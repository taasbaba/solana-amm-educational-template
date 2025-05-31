/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  
  // Solana Network
  readonly VITE_SOLANA_NETWORK: string
  readonly VITE_SOLANA_CLUSTER: string
  
  // AMM Program
  readonly VITE_PROGRAM_ID: string
  
  // Tokens
  readonly VITE_TOKEN_A_MINT: string
  readonly VITE_TOKEN_B_MINT: string
  
  // Admin
  readonly VITE_ADMIN_WALLET_PRIVATE_KEY: string
  
  // Pool Configuration
  readonly VITE_POOL_PDA: string
  readonly VITE_POOL_AUTHORITY: string
  readonly VITE_LP_MINT: string
  readonly VITE_VAULT_A: string
  readonly VITE_VAULT_B: string
  
  // Game Configuration
  readonly VITE_STARTING_TOKEN_A_AMOUNT: string
  readonly VITE_STARTING_TOKEN_B_AMOUNT: string
  readonly VITE_POOL_INITIAL_TOKEN_A: string
  readonly VITE_POOL_INITIAL_TOKEN_B: string
  readonly VITE_TRADING_FEE_PERCENTAGE: string
  readonly VITE_LP_FEE_PERCENTAGE: string
  readonly VITE_MIN_SWAP_AMOUNT: string
  readonly VITE_MIN_LP_AMOUNT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}