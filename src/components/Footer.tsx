import React from 'react';

interface FooterProps {
  totalMatches: number;
}

export const Footer: React.FC<FooterProps> = ({ totalMatches }) => {
  return (
    <footer className="mt-12 border-t border-[#1e1e2a] py-8 text-center bg-[#08080c]">
      <div className="max-w-[1100px] mx-auto px-4 text-[11px] text-[#5a5a6a] leading-relaxed space-y-1">
        <div>
          <span className="font-bold text-[#8a8aa0]">RIMING.GG</span> • CK 기록 전용 • Dark minimal
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <span>
            Data: {totalMatches} matches • Red팀 vs Blue팀 • 우리밍_ ADC/SUP
          </span>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e] opacity-80"
            title="클라우드 실시간 연결됨"
          />
        </div>
      </div>
    </footer>
  );
};
