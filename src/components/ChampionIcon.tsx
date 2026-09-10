import React, { useState, useEffect } from 'react';
import { getChampionIconUrl, getChampionFallbackUrl } from '../lib/champions';

interface ChampionIconProps {
  name: string;
  size?: number;
  shape?: 'circle' | 'square';
  className?: string;
}

export const ChampionIcon: React.FC<ChampionIconProps> = ({
  name,
  size = 18,
  shape = 'circle',
  className = '',
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | null>(() => getChampionIconUrl(name));
  const [hasFailedAll, setHasFailedAll] = useState(false);

  useEffect(() => {
    setCurrentSrc(getChampionIconUrl(name));
    setHasFailedAll(false);
  }, [name]);

  const roundedClass = shape === 'square' ? 'rounded-[6px]' : 'rounded-full';

  const handleError = () => {
    const fallback = getChampionFallbackUrl(name);
    if (currentSrc !== fallback && fallback) {
      setCurrentSrc(fallback);
    } else {
      setHasFailedAll(true);
    }
  };

  if (!currentSrc || hasFailedAll) {
    const initial = name ? name.trim().slice(0, 1) : '?';
    return (
      <div
        className={`${roundedClass} bg-[#1e1e2e] border border-[#3a3a4e] flex items-center justify-center font-bold text-[#c4b5fd] shrink-0 shadow-sm select-none ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          fontSize: `${Math.max(9, Math.floor(size * 0.44))}px`,
        }}
        title={name}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={name}
      title={name}
      referrerPolicy="no-referrer"
      onError={handleError}
      className={`${roundedClass} object-cover shrink-0 border border-white/20 shadow-sm ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      loading="lazy"
    />
  );
};
