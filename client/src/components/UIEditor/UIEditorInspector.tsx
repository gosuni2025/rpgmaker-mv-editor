import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo, UIWindowOverride } from '../../store/types';
import './UIEditor.css';

function NumInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      className="ui-inspector-input-num"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(v);
      }}
    />
  );
}

export default function UIEditorInspector() {
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorDirty = useEditorStore((s) => s.uiEditorDirty);
  const setUiEditorOverride = useEditorStore((s) => s.setUiEditorOverride);
  const resetUiEditorOverride = useEditorStore((s) => s.resetUiEditorOverride);
  const projectPath = useEditorStore((s) => s.projectPath);

  const selectedWindow = uiEditorWindows.find((w) => w.id === uiEditorSelectedWindowId) ?? null;
  const override = selectedWindow ? (uiEditorOverrides[selectedWindow.className] ?? null) : null;

  const getProp = useCallback(<K extends keyof UIWindowInfo>(
    key: K,
    win: UIWindowInfo,
    ov: UIWindowOverride | null,
  ): UIWindowInfo[K] => {
    if (ov && key in ov && key !== 'className') {
      return (ov as unknown as Record<string, unknown>)[key] as UIWindowInfo[K];
    }
    return win[key];
  }, []);

  const set = useCallback((prop: keyof Omit<UIWindowOverride, 'className'>, value: unknown) => {
    if (!selectedWindow) return;
    setUiEditorOverride(selectedWindow.className, prop, value);
    // postMessage로 iframe에 실시간 반영
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop, value }, '*');
  }, [selectedWindow, setUiEditorOverride]);

  const handleSave = async () => {
    if (!projectPath) return;
    try {
      const config = useEditorStore.getState().uiEditorOverrides;
      await fetch('/api/ui-editor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: config }),
      });
      // 플러그인 생성
      await fetch('/api/ui-editor/generate-plugin', { method: 'POST' });
      useEditorStore.getState().setUiEditorDirty(false);
      useEditorStore.getState().showToast('UI 테마 저장 완료');
    } catch {
      useEditorStore.getState().showToast('저장 실패', true);
    }
  };

  if (!selectedWindow) {
    return (
      <div className="ui-editor-inspector">
        <div className="ui-editor-inspector-header">인스펙터</div>
        <div className="ui-editor-inspector-body">
          <div className="ui-editor-inspector-empty">창을 선택하세요</div>
        </div>
      </div>
    );
  }

  const x = getProp('x', selectedWindow, override);
  const y = getProp('y', selectedWindow, override);
  const width = getProp('width', selectedWindow, override);
  const height = getProp('height', selectedWindow, override);
  const opacity = getProp('opacity', selectedWindow, override);
  const backOpacity = getProp('backOpacity', selectedWindow, override);
  const padding = getProp('padding', selectedWindow, override);
  const fontSize = getProp('fontSize', selectedWindow, override);
  const colorTone = getProp('colorTone', selectedWindow, override);

  const hasAnyOverride = !!override;

  return (
    <div className="ui-editor-inspector">
      <div className="ui-editor-inspector-header">
        {selectedWindow.className.replace(/^Window_/, '')}
      </div>
      <div className="ui-editor-inspector-body">

        {/* 위치 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">위치 / 크기</div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">X</div>
            <div className="ui-inspector-value">
              <NumInput value={x} onChange={(v) => set('x', v)} />
            </div>
          </div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">Y</div>
            <div className="ui-inspector-value">
              <NumInput value={y} onChange={(v) => set('y', v)} />
            </div>
          </div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">너비</div>
            <div className="ui-inspector-value">
              <NumInput value={width} min={32} onChange={(v) => set('width', v)} />
            </div>
          </div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">높이</div>
            <div className="ui-inspector-value">
              <NumInput value={height} min={32} onChange={(v) => set('height', v)} />
            </div>
          </div>
        </div>

        {/* 투명도 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">투명도</div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">창 투명도</div>
            <div className="ui-inspector-value">
              <NumInput value={opacity} min={0} max={255} onChange={(v) => set('opacity', v)} />
            </div>
          </div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">배경 투명도</div>
            <div className="ui-inspector-value">
              <NumInput value={backOpacity} min={0} max={255} onChange={(v) => set('backOpacity', v)} />
            </div>
          </div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">패딩</div>
            <div className="ui-inspector-value">
              <NumInput value={padding} min={0} max={64} onChange={(v) => set('padding', v)} />
            </div>
          </div>
        </div>

        {/* 폰트 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">폰트</div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">크기</div>
            <div className="ui-inspector-value">
              <NumInput value={fontSize} min={8} max={72} onChange={(v) => set('fontSize', v)} />
            </div>
          </div>
        </div>

        {/* 색조 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">색조 (R / G / B)</div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">R</div>
            <div className="ui-inspector-value">
              <div className="ui-inspector-tone-row">
                <span className="ui-inspector-tone-label">{colorTone[0]}</span>
                <input
                  type="range"
                  className="ui-inspector-tone-slider"
                  min={-255}
                  max={255}
                  value={colorTone[0]}
                  onChange={(e) => set('colorTone', [parseInt(e.target.value, 10), colorTone[1], colorTone[2]] as [number, number, number])}
                />
              </div>
            </div>
          </div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">G</div>
            <div className="ui-inspector-value">
              <div className="ui-inspector-tone-row">
                <span className="ui-inspector-tone-label">{colorTone[1]}</span>
                <input
                  type="range"
                  className="ui-inspector-tone-slider"
                  min={-255}
                  max={255}
                  value={colorTone[1]}
                  onChange={(e) => set('colorTone', [colorTone[0], parseInt(e.target.value, 10), colorTone[2]] as [number, number, number])}
                />
              </div>
            </div>
          </div>
          <div className="ui-inspector-row">
            <div className="ui-inspector-label">B</div>
            <div className="ui-inspector-value">
              <div className="ui-inspector-tone-row">
                <span className="ui-inspector-tone-label">{colorTone[2]}</span>
                <input
                  type="range"
                  className="ui-inspector-tone-slider"
                  min={-255}
                  max={255}
                  value={colorTone[2]}
                  onChange={(e) => set('colorTone', [colorTone[0], colorTone[1], parseInt(e.target.value, 10)] as [number, number, number])}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 리셋 */}
        {hasAnyOverride && (
          <div className="ui-inspector-row" style={{ marginTop: 8 }}>
            <div className="ui-inspector-label" />
            <div className="ui-inspector-value">
              <button
                className="ui-inspector-reset-btn"
                onClick={() => {
                  if (selectedWindow) resetUiEditorOverride(selectedWindow.className);
                  // 리셋: iframe에 씬 새로고침 요청
                  const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
                  iframe?.contentWindow?.postMessage({ type: 'refreshScene' }, '*');
                }}
              >
                기본값으로 리셋
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ui-inspector-footer">
        <button
          className="ui-inspector-save-btn"
          disabled={!uiEditorDirty}
          onClick={handleSave}
        >
          {uiEditorDirty ? '저장' : '저장됨'}
        </button>
      </div>
    </div>
  );
}
