import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BgmTrack } from '../lib/bgm';
import { Match } from '../types';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  matches: Match[];
  allStreamers: string[];
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  pairMap: Map<string, any>;
  onToast: (msg: string) => void;
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

function getPlayerTeam(m: any, player: string): 'Red'|'Blue'|null {
  const p = player.trim();
  for (const k of ['top','jgl','mid','adc','sup']) {
    if ((m.team_a?.[k] || '').trim() === p) return 'Red';
    if ((m.team_b?.[k] || '').trim() === p) return 'Blue';
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

export const Header: React.FC<HeaderProps> = ({
  currentTab, onTabChange, matches, allStreamers, isAdmin, onLoginClick, onLogoutClick,
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
      const teamS = getPlayerTeam(m, selected);
      const teamM = getPlayerTeam(m, mainPlayer);
      if (!teamS || !teamM) continue;
      const winner = getWinningTeam(m);
      if (!winner) continue;
      if (teamS === teamM) { sameTotal++; if (winner === teamS) sameWin++; }
      else { diffTotal++; if (winner === teamM) diffWin++; }
    }
    return {
      same: { total: sameTotal, wins: sameWin, rate: sameTotal ? Math.round(sameWin/sameTotal*100) : 0 },
      diff: { total: diffTotal, wins: diffWin, rate: diffTotal ? Math.round(diffWin/diffTotal*100) : 0 },
      hasData: sameTotal>0 || diffTotal>0,
    };
  }, [selected, mainPlayer, matches]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#08080c]/95 backdrop-blur-xl border-b border-[#1e1e2a]">
      <div className="max-w-[1100px] mx-auto px-3 md:px-6 py-2.5 md:py-0 md:h-[56px] flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4">
        <div className="flex items-center gap-2.5 w-full md:w-auto min-w-0">
          <div className="font-black text-[17px] md:text-[18px] tracking-[0.15em] text-[#c0c0d0] shrink-0">RIMING.GG</div>
          <nav className="flex items-center gap-1 bg-[#12121a] border border-[#1e1e2a] rounded-full p-1 overflow-x-auto scrollbar-hide flex-1 md:flex-none max-w-full">
            <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}`}</style>
            {tabs.map(t => (
              <button key={t.id} onClick={()=>{setSelected(null); onTabChange(t.id);}} className={`shrink-0 h-[28px] px-3.5 rounded-full text-[12px] font-bold transition whitespace-nowrap ${currentTab===t.id?'bg-[#7c3aed] text-white shadow':'text-[#8a8aa0] hover:text-white hover:bg-[#1e1e2a]'}`}>{t.label}</button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div ref={ref} className="order-1 relative flex-1 md:flex-none">
            <div className="relative">
              <input value={query} onChange={e=>{setQuery(e.target.value); setSelected(null); setOpen(true);}} onFocus={()=>setOpen(true)} placeholder="검색"
                className="w-full md:w-[140px] h-[32px] bg-[#12121a] border border-[#2a2a4a] rounded-full pl-8 pr-6 text-[12px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed]" />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px]">🔍</span>
            </div>

            {open && filtered.length>0 && !selected && (
              <div className="absolute mt-2 w-[180px] bg-[#12121a] border border-[#2a2a4a] rounded-xl shadow-xl overflow-hidden z-50">
                {filtered.map(name=>(
                  <button key={name} onClick={()=>{setQuery(name); setSelected(name); setOpen(false);}} className="w-full text-left px-3 py-2.5 text-[13px] text-white hover:bg-[#1e1e2a] font-bold">{name}</button>
                ))}
              </div>
            )}

            {selected && stats && (
              <div className="absolute mt-2 w-[260px] z-50">
                <div className="text-[14px] font-bold text-white mb-2 px-1 flex justify-between"><span>{selected}</span><button onClick={()=>setSelected(null)} className="text-[#5a5a70]">✕</button></div>
                {!stats.hasData ? (
                  <div className="bg-[#1a1a22] border border-[#2a2a3a] rounded-xl p-3 text-[11px] text-[#8a8aa0] text-center">CK일지에 {selected} 전적 없음</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#1a1a22] border border-[#2a2a3a] rounded-xl p-3">
                      <div className="text-[11px] text-[#8a8aa0] mb-1">같은 팀</div>
                      <div className="text-[12px] text-[#c0c0d0]">{stats.same.total}판 {stats.same.wins}승</div>
                      <div className="text-[16px] font-black mt-1" style={{color: stats.same.total ? (stats.same.rate>=50?'#a78bfa':'#f87171') : '#5a5a70'}}>{stats.same.total ? `${stats.same.rate}%` : '0%'}</div>
                    </div>
                    <div className="bg-[#1a1a22] border border-[#2a2a3a] rounded-xl p-3">
                      <div className="text-[11px] text-[#8a8aa0] mb-1">상대 팀</div>
                      <div className="text-[12px] text-[#c0c0d0]">{stats.diff.total ? `${stats.diff.total}판 우리밍_ ${stats.diff.wins}승` : '전적 없음'}</div>
                      <div className="text-[16px] font-black mt-1" style={{color: stats.diff.total ? (stats.diff.rate>=50?'#a78bfa':'#c0c0d0') : '#5a5a70'}}>{stats.diff.total ? `${stats.diff.rate}%` : '-'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="order-2 flex items-center gap-2 bg-[#12121a] border border-[#2a2a4a] rounded-full px-2.5 py-1 h-[34px] shrink-0">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isBgmPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-[11px] font-bold text-[#8a8aa0] hidden sm:inline">BGM</span>
            </div>
            <button onClick={onToggleBgm} className="w-6 h-6 rounded-full hover:bg-[#1e1e2a] flex items-center justify-center text-[12px]">{isBgmPlaying ? '⏸' : '▶'}</button>
            <button onClick={onNextBgm} className="w-6 h-6 rounded-full hover:bg-[#1e1e2a] flex items-center justify-center text-[12px]">⏭</button>
            <div className="w-px h-4 bg-[#2a2a3a] mx-1" />
            <button onClick={onToggleMute} className="w-6 h-6 rounded-full hover:bg-[#1e1e2a] flex items-center justify-center text-[11px]">{isMuted ? '🔇' : '🔊'}</button>
            <input type="range" min={0} max={100} value={bgmVolume} onChange={e=>onChangeVolume(Number(e.target.value))} className="w-[50px] accent-[#7c3aed] h-1 hidden sm:block" />
          </div>

          <div className="order-3 flex items-center gap-2 ml-auto md:ml-0">
            <button onClick={isAdmin ? onLogoutClick : onLoginClick} className={`h-[32px] px-3 rounded-full text-[11px] font-bold border transition shrink-0 ${isAdmin ? 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/30' : 'bg-[#1e1e2a] text-[#8a8aa0] border-[#2a2a3a]'}`}>{isAdmin ? '로그아웃' : '관리자'}</button>
          </div>
        </div>
      </div>
      <div className="md:hidden px-3 pb-2 -mt-1"><div className="text-[10px] text-[#5a5a70] truncate">🎵 {currentTrack?.title} - {currentTrack?.artist}</div></div>
    </header>
  );
};
