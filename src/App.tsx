import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import AnalyticsPage from './pages/AnalyticsPage';
import AssistantPage from './pages/AssistantPage';
import DashboardPage from './pages/DashboardPage';
import FamilyPage from './pages/FamilyPage';
import GoalsPage from './pages/GoalsPage';
import RetirementPage from './pages/RetirementPage';
import AuthLayout from './pages/AuthLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }
  return children;
}

function RedirectIfAuthed({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="login" replace /> },
      { path: 'login', element: <RedirectIfAuthed><LoginPage /></RedirectIfAuthed> },
      { path: 'register', element: <RedirectIfAuthed><RegisterPage /></RedirectIfAuthed> },
      { path: 'reset', element: <RedirectIfAuthed><ResetPasswordPage /></RedirectIfAuthed> },
    ],
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'goals', element: <GoalsPage /> },
      { path: 'retirement', element: <RetirementPage /> },
      { path: 'family', element: <FamilyPage /> },
      { path: 'assistant', element: <AssistantPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/auth/login" replace /> },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
