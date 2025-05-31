import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { TransactionResult, DevnetStatus } from '../types/websocket';

export interface DevnetStatusState {
  isDevnetDown: boolean;
  isTransactionsLocked: boolean;
  devnetMessage: string;
  failureCount: number;
  lastStatusUpdate: Date | null;
  status: 'up' | 'down' | 'unstable' | 'unknown';
}

export interface Transaction {
  id: string;
  timestamp: Date;
  action: string;
  txSignature: string;
  status: 'success' | 'failed';
  details?: string;
}

interface SystemState {
  // Devnet status state
  devnetStatus: DevnetStatusState;
  
  // Transaction state
  lastTransactionResult: TransactionResult | null;
  
  // Transaction history
  transactionHistory: Transaction[];
  
  // Current action being tracked
  currentAction: string | null;
}

interface SystemActions {
  // Devnet methods
  updateDevnetStatus: (data: DevnetStatus) => void;
  setDevnetStatus: (
    status: 'up' | 'down' | 'unstable',
    message?: string,
    failureCount?: number
  ) => void;
  
  // Transaction methods
  setLastTransactionResult: (result: TransactionResult) => void;
  
  // Transaction history methods
  addTransaction: (action: string, txSignature: string, status: 'success' | 'failed', details?: string) => void;
  clearTransactionHistory: () => void;
  
  // Action tracking methods
  setCurrentAction: (action: string) => void;
  clearCurrentAction: () => void;
  
  // Computed properties
  isSystemHealthy: () => boolean;
  canCreateWallet: () => boolean;
  canExecuteTransactions: () => boolean;
  getDevnetStatusMessage: () => string;
  
  // Toast method (simple console implementation for now)
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  
  // State management
  resetSystemState: () => void;
}

const initialDevnetStatus: DevnetStatusState = {
  isDevnetDown: false,
  isTransactionsLocked: false,
  devnetMessage: '',
  failureCount: 0,
  lastStatusUpdate: null,
  status: 'unknown',
};

const initialState: SystemState = {
  devnetStatus: initialDevnetStatus,
  lastTransactionResult: null,
  transactionHistory: [],
  currentAction: null,
};

export const useSystemStore = create<SystemState & SystemActions>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Devnet methods
      updateDevnetStatus: (data) => {
        set((state) => {
          state.devnetStatus = {
            isDevnetDown: data.status === 'down',
            isTransactionsLocked: data.status !== 'up',
            devnetMessage: data.message,
            failureCount: data.failureCount || 0,
            lastStatusUpdate: new Date(),
            status: data.status,
          };
        });
      },

      setDevnetStatus: (status, message = '', failureCount = 0) => {
        const newStatus: DevnetStatusState = {
          isDevnetDown: status === 'down',
          isTransactionsLocked: status === 'down' || status === 'unstable',
          devnetMessage: message,
          failureCount,
          lastStatusUpdate: new Date(),
          status,
        };

        set((state) => {
          state.devnetStatus = newStatus;
        });
      },

      // Transaction methods
      setLastTransactionResult: (result) => {
        set((state) => {
          state.lastTransactionResult = result;
        });

        // Add to transaction history if we have a signature
        if (result.txSignature) {
          const currentAction = get().currentAction || 'transaction';
          get().addTransaction(
            currentAction,
            result.txSignature,
            result.success ? 'success' : 'failed',
            result.error || undefined
          );
          
          // Clear the current action after processing
          get().clearCurrentAction();
        }
      },

      // Transaction history methods
      addTransaction: (action, txSignature, status, details) => {
        set((state) => {
          const newTransaction: Transaction = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            action,
            txSignature,
            status,
            details,
          };

          // Add to beginning of array and keep only last 50 transactions
          state.transactionHistory = [newTransaction, ...state.transactionHistory].slice(0, 50);
        });
      },

      clearTransactionHistory: () => {
        set((state) => {
          state.transactionHistory = [];
        });
      },

      // Action tracking methods
      setCurrentAction: (action) => {
        set((state) => {
          state.currentAction = action;
        });
      },

      clearCurrentAction: () => {
        set((state) => {
          state.currentAction = null;
        });
      },

      // Computed properties
      isSystemHealthy: () => {
        const { devnetStatus } = get();
        return !devnetStatus.isDevnetDown && !devnetStatus.isTransactionsLocked;
      },

      canCreateWallet: () => {
        const { devnetStatus } = get();
        return !devnetStatus.isDevnetDown;
      },

      canExecuteTransactions: () => {
        const { devnetStatus } = get();
        return !devnetStatus.isDevnetDown && !devnetStatus.isTransactionsLocked;
      },

      getDevnetStatusMessage: () => {
        const { devnetStatus } = get();
        
        switch (devnetStatus.status) {
          case 'down':
            return (
              devnetStatus.devnetMessage ||
              'Devnet is currently offline. Please try again in 2 hours.'
            );
          case 'unstable':
            return 'Devnet is unstable. Transactions are temporarily disabled.';
          case 'up':
            return 'System is operational';
          case 'unknown':
            return (
              devnetStatus.devnetMessage || 'Checking system status...'
            );
          default:
            return 'Checking system status...';
        }
      },

      // Toast method (simple console implementation)
      showToast: (message, type) => {
        switch (type) {
          case 'success':
            console.log('Success:', message);
            break;
          case 'error':
            console.error('Error:', message);
            break;
          case 'info':
            console.info('Info:', message);
            break;
          case 'warning':
            console.warn('Warning:', message);
            break;
          default:
            console.log(message);
        }
        
        // In a real implementation, you might want to:
        // - Dispatch to a toast notification system
        // - Add to a notifications array in state
        // - Integrate with react-hot-toast or similar library
      },

      // State management
      resetSystemState: () => {
        set((state) => {
          Object.assign(state, initialState);
        });
      },
    })),
    { name: 'system-store' }
  )
);