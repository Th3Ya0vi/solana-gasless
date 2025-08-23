import { NFTMetadata } from '../types'

export const NFT_METADATA: NFTMetadata = {
  name: "Gasless NFT Collection #1",
  symbol: "GASLESS",
  description: "An exclusive NFT that demonstrates gasless transactions on Solana. This unique digital collectible was minted without any gas fees for the claimant, showcasing the power of sponsored transactions.",
  image: "/nft-image.png", // This will be replaced with IPFS URL in production
  external_url: "https://your-website.com",
  attributes: [
    {
      trait_type: "Network",
      value: "Solana"
    },
    {
      trait_type: "Type",
      value: "Gasless"
    },
    {
      trait_type: "Rarity",
      value: "Common"
    },
    {
      trait_type: "Collection",
      value: "Free Mint"
    }
  ],
  properties: {
    files: [
      {
        uri: "/nft-image.png",
        type: "image/png"
      }
    ],
    category: "image",
    creators: [
      {
        address: "", // Will be set to fee payer address
        share: 100
      }
    ]
  }
}
