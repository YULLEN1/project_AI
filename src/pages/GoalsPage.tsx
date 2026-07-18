import { useState } from 'react';

const scenarios = [
  { key: 'base', label: 'Если ничего не менять', value: 25000, slider: 0 },
  { key: 'cafe', label: 'Если сократить кафе на 30%', value: 61000, slider: 30 },
  { key: 'subscriptions', label: 'Если отменить подписки', value: 71000, slider: 15 },
  { key: 'income', label: 'Если увеличить доход на 15%', value: 126000, slider: 15 },
] as const;

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function GoalsPage() {
  const [activeScenario, setActiveScenario] = useState<(typeof scenarios)[number]['key']>('base');
  const [savingsRate, setSavingsRate] = useState(20);
  const selected = scenarios.find(item => item.key === activeScenario)!;

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Планы и цели</p>
          <h3>Интерактивные сценарии с слайдерами</h3>
          <p>Настройте параметры и сразу увидите результат.</p>
        </div>
      </section>

      <section className="card large">
        <div className="chip-row">
          {scenarios.map(item => (
            <button key={item.key} className={`chip ${activeScenario === item.key ? 'active' : ''}`} onClick={() => setActiveScenario(item.key)}>
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
          <strong>{formatCurrency(selected.value + savingsRate * 900)}</strong>
          <span>остаток через 4 месяца</span>
        </div>
      </section>

      <section className="content-grid">
        <div className="card reveal-card">
          <p className="eyebrow">Что можно купить?</p>
          <h4>iPhone · 120 000 ₽</h4>
          <p>Можно купить через 41 день, если откладывать по 3 200 ₽ в неделю.</p>
        </div>
        <div className="card reveal-card">
          <p className="eyebrow">Рекомендация</p>
          <h4>Сейчас лучше отложить</h4>
          <p>Покупка сильно уменьшает запас до следующей зарплаты. Лучше перенести её на 1–2 месяца.</p>
        </div>
      </section>
    </div>
  );
}
