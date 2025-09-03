import type { NextApiRequest, NextApiResponse } from 'next'
import {
  Connection,
  clusterApiUrl,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js'
import {
  createUpdateMetadataAccountV2Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from '@metaplex-foundation/mpl-token-metadata'
import { NFT_METADATA } from '../../config/nft-metadata'
import { validateEnvVar, isValidPrivateKey } from '../../utils/validation'

// Fee payer keypair (same as minting)
const FEE_PAYER_PRIVATE_KEY = validateEnvVar('FEE_PAYER_PRIVATE_KEY', process.env.FEE_PAYER_PRIVATE_KEY)

if (!isValidPrivateKey(FEE_PAYER_PRIVATE_KEY)) {
  throw new Error('Invalid FEE_PAYER_PRIVATE_KEY format. Must be a JSON array of 64 numbers.')
}

interface UpdateRequest {
  mintAddress: string
  userPublicKey: string
}

interface UpdateResponse {
  success: boolean
  transaction?: string // Base64 encoded unsigned transaction
  signature?: string
  error?: string
  metadataUri?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { mintAddress, userPublicKey }: UpdateRequest = req.body

    if (!mintAddress) {
      return res.status(400).json({ success: false, error: 'Mint address is required' })
    }

    if (!userPublicKey) {
      return res.status(400).json({ success: false, error: 'User public key is required' })
    }

    // Validate mint address
    let mintPubkey: PublicKey
    try {
      mintPubkey = new PublicKey(mintAddress)
    } catch (error) {
      return res.status(400).json({ success: false, error: 'Invalid mint address' })
    }

    // Initialize connection
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed')

    // Initialize fee payer from private key
    const feePayerKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(FEE_PAYER_PRIVATE_KEY))
    )

    // Create metadata URI
    const protocol = req.headers['x-forwarded-proto'] || 'http'
    const host = req.headers.host
    const baseUrl = `${protocol}://${host}`
    const metadataUri = `${baseUrl}/api/metadata/${mintAddress}`

    // Get metadata address
    const [metadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintPubkey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )

    // Build transaction to update metadata
    const transaction = new Transaction()

    // Add instruction to update metadata
    transaction.add(
      createUpdateMetadataAccountV2Instruction(
        {
          metadata: metadataAddress,
          updateAuthority: feePayerKeypair.publicKey,
        },
        {
          updateMetadataAccountArgsV2: {
            data: {
              name: NFT_METADATA.name,
              symbol: NFT_METADATA.symbol,
              uri: metadataUri,
              sellerFeeBasisPoints: 0,
              creators: [
                {
                  address: feePayerKeypair.publicKey,
                  verified: true,
                  share: 100,
                },
              ],
              collection: null,
              uses: null,
            },
            updateAuthority: feePayerKeypair.publicKey,
            primarySaleHappened: null,
            isMutable: null, // Keep as is
          },
        }
      )
    )

    // Add user as a required signer by adding a 0 SOL transfer to themselves
    const userPubkey = new PublicKey(userPublicKey)
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: userPubkey,
        lamports: 0, // 0 SOL transfer to require user signature
      })
    )

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = feePayerKeypair.publicKey

    // Partially sign transaction with fee payer only
    // User will sign when they receive the transaction
    transaction.partialSign(feePayerKeypair)

    // Serialize the partially signed transaction for client signing
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false, // Allow missing user signature
    })

    console.log('Unsigned transaction created for metadata update:', {
      mint: mintAddress,
      metadataUri,
    })

    return res.status(200).json({
      success: true,
      transaction: Buffer.from(serializedTransaction).toString('base64'),
      metadataUri,
    })
  } catch (error) {
    console.error('Error updating NFT metadata:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}

