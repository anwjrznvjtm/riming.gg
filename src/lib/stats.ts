import { Match, LineKey, LineName, ChampionStat, PlayerChampionStat, PartnerStat, LINE_KEYS, LINE_LABELS } from '../types';

export const WOORIMING = '우리밍_';

export function isWooriming(name?: string | null): boolean {
  if (!name) return false;
  const clean = name.trim().replace(/\s+/g, '');
  return clean === '우리밍_' || clean === '우리밍' || clean.startsWith('우리밍');
}

export function parseKda(kda?: string): { k: number; d: number; a: number } {
  if (!kda || !kda.includes('/')) return { k: 0, d: 0, a: 0 };
  const parts = kda.split('/').map((x) => parseInt(x.trim(), 10) || 0);
  return { k: parts[0] || 0, d: parts[1] || 0, a: parts[2] || 0 };
}

export function formatPlayerWithChamp(player?: string, champ?: string): string {
  if (!player) return '';
  if (!champ) return player;
  return `${player}(${champ})`;
}

export function isKdaEmpty(kda?: string): boolean {
  if (!kda) return true;
  const trimmed = kda.trim();
  return trimmed === '' || trimmed === '0/0/0';
}

export function getWoorimingTeam(match: Match): 'Red' | 'Blue' {
  if (!match) return 'Red';
  if (match.team_a) {
    for (const key of LINE_KEYS) {
      if (isWooriming(match.team_a[key])) return 'Red';
    }
  }
  if (match.team_b) {
    for (const key of LINE_KEYS) {
      if (isWooriming(match.team_b[key])) return 'Blue';
    }
  }
  const inA = Object.values(match.team_a || {}).some(isWooriming);
  const inB = Object.values(match.team_b || {}).some(isWooriming);
  if (inA) return 'Red';
  if (inB) return 'Blue';
  return 'Red';
}

// Strictly check whether Wooriming won the match (regardless of casing, Korean '레드'/'블루', etc.)
export function isMatchWonByWooriming(match: Match): boolean {
  if (!match) return false;
  const wTeam = getWoorimingTeam(match); // 'Red' | 'Blue'
  const win = (match.winning_team || '').trim().toLowerCase();

  if (wTeam === 'Red') {
    return win === 'red' || win === '레드' || win === 'team_a' || win === 'a' || win === '1';
  } else if (wTeam === 'Blue') {
    return win === 'blue' || win === '블루' || win === 'team_b' || win === 'b' || win === '2';
  }
  return false;
}

export function getWoorimingLine(match: Match): LineName | null {
  if (!match) return 'ADC';
  for (const teamKey of ['team_a', 'team_b'] as const) {
    const roster = match[teamKey];
    if (roster) {
      for (const key of LINE_KEYS) {
        if (isWooriming(roster[key])) {
          return LINE_LABELS[key];
        }
      }
    }
  }
  return null;
}

export function getWoorimingLineKey(match: Match): LineKey {
  if (!match) return 'adc';
  for (const teamKey of ['team_a', 'team_b'] as const) {
    const roster = match[teamKey];
    if (roster) {
      for (const key of LINE_KEYS) {
        if (isWooriming(roster[key])) {
          return key;
        }
      }
    }
  }
  return 'adc';
}

export function getCombinations<T>(arr: T[], k: number): T[][] {
  const results: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return results;
}

export interface OpponentMatchDetail {
  matchId: string | number;
  date: string;
  ckName: string;
  setNumber: number;
  myLine: LineName;
  myChamp: string;
  myKda: string;
  opponentChamp: string;
  opponentKda: string;
  won: boolean;
  score: string;
  winningTeam: string;
}

export interface OpponentStat {
  name: string;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  primaryLine: LineName;
  matches: OpponentMatchDetail[];
}

export function calculateOpponentStats(matches: Match[]): OpponentStat[] {
  const map = new Map<string, OpponentStat>();

  for (const m of matches) {
    const wTeam = getWoorimingTeam(m);
    const lineKey = getWoorimingLineKey(m);
    const lineLabel = LINE_LABELS[lineKey];

    const oppTeamRoster = wTeam === 'Red' ? m.team_b : m.team_a;
    const oppTeamChamps = wTeam === 'Red' ? m.team_b_champs : m.team_a_champs;
    const oppTeamKda = wTeam === 'Red' ? m.team_b_kda : m.team_a_kda;

    const myTeamChamps = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
    const myTeamKda = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;

    const oppName = (oppTeamRoster?.[lineKey] || '').trim();
    if (!oppName || isWooriming(oppName)) continue;

    const won = isMatchWonByWooriming(m);

    if (!map.has(oppName)) {
      map.set(oppName, {
        name: oppName,
        games: 0,
        wins: 0,
        losses: 0,
        winrate: 0,
        primaryLine: lineLabel,
        matches: [],
      });
    }

    const stat = map.get(oppName)!;
    stat.games += 1;
    if (won) {
      stat.wins += 1;
    } else {
      stat.losses += 1;
    }
    stat.winrate = (stat.wins / stat.games) * 100;
    stat.matches.push({
      matchId: m.id,
      date: m.date,
      ckName: m.ck_name,
      setNumber: m.set_number || 1,
      myLine: lineLabel,
      myChamp: myTeamChamps?.[lineKey] || '',
      myKda: myTeamKda?.[lineKey] || '',
      opponentChamp: oppTeamChamps?.[lineKey] || '',
      opponentKda: oppTeamKda?.[lineKey] || '',
      won,
      score: m.score,
      winningTeam: m.winning_team,
    });
  }

  // Sort by matches played DESC, then winrate DESC
  return Array.from(map.values()).sort((a, b) => {
    if (b.games !== a.games) return b.games - a.games;
    return b.winrate - a.winrate;
  });
}

export interface ComputedStats {
  latestMonth: string;
  overallWinrate: { total: number; wins: number; losses: number; winrate: number };
  thisMonthWinrate: { total: number; wins: number; losses: number; winrate: number };
  roleStats: {
    adc: { games: number; wins: number; winrate: number };
    sup: { games: number; wins: number; winrate: number };
  };
  monthlyStats: { month: string; games: number; wins: number; losses: number; winrate: number }[];
  recentTenMatches: { match: Match; won: boolean }[];
  opponentStats: OpponentStat[];
  mostBannedChamps: { champ: string; cnt: number; rate: number }[];
  mostPickedChamps: ChampionStat[];
  partnerStats: {
    overall: { ADC: Record<string, PartnerStat>; SUP: Record<string, PartnerStat> };
    thisMonth: { ADC: Record<string, PartnerStat>; SUP: Record<string, PartnerStat> };
  };
  pairWinrates: Map<string, { games: number; wins: number }>;
  playerPrimaryLines: Record<string, LineName>;
  dominantMonthRole: 'ADC' | 'SUP';
}

export function calculateStats(matches: Match[]): ComputedStats {
  const latestMonth = matches.length
    ? matches.map((m) => m.date.slice(0, 7)).sort().reverse()[0]
    : '2026-09';

  const thisMonthMatches = matches.filter((m) => m.date.startsWith(latestMonth));

  function calcWl(list: Match[]) {
    let wins = 0;
    for (const m of list) {
      if (isMatchWonByWooriming(m)) wins++;
    }
    const total = list.length;
    return { total, wins, losses: total - wins, winrate: total ? (wins / total) * 100 : 0 };
  }

  const overallWinrate = calcWl(matches);
  const thisMonthWinrate = calcWl(thisMonthMatches);

  let adcGames = 0, adcWins = 0;
  let supGames = 0, supWins = 0;

  for (const m of matches) {
    const line = getWoorimingLine(m);
    const won = isMatchWonByWooriming(m);
    if (line === 'ADC') {
      adcGames++;
      if (won) adcWins++;
    } else if (line === 'SUP') {
      supGames++;
      if (won) supWins++;
    }
  }

  const roleStats = {
    adc: { games: adcGames, wins: adcWins, winrate: adcGames ? (adcWins / adcGames) * 100 : 0 },
    sup: { games: supGames, wins: supWins, winrate: supGames ? (supWins / supGames) * 100 : 0 },
  };

  // Monthly stats
  const monthlyMap: Record<string, { games: number; wins: number }> = {};
  for (const m of matches) {
    const month = m.date.slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { games: 0, wins: 0 };
    monthlyMap[month].games++;
    if (isMatchWonByWooriming(m)) monthlyMap[month].wins++;
  }

  const monthlyStats = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, data]) => ({
      month,
      games: data.games,
      wins: data.wins,
      losses: data.games - data.wins,
      winrate: data.games ? (data.wins / data.games) * 100 : 0,
    }));

  // Recent 10 matches (ordered from oldest to newest for timeline display)
  const sortedByDateAsc = [...matches].sort((a, b) => {
    const dDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dDiff !== 0) return dDiff;
    const setA = Number(a.set_number) || 1;
    const setB = Number(b.set_number) || 1;
    return setA - setB;
  });
  const recentTenMatches = sortedByDateAsc.slice(-10).map((m) => ({
    match: m,
    won: isMatchWonByWooriming(m),
  }));

  // Opponent Top Stats
  const opponentStats = calculateOpponentStats(matches);

  // Most banned
  const banCounts: Record<string, number> = {};
  for (const m of matches) {
    for (const b of [...m.ban_a, ...m.ban_b]) {
      if (!b) continue;
      banCounts[b] = (banCounts[b] || 0) + 1;
    }
  }
  const mostBannedChamps = Object.entries(banCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([champ, cnt]) => ({
      champ,
      cnt,
      rate: matches.length ? (cnt / matches.length) * 100 : 0,
    }));

  // Most picked by 우리밍_
  const pickMap: Record<string, { picks: number; wins: number; losses: number; kSum: number; dSum: number; aSum: number; kdaCount: number }> = {};
  for (const m of matches) {
    const wTeam = getWoorimingTeam(m);
    const roster = wTeam === 'Red' ? m.team_a : m.team_b;
    const champs = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
    const kdas = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;
    let wKey: LineKey | null = null;
    for (const k of LINE_KEYS) {
      if (isWooriming(roster[k])) {
        wKey = k;
        break;
      }
    }
    if (!wKey) continue;
    const champ = champs[wKey];
    const kda = kdas[wKey];
    if (!champ) continue;

    if (!pickMap[champ]) {
      pickMap[champ] = { picks: 0, wins: 0, losses: 0, kSum: 0, dSum: 0, aSum: 0, kdaCount: 0 };
    }
    pickMap[champ].picks++;
    if (isMatchWonByWooriming(m)) pickMap[champ].wins++;
    else pickMap[champ].losses++;

    if (!isKdaEmpty(kda)) {
      const parsed = parseKda(kda);
      pickMap[champ].kSum += parsed.k;
      pickMap[champ].dSum += parsed.d;
      pickMap[champ].aSum += parsed.a;
      pickMap[champ].kdaCount++;
    }
  }

  const mostPickedChamps: ChampionStat[] = Object.entries(pickMap)
    .map(([champ, data]) => ({
      champ,
      picks: data.picks,
      wins: data.wins,
      losses: data.losses,
      winrate: data.picks ? (data.wins / data.picks) * 100 : 0,
      kSum: data.kSum,
      dSum: data.dSum,
      aSum: data.aSum,
      kdaCount: data.kdaCount,
      avgKDA: data.kdaCount
        ? `${(data.kSum / data.kdaCount).toFixed(1)}/${(data.dSum / data.kdaCount).toFixed(1)}/${(data.aSum / data.kdaCount).toFixed(1)}`
        : '',
    }))
    .sort((a, b) => b.picks - a.picks);

  // Partner stats (Line synergy)
  function computePartners(list: Match[]) {
    const adcPartners: Record<string, PartnerStat> = {};
    const supPartners: Record<string, PartnerStat> = {};

    for (const m of list) {
      const wTeam = getWoorimingTeam(m);
      const roster = wTeam === 'Red' ? m.team_a : m.team_b;
      let wKey: LineKey | null = null;
      for (const k of LINE_KEYS) {
        if (isWooriming(roster[k])) {
          wKey = k;
          break;
        }
      }
      if (!wKey) continue;
      const wLine = LINE_LABELS[wKey];
      if (wLine !== 'ADC' && wLine !== 'SUP') continue;
      const won = isMatchWonByWooriming(m);

      for (const k of LINE_KEYS) {
        if (k === wKey) continue;
        const pRaw = roster[k];
        if (!pRaw || isWooriming(pRaw)) continue;
        const pName = pRaw.trim();
        const pLine = LINE_LABELS[k];
        const compositeKey = `${pName}|${pLine}`;
        const targetMap = wLine === 'ADC' ? adcPartners : supPartners;

        if (!targetMap[compositeKey]) {
          targetMap[compositeKey] = { name: pName, line: pLine, games: 0, wins: 0 };
        }
        targetMap[compositeKey].games++;
        if (won) targetMap[compositeKey].wins++;
      }
    }
    return { ADC: adcPartners, SUP: supPartners };
  }

  const partnerStats = {
    overall: computePartners(matches),
    thisMonth: computePartners(thisMonthMatches),
  };

  // Pair winrates (synergy among any two players on the same team)
  const pairWinrates = new Map<string, { games: number; wins: number }>();
  for (const m of matches) {
    const teams = [
      { players: Object.values(m.team_a), won: m.winning_team === 'Red' },
      { players: Object.values(m.team_b), won: m.winning_team === 'Blue' },
    ];
    for (const t of teams) {
      const validPlayers = t.players.filter(Boolean);
      for (let i = 0; i < validPlayers.length; i++) {
        for (let j = i + 1; j < validPlayers.length; j++) {
          const p1 = isWooriming(validPlayers[i]) ? WOORIMING : validPlayers[i].trim();
          const p2 = isWooriming(validPlayers[j]) ? WOORIMING : validPlayers[j].trim();
          const key = [p1, p2].sort().join('|');
          const stat = pairWinrates.get(key) || { games: 0, wins: 0 };
          stat.games++;
          if (t.won) stat.wins++;
          pairWinrates.set(key, stat);
        }
      }
    }
  }

  // Player primary lines
  const playerLineCounts: Record<string, Record<LineName, number>> = {};
  for (const m of matches) {
    const rosters = [m.team_a, m.team_b];
    for (const r of rosters) {
      for (const k of LINE_KEYS) {
        const rawName = r[k];
        if (!rawName) continue;
        const name = isWooriming(rawName) ? WOORIMING : rawName.trim();
        if (!playerLineCounts[name]) {
          playerLineCounts[name] = { TOP: 0, JGL: 0, MID: 0, ADC: 0, SUP: 0 };
        }
        playerLineCounts[name][LINE_LABELS[k]]++;
      }
    }
  }

  const playerPrimaryLines: Record<string, LineName> = {};
  for (const name in playerLineCounts) {
    let topL: LineName = 'TOP';
    let maxC = -1;
    for (const l of ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as LineName[]) {
      if (playerLineCounts[name][l] > maxC) {
        maxC = playerLineCounts[name][l];
        topL = l;
      }
    }
    playerPrimaryLines[name] = topL;
  }
  playerPrimaryLines[WOORIMING] = 'ADC';
  playerPrimaryLines['우리밍'] = 'ADC';

  // Dominant month role
  let curMonthAdc = 0, curMonthSup = 0;
  for (const m of thisMonthMatches) {
    const l = getWoorimingLine(m);
    if (l === 'ADC') curMonthAdc++;
    else if (l === 'SUP') curMonthSup++;
  }
  const dominantMonthRole: 'ADC' | 'SUP' = curMonthAdc >= curMonthSup ? 'ADC' : 'SUP';

  return {
    latestMonth,
    overallWinrate,
    thisMonthWinrate,
    roleStats,
    monthlyStats,
    recentTenMatches,
    opponentStats,
    mostBannedChamps,
    mostPickedChamps,
    partnerStats,
    pairWinrates,
    playerPrimaryLines,
    dominantMonthRole,
  };
}

export function getPlayerSynergyRate(
  p1: string,
  p2: string,
  pairMap: Map<string, { games: number; wins: number }>
): number {
  if (p1 === p2) return 1.0;
  const key = [p1, p2].sort().join('|');
  const stat = pairMap.get(key);
  if (!stat || stat.games === 0) return 0.5;
  return stat.wins / stat.games;
}

export function getPlayerLineChampionStats(
  playerName: string,
  line: LineName,
  matches: Match[]
): PlayerChampionStat[] {
  if (!playerName || !line || !matches || !matches.length) return [];
  const cleanTarget = playerName.trim().replace(/\s+/g, '');
  const isTargetW = isWooriming(playerName);

  const matchPlayer = (p?: string) => {
    if (!p) return false;
    if (isTargetW) return isWooriming(p);
    return p.trim().replace(/\s+/g, '') === cleanTarget;
  };

  const lineKey = (Object.keys(LINE_LABELS) as LineKey[]).find(
    (k) => LINE_LABELS[k] === line
  );
  if (!lineKey) return [];

  const champMap: Record<string, { games: number; wins: number; losses: number }> = {};

  for (const m of matches) {
    // Check Team A (Red)
    if (matchPlayer(m.team_a?.[lineKey])) {
      const champ = m.team_a_champs?.[lineKey]?.trim();
      if (champ) {
        if (!champMap[champ]) {
          champMap[champ] = { games: 0, wins: 0, losses: 0 };
        }
        champMap[champ].games++;
        if (m.winning_team === 'Red') {
          champMap[champ].wins++;
        } else {
          champMap[champ].losses++;
        }
      }
    }

    // Check Team B (Blue)
    if (matchPlayer(m.team_b?.[lineKey])) {
      const champ = m.team_b_champs?.[lineKey]?.trim();
      if (champ) {
        if (!champMap[champ]) {
          champMap[champ] = { games: 0, wins: 0, losses: 0 };
        }
        champMap[champ].games++;
        if (m.winning_team === 'Blue') {
          champMap[champ].wins++;
        } else {
          champMap[champ].losses++;
        }
      }
    }
  }

  return Object.entries(champMap)
    .map(([champ, data]) => ({
      champ,
      games: data.games,
      wins: data.wins,
      losses: data.losses,
      winrate: data.games ? (data.wins / data.games) * 100 : 0,
    }))
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate || b.wins - a.wins);
}

