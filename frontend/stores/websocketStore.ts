import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import { io, Socket } from 'socket.io-client';
import {
  WS_EVENTS,
  InitializationResult,
  WalletCreatedResult,
  UserStatus,
  InitializeUserRequest,
  PoolsUpdate,
  TransactionResult,
  BalanceUpdate,
  UserPortfolio,
  DevnetStatus,
} from '../types/websocket';

interface WebSocketState {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  reconnectAttempts: number;
  connectedForUser: string | null;
  initializationAttempted: boolean;
}

interface WebSocketActions {
  // Connection management
  connect: (token: string) => Promise<void>;
  disconnect: () => void;
  retryConnection: () => Promise<void>;
  
  // Socket operations
  emit: (event: string, data?: any) => void;
  createWallet: () => void;
  
  // Internal methods
  setupEventListeners: (socket: Socket) => void;
  createSocketConnection: (token: string) => Promise<Socket>;
  initializeUser: () => void;
  
  // State management
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setConnectionError: (error: string | null) => void;
  resetWebSocketState: () => void;
}

// Global socket manager (matches original useApp pattern)
const socketManager = {
  socket: null as Socket | null,
  user: null as any,
  initialized: false,
  isConnecting: false,
};

// Safe event listener helper to avoid duplicates
function safeOn<T>(socket: Socket, event: string, handler: (data: T) => void) {
  socket.off(event);
  socket.on(event, handler);
}

const initialState: WebSocketState = {
  socket: socketManager.socket,
  isConnected: socketManager.socket?.connected || false,
  isConnecting: socketManager.isConnecting,
  connectionError: null,
  reconnectAttempts: 0,
  connectedForUser: null,
  initializationAttempted: false,
};

export const useWebSocketStore = create<WebSocketState & WebSocketActions>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Connection management
      connect: async (token: string) => {
        const currentState = get();
        
        set((state) => {
          if (currentState.socket?.connected) {
            Object.assign(state, {
              isConnected: true,
              isConnecting: false,
              connectionError: null,
            });
          }
        });
        
        if (currentState.socket?.connected) {
          return;
        }

        if (currentState.isConnecting) {
          return;
        }

        try {
          set((state) => {
            state.isConnecting = true;
            state.connectionError = null;
          });
          socketManager.isConnecting = true;

          const socket = await get().createSocketConnection(token);
          get().setupEventListeners(socket);

          set((state) => {
            // Use Object.assign to avoid Immer issues with Socket object
            Object.assign(state, {
              socket,
              isConnected: true,
              isConnecting: false,
              connectionError: null,
              reconnectAttempts: 0,
            });
          });

          // Initialize user after connection
          setTimeout(() => {
            get().initializeUser();
          }, 100);

        } catch (err) {
          set((state) => {
            state.isConnecting = false;
            state.connectionError = err instanceof Error ? err.message : 'Failed to connect';
            state.reconnectAttempts = state.reconnectAttempts + 1;
          });
        } finally {
          socketManager.isConnecting = false;
        }
      },

      disconnect: () => {
        const { socket } = get();
        
        if (socket) {
          socket.disconnect();
          socket.removeAllListeners();
          socketManager.socket = null;
        }

        set((state) => {
          Object.assign(state, {
            socket: null,
            isConnected: false,
            isConnecting: false,
            connectionError: null,
            connectedForUser: null,
            initializationAttempted: false,
          });
        });
      },

      retryConnection: async () => {
        const getAuthData = async () => {
          const { supabase } = await import('../lib/supabase');
          return await supabase.auth.getSession();
        };

        try {
          const { data: { session }, error } = await getAuthData();

          if (error || !session?.access_token) {
            set((state) => {
              state.connectionError = 'Authentication session expired';
            });
            return;
          }

          // Reset connection state
          set((state) => {
            state.connectedForUser = null;
            state.initializationAttempted = false;
          });

          await get().connect(session.access_token);
        } catch (error) {
          set((state) => {
            state.connectionError = error instanceof Error ? error.message : 'Retry failed';
          });
        }
      },

      // Socket operations
      emit: (event, data) => {
        const { socket } = get();
        
        if (socket?.connected) {
          // Store the action type for transaction result mapping
          if ([WS_EVENTS.SWAP, WS_EVENTS.ADD_LIQUIDITY, WS_EVENTS.REMOVE_LIQUIDITY].includes(event as any)) {
            const actionMap: { [key: string]: string } = {
              [WS_EVENTS.SWAP]: 'swap',
              [WS_EVENTS.ADD_LIQUIDITY]: 'add_liquidity',
              [WS_EVENTS.REMOVE_LIQUIDITY]: 'remove_liquidity',
            };
            
            // Store current action in systemStore for later use
            import('./systemStore').then(({ useSystemStore }) => {
              useSystemStore.getState().setCurrentAction(actionMap[event] || event);
            });
          }
          
          socket.emit(event, data);
        } else {
          console.warn('Cannot emit event - socket not connected:', event);
        }
      },

      createWallet: () => {
        const getAuthUser = async () => {
          const { useAuthStore } = await import('./authStore');
          return useAuthStore.getState().user;
        };

        const getSystemStatus = async () => {
          const { useSystemStore } = await import('./systemStore');
          return useSystemStore.getState().devnetStatus;
        };

        Promise.all([getAuthUser(), getSystemStatus()]).then(([user, devnetStatus]) => {
          const { socket, isConnected } = get();
          
          if (!user || devnetStatus.isDevnetDown || !socket?.connected || !isConnected) {
            return;
          }

          // Set creating wallet state in authStore
          import('./authStore').then(({ useAuthStore }) => {
            useAuthStore.getState().setCreatingWallet(true);
          });

          socket.emit(WS_EVENTS.CREATE_WALLET, {
            userId: user.id,
            email: user.email || '',
          });
        });
      },

      // Internal methods
      createSocketConnection: (token) => {
        return new Promise<Socket>((resolve, reject) => {
          if (socketManager.socket) {
            socketManager.socket.disconnect();
            socketManager.socket.removeAllListeners();
            socketManager.socket = null;
          }

          const socket = io(
            import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3001',
            {
              auth: { token },
              autoConnect: false,
              reconnection: false,
              forceNew: true,
              timeout: 10000,
            }
          );

          socket.once('connect', () => {
            resolve(socket);
          });

          socket.once('connect_error', (error) => {
            reject(error);
          });

          socket.on('disconnect', () => {
            set((state) => {
              Object.assign(state, {
                isConnected: false,
                socket: null,
              });
            });

            // Mark pools as stale
            import('./poolStore').then(({ usePoolStore }) => {
              usePoolStore.getState().markPoolsAsStale();
            });

            socket.removeAllListeners();
            socketManager.socket = null;
          });

          socket.connect();
          socketManager.socket = socket;
        });
      },

      setupEventListeners: (socket) => {
        // Auth events → authStore
        safeOn<InitializationResult>(socket, WS_EVENTS.INITIALIZATION_RESULT, (result) => {
          import('./authStore').then(({ useAuthStore }) => {
            useAuthStore.getState().setInitializationResult({
              hasWallet: result.hasWallet || false,
              success: result.success,
              error: result.error,
            });
          });
        });

        safeOn<WalletCreatedResult>(socket, WS_EVENTS.WALLET_CREATED, (result) => {
          import('./authStore').then(({ useAuthStore }) => {
            useAuthStore.getState().setWalletCreated(result);
          });
        });

        safeOn<UserStatus>(socket, WS_EVENTS.USER_STATUS, (status) => {
          import('./authStore').then(({ useAuthStore }) => {
            useAuthStore.getState().setUserStatus(status);
          });
        });

        // Pool events → poolStore
        safeOn<PoolsUpdate>(socket, WS_EVENTS.POOLS_UPDATE, (data) => {
          // console.log("WS_EVENTS.POOLS_UPDATE data:", data);
          import('./poolStore').then(({ usePoolStore }) => {
            usePoolStore.getState().updatePools(data.data);
          });
        });

        // Wallet events → walletStore
        safeOn<UserPortfolio>(socket, WS_EVENTS.USER_PORTFOLIO, (data) => {
          console.log("WS_EVENTS.USER_PORTFOLIO data:", data);
          import('./walletStore').then(({ useWalletStore }) => {
            useWalletStore.getState().updatePortfolio(data.data);
          });
        });

        safeOn<BalanceUpdate>(socket, WS_EVENTS.BALANCE_UPDATE, (data) => {
          import('./walletStore').then(({ useWalletStore }) => {
            useWalletStore.getState().updateBalance(data.data);
          });
        });

        // System events → systemStore
        safeOn<TransactionResult>(socket, WS_EVENTS.TRANSACTION_RESULT, (data) => {
          import('./systemStore').then(({ useSystemStore }) => {
            const systemStore = useSystemStore.getState();
            
            // Add action type to the result
            const resultWithAction = {
              ...data,
              action: systemStore.currentAction || 'transaction'
            };
            
            systemStore.setLastTransactionResult(resultWithAction);
          });
        });

        safeOn<DevnetStatus>(socket, WS_EVENTS.DEVNET_STATUS, (data) => {
          import('./systemStore').then(({ useSystemStore }) => {
            useSystemStore.getState().updateDevnetStatus(data);
          });
        });
      },

      initializeUser: () => {
        const getAuthUser = async () => {
          const { useAuthStore } = await import('./authStore');
          return useAuthStore.getState().user;
        };

        getAuthUser().then((user) => {
          const { socket, isConnected, connectedForUser, initializationAttempted } = get();
          
          if (!user || !isConnected || !socket) {
            return;
          }

          if (initializationAttempted && connectedForUser === user.id) {
            return;
          }

          set((state) => {
            state.initializationAttempted = true;
            state.connectedForUser = user.id;
          });

          const request: InitializeUserRequest = { type: 'login' };
          socket.emit(WS_EVENTS.INITIALIZE_USER, request);
        });
      },

      // State management
      setConnected: (connected) => {
        set((state) => {
          state.isConnected = connected;
        });
      },

      setConnecting: (connecting) => {
        set((state) => {
          state.isConnecting = connecting;
        });
      },

      setConnectionError: (error) => {
        set((state) => {
          state.connectionError = error;
        });
      },

      resetWebSocketState: () => {
        get().disconnect();
        set((state) => {
          Object.assign(state, initialState);
        });
      },
    })),
    { name: 'websocket-store' }
  )
);