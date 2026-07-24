import { useMemo } from 'react';
import { Link } from 'react-router-dom';

type SavingsGoal = {
  id: string;
  name: string;
  type?: string;
  targetAmount: number;
  targetDate?: string;
  targetAge?: number;
  monthlyPension?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
  currentSavings: number;
};

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

function readNumber(key: string): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getPensionDetails(goal: SavingsGoal) {
  const isPension = goal.monthlyPension || goal.type === 'Пенсия' || goal.name.trim().toLowerCase() === 'пенсия';
  if (!isPension) return null;
  return {
    monthlyPension: goal.monthlyPension ?? goal.targetAmount,
    retirementAge: goal.retirementAge ?? goal.targetAge ?? 60,
    lifeExpectancy: goal.lifeExpectancy ?? 95,
  };
}

function getMonthsUntil(goal: SavingsGoal, userAge?: number | null) {
  const pension = getPensionDetails(goal);
  if (pension && userAge) {
    const months = (pension.retirementAge - userAge) * 12;
    return months > 0 ? months : null;
  }
  const { targetDate, targetAge } = goal;
  if (targetDate) {
    const now = new Date();
    const target = new Date(`${targetDate}T00:00:00`);
    const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
    return months > 0 ? months : null;
  }
  if (targetAge && userAge) {
    const months = (targetAge - userAge) * 12;
    return months > 0 ? months : null;
  }
  return null;
}

function getTargetAmount(goal: SavingsGoal) {
  const pension = getPensionDetails(goal);
  if (pension) return pension.monthlyPension * Math.max(0, pension.lifeExpectancy - pension.retirementAge) * 12;
  return goal.targetAmount;
}

function formatDeadline(goal: SavingsGoal) {
  const pension = getPensionDetails(goal);
  if (pension) return `выход в ${pension.retirementAge} лет`;
  if (goal.targetDate) return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(`${goal.targetDate}T00:00:00`));
  if (goal.targetAge) return `к ${goal.targetAge} годам`;
  return 'срок не указан';
}

export default function RetirementPage() {
  const userAge = readNumber('moneypilot-user-age');
  const goals = readJson<SavingsGoal[]>('moneypilot-savings-goals', []);

  const calculated = useMemo(() => goals.map(goal => {
    const pension = getPensionDetails(goal);
    const targetAmount = getTargetAmount(goal);
    const monthsLeft = getMonthsUntil(goal, userAge);
    const remaining = Math.max(0, targetAmount - goal.currentSavings);
    const monthly = monthsLeft ? Math.ceil(remaining / monthsLeft) : null;
    const progress = targetAmount > 0 ? Math.min(100, Math.round((goal.currentSavings / targetAmount) * 100)) : 0;
    return { ...goal, pension, targetAmount, monthsLeft, remaining, monthly, progress };
  }), [goals, userAge]);

  const totalMonthly = calculated.reduce((sum, goal) => sum + (goal.monthly ?? 0), 0);

  if (goals.length === 0) {
    return (
      <div className="page-grid">
        <section className="hero-panel compact">
          <div>
            <p className="eyebrow">Цели накоплений</p>
            <h2>Планируйте то, что важно вам</h2>
            <p>Путешествие, резерв, квартира, образование или пенсия - каждая цель получает отдельный план.</p>
          </div>
          <Link className="hero-action" to="/settings">Добавить цель</Link>
        </section>
        <div className="card large empty-cell">Пока нет целей. Создайте первую цель с суммой и сроком в <Link to="/settings">Настройках</Link>.</div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Цели накоплений</p>
          <h2>Понятный план для каждой цели</h2>
          <p>Чтобы выполнить все цели в срок, откладывайте {formatCurrency(totalMonthly)}/мес. Расчёт не учитывает доходность и инфляцию.</p>
        </div>
        <Link className="hero-action" to="/settings">Управлять целями</Link>
      </section>

      <div className="goal-plan-grid">
        {calculated.map(goal => (
          <article key={goal.id} className="card goal-plan-card">
            <div className="goal-plan-head">
              <div>
                <p className="eyebrow">{goal.type ?? 'Пенсия'}</p>
                <h2>{goal.name}</h2>
              </div>
              <span className="goal-type">{formatDeadline(goal)}</span>
            </div>

            <div className="goal-progress-label"><span>Накоплено</span><strong>{goal.progress}%</strong></div>
            <div className="bar-track"><span style={{ width: `${goal.progress}%` }} /></div>
            <div className="goal-progress-numbers"><span>{formatCurrency(goal.currentSavings)}</span><span>из {formatCurrency(goal.targetAmount)}</span></div>

            {goal.pension && (
              <p className="settings-note">Капитал для выплаты {formatCurrency(goal.pension.monthlyPension)}/мес с {goal.pension.retirementAge} до {goal.pension.lifeExpectancy} лет.</p>
            )}

            {goal.remaining === 0 ? (
              <div className="goal-plan-result success">Цель достигнута. Можно создать следующую.</div>
            ) : goal.monthly !== null ? (
              <div className="goal-plan-result">
                <span>Откладывать каждый месяц</span>
                <strong>{formatCurrency(goal.monthly)}</strong>
                <small>Осталось {formatCurrency(goal.remaining)} и {goal.monthsLeft} мес.</small>
              </div>
            ) : (
              <div className="goal-plan-result warning">Укажите будущий срок цели в настройках, чтобы рассчитать ежемесячный взнос.</div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
