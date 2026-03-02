import React, { useState, useCallback } from 'react';
import useEscClose from '../hooks/useEscClose';

// @type -> database API endpoint mapping for DataListPicker
export const DB_TYPE_MAP: Record<string, { endpoint: string; title: string }> = {
  actor: { endpoint: 'actors', title: '액터' },
  class: { endpoint: 'classes', title: '직업' },
  skill: { endpoint: 'skills', title: '스킬' },
  item: { endpoint: 'items', title: '아이템' },
  weapon: { endpoint: 'weapons', title: '무기' },
  armor: { endpoint: 'armors', title: '방어구' },
  enemy: { endpoint: 'enemies', title: '적' },
  state: { endpoint: 'states', title: '스테이트' },
  tileset: { endpoint: 'tilesets', title: '타일셋' },
  common_event: { endpoint: 'commonEvents', title: '커먼 이벤트' },
  switch: { endpoint: 'switches', title: '스위치' },
  variable: { endpoint: 'variables', title: '변수' },
  troop: { endpoint: 'troops', title: '적 그룹' },
};

export interface PluginParam {
  name: string;
  value: string;
}

export interface PluginEntry {
  name: string;
  status: boolean;
  description: string;
  parameters: PluginParam[];
}

export interface ServerPluginEntry {
  name: string;
  status: boolean;
  description: string;
  parameters: Record<string, string>;
}

export interface PluginsResponse {
  files: string[];
  list: ServerPluginEntry[];
}

export interface PluginParamOption {
  label: string;
  value: string;
}

export interface PluginParamMeta {
  name: string;
  text?: string;   // @text 표시명
  desc: string;
  type: string;
  default: string;
  options: PluginParamOption[];
  dir: string;
  min?: string;
  max?: string;
  parent?: string;
}

export interface PluginMetadata {
  pluginname: string;
  plugindesc: string;
  author: string;
  help: string;
  params: PluginParamMeta[];
  dependencies?: string[];
  requires?: string[];  // @require — 먼저 로드되어야 할 플러그인 목록
}

export interface ProjectSettings {
  touchUI: boolean;
  screenWidth: number;
  screenHeight: number;
  fps: number;
}

export interface EditorPluginInfo {
  name: string;
  hasUpdate: boolean;
}

/** File picker dialog for @type file parameters */
export function FilePickerDialog({ dir, files, value, onChange, onClose }: {
  dir: string;
  files: string[];
  value: string;
  onChange: (name: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(value);
  useEscClose(useCallback(() => onClose(), [onClose]));

  // Determine preview URL for images
  const isImage = (name: string) => /\.(png|jpe?g|gif|bmp|webp)$/i.test(name);
  // Find original filename with extension for the selected item
  const selectedFile = files.find(f => f.replace(/\.[^.]+$/, '') === selected) || '';
  const previewUrl = selected && selectedFile && isImage(selectedFile)
    ? `/${dir.replace(/\/$/, '')}/${selectedFile}`
    : null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="db-dialog" style={{ width: 500, height: 450 }}>
        <div className="db-dialog-header">파일 선택 ({dir})</div>
        <div className="db-dialog-body" style={{ display: 'flex', gap: 8, padding: 8, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #555', borderRadius: 3, background: '#1e1e1e' }}>
            <div
              className={`pm-plugin-item${selected === '' ? ' active' : ''}`}
              onClick={() => setSelected('')}
            >(None)</div>
            {files.map(f => {
              const nameNoExt = f.replace(/\.[^.]+$/, '');
              return (
                <div
                  key={f}
                  className={`pm-plugin-item${selected === nameNoExt || selected === f ? ' active' : ''}`}
                  onClick={() => setSelected(nameNoExt)}
                  onDoubleClick={() => onChange(nameNoExt)}
                  title={f}
                >{nameNoExt}</div>
              );
            })}
          </div>
          <div style={{ width: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #555', borderRadius: 3, background: '#1e1e1e' }}>
            {previewUrl ? (
              <img src={previewUrl} alt={selected} style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <span style={{ color: '#888', fontSize: 12 }}>{selected || '미리보기 없음'}</span>
            )}
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={() => onChange(selected)}>OK</button>
          <button className="db-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** Directory picker dialog for @type dir parameters */
export function DirPickerDialog({ parentDir, dirs, value, onChange, onClose }: {
  parentDir: string;
  dirs: string[];
  value: string;
  onChange: (name: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(value);
  useEscClose(useCallback(() => onClose(), [onClose]));

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="db-dialog" style={{ width: 400, height: 400 }}>
        <div className="db-dialog-header">폴더 선택 ({parentDir})</div>
        <div className="db-dialog-body" style={{ padding: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', overflow: 'auto', border: '1px solid #555', borderRadius: 3, background: '#1e1e1e' }}>
            {dirs.length === 0 ? (
              <div style={{ padding: 12, color: '#888', textAlign: 'center' }}>폴더가 없습니다</div>
            ) : (
              dirs.map(d => (
                <div
                  key={d}
                  className={`pm-plugin-item${selected === d ? ' active' : ''}`}
                  onClick={() => setSelected(d)}
                  onDoubleClick={() => onChange(d)}
                >
                  📁 {d}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={() => onChange(selected)}>OK</button>
          <button className="db-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** Text file picker dialog for @type textfile parameters */
export function TextFilePickerDialog({ dir, files, value, onChange, onClose }: {
  dir: string;
  files: string[];
  value: string;
  onChange: (path: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(value);
  useEscClose(useCallback(() => onClose(), [onClose]));

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="db-dialog" style={{ width: 360, height: 350 }}>
        <div className="db-dialog-header">텍스트 파일 선택 ({dir}/)</div>
        <div className="db-dialog-body" style={{ padding: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', overflow: 'auto', border: '1px solid #555', borderRadius: 3, background: '#1e1e1e' }}>
            {files.length === 0 ? (
              <div style={{ padding: 12, color: '#888', textAlign: 'center' }}>파일이 없습니다</div>
            ) : (
              files.map(f => {
                const fullPath = dir ? `${dir}/${f}` : f;
                return (
                  <div
                    key={f}
                    className={`pm-plugin-item${selected === fullPath ? ' active' : ''}`}
                    onClick={() => setSelected(fullPath)}
                    onDoubleClick={() => onChange(fullPath)}
                  >
                    {f}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={() => onChange(selected)}>OK</button>
          <button className="db-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
