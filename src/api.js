import { supabase } from './supabase.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://mctaba-test-api.onrender.com').replace(/\/$/, '');

export async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const { data: { session } = {} } = supabase ? await supabase.auth.getSession() : {};
  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

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

export async function signUp(name, email, password) {
  if (!supabase) throw new Error('Mctaba authentication is not configured. Add the Supabase URL and publishable key to Vercel.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Account creation did not return a user. Please try again.');
  if (!data.session) throw new Error('Your account was created. Check your email to confirm it, then return here to sign in.');
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
