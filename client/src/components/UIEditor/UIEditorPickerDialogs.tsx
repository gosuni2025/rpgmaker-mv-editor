import React, { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import './UIEditor.css';

// ── 프레임 선택 팝업 ──────────────────────────────────────────────────────────

interface SkinEntryBasic { name: string; label?: string; file?: string; cornerSize: number; }

export function FramePickerDialog({ open, current, onClose, onSelect }: {
  open: boolean;
  current: string;
  onClose: () => void;
  onSelect: (skinName: string, skinFile: string) => void;
}) {
  const [skins, setSkins] = useState<SkinEntryBasic[]>([]);

  useEffect(() => {
    if (!open) return;
    apiClient.get<{ skins: SkinEntryBasic[] }>('/ui-editor/skins')
      .then((d) => setSkins(d.skins ?? []))
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  return (
    <div className="ui-frame-picker-overlay" onClick={onClose}>
      <div className="ui-frame-picker-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ui-frame-picker-header">
          <span>프레임 선택</span>
          <button className="ui-help-close" onClick={onClose}>×</button>
        </div>
        {skins.length === 0 ? (
          <div className="ui-frame-picker-empty">
            등록된 스킨이 없습니다.<br />
            프레임 편집 탭에서 먼저 스킨을 등록하세요.
          </div>
        ) : (
          <div className="ui-frame-picker-grid">
            {skins.map((skin) => {
              const skinFile = skin.file || skin.name;
              const skinLabel = skin.label || skin.name;
              return (
                <div
                  key={skin.name}
                  className={`ui-frame-picker-item${current === skin.name ? ' selected' : ''}`}
                  onClick={() => { onSelect(skin.name, skinFile); onClose(); }}
                >
                  <div className="ui-frame-picker-img-wrap">
                    <img
                      src={`/img/system/${skinFile}.png`}
                      alt={skinLabel}
                      className="ui-frame-picker-img"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                  </div>
                  <span className="ui-frame-picker-name">{skinLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 이미지 선택 팝업 ──────────────────────────────────────────────────────────

export function ImagePickerDialog({ open, current, onClose, onSelect }: {
  open: boolean;
  current: string;
  onClose: () => void;
  onSelect: (filename: string) => void;
}) {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    apiClient.get<{ files: string[] }>('/ui-editor/images/list')
      .then((d) => setFiles(d.files ?? []))
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  return (
    <div className="ui-frame-picker-overlay" onClick={onClose}>
      <div className="ui-frame-picker-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ui-frame-picker-header">
          <span>이미지 선택</span>
          <button className="ui-help-close" onClick={onClose}>×</button>
        </div>
        {files.length === 0 ? (
          <div className="ui-frame-picker-empty">
            img/system/ 폴더에 PNG 파일이 없습니다.<br />
            플레이스홀더 생성 버튼으로 먼저 파일을 만드세요.
          </div>
        ) : (
          <div className="ui-frame-picker-grid">
            {files.map((f) => (
              <div
                key={f}
                className={`ui-frame-picker-item${current === f ? ' selected' : ''}`}
                onClick={() => { onSelect(f); onClose(); }}
              >
                <div className="ui-frame-picker-img-wrap">
                  <img
                    src={`/img/system/${f}.png`}
                    alt={f}
                    className="ui-frame-picker-img"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                  />
                </div>
                <span className="ui-frame-picker-name">{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
