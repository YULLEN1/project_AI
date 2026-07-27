export type Account = {
  id: string;
  name: string;
  openingBalance: number;
  spendable: boolean;
};

export type TransactionType = 'income' | 'expense' | 'transfer' | 'goal-contribution';
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
};

export const defaultAccount: Account = { id: 'main', name: 'Основной счёт', openingBalance: 0, spendable: true };

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
    migrateFamilyExpensesToPlannedPayments();
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
  migrateFamilyExpensesToPlannedPayments();
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

export function getAccounts() { ensureFinanceData(); return readJson<Account[]>(keys.accounts, [defaultAccount]); }
export function getTransactions() { ensureFinanceData(); return readJson<Transaction[]>(keys.transactions, []); }
export function getPlannedPayments() { ensureFinanceData(); return readJson<PlannedPayment[]>(keys.plannedPayments, []); }
export function saveAccounts(accounts: Account[]) { window.localStorage.setItem(keys.accounts, JSON.stringify(accounts)); }
export function saveTransactions(transactions: Transaction[]) { window.localStorage.setItem(keys.transactions, JSON.stringify(transactions)); }
export function savePlannedPayments(payments: PlannedPayment[]) { window.localStorage.setItem(keys.plannedPayments, JSON.stringify(payments)); }

export function accountBalances(accounts: Account[], transactions: Transaction[], throughDate = today()) {
  const balances = Object.fromEntries(accounts.map(account => [account.id, account.openingBalance])) as Record<string, number>;
  transactions.filter(item => item.status === 'completed' && item.date <= throughDate).forEach(item => {
    if (item.type === 'income') balances[item.accountId] = (balances[item.accountId] || 0) + item.amount;
    if (item.type === 'expense' || item.type === 'goal-contribution') balances[item.accountId] = (balances[item.accountId] || 0) - item.amount;
    if (item.type === 'transfer') {
      balances[item.accountId] = (balances[item.accountId] || 0) - item.amount;
      if (item.toAccountId) balances[item.toAccountId] = (balances[item.toAccountId] || 0) + item.amount;
    }
  });
  return balances;
}

export function totalSpent(transactions: Transaction[], from: string, through: string) {
  return transactions.filter(item => item.type === 'expense' && item.status === 'completed' && item.date >= from && item.date <= through).reduce((sum, item) => sum + item.amount, 0);
}

export function monthDates(date: string) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${date.slice(0, 7)}-01`, end: `${date.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`, lastDay };
}

export function plannedPaymentsUntil(payments: PlannedPayment[], date: string, through: string) {
  return payments.filter(payment => {
    if (!payment.active) return false;
    const { lastDay } = monthDates(date);
    const due = `${date.slice(0, 7)}-${String(Math.min(payment.dueDay, lastDay)).padStart(2, '0')}`;
    return due >= date && due <= through;
  }).reduce((sum, payment) => sum + payment.amount, 0);
}

export type CashFlowSummary = {
  income: number;
  expenses: number;
  goalContributions: number;
  transfersIn: number;
  transfersOut: number;
  netCashFlow: number;
};

export function cashFlowSummary(transactions: Transaction[], from: string, through: string): CashFlowSummary {
  const summary = transactions
    .filter(item => item.status === 'completed' && item.date >= from && item.date <= through)
    .reduce((result, item) => {
      if (item.type === 'income') result.income += item.amount;
      if (item.type === 'expense') result.expenses += item.amount;
      if (item.type === 'goal-contribution') result.goalContributions += item.amount;
      if (item.type === 'transfer') {
        result.transfersOut += item.amount;
        result.transfersIn += item.amount;
      }
      return result;
    }, { income: 0, expenses: 0, goalContributions: 0, transfersIn: 0, transfersOut: 0 });
  return { ...summary, netCashFlow: summary.income - summary.expenses - summary.goalContributions };
}

export function formatCurrency(value: number) { return `${Math.abs(Math.round(value)).toLocaleString('ru-RU')} ₽`; }
