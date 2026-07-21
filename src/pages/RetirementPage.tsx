import { useMemo } from 'react';
import { Link } from 'react-router-dom';

type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  targetAge: number;
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

export default function RetirementPage() {
  const userAge = readNumber('moneypilot-user-age');
  const goals = readJson<SavingsGoal[]>('moneypilot-savings-goals', []);

  const calculated = useMemo(() => {
    if (!userAge || goals.length === 0) return null;
    return goals.map(goal => {
      const yearsLeft = Math.max(1, goal.targetAge - userAge);
      const monthsLeft = yearsLeft * 12;
      const remaining = Math.max(0, goal.targetAmount - goal.currentSavings);
      const monthly = Math.round(remaining / monthsLeft);
      const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentSavings / goal.targetAmount) * 100)) : 0;
      return { ...goal, yearsLeft, monthsLeft, remaining, monthly, progress };
    });
  }, [userAge, goals]);

  const totalMonthly = useMemo(() => {
    if (!calculated) return 0;
    return calculated.reduce((s, g) => s + g.monthly, 0);
  }, [calculated]);

  if (!userAge) {
    return (
      <div className="page-grid">
        <section className="hero-panel compact">
          <div>
            <p className="eyebrow">Цели накоплений</p>
            <h3>Планируйте крупные покупки</h3>
            <p>Квартира, машина, пенсия, образование детей — любые цели.</p>
          </div>
        </section>
        <div className="card large">
          <div className="empty-cell">
            <p>Укажите свой возраст в <Link to="/settings">Настройках → Основные</Link>, чтобы увидеть расчёты.</p>
          </div>
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="page-grid">
        <section className="hero-panel compact">
          <div>
            <p className="eyebrow">Цели накоплений</p>
            <h3>Планируйте крупные покупки</h3>
            <p>Добавьте первую цель в <Link to="/settings">Настройках → Цели</Link>.</p>
          </div>
        </section>
        <div className="card large">
          <div className="empty-cell">
            <p>Добавьте цель в <Link to="/settings">Настройках</Link>, чтобы увидеть план накоплений.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Цели накоплений</p>
          <h3>Планируйте крупные покупки</h3>
          <p>Ваш возраст: {userAge} лет · Всего {formatCurrency(totalMonthly)}/мес на все цели</p>
        </div>
        <div className="hero-badge">{goals.length} {goals.length === 1 ? 'цель' : goals.length < 5 ? 'цели' : 'целей'}</div>
      </section>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {calculated!.map(goal => {
          const pct = goal.progress;
          return (
            <article key={goal.id} className="card">
              <div className="assistant-header">
                <div>
                  <p className="eyebrow">до {goal.targetAge} лет</p>
                  <h4>{goal.name}</h4>
                </div>
                <span>{goal.yearsLeft} {goal.yearsLeft === 1 ? 'год' : goal.yearsLeft < 5 ? 'года' : 'лет'}</span>
              </div>

              <div className="bar-track" style={{ margin: '12px 0 8px' }}>
                <span style={{ width: `${pct}%` }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 12, color: '#b8cfe8' }}>
                <span>{formatCurrency(goal.currentSavings)}</span>
                <span>{formatCurrency(goal.targetAmount)}</span>
              </div>

              <div className="forecast-box">
                <p style={{ margin: 0 }}>
                  {goal.remaining > 0
                    ? <>Нужно ещё <strong>{formatCurrency(goal.remaining)}</strong> · <strong>{formatCurrency(goal.monthly)}/мес</strong></>
                    : '✅ Цель достигнута!'}
                </p>
              </div>

              {goal.remaining > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 'var(--font-size-sm)', color: '#b8cfe8' }}>
                  <span>Осталось месяцев: {goal.monthsLeft}</span>
                  <span style={{ textAlign: 'right' }}>Прогресс: {pct}%</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
