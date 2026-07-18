import { useEffect, useMemo, useState } from 'react';

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

function getSavedSelectedDate() {
  if (typeof window === 'undefined') return new Date().toISOString().slice(0, 10);
  const raw = window.localStorage.getItem('moneypilot-selectedDate');
  return raw || new Date().toISOString().slice(0, 10);
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

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function AnalyticsPage() {
  const [visible, setVisible] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [range, setRange] = useState<RangeKey>('week');
  const [selectedDate, setSelectedDate] = useState(getSavedSelectedDate());

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
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const total = filteredPurchases.reduce((sum, item) => sum + item.amount, 0);
    const trend =
      filteredPurchases.length > 1 && filteredPurchases[0].amount !== 0
        ? Math.round((filteredPurchases[filteredPurchases.length - 1].amount - filteredPurchases[0].amount) / filteredPurchases[0].amount * 100)
        : 0;

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
      forecast: Math.round(total * 1.15),
    };
  }, [filteredPurchases]);

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
              <svg viewBox="0 0 300 120" className="line-chart" aria-label="line chart">
                <path d="M10 95 C50 70, 70 60, 100 70 S150 90, 180 60 S230 36, 290 20" />
              </svg>
              <p>За выбранный период расходы {analytics.trend >= 0 ? 'увеличились' : 'уменьшились'} на <strong>{Math.abs(analytics.trend)}%</strong>.</p>
            </>
          ) : (
            <p>{purchases.length ? 'В выбранном периоде нет расходов. Измените дату или диапазон в дашборде.' : 'Добавьте первые транзакции в дашборде, чтобы увидеть аналитику.'}</p>
          )}
        </div>
        <div className="card large reveal-card">
          <h4>Финансовый прогноз</h4>
          {analytics ? (
            <>
              <div className="bars-stack">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="bar-column">
                    <div className="bar-fill" style={{ height: `${30 + index * 10}%` }} />
                  </div>
                ))}
              </div>
              <p>Через год: <strong>+{formatCurrency(analytics.forecast - analytics.total)}</strong></p>
            </>
          ) : (
            <p>Пока нет прогноза — добавьте первые расходы.</p>
          )}
        </div>
      </section>
    </div>
  );
}
