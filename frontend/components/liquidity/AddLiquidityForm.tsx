import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocketStore, usePoolStore, useWalletStore, useSystemStore } from '../../stores';
import { WS_EVENTS, AddLiquidityRequest } from '../../types/websocket';
import { formatTokenAmount } from "../../utils/formatters";

interface AddLiquidityFormProps {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const AddLiquidityForm: React.FC<AddLiquidityFormProps> = ({ showToast }) => {
  // Get store data and methods
  const isConnected = useWebSocketStore(state => state.isConnected);
  const emit = useWebSocketStore(state => state.emit);
  
  const getPool = usePoolStore(state => state.getPool);
  
  const getTokenBalance = useWalletStore(state => state.getTokenBalance);
  
  const canExecuteTransactions = useSystemStore(state => state.canExecuteTransactions());
  const lastTransactionResult = useSystemStore(state => state.lastTransactionResult);

  const [formData, setFormData] = useState({
    poolType: 'NTD-USD' as 'NTD-USD' | 'USD-YEN' | 'NTD-YEN',
    amountA: '',
    amountB: '',
    expectedLP: '',
    poolShare: '',
    isAutoCalculating: true, // Auto-calculate second token amount
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pool options
  const poolOptions = [
    { value: 'NTD-USD', label: 'NTD/USD Pool', tokenA: 'NTD', tokenB: 'USD' },
    { value: 'USD-YEN', label: 'USD/YEN Pool', tokenA: 'USD', tokenB: 'YEN' },
    { value: 'NTD-YEN', label: 'NTD/YEN Pool', tokenA: 'NTD', tokenB: 'YEN' },
  ];

  // Handle transaction results from system store
  useEffect(() => {
    if (!lastTransactionResult) return;
    
    // Only handle if this was an add liquidity transaction
    if (isSubmitting) {
      setIsSubmitting(false);
      
      if (lastTransactionResult.success) {
        showToast(
          `Liquidity added! Transaction: ${lastTransactionResult.txSignature?.slice(0, 8)}...`,
          'success'
        );
        // Reset form
        setFormData(prev => ({
          ...prev,
          amountA: '',
          amountB: '',
          expectedLP: '',
          poolShare: '',
        }));
      } else {
        showToast(lastTransactionResult.error || 'Add liquidity failed', 'error');
      }
    }
  }, [lastTransactionResult, isSubmitting, showToast]);

  // Get current pool info
  const getCurrentPool = () => {
    return poolOptions.find(p => p.value === formData.poolType);
  };

  // Calculate LP tokens using your Solana program's exact math
  const calculateLPTokens = useCallback(() => {
    const pool = getPool(formData.poolType);
    const currentPoolInfo = getCurrentPool();
    const amountA = parseFloat(formData.amountA);
    const amountB = parseFloat(formData.amountB);
    
    if (!pool || !currentPoolInfo || !amountA || !amountB || amountA <= 0 || amountB <= 0) {
      setFormData(prev => ({ ...prev, expectedLP: '', poolShare: '' }));
      return;
    }

    const { vaultABalance, vaultBBalance, poolType, lpTokenSupply = 0 } = pool;
    
    let lpToMint = 0;
    
    if (lpTokenSupply === 0) {
      // First liquidity provider gets fixed amount: 1,000,000 LP tokens
      lpToMint = 1000000;
    } else {
      // Calculate based on your program's formulas
      switch (poolType) {
        case 0: // Standard pool: proportional to existing ratio
          const ratioA = (amountA * lpTokenSupply) / vaultABalance;
          const ratioB = (amountB * lpTokenSupply) / vaultBBalance;
          lpToMint = Math.min(ratioA, ratioB);
          break;
          
        case 1: // Stable pool: more generous LP tokens since assets are similar
          const avgRatio = ((amountA + amountB) * lpTokenSupply) / ((vaultABalance + vaultBBalance) * 2);
          lpToMint = avgRatio;
          break;
          
        case 2: // Concentrated pool: bonus LP tokens for providing liquidity
          const baseRatioA = (amountA * lpTokenSupply) / vaultABalance;
          const baseRatioB = (amountB * lpTokenSupply) / vaultBBalance;
          const baseRatio = Math.min(baseRatioA, baseRatioB);
          // 10% bonus for concentrated liquidity
          lpToMint = (baseRatio * 110) / 100;
          break;
          
        default:
          // Fallback to standard calculation
          const fallbackRatioA = (amountA * lpTokenSupply) / vaultABalance;
          const fallbackRatioB = (amountB * lpTokenSupply) / vaultBBalance;
          lpToMint = Math.min(fallbackRatioA, fallbackRatioB);
      }
    }
    
    // Calculate pool share percentage
    const newTotalSupply = lpTokenSupply + lpToMint;
    const poolShare = (lpToMint / newTotalSupply) * 100;
    
    setFormData(prev => ({
      ...prev,
      expectedLP: lpToMint.toFixed(6),
      poolShare: poolShare.toFixed(4),
    }));
  }, [formData.poolType, formData.amountA, formData.amountB, getPool]);

  // Auto-calculate second token amount to maintain pool ratio
  const autoCalculateTokenB = useCallback(() => {
    if (!formData.isAutoCalculating) return;
    
    const pool = getPool(formData.poolType);
    const amountA = parseFloat(formData.amountA);
    
    if (!pool || !amountA || amountA <= 0) {
      setFormData(prev => ({ ...prev, amountB: '' }));
      return;
    }

    const { vaultABalance, vaultBBalance } = pool;
    
    if (vaultABalance > 0 && vaultBBalance > 0) {
      // Calculate proportional amount B based on current pool ratio
      const ratio = vaultBBalance / vaultABalance;
      const calculatedAmountB = amountA * ratio;
      
      setFormData(prev => ({
        ...prev,
        amountB: calculatedAmountB.toFixed(6),
      }));
    }
  }, [formData.poolType, formData.amountA, formData.isAutoCalculating, getPool]);

  // Update calculations when inputs change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      autoCalculateTokenB();
      calculateLPTokens();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [autoCalculateTokenB, calculateLPTokens]);

  // Handle pool change
  const handlePoolChange = (poolType: string) => {
    setFormData(prev => ({
      ...prev,
      poolType: poolType as any,
      amountA: '',
      amountB: '',
      expectedLP: '',
      poolShare: '',
    }));
  };

  // Handle max amount for token A
  const handleMaxAmountA = () => {
    const currentPool = getCurrentPool();
    if (currentPool) {
      const maxBalance = getTokenBalance(currentPool.tokenA as any);
      setFormData(prev => ({ ...prev, amountA: maxBalance.toString() }));
    }
  };

  // Handle max amount for token B
  const handleMaxAmountB = () => {
    const currentPool = getCurrentPool();
    if (currentPool) {
      const maxBalance = getTokenBalance(currentPool.tokenB as any);
      setFormData(prev => ({ 
        ...prev, 
        amountB: maxBalance.toString(),
        isAutoCalculating: false // Disable auto-calc when user sets manual amount
      }));
    }
  };

  // Handle manual token B input
  const handleTokenBChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      amountB: value,
      isAutoCalculating: false, // Disable auto-calc when user manually inputs
    }));
  };

  // Toggle auto-calculation
  const toggleAutoCalculation = () => {
    setFormData(prev => ({ ...prev, isAutoCalculating: !prev.isAutoCalculating }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canExecuteTransactions) {
      showToast('Transactions are currently disabled', 'warning');
      return;
    }

    if (!isConnected) {
      showToast('Not connected to server', 'error');
      return;
    }

    const currentPool = getCurrentPool();
    const amountA = parseFloat(formData.amountA);
    const amountB = parseFloat(formData.amountB);

    if (!currentPool || !amountA || !amountB || amountA <= 0 || amountB <= 0) {
      showToast('Please enter valid amounts for both tokens', 'error');
      return;
    }

    const balanceA = getTokenBalance(currentPool.tokenA as any);
    const balanceB = getTokenBalance(currentPool.tokenB as any);

    if (amountA > balanceA) {
      showToast(`Insufficient ${currentPool.tokenA} balance`, 'error');
      return;
    }

    if (amountB > balanceB) {
      showToast(`Insufficient ${currentPool.tokenB} balance`, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const addLiquidityRequest: AddLiquidityRequest = {
        poolType: formData.poolType,
        amountA: amountA,
        amountB: amountB,
      };

      emit(WS_EVENTS.ADD_LIQUIDITY, addLiquidityRequest);
      showToast('Add liquidity transaction submitted...', 'info');
    } catch (error) {
      setIsSubmitting(false);
      showToast('Failed to submit add liquidity transaction', 'error');
    }
  };

  const currentPool = getCurrentPool();

  // Get pool type display name
  const getPoolTypeDisplayName = (poolType: string) => {
    switch (poolType) {
      case 'NTD-USD':
        return 'Stable (Low Fees)';
      case 'USD-YEN':
        return 'Standard (Balanced)';
      case 'NTD-YEN':
        return 'Concentrated (High Fees)';
      default:
        return 'Unknown';
    }
  };

  // Get current pool data for ratio display
  const getCurrentPoolData = () => {
    return getPool(formData.poolType);
  };

  const currentPoolData = getCurrentPoolData();

  return (
    <div className="card bg-white/90 backdrop-blur-sm shadow-xl border border-blue-200">
      <div className="card-body">
        <h2 className="card-title text-2xl mb-6 flex items-center gap-2 text-blue-600">
          <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full"></div>
          Add Liquidity
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pool Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold text-gray-700">Pool</span>
            </label>
            <select 
              className="select select-bordered select-info border-blue-200"
              value={formData.poolType}
              onChange={(e) => handlePoolChange(e.target.value)}
              disabled={isSubmitting}
            >
              {poolOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Token A Amount */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold text-gray-700">
                {currentPool?.tokenA} Amount
              </span>
            </label>
            <input 
              type="number"
              placeholder="0.0"
              className="input input-bordered input-info border-blue-200"
              value={formData.amountA}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                amountA: e.target.value,
                isAutoCalculating: true // Re-enable auto-calc when token A changes
              }))}
              disabled={isSubmitting}
              step="any"
              min="0"
            />
            <label className="label">
              <span className="label-text-alt text-gray-500">
                Balance: {currentPool ? formatTokenAmount(getTokenBalance(currentPool.tokenA as any), 6, 2) : '0'} {currentPool?.tokenA}
              </span>
              <span className="label-text-alt">
                <button 
                  type="button"
                  className="link link-info text-xs"
                  onClick={handleMaxAmountA}
                  disabled={isSubmitting}
                >
                  MAX
                </button>
              </span>
            </label>
          </div>

          {/* Auto-calculation toggle */}
          <div className="flex items-center justify-center">
            <label className="label cursor-pointer">
              <span className="label-text mr-2 text-sm text-gray-600">Auto-calculate ratio</span>
              <input 
                type="checkbox" 
                className="toggle toggle-info" 
                checked={formData.isAutoCalculating}
                onChange={toggleAutoCalculation}
                disabled={isSubmitting}
              />
            </label>
          </div>

          {/* Token B Amount */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold text-gray-700">
                {currentPool?.tokenB} Amount
              </span>
            </label>
            <input 
              type="number"
              placeholder="0.0"
              className={`input input-bordered input-info border-blue-200 ${formData.isAutoCalculating ? 'bg-blue-50' : ''}`}
              value={formData.amountB}
              onChange={(e) => handleTokenBChange(e.target.value)}
              disabled={isSubmitting || formData.isAutoCalculating}
              step="any"
              min="0"
            />
            <label className="label">
              <span className="label-text-alt text-gray-500">
                Balance: {currentPool ? formatTokenAmount(getTokenBalance(currentPool.tokenB as any), 6, 2) : '0'} {currentPool?.tokenB}
              </span>
              <span className="label-text-alt">
                <button 
                  type="button"
                  className="link link-info text-xs"
                  onClick={handleMaxAmountB}
                  disabled={isSubmitting || formData.isAutoCalculating}
                >
                  MAX
                </button>
              </span>
            </label>
          </div>

          {/* LP Token Preview */}
          {formData.amountA && formData.amountB && formData.expectedLP && (
            <div className="alert bg-blue-50 border-blue-200">
              <div className="text-sm w-full text-blue-700">
                <div className="flex justify-between">
                  <span>LP Tokens:</span>
                  <span className="font-semibold">~{parseFloat(formData.expectedLP).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pool Share:</span>
                  <span className="font-semibold">{formData.poolShare}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Pool Type:</span>
                  <span className="font-semibold">
                    {getPoolTypeDisplayName(formData.poolType)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Pool Ratio Info */}
          {currentPoolData && currentPoolData.vaultABalance > 0 && currentPoolData.vaultBBalance > 0 && (
            <div className="text-center text-sm text-gray-500">
              Current pool ratio: 1 {currentPool?.tokenA} = {(currentPoolData.vaultBBalance / currentPoolData.vaultABalance).toFixed(4)} {currentPool?.tokenB}
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit"
            className={`btn btn-info btn-lg w-full ${isSubmitting ? 'loading' : ''}`}
            disabled={
              isSubmitting || 
              !canExecuteTransactions || 
              !formData.amountA || 
              !formData.amountB ||
              parseFloat(formData.amountA || '0') > (currentPool ? getTokenBalance(currentPool.tokenA as any) : 0) ||
              parseFloat(formData.amountB || '0') > (currentPool ? getTokenBalance(currentPool.tokenB as any) : 0)
            }
          >
            {isSubmitting ? (
              'Processing Transaction...'
            ) : !canExecuteTransactions ? (
              'Trading Disabled'
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                Add Liquidity
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddLiquidityForm;