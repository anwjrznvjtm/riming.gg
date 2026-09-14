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
 * StreamerAutocomplete - 프로필 사진 없는 초경량 버전
 * soopProfiles.ts 필요 없음!
 * CK일지 기준 + 초성 ㅇㄹㅁ_ → 우리밍_ 완벽 지원
 */
export const StreamerAutocomplete: React.FC<Props> = ({
  value,
  allStreamers,
  onSelect,
  onChange,
  placeholder = "ㅇㄹㅁ_, ㅅㅇㄴ 초성 검색",
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
          className="w-full h-[36px] pl-8 pr-8 bg-[#08080c] border border-[#1e1e2a] rounded-full text-white text-[12px] placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] transition"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a70] text-[12px]">🔍</span>
        {query && <button onClick={() => { setQuery(''); onChange?.(''); setIsOpen(false); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded-full bg-[#1e1e2a] text-[#6a6a80] hover:text-white text-[10px]">✕</button>}
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full bg-[#12121a] border border-[#1e1e2a] rounded-[14px] shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto">
          <div className="px-3.5 py-2 text-[10px] text-[#5a5a70] border-b border-[#1e1e2a] flex justify-between bg-[#08080c]"><span>{results.length}명 • CK일지 • 초성 OK</span><span className="text-[#7c3aed] font-mono">{getChosung(query)}</span></div>
          {results.map((s, idx) => (
            <button key={s.id} onClick={() => handleSelect(s.nickname)} onMouseEnter={() => setSelectedIndex(idx)} className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[#1e1e2a] transition ${idx === selectedIndex ? 'bg-[#1e1e2a] border-l-2 border-[#7c3aed]' : 'border-l-2 border-transparent'}`}>
              <div className="w-7 h-7 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] grid place-items-center text-[11px] font-bold text-[#a78bfa]">{s.nickname.slice(0,1)}</div>
              <div className="flex-1 min-w-0"><div className="text-[12px] font-bold text-white truncate">{s.nickname}</div><div className="text-[10px] text-[#5a5a70]">초성: {s.chosung}</div></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
