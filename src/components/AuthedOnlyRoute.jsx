import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * AuthedOnlyRoute — guards /choose-role.
 * Logged-out users → /login
 * Loading → Loading div
 * Authenticated (any role) → render children
 */
export default function AuthedOnlyRoute({ children }) {
  const { currentUser, roleLoading } = useAuth();

  // Still resolving auth state
  if (currentUser === undefined || roleLoading) {
    return <div className="text-white">Loading...</div>;
  }

  // Not authenticated at all
  if (currentUser === null) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated — render the page regardless of role
  return children;
}
