import { Match } from '../types';

export const WORKER_BASE_URL = '';
export const STORAGE_KEY_MATCHES = 'ck_matches';
export const STORAGE_KEY_LEGACY = 'riming_matches';

export async function fetchAllMatchesFromWorker() {
  return { matches: [], source: 'local', error: undefined };
}
export async function createMatchOnWorker(match: Match) {
  return { success: true, match };
}
export async function updateMatchOnWorker(match: Match) {
  return { success: true, match };
}
export async function deleteMatchOnWorker(id: string) {
  return { success: true, id };
}

export const fetchAllMatchesFromApi = fetchAllMatchesFromWorker;
export const createMatchOnApi = createMatchOnWorker;
export const updateMatchOnApi = async (match: Match) => updateMatchOnWorker(match);
export const deleteMatchOnApi = async (id: string) => deleteMatchOnWorker(id);
