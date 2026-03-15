const API_BASE = '/api';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('bhl_refresh_token');
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      localStorage.setItem('bhl_token', json.data.access_token);
      localStorage.setItem('bhl_refresh_token', json.data.refresh_token);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const buildHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('bhl_token');
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

  const json = await res.json();

  if (!res.ok || !json.success) {
    // Nếu vẫn 401 sau refresh, chuyển về trang login
    if (res.status === 401 && typeof window !== 'undefined') {
      clearAuth();
      window.location.href = '/login';
    }
    throw new Error(json.error?.message || `API error: ${res.status}`);
  }

  return json;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('bhl_token');
}

export function getUser(): { id: string; username: string; full_name: string; role: string; warehouse_ids: string[] } | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('bhl_user');
  return data ? JSON.parse(data) : null;
}

export function setAuth(token: string, user: unknown, refreshToken?: string) {
  localStorage.setItem('bhl_token', token);
  localStorage.setItem('bhl_user', JSON.stringify(user));
  if (refreshToken) {
    localStorage.setItem('bhl_refresh_token', refreshToken);
  }
}

export function clearAuth() {
  localStorage.removeItem('bhl_token');
  localStorage.removeItem('bhl_user');
  localStorage.removeItem('bhl_refresh_token');
}
