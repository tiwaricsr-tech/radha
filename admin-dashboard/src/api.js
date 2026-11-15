const API_BASE = import.meta.env.VITE_API_URL || '';

const TOKEN_KEY = 'shree_unified_auth_token';
const USER_KEY = 'shree_unified_auth_user';

const memoryStore = new Map();
let activeToken = null;
let activeAdminUser = null;

export const safeStorage = {
  getItem(key) {
    if (memoryStore.has(key)) return memoryStore.get(key);
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null && val !== 'undefined' && val !== 'null') return val;
    } catch {
      // ignore iframe storage restriction
    }
    return null;
  },
  setItem(key, value) {
    memoryStore.set(key, String(value));
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // ignore iframe storage restriction
    }
  },
  removeItem(key) {
    memoryStore.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore iframe storage restriction
    }
  }
};

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function setAdminSession(token, user) {
  if (token) {
    activeToken = token;
    safeStorage.setItem(TOKEN_KEY, token);
  }
  if (user) {
    activeAdminUser = user;
    safeStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAdminSession() {
  activeToken = null;
  activeAdminUser = null;
  safeStorage.removeItem(TOKEN_KEY);
  safeStorage.removeItem(USER_KEY);
  safeStorage.removeItem('shree_admin_oauth_token');
  safeStorage.removeItem('shree_admin_oauth_user');
  safeStorage.removeItem('shree_customer_oauth_token');
  safeStorage.removeItem('shree_customer_oauth_user');
}

// Bootstrap SSO token or logout flag from URL query parameters on load
(function bootstrapSsoFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('logout') === '1') {
      clearAdminSession();
      url.searchParams.delete('logout');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      return;
    }
    const ssoToken = url.searchParams.get('sso_token');
    if (ssoToken) {
      const payload = decodeJwtPayload(ssoToken);
      if (payload && payload.email) {
        setAdminSession(ssoToken, {
          _id: payload.id,
          id: payload.id,
          name: payload.name || payload.email.split('@')[0],
          email: payload.email,
          role: payload.role || 'customer',
          avatar: payload.avatar || ''
        });
      }
      url.searchParams.delete('sso_token');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  } catch {
    // ignore URL parse error
  }
})();

export function getActiveToken() {
  return activeToken || safeStorage.getItem(TOKEN_KEY);
}

export function getStorefrontUrl(explicitToken = null, isLogout = false) {
  let baseOrigin = '';
  if (typeof window !== 'undefined') {
    if (window.location.port === '5174') {
      baseOrigin = `${window.location.protocol}//${window.location.hostname}:5173`;
    } else if (window.location.hostname.startsWith('5174-')) {
      baseOrigin = `${window.location.protocol}//${window.location.hostname.replace(/^5174-/, '5173-')}`;
    }
  }
  if (isLogout) {
    return `${baseOrigin}/?logout=1`;
  }
  const tok = explicitToken || getActiveToken();
  if (tok && tok !== 'null' && tok !== 'undefined') {
    return `${baseOrigin}/?sso_token=${encodeURIComponent(tok)}&mode=storefront`;
  }
  return `${baseOrigin}/`;
}

export function navigateToStorefront(explicitToken = null, isLogout = false) {
  window.location.href = getStorefrontUrl(explicitToken, isLogout);
}

export function getSavedAdminUser() {
  if (activeAdminUser && activeToken && activeAdminUser.role === 'admin') return activeAdminUser;
  try {
    const savedToken = safeStorage.getItem(TOKEN_KEY);
    const rawUser = safeStorage.getItem(USER_KEY);
    if (savedToken && rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed && parsed.email) {
        activeToken = savedToken;
        activeAdminUser = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

export async function apiRequest(path, options = {}) {
  const token = getActiveToken();
  const validToken = token && token !== 'undefined' && token !== 'null' ? token : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(validToken
        ? {
            Authorization: `Bearer ${validToken}`,
            'X-Auth-Token': validToken,
            'X-Admin-Token': validToken
          }
        : {}),
      ...(options.headers || {})
    };

    const sep = path.includes('?') ? '&' : '?';
    const finalUrl = validToken
      ? `${API_BASE}${path}${sep}authToken=${encodeURIComponent(validToken)}`
      : `${API_BASE}${path}`;

    const res = await fetch(finalUrl, {
      ...options,
      headers,
      signal: controller.signal
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function subscribeRealtime(onEvent) {
  let lastVersion = null;

  const checkSync = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sync`);
      if (!res.ok) return;
      const data = await res.json();
      if (lastVersion !== null && data.version !== lastVersion) {
        onEvent(data.lastEvent?.event || 'analytics:updated', {});
      }
      lastVersion = data.version;
    } catch {
      // ignore transient network error
    }
  };

  checkSync();
  const pollTimer = setInterval(checkSync, 2500);
  return () => clearInterval(pollTimer);
}
