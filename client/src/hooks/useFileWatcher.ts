import { useEffect } from 'react';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';
import type { MapData, TilesetData, SystemData, MapInfo } from '../types/rpgMakerMV';

/** API 서버의 WebSocket URL을 결정 */
function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  // Vite dev 서버(5173)에서는 API 서버(3001)로 직접 연결
  const port = window.location.port === '5173' ? '3001' : window.location.port;
  return `${protocol}//${host}:${port}`;
}

/** 서버 WebSocket에 연결하여 외부 파일 변경을 감지하고 자동 리로드 */
export default function useFileWatcher() {
  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (disposed) return;
      const url = getWsUrl();
      ws = new WebSocket(url);

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
        if (disposed) return;
        console.log('[FileWatcher] WebSocket 연결 끊김, 3초 후 재연결...');
        ws = null;
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    };
  }, []);
}

async function handleFileChanged(filename: string) {
  const store = useEditorStore.getState();
  const { showToast } = store;
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
        showToast(`맵 ${mapId} 데이터 갱신됨`);
      }
      return;
    }

    // MapInfos.json - 맵 트리 리로드
    if (filename === 'MapInfos.json') {
      const maps = await apiClient.get<(MapInfo | null)[]>('/maps');
      useEditorStore.setState({ maps });
      console.log('[FileWatcher] 맵 목록 리로드 완료');
      showToast('맵 목록 갱신됨');
      return;
    }

    // System.json - 시스템 데이터 리로드
    if (filename === 'System.json') {
      const sys = await apiClient.get<SystemData>('/database/system');
      useEditorStore.setState({ systemData: sys });
      console.log('[FileWatcher] 시스템 데이터 리로드 완료');
      showToast('시스템 데이터 갱신됨');
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
      showToast('타일셋 데이터 갱신됨');
      return;
    }

    // 기타 DB 파일 (Actors, Items 등) - 열려있는 다이얼로그가 있으면 알림
    // DB 다이얼로그는 자체적으로 데이터를 로드하므로, 변경 이벤트만 발행
    window.dispatchEvent(new CustomEvent('fileChanged', { detail: { file: filename } }));
    const label = filename.replace('.json', '');
    showToast(`${label} 데이터 갱신됨`);
  } catch (err) {
    console.error(`[FileWatcher] ${filename} 리로드 실패:`, err);
  }
}
