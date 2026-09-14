import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Match, LineKey, LINE_KEYS, LINE_LABELS } from '../types';
import { searchStreamersDetailed } from '../lib/championSearch';
import { StreamerAvatar } from './StreamerAvatar';
import { getWoorimingTeam } from '../lib/stats';
import { Search, X, Zap, ChevronRight, Swords, Users } from 'lucide-react';

interface StreamerSearchBarProps {
  allStreamers: string[];
  matches: Match[];
  onSelectStreamer: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
  className?: string;
  placeholder?: string;
}

export interface StreamerQuickStat {
  name: string;
  totalGames: number;
  mainLane: LineKey;
  vsGames: number;
  vsWins: number;
  vsLosses: number;
  vsWinrate: number;
  withGames: number;
  withWins: number;
  withLosses: number;
  withWinrate: number;
}

export const StreamerSearchBar: React.FC<StreamerSearchBarProps> = ({
  allStreamers,
  matches,
  onSelectStreamer,
  className = '',
  placeholder = '스트리머 검색 (예: 린다랑, 서리, 김민교)',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Precompute streamer match stats
  const streamerStatsMap = useMemo(() => {
    const map = new Map<string, StreamerQuickStat>();

    for (const name of allStreamers) {
      const cleanName = name.trim();
      const laneCounts: Record<LineKey, number> = { top: 0, jgl: 0, mid: 0, adc: 0, sup: 0 };
      let totalGames = 0;
      let vsGames = 0;
      let vsWins = 0;
      let vsLosses = 0;
      let withGames = 0;
      let withWins = 0;
      let withLosses = 0;

      for (const m of matches) {
        const wTeam = getWoorimingTeam(m);
        const redRoster = m.team_a || {};
        const blueRoster = m.team_b || {};
        const winningTeam = m.winning_team;

        let playerTeam: 'Red' | 'Blue' | null = null;
        let playerLane: LineKey | null = null;

        for (const k of LINE_KEYS) {
          if ((redRoster[k] || '').trim() === cleanName) {
            playerTeam = 'Red';
            playerLane = k;
            break;
          }
          if ((blueRoster[k] || '').trim() === cleanName) {
            playerTeam = 'Blue';
            playerLane = k;
            break;
          }
        }

        if (playerTeam && playerLane) {
          totalGames++;
          laneCounts[playerLane]++;

          const allyWon = winningTeam === wTeam;
          if (wTeam) {
            if (playerTeam === wTeam) {
              // Same team as Wooriming
              withGames++;
              if (allyWon) withWins++;
              else withLosses++;
            } else {
              // Opposite team to Wooriming
              vsGames++;
              if (!allyWon) vsWins++; // opponent won
              else vsLosses++; // opponent lost
            }
          }
        }
      }

      let bestLane: LineKey = 'mid';
      let maxLaneCount = -1;
      for (const k of LINE_KEYS) {
        if (laneCounts[k] > maxLaneCount) {
          maxLaneCount = laneCounts[k];
          bestLane = k;
        }
      }

      map.set(cleanName, {
        name: cleanName,
        totalGames,
        mainLane: bestLane,
        vsGames,
        vsWins,
        vsLosses,
        vsWinrate: vsGames ? Math.round((vsWins / vsGames) * 100) : 0,
        withGames,
        withWins,
        withLosses,
        withWinrate: withGames ? Math.round((withWins / withGames) * 100) : 0,
      });
    }

    return map;
  }, [allStreamers, matches]);

  // Compute search suggestions
  const suggestions = useMemo(() => {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      // Top active streamers when empty
      return allStreamers
        .filter((s) => s !== '우리밍_')
        .map((name) => ({
          name,
          stat: streamerStatsMap.get(name) || {
            name,
            totalGames: 0,
            mainLane: 'mid' as LineKey,
            vsGames: 0,
            vsWins: 0,
            vsLosses: 0,
            vsWinrate: 0,
            withGames: 0,
            withWins: 0,
            withLosses: 0,
            withWinrate: 0,
          },
        }))
        .sort((a, b) => b.stat.totalGames - a.stat.totalGames)
        .slice(0, 8);
    }

    const detailed = searchStreamersDetailed(cleanQuery, allStreamers);
    return detailed.map((d) => ({
      name: d.name,
      stat: streamerStatsMap.get(d.name) || {
        name: d.name,
        totalGames: 0,
        mainLane: 'mid' as LineKey,
        vsGames: 0,
        vsWins: 0,
        vsLosses: 0,
        vsWinrate: 0,
        withGames: 0,
        withWins: 0,
        withLosses: 0,
        withWinrate: 0,
      },
      matchType: d.matchType,
      aliasLabel: d.aliasLabel,
    }));
  }, [query, allStreamers, streamerStatsMap]);

  const handleSelect = (streamerName: string, teamRole: 'all' | 'ally' | 'enemy' = 'all') => {
    onSelectStreamer(streamerName, undefined, teamRole);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (suggestions.length > 0) {
        handleSelect(suggestions[0].name, 'all');
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-[34px] pl-8 pr-7 bg-[#12121a] hover:bg-[#161622] border border-[#2a2a3e] focus:border-[#8b5cf6] rounded-full text-[12px] text-white placeholder:text-[#6a6a82] focus:outline-none transition-all shadow-inner"
        />
        <Search
          size={14}
          className="absolute left-2.5 text-[#7a7a92] pointer-events-none transition-colors group-focus-within:text-[#8b5cf6]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 w-4 h-4 rounded-full bg-[#2a2a3e] hover:bg-[#3e3e56] text-[#c0c0d0] flex items-center justify-center text-[10px] transition"
            title="검색어 지우기"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 md:w-[320px] max-w-[92vw] bg-[#101018] border border-[#2c2c42] rounded-2xl shadow-2xl z-50 overflow-hidden animate-[fadeIn_0.15s]">
          <div className="px-3.5 py-2 bg-[#161624] border-b border-[#222234] flex items-center justify-between text-[11px]">
            <span className="font-bold text-[#c2c2d6] flex items-center gap-1.5">
              <Zap size={12} className="text-[#8b5cf6]" />
              <span>스트리머 전적 &amp; CK 일지 바로가기</span>
            </span>
            <span className="text-[10px] text-[#7a7a90]">
              {query ? `${suggestions.length}명 검색됨` : '주요 선수 목록'}
            </span>
          </div>

          <div className="max-h-[310px] overflow-y-auto divide-y divide-[#1c1c28]">
            {suggestions.length === 0 ? (
              <div className="p-4 text-center text-[12px] text-[#727288]">
                검색된 스트리머가 없습니다.
              </div>
            ) : (
              suggestions.map((item) => {
                const stat = item.stat;
                return (
                  <div
                    key={item.name}
                    className="p-2.5 hover:bg-[#1a1a2c] transition flex flex-col gap-2 group"
                  >
                    <div
                      className="flex items-center justify-between gap-2.5 cursor-pointer"
                      onClick={() => handleSelect(item.name, 'all')}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <StreamerAvatar name={item.name} size={32} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[13px] text-white group-hover:text-[#c4b5fd] transition truncate">
                              {item.name}
                            </span>
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-[#1e1e30] border border-[#2e2e46] text-[#a0a0b8] uppercase shrink-0">
                              {LINE_LABELS[stat.mainLane] || 'MID'}
                            </span>
                            {stat.totalGames > 0 && (
                              <span className="text-[10px] text-[#8e8ea2] shrink-0 font-medium">
                                총 {stat.totalGames}전
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-[#82829a] flex items-center gap-2 mt-0.5 truncate">
                            {stat.vsGames > 0 && (
                              <span className="flex items-center gap-1 text-[#f87171] font-medium">
                                <Swords size={11} />
                                <span>적팀 {stat.vsGames}전 ({stat.vsWins}승 {stat.vsLosses}패)</span>
                              </span>
                            )}
                            {stat.withGames > 0 && (
                              <span className="flex items-center gap-1 text-[#60a5fa] font-medium">
                                <Users size={11} />
                                <span>아군 {stat.withGames}전 ({stat.withWins}승 {stat.withLosses}패)</span>
                              </span>
                            )}
                            {stat.vsGames === 0 && stat.withGames === 0 && (
                              <span>참여 기록 보유</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(item.name, 'all');
                        }}
                        className="shrink-0 flex items-center gap-1 bg-[#8b5cf6]/10 hover:bg-[#8b5cf6] border border-[#8b5cf6]/30 hover:border-[#8b5cf6] text-[#c4b5fd] hover:text-white px-2 py-1 rounded-full text-[10px] font-bold transition"
                        title="전체 참여 경기 일지로 이동"
                      >
                        <span>전체 이동</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>

                    {/* 아군 / 적팀 구분 이동 퀵 버튼 */}
                    <div className="flex items-center gap-1.5 pl-10">
                      {stat.withGames > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(item.name, 'ally');
                          }}
                          className="px-2.5 py-0.5 rounded-full bg-[#3b82f6]/15 hover:bg-[#3b82f6] text-[#60a5fa] hover:text-white border border-[#3b82f6]/30 text-[10px] font-semibold flex items-center gap-1 transition shadow-sm"
                          title="같은 팀(아군)으로 함께한 경기만 필터링하여 일지 이동"
                        >
                          <Users size={10} />
                          <span>아군 경기만 ({stat.withGames})</span>
                        </button>
                      )}

                      {stat.vsGames > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(item.name, 'enemy');
                          }}
                          className="px-2.5 py-0.5 rounded-full bg-[#ef4444]/15 hover:bg-[#ef4444] text-[#f87171] hover:text-white border border-[#ef4444]/30 text-[10px] font-semibold flex items-center gap-1 transition shadow-sm"
                          title="상대팀(적팀)으로 맞붙은 경기만 필터링하여 일지 이동"
                        >
                          <Swords size={10} />
                          <span>적팀 경기만 ({stat.vsGames})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
