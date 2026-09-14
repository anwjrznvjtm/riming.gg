/**
 * src/components/JournalTab.tsx
 * FINAL FIXED - 상단 검색 + 플레이어 + 챔피언 전부 초성 검색 됨!
 * ㄱㄹ → 가렌, ㅇㄹㅁ_ → 우리밍_, ㅅㅇㄴ → 상이너
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Match, LineKey, LINE_KEYS, LINE_LABELS, MatchFormat, WinningTeam } from '../types';
import { ComputedStats, OpponentStat, isMatchWonByWooriming, formatPlayerWithChamp, isKdaEmpty, getWoorimingTeam, getWoorimingLine } from '../lib/stats';
import { ChampionIcon } from './ChampionIcon';
import { normalizeChampionName } from '../lib/champions';
import { PASSCODE } from '../data/initialMatches';
import { getChosung, isChosungQuery, searchChampions, searchStreamers, Streamer } from '../lib/fuzzySearch';
import { StreamerAutocomplete } from './StreamerAutocomplete';
import { ChampionAutocomplete } from './ChampionAutocomplete';
import { Plus, Search, Filter, ShieldAlert, X, Edit2, Trash2, Save, AlertCircle, CheckCircle2, Sparkles, Trophy, ArrowLeftRight, Copy } from 'lucide-react';

interface JournalTabProps {
  stats: ComputedStats;
  matches: Match[];
  onAddMatch: (match: Match) => void;
  onUpdateMatch: (match: Match) => void;
  onDeleteMatch: (id: string) => void;
  onImportMatches?: (matches: Match[]) => void;
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
  const [isChampsModalOpen, setIsChampsModalOpen] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentStat | null>(null);
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

  // ✅ FINAL FIX: 상단 검색창 - 초성 검색 지원!
  const filteredMatches = useMemo(() => {
    return matches
      .filter((m) => {
        if (filterDate && !m.date.includes(filterDate)) return false;
        
        // ✅ 초성 검색 지원! ㅇㄹㅁ_ → 우리밍_, ㄱㄹ → 가렌, ㅅㅇㄴ → 상이너
        if (filterName) {
          const q = filterName.trim().toLowerCase();
          const qChosung = getChosung(q);
          const isChosungOnly = isChosungQuery(q);
          
          const ckName = (m.ck_name || '').toLowerCase();
          const ckChosung = getChosung(m.ck_name || '');
          
          // 모든 플레이어 이름 모으기
          const allPlayersInMatch: string[] = [];
          for (const k of LINE_KEYS) {
            if (m.team_a[k]) allPlayersInMatch.push(m.team_a[k]);
            if (m.team_b[k]) allPlayersInMatch.push(m.team_b[k]);
          }
          
          let matched = false;
          if (isChosungOnly) {
            // 초성으로 검색: CK명 초성 또는 플레이어 초성
            if (ckChosung.includes(q)) matched = true;
            for (const p of allPlayersInMatch) {
              if (getChosung(p).includes(q)) { matched = true; break; }
            }
          } else {
            // 일반 검색: CK명 포함 또는 플레이어 포함 또는 초성 포함
            if (ckName.includes(q)) matched = true;
            if (!matched && ckChosung.includes(qChosung) && qChosung.length >= 2) matched = true;
            for (const p of allPlayersInMatch) {
              if (p.toLowerCase().includes(q) || getChosung(p).includes(qChosung)) { matched = true; break; }
            }
          }
          if (!matched) return false;
        }
        
        if (filterLine !== 'ALL') {
          const line = getWoorimingLine(m);
          if (line !== filterLine) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        const ckDiff = (b.ck_name || '').localeCompare(a.ck_name || '');
        if (ckDiff !== 0) return ckDiff;
        return (Number(b.set_number) || 1) - (Number(a.set_number) || 1);
      });
  }, [matches, filterDate, filterName, filterLine]);

  const woorimingLocation = useMemo(() => {
    for (const teamKey of ['team_a', 'team_b'] as const) {
      for (const l of LINE_KEYS) {
        if (formData[teamKey][l]?.trim() === '우리밍_') return { team: teamKey, line: l };
      }
    }
    return null;
  }, [formData.team_a, formData.team_b]);

  const handleSetWooriming = (targetTeam: 'team_a' | 'team_b', targetLine: LineKey) => {
    setFormData((prev) => {
      const nextA = { ...prev.team_a }; const nextB = { ...prev.team_b };
      for (const l of LINE_KEYS) {
        if (nextA[l]?.trim() === '우리밍_') nextA[l] = '';
        if (nextB[l]?.trim() === '우리밍_') nextB[l] = '';
      }
      if (targetTeam === 'team_a') nextA[targetLine] = '우리밍_'; else nextB[targetLine] = '우리밍_';
      return { ...prev, team_a: nextA, team_b: nextB };
    });
    setFormError('');
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
      if (!cleanPass) return { isValid: false, errorMsg: '관리자 패스코드를 입력해주세요.' };
      if (cleanPass !== PASSCODE.toLowerCase()) return { isValid: false, errorMsg: '패스코드가 올바르지 않습니다.' };
    }
    const allPlayers: string[] = [...(Object.values(matchData.team_a) as string[]), ...(Object.values(matchData.team_b) as string[])];
    const wCount = allPlayers.filter((p) => p && p.trim() === '우리밍_').length;
    if (wCount === 0) return { isValid: false, errorMsg: "양 팀 중 정확히 1개 라인에 '우리밍_'을 지정해야 합니다." };
    if (wCount > 1) return { isValid: false, errorMsg: `우리밍_이 ${wCount}곳에 중복으로 입력되어 있습니다.` };
    if (duplicatePlayers.size > 0 || duplicateChamps.size > 0) {
      return { isValid: false, errorMsg: `중복 선수/챔피언: ${Array.from(duplicatePlayers).join(',')} / ${Array.from(duplicateChamps).join(',')}` };
    }
    return { isValid: true, errorMsg: '' };
  };

  const handleSaveMatch = () => {
    const val = validateMatchForm(formData);
    if (!val.isValid) { setFormError(val.errorMsg); onToast(val.errorMsg); return; }
    if (!isAdmin && persistAdminInForm) onAdminLoginSuccess();
    const cleanCkName = formData.ck_name.trim() || `${formData.date} CK 경기 (${formData.winning_team}팀 승)`;
    const matchToSave: Match = { ...formData, ck_name: cleanCkName };
    try {
      if (editingMatch) { onUpdateMatch(matchToSave); onToast('경기 수정 완료!'); }
      else { onAddMatch(matchToSave); onToast('새 경기 등록 완료!'); }
      setIsEditModalOpen(false); setFormError('');
    } catch { setFormError('저장 오류'); onToast('저장 실패'); }
  };

  const handleSaveAndNextSet = () => {
    const val = validateMatchForm(formData);
    if (!val.isValid) { setFormError(val.errorMsg); onToast(val.errorMsg); return; }
    if (!isAdmin && persistAdminInForm) onAdminLoginSuccess();
    const cleanCkName = formData.ck_name.trim() || `${formData.date} CK 경기`;
    const matchToSave: Match = { ...formData, ck_name: cleanCkName };
    try {
      if (editingMatch) onUpdateMatch(matchToSave); else onAddMatch(matchToSave);
      const nextWinners = [...seriesWinners, formData.winning_team as 'Red' | 'Blue'];
      setSeriesWinners(nextWinners);
      const nextSetNum = (Number(formData.set_number) || 1) + 1;
      const redWins = nextWinners.filter((w) => w === 'Red').length + 1;
      setFormData((curr) => ({
        ...curr, id: `m_${Date.now()}`, set_number: nextSetNum, score: `${redWins}:${nextWinners.filter(w=>w==='Blue').length}`,
        winning_team: 'Red', team_a_kda: { ...emptyRoster }, team_b_kda: { ...emptyRoster },
      }));
      setEditingMatch(null); setFormError('');
      onToast(`${formData.set_number}세트 저장 완료! ${nextSetNum}세트 작성 중 ⚡`);
    } catch { setFormError('저장 오류'); }
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
    });
    setIsEditModalOpen(true); setFormError(''); setSeriesWinners([]);
  };

  const handleOpenEditModal = (m: Match) => {
    setEditingMatch(m); setFormData({ ...m }); setIsEditModalOpen(true); setFormError('');
  };

  const handleLoadPreviousSetRoster = () => {
    const prevMatches = matches.filter(mm => mm.date === formData.date && (mm.ck_name || '').trim() === formData.ck_name.trim()).sort((a,b)=> (Number(b.set_number)||1)-(Number(a.set_number)||1));
    if (prevMatches.length===0) { onToast('같은 날짜/CK명의 이전 세트가 없습니다.'); return; }
    const prev = prevMatches[0];
    setFormData(curr=> ({ ...curr, team_a: { ...prev.team_a }, team_b: { ...prev.team_b }, team_a_champs: { ...prev.team_a_champs }, team_b_champs: { ...prev.team_b_champs } }));
    onToast(`${prev.set_number}세트 로스터 불러오기 완료!`);
  };

  const handleSwapTeams = () => {
    setFormData(prev=> {
      const nextA={...prev.team_b}; const nextB={...prev.team_a};
      const nextAChamps={...prev.team_b_champs}; const nextBChamps={...prev.team_a_champs};
      const nextAKda={...prev.team_b_kda}; const nextBKda={...prev.team_a_kda};
      const nextBanA=[...prev.ban_b]; const nextBanB=[...prev.ban_a];
      const nextWinner = prev.winning_team==='Red'?'Blue':'Red'; let red=0, blue=0;
      if (prev.winning_team==='Red') red++; else blue++;
      return { ...prev, team_a: nextA, team_b: nextB, team_a_champs: nextAChamps, team_b_champs: nextBChamps, team_a_kda: nextAKda, team_b_kda: nextBKda, ban_a: nextBanA, ban_b: nextBanB, winning_team: nextWinner, score: `${red}:${blue}` };
    });
    onToast('Red ↔ Blue 스왑 완료!');
  };

  const handleDeleteClick = (id: string) => { setDeleteTargetId(id); setDeletePasscode(''); setDeleteError(''); };
  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;
    if (!isAdmin) {
      if (deletePasscode.trim().toLowerCase() !== PASSCODE.toLowerCase()) { setDeleteError('패스코드 틀림'); return; }
      onAdminLoginSuccess();
    }
    onDeleteMatch(deleteTargetId); onToast('삭제 완료'); setDeleteTargetId(null);
  };

  // 챔피언/스트리머 검색 결과를 위한 로컬 상태는 각 Autocomplete 내부에서 처리

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s]">
      {/* 상단 필터 - ✅ 초성 검색 지원! */}
      <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[16px] p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <div className="relative">
            <input value={filterDate} onChange={(e) => setFilterDate(e.target.value)} placeholder="날짜 (2026-09)" className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] w-[160px] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50 text-white" />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px]">🔍</span>
            <input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="CK명, 선수 초성 (ㅇㄹㅁ_, ㅅㅇㄴ)" className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full pl-8 pr-4 text-[12px] w-[240px] placeholder:text-[#5a5a6a] focus:outline-none focus:border-[#8b5cf6]/50 text-white" />
            {filterName && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-[#7c3aed] font-mono">{getChosung(filterName)}</span>}
          </div>
          <select value={filterLine} onChange={(e) => setFilterLine(e.target.value)} className="h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-[#c0c0d0] focus:outline-none focus:border-[#8b5cf6]/50">
            <option value="ALL">전체 라인</option><option value="TOP">TOP</option><option value="JGL">JGL</option><option value="MID">MID</option><option value="ADC">ADC</option><option value="SUP">SUP</option>
          </select>
          {filterName && <span className="text-[10px] text-[#5a5a70] self-center ml-2">{filteredMatches.length}개 찾음 • 초성 OK</span>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleOpenAddModal} className="h-[36px] px-4 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-semibold flex items-center gap-1.5">
            <Plus size={14} /><span>경기 추가</span>
          </button>
        </div>
      </div>

      {/* 매치 리스트 */}
      <div className="space-y-3.5">
        {filteredMatches.length === 0 ? (
          <div className="p-12 text-center text-[#62627a] bg-[#12121a]/80 border border-[#1e1e2a] rounded-[20px]">
            <div className="text-[13px]">일치하는 경기 없음</div>
            {filterName && <div className="text-[11px] mt-2 text-[#5a5a70]">"{filterName}" → {getChosung(filterName)} 초성 검색 중 • ㅇㄹㅁ_ → 우리밍_, ㅅㅇㄴ → 상이너</div>}
          </div>
        ) : filteredMatches.map((m) => {
          const wTeam = getAllyTeamDirect(m);
          const wRoster = wTeam === 'Red' ? m.team_a : m.team_b;
          const wChamps = wTeam === 'Red' ? m.team_a_champs : m.team_b_champs;
          const wKdas = wTeam === 'Red' ? m.team_a_kda : m.team_b_kda;
          let wKey: LineKey = 'adc'; for (const k of LINE_KEYS) { if (wRoster[k] === '우리밍_') { wKey = k; break; } }
          const champ = wChamps[wKey]; const kdaRaw = wKdas[wKey]; const won = m.winning_team === wTeam;
          const allyEnemyScoreText = correctedScoreMap.get(m.id) || '1:0';
          return (
            <div key={m.id} className={`relative rounded-xl border ${won?'border-[#3b82f6]/40':'border-[#ef4444]/40'} ${won?'bg-gradient-to-r from-[#0e213b]/95 to-[#0b1321]/95':'bg-gradient-to-r from-[#2c1218]/95 to-[#140b10]/95'} p-3.5 pl-5`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${won?'bg-[#3b82f6]':'bg-[#ef4444]'}`} />
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-[#8a8aa0] mb-1">
                    <span className="font-bold text-[#c0c0d0]">{m.date}</span><span>•</span><span className="text-white truncate">{m.ck_name}</span><span className="text-[#a78bfa]">{m.set_number}세트</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${won?'bg-[#3b82f6]/20 text-[#60a5fa]':'bg-[#ef4444]/20 text-[#f87171]'}`}>{won?'승리':'패배'} {allyEnemyScoreText}</span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {(LINE_KEYS as LineKey[]).map(k=> (
                      <span key={k} className="text-[11px] text-[#9aa0b8]">{k.toUpperCase()}: <b className="text-white">{m.team_a[k]||'-'}</b>({m.team_a_champs[k]||'?'}) vs <b className="text-white">{m.team_b[k]||'-'}</b>({m.team_b_champs[k]||'?'})</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={()=>handleOpenEditModal(m)} className="w-7 h-7 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full grid place-items-center text-[#8a8aa0]"><Edit2 size={12}/></button>
                  <button onClick={()=>handleDeleteClick(m.id)} className="w-7 h-7 bg-[#1e1e2a] hover:bg-[#ef4444]/20 rounded-full grid place-items-center text-[#8a8aa0] hover:text-[#f87171]"><Trash2 size={12}/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 경기 추가/수정 모달 - ✅ 플레이어 + 챔피언 초성 검색 적용! */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-[900px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 my-8 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[16px] text-white flex items-center gap-2"><Trophy size={16} className="text-[#fbbf24}"/>{editingMatch ? '경기 수정' : '경기 등록'} <span className="text-[10px] bg-[#7c3aed]/20 text-[#a78bfa] px-2 py-0.5 rounded-full border border-[#7c3aed]/30">초성 검색 지원!</span></h3>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="w-[28px] h-[28px] bg-[#1e1e2a] rounded-full grid place-items-center text-white"><X size={14}/></button>
            </div>

            <div className="mb-4 p-3 bg-[#0a0a12] border border-[#1e1e2a] rounded-[14px] flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button type="button" onClick={handleLoadPreviousSetRoster} className="h-[32px] px-3.5 bg-[#8b5cf6]/15 border border-[#8b5cf6]/40 text-[#c4b5fd] rounded-full text-[11px] font-bold flex items-center gap-1.5"><Copy size={13}/>이전 세트 불러오기</button>
                <button type="button" onClick={handleSwapTeams} className="h-[32px] px-3.5 bg-[#1e1e2a] border border-[#2a2a3a] text-[#c0c0d0] rounded-full text-[11px] font-bold flex items-center gap-1.5"><ArrowLeftRight size={13}/>Red ↔ Blue 스왑</button>
              </div>
              <span className="text-[10px] text-[#5a5a70]">ㅇㄹㅁ_ → 우리밍_ • ㄱㄹ → 가렌</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div><label className="text-[11px] text-[#8a8aa0] mb-1 block">일자</label><input type="date" value={formData.date} onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))} className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white" /></div>
              <div><label className="text-[11px] text-[#8a8aa0] mb-1 block">CK 명칭</label><input value={formData.ck_name} onChange={(e) => setFormData((prev) => ({ ...prev, ck_name: e.target.value }))} placeholder="치지직 CK" className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white placeholder:text-[#5a5a6a]" /></div>
              <div><label className="text-[11px] text-[#8a8aa0] mb-1 block">방식</label><select value={formData.match_format} onChange={(e) => setFormData((prev) => ({ ...prev, match_format: e.target.value as MatchFormat, set_number: e.target.value==='단판'?1:prev.set_number }))} className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-white"><option value="단판">단판</option><option value="3판2선승">3판2선승</option><option value="5판3선승">5판3선승</option></select></div>
              <div><label className="text-[11px] text-[#8a8aa0] mb-1 block">세트</label><select value={formData.set_number} onChange={(e) => setFormData((prev) => ({ ...prev, set_number: parseInt(e.target.value, 10) }))} disabled={formData.match_format === '단판'} className="w-full h-[36px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-3 text-[12px] text-white"><option value={1}>1세트</option><option value={2}>2세트</option><option value={3}>3세트</option><option value={4}>4세트</option><option value={5}>5세트</option></select></div>
            </div>

            {(['team_a', 'team_b'] as const).map((teamKey) => {
              const isRed = teamKey === 'team_a';
              const champsKey = `${teamKey}_champs` as const;
              const kdaKey = `${teamKey}_kda` as const;
              const banKey = isRed ? 'ban_a' : 'ban_b';
              return (
                <div key={teamKey} className="mb-4 bg-[#08080c] border rounded-[14px] p-4" style={{ borderColor: isRed ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)' }}>
                  <div className="text-[12px] font-bold mb-3 flex justify-between" style={{ color: isRed ? '#ef4444' : '#3b82f6' }}>
                    <span>{isRed ? '🔴 Red팀' : '🔵 Blue팀'} • 초성 검색 가능!</span>
                    <span className="text-[10px] text-[#8a8aa0] font-normal">ㅇㄹㅁ_, ㅅㅇㄴ, ㄱㄹ 검색</span>
                  </div>
                  <div className="space-y-2.5">
                    {LINE_KEYS.map((lineKey) => {
                      const playerName = formData[teamKey][lineKey] || '';
                      const champName = formData[champsKey][lineKey] || '';
                      return (
                        <div key={lineKey} className="flex flex-wrap gap-2 items-center">
                          <span className="w-[36px] text-[11px] font-bold text-[#8a8aa0]">{LINE_LABELS[lineKey]}</span>
                          
                          {/* ✅ 플레이어 초성 검색 */}
                          <div className="w-[170px]">
                            <StreamerAutocomplete
                              value={playerName}
                              allStreamers={allStreamers}
                              onSelect={(name) => { setFormData(prev=> ({...prev, [teamKey]: {...prev[teamKey], [lineKey]: name}})); setFormError(''); }}
                              onChange={(name) => { setFormData(prev=> ({...prev, [teamKey]: {...prev[teamKey], [lineKey]: name}})); setFormError(''); }}
                              placeholder="ㅇㄹㅁ_, ㅅㅇㄴ"
                              limit={6}
                            />
                          </div>

                          {/* ✅ 챔피언 초성 검색 */}
                          <div className="w-[170px]">
                            <ChampionAutocomplete
                              value={champName}
                              onSelect={(champ) => { setFormData(prev=> ({...prev, [champsKey]: {...prev[champsKey], [lineKey]: champ.kr}})); }}
                              onChange={(val) => { setFormData(prev=> ({...prev, [champsKey]: {...prev[champsKey], [lineKey]: val}})); }}
                              placeholder="ㄱㄹ, ㅇㅇ, ahri"
                              limit={6}
                            />
                          </div>

                          <input value={formData[kdaKey][lineKey]} onChange={(e) => setFormData((prev) => ({ ...prev, [kdaKey]: { ...prev[kdaKey], [lineKey]: e.target.value }}))} placeholder="K/D/A" className="h-[36px] w-[85px] bg-[#12121a] border border-[#1e1e2a] rounded-full px-3 text-[11px] text-white" />
                          <button type="button" onClick={() => handleSetWooriming(teamKey, lineKey)} className={`h-[28px] px-2.5 border rounded-full text-[10px] font-bold ${playerName==='우리밍_'?'bg-[#8b5cf6] text-white border-[#8b5cf6]':'bg-[#8b5cf6]/20 border-[#8b5cf6]/40 text-[#a78bfa]'}`}>밍</button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-[#1e1e2a] pt-3">
                    <span className="text-[11px] text-[#6a6a80] mr-2">밴 5개:</span>
                    {formData[banKey].map((banItem, bIdx) => (
                      <div key={bIdx} className="w-[110px]">
                        <ChampionAutocomplete
                          value={banItem}
                          onSelect={(champ) => {
                            const updated = [...formData[banKey]]; updated[bIdx]=champ.kr;
                            setFormData(prev=> ({...prev, [banKey]: updated}));
                          }}
                          onChange={(val) => {
                            const updated = [...formData[banKey]]; updated[bIdx]=val;
                            setFormData(prev=> ({...prev, [banKey]: updated}));
                          }}
                          placeholder={`밴 ${bIdx+1} ㄱㄹ`}
                          limit={5}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {formError && <div className="p-3 bg-[#ef4444]/15 border border-[#ef4444]/40 rounded-[12px] text-[#ef4444] text-[12px] flex items-center gap-2"><AlertCircle size={16}/>{formError}</div>}

            <div className="mt-4 flex gap-3">
              {!isAdmin && <input type="password" value={formPasscode} onChange={(e)=>{setFormPasscode(e.target.value); setFormError('');}} onKeyDown={(e)=>{if(e.key==='Enter') handleSaveMatch();}} placeholder="패스코드" className="h-[36px] flex-1 bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[12px] text-white" />}
              <button type="button" onClick={handleSaveMatch} className="h-[36px] px-5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-bold">저장</button>
              <button type="button" onClick={handleSaveAndNextSet} className="h-[36px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white rounded-full text-[12px]">저장+다음세트</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
