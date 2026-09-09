export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'counsel' | 'producer' | 'auditor';
  clearance: 'LEVEL_03' | 'LEVEL_04' | 'LEVEL_05';
  studio: string;
  token?: string;
}

const STORAGE_KEY = 'cineshield_session';

export const DEFAULT_USER: UserSession = {
  id: 'usr-julian-vane-01',
  name: 'Julian Vane',
  email: 'j.vane@studioalpha.com',
  role: 'admin',
  clearance: 'LEVEL_05',
  studio: 'Studio Alpha',
  token: 'csk_jwt_usr-julian-vane-01',
};

type AuthListener = (user: UserSession | null) => void;
const listeners = new Set<AuthListener>();

export function getStoredUser(): UserSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER; // Default executive session
    return JSON.parse(raw);
  } catch {
    return DEFAULT_USER;
  }
}

export function setStoredUser(user: UserSession | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((l) => l(user));
}

export function subscribeAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Authenticated API fetch helper
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const user = getStoredUser();
  const headers = new Headers(init?.headers);

  if (user) {
    if (!headers.has('x-user-id')) headers.set('x-user-id', user.id);
    if (!headers.has('x-user-email')) headers.set('x-user-email', user.email);
    if (!headers.has('x-user-role')) headers.set('x-user-role', user.role === 'admin' ? 'admin' : 'user');
    if (!headers.has('x-user-name')) headers.set('x-user-name', user.name);
    if (!headers.has('x-user-clearance')) headers.set('x-user-clearance', user.clearance);
    if (!headers.has('authorization') && user.token) {
      headers.set('authorization', `Bearer ${user.token}`);
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
