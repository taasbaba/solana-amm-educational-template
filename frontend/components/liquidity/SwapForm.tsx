import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocketStore, usePoolStore, useWalletStore, useSystemStore } from '../../stores';
import { WS_EVENTS, SwapRequest } from '../../types/websocket';
import { formatTokenAmount } from "../../utils/formatters";

interface SwapFormProps {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const SwapForm: React.FC<SwapFormProps> = ({ showToast }) => {
  // Get store data and methods
  const isConnected = useWebSocketStore(state => state.isConnected);
  const emit = useWebSocketStore(state => state.emit);
  
  const getPool = usePoolStore(state => state.getPool);
  
  const getTokenBalance = useWalletStore(state => state.getTokenBalance);
  
  const canExecuteTransactions = useSystemStore(state => state.canExecuteTransactions());
  const lastTransactionResult = useSystemStore(state => state.lastTransactionResult);

  const [formData, setFormData] = useState({
    poolType: 'NTD-USD' as 'NTD-USD' | 'USD-YEN' | 'NTD-YEN',
    fromToken: 'NTD' as 'NTD' | 'USD' | 'YEN',
    toToken: 'USD' as 'NTD' | 'USD' | 'YEN',
    amountIn: '',
    expectedAmountOut: '',
    slippage: 0.5, // 0.5%
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priceImpact, setPriceImpact] = useState(0);
  const [fee, setFee] = useState(0);

  // Pool options
  const poolOptions = [
    { value: 'NTD-USD', label: 'NTD ↔ USD (Stable)', tokens: ['NTD', 'USD'] },
    { value: 'USD-YEN', label: 'USD ↔ YEN (Standard)', tokens: ['USD', 'YEN'] },
    { value: 'NTD-YEN', label: 'NTD ↔ YEN (Concentrated)', tokens: ['NTD', 'YEN'] },
  ];

  // Calculate DEX exchange rates from pool reserves
  const getDexExchangeRates = () => {
    const ntdUsdPool = getPool('NTD-USD');
    const usdYenPool = getPool('USD-YEN');
    const ntdYenPool = getPool('NTD-YEN');

    const rates: Record<string, number> = {};

    if (ntdUsdPool) {
      // NTD-USD pool: vaultA = NTD, vaultB = USD
      rates['NTD-USD'] = ntdUsdPool.vaultBBalance / ntdUsdPool.vaultABalance; // 1 NTD = X USD
      rates['USD-NTD'] = ntdUsdPool.vaultABalance / ntdUsdPool.vaultBBalance; // 1 USD = X NTD
    }

    if (usdYenPool) {
      // USD-YEN pool: vaultA = USD, vaultB = YEN
      rates['USD-YEN'] = usdYenPool.vaultBBalance / usdYenPool.vaultABalance; // 1 USD = X YEN
      rates['YEN-USD'] = usdYenPool.vaultABalance / usdYenPool.vaultBBalance; // 1 YEN = X USD
    }

    if (ntdYenPool) {
      // NTD-YEN pool: vaultA = NTD, vaultB = YEN
      rates['NTD-YEN'] = ntdYenPool.vaultBBalance / ntdYenPool.vaultABalance; // 1 NTD = X YEN
      rates['YEN-NTD'] = ntdYenPool.vaultABalance / ntdYenPool.vaultBBalance; // 1 YEN = X NTD
    }

    return rates;
  };

  // Calculate arbitrage opportunity vs real market rates
  const calculateArbitrageOpportunity = () => {
    const dexRates = getDexExchangeRates();
    
    // Real market rates (keep these as reference)
    const realRates = {
      'NTD-USD': 0.032,    // 1 NTD = $0.032 USD
      'USD-YEN': 149.25,   // 1 USD = ¥149.25 YEN
      'YEN-USD': 0.0067,   // 1 YEN = $0.0067 USD
    };

    const opportunities: Record<string, { dexRate: number; realRate: number; arbitrage: number }> = {};

    if (dexRates['NTD-USD'] && realRates['NTD-USD']) {
      const arbitrage = ((dexRates['NTD-USD'] - realRates['NTD-USD']) / realRates['NTD-USD']) * 100;
      opportunities['NTD-USD'] = {
        dexRate: dexRates['NTD-USD'],
        realRate: realRates['NTD-USD'],
        arbitrage: arbitrage
      };
    }

    if (dexRates['USD-YEN'] && realRates['USD-YEN']) {
      const arbitrage = ((dexRates['USD-YEN'] - realRates['USD-YEN']) / realRates['USD-YEN']) * 100;
      opportunities['USD-YEN'] = {
        dexRate: dexRates['USD-YEN'],
        realRate: realRates['USD-YEN'],
        arbitrage: arbitrage
      };
    }

    return opportunities;
  };

  // Show slippage protection message with details
  const showSlippageProtectionMessage = () => {
    const expectedOut = parseFloat(formData.expectedAmountOut);
    const minReceived = expectedOut * (1 - formData.slippage / 100);
    
    showToast(
      `Slippage Protection Activated! Pool price changed during execution. ` +
      `Expected: ${expectedOut.toFixed(6)} ${formData.toToken}, ` +
      `Minimum: ${minReceived.toFixed(6)} ${formData.toToken}. ` +
      `Your funds are safe. Try again or increase slippage tolerance.`,
      'warning'
    );
  };

  // Handle transaction results from system store
  useEffect(() => {
    if (!lastTransactionResult) return;
    
    // Only handle if this was a swap transaction
    if (isSubmitting) {
      setIsSubmitting(false);
      
      if (lastTransactionResult.success) {
        showToast(
          `Swap completed! Transaction: ${lastTransactionResult.txSignature?.slice(0, 8)}...`,
          'success'
        );
        // Reset form
        setFormData(prev => ({
          ...prev,
          amountIn: '',
          expectedAmountOut: '',
        }));
      } else {
        // Check if it's a slippage error
        const errorMessage = lastTransactionResult.error || '';
        const isSlippageError = errorMessage.includes('SlippageExceeded') || 
                               errorMessage.includes('Slippage tolerance exceeded');
        
        if (isSlippageError) {
          // This is slippage protection working - not a real failure
          showSlippageProtectionMessage();
        } else {
          // This is a real transaction failure
          showToast(errorMessage || 'Swap failed', 'error');
        }
      }
    }
  }, [lastTransactionResult, isSubmitting, showToast]);

  // Calculate expected output and fees using your program's exact math
  const calculateSwapOutput = useCallback(() => {
    const pool = getPool(formData.poolType);
    const amountIn = parseFloat(formData.amountIn);
    
    if (!pool || !amountIn || amountIn <= 0) {
      setFormData(prev => ({ ...prev, expectedAmountOut: '' }));
      setPriceImpact(0);
      setFee(0);
      return;
    }

    const { vaultABalance, vaultBBalance, feeRate, poolType } = pool;
    const isTokenAToB = formData.fromToken === getTokenSymbols().tokenA;
    
    const inputReserve = isTokenAToB ? vaultABalance : vaultBBalance;
    const outputReserve = isTokenAToB ? vaultBBalance : vaultABalance;
    
    // Calculate fee using your program's formula: (amount_in * fee_rate) / 100000
    const feeAmount = (amountIn * feeRate) / 100000;
    const amountInAfterFee = amountIn - feeAmount;
    
    // Calculate output using your program's exact formulas
    let outputAmount = 0;
    
    // Standard calculation: (output_balance * amount_in_after_fee) / (input_balance + amount_in_after_fee)
    const standardOut = (outputReserve * amountInAfterFee) / (inputReserve + amountInAfterFee);
    
    switch (poolType) {
      case 0: // Standard Pool
        outputAmount = standardOut;
        break;
      case 1: // Stable Pool - standard + 5% bonus to reduce slippage
        const stabilityBonus = amountInAfterFee / 20; // 5% bonus
        outputAmount = Math.min(standardOut + stabilityBonus, outputReserve - 1);
        break;
      case 2: // Concentrated Pool - standard + 10% efficiency bonus  
        const efficiencyBonus = amountInAfterFee / 10; // 10% bonus
        outputAmount = Math.min(standardOut + efficiencyBonus, outputReserve - 1);
        break;
      default:
        outputAmount = standardOut;
    }
    
    // Calculate price impact: (amount_in_after_fee / (input_reserve + amount_in_after_fee)) * 100
    const priceImpactCalc = (amountInAfterFee / (inputReserve + amountInAfterFee)) * 100;
    
    setFormData(prev => ({ ...prev, expectedAmountOut: outputAmount.toFixed(6) }));
    setPriceImpact(priceImpactCalc);
    setFee(feeAmount);
  }, [formData.poolType, formData.amountIn, formData.fromToken, getPool]);

  // Update calculations when inputs change
  useEffect(() => {
    const timeoutId = setTimeout(calculateSwapOutput, 300);
    return () => clearTimeout(timeoutId);
  }, [calculateSwapOutput]);

  // Get token symbols for current pool
  const getTokenSymbols = () => {
    switch (formData.poolType) {
      case 'NTD-USD':
        return { tokenA: 'NTD', tokenB: 'USD' };
      case 'USD-YEN':
        return { tokenA: 'USD', tokenB: 'YEN' };
      case 'NTD-YEN':
        return { tokenA: 'NTD', tokenB: 'YEN' };
      default:
        return { tokenA: 'NTD', tokenB: 'USD' };
    }
  };

  // Handle pool selection change
  const handlePoolChange = (poolType: string) => {
    const pool = poolOptions.find(p => p.value === poolType);
    if (pool) {
      setFormData(prev => ({
        ...prev,
        poolType: poolType as any,
        fromToken: pool.tokens[0] as any,
        toToken: pool.tokens[1] as any,
        amountIn: '',
        expectedAmountOut: '',
      }));
    }
  };

  // Handle token swap (flip from/to tokens)
  const handleTokenSwap = () => {
    setFormData(prev => ({
      ...prev,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
      amountIn: '',
      expectedAmountOut: '',
    }));
  };

  // Handle max button
  const handleMaxAmount = () => {
    const maxBalance = getTokenBalance(formData.fromToken);
    setFormData(prev => ({
      ...prev,
      amountIn: maxBalance.toString(),
    }));
  };

  // Handle slippage change
  const handleSlippageChange = (value: string) => {
    const numericValue = parseFloat(value) || 0;
    const clampedValue = Math.max(0, Math.min(50, numericValue));
    setFormData(prev => ({ ...prev, slippage: clampedValue }));
  };

  // Get available tokens for from/to selection
  const getAvailableTokens = () => {
    const { tokenA, tokenB } = getTokenSymbols();
    return [tokenA, tokenB];
  };

  // Handle from token change
  const handleFromTokenChange = (token: string) => {
    const { tokenA, tokenB } = getTokenSymbols();
    const newToToken = token === tokenA ? tokenB : tokenA;
    setFormData(prev => ({
      ...prev,
      fromToken: token as any,
      toToken: newToToken as any,
      amountIn: '',
      expectedAmountOut: '',
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

    const amountIn = parseFloat(formData.amountIn);
    const expectedOut = parseFloat(formData.expectedAmountOut);

    if (!amountIn || amountIn <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    if (!expectedOut || expectedOut <= 0) {
      showToast('Invalid swap calculation', 'error');
      return;
    }

    const userBalance = getTokenBalance(formData.fromToken);
    if (amountIn > userBalance) {
      showToast(`Insufficient ${formData.fromToken} balance`, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const { tokenA } = getTokenSymbols();
      const swapRequest: SwapRequest = {
        poolType: formData.poolType,
        amountIn: amountIn,
        tokenType: formData.fromToken === tokenA ? 'A' : 'B',
        minAmountOut: expectedOut * (1 - formData.slippage / 100), // Apply slippage tolerance
      };

      emit(WS_EVENTS.SWAP, swapRequest);
      showToast('Swap transaction submitted...', 'info');
    } catch (error) {
      setIsSubmitting(false);
      showToast('Failed to submit swap transaction', 'error');
    }
  };

  // Check if form is valid
  const isFormValid = () => {
    const amountIn = parseFloat(formData.amountIn || '0');
    return (
      amountIn > 0 &&
      formData.expectedAmountOut &&
      amountIn <= getTokenBalance(formData.fromToken)
    );
  };

  // Get current DEX exchange rate for display
  const getCurrentDexRate = () => {
    const dexRates = getDexExchangeRates();
    const rateKey = `${formData.fromToken}-${formData.toToken}`;
    return dexRates[rateKey] || 0;
  };

  // Get arbitrage opportunity for current pair
  const getCurrentArbitrageOpportunity = () => {
    const opportunities = calculateArbitrageOpportunity();
    const opportunityKey = formData.poolType;
    return opportunities[opportunityKey];
  };

  return (
    <div className="card bg-white/90 backdrop-blur-sm shadow-xl border border-green-200">
      <div className="card-body">
        <h2 className="card-title text-2xl mb-6 flex items-center gap-2 text-green-600">
          <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full"></div>
          Swap Tokens
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pool Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold text-gray-700">Pool</span>
            </label>
            <select 
              className="select select-bordered select-success border-green-200"
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

          {/* DEX Rate Display */}
          {getCurrentDexRate() > 0 && (
            <div className="alert bg-blue-50 border-blue-200">
              <div className="text-sm w-full text-blue-700">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">DEX Pool Rate:</span>
                  <span>1 {formData.fromToken} = {getCurrentDexRate().toFixed(6)} {formData.toToken}</span>
                </div>
              </div>
            </div>
          )}

          {/* Slippage Protection Info */}
          {formData.amountIn && formData.expectedAmountOut && (
            <div className="alert bg-blue-50 border-blue-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div className="text-sm text-blue-700">
                <div className="font-semibold mb-1">Slippage Protection Active</div>
                <div>Transaction will only execute if you receive at least {(parseFloat(formData.expectedAmountOut) * (1 - formData.slippage / 100)).toFixed(6)} {formData.toToken}.</div>
                <div className="text-xs mt-1 opacity-80">If pool price changes too much, transaction will be cancelled to protect you.</div>
              </div>
            </div>
          )}

          {/* From Token Input - Only Input Field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold text-gray-700">You Pay</span>
            </label>
            <div className="relative">
              <input 
                type="number"
                placeholder="0.0"
                className="input input-bordered input-success w-full pr-24 border-green-200"
                value={formData.amountIn}
                onChange={(e) => setFormData(prev => ({ ...prev, amountIn: e.target.value }))}
                disabled={isSubmitting}
                step="any"
                min="0"
              />
              <div className="absolute inset-y-0 right-0 flex items-center">
                <select 
                  className="select select-bordered select-success border-l-0 rounded-l-none border-green-200"
                  value={formData.fromToken}
                  onChange={(e) => handleFromTokenChange(e.target.value)}
                  disabled={isSubmitting}
                >
                  {getAvailableTokens().map(token => (
                    <option key={token} value={token}>{token}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="label">
              <span className="label-text-alt text-gray-500">
                Balance: {formatTokenAmount(getTokenBalance(formData.fromToken), 6, 2)} {formData.fromToken}
              </span>
              <span className="label-text-alt">
                <button 
                  type="button"
                  className="link link-success text-xs"
                  onClick={handleMaxAmount}
                  disabled={isSubmitting}
                >
                  MAX
                </button>
              </span>
            </label>
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center">
            <button 
              type="button"
              className="btn btn-circle btn-ghost hover:rotate-180 transition-transform duration-500 text-green-500"
              onClick={handleTokenSwap}
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </button>
          </div>

          {/* To Token Display - Read Only */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold text-gray-700">You Receive</span>
            </label>
            <div className="relative">
              <input 
                type="text"
                placeholder="0.0"
                className="input input-bordered bg-gray-50 w-full pr-20 border-green-200"
                value={formData.expectedAmountOut}
                readOnly
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-gray-700 font-medium">{formData.toToken}</span>
              </div>
            </div>
            <label className="label">
              <span className="label-text-alt text-gray-500">
                Balance: {formatTokenAmount(getTokenBalance(formData.toToken), 6, 2)} {formData.toToken}
              </span>
            </label>
          </div>

          {/* Swap Details */}
          {formData.amountIn && formData.expectedAmountOut && (
            <div className="alert bg-green-50 border-green-200">
              <div className="text-sm w-full text-green-700">
                <div className="flex justify-between">
                  <span>Exchange Rate:</span>
                  <span>1 {formData.fromToken} = {(parseFloat(formData.expectedAmountOut) / parseFloat(formData.amountIn)).toFixed(6)} {formData.toToken}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price Impact:</span>
                  <span className={`${priceImpact > 5 ? 'text-warning' : 'text-green-600'}`}>
                    {priceImpact.toFixed(3)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Trading Fee:</span>
                  <span>{fee.toFixed(6)} {formData.fromToken}</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum Received:</span>
                  <span>{(parseFloat(formData.expectedAmountOut) * (1 - formData.slippage / 100)).toFixed(6)} {formData.toToken}</span>
                </div>
              </div>
            </div>
          )}

          {/* Slippage Settings */}
          <div className="collapse collapse-arrow bg-green-50 border border-green-200">
            <input type="checkbox" /> 
            <div className="collapse-title text-sm font-medium text-green-700">
              Slippage Tolerance ({formData.slippage}%)
            </div>
            <div className="collapse-content">
              <div className="flex items-center space-x-2 pt-2">
                <input 
                  type="number"
                  className="input input-bordered input-sm flex-1"
                  value={formData.slippage}
                  onChange={(e) => handleSlippageChange(e.target.value)}
                  step="0.1"
                  min="0"
                  max="50"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-gray-600">%</span>
              </div>
              <div className="flex space-x-2 mt-2">
                {[0.1, 0.5, 1.0, 3.0].map(value => (
                  <button
                    key={value}
                    type="button"
                    className={`btn btn-xs ${formData.slippage === value ? 'btn-success' : 'btn-outline'}`}
                    onClick={() => setFormData(prev => ({ ...prev, slippage: value }))}
                    disabled={isSubmitting}
                  >
                    {value}%
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-green-600">
                Higher slippage tolerance = lower chance of protection activation
              </div>
            </div>
          </div>

          {/* Warning for high price impact */}
          {priceImpact > 5 && (
            <div className="alert alert-warning bg-yellow-50 border-yellow-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-yellow-800">High price impact! Consider reducing swap amount.</span>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit"
            className={`btn btn-success btn-lg w-full ${isSubmitting ? 'loading' : ''}`}
            disabled={
              isSubmitting || 
              !canExecuteTransactions || 
              !isFormValid()
            }
          >
            {isSubmitting ? (
              'Processing Swap...'
            ) : !canExecuteTransactions ? (
              'Trading Disabled'
            ) : !isFormValid() ? (
              'Enter Amount'
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
                Execute Swap (Protected by {formData.slippage}% slippage)
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SwapForm;