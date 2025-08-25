import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Transaction } from '@solana/web3.js'
import { Button } from '../components/Button'
import Head from 'next/head'

export default function Admin() {
  const { publicKey, connected, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const [mintAddress, setMintAddress] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'updating' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill with known minted NFTs
  const knownMints = [
    '2Vu8srRuPoyi7Mutm2b8bUiEoaY5iVTyuxJ53hEvcQwy',
    '7i6cG58EdzcRmZksexintMAS17LuuFuXSG9qF8oZAbyf',
    'H7YXWhXXMuN4xqSBHhiy8UGRAnvm14Adb1Kf3AELyfYs',
    '39tpSZfQnePaY7aN9xv1Y2qWqYJ5NTfjVWYZ7fr26vc1',
    'CerEezNk2QuYr2BWMa7QKkZjw1PUNt2E5BpQ8K4q3yP6'
  ]

  const handleUpdateMetadata = async () => {
    if (!connected || !publicKey || !sendTransaction) {
      setError('Please connect your wallet first')
      return
    }

    if (!mintAddress.trim()) {
      setError('Please enter a mint address')
      return
    }

    setUpdateStatus('updating')
    setError(null)
    setResult(null)

    try {
      // Step 1: Get the unsigned transaction from the API
      const response = await fetch('/api/update-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mintAddress: mintAddress.trim(),
          userPublicKey: publicKey.toString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create update transaction')
      }

      if (!data.transaction) {
        throw new Error('No transaction returned from server')
      }

      // Step 2: Deserialize the transaction
      const transactionBuffer = Buffer.from(data.transaction, 'base64')
      const transaction = Transaction.from(transactionBuffer)

      // Step 3: Sign and send transaction using wallet
      const signature = await sendTransaction(transaction, connection)

      console.log('NFT metadata updated successfully:', {
        signature,
        mint: mintAddress.trim(),
        metadataUri: data.metadataUri,
      })

      setResult({
        signature,
        metadataUri: data.metadataUri,
      })
      setUpdateStatus('success')
    } catch (err) {
      console.error('Error updating metadata:', err)
      setError(err instanceof Error ? err.message : 'Failed to update metadata')
      setUpdateStatus('error')
    }
  }

  const handleUpdateAll = async () => {
    if (!connected || !publicKey || !sendTransaction) {
      setError('Please connect your wallet first')
      return
    }

    for (const mint of knownMints) {
      setMintAddress(mint)
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms between updates
      await handleUpdateMetadata()
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s after each update
    }
  }

  return (
    <>
      <Head>
        <title>NFT Metadata Admin</title>
        <meta name="description" content="Update NFT metadata for already minted tokens" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-paper p-8">
        <div className="container mx-auto max-w-2xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-ink">
              NFT Metadata Admin
            </h1>
            <WalletMultiButton className="!bg-brand hover:!brightness-95" />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-ink mb-4">
              Update Individual NFT
            </h2>

            {!connected ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">
                  Connect your wallet to update NFT metadata
                </p>
                <WalletMultiButton className="!bg-brand hover:!brightness-95" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-400">
                  <p>Connected: {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}</p>
                </div>
                <div>
                  <label htmlFor="mintAddress" className="block text-sm font-medium text-gray-400 mb-2">
                    Mint Address
                  </label>
                  <input
                    id="mintAddress"
                    type="text"
                    value={mintAddress}
                    onChange={(e) => setMintAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    placeholder="Enter NFT mint address..."
                  />
                </div>

                <Button
                  onClick={handleUpdateMetadata}
                  loading={updateStatus === 'updating'}
                  className="w-full"
                >
                  {updateStatus === 'updating' ? 'Updating Metadata...' : 'Update Metadata'}
                </Button>

                {updateStatus === 'success' && result && (
                  <div className="bg-green/10 border border-green/20 rounded-lg p-4">
                    <div className="text-green font-medium mb-2">
                      ✅ Metadata Updated Successfully!
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>Signature: {result.signature}</div>
                      <div>Metadata URI: {result.metadataUri}</div>
                      <a
                        href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline"
                      >
                        View on Solana Explorer →
                      </a>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-orange/10 border border-orange/20 rounded-lg p-4">
                    <div className="text-orange font-medium mb-1">
                      ⚠️ Update Failed
                    </div>
                    <div className="text-sm text-gray-400">
                      {error}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-ink mb-4">
              Known Minted NFTs
            </h2>

            <div className="space-y-2 mb-4">
              {knownMints.map((mint, index) => (
                <div key={mint} className="flex items-center justify-between p-2 bg-lavender/10 rounded">
                  <span className="text-sm font-mono text-gray-400">
                    {mint.slice(0, 8)}...{mint.slice(-8)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setMintAddress(mint)}
                  >
                    Use This
                  </Button>
                </div>
              ))}
            </div>

            <Button
              onClick={handleUpdateAll}
              variant="secondary"
              className="w-full"
              disabled={updateStatus === 'updating'}
            >
              🚀 Update All Known NFTs
            </Button>

            <div className="mt-4 text-sm text-gray-400">
              <strong>Note:</strong> This will update metadata for all NFTs that were minted 
              before the metadata fix. Each NFT will get proper image and description display.
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

