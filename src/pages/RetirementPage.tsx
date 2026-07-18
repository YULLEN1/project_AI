import { useMemo, useState } from 'react';

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function RetirementPage() {
  const [age, setAge] = useState('31');
  const [income, setIncome] = useState('180000');
  const [savings, setSavings] = useState('950000');
  const [target, setTarget] = useState('120000');

  const projection = useMemo(() => {
    const monthly = Number(income) * 0.08;
    const annual = monthly * 12 + Number(savings) * 0.06;
    return Math.round(annual * (60 - Number(age)) / 2);
  }, [age, income, savings]);

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Пенсионный калькулятор</p>
          <h3>Смотрите, как ваши решения влияют на будущее</h3>
          <p>Моделируйте повышение дохода, смену работы, покупку квартиры или рождение ребёнка.</p>
        </div>
      </section>

      <section className="card large">
        <div className="input-grid">
          <label>
            <span>Возраст</span>
            <input value={age} onChange={e => setAge(e.target.value)} />
          </label>
          <label>
            <span>Доход</span>
            <input value={income} onChange={e => setIncome(e.target.value)} />
          </label>
          <label>
            <span>Накопления</span>
            <input value={savings} onChange={e => setSavings(e.target.value)} />
          </label>
          <label>
            <span>Планируемая пенсия</span>
            <input value={target} onChange={e => setTarget(e.target.value)} />
          </label>
        </div>
        <div className="forecast-box">
          <p>Если откладывать по 15 000 ₽ в месяц, к 60 годам можно накопить</p>
          <strong>{formatCurrency(projection)}</strong>
          <span>с учётом умеренного роста</span>
        </div>
      </section>
    </div>
  );
}
