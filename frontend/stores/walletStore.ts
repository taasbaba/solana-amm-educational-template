import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface WalletBalance {
  NTD: number;
  USD: number;
  YEN: number;
  walletAddress?: string;
}

export interface LPPositions {
  'NTD-USD': {
    lpAmount: number;
    sharePercent: number;
    underlyingNTD: number;
    underlyingUSD: number;
  };
  'USD-YEN': {
    lpAmount: number;
    sharePercent: number;
    underlyingUSD: number;
    underlyingYEN: number;
  };
  'NTD-YEN': {
    lpAmount: number;
    sharePercent: number;
    underlyingNTD: number;
    underlyingYEN: number;
  };
}

interface WalletState {
  // Wallet balance state
  walletBalance: WalletBalance | null;
  lpPositions: LPPositions | null;
  balanceLoading: boolean;
  balanceError: string | null;
  balanceLastUpdated: Date | null;
}

interface WalletActions {
  // Balance update methods (called by websocketStore)
  updateBalance: (data: { NTD: number; USD: number; YEN: number; walletAddress?: string }) => void;
  updatePortfolio: (data: {
    walletTokens: { NTD: number; USD: number; YEN: number };
    walletAddress?: string;
    lpPositions: any;
  }) => void;
  
  // Balance operations
  refreshBalance: () => void;
  
  // Balance calculations
  getTotalBalance: () => number;
  getTokenBalance: (token: 'NTD' | 'USD' | 'YEN') => number;
  hasPosition: (poolType: string) => boolean;
  getTotalLPTokens: () => number;
  
  // State management
  setBalanceLoading: (loading: boolean) => void;
  setBalanceError: (error: string | null) => void;
  resetWalletState: () => void;
}

const initialState: WalletState = {
  walletBalance: null,
  lpPositions: null,
  balanceLoading: true,
  balanceError: null,
  balanceLastUpdated: null,
};

export const useWalletStore = create<WalletState & WalletActions>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Balance update methods (called by websocketStore)
      updateBalance: (data) => {
        set((state) => {
          state.walletBalance = {
            NTD: data.NTD || 0,
            USD: data.USD || 0,
            YEN: data.YEN || 0,
            walletAddress: data.walletAddress,
          };
          state.balanceLoading = false;
          state.balanceError = null;
          state.balanceLastUpdated = new Date();
        });
      },

      updatePortfolio: (data) => {
        const lpPositions: LPPositions = {
          'NTD-USD': {
            lpAmount: data.lpPositions['NTD-USD']?.lpAmount || 0,
            sharePercent: data.lpPositions['NTD-USD']?.sharePercent || 0,
            underlyingNTD: data.lpPositions['NTD-USD']?.underlyingNTD || 0,
            underlyingUSD: data.lpPositions['NTD-USD']?.underlyingUSD || 0,
          },
          'USD-YEN': {
            lpAmount: data.lpPositions['USD-YEN']?.lpAmount || 0,
            sharePercent: data.lpPositions['USD-YEN']?.sharePercent || 0,
            underlyingUSD: data.lpPositions['USD-YEN']?.underlyingUSD || 0,
            underlyingYEN: data.lpPositions['USD-YEN']?.underlyingYEN || 0,
          },
          'NTD-YEN': {
            lpAmount: data.lpPositions['NTD-YEN']?.lpAmount || 0,
            sharePercent: data.lpPositions['NTD-YEN']?.sharePercent || 0,
            underlyingNTD: data.lpPositions['NTD-YEN']?.underlyingNTD || 0,
            underlyingYEN: data.lpPositions['NTD-YEN']?.underlyingYEN || 0,
          },
        };

        set((state) => {
          state.walletBalance = {
            NTD: data.walletTokens.NTD || 0,
            USD: data.walletTokens.USD || 0,
            YEN: data.walletTokens.YEN || 0,
            walletAddress: data.walletAddress,
          };
          state.lpPositions = lpPositions;
          state.balanceLoading = false;
          state.balanceError = null;
          state.balanceLastUpdated = new Date();
        });
      },

      // Balance operations
      refreshBalance: () => {
        const getAuthUser = async () => {
          const { useAuthStore } = await import('./authStore');
          return useAuthStore.getState().user;
        };

        const getSocketAndWallet = async () => {
          const { useWebSocketStore } = await import('./websocketStore');
          const { useAuthStore } = await import('./authStore');
          
          const websocketState = useWebSocketStore.getState();
          const authState = useAuthStore.getState();
          
          return {
            socket: websocketState.socket,
            isConnected: websocketState.isConnected,
            user: authState.user,
            hasWallet: authState.hasWallet,
          };
        };

        getSocketAndWallet().then(({ socket, isConnected, user, hasWallet }) => {
          if (!socket || !isConnected || !user || !hasWallet) {
            return;
          }

          set((state) => {
            state.balanceLoading = true;
            state.balanceError = null;
          });

          // Emit refresh balance event
          const { useWebSocketStore } = require('./websocketStore');
          useWebSocketStore.getState().emit('REFRESH_BALANCE', { userId: user.id });
        });
      },

      // Balance calculations
      getTotalBalance: () => {
        const { walletBalance } = get();
        
        if (!walletBalance) {
          return 0;
        }

        // Exchange rates (same as original useApp)
        const rates = {
          NTD: 0.032,
          USD: 1,
          YEN: 0.0067,
        };

        const ntdValue = (walletBalance.NTD || 0) * rates.NTD;
        const usdValue = (walletBalance.USD || 0) * rates.USD;
        const yenValue = (walletBalance.YEN || 0) * rates.YEN;

        return ntdValue + usdValue + yenValue;
      },

      getTokenBalance: (token) => {
        const { walletBalance } = get();
        return walletBalance?.[token] || 0;
      },

      hasPosition: (poolType) => {
        const { lpPositions } = get();
        
        if (!lpPositions) {
          return false;
        }

        const position = lpPositions[poolType as keyof LPPositions];
        return position ? position.lpAmount > 0 : false;
      },

      getTotalLPTokens: () => {
        const { lpPositions } = get();
        
        if (!lpPositions) {
          return 0;
        }

        const ntdUsdLP = lpPositions['NTD-USD']?.lpAmount || 0;
        const usdYenLP = lpPositions['USD-YEN']?.lpAmount || 0;
        const ntdYenLP = lpPositions['NTD-YEN']?.lpAmount || 0;

        return ntdUsdLP + usdYenLP + ntdYenLP;
      },

      // State management
      setBalanceLoading: (loading) => {
        set((state) => {
          state.balanceLoading = loading;
        });
      },

      setBalanceError: (error) => {
        set((state) => {
          state.balanceError = error;
        });
      },

      resetWalletState: () => {
        set((state) => {
          Object.assign(state, initialState);
        });
      },
    })),
    { name: 'wallet-store' }
  )
);