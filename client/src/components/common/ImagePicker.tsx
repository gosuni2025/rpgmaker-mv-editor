import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';

interface ImagePickerProps {
  type: 'faces' | 'characters' | 'sv_actors' | 'sv_enemies' | 'enemies' | 'battlebacks1' | 'battlebacks2' | 'parallaxes' | 'tilesets' | 'titles1' | 'titles2' | 'animations' | 'pictures';
  value: string;
  onChange: (name: string) => void;
  index?: number;
  onIndexChange?: (index: number) => void;
}

// faces: 4x2 셀, 각 셀 = 이미지너비/4 x 이미지높이/2
// characters: 4x2 셀, 각 셀 = 3패턴x4방향 (이미지너비/4 x 이미지높이/2), 대표 프레임은 중앙 하단방향
// sv_actors: 전체 1개

interface CellLayout {
  cols: number;  // 셀 그리드 열 수
  rows: number;  // 셀 그리드 행 수
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

/** 캔버스에 셀 하나를 그려서 반환 */
function drawCellToCanvas(
  img: HTMLImageElement,
  type: string,
  cellIndex: number,
  layout: CellLayout,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const cellW = img.naturalWidth / layout.cols;
  const cellH = img.naturalHeight / layout.rows;

  if (type === 'characters') {
    // 캐릭터: 각 셀은 3패턴x4방향, 대표 프레임 = 패턴1(중앙), 방향0(아래)
    const patternW = cellW / 3;
    const patternH = cellH / 4;
    canvas.width = patternW;
    canvas.height = patternH;
    const ctx = canvas.getContext('2d')!;
    const col = cellIndex % layout.cols;
    const row = Math.floor(cellIndex / layout.cols);
    const sx = col * cellW + patternW; // 중앙 패턴 (index 1)
    const sy = row * cellH;            // 아래 방향 (index 0)
    ctx.drawImage(img, sx, sy, patternW, patternH, 0, 0, patternW, patternH);
  } else {
    // faces 등: 셀 전체
    canvas.width = cellW;
    canvas.height = cellH;
    const ctx = canvas.getContext('2d')!;
    const col = cellIndex % layout.cols;
    const row = Math.floor(cellIndex / layout.cols);
    ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH);
  }
  return canvas;
}

function CellGrid({ imgSrc, type, cellCount, layout, selectedIndex, onSelect }: {
  imgSrc: string;
  type: string;
  cellCount: number;
  layout: CellLayout;
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imgSrc;
    return () => { img.onload = null; };
  }, [imgSrc]);

  useEffect(() => {
    if (!imgLoaded || !imgRef.current) return;
    const img = imgRef.current;
    for (let i = 0; i < cellCount; i++) {
      const target = canvasRefs.current[i];
      if (!target) continue;
      const src = drawCellToCanvas(img, type, i, layout);
      target.width = src.width;
      target.height = src.height;
      target.getContext('2d')!.drawImage(src, 0, 0);
    }
  }, [imgLoaded, imgSrc, type, cellCount, layout]);

  const cellSize = type === 'faces' ? 80 : 64;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${layout.cols}, ${cellSize}px)`,
      gap: 4,
    }}>
      {Array.from({ length: cellCount }, (_, i) => (
        <div
          key={i}
          onClick={() => onSelect(i)}
          style={{
            cursor: 'pointer',
            border: i === selectedIndex ? '2px solid #2675bf' : '2px solid transparent',
            borderRadius: 3,
            background: i === selectedIndex ? 'rgba(38,117,191,0.15)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: cellSize,
            height: cellSize,
            padding: 2,
          }}
        >
          <canvas
            ref={el => { canvasRefs.current[i] = el; }}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** 프리뷰 썸네일 (선택된 셀 1개) */
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
      const src = drawCellToCanvas(img, type, cellIndex, layout);
      canvas.width = src.width;
      canvas.height = src.height;
      canvas.getContext('2d')!.drawImage(src, 0, 0);
    };
    img.src = imgSrc;
  }, [imgSrc, type, cellIndex, layout]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        maxWidth: size,
        maxHeight: size,
        imageRendering: 'pixelated',
      }}
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
                  <CellGrid
                    imgSrc={getImgUrl(selected + '.png')}
                    type={type}
                    cellCount={cellCount}
                    layout={layout}
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
