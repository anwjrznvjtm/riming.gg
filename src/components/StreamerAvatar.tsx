import React, { useState } from 'react';

// Known SOOP (AfreecaTV) streamer IDs / avatar mappings
export const SOOP_STREAMER_IDS: Record<string, string> = {
  '우리밍_': 'wooriming',
  '우리밍': 'wooriming',
  '김민교': 'minkyo1994',
  '이상호': 'opklol',
  '김봉준': 'khm11903',
  '임선비': 'sunbi1024',
  '다단': 'dadan',
  '오아': 'oa1214',
  '토마토': 'tomato',
  '박사장': 'parksajang',
  '남봉': 'nambong',
  '유소나': 'yusona',
  '수피': 'soopi',
  '강만식': 'kangmansik',
  '저라뎃': 'jradet',
  '준밧드': 'junbadd',
  '뜨뜨뜨뜨': 'daddaddadda',
  '단아냥': 'dananyang',
  '임아니': 'imani',
  '앵지': 'angji',
  '서리': 'seori',
  '하티': 'hatti',
  '연두': 'yeondoo',
  '유혜디': 'yuhedi',
  '다누리': 'danuri',
  '김레인': 'kimrain',
  '꿀탱탱': 'kkultt',
  '나라카일': 'narakyle',
  '린다랑': 'lindarang',
  '데스티니': 'destiny',
  '스맵': 'smeb',
  '쿠로': 'kuro',
  '피글렛': 'piglet',
  '상윤': 'sangyoon',
  '나는상윤': 'sangyoon',
  '눈꽃': 'snowflower',
  '강소연': 'kangsoyeon',
  '푸린': 'purin',
  '인섹': 'insec',
  '러너': 'runner',
  '꽃빈': 'flowervin',
  '백크': 'baekkeu',
  '제동빠': 'jedongppa',
  '스피릿': 'spirit',
  '이경민': 'leekyeongmin',
  '애교용': 'aegyoyong',
  '효딤': 'hyodim',
  '디임': 'diim',
  '박삐삐': 'bbibbi',
  '트할': 'thal',
  '마린': 'marin',
};

export function getSoopProfileUrl(streamerName?: string): string | null {
  if (!streamerName) return null;
  const clean = streamerName.trim();
  const id = SOOP_STREAMER_IDS[clean] || SOOP_STREAMER_IDS[clean.replace(/\s+/g, '')];
  if (!id) return null;
  // SOOP user title / profile image standard CDN path
  return `https://stimg.sooplive.co.kr/LOGO/${id.slice(0, 2)}/${id}/${id}.jpg`;
}

interface StreamerAvatarProps {
  name: string;
  size?: number;
  className?: string;
  shape?: 'circle' | 'square';
}

export const StreamerAvatar: React.FC<StreamerAvatarProps> = ({
  name,
  size = 20,
  className = '',
  shape = 'circle',
}) => {
  const [hasError, setHasError] = useState(false);
  const cleanName = (name || '').trim();
  const profileUrl = getSoopProfileUrl(cleanName);
  const roundedClass = shape === 'square' ? 'rounded-[6px]' : 'rounded-full';

  // Fallback initial
  const initial = cleanName ? cleanName.charAt(0) : '?';

  // Fallback background color based on name hash
  const colors = [
    'bg-purple-900/60 text-purple-200 border-purple-700/50',
    'bg-blue-900/60 text-blue-200 border-blue-700/50',
    'bg-emerald-900/60 text-emerald-200 border-emerald-700/50',
    'bg-amber-900/60 text-amber-200 border-amber-700/50',
    'bg-rose-900/60 text-rose-200 border-rose-700/50',
    'bg-indigo-900/60 text-indigo-200 border-indigo-700/50',
  ];
  let charSum = 0;
  for (let i = 0; i < cleanName.length; i++) {
    charSum += cleanName.charCodeAt(i);
  }
  const colorClass = colors[charSum % colors.length];

  if (!profileUrl || hasError) {
    return (
      <div
        className={`${roundedClass} border flex items-center justify-center font-bold shrink-0 select-none shadow-sm ${colorClass} ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          fontSize: `${Math.max(8, Math.floor(size * 0.46))}px`,
        }}
        title={cleanName}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={profileUrl}
      alt={cleanName}
      title={cleanName}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`${roundedClass} object-cover shrink-0 border border-white/20 shadow-sm ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      loading="lazy"
    />
  );
};
