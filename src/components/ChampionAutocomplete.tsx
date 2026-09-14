import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchChampions, SearchResult } from '../lib/fuzzySearch';
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

export const ChampionAutocomplete: React.FC<Props> = ({
  value,
  onSelect,
  onChange,
  placeholder = "챔피언",
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
          className="w-full h-[32px] bg-[#12121a] border border-[#1e1e2a] rounded-full px-3 text-[11px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#8b5cf6]/50 transition"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); onChange?.(''); setIsOpen(false); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded-full bg-[#1e1e2a] text-[#6a6a80] hover:text-white text-[10px]"
          >
            X
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-[#12121a] border border-[#1e1e2a] rounded-[12px] shadow-xl overflow-hidden max-h-[260px] overflow-y-auto">
          {results.map((champ, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={`${champ.id}-${idx}`}
                onClick={() => handleSelect(champ)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#1e1e2a] transition ${
                  isSelected ? 'bg-[#1e1e2a]' : ''
                }`}
              >
                <ChampionIcon name={champ.kr} size={22} shape="circle" />
                <span className="text-[12px] text-white truncate">{champ.kr}</span>
                <span className="text-[10px] text-[#5a5a70] ml-auto">{champ.en}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
