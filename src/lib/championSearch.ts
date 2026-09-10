import { CHAMPIONS_LIST } from '../data/initialMatches';

const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

export function getChosung(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if (code >= 0 && code <= 11171) {
      result += CHOSUNG_LIST[Math.floor(code / 588)];
    } else {
      result += str.charAt(i);
    }
  }
  return result;
}

// Common Korean LoL Champion Nicknames / Abbreviations
export const CHAMPION_ALIASES: Record<string, string> = {
  '자르반': '자르반 4세',
  '자르반4세': '자르반 4세',
  '자르반4': '자르반 4세',
  '누누': '누누와 윌럼프',
  '문도': '문도 박사',
  '미포': '미스 포츈',
  '마이': '마스터 이',
  '신짜오': '신 짜오',
  '짜오': '신 짜오',
  '블츠': '블리츠크랭크',
  '블리츠': '블리츠크랭크',
  '아솔': '아우렐리온 솔',
  '트페': '트위스티드 페이트',
  '레나타': '레나타 글라스크',
  '탐켄치': '탐 켄치',
  '켄치': '탐 켄치',
  '피들': '피들스틱',
  '하이머': '하이머딩거',
  '트린다': '트린다미어',
  '트리': '트리스타나',
  '세주': '세주아니',
  '블라디': '블라디미르',
  '모데': '모데카이저',
  '볼베': '볼리베어',
  '케이틀': '케이틀린',
  '헤카': '헤카림',
  '오리': '오리아나',
  '갱플': '갱플랭크',
  '카시': '카시오페아',
  '아펠': '아펠리오스',
  '레넥': '레넥톤',
  '말파': '말파이트',
  '모르': '모르가나',
};

export function searchChampions(rawQuery: string, sourceList: string[] = CHAMPIONS_LIST): string[] {
  if (!rawQuery || !rawQuery.trim()) return [];
  const query = rawQuery.trim().toLowerCase();
  const cleanQuery = query.replace(/\s+/g, '');
  const queryChosung = getChosung(cleanQuery);

  // Check direct alias first
  const aliasMatch = CHAMPION_ALIASES[cleanQuery];
  const candidates = Array.from(new Set([...sourceList, ...(aliasMatch ? [aliasMatch] : [])]));

  const scored = candidates.map((champ) => {
    const cleanChamp = champ.replace(/\s+/g, '').toLowerCase();
    const champChosung = getChosung(cleanChamp);

    let score = -1;

    if (champ === rawQuery.trim()) {
      score = 1000;
    } else if (cleanChamp === cleanQuery) {
      score = 900;
    } else if (aliasMatch && champ === aliasMatch) {
      score = 850;
    } else if (cleanChamp.startsWith(cleanQuery)) {
      score = 700 - cleanChamp.length;
    } else if (cleanChamp.includes(cleanQuery)) {
      score = 500 - cleanChamp.indexOf(cleanQuery);
    } else if (queryChosung.length > 0 && champChosung.startsWith(queryChosung)) {
      score = 400 - champChosung.length;
    } else if (queryChosung.length > 0 && champChosung.includes(queryChosung)) {
      score = 300 - champChosung.indexOf(queryChosung);
    } else {
      // Check if alias starts with query
      for (const [alias, target] of Object.entries(CHAMPION_ALIASES)) {
        if (target === champ && alias.startsWith(cleanQuery)) {
          score = 350;
          break;
        }
      }
    }

    return { champ, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.champ)
    .slice(0, 8);
}
