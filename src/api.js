import { supabase } from './supabase.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://mctaba-test-api.onrender.com').replace(/\/$/, '');

async function getUsableSession() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  let session = data.session;
  if (!session) return null;

  // Refresh shortly before expiry so the API never receives a stale access token.
  if (session.expires_at && session.expires_at * 1000 <= Date.now() + 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    session = refreshed.data.session;
  }
  return session;
}

async function sendApiRequest(url, options, session) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
}

export async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const options = {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };

  let session = await getUsableSession();
  let response = await sendApiRequest(url, options, session);

  // A token can be revoked or expire between the session check and the API call.
  // Refresh once and retry; never loop indefinitely.
  if (response.status === 401 && supabase && session) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session) {
      session = refreshed.data.session;
      response = await sendApiRequest(url, options, session);
    }
  }

  let result = {};
  try { result = await response.json(); } catch { /* response has no JSON body */ }
  if (!response.ok) {
    const detail = result.details?.[0]?.message;
    const error = new Error(detail || result.message || result.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Mctaba authentication is not configured. Add the Supabase URL and publishable key to Vercel.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Mctaba authentication is not configured. Add the Supabase URL and publishable key to Vercel.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signUp(name, email, password) {
  if (!supabase) throw new Error('Mctaba authentication is not configured. Add the Supabase URL and publishable key to Vercel.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Account creation did not return a user. Please try again.');
  if (!data.session) throw new Error('Your account was created, but sign-in was not completed. Please try signing in.');
  return data.user;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function normalizeUser(user) {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  return {
    ...user,
    id: user.id,
    uid: String(user.id),
    email: user.email,
    displayName: metadata.full_name || metadata.name || user.email,
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
