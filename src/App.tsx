import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Match } from './types';
import {
  PASSCODE,
  ADMIN_SESSION_KEY,
  CHAMPIONS_LIST,
  getInitialMatches,
} from './data/initialMatches';
import { calculateStats } from './lib/stats';
import { normalizeChampionName } from './lib/champions';
import { normalizeMatch } from './lib/matchSchema';
import {
  fetchAllMatchesFromApi,
  createMatchOnApi,
  updateMatchOnApi,
  deleteMatchOnApi,
} from './lib/matchApi';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MainTab } from './components/MainTab';
import { SynergyTab } from './components/SynergyTab';
import { JournalTab } from './components/JournalTab';
import { RollandTab } from './components/RollandTab';
import { SummaryModal } from './components/SummaryModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { BGM_PLAYLIST, BgmTrack, createBgmQueue } from './lib/bgm';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function App() {
  // 로컬스토리지 사용 안 함 - Cloudflare Worker만 사용!
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [currentTab, setCurrentTab] = useState<string>('main');
  const [targetStreamer, setTargetStreamer] = useState<string | null>(null);
  const [targetMatchId, setTargetMatchId] = useState<string | null>(null);
  const [targetStreamerRole, setTargetStreamerRole] = useState<'all' | 'ally' | 'enemy'>('all');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  const handleJumpToStreamer = useCallback((streamerName: string, matchId?: string, teamRole: 'all' | 'ally' | 'enemy' = 'all') => {
    setTargetStreamer(streamerName);
    setTargetMatchId(matchId || null);
    setTargetStreamerRole(teamRole);
    setCurrentTab('journal');
  }, []);

  const [isBgmPlaying, setIsBgmPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [bgmVolume, setBgmVolume] = useState<number>(35);

  const queueRef = useRef<BgmTrack[]>([]);
  const currentTrackRef = useRef<BgmTrack>(BGM_PLAYLIST[0]);
  const [currentTrack, setCurrentTrack] = useState<BgmTrack>(BGM_PLAYLIST[0]);
  const isQueueInitRef = useRef<boolean>(false);

  if (!isQueueInitRef.current) {
    const initialQueue = createBgmQueue(BGM_PLAYLIST);
    const first = initialQueue.shift() || BGM_PLAYLIST[0];
    currentTrackRef.current = first;
    queueRef.current = initialQueue;
    isQueueInitRef.current = true;
  }

  const ytPlayerRef = useRef<any>(null);
  const isUserPausedRef = useRef<boolean>(false);
  const hasInteractedRef = useRef<boolean>(false);

  const playNextTrack = (isAuto = false) => {
    hasInteractedRef.current = true;
    const player = ytPlayerRef.current || (window as any).__ytBgmPlayer;
    const lastTrack = currentTrackRef.current;
    let nextTrack: BgmTrack;
    if (queueRef.current.length === 0) {
      const newQueue = createBgmQueue(BGM_PLAYLIST, lastTrack?.id);
      nextTrack = newQueue.shift() || BGM_PLAYLIST[0];
      queueRef.current = newQueue;
    } else {
      nextTrack = queueRef.current.shift()!;
    }
    currentTrackRef.current = nextTrack;
    setCurrentTrack(nextTrack);
    if (player && typeof player.loadVideoById === 'function') {
      try {
        player.loadVideoById(nextTrack.videoId);
        if (!isUserPausedRef.current) {
          player.playVideo();
          setIsBgmPlaying(true);
        }
      } catch (e) {
        console.warn('Failed to load next video by ID', e);
      }
    }
    showToast(`🎵 ${isAuto ? '다음 곡' : 'BGM 전환'}: ${nextTrack.title} (${nextTrack.artist})`);
  };

  const playNextTrackRef = useRef(playNextTrack);
  playNextTrackRef.current = playNextTrack;

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Cloudflare Worker에서만 데이터 가져오기 - 로컬스토리지 사용 안 함!
  const syncFromApi = useCallback(async (isSilent = false) => {
    if (!isSilent) setSyncStatus('syncing');
    try {
      const { matches: remoteMatches, source, error } = await fetchAllMatchesFromApi();
      if (error) {
        console.warn('[Cloud Sync] Error:', error);
        if (!isSilent) setSyncStatus('error');
        return;
      }
      if (Array.isArray(remoteMatches)) {
        setMatches(remoteMatches);
        setSyncStatus('synced');
        setIsLoading(false);
        console.log(`[Cloud Sync] ${remoteMatches.length} matches from ${source} - Cloudflare Only!`);
      }
    } catch (err) {
      console.warn('[Cloud Sync] Failed:', err);
      setSyncStatus('error');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 초기 로드 - Cloudflare에서만!
    syncFromApi(false);
    // 30초마다 동기화 - PC/모바일 연동!
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFromApi(true);
      }
    }, 30000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromApi(true);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [syncFromApi]);

  // 로컬스토리지 저장 로직 완전 제거! - Cloudflare만 사용!

  useEffect(() => {
    try {
      const sess = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (sess) {
        const parsed = JSON.parse(sess);
        if (parsed.expiry && parsed.expiry > Date.now()) {
          setIsAdmin(true);
        } else {
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
        }
      }
    } catch (e) {}
  }, []);

  const handleAdminLoginSuccess = () => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ expiry }));
    setIsAdmin(true);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdmin(false);
    showToast('관리자에서 로그아웃되었습니다.');
  };

  useEffect(() => {
    let isMounted = true;
    const setupPlayer = () => {
      if (!isMounted) return;
      if ((window as any).__ytBgmPlayer) {
        ytPlayerRef.current = (window as any).__ytBgmPlayer;
        return;
      }
      if (!window.YT || !window.YT.Player) return;
      const el = document.getElementById('youtube-bgm-iframe-target');
      if (!el) return;
      try {
        const player = new window.YT.Player('youtube-bgm-iframe-target', {
          videoId: currentTrackRef.current.videoId,
          playerVars: { autoplay: 1, controls: 0, loop: 0, playsinline: 1, enablejsapi: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: (event: any) => {
              try {
                event.target.setVolume(bgmVolume);
                if (isMuted) event.target.mute();
                else event.target.unMute();
                if (!isUserPausedRef.current) event.target.playVideo();
              } catch (err) {}
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              if (event.data === 1) setIsBgmPlaying(true);
              else if (event.data === 2) setIsBgmPlaying(false);
              else if (event.data === 0) {
                if (!isUserPausedRef.current) playNextTrackRef.current(true);
              }
            },
            onError: (event: any) => {
              setTimeout(() => { if (!isUserPausedRef.current) playNextTrackRef.current(true); }, 800);
            },
          },
        });
        ytPlayerRef.current = player;
        (window as any).__ytBgmPlayer = player;
      } catch (e) {
        console.warn('Error creating YT.Player', e);
      }
    };
    if (window.YT && window.YT.Player) setupPlayer();
    else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        if (isMounted) setupPlayer();
      };
      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          if (isMounted) setupPlayer();
        }
      }, 200);
      return () => { isMounted = false; clearInterval(interval); };
    }
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (hasInteractedRef.current) return;
    const handleFirstGesture = () => {
      if (hasInteractedRef.current) return;
      hasInteractedRef.current = true;
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      if (isUserPausedRef.current) return;
      const player = ytPlayerRef.current || (window as any).__ytBgmPlayer;
      if (player && typeof player.playVideo === 'function') {
        try {
          if (!isMuted) player.unMute();
          player.setVolume(bgmVolume > 0 ? bgmVolume : 35);
          const state = player.getPlayerState?.();
          if (state !== 1) player.playVideo();
        } catch (e) {}
      }
    };
    window.addEventListener('click', handleFirstGesture, { passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [isMuted, bgmVolume]);

  const toggleBgm = () => {
    hasInteractedRef.current = true;
    const player = ytPlayerRef.current || (window as any).__ytBgmPlayer;
    if (!player || typeof player.playVideo !== 'function') {
      setIsBgmPlaying((prev) => !prev);
      showToast('BGM 연결 중... 🎵');
      return;
    }
    try {
      const state = player.getPlayerState?.();
      if (state === 1) {
        isUserPausedRef.current = true;
        player.pauseVideo();
        setIsBgmPlaying(false);
        showToast('BGM 일시정지');
      } else {
        isUserPausedRef.current = false;
        if (isMuted) { setIsMuted(false); player.unMute(); }
        else player.unMute();
        player.setVolume(bgmVolume > 0 ? bgmVolume : 35);
        if (bgmVolume === 0) setBgmVolume(35);
        player.playVideo();
        setIsBgmPlaying(true);
        showToast(`BGM 재생 🎵 (${currentTrackRef.current.title})`);
      }
    } catch (e) { console.warn(e); }
  };

  const toggleMute = () => {
    hasInteractedRef.current = true;
    const player = ytPlayerRef.current || (window as any).__ytBgmPlayer;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (!player || typeof player.mute !== 'function') return;
    try {
      if (nextMute) { player.mute(); showToast('음소거 됨'); }
      else {
        player.unMute();
        player.setVolume(bgmVolume > 0 ? bgmVolume : 35);
        if (bgmVolume === 0) setBgmVolume(35);
        if (!isUserPausedRef.current) {
          const state = player.getPlayerState?.();
          if (state !== 1) { player.playVideo(); setIsBgmPlaying(true); }
        }
        showToast('음소거 해제 🔊');
      }
    } catch (e) { console.warn(e); }
  };

  const handleVolumeChange = (val: number) => {
    setBgmVolume(val);
    const player = ytPlayerRef.current || (window as any).__ytBgmPlayer;
    if (!player || typeof player.setVolume !== 'function') return;
    try {
      player.setVolume(val);
      if (val > 0 && isMuted) { setIsMuted(false); player.unMute(); }
      if (val > 0 && !isUserPausedRef.current) {
        const state = player.getPlayerState?.();
        if (state !== 1) { player.playVideo(); setIsBgmPlaying(true); }
      }
    } catch (e) {}
  };

  const stats = useMemo(() => calculateStats(matches), [matches]);

  const allStreamers = useMemo(() => {
    const set = new Set<string>();
    set.add('우리밍_');
    for (const m of matches) {
      for (const k of ['top', 'jgl', 'mid', 'adc', 'sup'] as const) {
        if (m.team_a && m.team_a[k] && m.team_a[k].trim()) set.add(m.team_a[k].trim());
        if (m.team_b && m.team_b[k] && m.team_b[k].trim()) set.add(m.team_b[k].trim());
      }
    }
    return Array.from(set).filter(Boolean).sort((a, b) => {
      if (a === '우리밍_') return -1;
      if (b === '우리밍_') return 1;
      return a.localeCompare(b);
    });
  }, [matches]);

  const allChampions = useMemo(() => {
    const set = new Set<string>(CHAMPIONS_LIST);
    for (const m of matches) {
      for (const k of ['top', 'jgl', 'mid', 'adc', 'sup'] as const) {
        if (m.team_a_champs[k]) set.add(normalizeChampionName(m.team_a_champs[k].trim()));
        if (m.team_b_champs[k]) set.add(normalizeChampionName(m.team_b_champs[k].trim()));
      }
      for (const b of [...m.ban_a, ...m.ban_b]) {
        if (b) set.add(normalizeChampionName(b.trim()));
      }
    }
    return Array.from(set).filter(Boolean).sort();
  }, [matches]);

  // Cloudflare Only - 로컬스토리지 사용 안 함!
  const handleAddMatch = async (newMatch: Match) => {
    const normalized = normalizeMatch(newMatch);
    // Optimistic update
    setMatches((prev) => [normalized, ...prev]);
    try {
      const res = await createMatchOnApi(normalized);
      if (res.success) {
        showToast('경기 등록 완료 ☁️');
        // 클라우드에서 다시 불러와서 PC/모바일 동기화!
        setTimeout(() => syncFromApi(true), 500);
      } else {
        showToast('경기 등록 실패: ' + (res.error || ''));
        // 실패하면 롤백
        setMatches((prev) => prev.filter(m => String(m.id) !== String(normalized.id)));
      }
    } catch (err) {
      console.warn('POST failed:', err);
      showToast('경기 등록 실패 - 네트워크 오류');
      setMatches((prev) => prev.filter(m => String(m.id) !== String(normalized.id)));
    }
  };

  const handleUpdateMatch = async (updatedMatch: Match) => {
    const normalized = normalizeMatch(updatedMatch);
    const prevMatches = [...matches];
    setMatches((prev) => prev.map((m) => (String(m.id) === String(normalized.id) ? normalized : m)));
    try {
      const res = await updateMatchOnApi(normalized);
      if (res.success) {
        showToast('경기 수정 완료 ☁️');
        setTimeout(() => syncFromApi(true), 500);
      } else {
        showToast('경기 수정 실패: ' + (res.error || ''));
        setMatches(prevMatches);
      }
    } catch (err) {
      console.warn('PUT failed:', err);
      showToast('경기 수정 실패');
      setMatches(prevMatches);
    }
  };

  const handleDeleteMatch = async (id: string) => {
    const prevMatches = [...matches];
    const remaining = matches.filter((m) => String(m.id) !== String(id));
    setMatches(remaining);
    try {
      const res = await deleteMatchOnApi(id);
      if (res.success) {
        showToast('경기 삭제 완료 ☁️ - PC/모바일 모두 삭제됨!');
      } else {
        showToast('경기 삭제 실패: ' + (res.error || ''));
        setMatches(prevMatches);
      }
    } catch (err) {
      console.warn('DELETE failed:', err);
      showToast('경기 삭제 실패 - 네트워크 오류');
      setMatches(prevMatches);
    }
  };

  const handleImportMatches = async (importedList: Match[], mode: 'replace' | 'merge') => {
    const cleanList = importedList.map((m) => normalizeMatch(m));
    try {
      // Cloudflare에 배치 저장 - 로컬스토리지 사용 안 함!
      const res = await fetch('https://riming-gg.janghyck2.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, matches: cleanList }),
        mode: 'cors'
      });
      if (res.ok) {
        await syncFromApi(false);
        showToast(`전적 복원 완료! (총 ${cleanList.length}경기) ☁️`);
      }
    } catch (err) {
      console.warn('Import failed:', err);
      showToast('복원 실패');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08080c] grid place-items-center">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full mx-auto mb-3"></div>
          <div className="text-[14px]">Cloudflare에서 데이터 불러오는 중... ☁️</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#e6e6ef] selection:bg-[#8b5cf6]/30 flex flex-col justify-between">
      <div className="fixed bottom-0 right-0 w-[240px] h-[135px] opacity-[0.005] overflow-hidden pointer-events-none -z-50" aria-hidden="true">
        <div id="youtube-bgm-iframe-target" className="w-full h-full" />
      </div>
      <datalist id="players-datalist">
        {allStreamers.map((name) => (<option key={name} value={name} />))}
      </datalist>
      <datalist id="champs-datalist">
        {allChampions.map((champ) => (<option key={champ} value={champ} />))}
      </datalist>
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] bg-[#1e1e2a] border border-[#2a2a3a] text-white px-4 py-2 rounded-full text-[12px] shadow-2xl animate-[fadeIn_0.2s] max-w-[90vw] text-center font-medium">
          {toastMessage}
        </div>
      )}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        matches={matches}
        allStreamers={allStreamers}
        onSelectStreamer={handleJumpToStreamer}
        isAdmin={isAdmin}
        onLoginClick={() => setIsAdminModalOpen(true)}
        onLogoutClick={handleAdminLogout}
        pairMap={stats.pairWinrates}
        onToast={showToast}
        isBgmPlaying={isBgmPlaying}
        onToggleBgm={toggleBgm}
        onNextBgm={() => playNextTrack(false)}
        currentTrack={currentTrack}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        bgmVolume={bgmVolume}
        onChangeVolume={handleVolumeChange}
      />
      <main className="max-w-[1100px] w-full mx-auto px-4 md:px-6 py-6 md:py-10 flex-1">
        {currentTab === 'main' && (
          <MainTab stats={stats} matches={matches} onOpenSummaryModal={() => setIsSummaryModalOpen(true)} onToast={showToast} allStreamers={allStreamers} onJumpToStreamer={handleJumpToStreamer} />
        )}
        {currentTab === 'synergy' && <SynergyTab stats={stats} matches={matches} onJumpToStreamer={handleJumpToStreamer} />}
        {currentTab === 'journal' && (
          <JournalTab
            stats={stats} matches={matches} onAddMatch={handleAddMatch} onUpdateMatch={handleUpdateMatch} onDeleteMatch={handleDeleteMatch}
            isAdmin={isAdmin} onAdminLoginSuccess={handleAdminLoginSuccess} onToast={showToast}
            allStreamers={allStreamers} allChampions={allChampions}
            targetStreamer={targetStreamer} targetMatchId={targetMatchId} targetStreamerRole={targetStreamerRole}
            onJumpToStreamer={handleJumpToStreamer}
          />
        )}
        {currentTab === 'rolland' && <RollandTab onToast={showToast} allStreamers={allStreamers} />}
      </main>
      <SummaryModal stats={stats} isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} />
      <AdminLoginModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} onSuccess={handleAdminLoginSuccess} onToast={showToast} />
      <Footer totalMatches={matches.length} />
    </div>
  );
}
