import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { Loader } from '../components/ui';

export function homeFor(user) {
  return user?.role === 'OFFICER' ? '/admin' : '/student';
}

/** Frontend guard only — the backend enforces the same rules on every endpoint. */
export default function ProtectedRoute({ role, children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Loader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}
