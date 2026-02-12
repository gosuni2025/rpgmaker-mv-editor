import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';
import './ImagePicker.css';

interface ImagePickerProps {
  type: 'faces' | 'characters' | 'sv_actors' | 'sv_enemies' | 'enemies' | 'battlebacks1' | 'battlebacks2' | 'parallaxes' | 'tilesets' | 'titles1' | 'titles2' | 'animations' | 'pictures';
  value: string;
  onChange: (name: string) => void;
  index?: number;
  onIndexChange?: (index: number) => void;
  direction?: number;
  onDirectionChange?: (direction: number) => void;
  pattern?: number;
  onPatternChange?: (pattern: number) => void;
}

// RPG Maker MV direction: 2=아래, 4=왼쪽, 6=오른쪽, 8=위
// 스프라이트 시트 행 순서: 0=아래(2), 1=왼쪽(4), 2=오른쪽(6), 3=위(8)
const DIR_FROM_ROW: Record<number, number> = { 0: 2, 1: 4, 2: 6, 3: 8 };
const ROW_FROM_DIR: Record<number, number> = { 2: 0, 4: 1, 6: 2, 8: 3 };

function getCharacterSheetInfo(fileName: string) {
  const isSingle = fileName.startsWith('$');
  return {
    charCols: isSingle ? 1 : 4,
    charRows: isSingle ? 1 : 2,
    patterns: 3,
    dirs: 4,
    totalCols: isSingle ? 3 : 12,
    totalRows: isSingle ? 4 : 8,
  };
}

/** 스프라이트 시트 전체 표시, 개별 프레임 클릭 선택 */
function SheetSelector({ imgSrc, fileName, type, selectedIndex, selectedDirection, selectedPattern, onSelect }: {
  imgSrc: string;
  fileName: string;
  type: string;
  selectedIndex: number;
  selectedDirection: number;
  selectedPattern: number;
  onSelect: (index: number, direction: number, pattern: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setLoaded(false); }, [imgSrc]);

  if (type === 'characters') {
    const info = getCharacterSheetInfo(fileName);
    const selCharCol = selectedIndex % info.charCols;
    const selCharRow = Math.floor(selectedIndex / info.charCols);
    const selDirRow = ROW_FROM_DIR[selectedDirection] ?? 0;
    const selAbsCol = selCharCol * info.patterns + selectedPattern;
    const selAbsRow = selCharRow * info.dirs + selDirRow;

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={imgSrc}
          style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%' }}
          draggable={false}
          onLoad={() => setLoaded(true)}
        />
        {loaded && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'grid',
            gridTemplateColumns: `repeat(${info.totalCols}, 1fr)`,
            gridTemplateRows: `repeat(${info.totalRows}, 1fr)`,
          }}>
            {Array.from({ length: info.totalRows * info.totalCols }, (_, i) => {
              const col = i % info.totalCols;
              const row = Math.floor(i / info.totalCols);
              const charCol = Math.floor(col / info.patterns);
              const charRow = Math.floor(row / info.dirs);
              const charIdx = charRow * info.charCols + charCol;
              const pat = col % info.patterns;
              const dir = DIR_FROM_ROW[row % info.dirs];
              const isSelected = col === selAbsCol && row === selAbsRow;
              return (
                <div
                  key={i}
                  onClick={() => onSelect(charIdx, dir, pat)}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #2675bf' : '1px solid rgba(255,255,255,0.05)',
                    background: isSelected ? 'rgba(38,117,191,0.3)' : 'transparent',
                    boxSizing: 'border-box',
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // faces: 셀 단위 선택
  const layout = type === 'faces' ? { cols: 4, rows: 2 } : { cols: 1, rows: 1 };
  const cellCount = type === 'faces' ? 8 : 1;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img
        src={imgSrc}
        style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%' }}
        draggable={false}
        onLoad={() => setLoaded(true)}
      />
      {loaded && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'grid',
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        }}>
          {Array.from({ length: cellCount }, (_, i) => (
            <div
              key={i}
              onClick={() => onSelect(i, 2, 0)}
              style={{
                cursor: 'pointer',
                border: i === selectedIndex ? '2px solid #2675bf' : '1px solid rgba(255,255,255,0.05)',
                background: i === selectedIndex ? 'rgba(38,117,191,0.2)' : 'transparent',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 프리뷰 썸네일 */
function CellPreview({ imgSrc, fileName, type, cellIndex, direction, pattern, size }: {
  imgSrc: string;
  fileName: string;
  type: string;
  cellIndex: number;
  direction?: number;
  pattern?: number;
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (type === 'characters') {
        const info = getCharacterSheetInfo(fileName);
        const fw = img.naturalWidth / info.totalCols;
        const fh = img.naturalHeight / info.totalRows;
        const charCol = cellIndex % info.charCols;
        const charRow = Math.floor(cellIndex / info.charCols);
        const dirRow = ROW_FROM_DIR[direction ?? 2] ?? 0;
        const pat = pattern ?? 1;
        const sx = (charCol * info.patterns + pat) * fw;
        const sy = (charRow * info.dirs + dirRow) * fh;
        canvas.width = fw;
        canvas.height = fh;
        canvas.getContext('2d')!.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
      } else if (type === 'faces') {
        const cols = 4, rows = 2;
        const cw = img.naturalWidth / cols;
        const ch = img.naturalHeight / rows;
        const col = cellIndex % cols;
        const row = Math.floor(cellIndex / cols);
        canvas.width = cw;
        canvas.height = ch;
        canvas.getContext('2d')!.drawImage(img, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
      }
    };
    img.src = imgSrc;
  }, [imgSrc, fileName, type, cellIndex, direction, pattern]);

  return (
    <canvas
      ref={canvasRef}
      style={{ maxWidth: size, maxHeight: size, imageRendering: 'pixelated' }}
    />
  );
}

function getCellCount(type: string) {
  if (type === 'faces') return 8;
  if (type === 'characters') return 8;
  if (type === 'sv_actors') return 1;
  return 0;
}

export default function ImagePicker({ type, value, onChange, index, onIndexChange, direction, onDirectionChange, pattern, onPatternChange }: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(index ?? 0);
  const [selectedDirection, setSelectedDirection] = useState(direction ?? 2);
  const [selectedPattern, setSelectedPattern] = useState(pattern ?? 1);

  useEffect(() => {
    if (!open) return;
    setSelected(value);
    setSelectedIndex(index ?? 0);
    setSelectedDirection(direction ?? 2);
    setSelectedPattern(pattern ?? 1);
    apiClient.get<string[]>(`/resources/${type}`).then(setFiles).catch(() => setFiles([]));
  }, [open]);

  const handleOk = () => {
    onChange(selected.replace(/\.png$/i, ''));
    if (onIndexChange) onIndexChange(selectedIndex);
    if (onDirectionChange) onDirectionChange(selectedDirection);
    if (onPatternChange) onPatternChange(selectedPattern);
    setOpen(false);
  };

  const cellCount = getCellCount(type);
  const hasIndex = cellCount > 1;
  const getImgUrl = (name: string) => `/api/resources/${type}/${name}`;

  return (
    <div className="image-picker">
      <div className="image-picker-preview" onClick={() => setOpen(true)}>
        {value ? (
          hasIndex && index !== undefined ? (
            <CellPreview
              imgSrc={getImgUrl(value.includes('.') ? value : value + '.png')}
              fileName={value}
              type={type}
              cellIndex={index}
              direction={direction}
              pattern={pattern}
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
                {selected && hasIndex && onIndexChange ? (
                  <SheetSelector
                    imgSrc={getImgUrl(selected + '.png')}
                    fileName={selected}
                    type={type}
                    selectedIndex={selectedIndex}
                    selectedDirection={selectedDirection}
                    selectedPattern={selectedPattern}
                    onSelect={(idx, dir, pat) => {
                      setSelectedIndex(idx);
                      setSelectedDirection(dir);
                      setSelectedPattern(pat);
                    }}
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
