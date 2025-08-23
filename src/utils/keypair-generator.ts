import { Keypair } from '@solana/web3.js'
import fs from 'fs'
import path from 'path'

/**
 * Generates a new Solana keypair for use as a fee payer
 * This should be run once during setup
 */
export function generateFeePayerKeypair(): Keypair {
  const keypair = Keypair.generate()
  
  console.log('Generated new fee payer keypair:')
  console.log('Public Key:', keypair.publicKey.toString())
  console.log('Private Key (save this securely):', JSON.stringify(Array.from(keypair.secretKey)))
  
  return keypair
}

/**
 * Save keypair to a file for development purposes
 * DO NOT use this in production
 */
export function saveKeypairToFile(keypair: Keypair, filename: string = 'fee-payer-keypair.json'): void {
  const keypairPath = path.join(process.cwd(), filename)
  const keypairData = {
    publicKey: keypair.publicKey.toString(),
    secretKey: Array.from(keypair.secretKey)
  }
  
  fs.writeFileSync(keypairPath, JSON.stringify(keypairData, null, 2))
  console.log(`Keypair saved to: ${keypairPath}`)
  console.log('Remember to add this file to .gitignore!')
}

// CLI script
if (require.main === module) {
  const keypair = generateFeePayerKeypair()
  saveKeypairToFile(keypair)
  
  console.log('\n📋 Next steps:')
  console.log('1. Fund your fee payer wallet with some SOL (devnet):')
  console.log(`   solana airdrop 2 ${keypair.publicKey.toString()} --url devnet`)
  console.log('2. Create .env.local and add your private key:')
  console.log(`   FEE_PAYER_PRIVATE_KEY=${JSON.stringify(Array.from(keypair.secretKey))}`)
}
