import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { LockedState } from './LockedState.jsx';

/**
 * Route protection placeholder.
 *
 * Client-side checks only gate the UI — a production deployment must validate
 * the JWT and role on every Express endpoint. The shape here already matches
 * that contract so the guard can be swapped for a server-verified one.
 */
export default function ProtectedRoute({ role, children }) {
  const { isAuthenticated, role: currentRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (role && currentRole !== role) {
    return <LockedState requiredRole={role} currentRole={currentRole} />;
  }

  return children;
}
