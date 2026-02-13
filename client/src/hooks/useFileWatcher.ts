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
        const oldMap = store.currentMap;
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
        showToast(buildMapDiffMessage(mapId, oldMap, map));
      }
      return;
    }

    // MapInfos.json - 맵 트리 리로드
    if (filename === 'MapInfos.json') {
      const oldMaps = store.maps;
      const maps = await apiClient.get<(MapInfo | null)[]>('/maps');
      useEditorStore.setState({ maps });
      console.log('[FileWatcher] 맵 목록 리로드 완료');
      showToast(buildMapInfosDiffMessage(oldMaps, maps));
      return;
    }

    // System.json - 시스템 데이터 리로드
    if (filename === 'System.json') {
      const oldSys = store.systemData;
      const sys = await apiClient.get<SystemData>('/database/system');
      useEditorStore.setState({ systemData: sys });
      console.log('[FileWatcher] 시스템 데이터 리로드 완료');
      showToast(buildSystemDiffMessage(oldSys, sys));
      return;
    }

    // Tilesets.json - 현재 맵의 타일셋이 변경되었을 수 있으므로 리로드
    if (filename === 'Tilesets.json' && store.currentMap?.tilesetId) {
      const oldTilesetInfo = store.tilesetInfo;
      const tilesets = await apiClient.get<(TilesetData | null)[]>('/database/tilesets');
      const tilesetInfo = tilesets[store.currentMap.tilesetId];
      if (tilesetInfo) {
        const map = { ...store.currentMap, tilesetNames: tilesetInfo.tilesetNames };
        useEditorStore.setState({ currentMap: map, tilesetInfo });
      }
      console.log('[FileWatcher] 타일셋 리로드 완료');
      showToast(buildTilesetDiffMessage(oldTilesetInfo, tilesetInfo));
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

/** diff 항목 리스트를 메시지로 포맷 (5개 초과 시 truncate) */
function formatDiffLines(header: string, lines: string[]): string {
  if (lines.length === 0) return header;
  const MAX = 5;
  const shown = lines.slice(0, MAX);
  const result = [header, ...shown.map(l => `- ${l}`)];
  if (lines.length > MAX) result.push(`- 외 ${lines.length - MAX}건`);
  return result.join('\n');
}

/** 맵 데이터 diff 메시지 생성 */
function buildMapDiffMessage(mapId: number, oldMap: MapData | null, newMap: MapData): string {
  const header = `맵 ${mapId} 데이터 갱신됨`;
  if (!oldMap) return header;

  const lines: string[] = [];

  // 맵 속성 비교
  const props: (keyof MapData)[] = ['displayName', 'width', 'height', 'tilesetId', 'scrollType', 'autoplayBgm', 'autoplayBgs', 'encounterStep', 'note', 'parallaxName'];
  for (const key of props) {
    const oldVal = oldMap[key];
    const newVal = newMap[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      lines.push(`${key}: '${oldVal}'→'${newVal}'`);
    }
  }

  // 맵 크기 변경 시 타일 비교 생략
  if (oldMap.width !== newMap.width || oldMap.height !== newMap.height) {
    lines.push(`크기 변경: ${oldMap.width}×${oldMap.height}→${newMap.width}×${newMap.height}`);
  } else {
    // 타일 데이터 비교
    const len = Math.max(oldMap.data.length, newMap.data.length);
    let changedTiles = 0;
    for (let i = 0; i < len; i++) {
      if (oldMap.data[i] !== newMap.data[i]) changedTiles++;
    }
    if (changedTiles > 0) lines.push(`타일 ${changedTiles}개 수정`);
  }

  // 이벤트 비교
  const oldEvents = new Map<number, { name: string; json: string }>();
  const newEvents = new Map<number, { name: string; json: string }>();
  for (const ev of oldMap.events) {
    if (ev) oldEvents.set(ev.id, { name: ev.name, json: JSON.stringify(ev) });
  }
  for (const ev of newMap.events) {
    if (ev) newEvents.set(ev.id, { name: ev.name, json: JSON.stringify(ev) });
  }

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  for (const [id, info] of newEvents) {
    const old = oldEvents.get(id);
    if (!old) added.push(info.name || `EV${String(id).padStart(3, '0')}`);
    else if (old.json !== info.json) modified.push(info.name || `EV${String(id).padStart(3, '0')}`);
  }
  for (const [id, info] of oldEvents) {
    if (!newEvents.has(id)) removed.push(info.name || `EV${String(id).padStart(3, '0')}`);
  }
  if (modified.length > 0) lines.push(`이벤트 수정: ${modified.join(', ')}`);
  if (added.length > 0) lines.push(`이벤트 추가: ${added.join(', ')}`);
  if (removed.length > 0) lines.push(`이벤트 삭제: ${removed.join(', ')}`);

  return formatDiffLines(header, lines);
}

/** MapInfos diff 메시지 생성 */
function buildMapInfosDiffMessage(oldMaps: (MapInfo | null)[] | null, newMaps: (MapInfo | null)[]): string {
  const header = '맵 목록 갱신됨';
  if (!oldMaps) return header;

  const lines: string[] = [];
  const oldById = new Map<number, MapInfo>();
  const newById = new Map<number, MapInfo>();
  for (const m of oldMaps) { if (m) oldById.set(m.id, m); }
  for (const m of newMaps) { if (m) newById.set(m.id, m); }

  for (const [id, info] of newById) {
    const old = oldById.get(id);
    if (!old) lines.push(`맵 추가: ${info.name}`);
    else if (old.name !== info.name) lines.push(`맵 이름 변경: '${old.name}'→'${info.name}'`);
    else if (old.parentId !== info.parentId || old.order !== info.order) lines.push(`맵 이동: ${info.name}`);
  }
  for (const [id, info] of oldById) {
    if (!newById.has(id)) lines.push(`맵 삭제: ${info.name}`);
  }

  return formatDiffLines(header, lines);
}

/** System diff 메시지 생성 */
function buildSystemDiffMessage(oldSys: SystemData | null, newSys: SystemData): string {
  const header = '시스템 데이터 갱신됨';
  if (!oldSys) return header;

  const lines: string[] = [];
  const props: (keyof SystemData)[] = ['gameTitle', 'currencyUnit', 'locale', 'startMapId', 'startX', 'startY'];
  for (const key of props) {
    const oldVal = oldSys[key];
    const newVal = newSys[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      lines.push(`${key}: '${oldVal}'→'${newVal}'`);
    }
  }

  // 배열 비교 (간략)
  if (JSON.stringify(oldSys.partyMembers) !== JSON.stringify(newSys.partyMembers)) lines.push('파티 멤버 변경');
  if (JSON.stringify(oldSys.windowTone) !== JSON.stringify(newSys.windowTone)) lines.push('창 색조 변경');
  if (JSON.stringify(oldSys.switches) !== JSON.stringify(newSys.switches)) lines.push('스위치 변경');
  if (JSON.stringify(oldSys.variables) !== JSON.stringify(newSys.variables)) lines.push('변수 변경');

  return formatDiffLines(header, lines);
}

/** Tileset diff 메시지 생성 */
function buildTilesetDiffMessage(oldTs: TilesetData | null | undefined, newTs: TilesetData | null | undefined): string {
  const header = '타일셋 데이터 갱신됨';
  if (!oldTs || !newTs) return header;

  const lines: string[] = [];
  if (oldTs.name !== newTs.name) lines.push(`이름: '${oldTs.name}'→'${newTs.name}'`);
  if (oldTs.mode !== newTs.mode) lines.push(`모드: ${oldTs.mode}→${newTs.mode}`);
  if (JSON.stringify(oldTs.tilesetNames) !== JSON.stringify(newTs.tilesetNames)) lines.push('타일셋 이미지 변경');
  if (JSON.stringify(oldTs.flags) !== JSON.stringify(newTs.flags)) {
    let changed = 0;
    const len = Math.max(oldTs.flags.length, newTs.flags.length);
    for (let i = 0; i < len; i++) {
      if (oldTs.flags[i] !== newTs.flags[i]) changed++;
    }
    lines.push(`통행 설정 ${changed}개 변경`);
  }

  return formatDiffLines(header, lines);
}
