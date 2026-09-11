import React, { useState, useRef } from 'react';
import { Match } from '../types';
import {
  parseMatchPayload,
  serializeMatchesForExport,
  SCHEMA_VERSION,
} from '../lib/matchSchema';
import {
  Database,
  Upload,
  Download,
  RefreshCw,
  X,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  Layers,
} from 'lucide-react';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  onImportToD1: (importedList: Match[], mode: 'replace' | 'merge') => Promise<boolean>;
  onToast: (msg: string) => void;
  onRefreshFromD1: () => Promise<void>;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  matches,
  onImportToD1,
  onToast,
  onRefreshFromD1,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Staged candidate before saving to D1
  const [candidate, setCandidate] = useState<{
    filename: string;
    matches: Match[];
    format: string;
    schemaVersion?: string;
    warnings: string[];
  } | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  if (!isOpen) return null;

  // Process File
  const processJsonFile = (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      onToast('JSON (.json) 형식의 파일만 업로드할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || !text.trim()) {
          onToast('선택한 파일의 내용이 비어 있습니다.');
          return;
        }

        const parsed = JSON.parse(text);
        const { matches: parsedMatches, format, schemaVersion, warnings } = parseMatchPayload(parsed);

        if (parsedMatches.length === 0) {
          onToast('업로드한 파일에서 유효한 경기 데이터를 찾을 수 없습니다.');
          return;
        }

        setCandidate({
          filename: file.name,
          matches: parsedMatches,
          format,
          schemaVersion,
          warnings,
        });
        setImportMode('replace');
        onToast(`파일 파싱 성공: 총 ${parsedMatches.length}경기 감지`);
      } catch (err: any) {
        console.error('JSON parsing error:', err);
        onToast(err?.message || 'JSON 데이터를 파싱하는 도중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processJsonFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processJsonFile(file);
    }
  };

  // Upload and Save to Cloudflare D1
  const handleConfirmSaveToD1 = async () => {
    if (!candidate) return;
    setIsUploading(true);
    try {
      const success = await onImportToD1(candidate.matches, importMode);
      if (success) {
        onToast(`Cloudflare D1 DB에 ${candidate.matches.length}경기 저장 완료! ☁️`);
        setCandidate(null);
        onClose();
      } else {
        onToast('D1 DB 저장에 실패했습니다. 로컬 캐시로 우선 반영되었습니다.');
      }
    } catch (e: any) {
      console.error('Save to D1 error:', e);
      onToast(e?.message || 'D1 DB 저장 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // Backup Export
  const handleExportBackup = () => {
    if (matches.length === 0) {
      onToast('내보낼 경기 데이터가 없습니다.');
      return;
    }
    try {
      const exportPayload = serializeMatchesForExport(matches);
      const dataStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `wooriming_ck_matches_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast(`JSON 백업 다운로드 완료 (총 ${matches.length}경기)`);
    } catch (e) {
      console.error('Export error:', e);
      onToast('백업 파일 생성에 실패했습니다.');
    }
  };

  // Refresh from Cloudflare D1
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshFromD1();
      onToast('Cloudflare D1 DB 최신 데이터 동기화 완료 🔄');
    } catch (e) {
      onToast('D1 DB 동기화 실패');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-[fadeIn_0.15s]"
      onClick={onClose}
    >
      <div
        className="bg-[#12121a] border border-[#2a2a3a] rounded-[20px] w-full max-w-[540px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2a] bg-[#161622]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
              <Database size={18} />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-white flex items-center gap-2">
                JSON 데이터 불러오기 / 백업
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20 font-normal">
                  Cloudflare D1
                </span>
              </h3>
              <p className="text-[11px] text-[#8a8aa0]">
                JSON 파일을 업로드하여 Cloudflare D1 DB(/api/matches)로 자동 저장합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#8a8aa0] hover:text-white hover:bg-[#222232] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-[13px]">
          {/* Status Banner */}
          <div className="bg-[#0b0b12] border border-[#1e1e2a] rounded-[14px] p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cloud size={16} className="text-[#38bdf8]" />
              <div>
                <div className="text-[12px] font-semibold text-[#e2e8f0]">
                  현재 전적 데이터: <span className="text-[#38bdf8] font-bold">{matches.length}경기</span>
                </div>
                <div className="text-[10px] text-[#8a8aa0]">엔드포인트: /api/matches (바인딩: DB)</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e2c] hover:bg-[#2a2a3e] border border-[#2e2e42] text-[11px] text-[#cbd5e1] transition disabled:opacity-50"
              title="D1 DB에서 최신 데이터 다시 불러오기"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[#38bdf8]' : ''} />
              <span>{isRefreshing ? '동기화 중' : 'D1 새로고침'}</span>
            </button>
          </div>

          {/* Section 1: Upload JSON to D1 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white text-[13px] flex items-center gap-1.5">
                <Upload size={14} className="text-[#38bdf8]" />
                1. JSON 데이터 업로드 & D1 DB 자동 저장
              </span>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[16px] p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#38bdf8] bg-[#38bdf8]/10'
                  : 'border-[#262638] bg-[#0c0c14] hover:border-[#38bdf8]/50 hover:bg-[#12121e]'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-[#38bdf8]/10 text-[#38bdf8] flex items-center justify-center mb-3">
                <FileJson size={24} />
              </div>
              <div className="font-medium text-[13px] text-[#f1f5f9] mb-1">
                클릭하여 JSON 파일 선택 또는 여기에 드래그 앤 드롭
              </div>
              <div className="text-[11px] text-[#8a8aa0]">
                표준 백업 JSON, Supabase/D1 DTO, 경기 배열 (.json) 자동 감지
              </div>
            </div>

            {/* Candidate Preview & Confirmation */}
            {candidate && (
              <div className="bg-[#161624] border border-[#38bdf8]/40 rounded-[14px] p-4 space-y-3 animate-[fadeIn_0.2s]">
                <div className="flex items-center justify-between border-b border-[#252538] pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#38bdf8]" />
                    <span className="font-semibold text-white text-[12px]">{candidate.filename}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCandidate(null)}
                    className="text-[11px] text-[#8a8aa0] hover:text-white"
                  >
                    취소
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#0c0c14] p-3 rounded-[10px] border border-[#1e1e2e]">
                  <div>
                    <span className="text-[#8a8aa0]">감지된 포맷:</span>{' '}
                    <span className="text-[#38bdf8] font-medium">{candidate.format}</span>
                  </div>
                  <div>
                    <span className="text-[#8a8aa0]">불러올 경기 수:</span>{' '}
                    <span className="text-white font-bold">{candidate.matches.length}경기</span>
                  </div>
                  {candidate.schemaVersion && (
                    <div className="col-span-2">
                      <span className="text-[#8a8aa0]">스키마 버전:</span>{' '}
                      <span className="text-[#a78bfa]">v{candidate.schemaVersion}</span>
                    </div>
                  )}
                </div>

                {candidate.warnings.length > 0 && (
                  <div className="text-[11px] text-[#fbbf24] bg-[#fbbf24]/10 rounded-[8px] p-2.5 border border-[#fbbf24]/20 flex gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium mb-0.5">정규화 참고 사항:</div>
                      <ul className="list-disc pl-3 text-[10px] space-y-0.5">
                        {candidate.warnings.slice(0, 2).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Mode Select */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] text-[#8a8aa0] font-medium">D1 DB 저장 모드 선택:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`p-2.5 rounded-[10px] border text-left transition ${
                        importMode === 'replace'
                          ? 'border-[#38bdf8] bg-[#38bdf8]/10 text-white'
                          : 'border-[#262638] bg-[#0e0e16] text-[#8a8aa0] hover:bg-[#151522]'
                      }`}
                    >
                      <div className="font-semibold text-[11px]">전체 교체 (권장)</div>
                      <div className="text-[10px] opacity-75">기존 데이터를 비우고 파일 데이터로 교체</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('merge')}
                      className={`p-2.5 rounded-[10px] border text-left transition ${
                        importMode === 'merge'
                          ? 'border-[#38bdf8] bg-[#38bdf8]/10 text-white'
                          : 'border-[#262638] bg-[#0e0e16] text-[#8a8aa0] hover:bg-[#151522]'
                      }`}
                    >
                      <div className="font-semibold text-[11px]">기존 데이터에 병합</div>
                      <div className="text-[10px] opacity-75">중복 ID 제외하고 새 경기 추가</div>
                    </button>
                  </div>
                </div>

                {/* Save to D1 Button */}
                <button
                  type="button"
                  onClick={handleConfirmSaveToD1}
                  disabled={isUploading}
                  className="w-full py-2.5 px-4 rounded-[10px] bg-[#38bdf8] hover:bg-[#0284c7] text-[#08080c] font-bold text-[12px] flex items-center justify-center gap-2 shadow-lg shadow-[#38bdf8]/20 transition disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Cloudflare D1 DB에 저장 중...</span>
                    </>
                  ) : (
                    <>
                      <Cloud size={14} />
                      <span>{candidate.matches.length}경기 D1 DB로 즉시 저장하기</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-[#1e1e2a] my-2" />

          {/* Section 2: Backup Export */}
          <div className="space-y-3">
            <span className="font-semibold text-white text-[13px] flex items-center gap-1.5">
              <Download size={14} className="text-[#a78bfa]" />
              2. 현재 데이터 JSON 백업 다운로드
            </span>
            <div className="bg-[#0b0b12] border border-[#1e1e2a] rounded-[14px] p-4 flex items-center justify-between">
              <div>
                <div className="text-[12px] font-medium text-[#e2e8f0]">표준 JSON 파일로 내보내기</div>
                <div className="text-[11px] text-[#8a8aa0]">
                  총 {matches.length}경기를 표준 스키마(v{SCHEMA_VERSION})로 저장합니다.
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={matches.length === 0}
                className="px-4 py-2 rounded-[10px] bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[11px] font-bold flex items-center gap-1.5 transition shadow-md shadow-[#8b5cf6]/20 disabled:opacity-40"
              >
                <Download size={13} />
                <span>백업 다운로드</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#0d0d14] border-t border-[#1e1e2a] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-[8px] bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[12px] text-[#cbd5e1] transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
