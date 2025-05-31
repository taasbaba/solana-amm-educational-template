import React, { useState } from 'react'
import { useAuthStore, useSystemStore } from '../../stores'

interface LoginFormProps {
  onToggleMode: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

const LoginForm: React.FC<LoginFormProps> = ({ onToggleMode, showToast }) => {
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  
  // Get auth state and methods
  const signIn = useAuthStore(state => state.signIn)
  const authLoading = useAuthStore(state => state.authLoading)
  const isInitialized = useAuthStore(state => state.isInitialized)
  const hasWallet = useAuthStore(state => state.hasWallet)

  // Get system health methods
  const isSystemHealthy = useSystemStore(state => state.isSystemHealthy())
  const getDevnetStatusMessage = useSystemStore(state => state.getDevnetStatusMessage)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!email || !password) {
      showToast('Please fill in all fields', 'error')
      return
    }

    // Check system health before attempting login
    if (!isSystemHealthy) {
      showToast(getDevnetStatusMessage(), 'warning')
      return
    }

    const result = await signIn(email, password)
    
    if (result.success) {
      showToast('Login successful!', 'success')
      
      // Show wallet status after successful login
      // Note: There might be a delay for business logic to initialize
      setTimeout(() => {
        if (isInitialized && !hasWallet) {
          showToast('Welcome! Creating your wallet...', 'info')
        } else if (isInitialized && hasWallet) {
          showToast('Welcome back! Your wallet is ready.', 'success')
        } else {
          showToast('Setting up your account...', 'info')
        }
      }, 2000) // Increased delay for business logic to complete
    } else {
      showToast(result.error || 'Login failed', 'error')
    }
  }

  return (
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
          placeholder="Enter your password"
          className="input input-bordered w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={authLoading}
        />
      </div>

      <div className="form-control mt-6">
        <button
          type="submit"
          className={`btn btn-primary w-full ${authLoading ? 'loading' : ''}`}
          disabled={authLoading}
        >
          {authLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </div>

      <div className="text-center mt-4">
        <p className="text-sm">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onToggleMode}
            className="link link-primary font-semibold"
            disabled={authLoading}
          >
            Sign Up
          </button>
        </p>
      </div>
    </form>
  )
}

export default LoginForm