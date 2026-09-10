import React, { useState, useMemo } from 'react';
import { Match, LineKey, MatchFormat, WinningTeam, LINE_KEYS, LINE_LABELS } from '../types';
import { ComputedStats, formatPlayerWithChamp, isKdaEmpty, getWoorimingTeam, getWoorimingLine } from '../lib/stats';
import { PASSCODE } from '../data/initialMatches';
import { Plus, Search, Filter, ShieldAlert, X, Edit2, Trash2, Eye, Save, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

interface JournalTabProps {
  stats: ComputedStats;
  matches: Match[];
  onAddMatch: (match: Match) => void;
  onUpdateMatch: (match: Match) => void;
  onDeleteMatch: (id: string) => void;
  isAdmin: boolean;
  onAdminLoginSuccess: () => void;
  onToast: (msg: string) => void;
  allStreamers: string[];
  allChampions: string[];
}

export const JournalTab: React.FC<JournalTabProps> = ({
  stats,
  matches,
  onAddMatch,
  onUpdateMatch,
  onDeleteMatch,
  isAdmin,
  onAdminLoginSuccess,
  onToast,
  allStreamers,
  allChampions,
}) => {
  const [filterDate, setFilterDate] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterLine, setFilterLine] = useState('ALL');

  const [isChampsModalOpen, setIsChampsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [formError, setFormError] = useState('');

  // Form State
  const emptyRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
  const [formData, setFormData] = useState<Match>({
    id: '',
    date: new Date().toISOString().slice(0, 10),
    ck_name: '',
    team_a: { ...emptyRoster, adc: '우리밍_' },
    team_b: { ...emptyRoster },
    team_a_champs: { ...emptyRoster },
    team_b_champs: { ...emptyRoster },
    ban_a: ['', '', '', '', ''],
    ban_b: ['', '', '', '', ''],
    team_a_kda: { ...emptyRoster },
    team_b_kda: { ...emptyRoster },
    score: '1:0',
    winning_team: 'Red',
    match_format: '단판',
    set_number: 1,
  });

  const [formPasscode, setFormPasscode] = useState('');
  const [persistAdminInForm, setPersistAdminInForm] = useState(true);

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePasscode, setDeletePasscode] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Filtered matches
  const filteredMatches = matches
    .filter((m) => {
      if (filterDate && !m.date.includes(filterDate)) return false;
      if (filterName && !m.ck_name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterLine !== 'ALL') {
        const line = getWoorimingLine(m);
        if (line !== filterLine) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  // Find where Wooriming is currently placed in formData
  const woorimingLocation = useMemo(() => {
    for (const teamKey of ['team_a', 'team_b'] as const) {
      for (const l of LINE_KEYS) {
        if (formData[teamKey][l]?.trim() === '우리밍_') {
          return { team: teamKey, line: l };
        }
      }
    }
    return null;
  }, [formData.team_a, formData.team_b]);

  // Set Wooriming position exclusively (clears from other slots)
  const handleSetWooriming = (targetTeam: 'team_a' | 'team_b', targetLine: LineKey) => {
    setFormData((prev) => {
      const nextA = { ...prev.team_a };
      const nextB = { ...prev.team_b };
      for (const l of LINE_KEYS) {
        if (nextA[l]?.trim() === '우리밍_') nextA[l] = '';
        if (nextB[l]?.trim() === '우리밍_') nextB[l] = '';
      }
      if (targetTeam === 'team_a') {
        nextA[targetLine] = '우리밍_';
      } else {
        nextB[targetLine] = '우리밍_';
      }
      return {
        ...prev,
        team_a: nextA,
        team_b: nextB,
      };
    });
    setFormError('');
  };

  const handleOpenAddModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setFormData({
      id: `m_${Date.now()}`,
      date: today,
      ck_name: '',
      team_a: { ...emptyRoster, adc: '우리밍_' }, // Default ouriming to Red ADC
      team_b: { ...emptyRoster },
      team_a_champs: { ...emptyRoster },
      team_b_champs: { ...emptyRoster },
      ban_a: ['', '', '', '', ''],
      ban_b: ['', '', '', '', ''],
      team_a_kda: { ...emptyRoster },
      team_b_kda: { ...emptyRoster },
      score: '1:0',
      winning_team: 'Red',
      match_format: '단판',
      set_number: 1,
    });
    setEditingMatch(null);
    setFormPasscode('');
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (m: Match) => {
    setFormData({
      ...m,
      team_a: { ...m.team_a },
      team_b: { ...m.team_b },
      team_a_champs: { ...m.team_a_champs },
      team_b_champs: { ...m.team_b_champs },
      ban_a: [...m.ban_a],
      ban_b: [...m.ban_b],
      team_a_kda: { ...m.team_a_kda },
      team_b_kda: { ...m.team_b_kda },
    });
    setEditingMatch(m);
    setFormPasscode('');
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleSaveMatch = () => {
    // 1. Check Passcode if not already admin
    if (!isAdmin) {
      const cleanPass = formPasscode.trim().toLowerCase();
      if (!cleanPass) {
        setFormError('관리자 패스코드를 입력해주세요.');
        onToast('패스코드를 입력해주세요.');
        return;
      }
      if (cleanPass !== PASSCODE.toLowerCase()) {
        setFormError('패스코드가 올바르지 않습니다.');
        onToast('패스코드가 올바르지 않습니다.');
        return;
      }
      if (persistAdminInForm) {
        onAdminLoginSuccess();
      }
    }

    // 2. Validate Wooriming presence
    const allPlayers: string[] = [
      ...(Object.values(formData.team_a) as string[]),
      ...(Object.values(formData.team_b) as string[]),
    ];
    const wCount = allPlayers.filter((p) => p && p.trim() === '우리밍_').length;
    if (wCount === 0) {
      setFormError("양 팀 중 정확히 1개 라인에 '우리밍_'을 지정해야 합니다. (상단 빠른 지정 버튼 클릭)");
      onToast("우리밍_을 라인에 배치해주세요.");
      return;
    }
    if (wCount > 1) {
      setFormError(`우리밍_이 ${wCount}곳에 중복으로 입력되어 있습니다. 1곳에만 지정해주세요.`);
      onToast("우리밍_이 중복 입력되었습니다.");
      return;
    }

    // 3. Sensible fallback for CK Name if left blank
    const cleanCkName =
      formData.ck_name.trim() || `${formData.date} CK 경기 (${formData.winning_team}팀 승)`;

    const matchToSave: Match = {
      ...formData,
      ck_name: cleanCkName,
    };

    try {
      if (editingMatch) {
        onUpdateMatch(matchToSave);
        onToast('경기가 성공적으로 수정되었습니다.');
      } else {
        onAddMatch(matchToSave);
        onToast('새로운 경기가 등록되었습니다.');
      }
      setIsEditModalOpen(false);
      setFormError('');
    } catch (err) {
      console.error('Save match error', err);
      setFormError('경기 저장 중 예기치 않은 오류가 발생했습니다.');
      onToast('저장 실패');
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setDeletePasscode('');
    setDeleteError('');
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;

    if (!isAdmin) {
      const cleanPass = deletePasscode.trim().toLowerCase();
      if (cleanPass !== PASSCODE.toLowerCase()) {
        setDeleteError('패스코드가 올바르지 않습니다.');
        return;
      }
      onAdminLoginSuccess();
    }

    onDeleteMatch(deleteTargetId);
    onToast('경기가 삭제되었습니다.');
    setDeleteTargetId(null);
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s]">
      {/* Top Banner Stats: Most Banned & Most Picked */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Winrate Trend Card */}
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 flex flex-col justify-between">
          <div>
            <div className="text-[14px] font-bold mb-3 flex items-center justify-between text-white">
              <span className="flex items-center gap-2">📊 승률 추이</span>
              <span className="text-[11px] font-normal text-[#8a8aa0]">2026 시즌</span>
            </div>

            <div className="flex justify-between items-center bg-[#08080c] border border-[#1e1e2a] rounded-[10px] px-3.5 py-2 mb-3.5">
              <span className="text-[12px] text-[#8a8aa0]">전체 승률</span>
              <span className="text-[14px] font-bold text-[#8b5cf6]">
                {stats.overallWinrate.winrate.toFixed(0)}% ({stats.overallWinrate.wins}승{' '}
                {stats.overallWinrate.losses}패)
              </span>
            </div>

            {/* Monthly Bar chart */}
            <div className="mb-3.5">
              <div className="text-[11px] text-[#6a6a80] mb-1.5 font-semibold">월별 승률</div>
              <div className="flex items-end gap-2 h-20 bg-[#08080c] border border-[#1e1e2a] rounded-[12px] p-2.5">
                {stats.monthlyStats
                  .filter((m) => m.month >= '2026-07')
                  .reverse()
                  .map((m) => {
                    const rate = m.winrate;
                    const barColor = rate >= 60 ? '#8b5cf6' : rate >= 50 ? '#6366f1' : '#4b5563';
                    const barHeight = Math.max(6, (rate / 100) * 50);
                    return (
                      <div
                        key={m.month}
                        className="flex-1 flex flex-col items-center justify-end h-full"
                      >
                        <div className="text-[9px] font-bold text-[#c0c0d0] mb-0.5">
                          {rate.toFixed(0)}%
                        </div>
                        <div
                          className="w-full rounded-t-[4px] transition-all"
                          style={{ height: `${barHeight}px`, background: barColor, minHeight: '6px' }}
                          title={`${m.month} ${rate.toFixed(1)}% (${m.wins}승 ${m.losses}패)`}
                        />
                        <div className="text-[9px] text-[#6a6a80] mt-1 whitespace-nowrap">
                          {m.month.slice(5)}월
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Recent 10 games streak with Blue (승) / Red (패) */}
          <div>
            <div className="text-[11px] text-[#6a6a80] mb-1.5 font-semibold flex items-center justify-between">
              <span>최근 10경기 흐름</span>
              <span className="text-[9px] text-[#5a5a6a]">승(Blue) / 패(Red)</span>
            </div>
            <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[12px] p-2.5">
              <div className="flex gap-1.5">
                {stats.recentTenMatches.length === 0 ? (
                  <div className="text-[11px] text-[#5a5a6a]">경기 데이터가 없습니다.</div>
                ) : (
                  stats.recentTenMatches.map(({ match, won }) => (
                    <div
                      key={match.id}
                      className={`flex-1 h-[30px] rounded-[6px] flex items-center justify-center text-[11px] font-black border transition-transform hover:scale-105 ${
                        won
                          ? 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/40'
                          : 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/40'
                      }`}
                      title={`${match.date} ${match.ck_name} - ${won ? '승리' : '패배'}`}
                    >
                      {won ? '승' : '패'}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Most Picked */}
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-[14px] text-white">모스트픽 TOP 5</h3>
            <button
              type="button"
              onClick={() => setIsChampsModalOpen(true)}
              className="text-[11px] bg-[#1e1e2a] border border-[#2a2a3a] text-[#c0c0d0] hover:text-white rounded-full px-3 py-1 hover:bg-[#2a2a3a] transition"
            >
              전체 보기
            </button>
          </div>
          <div className="space-y-2">
            {stats.mostPickedChamps.slice(0, 5).map((item, idx) => (
              <div
                key={item.champ}
                className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] rounded-[10px] px-3.5 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] text-[#6a6a80] font-bold w-[14px]">{idx + 1}</span>
                  <div className="w-[24px] h-[24px] rounded-full bg-[#1e1e2a] flex items-center justify-center text-[10px] font-bold text-[#a78bfa]">
                    {item.champ.slice(0, 1)}
                  </div>
                  <span className="text-[13px] font-semibold text-white">{item.champ}</span>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-white font-medium">
                    {item.wins}승 {item.losses}패 •{' '}
                    <span className="text-[#8b5cf6] font-bold">{item.winrate.toFixed(0)}%</span>
                  </div>
                  {item.avgKDA ? (
                    <div className="text-[10px] text-[#a78bfa]">KDA {item.avgKDA}</div>
                  ) : (
                    <div className="text-[10px] text-[#5a5a6a]">KDA -</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter & Action Controls Bar */}
      <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[16px] p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <div className="relative">
            <input
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              placeholder="날짜 검색 (예: 2026-09)"
              className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] w-[180px] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
            />
          </div>

          <div className="relative">
            <input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="CK명 검색"
              className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] w-[140px] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
            />
          </div>

          <select
            value={filterLine}
            onChange={(e) => setFilterLine(e.target.value)}
            className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-[#c0c0d0] focus:outline-none focus:border-[#8b5cf6]/50"
          >
            <option value="ALL">전체 라인</option>
            <option value="TOP">TOP</option>
            <option value="JGL">JGL</option>
            <option value="MID">MID</option>
            <option value="ADC">ADC</option>
            <option value="SUP">SUP</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="h-[36px] px-4 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-semibold flex items-center gap-1.5 shadow transition"
        >
          <Plus size={14} />
          <span>경기 추가</span>
        </button>
      </div>

      {/* Match Records Table */}
      <div className="bg-[#0e0e16]/70 border border-[#1e1e2a] rounded-[20px] p-3.5 md:p-5 shadow-inner">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[960px] border-separate border-spacing-y-3.5">
            <thead>
              <tr className="text-[#717188] text-[11px] uppercase tracking-wider font-semibold">
                <th className="text-left py-2 px-4 font-semibold">날짜</th>
                <th className="text-left py-2 px-4 font-semibold">CK명</th>
                <th className="text-left py-2 px-4 font-semibold">우리밍_ 라인 (챔프 / KDA)</th>
                <th className="text-left py-2 px-4 font-semibold">🔴 Red팀 vs 🔵 Blue팀 명단</th>
                <th className="text-left py-2 px-4 font-semibold">밴</th>
                <th className="text-left py-2 px-4 font-semibold">승리 결과</th>
                <th className="text-center py-2 px-4 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-10 text-center text-[#62627a] bg-[#12121a]/80 border border-[#1e1e2a] rounded-[16px]"
                  >
                    일치하는 경기 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredMatches.map((m) => {
                  const wTeam = getWoorimingTeam(m);
                  const wRoster = wTeam === 'Red' ? m.team_a : m.team_b;
                  const wChamps = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
                  const wKdas = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;

                  let wKey: LineKey = 'adc';
                  for (const k of LINE_KEYS) {
                    if (wRoster[k] === '우리밍_') {
                      wKey = k;
                      break;
                    }
                  }

                  const champ = wChamps[wKey];
                  const kda = wKdas[wKey];
                  const won = m.winning_team === wTeam;
                  const format = m.match_format || '단판';
                  const setNum = m.set_number || 1;
                  const winningTeamText = m.winning_team === 'Red' ? 'RED팀' : 'BLUE팀';

                  // 승/패에 따른 독립 카드 스타일 (배경 음영, 라운드 테두리, 그림자)
                  const cardBgClass = won
                    ? 'bg-gradient-to-r from-[#0d1b32]/90 via-[#0f172a]/90 to-[#0e1628]/90 group-hover:from-[#112444] group-hover:to-[#121c33]'
                    : 'bg-gradient-to-r from-[#241016]/90 via-[#1c1015]/90 to-[#1a0f14]/90 group-hover:from-[#30151e] group-hover:to-[#24141b]';

                  const cardBorderYClass = won
                    ? 'border-y border-[#3b82f6]/35 group-hover:border-[#3b82f6]/60'
                    : 'border-y border-[#ef4444]/35 group-hover:border-[#ef4444]/60';

                  const firstTdClass = won
                    ? 'border-l-4 border-l-[#3b82f6] border-y border-[#3b82f6]/35 group-hover:border-y-[#3b82f6]/60 rounded-l-[14px]'
                    : 'border-l-4 border-l-[#ef4444] border-y border-[#ef4444]/35 group-hover:border-y-[#ef4444]/60 rounded-l-[14px]';

                  const lastTdClass = won
                    ? 'border-r border-y border-[#3b82f6]/35 group-hover:border-y-[#3b82f6]/60 group-hover:border-r-[#3b82f6]/60 rounded-r-[14px]'
                    : 'border-r border-y border-[#ef4444]/35 group-hover:border-y-[#ef4444]/60 group-hover:border-r-[#ef4444]/60 rounded-r-[14px]';

                  const cardShadowClass = won
                    ? 'shadow-[0_4px_16px_rgba(0,0,0,0.35),0_0_15px_rgba(59,130,246,0.06)] group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.45),0_0_20px_rgba(59,130,246,0.12)]'
                    : 'shadow-[0_4px_16px_rgba(0,0,0,0.35),0_0_15px_rgba(239,68,68,0.06)] group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.45),0_0_20px_rgba(239,68,68,0.12)]';

                  return (
                    <tr
                      key={m.id}
                      className={`group transition-all duration-150 ${cardShadowClass}`}
                    >
                      {/* 1. 날짜 및 승패 뱃지 */}
                      <td className={`p-4 pl-4 whitespace-nowrap align-middle ${cardBgClass} ${firstTdClass}`}>
                        <div className="font-semibold text-[13px] text-white tracking-tight">
                          {m.date}
                        </div>
                        <div
                          className={`mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${
                            won
                              ? 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/40'
                              : 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${won ? 'bg-[#60a5fa]' : 'bg-[#f87171]'}`}
                          />
                          {won ? '우리밍 승' : '우리밍 패'}
                        </div>
                      </td>

                      {/* 2. CK명 및 세트/점수 */}
                      <td className={`p-4 max-w-[190px] align-middle ${cardBgClass} ${cardBorderYClass}`}>
                        <div className="truncate font-bold text-white text-[13px] group-hover:text-[#d8b4fe] transition-colors">
                          {m.ck_name}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] bg-[#161622] border border-[#26263a] text-[#8e8ea8] px-2 py-0.5 rounded-full font-medium">
                            {format !== '단판' ? `${format} ${setNum}세트` : '단판'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              m.winning_team === 'Red'
                                ? 'bg-[#ef4444]/15 border-[#ef4444]/30 text-[#f87171]'
                                : 'bg-[#3b82f6]/15 border-[#3b82f6]/30 text-[#60a5fa]'
                            }`}
                          >
                            {winningTeamText} {m.score || '1:0'}
                          </span>
                        </div>
                      </td>

                      {/* 3. 우리밍_ 라인 / 챔프 / KDA */}
                      <td className={`p-4 align-middle ${cardBgClass} ${cardBorderYClass}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                              LINE_LABELS[wKey] === 'ADC'
                                ? 'bg-[#8b5cf6]/25 text-[#c4b5fd] border-[#8b5cf6]/50 shadow-[0_0_8px_rgba(139,92,246,0.2)]'
                                : 'bg-[#1e1e2c] text-[#a0a0b8] border-[#2c2c40]'
                            }`}
                          >
                            {LINE_LABELS[wKey]}
                          </span>
                          <span className="font-bold text-white text-[13px]">{champ || '-'}</span>
                          {!isKdaEmpty(kda) && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#161622] text-[#c0c0d8] border border-[#262638]">
                              KDA {kda}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Red vs Blue 팀 명단 */}
                      <td className={`p-4 align-middle ${cardBgClass} ${cardBorderYClass}`}>
                        <div className="grid grid-cols-2 gap-2.5 max-w-[370px] bg-[#090910]/70 p-2.5 rounded-[12px] border border-white/5">
                          {/* Red Team */}
                          <div className="space-y-0.5">
                            <div className="text-[10px] font-bold text-[#f87171] flex items-center gap-1 mb-1">
                              <span>🔴 Red팀</span>
                              {m.winning_team === 'Red' && (
                                <span className="text-[9px] bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#fca5a5] px-1 rounded">
                                  승리 👑
                                </span>
                              )}
                            </div>
                            {LINE_KEYS.map((k) => (
                              <div key={k} className="text-[11px] truncate leading-tight">
                                <span className="text-[#5a5a6a] mr-1 font-medium">{LINE_LABELS[k]}:</span>
                                <span
                                  className={
                                    m.team_a[k] === '우리밍_'
                                      ? 'text-[#c4b5fd] font-bold bg-[#8b5cf6]/20 px-1 rounded'
                                      : 'text-[#c0c0d0]'
                                  }
                                >
                                  {formatPlayerWithChamp(m.team_a[k], m.team_a_champs[k])}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Blue Team */}
                          <div className="space-y-0.5">
                            <div className="text-[10px] font-bold text-[#60a5fa] flex items-center gap-1 mb-1">
                              <span>🔵 Blue팀</span>
                              {m.winning_team === 'Blue' && (
                                <span className="text-[9px] bg-[#3b82f6]/20 border border-[#3b82f6]/40 text-[#93c5fd] px-1 rounded">
                                  승리 👑
                                </span>
                              )}
                            </div>
                            {LINE_KEYS.map((k) => (
                              <div key={k} className="text-[11px] truncate leading-tight">
                                <span className="text-[#5a5a6a] mr-1 font-medium">{LINE_LABELS[k]}:</span>
                                <span
                                  className={
                                    m.team_b[k] === '우리밍_'
                                      ? 'text-[#c4b5fd] font-bold bg-[#8b5cf6]/20 px-1 rounded'
                                      : 'text-[#c0c0d0]'
                                  }
                                >
                                  {formatPlayerWithChamp(m.team_b[k], m.team_b_champs[k])}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* 5. 밴 목록 */}
                      <td className={`p-4 align-middle ${cardBgClass} ${cardBorderYClass}`}>
                        <div className="text-[11px] space-y-1.5 text-[#8a8aa0] min-w-[120px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#ef4444]/15 text-[#f87171] border border-[#ef4444]/30">
                              RED
                            </span>
                            <span className="truncate max-w-[120px] text-[#a0a0b8]">
                              {m.ban_a.filter(Boolean).join(', ') || '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
                              BLUE
                            </span>
                            <span className="truncate max-w-[120px] text-[#a0a0b8]">
                              {m.ban_b.filter(Boolean).join(', ') || '-'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 6. 승리 결과 */}
                      <td className={`p-4 whitespace-nowrap align-middle ${cardBgClass} ${cardBorderYClass}`}>
                        <span
                          className={`px-3 py-1.5 rounded-[10px] text-[11px] font-extrabold inline-flex items-center gap-1.5 border shadow-sm ${
                            won
                              ? 'bg-[#3b82f6]/20 text-[#93c5fd] border-[#3b82f6]/40'
                              : 'bg-[#ef4444]/20 text-[#fca5a5] border-[#ef4444]/40'
                          }`}
                        >
                          {won ? '🔵 승리' : '🔴 패배'} ({winningTeamText})
                        </span>
                      </td>

                      {/* 7. 관리 버튼 */}
                      <td className={`p-4 pr-4 whitespace-nowrap align-middle text-center ${cardBgClass} ${lastTdClass}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(m)}
                            className="p-2 bg-[#1b1b28] hover:bg-[#2c2c40] text-[#a0a0b8] hover:text-white rounded-lg transition border border-[#2a2a3e]"
                            title="경기 수정"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(m.id)}
                            className="p-2 bg-[#2d161a] hover:bg-[#3d1e23] text-[#f87171] hover:text-[#fca5a5] rounded-lg transition border border-[#ef4444]/30"
                            title="경기 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Champion Stats Modal */}
      {isChampsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s]">
          <div className="w-full max-w-[520px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[16px] text-white">우리밍_ 전체 챔피언 픽 통계</h3>
              <button
                type="button"
                onClick={() => setIsChampsModalOpen(false)}
                className="w-[28px] h-[28px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white text-[12px]"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {stats.mostPickedChamps.map((item, idx) => (
                <div
                  key={item.champ}
                  className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] rounded-[10px] px-3.5 py-2 text-[12px]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[#6a6a80] text-[11px] w-[16px]">{idx + 1}</span>
                    <span className="font-semibold text-white">{item.champ}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[#c0c0d0]">
                      {item.picks}픽 {item.wins}승 {item.losses}패{' '}
                      <span className="text-[#8b5cf6] font-bold ml-1">{item.winrate.toFixed(0)}%</span>
                    </div>
                    {item.avgKDA ? (
                      <div className="text-[11px] text-[#a78bfa]">평균 KDA {item.avgKDA}</div>
                    ) : (
                      <div className="text-[10px] text-[#5a5a6a]">KDA 없음</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Match Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s]">
          <div className="w-full max-w-[850px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 my-8 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[16px] text-white">
                {editingMatch ? '경기 수정' : '새 경기 추가'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-[28px] h-[28px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
              >
                <X size={14} />
              </button>
            </div>

            {isAdmin && (
              <div className="mb-4 inline-flex items-center gap-1.5 text-[11px] bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] px-3 py-1 rounded-full">
                <span>🔒 관리자 인증 완료 (패스코드 입력 불필요)</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">경기 일자</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]/50"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">CK 명칭</label>
                <input
                  value={formData.ck_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ck_name: e.target.value }))}
                  placeholder="예: 치지직 심야 드래프트 CK"
                  className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">경기 방식</label>
                <select
                  value={formData.match_format}
                  onChange={(e) => {
                    const fmt = e.target.value as MatchFormat;
                    setFormData((prev) => ({
                      ...prev,
                      match_format: fmt,
                      set_number: fmt === '단판' ? 1 : prev.set_number,
                    }));
                  }}
                  className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]/50"
                >
                  <option value="단판">단판</option>
                  <option value="3판2선승">3판2선승</option>
                  <option value="5판3선승">5판3선승</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">세트 번호</label>
                <select
                  value={formData.set_number}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, set_number: parseInt(e.target.value, 10) }))
                  }
                  disabled={formData.match_format === '단판'}
                  className={`w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]/50 ${
                    formData.match_format === '단판' ? 'opacity-50' : ''
                  }`}
                >
                  {Array.from(
                    {
                      length:
                        formData.match_format === '5판3선승'
                          ? 5
                          : formData.match_format === '3판2선승'
                          ? 3
                          : 1,
                    },
                    (_, i) => i + 1
                  ).map((num) => (
                    <option key={num} value={num}>
                      {num}세트
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Score & Winner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">승리 팀</label>
                <select
                  value={formData.winning_team}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      winning_team: e.target.value as WinningTeam,
                    }))
                  }
                  className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]/50"
                >
                  <option value="Red">🔴 Red팀 승리</option>
                  <option value="Blue">🔵 Blue팀 승리</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#8a8aa0] mb-1 block">세트 스코어</label>
                <input
                  value={formData.score}
                  onChange={(e) => setFormData((prev) => ({ ...prev, score: e.target.value }))}
                  placeholder="예: 1:0, 2:1"
                  className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
                />
              </div>
            </div>

            {/* Wooriming Fast Line Assignment Bar */}
            <div className="mb-4 bg-[#0a0a10] border border-[#222232] rounded-[14px] p-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#a78bfa]" />
                  <span>우리밍_ 배치 라인:</span>
                </span>
                {woorimingLocation ? (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      woorimingLocation.team === 'team_a'
                        ? 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/40'
                        : 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/40'
                    }`}
                  >
                    {woorimingLocation.team === 'team_a' ? '🔴 Red팀' : '🔵 Blue팀'} {LINE_LABELS[woorimingLocation.line]} ({woorimingLocation.line.toUpperCase()})
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-[#ef4444] bg-[#ef4444]/15 px-2.5 py-0.5 rounded-full border border-[#ef4444]/30">
                    ⚠️ 아직 미배치됨 (전적 산출 필수)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-[#8a8aa0] text-[10px] mr-1">원클릭 배치:</span>
                <button
                  type="button"
                  onClick={() => handleSetWooriming('team_a', 'adc')}
                  className={`h-[28px] px-2.5 rounded-full text-[11px] font-medium border transition ${
                    woorimingLocation?.team === 'team_a' && woorimingLocation?.line === 'adc'
                      ? 'bg-[#ef4444] text-white border-[#ef4444]'
                      : 'bg-[#ef4444]/10 text-[#fca5a5] border-[#ef4444]/30 hover:bg-[#ef4444]/25'
                  }`}
                >
                  🔴 Red 원딜(ADC)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWooriming('team_a', 'sup')}
                  className={`h-[28px] px-2.5 rounded-full text-[11px] font-medium border transition ${
                    woorimingLocation?.team === 'team_a' && woorimingLocation?.line === 'sup'
                      ? 'bg-[#ef4444] text-white border-[#ef4444]'
                      : 'bg-[#ef4444]/10 text-[#fca5a5] border-[#ef4444]/30 hover:bg-[#ef4444]/25'
                  }`}
                >
                  🔴 Red 서폿(SUP)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWooriming('team_b', 'adc')}
                  className={`h-[28px] px-2.5 rounded-full text-[11px] font-medium border transition ${
                    woorimingLocation?.team === 'team_b' && woorimingLocation?.line === 'adc'
                      ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                      : 'bg-[#3b82f6]/10 text-[#93c5fd] border-[#3b82f6]/30 hover:bg-[#3b82f6]/25'
                  }`}
                >
                  🔵 Blue 원딜(ADC)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWooriming('team_b', 'sup')}
                  className={`h-[28px] px-2.5 rounded-full text-[11px] font-medium border transition ${
                    woorimingLocation?.team === 'team_b' && woorimingLocation?.line === 'sup'
                      ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                      : 'bg-[#3b82f6]/10 text-[#93c5fd] border-[#3b82f6]/30 hover:bg-[#3b82f6]/25'
                  }`}
                >
                  🔵 Blue 서폿(SUP)
                </button>
              </div>
            </div>

            {/* Team Roster Inputs */}
            {(['team_a', 'team_b'] as const).map((teamKey) => {
              const isRed = teamKey === 'team_a';
              const champsKey = `${teamKey}_champs` as const;
              const kdaKey = `${teamKey}_kda` as const;
              const banKey = isRed ? 'ban_a' : 'ban_b';

              return (
                <div
                  key={teamKey}
                  className="mb-4 bg-[#08080c] border rounded-[14px] p-4"
                  style={{
                    borderColor: isRed ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)',
                  }}
                >
                  <div
                    className="text-[12px] font-bold mb-3 flex items-center justify-between"
                    style={{ color: isRed ? '#ef4444' : '#3b82f6' }}
                  >
                    <span>
                      {isRed ? '🔴 Red팀' : '🔵 Blue팀'} 로스터 (플레이어 / 챔피언 / KDA)
                    </span>
                    <span className="text-[10px] text-[#8a8aa0] font-normal">
                      우리밍_은 '밍' 버튼으로 빠른 선택 가능
                    </span>
                  </div>

                  <div className="space-y-2">
                    {LINE_KEYS.map((lineKey) => {
                      const isW = formData[teamKey][lineKey] === '우리밍_';
                      return (
                        <div key={lineKey} className="flex flex-wrap gap-2 items-center">
                          <span className="w-[36px] text-[11px] font-bold text-[#8a8aa0] tracking-widest">
                            {LINE_LABELS[lineKey]}
                          </span>

                          {/* Player */}
                          <input
                            value={formData[teamKey][lineKey]}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                [teamKey]: { ...prev[teamKey], [lineKey]: val },
                              }));
                              setFormError('');
                            }}
                            placeholder="플레이어"
                            list="players-datalist"
                            className={`h-[32px] w-[110px] bg-[#12121a] border rounded-full px-3 text-[11px] text-white focus:outline-none ${
                              isW ? 'border-[#8b5cf6] font-bold text-[#a78bfa]' : 'border-[#1e1e2a]'
                            }`}
                          />

                          {/* Champ */}
                          <input
                            value={formData[champsKey][lineKey]}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                [champsKey]: { ...prev[champsKey], [lineKey]: e.target.value },
                              }))
                            }
                            placeholder="챔피언"
                            list="champs-datalist"
                            className={`h-[32px] w-[110px] bg-[#12121a] border rounded-full px-3 text-[11px] text-white focus:outline-none ${
                              isW ? 'border-[#8b5cf6]/50' : 'border-[#1e1e2a]'
                            }`}
                          />

                          {/* KDA */}
                          <input
                            value={formData[kdaKey][lineKey]}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                [kdaKey]: { ...prev[kdaKey], [lineKey]: e.target.value },
                              }))
                            }
                            placeholder={isW ? 'K/D/A (우리밍_)' : 'K/D/A (선택)'}
                            className={`h-[32px] w-[90px] bg-[#12121a] border rounded-full px-3 text-[11px] text-white focus:outline-none ${
                              isW
                                ? 'border-[#8b5cf6] bg-[#8b5cf6]/10 font-bold'
                                : 'border-[#1e1e2a] opacity-60'
                            }`}
                          />

                          {/* Quick 밍 button */}
                          <button
                            type="button"
                            onClick={() => handleSetWooriming(teamKey, lineKey)}
                            className={`h-[28px] px-2.5 border rounded-full text-[10px] font-bold transition ${
                              isW
                                ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                                : 'bg-[#8b5cf6]/20 border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/30 text-[#a78bfa]'
                            }`}
                          >
                            밍
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bans */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-[#1e1e2a] pt-3">
                    <span className="text-[11px] text-[#6a6a80] mr-2 font-medium">밴 (5개):</span>
                    {formData[banKey].map((banItem, bIdx) => (
                      <input
                        key={bIdx}
                        value={banItem}
                        onChange={(e) => {
                          const updated = [...formData[banKey]];
                          updated[bIdx] = e.target.value;
                          setFormData((prev) => ({ ...prev, [banKey]: updated }));
                        }}
                        placeholder={`밴 ${bIdx + 1}`}
                        list="champs-datalist"
                        className="h-[28px] w-[88px] bg-[#12121a] border border-[#1e1e2a] rounded-full px-2.5 text-[11px] text-white placeholder:text-[#4a4a5a] focus:outline-none focus:border-[#8b5cf6]/40"
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* In-Modal Error Banner */}
            {formError && (
              <div className="mt-4 p-3 bg-[#ef4444]/15 border border-[#ef4444]/40 rounded-[12px] text-[#ef4444] text-[12px] flex items-center gap-2 animate-[fadeIn_0.15s]">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-semibold">{formError}</span>
              </div>
            )}

            {/* Passcode & Submit */}
            <div className="mt-4 flex flex-wrap gap-3 items-center justify-between border-t border-[#1e1e2a] pt-4">
              {!isAdmin ? (
                <div className="flex items-center gap-2 flex-1 max-w-[340px]">
                  <input
                    type="password"
                    value={formPasscode}
                    onChange={(e) => {
                      setFormPasscode(e.target.value);
                      setFormError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveMatch();
                    }}
                    placeholder="패스코드"
                    className="h-[36px] flex-1 bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-[#8a8aa0] cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={persistAdminInForm}
                      onChange={(e) => setPersistAdminInForm(e.target.checked)}
                      className="accent-[#8b5cf6]"
                    />
                    <span>24시간 유지</span>
                  </label>
                </div>
              ) : (
                <div className="text-[12px] text-[#10b981] font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>관리자 모드 활성화됨 (패스코드 입력 불필요)</span>
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-[36px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#c0c0d0] rounded-full text-[12px] font-medium transition"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatch}
                  className="h-[36px] px-6 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-bold shadow transition flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>저장하기</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s]">
          <div className="w-full max-w-[360px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-[14px] text-white flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-[#ef4444]" />
                <span>경기 삭제 확인</span>
              </h4>
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="w-[28px] h-[28px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
              >
                <X size={14} />
              </button>
            </div>

            {isAdmin ? (
              <p className="text-[12px] text-[#8a8aa0] mb-4 leading-relaxed">
                관리자 모드가 활성화되어 있습니다. 선택한 경기를 삭제하시겠습니까?
              </p>
            ) : (
              <>
                <p className="text-[12px] text-[#8a8aa0] mb-4">
                  경기를 삭제하려면 관리자 패스코드를 입력해주세요.
                </p>
                <input
                  type="password"
                  value={deletePasscode}
                  onChange={(e) => {
                    setDeletePasscode(e.target.value);
                    setDeleteError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmDelete();
                  }}
                  placeholder="패스코드"
                  className="w-full h-[38px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white focus:outline-none focus:border-[#ef4444]/50 mb-2"
                  autoFocus
                />
                {deleteError && (
                  <div className="text-[11px] text-[#ff6b6b] mb-3">{deleteError}</div>
                )}
              </>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 h-[36px] bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#c0c0d0] rounded-full text-[12px]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 h-[36px] bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-full text-[12px] font-bold"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
