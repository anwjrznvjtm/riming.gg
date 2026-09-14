import { Match } from '../types';
import { normalizeMatch } from './matchSchema';

export const WORKER_BASE_URL = 'https://riming-gg.janghyck2.workers.dev';
export const STORAGE_KEY_MATCHES = 'ck_matches';
export const STORAGE_KEY_LEGACY = 'riming_matches';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchAllMatchesFromWorker(): Promise<{ matches: Match[]; source?: string; error?: string }> {
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { 
      method: 'GET', 
      headers: { Accept: 'application/json' },
      mode: 'cors'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('GET failed', res.status, text);
      return { matches: [], source: 'worker', error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];
    if (Array.isArray(rawList)) {
      const normalized = rawList.map((m: any) => normalizeMatch(m));
      return { matches: normalized, source: 'worker' };
    }
    return { matches: [], source: 'worker' };
  } catch (err: any) {
    console.error('fetchAll error', err);
    return { matches: [], source: 'worker', error: err?.message };
  }
}

export async function createMatchOnWorker(match: Match) {
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(normalizeMatch(match)),
      mode: 'cors'
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('POST failed', res.status, text);
      return { success: false, error: text.slice(0,200) };
    }
    return { success: true, match };
  } catch (err: any) {
    console.error('create error', err);
    return { success: false, error: err?.message };
  }
}

export async function updateMatchOnWorker(match: Match) {
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(normalizeMatch(match)),
      mode: 'cors'
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('PUT failed', res.status, text);
      return { success: false, error: text.slice(0,200) };
    }
    return { success: true, match };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function deleteMatchOnWorker(id: string) {
  try {
    // Cloudflare Worker가 ?id= 와 body 둘 다 지원하도록 두 가지 방법 시도
    const targetUrl = `${WORKER_BASE_URL}?id=${encodeURIComponent(id)}`;
    const res = await fetchWithTimeout(targetUrl, { 
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      mode: 'cors'
    });
    const text = await res.text();
    console.log('DELETE response', res.status, text);
    if (!res.ok) {
      return { success: false, id, error: text.slice(0,200) };
    }
    return { success: true, id };
  } catch (err: any) {
    console.error('delete error', err);
    return { success: false, id, error: err?.message };
  }
}

export const fetchAllMatchesFromApi = fetchAllMatchesFromWorker;
export const createMatchOnApi = createMatchOnWorker;
export const updateMatchOnApi = async (match: Match) => updateMatchOnWorker(match);
export const deleteMatchOnApi = async (id: string) => deleteMatchOnWorker(id);
