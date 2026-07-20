import { useMemo } from 'react';
import { Link } from 'react-router-dom';

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
  const age = readString(retirementKeys.age);
  const income = readString(retirementKeys.income);
  const savings = readString(retirementKeys.savings);
  const target = readString(retirementKeys.target);

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

  const monthlyContribution = useMemo(() => {
    if (!income) return null;
    return Math.round(Number(income) * 0.08);
  }, [income]);

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
        {age && income && savings ? (
          <>
            <div className="input-grid">
              <label>
                <span>Возраст: {age}</span>
              </label>
              <label>
                <span>Доход: {formatCurrency(Number(income))}</span>
              </label>
              <label>
                <span>Накопления: {formatCurrency(Number(savings))}</span>
              </label>
              <label>
                <span>Цель: {target ? formatCurrency(Number(target)) : 'Не задана'}</span>
              </label>
            </div>
            <div className="forecast-box">
              <p>
                {monthlyContribution !== null
                  ? `Откладывая ${formatCurrency(monthlyContribution)}/мес (8% от дохода), к 60 годам можно накопить`
                  : 'Рассчитайте накопления'}
              </p>
              <strong>{projection !== null ? formatCurrency(projection) : '—'}</strong>
              <span>{goalDiff !== null ? `Цель ${formatCurrency(Number(target))}, разрыв ${formatCurrency(goalDiff)}` : ''}</span>
            </div>
          </>
        ) : (
          <div className="empty-cell">
            <p>Заполните параметры пенсии в <Link to="/settings">Настройках</Link>, чтобы увидеть расчёт.</p>
          </div>
        )}
      </section>
    </div>
  );
}
