import React, { useState, useMemo } from 'react';
import { Match, LineName, PartnerStat, LINE_KEYS, LINE_LABELS, LineKey } from '../types';
import { ComputedStats, getWoorimingTeam, getWoorimingLineKey, isWooriming, getPlayerLineChampionStats } from '../lib/stats';
import { ChampionIcon } from './ChampionIcon';
import { StreamerAvatar } from './StreamerAvatar';
import { X, Trophy, TrendingDown, Users, ChevronRight, Calendar, Swords, Zap } from 'lucide-react';

interface SynergyTabProps {
  stats: ComputedStats;
  matches: Match[];
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
}

export const SynergyTab: React.FC<SynergyTabProps> = ({ stats, matches, onJumpToStreamer }) => {
  const [selectedModal, setSelectedModal] = useState<{
    woorimingLine: 'ADC' | 'SUP';
    partnerLine: LineName;
    selectedStreamer?: string | null;
  } | null>(null);

  const roles: ('ADC' | 'SUP')[] = ['ADC', 'SUP'];

  // Matches played together for the currently selected partner in the modal
  const partnerMatches = useMemo(() => {
    if (!selectedModal?.selectedStreamer) return [];
    const partnerName = selectedModal.selectedStreamer;
    const targetWLine = selectedModal.woorimingLine;
    const targetPLine = selectedModal.partnerLine;

    return matches.filter((m) => {
      const wTeam = getWoorimingTeam(m);
      const wRoster = wTeam === 'Red' ? m.team_a : m.team_b;
      const wKey = getWoorimingLineKey(m);
      if (LINE_LABELS[wKey] !== targetWLine) return false;

      const pKey = (Object.keys(LINE_LABELS) as LineKey[]).find((k) => LINE_LABELS[k] === targetPLine);
      if (!pKey) return false;
      return wRoster[pKey]?.trim() === partnerName.trim();
    });
  }, [matches, selectedModal]);

  return (
    <div className="space-y-8 animate-[fadeIn_0.2s]">
      <div>
        <h1 className="text-[20px] font-bold text-white flex items-center gap-2">
          <Users size={22} className="text-[#8b5cf6]" />
          <span>라인별 시너지 분석</span>
        </h1>
        <p className="text-[13px] text-[#8a8aa0] mt-1">
          우리밍_이 원딜 또는 서폿일 때, 함께한 파트너 라인별 Best / Worst 선수를 확인하고 상세 랭킹 및 경기 목록을 조회할 수 있습니다.
        </p>
      </div>

      {roles.map((wRole) => {
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
                  우리밍_ {wRole === 'ADC' ? '원딜' : '서폿'} 포지션
                </div>
                <div className="text-[11px] text-[#6a6a80]">
                  전체 기록 기준 • 파트너 라인별 승률 Best(승&gt;패 &amp; 1승 이상) &amp; Worst(패&gt;승 또는 0승)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {partnerLines.map((pLine) => {
                const partnerMap = stats.partnerStats.overall[wRole];
                const allPartnersInLine = (Object.values(partnerMap) as PartnerStat[]).filter(
                  (p) => p.line === pLine
                );

                // 1. Best 파트너 조건: 승이 패보다 많고(승률 50% 초과) 최소 1승 이상(wins > 0)
                const bestCandidates = allPartnersInLine
                  .filter((p) => p.wins > 0 && p.wins > p.games - p.wins)
                  .sort(
                    (a, b) => b.wins / b.games - a.wins / a.games || b.wins - a.wins || b.games - a.games
                  );
                const best = bestCandidates[0] || null;

                // 2. Worst 파트너 조건: 패가 승보다 많거나(승률 50% 미만), 승리가 0승인 경우(0승 1패 등)
                const worstCandidates = allPartnersInLine
                  .filter((p) => p.wins === 0 || p.games - p.wins > p.wins)
                  .sort(
                    (a, b) =>
                      a.wins / a.games - b.wins / b.games ||
                      (b.games - b.wins) - (a.games - a.wins) ||
                      b.games - a.games
                  );
                const worst = worstCandidates[0] || null;

                const bestChamps = best ? getPlayerLineChampionStats(best.name, pLine, matches).slice(0, 3) : [];
                const worstChamps = worst ? getPlayerLineChampionStats(worst.name, pLine, matches).slice(0, 3) : [];

                return (
                  <div
                    key={pLine}
                    onClick={() =>
                      setSelectedModal({
                        woorimingLine: wRole,
                        partnerLine: pLine,
                        selectedStreamer: null,
                      })
                    }
                    className="bg-[#08080c] border border-[#1e1e2a] rounded-[14px] p-4 hover:border-[#8b5cf6]/50 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <div className="text-[11px] tracking-widest text-[#8b5cf6] font-bold">
                          {pLine} 라인
                        </div>
                        <span className="text-[10px] text-[#5a5a6a] group-hover:text-[#a78bfa] transition flex items-center gap-0.5">
                          랭킹 &amp; 전적 보기 <ChevronRight size={12} />
                        </span>
                      </div>

                      <div className="mt-3 space-y-2.5">
                        {/* BEST */}
                        <div
                          onClick={(e) => {
                            if (best) {
                              e.stopPropagation();
                              setSelectedModal({
                                woorimingLine: wRole,
                                partnerLine: pLine,
                                selectedStreamer: best.name,
                              });
                            }
                          }}
                          className={`p-2 rounded-[10px] border transition ${
                            best
                              ? 'bg-[#10b981]/5 border-[#10b981]/20 hover:bg-[#10b981]/15'
                              : 'bg-transparent border-[#1e1e2a]'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1 text-[11px] text-[#10b981] font-semibold">
                              <Trophy size={12} />
                              <span>BEST</span>
                            </div>
                            {best ? (
                              <div className="flex items-center gap-2">
                                <StreamerAvatar name={best.name} size={28} shape="circle" className="border border-[#10b981]/40" />
                                <div className="text-right">
                                  <div className="text-[13px] font-bold text-white group-hover:text-[#86efac] transition">
                                    {best.name}
                                  </div>
                                  <div className="text-[11px] text-[#8a8aa0]">
                                    {best.games}판 {best.wins}승 {best.games - best.wins}패{' '}
                                    <span className="text-[#10b981] font-bold">
                                      {((best.wins / best.games) * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#5a5a6a]">조건 만족 없음</div>
                            )}
                          </div>

                          {/* Best Most Champions */}
                          {best && bestChamps.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[#10b981]/15 space-y-1">
                              <div className="text-[10px] text-[#8a8aa0] flex items-center justify-between">
                                <span>{pLine} 최다 플레이</span>
                                <span className="text-[9px] text-[#10b981] font-medium">TOP {bestChamps.length}</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {bestChamps.map((c) => (
                                  <div
                                    key={c.champ}
                                    className="inline-flex items-center gap-1 bg-[#08080c] border border-[#10b981]/25 px-1.5 py-0.5 rounded-[6px] text-[10px]"
                                    title={`${c.champ}: ${c.games}판 ${c.wins}승 ${c.losses}패 (${c.winrate.toFixed(0)}%)`}
                                  >
                                    <ChampionIcon name={c.champ} size={13} />
                                    <span className="font-semibold text-white truncate max-w-[50px]">{c.champ}</span>
                                    <span className="text-[#8a8aa0] text-[9px]">{c.games}판</span>
                                    <span
                                      className={`text-[9px] font-bold ${
                                        c.winrate >= 50 ? 'text-[#34d399]' : 'text-[#f87171]'
                                      }`}
                                    >
                                      ({c.winrate.toFixed(0)}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {best && bestChamps.length === 0 && (
                            <div className="mt-2 pt-2 border-t border-[#10b981]/15 text-[10px] text-[#6a6a80]">
                              해당 라인 챔피언 기록 없음
                            </div>
                          )}
                        </div>

                        {/* WORST */}
                        <div
                          onClick={(e) => {
                            if (worst) {
                              e.stopPropagation();
                              setSelectedModal({
                                woorimingLine: wRole,
                                partnerLine: pLine,
                                selectedStreamer: worst.name,
                              });
                            }
                          }}
                          className={`p-2 rounded-[10px] border transition ${
                            worst
                              ? 'bg-[#ef4444]/5 border-[#ef4444]/20 hover:bg-[#ef4444]/15'
                              : 'bg-transparent border-[#1e1e2a]'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1 text-[11px] text-[#ef4444] font-semibold">
                              <TrendingDown size={12} />
                              <span>WORST</span>
                            </div>
                            {worst ? (
                              <div className="flex items-center gap-2">
                                <StreamerAvatar name={worst.name} size={28} shape="circle" className="border border-[#ef4444]/40" />
                                <div className="text-right">
                                  <div className="text-[13px] font-bold text-white group-hover:text-[#fca5a5] transition">
                                    {worst.name}
                                  </div>
                                  <div className="text-[11px] text-[#8a8aa0]">
                                    {worst.games}판 {worst.wins}승 {worst.games - worst.wins}패{' '}
                                    <span className="text-[#ef4444] font-bold">
                                      {((worst.wins / worst.games) * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#5a5a6a]">조건 만족 없음</div>
                            )}
                          </div>

                          {/* Worst Most Champions */}
                          {worst && worstChamps.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[#ef4444]/15 space-y-1">
                              <div className="text-[10px] text-[#8a8aa0] flex items-center justify-between">
                                <span>{pLine} 최다 플레이</span>
                                <span className="text-[9px] text-[#ef4444] font-medium">TOP {worstChamps.length}</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {worstChamps.map((c) => (
                                  <div
                                    key={c.champ}
                                    className="inline-flex items-center gap-1 bg-[#08080c] border border-[#ef4444]/25 px-1.5 py-0.5 rounded-[6px] text-[10px]"
                                    title={`${c.champ}: ${c.games}판 ${c.wins}승 ${c.losses}패 (${c.winrate.toFixed(0)}%)`}
                                  >
                                    <ChampionIcon name={c.champ} size={13} />
                                    <span className="font-semibold text-white truncate max-w-[50px]">{c.champ}</span>
                                    <span className="text-[#8a8aa0] text-[9px]">{c.games}판</span>
                                    <span
                                      className={`text-[9px] font-bold ${
                                        c.winrate >= 50 ? 'text-[#34d399]' : 'text-[#f87171]'
                                      }`}
                                    >
                                      ({c.winrate.toFixed(0)}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {worst && worstChamps.length === 0 && (
                            <div className="mt-2 pt-2 border-t border-[#ef4444]/15 text-[10px] text-[#6a6a80]">
                              해당 라인 챔피언 기록 없음
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-[10px] text-[#4a4a5a] text-center pt-2 border-t border-[#1e1e2a]/50">
                      총 {allPartnersInLine.length}명의 {pLine} 선수 플레이 기록
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Full Partner Ranking & Match History Modal */}
      {selectedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-[fadeIn_0.15s]"
          onClick={() => setSelectedModal(null)}
        >
          <div
            className="w-full max-w-[880px] bg-[#12121a] border border-[#1e1e2a] rounded-[24px] p-6 max-h-[88vh] overflow-y-auto shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-[#1e1e2a] pb-4">
              <div>
                <div className="font-bold text-[17px] text-white flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#8b5cf6] text-white rounded text-[11px]">
                    우리밍_ {selectedModal.woorimingLine === 'ADC' ? '원딜' : '서폿'}
                  </span>
                  <span>×</span>
                  <span className="text-[#a78bfa]">{selectedModal.partnerLine} 파트너 상세 데이터</span>
                </div>
                <div className="text-[11px] text-[#8a8aa0] mt-1">
                  파트너별 승률 랭킹, 해당 라인 모스트 챔피언 TOP 3 및 스트리머 클릭 시 함께 출전한 전적(경기 목록) 확인
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedModal(null)}
                className="w-[30px] h-[30px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white text-[12px] transition"
              >
                <X size={15} />
              </button>
            </div>

            {/* Ranking Table */}
            <div>
              <div className="text-[12px] font-bold text-white mb-2 flex items-center justify-between">
                <span>파트너 랭킹 목록 (클릭하여 경기 목록 조회)</span>
                <span className="text-[11px] text-[#8a8aa0] font-normal">
                  승&gt;패: Best / 패&gt;승·0승: Worst • 모스트 챔피언 순
                </span>
              </div>
              <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[14px] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="text-[#6a6a80] text-[11px] bg-[#0f0f18] border-b border-[#1e1e2a]">
                      <tr>
                        <th className="text-left p-2.5">순위</th>
                        <th className="text-left p-2.5">스트리머</th>
                        <th className="text-left p-2.5">구분</th>
                        <th className="text-left p-2.5">전적</th>
                        <th className="text-right p-2.5">승률</th>
                        <th className="text-left p-2.5 min-w-[210px]">{selectedModal.partnerLine} 모스트 TOP 3</th>
                        <th className="text-center p-2.5">경기 목록</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const partners = (Object.values(
                          stats.partnerStats.overall[selectedModal.woorimingLine]
                        ) as PartnerStat[])
                          .filter((p) => p.line === selectedModal.partnerLine)
                          .sort(
                            (a, b) => b.wins / b.games - a.wins / a.games || b.wins - a.wins || b.games - a.games
                          );

                        if (partners.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-[#5a5a6a]">
                                해당 포지션과 함께한 경기 기록이 없습니다.
                              </td>
                            </tr>
                          );
                        }

                        return partners.map((p, idx) => {
                          const rate = (p.wins / p.games) * 100;
                          const isSelected = selectedModal.selectedStreamer === p.name;
                          const isBestCandidate = p.wins > 0 && p.wins > p.games - p.wins;
                          const isWorstCandidate = p.wins === 0 || p.games - p.wins > p.wins;
                          const pChamps = getPlayerLineChampionStats(p.name, selectedModal.partnerLine, matches).slice(0, 3);

                          return (
                            <tr
                              key={p.name}
                              onClick={() =>
                                setSelectedModal((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        selectedStreamer: prev.selectedStreamer === p.name ? null : p.name,
                                      }
                                    : null
                                )
                              }
                              className={`border-t border-[#1e1e2a] cursor-pointer transition ${
                                isSelected
                                  ? 'bg-[#8b5cf6]/20 border-l-4 border-l-[#8b5cf6]'
                                  : 'hover:bg-[#1a1a26]'
                              }`}
                            >
                              <td className="p-2.5 text-[#8a8aa0] font-medium">{idx + 1}</td>
                              <td className="p-2.5 font-bold text-white flex items-center gap-2">
                                <StreamerAvatar name={p.name} size={22} shape="circle" />
                                <span>{p.name}</span>
                                {isSelected && (
                                  <span className="text-[10px] bg-[#8b5cf6] text-white px-1.5 py-0.2 rounded font-normal">
                                    선택됨
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {isBestCandidate ? (
                                  <span className="text-[10px] font-semibold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 px-1.5 py-0.5 rounded">
                                    BEST
                                  </span>
                                ) : isWorstCandidate ? (
                                  <span className="text-[10px] font-semibold bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30 px-1.5 py-0.5 rounded">
                                    WORST
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold bg-[#8a8aa0]/15 text-[#8a8aa0] px-1.5 py-0.5 rounded">
                                    50%
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-[#c0c0d0]">
                                {p.games}판 <span className="text-[#3b82f6] font-semibold">{p.wins}승</span>{' '}
                                <span className="text-[#ef4444] font-semibold">{p.games - p.wins}패</span>
                              </td>
                              <td className="p-2.5 text-right">
                                <span
                                  className={`font-bold min-w-[36px] ${
                                    rate >= 50 ? 'text-[#3b82f6]' : 'text-[#ef4444]'
                                  }`}
                                >
                                  {rate.toFixed(0)}%
                                </span>
                              </td>
                              <td className="p-2.5">
                                {pChamps.length === 0 ? (
                                  <span className="text-[11px] text-[#5a5a6a]">기록 없음</span>
                                ) : (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {pChamps.map((c) => (
                                      <div
                                        key={c.champ}
                                        className="inline-flex items-center gap-1 bg-[#12121c] border border-[#252538] hover:border-[#8b5cf6]/40 px-2 py-0.5 rounded-[7px] text-[11px] transition-colors"
                                        title={`${c.champ}: ${c.games}판 ${c.wins}승 ${c.losses}패 (${c.winrate.toFixed(0)}%)`}
                                      >
                                        <ChampionIcon name={c.champ} size={15} />
                                        <span className="font-semibold text-white">{c.champ}</span>
                                        <span className="text-[#8a8aa0] text-[10px] ml-0.5">
                                          {c.games}판
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold ${
                                            c.winrate >= 50 ? 'text-[#38bdf8]' : 'text-[#f87171]'
                                          }`}
                                        >
                                          ({c.winrate.toFixed(0)}%)
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="text-[11px] text-[#a78bfa] underline hover:text-white">
                                  {isSelected ? '접기 ▲' : '보기 ▼'}
                                </span>
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

            {/* Match History for Selected Streamer */}
            {selectedModal.selectedStreamer && (
              <div className="border-t border-[#1e1e2a] pt-4 animate-[fadeIn_0.2s]">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="text-[13px] font-bold text-white flex items-center gap-2">
                    <Swords size={16} className="text-[#8b5cf6]" />
                    <StreamerAvatar name={selectedModal.selectedStreamer || ''} size={22} shape="circle" />
                    <span>우리밍_ × {selectedModal.selectedStreamer} 함께 플레이한 경기 목록</span>
                    <span className="text-[11px] bg-[#8b5cf6]/20 text-[#a78bfa] px-2 py-0.5 rounded-full">
                      총 {partnerMatches.length}경기
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onJumpToStreamer && (
                      <button
                        type="button"
                        onClick={() => {
                          const name = selectedModal.selectedStreamer || '';
                          setSelectedModal(null);
                          onJumpToStreamer(name);
                        }}
                        className="px-2.5 py-1 bg-[#8b5cf6]/20 hover:bg-[#8b5cf6] text-[#c4b5fd] hover:text-white border border-[#8b5cf6]/40 rounded-full text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <Zap size={11} />
                        <span>CK 일지 이동</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedModal((prev) => (prev ? { ...prev, selectedStreamer: null } : null))
                      }
                      className="text-[11px] text-[#8a8aa0] hover:text-white"
                    >
                      목록 닫기
                    </button>
                  </div>
                </div>

                {partnerMatches.length === 0 ? (
                  <div className="p-5 text-center text-[12px] text-[#6a6a80] bg-[#08080c] rounded-[12px] border border-[#1e1e2a]">
                    함께한 세부 경기 기록이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {partnerMatches.map((m) => {
                      const wTeam = getWoorimingTeam(m);
                      const wRoster = wTeam === 'Red' ? m.team_a : m.team_b;
                      const wChamps = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
                      const wKdas = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;
                      const wKey = getWoorimingLineKey(m);

                      const pKey = (Object.keys(LINE_LABELS) as LineKey[]).find(
                        (k) => LINE_LABELS[k] === selectedModal.partnerLine
                      ) || 'top';

                      const won = m.winning_team === wTeam;

                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-[12px] border flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-[12px] transition ${
                            won
                              ? 'bg-[rgba(59,130,246,0.08)] border-[#3b82f6]/30'
                              : 'bg-[rgba(239,68,68,0.08)] border-[#ef4444]/30'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  won
                                    ? 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/40'
                                    : 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/40'
                                }`}
                              >
                                {won ? '승리' : '패배'}
                              </span>
                              <span className="text-[#8a8aa0] text-[11px] flex items-center gap-1">
                                <Calendar size={11} />
                                {m.date}
                              </span>
                              <span className="font-semibold text-white truncate max-w-[200px]">
                                {m.ck_name}
                              </span>
                            </div>

                            <div className="text-[11px] text-[#c0c0d0] flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1">
                                <strong className="text-[#8b5cf6]">우리밍_({LINE_LABELS[wKey]}):</strong>{' '}
                                {wChamps[wKey] ? (
                                  <>
                                    <ChampionIcon name={wChamps[wKey]} size={14} />
                                    <span>{wChamps[wKey]}</span>
                                  </>
                                ) : (
                                  <span>-</span>
                                )}
                                {wKdas[wKey] ? ` (${wKdas[wKey]})` : ''}
                              </span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                <strong>
                                  {selectedModal.selectedStreamer}({selectedModal.partnerLine}):
                                </strong>{' '}
                                {wChamps[pKey] ? (
                                  <>
                                    <ChampionIcon name={wChamps[pKey]} size={14} />
                                    <span>{wChamps[pKey]}</span>
                                  </>
                                ) : (
                                  <span>-</span>
                                )}
                                {wKdas[pKey] ? ` (${wKdas[pKey]})` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            <div className="text-[11px] font-bold text-white">
                              {m.winning_team === 'Red' ? 'RED팀' : 'BLUE팀'} {m.score || ''}
                            </div>
                            <div className="text-[10px] text-[#8a8aa0]">
                              소속: {wTeam === 'Red' ? '🔴 Red팀' : '🔵 Blue팀'}
                            </div>
                            {onJumpToStreamer && (
                              <button
                                type="button"
                                onClick={() => {
                                  const name = selectedModal.selectedStreamer || '';
                                  setSelectedModal(null);
                                  onJumpToStreamer(name, m.id, 'ally');
                                }}
                                className="mt-0.5 px-2 py-0.5 rounded bg-[#1e1e30] hover:bg-[#8b5cf6] text-[#c0c0d8] hover:text-white rounded-md text-[10px] font-bold border border-[#2a2a44] transition flex items-center gap-1"
                                title="CK 일지의 해당 세트 카드로 이동"
                              >
                                <span>이 세트로 이동</span>
                                <Zap size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
