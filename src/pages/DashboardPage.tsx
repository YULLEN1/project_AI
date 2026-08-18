import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { accountBalances, getAccounts, getPlannedPayments, getTransactions, goalContributionTotal, monthDates, plannedGoalReserve, plannedPaymentsReserved, saveTransactions, totalSpent as calculateTotalSpent, type Transaction } from '../finance';

type RangeKey = 'today' | 'week' | 'month';

type Purchase = {
  title: string;
  amount: number;
  category: string;
  date: string;
  accountId: string;
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

function readIncomeEvents() {
  if (typeof window === 'undefined') return [] as IncomeEvent[];
  const raw = window.localStorage.getItem('moneypilot-income-events');
  if (!raw) return [];
  try { return JSON.parse(raw) as IncomeEvent[]; }
  catch { return []; }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function getSavedRange() {
  if (typeof window === 'undefined') return 'week' as RangeKey;
  const raw = window.localStorage.getItem('moneypilot-range');
  return raw === 'today' || raw === 'week' || raw === 'month' ? raw : 'week';
}

function getSavedSelectedDate() {
  const today = getToday();
  if (typeof window === 'undefined') return today;
  const raw = window.localStorage.getItem('moneypilot-selectedDate');
  return raw === today ? raw : today;
}

function normalizeDate(value: string) {
  return value.slice(0, 10);
}

function getRangeDates(base: string, range: RangeKey) {
  const date = new Date(`${base}T00:00:00`);
  const dates: string[] = [];
  if (range === 'today') {
    dates.push(normalizeDate(base));
    return dates;
  }
  if (range === 'week') {
    const day = date.getDay();
    const startOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(date);
    start.setDate(date.getDate() + startOffset);
    for (let i = 0; i < 7; i += 1) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      dates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
    }
    return dates;
  }
  if (range === 'month') {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= days; i += 1) {
      dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    return dates;
  }
  return dates;
}

function buildChartPoints(dates: string[], purchases: Purchase[]) {
  return dates.map(date => {
    const total = purchases.filter(item => item.date === date).reduce((sum, item) => sum + item.amount, 0);
    return { date, total };
  });
}

function formatDateLabel(dateString: string) {
  const date = new Date(dateString);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getNextIncome(events: IncomeEvent[], fromDate: string, includeLikely: boolean) {
  const base = new Date(`${fromDate}T00:00:00`);
  return events.flatMap(event => {
    if (event.status !== 'expected' || (!includeLikely && event.confidence === 'likely')) return [];
    if (event.recurrence !== 'monthly') return event.date >= fromDate ? [event] : [];
    const original = new Date(`${event.date}T00:00:00`);
    const date = new Date(base.getFullYear(), base.getMonth(), Math.min(original.getDate(), new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()));
    if (date <= base) date.setMonth(date.getMonth() + 1);
    return [{ ...event, date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }];
  }).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

function daysBetween(fromDate: string, toDate: string) {
  return Math.max(0, Math.round((new Date(`${toDate}T00:00:00`).getTime() - new Date(`${fromDate}T00:00:00`).getTime()) / 86400000));
}

function getSavedSuggestion() {
  if (typeof window === 'undefined') return { name: '', price: 0 };
  const raw = window.localStorage.getItem('moneypilot-suggestedItem');
  if (!raw) return { name: '', price: 0 };
  try {
    const parsed = JSON.parse(raw) as { name: string; price: number };
    return {
      name: parsed.name || '',
      price: Number.isFinite(parsed.price) && parsed.price > 0 ? parsed.price : 0,
    };
  } catch {
    return { name: '', price: 0 };
  }
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

const CATEGORIES = ['Транспорт', 'Еда', 'Развлечения', 'Подписки', 'Здоровье', 'Одежда', 'Жильё', 'ЖКХ', 'Связь', 'Кредиты', 'Образование', 'Разное'] as const;
type CategoryKey = typeof CATEGORIES[number];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Транспорт: ['такси', 'метро', 'автобус', 'транспорт', 'яндекс.драйв', 'каршеринг', 'бензин', 'парковка', 'ж/д', 'поезд', 'самолёт', 'avia', 'railway'],
  Еда: ['кафе', 'кофе', 'кофейн', 'еда', 'ресторан', 'доставка', 'обед', 'ужин', 'завтрак', 'продукты', 'supermarket', 'пятёрочка', 'магнит', 'перекрёсток', 'вкусвилл', 'лента', 'шашлык', 'пицца', 'бургер', 'суши'],
  Развлечения: ['кино', 'театр', 'концерт', 'игр', 'game', 'развлечен', 'бар', 'клуб', 'караоке', 'бильярд', 'bowling'],
  Подписки: ['подписк', 'spotify', 'netflix', 'kinopoisk', 'yandex plus', 'apple', 'youtube premium', 'ivi', 'okko', 'premier', 'start', 'wink'],
  Здоровье: ['аптека', 'лекарств', 'врач', 'доктор', 'больниц', 'clinic', 'стоматолог', 'анализ', 'медицин', 'спортзал', 'фитнес', 'тренажёр'],
  Одежда: ['одежд', 'обувь', 'zara', 'hm', 'uniqlo', 'lamoda', 'wildberries', 'ozon одежду', 'brand'],
  Жильё: ['аренд', 'жильё', 'квартир'],
  ЖКХ: ['жкх', 'коммунал', 'квартплата', 'электричеств', 'водоснабжен', 'газ'],
  Связь: ['интернет', 'мобильн', 'связь', 'телефон', 'тариф', 'оператор'],
  Кредиты: ['кредит', 'ипотек', 'займ', 'рассрочк', 'платёж по карте'],
  Образование: ['курс', 'обучен', 'учеб', 'книг', 'book', 'education', 'udemy', 'skillbox', 'stepik'],
};

function detectCategory(title: string): CategoryKey {
  const lower = title.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return category as CategoryKey;
  }
  return 'Разное';
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => getTransactions());
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CategoryKey>('Разное');
  const [date, setDate] = useState(getToday());
  const [accountId, setAccountId] = useState('main');
  const [paymentId, setPaymentId] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [formError, setFormError] = useState('');
  const [formWarning, setFormWarning] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [range, setRange] = useState<RangeKey>(() => getSavedRange());
  const [selectedDate, setSelectedDate] = useState(() => getSavedSelectedDate());
  const [includeLikelyIncome, setIncludeLikelyIncome] = useState(false);
  const suggestion = getSavedSuggestion();

  useEffect(() => {
    window.localStorage.setItem('moneypilot-range', range);
    window.localStorage.setItem('moneypilot-selectedDate', selectedDate);
  }, [range, selectedDate]);


  const accounts = getAccounts();
  const plannedPayments = getPlannedPayments();
  const memberAccountIds = useMemo(() => new Set(accounts.filter(account => account.kind === 'member' && !account.archived).map(account => account.id)), [accounts]);
  const purchases = useMemo<Purchase[]>(() => transactions
    .filter(item => item.type === 'expense' && item.status === 'completed')
    .map(item => ({ title: item.title, amount: item.amount, category: item.category || 'Разное', date: item.date, accountId: item.accountId })), [transactions]);
  const incomeEvents = readIncomeEvents();
  const nextIncome = useMemo(() => getNextIncome(incomeEvents, selectedDate, includeLikelyIncome), [incomeEvents, selectedDate, includeLikelyIncome]);
  const daysToIncome = nextIncome ? daysBetween(selectedDate, nextIncome.date) : null;
  const rangeDates = useMemo(() => getRangeDates(selectedDate, range), [selectedDate, range]);
  const filteredPurchases = useMemo(
    () => purchases.filter(item => rangeDates.includes(item.date)),
    [purchases, rangeDates],
  );
  const chartPurchases = useMemo(() => filteredPurchases.filter(item => !memberAccountIds.has(item.accountId)), [filteredPurchases, memberAccountIds]);
  const totalSpent = useMemo(() => filteredPurchases.reduce((sum, item) => sum + item.amount, 0), [filteredPurchases]);
  const monthKey = selectedDate.slice(0, 7);
  const monthSpent = useMemo(() => calculateTotalSpent(transactions, `${monthKey}-01`, selectedDate), [transactions, monthKey, selectedDate]);
  const actualIncomeToDate = useMemo(() => transactions.filter(item => item.type === 'income' && item.status === 'completed' && item.date.startsWith(monthKey) && item.date <= selectedDate).reduce((sum, item) => sum + item.amount, 0), [transactions, monthKey, selectedDate]);
  const familyMemberIncome = useMemo(() => transactions
    .filter(item => item.type === 'income' && item.status === 'completed' && item.date.startsWith(monthKey) && item.date <= selectedDate && memberAccountIds.has(item.accountId))
    .reduce((sum, item) => sum + item.amount, 0), [transactions, monthKey, selectedDate, memberAccountIds]);
  const familyMemberExpenses = useMemo(() => transactions
    .filter(item => item.type === 'expense' && item.status === 'completed' && item.date.startsWith(monthKey) && item.date <= selectedDate && memberAccountIds.has(item.accountId))
    .reduce((sum, item) => sum + item.amount, 0), [transactions, monthKey, selectedDate, memberAccountIds]);
  const familyGoals = readJson<Array<{ target: number; currentSavings?: number; monthlyContribution?: number; isPaused?: boolean }>>('moneypilot-family-goals', []);
  const savingsGoals = readJson<Array<{ targetAmount: number; currentSavings: number; targetDate?: string; targetAge?: number; type?: string; name?: string; monthlyPension?: number; retirementAge?: number; lifeExpectancy?: number }>>('moneypilot-savings-goals', []);
  const userAge = (() => { const value = Number(window.localStorage.getItem('moneypilot-user-age')); return Number.isFinite(value) && value > 0 ? value : null; })();
  const plannedGoalsForMonth = plannedGoalReserve([
    ...familyGoals.map(goal => ({ target: goal.target, currentSavings: goal.currentSavings ?? 0, monthlyContribution: goal.monthlyContribution, isPaused: goal.isPaused })),
    ...savingsGoals.map(goal => ({ target: goal.targetAmount, currentSavings: goal.currentSavings, targetDate: goal.targetDate, targetAge: goal.targetAge, type: goal.type, name: goal.name, monthlyPension: goal.monthlyPension, retirementAge: goal.retirementAge, lifeExpectancy: goal.lifeExpectancy })),
  ], userAge);
  const goalContributionsToDate = goalContributionTotal(transactions, `${monthKey}-01`, selectedDate);
  const goalsReserved = Math.max(0, plannedGoalsForMonth - goalContributionsToDate);
  const balances = useMemo(() => accountBalances(accounts, transactions, selectedDate), [accounts, transactions, selectedDate]);
  const savings = accounts.filter(account => !account.spendable).reduce((sum, account) => sum + (balances[account.id] || 0), 0);
  const availableCash = accounts.filter(account => account.spendable && account.kind !== 'member').reduce((sum, account) => sum + (balances[account.id] || 0), 0);
  const paymentsBeforeIncome = plannedPaymentsReserved(plannedPayments, transactions, selectedDate, nextIncome?.date ?? monthDates(selectedDate).end);
  const spendableBeforeIncome = availableCash - paymentsBeforeIncome - goalsReserved;
  const dailyBudget = daysToIncome !== null ? spendableBeforeIncome / Math.max(1, daysToIncome) : 0;
  const lastPurchase = purchases[purchases.length - 1];
  const averagePurchase = filteredPurchases.length ? Math.round(totalSpent / filteredPurchases.length) : 0;
  const chartPoints = useMemo(() => buildChartPoints(rangeDates, chartPurchases), [rangeDates, chartPurchases]);
  const chartPath = useMemo(() => {
    const values = chartPoints.map(point => point.total);
    const maxValue = Math.max(...values, 40);
    return chartPoints.map((point, index) => {
      const x = 10 + index * (300 / Math.max(chartPoints.length - 1, 1));
      const y = 125 - Math.round((point.total / maxValue) * 100);
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    }).join(' ');
  }, [chartPoints]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    setFormWarning('');
    setFormSuccess('');
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Укажите название покупки и сумму больше нуля.');
      return;
    }
    const transactionDate = normalizeDate(date);
    const balanceAfterExpense = (accountBalances(accounts, transactions, transactionDate)[accountId] || 0) - parsedAmount;
    const accountName = accounts.find(account => account.id === accountId)?.name || 'выбранного счёта';
    const next = [...transactions, {
      id: `${Date.now()}-${title.trim()}`,
      type: 'expense' as const,
      status: 'completed' as const,
      title: title.trim(),
      amount: parsedAmount,
      category,
      date: transactionDate,
      accountId,
      paymentId: paymentId || undefined,
    }];
    const warnings: string[] = [];
    if (balanceAfterExpense < 0) {
      warnings.push(`Расход приводит к дефициту: баланс ${accountName} станет −${formatCurrency(Math.abs(balanceAfterExpense))}.`);
    }
    const nextBalances = accountBalances(accounts, next, selectedDate);
    const nextAvailableCash = accounts.filter(account => account.spendable && account.kind !== 'member').reduce((sum, account) => sum + (nextBalances[account.id] || 0), 0);
    const nextPaymentsBeforeIncome = plannedPaymentsReserved(plannedPayments, next, selectedDate, nextIncome?.date ?? monthDates(selectedDate).end);
    const nextSpendableBeforeIncome = nextAvailableCash - nextPaymentsBeforeIncome - goalsReserved;
    if (nextSpendableBeforeIncome < 0) {
      warnings.push(`До следующего дохода образуется дефицит ${formatCurrency(Math.abs(nextSpendableBeforeIncome))} с учётом обязательных платежей и целей.`);
    }
    if (warnings.length) {
      const warning = warnings.join(' ');
      if (!window.confirm(`${warning} Сохранить операцию?`)) return;
      setFormWarning(warning);
    }
    setTransactions(next);
    saveTransactions(next);
    setTitle('');
    setAmount('');
    setCategory('Разное');
    setPaymentId('');
    setFormSuccess('Расход добавлен в выбранную дату.');
  };


  return (
    <div className="page-grid">
      <section className="hero-panel dashboard-decision">
        <div className="hero-copy">
          <p className="eyebrow">Финансовый ориентир</p>
          <h2>{nextIncome ? 'Можно потратить сегодня' : 'Добавьте ближайшее поступление'}</h2>
          {nextIncome ? (
            <>
              <strong className="decision-amount">{formatCurrency(Math.round(dailyBudget))}</strong>
              <p>На личных доступных счетах: {formatCurrency(availableCash)}. Следующее поступление: {nextIncome.source} · {formatCurrency(nextIncome.amount)} · через {daysToIncome} дн.</p>
            </>
          ) : (
            <p>Добавьте ожидаемую дату следующего поступления, чтобы распределить только уже полученные деньги по дням.</p>
          )}
        </div>
        <Link className="hero-action" to="/settings">{nextIncome ? 'Изменить план' : 'Добавить поступление'}</Link>
      </section>
      <section className="card calculation-breakdown" aria-label="Как рассчитан ориентир">
        <h2>Как рассчитан ориентир</h2>
        <p className="settings-note">Факт на {selectedDate}; плановые платежи пока не списаны.</p>
        <div className="settings-list">
          <div className="settings-row"><span>На личных доступных счетах</span><strong>{formatCurrency(availableCash)}</strong></div>
          <div className="settings-row"><span>Резерв обязательных платежей до дохода</span><strong>−{formatCurrency(paymentsBeforeIncome)}</strong></div>
          <div className="settings-row"><span>Резерв целей</span><strong>−{formatCurrency(goalsReserved)}</strong></div>
          <div className="settings-row"><strong>{spendableBeforeIncome < 0 ? 'Дефицит до дохода' : 'Можно потратить до дохода'}</strong><strong>{spendableBeforeIncome < 0 ? '−' : ''}{formatCurrency(spendableBeforeIncome)}</strong></div>
        </div>
      </section>
      {incomeEvents.some(event => event.status === 'expected' && event.confidence === 'likely') && <label className="income-confidence-toggle"><input type="checkbox" checked={includeLikelyIncome} onChange={e => setIncludeLikelyIncome(e.target.checked)} /> Учитывать вероятные поступления в ориентире</label>}

      <section className="widget-tabs" aria-label="Временные показатели">
        {[
          { key: 'today', label: 'Сегодня' },
          { key: 'week', label: 'Неделя' },
          { key: 'month', label: 'Месяц' },
        ].map(item => (
          <button key={item.key} className={`widget-tab ${range === item.key ? 'active' : ''}`} onClick={() => setRange(item.key as RangeKey)}>
            {item.label}
          </button>
        ))}
      </section>

      <section className="calendar-panel" aria-label="Период анализа">
        <div className="calendar-head">
          <label htmlFor="analytics-date">Дата анализа</label>
          <input id="analytics-date" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Потрачено в этом месяце</span>
          <strong>{formatCurrency(monthSpent)}</strong>
          {actualIncomeToDate > 0 ? (
            <div className="mini-pill warning">
              {Math.round((monthSpent / actualIncomeToDate) * 100)}% от полученных поступлений
            </div>
          ) : (
            <div className="mini-pill">Нет полученных поступлений</div>
          )}
        </article>
        <article className="metric-card primary">
          <span>Доступно до дохода</span>
          <strong>{formatCurrency(spendableBeforeIncome)}</strong>
          {nextIncome ? (
            <div className={`mini-pill ${spendableBeforeIncome > 0 ? 'good' : 'warning'}`}>
               {spendableBeforeIncome < 0 ? `Дефицит ${formatCurrency(Math.abs(spendableBeforeIncome))}` : `${formatCurrency(spendableBeforeIncome)} до следующего дохода`}
            </div>
          ) : (
            <div className="mini-pill">Через настройки</div>
          )}
        </article>
        <article className="metric-card">
          <span>Накопления</span>
          <strong>{formatCurrency(savings)}</strong>
          <div className="mini-pill">{savings > 0 ? 'Ваш запас' : 'Добавьте сумму'}</div>
        </article>
        <article className="metric-card">
          <span>Доходы членов семьи</span>
          <strong>{formatCurrency(familyMemberIncome)}</strong>
          <div className="mini-pill">На счета участников за месяц</div>
        </article>
        <article className="metric-card">
          <span>Расходы членов семьи</span>
          <strong>{formatCurrency(familyMemberExpenses)}</strong>
          <div className="mini-pill">Со счетов участников за месяц</div>
        </article>
      </section>

      <section className="content-grid">
          <div className="card large chart-card">
            <div className="card-head">
            <h2>Личные расходы по дням</h2>
            <span>{range === 'today' ? 'Сегодня' : range === 'week' ? 'Неделя' : 'Месяц'}</span>
          </div>
          <div className="chart-wrapper">
            <svg viewBox="0 0 320 140" className="real-chart" role="img" aria-label="График личных расходов по дням">
              <path d={chartPath} />
              {chartPoints.map((point, index) => {
                const x = 10 + index * (300 / Math.max(chartPoints.length - 1, 1));
                const values = chartPoints.map(item => item.total);
                const maxValue = Math.max(...values, 40);
                const y = 125 - Math.round((point.total / maxValue) * 100);
                return <circle key={point.date} cx={x} cy={y} r={4} />;
              })}
            </svg>
            <table className="sr-only">
              <caption>Личные расходы по дням за выбранный период</caption>
              <tbody>{chartPoints.map(point => <tr key={point.date}><th scope="row">{formatDateLabel(point.date)}</th><td>{formatCurrency(point.total)}</td></tr>)}</tbody>
            </table>
            <div className="chart-tooltip">
              {nextIncome
                ? (chartPurchases.length
                  ? `Итого ${formatCurrency(chartPurchases.reduce((sum, item) => sum + item.amount, 0))} за выбранный период`
                  : 'Добавьте личные расходы в выбранный диапазон')
                : 'Установите лимит и добавьте поступление в настройках'}
            </div>
          </div>
        </div>

        <div className="card large">
          <h2>Добавить расход</h2>
          <p>
            {lastPurchase
              ? `${lastPurchase.title} — покупка №${filteredPurchases.length} за период. Средний чек — ${formatCurrency(averagePurchase)}.`
              : 'Добавьте первую покупку.'}
          </p>
          <form className="inline-form purchase-form" onSubmit={handleSubmit} noValidate>
            <label><span className="sr-only">Название покупки</span><input aria-invalid={Boolean(formError)} value={title} onChange={e => { setTitle(e.target.value); setCategory(detectCategory(e.target.value)); }} placeholder="Что купили?" /></label>
            <label><span className="sr-only">Сумма в рублях</span><input aria-invalid={Boolean(formError)} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Сумма, ₽" type="number" min="1" inputMode="decimal" /></label>
            <button type="submit">Добавить расход</button>
            <button className="text-button" type="button" onClick={() => setShowDetails(!showDetails)} aria-expanded={showDetails}>Дополнительно</button>
            {showDetails && <div className="purchase-details">
              <label><span>Категория</span><select value={category} onChange={e => setCategory(e.target.value as CategoryKey)}>
               {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></label>
              <label><span>Счёт</span><select value={accountId} onChange={e => setAccountId(e.target.value)}>{accounts.filter(account => account.spendable).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <label><span>Обязательный платёж</span><select value={paymentId} onChange={e => setPaymentId(e.target.value)}><option value="">Не выбран</option>{plannedPayments.filter(payment => payment.active).map(payment => <option key={payment.id} value={payment.id}>{payment.title}</option>)}</select></label>
              <label><span>Дата</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            </div>}
          </form>
          {formError && <p className="form-feedback error" role="alert">{formError}</p>}
          {formWarning && <p className="form-feedback error" role="alert">{formWarning}</p>}
          {formSuccess && <p className="form-feedback success" role="status">{formSuccess}</p>}
        </div>

        <div className="stack">
          <div className="card">
            <p className="eyebrow">Накопления</p>
            <h4>{formatCurrency(savings)}</h4>
            <p>Это ваш текущий запас на случай непредвиденных расходов.</p>
            <p className="settings-note">Измените сумму накоплений на странице <Link to="/settings">Настройки</Link>.</p>
          </div>

          <div className="card">
            <p className="eyebrow">Предложение дня</p>
            {suggestion.name && suggestion.price > 0 ? (
              <>
                <h4>{suggestion.name} · {formatCurrency(suggestion.price)}</h4>
                <p>После такой покупки свободных денег останется {formatCurrency(Math.max(0, spendableBeforeIncome - suggestion.price))}.</p>
                <p className="settings-note">Измените это предложение в <Link to="/settings">Настройках</Link>.</p>
              </>
            ) : (
              <p>Предложение не задано. Измените его в <Link to="/settings">Настройках</Link>.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
