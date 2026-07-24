import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navGroups = [
  {
    label: 'Обзор',
    items: [
      { to: '/', label: 'Главная', icon: '◉' },
      { to: '/analytics', label: 'Аналитика', icon: '◌' },
    ],
  },
  {
    label: 'Планирование',
    items: [
      { to: '/goals', label: 'Планы', icon: '◍' },
      { to: '/retirement', label: 'Цели накоплений', icon: '◎' },
      { to: '/family', label: 'Семья', icon: '⬢' },
    ],
  },
  {
    label: 'Инструменты',
    items: [
      { to: '/assistant', label: 'ИИ-ассистент', icon: '✦' },
      { to: '/settings', label: 'Настройки', icon: '⚙' },
    ],
  },
];

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem('moneypilot-theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    window.localStorage.setItem('moneypilot-theme', theme);
  }, [theme]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
      if (event.key === 'Tab' && sidebarRef.current) {
        const focusable = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    sidebarRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) menuButtonRef.current?.focus();
  }, [sidebarOpen]);

  useEffect(() => {
    const onScroll = () => {
      document.documentElement.style.setProperty('--scroll-progress', `${window.scrollY / (document.body.scrollHeight - window.innerHeight)}`);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const currentPageLabel = location.pathname === '/'
    ? 'Главная'
    : navGroups.flatMap(g => g.items).find(item => item.to === location.pathname)?.label || 'Страница';

  return (
    <div className={`app-shell ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <a href="#main-content" className="skip-to-content">Перейти к содержимому</a>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside ref={sidebarRef} id="sidebar" className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Основная навигация">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">MP</div>
          <div>
            <p className="brand-title">MoneyPilot</p>
            <p className="brand-subtitle">Живой финансовый помощник</p>
          </div>
        </div>

        <nav className="nav-list" role="navigation">
          {navGroups.map(group => (
            <div key={group.label} className="nav-group">
              <span className="nav-group-label" aria-hidden="true">{group.label}</span>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  aria-label={item.label}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

      </aside>

      <main className="main-panel" id="main-content" role="main" aria-hidden={sidebarOpen || undefined}>
        <button
          ref={menuButtonRef}
          className="hamburger"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar"
        >
          <span />
          <span />
          <span />
        </button>

        <header className="topbar">
          <div>
            <p className="eyebrow">Сегодня</p>
            <h1>{currentPageLabel}</h1>
          </div>
          <div className="topbar-actions">
            <div className="status-pill" aria-live="polite">{currentPageLabel}</div>
            <div className="user-block">
              <span>{user?.email}</span>
              <button className="ghost-button small" onClick={logout} aria-label="Выйти из аккаунта">Выйти</button>
            </div>
            <button
              className="ghost-button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-pressed={theme === 'light'}
              aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
            >
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
