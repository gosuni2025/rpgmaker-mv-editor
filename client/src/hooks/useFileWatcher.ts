import { useEffect, useRef } from 'react';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';
import type { MapData, TilesetData, SystemData, MapInfo } from '../types/rpgMakerMV';

/** 서버 WebSocket에 연결하여 외부 파일 변경을 감지하고 자동 리로드 */
export default function useFileWatcher() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const projectPath = useEditorStore((s) => s.projectPath);

  useEffect(() => {
    if (!projectPath) {
      // 프로젝트가 닫혀있으면 연결하지 않음
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      // Vite dev에서는 API가 3001 포트로 프록시됨
      const port = (import.meta as unknown as { env: { DEV: boolean } }).env.DEV ? '3001' : window.location.port;
      const ws = new WebSocket(`${protocol}//${host}:${port}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[FileWatcher] WebSocket 연결됨');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'fileChanged') {
            handleFileChanged(msg.file);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        console.log('[FileWatcher] WebSocket 연결 끊김, 3초 후 재연결...');
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [projectPath]);
}

async function handleFileChanged(filename: string) {
  const store = useEditorStore.getState();
  console.log(`[FileWatcher] 외부 파일 변경 감지: ${filename}`);

  try {
    // MapXXX.json 또는 MapXXX_ext.json - 현재 열린 맵이면 리로드
    const mapMatch = filename.match(/^Map(\d{3})(?:_ext)?\.json$/);
    if (mapMatch) {
      const mapId = parseInt(mapMatch[1], 10);
      if (store.currentMapId === mapId) {
        const map = await apiClient.get<MapData>(`/maps/${mapId}`);
        if (map.tilesetId) {
          try {
            const tilesets = await apiClient.get<(TilesetData | null)[]>('/database/tilesets');
            const tilesetInfo = tilesets[map.tilesetId];
            if (tilesetInfo) {
              map.tilesetNames = tilesetInfo.tilesetNames;
              useEditorStore.setState({ currentMap: map, tilesetInfo, undoStack: [], redoStack: [] });
            } else {
              useEditorStore.setState({ currentMap: map, undoStack: [], redoStack: [] });
            }
          } catch {
            useEditorStore.setState({ currentMap: map, undoStack: [], redoStack: [] });
          }
        } else {
          useEditorStore.setState({ currentMap: map, undoStack: [], redoStack: [] });
        }
        console.log(`[FileWatcher] 맵 ${mapId} 리로드 완료`);
      }
      return;
    }

    // MapInfos.json - 맵 트리 리로드
    if (filename === 'MapInfos.json') {
      const maps = await apiClient.get<(MapInfo | null)[]>('/maps');
      useEditorStore.setState({ maps });
      console.log('[FileWatcher] 맵 목록 리로드 완료');
      return;
    }

    // System.json - 시스템 데이터 리로드
    if (filename === 'System.json') {
      const sys = await apiClient.get<SystemData>('/database/system');
      useEditorStore.setState({ systemData: sys });
      console.log('[FileWatcher] 시스템 데이터 리로드 완료');
      return;
    }

    // Tilesets.json - 현재 맵의 타일셋이 변경되었을 수 있으므로 리로드
    if (filename === 'Tilesets.json' && store.currentMap?.tilesetId) {
      const tilesets = await apiClient.get<(TilesetData | null)[]>('/database/tilesets');
      const tilesetInfo = tilesets[store.currentMap.tilesetId];
      if (tilesetInfo) {
        const map = { ...store.currentMap, tilesetNames: tilesetInfo.tilesetNames };
        useEditorStore.setState({ currentMap: map, tilesetInfo });
      }
      console.log('[FileWatcher] 타일셋 리로드 완료');
      return;
    }

    // 기타 DB 파일 (Actors, Items 등) - 열려있는 다이얼로그가 있으면 알림
    // DB 다이얼로그는 자체적으로 데이터를 로드하므로, 변경 이벤트만 발행
    window.dispatchEvent(new CustomEvent('fileChanged', { detail: { file: filename } }));
  } catch (err) {
    console.error(`[FileWatcher] ${filename} 리로드 실패:`, err);
  }
}
