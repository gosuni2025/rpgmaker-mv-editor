import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import { EnhancedTextEditor } from './EnhancedTextEditor';
import { MessagePreview } from './MessagePreview';
import { buildTextExtra } from './messageEditorUtils';

export function ShowTextEditorDialog({ p, onOk, onCancel, existingLines }: {
  p: unknown[]; onOk: (params: unknown[], extra?: EventCommand[]) => void; onCancel: () => void; existingLines?: string[];
}) {
  const [faceName, setFaceName] = useState<string>((p[0] as string) || '');
  const [faceIndex, setFaceIndex] = useState<number>((p[1] as number) || 0);
  const [background, setBackground] = useState<number>((p[2] as number) || 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) || 2);
  const [text, setText] = useState(existingLines?.join('\n') || '');
  const [bulkInput, setBulkInput] = useState(false);

  const [previewWidth, setPreviewWidth] = useState(() => {
    const saved = localStorage.getItem('showtext-preview-width');
    return saved ? Math.max(180, Math.min(900, parseInt(saved, 10))) : 380;
  });
  const splitDragging = useRef(false);
  const splitStartX = useRef(0);
  const splitStartW = useRef(previewWidth);

  const onSplitDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    splitDragging.current = true;
    splitStartX.current = e.clientX;
    splitStartW.current = previewWidth;
  }, [previewWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!splitDragging.current) return;
      const delta = splitStartX.current - e.clientX;
      const w = Math.max(180, Math.min(900, splitStartW.current + delta));
      setPreviewWidth(w);
      localStorage.setItem('showtext-preview-width', String(w));
    };
    const onUp = () => { splitDragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  const handleOk = () => {
    const params = [faceName, faceIndex, background, positionType];
    const extra = buildTextExtra(text, bulkInput, 401, params);
    onOk(params, extra);
  };

  const radioRowStyle: React.CSSProperties = { display: 'flex', gap: 12, marginTop: 4 };
  const radioLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#ddd', fontSize: 12 };

  return (
    <div className="modal-overlay">
      <div className="show-text-fullscreen-dialog">
        <div className="image-picker-header">텍스트 표시</div>
        <div className="show-text-body">
          <div className="show-text-settings">
            <div style={{ fontSize: 12, color: '#aaa' }}>
              얼굴
              <ImagePicker type="faces" value={faceName} onChange={setFaceName} index={faceIndex} onIndexChange={setFaceIndex} />
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
              배경
              <div style={radioRowStyle}>
                {([{ value: 0, label: '창' }, { value: 1, label: '어둡게' }, { value: 2, label: '투명' }] as const).map(opt => (
                  <label key={opt.value} style={radioLabelStyle}>
                    <input type="radio" name="showtext-background" value={opt.value} checked={background === opt.value} onChange={() => setBackground(opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
              창의 위치
              <div style={radioRowStyle}>
                {([{ value: 0, label: '위' }, { value: 1, label: '가운데' }, { value: 2, label: '아래' }] as const).map(opt => (
                  <label key={opt.value} style={radioLabelStyle}>
                    <input type="radio" name="showtext-position" value={opt.value} checked={positionType === opt.value} onChange={() => setPositionType(opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <input type="checkbox" checked={bulkInput} onChange={e => setBulkInput(e.target.checked)} />
              일괄 입력 <span style={{ color: '#666', fontSize: 11 }}>(4줄마다 자동 분할)</span>
            </label>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <label style={{ fontSize: 12, color: '#aaa', flex: 1, display: 'flex', flexDirection: 'column' }}>
                텍스트:
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <EnhancedTextEditor value={text} onChange={setText} rows={Math.max(4, text.split('\n').length)} placeholder="텍스트를 입력하세요..." />
                </div>
              </label>
            </div>
          </div>
          <div className="show-text-split-handle" onMouseDown={onSplitDown} title="드래그하여 미리보기 크기 조절" />
          <div className="show-text-preview-panel" style={{ width: previewWidth }}>
            <div className="show-text-preview-header">
              미리보기
              <span style={{ fontSize: 11, color: '#555', marginLeft: 8 }}>816×624</span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#111', borderRadius: 4, padding: 6 }}>
              <MessagePreview faceName={faceName} faceIndex={faceIndex} background={background} positionType={positionType} text={text} />
            </div>
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>
  );
}
