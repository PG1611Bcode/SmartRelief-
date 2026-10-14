/**
 * roleRedirect.js — maps a user role to their home route.
 * Used by ProtectedRoute, Unauthorized, Login, Signup, and root redirect.
 */

/**
 * @param {'admin'|'volunteer'|'requester'|null} role
 * @param {function} navigate - react-router-dom navigate fn
 */
export function getRoleTarget(role) {
  const cleanRole = typeof role === 'string' ? role.trim() : role;
  switch (cleanRole) {
    case 'admin': return '/admin-dash';
    case 'volunteer': return '/volunteer-dash';
    case 'requester': return '/status';
    default: return '/login';
  }
}

/**
 * @param {'admin'|'volunteer'|'requester'|null} role
 * @param {function} navigate - react-router-dom navigate fn
 */
export function redirectByRole(role, navigate) {
  const target = getRoleTarget(role);
  if (window.location.pathname === target) return;
  navigate(target, { replace: true });
}
