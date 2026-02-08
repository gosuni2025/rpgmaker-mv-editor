import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import {
  TILE_SIZE_PX, TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E,
  TILE_ID_A1, TILE_ID_A2, TILE_ID_A3, TILE_ID_A4, TILE_ID_A5,
  getTileRenderInfo,
} from '../../utils/tileHelper';

type PaletteTab = 'A' | 'B' | 'C' | 'D' | 'E' | 'R';
const TABS: PaletteTab[] = ['A', 'B', 'C', 'D', 'E', 'R'];

// Tab → tileset image index mapping
const TAB_SHEET_INDEX: Record<PaletteTab, number[]> = {
  A: [0, 1, 2, 3, 4], // A1-A5
  B: [5],
  C: [6],
  D: [7],
  E: [8],
  R: [],
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
  const setSelectedTileId = useEditorStore((s) => s.setSelectedTileId);
  const setCurrentLayer = useEditorStore((s) => s.setCurrentLayer);
  const currentMap = useEditorStore((s) => s.currentMap);

  const [activeTab, setActiveTab] = useState<PaletteTab>('A');
  const [tilesetImages, setTilesetImages] = useState<Record<number, HTMLImageElement>>({});
  const [selectedRegion, setSelectedRegion] = useState(0);

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

    // Highlight selected tile
    const offset = TAB_TILE_OFFSET[activeTab] ?? 0;
    const localId = selectedTileId - offset;
    if (localId >= 0 && localId < 256) {
      const cols = 16;
      const col = localId % cols;
      const row = Math.floor(localId / cols);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(col * TILE_SIZE_PX + 1, row * TILE_SIZE_PX + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
    }
  }, [activeTab, tilesetImages, selectedTileId]);

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

      // Highlight selected
      if (selectedTileId === entry.tileId) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx + 1, dy + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
      }
    }
  }, [tilesetImages, selectedTileId]);

  // Main render
  useEffect(() => {
    if (activeTab === 'R') return; // R tab doesn't use canvas
    if (activeTab === 'A') {
      renderATab();
    } else {
      renderNormalTab();
    }
  }, [activeTab, renderATab, renderNormalTab]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      const col = Math.floor(cx / TILE_SIZE_PX);
      const row = Math.floor(cy / TILE_SIZE_PX);

      if (activeTab === 'A') {
        const cols = 8;
        const idx = row * cols + col;
        if (idx >= 0 && idx < A_TILE_ENTRIES.length) {
          setSelectedTileId(A_TILE_ENTRIES[idx].tileId);
          setCurrentLayer(0); // A tiles go to lower layer
        }
      } else {
        const cols = 16;
        const localId = row * cols + col;
        const offset = TAB_TILE_OFFSET[activeTab] ?? 0;
        setSelectedTileId(offset + localId);
        setCurrentLayer(1); // B-E tiles go to upper layer
      }
    },
    [activeTab, setSelectedTileId, setCurrentLayer]
  );

  const handleTabClick = (tab: PaletteTab) => {
    setActiveTab(tab);
  };

  const hasSheet = (tab: PaletteTab): boolean => {
    if (tab === 'R') return true;
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
        {activeTab === 'R' ? (
          <div className="region-palette">
            {Array.from({ length: 256 }, (_, i) => (
              <div
                key={i}
                className={`region-cell${selectedRegion === i ? ' selected' : ''}`}
                onClick={() => {
                  setSelectedRegion(i);
                  setCurrentLayer(5); // Region layer
                  setSelectedTileId(i); // Use tileId for region
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
            onClick={handleClick}
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
