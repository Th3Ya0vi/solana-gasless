import type { NextApiRequest, NextApiResponse } from 'next'
import { NFT_METADATA } from '../../../config/nft-metadata'

// This endpoint serves NFT metadata JSON for wallets to display
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { mint } = req.query

  if (!mint || typeof mint !== 'string') {
    return res.status(400).json({ error: 'Mint address is required' })
  }

  try {
    // Get the base URL for the current request
    const protocol = req.headers['x-forwarded-proto'] || 'http'
    const host = req.headers.host
    const baseUrl = `${protocol}://${host}`
    
    // Create metadata with proper URLs
    const metadata = {
      name: NFT_METADATA.name,
      symbol: NFT_METADATA.symbol,
      description: NFT_METADATA.description,
      image: `${baseUrl}/nft-image.png`, // Full URL to image
      external_url: `${baseUrl}`,
      attributes: NFT_METADATA.attributes,
      properties: {
        ...NFT_METADATA.properties,
        files: [
          {
            uri: `${baseUrl}/nft-image.png`,
            type: "image/png"
          }
        ]
      }
    }

    // Set headers for JSON response
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    
    return res.status(200).json(metadata)
  } catch (error) {
    console.error('Error serving metadata:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
