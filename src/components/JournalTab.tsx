import React, { useState, useMemo } from 'react';
import { Match, LineKey, MatchFormat, WinningTeam, LINE_KEYS, LINE_LABELS } from '../types';
import { ComputedStats, formatPlayerWithChamp, isKdaEmpty, getWoorimingTeam, getWoorimingLine } from '../lib/stats';
import { ChampionIcon } from './ChampionIcon';
import { getPlayerLoadout, getItemIconUrl, parseKdaString } from '../lib/champions';
import { PASSCODE } from '../data/initialMatches';
import { Plus, Search, Filter, ShieldAlert, X, Edit2, Trash2, Eye, Save, AlertCircle, CheckCircle2, Sparkles, Trophy } from 'lucide-react';

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
                  <ChampionIcon name={item.champ} size={24} shape="square" />
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

      {/* Match Records List (OP.GG / image_1.png Independent Card Layout) */}
      <div className="space-y-3.5">
        {filteredMatches.length === 0 ? (
          <div className="p-12 text-center text-[#62627a] bg-[#12121a]/80 border border-[#1e1e2a] rounded-[20px]">
            일치하는 경기 기록이 없습니다.
          </div>
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
            const kdaRaw = wKdas[wKey];
            const kdaInfo = parseKdaString(kdaRaw);
            const won = m.winning_team === wTeam;
            const format = m.match_format || '단판';
            const setNum = m.set_number || 1;
            const winningTeamText = m.winning_team === 'Red' ? 'RED팀' : 'BLUE팀';

            const loadout = getPlayerLoadout(LINE_LABELS[wKey], champ);

            // 승/패에 따른 독립 카드 스타일 (배경 틴트, 테두리, 그림자)
            const cardBgClass = won
              ? 'bg-gradient-to-r from-[#0e213b]/95 via-[#0e192c]/95 to-[#0b1321]/95'
              : 'bg-gradient-to-r from-[#2c1218]/95 via-[#1d1016]/95 to-[#140b10]/95';

            const cardBorderClass = won
              ? 'border-[#3b82f6]/40 hover:border-[#3b82f6]/70 shadow-[0_4px_24px_rgba(59,130,246,0.12)]'
              : 'border-[#ef4444]/40 hover:border-[#ef4444]/70 shadow-[0_4px_24px_rgba(239,68,68,0.12)]';

            const accentBarClass = won ? 'bg-[#3b82f6]' : 'bg-[#ef4444]';

            return (
              <div
                key={m.id}
                className={`relative rounded-xl border ${cardBorderClass} ${cardBgClass} transition-all duration-200 overflow-hidden group`}
              >
                {/* 왼쪽 사이드 액센트 바 */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBarClass}`} />

                <div className="p-3.5 pl-5 md:p-4.5 md:pl-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  {/* 1. [왼쪽 영역] 날짜, CK명, 승/패 결과 뱃지, 세트 스코어 (image_1.png 참고) */}
                  <div className="flex xl:flex-col justify-between xl:justify-center items-start gap-1 min-w-[140px] xl:w-[150px] border-b xl:border-b-0 xl:border-r border-white/10 pb-3 xl:pb-0 xl:pr-4 shrink-0">
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-bold text-[#8a8aa0] tracking-wider uppercase">
                        {format !== '단판' ? `${format} ${setNum}세트` : '단판 CK'}
                      </div>
                      <div className="text-[11px] text-[#6a6a80] font-medium">{m.date}</div>
                    </div>

                    <div className="space-y-1.5 xl:mt-2">
                      <div
                        className="font-extrabold text-white text-[13px] line-clamp-1 group-hover:text-[#c4b5fd] transition-colors"
                        title={m.ck_name}
                      >
                        {m.ck_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[12px] font-black px-2.5 py-0.5 rounded shadow-sm inline-flex items-center gap-1 ${
                            won
                              ? 'bg-[#2563eb] text-white shadow-[#2563eb]/20'
                              : 'bg-[#dc2626] text-white shadow-[#dc2626]/20'
                          }`}
                        >
                          {won ? '승리' : '패배'}
                        </span>
                        <span className="text-[11px] text-[#a0a0b8] font-bold">
                          {m.score || '1:0'}{' '}
                          <span className="text-[10px] text-[#6a6a80] font-normal">({winningTeamText})</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. [중앙 영역] 우리밍_ 선수 정보 강조 (OP.GG / image_1.png 참고) */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 xl:px-3">
                    {/* [챔피언 아이콘 (정사각형, 크게)] + [스펠 아이콘 2개] + [룬 아이콘 2개] 그룹 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative">
                        <ChampionIcon
                          name={champ || ''}
                          size={54}
                          shape="square"
                          className="border-2 border-white/20 shadow-lg group-hover:scale-105 transition-transform"
                        />
                        <span
                          className={`absolute -bottom-1 -right-1 text-[9px] font-black px-1 py-0.2 rounded shadow ${
                            LINE_LABELS[wKey] === 'ADC'
                              ? 'bg-[#8b5cf6] text-white'
                              : 'bg-[#3b82f6] text-white'
                          }`}
                        >
                          {LINE_LABELS[wKey]}
                        </span>
                      </div>

                      {/* 스펠 2개 (세로) & 룬 2개 (세로) */}
                      <div className="flex items-center gap-1">
                        {/* 스펠 2개 */}
                        <div className="flex flex-col gap-1">
                          <img
                            src={loadout.spells[0]}
                            alt="spell 1"
                            className="w-[24px] h-[24px] rounded-[5px] border border-white/20 object-cover shadow-sm"
                            title="소환사 주문 1"
                            loading="lazy"
                          />
                          <img
                            src={loadout.spells[1]}
                            alt="spell 2"
                            className="w-[24px] h-[24px] rounded-[5px] border border-white/20 object-cover shadow-sm"
                            title="소환사 주문 2"
                            loading="lazy"
                          />
                        </div>

                        {/* 룬 2개 */}
                        <div className="flex flex-col gap-1">
                          <div
                            className="w-[24px] h-[24px] rounded-full bg-black/60 border border-white/20 flex items-center justify-center p-0.5 shadow-sm"
                            title="핵심 룬"
                          >
                            <img
                              src={loadout.runes[0]}
                              alt="primary rune"
                              className="w-[19px] h-[19px] object-contain"
                              loading="lazy"
                            />
                          </div>
                          <div
                            className="w-[24px] h-[24px] rounded-full bg-black/60 border border-white/20 flex items-center justify-center p-1 shadow-sm"
                            title="보조 룬"
                          >
                            <img
                              src={loadout.runes[1]}
                              alt="sub rune"
                              className="w-[15px] h-[15px] object-contain opacity-90"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* [KDA (큰 글씨)] + [평점 (소수점)] + [아이템 아이콘 7개 일렬] */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        {/* KDA 큰 글씨 */}
                        {kdaInfo && kdaInfo.kills !== undefined ? (
                          <div className="text-[17px] md:text-[18px] font-black tracking-wide text-white">
                            <span>{kdaInfo.kills}</span>
                            <span className="text-[#6a6a80] mx-1">/</span>
                            <span className="text-[#f87171]">{kdaInfo.deaths}</span>
                            <span className="text-[#6a6a80] mx-1">/</span>
                            <span>{kdaInfo.assists}</span>
                          </div>
                        ) : (
                          <div className="text-[16px] font-bold text-white">
                            {kdaRaw && !isKdaEmpty(kdaRaw) ? `KDA ${kdaRaw}` : 'KDA -'}
                          </div>
                        )}

                        {/* 평점 */}
                        {kdaInfo && (
                          <span
                            className={`text-[12px] font-bold ${
                              kdaInfo.isPerfect
                                ? 'text-[#fbbf24]'
                                : parseFloat(kdaInfo.ratioText) >= 3
                                ? 'text-[#38bdf8]'
                                : 'text-[#a0a0b8]'
                            }`}
                          >
                            {kdaInfo.ratioText} {kdaInfo.isPerfect ? '' : '평점'}
                          </span>
                        )}

                        <span className="text-[11px] text-[#8a8aa0] font-semibold">
                          우리밍_ ({champ || '챔피언 미지정'})
                        </span>
                      </div>

                      {/* 아이템 아이콘 7개 (6코어 + 1장신구) 일렬 배치 */}
                      <div className="flex items-center gap-1">
                        {loadout.items.map((itemId, i) => (
                          <div
                            key={i}
                            className="w-[24px] h-[24px] rounded-[4px] bg-[#090912] border border-white/15 overflow-hidden shadow-sm shrink-0 hover:scale-110 transition-transform"
                          >
                            <img
                              src={getItemIconUrl(itemId)}
                              alt={`item-${i}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                        {/* 장신구 / 와드 */}
                        <div
                          className="w-[24px] h-[24px] rounded-full bg-[#090912] border border-[#a78bfa]/50 overflow-hidden shadow-sm shrink-0 ml-1 hover:scale-110 transition-transform"
                          title="장신구"
                        >
                          <img
                            src={getItemIconUrl(loadout.trinket)}
                            alt="trinket"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. [오른쪽 영역] 10인 명단 전체 (5명씩 두 줄 Red팀/Blue팀 콤팩트 구성) */}
                  <div className="bg-[#07070d]/80 border border-white/10 rounded-[12px] p-2.5 flex flex-col gap-2 min-w-[340px] xl:max-w-[420px]">
                    {/* Red Team Row (5인) */}
                    <div className="flex items-center gap-2">
                      <div className="w-[52px] shrink-0 flex items-center gap-1">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/30">
                          RED
                        </span>
                        {m.winning_team === 'Red' && <span className="text-[11px]">👑</span>}
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 flex-1">
                        {LINE_KEYS.map((k) => {
                          const pName = m.team_a[k];
                          const pChamp = m.team_a_champs[k];
                          const isW = pName === '우리밍_';
                          return (
                            <div
                              key={k}
                              className={`flex items-center gap-1 text-[11px] px-1 py-0.5 rounded min-w-0 transition ${
                                isW
                                  ? 'bg-[#8b5cf6]/25 border border-[#8b5cf6]/50 text-[#d8b4fe] font-bold shadow-sm'
                                  : 'text-[#c0c0d0]'
                              }`}
                              title={`${LINE_LABELS[k]}: ${pName || '-'} (${pChamp || '-'})`}
                            >
                              <ChampionIcon name={pChamp || ''} size={15} shape="square" />
                              <span className="truncate text-[11px]">
                                {isW && <span className="text-[#fbbf24] mr-0.5">🌟</span>}
                                {pName || '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Blue Team Row (5인) */}
                    <div className="flex items-center gap-2 border-t border-white/5 pt-1.5">
                      <div className="w-[52px] shrink-0 flex items-center gap-1">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30">
                          BLUE
                        </span>
                        {m.winning_team === 'Blue' && <span className="text-[11px]">👑</span>}
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 flex-1">
                        {LINE_KEYS.map((k) => {
                          const pName = m.team_b[k];
                          const pChamp = m.team_b_champs[k];
                          const isW = pName === '우리밍_';
                          return (
                            <div
                              key={k}
                              className={`flex items-center gap-1 text-[11px] px-1 py-0.5 rounded min-w-0 transition ${
                                isW
                                  ? 'bg-[#8b5cf6]/25 border border-[#8b5cf6]/50 text-[#d8b4fe] font-bold shadow-sm'
                                  : 'text-[#c0c0d0]'
                              }`}
                              title={`${LINE_LABELS[k]}: ${pName || '-'} (${pChamp || '-'})`}
                            >
                              <ChampionIcon name={pChamp || ''} size={15} shape="square" />
                              <span className="truncate text-[11px]">
                                {isW && <span className="text-[#fbbf24] mr-0.5">🌟</span>}
                                {pName || '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 4. 관리 버튼 (수정, 삭제) */}
                  <div className="flex xl:flex-col items-center justify-end gap-1.5 shrink-0 pl-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(m)}
                      className="p-1.5 bg-[#1b1b28] hover:bg-[#2c2c40] text-[#a0a0b8] hover:text-white rounded-lg transition border border-[#2a2a3e]"
                      title="경기 수정"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(m.id)}
                      className="p-1.5 bg-[#2d161a] hover:bg-[#3d1e23] text-[#f87171] hover:text-[#fca5a5] rounded-lg transition border border-[#ef4444]/30"
                      title="경기 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* 밴(Ban) 정보 리본 (존재할 경우에만 하단에 콤팩트하게 표시) */}
                {(m.ban_a.filter(Boolean).length > 0 || m.ban_b.filter(Boolean).length > 0) && (
                  <div className="px-4 py-1.5 bg-black/40 border-t border-white/5 flex items-center gap-3 text-[10px] text-[#8a8aa0] flex-wrap">
                    <span className="font-bold text-[#6a6a80]">BANS:</span>
                    {m.ban_a.filter(Boolean).length > 0 && (
                      <div className="inline-flex items-center gap-1">
                        <span className="text-[#f87171] font-bold">RED</span>
                        <span className="text-[#a0a0b8]">{m.ban_a.filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    {m.ban_b.filter(Boolean).length > 0 && (
                      <div className="inline-flex items-center gap-1">
                        <span className="text-[#60a5fa] font-bold">BLUE</span>
                        <span className="text-[#a0a0b8]">{m.ban_b.filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
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
                    <ChampionIcon name={item.champ} size={24} shape="square" />
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
