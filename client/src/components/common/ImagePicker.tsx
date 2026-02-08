import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';

interface ImagePickerProps {
  type: 'faces' | 'characters' | 'sv_actors' | 'sv_enemies' | 'enemies' | 'battlebacks1' | 'battlebacks2' | 'parallaxes' | 'tilesets' | 'titles1' | 'titles2' | 'animations' | 'pictures';
  value: string;
  onChange: (name: string) => void;
  index?: number;
  onIndexChange?: (index: number) => void;
}

interface CellLayout {
  cols: number;
  rows: number;
}

function getCellCount(type: string) {
  if (type === 'faces') return 8;
  if (type === 'characters') return 8;
  if (type === 'sv_actors') return 1;
  return 0;
}

function getCellLayout(type: string): CellLayout {
  if (type === 'faces') return { cols: 4, rows: 2 };
  if (type === 'characters') return { cols: 4, rows: 2 };
  return { cols: 1, rows: 1 };
}

/** 스프라이트 시트 전체를 표시하고, 셀 클릭으로 선택하는 그리드 */
function SheetSelector({ imgSrc, type, layout, cellCount, selectedIndex, onSelect }: {
  imgSrc: string;
  type: string;
  layout: CellLayout;
  cellCount: number;
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imgSrc;
    return () => { img.onload = null; };
  }, [imgSrc]);

  if (!imgSize) return null;

  const cellW = imgSize.w / layout.cols;
  const cellH = imgSize.h / layout.rows;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img
        src={imgSrc}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          maxWidth: '100%',
        }}
        draggable={false}
      />
      {/* 셀 선택 오버레이 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
      }}>
        {Array.from({ length: cellCount }, (_, i) => (
          <div
            key={i}
            onClick={() => onSelect(i)}
            style={{
              cursor: 'pointer',
              border: i === selectedIndex ? '2px solid #2675bf' : '2px solid transparent',
              background: i === selectedIndex ? 'rgba(38,117,191,0.2)' : 'transparent',
              boxSizing: 'border-box',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** 프리뷰 썸네일 (캐릭터는 대표 프레임 1개, 그 외는 셀 전체) */
function CellPreview({ imgSrc, type, cellIndex, layout, size }: {
  imgSrc: string;
  type: string;
  cellIndex: number;
  layout: CellLayout;
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cellW = img.naturalWidth / layout.cols;
      const cellH = img.naturalHeight / layout.rows;
      const col = cellIndex % layout.cols;
      const row = Math.floor(cellIndex / layout.cols);

      if (type === 'characters') {
        // 대표 프레임: 중앙 패턴, 아래 방향
        const pw = cellW / 3;
        const ph = cellH / 4;
        canvas.width = pw;
        canvas.height = ph;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, col * cellW + pw, row * cellH, pw, ph, 0, 0, pw, ph);
      } else {
        canvas.width = cellW;
        canvas.height = cellH;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH);
      }
    };
    img.src = imgSrc;
  }, [imgSrc, type, cellIndex, layout]);

  return (
    <canvas
      ref={canvasRef}
      style={{ maxWidth: size, maxHeight: size, imageRendering: 'pixelated' }}
    />
  );
}

export default function ImagePicker({ type, value, onChange, index, onIndexChange }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(index ?? 0);

  useEffect(() => {
    if (!open) return;
    setSelected(value);
    setSelectedIndex(index ?? 0);
    apiClient.get<string[]>(`/resources/${type}`).then(setFiles).catch(() => setFiles([]));
  }, [open]);

  const handleOk = () => {
    onChange(selected.replace(/\.png$/i, ''));
    if (onIndexChange) onIndexChange(selectedIndex);
    setOpen(false);
  };

  const cellCount = getCellCount(type);
  const layout = getCellLayout(type);

  const getImgUrl = (name: string) => `/api/resources/${type}/${name}`;

  return (
    <div className="image-picker">
      <div className="image-picker-preview" onClick={() => setOpen(true)}>
        {value ? (
          cellCount > 1 && index !== undefined ? (
            <CellPreview
              imgSrc={getImgUrl(value.includes('.') ? value : value + '.png')}
              type={type}
              cellIndex={index}
              layout={layout}
              size={48}
            />
          ) : (
            <img
              src={getImgUrl(value.includes('.') ? value : value + '.png')}
              alt={value}
              style={{ maxHeight: 48, maxWidth: 96 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )
        ) : (
          <span className="image-picker-none">(None)</span>
        )}
        <span className="image-picker-name">{value || '(None)'}</span>
      </div>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="image-picker-dialog" onClick={e => e.stopPropagation()}>
            <div className="image-picker-header">Select {type}</div>
            <div className="image-picker-body">
              <div className="image-picker-list">
                <div
                  className={`image-picker-item${selected === '' ? ' selected' : ''}`}
                  onClick={() => setSelected('')}
                >
                  (None)
                </div>
                {files.map(f => {
                  const name = f.replace(/\.png$/i, '');
                  return (
                    <div
                      key={f}
                      className={`image-picker-item${selected === name ? ' selected' : ''}`}
                      onClick={() => setSelected(name)}
                    >
                      {name}
                    </div>
                  );
                })}
              </div>
              <div className="image-picker-preview-area">
                {selected && cellCount > 1 && onIndexChange ? (
                  <SheetSelector
                    imgSrc={getImgUrl(selected + '.png')}
                    type={type}
                    layout={layout}
                    cellCount={cellCount}
                    selectedIndex={selectedIndex}
                    onSelect={setSelectedIndex}
                  />
                ) : selected ? (
                  <img
                    src={getImgUrl(selected + '.png')}
                    alt={selected}
                    style={{ maxWidth: '100%', maxHeight: 300, imageRendering: 'pixelated' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : null}
              </div>
            </div>
            <div className="image-picker-footer">
              <button className="db-btn" onClick={handleOk}>OK</button>
              <button className="db-btn" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
