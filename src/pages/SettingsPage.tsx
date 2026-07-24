import { FormEvent, useEffect, useState } from 'react';

const storageKeys = {
  budget: 'moneypilot-budget',
  income: 'moneypilot-income',
  incomeEvents: 'moneypilot-income-events',
  notifications: 'moneypilot-notifications',
  purchases: 'moneypilot-purchases',
  userAge: 'moneypilot-user-age',
  savingsGoals: 'moneypilot-savings-goals',
  familyMembers: 'moneypilot-family-members',
  familyExpenses: 'moneypilot-family-expenses',
  familyGoals: 'moneypilot-family-goals',
  suggestedItem: 'moneypilot-suggestedItem',
  savings: 'moneypilot-savings',
};

type FamilyMember = {
  id: string;
  name: string;
  role: string;
  contribute: number;
  color: string;
};

type IncomeEvent = {
  id: string;
  source: string;
  amount: number;
  date: string;
  status: 'expected' | 'received';
  confidence: 'confirmed' | 'likely';
  recurrence: 'once' | 'monthly';
};

type FamilyGoal = {
  id: string;
  title: string;
  target: number;
  currentSavings?: number;
  targetDate?: string;
  priority?: 'high' | 'medium' | 'low';
  monthlyContribution?: number;
  memberIds?: string[];
  distribution?: 'equal' | 'income' | 'custom';
  memberContributions?: Record<string, number>;
  isPaused?: boolean;
  activity?: Array<{ id: string; amount: number; date: string; memberId?: string }>;
};

type FamilyExpense = {
  id: string;
  name: string;
  amount: number;
};

type SuggestedItem = {
  name: string;
  price: number;
};

type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  type?: string;
  targetDate?: string;
  targetAge?: number;
  monthlyPension?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
  currentSavings: number;
};

type SettingsTab = 'general' | 'income' | 'goals' | 'family' | 'extras';

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

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

const GOAL_TYPES = ['Крупная покупка', 'Резерв', 'Путешествие', 'Образование', 'Пенсия', 'Другое'] as const;

function formatTargetDate(value?: string) {
  if (!value) return 'срок не указан';
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function migrateLegacyFamilyExpenses() {
  const members = readJson<FamilyMember[]>(storageKeys.familyMembers, []);
  const expenses = readJson<FamilyExpense[]>(storageKeys.familyExpenses, []);
  const legacyExpenses = members.filter(member => member.role === 'Расход');
  if (legacyExpenses.length && expenses.length === 0) {
    window.localStorage.setItem(storageKeys.familyExpenses, JSON.stringify(legacyExpenses.map(member => ({ id: member.id, name: member.name, amount: member.contribute }))));
    window.localStorage.setItem(storageKeys.familyMembers, JSON.stringify(members.filter(member => member.role !== 'Расход')));
  }
}

function migrateOldRetirement() {
  const oldAge = window.localStorage.getItem('moneypilot-retirement-age');
  const oldIncome = window.localStorage.getItem('moneypilot-retirement-income');
  const oldSavings = window.localStorage.getItem('moneypilot-retirement-savings');
  const oldTarget = window.localStorage.getItem('moneypilot-retirement-target');
  if (oldAge || oldIncome || oldSavings || oldTarget) {
    const existing = readJson<SavingsGoal[]>('moneypilot-savings-goals', []);
    if (existing.length === 0) {
      const goal: SavingsGoal = {
        id: 'retirement-migrated',
        name: 'Пенсия',
        type: 'Пенсия',
        targetAmount: oldTarget ? Number(oldTarget) : 5000000,
        targetAge: oldAge ? Number(oldAge) : 60,
        currentSavings: oldSavings ? Number(oldSavings) : 0,
      };
      window.localStorage.setItem('moneypilot-savings-goals', JSON.stringify([goal]));
    }
    window.localStorage.removeItem('moneypilot-retirement-age');
    window.localStorage.removeItem('moneypilot-retirement-income');
    window.localStorage.removeItem('moneypilot-retirement-savings');
    window.localStorage.removeItem('moneypilot-retirement-target');
  }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [budget, setBudget] = useState<number | null>(null);
  const [income, setIncome] = useState<number | null>(null);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [message, setMessage] = useState('');
  const [incomeEvents, setIncomeEvents] = useState<IncomeEvent[]>(() => {
    if (typeof window === 'undefined') return [] as IncomeEvent[];
    return readJson<IncomeEvent[]>(storageKeys.incomeEvents, []);
  });

  const [members, setMembers] = useState<FamilyMember[]>(() => {
    if (typeof window === 'undefined') return [] as FamilyMember[];
    migrateLegacyFamilyExpenses();
    return readJson(storageKeys.familyMembers, [] as FamilyMember[]);
  });

  const [familyExpenses, setFamilyExpenses] = useState<FamilyExpense[]>(() => {
    if (typeof window === 'undefined') return [] as FamilyExpense[];
    return readJson(storageKeys.familyExpenses, [] as FamilyExpense[]);
  });

  const [familyGoalsList, setFamilyGoalsList] = useState<FamilyGoal[]>(() => {
    if (typeof window === 'undefined') return [] as FamilyGoal[];
    return readJson(storageKeys.familyGoals, [] as FamilyGoal[]);
  });

  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => {
    if (typeof window === 'undefined') return [] as SavingsGoal[];
    migrateOldRetirement();
    return readJson<SavingsGoal[]>(storageKeys.savingsGoals, []);
  });

  const [suggestion, setSuggestion] = useState<SuggestedItem>(() => {
    if (typeof window === 'undefined') return { name: '', price: 0 };
    return readJson(storageKeys.suggestedItem, { name: '', price: 0 });
  });

  const [savings, setSavings] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem(storageKeys.savings);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value >= 0 ? value : 0;
  });

  const [memberName, setMemberName] = useState('');
  const [memberAmount, setMemberAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incomeStatus, setIncomeStatus] = useState<IncomeEvent['status']>('expected');
  const [incomeConfidence, setIncomeConfidence] = useState<IncomeEvent['confidence']>('confirmed');
  const [incomeRecurrence, setIncomeRecurrence] = useState<IncomeEvent['recurrence']>('once');
  const [familyGoalTitle, setFamilyGoalTitle] = useState('');
  const [familyGoalTarget, setFamilyGoalTarget] = useState('');
  const [familyGoalSavings, setFamilyGoalSavings] = useState('');
  const [familyGoalDate, setFamilyGoalDate] = useState('');
  const [familyGoalPriority, setFamilyGoalPriority] = useState<FamilyGoal['priority']>('medium');
  const [familyGoalContribution, setFamilyGoalContribution] = useState('');
  const [familyGoalMemberIds, setFamilyGoalMemberIds] = useState<string[]>([]);
  const [familyGoalDistribution, setFamilyGoalDistribution] = useState<NonNullable<FamilyGoal['distribution']>>('equal');
  const [familyGoalMemberContributions, setFamilyGoalMemberContributions] = useState<Record<string, string>>({});

  const [goalName, setGoalName] = useState('');
  const [goalType, setGoalType] = useState<typeof GOAL_TYPES[number]>('Крупная покупка');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalSavings, setGoalSavings] = useState('');
  const [monthlyPension, setMonthlyPension] = useState('');
  const [retirementAge, setRetirementAge] = useState('60');
  const [lifeExpectancy, setLifeExpectancy] = useState('95');

  const [suggestionName, setSuggestionName] = useState(suggestion.name);
  const [suggestionPrice, setSuggestionPrice] = useState(String(suggestion.price));
  const [savingsInput, setSavingsInput] = useState(String(savings));

  const [budgetError, setBudgetError] = useState(false);

  useEffect(() => {
    setBudget(readNumberOrNull(storageKeys.budget));
    setIncome(readNumberOrNull(storageKeys.income));
    setUserAge(readNumberOrNull(storageKeys.userAge));
    setNotifications(readBoolean(storageKeys.notifications, true));
  }, []);

  const handleSaveSavingsGoals = (newGoals: SavingsGoal[]) => {
    setSavingsGoals(newGoals);
    window.localStorage.setItem(storageKeys.savingsGoals, JSON.stringify(newGoals));
  };

  const handleSaveMembers = (newMembers: FamilyMember[]) => {
    setMembers(newMembers);
    window.localStorage.setItem(storageKeys.familyMembers, JSON.stringify(newMembers));
  };

  const handleSaveFamilyExpenses = (newExpenses: FamilyExpense[]) => {
    setFamilyExpenses(newExpenses);
    window.localStorage.setItem(storageKeys.familyExpenses, JSON.stringify(newExpenses));
  };

  const handleSaveFamilyGoals = (newGoals: FamilyGoal[]) => {
    setFamilyGoalsList(newGoals);
    window.localStorage.setItem(storageKeys.familyGoals, JSON.stringify(newGoals));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    const hasBudgetError = budget === null || budget <= 0;
    setBudgetError(hasBudgetError);

    if (hasBudgetError) {
      setMessage('Укажите месячный лимит расходов.');
      return;
    }
    window.localStorage.setItem(storageKeys.budget, String(budget));
    if (income !== null) window.localStorage.setItem(storageKeys.income, String(income));
    else window.localStorage.removeItem(storageKeys.income);
    if (userAge !== null) {
      window.localStorage.setItem(storageKeys.userAge, String(userAge));
    } else {
      window.localStorage.removeItem(storageKeys.userAge);
    }
    window.localStorage.setItem(storageKeys.notifications, String(notifications));
    setMessage('Настройки сохранены.');
  };

  const clearPurchases = () => {
    window.localStorage.removeItem(storageKeys.purchases);
    setMessage('История расходов очищена.');
  };

  const resetDefaults = () => {
    window.localStorage.removeItem(storageKeys.budget);
    window.localStorage.removeItem(storageKeys.income);
    window.localStorage.removeItem(storageKeys.notifications);
    window.localStorage.removeItem(storageKeys.userAge);
    setBudget(null);
    setIncome(null);
    setUserAge(null);
    setNotifications(true);
    setBudgetError(false);
    setMessage('Настройки сброшены. Укажите месячный лимит расходов.');
  };

  const handleAddGoal = (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(goalAmount);
    const parsedSavings = Number(goalSavings);
    const parsedMonthlyPension = Number(monthlyPension);
    const parsedRetirementAge = Number(retirementAge);
    const parsedLifeExpectancy = Number(lifeExpectancy);
    const isPension = goalType === 'Пенсия';
    if (!goalName.trim() || (isPension
      ? !Number.isFinite(parsedMonthlyPension) || parsedMonthlyPension <= 0 || !Number.isFinite(parsedRetirementAge) || !Number.isFinite(parsedLifeExpectancy) || parsedLifeExpectancy <= parsedRetirementAge
      : !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !goalDate)) {
      setMessage(isPension
        ? 'Для пенсии укажите ежемесячную выплату, возраст выхода и ожидаемый возраст.'
        : 'Для цели укажите название, сумму и срок достижения.');
      return;
    }
    const pensionCapital = isPension ? parsedMonthlyPension * (parsedLifeExpectancy - parsedRetirementAge) * 12 : parsedAmount;
    const next: SavingsGoal = {
      id: `${Date.now()}-${goalName.trim()}`,
      name: goalName.trim(),
      type: goalType,
      targetAmount: pensionCapital,
      targetDate: isPension ? undefined : goalDate,
      retirementAge: isPension ? parsedRetirementAge : undefined,
      lifeExpectancy: isPension ? parsedLifeExpectancy : undefined,
      monthlyPension: isPension ? parsedMonthlyPension : undefined,
      currentSavings: Number.isFinite(parsedSavings) && parsedSavings > 0 ? parsedSavings : 0,
    };
    handleSaveSavingsGoals([...savingsGoals, next]);
    setGoalName('');
    setGoalAmount('');
    setGoalDate('');
    setGoalSavings('');
    setMonthlyPension('');
    setMessage('Цель накоплений добавлена.');
  };

  const handleRemoveGoal = (id: string) => {
    if (window.confirm('Удалить эту цель накоплений?')) handleSaveSavingsGoals(savingsGoals.filter(g => g.id !== id));
  };

  // Family handlers
  const handleAddMember = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(memberAmount);
    if (!memberName.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setMessage('Для дохода укажите имя и сумму больше нуля.');
      return;
    }
    const next: FamilyMember = {
      id: `${Date.now()}-${memberName.trim()}`,
      name: memberName.trim(),
      role: 'Доход',
      contribute: parsed,
      color: '#37c7ff',
    };
    handleSaveMembers([...members, next]);
    setMemberName('');
    setMemberAmount('');
  };

  const handleRemoveMember = (id: string) => {
    if (window.confirm('Удалить участника семьи?')) handleSaveMembers(members.filter(m => m.id !== id));
  };

  const handleAddFamilyExpense = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseAmount);
    if (!expenseName.trim() || !Number.isFinite(amount) || amount <= 0) {
      setMessage('Для обязательного расхода укажите название и сумму больше нуля.');
      return;
    }
    handleSaveFamilyExpenses([...familyExpenses, { id: `${Date.now()}-${expenseName.trim()}`, name: expenseName.trim(), amount }]);
    setExpenseName('');
    setExpenseAmount('');
  };

  const handleRemoveFamilyExpense = (id: string) => {
    if (window.confirm('Удалить обязательный расход?')) handleSaveFamilyExpenses(familyExpenses.filter(expense => expense.id !== id));
  };

  const handleAddFamilyGoal = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(familyGoalTarget);
    const parsedSavings = Number(familyGoalSavings);
    const parsedContribution = Number(familyGoalContribution);
    const customContributionTotal = familyGoalMemberIds.reduce((sum, id) => sum + (Number(familyGoalMemberContributions[id]) || 0), 0);
    if (!familyGoalTitle.trim() || !Number.isFinite(parsed) || parsed <= 0 || !familyGoalDate || !Number.isFinite(parsedSavings) || parsedSavings < 0 || !Number.isFinite(parsedContribution) || parsedContribution < 0) {
      setMessage('Для семейной цели укажите название, сумму, накопления, срок и ежемесячный взнос.');
      return;
    }
    if (familyGoalDistribution === 'custom' && familyGoalMemberIds.length > 0 && customContributionTotal !== parsedContribution) {
      setMessage('Сумма индивидуальных взносов должна совпадать с общим взносом на цель.');
      return;
    }
    const next: FamilyGoal = {
      id: `${Date.now()}-${familyGoalTitle.trim()}`,
      title: familyGoalTitle.trim(),
      target: parsed,
      currentSavings: parsedSavings,
      targetDate: familyGoalDate,
      priority: familyGoalPriority,
      monthlyContribution: parsedContribution,
      memberIds: familyGoalMemberIds,
      distribution: familyGoalDistribution,
      memberContributions: familyGoalDistribution === 'custom'
        ? Object.fromEntries(familyGoalMemberIds.map(id => [id, Number(familyGoalMemberContributions[id]) || 0]))
        : undefined,
      activity: [],
    };
    handleSaveFamilyGoals([...familyGoalsList, next]);
    setFamilyGoalTitle('');
    setFamilyGoalTarget('');
    setFamilyGoalSavings('');
    setFamilyGoalDate('');
    setFamilyGoalPriority('medium');
    setFamilyGoalContribution('');
    setFamilyGoalMemberIds([]);
    setFamilyGoalDistribution('equal');
    setFamilyGoalMemberContributions({});
  };

  const toggleFamilyGoalMember = (id: string) => {
    setFamilyGoalMemberIds(current => current.includes(id) ? current.filter(memberId => memberId !== id) : [...current, id]);
  };

  const handleRemoveFamilyGoal = (id: string) => {
    if (window.confirm('Удалить семейную цель?')) handleSaveFamilyGoals(familyGoalsList.filter(g => g.id !== id));
  };

  const handleAddFamilyGoalSavings = (id: string) => {
    const value = window.prompt('Сколько добавить в фонд этой цели?', '');
    if (value === null) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Введите сумму пополнения больше нуля.');
      return;
    }
    handleSaveFamilyGoals(familyGoalsList.map(goal => goal.id === id ? { ...goal, currentSavings: (goal.currentSavings ?? 0) + amount } : goal));
    setMessage('Пополнение семейной цели сохранено.');
  };

  const handleSaveSuggestion = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(suggestionPrice);
    if (!suggestionName.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setMessage('Укажите название товара и цену больше нуля.');
      return;
    }
    setSuggestion({ name: suggestionName.trim(), price: parsed });
    window.localStorage.setItem(storageKeys.suggestedItem, JSON.stringify({ name: suggestionName.trim(), price: parsed }));
    setMessage('Предложение сохранено.');
  };

  const handleSaveSavings = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(savingsInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMessage('Введите корректную сумму накоплений.');
      return;
    }
    setSavings(parsed);
    window.localStorage.setItem(storageKeys.savings, String(parsed));
    setMessage('Накопления сохранены.');
  };

  const handleAddIncomeEvent = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(incomeAmount);
    if (!incomeSource.trim() || !Number.isFinite(amount) || amount <= 0 || !incomeDate) {
      setMessage('Для поступления укажите источник, сумму и дату.');
      return;
    }
    const event: IncomeEvent = {
      id: `${Date.now()}-${incomeSource.trim()}`,
      source: incomeSource.trim(), amount, date: incomeDate, status: incomeStatus,
      confidence: incomeStatus === 'received' ? 'confirmed' : incomeConfidence,
      recurrence: incomeStatus === 'received' ? 'once' : incomeRecurrence,
    };
    const next = [...incomeEvents, event];
    setIncomeEvents(next);
    window.localStorage.setItem(storageKeys.incomeEvents, JSON.stringify(next));
    setIncomeSource('');
    setIncomeAmount('');
    setMessage(incomeStatus === 'received' ? 'Поступление добавлено в журнал.' : 'Плановое поступление сохранено.');
  };

  const handleRemoveIncomeEvent = (id: string) => {
    const next = incomeEvents.filter(event => event.id !== id);
    setIncomeEvents(next);
    window.localStorage.setItem(storageKeys.incomeEvents, JSON.stringify(next));
  };

  const tabs: Array<{ key: SettingsTab; label: string }> = [
    { key: 'general', label: 'Основные' },
    { key: 'income', label: 'Поступления' },
    { key: 'goals', label: 'Цели' },
    { key: 'family', label: 'Семья' },
    { key: 'extras', label: 'Дополнительно' },
  ];

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Настройки</p>
          <h3>Персонализируйте приложение под себя</h3>
          <p>Все пользовательские показатели задаются здесь.</p>
        </div>
      </section>

      <section className="settings-tabs" role="tablist" aria-label="Разделы настроек">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`settings-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`settings-panel-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {/* General Tab */}
      {activeTab === 'general' && (
        <section className="card large" id="settings-panel-general" role="tabpanel">
          <h4>Основные настройки</h4>
          <form className="settings-form" onSubmit={handleSubmit} noValidate>
            <label>
              Месячный лимит расходов <span style={{ color: 'var(--color-error)' }}>*</span>
              <input
                type="number"
                value={budget ?? ''}
                onChange={e => {
                  setBudget(e.target.value ? Number(e.target.value) : null);
                  setBudgetError(false);
                }}
                min={1}
                placeholder="Например, 80000 ₽"
                className={budgetError ? 'input-error' : ''}
                required
              />
            </label>

            <label>
              Ориентир дохода в месяц
              <input
                type="number"
                value={income ?? ''}
                onChange={e => setIncome(e.target.value ? Number(e.target.value) : null)}
                min={1}
                placeholder="Необязательно, например 120000 ₽"
                inputMode="decimal"
              />
              <small className="settings-note">Используется только для долгосрочных сценариев. Ближайшее поступление и дневной ориентир задаются во вкладке «Поступления».</small>
            </label>

            <label>
              Ваш возраст
              <input
                type="number"
                value={userAge ?? ''}
                onChange={e => setUserAge(e.target.value ? Number(e.target.value) : null)}
                min={14}
                max={100}
                placeholder="Например, 30"
              />
            </label>

            <label className="switch-label">
              <span>Уведомления</span>
              <input type="checkbox" checked={notifications} onChange={e => setNotifications(e.target.checked)} />
            </label>

            {message && <div className={message.includes('сохранены') ? 'auth-success' : 'auth-error'} role="status">{message}</div>}
            <div className="settings-actions">
              <button type="submit" className="primary-button">Сохранить настройки</button>
              <button type="button" className="ghost-button" onClick={clearPurchases}>Очистить расходы</button>
              <button type="button" className="ghost-button" onClick={resetDefaults}>Сбросить по умолчанию</button>
            </div>

          </form>
        </section>
      )}

      {activeTab === 'income' && (
        <section className="card large" id="settings-panel-income" role="tabpanel">
          <div className="settings-block">
            <div className="settings-block-head"><div><h4>План поступлений</h4><p>Для работы по найму добавьте аванс и зарплату с ежемесячным повторением. Для фриланса добавляйте ожидаемые поступления с уровнем уверенности.</p></div></div>
            <form className="inline-form" onSubmit={handleAddIncomeEvent}>
              <label><span className="sr-only">Источник поступления</span><input value={incomeSource} onChange={e => setIncomeSource(e.target.value)} placeholder="Например, аванс или проект Alpha" /></label>
              <label><span className="sr-only">Сумма поступления</span><input value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} type="number" inputMode="decimal" placeholder="Сумма, ₽" /></label>
              <label><span className="sr-only">Дата поступления</span><input value={incomeDate} onChange={e => setIncomeDate(e.target.value)} type="date" /></label>
              <label><span className="sr-only">Статус поступления</span><select value={incomeStatus} onChange={e => setIncomeStatus(e.target.value as IncomeEvent['status'])}><option value="expected">Ожидается</option><option value="received">Получено</option></select></label>
              {incomeStatus === 'expected' && <><label><span className="sr-only">Уверенность поступления</span><select value={incomeConfidence} onChange={e => setIncomeConfidence(e.target.value as IncomeEvent['confidence'])}><option value="confirmed">Подтверждено</option><option value="likely">Вероятно</option></select></label><label><span className="sr-only">Повторяемость поступления</span><select value={incomeRecurrence} onChange={e => setIncomeRecurrence(e.target.value as IncomeEvent['recurrence'])}><option value="once">Разово</option><option value="monthly">Каждый месяц</option></select></label></>}
              <button type="submit">Добавить</button>
            </form>
          </div>
          <div className="settings-block">
            <h4>Календарь и журнал поступлений</h4>
            <div className="settings-list">{incomeEvents.length ? [...incomeEvents].sort((a, b) => b.date.localeCompare(a.date)).map(event => <div className="settings-row" key={event.id}><div><strong>{event.source}</strong><p>{event.status === 'received' ? 'Получено' : event.confidence === 'confirmed' ? 'Ожидается, подтверждено' : 'Ожидается, вероятно'} · {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${event.date}T00:00:00`))}{event.recurrence === 'monthly' ? ' · ежемесячно' : ''}</p></div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><strong>{formatCurrency(event.amount)}</strong><button className="text-button" type="button" onClick={() => handleRemoveIncomeEvent(event.id)}>Удалить</button></div></div>) : <div className="empty-cell">Добавьте первое ожидаемое или фактически полученное поступление.</div>}</div>
          </div>
        </section>
      )}

      {/* Goals Tab (replaces retirement) */}
      {activeTab === 'goals' && (
        <section className="card large" id="settings-panel-goals" role="tabpanel">
          <div className="settings-block">
            <div className="settings-block-head">
              <div>
                <h4>Цели накоплений</h4>
                <p>Для каждой цели задайте сумму, уже накопленное и дату, к которой хотите прийти.</p>
              </div>
              <span className="mini-pill">{savingsGoals.length} целей</span>
            </div>
            <div className="settings-list">
              {savingsGoals.length ? savingsGoals.map(goal => {
                return (
                  <div key={goal.id} className="settings-row">
                    <div>
                      <strong>{goal.name} <span className="goal-type">{goal.type ?? 'Пенсия'}</span></strong>
                      <p>{goal.monthlyPension ? `${formatCurrency(goal.monthlyPension)}/мес до ${goal.lifeExpectancy} лет · выход в ${goal.retirementAge} лет` : `${formatCurrency(goal.targetAmount)} · ${goal.targetDate ? `к ${formatTargetDate(goal.targetDate)}` : `к ${goal.targetAge ?? 'неизвестному'} годам`}`}</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => handleRemoveGoal(goal.id)} aria-label={`Удалить ${goal.name}`}>Удалить</button>
                  </div>
                );
              }) : (
                <div className="empty-cell">Пока нет целей. Создайте первую цель.</div>
              )}
            </div>
            <form className="inline-form" onSubmit={handleAddGoal}>
              <label><span className="sr-only">Тип цели</span><select value={goalType} onChange={e => { const type = e.target.value as typeof GOAL_TYPES[number]; setGoalType(type); if (type === 'Пенсия' && !goalName.trim()) setGoalName('Пенсия'); }}>{GOAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
              <label><span className="sr-only">Название цели</span><input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="Например, отпуск в Японии" /></label>
              {goalType === 'Пенсия' ? (
                <>
                  <label><span className="sr-only">Желаемая пенсия в месяц</span><input value={monthlyPension} onChange={e => setMonthlyPension(e.target.value)} placeholder="Пенсия в месяц, ₽" type="number" inputMode="decimal" /></label>
                  <label><span className="sr-only">Возраст выхода на пенсию</span><input value={retirementAge} onChange={e => setRetirementAge(e.target.value)} placeholder="Выход на пенсию, лет" type="number" min="1" /></label>
                  <label><span className="sr-only">До какого возраста планировать</span><input value={lifeExpectancy} onChange={e => setLifeExpectancy(e.target.value)} placeholder="Планировать до, лет" type="number" min="1" /></label>
                </>
              ) : (
                <>
                  <label><span className="sr-only">Сумма цели</span><input value={goalAmount} onChange={e => setGoalAmount(e.target.value)} placeholder="Сколько нужно, ₽" type="number" inputMode="decimal" /></label>
                  <label><span className="sr-only">Срок достижения цели</span><input value={goalDate} onChange={e => setGoalDate(e.target.value)} aria-label="Срок достижения цели" type="month" min={new Date().toISOString().slice(0, 7)} /></label>
                </>
              )}
              <label><span className="sr-only">Текущие накопления</span><input value={goalSavings} onChange={e => setGoalSavings(e.target.value)} placeholder="Уже есть, ₽" type="number" inputMode="decimal" /></label>
              <button type="submit">Добавить</button>
            </form>
            {message && <div className={message.includes('добавлена') ? 'auth-success' : 'auth-error'} role="status">{message}</div>}
            <p className="settings-note">Для пенсии капитал считается как ежемесячная выплата на весь срок после выхода на пенсию. Доходность и инфляция не учитываются.</p>
          </div>
        </section>
      )}

      {/* Family Tab */}
      {activeTab === 'family' && (
        <section className="card large" id="settings-panel-family" role="tabpanel">
          <div className="settings-block">
            <div className="settings-block-head">
              <div>
                <h4>Доходы семьи</h4>
                <p>Добавьте человека и его регулярный доход. Эти деньги формируют семейный бюджет.</p>
              </div>
              <span className="mini-pill">{members.length} источников</span>
            </div>
            <div className="settings-list">
              {members.length ? members.map(member => (
                <div key={member.id} className="settings-row">
                  <div>
                    <strong>{member.name}</strong>
                    <p>Регулярный доход</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{member.contribute.toLocaleString('ru-RU')} ₽</span>
                    <button type="button" className="text-button" onClick={() => handleRemoveMember(member.id)} aria-label={`Удалить ${member.name}`}>Удалить</button>
                  </div>
                </div>
              )) : (
                <div className="empty-cell">Пока нет доходов. Добавьте первый источник ниже.</div>
              )}
            </div>
            <form className="inline-form" onSubmit={handleAddMember}>
              <label><span className="sr-only">Имя участника</span><input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Имя" /></label>
              <label><span className="sr-only">Ежемесячный доход</span><input value={memberAmount} onChange={e => setMemberAmount(e.target.value)} placeholder="Получает в месяц, ₽" type="number" inputMode="decimal" /></label>
              <button type="submit">Добавить доход</button>
            </form>
          </div>

          <div className="settings-block">
            <div className="settings-block-head">
              <div>
                <h4>Обязательные расходы</h4>
                <p>Ипотека, аренда, коммунальные услуги и другие регулярные платежи. Они вычитаются до распределения денег на цели.</p>
              </div>
              <span className="mini-pill">{familyExpenses.length} расходов</span>
            </div>
            <div className="settings-list">
              {familyExpenses.length ? familyExpenses.map(expense => (
                <div key={expense.id} className="settings-row">
                  <div><strong>{expense.name}</strong><p>Ежемесячный обязательный расход</p></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>−{formatCurrency(expense.amount)}</span><button type="button" className="text-button" onClick={() => handleRemoveFamilyExpense(expense.id)} aria-label={`Удалить ${expense.name}`}>Удалить</button></div>
                </div>
              )) : <div className="empty-cell">Пока нет обязательных расходов.</div>}
            </div>
            <form className="inline-form" onSubmit={handleAddFamilyExpense}>
              <label><span className="sr-only">Название обязательного расхода</span><input value={expenseName} onChange={e => setExpenseName(e.target.value)} placeholder="Например, ипотека" /></label>
              <label><span className="sr-only">Сумма обязательного расхода</span><input value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Сумма в месяц, ₽" type="number" inputMode="decimal" /></label>
              <button type="submit">Добавить расход</button>
            </form>
          </div>

          <div className="settings-block">
            <div className="settings-block-head">
              <div>
                <h4>Семейные цели</h4>
                <p>Укажите накопленное, дедлайн и ежемесячный взнос, чтобы видеть реальный план.</p>
              </div>
              <span className="mini-pill">{familyGoalsList.length} целей</span>
            </div>
            <div className="settings-list">
              {familyGoalsList.length ? familyGoalsList.map(goal => (
                <div key={goal.id} className="settings-row">
                  <div>
                    <strong>{goal.title} <span className={`goal-priority ${goal.priority ?? 'medium'}`}>{goal.priority === 'high' ? 'Высокий приоритет' : goal.priority === 'low' ? 'Низкий приоритет' : 'Средний приоритет'}</span></strong>
                    <p>{formatCurrency(goal.currentSavings ?? 0)} из {formatCurrency(goal.target)} · {goal.targetDate ? `к ${formatTargetDate(goal.targetDate)}` : 'срок не указан'} · {goal.isPaused ? 'план на паузе' : `${formatCurrency(goal.monthlyContribution ?? 0)}/мес`}</p>
                  </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="text-link text-button" onClick={() => handleAddFamilyGoalSavings(goal.id)}>Пополнить</button>
                      <button type="button" className="text-button" onClick={() => handleRemoveFamilyGoal(goal.id)} aria-label={`Удалить ${goal.title}`}>Удалить</button>
                    </div>
                </div>
              )) : (
                <div className="empty-cell">Пока нет целей. Создайте первую цель.</div>
              )}
            </div>
            <form className="inline-form" onSubmit={handleAddFamilyGoal}>
              <label><span className="sr-only">Название семейной цели</span><input value={familyGoalTitle} onChange={e => setFamilyGoalTitle(e.target.value)} placeholder="Название цели" /></label>
              <label><span className="sr-only">Сумма семейной цели</span><input value={familyGoalTarget} onChange={e => setFamilyGoalTarget(e.target.value)} placeholder="Сумма цели, ₽" type="number" inputMode="decimal" /></label>
              <label><span className="sr-only">Уже накоплено на семейную цель</span><input value={familyGoalSavings} onChange={e => setFamilyGoalSavings(e.target.value)} placeholder="Уже накоплено, ₽" type="number" inputMode="decimal" /></label>
              <label><span className="sr-only">Дедлайн семейной цели</span><input value={familyGoalDate} onChange={e => setFamilyGoalDate(e.target.value)} type="month" min={new Date().toISOString().slice(0, 7)} aria-label="Дедлайн семейной цели" /></label>
              <label><span className="sr-only">Приоритет семейной цели</span><select value={familyGoalPriority} onChange={e => setFamilyGoalPriority(e.target.value as FamilyGoal['priority'])}><option value="high">Высокий приоритет</option><option value="medium">Средний приоритет</option><option value="low">Низкий приоритет</option></select></label>
              <label><span className="sr-only">Ежемесячный взнос на семейную цель</span><input value={familyGoalContribution} onChange={e => setFamilyGoalContribution(e.target.value)} placeholder="Взнос в месяц, ₽" type="number" inputMode="decimal" /></label>
              <button type="submit">Добавить цель</button>
            </form>
            {members.length > 0 && (
              <>
                <fieldset className="goal-members">
                  <legend>Кто участвует в цели</legend>
                  {members.map(member => <label key={member.id}><input type="checkbox" checked={familyGoalMemberIds.includes(member.id)} onChange={() => toggleFamilyGoalMember(member.id)} /> {member.name}</label>)}
                </fieldset>
                <fieldset className="goal-members">
                  <legend>Как распределять ежемесячный взнос</legend>
                  <label><input type="radio" name="family-goal-distribution" checked={familyGoalDistribution === 'equal'} onChange={() => setFamilyGoalDistribution('equal')} /> Поровну</label>
                  <label><input type="radio" name="family-goal-distribution" checked={familyGoalDistribution === 'income'} onChange={() => setFamilyGoalDistribution('income')} /> Пропорционально доходу</label>
                  <label><input type="radio" name="family-goal-distribution" checked={familyGoalDistribution === 'custom'} onChange={() => setFamilyGoalDistribution('custom')} /> Указать вручную</label>
                </fieldset>
                {familyGoalDistribution === 'custom' && familyGoalMemberIds.length > 0 && (
                  <div className="input-grid goal-contribution-grid">
                    {familyGoalMemberIds.map(id => {
                      const member = members.find(item => item.id === id);
                      return <label key={id}>{member?.name ?? 'Участник'}<input type="number" min="0" inputMode="decimal" value={familyGoalMemberContributions[id] ?? ''} onChange={e => setFamilyGoalMemberContributions(current => ({ ...current, [id]: e.target.value }))} placeholder="Взнос, ₽" /></label>;
                    })}
                  </div>
                )}
              </>
            )}
            <p className="settings-note">Пополнения фонда можно вносить у сохранённой цели. Для ручного распределения сумма взносов участников должна совпадать с общим ежемесячным взносом.</p>
          </div>
        </section>
      )}

      {/* Extras Tab */}
      {activeTab === 'extras' && (
        <section className="card large" id="settings-panel-extras" role="tabpanel">
          <div className="settings-block">
            <div className="settings-block-head">
              <div>
                <h4>Что можно купить</h4>
                <p>Предложение отображается на дашборде.</p>
              </div>
              <span className="mini-pill">Редактируемо</span>
            </div>
            <form className="inline-form" onSubmit={handleSaveSuggestion}>
              <input value={suggestionName} onChange={e => setSuggestionName(e.target.value)} placeholder="Товар" />
              <input value={suggestionPrice} onChange={e => setSuggestionPrice(e.target.value)} placeholder="Цена" type="number" />
              <button type="submit">Сохранить</button>
            </form>
            <p className="settings-note">Это предложение будет отображаться на главной странице.</p>
          </div>

          <div className="settings-block">
            <div className="settings-block-head">
              <div>
                <h4>Накопления</h4>
                <p>Текущий запас, который учитывается в прогнозах.</p>
              </div>
              <span className="mini-pill">Сохранено</span>
            </div>
            <form className="inline-form" onSubmit={handleSaveSavings}>
              <input value={savingsInput} onChange={e => setSavingsInput(e.target.value)} placeholder="Сумма накоплений" type="number" />
              <button type="submit">Сохранить</button>
            </form>
            <p className="settings-note">Это число влияет на дашборд.</p>
          </div>
        </section>
      )}
    </div>
  );
}
