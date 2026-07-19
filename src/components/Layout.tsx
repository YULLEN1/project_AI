import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { to: '/', label: 'Главная', icon: '◉' },
  { to: '/analytics', label: 'Аналитика', icon: '◌' },
  { to: '/goals', label: 'Планы', icon: '◍' },
  { to: '/retirement', label: 'Пенсия', icon: '◎' },
  { to: '/family', label: 'Семья', icon: '⬢' },
  { to: '/assistant', label: 'ИИ-ассистент', icon: '✦' },
  { to: '/settings', label: 'Настройки', icon: '⚙' },
];

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem('moneypilot-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    window.localStorage.setItem('moneypilot-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onScroll = () => {
      document.documentElement.style.setProperty('--scroll-progress', `${window.scrollY / (document.body.scrollHeight - window.innerHeight)}`);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`app-shell ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">MP</div>
          <div>
            <p className="brand-title">MoneyPilot</p>
            <p className="brand-subtitle">Живой финансовый помощник</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <p>Премиум</p>
          <strong>Больше сценариев</strong>
          <span>Прогнозы на 1, 3, 5 лет и семейное планирование.</span>
        </div>
      </aside>

      <main className="main-panel">
        <div className="quick-panel">
          <div className="quick-item"><span>⚡</span> Быстрое действие</div>
          <div className="quick-item"><span>🔔</span> 3 новых уведомления</div>
          <div className="quick-item"><span>🎯</span> Цель: отпуск</div>
        </div>
        <header className="topbar">
          <div>
            <p className="eyebrow">Сегодня</p>
            <h2>Ваш финансовый компас в одном окне</h2>
          </div>
          <div className="topbar-actions">
            <div className="status-pill">{location.pathname === '/' ? 'Главная' : navItems.find(item => item.to === location.pathname)?.label || 'Страница'}</div>
            <div className="user-block">
              <span>{user?.email}</span>
              <button className="ghost-button small" onClick={logout}>Выйти</button>
            </div>
            <button className="ghost-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? '☀️ Светлая' : '🌙 Тёмная'}
            </button>
          </div>
        </header>

        <div className="page-content">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
