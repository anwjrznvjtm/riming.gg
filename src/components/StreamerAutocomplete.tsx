import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchStreamers, getChosung, Streamer } from '../lib/fuzzySearch';

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
 * CLEAN 버전 - 돋보기, 초성 힌트 텍스트 전부 제거
 * 기능은 그대로 초성 ㅇㄹㅁ_ -> 우리밍_ 작동, 화면은 깔끔하게
 */
export const StreamerAutocomplete: React.FC<Props> = ({
  value,
  allStreamers,
  onSelect,
  onChange,
  placeholder = "플레이어",
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setQuery(v); onChange?.(v);
  };
  const handleSelect = (name: string) => {
    setQuery(name); setIsOpen(false); onSelect(name); onChange?.(name);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[selectedIndex]) handleSelect(results[selectedIndex].nickname); }
    else if (e.key === 'Escape') setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          ref={inputRef} type="text" value={query} onChange={handleInputChange} onKeyDown={handleKeyDown}
          onFocus={() => query && results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full h-[32px] bg-[#12121a] border border-[#1e1e2a] rounded-full px-3 text-[11px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#8b5cf6]/50 transition"
        />
        {query && <button onClick={() => { setQuery(''); onChange?.(''); setIsOpen(false); inputRef.current?.focus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded-full bg-[#1e1e2a] text-[#6a6a80] hover:text-white text-[10px]">✕</button>}
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-[#12121a] border border-[#1e1e2a] rounded-[12px] shadow-xl overflow-hidden max-h-[240px] overflow-y-auto">
          {results.map((s, idx) => (
            <button key={s.id} onClick={() => handleSelect(s.nickname)} onMouseEnter={() => setSelectedIndex(idx)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#1e1e2a] transition ${idx === selectedIndex ? 'bg-[#1e1e2a]' : ''}`}>
              <div className="w-6 h-6 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] grid place-items-center text-[10px] font-bold text-[#c2c6d6]">{s.nickname.slice(0,1)}</div>
              <span className="text-[12px] text-white truncate">{s.nickname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
