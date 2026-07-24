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
  type?: string;
  targetAmount: number;
  targetDate?: string;
  targetAge?: number;
  monthlyPension?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
  currentSavings: number;
};

type ForecastType = 'simple' | 'goals' | 'retirement';

type ForecastPoint = {
  year: number;
  value: number;
};

type CategoryTotal = {
  name: string;
  amount: number;
  color: string;
};

const CATEGORY_COLORS = ['#37c7ff', '#8b6dff', '#84f4c0', '#ffca7a', '#ff7f8f', '#64a4ff'];

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
    const now = new Date();
    const target = new Date(`${targetDate}T00:00:00`);
    const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
    return months > 0 ? months : null;
  }
  if (targetAge && userAge) {
    const months = (targetAge - userAge) * 12;
    return months > 0 ? months : null;
  }
  return null;
}

function getTargetAmount(goal: SavingsGoal) {
  const pension = getPensionDetails(goal);
  if (pension) return pension.monthlyPension * Math.max(0, pension.lifeExpectancy - pension.retirementAge) * 12;
  return goal.targetAmount;
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
  const configuredIncome = readNumber('moneypilot-income');

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
    const income = readNumber('moneypilot-income');
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
    if (savingsGoals.length > 0) {
      const retirementPlans = savingsGoals.flatMap(goal => {
        const monthsLeft = getMonthsUntil(goal, userAge);
        if (!monthsLeft) return [];
        const targetAmount = getTargetAmount(goal);
        const remaining = Math.max(0, targetAmount - goal.currentSavings);
        return { ...goal, targetAmount, monthsLeft, monthly: Math.ceil(remaining / monthsLeft) };
      });
      if (retirementPlans.length > 0) {
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
      categories: sortedCategories.map(([name, amount], index) => ({ name, amount, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] })),
      history: [...filteredPurchases].sort((a, b) => b.date.localeCompare(a.date)),
      total,
      income,
      estimatedBalance: income === null ? null : income - monthlyExpenses,
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

      <section className="analytics-totals" aria-label="Сводка поступлений и расходов">
        <article className="card total-card income">
          <span>Поступления в месяц</span>
          <strong>{configuredIncome === null ? 'Не указаны' : formatCurrency(configuredIncome)}</strong>
          <p>Берутся из поля «Месячный доход» в настройках.</p>
        </article>
        <article className="card total-card expenses">
          <span>Расходы за период</span>
          <strong>{analytics ? formatCurrency(analytics.total) : formatCurrency(0)}</strong>
          <p>{range === 'today' ? 'Сегодня' : range === 'week' ? 'За выбранную неделю' : 'За выбранный месяц'}</p>
        </article>
        <article className="card total-card">
          <span>Остаток по месячному темпу</span>
          <strong>{configuredIncome === null ? 'Нет данных' : formatCurrency(configuredIncome - (analytics?.monthlyExpenses ?? 0))}</strong>
          <p>{configuredIncome === null ? 'Укажите доход для расчёта.' : `Доход минус расчётные расходы ${formatCurrency(analytics?.monthlyExpenses ?? 0)}/мес.`}</p>
        </article>
      </section>

      <section className="period-summary">
        <p>Период данных: <strong>{range === 'today' ? 'Сегодня' : range === 'week' ? 'Неделя' : 'Месяц'}</strong>, выбранная дата <strong>{selectedDate}</strong>.</p>
      </section>

      {analytics && (
        <section className="content-grid">
          <div className="card large reveal-card">
            <h2>Структура расходов</h2>
            <p className="settings-note">Круговая диаграмма по категориям за выбранный период.</p>
            <PieChart categories={analytics.categories} total={analytics.total} />
          </div>
          <div className="card large reveal-card">
            <div className="card-head"><h2>История расходов</h2><span>{analytics.history.length} операций</span></div>
            <div className="expense-history" tabIndex={0} aria-label="История расходов">
              <table>
                <thead><tr><th>Дата</th><th>Покупка</th><th>Категория</th><th>Сумма</th></tr></thead>
                <tbody>{analytics.history.map((item, index) => <tr key={`${item.date}-${item.title}-${index}`}><td>{formatDate(item.date)}</td><td>{item.title}</td><td>{item.category}</td><td>{formatCurrency(item.amount)}</td></tr>)}</tbody>
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
              По целям
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
                  <p>Прогноз по вашим целям накоплений:</p>
                  <div className="forecast-box">
                    <p>Через год</p>
                    <strong>{analytics.retirementForecast === null ? 'Нет данных' : formatCurrency(analytics.retirementForecast)}</strong>
                    <span>накопления по плану целей</span>
                    {analytics.retirementMonthly !== null && (
                      <p style={{ marginTop: 8, color: '#84f4c0' }}>
                        Нужно откладывать: {formatCurrency(analytics.retirementMonthly)}/мес
                      </p>
                    )}
                  </div>
                  <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#8aa2ca' }}>
                    {analytics.retirementMonthly !== null
                      ? 'Ежемесячный взнос рассчитан отдельно для каждой цели с её сроком.'
                      : 'Добавьте цели накоплений и укажите для них срок, чтобы увидеть расчёт'}
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
