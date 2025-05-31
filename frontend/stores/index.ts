// Store imports
import { useAuthStore } from './authStore';
import { useWalletStore } from './walletStore';  
import { usePoolStore } from './poolStore';
import { useWebSocketStore } from './websocketStore';
import { useSystemStore } from './systemStore';

// Store exports
export { useAuthStore } from './authStore';
export { useWalletStore } from './walletStore';  
export { usePoolStore } from './poolStore';
export { useWebSocketStore } from './websocketStore';
export { useSystemStore } from './systemStore';

// Type exports
export type { WalletBalance, LPPositions } from './walletStore';
export type { PoolDataState } from './poolStore';
export type { DevnetStatusState } from './systemStore';

// Store initialization helper
export const initializeStores = async () => {
  const authStore = useAuthStore.getState();
  
  // Initialize auth session if not already done
  if (!authStore.initialized) {
    await authStore.initializeSession();
  }
};

// Store reset helper for testing or logout
export const resetAllStores = () => {
  useAuthStore.getState().resetAuthState();
  useWalletStore.getState().resetWalletState();
  usePoolStore.getState().resetPoolState();
  useWebSocketStore.getState().resetWebSocketState();
  useSystemStore.getState().resetSystemState();
};