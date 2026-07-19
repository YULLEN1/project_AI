import { FormEvent, useEffect, useMemo, useState } from 'react';

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

const goalColors = [
  'linear-gradient(135deg, #37c7ff, #8b6dff)',
  'linear-gradient(135deg, #ffb54d, #ff6b6b)',
  'linear-gradient(135deg, #44c28b, #32a0ff)',
  'linear-gradient(135deg, #ff7cc7, #d85cff)',
];

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

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>(() => readMembers());
  const [goals, setGoals] = useState<FamilyGoal[]>(() => readGoals());
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('Доход');
  const [memberAmount, setMemberAmount] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  useEffect(() => {
    window.localStorage.setItem('moneypilot-family-members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    window.localStorage.setItem('moneypilot-family-goals', JSON.stringify(goals));
  }, [goals]);

  const totalContributions = useMemo(
    () => members.reduce((sum, member) => sum + member.contribute, 0),
    [members],
  );

  const totalTarget = useMemo(
    () => goals.reduce((sum, goal) => sum + goal.target, 0),
    [goals],
  );

  const progress = totalTarget > 0 ? Math.min(100, Math.round((totalContributions / totalTarget) * 100)) : 0;

  const handleAddMember = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(memberAmount);
    if (!memberName.trim() || !memberRole.trim() || !Number.isFinite(parsed) || parsed < 0) return;

    const next: FamilyMember = {
      id: `${Date.now()}-${memberName.trim()}`,
      name: memberName.trim(),
      role: memberRole.trim(),
      contribute: parsed,
      color: goalColors[members.length % goalColors.length],
    };

    setMembers(prev => [...prev, next]);
    setMemberName('');
    setMemberRole('Доход');
    setMemberAmount('');
  };

  const handleAddGoal = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(goalTarget);
    if (!goalTitle.trim() || !Number.isFinite(parsed) || parsed <= 0) return;

    const next: FamilyGoal = {
      id: `${Date.now()}-${goalTitle.trim()}`,
      title: goalTitle.trim(),
      target: parsed,
    };

    setGoals(prev => [...prev, next]);
    setGoalTitle('');
    setGoalTarget('');
  };

  const handleRemoveMember = (id: string) => {
    setMembers(prev => prev.filter(member => member.id !== id));
  };

  const handleRemoveGoal = (id: string) => {
    setGoals(prev => prev.filter(goal => goal.id !== id));
  };

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Семейный режим</p>
          <h3>Один бюджет, прозрачность и общие цели</h3>
          <p>Добавьте членов семьи и настройте общие финансовые задачи вместе.</p>
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
            <span>от общего целевого фонда</span>
          </div>

          <div className="stack" style={{ marginTop: 20 }}>
            {members.length ? members.map(member => (
              <div key={member.id} className="card" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{member.name}</strong>
                    <p style={{ margin: '4px 0 0', color: '#aaa' }}>{member.role}</p>
                  </div>
                  <span style={{ color: '#888' }}>{formatCurrency(member.contribute)}</span>
                </div>
                <div style={{ marginTop: 12, height: 8, borderRadius: 999, background: member.color }} />
              </div>
            )) : (
              <div className="card empty-card">
                <p>Пока нет членов семьи. Добавьте первого участника в настройках.</p>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <h4>Добавление участников и настройка целей</h4>
            <p>Управляйте членами семьи и целями в <a href="/settings">Настройках</a>.</p>
          </div>
        </div>

        <div className="card large">
          <h4>Цели семьи</h4>
          {goals.length ? (
            <ul className="goal-list">
              {goals.map(goal => (
                <li key={goal.id} className="goal-item">
                  <div>
                    <strong>{goal.title}</strong>
                    <span>{formatCurrency(goal.target)}</span>
                  </div>
                  <button type="button" className="text-button" onClick={() => handleRemoveGoal(goal.id)}>
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Пока нет целей. Добавьте первую цель ниже.</p>
          )}

          <form className="card" style={{ marginTop: 20 }} onSubmit={handleAddGoal}>
            <h4>Добавить цель</h4>
            <div className="grid-form">
              <input
                value={goalTitle}
                onChange={e => setGoalTitle(e.target.value)}
                placeholder="Цель"
              />
              <input
                value={goalTarget}
                onChange={e => setGoalTarget(e.target.value)}
                placeholder="Сумма цели"
                type="number"
              />
            </div>
            <button type="submit">Сохранить цель</button>
          </form>
        </div>
      </section>
    </div>
  );
}
