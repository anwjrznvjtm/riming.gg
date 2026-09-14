import React, { useState, useMemo, useCallback } from 'react';
import { Match, LineKey, LINE_KEYS } from '../types';

interface MainTabProps {
  matches: Match[];
  allStreamers: string[];
  stats?: any;
  pairMap?: Map<string, any> | Record<string, any>;
  onToast: (msg: string) => void;
}

type TeamRoster = Record<LineKey, string>;

// --- 포지션 기반 로직 (CK일지 전적 기반) ---
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
  // 전적 없으면 이름으로 대략 추정 (확장 가능, 지금은 mid fallback)
  if (max === 0) {
    // 감블러 같은 케이스: 예전 데이터에 JGL/MID 많이 함 -> 전적으로 잡힘
    // 전적 없으면 mid로 두지만, 필요하면 하드코딩 맵 추가 가능
    return 'mid';
  }
  return best;
}

function getSortedPositions(player: string, matches: Match[]): LineKey[] {
  const counts = getPlayerPositionCounts(player, matches);
  return (Object.entries(counts) as [LineKey, number][]).sort((a,b)=>b[1]-a[1]).map(([p])=>p);
}

function autoAssignByMainPosition(players: string[], matches: Match[]): { red: TeamRoster; blue: TeamRoster } {
  const empty: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
  const red: TeamRoster = { ...empty };
  const blue: TeamRoster = { ...empty };
  
  const infos = players.map(name => ({
    name,
    main: getMainPosition(name, matches),
    sorted: getSortedPositions(name, matches),
    counts: getPlayerPositionCounts(name, matches),
  }));

  const assigned = new Set<string>();

  // 1차: 주포지션대로 각 포지션에 2명씩
  for (const pos of LINE_KEYS as LineKey[]) {
    const cands = infos.filter(i=>!assigned.has(i.name) && i.main===pos).sort((a,b)=>b.counts[pos]-a.counts[pos]);
    if (cands.length>=2) { red[pos]=cands[0].name; blue[pos]=cands[1].name; assigned.add(cands[0].name); assigned.add(cands[1].name); }
    else if (cands.length===1) { red[pos]=cands[0].name; assigned.add(cands[0].name); }
  }
  // 2차: 세컨 포지션으로 빈자리 메우기
  for (const pos of LINE_KEYS as LineKey[]) {
    for (const team of [red, blue]) {
      if (!team[pos]) {
        const remain = infos.filter(i=>!assigned.has(i.name));
        const cand = remain.find(i=>i.sorted[0]===pos || i.sorted[1]===pos) || remain[0];
        if (cand) { team[pos]=cand.name; assigned.add(cand.name); }
      }
    }
  }
  // 3차: 그래도 남으면 그냥 채우기
  const remain = infos.filter(i=>!assigned.has(i.name));
  for (const pos of LINE_KEYS as LineKey[]) {
    if (!red[pos] && remain.length) red[pos]=remain.shift()!.name;
    if (!blue[pos] && remain.length) blue[pos]=remain.shift()!.name;
  }

  return { red, blue };
}

function getPairRate(p1: string, p2: string, pairMap?: any, stats?: any): number {
  if (!p1 || !p2) return 50;
  const k1 = `${p1}|${p2}`, k2 = `${p2}|${p1}`;
  if (pairMap instanceof Map) {
    const d = pairMap.get(k1) || pairMap.get(k2);
    if (d) { if (typeof d==='number') return d; if (d.winRate) return d.winRate*100; if (d.rate) return d.rate; if (d.wins!=null) return d.total?d.wins/d.total*100:50; }
  }
  if (stats?.pairWinrates) {
    const d = stats.pairWinrates[k1] || stats.pairWinrates[k2];
    if (d) { if (typeof d==='number') return d; if (d.winRate) return d.winRate*100; if (d.rate) return d.rate; }
  }
  if (pairMap && typeof pairMap==='object') {
    const d = (pairMap as any)[k1] || (pairMap as any)[k2];
    if (d) { if (typeof d==='number') return d; if (d.winRate) return d.winRate*100; if (d.rate) return d.rate; }
  }
  return 50;
}

function calcSynergy(team: TeamRoster, pairMap?: any, stats?: any) {
  const pls = Object.values(team).filter(Boolean);
  if (pls.length<2) return 50;
  let sum=0, cnt=0;
  for (let i=0;i<pls.length;i++) for (let j=i+1;j<pls.length;j++) { sum+=getPairRate(pls[i], pls[j], pairMap, stats); cnt++; }
  return cnt?sum/cnt:50;
}

function calcWinRates(red: TeamRoster, blue: TeamRoster, pairMap?: any, stats?: any) {
  const sR = calcSynergy(red, pairMap, stats);
  const sB = calcSynergy(blue, pairMap, stats);
  const tot = sR + sB;
  if (!tot) return { red: 50, blue: 50, sR, sB };
  return { red: sR/tot*100, blue: sB/tot*100, sR, sB };
}

function findOptimal(playersByPos: Record<LineKey, [string,string]>, pairMap?: any, stats?: any) {
  const posList = LINE_KEYS as LineKey[];
  let best:any=null, bestScore=Infinity;
  for (let mask=0; mask < (1<<posList.length); mask++) {
    const red: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
    const blue: TeamRoster = { top:'', jgl:'', mid:'', adc:'', sup:'' };
    for (let i=0;i<posList.length;i++) {
      const p = posList[i];
      const [a,b] = playersByPos[p];
      if ((mask & (1<<i))===0) { red[p]=a; blue[p]=b; } else { red[p]=b; blue[p]=a; }
    }
    const { red: wrR, blue: wrB, sR, sB } = calcWinRates(red, blue, pairMap, stats);
    const score = Math.abs(wrR-wrB)*0.7 + Math.abs(sR-sB)*0.3 - (sR+sB)*0.01;
    if (score < bestScore) { bestScore=score; best={ red, blue, wrR, wrB }; }
  }
  return best;
}

export const MainTab: React.FC<MainTabProps> = ({ matches, allStreamers, stats, pairMap, onToast }) => {
  const [redTeam, setRedTeam] = useState<TeamRoster>({ top:'', jgl:'', mid:'', adc:'', sup:'' });
  const [blueTeam, setBlueTeam] = useState<TeamRoster>({ top:'', jgl:'', mid:'', adc:'', sup:'' });
  const [winRate, setWinRate] = useState<{ red:number; blue:number; sR:number; sB:number }|null>(null);

  const playerMainPos = useMemo(()=>{
    const m = new Map<string, LineKey>();
    for (const p of allStreamers) m.set(p, getMainPosition(p, matches));
    return m;
  }, [allStreamers, matches]);

  const isFull = useMemo(()=> LINE_KEYS.every(k=> redTeam[k as LineKey] && blueTeam[k as LineKey]), [redTeam, blueTeam]);

  const handleFill = useCallback(()=>{
    // CK 10인: allStreamers 상위 10명 또는 우리밍_ 포함 10명
    let pool = allStreamers.slice(0,10);
    if (!pool.includes('우리밍_') && allStreamers.includes('우리밍_')) {
      pool = ['우리밍_', ...allStreamers.filter(n=>n!=='우리밍_').slice(0,9)];
    }
    if (pool.length<10) { onToast('등록된 선수가 10명 미만입니다.'); return; }
    const { red, blue } = autoAssignByMainPosition(pool, matches);
    setRedTeam(red);
    setBlueTeam(blue);
    setWinRate(null);
    onToast('주 포지션 기반으로 자동 배치 완료! (감블러 → 주라인으로 정상 배치)');
  }, [allStreamers, matches, onToast]);

  const handleClear = useCallback(()=>{
    setRedTeam({ top:'', jgl:'', mid:'', adc:'', sup:'' });
    setBlueTeam({ top:'', jgl:'', mid:'', adc:'', sup:'' });
    setWinRate(null);
  }, []);

  const handleAnalyze = useCallback(()=>{
    if (!isFull) { onToast('10명의 라인별 데이터가 모두 채워져야 시너지 분석이 가능합니다.'); return; }
    const result = calcWinRates(redTeam, blueTeam, pairMap, stats);
    setWinRate(result);
    onToast(`시너지 분석 완료! Red ${result.red.toFixed(1)}% vs Blue ${result.blue.toFixed(1)}%`);
  }, [isFull, redTeam, blueTeam, pairMap, stats, onToast]);

  const handleOptimal = useCallback(()=>{
    if (!isFull) { onToast('10명이 모두 채워진 상태에서만 최적 팀 재배치가 가능합니다.'); return; }
    const byPos: Record<LineKey, [string,string]> = {
      top: [redTeam.top, blueTeam.top],
      jgl: [redTeam.jgl, blueTeam.jgl],
      mid: [redTeam.mid, blueTeam.mid],
      adc: [redTeam.adc, blueTeam.adc],
      sup: [redTeam.sup, blueTeam.sup],
    };
    const best = findOptimal(byPos, pairMap, stats);
    if (best) {
      setRedTeam(best.red);
      setBlueTeam(best.blue);
      setWinRate({ red: best.wrR, blue: best.wrB, sR: 0, sB: 0 });
      onToast(`최적 팀 재배치 완료! Red ${best.wrR.toFixed(1)}% vs Blue ${best.wrB.toFixed(1)}% - 32가지 조합 중 최적`);
    }
  }, [isFull, redTeam, blueTeam, pairMap, stats, onToast]);

  return (
    <div className="max-w-[1100px] mx-auto space-y-4">
      {/* 상단 배너 */}
      <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-[13px] font-bold text-white">
          <span className="text-[16px]">⚡</span>
          승률 기반으로 최고의 시너지팀을 짜드립니다 - CK 10인 이름을 넣으면 최적의 5:5를 추천
        </div>
        <button className="shrink-0 h-[28px] px-4 bg-[#7c3aed]/20 hover:bg-[#7c3aed]/30 border border-[#7c3aed]/40 rounded-full text-[11px] font-bold text-[#a78bfa]">CK 템플릿</button>
      </div>

      <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-black text-white">라인별 팀 입력 <span className="text-[#5a5a70] font-normal text-[11px] ml-1">(10인 명단)</span></h3>
          <div className="flex items-center gap-2">
            <button onClick={handleClear} className="h-[32px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full text-[11px] font-bold text-[#8a8aa0] border border-[#2a2a3a]">비우기</button>
            <button onClick={handleFill} className="h-[32px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#3a3a5a] rounded-full text-[11px] font-bold text-[#c0c0d0] flex items-center gap-1.5">
              <span>✨</span> 등록 선수 채우기
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Red팀 */}
          <div className="bg-[#1a1010]/50 border border-[#3a1e1e] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-[0_0_8px_#ef4444]" />
              <span className="text-[12px] font-black text-[#f87171]">Red팀</span>
              {winRate && <span className="ml-auto text-[13px] font-black text-[#f87171]">{winRate.red.toFixed(1)}%</span>}
            </div>
            {(LINE_KEYS as LineKey[]).map(pos=>(
              <div key={`red-${pos}`} className="flex items-center gap-3 mb-2.5">
                <div className="w-[36px] text-[11px] font-bold text-[#8a8aa0] uppercase">{pos}</div>
                <div className="flex-1 relative">
                  <input
                    list="main-players"
                    value={redTeam[pos]}
                    onChange={e=>{ setRedTeam(p=>({ ...p, [pos]: e.target.value })); setWinRate(null); }}
                    placeholder="스트리머 이름"
                    className="w-full h-[36px] bg-[#08080c] border border-[#2a1e1e] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#ef4444]/50"
                  />
                  {redTeam[pos] && playerMainPos.get(redTeam[pos]) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded-full bg-[#2a1e1e] text-[#8a8aa0]">
                      주:{playerMainPos.get(redTeam[pos])?.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Blue팀 */}
          <div className="bg-[#101a2a]/50 border border-[#1e2a4a] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]" />
              <span className="text-[12px] font-black text-[#60a5fa]">Blue팀</span>
              {winRate && <span className="ml-auto text-[13px] font-black text-[#60a5fa]">{winRate.blue.toFixed(1)}%</span>}
            </div>
            {(LINE_KEYS as LineKey[]).map(pos=>(
              <div key={`blue-${pos}`} className="flex items-center gap-3 mb-2.5">
                <div className="w-[36px] text-[11px] font-bold text-[#8a8aa0] uppercase">{pos}</div>
                <div className="flex-1 relative">
                  <input
                    list="main-players"
                    value={blueTeam[pos]}
                    onChange={e=>{ setBlueTeam(p=>({ ...p, [pos]: e.target.value })); setWinRate(null); }}
                    placeholder="스트리머 이름"
                    className="w-full h-[36px] bg-[#08080c] border border-[#1e2a4a] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#3b82f6]/50"
                  />
                  {blueTeam[pos] && playerMainPos.get(blueTeam[pos]) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded-full bg-[#1e2a4a] text-[#8a8aa0]">
                      주:{playerMainPos.get(blueTeam[pos])?.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isFull && (
          <div className="mt-4 text-[11px] text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-full px-3 py-2 text-center">
            10명의 라인별 데이터가 모두 채워져야 시너지 분석 및 최적 재배치가 가능합니다. (현재 {Object.values(redTeam).filter(Boolean).length + Object.values(blueTeam).filter(Boolean).length}/10명)
          </div>
        )}

        {winRate && (
          <div className="mt-4 bg-[#08080c] border border-[#1e1e2a] rounded-xl p-3 flex items-center justify-between text-[12px]">
            <div className="text-[#8a8aa0]">예상 승률: Red <b className="text-[#f87171]">{winRate.red.toFixed(1)}%</b> vs Blue <b className="text-[#60a5fa]">{winRate.blue.toFixed(1)}%</b></div>
            <div className="text-[10px] text-[#5a5a70]">시너지: Red {winRate.sR.toFixed(1)}% / Blue {winRate.sB.toFixed(1)}%</div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={handleAnalyze} disabled={!isFull} className={`flex-1 h-[42px] rounded-full text-[12px] font-bold border transition ${isFull?'bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white border-[#2a2a3a]':'bg-[#12121a] text-[#5a5a70] border-[#1e1e2a] cursor-not-allowed'}`}>현재 팀 시너지 분석</button>
          <button onClick={handleOptimal} disabled={!isFull} className={`flex-1 h-[42px] rounded-full text-[12px] font-bold border transition ${isFull?'bg-[#7c3aed] hover:bg-[#6d28e0] text-white border-[#7c3aed] shadow-[0_0_12px_#7c3aed]/30':'bg-[#12121a] text-[#5a5a70] border-[#1e1e2a] cursor-not-allowed'}`}>승률 기반 최적 팀으로 재배치</button>
        </div>
      </div>

      <datalist id="main-players">
        {allStreamers.map(n=><option key={n} value={n} />)}
      </datalist>
    </div>
  );
};
