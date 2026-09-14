import React from 'react';
import { Match } from '../types';
import { BgmTrack } from '../lib/bgm';
import { StreamerSearchBar } from './StreamerSearchBar';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  matches: Match[];
  allStreamers: string[];
  onSelectStreamer: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
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

// FINAL FIX: 모바일에서도 메뉴 절대 안 사라지는 헤더 + 스트리머 전적 검색창
export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  matches,
  allStreamers,
  onSelectStreamer,
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
      <div className="max-w-[1100px] mx-auto px-3 md:px-6 py-2.5 md:py-0 md:h-[56px] flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3">
        
        {/* 첫 줄: 로고 + 메뉴 탭 (모바일에서도 항상 보임) */}
        <div className="flex items-center gap-2.5 w-full md:w-auto min-w-0">
          <div className="font-black text-[17px] md:text-[18px] tracking-[0.15em] text-[#c0c0d0] shrink-0">
            RIMING.GG
          </div>
          
          {/* 탭 - 가로 스크롤 가능하지만 절대 숨지 않음 */}
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

        {/* 둘째 줄 / 우측: 상단 스트리머 검색창 + BGM + 관리자 */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap md:flex-nowrap">
          {/* 상단 스트리머 전적 검색창 */}
          <div className="w-full md:w-[230px] lg:w-[260px] order-last md:order-first">
            <StreamerSearchBar
              allStreamers={allStreamers}
              matches={matches}
              onSelectStreamer={onSelectStreamer}
              placeholder="스트리머 검색 (예: 린다랑, 서리)"
            />
          </div>

          {/* BGM 컨트롤 */}
          <div className="flex items-center gap-2 bg-[#12121a] border border-[#2a2a4a] rounded-full px-2.5 py-1 h-[34px] shrink-0">
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

          <div className="flex items-center gap-2 ml-auto md:ml-0">
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
      
      {/* 현재 재생곡 - 모바일에서만 작게 표시 */}
      <div className="md:hidden px-3 pb-2 -mt-0.5">
        <div className="text-[10px] text-[#5a5a70] truncate">
          🎵 {currentTrack?.title} - {currentTrack?.artist}
        </div>
      </div>
    </header>
  );
};
