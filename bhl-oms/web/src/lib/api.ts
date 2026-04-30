const API_BASE = '/api';

const AUTH_KEYS = {
  token: 'bhl_token',
  refreshToken: 'bhl_refresh_token',
  user: 'bhl_user',
} as const;

const LEGACY_AUTH_KEYS = {
  token: ['access_token'],
  refreshToken: ['refresh_token'],
  user: ['user'],
} as const;

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function readStorage(key: string, legacyKeys: readonly string[] = []): string | null {
  const current = localStorage.getItem(key);
  if (current) return current;

  for (const legacyKey of legacyKeys) {
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue) {
      localStorage.setItem(key, legacyValue);
      localStorage.removeItem(legacyKey);
      return legacyValue;
    }
  }

  return null;
}

function getStoredToken(): string | null {
  return readStorage(AUTH_KEYS.token, LEGACY_AUTH_KEYS.token);
}

function getStoredRefreshToken(): string | null {
  return readStorage(AUTH_KEYS.refreshToken, LEGACY_AUTH_KEYS.refreshToken);
}

function getStoredUser(): string | null {
  return readStorage(AUTH_KEYS.user, LEGACY_AUTH_KEYS.user);
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const json = await res.json();
    const tokens = json.data?.tokens || json.data;
    if (res.ok && json.success && tokens?.access_token && tokens?.refresh_token) {
      localStorage.setItem(AUTH_KEYS.token, tokens.access_token);
      localStorage.setItem(AUTH_KEYS.refreshToken, tokens.refresh_token);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

export async function ensureValidAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const token = getStoredToken();
  if (!token) return null;

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return token;

  try {
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return token;

    const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized));
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    const now = Math.floor(Date.now() / 1000);
    if (exp > now + 30) {
      return token;
    }
  } catch {
    return token;
  }

  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = tryRefreshToken().finally(() => {
      isRefreshing = false;
    });
  }

  const refreshed = await refreshPromise;
  return refreshed ? getStoredToken() : token;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const traceId = crypto.randomUUID();

  const buildHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Trace-ID': traceId,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (typeof window !== 'undefined') {
      const stored = getStoredToken();
      if (stored) {
        headers['Authorization'] = `Bearer ${stored}`;
      }
    }
    return headers;
  };

  let res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  // Nếu bị 401, thử refresh token rồi gọi lại
  if (res.status === 401 && !token && typeof window !== 'undefined') {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => { isRefreshing = false; });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server trả về lỗi ${res.status}. Vui lòng thử lại.`);
  }

  if (!res.ok || !json.success) {
    // Nếu vẫn 401 sau refresh, chuyển về trang login
    if (res.status === 401 && typeof window !== 'undefined') {
      clearAuth();
      window.location.href = '/login';
    }
    const errMsg = json.error?.message || `API error: ${res.status}`;
    const serverTraceId = res.headers.get('X-Trace-ID') || traceId;
    throw new Error(`${errMsg} [trace: ${serverTraceId}]`);
  }

  return json;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return getStoredToken();
}

export function getUser(): { id: string; username: string; full_name: string; role: string; warehouse_ids: string[] } | null {
  if (typeof window === 'undefined') return null;
  const data = getStoredUser();
  return data ? JSON.parse(data) : null;
}

export function setAuth(token: string, user: unknown, refreshToken?: string) {
  localStorage.setItem(AUTH_KEYS.token, token);
  localStorage.setItem(AUTH_KEYS.user, JSON.stringify(user));
  if (refreshToken) {
    localStorage.setItem(AUTH_KEYS.refreshToken, refreshToken);
  }
  for (const legacyKey of LEGACY_AUTH_KEYS.token) localStorage.removeItem(legacyKey);
  for (const legacyKey of LEGACY_AUTH_KEYS.refreshToken) localStorage.removeItem(legacyKey);
  for (const legacyKey of LEGACY_AUTH_KEYS.user) localStorage.removeItem(legacyKey);
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEYS.token);
  localStorage.removeItem(AUTH_KEYS.user);
  localStorage.removeItem(AUTH_KEYS.refreshToken);
  for (const legacyKey of LEGACY_AUTH_KEYS.token) localStorage.removeItem(legacyKey);
  for (const legacyKey of LEGACY_AUTH_KEYS.refreshToken) localStorage.removeItem(legacyKey);
  for (const legacyKey of LEGACY_AUTH_KEYS.user) localStorage.removeItem(legacyKey);
}
