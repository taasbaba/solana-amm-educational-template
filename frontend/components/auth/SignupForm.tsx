import React, { useState, useEffect } from 'react'
import { useAuthStore, useSystemStore, useWebSocketStore } from '../../stores'

interface SignupFormProps {
  onToggleMode: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

const SignupForm: React.FC<SignupFormProps> = ({ onToggleMode, showToast }) => {
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [isWalletStep, setIsWalletStep] = useState(false)
  
  // Get auth state and methods
  const signUp = useAuthStore(state => state.signUp)
  const authLoading = useAuthStore(state => state.authLoading)
  const user = useAuthStore(state => state.user)
  const isInitialized = useAuthStore(state => state.isInitialized)
  const hasWallet = useAuthStore(state => state.hasWallet)
  const isCreatingWallet = useAuthStore(state => state.isCreatingWallet)

  // Get system health methods
  const canCreateWallet = useSystemStore(state => state.canCreateWallet())
  const isSystemHealthy = useSystemStore(state => state.isSystemHealthy())
  const getDevnetStatusMessage = useSystemStore(state => state.getDevnetStatusMessage)

  // Get websocket method for wallet creation
  const createWallet = useWebSocketStore(state => state.createWallet)

  // Handle wallet creation after successful signup
  useEffect(() => {
    if (user && isInitialized && !hasWallet && !isCreatingWallet && isWalletStep) {
      // Automatically create wallet after signup
      handleWalletCreation()
    }
  }, [user, isInitialized, hasWallet, isCreatingWallet, isWalletStep])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Validation
    if (!email || !password || !confirmPassword) {
      showToast('Please fill in all fields', 'error')
      return
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    // Check system health
    if (!isSystemHealthy) {
      showToast(getDevnetStatusMessage(), 'warning')
      return
    }

    try {
      const result = await signUp(email, password)
      
      if (result && result.success) {
        showToast('Account created successfully!', 'success')
        setIsWalletStep(true)
        
        // Check if we can create wallet immediately
        if (canCreateWallet) {
          showToast('Creating your Solana wallet...', 'info')
        } else {
          showToast('Account created! Wallet will be created when system is available.', 'warning')
        }
      } else {
        showToast(result?.error || 'Signup failed', 'error')
      }
    } catch (error) {
      showToast('An unexpected error occurred', 'error')
    }
  }

  const handleWalletCreation = async () => {
    if (!canCreateWallet) {
      showToast('Cannot create wallet: System is currently unavailable', 'error')
      return
    }

    try {
      // createWallet from websocketStore doesn't return a promise,
      // it just triggers the WebSocket event and wallet creation is handled via events
      createWallet()
      
      showToast('Wallet creation initiated...', 'info')
      
      // Wait a bit and check the result
      setTimeout(() => {
        if (hasWallet) {
          showToast('Wallet created successfully! You can now start trading.', 'success')
          
          // Switch to login after successful wallet creation
          setTimeout(() => {
            showToast('Welcome! Your account and wallet are ready.', 'success')
          }, 1500)
        } else if (!isCreatingWallet) {
          // If not creating and no wallet, something went wrong
          showToast('Wallet creation may have failed. You can try again after logging in.', 'warning')
          setTimeout(() => {
            onToggleMode()
          }, 2000)
        }
      }, 3000)
      
    } catch (error) {
      showToast('Wallet creation failed', 'error')
    }
  }

  const handleSkipWallet = () => {
    showToast('You can create your wallet after logging in.', 'info')
    setTimeout(() => {
      onToggleMode()
    }, 1000)
  }

  // If user is created and we're in wallet step
  if (isWalletStep && user) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-success">Account Created!</h3>
          <p className="text-sm text-base-content/70 mt-2">
            Now creating your Solana wallet...
          </p>
        </div>

        {/* Devnet status warning for wallet creation */}
        {!canCreateWallet && (
          <div className="alert alert-warning">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm">
              <p className="font-semibold">System Unavailable</p>
              <p>{getDevnetStatusMessage()}</p>
            </div>
          </div>
        )}

        <div className="alert alert-info">
          <div className="text-sm">
            <h4 className="font-semibold">Wallet Creation</h4>
            <p className="text-xs opacity-80">
              {isCreatingWallet 
                ? "Creating your Solana wallet and funding with initial tokens..."
                : canCreateWallet
                ? "Ready to create your wallet with starting tokens for trading!"
                : "Wallet creation will be available when the system is stable."
              }
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {canCreateWallet ? (
            <button
              onClick={handleWalletCreation}
              className={`btn btn-primary w-full ${isCreatingWallet ? 'loading' : ''}`}
              disabled={isCreatingWallet}
            >
              {isCreatingWallet ? 'Creating Wallet...' : 'Create Wallet Now'}
            </button>
          ) : (
            <button
              className="btn btn-primary w-full"
              disabled
            >
              Wallet Creation Unavailable
            </button>
          )}

          <button
            onClick={handleSkipWallet}
            className="btn btn-outline w-full"
            disabled={isCreatingWallet}
          >
            Skip for Now
          </button>
        </div>

        <div className="text-center mt-4">
          <p className="text-xs text-base-content/60">
            You can create your wallet later from the dashboard.
          </p>
        </div>
      </div>
    )
  }

  // Regular signup form
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* System status warning */}
        {!isSystemHealthy && (
          <div className="alert alert-warning">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm">{getDevnetStatusMessage()}</span>
          </div>
        )}

        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Email</span>
          </label>
          <input
            type="email"
            placeholder="Enter your email"
            className="input input-bordered w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={authLoading}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Password</span>
          </label>
          <input
            type="password"
            placeholder="Enter your password (min 6 characters)"
            className="input input-bordered w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={authLoading}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Confirm Password</span>
          </label>
          <input
            type="password"
            placeholder="Confirm your password"
            className="input input-bordered w-full"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={authLoading}
          />
        </div>

        <div className="alert alert-info">
          <div className="text-sm">
            <h4 className="font-semibold">Automatic Wallet Creation</h4>
            <p className="text-xs opacity-80">
              {canCreateWallet 
                ? "A Solana wallet will be created after signup with starting tokens for trading!"
                : "Wallet creation will be available when the system is stable."
              }
            </p>
          </div>
        </div>

        <div className="form-control mt-6">
          <button
            type="submit"
            className={`btn btn-primary w-full ${authLoading ? 'loading' : ''}`}
            disabled={authLoading}
          >
            {authLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>

        <div className="text-center mt-4">
          <p className="text-sm">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onToggleMode}
              className="link link-primary font-semibold"
              disabled={authLoading}
            >
              Sign In
            </button>
          </p>
        </div>
      </form>
    </div>
  )
}

export default SignupForm