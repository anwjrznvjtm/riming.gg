import React, { useState, useMemo, useCallback } from 'react';
import { Match, LineKey, LINE_KEYS, ComputedStats } from '../types';
import { ChampionIcon } from './ChampionIcon';

interface MainTabProps {
  stats: ComputedStats;
  matches: Match[];
  onOpenSummaryModal: () => void;
  onToast: (msg: string) => void;
  allStreamers: string[];
}

type TeamRoster = Record<LineKey, string>;

// --- 기본 유틸 ---
function getPlayerPositionCounts(player: string, matches: Match[]): Record<LineKey, number> {
  const counts: Record<LineKey, number> = { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 };
  for (const m of matches) {
    for (const k of LINE_KEYS as LineKey[]) {
      if ((m.team_a?.[k] || '').trim() === player.trim()) counts[k]++;
      if ((m.team_b?.[k] || '').trim() === player.trim()) counts[k]++;
    }
  }
  return counts;
}
function getMainPosition(player: string, matches: Match[]): LineKey {
  const counts = getPlayerPositionCounts(player, matches);
  let best: LineKey = 'adc';
  let max = -1;
  for (const k of LINE_KEYS as LineKey[]) {
    if (counts[k] > max) { max = counts[k]; best = k; }
  }
  return max===0 ? (player==='우리밍_' ? 'adc' : 'mid') : best;
}
function getPlayerTeam(m: Match, player: string): 'Red'|'Blue'|null {
  for (const k of LINE_KEYS as LineKey[]) {
    if ((m.team_a?.[k] || '').trim() === player.trim()) return 'Red';
    if ((m.team_b?.[k] || '').trim() === player.trim()) return 'Blue';
  }
  return null;
}
function getWinningTeam(m: any): 'Red'|'Blue'|null {
  const wt = m.winning_team;
  if (wt === 'Red' || wt === 'Blue') return wt;
  if (wt === 'A' || wt === 'team_a') return 'Red';
  if (wt === 'B' || wt === 'team_b') return 'Blue';
  return null;
}
function getIndividualWinRate(player: string, matches: Match[]): { rate:number, wins:number, total:number } {
  let wins=0, total=0;
  for (const m of matches) {
    const team = getPlayerTeam(m, player);
    if (!team) continue;
    const winner = getWinningTeam(m);
    if (!winner) continue;
    total++;
    if (team===winner) wins++;
  }
  return { rate: total? wins/total*100 : 50, wins, total };
}
function countLaneMatchups(p1: string, p2: string, lane: LineKey, matches: Match[]): number {
  let cnt = 0;
  for (const m of matches) {
    const a = (m.team_a?.[lane] || '').trim();
    const b = (m.team_b?.[lane] || '').trim();
    if ((a === p1.trim() && b === p2.trim()) || (a === p2.trim() && b === p1.trim())) cnt++;
  }
  return cnt;
}
function getLaneHeadToHead(p1: string, p2: string, lane: LineKey, matches: Match[]): { p1Wins:number, p2Wins:number, total:number, p1Rate:number } {
  let p1Wins=0, p2Wins=0;
  for (const m of matches) {
    const a = (m.team_a?.[lane] || '').trim();
    const b = (m.team_b?.[lane] || '').trim();
    const wt = getWinningTeam(m);
    if (!wt) continue;
    if (a===p1 && b===p2) { if (wt==='Red') p1Wins++; else p2Wins++; }
    else if (a===p2 && b===p1) { if (wt==='Red') p2Wins++; else p1Wins++; }
  }
  const total = p1Wins+p2Wins;
  return { p1Wins, p2Wins, total, p1Rate: total ? p1Wins/total*100 : 50 };
}
function getSameTeamWinRate(p1:string,p2:string,matches:Match[]): number {
  let wins=0, total=0;
  for (const m of matches) {
    const t1 = getPlayerTeam(m, p1);
    const t2 = getPlayerTeam(m, p2);
    if (!t1 || !t2 || t1!==t2) continue;
    const winner = getWinningTeam(m);
    if (!winner) continue;
    total++;
    if (t1===winner) wins++;
  }
  return total? wins/total*100 : 50;
}

// --- 맞라인 전적 기반 라인업 (랜덤으로 매번 바뀌게) ---
function buildLaneCandidates(allStreamers: string[], matches: Match[], lane: LineKey) {
  const cands: { p1:string; p2:string; games:number }[] = [];
  const laneMains = allStreamers.filter(p => getMainPosition(p, matches) === lane);
  const pool = laneMains.length >= 4 ? laneMains : allStreamers;
  for (let i=0;i<pool.length;i++) {
    for (let j=i+1;j<pool.length;j++) {
      const games = countLaneMatchups(pool[i], pool[j], lane, matches);
      if (games > 0) cands.push({ p1: pool[i], p2: pool[j], games });
    }
  }
  // 게임수 많은 순으로 정렬하되, 약간의 랜덤 셔플
  cands.sort((a,b)=>b.games-a.games);
  // 상위 8개 중에서 랜덤으로 섞기 (매번 다른 선수 나오게)
  const top = cands.slice(0, 8);
  for (let i=top.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [top[i], top[j]]=[top[j], top[i]]; }
  return [...top, ...cands.slice(8)].slice(0, 20);
}
function findBalancedLineup(allStreamers: string[], matches: Match[]) {
  const byLane: Record<LineKey, {p1:string;p2:string;games:number}[]> = {
    top: buildLaneCandidates(allStreamers, matches, 'top'),
    jgl: buildLaneCandidates(allStreamers, matches, 'jgl'),
    mid: buildLaneCandidates(allStreamers, matches, 'mid'),
    adc: buildLaneCandidates(allStreamers, matches, 'adc'),
    sup: buildLaneCandidates(allStreamers, matches, 'sup'),
  };
  let best: { pairs:{lane:LineKey; p1:string; p2:string; games:number}[]; total:number } | null = null;
  // 3번 시도해서 가장 점수 높은 거 + 랜덤성
  for (let attempt=0; attempt<3; attempt++) {
    const attemptBest = { pairs: [] as any[], total: -1 };
    function dfs(idx: number, used: Set<string>, cur: any[], total:number) {
      if (idx === LINE_KEYS.length) {
        if (total > attemptBest.total) { attemptBest.total=total; attemptBest.pairs=[...cur]; }
        return;
      }
      const lane = LINE_KEYS[idx] as LineKey;
      const list = byLane[lane];
      if (list.length === 0) { dfs(idx+1, used, cur, total); return; }
      const shuffled = [...list.slice(0,6)].sort(()=>Math.random()-0.5);
      for (const c of shuffled) {
        if (used.has(c.p1) || used.has(c.p2)) continue;
        used.add(c.p1); used.add(c.p2);
        cur.push({ lane, p1:c.p1, p2:c.p2, games:c.games });
        dfs(idx+1, used, cur, total + c.games + Math.random()*2);
        cur.pop();
        used.delete(c.p1); used.delete(c.p2);
      }
    }
    dfs(0, new Set(), [], 0);
    if (!best || attemptBest.total > best.total) best = { pairs: attemptBest.pairs, total: attemptBest.total };
  }

  if (!best || best.pairs.length===0) {
    const red: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
    const blue: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
    const used = new Set<string>();
    let pool = [...allStreamers].sort(()=>Math.random()-0.5); // 랜덤
    for (const lane of LINE_KEYS as LineKey[]) {
      const mains = pool.filter(p => !used.has(p) && getMainPosition(p, matches) === lane);
      const picks = mains.length >=2 ? mains.slice(0,2) : pool.filter(p=>!used.has(p)).slice(0,2);
      if (picks[0]) { red[lane]=picks[0]; used.add(picks[0]); pool=pool.filter(p=>p!==picks[0]); }
      if (picks[1]) { blue[lane]=picks[1]; used.add(picks[1]); pool=pool.filter(p=>p!==picks[1]); }
    }
    return { red, blue, totalGames: 0, pairs: [] as any[] };
  }

  const red: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
  const blue: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
  for (const { lane, p1, p2 } of best.pairs) { red[lane]=p1; blue[lane]=p2; }
  const used = new Set([...Object.values(red), ...Object.values(blue)].filter(Boolean));
  let remaining = allStreamers.filter(p=>!used.has(p)).sort(()=>Math.random()-0.5);
  for (const lane of LINE_KEYS as LineKey[]) {
    if (!red[lane]) {
      const idx = remaining.findIndex(p=>getMainPosition(p, matches)===lane);
      const pick = idx>=0 ? remaining.splice(idx,1)[0] : remaining.shift();
      if (pick) { red[lane]=pick; used.add(pick); }
    }
    if (!blue[lane]) {
      const idx = remaining.findIndex(p=>getMainPosition(p, matches)===lane);
      const pick = idx>=0 ? remaining.splice(idx,1)[0] : remaining.shift();
      if (pick) { blue[lane]=pick; used.add(pick); }
    }
  }
  return { red, blue, totalGames: best.total, pairs: best.pairs };
}

// --- 승률 계산: 개인 승률 + 맞라인 전적 + 같은팀 시너지 ---
function calcTeamScores(red:TeamRoster, blue:TeamRoster, matches:Match[], stats?:any) {
  let redLaneScore=0, blueLaneScore=0, redIndiv=0, blueIndiv=0, redSynergy=0, blueSynergy=0;
  let laneGames=0, indivCount=0, synergyCount=0;

  for (const lane of LINE_KEYS as LineKey[]) {
    const r = red[lane], b = blue[lane];
    if (!r || !b) continue;
    const h2h = getLaneHeadToHead(r, b, lane, matches);
    if (h2h.total>0) {
      redLaneScore += h2h.p1Rate;
      blueLaneScore += 100 - h2h.p1Rate;
      laneGames++;
    } else {
      const rRate = getIndividualWinRate(r, matches).rate;
      const bRate = getIndividualWinRate(b, matches).rate;
      redLaneScore += rRate > bRate ? 55 : 45;
      blueLaneScore += bRate > rRate ? 55 : 45;
      laneGames++;
    }
  }

  const redPlayers = Object.values(red).filter(Boolean);
  const bluePlayers = Object.values(blue).filter(Boolean);
  for (const p of redPlayers) { redIndiv += getIndividualWinRate(p, matches).rate; indivCount++; }
  for (const p of bluePlayers) { blueIndiv += getIndividualWinRate(p, matches).rate; }
  redIndiv = redPlayers.length ? redIndiv/redPlayers.length : 50;
  blueIndiv = bluePlayers.length ? blueIndiv/bluePlayers.length : 50;

  let rSyn=0, rCnt=0, bSyn=0, bCnt=0;
  for (let i=0;i<redPlayers.length;i++) for (let j=i+1;j<redPlayers.length;j++) { rSyn+=getSameTeamWinRate(redPlayers[i], redPlayers[j], matches); rCnt++; }
  for (let i=0;i<bluePlayers.length;i++) for (let j=i+1;j<bluePlayers.length;j++) { bSyn+=getSameTeamWinRate(bluePlayers[i], bluePlayers[j], matches); bCnt++; }
  redSynergy = rCnt? rSyn/rCnt : 50;
  blueSynergy = bCnt? bSyn/bCnt : 50;

  const rLaneAvg = laneGames? redLaneScore/laneGames : 50;
  const bLaneAvg = laneGames? blueLaneScore/laneGames : 50;

  // 최종 점수: 맞라인 50% + 개인 30% + 시너지 20%
  const redFinal = rLaneAvg*0.5 + redIndiv*0.3 + redSynergy*0.2;
  const blueFinal = bLaneAvg*0.5 + blueIndiv*0.3 + blueSynergy*0.2;

  const total = redFinal+blueFinal;
  const redWinRate = total ? redFinal/total*100 : 50;
  const blueWinRate = total ? blueFinal/total*100 : 50;

  return { 
    red: redWinRate, blue: blueWinRate, 
    detail: { redLane: rLaneAvg, blueLane: bLaneAvg, redIndiv, blueIndiv, redSynergy, blueSynergy, laneGames },
    redPlayers, bluePlayers
  };
}

export const MainTab: React.FC<MainTabProps> = ({ stats, matches, onOpenSummaryModal, onToast, allStreamers }) => {
  const [redTeam, setRedTeam] = useState<TeamRoster>({ top:'', jgl:'', mid:'', adc:'', sup:'' });
  const [blueTeam, setBlueTeam] = useState<TeamRoster>({ top:'', jgl:'', mid:'', adc:'', sup:'' });
  const [winRate, setWinRate] = useState<ReturnType<typeof calcTeamScores>|null>(null);
  const [showSynergyModal, setShowSynergyModal] = useState(false);
  const [synergyDetail, setSynergyDetail] = useState<any>(null);

  const woorimingStats = useMemo(()=>{
    let wins=0, losses=0, total=0;
    let monthWins=0, monthLosses=0, monthTotal=0;
    const lineCounts: Record<LineKey, number> = { top:0, jgl:0, mid:0, adc:0, sup:0 };
    const now = new Date();
    const thisMonthStr = '2026-09';
    for (const m of matches) {
      const team = getPlayerTeam(m, '우리밍_');
      if (!team) continue;
      const winner = getWinningTeam(m);
      if (!winner) continue;
      total++;
      if (team===winner) wins++; else losses++;
      const mMonth = (m.date||'').slice(0,7);
      if (mMonth===thisMonthStr) {
        monthTotal++;
        if (team===winner) monthWins++; else monthLosses++;
      }
      for (const k of LINE_KEYS as LineKey[]) {
        if ((m.team_a?.[k]||'').trim()==='우리밍_' || (m.team_b?.[k]||'').trim()==='우리밍_') lineCounts[k]++;
      }
    }
    let maxLine: LineKey='adc', maxCnt=-1;
    for (const k of LINE_KEYS as LineKey[]) { if (lineCounts[k]>maxCnt){maxCnt=lineCounts[k]; maxLine=k;} }
    const winRate = total? Math.round(wins/total*100):0;
    const monthWinRate = monthTotal? Math.round(monthWins/monthTotal*100): winRate;
    return { wins, losses, total, winRate, monthWins, monthLosses, monthTotal, monthWinRate, mainLine: maxLine };
  }, [matches]);

  const monthlyStats = useMemo(()=>{
    const byMonth: Record<string, {wins:number, losses:number, total:number}> = {};
    for (const m of matches) {
      const team = getPlayerTeam(m, '우리밍_');
      if (!team) continue;
      const winner = getWinningTeam(m);
      if (!winner) continue;
      const month = (m.date||'').slice(0,7) || '2026-09';
      if (!byMonth[month]) byMonth[month]={wins:0, losses:0, total:0};
      byMonth[month].total++;
      if (team===winner) byMonth[month].wins++; else byMonth[month].losses++;
    }
    const sorted = Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0])).slice(-3);
    return sorted.map(([month, s])=>({
      month,
      label: month.slice(5)+'월',
      rate: s.total ? Math.round(s.wins/s.total*100) : 0,
      text: `${s.total}판 ${s.total?Math.round(s.wins/s.total*100):0}%`,
      subText: `${s.total}판 ${Math.round(s.wins/s.total*100)}%`,
      ...s
    }));
  }, [matches]);

  const recentGames = useMemo(()=>{
    const list = matches.filter(m=> getPlayerTeam(m, '우리밍_')).slice(0,10);
    return list.map(m=>{
      const team = getPlayerTeam(m, '우리밍_');
      const winner = getWinningTeam(m);
      return team===winner ? 'W' : 'L';
    });
  }, [matches]);

  const playerMainPos = useMemo(()=>{ const m=new Map<string,LineKey>(); for(const p of allStreamers) m.set(p,getMainPosition(p,matches)); return m; }, [allStreamers, matches]);
  
  // CK일지 기반 진짜 Best 파트너 계산 - 우리밍_과 함께한 승률 기반
  const realBestPartners = useMemo(()=>{
    const result: Record<string, { name: string; line: string; wins: number; total: number; rate: number; mostChamps: {name:string; rate:number}[] }> = {} as any;
    const target = '우리밍_';
    
    for (const lane of LINE_KEYS as LineKey[]) {
      if (lane === 'adc') continue; // 우리밍_이 ADC니까 제외
      let bestName = '';
      let bestWins = 0;
      let bestTotal = 0;
      let bestRate = 0;
      
      for (const player of allStreamers) {
        if (player === target) continue;
        const mainPos = getMainPosition(player, matches);
        if (mainPos !== lane) continue;
        
        // 같은 팀 승률 계산
        let wins = 0, total = 0;
        for (const m of matches) {
          const t1 = getPlayerTeam(m, target);
          const t2 = getPlayerTeam(m, player);
          if (!t1 || !t2 || t1 !== t2) continue;
          const winner = getWinningTeam(m);
          if (!winner) continue;
          total++;
          if (t1 === winner) wins++;
        }
        if (total === 0) continue;
        const rate = wins/total*100;
        // 최소 2판 이상, 승률 높은 순
        if (total >= 2 && (rate > bestRate || (rate === bestRate && total > bestTotal))) {
          bestName = player;
          bestWins = wins;
          bestTotal = total;
          bestRate = rate;
        }
      }
      
      if (bestName) {
        // 모스트 챔피언 계산 - 해당 파트너가 같이 있을 때 우리밍_이 한 챔피언 승률
        const champStats: Record<string, {wins:number, total:number}> = {};
        for (const m of matches) {
          const t1 = getPlayerTeam(m, target);
          const t2 = getPlayerTeam(m, bestName);
          if (!t1 || !t2 || t1 !== t2) continue;
          // 우리밍_의 챔피언 찾기
          let champ = '';
          for (const k of LINE_KEYS as LineKey[]) {
            if ((m.team_a?.[k]||'').trim() === target) champ = (m as any).team_a_champs?.[k] || '';
            if ((m.team_b?.[k]||'').trim() === target) champ = (m as any).team_b_champs?.[k] || '';
          }
          if (!champ) continue;
          if (!champStats[champ]) champStats[champ] = {wins:0, total:0};
          champStats[champ].total++;
          const winner = getWinningTeam(m);
          if (getPlayerTeam(m, target) === winner) champStats[champ].wins++;
        }
        const mostChamps = Object.entries(champStats)
          .map(([name, s])=>({name, rate: s.total ? Math.round(s.wins/s.total*100) : 0, total: s.total}))
          .sort((a,b)=> b.rate - a.rate || b.total - a.total)
          .slice(0,3);
        
        result[lane] = {
          name: bestName,
          line: lane.toUpperCase(),
          wins: bestWins,
          total: bestTotal,
          rate: Math.round(bestRate),
          mostChamps
        };
      }
    }
    return result;
  }, [matches, allStreamers]);
  
  const isFull = useMemo(()=> LINE_KEYS.every(k=> redTeam[k as LineKey] && blueTeam[k as LineKey]), [redTeam, blueTeam]);

  const handleFill = useCallback(()=>{
    const result = findBalancedLineup(allStreamers, matches);
    setRedTeam(result.red);
    setBlueTeam(result.blue);
    setWinRate(null);
    onToast(`등록 완료! ${result.totalGames>0 ? `맞라인 ${Math.round(result.totalGames)}판 전적` : '주포지션 기반'} - 매번 다른 선수로 구성`);
  }, [allStreamers, matches, onToast]);

  const handleClear = useCallback(()=>{ setRedTeam({top:'',jgl:'',mid:'',adc:'',sup:''}); setBlueTeam({top:'',jgl:'',mid:'',adc:'',sup:''}); setWinRate(null); setSynergyDetail(null); setShowSynergyModal(false); onToast('초기화 완료'); }, [onToast]);

  const handleAnalyze = useCallback(()=>{
    if(!isFull){ onToast('10명이 모두 채워져야 분석 가능합니다.'); return; }
    const result = calcTeamScores(redTeam, blueTeam, matches, stats);
    setWinRate(result);
    setSynergyDetail(result);
    setShowSynergyModal(true);
    onToast(`시너지 분석: Red ${result.red.toFixed(1)}% vs Blue ${result.blue.toFixed(1)}% - 상세 창 열림`);
  }, [isFull, redTeam, blueTeam, matches, stats, onToast]);

  const handleOptimal = useCallback(()=>{
    if(!isFull){ onToast('10명이 모두 채워져야 재배치가 가능합니다.'); return; }
    // 32가지 조합 중 최적
    let best:any=null, bestDiff=Infinity;
    for (let mask=0; mask < (1<<LINE_KEYS.length); mask++) {
      const red:TeamRoster={top:'',jgl:'',mid:'',adc:'',sup:''};
      const blue:TeamRoster={top:'',jgl:'',mid:'',adc:'',sup:''};
      for (let i=0;i<LINE_KEYS.length;i++) {
        const p=LINE_KEYS[i] as LineKey;
        const a=redTeam[p], b=blueTeam[p];
        if ((mask & (1<<i))===0) { red[p]=a; blue[p]=b; } else { red[p]=b; blue[p]=a; }
      }
      const score = calcTeamScores(red, blue, matches, stats);
      const diff = Math.abs(score.red - score.blue);
      const avgSynergy = (score.detail.redSynergy + score.detail.blueSynergy)/2;
      const finalScore = diff - avgSynergy*0.05; // 밸런스 좋고 시너지 높을수록 좋음
      if (finalScore < bestDiff) { bestDiff=finalScore; best={red, blue, score}; }
    }
    if (best) {
      setRedTeam(best.red);
      setBlueTeam(best.blue);
      setWinRate(best.score);
      setSynergyDetail(best.score);
      setShowSynergyModal(true);
      onToast(`최적 재배치 완료! Red ${best.score.red.toFixed(1)}% vs Blue ${best.score.blue.toFixed(1)}% - 50/50에 가깝게 밸런스 맞춤`);
    }
  }, [isFull, redTeam, blueTeam, matches, stats, onToast]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* 왼쪽 */}
        <div className="space-y-5">
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 flex flex-col items-center text-center">
            <button onClick={onOpenSummaryModal} className="relative w-[110px] h-[110px] mb-4 group">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#1e1e2a" strokeWidth="8" />
                <circle cx="50" cy="50" r="46" fill="none" stroke="#a78bfa" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${woorimingStats.monthWinRate*2.89} 289`} className="group-hover:stroke-[#c4b5fd] transition" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[22px] font-black text-white group-hover:text-[#c4b5fd]">우</div>
                <div className="text-[16px] font-black text-[#a78bfa]">{woorimingStats.monthWinRate}%</div>
              </div>
            </button>
            <div className="text-[16px] font-bold text-white">우리밍_</div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[11px] text-[#c2c6d6]">
              <span>이번달 (2026-09)</span><span>•</span><span className="text-[#c0c0d0] font-bold">{woorimingStats.mainLine.toUpperCase()}</span>
            </div>
            <div className="mt-3 text-[12px] text-[#c0c0d0]">{woorimingStats.monthWins}승 {woorimingStats.monthLosses}패 / 총 {woorimingStats.monthTotal}판</div>
            <button onClick={onOpenSummaryModal} className="mt-4 w-full h-[36px] bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-full text-[11px] font-bold text-[#c2c6d6]">전체 전적 상세 보기</button>
          </div>

          {/* 승률 추이 - 글씨 빼고, 세로 그래프, 3개 */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-xl px-3 py-2.5 flex items-center justify-between mb-3">
              <span className="text-[11px] text-[#c2c6d6]">전체 승률</span>
              <span className="text-[12px] font-bold text-[#a78bfa]">{woorimingStats.winRate}% ({woorimingStats.wins}승 {woorimingStats.losses}패)</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#9aa0b8] mb-2">
              <span>월별 승률</span><span>최근 3개월</span>
            </div>
            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-xl p-3 mb-4">
              {/* 세로 그래프 */}
              <div className="flex items-end justify-around h-[100px] gap-2">
                {(monthlyStats.length>0 ? monthlyStats : [
                  {label:'08월', rate:39, total:28, subText:'28판 39%'},
                  {label:'09월', rate:52, total:25, subText:'25판 52%'},
                  {label:'10월', rate:45, total:12, subText:'12판 45%'}
                ]).slice(-3).map((m,i,arr)=>(
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="text-[11px] font-bold text-white">{m.rate}%</div>
                    <div className="w-full flex justify-center items-end h-[60px]">
                      <div className="w-[80%] rounded-t-lg transition-all" 
                        style={{
                          height: `${Math.max(10, m.rate)}%`,
                          background: i===arr.length-1 ? '#a78bfa' : '#3a3a4a',
                          minHeight: '8px'
                        }} />
                    </div>
                    <div className="text-[10px] font-bold text-[#c2c6d6]">{m.label}</div>
                    <div className="text-[9px] text-[#9aa0b8]">{m.subText || `${m.total}판 ${m.rate}%`}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#9aa0b8] mb-2"><span>최근 10경기 흐름</span><span>승(Blue) / 패(Red)</span></div>
            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e2a] text-[#9aa0b8]">[10경기 전]</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e2a] text-[#a78bfa]">[최신 경기]</span>
              </div>
              {/* 5x2 그리드, 승 파란색, 패 빨간색 */}
              <div className="grid grid-cols-5 gap-1.5">
                {recentGames.map((r,i)=>(
                  <div key={i} className={`aspect-square rounded-[10px] grid place-items-center text-[11px] font-black border text-white ${r==='W'?'bg-[#3b82f6] border-[#3b82f6]':'bg-[#ef4444] border-[#ef4444]'}`}>
                    {r==='W' ? '승' : '패'}
                  </div>
                ))}
                {recentGames.length===0 && Array.from({length:10}).map((_,i)=>(
                  <div key={i} className="aspect-square rounded-[10px] bg-[#1e1e2a] border border-white/10 grid place-items-center text-[10px] text-white/20">-</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 */}
        <div className="space-y-5">
          {/* 승률 기반 시너지팀 배너 - 라인별 팀 입력 바로 위로 이동 */}
          <div className="bg-[#1e1b2e] border border-[#7c3aed]/30 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 shadow-[0_0_20px_rgba(124,58,237,0.1)]">
            <div className="flex items-center gap-2.5 text-[13px] font-bold text-white leading-tight">
              <span className="text-[16px] shrink-0">⚡</span>
              <span>승률 기반으로 최고의 시너지팀을 짜드립니다 - CK 10인 이름을 넣으면 최적의 5:5를 추천</span>
            </div>
            <button className="shrink-0 h-[28px] px-4 bg-[#7c3aed] hover:bg-[#6d28e0] rounded-full text-[11px] font-bold text-white transition">CK 템플릿</button>
          </div>

          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-black text-white">라인별 팀 입력 <span className="text-[#9aa0b8] font-normal text-[11px] ml-1">(10인 명단)</span></h3>
              <div className="flex items-center gap-2">
                <button onClick={handleClear} className="h-[32px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full text-[11px] font-bold text-[#c2c6d6] border border-[#2a2a3a]">비우기</button>
                <button onClick={handleFill} className="h-[32px] px-4 bg-[#7c3aed] hover:bg-[#6d28e0] border border-[#7c3aed] rounded-full text-[11px] font-bold text-white flex items-center gap-1.5 shadow-[0_0_12px_#7c3aed]/30">
                  <span>✨</span> 등록 선수 채우기
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#1a1010]/50 border border-[#3a1e1e] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-[0_0_8px_#ef4444]" /><span className="text-[12px] font-black text-[#f87171]">Red팀</span>{winRate && <span className="ml-auto text-[13px] font-black text-[#f87171]">{winRate.red.toFixed(1)}%</span>}</div>
                {(LINE_KEYS as LineKey[]).map(pos=>(
                  <div key={`red-${pos}`} className="flex items-center gap-3 mb-2.5">
                    <div className="w-[36px] text-[11px] font-bold text-[#c2c6d6] uppercase">{pos}</div>
                    <div className="flex-1 relative">
                      <input list="main-players" value={redTeam[pos]} onChange={e=>{ setRedTeam(p=>({...p,[pos]:e.target.value})); setWinRate(null); }} placeholder="스트리머 이름" className="w-full h-[36px] bg-[#08080c] border border-[#2a1e1e] rounded-full px-4 text-[12px] text-white placeholder:text-[#9aa0b8] focus:outline-none focus:border-[#ef4444]/50" />
                      {redTeam[pos] && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded-full bg-[#2a1e1e] text-[#c2c6d6]">주:{playerMainPos.get(redTeam[pos])?.toUpperCase()||'-'}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-[#101a2a]/50 border border-[#1e2a4a] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3"><div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]" /><span className="text-[12px] font-black text-[#60a5fa]">Blue팀</span>{winRate && <span className="ml-auto text-[13px] font-black text-[#60a5fa]">{winRate.blue.toFixed(1)}%</span>}</div>
                {(LINE_KEYS as LineKey[]).map(pos=>(
                  <div key={`blue-${pos}`} className="flex items-center gap-3 mb-2.5">
                    <div className="w-[36px] text-[11px] font-bold text-[#c2c6d6] uppercase">{pos}</div>
                    <div className="flex-1 relative">
                      <input list="main-players" value={blueTeam[pos]} onChange={e=>{ setBlueTeam(p=>({...p,[pos]:e.target.value})); setWinRate(null); }} placeholder="스트리머 이름" className="w-full h-[36px] bg-[#08080c] border border-[#1e2a4a] rounded-full px-4 text-[12px] text-white placeholder:text-[#9aa0b8] focus:outline-none focus:border-[#3b82f6]/50" />
                      {blueTeam[pos] && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded-full bg-[#1e2a4a] text-[#c2c6d6]">주:{playerMainPos.get(blueTeam[pos])?.toUpperCase()||'-'}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {winRate ? (
              <div className="mt-4 bg-[#08080c] border border-[#1e1e2a] rounded-xl p-3">
                <div className="flex items-center justify-between text-[12px] mb-2">
                  <div className="text-[#c2c6d6]">예상 승률: Red <b className="text-[#f87171]">{winRate.red.toFixed(1)}%</b> vs Blue <b className="text-[#60a5fa]">{winRate.blue.toFixed(1)}%</b></div>
                  <div className="text-[10px] text-[#9aa0b8]">맞라인 {winRate.detail.laneGames}라인 • 개인 {winRate.detail.redIndiv.toFixed(0)}% vs {winRate.detail.blueIndiv.toFixed(0)}%</div>
                </div>
                <div className="w-full bg-[#1e1e2a] rounded-full h-2 overflow-hidden flex">
                  <div className="h-full bg-[#ef4444]" style={{width:`${winRate.red}%`}} />
                  <div className="h-full bg-[#3b82f6]" style={{width:`${winRate.blue}%`}} />
                </div>
                <div className="flex justify-between text-[9px] text-[#9aa0b8] mt-1">
                  <span>맞라인 우세 {winRate.detail.redLane.toFixed(0)}% • 시너지 {winRate.detail.redSynergy.toFixed(0)}%</span>
                  <span>시너지 {winRate.detail.blueSynergy.toFixed(0)}% • 맞라인 {winRate.detail.blueLane.toFixed(0)}%</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-[11px] text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-full px-3 py-2 text-center">10명의 라인별 데이터가 모두 채워져야 시너지 분석 및 최적 재배치가 가능합니다. (현재 {Object.values(redTeam).filter(Boolean).length + Object.values(blueTeam).filter(Boolean).length}/10명)</div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={handleAnalyze} disabled={!isFull} className={`flex-1 h-[42px] rounded-full text-[12px] font-bold border transition ${isFull?'bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white border-[#2a2a3a]':'bg-[#12121a] text-[#9aa0b8] border-[#1e1e2a] cursor-not-allowed'}`}>현재 팀 시너지 분석</button>
              <button onClick={handleOptimal} disabled={!isFull} className={`flex-1 h-[42px] rounded-full text-[12px] font-bold border transition ${isFull?'bg-[#7c3aed] hover:bg-[#6d28e0] text-white border-[#7c3aed] shadow-[0_0_12px_#7c3aed]/30':'bg-[#12121a] text-[#9aa0b8] border-[#1e1e2a] cursor-not-allowed'}`}>승률 기반 최적 팀으로 재배치</button>
            </div>
          </div>

          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-[14px] font-bold text-white"><span>🤝</span> 라인별 Best 파트너</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[#c2c6d6]">ADC 기준</span>
            </div>
            <div className="text-[11px] text-[#9aa0b8] mb-4">2026-09 (또는 전체) 경기 기준 • 함께 이긴 승률이 가장 높은 파트너</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(LINE_KEYS as LineKey[]).filter(k=>k!=='adc').map(lane=>{
                // CK일지 기반 진짜 데이터 우선, 없으면 stats, 없으면 빈 데이터
                const real = realBestPartners[lane];
                const statBest = (stats as any)?.bestPartners?.[lane];
                const best = real || statBest || { name: '데이터 없음', line: lane.toUpperCase(), wins:0, total:0, rate:0, mostChamps: [] };
                return (
                  <div key={lane} className="bg-[#08080c] border border-[#1e1e2a] rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#c2c6d6]">{lane.toUpperCase()} 라인 Best</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#1e1e2a] text-[#9aa0b8]">이번달</span>
                    </div>
                    <div className="text-[12px] font-bold text-white truncate">
                      {best.name !== '데이터 없음' ? `${best.name} (${best.line||lane.toUpperCase()})` : '아직 함께한 전적 없음'} 
                      <span className="text-[#a78bfa] ml-1">{best.total>0 ? `${best.rate}%` : ''}</span>
                    </div>
                    <div className="text-[11px] text-[#c2c6d6] mb-2">
                      {best.total>0 ? `${best.total}전 ${best.wins}승 ${best.total-best.wins}패` : 'CK일지에 함께한 경기가 없습니다'}
                    </div>
                    <div className="w-full bg-[#1e1e2a] rounded-full h-1 mb-3"><div className="h-1 bg-[#a78bfa] rounded-full transition-all" style={{width:`${Math.min(100, best.rate||75)}%`}} /></div>
                    <div className="flex items-center justify-between text-[9px] text-[#9aa0b8] mb-1.5"><span>{lane.toUpperCase()} 모스트</span><span>TOP 3</span></div>
                    <div className="flex gap-1.5 flex-wrap min-h-[28px]">
                      {(((best as any).mostChamps && (best as any).mostChamps.length > 0 ? (best as any).mostChamps : [{name:'사이온', rate:100},{name:'크산테', rate:100},{name:'자크', rate:100}]) as any[]).slice(0,3).map((c:any,i:number)=>(
                        <div key={i} className="px-2 py-1 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[10px] text-[#c2c6d6] flex items-center gap-1.5">
                          <ChampionIcon name={c.name} size={18} shape="circle" />
                          <span>{c.name} {c.total ? `${c.total}판` : '1판'} ({c.rate||100}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 시너지 분석 상세 모달 - 버튼 눌렀을 때 창 뜨게 */}
      {showSynergyModal && synergyDetail && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowSynergyModal(false)}>
          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-[20px] max-w-[520px] w-full p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-black text-white">팀 시너지 분석 상세</h3>
              <button onClick={()=>setShowSynergyModal(false)} className="w-8 h-8 rounded-full bg-[#1e1e2a] grid place-items-center text-[#c2c6d6]">✕</button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#1a1010] border border-[#3a1e1e] rounded-xl p-3 text-center">
                <div className="text-[11px] text-[#c2c6d6]">Red팀 예상 승률</div>
                <div className="text-[28px] font-black text-[#f87171]">{synergyDetail.red.toFixed(1)}%</div>
                <div className="text-[10px] text-[#9aa0b8] mt-1">맞라인 {synergyDetail.detail.redLane.toFixed(0)}% + 개인 {synergyDetail.detail.redIndiv.toFixed(0)}% + 시너지 {synergyDetail.detail.redSynergy.toFixed(0)}%</div>
              </div>
              <div className="bg-[#101a2a] border border-[#1e2a4a] rounded-xl p-3 text-center">
                <div className="text-[11px] text-[#c2c6d6]">Blue팀 예상 승률</div>
                <div className="text-[28px] font-black text-[#60a5fa]">{synergyDetail.blue.toFixed(1)}%</div>
                <div className="text-[10px] text-[#9aa0b8] mt-1">맞라인 {synergyDetail.detail.blueLane.toFixed(0)}% + 개인 {synergyDetail.detail.blueIndiv.toFixed(0)}% + 시너지 {synergyDetail.detail.blueSynergy.toFixed(0)}%</div>
              </div>
            </div>

            <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto">
              {LINE_KEYS.map(lane=> {
                const r = redTeam[lane as LineKey], b = blueTeam[lane as LineKey];
                if (!r || !b) return null;
                const h2h = getLaneHeadToHead(r, b, lane as LineKey, matches);
                return (
                  <div key={lane} className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 py-2 text-[11px]">
                    <span className="text-[#c2c6d6] w-[30px]">{lane.toUpperCase()}</span>
                    <span className="text-white">{r}</span>
                    <span className="text-[10px] text-[#a78bfa]">{h2h.total>0 ? `${h2h.p1Wins}승 ${h2h.p2Wins}패 (${h2h.p1Rate.toFixed(0)}%)` : `${getIndividualWinRate(r, matches).rate.toFixed(0)}% vs ${getIndividualWinRate(b, matches).rate.toFixed(0)}%`}</span>
                    <span className="text-white">{b}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button onClick={()=>setShowSynergyModal(false)} className="flex-1 h-[40px] bg-[#1e1e2a] border border-[#2a2a3a] rounded-full text-[12px] font-bold text-white">닫기</button>
              <button onClick={()=>{setShowSynergyModal(false); handleOptimal();}} className="flex-1 h-[40px] bg-[#7c3aed] rounded-full text-[12px] font-bold text-white">최적 팀으로 재배치</button>
            </div>
          </div>
        </div>
      )}

      <datalist id="main-players">{allStreamers.map(n=><option key={n} value={n} />)}</datalist>
    </div>
  );
};
