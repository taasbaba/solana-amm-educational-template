// src/types/portfolio.types.ts

export interface BasePosition {
  lpAmount: number;
  sharePercent: number;
}

export interface NtdUsdPosition extends BasePosition {
  underlyingNTD: number;
  underlyingUSD: number;
}

export interface UsdYenPosition extends BasePosition {
  underlyingUSD: number;
  underlyingYEN: number;
}

export interface NtdYenPosition extends BasePosition {
  underlyingNTD: number;
  underlyingYEN: number;
}

export interface LpPositions {
  'NTD-USD': NtdUsdPosition;
  'USD-YEN': UsdYenPosition;
  'NTD-YEN': NtdYenPosition;
}

export interface WalletTokens {
  NTD: number;
  USD: number;
  YEN: number;
}

export interface PortfolioData {
  walletTokens: WalletTokens;
  lpPositions: LpPositions;
  walletAddress: string;
  lastUpdated: string;
}

export interface LpTokenData {
  balance: number;
  uiAmount: number;
  lpMint: string;
  userLpAccount: string;
  accountExists: boolean;
  error?: string;
}

export interface LiquidityPosition {
  pool: string;
  lpAmount: number;
  lpMint: string;
  userLpAccount: string;
}

export interface UserLiquidityPositions {
  activePoolsCount: number;
  activePools: LiquidityPosition[];
  totalLpTokens: number;
  walletAddress: string;
}
