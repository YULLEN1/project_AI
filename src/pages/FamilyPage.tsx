import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type FamilyMember = {
  id: string;
  name: string;
  role: string;
  contribute: number;
  color: string;
  nextIncomeDate?: string;
  incomeAmount?: number;
};

type FamilyGoal = {
  id: string;
  title: string;
  target: number;
};

function readMembers() {
  if (typeof window === 'undefined') return [] as FamilyMember[];
  const raw = window.localStorage.getItem('moneypilot-family-members');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FamilyMember[];
  } catch {
    return [];
  }
}

function readGoals() {
  if (typeof window === 'undefined') return [] as FamilyGoal[];
  const raw = window.localStorage.getItem('moneypilot-family-goals');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FamilyGoal[];
  } catch {
    return [];
  }
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function daysUntil(dateString: string) {
  const now = new Date();
  const target = new Date(dateString);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>(() => readMembers());
  const [goals, setGoals] = useState<FamilyGoal[]>(() => readGoals());

  useEffect(() => {
    const refresh = () => {
      setMembers(readMembers());
      setGoals(readGoals());
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const totalContributions = useMemo(
    () => members.reduce((sum, member) => sum + member.contribute, 0),
    [members],
  );

  const totalTarget = useMemo(
    () => goals.reduce((sum, goal) => sum + goal.target, 0),
    [goals],
  );

  const progress = totalTarget > 0 ? Math.min(100, Math.round((totalContributions / totalTarget) * 100)) : 0;

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Семейный режим</p>
          <h3>Один бюджет для всей семьи</h3>
          <p>Добавляйте участников и цели только в настройках, а здесь смотрите итоги.</p>
        </div>
      </section>

      <section className="content-grid">
        <div className="card large">
          <h4>Общий бюджет семьи</h4>
          <p>Доступно: <strong>{formatCurrency(totalContributions)}</strong></p>
          <p>Осталось до цели: <strong>{formatCurrency(Math.max(0, totalTarget - totalContributions))}</strong></p>
          <div className="forecast-box" style={{ marginTop: 16 }}>
            <p>Прогресс по целям</p>
            <strong>{progress}%</strong>
            <span>от общего фонда</span>
          </div>

          <div className="settings-list" style={{ marginTop: 20 }}>
            {members.length ? members.map(member => (
              <div key={member.id} className="settings-row">
                <div>
                  <strong>{member.name}</strong>
                  <p>{member.role}</p>
                  {member.nextIncomeDate && member.incomeAmount ? (
                    <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                      Доход {formatCurrency(member.incomeAmount)} · {(() => {
                        const d = daysUntil(member.nextIncomeDate);
                        if (d < 0) return 'просрочен';
                        if (d === 0) return 'сегодня';
                        return `через ${d} дн.`;
                      })()}
                    </p>
                  ) : null}
                </div>
                <span>{formatCurrency(member.contribute)}</span>
              </div>
            )) : (
              <div className="empty-cell">Нет участников семьи. Добавьте их в настройках.</div>
            )}
          </div>
        </div>

        <div className="card large">
          <h4>Семейные цели</h4>
          {goals.length ? (
            <ul className="goal-list">
              {goals.map(goal => (
                <li key={goal.id} className="goal-item">
                  <div>
                    <strong>{goal.title}</strong>
                    <span>{formatCurrency(goal.target)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-cell">Нет целей. Добавьте семейные цели в настройках.</div>
          )}

          <div className="settings-note" style={{ marginTop: 20 }}>
            Изменения выполняются в <Link to="/settings">Настройках</Link>.
          </div>
        </div>
      </section>
    </div>
  );
}
