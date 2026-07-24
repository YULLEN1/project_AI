import { FormEvent, useEffect, useState } from 'react';

const storageKeys = {
  budget: 'moneypilot-budget',
  income: 'moneypilot-income',
  salaryDays: 'moneypilot-daysToSalary',
  notifications: 'moneypilot-notifications',
  purchases: 'moneypilot-purchases',
  userAge: 'moneypilot-user-age',
  savingsGoals: 'moneypilot-savings-goals',
  familyMembers: 'moneypilot-family-members',
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
  nextIncomeDate?: string;
  incomeAmount?: number;
};

type FamilyGoal = {
  id: string;
  title: string;
  target: number;
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

type SettingsTab = 'general' | 'goals' | 'family' | 'extras';

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
  const [salaryDays, setSalaryDays] = useState<number | null>(null);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [message, setMessage] = useState('');

  const [members, setMembers] = useState<FamilyMember[]>(() => {
    if (typeof window === 'undefined') return [] as FamilyMember[];
    return readJson(storageKeys.familyMembers, [] as FamilyMember[]);
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
  const [memberRole, setMemberRole] = useState('Доход');
  const [memberAmount, setMemberAmount] = useState('');
  const [memberIncomeDate, setMemberIncomeDate] = useState('');
  const [memberIncomeAmount, setMemberIncomeAmount] = useState('');
  const [familyGoalTitle, setFamilyGoalTitle] = useState('');
  const [familyGoalTarget, setFamilyGoalTarget] = useState('');

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
  const [salaryDaysError, setSalaryDaysError] = useState(false);

  useEffect(() => {
    setBudget(readNumberOrNull(storageKeys.budget));
    setIncome(readNumberOrNull(storageKeys.income));
    setSalaryDays(readNumberOrNull(storageKeys.salaryDays));
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

  const handleSaveFamilyGoals = (newGoals: FamilyGoal[]) => {
    setFamilyGoalsList(newGoals);
    window.localStorage.setItem(storageKeys.familyGoals, JSON.stringify(newGoals));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    const hasBudgetError = budget === null || budget <= 0;
    const hasSalaryError = salaryDays === null || salaryDays <= 0;
    setBudgetError(hasBudgetError);
    setSalaryDaysError(hasSalaryError);

    if (hasBudgetError || hasSalaryError) {
      setMessage('Заполните обязательные поля: бюджет и дни до зарплаты.');
      return;
    }
    window.localStorage.setItem(storageKeys.budget, String(budget));
    if (income !== null) window.localStorage.setItem(storageKeys.income, String(income));
    else window.localStorage.removeItem(storageKeys.income);
    window.localStorage.setItem(storageKeys.salaryDays, String(salaryDays));
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
    window.localStorage.removeItem(storageKeys.salaryDays);
    window.localStorage.removeItem(storageKeys.notifications);
    window.localStorage.removeItem(storageKeys.userAge);
    setBudget(null);
    setIncome(null);
    setSalaryDays(null);
    setUserAge(null);
    setNotifications(true);
    setBudgetError(false);
    setSalaryDaysError(false);
    setMessage('Настройки сброшены. Заполните бюджет и дни до зарплаты.');
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
  };

  const handleRemoveGoal = (id: string) => {
    if (window.confirm('Удалить эту цель накоплений?')) handleSaveSavingsGoals(savingsGoals.filter(g => g.id !== id));
  };

  // Family handlers
  const handleAddMember = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(memberAmount);
    if (!memberName.trim() || !Number.isFinite(parsed) || parsed < 0) {
      setMessage('Для участника укажите имя и сумму.');
      return;
    }
    const next: FamilyMember = {
      id: `${Date.now()}-${memberName.trim()}`,
      name: memberName.trim(),
      role: memberRole.trim(),
      contribute: parsed,
      color: '#37c7ff',
    };
    if (memberIncomeDate) next.nextIncomeDate = memberIncomeDate;
    if (memberIncomeAmount) {
      const inc = Number(memberIncomeAmount);
      if (Number.isFinite(inc) && inc > 0) next.incomeAmount = inc;
    }
    handleSaveMembers([...members, next]);
    setMemberName('');
    setMemberRole('Доход');
    setMemberAmount('');
    setMemberIncomeDate('');
    setMemberIncomeAmount('');
  };

  const handleRemoveMember = (id: string) => {
    if (window.confirm('Удалить участника семьи?')) handleSaveMembers(members.filter(m => m.id !== id));
  };

  const handleAddFamilyGoal = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(familyGoalTarget);
    if (!familyGoalTitle.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setMessage('Для семейной цели укажите название и сумму.');
      return;
    }
    const next: FamilyGoal = {
      id: `${Date.now()}-${familyGoalTitle.trim()}`,
      title: familyGoalTitle.trim(),
      target: parsed,
    };
    handleSaveFamilyGoals([...familyGoalsList, next]);
    setFamilyGoalTitle('');
    setFamilyGoalTarget('');
  };

  const handleRemoveFamilyGoal = (id: string) => {
    if (window.confirm('Удалить семейную цель?')) handleSaveFamilyGoals(familyGoalsList.filter(g => g.id !== id));
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

  const tabs: Array<{ key: SettingsTab; label: string }> = [
    { key: 'general', label: 'Основные' },
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
              Месячный доход
              <input
                type="number"
                value={income ?? ''}
                onChange={e => setIncome(e.target.value ? Number(e.target.value) : null)}
                min={1}
                placeholder="Необязательно, например 120000 ₽"
                inputMode="decimal"
              />
              <small className="settings-note">Доход нужен для сценариев. Лимит расходов используется для дневного ориентира.</small>
            </label>

            <label>
              Дней до следующего дохода <span style={{ color: 'var(--color-error)' }}>*</span>
              <input
                type="number"
                value={salaryDays ?? ''}
                onChange={e => {
                  setSalaryDays(e.target.value ? Number(e.target.value) : null);
                  setSalaryDaysError(false);
                }}
                min={1}
                placeholder="Например, 18"
                className={salaryDaysError ? 'input-error' : ''}
                required
              />
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
              <label><span className="sr-only">Тип цели</span><select value={goalType} onChange={e => setGoalType(e.target.value as typeof GOAL_TYPES[number])}>{GOAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
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
                <h4>Члены семьи</h4>
                <p>Добавьте участников и их вклад в семейный бюджет.</p>
              </div>
              <span className="mini-pill">{members.length} участников</span>
            </div>
            <div className="settings-list">
              {members.length ? members.map(member => (
                <div key={member.id} className="settings-row">
                  <div>
                    <strong>{member.name}</strong>
                    <p>{member.role}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{member.contribute.toLocaleString('ru-RU')} ₽</span>
                    <button type="button" className="text-button" onClick={() => handleRemoveMember(member.id)} aria-label={`Удалить ${member.name}`}>Удалить</button>
                  </div>
                </div>
              )) : (
                <div className="empty-cell">Пока нет членов семьи. Добавьте первого участника ниже.</div>
              )}
            </div>
            <form className="inline-form" onSubmit={handleAddMember}>
              <label><span className="sr-only">Имя участника</span><input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Имя" /></label>
              <label><span className="sr-only">Тип суммы</span><select value={memberRole} onChange={e => setMemberRole(e.target.value)}><option value="Доход">Доход</option><option value="Расход">Обязательный расход</option></select></label>
              <label><span className="sr-only">Сумма</span><input value={memberAmount} onChange={e => setMemberAmount(e.target.value)} placeholder="Сумма, ₽" type="number" inputMode="decimal" /></label>
              <label><span className="sr-only">Дата следующего дохода</span><input value={memberIncomeDate} onChange={e => setMemberIncomeDate(e.target.value)} type="date" /></label>
              <label><span className="sr-only">Сумма следующего дохода</span><input value={memberIncomeAmount} onChange={e => setMemberIncomeAmount(e.target.value)} placeholder="Доход, ₽" type="number" inputMode="decimal" /></label>
              <button type="submit">Добавить</button>
            </form>
          </div>

          <div className="settings-block">
            <div className="settings-block-head">
              <div>
                <h4>Семейные цели</h4>
                <p>Создайте задачи и храните запланированные суммы.</p>
              </div>
              <span className="mini-pill">{familyGoalsList.length} целей</span>
            </div>
            <div className="settings-list">
              {familyGoalsList.length ? familyGoalsList.map(goal => (
                <div key={goal.id} className="settings-row">
                  <div>
                    <strong>{goal.title}</strong>
                    <p>Цель {goal.target.toLocaleString('ru-RU')} ₽</p>
                  </div>
                  <button type="button" className="text-button" onClick={() => handleRemoveFamilyGoal(goal.id)} aria-label={`Удалить ${goal.title}`}>Удалить</button>
                </div>
              )) : (
                <div className="empty-cell">Пока нет целей. Создайте первую цель.</div>
              )}
            </div>
            <form className="inline-form" onSubmit={handleAddFamilyGoal}>
              <input value={familyGoalTitle} onChange={e => setFamilyGoalTitle(e.target.value)} placeholder="Название цели" />
              <input value={familyGoalTarget} onChange={e => setFamilyGoalTarget(e.target.value)} placeholder="Сумма цели" type="number" />
              <button type="submit">Добавить цель</button>
            </form>
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
