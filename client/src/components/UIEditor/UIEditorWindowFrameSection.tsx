import React, { useState } from 'react';
import apiClient from '../../api/client';
import type { UIWindowInfo, UIWindowOverride, ImageRenderMode } from '../../store/types';
import DragLabel from '../common/DragLabel';
import HelpButton from '../common/HelpButton';
import { FramePickerDialog, ImagePickerDialog } from './UIEditorPickerDialogs';

export function WindowFrameSection({ selectedWindow, override, windowStyle, set, setMeta, pu, colorTone }: {
  selectedWindow: UIWindowInfo;
  override: UIWindowOverride | null;
  windowStyle: 'default' | 'frame' | 'image';
  set: (prop: keyof Omit<UIWindowOverride, 'className' | 'elements'>, value: unknown) => void;
  setMeta: (prop: keyof Omit<UIWindowOverride, 'className' | 'elements'>, value: unknown) => void;
  pu: () => void;
  colorTone: [number, number, number];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [placeholderBusy, setPlaceholderBusy] = useState(false);

  const handleStyleChange = (style: 'default' | 'frame' | 'image') => {
    const newStyle = style === 'default' ? undefined : style;
    setMeta('windowStyle', newStyle);
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    const iw = iframe?.contentWindow;
    iw?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop: 'windowStyle', value: newStyle }, '*');
    if (style === 'default') {
      iw?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop: 'windowskinName', value: selectedWindow.windowskinName }, '*');
    } else if (style === 'frame' && override?.windowskinName) {
      iw?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop: 'windowskinName', value: override.windowskinName }, '*');
    } else if (style === 'image' && override?.imageFile) {
      iw?.postMessage({ type: 'updateWindowProp', windowId: selectedWindow.id, prop: 'imageFile', value: override.imageFile }, '*');
    }
  };

  const handleFrameSelect = (skinName: string, skinFile: string) => {
    set('windowskinName', skinFile);
    setMeta('skinId', skinName);
  };

  const handleCreatePlaceholder = async () => {
    setPlaceholderBusy(true);
    try {
      const d = await apiClient.post<{ filename?: string }>('/ui-editor/images/create-placeholder', {
        className: selectedWindow.className,
        width: override?.width ?? selectedWindow.width,
        height: override?.height ?? selectedWindow.height,
      });
      if (d.filename) set('imageFile', d.filename);
    } catch {}
    setPlaceholderBusy(false);
  };

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
        onSelect={(filename) => set('imageFile', filename)}
      />

      {/* 창 프레임 스타일 */}
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

      {/* 프레임 변경 설정 */}
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
            <button className="ui-frame-pick-btn" onClick={() => setPickerOpen(true)}>프레임 선택…</button>
          </div>
          <div className="ui-inspector-section-title" style={{ marginTop: 6 }}>색조 (R / G / B)</div>
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

      {/* 이미지로 변경 */}
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
            <button className="ui-frame-pick-btn" style={{ flex: 1 }}
              onClick={() => apiClient.post('/ui-editor/images/open-folder', {}).catch(() => {})}
              title="img/system 폴더 열기">
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
    </>
  );
}
