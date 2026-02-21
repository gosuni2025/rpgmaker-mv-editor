import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { selectStyle } from './messageEditors';
import '../common/BattlebackPicker.css';

/**
 * 전투 배경 변경 에디터 (코드 283)
 * params: [battleback1Name, battleback2Name]
 */
export function ChangeBattleBackEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [name1, setName1] = useState<string>((p[0] as string) || '');
  const [name2, setName2] = useState<string>((p[1] as string) || '');
  const [showPicker, setShowPicker] = useState(false);
  const [files1, setFiles1] = useState<string[]>([]);
  const [files2, setFiles2] = useState<string[]>([]);
  const [sel1, setSel1] = useState('');
  const [sel2, setSel2] = useState('');
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const displayText = (name1 || name2)
    ? `${name1 || '(없음)'} & ${name2 || '(없음)'}`
    : '';

  const openPicker = () => {
    setSel1(name1);
    setSel2(name2);
    setShowPicker(true);
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
  };

  const names1 = [...new Set(files1.map(f => f.replace(/\.png$/i, '')))];
  const names2 = [...new Set(files2.map(f => f.replace(/\.png$/i, '')))];

  // Composite preview
  useEffect(() => {
    if (!showPicker) return;
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
      new Promise<HTMLImageElement | null>((resolve) => {
        if (!src) { resolve(null); return; }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });

    const url1 = sel1 ? `/api/resources/battlebacks1/${sel1}.png` : '';
    const url2 = sel2 ? `/api/resources/battlebacks2/${sel2}.png` : '';

    Promise.all([drawImg(url1), drawImg(url2)]).then(([img1, img2]) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      if (img1) ctx.drawImage(img1, 0, 0, w, h);
      if (img2) ctx.drawImage(img2, 0, 0, w, h);
    });
  }, [sel1, sel2, showPicker, files1, files2]);

  const handlePickerOk = () => {
    setName1(sel1);
    setName2(sel2);
    setShowPicker(false);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#ddd', whiteSpace: 'nowrap' }}>전투 배경:</span>
        <input type="text" readOnly value={displayText}
          style={{ ...selectStyle, flex: 1, cursor: 'pointer' }}
          onClick={openPicker} />
        <button className="db-btn" onClick={openPicker}
          style={{ padding: '2px 8px', fontSize: 13 }}>...</button>
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([name1, name2])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPicker(false); }}>
          <div className="battleback-picker-dialog">
            <div className="audio-picker-header">전투 배경 선택</div>
            <div className="battleback-picker-body">
              <div className="battleback-picker-lists">
                <div className="battleback-picker-list-col">
                  <div className="audio-picker-list" style={{ flex: 1 }}>
                    <div
                      className={`audio-picker-item${sel1 === '' ? ' selected' : ''}`}
                      onClick={() => setSel1('')}
                    >
                      (없음)
                    </div>
                    {names1.map(name => (
                      <div
                        key={name}
                        className={`audio-picker-item${sel1 === name ? ' selected' : ''}`}
                        onClick={() => setSel1(name)}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="battleback-picker-list-col">
                  <div className="audio-picker-list" style={{ flex: 1 }}>
                    <div
                      className={`audio-picker-item${sel2 === '' ? ' selected' : ''}`}
                      onClick={() => setSel2('')}
                    >
                      (없음)
                    </div>
                    {names2.map(name => (
                      <div
                        key={name}
                        className={`audio-picker-item${sel2 === name ? ' selected' : ''}`}
                        onClick={() => setSel2(name)}
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
              <button className="db-btn" onClick={() => {
                apiClient.post('/resources/battlebacks1/open-folder', {}).catch(() => {});
              }} style={{ marginRight: 4 }}>배경1 폴더 열기</button>
              <button className="db-btn" onClick={() => {
                apiClient.post('/resources/battlebacks2/open-folder', {}).catch(() => {});
              }} style={{ marginRight: 'auto' }}>배경2 폴더 열기</button>
              <button className="db-btn" onClick={handlePickerOk}>OK</button>
              <button className="db-btn" onClick={() => setShowPicker(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
