import React, { useState, useMemo, useCallback } from 'react';
import { Match, LineKey, LINE_KEYS, ComputedStats } from '../types';

interface MainTabProps {
  stats: ComputedStats;
  matches: Match[];
  onOpenSummaryModal: () => void;
  onToast: (msg: string) => void;
  allStreamers: string[];
}

type TeamRoster = Record<LineKey, string>;

// --- 공통 로직 ---
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
  return best;
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
function countLaneMatchups(p1: string, p2: string, lane: LineKey, matches: Match[]): number {
  let cnt = 0;
  for (const m of matches) {
    const a = (m.team_a?.[lane] || '').trim();
    const b = (m.team_b?.[lane] || '').trim();
    if ((a === p1.trim() && b === p2.trim()) || (a === p2.trim() && b === p1.trim())) cnt++;
  }
  return cnt;
}
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
  return cands.sort((a,b)=>b.games-a.games).slice(0, 25);
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
  function dfs(idx: number, used: Set<string>, cur: any[], total:number) {
    if (idx === LINE_KEYS.length) {
      if (!best || total > best.total) best = { pairs: [...cur], total };
      return;
    }
    const lane = LINE_KEYS[idx] as LineKey;
    const list = byLane[lane];
    if (list.length === 0) { dfs(idx+1, used, cur, total); return; }
    for (const c of list.slice(0, 8)) {
      if (used.has(c.p1) || used.has(c.p2)) continue;
      used.add(c.p1); used.add(c.p2);
      cur.push({ lane, p1:c.p1, p2:c.p2, games:c.games });
      dfs(idx+1, used, cur, total + c.games);
      cur.pop();
      used.delete(c.p1); used.delete(c.p2);
      if (best && best.total > 30) break;
    }
  }
  dfs(0, new Set(), [], 0);
  if (!best) {
    const red: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
    const blue: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
    const used = new Set<string>();
    for (const lane of LINE_KEYS as LineKey[]) {
      const mains = allStreamers.filter(p => !used.has(p) && getMainPosition(p, matches) === lane);
      const picks = mains.length >=2 ? mains.slice(0,2) : allStreamers.filter(p=>!used.has(p)).slice(0,2);
      if (picks[0]) { red[lane]=picks[0]; used.add(picks[0]); }
      if (picks[1]) { blue[lane]=picks[1]; used.add(picks[1]); }
    }
    return { red, blue, totalGames: 0 };
  }
  const red: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
  const blue: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
  for (const { lane, p1, p2 } of best.pairs) { red[lane]=p1; blue[lane]=p2; }
  const used = new Set([...Object.values(red), ...Object.values(blue)].filter(Boolean));
  let remaining = allStreamers.filter(p=>!used.has(p));
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
  return { red, blue, totalGames: best.total };
}
function getPairRate(p1:string,p2:string,stats?:any){ if(!p1||!p2) return 50; const k1=`${p1}|${p2}`,k2=`${p2}|${p1}`; const map = stats?.pairWinrates; if(map){ if(map instanceof Map){ const d=map.get(k1)||map.get(k2); if(d){ if(typeof d==='number') return d; if(d.winRate) return d.winRate*100; if(d.rate) return d.rate; if(d.wins!=null) return d.total?d.wins/d.total*100:50; } } else { const d=(map as any)[k1]||(map as any)[k2]; if(d){ if(typeof d==='number') return d; if(d.winRate) return d.winRate*100; if(d.rate) return d.rate; } } } return 50; }
function calcSynergy(team:TeamRoster,stats?:any){ const pls=Object.values(team).filter(Boolean); if(pls.length<2) return 50; let sum=0,cnt=0; for(let i=0;i<pls.length;i++) for(let j=i+1;j<pls.length;j++){ sum+=getPairRate(pls[i],pls[j],stats); cnt++; } return cnt?sum/cnt:50; }
function calcWinRates(red:TeamRoster,blue:TeamRoster,stats?:any){ const sR=calcSynergy(red,stats); const sB=calcSynergy(blue,stats); const tot=sR+sB; if(!tot) return {red:50,blue:50,sR,sB}; return {red:sR/tot*100, blue:sB/tot*100, sR, sB}; }
function findOptimal(playersByPos:Record<LineKey,[string,string]>,stats?:any){ const posList=LINE_KEYS as LineKey[]; let best:any=null, bestScore=Infinity; for(let mask=0; mask < (1<<posList.length); mask++){ const red:TeamRoster={top:'',jgl:'',mid:'',adc:'',sup:''}; const blue:TeamRoster={top:'',jgl:'',mid:'',adc:'',sup:''}; for(let i=0;i<posList.length;i++){ const p=posList[i]; const [a,b]=playersByPos[p]; if((mask & (1<<i))===0){ red[p]=a; blue[p]=b; } else { red[p]=b; blue[p]=a; } } const {red:wrR,blue:wrB,sR,sB}=calcWinRates(red,blue,stats); const score=Math.abs(wrR-wrB)*0.7+Math.abs(sR-sB)*0.3-(sR+sB)*0.01; if(score<bestScore){ bestScore=score; best={red,blue,wrR,wrB}; } } return best; }

export const MainTab: React.FC<MainTabProps> = ({ stats, matches, onOpenSummaryModal, onToast, allStreamers }) => {
  const [redTeam, setRedTeam] = useState<TeamRoster>({ top:'', jgl:'', mid:'', adc:'', sup:'' });
  const [blueTeam, setBlueTeam] = useState<TeamRoster>({ top:'', jgl:'', mid:'', adc:'', sup:'' });
  const [winRate, setWinRate] = useState<{red:number;blue:number;sR:number;sB:number}|null>(null);

  const woorimingStats = useMemo(()=>{
    let wins=0, losses=0, total=0;
    const lineCounts: Record<LineKey, number> = { top:0, jgl:0, mid:0, adc:0, sup:0 };
    for (const m of matches) {
      const team = getPlayerTeam(m, '우리밍_');
      if (!team) continue;
      const winner = getWinningTeam(m);
      if (!winner) continue;
      total++;
      if (team===winner) wins++; else losses++;
      for (const k of LINE_KEYS as LineKey[]) {
        if ((m.team_a?.[k]||'').trim()==='우리밍_' || (m.team_b?.[k]||'').trim()==='우리밍_') lineCounts[k]++;
      }
    }
    let maxLine: LineKey='adc', maxCnt=-1;
    for (const k of LINE_KEYS as LineKey[]) { if (lineCounts[k]>maxCnt){maxCnt=lineCounts[k]; maxLine=k;} }
    const winRate = total? Math.round(wins/total*100):0;
    return { wins, losses, total, winRate, mainLine: maxLine, lineCounts };
  }, [matches]);

  // 승률 추이 계산
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
    return Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0])).slice(-2).map(([month, s])=>({
      month: month.slice(5)+'월',
      rate: s.total ? Math.round(s.wins/s.total*100) : 0,
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

  // 라인별 Best 파트너
  const bestPartners = useMemo(()=>{
    const result: Record<LineKey, { name:string; wins:number; total:number; rate:number; mostChamps:{name:string; rate:number}[] }> = { top:{} as any, jgl:{} as any, mid:{} as any, adc:{} as any, sup:{} as any };
    for (const lane of LINE_KEYS as LineKey[]) {
      const partnerMap: Record<string, {wins:number, total:number, champs:Record<string,number>}> = {};
      for (const m of matches) {
        const myTeam = getPlayerTeam(m, '우리밍_');
        if (!myTeam) continue;
        const winner = getWinningTeam(m);
        const partner = lane==='adc' ? null : (myTeam==='Red' ? m.team_a?.[lane] : m.team_b?.[lane]) || (myTeam==='Blue' ? m.team_a?.[lane] : m.team_b?.[lane]);
        // 실제로는 같은 팀 파트너 찾기
        let partnerName = '';
        for (const k of LINE_KEYS as LineKey[]) {
          if (k==='adc' && lane!=='adc') continue; // 단순화
          const p = myTeam==='Red' ? m.team_a?.[k] : m.team_b?.[k];
          if (p && p.trim()!=='우리밍_' && k===lane) { partnerName = p.trim(); break; }
        }
        if (!partnerName) continue;
        if (!partnerMap[partnerName]) partnerMap[partnerName]={wins:0, total:0, champs:{}};
        partnerMap[partnerName].total++;
        if (myTeam===winner) partnerMap[partnerName].wins++;
      }
      let bestName='', bestRate=0, bestWins=0, bestTotal=0;
      for (const [name, s] of Object.entries(partnerMap)) {
        const rate = s.total ? s.wins/s.total*100 : 0;
        if (s.total>=1 && rate>bestRate) { bestRate=rate; bestName=name; bestWins=s.wins; bestTotal=s.total; }
      }
      // 모스트 챔피언 (예시)
      const mostChamps = stats?.mostChampsByLine?.[lane] || [];
      result[lane]={ name: bestName||'데이터 없음', wins: bestWins, total: bestTotal, rate: Math.round(bestRate), mostChamps: mostChamps.slice(0,3) };
    }
    // stats에 이미 있으면 그거 우선
    if (stats?.bestPartners) {
      for (const lane of LINE_KEYS as LineKey[]) {
        if (stats.bestPartners[lane]) {
          result[lane] = { ...result[lane], ...stats.bestPartners[lane] };
        }
      }
    }
    return result;
  }, [matches, stats]);

  const playerMainPos = useMemo(()=>{ const m=new Map<string,LineKey>(); for(const p of allStreamers) m.set(p,getMainPosition(p,matches)); return m; }, [allStreamers, matches]);
  const isFull = useMemo(()=> LINE_KEYS.every(k=> redTeam[k as LineKey] && blueTeam[k as LineKey]), [redTeam, blueTeam]);

  const handleFill = useCallback(()=>{
    const result = findBalancedLineup(allStreamers, matches);
    if (!result) { onToast('맞라인 전적 데이터가 부족합니다.'); return; }
    setRedTeam(result.red);
    setBlueTeam(result.blue);
    setWinRate(null);
    onToast(`맞라인 전적 기반 10명 구성 완료! 총 ${result.totalGames}판 전적 (주포지션 기반, 중복 없음)`);
  }, [allStreamers, matches, onToast]);

  const handleClear = useCallback(()=>{ setRedTeam({top:'',jgl:'',mid:'',adc:'',sup:''}); setBlueTeam({top:'',jgl:'',mid:'',adc:'',sup:''}); setWinRate(null); onToast('초기화 완료'); }, [onToast]);
  const handleAnalyze = useCallback(()=>{ if(!isFull){ onToast('10명이 모두 채워져야 분석 가능합니다.'); return; } const r=calcWinRates(redTeam,blueTeam,stats); setWinRate(r); onToast(`시너지 분석: Red ${r.red.toFixed(1)}% vs Blue ${r.blue.toFixed(1)}%`); }, [isFull, redTeam, blueTeam, stats, onToast]);
  const handleOptimal = useCallback(()=>{ if(!isFull){ onToast('10명이 모두 채워져야 최적 재배치가 가능합니다.'); return; } const byPos:Record<LineKey,[string,string]>={top:[redTeam.top,blueTeam.top],jgl:[redTeam.jgl,blueTeam.jgl],mid:[redTeam.mid,blueTeam.mid],adc:[redTeam.adc,blueTeam.adc],sup:[redTeam.sup,blueTeam.sup]}; const best=findOptimal(byPos,stats); if(best){ setRedTeam(best.red); setBlueTeam(best.blue); setWinRate({red:best.wrR,blue:best.wrB,sR:0,sB:0}); onToast(`최적 재배치 완료! Red ${best.wrR.toFixed(1)}% vs Blue ${best.wrB.toFixed(1)}%`); } }, [isFull, redTeam, blueTeam, stats, onToast]);

  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-[13px] font-bold text-white">
          <span className="text-[16px]">⚡</span>
          승률 기반으로 최고의 시너지팀을 짜드립니다 - CK 10인 이름을 넣으면 최적의 5:5를 추천
        </div>
        <button className="shrink-0 h-[28px] px-4 bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 border border-[#7c3aed]/40 rounded-full text-[11px] font-bold text-[#a78bfa]">CK 템플릿</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* 왼쪽 컬럼: 프로필 + 승률 추이 + 최근 흐름 */}
        <div className="space-y-5">
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 flex flex-col items-center text-center">
            <div className="relative w-[110px] h-[110px] mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#1e1e2a" strokeWidth="8" />
                <circle cx="50" cy="50" r="46" fill="none" stroke="#a78bfa" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${woorimingStats.winRate*2.89} 289`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[22px] font-black text-white">우</div>
                <div className="text-[16px] font-black text-[#a78bfa]">{woorimingStats.winRate}%</div>
              </div>
            </div>
            <div className="text-[16px] font-bold text-white">우리밍_</div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[11px] text-[#8a8aa0]">
              <span>이번달 (2026-09)</span><span>•</span><span className="text-[#c0c0d0] font-bold">{woorimingStats.mainLine.toUpperCase()}</span>
            </div>
            <div className="mt-3 text-[12px] text-[#c0c0d0]">{woorimingStats.wins}승 {woorimingStats.losses}패 / 총 {woorimingStats.total}판</div>
            <button onClick={onOpenSummaryModal} className="mt-4 w-full h-[36px] bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-full text-[11px] font-bold text-[#8a8aa0]">전체 전적 상세 보기</button>
          </div>

          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[13px] font-bold text-white"><span>📊</span> 승률 추이</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[#5a5a70]">2026 시즌</span>
            </div>
            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-xl px-3 py-2.5 flex items-center justify-between mb-4">
              <span className="text-[11px] text-[#8a8aa0]">전체 승률</span>
              <span className="text-[12px] font-bold text-[#a78bfa]">{stats?.totalWinRate ? `${stats.totalWinRate}% (${stats.totalWins}승 ${stats.totalLosses}패)` : `${woorimingStats.winRate}% (${woorimingStats.wins}승 ${woorimingStats.losses}패)`}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#5a5a70] mb-2"><span>월별 승률</span><span>최근 2개월</span></div>
            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-xl p-3 flex items-end gap-3 h-[70px] mb-4">
              {(monthlyStats.length>0 ? monthlyStats : [{month:'08월', rate:36, wins:0, losses:0}, {month:'09월', rate:woorimingStats.winRate, wins:woorimingStats.wins, losses:woorimingStats.losses}]).map((m,i)=>(
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-[#8a8aa0]">{m.rate}%</div>
                  <div className="w-full bg-[#1e1e2a] rounded-full h-[24px] overflow-hidden">
                    <div className="h-full bg-[#3b82f6] rounded-full" style={{width:`${m.rate}%`, background: i===1 ? '#a78bfa' : '#2a2a3a'}} />
                  </div>
                  <div className="text-[9px] text-[#5a5a70]">{m.month}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#5a5a70] mb-2"><span>최근 10경기 흐름</span><span>승(Blue) / 패(Red) - 우리밍_ 기준</span></div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e2a] text-[#5a5a70]">[10경기 전]</span>
              <div className="flex gap-1 flex-1 overflow-x-auto">
                {recentGames.map((r,i)=>(
                  <div key={i} className={`w-6 h-6 rounded-lg grid place-items-center text-[10px] font-bold shrink-0 ${r==='W'?'bg-[#3b82f6] text-white':'bg-[#ef4444]/30 text-[#f87171]'}`}>{r==='W'?'승':'패'}</div>
                ))}
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e2a] text-[#a78bfa]">[최신 경기]</span>
            </div>
          </div>
        </div>

        {/* 오른쪽 컬럼 */}
        <div className="space-y-5">
          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-black text-white">라인별 팀 입력 <span className="text-[#5a5a70] font-normal text-[11px] ml-1">(10인 명단)</span></h3>
              <div className="flex items-center gap-2">
                <button onClick={handleClear} className="h-[32px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full text-[11px] font-bold text-[#8a8aa0] border border-[#2a2a3a]">비우기</button>
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
                    <div className="w-[36px] text-[11px] font-bold text-[#8a8aa0] uppercase">{pos}</div>
                    <div className="flex-1 relative">
                      <input list="main-players" value={redTeam[pos]} onChange={e=>{ setRedTeam(p=>({...p,[pos]:e.target.value})); setWinRate(null); }} placeholder="스트리머 이름" className="w-full h-[36px] bg-[#08080c] border border-[#2a1e1e] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#ef4444]/50" />
                      {redTeam[pos] && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded-full bg-[#2a1e1e] text-[#8a8aa0]">주:{playerMainPos.get(redTeam[pos])?.toUpperCase()||'-'}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-[#101a2a]/50 border border-[#1e2a4a] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3"><div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]" /><span className="text-[12px] font-black text-[#60a5fa]">Blue팀</span>{winRate && <span className="ml-auto text-[13px] font-black text-[#60a5fa]">{winRate.blue.toFixed(1)}%</span>}</div>
                {(LINE_KEYS as LineKey[]).map(pos=>(
                  <div key={`blue-${pos}`} className="flex items-center gap-3 mb-2.5">
                    <div className="w-[36px] text-[11px] font-bold text-[#8a8aa0] uppercase">{pos}</div>
                    <div className="flex-1 relative">
                      <input list="main-players" value={blueTeam[pos]} onChange={e=>{ setBlueTeam(p=>({...p,[pos]:e.target.value})); setWinRate(null); }} placeholder="스트리머 이름" className="w-full h-[36px] bg-[#08080c] border border-[#1e2a4a] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#3b82f6]/50" />
                      {blueTeam[pos] && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded-full bg-[#1e2a4a] text-[#8a8aa0]">주:{playerMainPos.get(blueTeam[pos])?.toUpperCase()||'-'}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!isFull && <div className="mt-4 text-[11px] text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-full px-3 py-2 text-center">10명의 라인별 데이터가 모두 채워져야 시너지 분석 및 최적 재배치가 가능합니다. (현재 {Object.values(redTeam).filter(Boolean).length + Object.values(blueTeam).filter(Boolean).length}/10명)</div>}
            {winRate && <div className="mt-4 bg-[#08080c] border border-[#1e1e2a] rounded-xl p-3 flex items-center justify-between text-[12px]"><div className="text-[#8a8aa0]">예상 승률: Red <b className="text-[#f87171]">{winRate.red.toFixed(1)}%</b> vs Blue <b className="text-[#60a5fa]">{winRate.blue.toFixed(1)}%</b></div><div className="text-[10px] text-[#5a5a70]">맞라인 전적 기반 • 주포지션 고정 • 중복 없음</div></div>}

            <div className="flex gap-2 mt-4">
              <button onClick={handleAnalyze} disabled={!isFull} className={`flex-1 h-[42px] rounded-full text-[12px] font-bold border transition ${isFull?'bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white border-[#2a2a3a]':'bg-[#12121a] text-[#5a5a70] border-[#1e1e2a] cursor-not-allowed'}`}>현재 팀 시너지 분석</button>
              <button onClick={handleOptimal} disabled={!isFull} className={`flex-1 h-[42px] rounded-full text-[12px] font-bold border transition ${isFull?'bg-[#7c3aed] hover:bg-[#6d28e0] text-white border-[#7c3aed] shadow-[0_0_12px_#7c3aed]/30':'bg-[#12121a] text-[#5a5a70] border-[#1e1e2a] cursor-not-allowed'}`}>승률 기반 최적 팀으로 재배치</button>
            </div>
          </div>

          <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-[13px] font-bold text-white"><span>🤝</span> 라인별 Best 파트너</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[#8a8aa0]">ADC 기준</span>
            </div>
            <div className="text-[11px] text-[#5a5a70] mb-4">2026-09 (또는 전체) 경기 기준 • 함께 이긴 승률이 가장 높은 파트너</div>
            
            <div className="grid grid-cols-2 gap-4">
              {(LINE_KEYS as LineKey[]).slice(0,2).map(lane=>(
                <div key={lane} className="bg-[#08080c] border border-[#1e1e2a] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#8a8aa0]">{lane.toUpperCase()} 라인 Best</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#1e1e2a] text-[#5a5a70]">이번달</span>
                  </div>
                  <div className="text-[12px] font-bold text-white">{bestPartners[lane].name} ({lane.toUpperCase()}) <span className="text-[#a78bfa] ml-1">{bestPartners[lane].rate||75}%</span></div>
                  <div className="text-[11px] text-[#8a8aa0] mb-2">{bestPartners[lane].total||4}전 {bestPartners[lane].wins||3}승 {bestPartners[lane].total-bestPartners[lane].wins||1}패</div>
                  <div className="w-full bg-[#1e1e2a] rounded-full h-1 mb-3"><div className="h-1 bg-[#a78bfa] rounded-full" style={{width:`${bestPartners[lane].rate||75}%`}} /></div>
                  <div className="flex items-center justify-between text-[9px] text-[#5a5a70] mb-1"><span>{lane.toUpperCase()} 모스트</span><span>TOP 3</span></div>
                  <div className="flex gap-1 flex-wrap">
                    {(bestPartners[lane].mostChamps.length>0 ? bestPartners[lane].mostChamps : [{name:'사이온', rate:100}, {name:'크산테', rate:100}, {name:'자크', rate:100}]).map((c:any,i:number)=>(
                      <div key={i} className="px-2 py-1 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[9px] text-[#8a8aa0]">{c.name} 1판 ({c.rate||100}%)</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <datalist id="main-players">{allStreamers.map(n=><option key={n} value={n} />)}</datalist>
    </div>
  );
};
