import { FormEvent, useEffect, useMemo, useState } from 'react';

type RangeKey = 'today' | 'week' | 'month';

type Purchase = {
  title: string;
  amount: number;
  category: string;
};

const defaultBudget = 118000;
const defaultDaysToSalary = 18;

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

function getBaseBudget() {
  if (typeof window === 'undefined') return defaultBudget;
  const raw = window.localStorage.getItem('moneypilot-budget');
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : defaultBudget;
}

function getDaysToSalary() {
  if (typeof window === 'undefined') return defaultDaysToSalary;
  const raw = window.localStorage.getItem('moneypilot-daysToSalary');
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : defaultDaysToSalary;
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function DashboardPage() {
  const [purchases, setPurchases] = useState<Purchase[]>(() => readPurchases());
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [range, setRange] = useState<RangeKey>('week');

  useEffect(() => {
    window.localStorage.setItem('moneypilot-purchases', JSON.stringify(purchases));
  }, [purchases]);

  const baseBudget = getBaseBudget();
  const daysToSalary = getDaysToSalary();
  const totalSpent = useMemo(() => purchases.reduce((sum, item) => sum + item.amount, 0), [purchases]);
  const remainingBudget = baseBudget - totalSpent;
  const dailyBudget = daysToSalary > 0 ? Math.max(0, remainingBudget / daysToSalary) : 0;
  const healthScore = purchases.length > 0 ? Math.max(45, Math.min(98, 92 - Math.round(totalSpent / 1800))) : 92;
  const healthTone = healthScore >= 80 ? 'Отлично' : healthScore >= 65 ? 'Внимание' : 'Критично';
  const lastPurchase = purchases[purchases.length - 1];
  const averagePurchase = purchases.length ? Math.round(totalSpent / purchases.length) : 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    setPurchases(prev => [...prev, { title: title.trim(), amount: parsedAmount, category: 'Разное' }]);
    setTitle('');
    setAmount('');
  };

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Здравствуйте</p>
          <h3>Начните с чистого счёта</h3>
          <p>Добавьте свои первые расходы и получите актуальный прогноз по бюджету.</p>
        </div>
        <div className="hero-badge">✨ Данные обнулены</div>
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

      <section className="metrics-grid">
        <article className="metric-card primary">
          <span>До зарплаты</span>
          <strong>{daysToSalary} дней</strong>
          <div className="spark-line">
            <span style={{ width: '70%' }} />
            <span style={{ width: '45%' }} />
            <span style={{ width: '90%' }} />
          </div>
        </article>
        <article className="metric-card">
          <span>Можно тратить сегодня</span>
          <strong>{formatCurrency(Math.round(dailyBudget))}</strong>
          <div className="mini-pill">+8% к среднему</div>
        </article>
        <article className="metric-card">
          <span>Уже потрачено</span>
          <strong>{formatCurrency(totalSpent)}</strong>
          <div className="mini-pill warning">13% выше нормы</div>
        </article>
        <article className="metric-card">
          <span>Остаток лимита</span>
          <strong>{formatCurrency(remainingBudget)}</strong>
          <div className="mini-pill good">+12 400 ₽ к цели</div>
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
              <path d="M0 110 C40 92, 60 82, 90 88 S150 95, 180 72 S240 48, 320 22" />
              <circle cx="180" cy="72" r="5" />
              <circle cx="320" cy="22" r="5" />
            </svg>
            <div className="chart-tooltip">{purchases.length ? `+12 400 ₽ за ${range === 'today' ? 'сегодня' : range === 'week' ? 'неделю' : 'месяц'}` : 'Добавьте первую покупку для прогноза'}</div>
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
            <p className="eyebrow">Что можно купить?</p>
            <h4>iPhone · 120 000 ₽</h4>
            <p>Не сейчас. После такой покупки свободных денег останется только {formatCurrency(Math.max(0, remainingBudget - 120000))}.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
