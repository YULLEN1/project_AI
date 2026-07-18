import { useEffect, useState } from 'react';

const habits = [
  { name: 'Кофе', amount: 7800, insight: 'Самая дорогая привычка' },
  { name: 'Такси', amount: 9700, insight: 'Самая бесполезная категория' },
  { name: 'Курс английского', amount: 0, insight: 'Самая выгодная покупка' },
];

const chartData = [34, 56, 48, 72, 64, 88];

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function AnalyticsPage() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

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
        {habits.map(item => (
          <article key={item.name} className="card reveal-card">
            <p className="eyebrow">{item.insight}</p>
            <h4>{item.name}</h4>
            <strong>{item.amount ? formatCurrency(item.amount) : 'Рост карьеры'}</strong>
            <div className="bar-track">
              <span style={{ width: item.amount ? '78%' : '92%' }} />
            </div>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <div className="card large reveal-card">
          <h4>Тренд расходов</h4>
          <svg viewBox="0 0 300 120" className="line-chart" aria-label="line chart">
            <path d="M10 95 C50 70, 70 60, 100 70 S150 90, 180 60 S230 36, 290 20" />
          </svg>
          <p>За последнюю неделю расходы снизились на <strong>14%</strong>.</p>
        </div>
        <div className="card large reveal-card">
          <h4>Финансовый прогноз</h4>
          <div className="bars-stack">
            {chartData.map((value, index) => (
              <div key={index} className="bar-column">
                <div className="bar-fill" style={{ height: `${value}%` }} />
              </div>
            ))}
          </div>
          <p>Через год: <strong>+410 000 ₽</strong></p>
        </div>
      </section>
    </div>
  );
}
