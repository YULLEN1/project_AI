import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ResetPasswordPage() {
  const { user, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim() || !password || !confirm) {
      setError('Заполните все поля.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов.');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    setLoading(true);
    try {
      const result = await resetPassword(email.trim(), password);
      if (!result.success) {
        setError(result.message || 'Не удалось сбросить пароль.');
        return;
      }
      setInfo(result.message || 'Пароль обновлён.');
      navigate('/');
    } catch {
      setError('Произошла ошибка. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-view">
      <h2>Восстановление пароля</h2>
      <p className="auth-lead">Введите email и новый пароль, чтобы вернуться в аккаунт.</p>
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
          Новый пароль
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Не менее 6 символов"
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Подтвердите пароль
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Повторите пароль"
            autoComplete="new-password"
            required
          />
        </label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {info && <div className="auth-success">{info}</div>}
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Обновление...' : 'Сбросить пароль'}
        </button>
      </form>
      <div className="auth-links">
        <Link to="/auth/login">Войти</Link>
      </div>
    </div>
  );
}
