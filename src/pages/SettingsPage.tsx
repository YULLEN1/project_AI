import { FormEvent, useEffect, useState } from 'react';

const storageKeys = {
  theme: 'moneypilot-theme',
  budget: 'moneypilot-budget',
  salaryDays: 'moneypilot-daysToSalary',
  notifications: 'moneypilot-notifications',
  purchases: 'moneypilot-purchases',
};

function readBoolean(key: string, fallback: boolean) {
  const raw = window.localStorage.getItem(key);
  return raw === null ? fallback : raw === 'true';
}

function readNumber(key: string, fallback: number) {
  const raw = window.localStorage.getItem(key);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [budget, setBudget] = useState(0);
  const [salaryDays, setSalaryDays] = useState(18);
  const [notifications, setNotifications] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKeys.theme);
    setTheme(savedTheme === 'light' ? 'light' : 'dark');
    setBudget(readNumber(storageKeys.budget, 118000));
    setSalaryDays(readNumber(storageKeys.salaryDays, 18));
    setNotifications(readBoolean(storageKeys.notifications, true));
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.localStorage.setItem(storageKeys.theme, theme);
    window.localStorage.setItem(storageKeys.budget, String(budget));
    window.localStorage.setItem(storageKeys.salaryDays, String(salaryDays));
    window.localStorage.setItem(storageKeys.notifications, String(notifications));
    setMessage('Настройки сохранены. Перейдите на главную для обновления данных.');
  };

  const clearPurchases = () => {
    window.localStorage.removeItem(storageKeys.purchases);
    setMessage('История расходов очищена.');
  };

  const resetDefaults = () => {
    window.localStorage.removeItem(storageKeys.theme);
    window.localStorage.removeItem(storageKeys.budget);
    window.localStorage.removeItem(storageKeys.salaryDays);
    window.localStorage.removeItem(storageKeys.notifications);
    setTheme('dark');
    setBudget(118000);
    setSalaryDays(18);
    setNotifications(true);
    setMessage('Настройки восстановлены по умолчанию.');
  };

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Настройки</p>
          <h3>Персонализируйте приложение под себя</h3>
          <p>Управляйте бюджетом, уведомлениями и сохраняйте чистоту данных.</p>
        </div>
      </section>

      <section className="card large">
        <form className="settings-form" onSubmit={handleSubmit}>
          <label>
            Тема интерфейса
            <select value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light')}>
              <option value="dark">Тёмная</option>
              <option value="light">Светлая</option>
            </select>
          </label>

          <label>
            Месячный бюджет
            <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} min={0} />
          </label>

          <label>
            Дней до зарплаты
            <input type="number" value={salaryDays} onChange={e => setSalaryDays(Number(e.target.value))} min={1} />
          </label>

          <label className="switch-label">
            <span>Уведомления</span>
            <input type="checkbox" checked={notifications} onChange={e => setNotifications(e.target.checked)} />
          </label>

          {message && <div className="auth-success">{message}</div>}
          <div className="settings-actions">
            <button type="submit" className="primary-button">Сохранить настройки</button>
            <button type="button" className="ghost-button" onClick={clearPurchases}>Очистить расходы</button>
          </div>
          <button type="button" className="ghost-button" onClick={resetDefaults}>Сбросить настройки</button>
        </form>
      </section>
    </div>
  );
}
