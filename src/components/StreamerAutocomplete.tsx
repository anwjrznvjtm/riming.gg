import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchStreamers, getChosung, Streamer } from '../lib/fuzzySearch';
import { StreamerAvatar } from './StreamerAvatar';

interface Props {
  value: string;
  allStreamers: string[];
  onSelect: (name: string) => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  limit?: number;
  className?: string;
}

/**
 * StreamerAutocomplete.tsx
 * 기존 riming-gg 프로젝트용 최종본
 * - 초성 검색: ㅅㅇㄴ -> 상이너, ㅇㅁ_ -> 우리밍_, ㄱㅌ -> 꿀탱죽었다
 * - 오타 허용: 우리밍 -> 우리밍_, 꿀탱 -> 꿀탱죽었다
 * - 기존 다크테마 (#08080c) 유지
 * - MainTab에서 Red/Blue 팀 채울 때 사용
 */
export const StreamerAutocomplete: React.FC<Props> = ({
  value,
  allStreamers,
  onSelect,
  onChange,
  placeholder = "닉네임, 초성으로 검색 (예: ㅅㅇㄴ, ㅇㅁ_, ㄱㅌ)",
  limit = 8,
  className = "",
}) => {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const streamerList: Streamer[] = useMemo(() => 
    allStreamers.map(s => ({
      id: s,
      nickname: s,
      nicknameLower: s.toLowerCase(),
      chosung: getChosung(s),
    })), [allStreamers]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchStreamers(query, streamerList, limit);
  }, [query, limit, streamerList]);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    setSelectedIndex(0);
    if (query.trim() && results.length > 0) setIsOpen(true);
    else if (!query.trim()) setIsOpen(false);
  }, [query, results.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange?.(v);
  };

  const handleSelect = (name: string) => {
    setQuery(name);
    setIsOpen(false);
    onSelect(name);
    onChange?.(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) handleSelect(results[selectedIndex].nickname);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full h-[38px] pl-8 pr-8 bg-[#08080c] border border-[#1e1e2a] rounded-full text-white text-[12px] placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] transition"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a70] text-[12px]">🔍</span>
        {query && (
          <button
            onClick={() => { setQuery(''); onChange?.(''); setIsOpen(false); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded-full bg-[#1e1e2a] text-[#6a6a80] hover:text-white text-[10px]"
          >✕</button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full bg-[#12121a] border border-[#1e1e2a] rounded-[14px] shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto">
          <div className="px-3.5 py-2 text-[10px] text-[#5a5a70] border-b border-[#1e1e2a] flex justify-between bg-[#08080c]">
            <span>{results.length}명 찾음 • 초성/오타 허용</span>
            <span className="text-[#7c3aed] font-mono">{getChosung(query)}</span>
          </div>
          {results.map((s, idx) => {
            const isSelected = idx === selectedIndex;
            const isExact = s.nicknameLower === query.toLowerCase();
            return (
              <button
                key={s.id}
                onClick={() => handleSelect(s.nickname)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[#1e1e2a] transition ${
                  isSelected ? 'bg-[#1e1e2a] border-l-2 border-[#7c3aed]' : 'border-l-2 border-transparent'
                }`}
              >
                <StreamerAvatar name={s.nickname} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[12px] font-bold truncate ${isExact ? 'text-[#a78bfa]' : 'text-white'}`}>
                      {s.nickname}
                    </span>
                    {isExact && <span className="text-[9px] bg-[#7c3aed]/30 text-[#a78bfa] px-1 py-0.5 rounded-full">완전일치</span>}
                  </div>
                  <div className="text-[10px] text-[#5a5a70]">초성: {s.chosung} • {s.score <= 10 ? '앞부분 일치' : s.score <= 25 ? '초성 일치' : '포함'}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute z-50 mt-1.5 w-full bg-[#12121a] border border-[#1e1e2a] rounded-[14px] p-3 text-center">
          <p className="text-[12px] text-[#8a8aa0]">"{query}" 없음</p>
          <p className="text-[10px] text-[#5a5a70] mt-1">초성(ㅅㅇㄴ, ㅇㅁ_)으로 검색해보세요</p>
        </div>
      )}
    </div>
  );
};

/**
 * MainTab에서 사용법:
 * 
 * import { StreamerAutocomplete } from './StreamerAutocomplete';
 * 
 * // Red팀 top 자리에
 * <StreamerAutocomplete
 *   value={redTeam.top}
 *   allStreamers={allStreamers}
 *   onSelect={(name) => setRedTeam({...redTeam, top: name})}
 *   placeholder="ㅅㅇㄴ 검색"
 * />
 */
