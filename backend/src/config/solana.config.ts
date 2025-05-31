import { Connection, PublicKey } from '@solana/web3.js';

export const getSolanaConfig = () => ({
  // RPC URL
  RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  
  // Your AMM Program ID
  PROGRAM_ID: new PublicKey(process.env.SOLANA_PROGRAM_ID || '6xHiHJTYYHGiqX3jz65pmK6XXALQB8uESRJ72Ze29ZnD'),
  
  // Connection config
  CONNECTION_CONFIG: {
    commitment: 'confirmed' as const,
    wsEndpoint: process.env.SOLANA_WS_URL || 'wss://api.devnet.solana.com',
  },
  
  // Pool types
  POOL_TYPES: {
    STANDARD: 0,    // NTD-USD (0.3%)
    STABLE: 1,      // USD-JPY (0.05%)
    CONCENTRATED: 2, // NTD-JPY (0.5%)
  },
});

// Create connection instance
export const createSolanaConnection = (): Connection => {
  const config = getSolanaConfig();
  return new Connection(
    config.RPC_URL,
    config.CONNECTION_CONFIG.commitment
  );
};