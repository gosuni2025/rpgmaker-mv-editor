import React from 'react';
import useEditorStore from '../../store/useEditorStore';

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

  return (
    <>
      {fontList.length > 0 && (
        <>
          <div className="ui-editor-sidebar-section" style={{ borderBottom: 'none', padding: '6px 8px 4px' }}>
            <label>프로젝트 폰트</label>
          </div>
          <div className="ui-editor-window-list" style={{ flex: 'none', maxHeight: 180 }}>
            {fontList.map((f) => (
              <div
                key={f.family + f.file}
                className={`ui-editor-window-item${selectedFamily === f.family ? ' selected' : ''}`}
                onClick={() => setUiFontSelectedFamily(f.family)}
              >
                <div>
                  <div>{f.family}</div>
                  <div className="window-class">{f.file}</div>
                </div>
                {defaultFontFace === f.family && <span className="ui-skin-default-badge" style={{ marginLeft: 'auto' }}>기본</span>}
              </div>
            ))}
          </div>
        </>
      )}

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
