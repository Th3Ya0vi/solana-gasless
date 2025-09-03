import type { NextApiRequest, NextApiResponse } from 'next'
import {
  Connection,
  clusterApiUrl,
  Keypair,
  Transaction,
} from '@solana/web3.js'
import { validateEnvVar, isValidPrivateKey, RateLimiter } from '../../utils/validation'

interface SubmitRequest {
  signedTransaction: string // Base64 encoded user-signed transaction
  mintKeypair: string // Base64 encoded mint keypair from claim-nft response
}

interface SubmitResponse {
  success: boolean
  signature?: string
  mintAddress?: string
  error?: string
}

// Rate limiter for submit attempts
const rateLimiter = new RateLimiter(3, 60000)

// Fee payer keypair (same as other endpoints)
const FEE_PAYER_PRIVATE_KEY = validateEnvVar('FEE_PAYER_PRIVATE_KEY', process.env.FEE_PAYER_PRIVATE_KEY)

if (!isValidPrivateKey(FEE_PAYER_PRIVATE_KEY)) {
  throw new Error('Invalid FEE_PAYER_PRIVATE_KEY format. Must be a JSON array of 64 numbers.')
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SubmitResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { signedTransaction, mintKeypair }: SubmitRequest = req.body

    if (!signedTransaction) {
      return res.status(400).json({ success: false, error: 'Signed transaction is required' })
    }

    if (!mintKeypair) {
      return res.status(400).json({ success: false, error: 'Mint keypair is required' })
    }

    // Initialize connection
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed')

    // Initialize fee payer from private key
    const feePayerKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(FEE_PAYER_PRIVATE_KEY))
    )

    // Deserialize the user-signed transaction
    const transactionBuffer = Buffer.from(signedTransaction, 'base64')
    const transaction = Transaction.from(transactionBuffer)

    // Deserialize the mint keypair
    const mintKeypairBuffer = Buffer.from(mintKeypair, 'base64')
    const mintKeypairData = JSON.parse(mintKeypairBuffer.toString())
    const mintKeypairObj = Keypair.fromSecretKey(Uint8Array.from(mintKeypairData))

    console.log('Received user-signed transaction for final processing:', {
      mint: mintKeypairObj.publicKey.toString(),
      userAlreadySigned: transaction.signatures.some(sig => sig.signature !== null),
      feePayer: feePayerKeypair.publicKey.toString(),
    })

    // Check fee payer balance before proceeding
    const feePayerBalance = await connection.getBalance(feePayerKeypair.publicKey)
    const minimumBalance = 0.01 * 1e9 // 0.01 SOL in lamports
    
    if (feePayerBalance < minimumBalance) {
      console.error('Fee payer balance too low:', feePayerBalance / 1e9, 'SOL')
      return res.status(503).json({ 
        success: false, 
        error: 'Service temporarily unavailable. Please try again later.' 
      })
    }

    // Rate limiting based on mint address to prevent duplicate submissions
    const mintAddress = mintKeypairObj.publicKey.toString()
    if (rateLimiter.isRateLimited(mintAddress)) {
      return res.status(429).json({ 
        success: false, 
        error: 'Transaction already being processed. Please wait.' 
      })
    }

    // Validate that the transaction is properly set up
    if (!transaction.feePayer) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid transaction: missing fee payer' 
      })
    }

    if (!transaction.recentBlockhash) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid transaction: missing recent blockhash' 
      })
    }

    // Ensure fee payer matches what we expect
    if (!transaction.feePayer.equals(feePayerKeypair.publicKey)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid transaction: fee payer mismatch' 
      })
    }

    // Add server signatures (fee payer + mint keypair)
    try {
      transaction.partialSign(feePayerKeypair, mintKeypairObj)
    } catch (error) {
      console.error('Error signing transaction:', error)
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to add server signatures to transaction' 
      })
    }

    // Verify all required signatures are present
    const allSignaturesPresent = transaction.verifySignatures()
    if (!allSignaturesPresent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transaction missing required signatures' 
      })
    }

    // Submit transaction to Solana network
    console.log('Submitting fully signed transaction to mainnet-beta...')
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      }
    )

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: transaction.recentBlockhash!,
      lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
    })

    if (confirmation.value.err) {
      console.error('Transaction failed on-chain:', confirmation.value.err)
      return res.status(500).json({
        success: false,
        error: 'Transaction failed on-chain: ' + JSON.stringify(confirmation.value.err),
      })
    }

    console.log('NFT successfully minted with user-first signing:', {
      signature,
      mint: mintAddress,
      confirmed: true,
      userSignedFirst: true,
    })

    return res.status(200).json({
      success: true,
      signature,
      mintAddress,
    })
  } catch (error) {
    console.error('Error submitting NFT transaction:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
