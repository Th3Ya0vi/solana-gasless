import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Button } from '../components/Button'
import { NFTCard } from '../components/NFTCard'
import { ClaimStatus } from '../types'
import Head from 'next/head'
import Image from 'next/image'

export default function Home() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('idle')
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleClaimNFT = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first')
      return
    }

    setClaimStatus('claiming')
    setError(null)
    setTxSignature(null)

    try {
      const response = await fetch('/api/claim-nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to claim NFT')
      }

      setTxSignature(data.signature)
      setClaimStatus('success')
    } catch (err) {
      console.error('Error claiming NFT:', err)
      setError(err instanceof Error ? err.message : 'Failed to claim NFT')
      setClaimStatus('error')
    }
  }

  return (
    <>
      <Head>
        <title>Gasless NFT Claim</title>
        <meta name="description" content="Claim your free NFT with no gas fees!" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-paper">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <header className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-ink mb-4">
              Free NFT Claim
            </h1>
            <p className="text-lg text-gray-400 mb-6">
              Claim your exclusive NFT with zero gas fees!
            </p>
            <div className="flex justify-center">
              <WalletMultiButton className="!bg-brand hover:!brightness-95" />
            </div>
          </header>

          {/* Main Content */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* NFT Preview */}
            <div className="flex justify-center">
              <NFTCard />
            </div>

            {/* Claim Section */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-2xl font-semibold text-ink mb-4">
                  Claim Your NFT
                </h2>
                
                {!connected ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">
                      Connect your wallet to claim your free NFT
                    </p>
                    <WalletMultiButton className="!bg-brand hover:!brightness-95" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-400">
                      <p>Connected: {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}</p>
                    </div>

                    {claimStatus === 'idle' && (
                      <Button
                        onClick={handleClaimNFT}
                        size="lg"
                        className="w-full"
                      >
                        🎁 Claim Free NFT
                      </Button>
                    )}

                    {claimStatus === 'claiming' && (
                      <Button
                        loading
                        size="lg"
                        className="w-full"
                        disabled
                      >
                        Claiming NFT...
                      </Button>
                    )}

                    {claimStatus === 'success' && (
                      <div className="text-center py-4">
                        <div className="text-green text-lg font-semibold mb-2">
                          ✅ NFT Claimed Successfully!
                        </div>
                        {txSignature && (
                          <a
                            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline text-sm"
                          >
                            View Transaction →
                          </a>
                        )}
                      </div>
                    )}

                    {error && (
                      <div className="bg-orange/10 border border-orange/20 rounded-lg p-4">
                        <div className="text-orange font-medium mb-1">
                          ⚠️ Claim Failed
                        </div>
                        <div className="text-sm text-gray-400">
                          {error}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-lavender/20 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">⚡</div>
                  <div className="font-medium text-ink">Zero Gas Fees</div>
                  <div className="text-sm text-gray-400">We cover all costs</div>
                </div>
                <div className="bg-vanilla/20 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🎨</div>
                  <div className="font-medium text-ink">Unique NFT</div>
                  <div className="text-sm text-gray-400">Exclusive design</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
