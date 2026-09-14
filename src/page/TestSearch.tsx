// 예시: src/pages/TestSearch.tsx 또는 기존 검색창이 있는 파일에 붙여넣기
// 이 파일을 새로 만들어서 테스트해보면 제일 쉬워!

import React, { useState } from 'react';
import { ChampionAutocomplete } from '@/components/ChampionAutocomplete';
// 또는 상대 경로: import { ChampionAutocomplete } from '../components/ChampionAutocomplete';

export default function TestSearchPage() {
  const [selectedChampion, setSelectedChampion] = useState('');

  return (
    <div className="min-h-screen bg-[#0f0f14] p-8">
      <h1 className="text-white text-xl font-bold mb-4">챔피언 검색 테스트</h1>
      
      {/* 여기가 4단계에서 말한 "쓰는 곳"이야! */}
      {/* 기존에 <input type="text" /> 있던 자리를 이걸로 교체하면 돼 */}
      <ChampionAutocomplete
        value=""
        placeholder="ㄱㄹ, 로크, 가랜(오타), ahri 입력해보세요"
        onSelect={(champ) => {
          // champ.kr = "가렌", champ.en = "Garen", champ.chosung = "ㄱㄹ"
          setSelectedChampion(champ.kr);
          console.log('선택된 챔피언:', champ);
          // 여기서 전적 검색 페이지로 이동하거나 필터링 하면 됨
          // 예: router.push(`/champion/${champ.en}`)
        }}
        onChange={(text) => {
          console.log('타이핑 중:', text);
        }}
      />

      {selectedChampion && (
        <div className="mt-4 text-white">
          선택한 챔피언: <span className="text-[#a78bfa] font-bold">{selectedChampion}</span>
        </div>
      )}
    </div>
  );
}

/*
어디에 붙이냐면:

1. 지금 전적 검색창이 있는 파일 찾기
   - 보통 src/components/SearchBar.tsx
   - 또는 src/pages/Home.tsx
   - 또는 src/components/MatchFilter.tsx

2. 그 파일에서 <input ... /> 있는 부분 찾기
   예시 - 기존 코드:
   <input 
     type="text" 
     placeholder="챔피언 검색" 
     value={searchText}
     onChange={e => setSearchText(e.target.value)}
   />

3. 그 input을 아래 코드로 교체:
   <ChampionAutocomplete
     value={searchText}
     onSelect={(champ) => setSearchText(champ.kr)}
     onChange={setSearchText}
   />

끝!
*/
