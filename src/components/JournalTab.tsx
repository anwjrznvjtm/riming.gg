/**
 * src/components/JournalTab.tsx
 * RESTORED VERSION - 스크린샷 원래 디자인 유지 + 초성 검색만 추가!
 * - 상단 필터: ㅇㄹㅁ_ → 우리밍_, ㅅㅇㄴ → 상이너, ㄱㄹ → 가렌 챔피언도 검색됨
 * - 경기 추가 모달: 플레이어 ㅇㄹㅁ_ / 챔피언 ㄱㄹ 초성 검색 지원
 * - 카드 디자인: 스크린샷 그대로 (TOP: 농이(말파) vs 여을(모데) 형태)
 */

import React, { useState, useMemo } from 'react';
import { Match, LineKey, LINE_KEYS, LINE_LABELS, MatchFormat, WinningTeam } from '../types';
import { ComputedStats, OpponentStat, getWoorimingLine } from '../lib/stats';
import { ChampionIcon } from './ChampionIcon';
import { normalizeChampionName } from '../lib/champions';
import { PASSCODE } from '../data/initialMatches';
import { getChosung, isChosungQuery } from '../lib/fuzzySearch';
import { StreamerAutocomplete } from './StreamerAutocomplete';
import { ChampionAutocomplete } from './ChampionAutocomplete';
import { Plus, X, Edit2, Trash2, ShieldAlert, ArrowLeftRight, Copy, Sparkles, Trophy, AlertCircle } from 'lucide-react';

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
  stats, matches, onAddMatch, onUpdateMatch, onDeleteMatch, isAdmin, onAdminLoginSuccess, onToast, allStreamers, allChampions,
}) => {
  const [filterDate, setFilterDate] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterLine, setFilterLine] = useState('ALL');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [formError, setFormError] = useState('');
  const [seriesWinners, setSeriesWinners] = useState<('Red' | 'Blue')[]>([]);
  const emptyRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };
  const [formData, setFormData] = useState<Match>({
    id: '', date: new Date().toISOString().slice(0, 10), ck_name: '',
    team_a: { ...emptyRoster, adc: '우리밍_' }, team_b: { ...emptyRoster },
    team_a_champs: { ...emptyRoster }, team_b_champs: { ...emptyRoster },
    ban_a: ['', '', '', '', ''], ban_b: ['', '', '', '', ''],
    team_a_kda: { ...emptyRoster }, team_b_kda: { ...emptyRoster },
    score: '1:0', winning_team: 'Red', match_format: '3판2선승', set_number: 1,
  });
  const [formPasscode, setFormPasscode] = useState('');
  const [persistAdminInForm, setPersistAdminInForm] = useState(true);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePasscode, setDeletePasscode] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const getAllyTeamDirect = (m: Match): 'Red' | 'Blue' => {
    for (const k of LINE_KEYS) { if ((m.team_a[k] || '').trim() === '우리밍_') return 'Red'; }
    return 'Blue';
  };

  const correctedScoreMap = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of matches) {
      const key = `${m.date}__${(m.ck_name || '').trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    const map = new Map<string, string>();
    for (const [, group] of groups) {
      const sortedAsc = [...group].sort((a, b) => (Number(a.set_number) || 1) - (Number(b.set_number) || 1));
      let allyWins = 0; let enemyWins = 0;
      for (const mm of sortedAsc) {
        const allyTeam = getAllyTeamDirect(mm);
        const allyWin = mm.winning_team === allyTeam;
        if (allyWin) allyWins++; else enemyWins++;
        map.set(mm.id, `${allyWins}:${enemyWins}`);
      }
    }
    return map;
  }, [matches]);

  // ✅ 복구 + 초성 검색 필터 - 스크린샷 디자인 유지!
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (filterDate && !m.date.includes(filterDate)) return false;
      if (filterName) {
        const q = filterName.trim().toLowerCase();
        const qChosung = getChosung(q);
        const isChosungOnly = isChosungQuery(q);
        const ckName = (m.ck_name || '').toLowerCase();
        const ckChosung = getChosung(m.ck_name || '');
        const allPlayersInMatch: string[] = [];
        for (const k of LINE_KEYS) {
          if (m.team_a[k]) allPlayersInMatch.push(m.team_a[k]);
          if (m.team_b[k]) allPlayersInMatch.push(m.team_b[k]);
          if (m.team_a_champs[k]) allPlayersInMatch.push(m.team_a_champs[k]);
          if (m.team_b_champs[k]) allPlayersInMatch.push(m.team_b_champs[k]);
        }
        let matched = false;
        if (isChosungOnly) {
          if (ckChosung.includes(q)) matched = true;
          for (const p of allPlayersInMatch) { if (getChosung(p).includes(q)) { matched = true; break; } }
        } else {
          if (ckName.includes(q)) matched = true;
          if (!matched && ckChosung.includes(qChosung) && qChosung.length >= 1) matched = true;
          for (const p of allPlayersInMatch) { if (p.toLowerCase().includes(q) || getChosung(p).includes(qChosung)) { matched = true; break; } }
        }
        if (!matched) return false;
      }
      if (filterLine !== 'ALL') {
        const line = getWoorimingLine(m);
        if (line !== filterLine) return false;
      }
      return true;
    }).sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      const ckDiff = (b.ck_name || '').localeCompare(a.ck_name || '');
      if (ckDiff !== 0) return ckDiff;
      return (Number(b.set_number) || 1) - (Number(a.set_number) || 1);
    });
  }, [matches, filterDate, filterName, filterLine]);

  const woorimingLocation = useMemo(() => {
    for (const teamKey of ['team_a', 'team_b'] as const) {
      for (const l of LINE_KEYS) { if (formData[teamKey][l]?.trim() === '우리밍_') return { team: teamKey, line: l }; }
    }
    return null;
  }, [formData.team_a, formData.team_b]);

  const handleSetWooriming = (targetTeam: 'team_a' | 'team_b', targetLine: LineKey) => {
    setFormData((prev) => {
      const nextA = { ...prev.team_a }; const nextB = { ...prev.team_b };
      for (const l of LINE_KEYS) { if (nextA[l]?.trim() === '우리밍_') nextA[l] = ''; if (nextB[l]?.trim() === '우리밍_') nextB[l] = ''; }
      if (targetTeam === 'team_a') nextA[targetLine] = '우리밍_'; else nextB[targetLine] = '우리밍_';
      return { ...prev, team_a: nextA, team_b: nextB };
    }); setFormError('');
  };

  const { duplicatePlayers, duplicateChamps } = useMemo(() => {
    const pCounts = new Map<string, number>(); const cCounts = new Map<string, number>();
    const dupP = new Set<string>(); const dupC = new Set<string>();
    for (const t of ['team_a', 'team_b'] as const) {
      for (const l of LINE_KEYS) {
        const p = (formData[t]?.[l] || '').trim();
        if (p) { pCounts.set(p, (pCounts.get(p) || 0) + 1); if ((pCounts.get(p) || 0) > 1) dupP.add(p); }
        const c = normalizeChampionName(formData[`${t}_champs`][l] || '');
        if (c) { cCounts.set(c, (cCounts.get(c) || 0) + 1); if ((cCounts.get(c) || 0) > 1) dupC.add(c); }
      }
    }
    return { duplicatePlayers: dupP, duplicateChamps: dupC };
  }, [formData]);

  const validateMatchForm = (matchData: Match): { isValid: boolean; errorMsg: string } => {
    if (!isAdmin) {
      const cleanPass = formPasscode.trim().toLowerCase();
      if (!cleanPass) return { isValid: false, errorMsg: '패스코드 입력 필요' };
      if (cleanPass !== PASSCODE.toLowerCase()) return { isValid: false, errorMsg: '패스코드 틀림' };
    }
    const allPlayers: string[] = [...(Object.values(matchData.team_a) as string[]), ...(Object.values(matchData.team_b) as string[])];
    const wCount = allPlayers.filter((p) => p && p.trim() === '우리밍_').length;
    if (wCount === 0) return { isValid: false, errorMsg: "우리밍_ 배치 필요" };
    if (wCount > 1) return { isValid: false, errorMsg: `우리밍_ 중복 ${wCount}곳` };
    if (duplicatePlayers.size > 0 || duplicateChamps.size > 0) return { isValid: false, errorMsg: `중복: ${Array.from(duplicatePlayers).join(',')} / ${Array.from(duplicateChamps).join(',')}` };
    return { isValid: true, errorMsg: '' };
  };

  const handleSaveMatch = () => {
    const val = validateMatchForm(formData);
    if (!val.isValid) { setFormError(val.errorMsg); onToast(val.errorMsg); return; }
    if (!isAdmin && persistAdminInForm) onAdminLoginSuccess();
    const cleanCkName = formData.ck_name.trim() || `${formData.date} CK`;
    const matchToSave: Match = { ...formData, ck_name: cleanCkName };
    if (editingMatch) { onUpdateMatch(matchToSave); onToast('수정 완료!'); } else { onAddMatch(matchToSave); onToast('등록 완료!'); }
    setIsEditModalOpen(false); setFormError('');
  };

  const handleSaveAndNextSet = () => {
    const val = validateMatchForm(formData);
    if (!val.isValid) { setFormError(val.errorMsg); onToast(val.errorMsg); return; }
    if (!isAdmin && persistAdminInForm) onAdminLoginSuccess();
    const cleanCkName = formData.ck_name.trim() || `${formData.date} CK`;
    const matchToSave: Match = { ...formData, ck_name: cleanCkName };
    if (editingMatch) onUpdateMatch(matchToSave); else onAddMatch(matchToSave);
    const nextWinners = [...seriesWinners, formData.winning_team as 'Red' | 'Blue'];
    setSeriesWinners(nextWinners);
    const nextSetNum = (Number(formData.set_number) || 1) + 1;
    setFormData((curr) => ({ ...curr, id: `m_${Date.now()}`, set_number: nextSetNum, team_a_kda: { ...emptyRoster }, team_b_kda: { ...emptyRoster } }));
    setEditingMatch(null); setFormError(''); onToast(`${formData.set_number}세트 저장! ${nextSetNum}세트 작성 중`);
  };

  const handleOpenAddModal = () => {
    setEditingMatch(null);
    setFormData({
      id: `m_${Date.now()}`, date: new Date().toISOString().slice(0, 10), ck_name: '',
      team_a: { ...emptyRoster, adc: '우리밍_' }, team_b: { ...emptyRoster },
      team_a_champs: { ...emptyRoster }, team_b_champs: { ...emptyRoster },
      ban_a: ['', '', '', '', ''], ban_b: ['', '', '', '', ''],
      team_a_kda: { ...emptyRoster }, team_b_kda: { ...emptyRoster },
      score: '1:0', winning_team: 'Red', match_format: '3판2선승', set_number: 1,
    }); setIsEditModalOpen(true); setFormError(''); setSeriesWinners([]);
  };

  const handleOpenEditModal = (m: Match) => { setEditingMatch(m); setFormData({ ...m }); setIsEditModalOpen(true); setFormError(''); };
  const handleLoadPreviousSetRoster = () => {
    const prevMatches = matches.filter(mm => mm.date === formData.date && (mm.ck_name || '').trim() === formData.ck_name.trim()).sort((a,b)=> (Number(b.set_number)||1)-(Number(a.set_number)||1));
    if (prevMatches.length===0) { onToast('이전 세트 없음'); return; }
    const prev = prevMatches[0];
    setFormData(curr=> ({ ...curr, team_a: { ...prev.team_a }, team_b: { ...prev.team_b }, team_a_champs: { ...prev.team_a_champs }, team_b_champs: { ...prev.team_b_champs } }));
    onToast(`${prev.set_number}세트 로스터 불러옴!`);
  };
  const handleSwapTeams = () => {
    setFormData(prev=> {
      const nextA={...prev.team_b}; const nextB={...prev.team_a};
      const nextAChamps={...prev.team_b_champs}; const nextBChamps={...prev.team_a_champs};
      const nextAKda={...prev.team_b_kda}; const nextBKda={...prev.team_a_kda};
      const nextBanA=[...prev.ban_b]; const nextBanB=[...prev.ban_a];
      const nextWinner = prev.winning_team==='Red'?'Blue':'Red';
      return { ...prev, team_a: nextA, team_b: nextB, team_a_champs: nextAChamps, team_b_champs: nextBChamps, team_a_kda: nextAKda, team_b_kda: nextBKda, ban_a: nextBanA, ban_b: nextBanB, winning_team: nextWinner };
    }); onToast('Red ↔ Blue 스왑!');
  };
  const handleDeleteClick = (id: string) => { setDeleteTargetId(id); setDeletePasscode(''); setDeleteError(''); };
  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;
    if (!isAdmin && deletePasscode.trim().toLowerCase() !== PASSCODE.toLowerCase()) { setDeleteError('패스코드 틀림'); return; }
    if (!isAdmin) onAdminLoginSuccess();
    onDeleteMatch(deleteTargetId); onToast('삭제 완료'); setDeleteTargetId(null);
  };

  return (
    <div className="space-y-4 animate-[fadeIn_0.2s]">
      {/* 필터 - 복구 + 초성 */}
      <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[16px] p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <input value={filterDate} onChange={(e) => setFilterDate(e.target.value)} placeholder="날짜 (2026-09)" className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] w-[160px] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50 text-white" />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px]">🔍</span>
            <input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="CK명, 선수, 챔프 초성 (ㅇㄹㅁ_, ㅅㅇㄴ, ㄱㄹ)" className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full pl-8 pr-4 text-[12px] w-[280px] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50 text-white" />
            {filterName && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-[#7c3aed] font-mono">{getChosung(filterName)}</span>}
          </div>
          <select value={filterLine} onChange={(e) => setFilterLine(e.target.value)} className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-[#c0c0d0]">
            <option value="ALL">전체 라인</option><option value="TOP">TOP</option><option value="JGL">JGL</option><option value="MID">MID</option><option value="ADC">ADC</option><option value="SUP">SUP</option>
          </select>
          {filterName && <span className="text-[10px] text-[#5a5a70] self-center">{filteredMatches.length}개 • 초성 OK</span>}
        </div>
        <button type="button" onClick={handleOpenAddModal} className="h-[36px] px-4 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-semibold flex items-center gap-1.5"><Plus size={14}/><span>경기 추가</span></button>
      </div>

      {/* 매치 리스트 - 스크린샷 원래 디자인 그대로 복구! */}
      <div className="space-y-2.5">
        {filteredMatches.length === 0 ? (
          <div className="p-12 text-center text-[#62627a] bg-[#12121a]/80 border border-[#1e1e2a] rounded-[20px]">
            일치하는 경기 없음 {filterName && ` - "${filterName}" (${getChosung(filterName)})`}
          </div>
        ) : filteredMatches.map((m) => {
          const won = m.winning_team === getAllyTeamDirect(m);
          const allyTeam = getAllyTeamDirect(m);
          const scoreText = correctedScoreMap.get(m.id) || m.score;
          const isRedWin = m.winning_team === 'Red';
          return (
            <div key={m.id} className={`relative rounded-[12px] border bg-[#12121a] overflow-hidden group hover:border-[#2a2a4a] transition ${won?'border-l-[3px] border-l-[#3b82f6] border-[#1e2a4a]':'border-l-[3px] border-l-[#ef4444] border-[#2a1e1e]'}`}>
              <div className="px-4 py-3">
                {/* 상단: 날짜 + CK명 + 승리/패배 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-[#8a8aa0] font-medium">{m.date}</span>
                    <span className="text-[#3a3a4a]">·</span>
                    <span className="text-white font-bold">{m.ck_name}</span>
                    <span className="text-[#8a8aa0]">{m.set_number}세트</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${won?'bg-[#1e3a5f] text-[#60a5fa] border border-[#2a4a7a]':'bg-[#3a1e1e] text-[#f87171] border border-[#4a2a2a]'}`}>
                      {won ? `승리 ${scoreText}` : `패배 ${scoreText}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={()=>handleOpenEditModal(m)} className="w-7 h-7 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full grid place-items-center text-[#6a6a80] hover:text-white transition"><Edit2 size={12}/></button>
                    <button onClick={()=>handleDeleteClick(m.id)} className="w-7 h-7 bg-[#1e1e2a] hover:bg-[#ef4444]/20 rounded-full grid place-items-center text-[#6a6a80] hover:text-[#f87171] transition"><Trash2 size={12}/></button>
                  </div>
                </div>
                {/* 라인별: TOP: 농이(말파) vs 여을(모데) - 스크린샷 형태 */}
                <div className="space-y-1 text-[11px] leading-[1.6]">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {(LINE_KEYS as LineKey[]).slice(0,3).map(k => {
                      const pA = m.team_a[k]||'-'; const cA = m.team_a_champs[k]||'?';
                      const pB = m.team_b[k]||'-'; const cB = m.team_b_champs[k]||'?';
                      const isWooA = pA==='우리밍_'; const isWooB = pB==='우리밍_';
                      return (
                        <span key={k} className="text-[#6a6a80]">
                          {k.toUpperCase()}: <b className={isWooA?'text-[#a78bfa]':'text-[#c2c6d6]'}>{pA}</b><span className="text-[#8a8aa0]">({cA})</span> vs <b className={isWooB?'text-[#a78bfa]':'text-[#c2c6d6]'}>{pB}</b><span className="text-[#8a8aa0]">({cB})</span>
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {(LINE_KEYS as LineKey[]).slice(3).map(k => {
                      const pA = m.team_a[k]||'-'; const cA = m.team_a_champs[k]||'?';
                      const pB = m.team_b[k]||'-'; const cB = m.team_b_champs[k]||'?';
                      const isWooA = pA==='우리밍_'; const isWooB = pB==='우리밍_';
                      return (
                        <span key={k} className="text-[#6a6a80]">
                          {k.toUpperCase()}: <b className={isWooA?'text-[#a78bfa]':'text-[#c2c6d6]'}>{pA}</b><span className="text-[#8a8aa0]">({cA})</span> vs <b className={isWooB?'text-[#a78bfa]':'text-[#c2c6d6]'}>{pB}</b><span className="text-[#8a8aa0]">({cB})</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 경기 추가 모달 - 초성 검색 적용 */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-[900px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 my-8 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[16px] text-white flex items-center gap-2"><Trophy size={16} className="text-[#fbbf24}"/>{editingMatch ? '경기 수정' : '경기 등록'} <span className="text-[10px] bg-[#7c3aed]/20 text-[#a78bfa] px-2 py-0.5 rounded-full border border-[#7c3aed]/30">ㅇㄹㅁ_, ㄱㄹ 초성 OK!</span></h3>
              <button onClick={() => setIsEditModalOpen(false)} className="w-7 h-7 bg-[#1e1e2a] rounded-full grid place-items-center text-white"><X size={14}/></button>
            </div>

            <div className="mb-4 p-3 bg-[#0a0a12] border border-[#1e1e2a] rounded-[14px] flex items-center justify-between">
              <div className="flex gap-2">
                <button type="button" onClick={handleLoadPreviousSetRoster} className="h-[32px] px-3.5 bg-[#8b5cf6]/15 border border-[#8b5cf6]/40 text-[#c4b5fd] rounded-full text-[11px] font-bold flex items-center gap-1.5"><Copy size={13}/>이전 세트 불러오기</button>
                <button type="button" onClick={handleSwapTeams} className="h-[32px] px-3.5 bg-[#1e1e2a] border border-[#2a2a3a] text-[#c0c0d0] rounded-full text-[11px] font-bold flex items-center gap-1.5"><ArrowLeftRight size={13}/>Red ↔ Blue 스왑</button>
              </div>
              <span className="text-[10px] text-[#5a5a70]">ㅇㄹㅁ_ → 우리밍_ • ㄱㄹ → 가렌 • ㅅㅇㄴ → 상이너</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div><label className="text-[11px] text-[#8a8aa0] mb-1 block">일자</label><input type="date" value={formData.date} onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))} className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white" /></div>
              <div><label className="text-[11px] text-[#8a8aa0] mb-1 block">CK 명칭</label><input value={formData.ck_name} onChange={(e) => setFormData((prev) => ({ ...prev, ck_name: e.target.value }))} placeholder="치지직 CK" className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white" /></div>
              <div><label className="text-[11px] text-[#8a8aa0] mb-1 block">방식</label><select value={formData.match_format} onChange={(e) => setFormData((prev) => ({ ...prev, match_format: e.target.value as MatchFormat }))} className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-white"><option value="단판">단판</option><option value="3판2선승">3판2선승</option><option value="5판3선승">5판3선승</option></select></div>
              <div><label className="text-[11px] text-[#8a8aa0] mb-1 block">세트</label><select value={formData.set_number} onChange={(e) => setFormData((prev) => ({ ...prev, set_number: parseInt(e.target.value, 10) }))} className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-white"><option value={1}>1세트</option><option value={2}>2세트</option><option value={3}>3세트</option><option value={4}>4세트</option><option value={5}>5세트</option></select></div>
            </div>

            {(['team_a', 'team_b'] as const).map((teamKey) => {
              const isRed = teamKey === 'team_a';
              const champsKey = `${teamKey}_champs` as const;
              const kdaKey = `${teamKey}_kda` as const;
              const banKey = isRed ? 'ban_a' : 'ban_b';
              return (
                <div key={teamKey} className="mb-4 bg-[#08080c] border rounded-[14px] p-4" style={{ borderColor: isRed ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)' }}>
                  <div className="text-[12px] font-bold mb-3" style={{ color: isRed ? '#ef4444' : '#3b82f6' }}>{isRed ? '🔴 Red팀' : '🔵 Blue팀'} • 초성 검색</div>
                  <div className="space-y-2.5">
                    {LINE_KEYS.map((lineKey) => {
                      const playerName = formData[teamKey][lineKey] || '';
                      const champName = formData[champsKey][lineKey] || '';
                      return (
                        <div key={lineKey} className="flex flex-wrap gap-2 items-center">
                          <span className="w-[36px] text-[11px] font-bold text-[#8a8aa0]">{LINE_LABELS[lineKey]}</span>
                          <div className="w-[170px]"><StreamerAutocomplete value={playerName} allStreamers={allStreamers} onSelect={(name) => { setFormData(prev=> ({...prev, [teamKey]: {...prev[teamKey], [lineKey]: name}})); setFormError(''); }} onChange={(name) => { setFormData(prev=> ({...prev, [teamKey]: {...prev[teamKey], [lineKey]: name}})); }} placeholder="ㅇㄹㅁ_, ㅅㅇㄴ" limit={6} /></div>
                          <div className="w-[170px]"><ChampionAutocomplete value={champName} onSelect={(champ) => { setFormData(prev=> ({...prev, [champsKey]: {...prev[champsKey], [lineKey]: champ.kr}})); }} onChange={(val) => { setFormData(prev=> ({...prev, [champsKey]: {...prev[champsKey], [lineKey]: val}})); }} placeholder="ㄱㄹ, ㅇㅇ" limit={6} /></div>
                          <input value={formData[kdaKey][lineKey]} onChange={(e) => setFormData((prev) => ({ ...prev, [kdaKey]: { ...prev[kdaKey], [lineKey]: e.target.value }}))} placeholder="K/D/A" className="h-[36px] w-[85px] bg-[#12121a] border border-[#1e1e2a] rounded-full px-3 text-[11px] text-white" />
                          <button type="button" onClick={() => handleSetWooriming(teamKey, lineKey)} className={`h-[28px] px-2.5 border rounded-full text-[10px] font-bold ${playerName==='우리밍_'?'bg-[#8b5cf6] text-white border-[#8b5cf6]':'bg-[#8b5cf6]/20 border-[#8b5cf6]/40 text-[#a78bfa]'}`}>밍</button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-[#1e1e2a] pt-3">
                    <span className="text-[11px] text-[#6a6a80] mr-2">밴:</span>
                    {formData[banKey].map((banItem, bIdx) => (
                      <div key={bIdx} className="w-[110px]"><ChampionAutocomplete value={banItem} onSelect={(champ) => { const updated = [...formData[banKey]]; updated[bIdx]=champ.kr; setFormData(prev=> ({...prev, [banKey]: updated})); }} onChange={(val) => { const updated = [...formData[banKey]]; updated[bIdx]=val; setFormData(prev=> ({...prev, [banKey]: updated})); }} placeholder={`밴 ${bIdx+1}`} limit={5} /></div>
                    ))}
                  </div>
                </div>
              );
            })}

            {formError && <div className="p-3 bg-[#ef4444]/15 border border-[#ef4444]/40 rounded-[12px] text-[#ef4444] text-[12px] flex items-center gap-2"><AlertCircle size={16}/>{formError}</div>}

            <div className="mt-4 flex gap-3">
              {!isAdmin && <input type="password" value={formPasscode} onChange={(e)=>{setFormPasscode(e.target.value); setFormError('');}} placeholder="패스코드" className="h-[36px] flex-1 bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white" />}
              <button type="button" onClick={handleSaveMatch} className="h-[36px] px-5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-bold">저장</button>
              <button type="button" onClick={handleSaveAndNextSet} className="h-[36px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white rounded-full text-[12px]">저장+다음세트</button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-[360px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 shadow-2xl">
            <h4 className="font-bold text-[14px] text-white flex items-center gap-1.5 mb-3"><ShieldAlert size={16} className="text-[#ef4444]"/>경기 삭제 확인</h4>
            {!isAdmin && <input type="password" value={deletePasscode} onChange={(e)=>{setDeletePasscode(e.target.value); setDeleteError('');}} placeholder="패스코드" className="w-full h-[38px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white mb-2" />}
            {deleteError && <div className="text-[11px] text-[#ff6b6b] mb-3">{deleteError}</div>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setDeleteTargetId(null)} className="flex-1 h-[36px] bg-[#1e1e2a] text-[#c0c0d0] rounded-full text-[12px]">취소</button>
              <button onClick={handleConfirmDelete} className="flex-1 h-[36px] bg-[#ef4444] text-white rounded-full text-[12px] font-bold">삭제하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
