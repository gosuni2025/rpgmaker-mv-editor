import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';

interface ImagePickerProps {
  type: 'faces' | 'characters' | 'sv_actors' | 'sv_enemies' | 'enemies' | 'battlebacks1' | 'battlebacks2' | 'parallaxes' | 'tilesets' | 'titles1' | 'titles2' | 'animations' | 'pictures';
  value: string;
  onChange: (name: string) => void;
  index?: number;
  onIndexChange?: (index: number) => void;
  direction?: number;
  onDirectionChange?: (direction: number) => void;
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

// RPG Maker MV direction: 2=아래, 4=왼쪽, 6=오른쪽, 8=위
// 스프라이트 시트 행 순서: 0=아래(2), 1=왼쪽(4), 2=오른쪽(6), 3=위(8)
const DIR_TO_ROW = [2, 4, 6, 8]; // row index -> direction value
const DIR_FROM_ROW: Record<number, number> = { 0: 2, 1: 4, 2: 6, 3: 8 };
const ROW_FROM_DIR: Record<number, number> = { 2: 0, 4: 1, 6: 2, 8: 3 };

/** 스프라이트 시트 전체를 표시하고, 개별 프레임 클릭으로 선택 */
function SheetSelector({ imgSrc, type, layout, cellCount, selectedIndex, onSelect, selectedDirection, onDirectionSelect }: {
  imgSrc: string;
  type: string;
  layout: CellLayout;
  cellCount: number;
  selectedIndex: number;
  onSelect: (i: number) => void;
  selectedDirection?: number;
  onDirectionSelect?: (dir: number) => void;
}) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setImgSize(null);
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imgSrc;
    return () => { img.onload = null; };
  }, [imgSrc]);

  if (!imgSize) return null;

  if (type === 'characters' && onDirectionSelect) {
    // 캐릭터: 12열(4캐릭터x3패턴) x 8행(2캐릭터x4방향) 개별 프레임 그리드
    const charCols = layout.cols;  // 4
    const charRows = layout.rows;  // 2
    const patternsPerChar = 3;
    const dirsPerChar = 4;
    const totalCols = charCols * patternsPerChar; // 12
    const totalRows = charRows * dirsPerChar;      // 8
    const frameCellW = imgSize.w / totalCols;
    const frameCellH = imgSize.h / totalRows;
    const dirRow = ROW_FROM_DIR[selectedDirection ?? 2] ?? 0;

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={imgSrc}
          style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%' }}
          draggable={false}
        />
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'grid',
          gridTemplateColumns: `repeat(${totalCols}, 1fr)`,
          gridTemplateRows: `repeat(${totalRows}, 1fr)`,
        }}>
          {Array.from({ length: totalRows }, (_, row) =>
            Array.from({ length: totalCols }, (_, col) => {
              const charCol = Math.floor(col / patternsPerChar);
              const charRow = Math.floor(row / dirsPerChar);
              const charIdx = charRow * charCols + charCol;
              const dirIdx = row % dirsPerChar;
              const dir = DIR_FROM_ROW[dirIdx];
              const isSelected = charIdx === selectedIndex && dirIdx === dirRow;
              const isCharSelected = charIdx === selectedIndex;
              return (
                <div
                  key={`${row}-${col}`}
                  onClick={() => {
                    onSelect(charIdx);
                    onDirectionSelect(dir);
                  }}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #2675bf' : '2px solid transparent',
                    background: isSelected
                      ? 'rgba(38,117,191,0.3)'
                      : isCharSelected
                        ? 'rgba(38,117,191,0.1)'
                        : 'transparent',
                    boxSizing: 'border-box',
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    );
  }

  // faces 등: 기존 셀 단위 선택
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img
        src={imgSrc}
        style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%' }}
        draggable={false}
      />
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
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

/** 프리뷰 썸네일 */
function CellPreview({ imgSrc, type, cellIndex, layout, size, direction }: {
  imgSrc: string;
  type: string;
  cellIndex: number;
  layout: CellLayout;
  size: number;
  direction?: number;
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
        const pw = cellW / 3;
        const ph = cellH / 4;
        const dirRow = ROW_FROM_DIR[direction ?? 2] ?? 0;
        canvas.width = pw;
        canvas.height = ph;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, col * cellW + pw, row * cellH + dirRow * ph, pw, ph, 0, 0, pw, ph);
      } else {
        canvas.width = cellW;
        canvas.height = cellH;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH);
      }
    };
    img.src = imgSrc;
  }, [imgSrc, type, cellIndex, layout, direction]);

  return (
    <canvas
      ref={canvasRef}
      style={{ maxWidth: size, maxHeight: size, imageRendering: 'pixelated' }}
    />
  );
}

export default function ImagePicker({ type, value, onChange, index, onIndexChange, direction, onDirectionChange }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(index ?? 0);
  const [selectedDirection, setSelectedDirection] = useState(direction ?? 2);

  useEffect(() => {
    if (!open) return;
    setSelected(value);
    setSelectedIndex(index ?? 0);
    setSelectedDirection(direction ?? 2);
    apiClient.get<string[]>(`/resources/${type}`).then(setFiles).catch(() => setFiles([]));
  }, [open]);

  const handleOk = () => {
    onChange(selected.replace(/\.png$/i, ''));
    if (onIndexChange) onIndexChange(selectedIndex);
    if (onDirectionChange) onDirectionChange(selectedDirection);
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
              direction={direction}
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
                    selectedDirection={selectedDirection}
                    onDirectionSelect={onDirectionChange ? setSelectedDirection : undefined}
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
