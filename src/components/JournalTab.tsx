import React, { useState, useMemo } from 'react';
import { Match, LineKey, MatchFormat, WinningTeam, LINE_KEYS, LINE_LABELS } from '../types';
import {
  ComputedStats,
  OpponentStat,
  isMatchWonByWooriming,
  formatPlayerWithChamp,
  isKdaEmpty,
  getWoorimingTeam,
  getWoorimingLine,
} from '../lib/stats';
import { ChampionIcon } from './ChampionIcon';
import { parseKdaString, normalizeChampionName, SOOP_POPULAR_STREAMERS } from '../lib/champions';
import { PASSCODE } from '../data/initialMatches';
import {
  Plus,
  Search,
  Filter,
  ShieldAlert,
  X,
  Edit2,
  Trash2,
  Eye,
  Save,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Trophy,
  ArrowLeftRight,
  Copy,
  FastForward,
  Swords,
} from 'lucide-react';

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
  onImportMatches,
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
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentStat | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [formError, setFormError] = useState('');

  // Series winners tracker for auto score calculation (e.g. ['Red', 'Blue'])
  const [seriesWinners, setSeriesWinners] = useState<('Red' | 'Blue')[]>([]);

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
    match_format: '3판2선승',
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

  // Real-time duplicates calculation
  const { duplicatePlayers, duplicateChamps } = useMemo(() => {
    const pCounts = new Map<string, number>();
    const cCounts = new Map<string, number>();
    for (const t of ['team_a', 'team_b'] as const) {
      for (const l of LINE_KEYS) {
        const p = (formData[t]?.[l] || '').trim();
        if (p) pCounts.set(p, (pCounts.get(p) || 0) + 1);
        const c = normalizeChampionName(formData[`${t}_champs` as const]?.[l]);
        if (c) cCounts.set(c, (cCounts.get(c) || 0) + 1);
      }
    }
    const dupP = new Set<string>();
    for (const [p, cnt] of pCounts.entries()) {
      if (cnt > 1) dupP.add(p);
    }
    const dupC = new Set<string>();
    for (const [c, cnt] of cCounts.entries()) {
      if (cnt > 1) dupC.add(c);
    }
    return { duplicatePlayers: dupP, duplicateChamps: dupC };
  }, [formData.team_a, formData.team_b, formData.team_a_champs, formData.team_b_champs]);

  const handleOpenAddModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setFormData({
      id: `m_${Date.now()}`,
      date: today,
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
      match_format: '3판2선승',
      set_number: 1,
    });
    setSeriesWinners([]);
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

  // Smart winner selection with cumulative score calculation
  const handleSelectWinner = (winner: 'Red' | 'Blue') => {
    const redWins = seriesWinners.filter((w) => w === 'Red').length + (winner === 'Red' ? 1 : 0);
    const blueWins = seriesWinners.filter((w) => w === 'Blue').length + (winner === 'Blue' ? 1 : 0);
    setFormData((prev) => ({
      ...prev,
      winning_team: winner,
      score: `${redWins}:${blueWins}`,
    }));
    setFormError('');
  };

  // 1-Click Load Previous Set Roster
  const handleLoadPreviousSetRoster = () => {
    if (matches.length === 0) {
      onToast('불러올 이전 경기 데이터가 없습니다.');
      return;
    }
    const sorted = [...matches].sort((a, b) => {
      const dDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dDiff !== 0) return dDiff;
      const setA = Number(a.set_number) || 1;
      const setB = Number(b.set_number) || 1;
      return setB - setA;
    });
    const prevMatch = sorted[0];
    const nextSet = (Number(prevMatch.set_number) || 1) + 1;

    // Collect previous series results for matching date & CK
    const sameSeriesMatches = matches
      .filter(
        (m) => m.date === prevMatch.date && (m.ck_name === prevMatch.ck_name || !prevMatch.ck_name)
      )
      .sort((a, b) => (Number(a.set_number) || 1) - (Number(b.set_number) || 1));
    const prevWinners = sameSeriesMatches.map((m) => m.winning_team as 'Red' | 'Blue');
    setSeriesWinners(prevWinners);

    const initialWinner: 'Red' | 'Blue' = 'Red';
    const redWins = prevWinners.filter((w) => w === 'Red').length + 1;
    const blueWins = prevWinners.filter((w) => w === 'Blue').length;

    setFormData((curr) => ({
      ...curr,
      ck_name: prevMatch.ck_name || curr.ck_name,
      match_format: prevMatch.match_format || curr.match_format,
      set_number: nextSet,
      team_a: { ...prevMatch.team_a },
      team_b: { ...prevMatch.team_b },
      team_a_champs: { ...prevMatch.team_a_champs },
      team_b_champs: { ...prevMatch.team_b_champs },
      team_a_kda: { ...emptyRoster },
      team_b_kda: { ...emptyRoster },
      winning_team: initialWinner,
      score: `${redWins}:${blueWins}`,
    }));

    onToast(`직전 경기(${prevMatch.ck_name || 'CK'} ${prevMatch.set_number}세트)의 10인 로스터를 불러왔습니다.`);
  };

  // 1-Click Swap Red & Blue Teams
  const handleSwapTeams = () => {
    setFormData((prev) => {
      const nextA = { ...prev.team_b };
      const nextB = { ...prev.team_a };
      const nextAChamps = { ...prev.team_b_champs };
      const nextBChamps = { ...prev.team_a_champs };
      const nextAKda = { ...prev.team_b_kda };
      const nextBKda = { ...prev.team_a_kda };
      const nextBanA = [...prev.ban_b];
      const nextBanB = [...prev.ban_a];
      const nextWinner: 'Red' | 'Blue' = prev.winning_team === 'Red' ? 'Blue' : 'Red';
      const redWins = seriesWinners.filter((w) => w === 'Red').length + (nextWinner === 'Red' ? 1 : 0);
      const blueWins = seriesWinners.filter((w) => w === 'Blue').length + (nextWinner === 'Blue' ? 1 : 0);

      return {
        ...prev,
        team_a: nextA,
        team_b: nextB,
        team_a_champs: nextAChamps,
        team_b_champs: nextBChamps,
        team_a_kda: nextAKda,
        team_b_kda: nextBKda,
        ban_a: nextBanA,
        ban_b: nextBanB,
        winning_team: nextWinner,
        score: `${redWins}:${blueWins}`,
      };
    });
    onToast('Red팀과 Blue팀 로스터 배치가 맞교환(Swap)되었습니다.');
  };

  // Unified Match Validation (with duplicate player & champion checks)
  const validateMatchForm = (matchData: Match): { isValid: boolean; errorMsg: string } => {
    // 1. Check Passcode if not already admin
    if (!isAdmin) {
      const cleanPass = formPasscode.trim().toLowerCase();
      if (!cleanPass) {
        return { isValid: false, errorMsg: '관리자 패스코드를 입력해주세요.' };
      }
      if (cleanPass !== PASSCODE.toLowerCase()) {
        return { isValid: false, errorMsg: '패스코드가 올바르지 않습니다.' };
      }
    }

    // 2. Validate Wooriming presence
    const allPlayers: string[] = [
      ...(Object.values(matchData.team_a) as string[]),
      ...(Object.values(matchData.team_b) as string[]),
    ];
    const wCount = allPlayers.filter((p) => p && p.trim() === '우리밍_').length;
    if (wCount === 0) {
      return {
        isValid: false,
        errorMsg: "양 팀 중 정확히 1개 라인에 '우리밍_'을 지정해야 합니다. (상단 빠른 지정 버튼 클릭)",
      };
    }
    if (wCount > 1) {
      return {
        isValid: false,
        errorMsg: `우리밍_이 ${wCount}곳에 중복으로 입력되어 있습니다. 1곳에만 지정해주세요.`,
      };
    }

    // 3. Player Duplicate Check (across 10 players)
    const playerCounts = new Map<string, number>();
    for (const p of allPlayers) {
      const trimmed = (p || '').trim();
      if (trimmed) {
        playerCounts.set(trimmed, (playerCounts.get(trimmed) || 0) + 1);
      }
    }
    const dupPlayers: string[] = [];
    for (const [p, count] of playerCounts.entries()) {
      if (count > 1) dupPlayers.push(p);
    }

    // 4. Champion Duplicate Check (across 10 champions in the match)
    const allChamps: string[] = [
      ...(Object.values(matchData.team_a_champs) as string[]),
      ...(Object.values(matchData.team_b_champs) as string[]),
    ];
    const champCounts = new Map<string, number>();
    for (const c of allChamps) {
      const norm = normalizeChampionName(c);
      if (norm) {
        champCounts.set(norm, (champCounts.get(norm) || 0) + 1);
      }
    }
    const dupChamps: string[] = [];
    for (const [c, count] of champCounts.entries()) {
      if (count > 1) dupChamps.push(c);
    }

    if (dupPlayers.length > 0 || dupChamps.length > 0) {
      const parts: string[] = [];
      if (dupPlayers.length > 0) parts.push(`중복 선수: ${dupPlayers.join(', ')}`);
      if (dupChamps.length > 0) parts.push(`중복 챔피언: ${dupChamps.join(', ')}`);
      return {
        isValid: false,
        errorMsg: `동일한 선수 또는 챔피언이 중복 선택되었습니다. (${parts.join(' / ')})`,
      };
    }

    return { isValid: true, errorMsg: '' };
  };

  const handleSaveMatch = () => {
    const val = validateMatchForm(formData);
    if (!val.isValid) {
      setFormError(val.errorMsg);
      onToast(val.errorMsg.includes('중복') ? '동일한 선수 또는 챔피언이 중복 선택되었습니다.' : val.errorMsg);
      return;
    }

    if (!isAdmin && persistAdminInForm) {
      onAdminLoginSuccess();
    }

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

  // Smart [저장하고 다음 세트 작성]
  const handleSaveAndNextSet = () => {
    const val = validateMatchForm(formData);
    if (!val.isValid) {
      setFormError(val.errorMsg);
      onToast(val.errorMsg.includes('중복') ? '동일한 선수 또는 챔피언이 중복 선택되었습니다.' : val.errorMsg);
      return;
    }

    if (!isAdmin && persistAdminInForm) {
      onAdminLoginSuccess();
    }

    const cleanCkName =
      formData.ck_name.trim() || `${formData.date} CK 경기`;

    const matchToSave: Match = {
      ...formData,
      ck_name: cleanCkName,
    };

    try {
      if (editingMatch) {
        onUpdateMatch(matchToSave);
      } else {
        onAddMatch(matchToSave);
      }

      // Update series winners
      const nextWinners = [...seriesWinners, formData.winning_team as 'Red' | 'Blue'];
      setSeriesWinners(nextWinners);

      const nextSetNum = (Number(formData.set_number) || 1) + 1;
      const initialWinner: 'Red' | 'Blue' = 'Red';
      const redWins = nextWinners.filter((w) => w === 'Red').length + 1;
      const blueWins = nextWinners.filter((w) => w === 'Blue').length;

      setFormData((curr) => ({
        ...curr,
        id: `m_${Date.now()}`,
        set_number: nextSetNum,
        score: `${redWins}:${blueWins}`,
        winning_team: initialWinner,
        team_a_kda: { ...emptyRoster },
        team_b_kda: { ...emptyRoster },
      }));
      setEditingMatch(null);
      setFormError('');
      onToast(`${formData.set_number}세트 저장 완료! (${nextSetNum}세트 작성을 이어갑니다 ⚡)`);
    } catch (err) {
      console.error('Save next set error', err);
      setFormError('다음 세트 저장 중 오류가 발생했습니다.');
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
      {/* Top Banner Stats: Opponent Stats TOP 5 & Most Picked TOP 5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ⚔ 맞라인 상대 승률 TOP 5 */}
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded- p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text- text-white flex items-center gap-2">
                <span>⚔</span>
                <span>맞라인 상대 승률 TOP 5</span>
              </h3>
              <span className="text- text-[#8a8aa0] bg-[#1e1e2a] px-2.5 py-0.5 rounded-full border border-[#2a2a3a]">
                클릭 시 상대 전적 상세
              </span>
            </div>

            <div className="space-y-2">
              {stats.opponentStats.length === 0 ? (
                <div className="text- text-[#6a6a80] py-6 text-center">
                  기록된 맞라인 상대 데이터가 없습니다.
                </div>
              ) : (
                stats.opponentStats.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.name}
                    onClick={() => setSelectedOpponent(item)}
                    className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] hover:border-[#8b5cf6]/50 rounded- px-3.5 py-2.5 cursor-pointer transition-all hover:bg-[#151522] group"
                    title="클릭하여 상대 전적 상세 보기"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text- text-[#6a6a80] font-bold w-">{idx + 1}</span>
                      <span className="text- font-semibold text-white group-hover:text-[#a78bfa] transition-colors">
                        {item.name}
                      </span>
                      <span className="text- text-[#a78bfa] bg-[#8b5cf6]/10 px-1.5 py-0.5 rounded font-medium border border-[#8b5cf6]/20">
                        {item.primaryLine}
                      </span>
                    </div>
                    <div className="text-right flex items-center gap-2.5">
                      <span className="text- text-[#8a8aa0]">
                        {item.games}전 {item.wins}승 {item.losses}패
                      </span>
                      <span
                        className={`text- font-black px-2 py-0.5 rounded-md ${
                          item.winrate >= 60
                            ? 'bg-[#3b82f6]/20 text-[#60a5fa]'
                            : item.winrate >= 50
                            ? 'bg-[#8b5cf6]/20 text-[#c4b5fd]'
                            : 'bg-[#ef4444]/20 text-[#f87171]'
                        }`}
                      >
                        {item.winrate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#1e1e2a] flex items-center justify-between text- text-[#6a6a80]">
            <span>우리밍_ 과의 맞라인 상대 기준</span>
            <span className="text-[#a78bfa]">상세 전적 지원</span>
          </div>
        </div>

        {/* 🏆 Most Picked */}
        <div className="bg-[#12121a] border border-[#1e1e2a] rounded- p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text- text-white flex items-center gap-2">
              <span>🏆</span>
              <span>모스트픽 TOP 5</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsChampsModalOpen(true)}
              className="text- bg-[#1e1e2a] border border-[#2a2a3a] text-[#c0c0d0] hover:text-white rounded-full px-3 py-1 hover:bg-[#2a2a3a] transition"
            >
              전체 보기
            </button>
          </div>
          <div className="space-y-2">
            {stats.mostPickedChamps.slice(0, 5).map((item, idx) => (
              <div
                key={item.champ}
                className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] rounded- px-3.5 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text- text-[#6a6a80] font-bold w-">{idx + 1}</span>
                  <ChampionIcon name={item.champ} size={24} shape="square" />
                  <span className="text- font-semibold text-white">{item.champ}</span>
                </div>
                <div className="text-right">
                  <div className="text- text-white font-medium">
                    {item.wins}승 {item.losses}패 •{' '}
                    <span className="text-[#8b5cf6] font-bold">{item.winrate.toFixed(0)}%</span>
                  </div>
                  {item.avgKDA ? (
                    <div className="text- text-[#a78bfa]">KDA {item.avgKDA}</div>
                  ) : (
                    <div className="text- text-[#5a5a6a]">KDA -</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter & Action Controls Bar */}
      <div className="bg-[#12121a] border border-[#1e1e2a] rounded- p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <div className="relative">
            <input
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              placeholder="날짜 검색 (예: 2026-09)"
              className="h- bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text- w- placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
            />
          </div>

          <div className="relative">
            <input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="CK명 검색"
              className="h- bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text- w- placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
            />
          </div>

          <select
            value={filterLine}
            onChange={(e) => setFilterLine(e.target.value)}
            className="h- bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text- text-[#c0c0d0] focus:outline-none focus:border-[#8b5cf6]/50"
          >
            <option value="ALL">전체 라인</option>
            <option value="TOP">TOP</option>
            <option value="JGL">JGL</option>
            <option value="MID">MID</option>
            <option value="ADC">ADC</option>
            <option value="SUP">SUP</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="h- px-4 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text- font-semibold flex items-center gap-1.5 shadow transition active:scale-95"
          >
            <Plus size={14} />
            <span>경기 추가</span>
          </button>
        </div>
      </div>

      {/* Match Records List (OP.GG / image_1.png Independent Card Layout) */}
      <div className="space-y-3.5">
        {filteredMatches.length === 0 ? (
          <div className="p-12 text-center text-[#62627a] bg-[#12121a]/80 border border-[#1e1e2a] rounded-">
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

            const isWRed = wTeam === 'Red';
            const allyTeamKey: WinningTeam = isWRed ? 'Red' : 'Blue';
            const enemyTeamKey: WinningTeam = isWRed ? 'Blue' : 'Red';

            const allyRoster = isWRed ? m.team_a : m.team_b;
            const allyChamps = isWRed ? m.team_a_champs : m.team_b_champs;
            const allyWon = m.winning_team === allyTeamKey;

            const enemyRoster = isWRed ? m.team_b : m.team_a;
            const enemyChamps = isWRed ? m.team_b_champs : m.team_a_champs;
            const enemyWon = m.winning_team === enemyTeamKey;

            // Calculate score with Allied team score on left, Enemy team score on right
            let scoreLeft = 0;
            let scoreRight = 0;
            if (m.score && m.score.includes(':')) {
              const parts = m.score.split(':').map((s) => parseInt(s.trim(), 10) || 0);
              const redScore = parts[0];
              const blueScore = parts[1];
              if (isWRed) {
                // Ally is Red
                scoreLeft = redScore;
                scoreRight = blueScore;
              } else {
                // Ally is Blue
                scoreLeft = blueScore;
                scoreRight = redScore;
              }
            } else {
              scoreLeft = won ? 1 : 0;
              scoreRight = won ? 0 : 1;
            }
            const allyEnemyScoreText = `${scoreLeft} : ${scoreRight}`;

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
                id={`match-${m.id}`}
                className={`relative rounded-xl border ${cardBorderClass} ${cardBgClass} transition-all duration-200 overflow-hidden group`}
              >
                {/* 왼쪽 사이드 액센트 바 */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBarClass}`} />

                <div className="p-3.5 pl-5 md:p-4.5 md:pl-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  {/* 1. [왼쪽 영역] 날짜, CK명, 승/패 결과 뱃지, 세트 스코어 (무조건 아군 vs 적군 순서) */}
                  <div className="flex xl:flex-col justify-between xl:justify-center items-start gap-1 min-w- xl:w- border-b xl:border-b-0 xl:border-r border-white/10 pb-3 xl:pb-0 xl:pr-4 shrink-0">
                    <div className="space-y-0.5">
                      <div className="text- font-bold text-[#8a8aa0] tracking-wider uppercase">
                        {format !== '단판' ? `${format} ${setNum}세트` : '단판 CK'}
                      </div>
                      <div className="text- text-[#6a6a80] font-medium">{m.date}</div>
                    </div>

                    <div className="space-y-1.5 xl:mt-2">
                      <div
                        className="font-extrabold text-white text- line-clamp-1 group-hover:text-[#c4b5fd] transition-colors"
                        title={m.ck_name}
                      >
                        {m.ck_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text- font-black px-2.5 py-0.5 rounded shadow-sm inline-flex items-center gap-1 ${
                            won
                              ? 'bg-[#2563eb] text-white shadow-[#2563eb]/20'
                              : 'bg-[#dc2626] text-white shadow-[#dc2626]/20'
                          }`}
                        >
                          {won ? '승리' : '패배'}
                        </span>
                        <span className="text- text-[#a0a0b8] font-bold" title="[아군 점수 : 적팀 점수]">
                          {allyEnemyScoreText}{' '}
                          <span className="text- text-[#6a6a80] font-normal">
                            ({won ? '아군 승' : '적팀 승'})
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. [중앙 영역] 우리밍_ 핵심 정보 (챔피언 이미지 + KDA + 평점 + 우리밍_ 닉네임) */}
                  <div className="flex items-center gap-4 flex-1 xl:px-4">
                    {/* [챔피언 아이콘 (정사각형, 크게)] */}
                    <div className="relative shrink-0">
                      <ChampionIcon
                        name={champ || ''}
                        size={56}
                        shape="square"
                        className="border-2 border-white/20 shadow-md group-hover:scale-105 transition-transform"
                      />
                      <span
                        className={`absolute -bottom-1 -right-1 text- font-black px-1.5 py-0.2 rounded shadow ${
                          LINE_LABELS[wKey] === 'ADC'
                            ? 'bg-[#8b5cf6] text-white'
                            : 'bg-[#3b82f6] text-white'
                        }`}
                      >
                        {LINE_LABELS[wKey]}
                      </span>
                    </div>

                    {/* KDA + 평점 + 우리밍_ 닉네임 */}
                    <div className="flex flex-col justify-center gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text- font-extrabold text-white tracking-tight flex items-center gap-1">
                          <span className="text-[#fbbf24] text-">👑</span>
                          우리밍_
                        </span>
                        <span className="text- text-[#8e8ea8] font-medium">
                          ({champ || '챔피언 미지정'} · {LINE_LABELS[wKey]})
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        {/* KDA 큰 글씨 */}
                        {kdaInfo && kdaInfo.kills !== undefined ? (
                          <div className="text- md:text- font-black tracking-wide text-white">
                            <span>{kdaInfo.kills}</span>
                            <span className="text-[#6a6a80] mx-1 font-medium">/</span>
                            <span className="text-[#f87171]">{kdaInfo.deaths}</span>
                            <span className="text-[#6a6a80] mx-1 font-medium">/</span>
                            <span>{kdaInfo.assists}</span>
                          </div>
                        ) : (
                          <div className="text- font-black text-white">
                            {kdaRaw && !isKdaEmpty(kdaRaw) ? `KDA ${kdaRaw}` : 'KDA -'}
                          </div>
                        )}

                        {/* 평점 */}
                        {kdaInfo && (
                          <span
                            className={`text- font-extrabold px-2 py-0.5 rounded-md ${
                              kdaInfo.isPerfect
                                ? 'bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/40'
                                : parseFloat(kdaInfo.ratioText) >= 3
                                ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40'
                                : 'bg-white/5 text-[#a0a0b8] border border-white/10'
                            }`}
                          >
                            {kdaInfo.ratioText} {kdaInfo.isPerfect ? '' : '평점'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. [우측 영역] 10인 로스터 [아군팀 5명 세로 배치] VS [적팀 5명 세로 배치] (총 2열 5행) */}
                  <div className="bg-[#07070d]/85 border border-white/10 rounded- p-2.5 sm:p-3 shrink-0">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {/* 좌측 열: 아군팀 5명 */}
                      <div className="flex flex-col gap-1 min-w- sm:min-w-">
                        <div className="flex items-center justify-between pb-1 border-b border-white/10 mb-0.5">
                          <span
                            className={`text- font-black px-1.5 py-0.5 rounded ${
                              isWRed
                                ? 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/30'
                                : 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30'
                            }`}
                          >
                            아군팀 ({isWRed ? 'RED' : 'BLUE'})
                          </span>
                          {allyWon && (
                            <span className="text- font-bold text-[#fbbf24] flex items-center gap-0.5">
                              👑 승리
                            </span>
                          )}
                        </div>
                        {LINE_KEYS.map((k) => {
                          const pName = allyRoster[k];
                          const pChamp = allyChamps[k];
                          const isW = pName === '우리밍_';
                          return (
                            <div
                              key={k}
                              className={`flex items-center gap-1.5 text- py-0.5 px-1.5 rounded transition ${
                                isW
                                  ? 'bg-[#8b5cf6]/25 border border-[#8b5cf6]/50 text-[#f5d0fe] font-bold shadow-sm'
                                  : 'text-[#c4c4d6]'
                              }`}
                              title={`${LINE_LABELS[k]}: ${pName || '-'} (${pChamp || '-'})`}
                            >
                              <ChampionIcon name={pChamp || ''} size={18} shape="square" />
                              <span className="text-[#6a6a80] text- font-semibold w- shrink-0">
                                {LINE_LABELS[k]}
                              </span>
                              <span className="whitespace-nowrap flex items-center gap-1">
                                {isW && <span className="text-[#fbbf24] text-">👑</span>}
                                <span className={isW ? 'text-[#f5d0fe] font-black' : ''}>
                                  {pName || '-'}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* 우측 열: 적팀 5명 */}
                      <div className="flex flex-col gap-1 min-w- sm:min-w- pl-2.5 sm:pl-3 border-l border-white/10">
                        <div className="flex items-center justify-between pb-1 border-b border-white/10 mb-0.5">
                          <span
                            className={`text- font-black px-1.5 py-0.5 rounded ${
                              !isWRed
                                ? 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/30'
                                : 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30'
                            }`}
                          >
                            적팀 ({!isWRed ? 'RED' : 'BLUE'})
                          </span>
                          {enemyWon && (
                            <span className="text- font-bold text-[#fbbf24] flex items-center gap-0.5">
                              👑 승리
                            </span>
                          )}
                        </div>
                        {LINE_KEYS.map((k) => {
                          const pName = enemyRoster[k];
                          const pChamp = enemyChamps[k];
                          return (
                            <div
                              key={k}
                              className="flex items-center gap-1.5 text- py-0.5 px-1.5 rounded text-[#a5a5bb]"
                              title={`${LINE_LABELS[k]}: ${pName || '-'} (${pChamp || '-'})`}
                            >
                              <ChampionIcon name={pChamp || ''} size={18} shape="square" />
                              <span className="text-[#6a6a80] text- font-semibold w- shrink-0">
                                {LINE_LABELS[k]}
                              </span>
                              <span className="whitespace-nowrap">{pName || '-'}</span>
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

                {/* 밴(Ban) 정보 리본 (Data Dragon 아이콘과 함께 세련되게 표시) */}
                {(m.ban_a.filter(Boolean).length > 0 || m.ban_b.filter(Boolean).length > 0) && (
                  <div className="px-4 py-2 bg-black/50 border-t border-white/5 flex items-center gap-4 text- text-[#8a8aa0] flex-wrap">
                    <span className="font-extrabold text-[#6a6a80] text- tracking-wider uppercase">BANS:</span>
                    {m.ban_a.filter(Boolean).length > 0 && (
                      <div className="inline-flex items-center gap-1.5 bg-[#1a1215] border border-[#ef4444]/25 px-2 py-0.5 rounded-full">
                        <span className="text-[#f87171] font-black text-">RED</span>
                        <div className="inline-flex items-center gap-1">
                          {m.ban_a.filter(Boolean).map((banName, bIdx) => (
                            <div
                              key={bIdx}
                              className="inline-flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded text- text-[#e0d0d0]"
                              title={`RED 밴: ${banName}`}
                            >
                              <ChampionIcon name={banName} size={15} shape="circle" />
                              <span className="whitespace-nowrap">{banName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.ban_b.filter(Boolean).length > 0 && (
                      <div className="inline-flex items-center gap-1.5 bg-[#101724] border border-[#3b82f6]/25 px-2 py-0.5 rounded-full">
                        <span className="text-[#60a5fa] font-black text-">BLUE</span>
                        <div className="inline-flex items-center gap-1">
                          {m.ban_b.filter(Boolean).map((banName, bIdx) => (
                            <div
                              key={bIdx}
                              className="inline-flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded text- text-[#d0d8e8]"
                              title={`BLUE 밴: ${banName}`}
                            >
                              <ChampionIcon name={banName} size={15} shape="circle" />
                              <span className="whitespace-nowrap">{banName}</span>
                            </div>
                          ))}
                        </div>
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
          <div className="w-full max-w- bg-[#12121a] border border-[#1e1e2a] rounded- p-6 max-h- overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text- text-white">우리밍_ 전체 챔피언 픽 통계</h3>
              <button
                type="button"
                onClick={() => setIsChampsModalOpen(false)}
                className="w- h- bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white text-"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {stats.mostPickedChamps.map((item, idx) => (
                <div
                  key={item.champ}
                  className="flex items-center justify-between bg-[#08080c] border border-[#1e1e2a] rounded- px-3.5 py-2 text-"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[#6a6a80] text- w-">{idx + 1}</span>
                    <ChampionIcon name={item.champ} size={24} shape="square" />
                    <span className="font-semibold text-white">{item.champ}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[#c0c0d0]">
                      {item.picks}픽 {item.wins}승 {item.losses}패{' '}
                      <span className="text-[#8b5cf6] font-bold ml-1">{item.winrate.toFixed(0)}%</span>
                    </div>
                    {item.avgKDA ? (
                      <div className="text- text-[#a78bfa]">평균 KDA {item.avgKDA}</div>
                    ) : (
                      <div className="text- text-[#5a5a6a]">KDA 없음</div>
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
          <div className="w-full max-w- bg-[#12121a] border border-[#1e1e2a] rounded- p-6 my-8 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold text- text-white">
                  {editingMatch ? '경기 수정' : '스마트 세트 경기 등록'}
                </h3>
                <span className="text- bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 text-[#c4b5fd] px-2 py-0.5 rounded-full font-semibold">
                  스마트 세트 시스템
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w- h- bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
              >
                <X size={14} />
              </button>
            </div>

            {isAdmin && (
              <div className="mb-4 inline-flex items-center gap-1.5 text- bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] px-3 py-1 rounded-full">
                <span>🔒 관리자 인증 완료 (패스코드 입력 불필요)</span>
              </div>
            )}

            {/* Smart Action Toolbar */}
            <div className="mb-4 p-3 bg-[#0a0a12] border border-[#1e1e2a] rounded- flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadPreviousSetRoster}
                  className="h- px-3.5 bg-[#8b5cf6]/15 hover:bg-[#8b5cf6]/25 border border-[#8b5cf6]/40 text-[#c4b5fd] rounded-full text- font-bold transition flex items-center gap-1.5"
                  title="직전 세트의 10인 명단과 챔피언 배치를 복사해옵니다"
                >
                  <Copy size={13} className="text-[#a78bfa]" />
                  <span>⚡ 이전 세트 10인 로스터 불러오기</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwapTeams}
                  className="h- px-3.5 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-[#c0c0d0] rounded-full text- font-bold transition flex items-center gap-1.5"
                  title="Red팀과 Blue팀 5인을 서로 맞교환합니다"
                >
                  <ArrowLeftRight size={13} className="text-[#38bdf8]" />
                  <span>🔄 Red ↔ Blue 팀 스왑</span>
                </button>
              </div>

              <div className="text- text-[#8a8aa0]">
                중복 방지 유효성 검사 활성
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text- text-[#8a8aa0] mb-1 block">경기 일자</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full h- bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text- text-white focus:outline-none focus:border-[#8b5cf6]/50"
                />
              </div>

              <div>
                <label className="text- text-[#8a8aa0] mb-1 block">CK 명칭</label>
                <input
                  value={formData.ck_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ck_name: e.target.value }))}
                  placeholder="예: 치지직 심야 드래프트 CK"
                  className="w-full h- bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text- text-white placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
                />
              </div>

              <div>
                <label className="text- text-[#8a8aa0] mb-1 block">경기 방식</label>
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
                  className="w-full h- bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text- text-white focus:outline-none focus:border-[#8b5cf6]/50"
                >
                  <option value="단판">단판</option>
                  <option value="3판2선승">3판2선승</option>
                  <option value="5판3선승">5판3선승</option>
                </select>
              </div>

              <div>
                <label className="text- text-[#8a8aa0] mb-1 block">세트 번호</label>
                <select
                  value={formData.set_number}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, set_number: parseInt(e.target.value, 10) }))
                  }
                  disabled={formData.match_format === '단판'}
                  className={`w-full h- bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text- text-white focus:outline-none focus:border-[#8b5cf6]/50 ${
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

            {/* Smart Winner Selection & Cumulative Score */}
            <div className="mb-4 bg-[#0a0a10] border border-[#1e1e2a] rounded- p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="text- font-bold text-white flex items-center gap-1.5">
                  <Trophy size={14} className="text-[#fbbf24]" />
                  <span>승리 팀 선택 & 세트 스코어 자동 계산</span>
                </div>
                {seriesWinners.length > 0 && (
                  <div className="text- text-[#c0c0d0] bg-[#1e1e2a] px-3 py-1 rounded-full border border-[#2a2a3a]">
                    이전 세트: {seriesWinners.map((w, i) => `${i + 1}세트(${w === 'Red' ? '🔴RED' : '🔵BLUE'})`).join(' → ')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => handleSelectWinner('Red')}
                  className={`h- rounded- font-bold text- border transition flex items-center justify-center gap-2 ${
                    formData.winning_team === 'Red'
                      ? 'bg-[#ef4444] text-white border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.35)]'
                      : 'bg-[#ef4444]/10 text-[#fca5a5] border-[#ef4444]/30 hover:bg-[#ef4444]/20'
                  }`}
                >
                  <span>🔴 RED팀 승리</span>
                  {formData.winning_team === 'Red' && (
                    <span className="text- bg-black/30 px-2 py-0.5 rounded-full">선택됨</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectWinner('Blue')}
                  className={`h- rounded- font-bold text- border transition flex items-center justify-center gap-2 ${
                    formData.winning_team === 'Blue'
                      ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.35)]'
                      : 'bg-[#3b82f6]/10 text-[#93c5fd] border-[#3b82f6]/30 hover:bg-[#3b82f6]/20'
                  }`}
                >
                  <span>🔵 BLUE팀 승리</span>
                  {formData.winning_team === 'Blue' && (
                    <span className="text- bg-black/30 px-2 py-0.5 rounded-full">선택됨</span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="text- font-semibold text-[#a0a0b8] whitespace-nowrap">
                  누적 세트 스코어:
                </label>
                <input
                  value={formData.score}
                  onChange={(e) => setFormData((prev) => ({ ...prev, score: e.target.value }))}
                  placeholder="예: 1:0, 2:1"
                  className="h- w- text-center font-bold font-mono bg-[#12121a] border border-[#2a2a3a] rounded-full px-3 text- text-white focus:outline-none focus:border-[#8b5cf6]"
                />
                <span className="text- text-[#6a6a80]">(승리 버튼 클릭 시 자동 계산 / 수동 수정 가능)</span>
              </div>
            </div>

            {/* Wooriming Fast Line Assignment Bar */}
            <div className="mb-4 bg-[#0a0a10] border border-[#222232] rounded- p-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text- font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#a78bfa]" />
                  <span>우리밍_ 배치 라인:</span>
                </span>
                {woorimingLocation ? (
                  <span
                    className={`text- font-bold px-2.5 py-0.5 rounded-full border ${
                      woorimingLocation.team === 'team_a'
                        ? 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/40'
                        : 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/40'
                    }`}
                  >
                    {woorimingLocation.team === 'team_a' ? '🔴 Red팀' : '🔵 Blue팀'} {LINE_LABELS[woorimingLocation.line]} ({woorimingLocation.line.toUpperCase()})
                  </span>
                ) : (
                  <span className="text- font-semibold text-[#ef4444] bg-[#ef4444]/15 px-2.5 py-0.5 rounded-full border border-[#ef4444]/30">
                    ⚠ 아직 미배치됨 (전적 산출 필수)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-">
                <span className="text-[#8a8aa0] text- mr-1">원클릭 배치:</span>
                <button
                  type="button"
                  onClick={() => handleSetWooriming('team_a', 'adc')}
                  className={`h- px-2.5 rounded-full text- font-medium border transition ${
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
                  className={`h- px-2.5 rounded-full text- font-medium border transition ${
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
                  className={`h- px-2.5 rounded-full text- font-medium border transition ${
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
                  className={`h- px-2.5 rounded-full text- font-medium border transition ${
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
                  className="mb-4 bg-[#08080c] border rounded- p-4"
                  style={{
                    borderColor: isRed ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)',
                  }}
                >
                  <div
                    className="text- font-bold mb-3 flex items-center justify-between"
                    style={{ color: isRed ? '#ef4444' : '#3b82f6' }}
                  >
                    <span>
                      {isRed ? '🔴 Red팀' : '🔵 Blue팀'} 로스터 (플레이어 / 챔피언 / KDA)
                    </span>
                    <span className="text- text-[#8a8aa0] font-normal">
                      우리밍_은 '밍' 버튼으로 빠른 지정 가능
                    </span>
                  </div>

                  <div className="space-y-2">
                    {LINE_KEYS.map((lineKey) => {
                      const playerName = formData[teamKey][lineKey] || '';
                      const isW = playerName === '우리밍_';
                      const isPlayerDup = playerName.trim() !== '' && duplicatePlayers.has(playerName.trim());
                      const champName = formData[champsKey][lineKey] || '';
                      const normChamp = normalizeChampionName(champName);
                      const isChampDup = normChamp !== '' && duplicateChamps.has(normChamp);

                      return (
                        <div key={lineKey} className="flex flex-wrap gap-2 items-center">
                          <span className="w- text- font-bold text-[#8a8aa0] tracking-widest">
                            {LINE_LABELS[lineKey]}
                          </span>

                          {/* Player Input with Autocomplete & Duplicate Highlight */}
                          <div className="relative">
                            <input
                              value={playerName}
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
                              className={`h- w- bg-[#12121a] border rounded-full px-3 text- text-white focus:outline-none transition ${
                                isPlayerDup
                                  ? 'border-[#ef4444] bg-[#ef4444]/15 text-[#fca5a5] ring-1 ring-[#ef4444]/50 font-bold'
                                  : isW
                                  ? 'border-[#8b5cf6] font-bold text-[#a78bfa]'
                                  : 'border-[#1e1e2a]'
                              }`}
                            />
                            {isPlayerDup && (
                              <span
                                className="absolute -top-1.5 -right-1 text- bg-[#ef4444] text-white px-1 rounded-full font-black"
                                title="동일한 선수가 중복되었습니다"
                              >
                                중복
                              </span>
                            )}
                          </div>

                          {/* Champ Input with Autocomplete & Duplicate Highlight */}
                          <div className="relative">
                            <input
                              value={champName}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  [champsKey]: { ...prev[champsKey], [lineKey]: e.target.value },
                                }))
                              }
                              placeholder="챔피언"
                              list="champs-datalist"
                              className={`h- w- bg-[#12121a] border rounded-full px-3 text- text-white focus:outline-none transition ${
                                isChampDup
                                  ? 'border-[#ef4444] bg-[#ef4444]/15 text-[#fca5a5] ring-1 ring-[#ef4444]/50 font-bold'
                                  : isW
                                  ? 'border-[#8b5cf6]/50'
                                  : 'border-[#1e1e2a]'
                              }`}
                            />
                            {isChampDup && (
                              <span
                                className="absolute -top-1.5 -right-1 text- bg-[#ef4444] text-white px-1 rounded-full font-black"
                                title="동일한 챔피언이 중복되었습니다"
                              >
                                중복
                              </span>
                            )}
                          </div>

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
                            className={`h- w- bg-[#12121a] border rounded-full px-3 text- text-white focus:outline-none ${
                              isW
                                ? 'border-[#8b5cf6] bg-[#8b5cf6]/10 font-bold'
                                : 'border-[#1e1e2a] opacity-60'
                            }`}
                          />

                          {/* Quick 밍 button */}
                          <button
                            type="button"
                            onClick={() => handleSetWooriming(teamKey, lineKey)}
                            className={`h- px-2.5 border rounded-full text- font-bold transition ${
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
                    <span className="text- text-[#6a6a80] mr-2 font-medium">밴 (5개):</span>
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
                        className="h- w- bg-[#12121a] border border-[#1e1e2a] rounded-full px-2.5 text- text-white placeholder:text-[#4a4a5a] focus:outline-none focus:border-[#8b5cf6]/40"
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Duplicate Warning Banner */}
            {(duplicatePlayers.size > 0 || duplicateChamps.size > 0) && (
              <div className="mb-4 p-3 bg-[#ef4444]/15 border border-[#ef4444]/40 rounded- text-[#ef4444] text- flex items-center gap-2 animate-[fadeIn_0.15s]">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-semibold">
                  동일한 선수 또는 챔피언이 중복 선택되었습니다.
                  {duplicatePlayers.size > 0 && ` [선수 중복: ${Array.from(duplicatePlayers).join(', ')}]`}
                  {duplicateChamps.size > 0 && ` [챔피언 중복: ${Array.from(duplicateChamps).join(', ')}]`}
                </span>
              </div>
            )}

            {/* In-Modal Error Banner */}
            {formError && (
              <div className="mt-4 p-3 bg-[#ef4444]/15 border border-[#ef4444]/40 rounded- text-[#ef4444] text- flex items-center gap-2 animate-[fadeIn_0.15s]">
                <AlertCircle size={16} className="shrink-0" />
                <span className="font-semibold">{formError}</span>
              </div>
            )}

            {/* Passcode & Action Buttons */}
            <div className="mt-4 flex flex-wrap gap-3 items-center justify-between border-t border-[#1e1e2a] pt-4">
              {!isAdmin ? (
                <div className="flex items-center gap-2 flex-1 max-w-">
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
                    className="h- flex-1 bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text- text-white placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50"
                  />
                  <label className="flex items-center gap-1 text- text-[#8a8aa0] cursor-pointer whitespace-nowrap">
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
                <div className="text- text-[#10b981] font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>관리자 모드 활성화됨 (패스코드 입력 불필요)</span>
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h- px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#c0c0d0] rounded-full text- font-medium transition"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndNextSet}
                  className="h- px-4 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#7c3aed] hover:to-[#4f46e5] text-white rounded-full text- font-bold shadow transition flex items-center gap-1.5"
                  title="현재 세트를 저장하고 10인 로스터를 유지한 채 다음 세트 작성을 이어갑니다"
                >
                  <FastForward size={14} />
                  <span>저장하고 다음 세트 작성 (⚡)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveMatch}
                  className="h- px-5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text- font-bold shadow transition flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>저장 완료</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Opponent Detail Modal (맞라인 상대 전적 상세 모달) */}
      {selectedOpponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-[fadeIn_0.15s]">
          <div className="w-full max-w- bg-[#12121a] border border-[#1e1e2a] rounded- p-6 max-h- flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-[#1e1e2a]">
              <div className="flex items-center gap-3">
                <div className="w- h- rounded-full bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 flex items-center justify-center text-">
                  ⚔
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text- text-white">{selectedOpponent.name}</h3>
                    <span className="text- text-[#a78bfa] bg-[#8b5cf6]/15 px-2.5 py-0.5 rounded-full font-semibold border border-[#8b5cf6]/30">
                      주 맞라인: {selectedOpponent.primaryLine}
                    </span>
                  </div>
                  <p className="text- text-[#8a8aa0] mt-0.5">
                    우리밍_ 상대 전적: <span className="text-white font-bold">{selectedOpponent.games}전 {selectedOpponent.wins}승 {selectedOpponent.losses}패</span> (승률 <span className="text-[#8b5cf6] font-extrabold">{selectedOpponent.winrate.toFixed(0)}%</span>)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOpponent(null)}
                className="w- h- bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-[#a0a0b8] hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Match History List */}
            <div className="overflow-y-auto my-4 space-y-2.5 pr-1 max-h-">
              {selectedOpponent.matches.map((m, idx) => (
                <div
                  key={`${m.matchId}_${idx}`}
                  className="bg-[#08080c] border border-[#1e1e2a] rounded- p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#8b5cf6]/30 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text- text-[#8a8aa0]">
                      <span className="text-[#c0c0d0] font-medium">{m.date}</span>
                      <span>•</span>
                      <span className="text-white font-semibold truncate max-w-">{m.ckName}</span>
                      <span>•</span>
                      <span className="text-[#a78bfa] font-bold">{m.setNumber}세트</span>
                    </div>
                    <div className="flex items-center gap-2.5 text- flex-wrap">
                      {/* Wooriming */}
                      <div className="flex items-center gap-1.5 bg-[#12121c] border border-[#222234] px-2.5 py-1 rounded-lg">
                        <ChampionIcon name={m.myChamp} size={20} shape="square" />
                        <span className="text-white font-bold text-">우리밍_</span>
                        <span className="text-[#8a8aa0] text-">({m.myChamp || '미지정'})</span>
                        {m.myKda && <span className="text-[#a78bfa] text- ml-1 font-mono">{m.myKda}</span>}
                      </div>

                      <span className="text-[#6a6a80] font-black text-">VS</span>

                      {/* Opponent */}
                      <div className="flex items-center gap-1.5 bg-[#12121c] border border-[#222234] px-2.5 py-1 rounded-lg">
                        <ChampionIcon name={m.opponentChamp} size={20} shape="square" />
                        <span className="text-white font-bold text-">{selectedOpponent.name}</span>
                        <span className="text-[#8a8aa0] text-">({m.opponentChamp || '미지정'})</span>
                        {m.opponentKda && <span className="text-[#8a8aa0] text- ml-1 font-mono">{m.opponentKda}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0">
                    <span
                      className={`text- font-black px-3 py-1 rounded-full border ${
                        m.won
                          ? 'bg-[#3b82f6]/20 text-[#60a5fa] border-[#3b82f6]/40'
                          : 'bg-[#ef4444]/20 text-[#f87171] border-[#ef4444]/40'
                      }`}
                    >
                      {m.won ? '우리밍_ 승리 👑' : '우리밍_ 패배'}
                    </span>
                    {m.score && (
                      <span className="text- text-[#8a8aa0] mt-1 font-mono">
                        세트 스코어 {m.score}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#1e1e2a] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOpponent(null)}
                className="h- px-5 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white rounded-full text- font-medium transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s]">
          <div className="w-full max-w- bg-[#12121a] border border-[#1e1e2a] rounded- p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text- text-white flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-[#ef4444]" />
                <span>경기 삭제 확인</span>
              </h4>
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="w- h- bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
              >
                <X size={14} />
              </button>
            </div>

            {isAdmin ? (
              <p className="text- text-[#8a8aa0] mb-4 leading-relaxed">
                관리자 모드가 활성화되어 있습니다. 선택한 경기를 삭제하시겠습니까?
              </p>
            ) : (
              <>
                <p className="text- text-[#8a8aa0] mb-4">
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
                  className="w-full h- bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text- text-white focus:outline-none focus:border-[#ef4444]/50 mb-2"
                  autoFocus
                />
                {deleteError && (
                  <div className="text- text-[#ff6b6b] mb-3">{deleteError}</div>
                )}
              </>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 h- bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#c0c0d0] rounded-full text-"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 h- bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-full text- font-bold"
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
