import React from "react";
import { useWalletStore } from "../../stores";
import { formatTokenAmount } from "../../utils/formatters";

// No props needed - component gets data directly from stores
/**
 * WalletBalance component:
 * Shows current USD, YEN, NTD balances and Total Portfolio Value from the user's wallet.
 * Data comes directly from walletStore via WebSocket updates.
 */
const WalletBalance: React.FC = () => {
  // Get wallet data directly from store
  const walletBalance = useWalletStore(state => state.walletBalance);
  const balanceLoading = useWalletStore(state => state.balanceLoading);
  const balanceError = useWalletStore(state => state.balanceError);
  const balanceLastUpdated = useWalletStore(state => state.balanceLastUpdated);
  
  // Get wallet methods from store
  const refreshBalance = useWalletStore(state => state.refreshBalance);
  const getTotalBalance = useWalletStore(state => state.getTotalBalance);
  const getTokenBalance = useWalletStore(state => state.getTokenBalance);

  // Handle manual refresh
  const handleRefresh = () => {
    refreshBalance();
  };

  // Format last updated time
  const formatLastUpdated = () => {
    if (!balanceLastUpdated) return "Never";
    return balanceLastUpdated.toLocaleTimeString();
  };

  // Handle wallet explorer link click
  const handleWalletExplorer = () => {
    if (walletBalance?.walletAddress) {
      const explorerUrl = `https://explorer.solana.com/address/${walletBalance.walletAddress}?cluster=devnet`;
      window.open(explorerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Get individual token balances
  const ntdBalance = getTokenBalance('NTD');
  const usdBalance = getTokenBalance('USD');
  const yenBalance = getTokenBalance('YEN');
  const totalValueUSD = getTotalBalance();

  return (
    <div className="card bg-base-100 shadow-xl mt-6">
      <div className="card-body">
        <div className="flex justify-between items-center">
          <h2 className="card-title">Your Wallet Tokens</h2>
          <div className="text-xs text-gray-500">
            Exchange rates: 1 NTD = $0.032 USD, 1 USD = ¥149.25 YEN, 1 YEN = $0.0067 USD
          </div>
        </div>

        {/* Loading State */}
        {balanceLoading && !walletBalance && (
          <div className="space-y-2">
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-full"></div>
          </div>
        )}

        {/* Error State */}
        {balanceError && (
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{balanceError}</span>
          </div>
        )}

        {/* Balance Display */}
        {!balanceLoading && !balanceError && (
          <div className="space-y-3">
            {/* Token Balances + Total Portfolio Value - 4 Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* USD Balance */}
              <div className="stat bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                <div className="stat-title text-green-600">USD Balance</div>
                <div className="stat-value text-green-700 text-lg">
                  {formatTokenAmount(usdBalance, 6)}
                </div>
                <div className="stat-desc text-green-500">US Dollar</div>
              </div>

              {/* YEN Balance */}
              <div className="stat bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
                <div className="stat-title text-purple-600">YEN Balance</div>
                <div className="stat-value text-purple-700 text-lg">
                  {formatTokenAmount(yenBalance, 6)}
                </div>
                <div className="stat-desc text-purple-500">Japanese Yen</div>
              </div>

              {/* NTD Balance */}
              <div className="stat bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="stat-title text-blue-600">NTD Balance</div>
                <div className="stat-value text-blue-700 text-lg">
                  {formatTokenAmount(ntdBalance, 6)}
                </div>
                <div className="stat-desc text-blue-500">New Taiwan Dollar</div>
              </div>

              {/* Total Portfolio Value */}
              <div className="stat bg-gradient-to-r from-yellow-50 to-orange-100 rounded-lg p-4">
                <div className="stat-title text-orange-600">Total Value</div>
                <div className="stat-value text-orange-700 text-lg">
                  ${formatTokenAmount(totalValueUSD, 6, 2)}
                </div>
                <div className="stat-desc text-orange-500">Portfolio USD</div>
              </div>
            </div>

            {/* Wallet Address & Last Updated */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-center text-sm text-gray-600">
                {walletBalance?.walletAddress && (
                  <div className="flex items-center">
                    <span className="mr-2">Wallet:</span>
                    <button 
                      onClick={handleWalletExplorer}
                      className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                      title="Click to view on Solana Explorer (Devnet)"
                    >
                      {walletBalance.walletAddress.slice(0, 8)}...{walletBalance.walletAddress.slice(-8)}
                      <svg className="w-3 h-3 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                      </svg>
                    </button>
                  </div>
                )}
                <div className="flex items-center">
                  <span className="mr-2">Last Updated:</span>
                  <span>{formatLastUpdated()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Wallet State */}
        {!balanceLoading && !balanceError && !walletBalance && (
          <div className="text-center py-4">
            <div className="text-gray-400 mb-2">No wallet data available</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletBalance;