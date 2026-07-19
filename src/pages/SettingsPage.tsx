import { FormEvent, useEffect, useMemo, useState } from 'react';

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
  familyMembers: 'moneypilot-family-members',
  familyGoals: 'moneypilot-family-goals',
  suggestedItem: 'moneypilot-suggestedItem',
  savings: 'moneypilot-savings',
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

function readJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

  const [members, setMembers] = useState(() => readJson(storageKeys.familyMembers, [] as any[]));
  const [goals, setGoals] = useState(() => readJson(storageKeys.familyGoals, [] as any[]));
  const [suggestion, setSuggestion] = useState(() => readJson(storageKeys.suggestedItem, { name: 'iPhone', price: 120000 }));
  const [savings, setSavings] = useState(() => {
    const raw = window.localStorage.getItem(storageKeys.savings);
    const v = raw ? Number(raw) : NaN;
    return Number.isFinite(v) && v >= 0 ? v : 0;
  });

  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('Доход');
  const [memberAmount, setMemberAmount] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [suggestionName, setSuggestionName] = useState(suggestion.name);
  const [suggestionPrice, setSuggestionPrice] = useState(String(suggestion.price));
  const [savingsInput, setSavingsInput] = useState(String(savings));

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

  useEffect(() => {
    window.localStorage.setItem(storageKeys.familyMembers, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.familyGoals, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.suggestedItem, JSON.stringify(suggestion));
  }, [suggestion]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.savings, String(savings));
  }, [savings]);

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

  const handleAddMember = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(memberAmount);
    if (!memberName.trim() || !memberRole.trim() || !Number.isFinite(parsed) || parsed < 0) return;
    const next = { id: `${Date.now()}-${memberName.trim()}`, name: memberName.trim(), role: memberRole.trim(), contribute: parsed, color: '#37c7ff' };
    setMembers(prev => [...prev, next]);
    setMemberName(''); setMemberRole('Доход'); setMemberAmount('');
  };

  const handleRemoveMember = (id: string) => setMembers(prev => prev.filter(m => m.id !== id));
  const handleAddGoal = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(goalTarget);
    if (!goalTitle.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    const next = { id: `${Date.now()}-${goalTitle.trim()}`, title: goalTitle.trim(), target: parsed };
    setGoals(prev => [...prev, next]);
    setGoalTitle(''); setGoalTarget('');
  };
  const handleRemoveGoal = (id: string) => setGoals(prev => prev.filter(g => g.id !== id));
  const handleSaveSuggestion = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(suggestionPrice);
    if (!suggestionName.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    setSuggestion({ name: suggestionName.trim(), price: parsed });
  };
  const handleSaveSavings = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(savingsInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setSavings(parsed);
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
