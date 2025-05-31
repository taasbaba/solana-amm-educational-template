import React, { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'error' | 'success' | 'warning' | 'info'
  onClose: () => void
  duration?: number
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, duration = 5000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [onClose, duration])

  const alertClass = {
    error: 'alert-error',
    success: 'alert-success',
    warning: 'alert-warning',
    info: 'alert-info'
  }[type] || 'alert-info'

  return (
    <div className="toast toast-top toast-end z-50">
      <div className={`alert ${alertClass} shadow-lg`}>
        <div>
          <span>{message}</span>
        </div>
        <div className="flex-none">
          <button onClick={onClose} className="btn btn-sm btn-ghost">
            X
          </button>
        </div>
      </div>
    </div>
  )
}

export default Toast