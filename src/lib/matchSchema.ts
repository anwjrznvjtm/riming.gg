import { Match, LineKey, LINE_KEYS, WinningTeam, MatchFormat } from '../types';
import { normalizeChampionName } from './champions';

/**
 * Standard Schema Version for CK Journal Match Data
 */
export const SCHEMA_VERSION = '1.0.0';
export const APP_IDENTIFIER = 'wooriming_ck_journal';
export const SUPABASE_TABLE_NAME = 'ck_matches';

/**
 * Database Row Interface (Supabase / PostgreSQL / REST API)
 * Columns match standard PostgreSQL naming conventions and JSONB payloads.
 */
export interface DbMatchRow {
  id: string;
  date: string; // 'YYYY-MM-DD'
  ck_name: string;
  match_format: string; // '단판' | '3판2선승' | '5판3선승'
  set_number: number;
  score: string; // '1:0', '2:1'
  winning_team: 'Red' | 'Blue';
  team_a: Record<string, string>; // { top: string, jgl: string, mid: string, adc: string, sup: string }
  team_b: Record<string, string>;
  team_a_champs: Record<string, string>;
  team_b_champs: Record<string, string>;
  team_a_kda: Record<string, string>;
  team_b_kda: Record<string, string>;
  ban_a: string[];
  ban_b: string[];
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601
}

/**
 * Standard Export Payload Structure
 * Contains schema metadata, export timestamp, and validated match array.
 */
export interface MatchExportPayload {
  schema_version: string;
  app_identifier: string;
  exported_at: string;
  total_count: number;
  matches: Match[];
}

/**
 * Validation result format
 */
export interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  data?: T;
}

/**
 * SQL DDL for Supabase / PostgreSQL Database Integration
 * Can be executed directly in the Supabase SQL Editor.
 */
export const SUPABASE_MATCHES_TABLE_SQL = `
-- =========================================================
-- Wooriming CK Journal matches table schema
-- =========================================================

CREATE TABLE IF NOT EXISTS ck_matches (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  ck_name TEXT NOT NULL,
  match_format TEXT NOT NULL DEFAULT '단판',
  set_number INTEGER NOT NULL DEFAULT 1,
  score TEXT NOT NULL DEFAULT '1:0',
  winning_team TEXT NOT NULL CHECK (winning_team IN ('Red', 'Blue')),
  team_a JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_b JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_a_champs JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_b_champs JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_a_kda JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_b_kda JSONB NOT NULL DEFAULT '{}'::jsonb,
  ban_a JSONB NOT NULL DEFAULT '[]'::jsonb,
  ban_b JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ck_matches_date ON ck_matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_ck_matches_winning_team ON ck_matches(winning_team);

-- Auto-update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_ck_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ck_matches_updated_at ON ck_matches;
CREATE TRIGGER trigger_ck_matches_updated_at
BEFORE UPDATE ON ck_matches
FOR EACH ROW EXECUTE FUNCTION update_ck_matches_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE ck_matches ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access" ON ck_matches
  FOR SELECT USING (true);

-- Authenticated or service-role write access
CREATE POLICY "Allow authenticated full access" ON ck_matches
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
`.trim();

/**
 * Generate a unique match ID
 */
export function generateMatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create an empty roster object for safety
 */
function createEmptyRoster(): Record<LineKey, string> {
  return {
    top: '',
    jgl: '',
    mid: '',
    adc: '',
    sup: '',
  };
}

/**
 * Sanitize and normalize raw roster/champs/kda objects
 */
function sanitizeRoster(raw: any, isChamp = false): Record<LineKey, string> {
  const result = createEmptyRoster();
  if (!raw || typeof raw !== 'object') return result;

  for (const line of LINE_KEYS) {
    const val = raw[line];
    if (typeof val === 'string') {
      const trimmed = val.trim();
      result[line] = isChamp ? normalizeChampionName(trimmed) : trimmed;
    } else {
      result[line] = '';
    }
  }
  return result;
}

/**
 * Sanitize and normalize bans array
 */
function sanitizeBans(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? normalizeChampionName(item.trim()) : ''))
    .filter(Boolean);
}

/**
 * Normalize and sanitize any match object into strict schema Match format
 */
export function normalizeMatch(raw: any): Match {
  const fallbackDate = new Date().toISOString().slice(0, 10);
  const rawDate = typeof raw?.date === 'string' ? raw.date.trim() : '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : fallbackDate;

  const validFormats: MatchFormat[] = ['단판', '3판2선승', '5판3선승'];
  const match_format: MatchFormat = validFormats.includes(raw?.match_format)
    ? raw.match_format
    : '단판';

  const winning_team: WinningTeam = raw?.winning_team === 'Red' ? 'Red' : 'Blue';

  const rawScore = typeof raw?.score === 'string' ? raw.score.trim() : '';
  const score = /^\d+:\d+$/.test(rawScore) ? rawScore : '1:0';

  const set_number = typeof raw?.set_number === 'number' && raw.set_number > 0
    ? Math.floor(raw.set_number)
    : 1;

  const ck_name = typeof raw?.ck_name === 'string' && raw.ck_name.trim()
    ? raw.ck_name.trim()
    : 'CK 경기';

  const id = typeof raw?.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : generateMatchId();

  return {
    id,
    date,
    ck_name,
    match_format,
    set_number,
    score,
    winning_team,
    team_a: sanitizeRoster(raw?.team_a),
    team_b: sanitizeRoster(raw?.team_b),
    team_a_champs: sanitizeRoster(raw?.team_a_champs, true),
    team_b_champs: sanitizeRoster(raw?.team_b_champs, true),
    team_a_kda: sanitizeRoster(raw?.team_a_kda),
    team_b_kda: sanitizeRoster(raw?.team_b_kda),
    ban_a: sanitizeBans(raw?.ban_a),
    ban_b: sanitizeBans(raw?.ban_b),
    created_at: raw?.created_at || undefined,
    updated_at: raw?.updated_at || undefined,
  };
}

/**
 * Validate a match object against requirements
 */
export function validateMatch(raw: any): ValidationResult<Match> {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { isValid: false, errors: ['데이터 객체가 유효하지 않습니다.'] };
  }

  if (!raw.ck_name || typeof raw.ck_name !== 'string' || !raw.ck_name.trim()) {
    errors.push('CK 경기 명칭(ck_name)은 필수입니다.');
  }

  if (!raw.date || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date.trim())) {
    errors.push('경기 날짜(date)는 YYYY-MM-DD 형식이어야 합니다.');
  }

  if (raw.winning_team !== 'Red' && raw.winning_team !== 'Blue') {
    errors.push('승리 팀(winning_team)은 Red 또는 Blue여야 합니다.');
  }

  if (!raw.team_a || typeof raw.team_a !== 'object' || !raw.team_b || typeof raw.team_b !== 'object') {
    errors.push('팀 명단(team_a, team_b) 객체 데이터가 필요합니다.');
  }

  const normalized = normalizeMatch(raw);
  return {
    isValid: errors.length === 0,
    errors,
    data: normalized,
  };
}

/**
 * Convert Match model to standard Database Row (DbMatchRow)
 */
export function matchToDbRow(match: Match): DbMatchRow {
  const now = new Date().toISOString();
  return {
    id: match.id,
    date: match.date,
    ck_name: match.ck_name,
    match_format: match.match_format,
    set_number: match.set_number,
    score: match.score,
    winning_team: match.winning_team,
    team_a: { ...match.team_a },
    team_b: { ...match.team_b },
    team_a_champs: { ...match.team_a_champs },
    team_b_champs: { ...match.team_b_champs },
    team_a_kda: { ...match.team_a_kda },
    team_b_kda: { ...match.team_b_kda },
    ban_a: [...match.ban_a],
    ban_b: [...match.ban_b],
    created_at: match.created_at || now,
    updated_at: now,
  };
}

/**
 * Convert Database Row (or raw REST API item) to client Match model
 */
export function dbRowToMatch(row: DbMatchRow | Record<string, any>): Match {
  return normalizeMatch(row);
}

/**
 * Serializes current matches array into standard export payload with schema metadata
 */
export function serializeMatchesForExport(matches: Match[]): MatchExportPayload {
  const cleanMatches = matches.map((m) => normalizeMatch(m));
  return {
    schema_version: SCHEMA_VERSION,
    app_identifier: APP_IDENTIFIER,
    exported_at: new Date().toISOString(),
    total_count: cleanMatches.length,
    matches: cleanMatches,
  };
}

/**
 * Parse any incoming JSON payload, whether it is:
 * 1) Standard export payload `{ schema_version, matches: [...] }`
 * 2) Direct array of matches `Match[]`
 * 3) Supabase query response `{ data: [...] }` or `DbMatchRow[]`
 * 4) REST API response `{ matches: [...] }` or `{ result: [...] }`
 */
export function parseMatchPayload(input: unknown): {
  matches: Match[];
  format: string;
  schemaVersion: string;
  count: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!input) {
    throw new Error('파싱할 데이터가 비어 있습니다.');
  }

  let rawList: any[] = [];
  let detectedFormat = '알 수 없음';
  let schemaVersion = SCHEMA_VERSION;

  if (Array.isArray(input)) {
    rawList = input;
    detectedFormat = '직접 배열(Array)';
  } else if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, any>;
    if (Array.isArray(obj.matches)) {
      rawList = obj.matches;
      detectedFormat = obj.schema_version ? `표준 스키마 (v${obj.schema_version})` : 'matches 객체 래퍼';
      if (obj.schema_version) {
        schemaVersion = String(obj.schema_version);
      }
    } else if (Array.isArray(obj.data)) {
      rawList = obj.data;
      detectedFormat = 'REST API / Supabase data 래퍼';
    } else if (Array.isArray(obj.result)) {
      rawList = obj.result;
      detectedFormat = 'REST API result 래퍼';
    } else if (obj.team_a && obj.team_b) {
      // Single match item passed
      rawList = [obj];
      detectedFormat = '단일 경기 객체';
    } else {
      throw new Error('유효한 경기 목록(matches/data/배열)을 JSON 구조에서 찾을 수 없습니다.');
    }
  } else {
    throw new Error('JSON 데이터 형식(객체 또는 배열)이 올바르지 않습니다.');
  }

  const matches: Match[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') {
      warnings.push(`항목 #${i + 1}: 객체 형식이 아니어서 제외되었습니다.`);
      continue;
    }
    // Basic verification
    if (!item.team_a && !item.team_b && !item.ck_name) {
      warnings.push(`항목 #${i + 1}: 필수 필드가 결여되어 제외되었습니다.`);
      continue;
    }

    try {
      const normalized = normalizeMatch(item);
      matches.push(normalized);
    } catch (err: any) {
      warnings.push(`항목 #${i + 1} 정규화 중 오류: ${err?.message || '알 수 없는 오류'}`);
    }
  }

  if (matches.length === 0) {
    throw new Error('유효한 경기 데이터가 0건입니다.');
  }

  return {
    matches,
    format: detectedFormat,
    schemaVersion,
    count: matches.length,
    warnings,
  };
}
