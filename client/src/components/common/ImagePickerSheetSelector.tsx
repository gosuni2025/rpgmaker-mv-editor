import React, { useState, useEffect } from 'react';
import { getCharacterSheetInfo, DIR_FROM_ROW, ROW_FROM_DIR } from './ImagePickerUtils';

/** 스프라이트 시트 전체 표시, 개별 프레임 클릭 선택 */
export function SheetSelector({ imgSrc, fileName, type, selectedIndex, selectedDirection, selectedPattern, onSelect }: {
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
