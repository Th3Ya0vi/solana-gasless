# Gasless Solana NFT Claiming Site

A simple web application that allows users to claim NFTs on Solana without paying gas fees. The application uses a **fee payer mechanism** where the server sponsors all transaction costs, providing a seamless user experience.

## 🚀 Features

- **Zero Gas Fees**: Users can claim NFTs without holding SOL for transaction fees
- **Simple UI**: Clean, modern interface built with Next.js and Tailwind CSS
- **Wallet Integration**: Supports popular Solana wallets (Phantom, Solflare, etc.)
- **Rate Limiting**: Prevents spam and abuse with built-in rate limiting
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Brand Theme**: Follows consistent design system with custom color tokens

## 🛠 How Gasless Transactions Work

**Gasless transactions** on Solana are enabled through a **fee payer mechanism**:

1. **User initiates claim**: User connects their wallet and clicks "Claim NFT"
2. **Server creates transaction**: Backend creates an NFT minting transaction
3. **Fee payer sponsors**: Server's wallet pays all transaction fees (SOL)
4. **NFT delivered**: User receives the NFT in their wallet at zero cost

The fee payer wallet must be funded with SOL to cover:
- Account creation fees
- Transaction fees
- Rent for NFT accounts

## 📋 Prerequisites

- Node.js 18+ and npm
- Solana CLI tools (optional, for keypair management)
- A Solana wallet with some SOL for the fee payer (devnet for testing)

## 🔧 Quick Setup

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Generate Fee Payer Keypair

\`\`\`bash
node scripts/setup-fee-payer.js
\`\`\`

This script will:
- Generate a new Solana keypair for fee paying
- Create `.env.local` with your private key
- Show you the public key to fund

### 3. Fund Your Fee Payer Wallet

For **Devnet testing** (recommended):
\`\`\`bash
solana airdrop 2 YOUR_FEE_PAYER_PUBLIC_KEY --url devnet
\`\`\`

For **Mainnet production**:
- Transfer SOL to your fee payer public key
- Monitor balance regularly

### 4. Start Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000) to test NFT claiming!

## 📁 Project Structure

\`\`\`
src/
├── pages/
│   ├── _app.tsx              # App wrapper with wallet providers
│   ├── index.tsx             # Main claiming interface
│   └── api/
│       └── claim-nft.ts      # Gasless NFT minting endpoint
├── components/
│   ├── WalletConnectionProvider.tsx  # Solana wallet integration
│   ├── Button.tsx            # Reusable button component
│   └── NFTCard.tsx           # NFT preview card
├── config/
│   └── nft-metadata.ts       # NFT metadata configuration
├── utils/
│   ├── keypair-generator.ts  # Keypair generation utilities
│   └── validation.ts         # Validation and rate limiting
├── types/
│   └── index.ts              # TypeScript type definitions
└── styles/
    └── globals.css           # Global styles with brand theme
\`\`\`

## 🎨 Customization

### NFT Metadata

Edit \`src/config/nft-metadata.ts\` to customize your NFT:

\`\`\`typescript
export const NFT_METADATA = {
  name: "Your NFT Collection",
  symbol: "YOUR",
  description: "Description of your NFT",
  // ... other metadata
}
\`\`\`

### NFT Image

Replace \`public/nft-image.png\` with your NFT artwork.

### Brand Colors

The app uses a consistent design system defined in \`src/styles/globals.css\`. Customize the color tokens:

\`\`\`css
:root {
  --color-brand: #ab91f2;     /* Primary brand color */
  --color-paper: #fffdf8;     /* Background color */
  --color-ink: #1c1c1c;       /* Text color */
  /* ... other colors */
}
\`\`\`

## 🔒 Security & Production Notes

### Environment Variables

- **Never commit** your private key to version control
- Use separate keypairs for development and production
- Store production keys securely (e.g., encrypted environment variables)

### Monitoring

- Monitor fee payer wallet balance regularly
- Set up alerts for low balance
- Track transaction costs and usage patterns

### Rate Limiting

The app includes built-in rate limiting (3 claims per wallet per minute). Adjust in \`src/utils/validation.ts\`:

\`\`\`typescript
const rateLimiter = new RateLimiter(3, 60000) // 3 attempts, 1 minute window
\`\`\`

### Production Checklist

- [ ] Generate new fee payer keypair for production
- [ ] Fund fee payer wallet with sufficient SOL
- [ ] Upload NFT metadata to IPFS/Arweave
- [ ] Update metadata URIs in \`nft-metadata.ts\`
- [ ] Configure custom RPC endpoint if needed
- [ ] Set up monitoring and alerts
- [ ] Test claiming flow end-to-end

## 🌐 Deployment

### Vercel (Recommended)

\`\`\`bash
npm run build
vercel --prod
\`\`\`

Add your environment variables in Vercel dashboard:
- \`FEE_PAYER_PRIVATE_KEY\`: Your fee payer private key array

### Other Platforms

The app can be deployed to any platform supporting Next.js:
- Netlify
- Railway
- Heroku
- AWS/GCP/Azure

## 🤝 API Reference

### POST /api/claim-nft

Mints and transfers an NFT to a user's wallet using gasless transactions.

**Request Body:**
\`\`\`json
{
  "walletAddress": "user_solana_public_key"
}
\`\`\`

**Response (Success):**
\`\`\`json
{
  "success": true,
  "signature": "transaction_signature",
  "mint": "nft_mint_address"
}
\`\`\`

**Response (Error):**
\`\`\`json
{
  "success": false,
  "error": "error_message"
}
\`\`\`

## 🔍 Troubleshooting

### Common Issues

1. **"Fee payer balance too low"**
   - Fund your fee payer wallet with more SOL
   - Check balance: \`solana balance YOUR_PUBLIC_KEY --url devnet\`

2. **"Invalid wallet address"**
   - Ensure user has connected a valid Solana wallet
   - Check wallet is on correct network (devnet/mainnet)

3. **"Too many attempts"**
   - Rate limiting is active, wait 1 minute between attempts
   - Or adjust rate limits in \`src/utils/validation.ts\`

4. **Transaction fails**
   - Check Solana network status
   - Verify RPC endpoint is responsive
   - Check transaction on Solana Explorer

### Debug Mode

Set \`NODE_ENV=development\` for detailed error logs in the API.

## 📚 Learn More

- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Metaplex NFT Standards](https://docs.metaplex.com/)
- [Next.js Documentation](https://nextjs.org/docs)

## 📄 License

MIT License - feel free to use this project as a template for your own gasless NFT claiming sites!

---

Built with ❤️ using Solana, Next.js, and the power of gasless transactions.
