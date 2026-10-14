import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthedOnlyRoute from './components/AuthedOnlyRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Landing from './pages/Landing';
import Unauthorized from './pages/Unauthorized';
import ChooseRole from './pages/ChooseRole';
import AdminDash from './pages/AdminDash';
import AdminVolunteers from './pages/AdminVolunteers';
import AdminPriorities from './pages/AdminPriorities';
import AdminMyRequests from './pages/AdminMyRequests';
import VolunteerDash from './pages/VolunteerDash';
import VolunteerProfile from './pages/VolunteerProfile';
import RequesterStatus from './pages/RequesterStatus';
import VolunteerTasks from './pages/VolunteerTasks';
import NeedsIntake from './pages/dashboard/NeedsIntake';
import { redirectByRole } from './utils/roleRedirect';

/**
 * PublicRoute — wraps routes that should redirect logged-in users away.
 *
 * While loading     → Loading div
 * Logged in, role null → /choose-role (user needs to pick a role)
 * Logged in, role set  → redirectByRole (goes to their dashboard)
 * Logged out           → render children (the public page)
 */
function PublicRoute({ children }) {
  const { currentUser, role, roleLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Guard: do not redirect while loading
    if (currentUser === undefined || roleLoading === true) return;
    // Guard: only act when user is logged in
    if (currentUser === null) return;

    if (role === null) {
      // Authenticated but no role — send to role picker
      if (window.location.pathname !== '/choose-role') {
        navigate('/choose-role', { replace: true });
      }
    } else {
      // Authenticated with role — send to dashboard
      redirectByRole(role, navigate);
    }
  }, [currentUser, role, roleLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Still resolving
  if (currentUser === undefined || roleLoading === true) {
    return <div className="text-white">Loading...</div>;
  }

  // Logged in — return null while useEffect fires the redirect
  if (currentUser !== null) {
    return null;
  }

  // Logged out — render the public page
  return children;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#18181B',
              color: '#FAFAFA',
              border: '1px solid rgba(255,255,255,0.10)',
            },
          }}
        />
        <Routes>
          {/* Public routes — redirect logged-in users to their dashboard */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route path="/signup" element={<Signup />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Role selection — authenticated users only (any role state) */}
          <Route
            path="/choose-role"
            element={
              <AuthedOnlyRoute>
                <ChooseRole />
              </AuthedOnlyRoute>
            }
          />

          {/* Protected role-split routes */}
          <Route
            path="/admin-dash/volunteers"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminVolunteers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dash/priorities"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPriorities />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dash/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDash />
              </ProtectedRoute>
            }
          >
            <Route path="my-requests" element={<AdminMyRequests />} />
          </Route>
          <Route
            path="/volunteer-dash/profile"
            element={
              <ProtectedRoute allowedRoles={['volunteer', 'admin', 'is_volunteer']}>
                <VolunteerProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/volunteer-dash/tasks"
            element={
              <ProtectedRoute allowedRoles={['volunteer', 'admin', 'is_volunteer']}>
                <VolunteerTasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/volunteer-dash/*"
            element={
              <ProtectedRoute allowedRoles={['volunteer', 'admin', 'is_volunteer']}>
                <VolunteerDash />
              </ProtectedRoute>
            }
          />
          <Route
            path="/status"
            element={
              <ProtectedRoute allowedRoles={['requester']}>
                <RequesterStatus />
              </ProtectedRoute>
            }
          />

          <Route
            path="/needs-intake"
            element={
              <ProtectedRoute allowedRoles={['requester', 'admin']}>
                <div className="min-h-screen bg-[#09090B]">
                  <NeedsIntake />
                </div>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
