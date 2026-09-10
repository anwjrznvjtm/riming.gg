import React, { useState, useRef } from 'react';
import { Match, LineKey, LineName, TeamRoster, SynergyAnalysisResult, PartnerStat, LINE_KEYS, LINE_LABELS } from '../types';
import { ComputedStats, getPlayerSynergyRate, getCombinations } from '../lib/stats';
import { Zap, Sparkles, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';

interface MainTabProps {
  stats: ComputedStats;
  matches: Match[];
  onOpenSummaryModal: () => void;
  onToast: (msg: string) => void;
  allStreamers: string[];
}

export const MainTab: React.FC<MainTabProps> = ({
  stats,
  matches,
  onOpenSummaryModal,
  onToast,
  allStreamers,
}) => {
  const emptyRoster: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };

  const [teamA, setTeamA] = useState<TeamRoster>({ ...emptyRoster });
  const [teamB, setTeamB] = useState<TeamRoster>({ ...emptyRoster });
  const [errorMsg, setErrorMsg] = useState('');
  const [analysisResult, setAnalysisResult] = useState<SynergyAnalysisResult | null>(null);
  const [isResultCollapsed, setIsResultCollapsed] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  // Fill example rosters using registered streamers only
  const handleFillExample = () => {
    if (allStreamers.length < 10) {
      onToast(`CK 일지에 등록된 스트리머가 10명 이상이어야 자동 채우기가 가능합니다. (현재 ${allStreamers.length}명)`);
      return;
    }
    const others = allStreamers.filter((s) => s !== '우리밍');
    setTeamA({
      top: others[0] || '',
      jgl: others[1] || '',
      mid: others[2] || '',
      adc: '우리밍',
      sup: others[3] || '',
    });
    setTeamB({
      top: others[4] || '',
      jgl: others[5] || '',
      mid: others[6] || '',
      adc: others[7] || '',
      sup: others[8] || '',
    });
    setErrorMsg('');
    onToast('CK 일지에 등록된 스트리머 10인으로 채워졌습니다.');
  };

  const handleClearTeams = () => {
    setTeamA({ top: '', jgl: '', mid: '', adc: '', sup: '' });
    setTeamB({ top: '', jgl: '', mid: '', adc: '', sup: '' });
    setAnalysisResult(null);
    setErrorMsg('');
    onToast('입력창이 비워졌습니다.');
  };

  // Evaluate Current Teams Synergy
  const handleAnalyzeCurrent = () => {
    setErrorMsg('');
    const playersA = LINE_KEYS.map((k) => ({
      lineKey: k,
      line: LINE_LABELS[k],
      player: teamA[k].trim(),
    })).filter((x) => Boolean(x.player));

    const playersB = LINE_KEYS.map((k) => ({
      lineKey: k,
      line: LINE_LABELS[k],
      player: teamB[k].trim(),
    })).filter((x) => Boolean(x.player));

    const allEntered = [...playersA.map((p) => p.player), ...playersB.map((p) => p.player)];

    if (allEntered.length < 10) {
      setErrorMsg(`10개 라인에 모든 선수를 채워야 분석이 가능합니다. (현재 ${allEntered.length}/10명)`);
      return;
    }

    if (!allEntered.includes('우리밍')) {
      setErrorMsg('우리밍이 10명 중에 포함되어야 시너지 분석이 가능합니다.');
      return;
    }

    const wInA = playersA.some((p) => p.player === '우리밍');
    const wTeam: 'Red' | 'Blue' = wInA ? 'Red' : 'Blue';
    const teammates = (wInA ? playersA : playersB).filter((p) => p.player !== '우리밍');

    // Wooriming synergy score with teammates
    const directSynergy =
      teammates.reduce((acc, p) => acc + getPlayerSynergyRate('우리밍', p.player, stats.pairWinrates), 0) /
      (teammates.length || 1);

    // Mutual synergies among other teammates
    let mutualSum = 0;
    let mutualCount = 0;
    for (let i = 0; i < teammates.length; i++) {
      for (let j = i + 1; j < teammates.length; j++) {
        mutualSum += getPlayerSynergyRate(teammates[i].player, teammates[j].player, stats.pairWinrates);
        mutualCount++;
      }
    }
    const mutualAvg = mutualCount ? mutualSum / mutualCount : 0.5;
    const finalExpected = directSynergy * 0.7 + mutualAvg * 0.3;

    const breakdown = teammates.map((t) => {
      const pairKey = [t.player, '우리밍'].sort().join('|');
      const pStat = stats.pairWinrates.get(pairKey);
      return {
        name: t.player,
        winrate: getPlayerSynergyRate('우리밍', t.player, stats.pairWinrates) * 100,
        games: pStat?.games || 0,
        line: t.line,
      };
    });

    setAnalysisResult({
      mode: 'current',
      teamA: playersA.map((p) => ({ line: p.line, player: p.player })),
      teamB: playersB.map((p) => ({ line: p.line, player: p.player })),
      expected: finalExpected * 100,
      breakdown,
      wTeam,
    });
    setIsResultCollapsed(false);

    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  // Optimize Teams based on Winrates
  const handleOptimizeTeams = () => {
    setErrorMsg('');
    const rawList = ([...Object.values(teamA), ...Object.values(teamB)] as string[])
      .map((s) => s.trim())
      .filter(Boolean);

    // Deduplicate
    const uniqueList: string[] = [];
    const seen = new Set<string>();
    for (const p of rawList) {
      if (!seen.has(p)) {
        seen.add(p);
        uniqueList.push(p);
      }
    }

    let players = uniqueList;
    if (!players.includes('우리밍')) {
      if (players.length >= 10) players.pop();
      players.push('우리밍');
    }

    if (players.length < 10) {
      setErrorMsg(`10명의 선수가 필요합니다. (현재 ${players.length}/10명)`);
      return;
    }

    if (players.length > 10) {
      players = ['우리밍', ...players.filter((x) => x !== '우리밍').slice(0, 9)];
    }

    const nonW = players.filter((p) => p !== '우리밍');
    const combos = getCombinations(nonW, 4);

    const scoredCombos = combos.map((combo) => {
      const direct =
        combo.reduce((acc, p) => acc + getPlayerSynergyRate('우리밍', p, stats.pairWinrates), 0) /
        combo.length;
      let mutualSum = 0,
        mutualCnt = 0;
      for (let i = 0; i < combo.length; i++) {
        for (let j = i + 1; j < combo.length; j++) {
          mutualSum += getPlayerSynergyRate(combo[i], combo[j], stats.pairWinrates);
          mutualCnt++;
        }
      }
      const mutualAvg = mutualCnt ? mutualSum / mutualCnt : 0.5;
      const base = direct * 0.7 + mutualAvg * 0.3;
      return { combo, score: base };
    });

    scoredCombos.sort((a, b) => b.score - a.score);
    const topPick = scoredCombos[0];
    const bestCombo = topPick.combo;
    const bestScore = topPick.score;

    const remaining = players.filter((p) => !bestCombo.includes(p) && p !== '우리밍');

    // Assign to lines based on primary played positions
    function assignLines(playerGroup: string[]) {
      const result: { line: LineName; player: string }[] = [];
      const usedLines = new Set<LineName>();
      const sorted = [...playerGroup].sort((a, b) => {
        if (a === '우리밍') return -1;
        if (b === '우리밍') return 1;
        return 0;
      });

      for (const p of sorted) {
        const preferred = stats.playerPrimaryLines[p] || 'TOP';
        if (!usedLines.has(preferred)) {
          result.push({ line: preferred, player: p });
          usedLines.add(preferred);
        } else {
          const avail = (['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as LineName[]).find(
            (l) => !usedLines.has(l)
          );
          if (avail) {
            result.push({ line: avail, player: p });
            usedLines.add(avail);
          }
        }
      }

      const order: Record<LineName, number> = { TOP: 0, JGL: 1, MID: 2, ADC: 3, SUP: 4 };
      return result.sort((a, b) => order[a.line] - order[b.line]);
    }

    const teamRedRoster = assignLines(['우리밍', ...bestCombo]);
    const teamBlueRoster = assignLines(remaining);

    const breakdown = bestCombo.map((p) => {
      const pairKey = [p, '우리밍'].sort().join('|');
      const pStat = stats.pairWinrates.get(pairKey);
      return {
        name: p,
        winrate: getPlayerSynergyRate('우리밍', p, stats.pairWinrates) * 100,
        games: pStat?.games || 0,
        line: teamRedRoster.find((x) => x.player === p)?.line || stats.playerPrimaryLines[p] || 'TOP',
      };
    });

    setAnalysisResult({
      mode: 'optimal',
      teamA: teamRedRoster,
      teamB: teamBlueRoster,
      expected: bestScore * 100,
      breakdown,
      wTeam: 'Red',
    });
    setIsResultCollapsed(false);

    onToast('승률 기반 최적 5:5 팀이 도출되었습니다!');
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  // Best partners this month
  const targetRole = stats.dominantMonthRole;
  const partnerRoleList = targetRole === 'ADC' ? ['TOP', 'JGL', 'MID', 'SUP'] : ['TOP', 'JGL', 'MID', 'ADC'];
  const bestPartners = partnerRoleList.map((line) => {
    const rolePartners = (Object.values(stats.partnerStats.thisMonth[targetRole]) as PartnerStat[]).filter(
      (p) => p.line === line
    );
    rolePartners.sort(
      (a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games
    );
    return {
      line,
      best: rolePartners[0] || null,
    };
  });

  const displayWinrate = stats.thisMonthWinrate.total
    ? stats.thisMonthWinrate.winrate
    : stats.overallWinrate.winrate;
  const circumference = 2 * Math.PI * 62;

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8">
      {/* Left Column: Wooriming Winrate & Trends */}
      <div className="md:w-[35%] w-full space-y-4">
        {/* Donut Card */}
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[24px] p-6 md:p-8 flex flex-col items-center">
          <div
            onClick={onOpenSummaryModal}
            title="클릭하면 전체 전적 상세 보기"
            className="relative w-[140px] h-[140px] flex items-center justify-center cursor-pointer hover:scale-[1.04] transition-transform group"
          >
            <svg width="140" height="140" className="absolute inset-0 -rotate-90">
              <circle cx="70" cy="70" r="62" stroke="#1e1e2a" strokeWidth="8" fill="none" />
              <circle
                cx="70"
                cy="70"
                r="62"
                stroke="#8b5cf6"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * displayWinrate) / 100}
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <div className="w-[112px] h-[112px] rounded-full bg-[#08080c] border border-[#1e1e2a] group-hover:border-[#8b5cf6]/40 flex flex-col items-center justify-center transition-colors">
              <div className="text-[28px] font-black tracking-tight text-white">우</div>
              <div className="text-[20px] font-bold text-[#8b5cf6]">
                {displayWinrate.toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="mt-5 text-center">
            <div className="text-[18px] font-bold tracking-tight text-white">우리밍</div>
            <div className="mt-2 inline-flex items-center gap-2 bg-[#1e1e2a] border border-[#2a2a3a] rounded-full px-3 py-1 text-[11px] text-[#a0a0b8]">
              <span>이번달 ({stats.latestMonth})</span>
              <span>•</span>
              <span className="font-semibold text-[#a78bfa]">{stats.dominantMonthRole}</span>
            </div>
          </div>

          <div className="mt-4 text-[13px] text-[#c0c0d0] font-medium">
            {stats.thisMonthWinrate.wins}승 {stats.thisMonthWinrate.losses}패 / 총{' '}
            {stats.thisMonthWinrate.total}판
          </div>
          <div className="mt-1 text-[11px] text-[#6a6a80]">클릭하면 전체 전적 보기</div>
        </div>

        {/* Winrate Graph Card */}
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-4 shadow-[0_0_0_1px_rgba(139,92,246,0.12)]">
          <div className="text-[13px] font-bold mb-3 flex items-center justify-between text-white">
            <span className="flex items-center gap-2">📊 승률 추이</span>
            <span className="text-[11px] font-normal text-[#8a8aa0]">2026 시즌</span>
          </div>

          <div className="flex justify-between items-center bg-[#08080c] border border-[#1e1e2a] rounded-[10px] px-3 py-2.5 mb-4">
            <span className="text-[12px] text-[#8a8aa0]">전체 승률</span>
            <span className="text-[14px] font-bold text-[#8b5cf6]">
              {stats.overallWinrate.winrate.toFixed(0)}% ({stats.overallWinrate.wins}승{' '}
              {stats.overallWinrate.losses}패)
            </span>
          </div>

          {/* Monthly Bar chart */}
          <div className="mb-4">
            <div className="text-[11px] text-[#6a6a80] mb-2 font-semibold">월별 승률</div>
            <div className="flex items-end gap-2 h-24 bg-[#08080c] border border-[#1e1e2a] rounded-[12px] p-3">
              {stats.monthlyStats
                .filter((m) => m.month >= '2026-07')
                .reverse()
                .map((m) => {
                  const rate = m.winrate;
                  const barColor = rate >= 60 ? '#8b5cf6' : rate >= 50 ? '#6366f1' : '#4b5563';
                  const barHeight = Math.max(8, (rate / 100) * 64);
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col items-center justify-end h-full"
                    >
                      <div className="text-[10px] font-bold text-[#c0c0d0] mb-1">
                        {rate.toFixed(0)}%
                      </div>
                      <div
                        className="w-full rounded-t-[6px] transition-all"
                        style={{ height: `${barHeight}px`, background: barColor, minHeight: '6px' }}
                        title={`${m.month} ${rate.toFixed(1)}% (${m.wins}승 ${m.losses}패)`}
                      />
                      <div className="text-[10px] text-[#6a6a80] mt-1.5 whitespace-nowrap">
                        {m.month.slice(5)}월
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Recent 10 games streak */}
          <div>
            <div className="text-[11px] text-[#6a6a80] mb-2 font-semibold flex items-center justify-between">
              <span>최근 10경기 흐름</span>
              <span className="text-[9px] text-[#5a5a6a]">W:승 / L:패</span>
            </div>
            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[12px] p-3">
              <div className="flex gap-1.5">
                {stats.recentTenMatches.length === 0 ? (
                  <div className="text-[11px] text-[#5a5a6a]">경기 데이터가 없습니다.</div>
                ) : (
                  stats.recentTenMatches.map(({ match, won }) => (
                    <div
                      key={match.id}
                      className={`flex-1 h-[36px] rounded-[8px] flex items-center justify-center text-[12px] font-black border transition-transform hover:scale-105 ${
                        won
                          ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
                          : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                      }`}
                      title={`${match.date} ${match.ck_name} - ${won ? '승리' : '패배'}`}
                    >
                      {won ? 'W' : 'L'}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-[#5a5a6a]">
                <span>과거</span>
                <span>최신</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Line-by-line Roster Input & Optimizer */}
      <div className="md:w-[65%] w-full space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#8b5cf6]/25 to-[#8b5cf6]/5 border border-[#8b5cf6]/40 rounded-[16px] p-4 flex items-start gap-3 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
          <div className="text-[18px]">⚡</div>
          <div className="text-[13px] md:text-[14px] font-bold leading-[1.4] text-[#ece4ff] flex-1">
            승률 기반으로 최고의 시너지팀을 짜드립니다 - CK 10인 이름을 넣으면 최적의 5:5를 추천
          </div>
          <span className="shrink-0 inline-flex bg-[#8b5cf6] text-white text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wide">
            CK 밸런서
          </span>
        </div>

        {/* Input Card */}
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold text-white flex items-center gap-2">
              <span>라인별 팀 입력</span>
              <span className="text-[11px] font-normal text-[#8a8aa0]">(10인 명단)</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearTeams}
                className="h-[30px] px-3 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-full text-[11px] text-[#a0a0b8] transition"
              >
                비우기
              </button>
              <button
                type="button"
                onClick={handleFillExample}
                className="h-[30px] px-3 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-full text-[11px] text-[#c0c0d0] flex items-center gap-1.5 transition"
              >
                <Sparkles size={12} className="text-[#a78bfa]" />
                <span>등록 선수 채우기</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Red Team Input */}
            <div className="bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.18)] rounded-[14px] p-3.5">
              <div className="text-[12px] font-bold mb-3 flex items-center gap-2 text-[#ef4444]">
                🔴 Red팀
              </div>
              <div className="space-y-2">
                {LINE_KEYS.map((k) => (
                  <div key={`A-${k}`} className="flex items-center gap-2">
                    <span className="w-[36px] text-[11px] font-bold text-[#8a8aa0] tracking-widest">
                      {LINE_LABELS[k]}
                    </span>
                    <input
                      id={`teamA-${k}`}
                      value={teamA[k]}
                      onChange={(e) => setTeamA((prev) => ({ ...prev, [k]: e.target.value }))}
                      placeholder="스트리머 이름"
                      list="players-datalist"
                      className="flex-1 h-[34px] bg-[#12121a] border border-[rgba(239,68,68,0.25)] rounded-full px-3 text-[12px] placeholder:text-[#4a4a5a] focus:outline-none focus:border-[#ef4444]/60 transition"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Blue Team Input */}
            <div className="bg-[rgba(59,130,246,0.05)] border border-[rgba(59,130,246,0.18)] rounded-[14px] p-3.5">
              <div className="text-[12px] font-bold mb-3 flex items-center gap-2 text-[#3b82f6]">
                🔵 Blue팀
              </div>
              <div className="space-y-2">
                {LINE_KEYS.map((k) => (
                  <div key={`B-${k}`} className="flex items-center gap-2">
                    <span className="w-[36px] text-[11px] font-bold text-[#8a8aa0] tracking-widest">
                      {LINE_LABELS[k]}
                    </span>
                    <input
                      id={`teamB-${k}`}
                      value={teamB[k]}
                      onChange={(e) => setTeamB((prev) => ({ ...prev, [k]: e.target.value }))}
                      placeholder="스트리머 이름"
                      list="players-datalist"
                      className="flex-1 h-[34px] bg-[#12121a] border border-[rgba(59,130,246,0.25)] rounded-full px-3 text-[12px] placeholder:text-[#4a4a5a] focus:outline-none focus:border-[#3b82f6]/60 transition"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-3 text-[12px] text-[#ff6b6b] bg-[#2a1a1a]/60 border border-[#ff6b6b]/30 rounded-[10px] px-3.5 py-2">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleAnalyzeCurrent}
              className="h-[36px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-full text-[12px] font-semibold text-[#c0c0d0] transition"
            >
              현재 팀 시너지 분석
            </button>
            <button
              type="button"
              onClick={handleOptimizeTeams}
              className="h-[36px] px-5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-bold shadow-[0_0_15px_rgba(139,92,246,0.3)] transition"
            >
              승률 기반 최적 팀으로 재배치
            </button>
          </div>

          {/* Synergy Analysis Output Card */}
          {analysisResult && (
            <div
              ref={resultRef}
              className="mt-5 bg-[#0f0f18] border border-[#1e1e2a] rounded-[16px] overflow-hidden transition-all shadow-xl"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-[#12121a] border-b border-[#1e1e2a]">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-white">분석 결과</span>
                  <span className="text-[11px] bg-[#8b5cf6]/20 text-[#a78bfa] border border-[#8b5cf6]/30 px-2.5 py-0.5 rounded-full font-medium">
                    {analysisResult.mode === 'optimal' ? '최적 재배치' : '현재 팀 분석'} • 예상 승률{' '}
                    {analysisResult.expected.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsResultCollapsed((prev) => !prev)}
                    className="h-[26px] px-2.5 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-full text-[11px] text-[#c0c0d0] flex items-center gap-1"
                  >
                    {isResultCollapsed ? (
                      <>
                        <ChevronDown size={12} /> 펼치기
                      </>
                    ) : (
                      <>
                        <ChevronUp size={12} /> 접기
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisResult(null)}
                    className="h-[26px] w-[26px] bg-[#2a1a1a] hover:bg-[#3a1a1a] border border-[#3a2a2a] rounded-full text-[12px] text-[#ff8a8a] flex items-center justify-center"
                    title="닫기"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {!isResultCollapsed && (
                <div className="p-4 grid md:grid-cols-2 gap-4">
                  {/* Team A Roster Card */}
                  <div className="bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.25)] rounded-[14px] p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-[13px] font-bold text-[#ef4444]">
                        {analysisResult.mode === 'optimal'
                          ? '최적 🔴 Red팀 (우리밍팀)'
                          : `🔴 Red팀 ${analysisResult.wTeam === 'Red' ? '(우리밍팀)' : ''}`}
                      </div>
                      <div className="text-[11px] bg-[#ef4444] text-white px-2 py-0.5 rounded-full font-bold">
                        {analysisResult.expected.toFixed(1)}% 예상 승률
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {analysisResult.teamA.map((p) => (
                        <div
                          key={`RA-${p.line}-${p.player}`}
                          className="flex justify-between items-center text-[12px] bg-[#12121a] rounded-[8px] px-2.5 py-1.5 border border-[#1e1e2a]"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-[10px] text-[#6a6a80] w-[30px] font-bold">
                              {p.line}
                            </span>
                            <span
                              className={
                                p.player === '우리밍' ? 'font-bold text-[#8b5cf6]' : 'text-white'
                              }
                            >
                              {p.player}
                            </span>
                          </span>
                          {p.player !== '우리밍' && (
                            <span className="text-[#8b5cf6] text-[11px] font-semibold">
                              {(getPlayerSynergyRate('우리밍', p.player, stats.pairWinrates) * 100).toFixed(0)}
                              %
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 text-[11px] text-[#8a8aa0] space-y-1 border-t border-[#1e1e2a] pt-2">
                      <div className="text-[10px] text-[#6a6a80] font-semibold mb-1">우리밍과의 판수 & 승률</div>
                      {analysisResult.breakdown.map((b) => (
                        <div key={b.name} className="flex justify-between text-[11px]">
                          <span>
                            {b.name} ({b.line})
                          </span>
                          <span className="text-[#c0c0d0]">
                            {b.winrate.toFixed(0)}% ({b.games}판)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team B Roster Card */}
                  <div className="bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.25)] rounded-[14px] p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-[13px] font-bold text-[#3b82f6]">
                        {analysisResult.mode === 'optimal'
                          ? '최적 🔵 Blue팀 (상대팀)'
                          : `🔵 Blue팀 ${analysisResult.wTeam === 'Blue' ? '(우리밍팀)' : ''}`}
                      </div>
                      <div className="text-[11px] bg-[#3b82f6] text-white px-2 py-0.5 rounded-full font-bold">
                        {(100 - analysisResult.expected).toFixed(1)}% 예상 승률
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {analysisResult.teamB.map((p) => (
                        <div
                          key={`RB-${p.line}-${p.player}`}
                          className="flex justify-between items-center text-[12px] bg-[#12121a] rounded-[8px] px-2.5 py-1.5 border border-[#1e1e2a]"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-[10px] text-[#6a6a80] w-[30px] font-bold">
                              {p.line}
                            </span>
                            <span className="text-white">{p.player}</span>
                          </span>
                        </div>
                      ))}
                    </div>

                    {analysisResult.mode === 'optimal' && (
                      <div className="mt-3 text-[10px] text-[#6a6a80] leading-relaxed">
                        * 라인 배치는 각 플레이어의 주 포지션(과거 경기 데이터 빈도)을 반영하여 자동 분배되었습니다.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Best Partners Card */}
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 md:p-6">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-[15px] font-bold text-white">이번달 라인별 Best 파트너</h2>
            <span className="text-[11px] text-[#a78bfa] font-medium bg-[#8b5cf6]/10 px-2.5 py-0.5 rounded-full">
              우리밍 {stats.dominantMonthRole} 기준
            </span>
          </div>
          <div className="text-[11px] text-[#6a6a80] mb-4">
            {stats.latestMonth} 경기 기준 • 함께 플레이했을 때 승률이 가장 높은 파트너
          </div>

          <div className="grid grid-cols-2 gap-3">
            {bestPartners.map((item) => (
              <div
                key={item.line}
                className="bg-[#08080c] border border-[#1e1e2a] rounded-[14px] p-4 hover:border-[#8b5cf6]/30 transition"
              >
                <div className="text-[10px] tracking-widest text-[#8a8aa0] font-semibold">
                  {item.line} 라인 Best
                </div>
                {item.best ? (
                  <>
                    <div className="mt-1 text-[14px] font-bold text-white">
                      {item.best.name}{' '}
                      <span className="text-[11px] font-normal text-[#8a8aa0]">
                        ({item.best.line})
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-[#c0c0d0]">
                      {item.best.games}전 {item.best.wins}승 {item.best.games - item.best.wins}패 •{' '}
                      <span className="text-[#8b5cf6] font-bold">
                        {((item.best.wins / item.best.games) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-2 h-[4px] bg-[#1e1e2a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#8b5cf6]"
                        style={{ width: `${(item.best.wins / item.best.games) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-[12px] text-[#5a5a6a]">데이터 없음</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
