import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo, UIWindowOverride } from '../../store/types';
import DragLabel from '../common/DragLabel';
import { AnimEffectSection, PivotAnchorSelector } from './UIEditorAnimEffectSection';
import { WindowFrameSection } from './UIEditorWindowFrameSection';
import './UIEditor.css';

const ALL_FONTS = [
  { family: '', label: '(미설정)' },
  { family: 'GameFont', label: 'GameFont' },
  { family: 'sans-serif', label: 'sans-serif' },
  { family: 'serif', label: 'serif' },
  { family: 'monospace', label: 'monospace' },
  { family: 'Dotum, AppleGothic, sans-serif', label: 'Dotum' },
  { family: 'Arial, sans-serif', label: 'Arial' },
  { family: 'Georgia, serif', label: 'Georgia' },
];

export function WindowInspector({ selectedWindow, override }: {
  selectedWindow: UIWindowInfo;
  override: UIWindowOverride | null;
}) {
  const setUiEditorOverride = useEditorStore((s) => s.setUiEditorOverride);
  const uiFontList = useEditorStore((s) => s.uiFontList);
  const pushUiOverrideUndo = useEditorStore((s) => s.pushUiOverrideUndo);
  const pu = useCallback(() => pushUiOverrideUndo(), [pushUiOverrideUndo]);

  const getProp = useCallback(<K extends keyof UIWindowInfo>(
    key: K, win: UIWindowInfo, ov: UIWindowOverride | null,
  ): UIWindowInfo[K] => {
    if (ov && key in ov && key !== 'className') {
      return (ov as unknown as Record<string, unknown>)[key] as UIWindowInfo[K];
    }
    return win[key];
  }, []);

  const set = useCallback((prop: keyof Omit<UIWindowOverride, 'className' | 'elements'>, value: unknown) => {
    setUiEditorOverride(selectedWindow.className, prop, value);
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop, value }, '*');
  }, [selectedWindow, setUiEditorOverride]);

  const setMeta = useCallback((prop: keyof Omit<UIWindowOverride, 'className' | 'elements'>, value: unknown) => {
    setUiEditorOverride(selectedWindow.className, prop, value);
  }, [selectedWindow, setUiEditorOverride]);

  const windowStyle = override?.windowStyle ?? 'default';

  const x = getProp('x', selectedWindow, override);
  const y = getProp('y', selectedWindow, override);
  const width = getProp('width', selectedWindow, override);
  const height = getProp('height', selectedWindow, override);
  const opacity = getProp('opacity', selectedWindow, override);
  const backOpacity = getProp('backOpacity', selectedWindow, override);
  const padding = getProp('padding', selectedWindow, override);
  const fontSize = getProp('fontSize', selectedWindow, override);
  const colorTone = getProp('colorTone', selectedWindow, override);

  const allFonts = [
    ...ALL_FONTS,
    ...uiFontList.map((f) => ({ family: f.family, label: `${f.family} (${f.file})` })),
  ];
  const currentFontFace = override?.fontFace ?? '';

  return (
    <>
      <div className="ui-editor-inspector-header">
        {selectedWindow.className.replace(/^Window_/, '')}
      </div>
      <div className="ui-editor-inspector-body">

        <WindowFrameSection
          selectedWindow={selectedWindow}
          override={override}
          windowStyle={windowStyle}
          set={set}
          setMeta={setMeta}
          pu={pu}
          colorTone={colorTone}
        />

        {/* 위치 / 크기 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">위치 / 크기</div>
          <div className="ui-inspector-row">
            <DragLabel label="X" value={x} onDragStart={pu} onChange={(v) => set('x', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="Y" value={y} onDragStart={pu} onChange={(v) => set('y', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="너비" value={width} min={32} onDragStart={pu} onChange={(v) => set('width', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="높이" value={height} min={32} onDragStart={pu} onChange={(v) => set('height', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="회전 X" value={override?.rotationX ?? 0} min={-180} max={180}
              onDragStart={pu} onChange={(v) => set('rotationX', Math.round(v * 10) / 10)} />
            <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>°</span>
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="회전 Y" value={override?.rotationY ?? 0} min={-180} max={180}
              onDragStart={pu} onChange={(v) => set('rotationY', Math.round(v * 10) / 10)} />
            <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>°</span>
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="회전 Z" value={override?.rotationZ ?? 0} min={-180} max={180}
              onDragStart={pu} onChange={(v) => set('rotationZ', Math.round(v * 10) / 10)} />
            <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>°</span>
          </div>
          <div className="ui-inspector-row" style={{ gap: 4 }}>
            {[
              { label: '가로 중앙', getPos: (sw: number) => ({ x: Math.round((sw - width) / 2) }) },
              { label: '세로 중앙', getPos: (_: number, sh: number) => ({ y: Math.round((sh - height) / 2) }) },
              { label: '정중앙',   getPos: (sw: number, sh: number) => ({ x: Math.round((sw - width) / 2), y: Math.round((sh - height) / 2) }) },
            ].map(({ label: btnLabel, getPos }) => (
              <button key={btnLabel}
                className="ui-canvas-toolbar-btn"
                style={{ flex: 1, fontSize: 11 }}
                onClick={() => {
                  const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
                  const g = (iframe?.contentWindow as unknown as { Graphics?: { width?: number; height?: number } } | null)?.Graphics;
                  const pos = getPos(g?.width ?? 816, g?.height ?? 624);
                  if ('x' in pos) set('x', pos.x!);
                  if ('y' in pos) set('y', pos.y!);
                }}
              >{btnLabel}</button>
            ))}
          </div>
        </div>

        {/* 투명도 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">투명도</div>
          <div className="ui-inspector-row">
            <DragLabel label="창 투명도" value={opacity} min={0} max={255} onDragStart={pu} onChange={(v) => set('opacity', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="배경 투명도" value={backOpacity} min={0} max={255} onDragStart={pu} onChange={(v) => set('backOpacity', Math.round(v))} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="패딩" value={padding} min={0} max={64} onDragStart={pu} onChange={(v) => set('padding', Math.round(v))} />
          </div>
        </div>

        {/* 폰트 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">폰트</div>
          <div className="ui-inspector-row">
            <DragLabel label="크기" value={fontSize} min={8} max={72} onDragStart={pu} onChange={(v) => set('fontSize', Math.round(v))} />
          </div>
          <div className="ui-font-tag-grid" style={{ padding: '4px 12px 6px' }}>
            {allFonts.map((f) => (
              <label key={f.family} className={`ui-radio-label${currentFontFace === f.family ? ' active' : ''}`}>
                <input
                  type="radio"
                  name={`win-font-${selectedWindow.id}`}
                  checked={currentFontFace === f.family}
                  onChange={() => set('fontFace', f.family || undefined)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        {/* 색조 */}
        {windowStyle !== 'frame' && (
          <div className="ui-inspector-section">
            <div className="ui-inspector-section-title">색조 (R / G / B)</div>
            <div className="ui-inspector-row">
              <DragLabel label="R" value={colorTone[0]} min={-255} max={255}
                onDragStart={pu} onChange={(v) => set('colorTone', [Math.round(v), colorTone[1], colorTone[2]] as [number, number, number])} />
            </div>
            <div className="ui-inspector-row">
              <DragLabel label="G" value={colorTone[1]} min={-255} max={255}
                onDragStart={pu} onChange={(v) => set('colorTone', [colorTone[0], Math.round(v), colorTone[2]] as [number, number, number])} />
            </div>
            <div className="ui-inspector-row">
              <DragLabel label="B" value={colorTone[2]} min={-255} max={255}
                onDragStart={pu} onChange={(v) => set('colorTone', [colorTone[0], colorTone[1], Math.round(v)] as [number, number, number])} />
            </div>
          </div>
        )}

        {/* 3D 렌더 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">3D 렌더</div>
          <div className="ui-inspector-row">
            <span className="ui-inspector-label">카메라</span>
            <select
              value={override?.renderCamera ?? 'auto'}
              onChange={(e) => {
                const val = e.target.value as 'auto' | 'orthographic' | 'perspective';
                const camVal = val === 'auto' ? undefined : val;
                setMeta('renderCamera', camVal);
                const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
                const iw = iframe?.contentWindow;
                iw?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop: 'renderCamera', value: camVal }, '*');
                iw?.postMessage({ type: 'updateRuntimeOverride', className: selectedWindow.className, prop: 'renderCamera', value: camVal }, '*');
              }}
              style={{ fontSize: 11, background: '#333', color: '#ddd', border: '1px solid #555', padding: '2px 4px', borderRadius: 3 }}
            >
              <option value="auto">자동 (회전 시 퍼스펙티브)</option>
              <option value="orthographic">오소그래픽 (강제)</option>
              <option value="perspective">퍼스펙티브 (강제)</option>
            </select>
          </div>
        </div>

        {/* 회전 기준점 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">회전 기준점</div>
          <div className="ui-inspector-row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <span className="ui-inspector-label" style={{ paddingTop: 2 }}>앵커</span>
            <PivotAnchorSelector
              value={override?.animPivot ?? 'center'}
              onChange={(v) => set('animPivot', v)}
            />
          </div>
        </div>

        <AnimEffectSection
          label="등장 효과"
          value={override?.entrances ?? []}
          onChange={(v) => setMeta('entrances', v)}
          onUndoPush={pu}
        />
        <AnimEffectSection
          label="퇴장 효과"
          isExit
          value={override?.exits ?? []}
          onChange={(v) => setMeta('exits', v)}
          onUndoPush={pu}
          entranceValue={override?.entrances ?? []}
        />

      </div>
    </>
  );
}
