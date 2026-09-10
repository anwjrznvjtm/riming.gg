import React, { useState, useRef, useEffect, useMemo } from 'react';
import { searchChampions, getChosung } from '../lib/championSearch';

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  sourceList: string[];
  type?: 'champion' | 'streamer';
  disabled?: boolean;
  autoFocus?: boolean;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  sourceList,
  type = 'champion',
  disabled = false,
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!value || !value.trim()) return [];
    if (type === 'champion') {
      return searchChampions(value, sourceList);
    }
    // Streamer search
    const cleanVal = value.trim().toLowerCase();
    const queryChosung = getChosung(cleanVal);
    return sourceList
      .filter((name) => {
        const cleanName = name.toLowerCase();
        if (cleanName.includes(cleanVal)) return true;
        const nameChosung = getChosung(cleanName);
        if (nameChosung.includes(queryChosung)) return true;
        return false;
      })
      .slice(0, 8);
  }, [value, sourceList, type]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [suggestions]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (selectedVal: string) => {
    onChange(selectedVal);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (suggestions[highlightIndex]) {
        e.preventDefault();
        handleSelect(suggestions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (value.trim() && suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        className={className}
        autoComplete="off"
        spellCheck="false"
      />

      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1.5 w-max min-w-full max-w-[220px] bg-[#12121a] border border-[#2a2a3a] rounded-[10px] shadow-2xl py-1 z-[100] max-h-[220px] overflow-y-auto">
          {suggestions.map((item, idx) => {
            const isHighlighted = idx === highlightIndex;
            return (
              <button
                key={item}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur
                  handleSelect(item);
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-medium flex items-center justify-between transition-colors ${
                  isHighlighted
                    ? 'bg-[#8b5cf6] text-white'
                    : 'text-[#e0e0f0] hover:bg-[#1e1e2a]'
                }`}
              >
                <span>{item}</span>
                {type === 'champion' && (
                  <span
                    className={`text-[9px] ${
                      isHighlighted ? 'text-white/80' : 'text-[#8a8aa0]'
                    }`}
                  >
                    챔피언
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
