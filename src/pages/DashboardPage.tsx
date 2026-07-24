import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type RangeKey = 'today' | 'week' | 'month';

type Purchase = {
  title: string;
  amount: number;
  category: string;
  date: string;
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

function readPurchases() {
  if (typeof window === 'undefined') return [] as Purchase[];
  const raw = window.localStorage.getItem('moneypilot-purchases');
  if (!raw) return [];
  try {
    const saved = JSON.parse(raw) as Purchase[];
    return saved.map(item => ({
      ...item,
      date: item.date || getToday(),
    }));
  } catch {
    return [];
  }
}

function getBaseBudget() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('moneypilot-budget');
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readIncomeEvents() {
  if (typeof window === 'undefined') return [] as IncomeEvent[];
  const raw = window.localStorage.getItem('moneypilot-income-events');
  if (!raw) return [];
  try { return JSON.parse(raw) as IncomeEvent[]; }
  catch { return []; }
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

function getSavedSavings() {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem('moneypilot-savings');
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : 0;
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
    if (date < base) date.setMonth(date.getMonth() + 1);
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
  const [purchases, setPurchases] = useState<Purchase[]>(() => readPurchases());
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CategoryKey>('Разное');
  const [date, setDate] = useState(getToday());
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [range, setRange] = useState<RangeKey>(() => getSavedRange());
  const [selectedDate, setSelectedDate] = useState(() => getSavedSelectedDate());
  const [includeLikelyIncome, setIncludeLikelyIncome] = useState(false);
  const suggestion = getSavedSuggestion();
  const savings = getSavedSavings();

  useEffect(() => {
    window.localStorage.setItem('moneypilot-purchases', JSON.stringify(purchases));
  }, [purchases]);

  useEffect(() => {
    window.localStorage.setItem('moneypilot-range', range);
    window.localStorage.setItem('moneypilot-selectedDate', selectedDate);
  }, [range, selectedDate]);


  const baseBudget = getBaseBudget();
  const incomeEvents = readIncomeEvents();
  const nextIncome = useMemo(() => getNextIncome(incomeEvents, selectedDate, includeLikelyIncome), [incomeEvents, selectedDate, includeLikelyIncome]);
  const daysToIncome = nextIncome ? daysBetween(selectedDate, nextIncome.date) : null;
  const rangeDates = useMemo(() => getRangeDates(selectedDate, range), [selectedDate, range]);
  const filteredPurchases = useMemo(
    () => purchases.filter(item => rangeDates.includes(item.date)),
    [purchases, rangeDates],
  );
  const totalSpent = useMemo(() => filteredPurchases.reduce((sum, item) => sum + item.amount, 0), [filteredPurchases]);
  const monthKey = selectedDate.slice(0, 7);
  const monthSpent = useMemo(() => purchases.filter(item => item.date.startsWith(monthKey) && item.date <= selectedDate).reduce((sum, item) => sum + item.amount, 0), [purchases, monthKey, selectedDate]);
  const receivedIncome = useMemo(() => incomeEvents.filter(event => event.status === 'received' && event.date.startsWith(monthKey) && event.date <= selectedDate).reduce((sum, event) => sum + event.amount, 0), [incomeEvents, monthKey, selectedDate]);
  const remainingBudget = baseBudget !== null ? baseBudget - monthSpent : 0;
  const availableCash = receivedIncome > 0 ? Math.max(0, receivedIncome - monthSpent) : null;
  const spendableBeforeIncome = Math.min(Math.max(0, remainingBudget), availableCash ?? Math.max(0, remainingBudget));
  const dailyBudget = baseBudget !== null && daysToIncome !== null ? spendableBeforeIncome / Math.max(1, daysToIncome) : 0;
  const healthScore = baseBudget !== null && filteredPurchases.length > 0 ? Math.max(45, Math.min(98, 92 - Math.round(totalSpent / 1800))) : 92;
  const healthTone = healthScore >= 80 ? 'Отлично' : healthScore >= 65 ? 'Внимание' : 'Критично';
  const lastPurchase = purchases[purchases.length - 1];
  const averagePurchase = filteredPurchases.length ? Math.round(totalSpent / filteredPurchases.length) : 0;
  const chartPoints = useMemo(() => buildChartPoints(rangeDates, purchases), [rangeDates, purchases]);
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
    setFormSuccess('');
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Укажите название покупки и сумму больше нуля.');
      return;
    }

    setPurchases(prev => [...prev, {
      title: title.trim(),
      amount: parsedAmount,
      category,
      date: normalizeDate(date),
    }] );
    setTitle('');
    setAmount('');
    setCategory('Разное');
    setFormSuccess('Расход добавлен в выбранную дату.');
  };


  return (
    <div className="page-grid">
      <section className="hero-panel dashboard-decision">
        <div className="hero-copy">
          <p className="eyebrow">Финансовый ориентир</p>
          <h2>{baseBudget !== null && nextIncome ? 'Можно потратить сегодня' : 'Добавьте ближайшее поступление'}</h2>
          {baseBudget !== null && nextIncome ? (
            <>
              <strong className="decision-amount">{formatCurrency(Math.round(dailyBudget))}</strong>
              <p>Следующее поступление: {nextIncome.source} · {formatCurrency(nextIncome.amount)} · {daysToIncome === 0 ? 'сегодня' : `через ${daysToIncome} дн.`}. Доступно из уже полученных денег: {formatCurrency(spendableBeforeIncome)}.</p>
            </>
          ) : (
            <p>Укажите месячный лимит и добавьте подтверждённое поступление в настройках, чтобы получить безопасный дневной ориентир.</p>
          )}
        </div>
        <Link className="hero-action" to="/settings">{baseBudget === null || !nextIncome ? 'Добавить поступление' : 'Изменить план'}</Link>
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
        <div className="calendar-range">
          {rangeDates.map(day => (
            <button
              key={day}
              type="button"
              className={`calendar-day ${day === selectedDate ? 'active' : ''}`}
              onClick={() => setSelectedDate(day)}
            >
              <span>{formatDateLabel(day)}</span>
              <small>{day === getToday() ? 'Сегодня' : ''}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card primary">
          <span>До следующего дохода</span>
          <strong>{nextIncome ? (daysToIncome === 0 ? 'Сегодня' : `${daysToIncome} дней`) : 'Нет поступлений'}</strong>
          <div className="spark-line">
            <span style={{ width: '70%' }} />
            <span style={{ width: '45%' }} />
            <span style={{ width: '90%' }} />
          </div>
        </article>
        <article className="metric-card">
          <span>Дневной ориентир</span>
          <strong>{baseBudget !== null && nextIncome ? formatCurrency(Math.round(dailyBudget)) : 'Настройте данные'}</strong>
          {baseBudget !== null && filteredPurchases.length > 0 ? (
            <div className="mini-pill">
              {(() => {
                const avgPerDay = totalSpent / Math.max(1, rangeDates.filter(d => d <= getToday()).length);
                const diff = Math.round(((dailyBudget - avgPerDay) / Math.max(1, avgPerDay)) * 100);
                return diff >= 0 ? `+${diff}% к среднему` : `${diff}% к среднему`;
              })()}
            </div>
          ) : (
            <div className="mini-pill">По полученным поступлениям</div>
          )}
        </article>
        <article className="metric-card">
          <span>Уже потрачено</span>
          <strong>{formatCurrency(totalSpent)}</strong>
          {baseBudget !== null && daysToIncome !== null && totalSpent > 0 ? (
            <div className="mini-pill warning">
              {(() => {
                const budgetForPeriod = (baseBudget / (Math.max(1, daysToIncome) + rangeDates.filter(d => d <= selectedDate).length)) * rangeDates.filter(d => d <= selectedDate).length;
                const pct = Math.round(((totalSpent - budgetForPeriod) / Math.max(1, budgetForPeriod)) * 100);
                return pct > 0 ? `${pct}% выше плана` : `${Math.abs(pct)}% ниже плана`;
              })()}
            </div>
          ) : (
            <div className="mini-pill">Нет расходов</div>
          )}
        </article>
        <article className="metric-card">
          <span>Доступно до дохода</span>
          <strong>{baseBudget !== null && nextIncome ? formatCurrency(spendableBeforeIncome) : 'Настройте данные'}</strong>
          {baseBudget !== null && nextIncome ? (
            <div className={`mini-pill ${spendableBeforeIncome > 0 ? 'good' : 'warning'}`}>
              {availableCash === null
                ? 'Нет полученных поступлений в этом месяце'
                : `${formatCurrency(spendableBeforeIncome)} до следующего дохода`
              }
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
      </section>

      <section className="content-grid">
          <div className="card large chart-card">
            <div className="card-head">
            <h2>Расходы по дням</h2>
            <span>{range === 'today' ? 'Сегодня' : range === 'week' ? 'Неделя' : 'Месяц'}</span>
          </div>
          <div className="chart-wrapper">
            <svg viewBox="0 0 320 140" className="real-chart" role="img" aria-label="График расходов по дням">
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
              <caption>Расходы по дням за выбранный период</caption>
              <tbody>{chartPoints.map(point => <tr key={point.date}><th scope="row">{formatDateLabel(point.date)}</th><td>{formatCurrency(point.total)}</td></tr>)}</tbody>
            </table>
            <div className="chart-tooltip">
              {baseBudget !== null && nextIncome
                ? (filteredPurchases.length
                  ? `Итого ${formatCurrency(totalSpent)} за выбранный период`
                  : 'Добавьте расходы в выбранный диапазон')
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
          <p>
            {baseBudget !== null && nextIncome
              ? <>До следующего поступления безопасно использовать не больше <strong>{formatCurrency(spendableBeforeIncome)}</strong> из уже полученных денег.</>
              : 'Установите лимит и добавьте поступление в настройках.'}
          </p>
          <form className="inline-form purchase-form" onSubmit={handleSubmit} noValidate>
            <label><span className="sr-only">Название покупки</span><input aria-invalid={Boolean(formError)} value={title} onChange={e => { setTitle(e.target.value); setCategory(detectCategory(e.target.value)); }} placeholder="Что купили?" /></label>
            <label><span className="sr-only">Сумма в рублях</span><input aria-invalid={Boolean(formError)} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Сумма, ₽" type="number" min="1" inputMode="decimal" /></label>
            <label><span className="sr-only">Категория</span><select value={category} onChange={e => setCategory(e.target.value as CategoryKey)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></label>
            <label><span className="sr-only">Дата расхода</span><input aria-label="Дата расхода" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <button type="submit">Добавить</button>
          </form>
          {formError && <p className="form-feedback error" role="alert">{formError}</p>}
          {formSuccess && <p className="form-feedback success" role="status">{formSuccess}</p>}
        </div>

        <div className="stack">
          <div className="card">
            <p className="eyebrow">Финансовое здоровье</p>
            <h4>{healthTone} — {healthScore}/100</h4>
            <ul>
              <li>Расходы под контролем</li>
              <li>Накопления растут</li>
              <li>Осталось до конца месяца меньше, чем обычно</li>
            </ul>
          </div>

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
                <p>После такой покупки свободных денег останется {formatCurrency(Math.max(0, remainingBudget - suggestion.price))}.</p>
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
