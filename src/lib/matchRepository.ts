import { Match } from '../types';
import {
  MatchExportPayload,
  normalizeMatch,
  serializeMatchesForExport,
  matchToDbRow,
  dbRowToMatch,
  DbMatchRow,
  SUPABASE_TABLE_NAME,
} from './matchSchema';
import {
  STORAGE_KEY_MATCHES,
  STORAGE_KEY_BACKUP,
  getInitialMatches,
} from '../data/initialMatches';
import { WORKER_API_ENDPOINT } from './matchApi';

/**
 * Common Match Repository Interface
 * Defines uniform CRUD & batch operations for any backend (LocalStorage, REST API, Supabase).
 */
export interface IMatchRepository {
  readonly providerName: string;
  getAll(): Promise<Match[]>;
  getById(id: string): Promise<Match | null>;
  create(match: Match): Promise<Match>;
  update(match: Match): Promise<Match>;
  delete(id: string): Promise<void>;
  importAll(matches: Match[], mode: 'replace' | 'merge'): Promise<Match[]>;
  exportAll(): Promise<MatchExportPayload>;
}

/**
 * LocalStorage Repository Implementation (Default)
 * Provides local browser-based storage while strictly honoring the standardized schema.
 */
export class LocalStorageMatchRepository implements IMatchRepository {
  public readonly providerName = 'LocalStorage';

  public async getAll(): Promise<Match[]> {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MATCHES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => normalizeMatch(item));
        }
      }
    } catch (e) {
      console.warn('[LocalStorageMatchRepository] Read error, returning empty list', e);
    }
    return getInitialMatches();
  }

  public async getById(id: string): Promise<Match | null> {
    const list = await this.getAll();
    return list.find((m) => String(m.id) === String(id)) || null;
  }

  public async create(match: Match): Promise<Match> {
    const normalized = normalizeMatch(match);
    const list = await this.getAll();
    const updated = [normalized, ...list];
    this.saveToStorage(updated);
    return normalized;
  }

  public async update(match: Match): Promise<Match> {
    const normalized = normalizeMatch(match);
    const list = await this.getAll();
    const updated = list.map((m) => (String(m.id) === String(match.id) ? normalized : m));
    this.saveToStorage(updated);
    return normalized;
  }

  public async delete(id: string): Promise<void> {
    const list = await this.getAll();
    const updated = list.filter((m) => String(m.id) !== String(id));
    this.saveToStorage(updated);
  }

  public async importAll(matches: Match[], mode: 'replace' | 'merge'): Promise<Match[]> {
    const cleanList = matches.map((m) => normalizeMatch(m));
    let finalMatches: Match[];

    if (mode === 'replace') {
      finalMatches = cleanList;
    } else {
      const current = await this.getAll();
      const existingIds = new Set(current.map((m) => String(m.id)));
      const newOnes = cleanList.filter((m) => !existingIds.has(String(m.id)));
      finalMatches = [...newOnes, ...current].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    this.saveToStorage(finalMatches);
    return finalMatches;
  }

  public async exportAll(): Promise<MatchExportPayload> {
    const list = await this.getAll();
    return serializeMatchesForExport(list);
  }

  private saveToStorage(matches: Match[]): void {
    try {
      const json = JSON.stringify(matches);
      localStorage.setItem(STORAGE_KEY_MATCHES, json);
      localStorage.setItem(STORAGE_KEY_BACKUP, json);
    } catch (e) {
      console.error('[LocalStorageMatchRepository] Save error', e);
    }
  }
}

/**
 * REST API Repository Implementation (Ready-to-use Template)
 * Connects to standard RESTful backend endpoints (e.g. Express / Fastify / Next.js API routes).
 */
export class RestApiMatchRepository implements IMatchRepository {
  public readonly providerName = 'REST API';
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string = WORKER_API_ENDPOINT, headers: Record<string, string> = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  public async getAll(): Promise<Match[]> {
    const res = await fetch(this.baseUrl, {
      method: 'GET',
      headers: this.headers,
    });
    if (!res.ok) {
      throw new Error(`[RestApiMatchRepository] Fetch failed: ${res.statusText}`);
    }
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data.matches || data.data || [];
    return rawList.map((item: any) => normalizeMatch(item));
  }

  public async getById(id: string): Promise<Match | null> {
    const res = await fetch(`${this.baseUrl}/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: this.headers,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`[RestApiMatchRepository] Get failed: ${res.statusText}`);
    const data = await res.json();
    return normalizeMatch(data.match || data);
  }

  public async create(match: Match): Promise<Match> {
    const normalized = normalizeMatch(match);
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(normalized),
    });
    if (!res.ok) throw new Error(`[RestApiMatchRepository] Create failed: ${res.statusText}`);
    const data = await res.json();
    return normalizeMatch(data.match || data);
  }

  public async update(match: Match): Promise<Match> {
    const normalized = normalizeMatch(match);
    const res = await fetch(`${this.baseUrl}/${encodeURIComponent(match.id)}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(normalized),
    });
    if (!res.ok) throw new Error(`[RestApiMatchRepository] Update failed: ${res.statusText}`);
    const data = await res.json();
    return normalizeMatch(data.match || data);
  }

  public async delete(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`[RestApiMatchRepository] Delete failed: ${res.statusText}`);
  }

  public async importAll(matches: Match[], mode: 'replace' | 'merge'): Promise<Match[]> {
    const cleanList = matches.map((m) => normalizeMatch(m));
    const res = await fetch(`${this.baseUrl}/batch`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ mode, matches: cleanList }),
    });
    if (!res.ok) throw new Error(`[RestApiMatchRepository] Batch import failed: ${res.statusText}`);
    const data = await res.json();
    const resultList = Array.isArray(data) ? data : data.matches || cleanList;
    return resultList.map((m: any) => normalizeMatch(m));
  }

  public async exportAll(): Promise<MatchExportPayload> {
    const list = await this.getAll();
    return serializeMatchesForExport(list);
  }
}

/**
 * Supabase PostgREST Repository Implementation (Ready-to-use Template)
 * Directly connects to Supabase REST endpoint without requiring external thick SDK dependencies.
 */
export class SupabaseMatchRepository implements IMatchRepository {
  public readonly providerName = 'Supabase';
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(supabaseUrl: string, supabaseAnonKey: string, tableName: string = SUPABASE_TABLE_NAME) {
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    this.endpoint = `${cleanUrl}/rest/v1/${tableName}`;
    this.headers = {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Prefer: 'return=representation',
    };
  }

  public async getAll(): Promise<Match[]> {
    const res = await fetch(`${this.endpoint}?order=date.desc`, {
      method: 'GET',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`[SupabaseMatchRepository] Query failed: ${res.statusText}`);
    const rows: DbMatchRow[] = await res.json();
    return rows.map((row) => dbRowToMatch(row));
  }

  public async getById(id: string): Promise<Match | null> {
    const res = await fetch(`${this.endpoint}?id=eq.${encodeURIComponent(id)}&limit=1`, {
      method: 'GET',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`[SupabaseMatchRepository] Query failed: ${res.statusText}`);
    const rows: DbMatchRow[] = await res.json();
    return rows.length > 0 ? dbRowToMatch(rows[0]) : null;
  }

  public async create(match: Match): Promise<Match> {
    const dbRow = matchToDbRow(match);
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(dbRow),
    });
    if (!res.ok) throw new Error(`[SupabaseMatchRepository] Insert failed: ${res.statusText}`);
    const rows: DbMatchRow[] = await res.json();
    return dbRowToMatch(rows[0] || dbRow);
  }

  public async update(match: Match): Promise<Match> {
    const dbRow = matchToDbRow(match);
    const res = await fetch(`${this.endpoint}?id=eq.${encodeURIComponent(match.id)}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(dbRow),
    });
    if (!res.ok) throw new Error(`[SupabaseMatchRepository] Update failed: ${res.statusText}`);
    const rows: DbMatchRow[] = await res.json();
    return dbRowToMatch(rows[0] || dbRow);
  }

  public async delete(id: string): Promise<void> {
    const res = await fetch(`${this.endpoint}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`[SupabaseMatchRepository] Delete failed: ${res.statusText}`);
  }

  public async importAll(matches: Match[], mode: 'replace' | 'merge'): Promise<Match[]> {
    if (mode === 'replace') {
      // Clear existing records
      await fetch(`${this.endpoint}?id=neq.placeholder_none`, {
        method: 'DELETE',
        headers: this.headers,
      });
    }

    const rows = matches.map((m) => matchToDbRow(m));
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        ...this.headers,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`[SupabaseMatchRepository] Upsert failed: ${res.statusText}`);
    const resultRows: DbMatchRow[] = await res.json();
    return resultRows.map((r) => dbRowToMatch(r));
  }

  public async exportAll(): Promise<MatchExportPayload> {
    const list = await this.getAll();
    return serializeMatchesForExport(list);
  }
}

/**
 * Active Repository Singleton Provider
 * Defaults to Cloudflare Worker REST API for live multi-device synchronization.
 */
let activeRepository: IMatchRepository = new RestApiMatchRepository(WORKER_API_ENDPOINT);

export function getMatchRepository(): IMatchRepository {
  return activeRepository;
}

export function setMatchRepository(repo: IMatchRepository): void {
  activeRepository = repo;
}
