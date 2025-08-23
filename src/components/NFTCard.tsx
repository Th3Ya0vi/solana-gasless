import Image from 'next/image'

export function NFTCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-sm w-full shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="aspect-square relative mb-4 rounded-lg overflow-hidden bg-lavender/10">
        <Image
          src="/nft-image.png"
          alt="Free NFT"
          fill
          className="object-cover"
          priority
        />
      </div>
      
      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-ink">
          Exclusive NFT Collection
        </h3>
        
        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex justify-between">
            <span>Network:</span>
            <span className="text-brand font-medium">Solana</span>
          </div>
          <div className="flex justify-between">
            <span>Cost:</span>
            <span className="text-green font-medium">FREE</span>
          </div>
          <div className="flex justify-between">
            <span>Gas Fees:</span>
            <span className="text-green font-medium">$0.00</span>
          </div>
        </div>

        <div className="bg-lavender/20 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Description</div>
          <p className="text-sm text-ink">
            A unique digital collectible with exclusive artwork. 
            Claim yours for free with no gas fees required!
          </p>
        </div>
      </div>
    </div>
  )
}
