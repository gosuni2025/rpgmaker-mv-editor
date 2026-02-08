import React, { useState, useRef, useEffect, useCallback } from 'react';

interface TileFlagsEditorProps {
  flags: number[];
  tilesetNames: string[];
  onChange: (flags: number[]) => void;
}

// Flag bits
const FLAG_DOWN = 0x01;
const FLAG_LEFT = 0x02;
const FLAG_RIGHT = 0x04;
const FLAG_UP = 0x08;
const FLAG_PASSAGE = 0x0F;
const FLAG_STAR = 0x10;
const FLAG_LADDER = 0x20;
const FLAG_BUSH = 0x40;
const FLAG_COUNTER = 0x80;
const FLAG_DAMAGE = 0x100;

// Tile ID ranges
const TILE_ID_B = 0;
const TILE_ID_A5 = 1536;
const TILE_ID_A1 = 2048;
const TILE_ID_A2 = 2816;
const TILE_ID_A3 = 4352;
const TILE_ID_A4 = 5888;

const TABS = ['A1', 'A2', 'A3', 'A4', 'A5', 'B', 'C', 'D', 'E'] as const;
type TabName = typeof TABS[number];

const MODES = [
  { label: 'Passage', value: 'passage' },
  { label: '4-Dir Passage', value: '4dir' },
  { label: 'Ladder', value: 'ladder' },
  { label: 'Bush', value: 'bush' },
  { label: 'Counter', value: 'counter' },
  { label: 'Damage Floor', value: 'damage' },
  { label: 'Terrain Tag', value: 'terrain' },
] as const;

type Mode = typeof MODES[number]['value'];

const TILE_SIZE = 24; // Display size (half of 48)

function getTabConfig(tab: TabName) {
  switch (tab) {
    case 'B': return { cols: 16, rows: 16, baseId: TILE_ID_B + 0, tilesetIdx: 5 };
    case 'C': return { cols: 16, rows: 16, baseId: TILE_ID_B + 256, tilesetIdx: 6 };
    case 'D': return { cols: 16, rows: 16, baseId: TILE_ID_B + 512, tilesetIdx: 7 };
    case 'E': return { cols: 16, rows: 16, baseId: TILE_ID_B + 768, tilesetIdx: 8 };
    case 'A5': return { cols: 8, rows: 16, baseId: TILE_ID_A5, tilesetIdx: 4 };
    case 'A1': return { cols: 8, rows: 4, baseId: TILE_ID_A1, tilesetIdx: 0, isAutotile: true, kindsPerRow: 4, kindCount: 16 };
    case 'A2': return { cols: 8, rows: 4, baseId: TILE_ID_A2, tilesetIdx: 1, isAutotile: true, kindsPerRow: 8, kindCount: 32 };
    case 'A3': return { cols: 8, rows: 4, baseId: TILE_ID_A3, tilesetIdx: 2, isAutotile: true, kindsPerRow: 8, kindCount: 32 };
    case 'A4': return { cols: 8, rows: 6, baseId: TILE_ID_A4, tilesetIdx: 3, isAutotile: true, kindsPerRow: 8, kindCount: 48 };
    default: return { cols: 16, rows: 16, baseId: 0, tilesetIdx: 5 };
  }
}

function getTileId(tab: TabName, col: number, row: number): number {
  const config = getTabConfig(tab);
  if ((config as { isAutotile?: boolean }).isAutotile) {
    const kind = row * (config as { kindsPerRow: number }).kindsPerRow + col;
    return config.baseId + kind * 48;
  }
  return config.baseId + row * config.cols + col;
}

export default function TileFlagsEditor({ flags, tilesetNames, onChange }: TileFlagsEditorProps) {
  const [activeTab, setActiveTab] = useState<TabName>('B');
  const [mode, setMode] = useState<Mode>('passage');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const config = getTabConfig(activeTab);
  const tilesetName = tilesetNames[config.tilesetIdx] || '';

  // Load tileset image
  useEffect(() => {
    setImgLoaded(false);
    if (!tilesetName) {
      imgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => {
      imgRef.current = null;
    };
    const name = tilesetName.includes('.') ? tilesetName : tilesetName + '.png';
    img.src = `/api/resources/tilesets/${name}`;
  }, [tilesetName, activeTab]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { cols, rows } = config;
    const w = cols * TILE_SIZE;
    const h = rows * TILE_SIZE;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, w, h);

    const img = imgRef.current;
    if (img && imgLoaded) {
      // For B-E and A5: direct tile mapping
      // For A1-A4 autotiles: show one representative tile per kind
      const isAutotile = (config as { isAutotile?: boolean }).isAutotile;
      if (!isAutotile) {
        // Simple tiles: draw the whole image scaled
        const srcTileSize = 48;
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            ctx.drawImage(img,
              col * srcTileSize, row * srcTileSize, srcTileSize, srcTileSize,
              col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE
            );
          }
        }
      } else {
        // Autotiles: show representative image for each kind
        drawAutotileGrid(ctx, img, activeTab, config);
      }
    }

    // Draw flag overlays
    const { cols: c, rows: r } = config;
    for (let row = 0; row < r; row++) {
      for (let col = 0; col < c; col++) {
        const tileId = getTileId(activeTab, col, row);
        const flag = flags[tileId] || 0;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        drawFlagOverlay(ctx, x, y, TILE_SIZE, flag, mode);
      }
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    for (let row = 0; row <= r; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * TILE_SIZE);
      ctx.lineTo(c * TILE_SIZE, row * TILE_SIZE);
      ctx.stroke();
    }
    for (let col = 0; col <= c; col++) {
      ctx.beginPath();
      ctx.moveTo(col * TILE_SIZE, 0);
      ctx.lineTo(col * TILE_SIZE, r * TILE_SIZE);
      ctx.stroke();
    }
  }, [config, flags, mode, imgLoaded, activeTab]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const row = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    if (col < 0 || col >= config.cols || row < 0 || row >= config.rows) return;

    const tileId = getTileId(activeTab, col, row);
    const newFlags = [...flags];
    while (newFlags.length <= tileId + 47) newFlags.push(0);

    const current = newFlags[tileId] || 0;
    let newFlag = current;

    switch (mode) {
      case 'passage':
        // Cycle: passable(0) → impassable(0x0F) → star(0x10)
        if ((current & FLAG_STAR) !== 0) {
          newFlag = current & ~FLAG_STAR & ~FLAG_PASSAGE;
        } else if ((current & FLAG_PASSAGE) === FLAG_PASSAGE) {
          newFlag = (current & ~FLAG_PASSAGE) | FLAG_STAR;
        } else {
          newFlag = current | FLAG_PASSAGE;
        }
        break;
      case '4dir': {
        // Determine which quadrant was clicked
        const relX = (e.clientX - canvas.getBoundingClientRect().left) - col * TILE_SIZE;
        const relY = (e.clientY - canvas.getBoundingClientRect().top) - row * TILE_SIZE;
        const mid = TILE_SIZE / 2;
        let dirBit = 0;
        if (relY > mid + 2) dirBit = FLAG_DOWN;
        else if (relY < mid - 2) dirBit = FLAG_UP;
        else if (relX < mid - 2) dirBit = FLAG_LEFT;
        else dirBit = FLAG_RIGHT;
        newFlag = current ^ dirBit;
        break;
      }
      case 'ladder': newFlag = current ^ FLAG_LADDER; break;
      case 'bush': newFlag = current ^ FLAG_BUSH; break;
      case 'counter': newFlag = current ^ FLAG_COUNTER; break;
      case 'damage': newFlag = current ^ FLAG_DAMAGE; break;
      case 'terrain': {
        const currentTag = (current >> 12) & 0x0F;
        const nextTag = (currentTag + 1) % 8;
        newFlag = (current & 0x0FFF) | (nextTag << 12);
        break;
      }
    }

    // For autotiles, apply to all 48 shapes of the kind
    const isAutotile = (config as { isAutotile?: boolean }).isAutotile;
    if (isAutotile) {
      for (let s = 0; s < 48; s++) {
        newFlags[tileId + s] = newFlag;
      }
    } else {
      newFlags[tileId] = newFlag;
    }

    onChange(newFlags);
  };

  return (
    <div>
      <div className="db-form-section">Tile Flags</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            className="db-btn-small"
            style={tab === activeTab ? { background: '#2675bf', borderColor: '#2675bf', color: '#fff' } : {}}
            onClick={() => { setActiveTab(tab); setImgLoaded(false); }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <button
            key={m.value}
            className="db-btn-small"
            style={m.value === mode ? { background: '#bf6226', borderColor: '#bf6226', color: '#fff' } : { fontSize: 11 }}
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {!tilesetName && (
        <div style={{ color: '#666', fontSize: 12, padding: 8 }}>No tileset image assigned for {activeTab}</div>
      )}
      <div style={{ overflow: 'auto', maxHeight: 400, border: '1px solid #444' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: 'pointer' }}
          onClick={handleClick}
        />
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
        {mode === 'passage' && 'Click: ○ (passable) → × (impassable) → ☆ (star)'}
        {mode === '4dir' && 'Click direction quadrant to toggle individual passage'}
        {mode === 'ladder' && 'Click to toggle ladder flag'}
        {mode === 'bush' && 'Click to toggle bush flag'}
        {mode === 'counter' && 'Click to toggle counter flag'}
        {mode === 'damage' && 'Click to toggle damage floor flag'}
        {mode === 'terrain' && 'Click to cycle terrain tag (0-7)'}
      </div>
    </div>
  );
}

function drawAutotileGrid(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  tab: TabName,
  config: ReturnType<typeof getTabConfig>
) {
  const srcTileSize = 48;
  const { cols, rows } = config;

  // For autotiles, each kind occupies a 2x3 (96x144) or 2x2 block in the source image
  // A1: 768x576 — 4 animations per row, 2 rows per block, complex layout
  // A2: 768x576 — 8 kinds per row (each 96x144), 4 rows of kinds
  // A3: 768x384 — 8 kinds per row (each 96x96), wall tiles
  // A4: 768x720 — 8 kinds per row, mixed floor/wall

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Source position: each kind is a 2-tile-wide block
      let sx: number, sy: number;
      if (tab === 'A1') {
        // A1 has complex layout: 4 animation sets per row, 2 rows
        // Each animation set: 2 columns x 3 rows of autotile sources = 96x144
        // Row 0-1: kind 0-7 (water/deep water)
        // Row 2-3: kind 8-15 (waterfall)
        const kindIdx = row * 4 + col;
        const blockCol = (kindIdx % 4);
        const blockRow = Math.floor(kindIdx / 4);
        sx = blockCol * 2 * srcTileSize;
        sy = blockRow * 3 * srcTileSize;
      } else if (tab === 'A2') {
        sx = col * 2 * srcTileSize;
        sy = row * 3 * srcTileSize;
      } else if (tab === 'A3') {
        sx = col * 2 * srcTileSize;
        sy = row * 2 * srcTileSize;
      } else if (tab === 'A4') {
        // A4: alternating floor (3-row) and wall (2-row) blocks
        // Row 0: floor (8 kinds, 3 src rows each)
        // Row 1: wall (8 kinds, 2 src rows each)
        // etc
        const isWall = row % 2 === 1;
        const srcRow = Math.floor(row / 2) * 5 + (isWall ? 3 : 0);
        sx = col * 2 * srcTileSize;
        sy = srcRow * srcTileSize;
      } else {
        sx = col * srcTileSize;
        sy = row * srcTileSize;
      }
      ctx.drawImage(img,
        sx, sy, srcTileSize * 2, srcTileSize * 2,
        col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE
      );
    }
  }
}

function drawFlagOverlay(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  flag: number, mode: Mode
) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.font = `${Math.floor(size * 0.5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (mode) {
    case 'passage': {
      if ((flag & FLAG_STAR) !== 0) {
        ctx.fillStyle = 'rgba(0,100,255,0.5)';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillText('☆', cx, cy);
      } else if ((flag & FLAG_PASSAGE) === FLAG_PASSAGE) {
        ctx.fillStyle = 'rgba(255,0,0,0.4)';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillText('×', cx, cy);
      } else if ((flag & FLAG_PASSAGE) !== 0) {
        ctx.fillStyle = 'rgba(255,165,0,0.4)';
        ctx.fillRect(x, y, size, size);
      } else {
        ctx.fillStyle = 'rgba(0,255,0,0.25)';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillText('○', cx, cy);
      }
      break;
    }
    case '4dir': {
      const q = size / 4;
      // Draw each direction
      const dirs = [
        { bit: FLAG_UP, dx: cx, dy: y + q },
        { bit: FLAG_DOWN, dx: cx, dy: y + size - q },
        { bit: FLAG_LEFT, dx: x + q, dy: cy },
        { bit: FLAG_RIGHT, dx: x + size - q, dy: cy },
      ];
      ctx.font = `${Math.floor(size * 0.3)}px sans-serif`;
      for (const d of dirs) {
        const blocked = (flag & d.bit) !== 0;
        ctx.fillStyle = blocked ? 'rgba(255,0,0,0.6)' : 'rgba(0,255,0,0.4)';
        ctx.beginPath();
        ctx.arc(d.dx, d.dy, q * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(blocked ? '×' : '○', d.dx, d.dy);
      }
      break;
    }
    case 'ladder': {
      if ((flag & FLAG_LADDER) !== 0) {
        ctx.fillStyle = 'rgba(255,200,0,0.5)';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillText('L', cx, cy);
      }
      break;
    }
    case 'bush': {
      if ((flag & FLAG_BUSH) !== 0) {
        ctx.fillStyle = 'rgba(0,200,0,0.5)';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillText('B', cx, cy);
      }
      break;
    }
    case 'counter': {
      if ((flag & FLAG_COUNTER) !== 0) {
        ctx.fillStyle = 'rgba(200,0,200,0.5)';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillText('C', cx, cy);
      }
      break;
    }
    case 'damage': {
      if ((flag & FLAG_DAMAGE) !== 0) {
        ctx.fillStyle = 'rgba(255,0,0,0.5)';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillText('D', cx, cy);
      }
      break;
    }
    case 'terrain': {
      const tag = (flag >> 12) & 0x0F;
      if (tag > 0) {
        ctx.fillStyle = 'rgba(100,100,255,0.5)';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#fff';
        ctx.fillText(String(tag), cx, cy);
      }
      break;
    }
  }
}
