import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchChampions, getChosung, SearchResult } from '../lib/fuzzySearch';
import { getChampionIconUrl } from '../lib/champions';

interface Props {
  value: string;
  onSelect: (champion: SearchResult) => void;
  onChange?: (value: string) => void;
  placeholder?: string;
  limit?: number;
  autoFocus?: boolean;
}

/**
 * 챔피언 자동완성 컴포넌트
 * - 초성 검색: ㄱㄹ -> 가렌, ㄹㅋ -> 로크
 * - 오타 허용: 가랜 -> 가렌, 아리 -> 아리 (ㅇㅏㄹㅣ 오타도)
 * - 드롭다운 추천
 */
export const ChampionAutocomplete: React.FC<Props> = ({
  value,
  onSelect,
  onChange,
  placeholder = "챔피언 이름, 초성, 영문으로 검색 (예: ㄱㄹ, 로크, ahri)",
  limit = 8,
  autoFocus = false,
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
    if (!isOpen) return;
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

  // 하이라이트 (검색어 부분 강조)
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) {
      // 초성 검색이면 전체 강조
      return <span className="font-bold text-[#7c3aed]">{text}</span>;
    }
    return (
      <>
        {text.slice(0, idx)}
        <span className="bg-[#7c3aed]/30 text-[#a78bfa] font-bold">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[400px]">
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
          className="w-full h-11 pl-10 pr-4 bg-[#1e1e2e] border border-[#3a3a4e] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] transition"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        {query && (
          <button
            onClick={() => { setQuery(''); onChange?.(''); setIsOpen(false); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-[#1e1e2e] border border-[#3a3a4e] rounded-lg shadow-2xl overflow-hidden max-h-[360px] overflow-y-auto">
          <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-[#2a2a3e] flex justify-between">
            <span>{results.length}개 찾음 • 초성/오타 허용</span>
            <span className="text-[#7c3aed]">{query} → {getChosung(query)}</span>
          </div>
          {results.map((champ, idx) => {
            const iconUrl = getChampionIconUrl(champ.kr);
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={champ.id}
                onClick={() => handleSelect(champ)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#2a2a3e] transition ${
                  isSelected ? 'bg-[#2a2a3e] border-l-2 border-[#7c3aed]' : 'border-l-2 border-transparent'
                }`}
              >
                {iconUrl ? (
                  <img src={iconUrl} alt={champ.kr} className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#2a2a3e] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {champ.kr.slice(0,2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">
                      {highlightMatch(champ.kr, query)}
                    </span>
                    <span className="text-[11px] text-gray-500">{champ.en}</span>
                    {champ.matchedOn === 'fuzzy' && (
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">오타 교정</span>
                    )}
                    {champ.matchedOn.includes('chosung') && (
                      <span className="text-[10px] bg-[#7c3aed]/20 text-[#a78bfa] px-1.5 py-0.5 rounded">초성</span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    <span className="text-[11px] text-gray-500">초성: {champ.chosung}</span>
                    {champ.krAliases.length > 0 && (
                      <span className="text-[11px] text-gray-600 truncate">• 별칭: {champ.krAliases.join(', ')}</span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-gray-600">#{champ.score}</span>
              </button>
            );
          })}
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute z-50 mt-2 w-full bg-[#1e1e2e] border border-[#3a3a4e] rounded-lg p-4 text-center">
          <p className="text-sm text-gray-400">"{query}" 검색 결과 없음</p>
          <p className="text-[11px] text-gray-600 mt-1">초성(ㄱㄴ)이나 영문(ahri)으로도 검색해보세요</p>
        </div>
      )}
    </div>
  );
};

/**
 * 스트리머 + 챔피언 통합 검색 예시
 */
export const IntegratedSearchAutocomplete: React.FC = () => {
  const [selected, setSelected] = useState<SearchResult | null>(null);
  
  return (
    <div className="p-4 bg-[#12121a] rounded-xl">
      <h3 className="text-white font-bold mb-3">챔피언 검색 (퍼지 + 초성)</h3>
      <ChampionAutocomplete
        value=""
        onSelect={setSelected}
        placeholder="ㄱㄹ, ㄹㅋ, 가랜(오타), ahri 등 입력"
      />
      {selected && (
        <div className="mt-4 p-3 bg-[#1e1e2e] rounded-lg border border-[#7c3aed]/30">
          <p className="text-white">선택됨: <span className="font-bold text-[#a78bfa]">{selected.kr}</span> ({selected.en})</p>
          <p className="text-xs text-gray-500 mt-1">매칭 방식: {selected.matchedOn}, 점수: {selected.score}, 초성: {selected.chosung}</p>
        </div>
      )}
      
      <div className="mt-6 text-[12px] text-gray-500 space-y-1">
        <p>• 초성 검색: ㅇㅇ → 아리, 아트록스 / ㄱㄹ → 가렌 / ㄹㅋ → 로크</p>
        <p>• 오타 허용: 가랜 → 가렌, 아리 → 아리, 진크스 → 징크스</p>
        <p>• 영문 검색: ahri, yasuo, locke</p>
        <p>• 별칭 검색: 미포 → 미스 포츈, 문도 → 문도 박사, 록 → 로크</p>
      </div>
    </div>
  );
};
