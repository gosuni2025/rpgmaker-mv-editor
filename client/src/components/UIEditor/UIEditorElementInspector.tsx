import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo, UIElementInfo } from '../../store/types';
import DragLabel from '../common/DragLabel';

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

export function ElementInspector({ selectedWindow, elem }: {
  selectedWindow: UIWindowInfo;
  elem: UIElementInfo;
}) {
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiFontList = useEditorStore((s) => s.uiFontList);
  const setUiElementOverride = useEditorStore((s) => s.setUiElementOverride);
  const setUiEditorSelectedElementType = useEditorStore((s) => s.setUiEditorSelectedElementType);

  const elemOv = uiEditorOverrides[selectedWindow.className]?.elements?.[elem.type] ?? {};
  const ex = elemOv.x ?? elem.x;
  const ey = elemOv.y ?? elem.y;
  const ew = elemOv.width ?? elem.width;
  const eh = elemOv.height ?? elem.height;

  const allFonts = [
    ...ALL_FONTS,
    ...uiFontList.map((f) => ({ family: f.family, label: `${f.family} (${f.file})` })),
  ];

  const setProp = useCallback((prop: string, value: unknown) => {
    setUiElementOverride(selectedWindow.className, elem.type, prop, value);
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({
      type: 'updateElementProp',
      windowId: selectedWindow.id,
      elemType: elem.type,
      prop,
      value,
    }, '*');
  }, [selectedWindow, elem.type, setUiElementOverride]);

  const set = useCallback((prop: 'x' | 'y' | 'width' | 'height', value: number) => {
    setProp(prop, value);
  }, [setProp]);

  return (
    <>
      <div className="ui-editor-inspector-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          className="ui-inspector-back-btn"
          onClick={() => setUiEditorSelectedElementType(null)}
          title="창 인스펙터로 돌아가기"
        >←</button>
        <span>{elem.label}</span>
        <span style={{ fontSize: 10, color: '#777', marginLeft: 2 }}>
          ({selectedWindow.className.replace(/^Window_/, '')})
        </span>
      </div>
      <div className="ui-editor-inspector-body">
        {/* 위치/크기: supportsPosition이 false인 제네릭 요소는 숨김 */}
        {elem.supportsPosition !== false && (
          <>
            <div className="ui-inspector-section">
              <div className="ui-inspector-section-title">위치 / 크기</div>
              <div className="ui-inspector-row">
                <DragLabel label="X" value={ex} onChange={(v) => set('x', Math.round(v))} />
              </div>
              {!elem.isPerActor && (
                <div className="ui-inspector-row">
                  <DragLabel label="Y" value={ey} onChange={(v) => set('y', Math.round(v))} />
                </div>
              )}
              {elem.type !== 'actorLevel' && (
                <div className="ui-inspector-row">
                  <DragLabel label="너비" value={ew} min={8} onChange={(v) => set('width', Math.round(v))} />
                </div>
              )}
              {elem.type === 'actorFace' && (
                <div className="ui-inspector-row">
                  <DragLabel label="높이" value={eh} min={8} onChange={(v) => set('height', Math.round(v))} />
                </div>
              )}
            </div>
            {elem.isPerActor && (
              <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777' }}>
                perActor 레이아웃: X/너비만 편집 가능 (Y는 행 순서에 따라 자동)
              </div>
            )}
          </>
        )}

        {elem.supportsPosition === false && (
          <div style={{ padding: '6px 12px 2px', fontSize: 11, color: '#777' }}>
            제네릭 요소: 폰트만 설정 가능
          </div>
        )}

        {/* 폰트 */}
        {elem.type !== 'actorFace' && elem.type !== 'actorIcons' && (
          <div className="ui-inspector-section">
            <div className="ui-inspector-section-title">폰트</div>
            <div className="ui-font-tag-grid" style={{ padding: '4px 12px 6px' }}>
              {allFonts.map((f) => (
                <label key={f.family} className={`ui-radio-label${(elemOv.fontFace ?? '') === f.family ? ' active' : ''}`}>
                  <input
                    type="radio"
                    name={`elem-font-${selectedWindow.id}-${elem.type}`}
                    checked={(elemOv.fontFace ?? '') === f.family}
                    onChange={() => setProp('fontFace', f.family || undefined)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
