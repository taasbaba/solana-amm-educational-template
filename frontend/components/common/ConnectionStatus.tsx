import React from 'react'
import { useWebSocketStore, useAuthStore, useSystemStore } from '../../stores'

const ConnectionStatus: React.FC = () => {
  // Get WebSocket state
  const isConnected = useWebSocketStore(state => state.isConnected)
  const isConnecting = useWebSocketStore(state => state.isConnecting)
  const connectionError = useWebSocketStore(state => state.connectionError)
  const reconnectAttempts = useWebSocketStore(state => state.reconnectAttempts)
  const retryConnection = useWebSocketStore(state => state.retryConnection)

  // Get Auth state
  const isInitialized = useAuthStore(state => state.isInitialized)
  const isCreatingWallet = useAuthStore(state => state.isCreatingWallet)
  const hasWallet = useAuthStore(state => state.hasWallet)

  // Get System state
  const devnetStatus = useSystemStore(state => state.devnetStatus)

  const getStatusColor = () => {
    if (!isConnected) return 'text-error'
    if (!isInitialized) return 'text-warning'
    if (isCreatingWallet) return 'text-info'
    return 'text-success'
  }

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...'
    if (!isConnected) return 'Disconnected'
    if (!isInitialized) return 'Initializing...'
    if (isCreatingWallet) return 'Creating Wallet...'
    if (hasWallet) return 'Connected & Ready'
    return 'Connected'
  }

  const getStatusIcon = () => {
    if (isConnecting) {
      return <span className="loading loading-spinner loading-xs"></span>
    }
        
    if (!isConnected) {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )
    }

    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    )
  }

  const handleRetryConnection = () => {
    retryConnection()
  }

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className={`flex items-center space-x-1 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>
            
      {/* Connection details */}
      {connectionError && (
        <div className="text-error text-xs">
          ({connectionError})
        </div>
      )}
            
      {/* Retry info and button */}
      {reconnectAttempts > 0 && !isConnected && (
        <div className="flex items-center space-x-1">
          <div className="text-warning text-xs">
            Retry {reconnectAttempts}/5
          </div>
          <button 
            onClick={handleRetryConnection}
            className="btn btn-xs btn-outline btn-warning"
            disabled={isConnecting}
          >
            Retry
          </button>
        </div>
      )}
            
      {/* Devnet status */}
      {devnetStatus.isDevnetDown && (
        <div className="badge badge-warning badge-xs">
          Devnet Down
        </div>
      )}

      {/* Transaction lock status */}
      {devnetStatus.isTransactionsLocked && !devnetStatus.isDevnetDown && (
        <div className="badge badge-error badge-xs">
          Transactions Locked
        </div>
      )}
    </div>
  )
}

export default ConnectionStatus