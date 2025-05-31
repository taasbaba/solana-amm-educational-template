import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { PoolState } from '../types/websocket';

export interface PoolDataState {
  pools: {
    'NTD-USD': PoolState | null;
    'USD-YEN': PoolState | null;
    'NTD-YEN': PoolState | null;
  };
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isStale: boolean;
}

interface PoolStoreState {
  poolsData: PoolDataState;
}

interface PoolActions {
  // Pool data updates (called by websocketStore)
  updatePools: (data: { [key: string]: PoolState }) => void;
  
  // Pool data methods
  getPool: (poolType: string) => PoolState | null;
  isPoolLoading: (poolType: string) => boolean;
  getAllPools: () => PoolState[];
  getPoolByTokens: (tokenA: string, tokenB: string) => PoolState | null;
  
  // Pool state management
  markPoolsAsStale: () => void;
  clearPoolsStale: () => void;
  setPoolsLoading: (loading: boolean) => void;
  setPoolsError: (error: string | null) => void;
  resetPoolState: () => void;
}

// Helper function to extract token symbol from mint address
function getTokenSymbol(tokenAddress: string): string {
  const TOKEN_MAP: Record<string, string> = {
    [import.meta.env.VITE_NTD_MINT || '']: 'NTD',
    [import.meta.env.VITE_USD_MINT || '']: 'USD',
    [import.meta.env.VITE_YEN_MINT || '']: 'YEN',
  };
  return TOKEN_MAP[tokenAddress] || tokenAddress;
}

const initialState: PoolStoreState = {
  poolsData: {
    pools: {
      'NTD-USD': null,
      'USD-YEN': null,
      'NTD-YEN': null,
    },
    loading: true,
    error: null,
    lastUpdated: null,
    isStale: false,
  },
};

export const usePoolStore = create<PoolStoreState & PoolActions>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Pool data updates (called by websocketStore)
      updatePools: (data) => {
        set((state) => {
          state.poolsData.pools = {
            'NTD-USD': data['NTD-USD'] || null,
            'USD-YEN': data['USD-YEN'] || null,
            'NTD-YEN': data['NTD-YEN'] || null,
          };
          state.poolsData.loading = false;
          state.poolsData.error = null;
          state.poolsData.lastUpdated = new Date();
          state.poolsData.isStale = false;
        });
      },

      // Pool data methods
      getPool: (poolType) => {
        const { poolsData } = get();
        return poolsData.pools[poolType as keyof typeof poolsData.pools] || null;
      },

      isPoolLoading: (poolType) => {
        const { poolsData } = get();
        const pool = poolsData.pools[poolType as keyof typeof poolsData.pools];
        return poolsData.loading || !pool;
      },

      getAllPools: () => {
        const { poolsData } = get();
        return Object.values(poolsData.pools).filter(
          (pool): pool is PoolState => pool !== null
        );
      },

      getPoolByTokens: (tokenA, tokenB) => {
        const allPools = get().getAllPools();

        return (
          allPools.find((pool) => {
            const poolTokenA = getTokenSymbol(pool.tokenA);
            const poolTokenB = getTokenSymbol(pool.tokenB);

            return (
              (poolTokenA === tokenA && poolTokenB === tokenB) ||
              (poolTokenA === tokenB && poolTokenB === tokenA)
            );
          }) || null
        );
      },

      // Pool state management
      markPoolsAsStale: () => {
        set((state) => {
          state.poolsData.isStale = true;
          state.poolsData.error = 'Connection lost - pool data may be outdated';
        });
      },

      clearPoolsStale: () => {
        set((state) => {
          state.poolsData.isStale = false;
          state.poolsData.error = null;
        });
      },

      setPoolsLoading: (loading) => {
        set((state) => {
          state.poolsData.loading = loading;
        });
      },

      setPoolsError: (error) => {
        set((state) => {
          state.poolsData.error = error;
        });
      },

      resetPoolState: () => {
        set((state) => {
          Object.assign(state.poolsData, initialState.poolsData);
        });
      },
    })),
    { name: 'pool-store' }
  )
);