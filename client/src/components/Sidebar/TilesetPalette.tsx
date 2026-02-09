import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import {
  TILE_SIZE_PX, TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E,
  TILE_ID_A1, TILE_ID_A2, TILE_ID_A3, TILE_ID_A4, TILE_ID_A5,
  getTileRenderInfo,
} from '../../utils/tileHelper';

type PaletteTab = 'A' | 'B' | 'C' | 'D' | 'E' | 'R' | 'L';
const TABS: PaletteTab[] = ['A', 'B', 'C', 'D', 'E', 'R', 'L'];

// Tab → tileset image index mapping
const TAB_SHEET_INDEX: Record<PaletteTab, number[]> = {
  A: [0, 1, 2, 3, 4], // A1-A5
  B: [5],
  C: [6],
  D: [7],
  E: [8],
  R: [],
  L: [],
};

// B-E tile ID offsets
const TAB_TILE_OFFSET: Record<string, number> = {
  B: TILE_ID_B,
  C: TILE_ID_C,
  D: TILE_ID_D,
  E: TILE_ID_E,
};

const HALF = TILE_SIZE_PX / 2;

// A-tab autotile definitions: each kind with its sheet index and base tile ID
interface AutotileEntry {
  sheet: number;
  kind: number;
  label: string;
  tileId: number;
}

function buildAtileEntries(): AutotileEntry[] {
  const entries: AutotileEntry[] = [];
  // A1: kinds 0-15 (sheet 0)
  for (let k = 0; k < 16; k++) {
    entries.push({ sheet: 0, kind: k, label: `A1-${k}`, tileId: TILE_ID_A1 + k * 48 + 46 });
  }
  // A2: kinds 16-47 (sheet 1), ty starts at 2
  for (let k = 16; k < 48; k++) {
    entries.push({ sheet: 1, kind: k, label: `A2-${k - 16}`, tileId: TILE_ID_A1 + k * 48 + 46 });
  }
  // A3: kinds 48-79 (sheet 2)
  for (let k = 48; k < 80; k++) {
    entries.push({ sheet: 2, kind: k, label: `A3-${k - 48}`, tileId: TILE_ID_A1 + k * 48 + 46 });
  }
  // A4: kinds 80-127 (sheet 3)
  for (let k = 80; k < 128; k++) {
    entries.push({ sheet: 3, kind: k, label: `A4-${k - 80}`, tileId: TILE_ID_A1 + k * 48 + 46 });
  }
  // A5: non-autotile, 128 tiles (sheet 4)
  for (let i = 0; i < 128; i++) {
    entries.push({ sheet: 4, kind: -1, label: `A5-${i}`, tileId: TILE_ID_A5 + i });
  }
  return entries;
}

const A_TILE_ENTRIES = buildAtileEntries();

export default function TilesetPalette() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedTileId = useEditorStore((s) => s.selectedTileId);
  const selectedTiles = useEditorStore((s) => s.selectedTiles);
  const selectedTilesWidth = useEditorStore((s) => s.selectedTilesWidth);
  const selectedTilesHeight = useEditorStore((s) => s.selectedTilesHeight);
  const setSelectedTileId = useEditorStore((s) => s.setSelectedTileId);
  const setSelectedTiles = useEditorStore((s) => s.setSelectedTiles);
  const setCurrentLayer = useEditorStore((s) => s.setCurrentLayer);
  const currentMap = useEditorStore((s) => s.currentMap);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const setLightEditMode = useEditorStore((s) => s.setLightEditMode);
  const setShadowLight = useEditorStore((s) => s.setShadowLight);
  const initEditorLights = useEditorStore((s) => s.initEditorLights);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  const setSelectedLightId = useEditorStore((s) => s.setSelectedLightId);
  const selectedLightType = useEditorStore((s) => s.selectedLightType);
  const setSelectedLightType = useEditorStore((s) => s.setSelectedLightType);

  const [activeTab, setActiveTab] = useState<PaletteTab>('A');
  const prevShadowLightRef = useRef(false);
  const [tilesetImages, setTilesetImages] = useState<Record<number, HTMLImageElement>>({});
  const [selectedRegion, setSelectedRegion] = useState(0);

  // Drag selection state for multi-tile selection
  const isDragging = useRef(false);
  const dragStartCell = useRef<{ col: number; row: number } | null>(null);
  const [dragCurrentCell, setDragCurrentCell] = useState<{ col: number; row: number } | null>(null);

  // Load ALL tileset images
  useEffect(() => {
    if (!currentMap || !currentMap.tilesetNames) {
      setTilesetImages({});
      return;
    }

    const names = currentMap.tilesetNames;
    const loaded: Record<number, HTMLImageElement> = {};
    let cancelled = false;
    let remaining = 0;

    for (let idx = 0; idx <= 8; idx++) {
      const name = names[idx];
      if (!name) continue;
      remaining++;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        loaded[idx] = img;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.onerror = () => {
        if (cancelled) return;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.src = `/api/resources/img_tilesets/${name}.png`;
    }

    if (remaining === 0) setTilesetImages({});

    return () => { cancelled = true; };
  }, [currentMap?.tilesetId, currentMap?.tilesetNames]);

  // Render B-E tab (simple tileset image)
  const renderNormalTab = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sheetIdx = TAB_SHEET_INDEX[activeTab][0];
    const img = tilesetImages[sheetIdx];

    if (!img) {
      canvas.width = 256;
      canvas.height = 100;
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No tileset', canvas.width / 2, 50);
      return;
    }

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Highlight selection (drag preview or committed selection)
    const offset = TAB_TILE_OFFSET[activeTab] ?? 0;

    // Convert localId (0~255) to image grid position (col, row) in 16-col layout
    // RPG Maker MV: left half (0~127) → cols 0-7, right half (128~255) → cols 8-15
    const localIdToCell = (localId: number) => {
      if (localId < 128) {
        return { col: localId % 8, row: Math.floor(localId / 8) };
      } else {
        return { col: 8 + (localId - 128) % 8, row: Math.floor((localId - 128) / 8) };
      }
    };

    if (isDragging.current && dragStartCell.current && dragCurrentCell) {
      // Drag preview highlight
      const minCol = Math.min(dragStartCell.current.col, dragCurrentCell.col);
      const maxCol = Math.max(dragStartCell.current.col, dragCurrentCell.col);
      const minRow = Math.min(dragStartCell.current.row, dragCurrentCell.row);
      const maxRow = Math.max(dragStartCell.current.row, dragCurrentCell.row);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
      const rx = minCol * TILE_SIZE_PX + 1;
      const ry = minRow * TILE_SIZE_PX + 1;
      const rw = (maxCol - minCol + 1) * TILE_SIZE_PX - 2;
      const rh = (maxRow - minRow + 1) * TILE_SIZE_PX - 2;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (selectedTiles && (selectedTilesWidth > 1 || selectedTilesHeight > 1)) {
      // Multi-tile committed selection: find top-left from selectedTileId
      const localId = selectedTileId - offset;
      if (localId >= 0 && localId < 256) {
        const cell = localIdToCell(localId);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        const rx = cell.col * TILE_SIZE_PX + 1;
        const ry = cell.row * TILE_SIZE_PX + 1;
        const rw = selectedTilesWidth * TILE_SIZE_PX - 2;
        const rh = selectedTilesHeight * TILE_SIZE_PX - 2;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      }
    } else {
      // Single tile selection
      const localId = selectedTileId - offset;
      if (localId >= 0 && localId < 256) {
        const cell = localIdToCell(localId);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(cell.col * TILE_SIZE_PX + 1, cell.row * TILE_SIZE_PX + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
      }
    }
  }, [activeTab, tilesetImages, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight, dragCurrentCell]);

  // Render A tab (autotile thumbnails grid)
  const renderATab = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = 8;
    const totalEntries = A_TILE_ENTRIES.length;
    const rows = Math.ceil(totalEntries / cols);
    const cw = cols * TILE_SIZE_PX;
    const ch = rows * TILE_SIZE_PX;
    canvas.width = cw;
    canvas.height = ch;

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, cw, ch);

    for (let i = 0; i < totalEntries; i++) {
      const entry = A_TILE_ENTRIES[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const dx = col * TILE_SIZE_PX;
      const dy = row * TILE_SIZE_PX;

      const img = tilesetImages[entry.sheet];
      if (!img) continue;

      const info = getTileRenderInfo(entry.tileId);
      if (!info) continue;

      if (info.type === 'normal') {
        ctx.drawImage(img, info.sx, info.sy, info.sw, info.sh, dx, dy, TILE_SIZE_PX, TILE_SIZE_PX);
      } else {
        const q = info.quarters;
        for (let j = 0; j < 4; j++) {
          const qimg = tilesetImages[q[j].sheet];
          if (!qimg) continue;
          const qdx = dx + (j % 2) * HALF;
          const qdy = dy + Math.floor(j / 2) * HALF;
          ctx.drawImage(qimg, q[j].sx, q[j].sy, HALF, HALF, qdx, qdy, HALF, HALF);
        }
      }

    }

    // Draw selection highlight for A tab
    if (isDragging.current && dragStartCell.current && dragCurrentCell) {
      const minCol = Math.min(dragStartCell.current.col, dragCurrentCell.col);
      const maxCol = Math.max(dragStartCell.current.col, dragCurrentCell.col);
      const minRow = Math.min(dragStartCell.current.row, dragCurrentCell.row);
      const maxRow = Math.max(dragStartCell.current.row, dragCurrentCell.row);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
      const rx = minCol * TILE_SIZE_PX + 1;
      const ry = minRow * TILE_SIZE_PX + 1;
      const rw = (maxCol - minCol + 1) * TILE_SIZE_PX - 2;
      const rh = (maxRow - minRow + 1) * TILE_SIZE_PX - 2;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (selectedTiles && (selectedTilesWidth > 1 || selectedTilesHeight > 1)) {
      // Multi-tile committed selection on A tab
      const startIdx = A_TILE_ENTRIES.findIndex(e => e.tileId === selectedTileId);
      if (startIdx >= 0) {
        const startCol = startIdx % cols;
        const startRow = Math.floor(startIdx / cols);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        const rx = startCol * TILE_SIZE_PX + 1;
        const ry = startRow * TILE_SIZE_PX + 1;
        const rw = selectedTilesWidth * TILE_SIZE_PX - 2;
        const rh = selectedTilesHeight * TILE_SIZE_PX - 2;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      }
    } else {
      // Single tile highlight
      for (let i = 0; i < totalEntries; i++) {
        if (selectedTileId === A_TILE_ENTRIES[i].tileId) {
          const sc = i % cols;
          const sr = Math.floor(i / cols);
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 2;
          ctx.strokeRect(sc * TILE_SIZE_PX + 1, sr * TILE_SIZE_PX + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
          break;
        }
      }
    }
  }, [tilesetImages, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight, dragCurrentCell]);

  // Main render
  useEffect(() => {
    if (activeTab === 'R' || activeTab === 'L') return; // R/L tabs don't use canvas
    if (activeTab === 'A') {
      renderATab();
    } else {
      renderNormalTab();
    }
  }, [activeTab, renderATab, renderNormalTab]);

  const canvasToCell = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      const cols = activeTab === 'A' ? 8 : 16;
      const col = Math.max(0, Math.min(cols - 1, Math.floor(cx / TILE_SIZE_PX)));
      const row = Math.max(0, Math.floor(cy / TILE_SIZE_PX));
      return { col, row };
    },
    [activeTab]
  );

  const getTileIdForCell = useCallback(
    (col: number, row: number): number => {
      if (activeTab === 'A') {
        const cols = 8;
        const idx = row * cols + col;
        if (idx >= 0 && idx < A_TILE_ENTRIES.length) {
          return A_TILE_ENTRIES[idx].tileId;
        }
        return 0;
      } else {
        // B-E tileset image layout: 16 cols (768px / 48px)
        // But RPG Maker MV tile ID mapping uses 8-col halves:
        //   Left half (col 0-7): localId = row * 8 + col       (0~127)
        //   Right half (col 8-15): localId = 128 + row * 8 + (col - 8) (128~255)
        const localId = col < 8
          ? row * 8 + col
          : 128 + row * 8 + (col - 8);
        const offset = TAB_TILE_OFFSET[activeTab] ?? 0;
        return offset + localId;
      }
    },
    [activeTab]
  );

  const commitSelection = useCallback(
    (startCol: number, startRow: number, endCol: number, endRow: number) => {
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const w = maxCol - minCol + 1;
      const h = maxRow - minRow + 1;

      const layer = activeTab === 'A' ? 0 : 1;
      setCurrentLayer(layer);

      if (w === 1 && h === 1) {
        // Single tile selection
        setSelectedTileId(getTileIdForCell(minCol, minRow));
      } else {
        // Multi-tile selection: build 2D array
        const tiles: number[][] = [];
        for (let r = 0; r < h; r++) {
          const rowTiles: number[] = [];
          for (let c = 0; c < w; c++) {
            rowTiles.push(getTileIdForCell(minCol + c, minRow + r));
          }
          tiles.push(rowTiles);
        }
        // Set the top-left tile as selectedTileId for backward compat
        const topLeftId = getTileIdForCell(minCol, minRow);
        useEditorStore.setState({ selectedTileId: topLeftId });
        setSelectedTiles(tiles, w, h);
      }
    },
    [activeTab, getTileIdForCell, setSelectedTileId, setSelectedTiles, setCurrentLayer]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const cell = canvasToCell(e);
      if (!cell) return;
      isDragging.current = true;
      dragStartCell.current = cell;
      setDragCurrentCell(cell);
    },
    [canvasToCell]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current || !dragStartCell.current) return;
      const cell = canvasToCell(e);
      if (!cell) return;
      setDragCurrentCell(cell);
    },
    [canvasToCell]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging.current || !dragStartCell.current) return;
      isDragging.current = false;
      const cell = canvasToCell(e);
      const start = dragStartCell.current;
      const end = cell || dragCurrentCell;
      if (!end) return;
      commitSelection(start.col, start.row, end.col, end.row);
      dragStartCell.current = null;
      setDragCurrentCell(null);
    },
    [canvasToCell, dragCurrentCell, commitSelection]
  );

  // Handle mouse leaving the canvas while dragging
  const handleMouseLeave = useCallback(
    () => {
      if (!isDragging.current || !dragStartCell.current) return;
      isDragging.current = false;
      const start = dragStartCell.current;
      const end = dragCurrentCell || start;
      commitSelection(start.col, start.row, end.col, end.row);
      dragStartCell.current = null;
      setDragCurrentCell(null);
    },
    [dragCurrentCell, commitSelection]
  );

  const handleTabClick = (tab: PaletteTab) => {
    setActiveTab(tab);
    if (tab === 'L') {
      // L탭 진입: 조명 모드 활성화 + 조명 자동 ON
      prevShadowLightRef.current = useEditorStore.getState().shadowLight;
      setLightEditMode(true);
      initEditorLights();
      setShadowLight(true);
    } else {
      // L탭 이탈: 조명 모드 비활성화, 이전 조명 상태 복원
      if (lightEditMode) {
        setLightEditMode(false);
        setShadowLight(prevShadowLightRef.current);
      }
      if (tab === 'R') {
        setCurrentLayer(5);
      } else if (currentMap) {
        const layer = useEditorStore.getState().currentLayer;
        if (layer === 5) {
          setCurrentLayer(tab === 'A' ? 0 : 1);
        }
      }
    }
  };

  const hasSheet = (tab: PaletteTab): boolean => {
    if (tab === 'R' || tab === 'L') return true;
    return TAB_SHEET_INDEX[tab].some(idx => !!tilesetImages[idx]);
  };

  return (
    <div style={styles.container}>
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <div
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
              ...(hasSheet(tab) ? {} : styles.tabDisabled),
            }}
            onClick={() => handleTabClick(tab)}
          >
            {tab}
          </div>
        ))}
      </div>
      <div style={styles.scrollArea}>
        {activeTab === 'L' ? (
          <div className="light-palette">
            <div className="light-palette-section-title">조명 타입</div>
            <div
              className={`light-type-item${selectedLightType === 'point' ? ' selected' : ''}`}
              onClick={() => setSelectedLightType('point')}
            >
              <div className="light-type-icon" style={{ backgroundColor: '#ffcc88' }} />
              포인트 라이트
            </div>
            <div
              className={`light-type-item${selectedLightType === 'ambient' ? ' selected' : ''}`}
              onClick={() => setSelectedLightType('ambient')}
            >
              <div className="light-type-icon" style={{ backgroundColor: '#667788' }} />
              앰비언트 라이트
            </div>
            <div
              className={`light-type-item${selectedLightType === 'directional' ? ' selected' : ''}`}
              onClick={() => setSelectedLightType('directional')}
            >
              <div className="light-type-icon" style={{ backgroundColor: '#fff8ee' }} />
              디렉셔널 라이트
            </div>

            {currentMap?.editorLights?.points && currentMap.editorLights.points.length > 0 && (
              <>
                <div className="light-palette-section-title" style={{ marginTop: 8 }}>
                  배치된 포인트 라이트 ({currentMap.editorLights.points.length})
                </div>
                <div className="light-point-list">
                  {currentMap.editorLights.points.map((pl) => (
                    <div
                      key={pl.id}
                      className={`light-point-item${selectedLightId === pl.id ? ' selected' : ''}`}
                      onClick={() => {
                        setSelectedLightType('point');
                        setSelectedLightId(pl.id);
                      }}
                    >
                      <div className="light-point-swatch" style={{ backgroundColor: pl.color }} />
                      #{pl.id} ({pl.x}, {pl.y})
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'R' ? (
          <div className="region-palette">
            {Array.from({ length: 256 }, (_, i) => (
              <div
                key={i}
                className={`region-cell${selectedRegion === i ? ' selected' : ''}`}
                onClick={() => {
                  setSelectedRegion(i);
                  setCurrentLayer(5);
                  setSelectedTileId(i);
                }}
                style={i > 0 ? { backgroundColor: `hsl(${(i * 137) % 360}, 50%, 30%)` } : undefined}
              >
                {i}
              </div>
            ))}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={styles.canvas}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid #444',
    flex: 1,
    minHeight: 0,
  },
  tabBar: {
    display: 'flex',
    background: '#2a2a2a',
    borderBottom: '1px solid #444',
  },
  tab: {
    padding: '3px 8px',
    fontSize: 11,
    color: '#aaa',
    cursor: 'pointer',
    borderRight: '1px solid #444',
    userSelect: 'none',
  },
  tabActive: {
    background: '#3a3a3a',
    color: '#fff',
    borderBottom: '2px solid #4a9eff',
  },
  tabDisabled: {
    color: '#555',
  },
  scrollArea: {
    flex: 1,
    overflow: 'auto',
    background: '#1e1e1e',
  },
  canvas: {
    display: 'block',
    width: '100%',
    cursor: 'crosshair',
    imageRendering: 'pixelated',
  },
};
