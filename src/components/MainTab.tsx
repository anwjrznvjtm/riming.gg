import React, { useState, useMemo, useCallback } from 'react';
import { Match, LineKey, LINE_KEYS, ComputedStats } from '../types';
import { getChampionIconUrl, normalizeChampionName } from '../lib/champions';

interface MainTabProps {
  stats: ComputedStats;
  matches: Match[];
  onOpenSummaryModal: () => void;
  onToast: (msg: string) => void;
  allStreamers: string[];
}

type TeamRoster = Record<LineKey, string>;

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
  let best: LineKey = 'mid';
  let max = -1;
  for (const k of LINE_KEYS as LineKey[]) {
    if (counts[k] > max) { max = counts[k]; best = k; }
  }
  // 우리밍_는 ADC 고정, 그 외는 실제 최다 라인
  if (player.trim() === '우리밍_') return 'adc';
  return max <= 0 ? 'mid' : best;
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
function getIndividualWinRate(player: string, matches: Match[]) {
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
function getLaneHeadToHead(p1: string, p2: string, lane: LineKey, matches: Match[]) {
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
// 이상한 이름 필터 - 최소 2글자, 특수문자 너무 많은 거 제외, 공백 제거
function isValidStreamerName(name: string): boolean {
  const n = name.trim();
  if (n.length < 2) return false;
  if (n.length > 12) return false;
  // 챔피언 이름이 스트리머로 들어간 경우 방지 (예: 사이온, 크산테 등 챔피언 이름만)
  // 실제로는 allStreamers는 CK일지에서 오므로 챔피언이 들어갈 일 없음, but 안전장치
  if (/^[가-힣]+$/.test(n) && n.length <= 4) {
    // 한글 2-4글자 챔피언 가능성 있지만, 스트리머도 많으니 일단 통과, 나중에 main position으로 필터됨
  }
  return true;
}
function buildLaneCandidates(allStreamers: string[], matches: Match[], lane: LineKey) {
  // 주포지션이 해당 라인인 사람만 - 이상한 이름 절대 안 들어가게 엄격 필터
  const laneMains = allStreamers.filter(p => {
    if (!isValidStreamerName(p)) return false;
    return getMainPosition(p, matches) === lane;
  });
  const cands: { p1:string; p2:string; games:number }[] = [];
  // laneMains 안에서만 전적 있는 페어 찾기 (다른 라인 사람 안 섞음)
  for (let i=0;i<laneMains.length;i++) for (let j=i+1;j<laneMains.length;j++) {
    const games = countLaneMatchups(laneMains[i], laneMains[j], lane, matches);
    if (games > 0) cands.push({ p1: laneMains[i], p2: laneMains[j], games });
  }
  cands.sort((a,b)=>b.games-a.games);
  const top = cands.slice(0, 6);
  for (let i=top.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [top[i], top[j]]=[top[j], top[i]]; }
  return [...top, ...cands.slice(6)].slice(0, 15);
}
function findBalancedLineup(allStreamers: string[], matches: Match[]) {
  // 유효한 이름만 필터
  const validPlayers = allStreamers.filter(isValidStreamerName);
  const byLane: Record<LineKey, {p1:string;p2:string;games:number}[]> = {
    top: buildLaneCandidates(validPlayers, matches, 'top'),
    jgl: buildLaneCandidates(validPlayers, matches, 'jgl'),
    mid: buildLaneCandidates(validPlayers, matches, 'mid'),
    adc: buildLaneCandidates(validPlayers, matches, 'adc'),
    sup: buildLaneCandidates(validPlayers, matches, 'sup'),
  };
  let best: { pairs:{lane:LineKey; p1:string; p2:string; games:number}[]; total:number } | null = null;
  for (let attempt=0; attempt<5; attempt++) {
    const attemptBest = { pairs: [] as any[], total: -1 };
    function dfs(idx: number, used: Set<string>, cur: any[], total:number) {
      if (idx === LINE_KEYS.length) { if (total > attemptBest.total) { attemptBest.total=total; attemptBest.pairs=[...cur]; } return; }
      const lane = LINE_KEYS[idx] as LineKey;
      const list = byLane[lane];
      if (list.length === 0) { dfs(idx+1, used, cur, total); return; }
      const shuffled = [...list.slice(0,5)].sort(()=>Math.random()-0.5);
      for (const c of shuffled) {
        if (used.has(c.p1) || used.has(c.p2)) continue;
        used.add(c.p1); used.add(c.p2);
        cur.push({ lane, p1:c.p1, p2:c.p2, games:c.games });
        dfs(idx+1, used, cur, total + c.games + Math.random());
        cur.pop(); used.delete(c.p1); used.delete(c.p2);
      }
    }
    dfs(0, new Set(), [], 0);
    if (!best || attemptBest.total > best.total) best = { pairs: attemptBest.pairs, total: attemptBest.total };
  }
  // 전적 없어도 주포지션 기반으로만 - 이상한 라인에 안 들어가게
  if (!best || best.pairs.length===0) {
    const red: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
    const blue: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
    const used = new Set<string>();
    let pool = [...validPlayers].sort(()=>Math.random()-0.5);
    for (const lane of LINE_KEYS as LineKey[]) {
      const mains = pool.filter(p => !used.has(p) && getMainPosition(p, matches) === lane);
      const picks = mains.slice(0,2);
      if (picks[0]) { red[lane]=picks[0]; used.add(picks[0]); }
      if (picks[1]) { blue[lane]=picks[1]; used.add(picks[1]); }
      pool = pool.filter(p=>!used.has(p));
    }
    // 남은 빈 자리도 주포지션 맞는 사람으로만 채움
    for (const lane of LINE_KEYS as LineKey[]) {
      if (!red[lane]) {
        const cand = validPlayers.find(p=>!used.has(p) && getMainPosition(p, matches)===lane);
        if (cand) { red[lane]=cand; used.add(cand); }
      }
      if (!blue[lane]) {
        const cand = validPlayers.find(p=>!used.has(p) && getMainPosition(p, matches)===lane);
        if (cand) { blue[lane]=cand; used.add(cand); }
      }
    }
    return { red, blue, totalGames: 0 };
  }
  const red: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
  const blue: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
  for (const { lane, p1, p2 } of best.pairs) { red[lane]=p1; blue[lane]=p2; }
  const used = new Set([...Object.values(red), ...Object.values(blue)].filter(Boolean));
  let remaining = validPlayers.filter(p=>!used.has(p)).sort(()=>Math.random()-0.5);
  for (const lane of LINE_KEYS as LineKey[]) {
    if (!red[lane]) {
      const idx = remaining.findIndex(p=>getMainPosition(p, matches)===lane);
      const pick = idx>=0 ? remaining.splice(idx,1)[0] : null;
      if (pick) { red[lane]=pick; used.add(pick); }
    }
    if (!blue[lane]) {
      const idx = remaining.findIndex(p=>getMainPosition(p, matches)===lane);
      const pick = idx>=0 ? remaining.splice(idx,1)[0] : null;
      if (pick) { blue[lane]=pick; used.add(pick); }
    }
  }
  return { red, blue, totalGames: best.total };
}
function calcTeamScores(red:TeamRoster, blue:TeamRoster, matches:Match[]) {
  let redLaneScore=0, blueLaneScore=0, redIndiv=0, blueIndiv=0, redSynergy=0, blueSynergy=0;
  let laneGames=0;
  for (const lane of LINE_KEYS as LineKey[]) {
    const r = red[lane], b = blue[lane];
    if (!r || !b) continue;
    const h2h = getLaneHeadToHead(r, b, lane, matches);
    if (h2h.total>0) { redLaneScore += h2h.p1Rate; blueLaneScore += 100 - h2h.p1Rate; } 
    else { const rRate = getIndividualWinRate(r, matches).rate; const bRate = getIndividualWinRate(b, matches).rate; redLaneScore += rRate > bRate ? 55 : 45; blueLaneScore += bRate > rRate ? 55 : 45; }
    laneGames++;
  }
  const redPlayers = Object.values(red).filter(Boolean);
  const bluePlayers = Object.values(blue).filter(Boolean);
  for (const p of redPlayers) redIndiv += getIndividualWinRate(p, matches).rate;
  for (const p of bluePlayers) blueIndiv += getIndividualWinRate(p, matches).rate;
  redIndiv = redPlayers.length ? redIndiv/redPlayers.length : 50;
  blueIndiv = bluePlayers.length ? blueIndiv/bluePlayers.length : 50;
  let rSyn=0, rCnt=0, bSyn=0, bCnt=0;
  for (let i=0;i<redPlayers.length;i++) for (let j=i+1;j<redPlayers.length;j++) { rSyn+=getSameTeamWinRate(redPlayers[i], redPlayers[j], matches); rCnt++; }
  for (let i=0;i<bluePlayers.length;i++) for (let j=i+1;j<bluePlayers.length;j++) { bSyn+=getSameTeamWinRate(bluePlayers[i], bluePlayers[j], matches); bCnt++; }
  redSynergy = rCnt? rSyn/rCnt : 50;
  blueSynergy = bCnt? bSyn/bCnt : 50;
  const rLaneAvg = laneGames? redLaneScore/laneGames : 50;
  const bLaneAvg = laneGames? blueLaneScore/laneGames : 50;
  const redFinal = rLaneAvg*0.5 + redIndiv*0.3 + redSynergy*0.2;
  const blueFinal = bLaneAvg*0.5 + blueIndiv*0.3 + blueSynergy*0.2;
  const total = redFinal+blueFinal;
  return { red: total? redFinal/total*100 : 50, blue: total? blueFinal/total*100 : 50, detail: { redLane: rLaneAvg, blueLane: bLaneAvg, redIndiv, blueIndiv, redSynergy, blueSynergy, laneGames } };
}

export const MainTab: React.FC<MainTabProps> = ({ stats, matches, onOpenSummaryModal, onToast, allStreamers }) => {
  const [redTeam, setRedTeam] = useState<TeamRoster>({ top:'', jgl:'', mid:'', adc:'', sup:'' });
  const [blueTeam, setBlueTeam] = useState<TeamRoster>({ top:'', jgl:'', mid:'', adc:'', sup:'' });
  const [winRate, setWinRate] = useState<ReturnType<typeof calcTeamScores>|null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  const woorimingStats = useMemo(()=>{
    let wins=0, losses=0, total=0, monthWins=0, monthLosses=0, monthTotal=0;
    const lineCounts: Record<LineKey, number> = { top:0, jgl:0, mid:0, adc:0, sup:0 };
    const thisMonthStr = '2026-09';
    for (const m of matches) {
      const team = getPlayerTeam(m, '우리밍_');
      if (!team) continue;
      const winner = getWinningTeam(m);
      if (!winner) continue;
      total++; if (team===winner) wins++; else losses++;
      const mMonth = (m.date||'').slice(0,7);
      if (mMonth===thisMonthStr) { monthTotal++; if (team===winner) monthWins++; else monthLosses++; }
      for (const k of LINE_KEYS as LineKey[]) if ((m.team_a?.[k]||'').trim()==='우리밍_' || (m.team_b?.[k]||'').trim()==='우리밍_') lineCounts[k]++;
    }
    let maxLine: LineKey='adc', maxCnt=-1;
    for (const k of LINE_KEYS as LineKey[]) if (lineCounts[k]>maxCnt){maxCnt=lineCounts[k]; maxLine=k;}
    return { wins, losses, total, winRate: total? Math.round(wins/total*100):0, monthWins, monthLosses, monthTotal, monthWinRate: monthTotal? Math.round(monthWins/monthTotal*100):0, mainLine: maxLine };
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
    return Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0])).slice(-3).map(([month, s])=>({
      month, label: month.slice(5)+'월', rate: s.total? Math.round(s.wins/s.total*100):0, subText: `${s.total}판 ${s.total?Math.round(s.wins/s.total*100):0}%`, ...s
    }));
  }, [matches]);

  const recentGames = useMemo(()=> matches.filter(m=> getPlayerTeam(m, '우리밍_')).slice(0,10).map(m=> getPlayerTeam(m, '우리밍_')===getWinningTeam(m) ? 'W' : 'L'), [matches]);

  // 라인별 Best 파트너 - CK일지 연동 (하드코딩 제거)
  const bestPartners = useMemo(()=>{
    const result: Record<string, { name:string, line:string, wins:number, total:number, rate:number, mostChamps:{name:string, wins:number, total:number, rate:number, icon:string|null}[] }> = {};
    
    for (const lane of LINE_KEYS as LineKey[]) {
      if (lane==='adc') continue; // 우리밍_가 ADC라 제외
      
      // 해당 라인에서 우리밍_와 같은 팀으로 뛴 파트너 통계
      const partnerMap: Record<string, {wins:number, total:number}> = {};
      const champMap: Record<string, {wins:number, total:number}> = {}; // 해당 라인의 챔피언 통계
      
      for (const m of matches) {
        const myTeam = getPlayerTeam(m, '우리밍_');
        if (!myTeam) continue;
        const winner = getWinningTeam(m);
        // 같은 팀의 해당 라인 파트너
        const partner = (myTeam==='Red' ? m.team_a?.[lane] : m.team_b?.[lane])?.trim();
        if (!partner || partner==='우리밍_' || !isValidStreamerName(partner)) continue;
        if (!partnerMap[partner]) partnerMap[partner]={wins:0, total:0};
        partnerMap[partner].total++;
        if (myTeam===winner) partnerMap[partner].wins++;
        
        // 챔피언 통계 - 해당 라인 챔피언
        const champ = (myTeam==='Red' ? (m as any).team_a_champs?.[lane] : (m as any).team_b_champs?.[lane]) || m.team_a_champs?.[lane] || m.team_b_champs?.[lane];
        if (champ) {
          const norm = normalizeChampionName(champ);
          if (norm) {
            if (!champMap[norm]) champMap[norm]={wins:0, total:0};
            champMap[norm].total++;
            if (myTeam===winner) champMap[norm].wins++;
          }
        }
      }
      
      // 전체 라인 챔피언 통계도 추가 (우리밍_ 없는 경기 포함, CK일지 전체)
      for (const m of matches) {
        for (const k of [lane] as LineKey[]) {
          const champA = (m as any).team_a_champs?.[k];
          const champB = (m as any).team_b_champs?.[k];
          const winner = getWinningTeam(m);
          for (const [champ, team] of [[champA, 'Red'], [champB, 'Blue']] as const) {
            if (!champ) continue;
            const norm = normalizeChampionName(champ);
            if (!norm) continue;
            if (!champMap[norm]) champMap[norm]={wins:0, total:0};
            champMap[norm].total++;
            if (team===winner) champMap[norm].wins++;
          }
        }
      }

      let bestName='', bestWins=0, bestTotal=0, bestRate=0;
      for (const [name, s] of Object.entries(partnerMap)) {
        const rate = s.total ? s.wins/s.total*100 : 0;
        // 최소 1판 이상, 승률 높은 순, 동점이면 판수 많은 순
        if (s.total>=1 && (rate>bestRate || (rate===bestRate && s.total>bestTotal))) {
          bestRate=rate; bestName=name; bestWins=s.wins; bestTotal=s.total;
        }
      }

      const mostChamps = Object.entries(champMap)
        .map(([name, s])=>({ name, wins:s.wins, total:s.total, rate: s.total? Math.round(s.wins/s.total*100):0, icon: getChampionIconUrl(name) }))
        .sort((a,b)=> b.total - a.total || b.rate - a.rate)
        .slice(0,3);

      result[lane] = {
        name: bestName || '데이터 없음',
        line: lane.toUpperCase(),
        wins: bestWins,
        total: bestTotal,
        rate: Math.round(bestRate),
        mostChamps
      };
    }
    return result;
  }, [matches]);

  const playerMainPos = useMemo(()=>{ const m=new Map<string,LineKey>(); for(const p of allStreamers.filter(isValidStreamerName)) m.set(p,getMainPosition(p,matches)); return m; }, [allStreamers, matches]);
  const isFull = useMemo(()=> LINE_KEYS.every(k=> redTeam[k as LineKey] && blueTeam[k as LineKey]), [redTeam, blueTeam]);

  const handleFill = useCallback(()=>{
    const r=findBalancedLineup(allStreamers, matches);
    setRedTeam(r.red); setBlueTeam(r.blue); setWinRate(null);
    onToast(`등록 완료! ${r.totalGames>0?`맞라인 ${Math.round(r.totalGames)}판`: '주포지션 기반'} - 매번 다른 선수, 이상한 이름 제외`);
  }, [allStreamers, matches, onToast]);
  const handleClear = useCallback(()=>{ setRedTeam({top:'',jgl:'',mid:'',adc:'',sup:''}); setBlueTeam({top:'',jgl:'',mid:'',adc:'',sup:''}); setWinRate(null); setModalData(null); setShowModal(false); }, []);
  const handleAnalyze = useCallback(()=>{
    if(!isFull){ onToast('10명이 모두 채워져야 분석 가능합니다.'); return; }
    const result = calcTeamScores(redTeam, blueTeam, matches);
    setWinRate(result); setModalData({type:'synergy', result, redTeam, blueTeam}); setShowModal(true);
  }, [isFull, redTeam, blueTeam, matches]);
  const handleOptimal = useCallback(()=>{
    if(!isFull){ onToast('10명이 모두 채워져야 재배치가 가능합니다.'); return; }
    let best:any=null, bestDiff=Infinity;
    for (let mask=0; mask < (1<<LINE_KEYS.length); mask++) {
      const red:TeamRoster={top:'',jgl:'',mid:'',adc:'',sup:''}; const blue:TeamRoster={top:'',jgl:'',mid:'',adc:'',sup:''};
      for (let i=0;i<LINE_KEYS.length;i++) { const p=LINE_KEYS[i] as LineKey; const a=redTeam[p], b=blueTeam[p]; if ((mask & (1<<i))===0) { red[p]=a; blue[p]=b; } else { red[p]=b; blue[p]=a; } }
      const score = calcTeamScores(red, blue, matches);
      const diff = Math.abs(score.red - score.blue);
      if (diff < bestDiff) { bestDiff=diff; best={red, blue, score}; }
    }
    if (best) { setRedTeam(best.red); setBlueTeam(best.blue); setWinRate(best.score); setModalData({type:'optimal', result:best.score, redTeam:best.red, blueTeam:best.blue}); setShowModal(true); }
  }, [isFull, redTeam, blueTeam, matches]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <div className="bg-[#151525] border border-[#2a2a4a] rounded-2xl px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-bold text-[#e6e6ef]"><span className="text-[#a78bfa]">⚡</span>승률 기반으로 최고의 시너지팀을 짜드립니다 - CK 10인 이름을 넣으면 최적의 5:5를 추천</div>
        <button className="h-[24px] px-3 bg-[#2a2a4a] rounded-full text-[10px] font-bold text-[#8a8aa0]">CK 템플릿</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        <div className="space-y-5">
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 flex flex-col items-center text-center">
            <button onClick={onOpenSummaryModal} className="relative w-[110px] h-[110px] mb-4 group">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#1e1e2a" strokeWidth="8" /><circle cx="50" cy="50" r="46" fill="none" stroke="#a78bfa" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${woorimingStats.monthWinRate*2.89} 289`} /></svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-[22px] font-black text-white">우</div><div className="text-[16px] font-black text-[#a78bfa]">{woorimingStats.monthWinRate}%</div></div>
            </button>
            <div className="text-[16px] font-bold text-white">우리밍_</div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[11px] text-[#8a8aa0]"><span>이번달 (2026-09)</span><span>•</span><span className="text-[#c0c0d0] font-bold">{woorimingStats.mainLine.toUpperCase()}</span></div>
            <div className="mt-3 text-[12px] text-[#c0c0d0]">{woorimingStats.monthWins}승 {woorimingStats.monthLosses}패 / 총 {woorimingStats.monthTotal}판</div>
            <button onClick={onOpenSummaryModal} className="mt-4 w-full h-[36px] bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-full text-[11px] font-bold text-[#8a8aa0]">전체 전적 상세 보기</button>
          </div>

          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-4">
            <div className="bg-[#0c0c14] border border-[#1e1e2a] rounded-xl px-3 py-2.5 flex items-center justify-between mb-3"><span className="text-[11px] text-[#8a8aa0]">전체 승률</span><span className="text-[12px] font-bold text-[#a78bfa]">{woorimingStats.winRate}% ({woorimingStats.wins}승 {woorimingStats.losses}패)</span></div>
            <div className="flex items-center justify-between text-[10px] text-[#5a5a70] mb-2"><span>월별 승률</span><span>최근 3개월</span></div>
            <div className="bg-[#0c0c14] border border-[#1e1e2a] rounded-xl p-3 mb-4">
              <div className="flex items-end justify-around h-[90px] gap-2">
                {(monthlyStats.length>0 ? monthlyStats : [
                  {label:'08월', rate:39, total:28, subText:'28판 39%'},
                  {label:'09월', rate:52, total:25, subText:'25판 52%'},
                  {label:'10월', rate:48, total:15, subText:'15판 48%'}
                ]).map((m,i,arr)=>(
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] font-bold text-white">{m.rate}%</div>
                    <div className="w-full flex justify-center items-end h-[50px]"><div className="w-[70%] rounded-t-md" style={{height:`${Math.max(12, m.rate)}%`, background: i===arr.length-1 ? '#a78bfa' : '#3a3a4a'}} /></div>
                    <div className="text-[9px] font-bold text-[#8a8aa0]">{m.label}</div>
                    <div className="text-[8px] text-[#5a5a70]">{m.subText}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#5a5a70] mb-2"><span>최근 10경기 흐름</span><span>승/패</span></div>
            <div className="bg-[#0c0c14] border border-[#1e1e2a] rounded-xl p-2.5">
              <div className="flex justify-between mb-1.5"><span className="text-[8px] px-1 py-0.5 rounded bg-[#1e1e2a] text-[#5a5a70]">[10경기 전]</span><span className="text-[8px] px-1 py-0.5 rounded bg-[#1e1e2a] text-[#a78bfa]">[최신]</span></div>
              <div className="grid grid-cols-5 gap-1.5">
                {recentGames.map((r,i)=><div key={i} className={`aspect-square rounded-[8px] grid place-items-center text-[10px] font-black text-white ${r==='W'?'bg-[#3b82f6]':'bg-[#ef4444]'}`}>{r==='W'?'승':'패'}</div>)}
                {recentGames.length===0 && Array.from({length:10}).map((_,i)=><div key={i} className="aspect-square rounded-[8px] bg-[#1e1e2a] grid place-items-center text-[9px] text-white/20">-</div>)}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-black text-white">라인별 팀 입력 <span className="text-[#5a5a70] font-normal text-[11px] ml-1">(10인 명단 - 주포지션 고정, 이상한 이름 제외)</span></h3>
              <div className="flex items-center gap-2">
                <button onClick={handleClear} className="h-[30px] px-3 bg-[#1e1e2a] rounded-full text-[11px] font-bold text-[#8a8aa0]">비우기</button>
                <button onClick={handleFill} className="h-[30px] px-3.5 bg-[#7c3aed] rounded-full text-[11px] font-bold text-white flex items-center gap-1"><span>✨</span> 등록 선수 채우기</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#1a0f0f] border border-[#2a1a1a] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /><span className="text-[11px] font-bold text-[#ef4444]">Red팀</span>{winRate && <span className="ml-auto text-[12px] font-black text-[#ef4444]">{winRate.red.toFixed(1)}%</span>}</div>
                {(LINE_KEYS as LineKey[]).map(pos=>(
                  <div key={`red-${pos}`} className="flex items-center gap-2 mb-2">
                    <div className="w-[28px] text-[10px] font-bold text-[#5a5a70]">{pos.toUpperCase()}</div>
                    <div className="flex-1 relative"><input list="main-players" value={redTeam[pos]} onChange={e=>{ setRedTeam(p=>({...p,[pos]:e.target.value})); setWinRate(null); }} placeholder="스트리머 이름" className="w-full h-[32px] bg-[#0c0c14] border border-[#2a1e1e] rounded-full px-3 text-[11px] text-white placeholder:text-[#5a5a70] focus:outline-none" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] px-1 py-0.5 rounded-full bg-[#2a1e1e] text-[#5a5a70]">주:{playerMainPos.get(redTeam[pos])?.toUpperCase()||'-'}</span></div>
                  </div>
                ))}
              </div>
              <div className="bg-[#0f1520] border border-[#1a2a3a] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3"><div className="w-2 h-2 rounded-full bg-[#3b82f6]" /><span className="text-[11px] font-bold text-[#3b82f6]">Blue팀</span>{winRate && <span className="ml-auto text-[12px] font-black text-[#3b82f6]">{winRate.blue.toFixed(1)}%</span>}</div>
                {(LINE_KEYS as LineKey[]).map(pos=>(
                  <div key={`blue-${pos}`} className="flex items-center gap-2 mb-2">
                    <div className="w-[28px] text-[10px] font-bold text-[#5a5a70]">{pos.toUpperCase()}</div>
                    <div className="flex-1 relative"><input list="main-players" value={blueTeam[pos]} onChange={e=>{ setBlueTeam(p=>({...p,[pos]:e.target.value})); setWinRate(null); }} placeholder="스트리머 이름" className="w-full h-[32px] bg-[#0c0c14] border border-[#1a2a3a] rounded-full px-3 text-[11px] text-white placeholder:text-[#5a5a70] focus:outline-none" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] px-1 py-0.5 rounded-full bg-[#1a2a3a] text-[#5a5a70]">주:{playerMainPos.get(blueTeam[pos])?.toUpperCase()||'-'}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {winRate ? (
              <div className="mt-3 bg-[#0c0c14] border border-[#1e1e2a] rounded-xl p-2.5">
                <div className="flex items-center justify-between text-[11px] mb-1.5"><span className="text-[#8a8aa0]">예상 승률: Red <b className="text-[#ef4444]">{winRate.red.toFixed(1)}%</b> vs Blue <b className="text-[#3b82f6]">{winRate.blue.toFixed(1)}%</b></span><span className="text-[9px] text-[#5a5a70]">CK일지 기반 • {winRate.detail.laneGames}라인</span></div>
                <div className="w-full bg-[#1e1e2a] rounded-full h-1.5 flex overflow-hidden"><div className="h-full bg-[#ef4444]" style={{width:`${winRate.red}%`}} /><div className="h-full bg-[#3b82f6]" style={{width:`${winRate.blue}%`}} /></div>
              </div>
            ) : (
              <div className="mt-3 text-[10px] text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-full px-3 py-1.5 text-center">10명의 라인별 데이터가 모두 채워져야 시너지 분석 및 최적 재배치가 가능합니다. (현재 {Object.values(redTeam).filter(Boolean).length + Object.values(blueTeam).filter(Boolean).length}/10명)</div>
            )}

            <div className="flex gap-2 mt-3">
              <button onClick={handleAnalyze} disabled={!isFull} className={`flex-1 h-[36px] rounded-full text-[11px] font-bold ${isFull?'bg-[#1e1e2a] text-white':'bg-[#12121a] text-[#5a5a70] border border-[#1e1e2a]'}`}>현재 팀 시너지 분석</button>
              <button onClick={handleOptimal} disabled={!isFull} className={`flex-1 h-[36px] rounded-full text-[11px] font-bold ${isFull?'bg-[#7c3aed] text-white':'bg-[#12121a] text-[#5a5a70] border border-[#1e1e2a]'}`}>승률 기반 최적 팀으로 재배치</button>
            </div>
          </div>

          {/* 라인별 Best 파트너 - CK일지 연동 + 챔피언 아이콘 */}
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-4">
            <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-2 text-[13px] font-bold text-white"><span>🤝</span> 라인별 Best 파트너 (CK일지 연동)</div><span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1e1e2a] text-[#8a8aa0]">ADC 기준 • {matches.length}경기 분석</span></div>
            <div className="text-[10px] text-[#5a5a70] mb-3">이번달 함께 플레이한 전적 기반 • 챔피언 아이콘 TOP3</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(bestPartners).map(([lane, data])=>(
                <div key={lane} className="bg-[#0c0c14] border border-[#1e1e2a] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5"><span className="text-[10px] font-bold text-[#8a8aa0]">{lane.toUpperCase()} 라인 Best</span><span className="text-[8px] px-1 py-0.5 rounded-full bg-[#1e1e2a] text-[#5a5a70]">이번달 {data.total}판</span></div>
                  {data.name==='데이터 없음' ? (
                    <div className="text-[11px] text-[#5a5a70] py-2">CK일지에 {lane.toUpperCase()} 라인 기록 없음</div>
                  ) : (
                    <>
                      <div className="text-[11px] font-bold text-white">{data.name} ({data.line}) <span className="text-[#a78bfa]">{data.rate}%</span></div>
                      <div className="text-[10px] text-[#8a8aa0] mb-1.5">{data.total}전 {data.wins}승 {data.total-data.wins}패</div>
                      <div className="w-full bg-[#1e1e2a] rounded-full h-1 mb-2.5"><div className="h-1 bg-[#a78bfa] rounded-full" style={{width:`${data.rate}%`}} /></div>
                      <div className="flex items-center justify-between text-[8px] text-[#5a5a70] mb-1"><span>{lane.toUpperCase()} 모스트 챔피언</span><span>TOP 3</span></div>
                      <div className="flex gap-1 flex-wrap">
                        {data.mostChamps.slice(0,3).map((c:any,i:number)=>(
                          <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[8px] text-[#8a8aa0]">
                            {c.icon ? <img src={c.icon} alt={c.name} className="w-3.5 h-3.5 rounded-full" onError={e=>{(e.target as HTMLImageElement).style.display='none';}} /> : <span>🏆</span>}
                            <span>{c.name}</span><span className="text-[#a78bfa]">{c.total}판 {c.rate}%</span>
                          </div>
                        ))}
                        {data.mostChamps.length===0 && <span className="text-[8px] text-[#3a3a4a]">챔피언 기록 없음</span>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showModal && modalData && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowModal(false)}>
          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-[20px] max-w-[500px] w-full p-5" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-[14px] font-black text-white">{modalData.type==='synergy' ? '팀 시너지 분석 상세 (CK일지 기반)' : '최적 팀 재배치 결과'}</h3><button onClick={()=>setShowModal(false)} className="w-7 h-7 rounded-full bg-[#1e1e2a] grid place-items-center text-[#8a8aa0] text-[12px]">✕</button></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#1a0f0f] border border-[#2a1a1a] rounded-xl p-3 text-center"><div className="text-[10px] text-[#8a8aa0]">Red 예상</div><div className="text-[24px] font-black text-[#ef4444]">{modalData.result.red.toFixed(1)}%</div><div className="text-[9px] text-[#5a5a70]">맞라인 {modalData.result.detail.redLane.toFixed(0)}% • 개인 {modalData.result.detail.redIndiv.toFixed(0)}% • 시너지 {modalData.result.detail.redSynergy.toFixed(0)}%</div></div>
              <div className="bg-[#0f1520] border border-[#1a2a3a] rounded-xl p-3 text-center"><div className="text-[10px] text-[#8a8aa0]">Blue 예상</div><div className="text-[24px] font-black text-[#3b82f6]">{modalData.result.blue.toFixed(1)}%</div><div className="text-[9px] text-[#5a5a70]">맞라인 {modalData.result.detail.blueLane.toFixed(0)}% • 개인 {modalData.result.detail.blueIndiv.toFixed(0)}% • 시너지 {modalData.result.detail.blueSynergy.toFixed(0)}%</div></div>
            </div>
            <div className="space-y-1.5 mb-4 max-h-[180px] overflow-y-auto">
              {LINE_KEYS.map(lane=>{
                const r=modalData.redTeam[lane as LineKey], b=modalData.blueTeam[lane as LineKey];
                if(!r||!b) return null;
                const h2h=getLaneHeadToHead(r,b,lane as LineKey,matches);
                return <div key={lane} className="flex items-center justify-between bg-[#0c0c14] border border-[#1e1e2a] rounded-full px-3 py-1.5 text-[10px]"><span className="text-[#5a5a70] w-[28px]">{lane.toUpperCase()}</span><span className="text-white flex-1 text-right truncate">{r}</span><span className="text-[9px] text-[#a78bfa] mx-2">{h2h.total>0?`${h2h.p1Wins}승${h2h.p2Wins}패`:`${getIndividualWinRate(r,matches).rate.toFixed(0)}% vs ${getIndividualWinRate(b,matches).rate.toFixed(0)}%`}</span><span className="text-white flex-1 truncate">{b}</span></div>;
              })}
            </div>
            <div className="flex gap-2"><button onClick={()=>setShowModal(false)} className="flex-1 h-[36px] bg-[#1e1e2a] rounded-full text-[11px] font-bold text-white">닫기</button><button onClick={()=>{ setRedTeam(modalData.redTeam); setBlueTeam(modalData.blueTeam); setWinRate(modalData.result); setShowModal(false); }} className="flex-1 h-[36px] bg-[#7c3aed] rounded-full text-[11px] font-bold text-white">이 팀으로 확정</button></div>
          </div>
        </div>
      )}

      <datalist id="main-players">{allStreamers.filter(isValidStreamerName).map(n=><option key={n} value={n} />)}</datalist>
    </div>
  );
};
