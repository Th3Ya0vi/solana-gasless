export type ClaimStatus = 'idle' | 'claiming' | 'success' | 'error'

export interface NFTMetadata {
  name: string
  symbol: string
  description: string
  image: string
  external_url?: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
  properties?: {
    files?: Array<{
      uri: string
      type: string
    }>
    category?: string
    creators?: Array<{
      address: string
      share: number
    }>
  }
}

export interface ClaimRequest {
  walletAddress: string
}

export interface ClaimResponse {
  success: boolean
  signature?: string
  mintAddress?: string
  error?: string
}
