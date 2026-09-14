import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchChampions, getChosung, SearchResult } from '../lib/fuzzySearch';
import { getChampionIconUrl } from '../lib/champions';
import { ChampionIcon } from './ChampionIcon';

interface Props {
  value: string;
  onSelect: (champion: SearchResult) => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  limit?: number;
  autoFocus?: boolean;
  className?: string;
}

/**
 * ChampionAutocomplete.tsx
 * 기존 riming-gg 프로젝트용 최종본
 * - 초성 검색: ㄱㄹ -> 가렌, ㄹㅋ -> 로크
 * - 오타 허용: 가랜 -> 가렌, 진크스 -> 징크스
 * - 영문 검색: ahri -> 아리
 * - 별칭 검색: 미포 -> 미스 포츈, 블츠 -> 블리츠크랭크
 * - 기존 다크테마 (#12121a) 유지
 */
export const ChampionAutocomplete: React.FC<Props> = ({
  value,
  onSelect,
  onChange,
  placeholder = "챔피언 이름, 초성, 영문으로 검색 (예: ㄱㄹ, 로크, ahri)",
  limit = 8,
  autoFocus = false,
  className = "",
}) => {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchChampions(query, limit);
  }, [query, limit]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    setSelectedIndex(0);
    if (query.trim() && results.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [query, results.length]);

  // 외부 클릭 시 닫기
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

  const handleSelect = (champ: SearchResult) => {
    setQuery(champ.kr);
    setIsOpen(false);
    onSelect(champ);
    onChange?.(champ.kr);
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
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // 검색어 하이라이트
  const highlightMatch = (text: string, q: string) => {
    if (!q) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = q.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) {
      return <span className="font-bold text-[#a78bfa]">{text}</span>;
    }
    return (
      <>
        {text.slice(0, idx)}
        <span className="bg-[#7c3aed]/30 text-[#a78bfa] font-bold">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
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
          autoFocus={autoFocus}
          className="w-full h-[42px] pl-10 pr-10 bg-[#08080c] border border-[#1e1e2a] rounded-full text-[13px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] transition"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a70] text-[14px]">🔍</span>
        {query && (
          <button
            onClick={() => { setQuery(''); onChange?.(''); setIsOpen(false); inputRef.current?.focus(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full bg-[#1e1e2a] text-[#8a8aa0] hover:text-white text-[11px] transition"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-[#12121a] border border-[#1e1e2a] rounded-[16px] shadow-2xl overflow-hidden max-h-[360px] overflow-y-auto">
          <div className="px-4 py-2.5 text-[11px] text-[#5a5a70] border-b border-[#1e1e2a] flex justify-between items-center bg-[#08080c]">
            <span>{results.length}개 찾음 • 초성/오타 허용</span>
            <span className="text-[#7c3aed] font-mono text-[10px]">{query} → {getChosung(query)}</span>
          </div>
          {results.map((champ, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={`${champ.id}-${idx}`}
                onClick={() => handleSelect(champ)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1e1e2a] transition ${
                  isSelected ? 'bg-[#1e1e2a] border-l-2 border-[#7c3aed]' : 'border-l-2 border-transparent'
                }`}
              >
                <ChampionIcon name={champ.kr} size={32} shape="circle" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-white truncate">
                      {highlightMatch(champ.kr, query)}
                    </span>
                    <span className="text-[11px] text-[#5a5a70]">{champ.en}</span>
                    {champ.matchedOn === 'fuzzy' && (
                      <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full border border-yellow-500/30">오타 교정</span>
                    )}
                    {champ.matchedOn.includes('chosung') && (
                      <span className="text-[9px] bg-[#7c3aed]/20 text-[#a78bfa] px-1.5 py-0.5 rounded-full border border-[#7c3aed]/30">초성</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-[#5a5a70]">초성: {champ.chosung}</span>
                    {champ.krAliases.length > 0 && (
                      <span className="text-[10px] text-[#3a3a4e] truncate">• 별칭: {champ.krAliases.slice(0,2).join(', ')}</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-[#2a2a3a] font-mono">#{champ.score}</span>
              </button>
            );
          })}
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute z-50 mt-2 w-full bg-[#12121a] border border-[#1e1e2a] rounded-[16px] p-4 text-center">
          <p className="text-[13px] text-[#8a8aa0]">"{query}" 검색 결과 없음</p>
          <p className="text-[11px] text-[#5a5a70] mt-1.5">초성(ㄱㄴ)이나 영문(ahri)으로도 검색해보세요</p>
          <div className="mt-3 flex gap-1.5 justify-center flex-wrap">
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[#5a5a70]">ㄱㄹ → 가렌</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[#5a5a70]">ㅇㅇ → 아리</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#1e1e2a] border border-[#2a2a3a] text-[#5a5a70]">ahri</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 사용 예시:
 * 
 * import { ChampionAutocomplete } from './components/ChampionAutocomplete';
 * 
 * <ChampionAutocomplete
 *   value={championName}
 *   onSelect={(champ) => setChampionName(champ.kr)}
 *   placeholder="ㄱㄹ, 로크, ahri 검색"
 * />
 */
