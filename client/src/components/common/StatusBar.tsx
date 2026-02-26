import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import { memHistory, startSampler, formatBytes, formatBytesDelta, SAMPLE_INTERVAL } from './memoryMonitor';
import MemoryGraph from './MemoryGraph';
import './StatusBar.css';

interface VersionInfo {
  type: 'release' | 'git';
  version?: string;
  commitDate?: string;
  commitHash?: string;
}

export default function StatusBar() {
  const { t } = useTranslation();
  const projectPath = useEditorStore((s) => s.projectPath);
  const currentMap = useEditorStore((s) => s.currentMap);
  const demoMode = useEditorStore((s) => s.demoMode);
  const editMode = useEditorStore((s) => s.editMode);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const cursorTileX = useEditorStore((s) => s.cursorTileX);
  const cursorTileY = useEditorStore((s) => s.cursorTileY);
  const setShowUpdateCheckDialog = useEditorStore((s) => s.setShowUpdateCheckDialog);
  const [showGraph, setShowGraph] = useState(false);
  const [, setTick] = useState(0);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    apiClient.get<VersionInfo>('/version/info').then(setVersionInfo).catch(() => {});
  }, []);

  useEffect(() => {
    startSampler();
    const id = setInterval(() => setTick((t) => t + 1), SAMPLE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const latest = memHistory.length > 0 ? memHistory[memHistory.length - 1] : null;
  const prev = memHistory.length > 1 ? memHistory[memHistory.length - 2] : null;
  const delta = latest && prev ? latest.used - prev.used : 0;

  const handleMemClick = useCallback(() => setShowGraph((v) => !v), []);

  const perf = performance as Performance & { memory?: unknown };
  const hasMemory = !!perf.memory;

  const w = window as any;
  const gpuInfo = w.Graphics?._renderer?.info;
  const gpuLabel = gpuInfo
    ? `GPU: tex ${gpuInfo.memory?.textures ?? '-'} / geo ${gpuInfo.memory?.geometries ?? '-'} / dc ${gpuInfo.render?.calls ?? '-'}`
    : null;

  const versionLabel = versionInfo?.version ? `v${versionInfo.version}` : null;

  return (
    <div className="statusbar">
      {versionLabel && (
        <span
          className="statusbar-item statusbar-version"
          onClick={() => setShowUpdateCheckDialog(true)}
          title="클릭하여 업데이트 확인"
        >
          {versionLabel}
        </span>
      )}
      {demoMode && (
        <span className="statusbar-item statusbar-demo-badge" title="데모 모드: 저장은 이 세션에서만 유효합니다">
          DEMO
        </span>
      )}
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
      {gpuLabel && (
        <span className="statusbar-item statusbar-gpu statusbar-push-right" title="Three.js GPU 사용 현황 (텍스처 / 지오메트리 / 드로우콜)">
          {gpuLabel}
        </span>
      )}
      {hasMemory && latest && (
        <span
          className={`statusbar-item statusbar-memory${gpuLabel ? '' : ' statusbar-push-right'}`}
          onClick={handleMemClick}
          title="클릭하여 메모리 그래프 표시"
        >
          메모리: {formatBytes(latest.used)} / {formatBytes(latest.total)}
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
