import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CHAMPION_KR_TO_EN, getChampionIconUrl } from '../lib/champions';

// --- 초성 검색 유틸 (fuzzySearch.ts 없이 이 파일 하나로 동작) ---
const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function getChosung(str: string): string {
  let r = '';
  for (const c of str) {
    const code = c.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      r += CHOSUNG[Math.floor((code - 0xAC00) / (21 * 28))];
    } else {
      r += c.toLowerCase();
    }
  }
  return r;
}

function levenshtein(a: string, b: string): number {
  const m = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+cost);
    }
  }
  return m[a.length][b.length];
}

// 챔피언 리스트 만들기 (173개 중복 제거)
function getList() {
  const map = new Map<string, string>();
  const list: { kr: string; en: string; chosung: string }[] = [];
  const seenEn = new Set<string>();
  for (const [kr, en] of Object.entries(CHAMPION_KR_TO_EN)) {
    if (seenEn.has(en)) continue;
    // 대표 이름만 (별칭 제외: 미포, 록 등)
    if (['미포','이즈','블츠','모데','문도','록','문도박사','미스포츈','마스터이','신짜오','트페','아우솔','자르반','블리츠','리신'].includes(kr)) continue;
    seenEn.add(en);
    list.push({ kr, en, chosung: getChosung(kr) });
  }
  return list.sort((a,b) => a.kr.localeCompare(b.kr, 'ko'));
}

interface Props {
  onSelect?: (kr: string, en: string) => void;
}

export default function ChampionAutocompleteSimple({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const championList = useMemo(() => getList(), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qCho = getChosung(q);
    const isChoOnly = [...q].every(ch => CHOSUNG.includes(ch));
    
    const scored = championList.map(c => {
      const krLow = c.kr.toLowerCase();
      const enLow = c.en.toLowerCase();
      let score = 999;
      
      if (krLow === q || enLow === q) score = 0;
      else if (krLow.startsWith(q) || enLow.startsWith(q)) score = 10;
      else if (isChoOnly && c.chosung.startsWith(q)) score = 15;
      else if (isChoOnly && c.chosung.includes(q)) score = 20;
      else if (c.chosung.includes(qCho) && qCho.length >= 2) score = 25;
      else if (krLow.includes(q) || enLow.includes(q)) score = 30;
      else {
        const d = Math.min(levenshtein(krLow, q), levenshtein(enLow, q));
        const allow = q.length <= 2 ? 1 : 2;
        if (d <= allow) score = 50 + d*10;
      }
      return { ...c, score };
    }).filter(x => x.score < 999).sort((a,b) => a.score - b.score).slice(0, 8);
    
    return scored;
  }, [query, championList]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-[400px]">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setIdx(0); }}
        onKeyDown={e => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(p => (p+1)%results.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(p => (p-1+results.length)%results.length); }
          else if (e.key === 'Enter') { e.preventDefault(); if (results[idx]) { setQuery(results[idx].kr); setOpen(false); onSelect?.(results[idx].kr, results[idx].en); } }
          else if (e.key === 'Escape') setOpen(false);
        }}
        onFocus={() => query && setOpen(true)}
        placeholder="챔피언 검색: ㄱㄹ, 로크, 가랜(오타), ahri"
        className="w-full h-11 pl-10 pr-4 bg-[#1e1e2e] border border-[#3a3a4e] rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-[#7c3aed]"
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-[#1e1e2e] border border-[#3a3a4e] rounded-lg shadow-xl overflow-hidden">
          {results.map((c, i) => (
            <button
              key={c.en}
              onClick={() => { setQuery(c.kr); setOpen(false); onSelect?.(c.kr, c.en); }}
              onMouseEnter={() => setIdx(i)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#2a2a3e] ${i===idx?'bg-[#2a2a3e] border-l-2 border-[#7c3aed]':'border-l-2 border-transparent'}`}
            >
              <img src={getChampionIconUrl(c.kr) || ''} alt={c.kr} className="w-8 h-8 rounded-full" onError={e => (e.currentTarget.style.display='none')} />
              <div className="flex-1">
                <div className="text-sm font-bold text-white">{c.kr} <span className="text-[11px] text-gray-500 ml-1">{c.en}</span></div>
                <div className="text-[11px] text-gray-500">초성: {c.chosung}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query && results.length === 0 && (
        <div className="absolute z-50 mt-2 w-full bg-[#1e1e2e] border border-[#3a3a4e] rounded-lg p-3 text-center text-sm text-gray-400">결과 없음</div>
      )}
    </div>
  );
}
