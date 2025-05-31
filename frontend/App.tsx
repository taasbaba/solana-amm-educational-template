import React, { useState, useEffect } from 'react'
import { initializeStores, useAuthStore, useSystemStore } from './stores'
import LoginForm from './components/auth/LoginForm'
import SignupForm from './components/auth/SignupForm'
import Dashboard from './components/dashboard/Dashboard'
import DevnetDown from './pages/DevnetDown'
import Toast from './components/ui/Toast'
import Loading from './components/common/Loading'

type ToastType = 'info' | 'success' | 'error' | 'warning'
type AuthMode = 'login' | 'signup'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

const App: React.FC = () => {
  // REMOVED: const app = useApp()
  // ADDED: Direct store access
  const user = useAuthStore(state => state.user)
  const authLoading = useAuthStore(state => state.authLoading)
  const sessionLoading = useAuthStore(state => state.sessionLoading)
  const devnetStatus = useSystemStore(state => state.devnetStatus)
  
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Initialize stores on app startup
  useEffect(() => {
    initializeStores().catch(console.error)
  }, [])

  // Toast management
  const showToast = (message: string, type: ToastType = 'info'): void => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
  }

  const removeToast = (id: string): void => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  // Loading state - check both auth and session loading
  if (authLoading || sessionLoading) {
    return <Loading />
  }

  // Check devnet status first - if down, show maintenance page
  if (devnetStatus.isDevnetDown) {
    return <DevnetDown />
  }

  // If user is logged in, show dashboard
  if (user) {
    return (
      <>
        <Dashboard />
        {/* Toast notifications */}
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </>
    )
  }

  // If user is not logged in, show auth forms
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-2xl">
        <div className="card-body">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-primary">Solana Pool</h1>
            <p className="text-base-content/70 mt-2">
              {authMode === 'login' ? 'Welcome back' : 'Create your account'}
            </p>
          </div>

          {/* Show devnet status warning if unstable */}
          {devnetStatus.isTransactionsLocked && !devnetStatus.isDevnetDown && (
            <div className="alert alert-warning mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm">System is unstable. Some features may be limited.</span>
            </div>
          )}

          {authMode === 'login' ? (
            <LoginForm 
              onToggleMode={() => setAuthMode('signup')}
              showToast={showToast}
            />
          ) : (
            <SignupForm 
              onToggleMode={() => setAuthMode('login')}
              showToast={showToast}
            />
          )}
        </div>
      </div>

      {/* Toast notifications */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

export default App