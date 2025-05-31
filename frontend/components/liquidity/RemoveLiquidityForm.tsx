import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocketStore, usePoolStore, useWalletStore, useSystemStore } from '../../stores';
import { WS_EVENTS, RemoveLiquidityRequest } from '../../types/websocket';
import { formatTokenAmount } from "../../utils/formatters";

interface RemoveLiquidityFormProps {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const RemoveLiquidityForm: React.FC<RemoveLiquidityFormProps> = ({ showToast }) => {
  // Get store data and methods
  const isConnected = useWebSocketStore(state => state.isConnected);
  const emit = useWebSocketStore(state => state.emit);
  
  const getPool = usePoolStore(state => state.getPool);
  
  const lpPositions = useWalletStore(state => state.lpPositions);
  const hasPosition = useWalletStore(state => state.hasPosition);
  
  const canExecuteTransactions = useSystemStore(state => state.canExecuteTransactions());
  const lastTransactionResult = useSystemStore(state => state.lastTransactionResult);

  const [formData, setFormData] = useState({
    poolType: 'NTD-USD' as 'NTD-USD' | 'USD-YEN' | 'NTD-YEN',
    lpAmount: '',
    expectedTokenA: '',
    expectedTokenB: '',
    slippageA: 0.5, // 0.5% slippage tolerance
    slippageB: 0.5,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pool options with LP balance info
  const getPoolOptions = () => {
    return [
      {
        value: 'NTD-USD',
        label: `NTD/USD Pool`,
        tokenA: 'NTD',
        tokenB: 'USD',
        lpBalance: lpPositions?.['NTD-USD']?.lpAmount || 0,
        hasPosition: hasPosition('NTD-USD')
      },
      {
        value: 'USD-YEN',
        label: `USD/YEN Pool`,
        tokenA: 'USD',
        tokenB: 'YEN',
        lpBalance: lpPositions?.['USD-YEN']?.lpAmount || 0,
        hasPosition: hasPosition('USD-YEN')
      },
      {
        value: 'NTD-YEN',
        label: `NTD/YEN Pool`,
        tokenA: 'NTD',
        tokenB: 'YEN',
        lpBalance: lpPositions?.['NTD-YEN']?.lpAmount || 0,
        hasPosition: hasPosition('NTD-YEN')
      },
    ];
  };

  // Handle transaction results from system store
  useEffect(() => {
    if (!lastTransactionResult) return;
    
    // Only handle if this was a remove liquidity transaction
    if (isSubmitting) {
      setIsSubmitting(false);
      
      if (lastTransactionResult.success) {
        showToast(
          `Liquidity removed! Transaction: ${lastTransactionResult.txSignature?.slice(0, 8)}...`,
          'success'
        );
        // Reset form
        setFormData(prev => ({
          ...prev,
          lpAmount: '',
          expectedTokenA: '',
          expectedTokenB: '',
        }));
      } else {
        showToast(lastTransactionResult.error || 'Remove liquidity failed', 'error');
      }
    }
  }, [lastTransactionResult, isSubmitting, showToast]);

  // Get current pool info
  const getCurrentPool = () => {
    return getPoolOptions().find(p => p.value === formData.poolType);
  };

  // Calculate expected token amounts using your Solana program's exact math
  const calculateWithdrawalAmounts = useCallback(() => {
    const pool = getPool(formData.poolType);
    const currentPool = getCurrentPool();
    const lpAmount = parseFloat(formData.lpAmount);
    
    if (!pool || !currentPool || !lpAmount || lpAmount <= 0) {
      setFormData(prev => ({ ...prev, expectedTokenA: '', expectedTokenB: '' }));
      return;
    }

    const { vaultABalance, vaultBBalance, lpTokenSupply = 0 } = pool;
    
    if (lpTokenSupply === 0) {
      setFormData(prev => ({ ...prev, expectedTokenA: '0', expectedTokenB: '0' }));
      return;
    }

    // Your program's formula: (vault_balance * lp_amount) / lp_supply
    const amountAOut = (vaultABalance * lpAmount) / lpTokenSupply;
    const amountBOut = (vaultBBalance * lpAmount) / lpTokenSupply;
    
    setFormData(prev => ({
      ...prev,
      expectedTokenA: amountAOut.toFixed(6),
      expectedTokenB: amountBOut.toFixed(6),
    }));
  }, [formData.poolType, formData.lpAmount, getPool]);

  // Update calculations when LP amount changes
  useEffect(() => {
    const timeoutId = setTimeout(calculateWithdrawalAmounts, 300);
    return () => clearTimeout(timeoutId);
  }, [calculateWithdrawalAmounts]);

  // Handle pool change
  const handlePoolChange = (poolType: string) => {
    setFormData(prev => ({
      ...prev,
      poolType: poolType as any,
      lpAmount: '',
      expectedTokenA: '',
      expectedTokenB: '',
    }));
  };

  // Handle percentage buttons
  const handlePercentage = (percentage: number) => {
    const currentPool = getCurrentPool();
    if (currentPool && currentPool.lpBalance > 0) {
      const amount = (currentPool.lpBalance * percentage) / 100;
      setFormData(prev => ({ ...prev, lpAmount: amount.toString() }));
    }
  };

  // Handle max button
  const handleMax = () => {
    handlePercentage(100);
  };

  // Calculate minimum amounts with slippage protection
  const getMinimumAmounts = () => {
    const expectedA = parseFloat(formData.expectedTokenA);
    const expectedB = parseFloat(formData.expectedTokenB);
    
    if (!expectedA || !expectedB) return { minAmountA: 0, minAmountB: 0 };
    
    const minAmountA = expectedA * (1 - formData.slippageA / 100);
    const minAmountB = expectedB * (1 - formData.slippageB / 100);
    
    return { minAmountA, minAmountB };
  };

  // Handle slippage input with validation
  const handleSlippageChange = (field: 'slippageA' | 'slippageB', value: string) => {
    const numericValue = parseFloat(value) || 0;
    const clampedValue = Math.max(0, Math.min(50, numericValue));
    setFormData(prev => ({ 
      ...prev, 
      [field]: clampedValue
    }));
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
    const lpAmount = parseFloat(formData.lpAmount);

    if (!currentPool || !lpAmount || lpAmount <= 0) {
      showToast('Please enter a valid LP token amount', 'error');
      return;
    }

    if (!currentPool.hasPosition) {
      showToast(`No liquidity position in ${currentPool.label}`, 'error');
      return;
    }

    if (lpAmount > currentPool.lpBalance) {
      showToast(`Insufficient LP token balance`, 'error');
      return;
    }

    const { minAmountA, minAmountB } = getMinimumAmounts();

    setIsSubmitting(true);

    try {
      const removeLiquidityRequest: RemoveLiquidityRequest = {
        poolType: formData.poolType,
        lpAmount: lpAmount,
        minAmountA: minAmountA,
        minAmountB: minAmountB,
      };

      emit(WS_EVENTS.REMOVE_LIQUIDITY, removeLiquidityRequest);
      showToast('Remove liquidity transaction submitted...', 'info');
    } catch (error) {
      setIsSubmitting(false);
      showToast('Failed to submit remove liquidity transaction', 'error');
    }
  };

  const currentPool = getCurrentPool();
  const poolOptions = getPoolOptions();
  const minimumAmounts = getMinimumAmounts();

  // Check if form is valid
  const isFormValid = () => {
    return (
      formData.lpAmount &&
      parseFloat(formData.lpAmount) > 0 &&
      currentPool?.hasPosition &&
      parseFloat(formData.lpAmount) <= (currentPool?.lpBalance || 0)
    );
  };

  return (
    <div className="card bg-white/90 backdrop-blur-sm shadow-xl border border-purple-200">
      <div className="card-body">
        <h2 className="card-title text-2xl mb-6 flex items-center gap-2 text-purple-600">
          <div className="w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
          Remove Liquidity
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pool Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold text-gray-700">Pool</span>
            </label>
            <select 
              className="select select-bordered select-secondary border-purple-200"
              value={formData.poolType}
              onChange={(e) => handlePoolChange(e.target.value)}
              disabled={isSubmitting}
            >
              {poolOptions.map(option => (
                <option 
                  key={option.value} 
                  value={option.value}
                  disabled={!option.hasPosition}
                >
                  {option.label} ({option.lpBalance.toFixed(2)} LP)
                  {!option.hasPosition && ' - No Position'}
                </option>
              ))}
            </select>
            {currentPool && !currentPool.hasPosition && (
              <label className="label">
                <span className="label-text-alt text-warning">No liquidity position in this pool</span>
              </label>
            )}
          </div>

          {/* LP Token Amount */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold text-gray-700">LP Token Amount</span>
            </label>
            <input 
              type="number"
              placeholder="0.0"
              className="input input-bordered input-secondary border-purple-200"
              value={formData.lpAmount}
              onChange={(e) => setFormData(prev => ({ ...prev, lpAmount: e.target.value }))}
              disabled={isSubmitting || !currentPool?.hasPosition}
              step="any"
              min="0"
              max={currentPool?.lpBalance || 0}
            />
            <label className="label">
              <span className="label-text-alt text-gray-500">
                Available: {currentPool ? currentPool.lpBalance.toFixed(6) : '0'} LP
              </span>
              <span className="label-text-alt">
                <button 
                  type="button"
                  className="link link-secondary text-xs"
                  onClick={handleMax}
                  disabled={isSubmitting || !currentPool?.hasPosition}
                >
                  MAX
                </button>
              </span>
            </label>
          </div>

          {/* Percentage Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map(percentage => (
              <button 
                key={percentage}
                type="button"
                className="btn btn-outline btn-sm border-purple-200 text-purple-600 hover:bg-purple-50"
                onClick={() => handlePercentage(percentage)}
                disabled={isSubmitting || !currentPool?.hasPosition}
              >
                {percentage}%
              </button>
            ))}
          </div>

          {/* Expected Withdrawal Preview */}
          {formData.lpAmount && formData.expectedTokenA && formData.expectedTokenB && (
            <div className="alert bg-purple-50 border-purple-200">
              <div className="text-sm w-full text-purple-700">
                <div className="font-semibold mb-2">You'll receive:</div>
                <div className="flex justify-between">
                  <span>{currentPool?.tokenA}:</span>
                  <span className="font-semibold">~{parseFloat(formData.expectedTokenA).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{currentPool?.tokenB}:</span>
                  <span className="font-semibold">~{parseFloat(formData.expectedTokenB).toLocaleString()}</span>
                </div>
                <div className="divider my-2"></div>
                <div className="text-xs text-purple-600">
                  <div className="flex justify-between">
                    <span>Min {currentPool?.tokenA} (with {formData.slippageA}% slippage):</span>
                    <span>{minimumAmounts.minAmountA.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min {currentPool?.tokenB} (with {formData.slippageB}% slippage):</span>
                    <span>{minimumAmounts.minAmountB.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Slippage Settings */}
          <div className="collapse collapse-arrow bg-purple-50 border border-purple-200">
            <input type="checkbox" /> 
            <div className="collapse-title text-sm font-medium text-purple-700">
              Advanced Settings (Slippage Tolerance)
            </div>
            <div className="collapse-content">
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-xs">{currentPool?.tokenA} Slippage %</span>
                  </label>
                  <input 
                    type="number"
                    className="input input-bordered input-xs"
                    value={formData.slippageA}
                    onChange={(e) => handleSlippageChange('slippageA', e.target.value)}
                    step="0.1"
                    min="0"
                    max="50"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-xs">{currentPool?.tokenB} Slippage %</span>
                  </label>
                  <input 
                    type="number"
                    className="input input-bordered input-xs"
                    value={formData.slippageB}
                    onChange={(e) => handleSlippageChange('slippageB', e.target.value)}
                    step="0.1"
                    min="0"
                    max="50"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-purple-600">
                Slippage tolerance protects you from price changes during transaction execution.
              </div>
            </div>
          </div>

          {/* Warning for no position */}
          {currentPool && !currentPool.hasPosition && (
            <div className="alert alert-warning bg-yellow-50 border-yellow-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-yellow-800">
                You don't have any liquidity position in this pool. Add liquidity first to earn fees.
              </span>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit"
            className={`btn btn-secondary btn-lg w-full ${isSubmitting ? 'loading' : ''}`}
            disabled={
              isSubmitting || 
              !canExecuteTransactions || 
              !isFormValid()
            }
          >
            {isSubmitting ? (
              'Processing Transaction...'
            ) : !canExecuteTransactions ? (
              'Trading Disabled'
            ) : !currentPool?.hasPosition ? (
              'No Position Available'
            ) : !isFormValid() ? (
              'Enter Valid Amount'
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/>
                </svg>
                Remove Liquidity
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RemoveLiquidityForm;