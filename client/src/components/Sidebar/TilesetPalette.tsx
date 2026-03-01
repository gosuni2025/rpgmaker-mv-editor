import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import {
  TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E,
  isGroundDecorationTile,
} from '../../utils/tileHelper';
import { loadTilesetImages } from '../../utils/tilesetImageLoader';
import { PaletteTileTooltip } from '../MapEditor/TileInfoTooltip';
import { renderNormalTab, renderATab, A_TILE_ENTRIES } from './paletteRenderers';
import './RegionPalette.css';
import './InspectorPanel.css';

type PaletteTab = 'A' | 'B' | 'C' | 'D' | 'E' | 'R';
const TABS: PaletteTab[] = ['A', 'B', 'C', 'D', 'E', 'R'];

const TAB_SHEET_INDEX: Record<PaletteTab, number[]> = {
  A: [0, 1, 2, 3, 4], B: [5], C: [6], D: [7], E: [8], R: [],
};

const TAB_TILE_OFFSET: Record<string, number> = {
  B: TILE_ID_B, C: TILE_ID_C, D: TILE_ID_D, E: TILE_ID_E,
};

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
  const editMode = useEditorStore((s) => s.editMode);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  const selectedLightType = useEditorStore((s) => s.selectedLightType);
  const setSelectedLightType = useEditorStore((s) => s.setSelectedLightType);
  const paletteTab = useEditorStore((s) => s.paletteTab);
  const setPaletteTab = useEditorStore((s) => s.setPaletteTab);
  const showTileInfo = useEditorStore((s) => s.showTileInfo);
  const transparentColor = useEditorStore((s) => s.transparentColor);
  const setShowTileInfo = useEditorStore((s) => s.setShowTileInfo);
  const activeTab = paletteTab as PaletteTab;
  const setActiveTab = setPaletteTab;
  const [tilesetImages, setTilesetImages] = useState<Record<number, HTMLImageElement>>({});
  const [selectedRegion, setSelectedRegion] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartCell = useRef<{ col: number; row: number } | null>(null);
  const [dragCurrentCell, setDragCurrentCell] = useState<{ col: number; row: number } | null>(null);
  const [paletteHover, setPaletteHover] = useState<{ tileId: number; mouseX: number; mouseY: number } | null>(null);

  useEffect(() => {
    if (!currentMap || !currentMap.tilesetNames) { setTilesetImages({}); return; }
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

  // Main render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || activeTab === 'R') return;
    const highlight = {
      isDragging: isDragging.current,
      dragStart: dragStartCell.current,
      dragCurrent: dragCurrentCell,
    };
    if (activeTab === 'A') {
      renderATab(canvas, tilesetImages, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight, transparentColor, { ctx: null as any, ...highlight }, containerWidth);
    } else {
      renderNormalTab(canvas, activeTab, tilesetImages, TAB_SHEET_INDEX, TAB_TILE_OFFSET, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight, transparentColor, { ctx: null as any, ...highlight }, containerWidth);
    }
  }, [activeTab, tilesetImages, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight, dragCurrentCell, transparentColor, containerWidth]);

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
      const tilePixelSize = canvas.width / cols; // 스케일된 타일 픽셀 크기 (정사각형)
      const col = Math.max(0, Math.min(cols - 1, Math.floor(cx / tilePixelSize)));
      const row = Math.max(0, Math.floor(cy / tilePixelSize));
      return { col, row };
    }, [activeTab]
  );

  const getTileIdForCell = useCallback(
    (col: number, row: number): number => {
      if (activeTab === 'A') {
        const idx = row * 8 + col;
        return idx >= 0 && idx < A_TILE_ENTRIES.length ? A_TILE_ENTRIES[idx].tileId : 0;
      }
      const localId = col < 8 ? row * 8 + col : 128 + row * 8 + (col - 8);
      return (TAB_TILE_OFFSET[activeTab] ?? 0) + localId;
    }, [activeTab]
  );

  const commitSelection = useCallback(
    (startCol: number, startRow: number, endCol: number, endRow: number) => {
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const w = maxCol - minCol + 1;
      const h = maxRow - minRow + 1;

      let layer: number;
      if (activeTab === 'A') {
        layer = isGroundDecorationTile(getTileIdForCell(minCol, minRow)) ? 1 : 0;
      } else { layer = 1; }
      setCurrentLayer(layer);

      if (w === 1 && h === 1) {
        setSelectedTileId(getTileIdForCell(minCol, minRow));
      } else {
        const tiles: number[][] = [];
        for (let r = 0; r < h; r++) {
          const rowTiles: number[] = [];
          for (let c = 0; c < w; c++) rowTiles.push(getTileIdForCell(minCol + c, minRow + r));
          tiles.push(rowTiles);
        }
        useEditorStore.setState({ selectedTileId: getTileIdForCell(minCol, minRow) });
        setSelectedTiles(tiles, w, h);
      }
    }, [activeTab, getTileIdForCell, setSelectedTileId, setSelectedTiles, setCurrentLayer]
  );

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
    if (showTileInfo && cell) {
      setPaletteHover({ tileId: getTileIdForCell(cell.col, cell.row), mouseX: e.clientX, mouseY: e.clientY });
    } else { setPaletteHover(null); }
  }, [canvasToCell, showTileInfo, getTileIdForCell]);

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
    setPaletteHover(null);
    if (!isDragging.current || !dragStartCell.current) return;
    isDragging.current = false;
    const end = dragCurrentCell || dragStartCell.current;
    commitSelection(dragStartCell.current.col, dragStartCell.current.row, end.col, end.row);
    dragStartCell.current = null;
    setDragCurrentCell(null);
  }, [dragCurrentCell, commitSelection]);

  const handleTabClick = (tab: PaletteTab) => {
    setActiveTab(tab);
    if (tab === 'R') { setCurrentLayer(5); }
    else if (currentMap) {
      const layer = useEditorStore.getState().currentLayer;
      if (layer === 5) setCurrentLayer(tab === 'A' ? 0 : 1);
    }
  };

  useEffect(() => {
    if (editMode === 'object' && activeTab === 'R') handleTabClick('A');
  }, [editMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasSheet = (tab: PaletteTab): boolean => {
    if (tab === 'R') return true;
    return TAB_SHEET_INDEX[tab].some(idx => !!tilesetImages[idx]);
  };

  return (
    <div style={styles.container}>
      {editMode === 'light' ? (
        <div style={styles.scrollArea}>
          <div className="light-palette">
            <div className="light-palette-section-title">조명 타입</div>
            {[
              { type: 'point' as const, color: '#ffcc88', label: '점 조명' },
              { type: 'ambient' as const, color: '#667788', label: '환경광' },
              { type: 'directional' as const, color: '#fff8ee', label: '방향 조명' },
            ].map(({ type, color, label }) => (
              <div key={type} className={`light-type-item${selectedLightType === type ? ' selected' : ''}`}
                onClick={() => setSelectedLightType(type)}>
                <div className="light-type-icon" style={{ backgroundColor: color }} />
                {label}
              </div>
            ))}
            <div className="light-palette-section-title" style={{ marginTop: 8 }}>플레이어</div>
            {[
              { type: 'playerLight' as const, color: '#a25f06', label: '플레이어 조명' },
              { type: 'spotLight' as const, color: '#ffeedd', label: '집중 조명' },
            ].map(({ type, color, label }) => (
              <div key={type} className={`light-type-item${selectedLightType === type ? ' selected' : ''}`}
                onClick={() => setSelectedLightType(type)}>
                <div className="light-type-icon" style={{ backgroundColor: color }} />
                {label}
              </div>
            ))}
            {currentMap?.editorLights?.points && currentMap.editorLights.points.length > 0 && (
              <>
                <div className="light-palette-section-title" style={{ marginTop: 8 }}>
                  배치된 점 조명 ({currentMap.editorLights.points.length})
                </div>
                <div className="light-point-list">
                  {currentMap.editorLights.points.map((pl) => (
                    <div key={pl.id}
                      className={`light-point-item${selectedLightId === pl.id ? ' selected' : ''}`}
                      onClick={() => useEditorStore.setState({ selectedLightType: 'point', selectedLightId: pl.id })}>
                      <div className="light-point-swatch" style={{ backgroundColor: pl.color }} />
                      #{pl.id} ({pl.x}, {pl.y})
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
        <div style={styles.tabBar}>
          {TABS.filter((tab) => !(editMode === 'object' && tab === 'R')).map((tab) => (
            <div key={tab}
              style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}), ...(hasSheet(tab) ? {} : styles.tabDisabled) }}
              onClick={() => handleTabClick(tab)}>{tab}</div>
          ))}
          <label style={styles.tileInfoToggle} title="맵에서 타일 정보 툴팁 표시">
            <input type="checkbox" checked={showTileInfo} onChange={(e) => setShowTileInfo(e.target.checked)} style={{ margin: 0, marginRight: 3 }} />
            <span style={{ fontSize: 10 }}>정보</span>
          </label>
          <div style={styles.openFolderBtn} title="타일셋 폴더 열기"
            onClick={() => { apiClient.post('/resources/img_tilesets/open-folder', {}).catch(() => {}); }}>📂</div>
        </div>
        <div ref={scrollAreaRef} style={styles.scrollArea}>
          {activeTab === 'R' ? (
            <div className="region-palette">
              {Array.from({ length: 256 }, (_, i) => (
                <div key={i} className={`region-cell${selectedRegion === i ? ' selected' : ''}`}
                  onClick={() => { setSelectedRegion(i); setCurrentLayer(5); setSelectedTileId(i); }}
                  style={i > 0 ? { backgroundColor: `hsl(${(i * 137) % 360}, 50%, 30%)` } : undefined}>{i}</div>
              ))}
            </div>
          ) : (
            <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} style={styles.canvas} />
          )}
        </div>
        {showTileInfo && paletteHover && paletteHover.tileId !== 0 && (
          <PaletteTileTooltip tileId={paletteHover.tileId} mouseX={paletteHover.mouseX}
            mouseY={paletteHover.mouseY} tilesetNames={currentMap?.tilesetNames} />
        )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', borderTop: '1px solid #444', flex: 1, minHeight: 0 },
  tabBar: { display: 'flex', background: '#2a2a2a', borderBottom: '1px solid #444' },
  tab: { padding: '3px 8px', fontSize: 11, color: '#aaa', cursor: 'pointer', borderRight: '1px solid #444', userSelect: 'none' },
  tabActive: { background: '#3a3a3a', color: '#fff', borderBottom: '2px solid #4a9eff' },
  tabDisabled: { color: '#555' },
  tileInfoToggle: { marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '1px 4px', cursor: 'pointer', userSelect: 'none', color: '#aaa', fontSize: 10 },
  openFolderBtn: { padding: '3px 6px', fontSize: 12, cursor: 'pointer', userSelect: 'none', opacity: 0.7 },
  scrollArea: { flex: 1, overflow: 'auto', background: '#1e1e1e' },
  canvas: { display: 'block', width: '100%', cursor: 'crosshair', imageRendering: 'pixelated' },
};
