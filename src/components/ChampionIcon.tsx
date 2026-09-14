import React, { useState } from 'react';
import { getChampionIconUrl, getChampionFallbackUrl, getChampionEnName } from '../lib/champions';

interface Props {
  name: string;
  size?: number;
  shape?: "circle" | "square";
  showLock?: boolean;
}

export const ChampionIcon: React.FC<Props> = ({ name, size = 24, shape = "circle", showLock = false }) => {
  const [failed, setFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  
  const cleanName = (name || "").trim();
  if (!cleanName) {
    return <div style={{ width: size, height: size }} className="bg-[#1e1e2a] rounded-full" />;
  }

  const enName = getChampionEnName(cleanName);
  const primaryUrl = getChampionIconUrl(cleanName);
  const fallbackUrl = getChampionFallbackUrl(cleanName);
  const url = useFallback && fallbackUrl ? fallbackUrl : primaryUrl;

  if (failed || !url || !enName) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`${shape === "circle" ? "rounded-full" : "rounded-[4px]"} bg-[#1e1e2a] border border-[#2a2a3a] flex items-center justify-center text-[8px] text-[#6a6a80] font-bold`}
        title={cleanName}
      >
        {cleanName.slice(0, 2)}
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      <img
        src={url}
        alt={cleanName}
        width={size}
        height={size}
        className={`${shape === "circle" ? "rounded-full" : "rounded-[4px]"} border border-[#2a2a3a] object-cover bg-[#12121a]`}
        onError={() => {
          if (!useFallback && fallbackUrl && fallbackUrl !== primaryUrl) {
            setUseFallback(true);
          } else {
            setFailed(true);
          }
        }}
        loading="lazy"
      />
      {showLock && (
        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
          <span className="text-[10px]">🔒</span>
        </div>
      )}
    </div>
  );
};
