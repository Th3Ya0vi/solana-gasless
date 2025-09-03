import type { NextApiRequest, NextApiResponse } from 'next'
import {
  Connection,
  clusterApiUrl,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from '@metaplex-foundation/mpl-token-metadata'
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token'
import { ClaimRequest } from '../../types'

interface ClaimResponse {
  success: boolean
  transaction?: string // Base64 encoded unsigned transaction for user signing
  mintAddress?: string
  mintKeypair?: string // Base64 encoded mint keypair for server signing later
  error?: string
}

import { NFT_METADATA } from '../../config/nft-metadata'
import { isValidSolanaAddress, validateEnvVar, isValidPrivateKey, RateLimiter } from '../../utils/validation'

// Rate limiter to prevent spam (3 attempts per wallet per minute)
const rateLimiter = new RateLimiter(3, 60000)

// Fee payer keypair (in production, store this securely)
const FEE_PAYER_PRIVATE_KEY = validateEnvVar('FEE_PAYER_PRIVATE_KEY', process.env.FEE_PAYER_PRIVATE_KEY)

if (!isValidPrivateKey(FEE_PAYER_PRIVATE_KEY)) {
  throw new Error('Invalid FEE_PAYER_PRIVATE_KEY format. Must be a JSON array of 64 numbers.')
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClaimResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { walletAddress }: ClaimRequest = req.body

    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'Wallet address is required' })
    }

    // Validate wallet address format
    if (!isValidSolanaAddress(walletAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address format' })
    }

    // Rate limiting check
    if (rateLimiter.isRateLimited(walletAddress)) {
      return res.status(429).json({ 
        success: false, 
        error: 'Too many attempts. Please wait before claiming again.' 
      })
    }

    const recipientPubkey = new PublicKey(walletAddress)

    // Initialize connection
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed')

    // Check if recipient wallet exists on-chain (never had SOL = doesn't exist)
    const recipientAccountInfo = await connection.getAccountInfo(recipientPubkey)
    const recipientNeedsInitialization = !recipientAccountInfo

    // Initialize fee payer from private key
    const feePayerKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(FEE_PAYER_PRIVATE_KEY))
    )

    // Check fee payer balance (accounting for potential recipient initialization)
    const feePayerBalance = await connection.getBalance(feePayerKeypair.publicKey)
    const baseMinimum = 0.1 * 1e9 // Base minimum for NFT transaction
    const initializationCost = recipientNeedsInitialization ? await connection.getMinimumBalanceForRentExemption(0) : 0
    const minimumBalance = baseMinimum + initializationCost
    
    if (feePayerBalance < minimumBalance) {
      console.error('Fee payer balance too low:', feePayerBalance / 1e9, 'SOL', 'Required:', minimumBalance / 1e9, 'SOL', 'Including recipient init:', recipientNeedsInitialization)
      const errorMsg = recipientNeedsInitialization 
        ? `Insufficient balance for NFT minting. Fee payer has ${(feePayerBalance / 1e9).toFixed(3)} SOL but needs ${(minimumBalance / 1e9).toFixed(3)} SOL (includes ${(initializationCost / 1e9).toFixed(3)} SOL to initialize new wallet).`
        : `Insufficient balance for NFT minting. Fee payer has ${(feePayerBalance / 1e9).toFixed(3)} SOL but needs at least ${(minimumBalance / 1e9).toFixed(1)} SOL for mainnet transactions.`
      
      return res.status(503).json({ 
        success: false, 
        error: errorMsg
      })
    }

    // Create mint keypair
    const mintKeypair = Keypair.generate()

    // Get associated token account address
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      recipientPubkey
    )

    // Create metadata address
    const [metadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )

    // Get minimum balance for rent exemption
    const rentExemption = await getMinimumBalanceForRentExemptMint(connection)

    // Build the complete transaction (all instructions in one transaction)
    const transaction = new Transaction()
    
    // 0. If recipient wallet doesn't exist, initialize it with minimum SOL
    if (recipientNeedsInitialization) {
      const minBalanceForAccount = await connection.getMinimumBalanceForRentExemption(0) // Basic account
      console.log(`Initializing recipient wallet ${walletAddress} with ${minBalanceForAccount / 1e9} SOL`)
      
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: feePayerKeypair.publicKey,
          toPubkey: recipientPubkey,
          lamports: minBalanceForAccount,
        })
      )
    }
    
    // 1. Add instruction to create mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: feePayerKeypair.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: rentExemption,
        programId: TOKEN_PROGRAM_ID,
      })
    )

    // 2. Add instruction to initialize mint
    transaction.add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        0, // 0 decimals for NFT
        feePayerKeypair.publicKey, // mint authority
        feePayerKeypair.publicKey, // freeze authority
        TOKEN_PROGRAM_ID
      )
    )

    // 3. Prepare metadata with proper URI
    const protocol = req.headers['x-forwarded-proto'] || 'http'
    const host = req.headers.host
    const baseUrl = `${protocol}://${host}`
    const metadataUri = `${baseUrl}/api/metadata/${mintKeypair.publicKey.toString()}`
    
    const metadata = {
      ...NFT_METADATA,
      properties: {
        ...NFT_METADATA.properties,
        creators: [
          {
            address: feePayerKeypair.publicKey.toString(),
            share: 100,
          },
        ],
      },
    }

    // 4. Add instruction to create metadata
    transaction.add(
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAddress,
          mint: mintKeypair.publicKey,
          mintAuthority: feePayerKeypair.publicKey,
          payer: feePayerKeypair.publicKey,
          updateAuthority: feePayerKeypair.publicKey,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name: metadata.name,
              symbol: metadata.symbol,
              uri: metadataUri,
              sellerFeeBasisPoints: 0,
              creators: metadata.properties?.creators?.map(creator => ({
                address: new PublicKey(creator.address),
                verified: true,
                share: creator.share,
              })) || [],
              collection: null,
              uses: null,
            },
            isMutable: true,
            collectionDetails: null,
          },
        }
      )
    )

    // 5. Check if ATA exists, if not add instruction to create it
    const ataInfo = await connection.getAccountInfo(associatedTokenAddress)
    if (!ataInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          feePayerKeypair.publicKey, // payer (server pays)
          associatedTokenAddress,
          recipientPubkey, // owner
          mintKeypair.publicKey, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    }

    // 6. Add instruction to mint token to the ATA
    transaction.add(
      createMintToInstruction(
        mintKeypair.publicKey,
        associatedTokenAddress,
        feePayerKeypair.publicKey,
        1, // amount (1 for NFT)
        [],
        TOKEN_PROGRAM_ID
      )
    )

    // 7. Add memo instruction for user authorization - this shouldn't trigger balance check
    const memoText = `NFT Claim Authorization for ${mintKeypair.publicKey.toString()}`
    const memoInstruction = new TransactionInstruction({
      keys: [
        {
          pubkey: recipientPubkey,
          isSigner: true, // User signature required for authorization
          isWritable: false, // Not modifying any accounts - just authorization
        },
      ],
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), // Memo program
      data: Buffer.from(memoText, 'utf8'),
    })
    transaction.add(memoInstruction)

    // Set transaction metadata
    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = feePayerKeypair.publicKey // Server pays ALL fees
    
    // Return unsigned transaction for user to sign first
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false, // Allow missing signatures
      verifySignatures: false, // Don't verify since no signatures yet
    })

    console.log('Transaction prepared for user signing:', {
      mint: mintKeypair.publicKey.toString(),
      recipient: walletAddress,
      recipientNeedsInitialization,
      ataToBeCreated: !ataInfo,
      instructionCount: transaction.instructions.length,
    })

    return res.status(200).json({
      success: true,
      transaction: Buffer.from(serializedTransaction).toString('base64'),
      mintAddress: mintKeypair.publicKey.toString(),
      mintKeypair: Buffer.from(JSON.stringify(Array.from(mintKeypair.secretKey))).toString('base64'),
    })
  } catch (error) {
    console.error('Error preparing NFT transaction:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
