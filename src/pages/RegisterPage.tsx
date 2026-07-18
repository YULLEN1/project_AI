import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    const result = register(email.trim(), password);
    if (!result.success) {
      setError(result.message || 'Не удалось зарегистрироваться.');
      return;
    }
    navigate('/');
  };

  return (
    <div className="auth-view">
      <h2>Регистрация</h2>
      <p className="auth-lead">Создайте аккаунт, чтобы пользоваться финансами, прогнозами и историей.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Пароль
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        <label>
          Подтвердите пароль
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </label>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="primary-button">Зарегистрироваться</button>
      </form>
      <div className="auth-links">
        <Link to="/auth/login">Уже зарегистрированы? Войти</Link>
      </div>
    </div>
  );
}
