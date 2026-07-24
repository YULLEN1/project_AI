import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type FamilyMember = { id: string; name: string; role: string; contribute: number; };
type FamilyExpense = { id: string; name: string; amount: number; };
type GoalActivity = { id: string; amount: number; date: string; memberId?: string; };
type FamilyGoal = {
  id: string; title: string; target: number; currentSavings?: number; targetDate?: string;
  priority?: 'high' | 'medium' | 'low'; monthlyContribution?: number; memberIds?: string[];
  distribution?: 'equal' | 'income' | 'custom'; memberContributions?: Record<string, number>;
  isPaused?: boolean; activity?: GoalActivity[];
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function formatCurrency(value: number) { return `${value.toLocaleString('ru-RU')} ₽`; }
function getToday() { return new Date().toISOString().slice(0, 10); }
function formatDate(value: string) { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`)); }
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
function formatProjectedDate(remaining: number, contribution: number) {
  if (remaining <= 0) return 'цель достигнута';
  if (contribution <= 0) return 'нет взноса';
  const date = new Date();
  date.setMonth(date.getMonth() + Math.ceil(remaining / contribution));
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
}
function priorityLabel(priority?: FamilyGoal['priority']) { return priority === 'high' ? 'Высокий приоритет' : priority === 'low' ? 'Низкий приоритет' : 'Средний приоритет'; }

function getShares(goal: FamilyGoal, members: FamilyMember[], contribution: number) {
  const participants = (goal.memberIds ?? []).map(id => members.find(member => member.id === id)).filter(Boolean) as FamilyMember[];
  if (!participants.length) return [];
  if (goal.distribution === 'custom') return participants.map(member => ({ name: member.name, amount: goal.memberContributions?.[member.id] ?? 0 }));
  if (goal.distribution === 'income') {
    const totalIncome = participants.filter(member => member.role === 'Доход').reduce((sum, member) => sum + member.contribute, 0);
    if (totalIncome > 0) return participants.map(member => ({ name: member.name, amount: member.role === 'Доход' ? Math.round(contribution * member.contribute / totalIncome) : 0 }));
  }
  const base = Math.floor(contribution / participants.length);
  return participants.map((member, index) => ({ name: member.name, amount: base + (index === 0 ? contribution - base * participants.length : 0) }));
}

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>(() => readJson('moneypilot-family-members', []));
  const [familyExpenses, setFamilyExpenses] = useState<FamilyExpense[]>(() => readJson('moneypilot-family-expenses', []));
  const [goals, setGoals] = useState<FamilyGoal[]>(() => readJson('moneypilot-family-goals', []));
  const [contributionGoalId, setContributionGoalId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionMemberId, setContributionMemberId] = useState('');
  const [contributionDate, setContributionDate] = useState(getToday());

  useEffect(() => {
    const refresh = () => { setMembers(readJson('moneypilot-family-members', [])); setFamilyExpenses(readJson('moneypilot-family-expenses', [])); setGoals(readJson('moneypilot-family-goals', [])); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const saveGoals = (next: FamilyGoal[]) => {
    setGoals(next);
    window.localStorage.setItem('moneypilot-family-goals', JSON.stringify(next));
  };

  const plan = useMemo(() => {
    const incomeMembers = members.filter(member => member.role !== 'Расход');
    const income = incomeMembers.reduce((sum, member) => sum + member.contribute, 0);
    const legacyExpenses = members.filter(member => member.role === 'Расход').reduce((sum, member) => sum + member.contribute, 0);
    const expenses = familyExpenses.reduce((sum, expense) => sum + expense.amount, legacyExpenses);
    const currentMonth = getToday().slice(0, 7);
    const goalPlans = goals.map(goal => {
      const currentSavings = goal.currentSavings ?? 0;
      const remaining = Math.max(0, goal.target - currentSavings);
      const plannedContribution = goal.isPaused ? 0 : goal.monthlyContribution ?? 0;
      const monthsLeft = getMonthsUntil(goal.targetDate);
      const requiredMonthly = monthsLeft ? Math.ceil(remaining / monthsLeft) : null;
      const progress = goal.target > 0 ? Math.min(100, Math.round((currentSavings / goal.target) * 100)) : 0;
      const actualThisMonth = (goal.activity ?? []).filter(item => item.date.startsWith(currentMonth)).reduce((sum, item) => sum + item.amount, 0);
      const shares = getShares(goal, incomeMembers, plannedContribution);
      const planStatus = remaining === 0 ? 'done' : goal.isPaused ? 'paused' : requiredMonthly === null ? 'missing-date' : plannedContribution >= requiredMonthly ? 'on-track' : 'at-risk';
      const factStatus = goal.isPaused || remaining === 0 || plannedContribution === 0 ? 'not-applicable' : actualThisMonth >= plannedContribution ? 'funded' : 'missing';
      const projectedDate = formatProjectedDate(remaining, plannedContribution);
      return { ...goal, currentSavings, remaining, plannedContribution, monthsLeft, requiredMonthly, progress, actualThisMonth, shares, planStatus, factStatus, projectedDate };
    }).sort((a, b) => {
      const statusOrder: Record<string, number> = { 'at-risk': 0, 'missing-date': 1, paused: 2, 'on-track': 3, done: 4 };
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return statusOrder[a.planStatus] - statusOrder[b.planStatus] || priorityOrder[a.priority ?? 'medium'] - priorityOrder[b.priority ?? 'medium'] || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999');
    });
    const planned = goalPlans.reduce((sum, goal) => sum + goal.plannedContribution, 0);
    const actualThisMonth = goalPlans.reduce((sum, goal) => sum + goal.actualThisMonth, 0);
    const fund = goalPlans.reduce((sum, goal) => sum + goal.currentSavings, 0);
    const required = goalPlans.reduce((sum, goal) => sum + (goal.requiredMonthly ?? 0), 0);
    return { income, expenses, available: income - expenses, planned, actualThisMonth, fund, required, unallocated: income - expenses - planned, goalPlans };
  }, [members, familyExpenses, goals]);

  const addContribution = (event: FormEvent, goal: FamilyGoal) => {
    event.preventDefault();
    const amount = Number(contributionAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const activity: GoalActivity = { id: `${Date.now()}-${amount}`, amount, date: contributionDate, memberId: contributionMemberId || undefined };
    saveGoals(goals.map(item => item.id === goal.id ? { ...item, currentSavings: (item.currentSavings ?? 0) + amount, activity: [...(item.activity ?? []), activity] } : item));
    setContributionAmount('');
    setContributionGoalId(null);
  };

  const togglePause = (id: string) => saveGoals(goals.map(goal => goal.id === id ? { ...goal, isPaused: !goal.isPaused } : goal));
  const activities = plan.goalPlans.flatMap(goal => (goal.activity ?? []).map(activity => ({ ...activity, goalTitle: goal.title, memberName: members.find(member => member.id === activity.memberId)?.name }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const nextGoal = plan.goalPlans.find(goal => goal.planStatus === 'at-risk' || goal.planStatus === 'missing-date') ?? plan.goalPlans[0];

  return (
    <div className="page-grid">
      <section className="hero-panel compact family-hero">
        <div><p className="eyebrow">Семейный режим</p><h2>{plan.unallocated < 0 ? 'План требует пересмотра' : 'Свободные деньги распределены'}</h2><p>{plan.unallocated < 0 ? `Для текущих планов не хватает ${formatCurrency(Math.abs(plan.unallocated))}/мес.` : `После всех плановых взносов остаётся ${formatCurrency(plan.unallocated)}/мес.`}</p></div>
        <Link className="hero-action" to="/settings">Управлять планом</Link>
      </section>

      <section className="family-summary" aria-label="Сводка семейного бюджета">
        <article className="card total-card income"><span>Доходы семьи</span><strong>{formatCurrency(plan.income)}</strong><p>Регулярные поступления всех участников.</p></article>
        <article className="card total-card expenses"><span>Обязательные расходы</span><strong>{formatCurrency(plan.expenses)}</strong><p>Вычитаются до распределения на цели.</p></article>
        <article className="card total-card"><span>Свободно в месяц</span><strong>{formatCurrency(plan.available)}</strong><p>Доходы минус обязательные расходы.</p></article>
        <article className="card total-card"><span>Нужно для дедлайнов</span><strong>{formatCurrency(plan.required)}</strong><p>Запланировано {formatCurrency(plan.planned)}/мес.</p></article>
        <article className="card total-card"><span>Внесено в этом месяце</span><strong>{formatCurrency(plan.actualThisMonth)}</strong><p>Фактические пополнения фондов.</p></article>
      </section>

      {nextGoal && <section className={`family-alert ${nextGoal.planStatus}`}><strong>{nextGoal.title}</strong><span>{nextGoal.planStatus === 'at-risk' ? `Не хватает ${formatCurrency(Math.max(0, (nextGoal.requiredMonthly ?? 0) - nextGoal.plannedContribution))}/мес до дедлайна.` : nextGoal.planStatus === 'missing-date' ? 'Укажите дедлайн, чтобы проверить выполнимость.' : `Ближайшая цель: ${formatDeadline(nextGoal.targetDate)}.`}</span></section>}

      <section className="card large">
        <div className="card-head"><div><h2>Семейные цели</h2><p className="settings-note">Сначала показаны цели с риском срыва срока.</p></div><Link className="text-link" to="/settings">Добавить цель</Link></div>
        {plan.goalPlans.length ? <div className="family-goal-grid">{plan.goalPlans.map(goal => (
          <article key={goal.id} className="family-goal-card">
            <div className="goal-plan-head"><div><span className={`goal-priority ${goal.priority ?? 'medium'}`}>{priorityLabel(goal.priority)}</span><h3>{goal.title}</h3></div><span className="goal-type">{formatDeadline(goal.targetDate)}</span></div>
            <div className="goal-progress-label"><span>Накоплено</span><strong>{goal.progress}%</strong></div><div className="bar-track"><span style={{ width: `${goal.progress}%` }} /></div><div className="goal-progress-numbers"><span>{formatCurrency(goal.currentSavings)}</span><span>из {formatCurrency(goal.target)}</span></div>
            <div className={`family-goal-status ${goal.planStatus}`}>{goal.planStatus === 'done' ? 'Цель достигнута' : goal.planStatus === 'paused' ? 'План на паузе' : goal.planStatus === 'missing-date' ? 'Добавьте дедлайн, чтобы проверить план' : goal.planStatus === 'on-track' ? `План достаточен: ${formatCurrency(goal.plannedContribution)}/мес` : `Плану не хватает ${formatCurrency(Math.max(0, (goal.requiredMonthly ?? 0) - goal.plannedContribution))}/мес`}</div>
            {goal.factStatus !== 'not-applicable' && <div className={`family-goal-fact ${goal.factStatus}`}>{goal.factStatus === 'funded' ? `В этом месяце внесено ${formatCurrency(goal.actualThisMonth)}` : `Не внесено ${formatCurrency(Math.max(0, goal.plannedContribution - goal.actualThisMonth))} из плана этого месяца`}</div>}
            <p className="settings-note">Осталось {formatCurrency(goal.remaining)}{goal.requiredMonthly ? ` · необходимо ${formatCurrency(goal.requiredMonthly)}/мес` : ''} · текущий темп: {goal.projectedDate}</p>
            <p className="settings-note">Вклад: {goal.shares.length ? goal.shares.map(share => `${share.name} ${formatCurrency(share.amount)}`).join(' · ') : 'участники не назначены'}</p>
            <div className="goal-card-actions"><button type="button" className="text-link" onClick={() => { setContributionGoalId(goal.id); setContributionMemberId(goal.memberIds?.[0] ?? ''); }}>Пополнить</button><button type="button" className="text-link" onClick={() => togglePause(goal.id)}>{goal.isPaused ? 'Возобновить' : 'Пауза'}</button><Link className="text-link" to="/settings">Изменить план</Link></div>
            {contributionGoalId === goal.id && <form className="goal-contribution-form" onSubmit={event => addContribution(event, goal)}><input autoFocus value={contributionAmount} onChange={event => setContributionAmount(event.target.value)} type="number" min="1" inputMode="decimal" placeholder="Сумма, ₽" aria-label="Сумма пополнения" /><select value={contributionMemberId} onChange={event => setContributionMemberId(event.target.value)} aria-label="Кто пополнил"><option value="">Без участника</option>{members.filter(member => member.role !== 'Расход').map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select><input value={contributionDate} onChange={event => setContributionDate(event.target.value)} type="date" aria-label="Дата пополнения" /><button type="submit">Сохранить</button></form>}
          </article>
        ))}</div> : <div className="empty-cell">Добавьте семейную цель с накопленной суммой и дедлайном в <Link to="/settings">Настройках</Link>.</div>}
      </section>

      <section className="content-grid">
        <div className="card large"><h2>Активность фондов</h2>{activities.length ? <ul className="family-activity">{activities.map(item => <li key={item.id}><span>{formatDate(item.date)} · {item.goalTitle}{item.memberName ? ` · ${item.memberName}` : ''}</span><strong>+{formatCurrency(item.amount)}</strong></li>)}</ul> : <div className="empty-cell">Пополнения целей появятся здесь.</div>}</div>
        <div className="card large"><h2>Доходы семьи</h2><div className="settings-list">{members.filter(member => member.role !== 'Расход').length ? members.filter(member => member.role !== 'Расход').map(member => <div key={member.id} className="settings-row"><div><strong>{member.name}</strong><p>Регулярный доход</p></div><strong>+{formatCurrency(member.contribute)}/мес</strong></div>) : <div className="empty-cell">Добавьте источники дохода в <Link to="/settings">Настройках</Link>.</div>}</div></div>
      </section>
    </div>
  );
}
