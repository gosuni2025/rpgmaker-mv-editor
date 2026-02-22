import React, { useState, useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { memHistory, SAMPLE_INTERVAL, formatBytes, formatBytesDelta } from './memoryMonitor';

function generateMemoryReport(): string {
  const w = window as unknown as Record<string, unknown>;
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } };
  const lines: string[] = [];
  const ts = new Date().toISOString();

  lines.push(`=== Memory Diagnostic Report ===`);
  lines.push(`Time: ${ts}`);
  lines.push('');

  if (perf.memory) {
    lines.push(`[JS Heap]`);
    lines.push(`  Used:  ${formatBytes(perf.memory.usedJSHeapSize)}`);
    lines.push(`  Total: ${formatBytes(perf.memory.totalJSHeapSize)}`);
    lines.push(`  Limit: ${formatBytes(perf.memory.jsHeapSizeLimit)}`);
    lines.push('');
  }

  if (memHistory.length > 1) {
    const first = memHistory[0];
    const last = memHistory[memHistory.length - 1];
    const elapsed = ((last.time - first.time) / 1000).toFixed(0);
    const delta = last.used - first.used;
    const rate = delta / ((last.time - first.time) / 1000);
    lines.push(`[Trend] ${elapsed}s 추적`);
    lines.push(`  시작: ${formatBytes(first.used)} -> 현재: ${formatBytes(last.used)}`);
    lines.push(`  변화: ${formatBytesDelta(delta)}  (${formatBytesDelta(rate)}/s)`);
    const idx30 = Math.max(0, memHistory.length - 31);
    const d30 = last.used - memHistory[idx30].used;
    lines.push(`  최근 30s: ${formatBytesDelta(d30)}`);
    lines.push('');
  }

  let scene: unknown = null;
  try {
    if ((w._editorSpriteset as { _tilemap?: { parent?: unknown; _scene?: unknown } })?._tilemap?.parent) {
      let node = (w._editorSpriteset as { _tilemap: { parent: unknown; _scene?: unknown } })._tilemap;
      while ((node as { parent?: unknown }).parent) node = (node as { parent: typeof node }).parent;
      if ((node as { _scene?: unknown })._scene) scene = (node as { _scene: unknown })._scene;
    }
  } catch {}
  if (!scene && (w.RendererStrategy as { getStrategy?: () => { _rendererObj?: { scene?: unknown } } })?.getStrategy) {
    try {
      const strategy = (w.RendererStrategy as { getStrategy: () => { _rendererObj?: { scene?: unknown } } }).getStrategy();
      if (strategy?._rendererObj?.scene) scene = strategy._rendererObj.scene;
    } catch {}
  }

  if (scene) {
    const counts: Record<string, number> = {};
    let totalObjects = 0;
    (scene as { traverse: (cb: (obj: unknown) => void) => void }).traverse((obj: unknown) => {
      totalObjects++;
      const o = obj as { constructor?: { name: string }; type?: string };
      const type = o.constructor?.name || o.type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    lines.push(`[Three.js Scene]`);
    lines.push(`  총 오브젝트: ${totalObjects}`);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sorted.slice(0, 15)) {
      lines.push(`  ${type}: ${count}`);
    }
    let editorCount = 0;
    (scene as { traverse: (cb: (obj: unknown) => void) => void }).traverse((obj: unknown) => { if ((obj as { userData?: { editorGrid?: boolean } }).userData?.editorGrid) editorCount++; });
    lines.push(`  에디터 오버레이(editorGrid): ${editorCount}`);
    let geomCount = 0, matCount = 0, texCount = 0;
    (scene as { traverse: (cb: (obj: unknown) => void) => void }).traverse((obj: unknown) => {
      const o = obj as { geometry?: unknown; material?: { map?: unknown } };
      if (o.geometry) geomCount++;
      if (o.material) { matCount++; if (o.material.map) texCount++; }
    });
    lines.push(`  Geometry: ${geomCount}, Material: ${matCount}, Texture(map): ${texCount}`);
    lines.push('');
  } else {
    lines.push(`[Three.js Scene] 접근 불가`);
    lines.push('');
  }

  try {
    const strategy = (w.RendererStrategy as { getStrategy?: () => { _rendererObj?: { renderer?: { info?: { memory?: { geometries?: number; textures?: number }; programs?: unknown[]; render?: { calls?: number; triangles?: number } } } } } })?.getStrategy?.();
    const renderer = strategy?._rendererObj?.renderer;
    if (renderer?.info) {
      const info = renderer.info;
      lines.push(`[WebGL Renderer Info]`);
      lines.push(`  Geometries: ${info.memory?.geometries ?? '?'}`);
      lines.push(`  Textures: ${info.memory?.textures ?? '?'}`);
      lines.push(`  Programs: ${info.programs?.length ?? '?'}`);
      lines.push(`  Render calls: ${info.render?.calls ?? '?'}`);
      lines.push(`  Triangles: ${info.render?.triangles ?? '?'}`);
      lines.push('');
    }
  } catch {}

  if (w.ImageManager) {
    const im = w.ImageManager as { _imageCache?: { _items?: Record<string, { bitmap?: { width: number; height: number } }> }; cache?: { _inner?: Record<string, unknown> } };
    lines.push(`[ImageManager Cache]`);
    if (im._imageCache?._items) {
      const items = im._imageCache._items;
      const keys = Object.keys(items);
      let totalPixels = 0;
      const entries: string[] = [];
      for (const key of keys) {
        const bmp = items[key]?.bitmap;
        if (bmp) {
          const pixels = (bmp.width || 0) * (bmp.height || 0);
          totalPixels += pixels;
          entries.push(`    ${key} (${bmp.width}x${bmp.height} = ${formatBytes(pixels * 4)})`);
        }
      }
      lines.push(`  ImageCache 항목: ${keys.length}개, ~${formatBytes(totalPixels * 4)}`);
      for (const e of entries) lines.push(e);
    }
    if (im.cache?._inner) {
      lines.push(`  CacheMap 항목: ${Object.keys(im.cache._inner).length}개`);
    }
    lines.push('');
  }

  lines.push(`[Editor Global Arrays]`);
  for (const key of ['_editorSelectionMeshes', '_editorDragMeshes', '_editorMoveRouteMeshes']) {
    const arr = w[key] as unknown[];
    lines.push(`  ${key}: ${arr?.length ?? 0}개`);
  }
  lines.push('');

  if (w.ShadowLight) {
    const sl = w.ShadowLight as { _active?: boolean; _editorPointLights?: unknown[]; _editorLightMarkers?: unknown[]; _editorSunLights?: unknown[] };
    lines.push(`[ShadowLight]`);
    lines.push(`  _active: ${sl._active}`);
    lines.push(`  _editorPointLights: ${sl._editorPointLights?.length ?? 0}개`);
    lines.push(`  _editorLightMarkers: ${sl._editorLightMarkers?.length ?? 0}개`);
    lines.push(`  _editorSunLights: ${sl._editorSunLights?.length ?? 0}개`);
    lines.push('');
  }

  const spriteset = w._editorSpriteset as { _characterSprites?: unknown[]; _objectSprites?: unknown[]; _tilemap?: { children?: unknown[]; bitmaps?: unknown[] } } | undefined;
  if (spriteset) {
    lines.push(`[Spriteset_Map]`);
    lines.push(`  _characterSprites: ${spriteset._characterSprites?.length ?? 0}개`);
    lines.push(`  _objectSprites: ${spriteset._objectSprites?.length ?? 0}개`);
    if (spriteset._tilemap) {
      lines.push(`  Tilemap children: ${spriteset._tilemap.children?.length ?? 0}개`);
      lines.push(`  Tilemap bitmaps: ${spriteset._tilemap.bitmaps?.length ?? 0}개`);
    }
    lines.push('');
  }

  if (w.$dataMap) {
    const dm = w.$dataMap as { data?: unknown[]; events?: unknown[]; width?: number; height?: number };
    lines.push(`[Map Data]`);
    lines.push(`  data length: ${dm.data?.length ?? 0}`);
    lines.push(`  events: ${dm.events?.length ?? 0}개`);
    lines.push(`  width: ${dm.width}, height: ${dm.height}`);
    lines.push('');
  }

  const store = useEditorStore.getState() as { currentMap?: { data?: unknown[] }; undoStack?: { changes?: unknown[] }[]; redoStack?: unknown[] };
  if (store) {
    lines.push(`[Zustand Store]`);
    const mapData = store.currentMap?.data;
    if (mapData) {
      lines.push(`  currentMap.data: ${mapData.length}개 (~${formatBytes(mapData.length * 8)})`);
    }
    lines.push(`  undoStack: ${store.undoStack?.length ?? 0}개`);
    lines.push(`  redoStack: ${store.redoStack?.length ?? 0}개`);
    if (store.undoStack?.length && store.undoStack.length > 0) {
      let undoChanges = 0;
      for (const entry of store.undoStack) {
        if (entry.changes) undoChanges += entry.changes.length;
      }
      lines.push(`  undoStack 총 changes: ${undoChanges}개`);
    }
    lines.push('');
  }

  lines.push(`[History CSV (최근 60s)]`);
  lines.push(`  sec, used_mb, total_mb`);
  const recent = Math.max(0, memHistory.length - 61);
  const ref = memHistory.length > 0 ? memHistory[memHistory.length - 1].time : 0;
  for (let i = recent; i < memHistory.length; i++) {
    const s = memHistory[i];
    lines.push(`  ${((s.time - ref) / 1000).toFixed(0)}, ${(s.used / 1048576).toFixed(2)}, ${(s.total / 1048576).toFixed(2)}`);
  }

  return lines.join('\n');
}

export default function MemoryGraph({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const logRef = useRef<HTMLTextAreaElement>(null);
  const [showLog, setShowLog] = useState(false);
  const [logText, setLogText] = useState('');

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), SAMPLE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth;
    const h = cvs.clientHeight;
    cvs.width = w * dpr;
    cvs.height = h * dpr;
    ctx.scale(dpr, dpr);

    const samples = memHistory;
    if (samples.length < 2) {
      ctx.fillStyle = '#999';
      ctx.font = '12px monospace';
      ctx.fillText('데이터 수집 중...', 10, h / 2);
      return;
    }

    let minUsed = Infinity, maxUsed = 0;
    let minTotal = Infinity, maxTotal = 0;
    for (const s of samples) {
      if (s.used < minUsed) minUsed = s.used;
      if (s.used > maxUsed) maxUsed = s.used;
      if (s.total < minTotal) minTotal = s.total;
      if (s.total > maxTotal) maxTotal = s.total;
    }

    const yMin = Math.min(minUsed, minTotal) * 0.95;
    const yMax = Math.max(maxUsed, maxTotal) * 1.05;
    const yRange = yMax - yMin || 1;

    const pad = { top: 30, bottom: 30, left: 60, right: 20 };
    const gw = w - pad.left - pad.right;
    const gh = h - pad.top - pad.bottom;

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#333';
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const val = yMin + (yRange * i) / ySteps;
      const y = pad.top + gh - (gh * i) / ySteps;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillText(formatBytes(val), pad.left - 4, y + 3);
    }

    ctx.textAlign = 'center';
    const tStart = samples[0].time;
    const tEnd = samples[samples.length - 1].time;
    const tRange = tEnd - tStart || 1;
    const xSteps = Math.min(6, samples.length - 1);
    for (let i = 0; i <= xSteps; i++) {
      const t = tStart + (tRange * i) / xSteps;
      const x = pad.left + (gw * i) / xSteps;
      const sec = Math.round((t - tEnd) / 1000);
      ctx.fillText(sec + 's', x, h - pad.bottom + 16);
    }

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100,100,255,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < samples.length; i++) {
      const x = pad.left + (gw * (samples[i].time - tStart)) / tRange;
      const y = pad.top + gh - (gh * (samples[i].total - yMin)) / yRange;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    for (let i = 0; i < samples.length; i++) {
      const x = pad.left + (gw * (samples[i].time - tStart)) / tRange;
      const y = pad.top + gh - (gh * (samples[i].used - yMin)) / yRange;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const lastX = pad.left + (gw * (samples[samples.length - 1].time - tStart)) / tRange;
    ctx.lineTo(lastX, pad.top + gh);
    ctx.lineTo(pad.left, pad.top + gh);
    ctx.closePath();
    ctx.fillStyle = 'rgba(79,195,247,0.1)';
    ctx.fill();

    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText('● Used Heap', pad.left + 4, 14);
    ctx.fillStyle = 'rgba(100,100,255,0.7)';
    ctx.fillText('● Total Heap', pad.left + 120, 14);

    const cur = samples[samples.length - 1];
    const prev30 = samples[Math.max(0, samples.length - 31)];
    const delta = cur.used - prev30.used;
    const deltaStr = formatBytesDelta(delta);
    const deltaColor = delta > 0 ? '#ff8a80' : '#69f0ae';

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ccc';
    ctx.fillText(`현재: ${formatBytes(cur.used)}`, w - pad.right, 14);
    ctx.fillStyle = deltaColor;
    ctx.fillText(`Δ30s: ${deltaStr}`, w - pad.right, 26);
  });

  const handleSnapshot = useCallback(() => {
    const report = generateMemoryReport();
    setLogText(report);
    setShowLog(true);
    setCopied(false);
  }, []);

  const handleCopy = useCallback(() => {
    if (logRef.current) {
      logRef.current.select();
      navigator.clipboard.writeText(logRef.current.value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, []);

  return (
    <div className="memory-graph-popup" style={showLog ? { width: 640 } : undefined}>
      <div className="memory-graph-header">
        <span>JS Heap 메모리 모니터</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleSnapshot} title="진단 리포트 생성">리포트</button>
          <button onClick={onClose}>✕</button>
        </div>
      </div>
      <canvas ref={canvasRef} className="memory-graph-canvas" />
      <div className="memory-graph-footer">
        {memHistory.length > 1 && (() => {
          const cur = memHistory[memHistory.length - 1];
          const first = memHistory[0];
          const totalDelta = cur.used - first.used;
          const elapsed = ((cur.time - first.time) / 1000).toFixed(0);
          const perf = performance as Performance & { memory?: { jsHeapSizeLimit: number } };
          return (
            <>
              <span>전체 추적: {elapsed}s</span>
              <span>총 변화: <span style={{ color: totalDelta > 0 ? '#ff8a80' : '#69f0ae' }}>{formatBytesDelta(totalDelta)}</span></span>
              <span>Used: {formatBytes(cur.used)}</span>
              <span>Total: {formatBytes(cur.total)}</span>
              <span>Limit: {formatBytes(perf.memory?.jsHeapSizeLimit ?? 0)}</span>
            </>
          );
        })()}
      </div>
      {showLog && (
        <div className="memory-log-section">
          <div className="memory-log-toolbar">
            <span>진단 리포트</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleCopy}>{copied ? '복사됨!' : '복사'}</button>
              <button onClick={handleSnapshot}>새로고침</button>
              <button onClick={() => setShowLog(false)}>닫기</button>
            </div>
          </div>
          <textarea
            ref={logRef}
            className="memory-log-textarea"
            value={logText}
            readOnly
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
