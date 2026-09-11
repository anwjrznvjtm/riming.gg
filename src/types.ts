export type LineKey = 'top' | 'jgl' | 'mid' | 'adc' | 'sup';
export type LineName = 'TOP' | 'JGL' | 'MID' | 'ADC' | 'SUP';

export const LINE_KEYS: LineKey[] = ['top', 'jgl', 'mid', 'adc', 'sup'];

export const LINE_LABELS: Record<LineKey, LineName> = {
  top: 'TOP',
  jgl: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  sup: 'SUP',
};

export type MatchFormat = '단판' | '3판2선승' | '5판3선승';
export type WinningTeam = 'Red' | 'Blue';

export type TeamRoster = Record<LineKey, string>;
export type TeamChamps = Record<LineKey, string>;
export type TeamKda = Record<LineKey, string>;

export interface Match {
  id: string;
  date: string; // YYYY-MM-DD
  ck_name: string;
  team_a: TeamRoster; // Red
  team_b: TeamRoster; // Blue
  team_a_champs: TeamChamps;
  team_b_champs: TeamChamps;
  ban_a: string[];
  ban_b: string[];
  team_a_kda: TeamKda;
  team_b_kda: TeamKda;
  score: string; // e.g. "1:0", "2:1"
  winning_team: WinningTeam;
  match_format: MatchFormat;
  set_number: number;
  created_at?: string; // ISO 8601 string for DB/REST synchronization
  updated_at?: string; // ISO 8601 string for DB/REST synchronization
}

export interface ChampionStat {
  champ: string;
  picks: number;
  wins: number;
  losses: number;
  winrate: number;
  avgKDA: string;
  kSum: number;
  dSum: number;
  aSum: number;
  kdaCount: number;
}

export interface PlayerChampionStat {
  champ: string;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
}

export interface PartnerStat {
  name: string;
  line: LineName;
  games: number;
  wins: number;
}

export interface SynergyAnalysisResult {
  mode: 'current' | 'optimal';
  teamA: { line: LineName; player: string }[];
  teamB: { line: LineName; player: string }[];
  expected: number;
  breakdown: { name: string; winrate: number; games: number; line: LineName }[];
  wTeam: WinningTeam;
}
