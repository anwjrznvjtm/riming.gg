import React from 'react';
import { ComputedStats } from '../lib/stats';
import { X } from 'lucide-react';

interface SummaryModalProps {
  stats: ComputedStats;
  isOpen: boolean;
  onClose: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({ stats, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-[#12121a] border border-[#1e1e2a] rounded-[24px] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[16px] font-bold text-white">우리밍_ 전체 요약 · riming.gg</div>
            <div className="text-[11px] text-[#6a6a80] mt-0.5">전체 CK 전적 통계 및 포지션 상세</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[28px] h-[28px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
          >
            <X size={14} />
          </button>
        </div>

        {/* 3 Metrics Block */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[14px] p-3 text-center">
            <div className="text-[22px] font-black text-white">{stats.overallWinrate.total}</div>
            <div className="text-[11px] text-[#8a8aa0] mt-0.5">총 경기</div>
          </div>
          <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[14px] p-3 text-center">
            <div className="text-[22px] font-black text-[#10b981]">{stats.overallWinrate.wins}</div>
            <div className="text-[11px] text-[#8a8aa0] mt-0.5">승리</div>
          </div>
          <div className="bg-[#08080c] border border-[#8b5cf6]/30 rounded-[14px] p-3 text-center">
            <div className="text-[22px] font-black text-[#8b5cf6]">
              {stats.overallWinrate.winrate.toFixed(0)}%
            </div>
            <div className="text-[11px] text-[#8a8aa0] mt-0.5">승률</div>
          </div>
        </div>

        {/* Roles Breakdown */}
        <div className="mb-5">
          <div className="text-[12px] font-bold text-white mb-2">라인별 (전체)</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-[#08080c] border border-[#1e1e2a] rounded-[10px] px-3 py-2 text-[12px]">
              <span className="text-[#c0c0d0]">원딜 ({stats.roleStats.adc.games}판)</span>
              <span className="font-bold text-[#8b5cf6]">
                {stats.roleStats.adc.winrate.toFixed(0)}% ({stats.roleStats.adc.wins}승)
              </span>
            </div>
            <div className="flex justify-between items-center bg-[#08080c] border border-[#1e1e2a] rounded-[10px] px-3 py-2 text-[12px]">
              <span className="text-[#c0c0d0]">서폿 ({stats.roleStats.sup.games}판)</span>
              <span className="font-bold text-[#a78bfa]">
                {stats.roleStats.sup.winrate.toFixed(0)}% ({stats.roleStats.sup.wins}승)
              </span>
            </div>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div>
          <div className="text-[12px] font-bold text-white mb-2">월별 기록</div>
          <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[12px] overflow-hidden">
            <div className="grid grid-cols-3 text-[11px] text-[#6a6a80] bg-[#0f0f18] px-3 py-2">
              <span>월</span>
              <span className="text-center">경기수</span>
              <span className="text-right">승률</span>
            </div>
            {stats.monthlyStats.length === 0 ? (
              <div className="text-[12px] text-[#6a6a80] text-center py-4 border-t border-[#1e1e2a]">
                기록된 월별 경기 데이터가 없습니다.
              </div>
            ) : (
              stats.monthlyStats.map((m) => (
                <div
                  key={m.month}
                  className="grid grid-cols-3 text-[12px] px-3 py-2 border-t border-[#1e1e2a]"
                >
                  <span className="font-medium text-white">{m.month}</span>
                  <span className="text-center text-[#c0c0d0]">{m.games}전</span>
                  <span className="text-right font-bold text-[#8b5cf6]">
                    {m.winrate.toFixed(0)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
