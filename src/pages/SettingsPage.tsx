import { FormEvent, useEffect, useState } from 'react';

const storageKeys = {
  theme: 'moneypilot-theme',
  budget: 'moneypilot-budget',
  salaryDays: 'moneypilot-daysToSalary',
  notifications: 'moneypilot-notifications',
  purchases: 'moneypilot-purchases',
  retirementAge: 'moneypilot-retirement-age',
  retirementIncome: 'moneypilot-retirement-income',
  retirementSavings: 'moneypilot-retirement-savings',
  retirementTarget: 'moneypilot-retirement-target',
};

function readBoolean(key: string, fallback: boolean) {
  const raw = window.localStorage.getItem(key);
  return raw === null ? fallback : raw === 'true';
}

function readNumberOrNull(key: string) {
  const raw = window.localStorage.getItem(key);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [budget, setBudget] = useState<number | null>(null);
  const [salaryDays, setSalaryDays] = useState<number | null>(null);
  const [retirementAge, setRetirementAge] = useState<number | null>(null);
  const [retirementIncome, setRetirementIncome] = useState<number | null>(null);
  const [retirementSavings, setRetirementSavings] = useState<number | null>(null);
  const [retirementTarget, setRetirementTarget] = useState<number | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKeys.theme);
    setTheme(savedTheme === 'light' ? 'light' : 'dark');
    setBudget(readNumberOrNull(storageKeys.budget));
    setSalaryDays(readNumberOrNull(storageKeys.salaryDays));
    setRetirementAge(readNumberOrNull(storageKeys.retirementAge));
    setRetirementIncome(readNumberOrNull(storageKeys.retirementIncome));
    setRetirementSavings(readNumberOrNull(storageKeys.retirementSavings));
    setRetirementTarget(readNumberOrNull(storageKeys.retirementTarget));
    setNotifications(readBoolean(storageKeys.notifications, true));
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (budget === null || salaryDays === null) {
      setMessage('Установите бюджет и дни до зарплаты.');
      return;
    }
    window.localStorage.setItem(storageKeys.theme, theme);
    window.localStorage.setItem(storageKeys.budget, String(budget));
    window.localStorage.setItem(storageKeys.salaryDays, String(salaryDays));
    if (retirementAge !== null) {
      window.localStorage.setItem(storageKeys.retirementAge, String(retirementAge));
    } else {
      window.localStorage.removeItem(storageKeys.retirementAge);
    }
    if (retirementIncome !== null) {
      window.localStorage.setItem(storageKeys.retirementIncome, String(retirementIncome));
    } else {
      window.localStorage.removeItem(storageKeys.retirementIncome);
    }
    if (retirementSavings !== null) {
      window.localStorage.setItem(storageKeys.retirementSavings, String(retirementSavings));
    } else {
      window.localStorage.removeItem(storageKeys.retirementSavings);
    }
    if (retirementTarget !== null) {
      window.localStorage.setItem(storageKeys.retirementTarget, String(retirementTarget));
    } else {
      window.localStorage.removeItem(storageKeys.retirementTarget);
    }
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
            <input
              type="number"
              value={budget ?? ''}
              onChange={e => setBudget(e.target.value ? Number(e.target.value) : null)}
              min={1}
              placeholder="Укажите сумму"
            />
          </label>

          <label>
            Дней до зарплаты
            <input
              type="number"
              value={salaryDays ?? ''}
              onChange={e => setSalaryDays(e.target.value ? Number(e.target.value) : null)}
              min={1}
              placeholder="Укажите количество дней"
            />
          </label>

          <div className="settings-section-heading">Параметры пенсии</div>
          <label>
            Возраст
            <input
              type="number"
              value={retirementAge ?? ''}
              onChange={e => setRetirementAge(e.target.value ? Number(e.target.value) : null)}
              min={18}
              placeholder="Укажите ваш возраст"
            />
          </label>
          <label>
            Доход
            <input
              type="number"
              value={retirementIncome ?? ''}
              onChange={e => setRetirementIncome(e.target.value ? Number(e.target.value) : null)}
              min={0}
              placeholder="Ежемесячный доход"
            />
          </label>
          <label>
            Накопления
            <input
              type="number"
              value={retirementSavings ?? ''}
              onChange={e => setRetirementSavings(e.target.value ? Number(e.target.value) : null)}
              min={0}
              placeholder="Текущие сбережения"
            />
          </label>
          <label>
            Планируемая пенсия
            <input
              type="number"
              value={retirementTarget ?? ''}
              onChange={e => setRetirementTarget(e.target.value ? Number(e.target.value) : null)}
              min={0}
              placeholder="Желаемая пенсия"
            />
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
