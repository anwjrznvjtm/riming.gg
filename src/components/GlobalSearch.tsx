import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Match, LineKey, LINE_KEYS } from '../types';
import { getChosung, isChosungQuery, searchStreamers, Streamer, searchChampions } from '../lib/fuzzySearch';

interface Props {
  matches: Match[];
  allStreamers: string[];
  onJumpToMatch?: (matchId: string) => void;
  onToast?: (msg: string) => void;
}

export const GlobalSearch: React.FC<Props> = ({ matches, allStreamers, onJumpToMatch, onToast }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const streamerList: Streamer[] = useMemo(() => 
    allStreamers.map(s => ({ id: s, nickname: s, nicknameLower: s.toLowerCase(), chosung: getChosung(s) })),
    [allStreamers]
  );

  const results = useMemo(() => {
    if (!query.trim()) return { streamers: [], champs: [], matches: [] };
    const q = query.trim();
    const qLower = q.toLowerCase();
    const qChosung = getChosung(q);
    const isChosungOnly = isChosungQuery(q);

    const streamers = searchStreamers(q, streamerList, 5);
    const champs = searchChampions(q, 5);

    const matchedMatches = matches.filter(m => {
      const ckName = (m.ck_name || '').toLowerCase();
      const ckChosung = getChosung(m.ck_name || '');
      if (isChosungOnly) {
        if (ckChosung.includes(q)) return true;
      } else {
        if (ckName.includes(qLower) || ckChosung.includes(qChosung)) return true;
      }
      for (const k of LINE_KEYS as LineKey[]) {
        const a = (m.team_a?.[k] || '').toLowerCase();
        const b = (m.team_b?.[k] || '').toLowerCase();
        if (a.includes(qLower) || b.includes(qLower)) return true;
        if (getChosung(m.team_a?.[k] || '').includes(qChosung) || getChosung(m.team_b?.[k] || '').includes(qChosung)) return true;
      }
      return false;
    }).slice(0, 5);

    return { streamers, champs, matches: matchedMatches };
  }, [query, streamerList, matches]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalCount = results.streamers.length + results.champs.length + results.matches.length;

  return (
    <div ref={containerRef} className="relative w-full max-w-[320px]">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => query && setIsOpen(true)}
          placeholder="검색"
          className="w-full h-[36px] bg-[#12121a] border border-[#2a2a3a] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed] transition"
        />
        {query && (
          <button onClick={() => { setQuery(''); setIsOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#1e1e2a] grid place-items-center text-[#6a6a80] text-[10px]">X</button>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute z-50 mt-2 w-full bg-[#12121a] border border-[#1e1e2a] rounded-[16px] shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto">
          {results.streamers.length > 0 && (
            <div className="p-2">
              <div className="text-[10px] text-[#8a8aa0] px-2 py-1 font-bold">스트리머</div>
              {results.streamers.map(s => (
                <button key={s.id} onClick={() => { setIsOpen(false); onToast?.(`${s.nickname}`); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1e1e2a] text-left">
                  <div className="w-6 h-6 rounded-full bg-[#1e1e2a] grid place-items-center text-[10px] font-bold text-[#a78bfa]">{s.nickname.slice(0,1)}</div>
                  <span className="text-[12px] text-white font-bold">{s.nickname}</span>
                </button>
              ))}
            </div>
          )}

          {results.champs.length > 0 && (
            <div className="p-2 border-t border-[#1e1e2a]">
              <div className="text-[10px] text-[#8a8aa0] px-2 py-1 font-bold">챔피언</div>
              {results.champs.map(c => (
                <button key={c.id} onClick={() => { setIsOpen(false); onToast?.(`${c.kr}`); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1e1e2a] text-left">
                  <span className="text-[12px] text-white font-bold">{c.kr}</span>
                  <span className="text-[10px] text-[#5a5a70]">{c.en}</span>
                </button>
              ))}
            </div>
          )}

          {results.matches.length > 0 && (
            <div className="p-2 border-t border-[#1e1e2a]">
              <div className="text-[10px] text-[#8a8aa0] px-2 py-1 font-bold">CK 일지</div>
              {results.matches.map(m => (
                <button key={m.id} onClick={() => { setIsOpen(false); onJumpToMatch?.(m.id); }} className="w-full flex flex-col gap-0.5 px-3 py-2 rounded-lg hover:bg-[#1e1e2a] text-left">
                  <span className="text-[12px] text-white font-bold truncate">{m.ck_name} {m.set_number}세트</span>
                  <span className="text-[10px] text-[#8a8aa0]">{m.date}</span>
                </button>
              ))}
            </div>
          )}

          {totalCount === 0 && (
            <div className="p-6 text-center">
              <div className="text-[12px] text-[#8a8aa0]">결과 없음</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
