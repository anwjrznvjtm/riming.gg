import React, { useState } from 'react';
import { getChampionIconUrl } from '../lib/champions';

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
  const [hasError, setHasError] = useState(false);
  const iconUrl = getChampionIconUrl(name);
  const roundedClass = shape === 'square' ? 'rounded-[8px]' : 'rounded-full';

  if (!iconUrl || hasError) {
    const initial = name ? name.trim().slice(0, 1) : '?';
    return (
      <div
        className={`${roundedClass} bg-[#1e1e2e] border border-[#3a3a4e] flex items-center justify-center font-bold text-white shrink-0 shadow-sm ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          fontSize: `${Math.max(9, Math.floor(size * 0.45))}px`,
        }}
        title={name}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={name}
      title={name}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`${roundedClass} object-cover shrink-0 border border-white/20 shadow-sm ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      loading="lazy"
    />
  );
};
