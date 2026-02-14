import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../api/client';
import useEscClose from '../../hooks/useEscClose';
import './BattlebackPicker.css';

interface BattlebackPickerProps {
  value1: string;
  value2: string;
  onChange: (name1: string, name2: string) => void;
}

export default function BattlebackPicker({ value1, value2, onChange }: BattlebackPickerProps) {
  const [open, setOpen] = useState(false);
  useEscClose(useCallback(() => { if (open) setOpen(false); }, [open]));
  const [files1, setFiles1] = useState<string[]>([]);
  const [files2, setFiles2] = useState<string[]>([]);
  const [selected1, setSelected1] = useState(value1);
  const [selected2, setSelected2] = useState(value2);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected1(value1);
    setSelected2(value2);
    Promise.all([
      apiClient.get<string[]>('/resources/battlebacks1'),
      apiClient.get<string[]>('/resources/battlebacks2'),
    ]).then(([f1, f2]) => {
      setFiles1(f1);
      setFiles2(f2);
    }).catch(() => {
      setFiles1([]);
      setFiles2([]);
    });
  }, [open]);

  const names1 = [...new Set(files1.map(f => f.replace(/\.png$/i, '')))];
  const names2 = [...new Set(files2.map(f => f.replace(/\.png$/i, '')))];

  // Composite preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = 580;
    const h = 340;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const drawImg = (src: string) =>
      new Promise<HTMLImageElement>((resolve) => {
        if (!src) { resolve(null as any); return; }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null as any);
        img.src = src;
      });

    const url1 = selected1 ? `/api/resources/battlebacks1/${selected1}.png` : '';
    const url2 = selected2 ? `/api/resources/battlebacks2/${selected2}.png` : '';

    Promise.all([drawImg(url1), drawImg(url2)]).then(([img1, img2]) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      if (img1) {
        ctx.drawImage(img1, 0, 0, w, h);
      }
      if (img2) {
        ctx.drawImage(img2, 0, 0, w, h);
      }
    });
  }, [selected1, selected2, files1, files2]);

  const handleOk = () => {
    onChange(selected1, selected2);
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const displayText = (value1 || value2)
    ? `${value1 || '(없음)'} / ${value2 || '(없음)'}`
    : '(없음)';

  return (
    <div className="battleback-picker">
      <div className="audio-picker-preview" onClick={() => setOpen(true)}>
        <span>{displayText}</span>
      </div>
      {open && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}>
          <div className="battleback-picker-dialog">
            <div className="audio-picker-header">이미지 선택</div>
            <div className="battleback-picker-body">
              <div className="battleback-picker-lists">
                <div className="battleback-picker-list-col">
                  <div className="audio-picker-list" style={{ flex: 1 }}>
                    <div
                      className={`audio-picker-item${selected1 === '' ? ' selected' : ''}`}
                      onClick={() => setSelected1('')}
                    >
                      (없음)
                    </div>
                    {names1.map(name => (
                      <div
                        key={name}
                        className={`audio-picker-item${selected1 === name ? ' selected' : ''}`}
                        onClick={() => setSelected1(name)}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="battleback-picker-list-col">
                  <div className="audio-picker-list" style={{ flex: 1 }}>
                    <div
                      className={`audio-picker-item${selected2 === '' ? ' selected' : ''}`}
                      onClick={() => setSelected2('')}
                    >
                      (없음)
                    </div>
                    {names2.map(name => (
                      <div
                        key={name}
                        className={`audio-picker-item${selected2 === name ? ' selected' : ''}`}
                        onClick={() => setSelected2(name)}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="battleback-picker-preview">
                <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', imageRendering: 'pixelated' }} />
              </div>
            </div>
            <div className="audio-picker-footer">
              <button className="db-btn" onClick={handleOk}>OK</button>
              <button className="db-btn" onClick={handleCancel}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
