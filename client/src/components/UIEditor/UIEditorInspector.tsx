import React, { useCallback, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo, UIWindowOverride, UIElementInfo, ImageRenderMode } from '../../store/types';
import DragLabel from '../common/DragLabel';
import HelpButton from '../common/HelpButton';
import './UIEditor.css';

// ── 프레임 선택 팝업 ──────────────────────────────────────────────────────────

interface SkinEntryBasic { name: string; label?: string; file?: string; cornerSize: number; }

function FramePickerDialog({ open, current, onClose, onSelect }: {
  open: boolean;
  current: string;
  onClose: () => void;
  onSelect: (skinName: string, skinFile: string) => void;
}) {
  const [skins, setSkins] = useState<SkinEntryBasic[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/ui-editor/skins')
      .then((r) => r.json())
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

function ImagePickerDialog({ open, current, onClose, onSelect }: {
  open: boolean;
  current: string;
  onClose: () => void;
  onSelect: (filename: string) => void;
}) {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/ui-editor/images/list')
      .then((r) => r.json())
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

// ── 창 인스펙터 ───────────────────────────────────────────────────────────────

function WindowInspector({ selectedWindow, override }: {
  selectedWindow: UIWindowInfo;
  override: UIWindowOverride | null;
}) {
  const projectPath = useEditorStore((s) => s.projectPath);
  const setUiEditorOverride = useEditorStore((s) => s.setUiEditorOverride);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [placeholderBusy, setPlaceholderBusy] = useState(false);

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

  // 프레임 스타일 메타 (iframe 업데이트 불필요)
  const setMeta = useCallback((prop: keyof Omit<UIWindowOverride, 'className' | 'elements'>, value: unknown) => {
    setUiEditorOverride(selectedWindow.className, prop, value);
  }, [selectedWindow, setUiEditorOverride]);

  const windowStyle = override?.windowStyle ?? 'default';

  const handleStyleChange = (style: 'default' | 'frame' | 'image') => {
    const newStyle = style === 'default' ? undefined : style;
    setMeta('windowStyle', newStyle);

    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    const iw = iframe?.contentWindow;

    // windowStyle 변경을 iframe에 전달 → UITheme._ov 업데이트 + _refreshAllParts
    iw?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop: 'windowStyle', value: newStyle }, '*');

    if (style === 'default') {
      // 원본 windowskin 복원
      iw?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop: 'windowskinName', value: selectedWindow.windowskinName }, '*');
    } else if (style === 'frame' && override?.windowskinName) {
      // frame 모드: 스킨 파일 복원
      iw?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop: 'windowskinName', value: override.windowskinName }, '*');
    } else if (style === 'image' && override?.imageFile) {
      // image 모드: 이미지 파일 복원 (frame의 windowskinName과 분리된 필드)
      iw?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop: 'imageFile', value: override.imageFile }, '*');
    }
  };

  const handleFrameSelect = (skinName: string, skinFile: string) => {
    set('windowskinName', skinFile);
    setMeta('skinId', skinName);
  };

  const handleImageSelect = (filename: string) => {
    set('imageFile', filename);
  };

  const handleCreatePlaceholder = async () => {
    setPlaceholderBusy(true);
    try {
      const res = await fetch('/api/ui-editor/images/create-placeholder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: selectedWindow.className,
          width: override?.width ?? selectedWindow.width,
          height: override?.height ?? selectedWindow.height,
        }),
      });
      const d = await res.json();
      if (d.filename) {
        set('imageFile', d.filename);
      }
    } catch {}
    setPlaceholderBusy(false);
  };

  const handleOpenFolder = () => {
    fetch('/api/ui-editor/images/open-folder', { method: 'POST' }).catch(() => {});
  };

  const x = getProp('x', selectedWindow, override);
  const y = getProp('y', selectedWindow, override);
  const width = getProp('width', selectedWindow, override);
  const height = getProp('height', selectedWindow, override);
  const opacity = getProp('opacity', selectedWindow, override);
  const backOpacity = getProp('backOpacity', selectedWindow, override);
  const padding = getProp('padding', selectedWindow, override);
  const fontSize = getProp('fontSize', selectedWindow, override);
  const colorTone = getProp('colorTone', selectedWindow, override);

  return (
    <>
      <FramePickerDialog
        open={pickerOpen}
        current={override?.skinId ?? ''}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFrameSelect}
      />
      <ImagePickerDialog
        open={imagePickerOpen}
        current={override?.imageFile ?? ''}
        onClose={() => setImagePickerOpen(false)}
        onSelect={handleImageSelect}
      />

      <div className="ui-editor-inspector-header">
        {selectedWindow.className.replace(/^Window_/, '')}
      </div>
      <div className="ui-editor-inspector-body">

        {/* ── 창 프레임 스타일 ── */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">창 프레임 스타일</div>
          <div className="ui-window-style-radios">
            {(['default', 'frame', 'image'] as const).map((style) => (
              <label key={style} className={`ui-radio-label${windowStyle === style ? ' active' : ''}`}>
                <input
                  type="radio"
                  name={`win-style-${selectedWindow.id}`}
                  value={style}
                  checked={windowStyle === style}
                  onChange={() => handleStyleChange(style)}
                />
                {style === 'default' ? '기본' : style === 'frame' ? '프레임 변경' : '이미지로 변경'}
              </label>
            ))}
          </div>
        </div>

        {/* ── 프레임 변경 설정 ── */}
        {windowStyle === 'frame' && (
          <div className="ui-inspector-section">
            <div className="ui-inspector-section-title">프레임 설정</div>
            <div className="ui-inspector-row">
              <span className="ui-inspector-label">선택된 프레임</span>
              <span className="ui-frame-selected-name">
                {override?.skinId ?? override?.windowskinName ?? selectedWindow.windowskinName ?? '(없음)'}
              </span>
            </div>
            <div className="ui-inspector-row">
              <button className="ui-frame-pick-btn" onClick={() => setPickerOpen(true)}>
                프레임 선택…
              </button>
            </div>
            <div className="ui-inspector-section-title" style={{ marginTop: 6 }}>색조 (R / G / B)</div>
            <div className="ui-inspector-row">
              <DragLabel label="R" value={colorTone[0]} min={-255} max={255}
                onChange={(v) => set('colorTone', [Math.round(v), colorTone[1], colorTone[2]] as [number, number, number])} />
            </div>
            <div className="ui-inspector-row">
              <DragLabel label="G" value={colorTone[1]} min={-255} max={255}
                onChange={(v) => set('colorTone', [colorTone[0], Math.round(v), colorTone[2]] as [number, number, number])} />
            </div>
            <div className="ui-inspector-row">
              <DragLabel label="B" value={colorTone[2]} min={-255} max={255}
                onChange={(v) => set('colorTone', [colorTone[0], colorTone[1], Math.round(v)] as [number, number, number])} />
            </div>
          </div>
        )}

        {/* ── 이미지로 변경 ── */}
        {windowStyle === 'image' && (
          <div className="ui-inspector-section">
            <div className="ui-inspector-section-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              이미지 설정
              <HelpButton>
                <strong>이미지로 변경</strong> 모드는 선택한 PNG 이미지를 창 배경으로 표시합니다.<br /><br />
                <strong>플레이스홀더 생성</strong>을 누르면 현재 창 크기에 맞는 가이드 이미지가<br />
                img/system/ 폴더에 자동 생성됩니다. 이 파일을 열어 직접 디자인하세요.<br /><br />
                <strong>렌더링 방식:</strong><br />
                • <strong>원본 크기</strong> — 이미지를 원본 픽셀 크기로 중앙에 배치. 창보다 크면 가장자리가 잘립니다.<br />
                • <strong>늘림</strong> — 이미지를 창 전체 크기로 강제 늘립니다. 비율이 달라질 수 있습니다.<br />
                • <strong>타일 반복</strong> — 작은 패턴 이미지를 타일처럼 반복 배치합니다.<br />
                • <strong>비율 맞춤</strong> — 가로세로 비율을 유지하며 창 안에 맞춥니다. 빈 가장자리가 생길 수 있습니다.<br />
                • <strong>비율 채움</strong> — 가로세로 비율을 유지하며 창을 꽉 채웁니다. 이미지 가장자리가 잘릴 수 있습니다.
              </HelpButton>
            </div>
            <div className="ui-inspector-row">
              <span className="ui-inspector-label">선택된 파일</span>
              <span className="ui-frame-selected-name" title={override?.imageFile ?? ''}>
                {override?.imageFile ?? '(없음)'}
              </span>
            </div>
            <div className="ui-inspector-row" style={{ gap: 4 }}>
              <button className="ui-frame-pick-btn" style={{ flex: 1 }} onClick={() => setImagePickerOpen(true)}>
                파일 선택…
              </button>
              <button className="ui-frame-pick-btn" style={{ flex: 1 }} onClick={handleOpenFolder} title="img/system 폴더 열기">
                폴더 열기
              </button>
            </div>
            <div className="ui-inspector-row">
              <button
                className="ui-frame-pick-btn"
                style={{ width: '100%', opacity: placeholderBusy ? 0.6 : 1 }}
                disabled={placeholderBusy}
                onClick={handleCreatePlaceholder}
                title="현재 창 크기로 플레이스홀더 PNG를 img/system에 생성합니다"
              >
                {placeholderBusy ? '생성 중…' : '플레이스홀더 생성'}
              </button>
            </div>
            <div className="ui-inspector-section-title" style={{ marginTop: 6 }}>렌더링 방식</div>
            <div className="ui-window-style-radios" style={{ flexDirection: 'column', gap: 2 }}>
              {([
                ['center',  '원본 크기'],
                ['stretch', '늘림'],
                ['tile',    '타일 반복'],
                ['fit',     '비율 맞춤'],
                ['cover',   '비율 채움'],
              ] as [ImageRenderMode, string][]).map(([mode, label]) => {
                const current = override?.imageRenderMode ?? 'center';
                return (
                  <label key={mode} className={`ui-radio-label${current === mode ? ' active' : ''}`}>
                    <input
                      type="radio"
                      name={`img-render-${selectedWindow.id}`}
                      value={mode}
                      checked={current === mode}
                      onChange={() => set('imageRenderMode', mode)}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        )}

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
          <div className="ui-inspector-row" style={{ gap: 4 }}>
            <button
              className="ui-canvas-toolbar-btn"
              style={{ flex: 1, fontSize: 11 }}
              title="화면 가로 중앙"
              onClick={() => {
                const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
                const g = (iframe?.contentWindow as unknown as { Graphics?: { width?: number } } | null)?.Graphics;
                const sw = g?.width ?? 816;
                set('x', Math.round((sw - width) / 2));
              }}
            >
              가로 중앙
            </button>
            <button
              className="ui-canvas-toolbar-btn"
              style={{ flex: 1, fontSize: 11 }}
              title="화면 세로 중앙"
              onClick={() => {
                const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
                const g = (iframe?.contentWindow as unknown as { Graphics?: { height?: number } } | null)?.Graphics;
                const sh = g?.height ?? 624;
                set('y', Math.round((sh - height) / 2));
              }}
            >
              세로 중앙
            </button>
            <button
              className="ui-canvas-toolbar-btn"
              style={{ flex: 1, fontSize: 11 }}
              title="화면 정중앙"
              onClick={() => {
                const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
                const g = (iframe?.contentWindow as unknown as { Graphics?: { width?: number; height?: number } } | null)?.Graphics;
                const sw = g?.width ?? 816;
                const sh = g?.height ?? 624;
                set('x', Math.round((sw - width) / 2));
                set('y', Math.round((sh - height) / 2));
              }}
            >
              정중앙
            </button>
          </div>
        </div>

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

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">폰트</div>
          <div className="ui-inspector-row">
            <DragLabel label="크기" value={fontSize} min={8} max={72} onChange={(v) => set('fontSize', Math.round(v))} />
          </div>
        </div>

        {windowStyle !== 'frame' && (
          <div className="ui-inspector-section">
            <div className="ui-inspector-section-title">색조 (R / G / B)</div>
            <div className="ui-inspector-row">
              <DragLabel label="R" value={colorTone[0]} min={-255} max={255}
                onChange={(v) => set('colorTone', [Math.round(v), colorTone[1], colorTone[2]] as [number, number, number])} />
            </div>
            <div className="ui-inspector-row">
              <DragLabel label="G" value={colorTone[1]} min={-255} max={255}
                onChange={(v) => set('colorTone', [colorTone[0], Math.round(v), colorTone[2]] as [number, number, number])} />
            </div>
            <div className="ui-inspector-row">
              <DragLabel label="B" value={colorTone[2]} min={-255} max={255}
                onChange={(v) => set('colorTone', [colorTone[0], colorTone[1], Math.round(v)] as [number, number, number])} />
            </div>
          </div>
        )}

      </div>

    </>
  );
}

// ── 요소 인스펙터 ─────────────────────────────────────────────────────────────

function ElementInspector({ selectedWindow, elem }: {
  selectedWindow: UIWindowInfo;
  elem: UIElementInfo;
}) {
  const projectPath = useEditorStore((s) => s.projectPath);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const setUiElementOverride = useEditorStore((s) => s.setUiElementOverride);
  const setUiEditorSelectedElementType = useEditorStore((s) => s.setUiEditorSelectedElementType);

  const elemOv = uiEditorOverrides[selectedWindow.className]?.elements?.[elem.type] ?? {};
  const ex = elemOv.x ?? elem.x;
  const ey = elemOv.y ?? elem.y;
  const ew = elemOv.width ?? elem.width;
  const eh = elemOv.height ?? elem.height;

  const set = useCallback((prop: 'x' | 'y' | 'width' | 'height', value: number) => {
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

      </div>

    </>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function UIEditorInspector() {
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorSelectedElementType = useEditorStore((s) => s.uiEditorSelectedElementType);

  const selectedWindow = uiEditorWindows.find((w) => w.id === uiEditorSelectedWindowId) ?? null;
  const override = selectedWindow ? (uiEditorOverrides[selectedWindow.className] ?? null) : null;
  const selectedElement = selectedWindow?.elements?.find((e) => e.type === uiEditorSelectedElementType) ?? null;

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

  return (
    <div className="ui-editor-inspector">
      {selectedElement ? (
        <ElementInspector selectedWindow={selectedWindow} elem={selectedElement} />
      ) : (
        <WindowInspector selectedWindow={selectedWindow} override={override} />
      )}
    </div>
  );
}
