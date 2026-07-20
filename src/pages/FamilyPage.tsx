import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type FamilyMember = {
  id: string;
  name: string;
  role: string;
  contribute: number;
  color: string;
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

function writeMembers(members: FamilyMember[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('moneypilot-family-members', JSON.stringify(members));
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

function getSalary() {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem('moneypilot-salary');
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

const SELF_COLOR = '#4c7eff';

export default function FamilyPage() {
  const { user } = useAuth();
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

  useEffect(() => {
    if (!user) return;
    const selfId = `self:${user.email}`;
    const salary = getSalary();
    setMembers(prev => {
      const selfIndex = prev.findIndex(m => m.id === selfId);
      if (selfIndex >= 0) {
        const updated = [...prev];
        updated[selfIndex] = { ...updated[selfIndex], contribute: salary };
        writeMembers(updated);
        return updated;
      }
      const updated = [
        { id: selfId, name: user.email.split('@')[0], role: 'Вы (автор)', contribute: salary, color: SELF_COLOR },
        ...prev,
      ];
      writeMembers(updated);
      return updated;
    });
  }, [user]);

  const selfId = user ? `self:${user.email}` : '';

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
          <p>Вы автоматически добавлены как участник. Остальных добавляйте в настройках.</p>
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
                  <strong style={member.id === selfId ? { color: SELF_COLOR } : undefined}>{member.name}</strong>
                  <p>{member.role}</p>
                </div>
                <span>{formatCurrency(member.contribute)}</span>
              </div>
            )) : (
              <div className="empty-cell">Нет участников семьи.</div>
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
