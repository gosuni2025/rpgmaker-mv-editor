import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo, UIWindowOverride } from '../../store/types';
import DragLabel from '../common/DragLabel';
import './UIEditor.css';

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

        {/* 위치 / 크기 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">위치 / 크기</div>
          <div className="ui-inspector-row">
            <DragLabel label="X" value={x} onChange={(v) => set('x', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="Y" value={y} onChange={(v) => set('y', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="너비" value={width} min={32} onChange={(v) => set('width', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="높이" value={height} min={32} onChange={(v) => set('height', Math.round(v))} />
          </div>
        </div>

        {/* 투명도 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">투명도</div>
          <div className="ui-inspector-row">
            <DragLabel label="창 투명도" value={opacity} min={0} max={255} onChange={(v) => set('opacity', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="배경 투명도" value={backOpacity} min={0} max={255} onChange={(v) => set('backOpacity', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="패딩" value={padding} min={0} max={64} onChange={(v) => set('padding', Math.round(v))} />
          </div>
        </div>

        {/* 폰트 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">폰트</div>
          <div className="ui-inspector-row">
            <DragLabel label="크기" value={fontSize} min={8} max={72} onChange={(v) => set('fontSize', Math.round(v))} />
          </div>
        </div>

        {/* 색조 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">색조 (R / G / B)</div>
          <div className="ui-inspector-row">
            <DragLabel
              label="R"
              value={colorTone[0]}
              min={-255}
              max={255}
              onChange={(v) => set('colorTone', [Math.round(v), colorTone[1], colorTone[2]] as [number, number, number])}
            />
          </div>
          <div className="ui-inspector-row">
            <DragLabel
              label="G"
              value={colorTone[1]}
              min={-255}
              max={255}
              onChange={(v) => set('colorTone', [colorTone[0], Math.round(v), colorTone[2]] as [number, number, number])}
            />
          </div>
          <div className="ui-inspector-row">
            <DragLabel
              label="B"
              value={colorTone[2]}
              min={-255}
              max={255}
              onChange={(v) => set('colorTone', [colorTone[0], colorTone[1], Math.round(v)] as [number, number, number])}
            />
          </div>
        </div>

        {/* 리셋 */}
        {hasAnyOverride && (
          <div className="ui-inspector-row" style={{ marginTop: 8 }}>
            <button
              className="ui-inspector-reset-btn"
              onClick={() => {
                if (selectedWindow) resetUiEditorOverride(selectedWindow.className);
                const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
                iframe?.contentWindow?.postMessage({ type: 'refreshScene' }, '*');
              }}
            >
              기본값으로 리셋
            </button>
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
