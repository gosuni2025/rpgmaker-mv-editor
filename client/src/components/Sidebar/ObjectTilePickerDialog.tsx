import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import {
  TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E,
  isGroundDecorationTile,
} from '../../utils/tileHelper';
import { loadTilesetImages } from '../../utils/tilesetImageLoader';
import { renderNormalTab, renderATab, A_TILE_ENTRIES } from './paletteRenderers';

type PaletteTab = 'A' | 'B' | 'C' | 'D' | 'E';
const TABS: PaletteTab[] = ['A', 'B', 'C', 'D', 'E'];

const TAB_SHEET_INDEX: Record<PaletteTab, number[]> = {
  A: [0, 1, 2, 3, 4], B: [5], C: [6], D: [7], E: [8],
};
const TAB_TILE_OFFSET: Record<string, number> = {
  B: TILE_ID_B, C: TILE_ID_C, D: TILE_ID_D, E: TILE_ID_E,
};

interface Props {
  onConfirm: (tiles: number[][], width: number, height: number) => void;
  onClose: () => void;
}

export default function ObjectTilePickerDialog({ onConfirm, onClose }: Props) {
  const currentMap = useEditorStore((s) => s.currentMap);
  const transparentColor = useEditorStore((s) => s.transparentColor);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartCell = useRef<{ col: number; row: number } | null>(null);

  const [activeTab, setActiveTab] = useState<PaletteTab>('A');
  const [tilesetImages, setTilesetImages] = useState<Record<number, HTMLImageElement>>({});
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragCurrentCell, setDragCurrentCell] = useState<{ col: number; row: number } | null>(null);

  // 로컬 선택 상태
  const [localTileId, setLocalTileId] = useState(0);
  const [localTiles, setLocalTiles] = useState<number[][] | null>(null);
  const [localWidth, setLocalWidth] = useState(1);
  const [localHeight, setLocalHeight] = useState(1);

  useEffect(() => {
    if (!currentMap?.tilesetNames) { setTilesetImages({}); return; }
    return loadTilesetImages(currentMap.tilesetNames, setTilesetImages);
  }, [currentMap?.tilesetId, currentMap?.tilesetNames]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(Math.floor(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const highlight = {
      isDragging: isDragging.current,
      dragStart: dragStartCell.current,
      dragCurrent: dragCurrentCell,
    };
    if (activeTab === 'A') {
      renderATab(canvas, tilesetImages, localTileId, localTiles, localWidth, localHeight, transparentColor, { ctx: null as any, ...highlight }, containerWidth);
    } else {
      renderNormalTab(canvas, activeTab, tilesetImages, TAB_SHEET_INDEX, TAB_TILE_OFFSET, localTileId, localTiles, localWidth, localHeight, transparentColor, { ctx: null as any, ...highlight }, containerWidth);
    }
  }, [activeTab, tilesetImages, localTileId, localTiles, localWidth, localHeight, dragCurrentCell, transparentColor, containerWidth]);

  const canvasToCell = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const cols = activeTab === 'A' ? 8 : 16;
    const tilePixelSize = canvas.width / cols;
    const col = Math.max(0, Math.min(cols - 1, Math.floor(cx / tilePixelSize)));
    const row = Math.max(0, Math.floor(cy / tilePixelSize));
    return { col, row };
  }, [activeTab]);

  const getTileIdForCell = useCallback((col: number, row: number): number => {
    if (activeTab === 'A') {
      const idx = row * 8 + col;
      return idx >= 0 && idx < A_TILE_ENTRIES.length ? A_TILE_ENTRIES[idx].tileId : 0;
    }
    const localId = col < 8 ? row * 8 + col : 128 + row * 8 + (col - 8);
    return (TAB_TILE_OFFSET[activeTab] ?? 0) + localId;
  }, [activeTab]);

  const commitSelection = useCallback((startCol: number, startRow: number, endCol: number, endRow: number) => {
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const w = maxCol - minCol + 1;
    const h = maxRow - minRow + 1;
    const firstTileId = getTileIdForCell(minCol, minRow);
    setLocalTileId(firstTileId);
    if (w === 1 && h === 1) {
      setLocalTiles(null);
      setLocalWidth(1);
      setLocalHeight(1);
    } else {
      const tiles: number[][] = [];
      for (let r = 0; r < h; r++) {
        const rowTiles: number[] = [];
        for (let c = 0; c < w; c++) rowTiles.push(getTileIdForCell(minCol + c, minRow + r));
        tiles.push(rowTiles);
      }
      setLocalTiles(tiles);
      setLocalWidth(w);
      setLocalHeight(h);
    }
  }, [getTileIdForCell]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const cell = canvasToCell(e);
    if (!cell) return;
    isDragging.current = true;
    dragStartCell.current = cell;
    setDragCurrentCell(cell);
  }, [canvasToCell]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = canvasToCell(e);
    if (isDragging.current && dragStartCell.current && cell) setDragCurrentCell(cell);
  }, [canvasToCell]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !dragStartCell.current) return;
    isDragging.current = false;
    const end = canvasToCell(e) || dragCurrentCell;
    if (!end) return;
    commitSelection(dragStartCell.current.col, dragStartCell.current.row, end.col, end.row);
    dragStartCell.current = null;
    setDragCurrentCell(null);
  }, [canvasToCell, dragCurrentCell, commitSelection]);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging.current || !dragStartCell.current) return;
    isDragging.current = false;
    const end = dragCurrentCell || dragStartCell.current;
    commitSelection(dragStartCell.current.col, dragStartCell.current.row, end.col, end.row);
    dragStartCell.current = null;
    setDragCurrentCell(null);
  }, [dragCurrentCell, commitSelection]);

  const hasSheet = (tab: PaletteTab) =>
    TAB_SHEET_INDEX[tab].some(idx => !!tilesetImages[idx]);

  const handleConfirm = () => {
    const tiles = localTiles ?? [[localTileId]];
    const w = localTiles ? localWidth : 1;
    const h = localTiles ? localHeight : 1;
    onConfirm(tiles, w, h);
  };

  const selectionLabel = localTiles
    ? `${localWidth} × ${localHeight} 타일 선택됨`
    : localTileId > 0
    ? `타일 ID: ${localTileId}`
    : '타일을 선택하세요';

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>타일로 오브젝트 생성</span>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* 탭 바 */}
        <div style={tabBarStyle}>
          {TABS.map((tab) => (
            <div key={tab}
              style={{ ...tabStyle, ...(activeTab === tab ? tabActiveStyle : {}), ...(!hasSheet(tab) ? tabDisabledStyle : {}) }}
              onClick={() => setActiveTab(tab)}>{tab}</div>
          ))}
        </div>

        {/* 캔버스 */}
        <div ref={scrollAreaRef} style={canvasAreaStyle}>
          <canvas ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ display: 'block', width: '100%', cursor: 'crosshair', imageRendering: 'pixelated' }} />
        </div>

        {/* 하단 */}
        <div style={footerStyle}>
          <span style={{ fontSize: 11, color: localTileId > 0 || localTiles ? '#9cf' : '#888' }}>
            {selectionLabel}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={cancelBtnStyle} onClick={onClose}>취소</button>
            <button style={confirmBtnStyle}
              disabled={localTileId === 0 && !localTiles}
              onClick={handleConfirm}>
              오브젝트 생성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const dialogStyle: React.CSSProperties = {
  background: '#2b2b2b', border: '1px solid #555', borderRadius: 6,
  display: 'flex', flexDirection: 'column',
  width: 480, maxHeight: '80vh', overflow: 'hidden',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 12px', borderBottom: '1px solid #444', color: '#ddd',
};
const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14, padding: '0 4px',
};
const tabBarStyle: React.CSSProperties = {
  display: 'flex', background: '#2a2a2a', borderBottom: '1px solid #444',
};
const tabStyle: React.CSSProperties = {
  padding: '3px 12px', fontSize: 11, color: '#aaa', cursor: 'pointer',
  borderRight: '1px solid #444', userSelect: 'none',
};
const tabActiveStyle: React.CSSProperties = {
  background: '#3a3a3a', color: '#fff', borderBottom: '2px solid #4a9eff',
};
const tabDisabledStyle: React.CSSProperties = { color: '#555' };
const canvasAreaStyle: React.CSSProperties = {
  flex: 1, overflow: 'auto', background: '#1e1e1e', minHeight: 200,
};
const footerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 12px', borderTop: '1px solid #444', background: '#252525',
};
const cancelBtnStyle: React.CSSProperties = {
  background: '#444', border: '1px solid #666', color: '#ddd',
  padding: '4px 12px', borderRadius: 3, cursor: 'pointer', fontSize: 12,
};
const confirmBtnStyle: React.CSSProperties = {
  background: '#2675bf', border: '1px solid #3a8ad4', color: '#fff',
  padding: '4px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12,
};
