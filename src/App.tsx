import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import AnalyticsPage from './pages/AnalyticsPage';
import AssistantPage from './pages/AssistantPage';
import DashboardPage from './pages/DashboardPage';
import FamilyPage from './pages/FamilyPage';
import GoalsPage from './pages/GoalsPage';
import RetirementPage from './pages/RetirementPage';
import SettingsPage from './pages/SettingsPage';
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

function ErrorFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24, color: '#d0d9ee' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 12 }}>Что-то пошло не так</h1>
        <p style={{ color: '#8aa2ca', marginBottom: 20 }}>Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.</p>
        <button
          onClick={() => window.location.assign('/')}
          style={{
            padding: '12px 24px',
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #37c7ff, #8b6dff)',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          На главную
        </button>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout />,
    errorElement: <ErrorFallback />,
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
    errorElement: <ErrorFallback />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'goals', element: <GoalsPage /> },
      { path: 'retirement', element: <RetirementPage /> },
      { path: 'family', element: <FamilyPage /> },
      { path: 'assistant', element: <AssistantPage /> },
      { path: 'settings', element: <SettingsPage /> },
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
