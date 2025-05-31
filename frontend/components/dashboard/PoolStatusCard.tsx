import React from 'react';
import { PoolState } from '../../types/websocket';
import { useWalletStore, useSystemStore, usePoolStore } from '../../stores';
import { formatTokenAmount } from "../../utils/formatters";

interface PoolStatusCardProps {
  poolType: string;
  colorScheme: 'green' | 'blue' | 'purple';
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const PoolStatusCard: React.FC<PoolStatusCardProps> = ({
  poolType,
  colorScheme,
  showToast
}) => {
  // Get pool data from store
  const pool = usePoolStore(state => state.getPool(poolType));
  const loading = usePoolStore(state => state.isPoolLoading(poolType));

  // Get wallet data
  const lpPositions = useWalletStore(state => state.lpPositions);
  const hasPosition = useWalletStore(state => state.hasPosition);

  // Get system capabilities
  const canExecuteTransactions = useSystemStore(state => state.canExecuteTransactions());

  // Get color classes based on scheme
  const getColorClasses = () => {
    switch (colorScheme) {
      case 'green':
        return {
          gradient: 'from-green-50 to-emerald-50',
          border: 'border-green-200',
          shadow: 'hover:shadow-green-200',
          text: 'text-green-600',
          badge: 'badge-success',
          button: 'btn-success',
          buttonOutline: 'btn-outline btn-success',
          dot: 'bg-green-400',
          hover: 'hover:bg-green-100',
          bg: 'bg-green-100',
          feeBg: 'bg-green-100 border-green-200',
          feeText: 'text-green-700'
        };
      case 'blue':
        return {
          gradient: 'from-blue-50 to-cyan-50',
          border: 'border-blue-200',
          shadow: 'hover:shadow-blue-200',
          text: 'text-blue-600',
          badge: 'badge-info',
          button: 'btn-info',
          buttonOutline: 'btn-outline btn-info',
          dot: 'bg-blue-400',
          hover: 'hover:bg-blue-100',
          bg: 'bg-blue-100',
          feeBg: 'bg-blue-100 border-blue-200',
          feeText: 'text-blue-700'
        };
      case 'purple':
        return {
          gradient: 'from-purple-50 to-pink-50',
          border: 'border-purple-200',
          shadow: 'hover:shadow-purple-200',
          text: 'text-purple-600',
          badge: 'badge-secondary',
          button: 'btn-secondary',
          buttonOutline: 'btn-outline btn-secondary',
          dot: 'bg-purple-400',
          hover: 'hover:bg-purple-100',
          bg: 'bg-purple-100',
          feeBg: 'bg-purple-100 border-purple-200',
          feeText: 'text-purple-700'
        };
    }
  };

  const colors = getColorClasses();

  // Get pool type display info
  const getPoolInfo = () => {
    switch (poolType) {
      case 'NTD-USD':
        return {
          name: 'NTD/USD',
          type: 'Stable Pool',
          fee: '0.05%',
          description: 'Low slippage trading'
        };
      case 'USD-YEN':
        return {
          name: 'USD/YEN',
          type: 'Standard Pool',
          fee: '0.3%',
          description: 'Constant product formula'
        };
      case 'NTD-YEN':
        return {
          name: 'NTD/YEN',
          type: 'Concentrated Pool',
          fee: '0.5%',
          description: 'Range-based liquidity'
        };
      default:
        return {
          name: poolType,
          type: 'Pool',
          fee: '0%',
          description: 'Unknown pool type'
        };
    }
  };

  const poolInfo = getPoolInfo();

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toLocaleString();
  };

  // Get token symbols for display
  const getTokenSymbols = () => {
    switch (poolType) {
      case 'NTD-USD':
        return { tokenA: 'NTD', tokenB: 'USD' };
      case 'USD-YEN':
        return { tokenA: 'USD', tokenB: 'YEN' };
      case 'NTD-YEN':
        return { tokenA: 'NTD', tokenB: 'YEN' };
      default:
        return { tokenA: 'TokenA', tokenB: 'TokenB' };
    }
  };

  const { tokenA, tokenB } = getTokenSymbols();

  // Get user's LP position for this pool
  const getUserPosition = () => {
    if (!lpPositions) return null;
    return lpPositions[poolType as keyof typeof lpPositions];
  };

  const userPosition = getUserPosition();

  // Calculate mock 24h fees earned (in real app, this would come from backend)
  const calculateFeesEarned = (): number => {
    if (!userPosition || userPosition.lpAmount === 0) return 0;
    
    // Mock calculation based on share percentage
    const baseDaily = poolType === 'NTD-USD' ? 100 : poolType === 'USD-YEN' ? 150 : 80;
    return (userPosition.sharePercent / 100) * baseDaily;
  };

  const feesEarned = calculateFeesEarned();

  // Handle action buttons
  const handleTrade = () => {
    if (!canExecuteTransactions) {
      showToast('Trading is currently disabled due to system instability', 'warning');
      return;
    }
    showToast(`Opening ${poolInfo.name} trading interface`, 'info');
    // In real app, this would open a modal or navigate to trading form
  };

  const handleManage = () => {
    if (!hasPosition(poolType)) {
      showToast(`No liquidity position in ${poolInfo.name} pool`, 'info');
      return;
    }
    showToast(`Opening ${poolInfo.name} position management`, 'info');
    // In real app, this would open position management interface
  };

  const handleViewDetails = () => {
    showToast(`Opening ${poolInfo.name} pool details`, 'info');
    // In real app, this would show detailed pool information
  };

  const handlePoolAnalytics = () => {
    showToast(`Opening ${poolInfo.name} analytics`, 'info');
    // In real app, this would show pool performance charts and metrics
  };

  const handleTransactionHistory = () => {
    showToast(`Opening ${poolInfo.name} transaction history`, 'info');
    // In real app, this would show user's transaction history for this pool
  };

  if (loading) {
    return (
      <div className={`card bg-gradient-to-br ${colors.gradient} backdrop-blur-sm shadow-xl border ${colors.border}`}>
        <div className="card-body">
          <div className="flex items-center space-x-4">
            <div className="skeleton w-4 h-4 rounded-full"></div>
            <div className="skeleton h-6 w-24"></div>
          </div>
          <div className="skeleton h-4 w-32 mt-2"></div>
          
          <div className="space-y-3 mt-4">
            <div className="skeleton h-16 w-full rounded-lg"></div>
            <div className="skeleton h-16 w-full rounded-lg"></div>
            <div className="skeleton h-16 w-full rounded-lg"></div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <div className="skeleton h-8 w-16"></div>
            <div className="skeleton h-8 w-20"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className={`card bg-gradient-to-br from-gray-50 to-gray-100 backdrop-blur-sm shadow-xl border border-gray-200`}>
        <div className="card-body">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="card-title text-xl text-gray-500 flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                {poolInfo.name}
              </h3>
              <div className="badge badge-outline badge-ghost">{poolInfo.type} • {poolInfo.fee}</div>
            </div>
          </div>
          
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">Pool data unavailable</div>
            <div className="text-xs text-gray-400">Waiting for connection...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card bg-gradient-to-br ${colors.gradient} backdrop-blur-sm shadow-xl border ${colors.border} ${colors.shadow} hover:scale-[1.02] transition-all duration-300`}>
      <div className="card-body">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className={`card-title text-xl ${colors.text} flex items-center gap-2`}>
              <div className={`w-3 h-3 ${colors.dot} rounded-full animate-pulse`}></div>
              {poolInfo.name}
            </h3>
            <div className={`badge ${colors.badge} badge-outline`}>
              {poolInfo.type} • {poolInfo.fee}
            </div>
          </div>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className={`btn btn-ghost btn-sm btn-circle ${colors.hover}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
              </svg>
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-white rounded-box w-52 border border-gray-200">
              <li><a className="text-sm" onClick={handleViewDetails}>View Details</a></li>
              <li><a className="text-sm" onClick={handlePoolAnalytics}>Pool Analytics</a></li>
              <li><a className="text-sm" onClick={handleTransactionHistory}>Transaction History</a></li>
            </ul>
          </div>
        </div>
        
        <div className="space-y-3">
          {/* Pool Reserves */}
          <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg border border-gray-100">
            <span className="text-sm text-gray-600">Reserves</span>
            <div className="text-right">
              <div className="font-semibold text-gray-700">
                {formatTokenAmount(pool.vaultABalance, 6, 2)} {tokenA}
              </div>
              <div className="font-semibold text-gray-700">
                {formatTokenAmount(pool.vaultBBalance, 6, 2)} {tokenB}
              </div>
            </div>
          </div>
          
          {/* User Position */}
          <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg border border-gray-100">
            <span className="text-sm text-gray-600">Your Position</span>
            <div className="text-right">
              {userPosition && userPosition.lpAmount > 0 ? (
                <>
                  <div className={`font-semibold ${colors.text}`}>
                    {userPosition.lpAmount.toFixed(6)} LP
                  </div>
                  <div className="text-xs text-gray-500">
                    {userPosition.sharePercent.toFixed(3)}% share
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-gray-400">0 LP</div>
                  <div className="text-xs text-gray-400">No position</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pool Description */}
        <div className="text-xs text-gray-500 mt-2">
          {poolInfo.description}
        </div>

        {/* Pool Status */}
        <div className="flex items-center space-x-2 mt-3 pt-2 border-t border-gray-200">
          <div className={`w-2 h-2 ${colors.dot} rounded-full animate-pulse`}></div>
          <span className={`text-xs ${colors.text}`}>
            Active • Updated {pool.lastUpdated ? new Date(pool.lastUpdated).toLocaleTimeString() : 'now'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PoolStatusCard;