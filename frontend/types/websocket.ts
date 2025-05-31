// WebSocket Event Types for Frontend

// ============ REQUEST EVENTS (Frontend to Backend) ============

export interface InitializeUserRequest {
  type: 'login' | 'signup';
}

export interface CreateWalletRequest {
  userId: string;
  email: string;
}

export interface GetProfileRequest {
  userId: string;
}

export interface UpdateProfileRequest {
  userId: string;
  updates: Record<string, any>;
}

export interface SwapRequest {
  poolType: 'NTD-USD' | 'USD-YEN' | 'NTD-YEN';
  amountIn: number;
  tokenType: 'A' | 'B';
  minAmountOut: number;
}

export interface AddLiquidityRequest {
  poolType: string;
  amountA: number;
  amountB: number;
}

export interface RemoveLiquidityRequest {
  poolType: string;
  lpAmount: number;
  minAmountA: number;
  minAmountB: number;
}

// ============ RESPONSE EVENTS (Backend to Frontend) ============

export interface InitializationResult {
  success: boolean;
  type?: 'login' | 'signup';
  hasWallet?: boolean;
  message?: string;
  error?: string;
  devnetDown?: boolean;
}

export interface WalletCreatedResult {
  success: boolean;
  wallet_address?: string;
  message: string;
  error?: string;
  devnetDown?: boolean;
}

export interface UserStatus {
  status: 'new_user' | 'existing_user';
  message: string;
  hasWallet: boolean;
}

export interface ProfileResult {
  success: boolean;
  profile?: UserProfile;
  error?: string;
}

export interface ProfileUpdatedResult {
  success: boolean;
  profile?: UserProfile;
  message?: string;
  error?: string;
}

export interface TransactionResult {
  success: boolean;
  txSignature?: string;
  message?: string;
  error?: string;
}

export interface BalanceUpdate {
  data: {
    NTD: number;
    USD: number;
    YEN: number;
    walletAddress: string;
  };
}

export interface UserPortfolio {
  data: {
    walletTokens: {
      NTD: number;
      USD: number;
      YEN: number;
    };
    lpPositions: {
      'NTD-USD': LPPosition;
      'USD-YEN': LPPosition;
      'NTD-YEN': LPPosition;
    };
  };
}

export interface LPPosition {
  lpAmount: number;
  sharePercent: number;
  underlyingNTD?: number;
  underlyingUSD?: number;
  underlyingYEN?: number;
}

type PoolKey = 'NTD-USD' | 'USD-YEN' | 'NTD-YEN';
export interface PoolsUpdate {
  data: Partial<Record<PoolKey, PoolState>>;
}
// export interface PoolsUpdate {
//   data: {
//     'NTD-USD': PoolState;
//     'USD-YEN': PoolState;
//     'NTD-YEN': PoolState;
//   };
// }

export interface PoolState {
  poolType: number;
  tokenA: string;
  tokenB: string;
  vaultABalance: number;
  vaultBBalance: number;
  feeRate: number;
  lpTokenSupply?: number;
  lastUpdated?: number;
}

export interface DevnetStatus {
  status: 'up' | 'down' | 'unstable';
  message: string;
  failureCount?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  wallet_address: string;
  created_at: string;
}

// ============ WEBSOCKET EVENT NAMES ============

export const WS_EVENTS = {
  // Outgoing (Frontend to Backend)
  INITIALIZE_USER: 'initialize_user',
  CREATE_WALLET: 'create_wallet',
  GET_PROFILE: 'get_profile',
  UPDATE_PROFILE: 'update_profile',
  SWAP: 'swap',
  ADD_LIQUIDITY: 'add_liquidity',
  REMOVE_LIQUIDITY: 'remove_liquidity',

  // Incoming (Backend to Frontend)
  INITIALIZATION_RESULT: 'initialization_result',
  WALLET_CREATED: 'wallet_created',
  USER_STATUS: 'user_status',
  PROFILE_RESULT: 'profile_result',
  PROFILE_UPDATED: 'profile_updated',
  TRANSACTION_RESULT: 'transaction_result',
  BALANCE_UPDATE: 'balance_update',
  USER_PORTFOLIO: 'user_portfolio',
  POOLS_UPDATE: 'pools_update',
  DEVNET_STATUS: 'devnet_status',

  // Connection Events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ERROR: 'reconnect_error',
  RECONNECT_FAILED: 'reconnect_failed',
} as const;

// ============ WEBSOCKET CONNECTION STATUS ============

export interface ConnectionStatus {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastConnected: Date | null;
}

// ============ DEVNET PROTECTION STATUS ============

export interface DevnetProtectionStatus {
  isDevnetDown: boolean;
  isTransactionsLocked: boolean;
  devnetMessage: string;
  lastStatusUpdate: Date | null;
}