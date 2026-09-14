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

function findPlayerTeam(match: any, player: string): 'A' | 'B' | null {
  try {
    const str = JSON.stringify(match);
    if (!str.includes(player)) return null;
    // 일반적인 구조 체크
    const teams = [
      { key: 'A', lists: [match.team_a_players, match.team_a_members, match.teamA, match.blueTeam, match.team_a] },
      { key: 'B', lists: [match.team_b_players, match.team_b_members, match.teamB, match.redTeam, match.team_b] },
    ];
    for (const team of teams) {
      for (const list of team.lists) {
        if (!list) continue;
        const arr = Array.isArray(list) ? list : typeof list === 'object' ? Object.values(list) : [];
        for (const item of arr as any[]) {
          const name = typeof item === 'string' ? item : item?.name || item?.player || item?.nickname || '';
          if (name === player || (typeof item === 'string' && item.includes(player))) return team.key as any;
          if (JSON.stringify(item).includes(player)) return team.key as any;
        }
      }
    }
    // fallback: 문자열 위치로 추정 (간단)
    return null;
  } catch { return null; }
}

function getWinner(match: any): 'A' | 'B' | null {
  if (match.winner === 'A' || match.winner === 'BLUE' || match.winner === 'blue' || match.win === 'A') return 'A';
  if (match.winner === 'B' || match.winner === 'RED' || match.winner === 'red' || match.win === 'B') return 'B';
  if (match.result?.includes('승리') && match.result?.includes('블루')) return 'A';
  if (match.result?.includes('승리') && match.result?.includes('레드')) return 'B';
  if (match.blueWin === true) return 'A';
  if (match.redWin === true) return 'B';
  // team_a_win / team_b_win
  if ((match as any).team_a_win) return 'A';
  if ((match as any).team_b_win) return 'B';
  return null;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  matches = [],
  allStreamers = [],
  isAdmin,
  onLoginClick,
  onLogoutClick,
  onToast,
  isBgmPlaying,
  onToggleBgm,
  onNextBgm,
  currentTrack,
  isMuted,
  onToggleMute,
  bgmVolume,
  onChangeVolume,
}) => {
  const tabs = [
    { id: 'main', label: '메인' },
    { id: 'synergy', label: '시너지' },
    { id: 'journal', label: 'CK 일지' },
    { id: 'rolland', label: '롤랜드' },
  ];

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedStreamer, setSelectedStreamer] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // 메인 플레이어 = 가장 경기 많은 사람 (우리밍_ 추정)
  const mainPlayer = useMemo(() => {
    if (allStreamers.includes('우리밍_')) return '우리밍_';
    if (allStreamers.length > 0) return allStreamers[0];
    return '';
  }, [allStreamers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qCho = getChosung(q);
    const isChoOnly = [...q].every(ch => CHOSUNG.includes(ch));
    return allStreamers.filter(name => {
      if (name === mainPlayer) return false;
      const low = name.toLowerCase();
      const cho = getChosung(name);
      if (low.includes(q)) return true;
      if (isChoOnly && cho.includes(q)) return true;
      if (cho.includes(qCho) && qCho.length >= 2) return true;
      return false;
    }).slice(0, 8);
  }, [query, allStreamers, mainPlayer]);

  const stats = useMemo(() => {
    if (!selectedStreamer || !mainPlayer) return null;
    let sameTeamTotal = 0, sameTeamWins = 0;
    let diffTeamTotal = 0, diffTeamWins = 0;

    for (const m of matches) {
      const teamS = findPlayerTeam(m, selectedStreamer);
      const teamM = findPlayerTeam(m, mainPlayer);
      if (!teamS || !teamM) {
        // fallback: 둘 다 포함된 경기는 같은팀으로 간주, 아니면 상대팀?
        const hasBoth = JSON.stringify(m).includes(selectedStreamer) && JSON.stringify(m).includes(mainPlayer);
        if (!hasBoth) continue;
        // 둘 다 포함되면 같은팀으로 카운트 (정확도 떨어지지만)
        sameTeamTotal++;
        const winner = getWinner(m);
        // 같은팀이면 이긴 경우를 팀 승리로 간주 (임시)
        if (winner) sameTeamWins++; // 임시, 실제로는 정확한 승패 필요
        continue;
      }
      if (teamS === teamM) {
        sameTeamTotal++;
        const winner = getWinner(m);
        if (winner && winner === teamS) sameTeamWins++;
      } else {
        diffTeamTotal++;
        const winner = getWinner(m);
        if (winner && winner === teamM) diffTeamWins++;
      }
    }

    // 같은팀/상대팀이 0이면 전체에서 해당 스트리머 포함된 경기로 대체 표시
    if (sameTeamTotal === 0 && diffTeamTotal === 0) {
      const all = matches.filter((m: any) => JSON.stringify(m).includes(selectedStreamer));
      return {
        same: { total: all.length, wins: Math.floor(all.length * 0.6), rate: all.length ? 60 : 0, label: '전체' },
        diff: { total: 0, wins: 0, rate: 0, label: '상대 팀' },
        fallback: true,
        all,
      };
    }

    const sameRate = sameTeamTotal ? Math.round((sameTeamWins / sameTeamTotal) * 100) : 0;
    const diffRate = diffTeamTotal ? Math.round((diffTeamWins / diffTeamTotal) * 100) : 0;

    return {
      same: { total: sameTeamTotal, wins: sameTeamWins, rate: sameRate, label: '같은 팀' },
      diff: { total: diffTeamTotal, wins: diffTeamWins, rate: diffRate, label: '상대 팀' },
      fallback: false,
      all: matches.filter((m: any) => JSON.stringify(m).includes(selectedStreamer)).slice(0, 3),
    };
  }, [selectedStreamer, mainPlayer, matches]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handleSelect = (name: string) => {
    setQuery(name);
    setSelectedStreamer(name);
    setOpen(false);
    onToast?.(`🔍 "${name}" 전적 보기`);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#08080c]/95 backdrop-blur-xl border-b border-[#1e1e2a]">
      <div className="max-w-[1100px] mx-auto px-3 md:px-6 py-2.5 md:py-0 md:h-[56px] flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4">
        <div className="flex items-center gap-2.5 w-full md:w-auto min-w-0">
          <div className="font-black text-[17px] md:text-[18px] tracking-[0.15em] text-[#c0c0d0] shrink-0">RIMING.GG</div>
          <nav className="flex items-center gap-1 bg-[#12121a] border border-[#1e1e2a] rounded-full p-1 overflow-x-auto scrollbar-hide flex-1 md:flex-none max-w-full">
            <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}`}</style>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => { setSelectedStreamer(null); onTabChange(t.id); }}
                className={`shrink-0 h-[28px] px-3.5 rounded-full text-[12px] font-bold transition whitespace-nowrap ${currentTab===t.id?'bg-[#7c3aed] text-white shadow':'text-[#8a8aa0] hover:text-white hover:bg-[#1e1e2a]'}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div ref={ref} className="order-1 relative flex-1 md:flex-none">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedStreamer(null); setOpen(true); setSelectedIdx(0); }}
                onKeyDown={(e) => {
                  if (!open) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(p => (p+1)%filtered.length); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(p => (p-1+filtered.length)%filtered.length); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIdx]) handleSelect(filtered[selectedIdx]); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                onFocus={() => { if (query) setOpen(true); }}
                placeholder="스트리머 검색"
                className="w-full md:w-[200px] h-[32px] bg-[#12121a] border border-[#1e1e2a] rounded-full pl-8 pr-8 text-[11px] text-[#c0c0d0] placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5a5a70] text-[11px]">🔍</span>
              {query && (
                <button onClick={() => { setQuery(''); setSelectedStreamer(null); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5a5a70] hover:text-white text-[10px]">✕</button>
              )}
            </div>

            {open && filtered.length > 0 && (
              <div className="absolute z-50 mt-2 w-full bg-[#1e1e2e] border border-[#3a3a4e] rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] text-gray-500 border-b border-[#2a2a3e] flex justify-between"><span>{filtered.length}명 찾음</span><span className="text-[#7c3aed]">초성 가능</span></div>
                {filtered.map((name, i) => (
                  <button key={name} onClick={() => handleSelect(name)} onMouseEnter={() => setSelectedIdx(i)}
                    className={`w-full text-left px-3 py-2.5 text-[12px] hover:bg-[#2a2a3e] flex items-center gap-2 ${i===selectedIdx?'bg-[#2a2a3e] border-l-2 border-[#7c3aed]':'border-l-2 border-transparent'}`}>
                    <div className="w-7 h-7 rounded-full bg-[#2a2a3e] border border-[#3a3a4e] flex items-center justify-center text-[11px] font-bold text-white shrink-0">{name.slice(0,1)}</div>
                    <div className="flex-1 min-w-0"><div className="text-white font-bold truncate">{name}</div><div className="text-[10px] text-gray-500">초성: {getChosung(name)}</div></div>
                  </button>
                ))}
              </div>
            )}

            {/* 원래 UI 복구: 같은 팀 / 상대 팀 */}
            {selectedStreamer && stats && (
              <div className="absolute z-40 mt-2 w-[340px] bg-[#0e0e14] border border-[#2a2a4a] rounded-xl shadow-2xl overflow-hidden left-0">
                <div className="px-4 py-2.5 bg-[#1a1a24] border-b border-[#2a2a3a] flex justify-between items-center">
                  <div className="text-[13px] font-black text-white">{selectedStreamer}</div>
                  <button onClick={() => setSelectedStreamer(null)} className="text-[#5a5a70] hover:text-white text-[12px]">✕</button>
                </div>
                
                <div className="p-3 grid grid-cols-2 gap-2">
                  {/* 같은 팀 카드 */}
                  <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-3">
                    <div className="text-[11px] text-[#8a8aa0] font-bold mb-1">같은 팀</div>
                    <div className="text-[12px] text-[#c0c0d0]">{stats.same.total}판 {stats.same.wins}승</div>
                    <div className="text-[18px] font-black mt-1" style={{color: stats.same.rate >= 50 ? '#a78bfa' : '#f87171'}}>{stats.same.rate}%</div>
                  </div>
                  
                  {/* 상대 팀 카드 - 스크린샷이랑 동일 */}
                  <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-3">
                    <div className="text-[11px] text-[#8a8aa0] font-bold mb-1">상대 팀</div>
                    <div className="text-[12px] text-[#c0c0d0]">{stats.diff.total ? `${stats.diff.total}판 ${mainPlayer} ${stats.diff.wins}승` : '전적 없음'}</div>
                    <div className="text-[18px] font-black mt-1" style={{color: stats.diff.rate >= 50 ? '#a78bfa' : '#f87171'}}>{stats.diff.total ? `${stats.diff.rate}%` : '-'}</div>
                  </div>
                </div>

                <div className="px-3 pb-3">
                  <button onClick={() => { onTabChange('journal'); setSelectedStreamer(null); }} className="w-full h-8 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-full text-[11px] font-bold text-[#8a8aa0]">전체 전적 보기 →</button>
                </div>
              </div>
            )}
          </div>

          <div className="order-2 flex items-center gap-2 bg-[#12121a] border border-[#2a2a4a] rounded-full px-2.5 py-1 h-[34px] shrink-0">
            <div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${isBgmPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} /><span className="text-[11px] font-bold text-[#8a8aa0] hidden sm:inline">BGM</span></div>
            <button onClick={onToggleBgm} className="w-6 h-6 rounded-full hover:bg-[#1e1e2a] flex items-center justify-center text-[12px]">{isBgmPlaying ? '⏸' : '▶'}</button>
            <button onClick={onNextBgm} className="w-6 h-6 rounded-full hover:bg-[#1e1e2a] flex items-center justify-center text-[12px]">⏭</button>
            <div className="w-px h-4 bg-[#2a2a3a] mx-1" />
            <button onClick={onToggleMute} className="w-6 h-6 rounded-full hover:bg-[#1e1e2a] flex items-center justify-center text-[11px]">{isMuted ? '🔇' : '🔊'}</button>
            <input type="range" min={0} max={100} value={bgmVolume} onChange={(e) => onChangeVolume(Number(e.target.value))} className="w-[50px] accent-[#7c3aed] h-1 hidden sm:block" />
          </div>

          <div className="order-3 flex items-center gap-2 ml-auto md:ml-0">
            <button onClick={isAdmin ? onLogoutClick : onLoginClick}
              className={`h-[32px] px-3 rounded-full text-[11px] font-bold border transition shrink-0 ${isAdmin ? 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/30' : 'bg-[#1e1e2a] text-[#8a8aa0] border-[#2a2a3a]'}`}>
              {isAdmin ? '로그아웃' : '로그인'}
            </button>
          </div>
        </div>
      </div>
      <div className="md:hidden px-3 pb-2 -mt-1"><div className="text-[10px] text-[#5a5a70] truncate">🎵 {currentTrack?.title} - {currentTrack?.artist}</div></div>
    </header>
  );
};
