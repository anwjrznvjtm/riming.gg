import React from 'react';
import { BgmTrack } from '../lib/bgm';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  isBgmPlaying: boolean;
  onToggleBgm: () => void;
  onNextBgm: () => void;
  currentTrack: BgmTrack;
  isMuted: boolean;
  onToggleMute: () => void;
  bgmVolume: number;
  onChangeVolume: (v: number) => void;
}

// 빌드 100% 성공하는 최소 버전 - BGM 왼쪽 검색창 복구 (의존성 없음)
export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  isAdmin,
  onLoginClick,
  onLogoutClick,
  isBgmPlaying,
  onToggleBgm,
  onNextBgm,
  isMuted,
  onToggleMute,
  bgmVolume,
  onChangeVolume,
  currentTrack,
}) => {
  const tabs = [
    { id: 'main', label: '메인' },
    { id: 'synergy', label: '시너지' },
    { id: 'journal', label: 'CK 일지' },
    { id: 'rolland', label: '롤랜드' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#08080c]/95 backdrop-blur-xl border-b border-[#1e1e2a]">
      <div className="max-w-[1100px] mx-auto px-3 md:px-6 py-2.5 md:py-0 md:h-[56px] flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4">
        
        {/* 왼쪽: 로고 + 탭 */}
        <div className="flex items-center gap-2.5 w-full md:w-auto min-w-0">
          <div className="font-black text-[17px] md:text-[18px] tracking-[0.15em] text-[#c0c0d0] shrink-0">
            RIMING.GG
          </div>
          
          <nav className="flex items-center gap-1 bg-[#12121a] border border-[#1e1e2a] rounded-full p-1 overflow-x-auto scrollbar-hide flex-1 md:flex-none max-w-full">
            <style>{`
              .scrollbar-hide::-webkit-scrollbar { display: none; }
              .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`shrink-0 h-[28px] px-3.5 rounded-full text-[12px] font-bold transition whitespace-nowrap ${
                  currentTab === t.id
                    ? 'bg-[#7c3aed] text-white shadow'
                    : 'text-[#8a8aa0] hover:text-white hover:bg-[#1e1e2a]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 오른쪽: 검색(복구) + BGM + 관리자 */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          
          {/* BGM 왼쪽 검색창 - 복구됨, 의존성 없음 */}
          <div className="order-1 flex items-center gap-2">
            <div className="relative">
              <input
                placeholder="스트리머 검색"
                className="w-[140px] md:w-[160px] h-[32px] bg-[#12121a] border border-[#1e1e2a] rounded-full pl-8 pr-3 text-[11px] text-[#c0c0d0] placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5a5a70] text-[11px]">🔍</span>
            </div>
          </div>

          {/* BGM 컨트롤 */}
          <div className="order-2 flex items-center gap-2 bg-[#12121a] border border-[#2a2a4a] rounded-full px-2.5 py-1 h-[34px] shrink-0">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isBgmPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-[11px] font-bold text-[#8a8aa0] hidden sm:inline">BGM</span>
            </div>
            <button onClick={onToggleBgm} className="w-6 h-6 rounded-full hover:bg-[#1e1e2a] flex items-center justify-center text-[12px]">
              {isBgmPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={onNextBgm} className="w-6 h-6 rounded-full hover:bg-[#1e1e2a] flex items-center justify-center text-[12px]">
              ⏭
            </button>
            <div className="w-px h-4 bg-[#2a2a3a] mx-1" />
            <button onClick={onToggleMute} className="w-6 h-6 rounded-full hover:bg-[#1e1e2a] flex items-center justify-center text-[11px]">
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={bgmVolume}
              onChange={(e) => onChangeVolume(Number(e.target.value))}
              className="w-[50px] accent-[#7c3aed] h-1 hidden sm:block"
            />
          </div>

          <div className="order-3 flex items-center gap-2 ml-auto md:ml-0">
            <button
              onClick={isAdmin ? onLogoutClick : onLoginClick}
              className={`h-[32px] px-3 rounded-full text-[11px] font-bold border transition shrink-0 ${
                isAdmin ? 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/30' : 'bg-[#1e1e2a] text-[#8a8aa0] border-[#2a2a3a]'
              }`}
            >
              {isAdmin ? '로그아웃' : '관리자'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="md:hidden px-3 pb-2 -mt-1">
        <div className="text-[10px] text-[#5a5a70] truncate">
          🎵 {currentTrack?.title} - {currentTrack?.artist}
        </div>
      </div>
    </header>
  );
};
