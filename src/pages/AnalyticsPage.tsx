import { useEffect, useMemo, useState } from 'react';

type RangeKey = 'today' | 'week' | 'month';

type Purchase = {
  title: string;
  amount: number;
  category: string;
  date: string;
};

type FamilyMember = {
  id: string;
  name: string;
  role: string;
  contribute: number;
  color: string;
};

type FamilyGoal = {
  id: string;
  title: string;
  target: number;
};

type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  targetAge: number;
  currentSavings: number;
};

type ForecastType = 'simple' | 'goals' | 'retirement';

type ForecastPoint = {
  year: number;
  value: number;
};

function readPurchases() {
  if (typeof window === 'undefined') return [] as Purchase[];
  const raw = window.localStorage.getItem('moneypilot-purchases');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Purchase[];
  } catch {
    return [];
  }
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

function buildLinePath(points: ForecastPoint[]) {
  const maxValue = Math.max(...points.map(point => point.value), 1);
  return points.map((point, index) => {
    const x = 18 + index * (264 / Math.max(points.length - 1, 1));
    const y = 108 - Math.round((point.value / maxValue) * 82);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ');
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
          return <circle key={point.year} cx={x} cy={y} r="4" />;
        })}
      </svg>
      <div className="forecast-chart-labels">
        {points.map(point => <span key={point.year}>{point.year} г.</span>)}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{points.map(point => <tr key={point.year}><th scope="row">Через {point.year} г.</th><td>{formatCurrency(point.value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function AnalyticsPage() {
  const [visible, setVisible] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [range, setRange] = useState<RangeKey>('week');
  const [selectedDate, setSelectedDate] = useState(getSavedSelectedDate());
  const [forecastType, setForecastType] = useState<ForecastType>('simple');

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 80);
    setPurchases(readPurchases());
    setRange(getSavedRange());
    setSelectedDate(getSavedSelectedDate());

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'moneypilot-range') setRange(getSavedRange());
      if (event.key === 'moneypilot-selectedDate') setSelectedDate(getSavedSelectedDate());
      if (event.key === 'moneypilot-purchases') setPurchases(readPurchases());
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

  const analytics = useMemo(() => {
    if (!filteredPurchases.length) return null;
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

    const budget = readNumber('moneypilot-budget') ?? 0;
    const savings = readNumber('moneypilot-savings') ?? 0;
    const members = readJson<FamilyMember[]>('moneypilot-family-members', []);
    const familyGoals = readJson<FamilyGoal[]>('moneypilot-family-goals', []);
    const userAge = readNumber('moneypilot-user-age');
    const savingsGoals = readJson<SavingsGoal[]>('moneypilot-savings-goals', []);

    const daysInPeriod = range === 'today' ? 1 : range === 'week' ? 7 : rangeDates.length;
    const monthlyExpenses = Math.round((total / Math.max(1, daysInPeriod)) * 30);
    const annualExpenses = monthlyExpenses * 12;
    const simpleForecast = Math.round(annualExpenses * 1.15);
    const simpleForecastPoints = Array.from({ length: 5 }, (_, index) => ({
      year: index + 1,
      value: Math.round(annualExpenses * 1.15 ** (index + 1)),
    }));

    const totalFamilyTarget = familyGoals.reduce((sum, g) => sum + g.target, 0);
    const familyAvailable = members.reduce((sum, member) => sum + (member.role === 'Расход' ? -member.contribute : member.contribute), 0);
    const currentGoalSavings = savings + Math.max(0, familyAvailable);
    const monthlySavings = Math.max(0, budget - monthlyExpenses);
    const goalsForecast = currentGoalSavings + monthlySavings * 12;
    const goalsProgress = totalFamilyTarget > 0
      ? Math.min(100, Math.round((goalsForecast / totalFamilyTarget) * 100))
      : null;
    const goalsForecastPoints = Array.from({ length: 5 }, (_, index) => ({
      year: index + 1,
      value: currentGoalSavings + monthlySavings * 12 * (index + 1),
    }));

    let retirementForecast: number | null = null;
    let retirementMonthly: number | null = null;
    let retirementForecastPoints: ForecastPoint[] = [];
    if (userAge && savingsGoals.length > 0) {
      const retirementPlans = savingsGoals.map(goal => {
        const monthsLeft = Math.max(1, (goal.targetAge - userAge) * 12);
        const remaining = Math.max(0, goal.targetAmount - goal.currentSavings);
        return { ...goal, monthsLeft, monthly: Math.ceil(remaining / monthsLeft) };
      });
      retirementMonthly = retirementPlans.reduce((sum, goal) => sum + goal.monthly, 0);
      retirementForecastPoints = Array.from({ length: 5 }, (_, index) => {
        const months = (index + 1) * 12;
        return {
          year: index + 1,
          value: retirementPlans.reduce((sum, goal) => (
            sum + Math.min(goal.targetAmount, goal.currentSavings + goal.monthly * Math.min(months, goal.monthsLeft))
          ), 0),
        };
      });
      retirementForecast = retirementForecastPoints[0].value;
    }

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
      total,
      trend,
      expenseChartPath,
      simpleForecast,
      goalsForecast,
      goalsProgress,
      retirementForecast,
      retirementMonthly,
      monthlyExpenses,
      annualExpenses,
      monthlySavings,
      currentGoalSavings,
      totalFamilyTarget,
      simpleForecastPoints,
      goalsForecastPoints,
      retirementForecastPoints,
    };
  }, [filteredPurchases, purchases, range, rangeDates]);

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

      <section className="period-summary">
        <p>Период данных: <strong>{range === 'today' ? 'Сегодня' : range === 'week' ? 'Неделя' : 'Месяц'}</strong>, выбранная дата <strong>{selectedDate}</strong>.</p>
      </section>

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
              Простой
            </button>
            <button
              className={`chip ${forecastType === 'goals' ? 'active' : ''}`}
              onClick={() => setForecastType('goals')}
            >
              С целями
            </button>
            <button
              className={`chip ${forecastType === 'retirement' ? 'active' : ''}`}
              onClick={() => setForecastType('retirement')}
            >
              Пенсионный
            </button>
          </div>
          {analytics ? (
            <>
              {forecastType === 'simple' && (
                <>
                  <p>Годовые расходы при сохранении текущего темпа и росте на 15% в год:</p>
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
              {forecastType === 'goals' && (
                <>
                  <p>Прогноз накоплений из остатка ежемесячного бюджета:</p>
                  <div className="forecast-box">
                    <p>Через год</p>
                    <strong>{formatCurrency(analytics.goalsForecast)}</strong>
                    <span>прогноз накоплений</span>
                    {analytics.goalsProgress !== null && (
                      <p style={{ marginTop: 8, color: '#84f4c0' }}>
                        Прогресс семейных целей: {analytics.goalsProgress}%
                      </p>
                    )}
                  </div>
                  <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#8aa2ca' }}>
                    Уже накоплено: {formatCurrency(analytics.currentGoalSavings)} · доступно для накоплений: {formatCurrency(analytics.monthlySavings)}/мес
                  </p>
                  {analytics.totalFamilyTarget > 0 && (
                    <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#8aa2ca' }}>
                      Семейные цели: {formatCurrency(analytics.totalFamilyTarget)}
                    </p>
                  )}
                  <ForecastChart points={analytics.goalsForecastPoints} label="Прогноз накоплений на пять лет" />
                </>
              )}
              {forecastType === 'retirement' && (
                <>
                  <p>Пенсионный прогноз:</p>
                  <div className="forecast-box">
                    <p>Через год</p>
                    <strong>{analytics.retirementForecast === null ? 'Нет данных' : formatCurrency(analytics.retirementForecast)}</strong>
                    <span>прогноз накоплений по целям</span>
                    {analytics.retirementMonthly !== null && (
                      <p style={{ marginTop: 8, color: '#84f4c0' }}>
                        Нужно откладывать: {formatCurrency(analytics.retirementMonthly)}/мес
                      </p>
                    )}
                  </div>
                  <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#8aa2ca' }}>
                    {analytics.retirementMonthly !== null
                      ? 'Ежемесячный взнос рассчитан отдельно для каждой цели с её сроком.'
                      : 'Добавьте цели накоплений и укажите возраст для точного расчёта'}
                  </p>
                  {analytics.retirementForecastPoints.length > 0 && (
                    <ForecastChart points={analytics.retirementForecastPoints} label="Прогноз накоплений по целям на пять лет" />
                  )}
                </>
              )}
            </>
          ) : (
            <p>Пока нет прогноза — добавьте первые расходы.</p>
          )}
        </div>
      </section>
    </div>
  );
}
