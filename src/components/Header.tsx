import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BgmTrack } from '../lib/bgm';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  matches?: any[];
  allStreamers?: string[];
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  pairMap?: any;
  onToast?: (msg: string) => void;
  isBgmPlaying: boolean;
  onToggleBgm: () => void;
  onNextBgm: () => void;
  currentTrack: BgmTrack;
  isMuted: boolean;
  onToggleMute: () => void;
  bgmVolume: number;
  onChangeVolume: (v: number) => void;
}

const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function getChosung(str: string): string {
  let r = '';
  for (const c of str) {
    const code = c.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) r += CHOSUNG[Math.floor((code - 0xAC00) / (21*28))];
    else r += c.toLowerCase();
  }
  return r;
}

// CK일지 데이터 구조에 맞게 팀 판별 - team_a / team_b 가 {top,jgl,mid,adc,sup}
function getPlayerTeam(m: any, player: string): 'A'|'B'|null {
  const check = (team: any) => {
    if (!team) return false;
    const vals = typeof team === 'object' ? Object.values(team) : Array.isArray(team) ? team : [];
    return vals.some((v: any) => {
      const name = typeof v === 'string' ? v.trim() : v?.name || v?.player || '';
      return name === player || (typeof name === 'string' && name.includes(player));
    });
  };
  if (check(m.team_a)) return 'A';
  if (check(m.team_b)) return 'B';
  // fallback: team_a_players / blueTeam 등
  if (check(m.team_a_players) || check(m.blueTeam)) return 'A';
  if (check(m.team_b_players) || check(m.redTeam)) return 'B';
  return null;
}

function getWinningTeam(m: any): 'A'|'B'|null {
  // 가장 흔한 필드들 순서대로 체크 - CK일지에서 쓰는 필드
  const v = m.winner_team || m.winning_team || m.winner || m.win_team || m.victor || m.victory_team || m.result_team;
  if (v === 'A' || v === 'a' || v === 'BLUE' || v === 'blue' || v === 'Blue' || v === 0 || v === 'team_a' || v === 'teamA') return 'A';
  if (v === 'B' || v === 'b' || v === 'RED' || v === 'red' || v === 'Red' || v === 1 || v === 'team_b' || v === 'teamB') return 'B';
  
  if (m.team_a_win === true || m.blue_win === true || m.blueWin === true || m.a_win === true) return 'A';
  if (m.team_b_win === true || m.red_win === true || m.redWin === true || m.b_win === true) return 'B';
  
  // result 문자열에 블루/레드 승리 포함된 경우
  if (typeof m.result === 'string') {
    if (m.result.includes('블루') || m.result.includes('BLUE') || m.result.includes('A승')) return 'A';
    if (m.result.includes('레드') || m.result.includes('RED') || m.result.includes('B승')) return 'B';
  }
  
  // win 필드가 boolean인 경우 team_a 기준
  if (typeof m.win === 'boolean') return m.win ? 'A' : 'B';
  if (m.win === 'A' || m.win === 'BLUE') return 'A';
  if (m.win === 'B' || m.win === 'RED') return 'B';

  return null;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab, onTabChange, matches = [], allStreamers = [], isAdmin, onLoginClick, onLogoutClick, onToast,
  isBgmPlaying, onToggleBgm, onNextBgm, currentTrack, isMuted, onToggleMute, bgmVolume, onChangeVolume,
}) => {
  const tabs = [
    { id: 'main', label: '메인' },
    { id: 'synergy', label: '시너지' },
    { id: 'journal', label: 'CK 일지' },
    { id: 'rolland', label: '롤랜드' },
  ];
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string|null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mainPlayer = useMemo(() => allStreamers.includes('우리밍_') ? '우리밍_' : allStreamers[0] || '', [allStreamers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qCho = getChosung(q);
    const isCho = [...q].every(c => CHOSUNG.includes(c));
    return allStreamers.filter(n => {
      if (n === mainPlayer) return false;
      const low = n.toLowerCase();
      const cho = getChosung(n);
      return low.includes(q) || (isCho && cho.includes(q)) || cho.includes(qCho);
    }).slice(0,6);
  }, [query, allStreamers, mainPlayer]);

  // CK일지와 동기화된 전적 계산
  const stats = useMemo(() => {
    if (!selected || !mainPlayer) return null;
    let sameTotal=0, sameWin=0, diffTotal=0, diffWin=0;

    for (const m of matches) {
      const teamS = getPlayerTeam(m, selected);
      const teamM = getPlayerTeam(m, mainPlayer);
      if (!teamS || !teamM) continue; // CK일지에 없는 경기는 스킵
      const winner = getWinningTeam(m);
      if (!winner) continue; // 승리팀 모르면 카운트 안함 - 0% 방지 위해 스킵

      if (teamS === teamM) {
        sameTotal++;
        if (winner === teamS) sameWin++;
      } else {
        diffTotal++;
        if (winner === teamM) diffWin++;
      }
    }

    // 같은팀/상대팀 데이터가 아예 없으면 전체 경기에서 해당 스트리머가 포함된 걸로라도 표시
    const hasData = sameTotal > 0 || diffTotal > 0;
    return {
      same: { total: sameTotal, wins: sameWin, rate: sameTotal ? Math.round(sameWin/sameTotal*100) : 0 },
      diff: { total: diffTotal, wins: diffWin, rate: diffTotal ? Math.round(diffWin/diffTotal*100) : 0 },
      hasData,
    };
  }, [selected, mainPlayer, matches]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#08080c]/95 backdrop-blur-xl border-b border-[#1e1e2a]">
      <div className="max-w-[1100px] mx-auto px-3 md:px-6 h-[56px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="font-black text-[18px] tracking-[0.15em] text-[#c0c0d0] shrink-0">RIMING.GG</div>
          <nav className="flex items-center gap-1 bg-[#12121a] border border-[#1e1e2a] rounded-full p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={()=>{setSelected(null); onTabChange(t.id);}} className={`h-[28px] px-3.5 rounded-full text-[12px] font-bold whitespace-nowrap ${currentTab===t.id?'bg-[#7c3aed] text-white':'text-[#8a8aa0] hover:text-white hover:bg-[#1e1e2a]'}`}>{t.label}</button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div ref={ref} className="relative">
            <div className="relative">
              <input value={query} onChange={e=>{setQuery(e.target.value); setSelected(null); setOpen(true);}} onFocus={()=>setOpen(true)} placeholder="검색"
                className="w-[140px] h-[32px] bg-[#12121a] border border-[#2a2a4a] rounded-full pl-8 pr-6 text-[12px] text-white placeholder:text-[#5a5a70] focus:outline-none focus:border-[#7c3aed]" />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px]">🔍</span>
            </div>

            {open && filtered.length>0 && !selected && (
              <div className="absolute mt-2 w-[180px] bg-[#12121a] border border-[#2a2a4a] rounded-xl shadow-xl overflow-hidden z-50">
                {filtered.map(name=>(
                  <button key={name} onClick={()=>{setQuery(name); setSelected(name); setOpen(false);}} className="w-full text-left px-3 py-2.5 text-[13px] text-white hover:bg-[#1e1e2a] font-bold">{name}</button>
                ))}
              </div>
            )}

            {selected && stats && (
              <div className="absolute mt-2 w-[260px] z-50">
                <div className="text-[14px] font-bold text-white mb-2 px-1 flex justify-between"><span>{selected}</span><button onClick={()=>setSelected(null)} className="text-[#5a5a70]">✕</button></div>
                {!stats.hasData ? (
                  <div className="bg-[#1a1a22] border border-[#2a2a3a] rounded-xl p-3 text-[11px] text-[#8a8aa0] text-center">CK일지에 {selected} 데이터 없음<br/>matches 구조 확인 필요</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#1a1a22] border border-[#2a2a3a] rounded-xl p-3">
                      <div className="text-[11px] text-[#8a8aa0] mb-1">같은 팀</div>
                      <div className="text-[12px] text-[#c0c0d0]">{stats.same.total}판 {stats.same.wins}승</div>
                      <div className="text-[16px] font-black mt-1" style={{color: stats.same.rate>=50?'#a78bfa':'#f87171'}}>{stats.same.rate}%</div>
                    </div>
                    <div className="bg-[#1a1a22] border border-[#2a2a3a] rounded-xl p-3">
                      <div className="text-[11px] text-[#8a8aa0] mb-1">상대 팀</div>
                      <div className="text-[12px] text-[#c0c0d0]">{stats.diff.total ? `${stats.diff.total}판 ${mainPlayer} ${stats.diff.wins}승` : '전적 없음'}</div>
                      <div className="text-[16px] font-black mt-1" style={{color: stats.diff.rate>=50?'#a78bfa':'#c0c0d0'}}>{stats.diff.total ? `${stats.diff.rate}%` : '-'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#12121a] border border-[#2a2a4a] rounded-full px-2.5 py-1 h-[34px]">
            <span className="text-[11px] font-bold text-[#8a8aa0]">BGM</span>
            <button onClick={onToggleBgm} className="w-6 h-6 flex items-center justify-center">{isBgmPlaying ? '⏸' : '▶'}</button>
            <button onClick={onNextBgm} className="w-6 h-6 flex items-center justify-center">⏭</button>
          </div>
        </div>
      </div>
    </header>
  );
};
