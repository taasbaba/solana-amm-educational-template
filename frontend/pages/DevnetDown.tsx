import React from 'react';
import { useSystemStore } from '../stores';

const DevnetDown: React.FC = () => {
  // Get devnet status directly from systemStore
  const devnetStatus = useSystemStore(state => state.devnetStatus);
  const getDevnetStatusMessage = useSystemStore(state => state.getDevnetStatusMessage);

  // Handle refresh action
  const handleRefresh = () => {
    window.location.reload();
  };

  // Get status color based on current status
  const getStatusColor = () => {
    switch (devnetStatus.status) {
      case 'up':
        return 'bg-success';
      case 'unstable':
        return 'bg-warning';
      case 'down':
        return 'bg-error';
      default:
        return 'bg-gray-400';
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (devnetStatus.status) {
      case 'up':
        return 'Operational';
      case 'unstable':
        return 'Unstable';
      case 'down':
        return 'Down';
      default:
        return 'Checking...';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="text-center max-w-2xl mx-auto p-8">
        {/* Icon */}
        <div className="text-8xl mb-6 text-warning">
          <div className="w-24 h-24 mx-auto bg-warning/20 rounded-full flex items-center justify-center">
            <svg 
              className="w-12 h-12 text-warning" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
          </div>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl font-bold mb-4 text-error">
          {devnetStatus.status === 'unstable' ? 'System Unstable' : 'System Maintenance'}
        </h1>

        {/* Status Message */}
        <p className="text-xl mb-6 text-base-content/80">
          {getDevnetStatusMessage()}
        </p>

        {/* Detailed Information */}
        <div className="bg-base-200 rounded-lg p-6 mb-8 text-left">
          <h3 className="text-lg font-semibold mb-4 text-center">What's happening?</h3>
          
          <div className="space-y-3 text-base-content/70">
            {devnetStatus.status === 'down' ? (
              <>
                <p>• Solana Devnet is experiencing connectivity issues</p>
                <p>• Our AMM platform is temporarily unavailable</p>
                <p>• All trading and wallet operations are paused</p>
              </>
            ) : (
              <>
                <p>• Solana Devnet is experiencing instability</p>
                <p>• Trading operations are temporarily disabled</p>
                <p>• Wallet viewing is still available</p>
                <p>• System will auto-resume when stable</p>
              </>
            )}
          </div>
        </div>

        {/* Status Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-base-200 rounded-lg p-4">
            <h4 className="font-semibold text-base-content/90 mb-2">System Status</h4>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
              <span className="text-sm capitalize text-base-content/70">
                {getStatusText()}
              </span>
            </div>
          </div>

          <div className="bg-base-200 rounded-lg p-4">
            <h4 className="font-semibold text-base-content/90 mb-2">Failure Count</h4>
            <span className="text-sm text-base-content/70">
              {devnetStatus.failureCount > 0 ? `${devnetStatus.failureCount} failures` : 'No failures'}
            </span>
          </div>

          <div className="bg-base-200 rounded-lg p-4">
            <h4 className="font-semibold text-base-content/90 mb-2">Last Update</h4>
            <span className="text-sm text-base-content/70">
              {devnetStatus.lastStatusUpdate 
                ? devnetStatus.lastStatusUpdate.toLocaleTimeString()
                : 'Checking...'
              }
            </span>
          </div>
        </div>

        {/* Expected Resolution */}
        <div className="bg-info/10 border border-info/20 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-2 text-info">Expected Resolution</h3>
          <p className="text-base-content/70">
            {devnetStatus.status === 'down' 
              ? 'Devnet issues typically resolve within 1-2 hours. We\'re monitoring the situation and will restore service automatically once Solana Devnet is stable.'
              : 'System instability usually resolves within 15-30 minutes. Trading will automatically resume when the network stabilizes.'
            }
          </p>
        </div>

        {/* Action Items */}
        <div className="space-y-4">
          <div className="text-base-content/60">
            <p className="mb-4">What you can do:</p>
            <div className="space-y-2 text-sm">
              <p>• Check back in {devnetStatus.status === 'down' ? '30 minutes' : '15 minutes'}</p>
              <p>• System will auto-recover when stable</p>
              {devnetStatus.status === 'unstable' && (
                <p>• View-only features are still available</p>
              )}
            </div>
          </div>

          {/* Refresh Button */}
          <button 
            className="btn btn-primary btn-outline"
            onClick={handleRefresh}
          >
            Check Status Again
          </button>
        </div>

        {/* Loading Indicator */}
        <div className="mt-8 flex flex-col items-center space-y-3">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="text-sm text-base-content/50">
            Monitoring system status...
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-base-300">
          <p className="text-xs text-base-content/40">
            This is a development environment using Solana Devnet. 
            Production systems would have additional redundancy and failover mechanisms.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DevnetDown;