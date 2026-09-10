export interface BgmTrack {
  id: string;
  title: string;
  artist: string;
  videoId: string;
}

/**
 * 롤 / 스트리머 / CK 시청에 최적화된 엄선된 공식 BGM 리스트
 */
export const BGM_PLAYLIST: BgmTrack[] = [
  {
    id: 'riming-signature',
    title: '우리밍 시그니처 LoL BGM',
    artist: 'League of Legends Streamer',
    videoId: 'Ya3APDs8hUk',
  },
  {
    id: 'popstars',
    title: 'POP/STARS',
    artist: 'K/DA (Madison Beer, (G)I-DLE)',
    videoId: 'UOxkGD8qRB4',
  },
  {
    id: 'legends-never-die',
    title: 'Legends Never Die',
    artist: 'Against The Current (Worlds 2017)',
    videoId: '4P4fYcQjNsw',
  },
  {
    id: 'gods',
    title: 'GODS',
    artist: 'NewJeans (Worlds 2023)',
    videoId: 'C3GouGa0noM',
  },
  {
    id: 'rise',
    title: 'RISE',
    artist: 'The Glitch Mob, Mako, The Word Alive',
    videoId: 'fB8TyLTrcC0',
  },
  {
    id: 'warriors',
    title: 'Warriors',
    artist: 'Imagine Dragons (Worlds 2014)',
    videoId: 'fmI_Ndrxy14',
  },
  {
    id: 'silver-scapes',
    title: 'Silver Scrapes',
    artist: 'Danny McCarthy (LCK 5세트 테마)',
    videoId: 'v2AYI36lyCA',
  },
  {
    id: 'phoenix',
    title: 'Phoenix',
    artist: 'Cailin Russo, Chrissy Costanza (Worlds 2019)',
    videoId: 'r6zIGXun57U',
  },
  {
    id: 'star-walkin',
    title: 'STAR WALKIN’',
    artist: 'Lil Nas X (Worlds 2022)',
    videoId: 'HYsz1hP0BFo',
  },
  {
    id: 'more',
    title: 'MORE',
    artist: 'K/DA (Madison Beer, (G)I-DLE, Seraphine)',
    videoId: '3z-bjzIeVJU',
  },
  {
    id: 'awaken',
    title: 'Awaken',
    artist: 'Valerie Broussard ft. Ray Chen',
    videoId: 'zF5Ddo9JDPY',
  },
];

/**
 * Fisher-Yates (Knuth) 무작위 셔플 알고리즘
 * 모든 순열이 동일한 확률로 생성되도록 배열을 제자리에서 섞습니다.
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 새로운 BGM 재생 큐(Queue) 생성 함수:
 * 1. 전체 트랙을 Fisher-Yates 알고리즘으로 무작위 셔플합니다.
 * 2. 직전에 마지막으로 재생된 곡(lastTrackId)과 새 큐의 첫 번째 곡이 동일한 경우,
 *    다른 위치의 곡과 맞바꿔 동일한 곡이 연속해서 재생되지 않도록 보장합니다.
 */
export function createBgmQueue(allTracks: BgmTrack[] = BGM_PLAYLIST, lastTrackId?: string): BgmTrack[] {
  if (allTracks.length === 0) return [];
  if (allTracks.length === 1) return [...allTracks];

  const shuffled = fisherYatesShuffle(allTracks);

  // 직전 곡과 새 큐의 첫 번째 곡이 동일하면 1 ~ (N-1) 사이의 곡과 교체
  if (lastTrackId && shuffled[0].id === lastTrackId) {
    const swapTarget = 1 + Math.floor(Math.random() * (shuffled.length - 1));
    [shuffled[0], shuffled[swapTarget]] = [shuffled[swapTarget], shuffled[0]];
  }

  return shuffled;
}
