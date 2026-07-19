import { useEffect, useMemo, useState } from 'react';

const retirementKeys = {
  age: 'moneypilot-retirement-age',
  income: 'moneypilot-retirement-income',
  savings: 'moneypilot-retirement-savings',
  target: 'moneypilot-retirement-target',
};

function readString(key: string) {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) ?? '';
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function RetirementPage() {
  const [age, setAge] = useState(() => readString(retirementKeys.age));
  const [income, setIncome] = useState(() => readString(retirementKeys.income));
  const [savings, setSavings] = useState(() => readString(retirementKeys.savings));
  const [target, setTarget] = useState(() => readString(retirementKeys.target));

  const projection = useMemo(() => {
    if (!age || !income || !savings) return null;
    const monthly = Number(income) * 0.08;
    const annual = monthly * 12 + Number(savings) * 0.06;
    return Math.round(annual * (60 - Number(age)) / 2);
  }, [age, income, savings]);

  const goalDiff = useMemo(() => {
    if (!projection || !target) return null;
    return Number(target) - projection;
  }, [projection, target]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(retirementKeys.age, age);
    window.localStorage.setItem(retirementKeys.income, income);
    window.localStorage.setItem(retirementKeys.savings, savings);
    window.localStorage.setItem(retirementKeys.target, target);
  }, [age, income, savings, target]);

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
          <strong>{projection !== null ? formatCurrency(projection) : 'Задайте параметры в настройках'}</strong>
          <span>{goalDiff !== null ? `Цель ${formatCurrency(Number(target))}, разрыв ${formatCurrency(goalDiff)}` : 'Заполните возраст, доход и накопления'}</span>
        </div>
      </section>
    </div>
  );
}
