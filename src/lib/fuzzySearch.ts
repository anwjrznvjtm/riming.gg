/**
 * src/lib/fuzzySearch.ts
 * 챔피언 / 스트리머 닉네임 퍼지 검색 + 초성 검색
 * Fuse.js 없이 동작하는 경량 버전, Fuse.js 있으면 같이 쓸 수도 있음
 */

import { CHAMPION_KR_TO_EN, normalizeChampionName } from './champions';

// 초성 리스트
const CHOSUNG_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHOSUNG_SET = new Set(CHOSUNG_LIST);

// 한글 유니코드 범위
const HANGUL_BASE = 0xAC00;
const HANGUL_END = 0xD7A3;

/**
 * 한글 음절에서 초성 추출
 */
export function getChosung(str: string): string {
  let result = '';
  for (const char of str) {
    const code = char.charCodeAt(0);
    if (code >= HANGUL_BASE && code <= HANGUL_END) {
      const chosungIndex = Math.floor((code - HANGUL_BASE) / (21 * 28));
      result += CHOSUNG_LIST[chosungIndex];
    } else if (CHOSUNG_SET.has(char)) {
      result += char; // 이미 초성이면 그대로
    } else {
      // 영문/숫자/기타는 소문자로 그대로 (검색용)
      result += char.toLowerCase();
    }
  }
  return result;
}

export function isChosungQuery(query: string): boolean {
  if (!query) return false;
  return [...query].every(ch => CHOSUNG_SET.has(ch));
}

// Levenshtein 거리 (오타 허용용)
export function levenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  
  const matrix = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) matrix[i][0] = i;
  for (let j = 0; j <= bl; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,      // 삭제
        matrix[i][j-1] + 1,      // 삽입
        matrix[i-1][j-1] + cost  // 교체
      );
    }
  }
  return matrix[al][bl];
}

export interface SearchableChampion {
  id: string; // 영문 ID (Garen)
  kr: string; // 한글 대표 이름 (가렌)
  krAliases: string[]; // 별칭 (미포, 문도 등)
  en: string; // 영문
  chosung: string; // 초성 (ㄱㄹ)
  enLower: string;
  krLower: string;
}

// CHAMPION_KR_TO_EN 에서 중복 제거하고 대표 리스트 만들기
let _championCache: SearchableChampion[] | null = null;

export function getChampionSearchList(): SearchableChampion[] {
  if (_championCache) return _championCache;
  
  const byEn = new Map<string, { mainKr: string; aliases: string[] }>();
  
  for (const [kr, en] of Object.entries(CHAMPION_KR_TO_EN)) {
    if (!byEn.has(en)) {
      byEn.set(en, { mainKr: kr, aliases: [] });
    } else {
      // 첫 번째 키를 대표로 쓰고 나머지는 별칭
      const existing = byEn.get(en)!;
      if (kr.length < existing.mainKr.length || existing.mainKr.includes(' ')) {
        // 더 짧은 걸 대표로 (가렌이 문도 박사보다 대표)
        // 단, 현재 main이 약어면 유지
        if (!['미포','이즈','블츠','모데','문도','록'].includes(existing.mainKr)) {
          existing.aliases.push(existing.mainKr);
          existing.mainKr = kr;
        } else {
          existing.aliases.push(kr);
        }
      } else {
        existing.aliases.push(kr);
      }
    }
  }
  
  const list: SearchableChampion[] = [];
  for (const [en, { mainKr, aliases }] of byEn.entries()) {
    // 로크 같은 경우 '록'과 '로크' 둘 다 있지만 대표 1개만
    const dedupedAliases = [...new Set(aliases)].filter(a => a !== mainKr);
    list.push({
      id: en,
      kr: mainKr,
      krAliases: dedupedAliases,
      en,
      chosung: getChosung(mainKr),
      enLower: en.toLowerCase(),
      krLower: mainKr.toLowerCase(),
    });
  }
  
  // 173개 정렬 (가나다 순)
  list.sort((a,b) => a.kr.localeCompare(b.kr, 'ko'));
  _championCache = list;
  return list;
}

export interface SearchResult extends SearchableChampion {
  score: number; // 낮을수록 정확
  matchedOn: 'exact' | 'prefix' | 'includes' | 'chosung' | 'chosung-prefix' | 'alias' | 'en' | 'fuzzy';
}

/**
 * Fuse.js 스타일 점수 계산 (가볍게)
 */
export function searchChampions(query: string, limit = 8): SearchResult[] {
  const q = normalizeChampionName(query).toLowerCase().trim();
  if (!q) return [];
  
  const qChosung = getChosung(q);
  const isChosungOnly = isChosungQuery(q);
  const list = getChampionSearchList();
  const results: SearchResult[] = [];
  
  for (const champ of list) {
    let score = 999;
    let matchedOn: SearchResult['matchedOn'] = 'fuzzy';
    
    // 1. 완전 일치
    if (champ.krLower === q || champ.enLower === q) {
      score = 0;
      matchedOn = 'exact';
    }
    // 2. 별칭 완전 일치
    else if (champ.krAliases.some(alias => alias.toLowerCase() === q)) {
      score = 1;
      matchedOn = 'alias';
    }
    // 3. 한글 prefix (가렌 -> 가)
    else if (champ.krLower.startsWith(q)) {
      score = 10 + q.length; // 짧은 검색어가 앞에 있을수록 좋음
      matchedOn = 'prefix';
    }
    // 4. 영문 prefix
    else if (champ.enLower.startsWith(q)) {
      score = 12 + q.length;
      matchedOn = 'en';
    }
    // 5. 초성 검색 (ㄱㄹ -> 가렌)
    else if (isChosungOnly && champ.chosung.startsWith(q)) {
      score = 15 + q.length;
      matchedOn = 'chosung-prefix';
    }
    else if (isChosungOnly && champ.chosung.includes(q)) {
      score = 25 + champ.chosung.indexOf(q);
      matchedOn = 'chosung';
    }
    // 6. 초성 포함 검색 (q가 초성이 아니어도 초성으로 변환해서 매칭)
    else if (!isChosungOnly && champ.chosung.includes(qChosung) && qChosung.length >= 1) {
      // 예: 'ㄱㄹ' 입력이 아니어도 'ㄱㄹ' 형태로 변환된 게 포함되면
      if (qChosung.length >= 2) {
        score = 26 + champ.chosung.indexOf(qChosung);
        matchedOn = 'chosung';
      }
    }
    // 7. 일반 포함
    else if (champ.krLower.includes(q)) {
      score = 30 + champ.krLower.indexOf(q);
      matchedOn = 'includes';
    }
    else if (champ.enLower.includes(q)) {
      score = 35 + champ.enLower.indexOf(q);
      matchedOn = 'en';
    }
    else if (champ.krAliases.some(a => a.toLowerCase().includes(q))) {
      score = 40;
      matchedOn = 'alias';
    }
    // 8. 오타 허용 (Levenshtein)
    else {
      const distKr = levenshtein(champ.krLower, q);
      const distEn = levenshtein(champ.enLower, q);
      const minDist = Math.min(distKr, distEn);
      // 글자 길이에 따라 허용 거리 조절
      const allowedDist = q.length <= 2 ? 1 : q.length <= 4 ? 2 : 3;
      if (minDist <= allowedDist) {
        score = 50 + minDist * 10;
        matchedOn = 'fuzzy';
      } else {
        continue; // 매칭 안 됨
      }
    }
    
    // 로크 같은 2글자는 가중치 보정
    if (q.length === 1 && champ.krLower.length > 1) score += 5;
    
    results.push({ ...champ, score, matchedOn });
  }
  
  return results
    .sort((a,b) => a.score - b.score)
    .slice(0, limit);
}

// 스트리머용 (동일 로직)
export interface Streamer {
  id: string;
  nickname: string;
  nicknameLower: string;
  chosung: string;
}

export function searchStreamers(query: string, streamers: Streamer[], limit = 8) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const qChosung = getChosung(q);
  const isChosungOnly = isChosungQuery(q);
  
  return streamers.map(s => {
    let score = 999;
    if (s.nicknameLower === q) score = 0;
    else if (s.nicknameLower.startsWith(q)) score = 10;
    else if (isChosungOnly && s.chosung.startsWith(q)) score = 15;
    else if (isChosungOnly && s.chosung.includes(q)) score = 25;
    else if (s.nicknameLower.includes(q)) score = 30;
    else if (s.chosung.includes(qChosung) && qChosung.length >= 2) score = 35;
    else {
      const d = levenshtein(s.nicknameLower, q);
      if (d <= 2) score = 50 + d*10;
    }
    return { ...s, score };
  }).filter(r => r.score < 999).sort((a,b) => a.score - b.score).slice(0, limit);
}

/**
 * Fuse.js 사용할 때 옵션 예시 (이미 설치했다면)
 * npm install fuse.js
 * 
 * import Fuse from 'fuse.js';
 * const fuse = new Fuse(championList, {
 *   keys: ['kr','krAliases','en','chosung'],
 *   threshold: 0.4, // 0~1, 낮을수록 엄격
 *   includeScore: true,
 *   ignoreLocation: true,
 * });
 */
