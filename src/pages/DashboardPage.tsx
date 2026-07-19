import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type RangeKey = 'today' | 'week' | 'month';

type Purchase = {
  title: string;
  amount: number;
  category: string;
  date: string;
};

function readPurchases() {
  if (typeof window === 'undefined') return [] as Purchase[];
  const raw = window.localStorage.getItem('moneypilot-purchases');
  if (!raw) return [];
  try {
    const saved = JSON.parse(raw) as Purchase[];
    return saved.map(item => ({
      ...item,
      date: item.date || new Date().toISOString().slice(0, 10),
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

function getDaysToSalary() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('moneypilot-daysToSalary');
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getSavedRange() {
  if (typeof window === 'undefined') return 'week' as RangeKey;
  const raw = window.localStorage.getItem('moneypilot-range');
  return raw === 'today' || raw === 'week' || raw === 'month' ? raw : 'week';
}

function getSavedSelectedDate() {
  if (typeof window === 'undefined') return getToday();
  const raw = window.localStorage.getItem('moneypilot-selectedDate');
  return raw || getToday();
}

function getSavedSavings() {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem('moneypilot-savings');
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function normalizeDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
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
  return new Date().toISOString().slice(0, 10);
}

function getSavedSuggestion() {
  if (typeof window === 'undefined') return { name: 'iPhone', price: 120000 };
  const raw = window.localStorage.getItem('moneypilot-suggestedItem');
  if (!raw) return { name: 'iPhone', price: 120000 };
  try {
    const parsed = JSON.parse(raw) as { name: string; price: number };
    return {
      name: parsed.name || 'iPhone',
      price: Number.isFinite(parsed.price) && parsed.price > 0 ? parsed.price : 120000,
    };
  } catch {
    return { name: 'iPhone', price: 120000 };
  }
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function DashboardPage() {
  const [purchases, setPurchases] = useState<Purchase[]>(() => readPurchases());
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getToday());
  const [range, setRange] = useState<RangeKey>(() => getSavedRange());
  const [selectedDate, setSelectedDate] = useState(() => getSavedSelectedDate());
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
  const daysToSalary = getDaysToSalary();
  const rangeDates = useMemo(() => getRangeDates(selectedDate, range), [selectedDate, range]);
  const filteredPurchases = useMemo(
    () => purchases.filter(item => rangeDates.includes(item.date)),
    [purchases, rangeDates],
  );
  const totalSpent = useMemo(() => filteredPurchases.reduce((sum, item) => sum + item.amount, 0), [filteredPurchases]);
  const remainingBudget = baseBudget !== null ? baseBudget - totalSpent : 0;
  const dailyBudget = baseBudget !== null && daysToSalary !== null ? Math.max(0, remainingBudget / daysToSalary) : 0;
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
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    setPurchases(prev => [...prev, {
      title: title.trim(),
      amount: parsedAmount,
      category: 'Разное',
      date: normalizeDate(date),
    }] );
    setTitle('');
    setAmount('');
  };


  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Здравствуйте</p>
          <h3>Настройте стартовые данные</h3>
          <p>Установите бюджет и дни до зарплаты на странице настроек, чтобы расчёты были точными.</p>
        </div>
        <div className="hero-badge">✨ Все данные берутся из настроек</div>
      </section>

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

      <section className="calendar-panel">
        <div className="calendar-head">
          <span>Календарь</span>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
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
          <span>До зарплаты</span>
          <strong>{daysToSalary !== null ? `${daysToSalary} дней` : 'Не задано'}</strong>
          <div className="spark-line">
            <span style={{ width: '70%' }} />
            <span style={{ width: '45%' }} />
            <span style={{ width: '90%' }} />
          </div>
        </article>
        <article className="metric-card">
          <span>Можно тратить сегодня</span>
          <strong>{baseBudget !== null && daysToSalary !== null ? formatCurrency(Math.round(dailyBudget)) : 'Настройте данные'}</strong>
          <div className="mini-pill">{baseBudget !== null ? '+8% к среднему' : 'Через настройки'}</div>
        </article>
        <article className="metric-card">
          <span>Уже потрачено</span>
          <strong>{formatCurrency(totalSpent)}</strong>
          <div className="mini-pill warning">{purchases.length ? '13% выше нормы' : 'Нет расходов'}</div>
        </article>
        <article className="metric-card">
          <span>Остаток лимита</span>
          <strong>{baseBudget !== null ? formatCurrency(remainingBudget) : 'Настройте данные'}</strong>
          <div className="mini-pill good">{baseBudget !== null ? '+12 400 ₽ к цели' : 'Через настройки'}</div>
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
            <h4>Динамика баланса</h4>
            <span>{range === 'today' ? 'Сегодня' : range === 'week' ? 'Неделя' : 'Месяц'}</span>
          </div>
          <div className="chart-wrapper">
            <svg viewBox="0 0 320 140" className="real-chart" role="img" aria-label="График баланса">
              <path d={chartPath} />
              {chartPoints.map((point, index) => {
                const x = 10 + index * (300 / Math.max(chartPoints.length - 1, 1));
                const values = chartPoints.map(item => item.total);
                const maxValue = Math.max(...values, 40);
                const y = 125 - Math.round((point.total / maxValue) * 100);
                return <circle key={point.date} cx={x} cy={y} r={4} />;
              })}
            </svg>
            <div className="chart-tooltip">
              {baseBudget !== null && daysToSalary !== null
                ? (filteredPurchases.length
                  ? `Итого ${formatCurrency(totalSpent)} за выбранный период`
                  : 'Добавьте расходы в выбранный диапазон')
                : 'Установите бюджет и дни до зарплаты в настройках'}
            </div>
          </div>
        </div>

        <div className="card large">
          <h4>ИИ-сообщение</h4>
          <p>
            {lastPurchase
              ? `${lastPurchase.title} уже ${purchases.filter(item => item.title === lastPurchase.title).length}-я покупка в месяце. Средний чек — ${formatCurrency(averagePurchase)}.`
              : 'Добавьте первую покупку.'}
          </p>
          <p>
            Если сегодня не покупать ничего лишнего, к концу месяца останется около <strong>{formatCurrency(25000 + remainingBudget)}</strong>.
          </p>
          <form className="inline-form" onSubmit={handleSubmit}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Что купили?" />
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Сумма" type="number" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <button type="submit">Добавить</button>
          </form>
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
            <p className="eyebrow">Что можно купить?</p>
            <h4>{suggestion.name} · {formatCurrency(suggestion.price)}</h4>
            <p>После такой покупки свободных денег останется {formatCurrency(Math.max(0, remainingBudget - suggestion.price))}.</p>
            <p className="settings-note">Измените это предложение в <Link to="/settings">Настройках</Link>.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
