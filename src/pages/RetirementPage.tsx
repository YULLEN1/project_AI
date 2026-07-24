import { useMemo } from 'react';
import { Link } from 'react-router-dom';

type SavingsGoal = {
  id: string;
  name: string;
  type?: string;
  targetAmount: number;
  targetDate?: string;
  targetAge?: number;
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

function getMonthsUntil(targetDate?: string, targetAge?: number, userAge?: number | null) {
  if (targetDate) {
    const now = new Date();
    const target = new Date(`${targetDate}T00:00:00`);
    return Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth());
  }
  if (targetAge && userAge) return Math.max(1, (targetAge - userAge) * 12);
  return null;
}

function formatDeadline(goal: SavingsGoal) {
  if (goal.targetDate) return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(`${goal.targetDate}T00:00:00`));
  if (goal.targetAge) return `к ${goal.targetAge} годам`;
  return 'срок не указан';
}

export default function RetirementPage() {
  const userAge = readNumber('moneypilot-user-age');
  const goals = readJson<SavingsGoal[]>('moneypilot-savings-goals', []);

  const calculated = useMemo(() => goals.map(goal => {
    const monthsLeft = getMonthsUntil(goal.targetDate, goal.targetAge, userAge);
    const remaining = Math.max(0, goal.targetAmount - goal.currentSavings);
    const monthly = monthsLeft ? Math.ceil(remaining / monthsLeft) : null;
    const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentSavings / goal.targetAmount) * 100)) : 0;
    return { ...goal, monthsLeft, remaining, monthly, progress };
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

            {goal.remaining === 0 ? (
              <div className="goal-plan-result success">Цель достигнута. Можно создать следующую.</div>
            ) : goal.monthly !== null ? (
              <div className="goal-plan-result">
                <span>Откладывать каждый месяц</span>
                <strong>{formatCurrency(goal.monthly)}</strong>
                <small>Осталось {formatCurrency(goal.remaining)} и {goal.monthsLeft} мес.</small>
              </div>
            ) : (
              <div className="goal-plan-result warning">Укажите срок цели в настройках, чтобы рассчитать ежемесячный взнос.</div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
