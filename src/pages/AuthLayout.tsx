import { Outlet, Link } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">MP</div>
          <div>
            <h1>MoneyPilot</h1>
            <p>Вход по email, регистрация и восстановление пароля.</p>
          </div>
        </div>
        <div className="auth-content">
          <Outlet />
        </div>
        <div className="auth-footer">
          <p>Уже есть аккаунт? <Link to="/auth/login">Войти</Link></p>
          <p>Еще нет регистрации? <Link to="/auth/register">Зарегистрироваться</Link></p>
        </div>
      </div>
    </div>
  );
}
