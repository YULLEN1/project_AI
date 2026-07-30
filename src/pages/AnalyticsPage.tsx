import { useEffect, useMemo, useState } from 'react';
import { accountBalances, cashFlowSummary, getAccounts, getPlannedPayments, getTransactions, plannedGoalReserve, plannedPaymentsReserved, type Transaction } from '../finance';

type RangeKey = 'today' | 'week' | 'month';

type Purchase = {
  title: string;
  amount: number;
  category: string;
  date: string;
};

type FamilyGoal = {
  id: string;
  title: string;
  target: number;
  currentSavings?: number;
  targetDate?: string;
  monthlyContribution?: number;
  isPaused?: boolean;
  activity?: Array<{ amount: number; date: string }>;
};

type SavingsGoal = {
  id: string;
  name: string;
  type?: string;
  targetAmount: number;
  targetDate?: string;
  targetAge?: number;
  monthlyPension?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
  currentSavings: number;
  activity?: Array<{ amount: number; date: string }>;
};

type ForecastType = 'simple' | 'family-goals' | 'personal-goals';

type ForecastPoint = {
  year: number;
  value: number;
  label?: string;
};

type CategoryTotal = {
  name: string;
  amount: number;
  color: string;
};

type IncomeEvent = { amount: number; date: string; status: 'expected' | 'received'; confidence: 'confirmed' | 'likely'; recurrence: 'once' | 'monthly'; };

type GoalPlan = {
  id: string;
  title: string;
  target: number;
  current: number;
  plannedMonthly: number;
  actualThisMonth: number;
  actualMonthly: number;
  deadline?: string;
  monthsLeft?: number;
  kind: 'family' | 'personal' | 'pension';
};

function summarizeGoals(goals: GoalPlan[]) {
  return {
    current: goals.reduce((sum, goal) => sum + goal.current, 0),
    target: goals.reduce((sum, goal) => sum + goal.target, 0),
    plannedMonthly: goals.reduce((sum, goal) => sum + goal.plannedMonthly, 0),
    actualThisMonth: goals.reduce((sum, goal) => sum + goal.actualThisMonth, 0),
    actualMonthly: goals.reduce((sum, goal) => sum + goal.actualMonthly, 0),
  };
}

const CATEGORY_COLORS = ['#37c7ff', '#8b6dff', '#84f4c0', '#ffca7a', '#ff7f8f', '#64a4ff'];

function readPurchases() {
  return getTransactions().filter(item => item.type === 'expense' && item.status === 'completed').map(item => ({ title: item.title, amount: item.amount, category: item.category || 'Разное', date: item.date }));
}

function getSavedRange() {
  if (typeof window === 'undefined') return 'week' as RangeKey;
  const raw = window.localStorage.getItem('moneypilot-range');
  return raw === 'today' || raw === 'week' || raw === 'month' ? raw : 'week';
}

function getLocalToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getSavedSelectedDate() {
  const today = getLocalToday();
  if (typeof window === 'undefined') return today;
  const raw = window.localStorage.getItem('moneypilot-selectedDate');
  return raw === today ? raw : today;
}

function normalizeDate(value: string) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRangeDates(base: string, range: RangeKey) {
  const date = new Date(base);
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
      dates.push(normalizeDate(current.toISOString()));
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

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

function readNumber(key: string): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function previousDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function transactionLabel(transaction: Transaction) {
  if (transaction.type === 'income') return 'Поступление';
  if (transaction.type === 'expense') return transaction.category || 'Расход';
  if (transaction.type === 'goal-contribution') return 'Пополнение цели';
  return 'Перевод между счетами';
}

function getPensionDetails(goal: SavingsGoal) {
  const isPension = goal.monthlyPension || goal.type === 'Пенсия' || goal.name.trim().toLowerCase() === 'пенсия';
  if (!isPension) return null;
  return {
    monthlyPension: goal.monthlyPension ?? goal.targetAmount,
    retirementAge: goal.retirementAge ?? goal.targetAge ?? 60,
    lifeExpectancy: goal.lifeExpectancy ?? 95,
  };
}

function getMonthsUntil(goal: SavingsGoal, userAge?: number | null) {
  const pension = getPensionDetails(goal);
  if (pension && userAge) {
    const months = (pension.retirementAge - userAge) * 12;
    return months > 0 ? months : null;
  }
  const { targetDate, targetAge } = goal;
  if (targetDate) {
    return getMonthsUntilDate(targetDate);
  }
  if (targetAge && userAge) {
    const months = (targetAge - userAge) * 12;
    return months > 0 ? months : null;
  }
  return null;
}

function getMonthsUntilDate(targetDate?: string) {
  if (!targetDate) return null;
  const now = new Date();
  const date = targetDate.length === 7 ? `${targetDate}-01` : targetDate;
  const target = new Date(`${date}T00:00:00`);
  const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
  return Number.isFinite(months) && months > 0 ? months : null;
}

function getTargetAmount(goal: SavingsGoal) {
  const pension = getPensionDetails(goal);
  if (pension) return pension.monthlyPension * Math.max(0, pension.lifeExpectancy - pension.retirementAge) * 12;
  return goal.targetAmount;
}

function getGoalPlans(familyGoals: FamilyGoal[], savingsGoals: SavingsGoal[], userAge: number | null, today: string): GoalPlan[] {
  const currentMonth = today.slice(0, 7);
  const threeMonthsAgo = new Date(`${currentMonth}-01T00:00:00`);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
  const activitySummary = (activity: Array<{ amount: number; date: string }> = []) => ({
    thisMonth: activity.filter(item => item.date.startsWith(currentMonth)).reduce((sum, item) => sum + item.amount, 0),
    monthly: activity.filter(item => new Date(`${item.date}T00:00:00`) >= threeMonthsAgo).reduce((sum, item) => sum + item.amount, 0) / 3,
  });
  const family = familyGoals.map(goal => {
    const activity = activitySummary(goal.activity);
    return { id: `family-${goal.id}`, title: goal.title, target: goal.target, current: goal.currentSavings ?? 0, plannedMonthly: goal.isPaused ? 0 : goal.monthlyContribution ?? 0, actualThisMonth: activity.thisMonth, actualMonthly: activity.monthly, deadline: goal.targetDate, monthsLeft: getMonthsUntilDate(goal.targetDate) ?? undefined, kind: 'family' as const };
  });
  const personal = savingsGoals.map(goal => {
    const pension = getPensionDetails(goal);
    const target = getTargetAmount(goal);
    const monthsLeft = getMonthsUntil(goal, userAge);
    const plannedMonthly = monthsLeft ? Math.ceil(Math.max(0, target - goal.currentSavings) / monthsLeft) : 0;
    const activity = activitySummary(goal.activity);
    return { id: `personal-${goal.id}`, title: goal.name, target, current: goal.currentSavings, plannedMonthly, actualThisMonth: activity.thisMonth, actualMonthly: activity.monthly, deadline: pension ? `выход в ${pension.retirementAge} лет` : goal.targetDate, monthsLeft: monthsLeft ?? undefined, kind: pension ? 'pension' as const : 'personal' as const };
  });
  return [...family, ...personal];
}

function formatMonthsLabel(months: number) {
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  if (!years) return `${months} мес.`;
  if (!remainder) return `${years} г.`;
  return `${years} г. ${remainder} мес.`;
}

function getGoalForecastMonths(goals: GoalPlan[]) {
  const nearestDeadline = Math.min(...goals.map(goal => goal.monthsLeft ?? Infinity));
  const horizon = nearestDeadline <= 60 ? nearestDeadline : 60;
  const annualPoints = [12, 24, 36, 48].filter(month => month < horizon);
  return [...annualPoints, horizon];
}

function buildLinePath(points: ForecastPoint[]) {
  const maxValue = Math.max(...points.map(point => point.value), 1);
  return points.map((point, index) => {
    const x = 18 + index * (264 / Math.max(points.length - 1, 1));
    const y = 108 - Math.round((point.value / maxValue) * 82);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`));
}

function PieChart({ categories, total }: { categories: CategoryTotal[]; total: number }) {
  let startAngle = -90;
  return (
    <div className="expense-breakdown">
      <svg viewBox="0 0 180 180" className="pie-chart" role="img" aria-label="Распределение расходов по категориям">
        {categories.map(category => {
          const angle = (category.amount / total) * 360;
          const endAngle = startAngle + angle;
          const start = { x: 90 + 70 * Math.cos((Math.PI * startAngle) / 180), y: 90 + 70 * Math.sin((Math.PI * startAngle) / 180) };
          const end = { x: 90 + 70 * Math.cos((Math.PI * endAngle) / 180), y: 90 + 70 * Math.sin((Math.PI * endAngle) / 180) };
          const largeArc = angle > 180 ? 1 : 0;
          const path = angle === 360
            ? 'M 90 20 A 70 70 0 1 1 89.99 20 Z'
            : `M 90 90 L ${start.x} ${start.y} A 70 70 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
          startAngle = endAngle;
          return <path key={category.name} d={path} fill={category.color}><title>{`${category.name}: ${formatCurrency(category.amount)}`}</title></path>;
        })}
        <circle cx="90" cy="90" r="42" className="pie-chart-center" />
        <text x="90" y="86" textAnchor="middle" className="pie-chart-total">{formatCurrency(total)}</text>
        <text x="90" y="104" textAnchor="middle" className="pie-chart-caption">расходы</text>
      </svg>
      <ul className="pie-legend">
        {categories.map(category => <li key={category.name}><span style={{ background: category.color }} /><span>{category.name}</span><strong>{Math.round((category.amount / total) * 100)}%</strong></li>)}
      </ul>
    </div>
  );
}

function ForecastChart({ points, label }: { points: ForecastPoint[]; label: string }) {
  const path = buildLinePath(points);
  const maxValue = Math.max(...points.map(point => point.value), 1);

  return (
      <div className="forecast-chart" role="img" aria-label={label}>
      <svg viewBox="0 0 300 132" preserveAspectRatio="none">
        <path className="forecast-grid-line" d="M18 108 H282 M18 67 H282 M18 26 H282" />
        <path className="forecast-line" d={path} />
        {points.map((point, index) => {
          const x = 18 + index * (264 / Math.max(points.length - 1, 1));
          const y = 108 - Math.round((point.value / maxValue) * 82);
          return <circle key={`${point.label ?? point.year}-${index}`} cx={x} cy={y} r="4" />;
        })}
      </svg>
      <div className="forecast-chart-labels">
        {points.map((point, index) => <span key={`${point.label ?? point.year}-${index}`}>{point.label ?? `${point.year} г.`}</span>)}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{points.map((point, index) => <tr key={`${point.label ?? point.year}-${index}`}><th scope="row">Через {point.label ?? `${point.year} г.`}</th><td>{formatCurrency(point.value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function GoalForecast({ title, goals, summary, planPoints, factPoints }: { title: string; goals: GoalPlan[]; summary: ReturnType<typeof summarizeGoals>; planPoints: ForecastPoint[]; factPoints: ForecastPoint[] }) {
  if (!goals.length) return <p className="settings-note">Добавьте {title.toLowerCase()}, чтобы построить прогноз.</p>;
  const progress = summary.target > 0 ? Math.min(100, Math.round(summary.current / summary.target * 100)) : 0;
  const deadlineMonths = Math.min(...goals.map(goal => goal.monthsLeft ?? Infinity));
  return <>
    <p>Плановый темп - необходимый взнос; фактический - среднее подтверждённых пополнений за последние три месяца.</p>
    {deadlineMonths <= 60 && <p className="settings-note">График построен до ближайшего дедлайна: {formatMonthsLabel(deadlineMonths)}.</p>}
    <div className="forecast-box"><p>Уже накоплено</p><strong>{formatCurrency(summary.current)}</strong><span>из {formatCurrency(summary.target)} · {progress}%</span></div>
    <p className="settings-note">План на месяц: {formatCurrency(summary.plannedMonthly)} · внесено: {formatCurrency(summary.actualThisMonth)} · {summary.actualThisMonth >= summary.plannedMonthly ? 'план выполнен' : `не внесено ${formatCurrency(summary.plannedMonthly - summary.actualThisMonth)}`}</p>
    <div className="settings-list" style={{ marginTop: 16 }}>{goals.map(goal => <div className="settings-row" key={goal.id}><div><strong>{goal.title}</strong><p>{goal.kind === 'pension' ? 'Пенсия' : goal.kind === 'family' ? 'Семейная цель' : 'Личная цель'}{goal.deadline ? ` · срок ${goal.deadline}` : ''}</p></div><div><strong>{formatCurrency(goal.current)} из {formatCurrency(goal.target)}</strong><p>План {formatCurrency(goal.plannedMonthly)}/мес · факт {formatCurrency(goal.actualThisMonth)}/мес</p></div></div>)}</div>
    <p className="settings-note" style={{ marginTop: 16 }}>Прогноз по плановому темпу</p><ForecastChart points={planPoints} label={`${title}: прогноз по плановому темпу`} />
    {summary.actualMonthly > 0 ? <><p className="settings-note">Прогноз по фактическому темпу</p><ForecastChart points={factPoints} label={`${title}: прогноз по фактическому темпу`} /></> : <p className="settings-note">Нет фактических пополнений за последние три месяца.</p>}
  </>;
}

export default function AnalyticsPage() {
  const [visible, setVisible] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [range, setRange] = useState<RangeKey>('week');
  const [selectedDate, setSelectedDate] = useState(getSavedSelectedDate());
  const [forecastType, setForecastType] = useState<ForecastType>('simple');

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 80);
    setPurchases(readPurchases());
    setTransactions(getTransactions());
    setRange(getSavedRange());
    setSelectedDate(getSavedSelectedDate());

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'moneypilot-range') setRange(getSavedRange());
      if (event.key === 'moneypilot-selectedDate') setSelectedDate(getSavedSelectedDate());
      if (event.key === 'moneypilot-purchases' || event.key === 'moneypilot-transactions') { setPurchases(readPurchases()); setTransactions(getTransactions()); }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const rangeDates = useMemo(() => getRangeDates(selectedDate, range), [selectedDate, range]);
  const filteredPurchases = useMemo(
    () => purchases.filter(item => rangeDates.includes(item.date)),
    [purchases, rangeDates],
  );
  const configuredIncome = readNumber('moneypilot-income');

  const analytics = useMemo(() => {
    const categoryTotals = filteredPurchases.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {});

    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1]);

    const total = filteredPurchases.reduce((sum, item) => sum + item.amount, 0);
    const dailyExpenses = rangeDates.map((date, index) => ({
      year: index + 1,
      value: purchases.filter(item => item.date === date).reduce((sum, item) => sum + item.amount, 0),
    }));
    const expenseChartPath = buildLinePath(dailyExpenses);
    const spendingDays = dailyExpenses.filter(point => point.value > 0);
    const trend =
      spendingDays.length > 1 && spendingDays[0].value !== 0
        ? Math.round((spendingDays[spendingDays.length - 1].value - spendingDays[0].value) / spendingDays[0].value * 100)
        : 0;

    const income = readNumber('moneypilot-income');
    const fromDate = rangeDates[0];
    const throughDate = rangeDates[rangeDates.length - 1];
    const cashFlow = cashFlowSummary(transactions, fromDate, throughDate);
    const accounts = getAccounts();
    const openingBalance = Object.values(accountBalances(accounts, transactions, previousDate(fromDate))).reduce((sum, amount) => sum + amount, 0);
    const closingBalance = Object.values(accountBalances(accounts, transactions, throughDate)).reduce((sum, amount) => sum + amount, 0);
    const periodTransactions = transactions.filter(transaction => transaction.status === 'completed' && rangeDates.includes(transaction.date)).sort((a, b) => b.date.localeCompare(a.date));
    const plannedPayments = plannedPaymentsReserved(getPlannedPayments(), transactions, selectedDate);
    const plannedIncome = readJson<IncomeEvent[]>('moneypilot-income-events', []).reduce((sum, event) => {
      if (event.status !== 'expected' || event.confidence === 'likely') return sum;
      if (event.recurrence === 'once') return rangeDates.includes(event.date) ? sum + event.amount : sum;
      return sum + rangeDates.filter(date => Number(date.slice(8, 10)) === new Date(`${event.date}T00:00:00`).getDate()).length * event.amount;
    }, 0);
    const familyGoals = readJson<FamilyGoal[]>('moneypilot-family-goals', []);
    const userAge = readNumber('moneypilot-user-age');
    const savingsGoals = readJson<SavingsGoal[]>('moneypilot-savings-goals', []);
    const plannedGoals = plannedGoalReserve([
      ...familyGoals.map(goal => ({ target: goal.target, currentSavings: goal.currentSavings ?? 0, monthlyContribution: goal.monthlyContribution, isPaused: goal.isPaused })),
      ...savingsGoals.map(goal => ({ target: goal.targetAmount, currentSavings: goal.currentSavings, targetDate: goal.targetDate, targetAge: goal.targetAge, type: goal.type, name: goal.name, monthlyPension: goal.monthlyPension, retirementAge: goal.retirementAge, lifeExpectancy: goal.lifeExpectancy })),
    ], userAge);
    const monthStart = `${selectedDate.slice(0, 7)}-01`;
    const actualGoalContributionsThisMonth = cashFlowSummary(transactions, monthStart, selectedDate).goalContributions;
    const goalsReserved = Math.max(0, plannedGoals - actualGoalContributionsThisMonth);

    const daysInPeriod = range === 'today' ? 1 : range === 'week' ? 7 : rangeDates.length;
    const monthlyExpenses = Math.round((total / Math.max(1, daysInPeriod)) * 30);
    const annualExpenses = monthlyExpenses * 12;
    const simpleForecast = Math.round(annualExpenses * 1.15);
    const simpleForecastPoints = Array.from({ length: 5 }, (_, index) => ({
      year: index + 1,
      value: Math.round(annualExpenses * 1.15 ** (index + 1)),
    }));

    const goalPlans = getGoalPlans(familyGoals, savingsGoals, userAge, getLocalToday());
    const goalsTarget = goalPlans.reduce((sum, goal) => sum + goal.target, 0);
    const goalsCurrent = goalPlans.reduce((sum, goal) => sum + goal.current, 0);
    const goalsPlannedMonthly = goalPlans.reduce((sum, goal) => sum + goal.plannedMonthly, 0);
    const goalsActualThisMonth = goalPlans.reduce((sum, goal) => sum + goal.actualThisMonth, 0);
    const goalsActualMonthly = goalPlans.reduce((sum, goal) => sum + goal.actualMonthly, 0);
    const goalsProgress = goalsTarget > 0 ? Math.min(100, Math.round((goalsCurrent / goalsTarget) * 100)) : null;
    const goalForecastPoints = (goals: GoalPlan[], monthly: number) => getGoalForecastMonths(goals).map(months => {
      const totalPlanned = goals.reduce((sum, goal) => sum + goal.plannedMonthly, 0);
      return { year: Math.ceil(months / 12), label: formatMonthsLabel(months), value: goals.reduce((sum, goal) => sum + Math.min(goal.target, goal.current + monthly * months * (goal.plannedMonthly > 0 ? goal.plannedMonthly / Math.max(1, totalPlanned) : 0)), 0) };
    });
    const factForecastPoints = (goals: GoalPlan[]) => goals.length ? getGoalForecastMonths(goals).map(months => {
      return { year: Math.ceil(months / 12), label: formatMonthsLabel(months), value: goals.reduce((sum, goal) => sum + Math.min(goal.target, goal.current + goal.actualMonthly * months), 0) };
    }) : [];
    const familyGoalPlans = goalPlans.filter(goal => goal.kind === 'family');
    const personalGoalPlans = goalPlans.filter(goal => goal.kind !== 'family');
    const familyGoalSummary = summarizeGoals(familyGoalPlans);
    const personalGoalSummary = summarizeGoals(personalGoalPlans);

    return {
      habits: sortedCategories.map(([name, amount], index) => ({
        name,
        amount,
        insight:
          index === 0
            ? 'Самая дорогая категория'
            : index === 1
            ? 'Второй по расходам'
            : 'Третья по расходам',
      })),
      categories: sortedCategories.map(([name, amount], index) => ({ name, amount, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] })),
      history: [...filteredPurchases].sort((a, b) => b.date.localeCompare(a.date)),
      total,
      income,
       actualIncome: cashFlow.income,
       cashFlow,
       openingBalance,
       closingBalance,
        plannedPayments,
        plannedGoals,
        goalsReserved,
        plannedIncome,
        forecastClosingBalance: closingBalance + plannedIncome - plannedPayments - goalsReserved,
       periodTransactions,
       estimatedBalance: income === null ? null : income - monthlyExpenses,
      trend,
      expenseChartPath,
      simpleForecast,
       goalPlans,
       goalsProgress,
       goalsTarget,
       goalsCurrent,
       goalsPlannedMonthly,
       goalsActualThisMonth,
       goalsActualMonthly,
      monthlyExpenses,
      annualExpenses,
       simpleForecastPoints,
       familyPlanForecastPoints: goalForecastPoints(familyGoalPlans, familyGoalPlans.reduce((sum, goal) => sum + goal.plannedMonthly, 0)),
       familyFactForecastPoints: factForecastPoints(familyGoalPlans),
       personalPlanForecastPoints: goalForecastPoints(personalGoalPlans, personalGoalPlans.reduce((sum, goal) => sum + goal.plannedMonthly, 0)),
       personalFactForecastPoints: factForecastPoints(personalGoalPlans),
       familyGoalPlans,
       personalGoalPlans,
       familyGoalSummary,
       personalGoalSummary,
    };
  }, [filteredPurchases, purchases, range, rangeDates, selectedDate, transactions]);

  return (
    <div className={`page-grid ${visible ? 'visible' : ''}`}>
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Аналитика</p>
          <h3>Реальный dashboard с живыми показателями</h3>
          <p>Вместо скучных диаграмм — динамические выводы и понятные тренды.</p>
        </div>
      </section>

      <section className="metrics-grid analytics-grid">
        {analytics ? (
          analytics.habits.map(item => (
            <article key={item.name} className="card reveal-card">
              <p className="eyebrow">{item.insight}</p>
              <h4>{item.name}</h4>
              <strong>{formatCurrency(item.amount)}</strong>
              <div className="bar-track">
                <span style={{ width: `${Math.min(100, (item.amount / analytics.total) * 100)}%` }} />
              </div>
            </article>
          ))
        ) : (
          <article className="card reveal-card empty-card">
            <p className="eyebrow">Аналитика</p>
            <h4>Данные отсутствуют</h4>
            <p>Добавьте первые транзакции в дашборде, чтобы увидеть отчеты и тренды.</p>
          </article>
        )}
      </section>

      <section className="analytics-totals" aria-label="Сводка поступлений и расходов">
        <article className="card total-card income">
          <span>Поступления за период</span>
          <strong>{analytics ? formatCurrency(analytics.actualIncome) : formatCurrency(0)}</strong>
          <p>{analytics?.actualIncome ? 'Только фактически полученные поступления.' : 'Добавьте полученное поступление в настройках.'}</p>
        </article>
        <article className="card total-card expenses">
          <span>Исходящий поток за период</span>
          <strong>{analytics ? formatCurrency(analytics.cashFlow.expenses + analytics.cashFlow.goalContributions) : formatCurrency(0)}</strong>
          <p>Расходы {formatCurrency(analytics?.cashFlow.expenses ?? 0)} + цели {formatCurrency(analytics?.cashFlow.goalContributions ?? 0)}.</p>
        </article>
        <article className="card total-card">
          <span>Сценарий бюджета на месяц</span>
          <strong>{configuredIncome === null ? 'Нет данных' : formatCurrency(configuredIncome - (analytics?.monthlyExpenses ?? 0))}</strong>
          <p>{configuredIncome === null ? 'Укажите ориентир дохода для сценария.' : `Ориентир дохода минус средние расходы ${formatCurrency(analytics?.monthlyExpenses ?? 0)}/мес. Это не факт.`}</p>
        </article>
      </section>

      <section className="period-summary">
        <p>Период данных: <strong>{range === 'today' ? 'Сегодня' : range === 'week' ? 'Неделя' : 'Месяц'}</strong>, выбранная дата <strong>{selectedDate}</strong>.</p>
      </section>

      {analytics && (
        <section className="content-grid">
          <div className="card large reveal-card">
            <div className="card-head"><div><h2>Денежный поток: факт</h2><p className="settings-note">Только завершённые операции за выбранный период.</p></div></div>
            <div className="settings-list">
              <div className="settings-row"><span>Остаток на начало периода</span><strong>{formatCurrency(analytics.openingBalance)}</strong></div>
              <div className="settings-row"><span>Поступления</span><strong>+{formatCurrency(analytics.cashFlow.income)}</strong></div>
              <div className="settings-row"><span>Потребительские расходы</span><strong>−{formatCurrency(analytics.cashFlow.expenses)}</strong></div>
              <div className="settings-row"><span>Пополнения целей</span><strong>−{formatCurrency(analytics.cashFlow.goalContributions)}</strong></div>
              <div className="settings-row"><span>Переводы между счетами</span><strong>{formatCurrency(analytics.cashFlow.transfersIn)} ↔ {formatCurrency(analytics.cashFlow.transfersOut)}</strong></div>
              <div className="settings-row"><strong>Чистый поток</strong><strong>{analytics.cashFlow.netCashFlow >= 0 ? '+' : '−'}{formatCurrency(Math.abs(analytics.cashFlow.netCashFlow))}</strong></div>
              <div className="settings-row"><strong>Остаток на конец периода</strong><strong>{formatCurrency(analytics.closingBalance)}</strong></div>
            </div>
          </div>
          <div className="card large reveal-card">
            <div className="card-head"><div><h2>План и резервы месяца</h2><p className="settings-note">Подтверждённые ожидаемые поступления, все месячные обязательства и невнесённые взносы в цели.</p></div></div>
            <div className="settings-list">
              <div className="settings-row"><span>Текущий остаток</span><strong>{formatCurrency(analytics.closingBalance)}</strong></div>
              <div className="settings-row"><span>Ожидаемые поступления</span><strong>+{formatCurrency(analytics.plannedIncome)}</strong></div>
              <div className="settings-row"><span>Обязательные платежи</span><strong>−{formatCurrency(analytics.plannedPayments)}</strong></div>
              <div className="settings-row"><span>Резерв личных и семейных целей</span><strong>−{formatCurrency(analytics.goalsReserved)}</strong></div>
              <div className="settings-row"><strong>Прогнозный остаток</strong><strong>{formatCurrency(analytics.forecastClosingBalance)}</strong></div>
            </div>
          </div>
        </section>
      )}

      {analytics && (
        <section className="content-grid">
          <div className="card large reveal-card">
            <h2>Структура расходов</h2>
            <p className="settings-note">Круговая диаграмма по категориям за выбранный период.</p>
            <PieChart categories={analytics.categories} total={analytics.total} />
          </div>
          <div className="card large reveal-card">
            <div className="card-head"><h2>Журнал денежных потоков</h2><span>{analytics.periodTransactions.length} операций</span></div>
            <div className="expense-history" tabIndex={0} aria-label="Журнал денежных потоков">
              <table>
                <thead><tr><th>Дата</th><th>Операция</th><th>Тип</th><th>Сумма</th></tr></thead>
                <tbody>{analytics.periodTransactions.map(item => <tr key={item.id}><td>{formatDate(item.date)}</td><td>{item.title}</td><td>{transactionLabel(item)}</td><td>{item.type === 'income' ? '+' : item.type === 'transfer' ? '↔' : '−'}{formatCurrency(item.amount)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="content-grid">
        <div className="card large reveal-card">
          <h4>Тренд расходов</h4>
          {analytics ? (
            <>
              <svg viewBox="0 0 300 120" className="line-chart" role="img" aria-label="Тренд расходов за выбранный период">
                <path d={analytics.expenseChartPath} />
              </svg>
              <p>За выбранный период расходы {analytics.trend >= 0 ? 'увеличились' : 'уменьшились'} на <strong>{Math.abs(analytics.trend)}%</strong>.</p>
            </>
          ) : (
            <p>{purchases.length ? 'В выбранном периоде нет расходов. Измените дату или диапазон в дашборде.' : 'Добавьте первые транзакции в дашборде, чтобы увидеть аналитику.'}</p>
          )}
        </div>
        <div className="card large reveal-card">
          <h4>Финансовый прогноз</h4>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            <button
              className={`chip ${forecastType === 'simple' ? 'active' : ''}`}
              onClick={() => setForecastType('simple')}
            >
              Расходы
            </button>
            <button
              className={`chip ${forecastType === 'family-goals' ? 'active' : ''}`}
              onClick={() => setForecastType('family-goals')}
            >
              Семейные цели
            </button>
            <button className={`chip ${forecastType === 'personal-goals' ? 'active' : ''}`} onClick={() => setForecastType('personal-goals')}>Личные цели</button>
          </div>
          {analytics ? (
            <>
              {forecastType === 'simple' && (
                <>
                   <p>Прогноз, не факт: средние расходы выбранного периода, пересчитанные на год, с допущением роста 15% в год.</p>
                  <div className="forecast-box">
                    <p>Через год</p>
                    <strong>{formatCurrency(analytics.simpleForecast)}</strong>
                    <span>ожидаемые расходы за год</span>
                    <p style={{ marginTop: 8, color: '#84f4c0' }}>
                      +{formatCurrency(analytics.simpleForecast - analytics.annualExpenses)} к текущему годовому темпу
                    </p>
                  </div>
                  <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#8aa2ca' }}>
                    Средние расходы: {formatCurrency(analytics.monthlyExpenses)}/мес
                  </p>
                  <ForecastChart points={analytics.simpleForecastPoints} label="Прогноз годовых расходов на пять лет" />
                </>
              )}
              {forecastType === 'family-goals' && <GoalForecast title="Семейные цели" goals={analytics.familyGoalPlans} summary={analytics.familyGoalSummary} planPoints={analytics.familyPlanForecastPoints} factPoints={analytics.familyFactForecastPoints} />}
              {forecastType === 'personal-goals' && <GoalForecast title="Личные и пенсионные цели" goals={analytics.personalGoalPlans} summary={analytics.personalGoalSummary} planPoints={analytics.personalPlanForecastPoints} factPoints={analytics.personalFactForecastPoints} />}
            </>
          ) : (
            <p>Пока нет прогноза — добавьте первые расходы.</p>
          )}
        </div>
      </section>
    </div>
  );
}
