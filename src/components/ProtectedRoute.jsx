import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleTarget } from '../utils/roleRedirect';

/**
 * Decision tree (strict order):
 * 1. currentUser === undefined OR roleLoading → Loading div
 * 2. currentUser === null → /login
 * 3. role === null → /choose-role  (authenticated but unassigned)
 * 4. role not in allowedRoles → role's actual target
 * 5. Pass → children
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { currentUser, role, isVolunteer, roleLoading } = useAuth();
  const location = useLocation();

  // 1. FIRST — block all redirect logic while auth/role resolving
  if (currentUser === undefined || roleLoading === true) {
    return <div className="text-white">Loading...</div>;
  }

  // 2. Not authenticated
  if (currentUser === null) {
    return <Navigate to="/login" replace />;
  }

  // 3. Authenticated but no role assigned yet → force role selection
  if (role === null) {
    // Guard: don't redirect if already heading to /choose-role
    if (location.pathname === '/choose-role') return null;
    return <Navigate to="/choose-role" replace />;
  }

  // 4. Authenticated but wrong role
  if (allowedRoles.length > 0) {
    const cleanRole = typeof role === 'string' ? role.trim() : role;
    const roleAllowed = allowedRoles.includes(cleanRole);
    const volunteerAllowed = allowedRoles.includes('is_volunteer') && isVolunteer;
    
    if (!roleAllowed && !volunteerAllowed) {
      const safeTarget = getRoleTarget(cleanRole);
      if (location.pathname === safeTarget) return null;
      return <Navigate to={safeTarget} replace />;
    }
  }

  // 5. Pass
  return children;
}
