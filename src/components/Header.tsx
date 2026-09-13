import React, { useState } from 'react';
import { Match } from '../types';
import { getPlayerSynergyRate, isWooriming, WOORIMING } from '../lib/stats';
import { Search, Volume2, VolumeX, Play, Pause, Lock, Unlock, SkipForward } from 'lucide-react';
import { BgmTrack } from '../lib/bgm';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  matches: Match[];
  allStreamers: string[];
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  pairMap: Map<string, { games: number; wins: number }>;
  onToast: (msg: string) => void;
  isBgmPlaying: boolean;
  onToggleBgm: () => void;
  onNextBgm?: () => void;
  currentTrack?: BgmTrack | null;
  isMuted: boolean;
  onToggleMute: () => void;
  bgmVolume: number;
  onChangeVolume: (vol: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  matches,
  allStreamers,
  isAdmin,
  onLoginClick,
  onLogoutClick,
  pairMap,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navItems = [
    { key: 'main', label: '메인' },
    { key: 'synergy', label: '시너지' },
    { key: 'journal', label: 'CK 일지' },
    { key: 'rolland', label: '롤랜드' },
  ];

  // Search suggestions
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = allStreamers
      .filter((name) => name.toLowerCase().includes(q) && !isWooriming(name))
      .slice(0, 6);

    return filtered.map((name) => {
      let sameGames = 0, sameWins = 0;
      let oppGames = 0, oppWins = 0;

      for (const m of matches) {
        const aPlayers = Object.values(m.team_a);
        const bPlayers = Object.values(m.team_b);
        const wInA = aPlayers.some(isWooriming);
        const pInA = aPlayers.includes(name);
        const wInB = bPlayers.some(isWooriming);
        const pInB = bPlayers.includes(name);

        const isSame = (wInA && pInA) || (wInB && pInB);
        const isOpp = (wInA && pInB) || (wInB && pInA);

        if (isSame) {
          sameGames++;
          const wTeam = wInA ? 'Red' : 'Blue';
          if (m.winning_team === wTeam) sameWins++;
        }
        if (isOpp) {
          oppGames++;
          const wTeam = wInA ? 'Red' : 'Blue';
          if (m.winning_team === wTeam) oppWins++;
        }
      }

      return {
        name,
        same: {
          games: sameGames,
          wins: sameWins,
          winrate: sameGames ? (sameWins / sameGames) * 100 : 0,
        },
        opp: {
          games: oppGames,
          wins: oppWins,
          winrate: oppGames ? (oppWins / oppGames) * 100 : 0,
        },
      };
    });
  }, [searchQuery, allStreamers, matches]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#08080c]/85 border-b border-[#1e1e2a]">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 h-[56px] flex items-center justify-between gap-3">
        {/* Logo & Desktop Nav */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onTabChange('main')}
            className="text-[15px] tracking-[0.18em] text-[#8a8a9a] hover:text-white font-bold cursor-pointer transition-colors"
          >
            RIMING.GG
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-[#12121a] rounded-full p-1 border border-[#1e1e2a]">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onTabChange(item.key);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  onToast(`${item.label} 탭`);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition ${
                  currentTab === item.key
                    ? 'bg-[#8b5cf6] text-white shadow'
                    : 'text-[#9a9ab0] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Mobile nav pills */}
          <div className="flex md:hidden items-center gap-1 mr-1 bg-[#12121a] rounded-full p-1 border border-[#1e1e2a] overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onTabChange(item.key);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap ${
                  currentTab === item.key ? 'bg-[#8b5cf6] text-white' : 'text-[#9a9ab0]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative">
            <div className="relative flex items-center">
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onBlur={() => setTimeout(() => setIsSearchOpen(false), 250)}
                placeholder="스트리머 검색"
                className="w-[120px] md:w-[170px] h-[34px] bg-[#12121a] border border-[#1e1e2a] rounded-full pl-8 pr-3 text-[12px] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50 transition-all"
              />
              <Search size={14} className="absolute left-3 text-[#6a6a80] pointer-events-none" />
            </div>

            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute top-[42px] right-0 md:left-0 md:right-auto w-[290px] bg-[#12121a] border border-[#1e1e2a] rounded-[16px] shadow-2xl p-2 z-50 animate-[fadeIn_0.2s]">
                {searchResults.map((item) => (
                  <div key={item.name} className="p-2.5 rounded-[12px] hover:bg-[#1a1a26] transition">
                    <div className="font-semibold text-[13px] mb-1.5 text-white">{item.name}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#08080c] rounded-[10px] p-2 border border-[#1e1e2a]">
                        <div className="text-[10px] text-[#8a8aa0]">같은 팀</div>
                        <div className="text-[11px] mt-0.5 font-medium">
                          {item.same.games}판 {item.same.wins}승
                        </div>
                        <div className="text-[12px] font-bold text-[#8b5cf6]">
                          {item.same.games ? item.same.winrate.toFixed(0) : 0}%
                        </div>
                      </div>
                      <div className="bg-[#08080c] rounded-[10px] p-2 border border-[#1e1e2a]">
                        <div className="text-[10px] text-[#8a8aa0]">상대 팀</div>
                        <div className="text-[11px] mt-0.5 font-medium">
                          {item.opp.games}판 우리밍_ {item.opp.wins}승
                        </div>
                        <div className="text-[12px] font-bold text-[#a0a0b8]">
                          {item.opp.games ? item.opp.winrate.toFixed(0) : 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BGM Player Bar */}
          <div
            className={`flex items-center gap-1.5 border rounded-full pl-2.5 pr-2 h-[34px] shrink-0 transition-all ${
              isBgmPlaying
                ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/50 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
                : 'bg-[#12121a] border-[#1e1e2a] hover:border-[#2a2a3e]'
            }`}
            title={currentTrack ? `현재 곡: ${currentTrack.title} - ${currentTrack.artist}` : 'BGM 플레이어'}
          >
            <button
              type="button"
              onClick={onToggleBgm}
              className="flex items-center gap-1.5 hover:opacity-90 group transition"
              title={isBgmPlaying ? 'BGM 일시정지' : 'BGM 재생'}
            >
              <div
                className={`w-[7px] h-[7px] rounded-full transition-all ${
                  isBgmPlaying && !isMuted ? 'bg-[#10b981] animate-pulse shadow-[0_0_6px_#10b981]' : 'bg-[#4a4a5a]'
                }`}
              />
              <span className="text-[11px] font-bold text-[#c4b5fd] select-none">BGM</span>
              <div className="w-[22px] h-[22px] flex items-center justify-center rounded-full bg-[#1e1e2c] group-hover:bg-[#2a2a3e] text-[#e0e0f0]">
                {isBgmPlaying ? <Pause size={11} /> : <Play size={11} className="ml-0.5" />}
              </div>
            </button>

            {onNextBgm && (
              <button
                type="button"
                onClick={onNextBgm}
                className="w-[22px] h-[22px] flex items-center justify-center rounded-full hover:bg-[#1e1e2c] text-[#a0a0b8] hover:text-[#c4b5fd] transition"
                title="다음 곡 (무작위 셔플 큐)"
              >
                <SkipForward size={11} />
              </button>
            )}

            {currentTrack && isBgmPlaying && (
              <div className="hidden xl:flex items-center max-w-[110px] truncate text-[10px] text-[#a78bfa] font-medium px-0.5 select-none">
                <span className="truncate">{currentTrack.title}</span>
              </div>
            )}

            <div className="w-[1px] h-[14px] bg-[#222234] mx-0.5" />

            <button
              type="button"
              onClick={onToggleMute}
              className="w-[22px] h-[22px] flex items-center justify-center rounded-full hover:bg-[#1e1e2c] text-[#a0a0b8] hover:text-white transition"
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {isMuted ? <VolumeX size={12} className="text-[#ef4444]" /> : <Volume2 size={12} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={bgmVolume}
              onChange={(e) => onChangeVolume(Number(e.target.value))}
              className="w-[36px] md:w-[48px] h-[3px] accent-[#8b5cf6] cursor-pointer"
              title={`볼륨: ${bgmVolume}%`}
            />
          </div>

          {/* Admin Mode Button */}
          {isAdmin ? (
            <button
              type="button"
              onClick={onLogoutClick}
              className="h-[34px] px-3 rounded-full text-[11px] bg-[#1e1e2a] border border-[#2a2a3a] text-[#8a8aa0] hover:text-white flex items-center gap-1 transition"
            >
              <Lock size={12} />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onLoginClick}
              className="h-[34px] px-3 rounded-full text-[11px] bg-[#12121a] border border-[#8b5cf6]/30 text-[#a78bfa] hover:bg-[#8b5cf6]/10 flex items-center gap-1 transition"
            >
              <Unlock size={12} />
              <span className="hidden sm:inline">관리자</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
