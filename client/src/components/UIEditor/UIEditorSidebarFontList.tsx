import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { useFontEditorData } from './UIEditorFontEditor';

const SYSTEM_FONTS = [
  { family: 'GameFont', label: 'GameFont (기본)' },
  { family: 'sans-serif', label: 'sans-serif' },
  { family: 'serif', label: 'serif' },
  { family: 'monospace', label: 'monospace' },
  { family: 'Dotum, AppleGothic, sans-serif', label: 'Dotum (한국어)' },
  { family: 'SimHei, Heiti TC, sans-serif', label: 'SimHei (중국어)' },
  { family: 'Arial, sans-serif', label: 'Arial' },
  { family: 'Georgia, serif', label: 'Georgia' },
];

export function FontList() {
  const fontList = useEditorStore((s) => s.uiFontList);
  const selectedFamily = useEditorStore((s) => s.uiFontSelectedFamily);
  const defaultFontFace = useEditorStore((s) => s.uiFontDefaultFace);
  const setUiFontSelectedFamily = useEditorStore((s) => s.setUiFontSelectedFamily);
  const reload = useFontEditorData();

  const handleOpenFolder = async () => {
    try {
      await fetch('/api/ui-editor/fonts/open-folder', { method: 'POST' });
    } catch { /* ignore */ }
  };

  const handleRegister = async () => {
    try {
      const r = await fetch('/api/ui-editor/fonts/register', { method: 'POST' });
      const data = await r.json();
      if (data.registered > 0) {
        useEditorStore.getState().showToast(`${data.registered}개 폰트 등록됨`);
      } else {
        useEditorStore.getState().showToast('새 폰트 없음');
      }
      reload();
    } catch {
      useEditorStore.getState().showToast('폰트 등록 실패', true);
    }
  };

  const handleDelete = async (fileName: string, family: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`폰트 "${family}" (${fileName})를 삭제하시겠습니까?`)) return;
    try {
      await fetch(`/api/ui-editor/fonts/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
      reload();
    } catch {
      useEditorStore.getState().showToast('폰트 삭제 실패', true);
    }
  };

  const handleAdd = async () => {
    await handleOpenFolder();
    alert('fonts 폴더에 폰트 파일(.ttf, .otf, .woff, .woff2)을 복사한 후\n아래 "폴더에서 불러오기" 버튼을 눌러주세요.');
  };

  return (
    <>
      <div className="ui-editor-sidebar-section" style={{ borderBottom: 'none', padding: '6px 8px 4px' }}>
        <label style={{ flex: 1 }}>프로젝트 폰트</label>
        <button
          className="ui-canvas-toolbar-btn"
          style={{ padding: '2px 6px', fontSize: 11 }}
          onClick={handleOpenFolder}
          title="fonts 폴더 열기"
        >&#128193;</button>
      </div>
      <div className="ui-editor-window-list" style={{ flex: 'none', maxHeight: 180 }}>
        {fontList.length === 0 ? (
          <div className="ui-editor-no-windows" style={{ padding: '8px', fontSize: 12, color: '#888' }}>
            등록된 폰트 없음
          </div>
        ) : (
          fontList.map((f) => (
            <div
              key={f.family + f.file}
              className={`ui-editor-window-item${selectedFamily === f.family ? ' selected' : ''}`}
              onClick={() => setUiFontSelectedFamily(f.family)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{f.family}</div>
                <div className="window-class">{f.file}</div>
              </div>
              {defaultFontFace === f.family && <span className="ui-skin-default-badge" style={{ marginLeft: 'auto' }}>기본</span>}
              <button
                className="ui-skin-delete-btn"
                onClick={(e) => handleDelete(f.file, f.family, e)}
                title="폰트 삭제"
              >&times;</button>
            </div>
          ))
        )}
      </div>
      <div className="ui-editor-sidebar-section" style={{ padding: '4px 8px', gap: 4, display: 'flex' }}>
        <button
          className="ui-canvas-toolbar-btn"
          style={{ flex: 1 }}
          onClick={handleAdd}
        >
          + 폰트 추가
        </button>
        <button
          className="ui-canvas-toolbar-btn"
          style={{ flex: 1 }}
          onClick={handleRegister}
        >
          폴더에서 불러오기
        </button>
      </div>

      <div className="ui-editor-sidebar-section" style={{ borderBottom: 'none', padding: '6px 8px 4px' }}>
        <label>시스템 폰트</label>
      </div>
      <div className="ui-font-tag-grid" style={{ padding: '4px 0', flex: 1, overflowY: 'auto' }}>
        {SYSTEM_FONTS.map((f) => (
          <label
            key={f.family}
            className={`ui-radio-label ui-font-tag${selectedFamily === f.family ? ' active' : ''}`}
          >
            <input
              type="radio"
              name="font-family"
              value={f.family}
              checked={selectedFamily === f.family}
              onChange={() => setUiFontSelectedFamily(f.family)}
            />
            {f.label}
            {defaultFontFace === f.family && (
              <span className="ui-skin-default-badge" style={{ marginLeft: 'auto' }}>기본</span>
            )}
          </label>
        ))}
      </div>
    </>
  );
}
