import { useEffect, useMemo, useState } from 'react';

type Purchase = {
  title: string;
  amount: number;
  category: string;
  date: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readNumber(key: string): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function getLocalToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getMonthDates(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const dates: string[] = [];
  for (let i = 1; i <= days; i++) {
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }
  return dates;
}

type ScenarioResult = {
  key: string;
  label: string;
  monthlyDelta: number;
  description: string;
};

export default function GoalsPage() {
  const [activeScenario, setActiveScenario] = useState(0);
  const [savingsRate, setSavingsRate] = useState(20);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const data = useMemo(() => {
    const budget = readNumber('moneypilot-budget') ?? 0;
    const salaryDays = readNumber('moneypilot-daysToSalary') ?? 30;
    const savings = readNumber('moneypilot-savings') ?? 0;
    const purchases = readJson<Purchase[]>('moneypilot-purchases', []);
    const monthDates = getMonthDates();
    const today = getLocalToday();

    const daysPassed = monthDates.filter(d => d <= today).length || 1;
    const monthPurchases = purchases.filter(p => monthDates.includes(p.date));
    const totalSpent = monthPurchases.reduce((sum, p) => sum + p.amount, 0);
    const daysLeft = Math.max(0, salaryDays - daysPassed);

    const avgDailySpend = daysPassed > 0 ? totalSpent / daysPassed : 0;
    const projectedMonthEnd = avgDailySpend * salaryDays;
    const currentMonthlySavings = Math.max(0, budget - projectedMonthEnd);

    const cafeEstimate = totalSpent * 0.15;
    const subscriptionEstimate = 5000;

    return {
      budget,
      salaryDays,
      savings,
      totalSpent,
      currentMonthlySavings,
      cafeEstimate,
      subscriptionEstimate,
      daysLeft,
      projectedMonthEnd,
    };
  }, [tick]);

  const scenarios: ScenarioResult[] = useMemo(() => {
    const { budget, cafeEstimate, subscriptionEstimate } = data;

    return [
      {
        key: 'base',
        label: 'Если ничего не менять',
        monthlyDelta: 0,
        description: 'Текущий темп расходов без изменений.',
      },
      {
        key: 'cafe',
        label: 'Сократить кафе на 30%',
        monthlyDelta: Math.round(cafeEstimate * 0.3),
        description: `Экономия ${formatCurrency(Math.round(cafeEstimate * 0.3))}/мес при сокращении кафе.`,
      },
      {
        key: 'subscriptions',
        label: 'Отменить подписки',
        monthlyDelta: subscriptionEstimate,
        description: `Экономия ${formatCurrency(subscriptionEstimate)}/мес при полной отмене подписок.`,
      },
      {
        key: 'income',
        label: 'Увеличить доход на 15%',
        monthlyDelta: Math.round(budget * 0.15),
        description: `Дополнительно ${formatCurrency(Math.round(budget * 0.15))}/мес к бюджету.`,
      },
    ];
  }, [data]);

  const selected = scenarios[activeScenario];

  const forecast = useMemo(() => {
    const baseMonthlySaving = data.currentMonthlySavings * (savingsRate / 100);
    const adjustedMonthly = baseMonthlySaving + selected.monthlyDelta * (savingsRate / 100);
    const totalIn4Months = data.savings + adjustedMonthly * 4;
    return { monthly: Math.round(adjustedMonthly), total: Math.round(totalIn4Months) };
  }, [data, selected, savingsRate]);

  const canBuy = useMemo(() => {
    if (forecast.monthly <= 0) return { item: '—', days: Infinity };
    const target = 120000;
    const weeks = Math.ceil(target / (forecast.monthly * 12 / 52));
    return { item: 'iPhone', days: weeks * 7 };
  }, [forecast]);

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Планы и цели</p>
          <h3>Интерактивные сценарии с слайдерами</h3>
          <p>Настройте параметры и сразу увидите результат на основе ваших данных.</p>
        </div>
      </section>

      <section className="card large">
        <div className="chip-row">
          {scenarios.map((item, index) => (
            <button
              key={item.key}
              className={`chip ${activeScenario === index ? 'active' : ''}`}
              onClick={() => setActiveScenario(index)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="slider-block">
          <label htmlFor="savings">Ставка накоплений: {savingsRate}%</label>
          <input id="savings" type="range" min="5" max="40" value={savingsRate} onChange={e => setSavingsRate(Number(e.target.value))} />
        </div>

        <div className="forecast-box">
          <p>{selected.label}</p>
          <strong>{formatCurrency(forecast.total)}</strong>
          <span>остаток через 4 месяца</span>
          {selected.monthlyDelta > 0 && (
            <p style={{ marginTop: 8, color: '#84f4c0' }}>+{formatCurrency(selected.monthlyDelta)}/мес</p>
          )}
        </div>

        <p style={{ marginTop: 12, fontSize: '0.9rem', color: '#8aa2ca' }}>{selected.description}</p>
      </section>

      <section className="content-grid">
        <div className="card reveal-card">
          <p className="eyebrow">Что можно купить?</p>
          <h4>{canBuy.item} · 120 000 ₽</h4>
          <p>
            {canBuy.days < Infinity
              ? `Можно купить через ${canBuy.days} дн., если откладывать ${formatCurrency(forecast.monthly)}/мес.`
              : 'Сначала увеличьте ставку накоплений или доход.'}
          </p>
        </div>
        <div className="card reveal-card">
          <p className="eyebrow">Рекомендация</p>
          {data.projectedMonthEnd > data.budget ? (
            <>
              <h4>Расходы превышают бюджет</h4>
              <p>Текущий темп ({formatCurrency(Math.round(data.projectedMonthEnd))}/мес) выше бюджета ({formatCurrency(data.budget)}/мес). Сократьте траты или увеличьте доход.</p>
            </>
          ) : (
            <>
              <h4>Всё под контролем</h4>
              <p>При текущем темпе к концу месяца останется {formatCurrency(Math.round(data.budget - data.projectedMonthEnd))}. Вы в хорошей форме.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
