import React, { useState } from 'react';
import { PASSCODE } from '../data/initialMatches';
import { Lock, X } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onToast: (msg: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onToast,
}) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = () => {
    if (passcode.trim().toLowerCase() === PASSCODE.toLowerCase()) {
      onSuccess();
      onToast('관리자로 로그인되었습니다 (24시간 유지).');
      onClose();
      setPasscode('');
      setError('');
    } else {
      setError('패스코드가 올바르지 않습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s]">
      <div className="w-full max-w-[360px] bg-[#12121a] border border-[#1e1e2a] rounded-[20px] p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-3">
          <div className="font-bold text-[15px] text-white flex items-center gap-1.5">
            <Lock size={16} className="text-[#8b5cf6]" />
            <span>관리자 로그인</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[28px] h-[28px] bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-white"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-[11px] text-[#8a8aa0] mb-3 leading-relaxed">
          패스코드를 입력하면 24시간 동안 경기 추가, 수정, 삭제 권한이 유지됩니다.
        </p>

        <input
          type="password"
          value={passcode}
          onChange={(e) => {
            setPasscode(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleLogin();
          }}
          placeholder="패스코드"
          className="w-full h-[40px] bg-[#08080c] border border-[#1e1e2a] rounded-full px-4 text-[13px] text-white focus:outline-none focus:border-[#8b5cf6]/50 mb-2"
          autoFocus
        />

        {error && <div className="text-[11px] text-[#ff6b6b] mb-3">⚠️ {error}</div>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[36px] bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#c0c0d0] rounded-full text-[12px]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleLogin}
            className="flex-1 h-[36px] bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-full text-[12px] font-bold shadow"
          >
            로그인
          </button>
        </div>
      </div>
    </div>
  );
};
