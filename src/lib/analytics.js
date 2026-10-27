import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase.js';

export async function fetchLibraryAnalytics(libraryId) {
  if (!app) throw new Error('Connect Firebase before loading live library analytics.');
  if (typeof libraryId !== 'string' || !libraryId.trim()) {
    throw new Error('A library ID is required.');
  }
  const callable = httpsCallable(getFunctions(app), 'getLibraryAnalytics');
  const result = await callable({ libraryId: libraryId.trim() });
  return result.data;
}
