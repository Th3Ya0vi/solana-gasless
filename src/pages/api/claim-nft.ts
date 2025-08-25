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
  transaction?: string // Base64 encoded transaction for user signing
  signature?: string
  mintAddress?: string
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
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed')

    // Initialize fee payer from private key
    const feePayerKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(FEE_PAYER_PRIVATE_KEY))
    )

    // Check fee payer balance
    const feePayerBalance = await connection.getBalance(feePayerKeypair.publicKey)
    const minimumBalance = 0.01 * 1e9 // 0.01 SOL in lamports
    
    if (feePayerBalance < minimumBalance) {
      console.error('Fee payer balance too low:', feePayerBalance / 1e9, 'SOL')
      return res.status(503).json({ 
        success: false, 
        error: 'Service temporarily unavailable. Please try again later.' 
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

    // Step 1: Server creates mint and metadata in separate transaction (no ATA yet)
    const mintTransaction = new Transaction()
    
    // Add instruction to create mint account
    mintTransaction.add(
      SystemProgram.createAccount({
        fromPubkey: feePayerKeypair.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: rentExemption,
        programId: TOKEN_PROGRAM_ID,
      })
    )

    // Add instruction to initialize mint
    mintTransaction.add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        0, // 0 decimals for NFT
        feePayerKeypair.publicKey, // mint authority
        feePayerKeypair.publicKey, // freeze authority
        TOKEN_PROGRAM_ID
      )
    )

    // Prepare metadata with proper URI
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

    // Add instruction to create metadata
    mintTransaction.add(
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

    // Execute mint and metadata creation
    const { blockhash: mintBlockhash } = await connection.getLatestBlockhash()
    mintTransaction.recentBlockhash = mintBlockhash
    mintTransaction.feePayer = feePayerKeypair.publicKey
    mintTransaction.partialSign(feePayerKeypair, mintKeypair)
    
    const mintSignature = await connection.sendRawTransaction(mintTransaction.serialize())
    await connection.confirmTransaction(mintSignature, 'confirmed')
    
    console.log('Mint and metadata created by server:', mintSignature)

    // Step 2: Create ATA now that mint exists (if needed)
    const ataInfo = await connection.getAccountInfo(associatedTokenAddress)
    if (!ataInfo) {
      const ataTransaction = new Transaction()
      ataTransaction.add(
        createAssociatedTokenAccountInstruction(
          feePayerKeypair.publicKey, // payer (server pays)
          associatedTokenAddress,
          recipientPubkey, // owner
          mintKeypair.publicKey, // mint (now exists)
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
      
      const { blockhash: ataBlockhash } = await connection.getLatestBlockhash()
      ataTransaction.recentBlockhash = ataBlockhash
      ataTransaction.feePayer = feePayerKeypair.publicKey
      ataTransaction.partialSign(feePayerKeypair)
      
      const ataSignature = await connection.sendRawTransaction(ataTransaction.serialize())
      await connection.confirmTransaction(ataSignature, 'confirmed')
      
      console.log('ATA created by server:', ataSignature)
    }

    // Step 3: Build user transaction (just mint to ATA + memo)
    let transaction = new Transaction()

    // Add instruction to mint token to the ATA
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

    // Add memo instruction for user authorization (no account modifications)
    const memoText = `I authorize NFT mint: ${mintKeypair.publicKey.toString()}`
    const memoInstruction = new TransactionInstruction({
      keys: [
        {
          pubkey: recipientPubkey,
          isSigner: true, // User MUST sign for authorization
          isWritable: false, // NO account modifications - just authorization
        },
      ],
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      data: Buffer.from(memoText, 'utf8'),
    })
    transaction.add(memoInstruction)

    // Prepare transaction for user signing
    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = feePayerKeypair.publicKey // Server pays ALL fees
    
    // Server partially signs (handles all the actual minting)
    transaction.partialSign(feePayerKeypair, mintKeypair)
    
    // Return transaction for user authorization signature
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false, // User signature still needed
    })

    console.log('Transaction prepared for user authorization:', {
      mint: mintKeypair.publicKey.toString(),
      recipient: walletAddress,
      ataPreCreated: !ataInfo,
    })

    return res.status(200).json({
      success: true,
      transaction: Buffer.from(serializedTransaction).toString('base64'),
      mintAddress: mintKeypair.publicKey.toString(),
    })
  } catch (error) {
    console.error('Error minting NFT:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
