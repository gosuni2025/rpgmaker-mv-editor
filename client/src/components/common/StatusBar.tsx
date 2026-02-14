import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import './StatusBar.css';

/* ── 메모리 샘플 타입 ── */
interface MemSample {
  time: number;   // Date.now()
  used: number;   // bytes
  total: number;  // bytes
}

const MAX_SAMPLES = 300;        // 최대 보관 샘플 수
const SAMPLE_INTERVAL = 1000;   // 1초 간격

/* ── 전역 히스토리 (컴포넌트 언마운트 후에도 유지) ── */
const memHistory: MemSample[] = [];
let samplerInterval: ReturnType<typeof setInterval> | null = null;

function startSampler() {
  if (samplerInterval) return;
  const perf = performance as any;
  if (!perf.memory) return;
  const sample = () => {
    memHistory.push({
      time: Date.now(),
      used: perf.memory.usedJSHeapSize,
      total: perf.memory.totalJSHeapSize,
    });
    if (memHistory.length > MAX_SAMPLES) memHistory.shift();
  };
  sample();
  samplerInterval = setInterval(sample, SAMPLE_INTERVAL);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatBytesDelta(bytes: number): string {
  const sign = bytes >= 0 ? '+' : '';
  if (Math.abs(bytes) < 1024) return sign + bytes + ' B';
  if (Math.abs(bytes) < 1024 * 1024) return sign + (bytes / 1024).toFixed(1) + ' KB';
  return sign + (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/* ── 메모리 그래프 팝업 ── */
function MemoryGraph({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setTick] = useState(0);

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

    // 범위 계산
    let minUsed = Infinity, maxUsed = 0;
    let minTotal = Infinity, maxTotal = 0;
    for (const s of samples) {
      if (s.used < minUsed) minUsed = s.used;
      if (s.used > maxUsed) maxUsed = s.used;
      if (s.total < minTotal) minTotal = s.total;
      if (s.total > maxTotal) maxTotal = s.total;
    }

    // 전체 범위 (total 기준으로 Y축 스케일)
    const yMin = Math.min(minUsed, minTotal) * 0.95;
    const yMax = Math.max(maxUsed, maxTotal) * 1.05;
    const yRange = yMax - yMin || 1;

    const pad = { top: 30, bottom: 30, left: 60, right: 20 };
    const gw = w - pad.left - pad.right;
    const gh = h - pad.top - pad.bottom;

    // 배경
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, w, h);

    // Y축 눈금
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

    // X축 시간 눈금
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

    // total 선 (반투명)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100,100,255,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < samples.length; i++) {
      const x = pad.left + (gw * (samples[i].time - tStart)) / tRange;
      const y = pad.top + gh - (gh * (samples[i].total - yMin)) / yRange;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // used 선 (메인)
    ctx.beginPath();
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    for (let i = 0; i < samples.length; i++) {
      const x = pad.left + (gw * (samples[i].time - tStart)) / tRange;
      const y = pad.top + gh - (gh * (samples[i].used - yMin)) / yRange;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // used 영역 채우기
    const lastX = pad.left + (gw * (samples[samples.length - 1].time - tStart)) / tRange;
    ctx.lineTo(lastX, pad.top + gh);
    ctx.lineTo(pad.left, pad.top + gh);
    ctx.closePath();
    ctx.fillStyle = 'rgba(79,195,247,0.1)';
    ctx.fill();

    // 범례
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText('● Used Heap', pad.left + 4, 14);
    ctx.fillStyle = 'rgba(100,100,255,0.7)';
    ctx.fillText('● Total Heap', pad.left + 120, 14);

    // 현재 값 & 변화량
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

  return (
    <div className="memory-graph-popup">
      <div className="memory-graph-header">
        <span>JS Heap 메모리 모니터</span>
        <button onClick={onClose}>✕</button>
      </div>
      <canvas ref={canvasRef} className="memory-graph-canvas" />
      <div className="memory-graph-footer">
        {memHistory.length > 1 && (() => {
          const cur = memHistory[memHistory.length - 1];
          const first = memHistory[0];
          const totalDelta = cur.used - first.used;
          const elapsed = ((cur.time - first.time) / 1000).toFixed(0);
          return (
            <>
              <span>전체 추적: {elapsed}s</span>
              <span>총 변화: <span style={{ color: totalDelta > 0 ? '#ff8a80' : '#69f0ae' }}>{formatBytesDelta(totalDelta)}</span></span>
              <span>Used: {formatBytes(cur.used)}</span>
              <span>Total: {formatBytes(cur.total)}</span>
              <span>Limit: {formatBytes((performance as any).memory?.jsHeapSizeLimit ?? 0)}</span>
            </>
          );
        })()}
      </div>
    </div>
  );
}

/* ── 메인 StatusBar ── */
export default function StatusBar() {
  const { t } = useTranslation();
  const projectPath = useEditorStore((s) => s.projectPath);
  const currentMap = useEditorStore((s) => s.currentMap);
  const editMode = useEditorStore((s) => s.editMode);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const cursorTileX = useEditorStore((s) => s.cursorTileX);
  const cursorTileY = useEditorStore((s) => s.cursorTileY);
  const [showGraph, setShowGraph] = useState(false);
  const [, setTick] = useState(0);

  // 샘플러 시작 & 주기적 갱신
  useEffect(() => {
    startSampler();
    const id = setInterval(() => setTick((t) => t + 1), SAMPLE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const latest = memHistory.length > 0 ? memHistory[memHistory.length - 1] : null;
  const prev = memHistory.length > 1 ? memHistory[memHistory.length - 2] : null;
  const delta = latest && prev ? latest.used - prev.used : 0;

  const handleMemClick = useCallback(() => setShowGraph((v) => !v), []);

  const perf = performance as any;
  const hasMemory = !!perf.memory;

  return (
    <div className="statusbar">
      <span className="statusbar-item">
        {projectPath || t('statusBar.noProject')}
      </span>
      {currentMap && (
        <span className="statusbar-item">
          {t('statusBar.map')}: {currentMap.displayName || currentMap.name || `Map`} ({currentMap.width}x{currentMap.height})
        </span>
      )}
      <span className="statusbar-item">
        {t('statusBar.mode')}: {editMode === 'map' ? t('statusBar.modeMap') : t('statusBar.modeEvent')}
      </span>
      <span className="statusbar-item">
        {t('statusBar.coord')}: ({cursorTileX}, {cursorTileY})
      </span>
      <span className="statusbar-item">
        {t('statusBar.zoom')}: {Math.round(zoomLevel * 100)}%
      </span>
      {hasMemory && latest && (
        <span
          className="statusbar-item statusbar-memory"
          onClick={handleMemClick}
          title="클릭하여 메모리 그래프 표시"
        >
          메모리: {formatBytes(latest.used)}
          {delta !== 0 && (
            <span className={delta > 0 ? 'mem-delta-up' : 'mem-delta-down'}>
              {' '}{formatBytesDelta(delta)}
            </span>
          )}
        </span>
      )}
      {showGraph && <MemoryGraph onClose={() => setShowGraph(false)} />}
    </div>
  );
}
