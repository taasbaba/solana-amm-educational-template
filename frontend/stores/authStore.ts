import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  // User state
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  sessionLoading: boolean;
  
  // Business state from useApp
  isInitialized: boolean;
  hasWallet: boolean;
  isCreatingWallet: boolean;
  businessError: string | null;
  
  // Initialization tracking
  initialized: boolean;
}

interface AuthActions {
  // Auth methods
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  
  // Session methods
  initializeSession: () => Promise<void>;
  
  // Business methods
  setInitializationResult: (result: { hasWallet: boolean; success: boolean; error?: string }) => void;
  setWalletCreated: (result: { success: boolean; error?: string }) => void;
  setUserStatus: (status: { status: string; hasWallet: boolean }) => void;
  setCreatingWallet: (creating: boolean) => void;
  
  // Internal state methods
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  setSessionLoading: (loading: boolean) => void;
  
  // Reset methods
  resetAuthState: () => void;
  resetBusinessState: () => void;
}

const initialState: AuthState = {
  user: null,
  authLoading: false,
  authError: null,
  sessionLoading: true,
  isInitialized: false,
  hasWallet: false,
  isCreatingWallet: false,
  businessError: null,
  initialized: false,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Auth methods
      signIn: async (email: string, password: string) => {
        set((state) => {
          state.authLoading = true;
          state.authError = null;
        });

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            set((state) => {
              state.authLoading = false;
              state.authError = error.message;
            });
            return { success: false, error: error.message };
          }

          if (data.user && data.session) {
            set((state) => {
              state.user = data.user;
              state.authLoading = false;
              state.authError = null;
            });

            // Trigger WebSocket connection via websocketStore
            const { useWebSocketStore } = await import('./websocketStore');
            await useWebSocketStore.getState().connect(data.session.access_token);
            
            return { success: true };
          }

          return { success: false, error: 'No user data received' };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
          set((state) => {
            state.authLoading = false;
            state.authError = errorMessage;
          });
          return { success: false, error: errorMessage };
        }
      },

      signUp: async (email: string, password: string) => {
        set((state) => {
          state.authLoading = true;
          state.authError = null;
        });

        try {
          const { data, error } = await supabase.auth.signUp({ email, password });

          if (error) {
            set((state) => {
              state.authLoading = false;
              state.authError = error.message;
            });
            return { success: false, error: error.message };
          }

          if (data.user && data.session) {
            set((state) => {
              state.user = data.user;
              state.authLoading = false;
              state.authError = null;
            });

            // Trigger WebSocket connection via websocketStore
            const { useWebSocketStore } = await import('./websocketStore');
            await useWebSocketStore.getState().connect(data.session.access_token);
            
            return { success: true };
          }

          return { success: false, error: 'No user data received' };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
          set((state) => {
            state.authLoading = false;
            state.authError = errorMessage;
          });
          return { success: false, error: errorMessage };
        }
      },

      signOut: async () => {
        try {
          // Disconnect WebSocket first
          const { useWebSocketStore } = await import('./websocketStore');
          useWebSocketStore.getState().disconnect();

          // Sign out from Supabase
          await supabase.auth.signOut();

          // Reset all stores
          get().resetAuthState();
          
          // Reset other stores
          const { useWalletStore } = await import('./walletStore');
          const { usePoolStore } = await import('./poolStore');
          const { useSystemStore } = await import('./systemStore');
          
          useWalletStore.getState().resetWalletState();
          usePoolStore.getState().resetPoolState();
          useSystemStore.getState().resetSystemState();

        } catch (error) {
          console.error('Sign out error:', error);
        }
      },

      // Session methods
      initializeSession: async () => {
        if (get().initialized) {
          return;
        }

        try {
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            console.error('Session initialization error:', error);
            set((state) => {
              state.authLoading = false;
              state.sessionLoading = false;
              state.authError = error.message;
              state.initialized = true;
            });
            return;
          }

          if (!data.session?.user) {
            set((state) => {
              state.authLoading = false;
              state.sessionLoading = false;
              state.initialized = true;
            });
            return;
          }

          set((state) => {
            state.user = data.session.user;
            state.authLoading = false;
            state.sessionLoading = false;
            state.initialized = true;
          });

          // Connect WebSocket with session token
          const { useWebSocketStore } = await import('./websocketStore');
          await useWebSocketStore.getState().connect(data.session.access_token);

        } catch (error) {
          console.error('Auth initialization error:', error);
          set((state) => {
            state.authLoading = false;
            state.sessionLoading = false;
            state.authError = 'Failed to initialize authentication';
            state.initialized = true;
          });
        }
      },

      // Business methods (from WebSocket events)
      setInitializationResult: (result) => {
        set((state) => {
          state.isInitialized = true;
          state.hasWallet = result.hasWallet || false;
          state.businessError = result.success ? null : result.error || null;
        });
      },

      setWalletCreated: (result) => {
        set((state) => {
          state.isCreatingWallet = false;
          state.hasWallet = result.success;
          state.businessError = result.success ? null : result.error || null;
        });
      },

      setUserStatus: (status) => {
        if (status.status === 'new_user' && !status.hasWallet) {
          set((state) => {
            state.hasWallet = false;
            state.isInitialized = true;
            state.isCreatingWallet = true;
          });

          // Auto-create wallet for new users
          setTimeout(async () => {
            const currentState = get();
            if (currentState.user) {
              const { useWebSocketStore } = await import('./websocketStore');
              const websocketStore = useWebSocketStore.getState();
              
              if (websocketStore.isConnected) {
                websocketStore.createWallet();
              }
            }
          }, 300);
        }
      },

      setCreatingWallet: (creating) => {
        set((state) => {
          state.isCreatingWallet = creating;
        });
      },

      // Internal state methods
      setUser: (user) => {
        set((state) => {
          state.user = user;
        });
      },

      setAuthLoading: (loading) => {
        set((state) => {
          state.authLoading = loading;
        });
      },

      setAuthError: (error) => {
        set((state) => {
          state.authError = error;
        });
      },

      setSessionLoading: (loading) => {
        set((state) => {
          state.sessionLoading = loading;
        });
      },

      // Reset methods
      resetAuthState: () => {
        set((state) => {
          Object.assign(state, initialState);
        });
      },

      resetBusinessState: () => {
        set((state) => {
          state.isInitialized = false;
          state.hasWallet = false;
          state.isCreatingWallet = false;
          state.businessError = null;
        });
      },
    })),
    { name: 'auth-store' }
  )
);