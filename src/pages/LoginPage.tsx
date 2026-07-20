import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Заполните все поля.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.success) {
        setError(result.message || 'Ошибка входа');
        return;
      }
      navigate('/');
    } catch {
      setError('Произошла ошибка. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-view">
      <h2>Войти</h2>
      <p className="auth-lead">Введите email и пароль, чтобы начать работу с личным кабинетом.</p>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            required
            autoFocus
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Введите пароль"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
      <div className="auth-links">
        <Link to="/auth/reset">Забыли пароль?</Link>
        <span>&middot;</span>
        <Link to="/auth/register">Создать аккаунт</Link>
      </div>
    </div>
  );
}
