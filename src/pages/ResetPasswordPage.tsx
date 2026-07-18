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

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    const result = resetPassword(email.trim(), password);
    if (!result.success) {
      setError(result.message || 'Не удалось сбросить пароль.');
      return;
    }
    setInfo(result.message || 'Пароль обновлён.');
    setError('');
    navigate('/');
  };

  return (
    <div className="auth-view">
      <h2>Восстановление пароля</h2>
      <p className="auth-lead">Введите email и новый пароль, чтобы вернуться в аккаунт.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Новый пароль
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        <label>
          Подтвердите пароль
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </label>
        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-success">{info}</div>}
        <button type="submit" className="primary-button">Сбросить пароль</button>
      </form>
      <div className="auth-links">
        <Link to="/auth/login">Войти</Link>
      </div>
    </div>
  );
}
