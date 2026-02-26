import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import './UIEditor.css';

// 기본 시스템 폰트 태그 목록
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

const SAMPLE_TEXTS = [
  '가나다라마바사아자차카타파하',
  'The quick brown fox jumps over the lazy dog',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789',
  '아이템을 획득했습니다! HP +100',
];

interface FontEntry {
  name: string;
  file: string;
  family: string;
}

interface FontItem {
  family: string;
  label: string;
  file?: string;
  isProject?: boolean;
}

export default function UIEditorFontEditor() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const uiEditorDirty = useEditorStore((s) => s.uiEditorDirty);
  const setUiEditorDirty = useEditorStore((s) => s.setUiEditorDirty);

  const [projectFonts, setProjectFonts] = useState<FontEntry[]>([]);
  const [defaultFontFace, setDefaultFontFace] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [sampleText, setSampleText] = useState(SAMPLE_TEXTS[0]);
  const [fontSize, setFontSize] = useState(28);
  const [loading, setLoading] = useState(false);

  const allFonts: FontItem[] = [
    ...projectFonts.map((f) => ({
      family: f.family,
      label: `${f.family} (${f.file})`,
      file: f.file,
      isProject: true,
    })),
    ...SYSTEM_FONTS,
  ];

  const loadFonts = useCallback(() => {
    if (!projectPath) return;
    setLoading(true);
    fetch('/api/ui-editor/fonts')
      .then((r) => r.json())
      .then((data) => {
        setProjectFonts(data.fonts ?? []);
        setDefaultFontFace(data.defaultFontFace ?? '');
        if (!selectedFamily) setSelectedFamily(data.defaultFontFace || 'GameFont');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadFonts(); }, [loadFonts]);

  const handleSetDefault = async () => {
    if (!selectedFamily) return;
    await fetch('/api/ui-editor/fonts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultFontFace: selectedFamily }),
    });
    setDefaultFontFace(selectedFamily);
    // iframe에 전역 폰트 변경 알림
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'setDefaultFontFace', fontFace: selectedFamily }, '*');
    setUiEditorDirty(true);
    useEditorStore.getState().showToast(`기본 폰트 설정: ${selectedFamily}`);
  };

  const handleSave = async () => {
    await fetch('/api/ui-editor/fonts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultFontFace }),
    });
    setUiEditorDirty(false);
    useEditorStore.getState().showToast('폰트 설정 저장 완료');
  };

  const selectedItem = allFonts.find((f) => f.family === selectedFamily) ?? null;
  const isDefault = defaultFontFace === selectedFamily;

  return (
    <div className="ui-font-editor">
      {/* 왼쪽: 폰트 목록 */}
      <div className="ui-font-list-panel">
        {projectFonts.length > 0 && (
          <div className="ui-font-group-label">프로젝트 폰트</div>
        )}
        {projectFonts.map((f) => (
          <div
            key={f.family + f.file}
            className={`ui-font-list-item${selectedFamily === f.family ? ' selected' : ''}`}
            onClick={() => setSelectedFamily(f.family)}
          >
            <div className="ui-font-item-name">{f.family}</div>
            <div className="ui-font-item-sub">{f.file}</div>
            {defaultFontFace === f.family && <span className="ui-skin-default-badge">기본</span>}
          </div>
        ))}

        <div className="ui-font-group-label">시스템 폰트</div>
        {SYSTEM_FONTS.map((f) => (
          <div
            key={f.family}
            className={`ui-font-list-item${selectedFamily === f.family ? ' selected' : ''}`}
            onClick={() => setSelectedFamily(f.family)}
          >
            <div className="ui-font-item-name">{f.label}</div>
            <div className="ui-font-item-sub" style={{ fontFamily: f.family, fontSize: 13 }}>
              ABCabc 가나다
            </div>
            {defaultFontFace === f.family && <span className="ui-skin-default-badge">기본</span>}
          </div>
        ))}

        {!loading && projectFonts.length === 0 && (
          <div className="ui-editor-no-windows" style={{ padding: '8px 12px', fontSize: 11, color: '#888' }}>
            fonts/ 폴더에 폰트 파일 없음
          </div>
        )}
      </div>

      {/* 가운데: 샘플 프리뷰 */}
      <div className="ui-font-preview-panel">
        <div className="ui-font-preview-controls">
          <select
            className="ui-editor-scene-select"
            style={{ flex: 1 }}
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
          >
            {SAMPLE_TEXTS.map((t) => (
              <option key={t} value={t}>{t.substring(0, 30)}{t.length > 30 ? '…' : ''}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>
            크기
            <input
              type="range" min={10} max={72} value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: 80 }}
            />
            {fontSize}px
          </label>
        </div>

        <input
          className="ui-font-sample-input"
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          placeholder="샘플 텍스트 입력..."
          style={{ fontFamily: selectedFamily || 'GameFont', fontSize }}
        />

        <div className="ui-font-preview-sizes">
          {[14, 20, 28, 36, 48].map((sz) => (
            <div
              key={sz}
              className="ui-font-preview-row"
              style={{ fontFamily: selectedFamily || 'GameFont', fontSize: sz }}
            >
              <span className="ui-font-preview-sz-label">{sz}px</span>
              {sampleText}
            </div>
          ))}
        </div>

        {defaultFontFace && (
          <div className="ui-font-current-default">
            현재 기본 폰트: <strong>{defaultFontFace || '(미설정 — 언어별 자동)'}</strong>
          </div>
        )}
      </div>

      {/* 오른쪽: 인스펙터 */}
      <div className="ui-font-inspector-panel">
        <div className="ui-editor-inspector-header">폰트 정보</div>

        {selectedItem ? (
          <div className="ui-font-inspector-body">
            <div className="ui-inspector-row">
              <label>Family</label>
              <div className="ui-font-family-text">{selectedItem.family}</div>
            </div>
            {selectedItem.file && (
              <div className="ui-inspector-row">
                <label>파일</label>
                <div className="ui-font-family-text" style={{ color: '#aaa', fontSize: 11 }}>
                  fonts/{selectedItem.file}
                </div>
              </div>
            )}
            {!selectedItem.isProject && (
              <div className="ui-inspector-row">
                <label>종류</label>
                <div style={{ fontSize: 12, color: '#aaa' }}>시스템 폰트</div>
              </div>
            )}

            <div style={{ margin: '12px 0 6px', borderTop: '1px solid #444', paddingTop: 10 }}>
              <div className="ui-font-preview-box" style={{ fontFamily: selectedFamily, fontSize: 22 }}>
                가나다 ABC 123
              </div>
            </div>

            <button
              className="ui-canvas-toolbar-btn"
              style={{
                width: '100%', marginTop: 8,
                background: isDefault ? '#1a4a1a' : undefined,
                borderColor: isDefault ? '#3a8a3a' : undefined,
                color: isDefault ? '#6cf06c' : undefined,
              }}
              onClick={handleSetDefault}
              disabled={!projectPath || isDefault}
            >
              {isDefault ? '✓ 현재 기본 폰트' : '기본 폰트로 설정'}
            </button>

            {!isDefault && defaultFontFace && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 6, textAlign: 'center' }}>
                현재 기본: {defaultFontFace}
              </div>
            )}
          </div>
        ) : (
          <div className="ui-editor-inspector-empty">폰트를 선택하세요</div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ padding: 8, borderTop: '1px solid #444' }}>
          <button
            className={`draw-toolbar-save-btn${uiEditorDirty ? ' dirty' : ''}`}
            style={{ width: '100%' }}
            onClick={handleSave}
            disabled={!projectPath}
          >
            저장{uiEditorDirty ? ' *' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
