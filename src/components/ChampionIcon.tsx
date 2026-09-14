import React, { useState, useEffect } from 'react';
import { getChampionIconUrl, getChampionFallbackUrl, normalizeChampionName } from '../lib/champions';

interface ChampionIconProps {
  name: string;
  size?: number;
  shape?: 'circle' | 'square';
  className?: string;
  showLock?: boolean;
}

export const ChampionIcon: React.FC<ChampionIconProps> = ({
  name,
  size = 18,
  shape = 'circle',
  className = '',
  showLock = false,
}) => {
  const normalized = normalizeChampionName(name);
  const [src, setSrc] = useState<string | null>(() => getChampionIconUrl(normalized));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(getChampionIconUrl(normalized));
    setFailed(false);
  }, [normalized]);

  const rounded = shape === 'square' ? 'rounded-[6px]' : 'rounded-full';

  const onError = () => {
    const fb = getChampionFallbackUrl(normalized);
    if (src !== fb && fb && !normalized.includes('로크') && !normalized.includes('록')) {
      // 로크는 커스텀 아이콘이라 fallback도 같은 거라 무한루프 방지
      setSrc(fb);
    } else {
      setFailed(true);
    }
  };

  if (!src || failed) {
    const isLocke = ['로크', '록', 'Locke', 'locke'].includes(normalized);
    const text = isLocke ? '로크' : (normalized.slice(0, 2) || '?');
    return (
      <div
        className={`${rounded} ${isLocke ? 'bg-[#7c3aed] border-[#a78bfa] text-white' : 'bg-[#1e1e2e] border-[#3a3a4e] text-[#c4b5fd]'} border flex items-center justify-center font-black shrink-0 ${className}`}
        style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(8, Math.floor(size * 0.38))}px` }}
        title={normalized}
      >
        {text}
      </div>
    );
  }

  return (
    <div className="relative shrink-0" style={{ width: `${size}px`, height: `${size}px` }}>
      <img
        src={src}
        alt={normalized}
        title={normalized}
        onError={onError}
        className={`${rounded} object-cover border border-white/20 w-full h-full ${className}`}
        loading="lazy"
      />
      {showLock && (
        <div className={`${rounded} absolute inset-0 bg-black/50 flex items-center justify-center`}>🔒</div>
      )}
    </div>
  );
};
