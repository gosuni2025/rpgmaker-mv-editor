import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';

type ImageType = 'faces' | 'characters' | 'sv_actors';

const TYPE_LABELS: Record<ImageType, string> = {
  faces: '얼굴',
  characters: '캐릭터',
  sv_actors: '[SV] 전투 캐릭터',
};

const CELL_LAYOUTS: Record<ImageType, { cols: number; rows: number; total: number }> = {
  faces: { cols: 4, rows: 2, total: 8 },
  characters: { cols: 4, rows: 2, total: 8 },
  sv_actors: { cols: 1, rows: 1, total: 1 },
};

export function ImageSelectDialog({ type, value, index, onOk, onCancel }: {
  type: ImageType;
  value: string;
  index: number;
  onOk: (name: string, index: number) => void;
  onCancel: () => void;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(index);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient.get<string[]>(`/resources/${type}`).then(setFiles).catch(() => setFiles([]));
  }, [type]);

  useEffect(() => {
    if (files.length > 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.image-picker-item');
      const idx = selected ? files.findIndex(f => f.replace(/\.png$/i, '') === selected) : -1;
      if (items[idx + 1]) {
        items[idx + 1].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [files]);

  const getImgUrl = (name: string) => `/api/resources/${type}/${name}.png`;
  const layout = CELL_LAYOUTS[type];

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: 520, maxHeight: '80vh' }}>
        <div className="image-picker-header">이미지 선택 - {TYPE_LABELS[type]}</div>
        <div className="image-picker-body">
          <div className="image-picker-list" ref={listRef}>
            <div className={`image-picker-item${selected === '' ? ' selected' : ''}`}
              onClick={() => { setSelected(''); setSelectedIndex(0); }}>(없음)</div>
            {files.map(f => {
              const name = f.replace(/\.png$/i, '');
              return (
                <div key={f}
                  className={`image-picker-item${selected === name ? ' selected' : ''}`}
                  onClick={() => { setSelected(name); setSelectedIndex(0); }}
                >{name}</div>
              );
            })}
          </div>
          <div className="image-picker-preview-area">
            {selected && layout.total > 1 ? (
              <ImageCellSelector
                imgSrc={getImgUrl(selected)}
                fileName={selected}
                cellCount={layout.total}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            ) : selected ? (
              <img src={getImgUrl(selected)} alt={selected}
                style={{ maxWidth: '100%', maxHeight: 300, imageRendering: 'pixelated' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : null}
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => {
            apiClient.post(`/resources/${type}/open-folder`, {}).catch(() => {});
          }} style={{ marginRight: 'auto' }}>폴더 열기</button>
          <button className="db-btn" onClick={() => onOk(selected, selectedIndex)}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>
  );
}

function ImageCellSelector({ imgSrc, fileName, cellCount, selectedIndex, onSelect }: {
  imgSrc: string;
  fileName: string;
  cellCount: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [imgSrc]);

  const isSingle = fileName.startsWith('$');
  const charCols = isSingle ? 1 : 4;
  const charRows = isSingle ? 1 : 2;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img src={imgSrc} style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%' }}
        draggable={false} onLoad={() => setLoaded(true)} />
      {loaded && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'grid',
          gridTemplateColumns: `repeat(${charCols}, 1fr)`,
          gridTemplateRows: `repeat(${charRows}, 1fr)`,
        }}>
          {Array.from({ length: cellCount }, (_, i) => (
            <div key={i} onClick={() => onSelect(i)}
              style={{
                cursor: 'pointer',
                border: i === selectedIndex ? '2px solid #2675bf' : '1px solid rgba(255,255,255,0.05)',
                background: i === selectedIndex ? 'rgba(38,117,191,0.25)' : 'transparent',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ImagePreviewThumb({ type, name, index, size }: {
  type: ImageType;
  name: string;
  index: number;
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!name) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      if (type === 'faces') {
        const cw = img.naturalWidth / 4;
        const ch = img.naturalHeight / 2;
        const col = index % 4;
        const row = Math.floor(index / 4);
        canvas.width = cw;
        canvas.height = ch;
        ctx.drawImage(img, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
      } else if (type === 'characters') {
        const isSingle = name.startsWith('$');
        const totalCols = isSingle ? 3 : 12;
        const totalRows = isSingle ? 4 : 8;
        const charCols = isSingle ? 1 : 4;
        const patterns = 3;
        const dirs = 4;
        const fw = img.naturalWidth / totalCols;
        const fh = img.naturalHeight / totalRows;
        const charCol = index % charCols;
        const charRow = Math.floor(index / charCols);
        const sx = (charCol * patterns + 1) * fw;
        const sy = (charRow * dirs + 0) * fh;
        canvas.width = fw;
        canvas.height = fh;
        ctx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
      } else {
        const fw = img.naturalWidth / 9;
        const fh = img.naturalHeight / 6;
        canvas.width = fw;
        canvas.height = fh;
        ctx.drawImage(img, 0, 0, fw, fh, 0, 0, fw, fh);
      }
    };
    img.src = `/api/resources/${type}/${name}.png`;
  }, [type, name, index]);

  if (!name) {
    return <div style={{ width: size, height: size, background: '#333', border: '1px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#888', fontSize: 11 }}>(없음)</span>
    </div>;
  }
  return <canvas ref={canvasRef} style={{ maxWidth: size, maxHeight: size, imageRendering: 'pixelated', background: 'repeating-conic-gradient(#444 0% 25%, #555 0% 50%) 50% / 16px 16px' }} />;
}
