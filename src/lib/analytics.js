import { apiRequest } from '../api.js';

export async function fetchLibraryAnalytics(libraryId) {
  if (typeof libraryId !== 'string' || !libraryId.trim()) {
    throw new Error('A library ID is required.');
  }
  return apiRequest('/api/analytics', {
    action: 'getLibraryAnalytics',
    libraryId: libraryId.trim(),
  });
}
