import { createContext, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  email: string;
}

interface AuthResult {
  success: boolean;
  message?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => AuthResult;
  register: (email: string, password: string) => AuthResult;
  resetPassword: (email: string, password: string) => AuthResult;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const storageKeyUser = 'moneypilot-user';
const storageKeyUsers = 'moneypilot-users';

function readUsers() {
  if (typeof window === 'undefined') return [] as Array<{ email: string; password: string }>;
  const raw = window.localStorage.getItem(storageKeyUsers);
  if (!raw) return [] as Array<{ email: string; password: string }>;
  try {
    return JSON.parse(raw) as Array<{ email: string; password: string }>;
  } catch {
    return [];
  }
}

function writeUsers(users: Array<{ email: string; password: string }>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKeyUsers, JSON.stringify(users));
}

function readCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKeyUser);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function writeCurrentUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    window.localStorage.setItem(storageKeyUser, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(storageKeyUser);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => (typeof window !== 'undefined' ? readCurrentUser() : null));

  useEffect(() => {
    writeCurrentUser(user);
  }, [user]);

  const login = (email: string, password: string): AuthResult => {
    const users = readUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) {
      return { success: false, message: 'Пользователь не найден. Проверьте email или зарегистрируйтесь.' };
    }
    if (found.password !== password) {
      return { success: false, message: 'Неверный пароль. Попробуйте снова.' };
    }
    const authUser = { email: found.email };
    setUser(authUser);
    return { success: true };
  };

  const register = (email: string, password: string): AuthResult => {
    const users = readUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, message: 'Пользователь с этим email уже существует.' };
    }
    const normalizedEmail = email.trim().toLowerCase();
    users.push({ email: normalizedEmail, password });
    writeUsers(users);
    setUser({ email: normalizedEmail });
    return { success: true };
  };

  const resetPassword = (email: string, password: string): AuthResult => {
    const users = readUsers();
    const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (index === -1) {
      return { success: false, message: 'Такой email не найден. Проверьте адрес.' };
    }
    users[index].password = password;
    writeUsers(users);
    setUser({ email: users[index].email });
    return { success: true, message: 'Пароль обновлён. Вы уже вошли в систему.' };
  };

  const logout = () => {
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, register, resetPassword, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
