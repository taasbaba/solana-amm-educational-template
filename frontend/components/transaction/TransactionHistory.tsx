import React from 'react';
import { useSystemStore } from '../../stores/systemStore';

interface TransactionHistoryProps {
  className?: string;
  maxItems?: number;
  showClearButton?: boolean;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  className = '',
  maxItems = 50,
  showClearButton = true,
}) => {
  const { transactionHistory, clearTransactionHistory } = useSystemStore();

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };

  const displayedTransactions = transactionHistory.slice(0, maxItems);

  const getActionDisplayName = (action: string): string => {
    switch (action) {
      case 'swap':
        return 'Swap';
      case 'add_liquidity':
        return 'Add Liquidity';
      case 'remove_liquidity':
        return 'Remove Liquidity';
      case 'create_wallet':
        return 'Create Wallet';
      default:
        return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const truncateSignature = (signature: string, length: number = 16): string => {
    if (signature.length <= length) return signature;
    return `${signature.slice(0, length / 2)}...${signature.slice(-length / 2)}`;
  };

  const openInExplorer = (signature: string): void => {
    const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  };

  if (transactionHistory.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
        </div>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500">No transactions yet</p>
          <p className="text-sm text-gray-400 mt-1">Your transaction history will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {transactionHistory.length} transaction{transactionHistory.length !== 1 ? 's' : ''}
          </span>
          {showClearButton && transactionHistory.length > 0 && (
            <button
              onClick={clearTransactionHistory}
              className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {displayedTransactions.map((transaction) => (
          <div key={transaction.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {getActionDisplayName(transaction.action)}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <button
                        onClick={() => openInExplorer(transaction.txSignature)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-mono hover:underline"
                        title="View on Solana Explorer"
                      >
                        {truncateSignature(transaction.txSignature)}
                      </button>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(transaction.timestamp)}
                      </span>
                    </div>
                    {transaction.details && (
                      <p className="text-xs text-red-600 mt-1 truncate" title={transaction.details}>
                        {transaction.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                <button
                  onClick={() => openInExplorer(transaction.txSignature)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="View on Solana Explorer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {transactionHistory.length > maxItems && (
        <div className="p-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Showing {maxItems} of {transactionHistory.length} transactions
          </p>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;