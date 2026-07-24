import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type FamilyMember = {
  id: string;
  name: string;
  role: string;
  contribute: number;
  nextIncomeDate?: string;
  incomeAmount?: number;
};

type FamilyGoal = {
  id: string;
  title: string;
  target: number;
  currentSavings?: number;
  targetDate?: string;
  priority?: 'high' | 'medium' | 'low';
  monthlyContribution?: number;
  memberIds?: string[];
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function getMonthsUntil(targetDate?: string) {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(`${targetDate}T00:00:00`);
  const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
  return months > 0 ? months : null;
}

function formatDeadline(targetDate?: string) {
  if (!targetDate) return 'Срок не указан';
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(`${targetDate}T00:00:00`));
}

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>(() => readJson('moneypilot-family-members', []));
  const [goals, setGoals] = useState<FamilyGoal[]>(() => readJson('moneypilot-family-goals', []));

  useEffect(() => {
    const refresh = () => {
      setMembers(readJson('moneypilot-family-members', []));
      setGoals(readJson('moneypilot-family-goals', []));
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const plan = useMemo(() => {
    const income = members.filter(member => member.role === 'Доход').reduce((sum, member) => sum + member.contribute, 0);
    const expenses = members.filter(member => member.role === 'Расход').reduce((sum, member) => sum + member.contribute, 0);
    const available = income - expenses;
    const goalPlans = goals.map(goal => {
      const currentSavings = goal.currentSavings ?? 0;
      const remaining = Math.max(0, goal.target - currentSavings);
      const monthlyContribution = goal.monthlyContribution ?? 0;
      const monthsLeft = getMonthsUntil(goal.targetDate);
      const requiredMonthly = monthsLeft ? Math.ceil(remaining / monthsLeft) : null;
      const progress = goal.target > 0 ? Math.min(100, Math.round((currentSavings / goal.target) * 100)) : 0;
      const participants = (goal.memberIds ?? []).map(id => members.find(member => member.id === id)?.name).filter(Boolean) as string[];
      const contributionPerMember = participants.length ? Math.ceil(monthlyContribution / participants.length) : null;
      const status = remaining === 0 ? 'done' : requiredMonthly === null ? 'missing-date' : monthlyContribution >= requiredMonthly ? 'on-track' : 'at-risk';
      return { ...goal, currentSavings, remaining, monthlyContribution, monthsLeft, requiredMonthly, progress, participants, contributionPerMember, status };
    });
    const planned = goalPlans.reduce((sum, goal) => sum + goal.monthlyContribution, 0);
    const fund = goalPlans.reduce((sum, goal) => sum + goal.currentSavings, 0);
    const required = goalPlans.reduce((sum, goal) => sum + (goal.requiredMonthly ?? 0), 0);
    return { income, expenses, available, planned, fund, required, unallocated: available - planned, goalPlans };
  }, [members, goals]);

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Семейный режим</p>
          <h2>План семьи без смешения денег</h2>
          <p>Фонд целей показывает уже накопленные средства, а бюджет - то, что можно распределять каждый месяц.</p>
        </div>
        <Link className="hero-action" to="/settings">Управлять планом</Link>
      </section>

      <section className="family-summary" aria-label="Сводка семейного бюджета">
        <article className="card total-card income"><span>Доходы в месяц</span><strong>{formatCurrency(plan.income)}</strong></article>
        <article className="card total-card expenses"><span>Обязательные расходы</span><strong>{formatCurrency(plan.expenses)}</strong></article>
        <article className="card total-card"><span>Свободно в месяц</span><strong>{formatCurrency(plan.available)}</strong></article>
        <article className="card total-card"><span>Запланировано на цели</span><strong>{formatCurrency(plan.planned)}</strong><p>{plan.unallocated >= 0 ? `Нераспределено ${formatCurrency(plan.unallocated)}` : `Не хватает ${formatCurrency(Math.abs(plan.unallocated))}`}</p></article>
        <article className="card total-card"><span>Фонд семейных целей</span><strong>{formatCurrency(plan.fund)}</strong><p>Фактически накоплено на все цели.</p></article>
      </section>

      <section className="card large">
        <div className="card-head"><div><h2>Семейные цели</h2><p className="settings-note">Для дедлайнов нужно {formatCurrency(plan.required)}/мес, сейчас запланировано {formatCurrency(plan.planned)}/мес.</p></div><Link className="text-link" to="/settings">Добавить цель</Link></div>
        {plan.goalPlans.length ? (
          <div className="family-goal-grid">
            {plan.goalPlans.map(goal => (
              <article key={goal.id} className="family-goal-card">
                <div className="goal-plan-head"><div><span className={`goal-priority ${goal.priority ?? 'medium'}`}>{goal.priority === 'high' ? 'Высокий приоритет' : goal.priority === 'low' ? 'Низкий приоритет' : 'Средний приоритет'}</span><h3>{goal.title}</h3></div><span className="goal-type">{formatDeadline(goal.targetDate)}</span></div>
                <div className="goal-progress-label"><span>Накоплено</span><strong>{goal.progress}%</strong></div>
                <div className="bar-track"><span style={{ width: `${goal.progress}%` }} /></div>
                <div className="goal-progress-numbers"><span>{formatCurrency(goal.currentSavings)}</span><span>из {formatCurrency(goal.target)}</span></div>
                <div className={`family-goal-status ${goal.status}`}>
                  {goal.status === 'done' && 'Цель достигнута'}
                  {goal.status === 'missing-date' && 'Добавьте дедлайн, чтобы проверить план'}
                  {goal.status === 'on-track' && `По плану: ${formatCurrency(goal.monthlyContribution)}/мес`}
                  {goal.status === 'at-risk' && `Не хватает ${formatCurrency(Math.max(0, (goal.requiredMonthly ?? 0) - goal.monthlyContribution))}/мес`}
                </div>
                <p className="settings-note">Осталось {formatCurrency(goal.remaining)}{goal.requiredMonthly ? ` · нужно ${formatCurrency(goal.requiredMonthly)}/мес` : ''}</p>
                <p className="settings-note">Участники: {goal.participants.length ? `${goal.participants.join(', ')} · по ${formatCurrency(goal.contributionPerMember ?? 0)}/мес` : 'не назначены'}</p>
              </article>
            ))}
          </div>
        ) : <div className="empty-cell">Добавьте семейную цель с накопленной суммой и дедлайном в <Link to="/settings">Настройках</Link>.</div>}
      </section>

      <section className="card large">
        <h2>Участники бюджета</h2>
        <div className="settings-list">
          {members.length ? members.map(member => <div key={member.id} className="settings-row"><div><strong>{member.name}</strong><p>{member.role === 'Доход' ? 'Ежемесячный доход' : 'Обязательный расход'}{member.nextIncomeDate && member.incomeAmount ? ` · следующее поступление ${formatCurrency(member.incomeAmount)} ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${member.nextIncomeDate}T00:00:00`))}` : ''}</p></div><strong>{member.role === 'Расход' ? '−' : '+'}{formatCurrency(member.contribute)}/мес</strong></div>) : <div className="empty-cell">Добавьте участников семьи в <Link to="/settings">Настройках</Link>.</div>}
        </div>
      </section>
    </div>
  );
}
