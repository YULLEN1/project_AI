export type AccountKind = 'cash' | 'reserve' | 'goal' | 'member';
export type AccountScope = 'personal' | 'family';

export type Account = {
  id: string;
  name: string;
  openingBalance: number;
  spendable: boolean;
  /** Persisted for new data; omitted values are normalized when finance data is read or saved. */
  kind?: AccountKind;
  scope?: AccountScope;
  goalId?: string;
  memberId?: string;
  archived?: boolean;
};

export type TransactionType = 'income' | 'expense' | 'transfer' | 'goal-contribution' | 'reconciliation';
export type TransactionStatus = 'completed' | 'planned' | 'cancelled';

export type Transaction = {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  title: string;
  amount: number;
  date: string;
  accountId: string;
  toAccountId?: string;
  category?: string;
  note?: string;
  goalId?: string;
  paymentId?: string;
  reconciliation?: {
    expectedBalance: number;
    actualBalance: number;
    adjustment: number;
  };
};

export type ReconciliationTransaction = Readonly<Transaction & {
  type: 'reconciliation';
  status: 'completed';
  reconciliation: {
    expectedBalance: number;
    actualBalance: number;
    adjustment: number;
  };
}>;

export type ReconciliationInput = {
  id?: string;
  accountId: string;
  expectedBalance: number;
  actualBalance: number;
  date?: string;
  title?: string;
};

export type PlannedPayment = {
  id: string;
  title: string;
  amount: number;
  dueDay: number;
  category: string;
  active: boolean;
};

const keys = {
  accounts: 'moneypilot-accounts',
  transactions: 'moneypilot-transactions',
  plannedPayments: 'moneypilot-planned-payments',
  migrated: 'moneypilot-finance-migrated-v1',
  paymentsMigrated: 'moneypilot-planned-payments-migrated-v2',
  accountMetadataMigrated: 'moneypilot-account-metadata-migrated-v3',
};

export const defaultAccount: Account = { id: 'main', name: 'Основной счёт', openingBalance: 0, spendable: true, kind: 'cash', scope: 'personal' };
export function goalAccountId(goalId: string) { return `goal-account-${goalId}`; }
export function memberAccountId(memberId: string) { return `member-account-${memberId}`; }

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function dateOnly(value: Date | string = new Date()) {
  if (typeof value === 'string') return value.slice(0, 10);
  const now = value;
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function today() { return dateOnly(); }

export function isDateOnlyInRange(date: string, from: string, through: string) {
  const normalizedDate = dateOnly(date);
  return normalizedDate >= dateOnly(from) && normalizedDate <= dateOnly(through);
}

function accountMetadata(account: Account): Pick<Account, 'kind' | 'scope'> {
  const persistedKind = account.kind === 'cash' || account.kind === 'reserve' || account.kind === 'goal' || account.kind === 'member'
    ? account.kind : undefined;
  const kind = persistedKind || (account.goalId || account.id.startsWith('goal-account-') ? 'goal'
    : account.memberId || account.id.startsWith('member-account-') ? 'member'
      : account.id === 'reserve' || !account.spendable ? 'reserve' : 'cash');
  const scope = (account.scope === 'personal' || account.scope === 'family') ? account.scope : (kind === 'member' || account.goalId?.startsWith('family-') ? 'family' : 'personal');
  return { kind, scope };
}

function normalizeAccounts(accounts: Account[]) {
  return accounts.map(account => ({ ...account, ...accountMetadata(account) }));
}

function asAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function ensureFinanceData() {
  if (typeof window === 'undefined') return;
  const existingAccounts = readJson<Account[]>(keys.accounts, []);
  const existingTransactions = readJson<Transaction[]>(keys.transactions, []);
  if (window.localStorage.getItem(keys.migrated)) {
    if (!existingAccounts.length) saveAccounts([defaultAccount]);
    if (!window.localStorage.getItem(keys.accountMetadataMigrated)) {
      saveAccounts(existingAccounts.length ? existingAccounts : [defaultAccount]);
      window.localStorage.setItem(keys.accountMetadataMigrated, 'true');
    }
    migrateFamilyExpensesToPlannedPayments();
    migrateGoalAccounts();
    migrateMemberAccounts();
    return;
  }

  const accounts = existingAccounts.length ? existingAccounts : [defaultAccount];
  const transactions = [...existingTransactions];
  const oldPurchases = readJson<Array<{ title?: string; amount?: number; category?: string; date?: string }>>('moneypilot-purchases', []);
  const oldIncome = readJson<Array<{ id?: string; source?: string; amount?: number; date?: string; status?: string }>>('moneypilot-income-events', []);
  const oldFamilyExpenses = readJson<Array<{ id?: string; name?: string; amount?: number }>>('moneypilot-family-expenses', []);
  const savings = Number(window.localStorage.getItem('moneypilot-savings'));

  oldPurchases.forEach((purchase, index) => {
    const amount = asAmount(purchase.amount);
    if (amount) transactions.push({ id: `legacy-expense-${index}`, type: 'expense', status: 'completed', title: purchase.title || 'Расход', amount, date: purchase.date || today(), accountId: 'main', category: purchase.category || 'Разное' });
  });
  oldIncome.filter(event => event.status === 'received').forEach((income, index) => {
    const amount = asAmount(income.amount);
    if (amount) transactions.push({ id: `legacy-income-${income.id || index}`, type: 'income', status: 'completed', title: income.source || 'Поступление', amount, date: income.date || today(), accountId: 'main' });
  });
  if (Number.isFinite(savings) && savings > 0 && !accounts.some(account => account.id === 'reserve')) {
    accounts.push({ id: 'reserve', name: 'Накопления', openingBalance: savings, spendable: false });
  }

  saveAccounts(accounts);
  saveTransactions(transactions);
  const payments = readJson<PlannedPayment[]>(keys.plannedPayments, []);
  if (!payments.length && oldFamilyExpenses.length) savePlannedPayments(oldFamilyExpenses.flatMap((expense, index) => {
    const amount = asAmount(expense.amount);
    return amount ? [{ id: `family-expense-${expense.id || index}`, title: expense.name || 'Обязательный платёж', amount, dueDay: 1, category: 'Обязательные платежи', active: true }] : [];
  }));
  window.localStorage.setItem(keys.migrated, 'true');
  window.localStorage.setItem(keys.accountMetadataMigrated, 'true');
  migrateFamilyExpensesToPlannedPayments();
  migrateGoalAccounts();
  migrateMemberAccounts();
}

function migrateFamilyExpensesToPlannedPayments() {
  if (window.localStorage.getItem(keys.paymentsMigrated)) return;
  const familyExpenses = readJson<Array<{ id?: string; name?: string; amount?: number }>>('moneypilot-family-expenses', []);
  const payments = readJson<PlannedPayment[]>(keys.plannedPayments, []);
  const additions = familyExpenses.flatMap((expense, index) => {
    const id = `family-expense-${expense.id || index}`;
    const amount = asAmount(expense.amount);
    return amount && !payments.some(payment => payment.id === id)
      ? [{ id, title: expense.name || 'Обязательный платёж', amount, dueDay: 1, category: 'Обязательные платежи', active: true }]
      : [];
  });
  if (additions.length) savePlannedPayments([...payments, ...additions]);
  window.localStorage.setItem(keys.paymentsMigrated, 'true');
}

function migrateGoalAccounts() {
  const accounts = readJson<Account[]>(keys.accounts, []);
  const personalGoals = readJson<Array<{ id?: string; name?: string; currentSavings?: number }>>('moneypilot-savings-goals', []);
  const familyGoals = readJson<Array<{ id?: string; title?: string; currentSavings?: number }>>('moneypilot-family-goals', []);
  const goalAccounts = [
    ...personalGoals.flatMap(goal => goal.id ? [{ id: goal.id, name: goal.name || 'цель', balance: Math.max(0, Number(goal.currentSavings) || 0), family: false }] : []),
    ...familyGoals.flatMap(goal => goal.id ? [{ id: `family-${goal.id}`, name: goal.title || 'цель', balance: Math.max(0, Number(goal.currentSavings) || 0), family: true }] : []),
  ].filter(goal => !accounts.some(account => account.id === goalAccountId(goal.id)));
  if (goalAccounts.length) saveAccounts([...accounts, ...goalAccounts.map(goal => ({ id: goalAccountId(goal.id), name: `${goal.family ? 'Семейная цель' : 'Цель'}: ${goal.name}`, openingBalance: goal.balance, spendable: false, goalId: goal.id }))]);
}

function migrateMemberAccounts() {
  const accounts = readJson<Account[]>(keys.accounts, []);
  const members = readJson<Array<{ id?: string; name?: string; role?: string }>>('moneypilot-family-members', []);
  const additions = members
    .filter(member => member.id && member.role !== 'Расход' && !accounts.some(account => account.id === memberAccountId(member.id!)))
    .map(member => ({ id: memberAccountId(member.id!), name: `Счёт: ${member.name || 'участник'}`, openingBalance: 0, spendable: true, memberId: member.id }));
  if (additions.length) saveAccounts([...accounts, ...additions]);
}

function syncMemberMonthlyIncome() {
  const currentDate = today();
  const month = currentDate.slice(0, 7);
  const members = readJson<Array<{ id?: string; name?: string; role?: string; contribute?: number; incomeDay?: number }>>('moneypilot-family-members', []);
  const accounts = readJson<Account[]>(keys.accounts, []);
  const transactions = readJson<Transaction[]>(keys.transactions, []);
  const additions = members.flatMap(member => {
    const amount = asAmount(member.contribute);
    const accountId = member.id ? memberAccountId(member.id) : '';
    const id = `family-member-income-${member.id}-${month}`;
    const dueDay = Math.min(Math.max(1, Math.floor(Number(member.incomeDay) || 1)), monthDates(currentDate).lastDay);
    const dueDate = `${month}-${String(dueDay).padStart(2, '0')}`;
    if (!member.id || member.role === 'Расход' || !amount || currentDate < dueDate || !accounts.some(account => account.id === accountId) || transactions.some(transaction => transaction.id === id)) return [];
    return [{ id, type: 'income' as const, status: 'completed' as const, title: `Регулярный доход: ${member.name || 'участник'}`, amount, date: dueDate, accountId }];
  });
  if (additions.length) saveTransactions([...transactions, ...additions]);
}

export function getAccounts() { ensureFinanceData(); syncMemberMonthlyIncome(); return normalizeAccounts(readJson<Account[]>(keys.accounts, [defaultAccount])); }
export function getTransactions() { ensureFinanceData(); syncMemberMonthlyIncome(); return readJson<Transaction[]>(keys.transactions, []); }
export function getPlannedPayments() { ensureFinanceData(); return readJson<PlannedPayment[]>(keys.plannedPayments, []); }
export function saveAccounts(accounts: Account[]) { window.localStorage.setItem(keys.accounts, JSON.stringify(normalizeAccounts(accounts))); }
export function saveTransactions(transactions: Transaction[]) { window.localStorage.setItem(keys.transactions, JSON.stringify(transactions)); }
export function savePlannedPayments(payments: PlannedPayment[]) { window.localStorage.setItem(keys.plannedPayments, JSON.stringify(payments)); }

export function accountBalances(accounts: Account[], transactions: Transaction[], throughDate = today()) {
  const balances = Object.fromEntries(accounts.map(account => [account.id, account.openingBalance])) as Record<string, number>;
  // A completed entry dated in the future is not part of any current balance.
  const effectiveThroughDate = [dateOnly(throughDate), today()].sort()[0];
  transactions.filter(item => item.status === 'completed' && dateOnly(item.date) <= effectiveThroughDate).forEach(item => {
    if (item.type === 'income') balances[item.accountId] = (balances[item.accountId] || 0) + item.amount;
    // Goal entries without a destination are legacy opening balances, not transfers from this account.
    if (item.type === 'expense' || (item.type === 'goal-contribution' && item.toAccountId)) balances[item.accountId] = (balances[item.accountId] || 0) - item.amount;
    if (item.type === 'goal-contribution' && item.toAccountId) balances[item.toAccountId] = (balances[item.toAccountId] || 0) + item.amount;
    if (item.type === 'transfer') {
      balances[item.accountId] = (balances[item.accountId] || 0) - item.amount;
      if (item.toAccountId) balances[item.toAccountId] = (balances[item.toAccountId] || 0) + item.amount;
    }
    if (item.type === 'reconciliation') balances[item.accountId] = (balances[item.accountId] || 0) + item.amount;
  });
  return balances;
}

/** Creates a ledger adjustment; callers append it to transactions instead of changing an opening balance. */
export function createReconciliationTransaction(input: ReconciliationInput): ReconciliationTransaction {
  const expectedBalance = Number(input.expectedBalance);
  const actualBalance = Number(input.actualBalance);
  if (!input.accountId || !Number.isFinite(expectedBalance) || !Number.isFinite(actualBalance)) {
    throw new Error('A reconciliation requires an account and finite expected and actual balances.');
  }
  const adjustment = actualBalance - expectedBalance;
  return Object.freeze({
    id: input.id || `reconciliation-${Date.now()}`,
    type: 'reconciliation' as const,
    status: 'completed' as const,
    title: input.title || 'Сверка остатка',
    amount: adjustment,
    date: dateOnly(input.date || today()),
    accountId: input.accountId,
    reconciliation: Object.freeze({ expectedBalance, actualBalance, adjustment }),
  });
}

export function totalSpent(transactions: Transaction[], from: string, through: string) {
  return transactions.filter(item => item.type === 'expense' && item.status === 'completed' && isDateOnlyInRange(item.date, from, through)).reduce((sum, item) => sum + item.amount, 0);
}

export function monthDates(date: string) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${date.slice(0, 7)}-01`, end: `${date.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`, lastDay };
}

export type PlannedPaymentOccurrence = PlannedPayment & { dueDate: string };

/** Returns every active monthly payment occurrence due in the inclusive date-only range. */
export function plannedPaymentOccurrences(payments: PlannedPayment[], from: string, through: string): PlannedPaymentOccurrence[] {
  const start = dateOnly(from);
  const end = dateOnly(through);
  if (start > end) return [];
  const occurrences: PlannedPaymentOccurrence[] = [];
  let month = `${start.slice(0, 7)}-01`;
  while (month <= end) {
    const { lastDay } = monthDates(month);
    payments.filter(payment => payment.active).forEach(payment => {
      const dueDate = `${month.slice(0, 7)}-${String(Math.min(payment.dueDay, lastDay)).padStart(2, '0')}`;
      if (isDateOnlyInRange(dueDate, start, end)) occurrences.push({ ...payment, dueDate });
    });
    const nextMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1);
    month = dateOnly(nextMonth);
  }
  return occurrences;
}

export function plannedPaymentsUntil(payments: PlannedPayment[], date: string, through: string) {
  return plannedPaymentOccurrences(payments, date, through).reduce((sum, payment) => sum + payment.amount, 0);
}

export function plannedPaymentsReserved(payments: PlannedPayment[], transactions: Transaction[], date: string): number;
export function plannedPaymentsReserved(payments: PlannedPayment[], transactions: Transaction[], from: string, through: string): number;
export function plannedPaymentsReserved(payments: PlannedPayment[], transactions: Transaction[], date: string, through?: string) {
  // Preserve the old dashboard contract: reserve every unpaid payment for date's month.
  if (!through) return plannedPaymentsReservedForMonth(payments, transactions, date);
  const occurrences = plannedPaymentOccurrences(payments, date, through);
  const paidThrough = [dateOnly(through), today()].sort()[0];
  return payments.filter(payment => payment.active).reduce((sum, payment) => {
    const occurrenceTotal = occurrences.filter(occurrence => occurrence.id === payment.id).reduce((total, occurrence) => total + occurrence.amount, 0);
    const matchingPaymentCount = payments.filter(item => item.title.trim() === payment.title.trim()).length;
    const paid = transactions
      .filter(transaction => transaction.type === 'expense' && transaction.status === 'completed' && dateOnly(transaction.date) >= dateOnly(date) && dateOnly(transaction.date) <= paidThrough && (transaction.paymentId === payment.id || (!transaction.paymentId && matchingPaymentCount === 1 && transaction.title.trim() === payment.title.trim())))
      .reduce((paymentSum, transaction) => paymentSum + transaction.amount, 0);
    return sum + Math.max(0, occurrenceTotal - paid);
  }, 0);
}

function plannedPaymentsReservedForMonth(payments: PlannedPayment[], transactions: Transaction[], date: string) {
  const { start } = monthDates(date);
  return payments.filter(payment => payment.active).reduce((sum, payment) => {
    const matchingPaymentCount = payments.filter(item => item.title.trim() === payment.title.trim()).length;
    const paid = transactions
      .filter(transaction => transaction.type === 'expense' && transaction.status === 'completed' && transaction.date >= start && transaction.date <= date && (transaction.paymentId === payment.id || (!transaction.paymentId && matchingPaymentCount === 1 && transaction.title.trim() === payment.title.trim())))
      .reduce((paymentSum, transaction) => paymentSum + transaction.amount, 0);
    return sum + Math.max(0, payment.amount - paid);
  }, 0);
}

export type CashFlowSummary = {
  income: number;
  expenses: number;
  goalContributions: number;
  transfersIn: number;
  transfersOut: number;
  netCashFlow: number;
};

export type GoalReserve = {
  target: number;
  currentSavings: number;
  targetDate?: string;
  targetAge?: number;
  monthlyContribution?: number;
  isPaused?: boolean;
  type?: string;
  name?: string;
  monthlyPension?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
};

export function plannedGoalReserve(goals: GoalReserve[], userAge: number | null) {
  return goals.reduce((sum, goal) => {
    if (goal.isPaused) return sum;
    if (typeof goal.monthlyContribution === 'number') return sum + Math.max(0, goal.monthlyContribution);
    const isPension = goal.monthlyPension || goal.type === 'Пенсия' || goal.name?.trim().toLowerCase() === 'пенсия';
    const target = isPension
      ? (goal.monthlyPension ?? goal.target) * Math.max(0, (goal.lifeExpectancy ?? 95) - (goal.retirementAge ?? goal.targetAge ?? 60)) * 12
      : goal.target;
    const months = isPension && userAge
      ? ((goal.retirementAge ?? goal.targetAge ?? 60) - userAge) * 12
      : goal.targetDate
        ? (() => {
          const targetDate = new Date(`${goal.targetDate.length === 7 ? `${goal.targetDate}-01` : goal.targetDate}T00:00:00`);
          const now = new Date();
          return (targetDate.getFullYear() - now.getFullYear()) * 12 + targetDate.getMonth() - now.getMonth() + 1;
        })()
        : goal.targetAge && userAge ? (goal.targetAge - userAge) * 12 : 0;
    return months > 0 ? sum + Math.ceil(Math.max(0, target - goal.currentSavings) / months) : sum;
  }, 0);
}

export function cashFlowSummary(transactions: Transaction[], from: string, through: string): CashFlowSummary {
  const periodTransactions = transactions.filter(item => item.status === 'completed' && isDateOnlyInRange(item.date, from, [dateOnly(through), today()].sort()[0]));
  const summary = periodTransactions
    .reduce((result, item) => {
      if (item.type === 'income') result.income += item.amount;
      if (item.type === 'expense') result.expenses += item.amount;
      if (item.type === 'goal-contribution' && item.toAccountId) result.goalContributions += item.amount;
      if (item.type === 'transfer') {
        result.transfersOut += item.amount;
        result.transfersIn += item.amount;
      }
      return result;
    }, { income: 0, expenses: 0, goalContributions: 0, transfersIn: 0, transfersOut: 0 });
  return { ...summary, netCashFlow: summary.income - summary.expenses };
}

export function goalContributionTotal(transactions: Transaction[], from: string, through: string) {
  return transactions
    .filter(item => item.type === 'goal-contribution' && item.goalId && item.toAccountId && item.status === 'completed' && isDateOnlyInRange(item.date, from, [dateOnly(through), today()].sort()[0]))
    .reduce((sum, item) => sum + item.amount, 0);
}

export function formatCurrency(value: number) { return `${Math.abs(Math.round(value)).toLocaleString('ru-RU')} ₽`; }
