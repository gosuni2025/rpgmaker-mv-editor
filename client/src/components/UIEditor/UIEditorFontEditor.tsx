import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import './UIEditor.css';

const SAMPLE_TEXTS = [
  '가나다라마바사아자차카타파하',
  'The quick brown fox jumps over the lazy dog',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789',
  '아이템을 획득했습니다! HP +100',
];

/** 폰트 데이터를 로드하여 store에 반영하는 훅 */
export function useFontEditorData() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const setUiFontList = useEditorStore((s) => s.setUiFontList);
  const setUiFontDefaultFace = useEditorStore((s) => s.setUiFontDefaultFace);
  const setUiFontSelectedFamily = useEditorStore((s) => s.setUiFontSelectedFamily);
  const uiFontSelectedFamily = useEditorStore((s) => s.uiFontSelectedFamily);

  const reload = useCallback(() => {
    if (!projectPath) return;
    fetch('/api/ui-editor/fonts')
      .then((r) => r.json())
      .then((data) => {
        setUiFontList(data.fonts ?? []);
        setUiFontDefaultFace(data.defaultFontFace ?? '');
        if (!uiFontSelectedFamily || uiFontSelectedFamily === 'GameFont') {
          setUiFontSelectedFamily(data.defaultFontFace || 'GameFont');
        }
      })
      .catch(() => {});
  }, [projectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload(); }, [reload]);
  return reload;
}

/** 가운데: 샘플 프리뷰 패널 */
export default function UIEditorFontEditor() {
  const selectedFamily = useEditorStore((s) => s.uiFontSelectedFamily);
  const defaultFontFace = useEditorStore((s) => s.uiFontDefaultFace);
  useFontEditorData();

  const [sampleText, setSampleText] = useState(SAMPLE_TEXTS[0]);
  const [fontSize, setFontSize] = useState(28);

  return (
    <div className="ui-font-preview-panel">
      <div className="ui-font-preview-controls">
        <select
          className="ui-editor-scene-select"
          style={{ flex: 1, maxWidth: 260 }}
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
        >
          {SAMPLE_TEXTS.map((t) => (
            <option key={t} value={t}>{t.substring(0, 32)}{t.length > 32 ? '…' : ''}</option>
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
          기본 폰트: <strong>{defaultFontFace}</strong>
        </div>
      )}
    </div>
  );
}
