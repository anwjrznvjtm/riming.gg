import React, { useState } from 'react';
import { LineName, PartnerStat } from '../types';
import { ComputedStats } from '../lib/stats';
import { X, Trophy, TrendingDown, Users } from 'lucide-react';

interface SynergyTabProps {
  stats: ComputedStats;
}

export const SynergyTab: React.FC<SynergyTabProps> = ({ stats }) => {
  const [selectedModal, setSelectedModal] = useState<{
    woorimingLine: 'ADC' | 'SUP';
    partnerLine: LineName;
  } | null>(null);

  const roles: ('ADC' | 'SUP')[] = ['ADC', 'SUP'];

  return (
    <div className="space-y-8 animate-[fadeIn_0.2s]">
      <div>
        <h1 className="text-[20px] font-bold text-white flex items-center gap-2">
          <Users size={22} className="text-[#8b5cf6]" />
          <span>라인별 시너지 분석</span>
        </h1>
        <p className="text-[13px] text-[#8a8aa0] mt-1">
          우리밍이 원딜 또는 서폿일 때, 함께한 파트너 라인별 Best / Worst 선수를 확인하고 상세 랭킹을 조회할 수 있습니다.
        </p>
      </div>

      {roles.map((wRole) => {
        const totalGamesInRole = (Object.values(stats.partnerStats.overall[wRole]) as PartnerStat[]).reduce(
          (acc, p) => acc + p.games,
          0
        );

        const partnerLines: LineName[] = (['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as LineName[]).filter(
          (l) => l !== wRole
        );

        return (
          <div key={wRole} className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-[36px] h-[36px] rounded-full bg-[#8b5cf6] flex items-center justify-center text-[12px] font-bold text-white shadow">
                {wRole}
              </div>
              <div>
                <div className="font-bold text-[16px] text-white">
                  우리밍 {wRole === 'ADC' ? '원딜' : '서폿'} 포지션
                </div>
                <div className="text-[11px] text-[#6a6a80]">
                  전체 기록 기준 • 파트너 라인별 승률 Best & Worst
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {partnerLines.map((pLine) => {
                const partnerMap = stats.partnerStats.overall[wRole];
                const linePartners = (Object.values(partnerMap) as PartnerStat[])
                  .filter((p) => p.line === pLine)
                  .sort(
                    (a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games
                  );

                const best = linePartners[0] || null;
                const worst = linePartners.length > 1 ? linePartners[linePartners.length - 1] : null;

                return (
                  <div
                    key={pLine}
                    onClick={() => setSelectedModal({ woorimingLine: wRole, partnerLine: pLine })}
                    className="bg-[#08080c] border border-[#1e1e2a] rounded-[14px] p-4 hover:border-[#8b5cf6]/50 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-center">
                      <div className="text-[11px] tracking-widest text-[#8b5cf6] font-bold">
                        {pLine} 라인
                      </div>
                      <span className="text-[10px] text-[#5a5a6a] group-hover:text-[#a78bfa] transition">
                        랭킹 보기 →
                      </span>
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {/* BEST */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1 text-[11px] text-[#10b981] font-semibold">
                          <Trophy size={12} />
                          <span>BEST</span>
                        </div>
                        {best ? (
                          <div className="text-right">
                            <div className="text-[13px] font-bold text-white">{best.name}</div>
                            <div className="text-[11px] text-[#8a8aa0]">
                              {best.games}판 {best.wins}승{' '}
                              <span className="text-[#10b981] font-semibold">
                                {((best.wins / best.games) * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#5a5a6a]">데이터 없음</div>
                        )}
                      </div>

                      <div className="h-px bg-[#1e1e2a]" />

                      {/* WORST */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1 text-[11px] text-[#ef4444] font-semibold">
                          <TrendingDown size={12} />
                          <span>WORST</span>
                        </div>
                        {worst ? (
                          <div className="text-right">
                            <div className="text-[13px] font-bold text-white">{worst.name}</div>
                            <div className="text-[11px] text-[#8a8aa0]">
                              {worst.games}판 {worst.wins}승{' '}
                              <span className="text-[#ef4444] font-semibold">
                                {((worst.wins / worst.games) * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#5a5a6a]">데이터 없음</div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-[10px] text-[#4a4a5a] text-center pt-1 border-t border-[#1e1e2a]/50">
                      총 {linePartners.length}명의 {pLine} 선수 플레이 기록
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Full Partner Ranking Modal */}
      {selectedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s]">
          <div className="w-full max-w-[520px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="font-bold text-[16px] text-white">
                  우리밍({selectedModal.woorimingLine === 'ADC' ? '원딜' : '서폿'}) ×{' '}
                  {selectedModal.partnerLine} 파트너 전체 랭킹
                </div>
                <div className="text-[11px] text-[#6a6a80]">
                  {selectedModal.partnerLine} 포지션 파트너별 승률 및 판수 기준 정렬
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedModal(null)}
                className="w-[28px] h-[28px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white text-[12px]"
              >
                <X size={14} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-[#6a6a80] text-[11px] border-b border-[#1e1e2a]">
                  <tr>
                    <th className="text-left p-2.5">순위</th>
                    <th className="text-left p-2.5">스트리머</th>
                    <th className="text-left p-2.5">포지션</th>
                    <th className="text-left p-2.5">전적</th>
                    <th className="text-right p-2.5">승률</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const partners = (Object.values(
                      stats.partnerStats.overall[selectedModal.woorimingLine]
                    ) as PartnerStat[])
                      .filter((p) => p.line === selectedModal.partnerLine)
                      .sort(
                        (a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games
                      );

                    if (partners.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-[#5a5a6a]">
                            해당 포지션과 함께한 경기 기록이 없습니다.
                          </td>
                        </tr>
                      );
                    }

                    return partners.map((p, idx) => {
                      const rate = (p.wins / p.games) * 100;
                      return (
                        <tr
                          key={p.name}
                          className="border-t border-[#1e1e2a] hover:bg-[#1a1a26] transition"
                        >
                          <td className="p-2.5 text-[#8a8aa0] font-medium">{idx + 1}</td>
                          <td className="p-2.5 font-semibold text-white">{p.name}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 bg-[#1e1e2a] rounded-full text-[10px] text-[#a0a0b8]">
                              {p.line}
                            </span>
                          </td>
                          <td className="p-2.5 text-[#c0c0d0]">
                            {p.games}판 {p.wins}승 {p.games - p.wins}패
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-[50px] h-[4px] bg-[#1e1e2a] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#8b5cf6]"
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className="text-[#8b5cf6] font-bold min-w-[36px]">
                                {rate.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
