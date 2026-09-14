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

// 원래 기능 복구 - 스트리머 검색 먹통 해결
export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
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
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qCho = getChosung(q);
    const isChoOnly = [...q].every(ch => CHOSUNG.includes(ch));
    
    return allStreamers.filter(name => {
      const low = name.toLowerCase();
      const cho = getChosung(name);
      if (low.includes(q)) return true;
      if (isChoOnly && cho.includes(q)) return true;
      if (cho.includes(qCho) && qCho.length >= 2) return true;
      return false;
    }).slice(0, 8);
  }, [query, allStreamers]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handleSelect = (name: string) => {
    setQuery(name);
    setOpen(false);
    onToast?.(`🔍 "${name}" 검색 - 필터 적용됨`);
    // 기존 로직: 메인탭에서 해당 스트리머 하이라이트되거나, 전적 필터
    // 여기서는 토스트만 띄우고, 필요하다면 localStorage나 커스텀 이벤트로 전달
    window.dispatchEvent(new CustomEvent('streamer-search', { detail: name }));
  };

  return (
    <header className="sticky top-0 z-40 bg-[#08080c]/95 backdrop-blur-xl border-b border-[#1e1e2a]">
      <div className="max-w-[1100px] mx-auto px-3 md:px-6 py-2.5 md:py-0 md:h-[56px] flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4">
        
        <div className="flex items-center gap-2.5 w-full md:w-auto min-w-0">
          <div className="font-black text-[17px] md:text-[18px] tracking-[0.15em] text-[#c0c0d0] shrink-0">
            RIMING.GG
          </div>
          <nav className="flex items-center gap-1 bg-[#12121a] border border-[#1e1e2a] rounded-full p-1 overflow-x-auto scrollbar-hide flex-1 md:flex-none max-w-full">
            <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}`}</style>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => onTabChange(t.id)}
                className={`shrink-0 h-[28px] px-3.5 rounded-full text-[12px] font-bold transition whitespace-nowrap ${currentTab===t.id?'bg-[#7c3aed] text-white shadow':'text-[#8a8aa0] hover:text-white hover:bg-[#1e1e2a]'}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          
          {/* 스트리머 검색 - 기능 복구 */}
          <div ref={ref} className="order-1 relative flex-1 md:flex-none">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); setSelectedIdx(0); }}
                onKeyDown={(e) => {
                  if (!open) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(p => (p+1)%filtered.length); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(p => (p-1+filtered.length)%filtered.length); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIdx]) handleSelect(filtered[selectedIdx]); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                onFocus={() => query && setOpen(true)}
                placeholder="스트리머 검색"
                className="w-full md:w-[160px] h-[32px] bg-[#12121a] border border-[#1e1e2a] rounded-full pl-8 pr-8 text-[11px] text-[#c0c0d0] placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5a5a70] text-[11px]">🔍</span>
              {query && (
                <button onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5a5a70] hover:text-white text-[10px]">✕</button>
              )}
            </div>

            {open && filtered.length > 0 && (
              <div className="absolute z-50 mt-2 w-full bg-[#1e1e2e] border border-[#3a3a4e] rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] text-gray-500 border-b border-[#2a2a3e]">{filtered.length}명 찾음 • 초성 검색 가능</div>
                {filtered.map((name, i) => (
                  <button key={name} onClick={() => handleSelect(name)} onMouseEnter={() => setSelectedIdx(i)}
                    className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#2a2a3e] flex items-center gap-2 ${i===selectedIdx?'bg-[#2a2a3e] border-l-2 border-[#7c3aed]':'border-l-2 border-transparent'}`}>
                    <div className="w-6 h-6 rounded-full bg-[#2a2a3e] flex items-center justify-center text-[10px] font-bold text-white">{name.slice(0,1)}</div>
                    <span className="text-white font-bold">{name}</span>
                    <span className="text-[10px] text-gray-500">{getChosung(name)}</span>
                  </button>
                ))}
              </div>
            )}
            {open && query && filtered.length === 0 && (
              <div className="absolute z-50 mt-2 w-full bg-[#1e1e2e] border border-[#3a3a4e] rounded-lg p-3 text-center text-[11px] text-gray-400">"{query}" 결과 없음</div>
            )}
          </div>

          {/* BGM */}
          <div className="order-2 flex items-center gap-2 bg-[#12121a] border border-[#2a2a4a] rounded-full px-2.5 py-1 h-[34px] shrink-0">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isBgmPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-[11px] font-bold text-[#8a8aa0] hidden sm:inline">BGM</span>
            </div>
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
