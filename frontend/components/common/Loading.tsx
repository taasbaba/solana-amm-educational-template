import React from 'react'

const Loading = () => {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center">
      <div className="text-center">
        <div className="loading loading-spinner loading-lg text-primary"></div>
        <p className="mt-4 text-base-content/70">Loading...</p>
      </div>
    </div>
  )
}

export default Loading