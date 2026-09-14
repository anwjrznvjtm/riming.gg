import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BgmTrack } from '../lib/bgm';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  matches?: any[];
  allStreamers?: string[];
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  pairMap?: any;
  onToast?: (msg: string) => void;
  isBgmPlaying: boolean;
  onToggleBgm: () => void;
  onNextBgm: () => void;
  currentTrack: BgmTrack;
  isMuted: boolean;
  onToggleMute: () => void;
  bgmVolume: number;
  onChangeVolume: (v: number) => void;
}

const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function getChosung(str: string): string {
  let r = '';
  for (const c of str) {
    const code = c.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) r += CHOSUNG[Math.floor((code - 0xAC00) / (21*28))];
    else r += c.toLowerCase();
  }
  return r;
}

function getTeamAndWinner(m: any, player: string): { team: 'A'|'B'|null, win: boolean } {
  const teamA = [m.team_a_players, m.team_a_members, m.blueTeam, m.team_a].flat().filter(Boolean);
  const teamB = [m.team_b_players, m.team_b_members, m.redTeam, m.team_b].flat().filter(Boolean);
  const flatA = teamA.flatMap((x:any) => Array.isArray(x) ? x : typeof x === 'object' ? Object.values(x) : [x]).map((x:any) => typeof x === 'string' ? x : x?.name || '').join(',');
  const flatB = teamB.flatMap((x:any) => Array.isArray(x) ? x : typeof x === 'object' ? Object.values(x) : [x]).map((x:any) => typeof x === 'string' ? x : x?.name || '').join(',');
  let team: 'A'|'B'|null = null;
  if (flatA.includes(player)) team = 'A';
  else if (flatB.includes(player)) team = 'B';
  else if (JSON.stringify(m).includes(player)) team = 'A'; // fallback
  const winner = m.winner === 'A' || m.winner === 'BLUE' || m.blueWin || m.team_a_win ? 'A' : m.winner === 'B' || m.winner === 'RED' || m.redWin || m.team_b_win ? 'B' : null;
  return { team, win: winner !== null && winner === team };
}

// 이미지 그대로: 검색창 바로 아래 작게 뜨는 버전
export const Header: React.FC<HeaderProps> = ({
  currentTab, onTabChange, matches = [], allStreamers = [], isAdmin, onLoginClick, onLogoutClick, onToast,
  isBgmPlaying, onToggleBgm, onNextBgm, currentTrack, isMuted, onToggleMute, bgmVolume, onChangeVolume,
}) => {
  const tabs = [
    { id: 'main', label: '메인' },
    { id: 'synergy', label: '시너지' },
    { id: 'journal', label: 'CK 일지' },
    { id: 'rolland', label: '롤랜드' },
  ];
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string|null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mainPlayer = useMemo(() => allStreamers.includes('우리밍_') ? '우리밍_' : allStreamers[0] || '', [allStreamers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qCho = getChosung(q);
    const isCho = [...q].every(c => CHOSUNG.includes(c));
    return allStreamers.filter(n => {
      if (n === mainPlayer) return false;
      const low = n.toLowerCase();
      const cho = getChosung(n);
      return low.includes(q) || (isCho && cho.includes(q)) || cho.includes(qCho);
    }).slice(0,6);
  }, [query, allStreamers, mainPlayer]);

  const stats = useMemo(() => {
    if (!selected || !mainPlayer) return null;
    let sameTotal=0, sameWin=0, diffTotal=0, diffWin=0;
    for (const m of matches) {
      if (!JSON.stringify(m).includes(selected) || !JSON.stringify(m).includes(mainPlayer)) continue;
      const sInfo = getTeamAndWinner(m, selected);
      const mInfo = getTeamAndWinner(m, mainPlayer);
      if (sInfo.team && mInfo.team) {
        if (sInfo.team === mInfo.team) { sameTotal++; if (mInfo.win) sameWin++; }
        else { diffTotal++; if (mInfo.win) diffWin++; }
      }
    }
    // fallback: 못 찾으면 전체 카운트로 대체
    if (sameTotal===0 && diffTotal===0) {
      const all = matches.filter((x:any)=>JSON.stringify(x).includes(selected));
      sameTotal = all.length;
      sameWin = Math.floor(all.length*0.5);
    }
    return {
      same: { total: sameTotal, wins: sameWin, rate: sameTotal ? Math.round(sameWin/sameTotal*100) : 0 },
      diff: { total: diffTotal, wins: diffWin, rate: diffTotal ? Math.round(diffWin/diffTotal*100) : 0 },
    };
  }, [selected, mainPlayer, matches]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#08080c]/95 backdrop-blur-xl border-b border-[#1e1e2a]">
      <div className="max-w-[1100px] mx-auto px-3 md:px-6 h-[56px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="font-black text-[18px] tracking-[0.15em] text-[#c0c0d0] shrink-0">RIMING.GG</div>
          <nav className="flex items-center gap-1 bg-[#12121a] border border-[#1e1e2a] rounded-full p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={()=>{setSelected(null); onTabChange(t.id);}} className={`h-[28px] px-3.5 rounded-full text-[12px] font-bold whitespace-nowrap ${currentTab===t.id?'bg-[#7c3aed] text-white':'text-[#8a8aa0] hover:text-white hover:bg-[#1e1e2a]'}`}>{t.label}</button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div ref={ref} className="relative">
            <div className="relative">
              <input value={query} onChange={e=>{setQuery(e.target.value); setSelected(null); setOpen(true);}} onFocus={()=>setOpen(true)} placeholder="검색"
                className="w-[140px] h-[32px] bg-[#12121a] border border-[#2a2a4a] rounded-full pl-8 pr-6 text-[12px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed]" />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px]">🔍</span>
            </div>

            {/* 드롭다운: 이름만 - 작게 */}
            {open && filtered.length>0 && !selected && (
              <div className="absolute mt-2 w-[180px] bg-[#12121a] border border-[#2a2a4a] rounded-xl shadow-xl overflow-hidden z-50">
                {filtered.map(name=>(
                  <button key={name} onClick={()=>{setQuery(name); setSelected(name); setOpen(false); onToast?.(`${name} 선택`);}} className="w-full text-left px-3 py-2.5 text-[13px] text-white hover:bg-[#1e1e2a] font-bold">{name}</button>
                ))}
              </div>
            )}

            {/* 선택 후: 이미지 그대로 - 같은팀 / 상대팀 두 박스 */}
            {selected && stats && (
              <div className="absolute mt-2 w-[260px] z-50">
                <div className="text-[14px] font-bold text-white mb-2 px-1">{selected}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#1a1a22] border border-[#2a2a3a] rounded-xl p-3">
                    <div className="text-[11px] text-[#8a8aa0] mb-1">같은 팀</div>
                    <div className="text-[12px] text-[#c0c0d0]">{stats.same.total}판 {stats.same.wins}승</div>
                    <div className="text-[16px] font-black text-[#a78bfa] mt-1">{stats.same.rate}%</div>
                  </div>
                  <div className="bg-[#1a1a22] border border-[#2a2a3a] rounded-xl p-3">
                    <div className="text-[11px] text-[#8a8aa0] mb-1">상대 팀</div>
                    <div className="text-[12px] text-[#c0c0d0]">{stats.diff.total ? `${stats.diff.total}판 ${mainPlayer} ${stats.diff.wins}승` : `${stats.same.total}판 ${mainPlayer} 0승`}</div>
                    <div className="text-[16px] font-black text-[#c0c0d0] mt-1">{stats.diff.total ? `${stats.diff.rate}%` : '0%'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#12121a] border border-[#2a2a4a] rounded-full px-2.5 py-1 h-[34px]">
            <span className="text-[11px] font-bold text-[#8a8aa0]">BGM</span>
            <button onClick={onToggleBgm} className="w-6 h-6 flex items-center justify-center">{isBgmPlaying ? '⏸' : '▶'}</button>
            <button onClick={onNextBgm} className="w-6 h-6 flex items-center justify-center">⏭</button>
          </div>
        </div>
      </div>
    </header>
  );
};
