import { PublicKey } from '@solana/web3.js'

/**
 * Validates if a string is a valid Solana public key
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * Validates if an environment variable exists and is not empty
 */
export function validateEnvVar(name: string, value?: string): string {
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set`)
  }
  return value
}

/**
 * Validates if a private key string is valid
 */
export function isValidPrivateKey(privateKeyString: string): boolean {
  try {
    const parsed = JSON.parse(privateKeyString)
    return Array.isArray(parsed) && parsed.length === 64 && parsed.every(n => typeof n === 'number' && n >= 0 && n <= 255)
  } catch {
    return false
  }
}

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map()

  constructor(
    private maxAttempts: number = 3,
    private windowMs: number = 60000 // 1 minute
  ) {}

  isRateLimited(key: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []
    
    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs)
    
    if (recentAttempts.length >= this.maxAttempts) {
      return true
    }
    
    // Add current attempt
    recentAttempts.push(now)
    this.attempts.set(key, recentAttempts)
    
    return false
  }
}
