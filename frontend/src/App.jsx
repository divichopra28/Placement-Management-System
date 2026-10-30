import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute, { homeFor } from './routes/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import { useAuth } from './hooks/AuthContext';
import { ErrorBoundary, EmptyState, Loader } from './components/ui';

import Login from './pages/Login';
import StudentDashboard from './pages/student/StudentDashboard';
import MyProfile from './pages/student/MyProfile';
import MySkills from './pages/student/MySkills';
import StudentJobs from './pages/student/StudentJobs';
import MyApplications from './pages/student/MyApplications';
import MyPlacement from './pages/student/MyPlacement';

import Companies from './pages/Companies';
import Interviews from './pages/Interviews';
import Offers from './pages/Offers';

import AdminDashboard from './pages/admin/AdminDashboard';
import Students from './pages/admin/Students';
import JobsAdmin from './pages/admin/JobsAdmin';
import EligibilityAdmin from './pages/admin/EligibilityAdmin';
import ApplicationsAdmin from './pages/admin/ApplicationsAdmin';
import Placements from './pages/admin/Placements';
import Reports from './pages/admin/Reports';
import AuditLogs from './pages/admin/AuditLogs';

function Home() {
  const { user, checking } = useAuth();
  if (checking) return <Loader />;
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

const page = (el) => <ErrorBoundary>{el}</ErrorBoundary>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      <Route path="/student" element={<ProtectedRoute role="STUDENT"><AppLayout /></ProtectedRoute>}>
        <Route index element={page(<StudentDashboard />)} />
        <Route path="profile" element={page(<MyProfile />)} />
        <Route path="skills" element={page(<MySkills />)} />
        <Route path="companies" element={page(<Companies />)} />
        <Route path="jobs" element={page(<StudentJobs />)} />
        <Route path="applications" element={page(<MyApplications />)} />
        <Route path="interviews" element={page(<Interviews />)} />
        <Route path="offers" element={page(<Offers />)} />
        <Route path="placement" element={page(<MyPlacement />)} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute role="OFFICER"><AppLayout /></ProtectedRoute>}>
        <Route index element={page(<AdminDashboard />)} />
        <Route path="students" element={page(<Students />)} />
        <Route path="companies" element={page(<Companies />)} />
        <Route path="jobs" element={page(<JobsAdmin />)} />
        <Route path="eligibility" element={page(<EligibilityAdmin />)} />
        <Route path="applications" element={page(<ApplicationsAdmin />)} />
        <Route path="interviews" element={page(<Interviews />)} />
        <Route path="offers" element={page(<Offers />)} />
        <Route path="placements" element={page(<Placements />)} />
        <Route path="reports" element={page(<Reports />)} />
        <Route path="audit" element={page(<AuditLogs />)} />
      </Route>

      <Route path="*" element={<div style={{ padding: 40 }}><EmptyState title="Page not found" message="The page you're looking for doesn't exist." action={<a className="btn btn-primary" href="/">Go home</a>} /></div>} />
    </Routes>
  );
}
