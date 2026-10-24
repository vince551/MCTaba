const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'mctaba_api_token';

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  let result = {};
  try { result = await response.json(); } catch { /* response has no JSON body */ }

  if (!response.ok) {
    const validationMessage = result.errors && Object.values(result.errors).flat()[0];
    const error = new Error(validationMessage || result.message || result.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function signIn(email, password) {
  const result = await apiRequest('/api/auth/login', { method: 'POST', body: { email, password } });
  setAuthToken(result.token);
  return result.user;
}

export async function signUp(name, email, password) {
  const result = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: { name, email, password, password_confirmation: password },
  });
  setAuthToken(result.token);
  return result.user;
}

export async function signOut() {
  try { if (getAuthToken()) await apiRequest('/api/auth/logout', { method: 'POST' }); }
  finally { setAuthToken(null); }
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    uid: String(user.id),
    displayName: user.name || user.display_name || user.email,
  };
}

export function normalizeBook(book) {
  const copies = Number(book.total_copies ?? book.copies_count ?? book.copies ?? 0);
  const available = Number(book.available_copies ?? book.available ?? 0);
  return {
    ...book,
    id: String(book.id),
    category: book.category || 'Uncategorized',
    isbn: book.isbn || '',
    copies,
    available,
    status: available === 0 ? 'All borrowed' : available <= 3 ? 'Low stock' : 'Available',
    color: 'sage',
  };
}
