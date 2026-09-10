import React, { useState, useRef, useMemo, useEffect } from 'react';

const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

/**
 * Extracts Korean initial consonants (초성) from a string.
 */
export function getChosung(text: string): string {
  return text
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0) - 44032;
      if (code >= 0 && code <= 11171) {
        return CHOSUNG_LIST[Math.floor(code / 588)];
      }
      return char;
    })
    .join('');
}

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  onSelect?: (val: string) => void;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className,
  wrapperClassName = 'inline-block',
  onSelect,
  autoFocus,
  onKeyDown,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute matched options
  const filteredOptions = useMemo(() => {
    const raw = (value || '').trim().toLowerCase();
    if (!raw) return [];

    const cleanRaw = raw.replace(/\s+/g, '');
    const isOnlyChosung = /^[ㄱ-ㅎ]+$/.test(cleanRaw);

    const prefixMatches: string[] = [];
    const substringMatches: string[] = [];
    const chosungMatches: string[] = [];

    for (const opt of options) {
      if (!opt) continue;
      const optLower = opt.toLowerCase();
      const cleanOpt = optLower.replace(/\s+/g, '');

      // If exact full match, omit from suggestions to avoid covering input
      if (optLower === raw || cleanOpt === cleanRaw) {
        continue;
      }

      if (optLower.startsWith(raw) || cleanOpt.startsWith(cleanRaw)) {
        prefixMatches.push(opt);
      } else if (optLower.includes(raw) || cleanOpt.includes(cleanRaw)) {
        substringMatches.push(opt);
      } else if (isOnlyChosung) {
        const chosung = getChosung(cleanOpt);
        if (chosung.includes(cleanRaw)) {
          chosungMatches.push(opt);
        }
      }
    }

    // Sort prefixes naturally
    prefixMatches.sort((a, b) => a.localeCompare(b, 'ko'));
    substringMatches.sort((a, b) => a.localeCompare(b, 'ko'));
    chosungMatches.sort((a, b) => a.localeCompare(b, 'ko'));

    return [...prefixMatches, ...substringMatches, ...chosungMatches].slice(0, 15);
  }, [value, options]);

  const selectItem = (item: string) => {
    onChange(item);
    if (onSelect) onSelect(item);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) onKeyDown(e);

    if (isOpen && filteredOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const chosen = selectedIndex >= 0 ? filteredOptions[selectedIndex] : filteredOptions[0];
        if (chosen) {
          e.preventDefault();
          selectItem(chosen);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${wrapperClassName}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setSelectedIndex(-1);
        }}
        onFocus={() => {
          if (value.trim().length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck="false"
      />

      {isOpen && filteredOptions.length > 0 && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] min-w-[140px] w-full max-h-[190px] overflow-y-auto bg-[#161622] border border-[#2e2e42] rounded-[12px] shadow-2xl z-[80] py-1 text-[11px] scrollbar-thin"
          style={{
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)',
          }}
        >
          {filteredOptions.map((opt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={opt}
                onMouseDown={(e) => {
                  e.preventDefault(); // Keep input focused until item selected
                  selectItem(opt);
                }}
                className={`px-3 py-1.5 cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-[#8b5cf6] text-white font-bold'
                    : 'text-[#d0d0e0] hover:bg-[#222234] hover:text-white'
                }`}
              >
                <span className="truncate">{opt}</span>
                {idx === 0 && !isSelected && (
                  <span className="text-[9px] text-[#8a8aa0] bg-[#222232] px-1.5 py-0.5 rounded font-mono ml-2 shrink-0">
                    ↵ 완결
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
