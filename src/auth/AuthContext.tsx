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
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const storageKeyUser = 'moneypilot-user';
const storageKeyUsers = 'moneypilot-users';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface StoredUser {
  email: string;
  passwordHash: string;
}

function readUsers(): StoredUser[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(storageKeyUsers);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ email: string; password: string; passwordHash?: string }>;
    return parsed.map(u => ({
      email: u.email,
      passwordHash: u.passwordHash || u.password,
    }));
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
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

  const login = async (email: string, password: string): Promise<AuthResult> => {
    const users = readUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) {
      return { success: false, message: 'Пользователь не найден. Проверьте email или зарегистрируйтесь.' };
    }
    const hash = await hashPassword(password);
    if (found.passwordHash !== hash) {
      return { success: false, message: 'Неверный пароль. Попробуйте снова.' };
    }
    const authUser = { email: found.email };
    setUser(authUser);
    return { success: true };
  };

  const register = async (email: string, password: string): Promise<AuthResult> => {
    const users = readUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, message: 'Пользователь с этим email уже существует.' };
    }
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    users.push({ email: normalizedEmail, passwordHash });
    writeUsers(users);
    setUser({ email: normalizedEmail });
    return { success: true };
  };

  const resetPassword = async (email: string, password: string): Promise<AuthResult> => {
    const users = readUsers();
    const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (index === -1) {
      return { success: false, message: 'Такой email не найден. Проверьте адрес.' };
    }
    users[index].passwordHash = await hashPassword(password);
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
