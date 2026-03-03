import React, { useState } from 'react';
import type { WidgetDef, WidgetType, ImageRenderMode } from '../../store/uiEditorTypes';
import { inputStyle, smallBtnStyle, rowStyle } from './UIEditorSceneStyles';
import useEditorStore from '../../store/useEditorStore';
import { FramePickerDialog, ImagePickerDialog } from './UIEditorPickerDialogs';

// ── WindowStyleSection — 모든 window-based 위젯 공통 창 스타일 UI ─────────────

export const WINDOW_BASED_TYPES: WidgetType[] = ['panel', 'button', 'list', 'textList', 'options'];

export function WindowStyleSection({ widget, update }: {
  widget: WidgetDef; update: (u: Partial<WidgetDef>) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  // button은 기본 off, 나머지(panel/list/options)는 기본 on
  const defaultWindowed = widget.type === 'button' ? false : true;
  const windowed = widget.windowed !== undefined ? widget.windowed : defaultWindowed;
  const windowStyle = widget.windowStyle ?? 'default';
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);

  const reloadPreview = async () => {
    await saveCustomScenes();
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
    iframe?.contentWindow?.postMessage({ type: 'loadScene', sceneName: uiEditorScene }, '*');
  };

  return (
    <div>
      <FramePickerDialog
        open={pickerOpen}
        current={widget.skinId ?? ''}
        onClose={() => setPickerOpen(false)}
        onSelect={(skinName, skinFile) => {
          update({ windowskinName: skinFile, skinId: skinName } as any);
          reloadPreview();
        }}
      />
      <ImagePickerDialog
        open={imagePickerOpen}
        current={widget.imageFile ?? ''}
        onClose={() => setImagePickerOpen(false)}
        onSelect={(filename) => { update({ imageFile: filename } as any); reloadPreview(); }}
      />
      <div style={rowStyle}>
        <label style={{ fontSize: 11, color: '#aaa' }}>
          <input type="checkbox" checked={windowed}
            onChange={(e) => {
              const v = e.target.checked;
              update({ windowed: v !== defaultWindowed ? v : undefined } as any);
              reloadPreview();
            }} /> 창 배경 표시
        </label>
      </div>
      {windowed && (
        <>
          <div className="ui-window-style-radios" style={{ margin: '4px 0' }}>
            {(['default', 'frame', 'image'] as const).map((style) => (
              <label key={style} className={`ui-radio-label${windowStyle === style ? ' active' : ''}`}>
                <input
                  type="radio"
                  name={`winstyle-${widget.id}`}
                  value={style}
                  checked={windowStyle === style}
                  onChange={() => { update({ windowStyle: style === 'default' ? undefined : style } as any); reloadPreview(); }}
                />
                {style === 'default' ? '기본' : style === 'frame' ? '프레임 변경' : '이미지로 변경'}
              </label>
            ))}
          </div>
          {windowStyle === 'frame' && (
            <div style={{ marginBottom: 4 }}>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: '#888', width: 70 }}>선택 프레임</span>
                <span style={{ fontSize: 11, color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {widget.skinId ?? widget.windowskinName ?? '(없음)'}
                </span>
              </div>
              <div style={rowStyle}>
                <button style={smallBtnStyle} onClick={() => setPickerOpen(true)}>프레임 선택…</button>
              </div>
            </div>
          )}
          {windowStyle === 'image' && (
            <div style={{ marginBottom: 4 }}>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: '#888', width: 70 }}>선택 파일</span>
                <span style={{ fontSize: 11, color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {widget.imageFile ?? '(없음)'}
                </span>
              </div>
              <div style={rowStyle}>
                <button style={smallBtnStyle} onClick={() => setImagePickerOpen(true)}>파일 선택…</button>
              </div>
              <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 2 }}>
                {([['center', '원본'], ['stretch', '늘림'], ['tile', '타일'], ['fit', '비율맞춤'], ['cover', '비율채움']] as [ImageRenderMode, string][]).map(([mode, label]) => {
                  const cur = widget.imageRenderMode ?? 'center';
                  return (
                    <label key={mode} className={`ui-radio-label${cur === mode ? ' active' : ''}`} style={{ fontSize: 10 }}>
                      <input type="radio" name={`winstyle-imgmode-${widget.id}`} value={mode} checked={cur === mode}
                        onChange={() => { update({ imageRenderMode: mode } as any); reloadPreview(); }} />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 70 }}>패딩</span>
            <input style={{ ...inputStyle, width: 60 }} type="number"
              value={widget.padding ?? ''}
              placeholder="기본"
              onChange={(e) => {
                const v = e.target.value.trim();
                update({ padding: v === '' ? undefined : (parseInt(v) || 0) } as any);
              }} />
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 70 }}>배경 불투명도</span>
            <input style={{ ...inputStyle, width: 60 }} type="number" min="0" max="255"
              value={widget.backOpacity ?? ''}
              placeholder="기본"
              onChange={(e) => {
                const v = e.target.value.trim();
                update({ backOpacity: v === '' ? undefined : (parseInt(v) || 0) } as any);
              }} />
            <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>0~255</span>
          </div>
        </>
      )}
    </div>
  );
}
