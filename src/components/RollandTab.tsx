import React, { useState } from 'react';
import { LineKey, TeamRoster, LINE_KEYS, LINE_LABELS } from '../types';
import { Dices, RotateCcw, Eye, EyeOff } from 'lucide-react';

interface RollandTabProps {
  onToast: (msg: string) => void;
  allStreamers: string[];
}

export const RollandTab: React.FC<RollandTabProps> = ({ onToast }) => {
  const emptyRoster: TeamRoster = { top: '', jgl: '', mid: '', adc: '', sup: '' };

  const [redRoster, setRedRoster] = useState<TeamRoster>({ ...emptyRoster });
  const [blueRoster, setBlueRoster] = useState<TeamRoster>({ ...emptyRoster });
  const [result, setResult] = useState<{ red: TeamRoster; blue: TeamRoster } | null>(null);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [blindMode, setBlindMode] = useState(false);
  const [isRevealed, setIsRevealed] = useState(true);

  const handleReset = () => {
    setRedRoster({ ...emptyRoster });
    setBlueRoster({ ...emptyRoster });
    setResult(null);
    setShuffleCount(0);
    setIsRevealed(true);
    setBlindMode(false);
    onToast('롤랜드 입력이 초기화되었습니다.');
  };

  const handleShuffle = () => {
    const nextRed = { ...redRoster };
    const nextBlue = { ...blueRoster };

    // Swap each line with 70% probability
    LINE_KEYS.forEach((k) => {
      if (Math.random() < 0.7) {
        const temp = nextRed[k];
        nextRed[k] = nextBlue[k];
        nextBlue[k] = temp;
      }
    });

    // 입력 명단(redRoster, blueRoster)은 유지하고 결과(result)만 변경
    setResult({ red: { ...nextRed }, blue: { ...nextBlue } });
    setShuffleCount((prev) => prev + 1);

    if (blindMode) {
      setIsRevealed(false);
    } else {
      setIsRevealed(true);
    }

    onToast('팀 뽑기가 완료되었습니다!');
  };

  const handleReveal = () => {
    setIsRevealed(true);
    onToast('팀 결과가 공개되었습니다!');
  };

  const handleToggleBlindMode = () => {
    // 블라인드 상태에서 결과를 확인하지 않았다면 해제 불가
    if (blindMode && !isRevealed) {
      onToast('결과를 먼저 확인해야 블라인드 모드를 해제할 수 있습니다.');
      return;
    }
    const next = !blindMode;
    setBlindMode(next);
    if (next) {
      // 블라인드 모드 활성화 시 결과가 있다면 가림
      if (result) {
        setIsRevealed(false);
      }
    } else {
      setIsRevealed(true);
    }
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.2s]">
      <div>
        <h1 className="text-[20px] font-bold text-white flex items-center gap-2">
          <Dices size={22} className="text-[#8b5cf6]" />
          <span>롤랜드 - 팀 뽑기</span>
        </h1>
        <p className="text-[13px] text-[#8a8aa0] mt-1">
          CK 일지에 기록하지 않는 가벼운 내전/스크림용 랜덤 팀 셔플러입니다. 같은 라인끼리만 팀이 스왑됩니다.
        </p>
      </div>

      {/* Input rosters */}
      <div className="bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-white">팀 입력 (10인)</h2>
          <button
            type="button"
            onClick={handleReset}
            className="h-[30px] px-3 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] rounded-full text-[11px] text-[#c0c0d0] flex items-center gap-1.5 transition"
          >
            <RotateCcw size={12} />
            <span>초기화</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Red Team Input */}
          <div className="bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.18)] rounded-[14px] p-3.5">
            <div className="text-[12px] font-bold mb-3 text-[#ef4444]">🔴 Red팀</div>
            <div className="space-y-2">
              {LINE_KEYS.map((k) => (
                <div key={`R-${k}`} className="flex items-center gap-2">
                  <span className="w-[36px] text-[11px] font-bold text-[#8a8aa0] tracking-widest">
                    {LINE_LABELS[k]}
                  </span>
                  <input
                    value={redRoster[k]}
                    onChange={(e) => setRedRoster((prev) => ({ ...prev, [k]: e.target.value }))}
                    placeholder={`Red ${LINE_LABELS[k]}`}
                    list="players-datalist"
                    className="flex-1 h-[34px] bg-[#12121a] border border-[rgba(239,68,68,0.25)] rounded-full px-3 text-[12px] text-white placeholder:text-[#4a4a5a] focus:outline-none focus:border-[#ef4444]/60 transition"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Blue Team Input */}
          <div className="bg-[rgba(59,130,246,0.05)] border border-[rgba(59,130,246,0.18)] rounded-[14px] p-3.5">
            <div className="text-[12px] font-bold mb-3 text-[#3b82f6]">🔵 Blue팀</div>
            <div className="space-y-2">
              {LINE_KEYS.map((k) => (
                <div key={`B-${k}`} className="flex items-center gap-2">
                  <span className="w-[36px] text-[11px] font-bold text-[#8a8aa0] tracking-widest">
                    {LINE_LABELS[k]}
                  </span>
                  <input
                    value={blueRoster[k]}
                    onChange={(e) => setBlueRoster((prev) => ({ ...prev, [k]: e.target.value }))}
                    placeholder={`Blue ${LINE_LABELS[k]}`}
                    list="players-datalist"
                    className="flex-1 h-[34px] bg-[#12121a] border border-[rgba(59,130,246,0.25)] rounded-full px-3 text-[12px] text-white placeholder:text-[#4a4a5a] focus:outline-none focus:border-[#3b82f6]/60 transition"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-[#08080c] border border-[#1e1e2a] rounded-[14px]">
          <button
            type="button"
            onClick={handleShuffle}
            className="h-[36px] px-5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[13px] font-bold shadow flex items-center gap-2 transition"
          >
            <Dices size={16} />
            <span>팀 뽑기</span>
          </button>
          <span className="text-[11px] text-[#8a8aa0]">{shuffleCount}번 섞음</span>

          <div className="h-[20px] w-px bg-[#1e1e2a] mx-1" />

          <label
            className={`flex items-center gap-2 select-none ${
              blindMode && !isRevealed ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
            }`}
            onClick={(e) => {
              if (blindMode && !isRevealed) {
                e.preventDefault();
                onToast('결과를 먼저 확인해야 블라인드 모드를 해제할 수 있습니다.');
              }
            }}
          >
            <input
              type="checkbox"
              checked={blindMode}
              onChange={handleToggleBlindMode}
              disabled={blindMode && !isRevealed}
              className="w-[16px] h-[16px] accent-[#8b5cf6] cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="text-[12px] font-semibold text-[#c0c0d0] flex items-center gap-1">
              {blindMode ? <EyeOff size={14} className="text-[#a78bfa]" /> : <Eye size={14} />}
              <span>블라인드 모드</span>
            </span>
            {blindMode && !isRevealed && (
              <span className="text-[10px] text-[#f87171] font-medium ml-1">
                (결과 확인 후 해제 가능)
              </span>
            )}
          </label>
        </div>

        {/* Shuffle Result Display */}
        <div className="bg-[#08080c] border border-[#1e1e2a] rounded-[16px] p-4 min-h-[180px]">
          <div className="text-[12px] font-bold text-white mb-3">
            결과 {blindMode && !isRevealed ? '(🙈 블라인드 상태)' : ''}
          </div>

          {result ? (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${
                blindMode && !isRevealed ? 'blur-[12px] select-none pointer-events-none' : ''
              }`}
            >
              <div className="bg-[#12121a] border border-[rgba(239,68,68,0.2)] rounded-[12px] p-3.5">
                <div className="text-[12px] font-bold mb-2 text-[#ef4444]">🔴 Red팀</div>
                {LINE_KEYS.map((k) => (
                  <div key={`resR-${k}`} className="flex justify-between text-[12px] py-1 border-b border-[#1e1e2a]/40 last:border-0">
                    <span className="text-[#6a6a80]">{LINE_LABELS[k]}</span>
                    <span className="font-semibold text-white">{result.red[k] || '-'}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#12121a] border border-[rgba(59,130,246,0.2)] rounded-[12px] p-3.5">
                <div className="text-[12px] font-bold mb-2 text-[#3b82f6]">🔵 Blue팀</div>
                {LINE_KEYS.map((k) => (
                  <div key={`resB-${k}`} className="flex justify-between text-[12px] py-1 border-b border-[#1e1e2a]/40 last:border-0">
                    <span className="text-[#6a6a80]">{LINE_LABELS[k]}</span>
                    <span className="font-semibold text-white">{result.blue[k] || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-[#5a5a6a] text-center py-10">
              팀 선수를 입력한 후 "팀 뽑기"를 눌러보세요.
            </div>
          )}

          {blindMode && !isRevealed && result && (
            <div className="mt-4 text-center">
              <div className="inline-flex flex-col items-center gap-2 bg-[#1e1e2a] border border-[#2a2a3a] rounded-[14px] px-6 py-4 shadow-xl">
                <div className="text-[28px]">🙈</div>
                <div className="text-[13px] font-bold text-white">블라인드 상태입니다</div>
                <div className="text-[11px] text-[#8a8aa0]">
                  팀은 {shuffleCount}번 섞였습니다. 아래 버튼을 눌러 결과를 확인하세요!
                </div>
                <button
                  type="button"
                  onClick={handleReveal}
                  className="mt-2 h-[36px] px-6 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-bold shadow transition"
                >
                  👁️ 결과 확인하기
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 text-[11px] text-[#5a5a6a]">
          • 각 포지션(탑, 정글, 미드, 원딜, 서폿) 별로 70% 확률로 상대 팀과 교환됩니다.
        </div>
      </div>
    </div>
  );
};
