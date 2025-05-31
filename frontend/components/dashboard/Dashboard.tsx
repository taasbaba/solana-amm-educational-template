import React, { useState } from "react";
import { useAuthStore, usePoolStore, useWalletStore, useSystemStore } from "../../stores";
import PoolStatusCard from "./PoolStatusCard";
import SwapForm from "../liquidity/SwapForm";
import AddLiquidityForm from "../liquidity/AddLiquidityForm";
import RemoveLiquidityForm from "../liquidity/RemoveLiquidityForm";
import ConnectionStatus from "../common/ConnectionStatus";
import WalletBalance from "../wallet/WalletBalance";
import TransactionHistory from "../transaction/TransactionHistory";

const Dashboard: React.FC = () => {
  // Toast state management
  const [toasts, setToasts] = useState<Array<{id: string, message: string, type: string}>>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Get auth state and methods
  const user = useAuthStore(state => state.user);
  const signOut = useAuthStore(state => state.signOut);
  const hasWallet = useAuthStore(state => state.hasWallet);
  const isCreatingWallet = useAuthStore(state => state.isCreatingWallet);
  
  // Get pool data
  const poolsData = usePoolStore(state => state.poolsData);
  const getAllPools = usePoolStore(state => state.getAllPools);
  
  // Get wallet data
  const lpPositions = useWalletStore(state => state.lpPositions);
  
  // Get system status
  const isSystemHealthy = useSystemStore(state => state.isSystemHealthy());
  const getDevnetStatusMessage = useSystemStore(state => state.getDevnetStatusMessage);

  // Toast management
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Handle sign out - no navigation needed since App.tsx will handle the state change
  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      showToast("Signed out successfully", "success");
      // No need to navigate - App.tsx will automatically show login when user becomes null
    } catch (error) {
      showToast("Signed out", "info");
      // Even on error, the signOut function should clear the user state
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Check if user has any LP position
  const hasAnyLPPosition = () => {
    if (!lpPositions) return false;
    return Object.values(lpPositions).some(position => position.lpAmount > 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="navbar bg-white/90 backdrop-blur-md shadow-lg border-b border-purple-100">
        <div className="flex-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Solana AMM Playground
          </h1>
        </div>
        <div className="flex-none gap-4">
          <ConnectionStatus />
          
          {/* User Info Display */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 text-white flex items-center justify-center font-bold text-xs">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <span className="hidden md:block">{user?.email}</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="btn btn-outline btn-error btn-sm hover:btn-error hover:text-white transition-all duration-200"
          >
            {isLoggingOut ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                Signing out...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </>
            )}
          </button>
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl">
        {/* System Status Warning */}
        {!isSystemHealthy && (
          <div className="alert alert-warning mb-6 bg-yellow-50 border-yellow-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span className="text-yellow-800">{getDevnetStatusMessage()}</span>
          </div>
        )}

        {/* Wallet Creation Status */}
        {!hasWallet && isCreatingWallet && (
          <div className="alert alert-info mb-6 bg-blue-50 border-blue-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-blue-800">Creating your Solana wallet... This may take a few moments.</span>
          </div>
        )}

        {/* No Wallet Warning */}
        {!hasWallet && !isCreatingWallet && (
          <div className="alert alert-warning mb-6 bg-orange-50 border-orange-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <div className="font-bold">Wallet Required</div>
              <div className="text-sm">You need a wallet to start trading. Please wait while we create one for you.</div>
            </div>
          </div>
        )}

        {/* Wallet Balance - Full Width */}
        <div className="mb-8">
          <WalletBalance />
        </div>

        {/* Pool Status Cards */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <PoolStatusCard
            poolType="NTD-USD"
            colorScheme="green"
            showToast={showToast}
          />
          <PoolStatusCard
            poolType="USD-YEN"
            colorScheme="blue"
            showToast={showToast}
          />
          <PoolStatusCard
            poolType="NTD-YEN"
            colorScheme="purple"
            showToast={showToast}
          />
        </div>

        {/* Trading Interface - Only show if user has wallet */}
        {hasWallet && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <SwapForm showToast={showToast} />
            <AddLiquidityForm showToast={showToast} />
            <RemoveLiquidityForm showToast={showToast} />
          </div>
        )}

        {/* No Wallet Trading Interface Placeholder */}
        {!hasWallet && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card bg-white/50 backdrop-blur-sm shadow-xl border border-gray-200">
                <div className="card-body text-center">
                  <div className="loading loading-spinner loading-lg text-gray-400 mb-4"></div>
                  <h3 className="text-lg font-semibold text-gray-500 mb-2">
                    {i === 1 ? 'Swap Tokens' : i === 2 ? 'Add Liquidity' : 'Remove Liquidity'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Wallet creation in progress...
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Transaction History - Full Width Below Trading Interface */}
        <div className="mb-8">
          <TransactionHistory />
        </div>

        {/* Data Status Footer */}
        <div className="text-center mt-8">
          <div className="card bg-white/60 backdrop-blur-sm shadow-sm border border-gray-200">
            <div className="card-body py-4">
              <div className="flex justify-center items-center space-x-4 text-sm">
                <div className={`flex items-center space-x-2 ${poolsData.isStale ? "text-warning" : "text-success"}`}>
                  <div className={`w-2 h-2 rounded-full ${poolsData.isStale ? "bg-warning animate-pulse" : "bg-success"}`}></div>
                  <span>
                    Pool data: {poolsData.lastUpdated ? poolsData.lastUpdated.toLocaleTimeString() : 'Connecting...'}
                    {poolsData.isStale && " (May be outdated)"}
                  </span>
                </div>
                
                <div className="divider divider-horizontal"></div>
                
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                  <span>
                    Connected to Solana Devnet
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toast Notifications */}
        <div className="toast toast-top toast-end">
          {toasts.map(toast => (
            <div key={toast.id} className={`alert alert-${toast.type}`}>
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;