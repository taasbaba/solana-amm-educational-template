import React from "react";
import Dashboard from "../components/dashboard/Dashboard";
import { useAuthStore } from "../stores";

const DashboardPage: React.FC = () => {
  // Get auth state directly from authStore
  const user = useAuthStore(state => state.user);
  const authLoading = useAuthStore(state => state.authLoading);
  const sessionLoading = useAuthStore(state => state.sessionLoading);
  const authError = useAuthStore(state => state.authError);

  // Show loading state while session is being initialized
  if (sessionLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state if authentication failed
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="alert alert-error max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">Authentication Error</h3>
            <div className="text-xs">{authError}</div>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if no user
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="alert alert-info max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <h3 className="font-bold">Authentication Required</h3>
            <div className="text-xs">Please log in to access your dashboard.</div>
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard component (no need to pass app object anymore)
  return <Dashboard />;
};

export default DashboardPage;