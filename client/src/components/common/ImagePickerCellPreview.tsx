import React, { useEffect, useRef } from 'react';
import { getCharacterSheetInfo, ROW_FROM_DIR } from './ImagePickerUtils';

/** 프리뷰 썸네일 */
export function CellPreview({ imgSrc, fileName, type, cellIndex, direction, pattern, size }: {
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
      } else if (type === 'sv_actors') {
        // SV 배틀러: 9열×6행, walk 모션 중앙 프레임 (cx=1, cy=0)
        const fw = img.naturalWidth / 9;
        const fh = img.naturalHeight / 6;
        canvas.width = fw;
        canvas.height = fh;
        canvas.getContext('2d')!.drawImage(img, fw, 0, fw, fh, 0, 0, fw, fh);
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
