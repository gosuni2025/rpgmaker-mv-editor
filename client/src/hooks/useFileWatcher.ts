import { useEffect } from 'react';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';
import type { MapData, TilesetData, SystemData, MapInfo, RPGEvent } from '../types/rpgMakerMV';

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
          console.log('[FileWatcher] WebSocket 메시지 수신:', msg);
          if (msg.type === 'fileChanged') {
            handleFileChanged(msg.file);
          } else if (msg.type === 'imageChanged') {
            handleImageChanged(msg.file, msg.folder);
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

/**
 * 이미지 파일이 외부에서 변경되었을 때 ImageManager 캐시를 무효화하고 재로드.
 * @param basename 파일명 (확장자 제외, e.g. "Actor1")
 * @param folder 하위 폴더명 (e.g. "pictures", "tilesets", "characters")
 */
function handleImageChanged(basename: string, folder: string) {
  console.log(`[FileWatcher] handleImageChanged 호출: basename=${basename}, folder=${folder}`);
  const IM = (window as any).ImageManager;
  if (!IM || !IM._imageCache || !IM._imageCache._items) {
    console.log('[FileWatcher] ImageManager 또는 _imageCache 없음');
    return;
  }

  const store = useEditorStore.getState();
  const { showToast } = store;

  // ImageManager 캐시 키 형식: "img/pictures/Actor1.png:0"
  const searchPath = folder ? `img/${folder}/${encodeURIComponent(basename)}.png` : basename;
  const items = IM._imageCache._items;
  const allKeys = Object.keys(items);
  console.log(`[FileWatcher] 캐시 검색: searchPath=${searchPath}, 전체 캐시 키 수=${allKeys.length}`);

  // 캐시에서 매칭되는 Bitmap을 찾아서 이미지를 강제 재로드
  let reloadCount = 0;
  for (const key of allKeys) {
    if (key.includes(searchPath)) {
      const entry = items[key];
      const bitmap = entry?.bitmap;
      if (bitmap) {
        console.log(`[FileWatcher] Bitmap 재로드: key=${key}, url=${bitmap._url}`);
        // 캐시 버스팅 URL로 HTMLImageElement를 강제 재로드
        const cacheBustUrl = bitmap._url + (bitmap._url.includes('?') ? '&' : '?') + '_t=' + Date.now();
        const img = new Image();
        img.onload = () => {
          console.log(`[FileWatcher] 이미지 재로드 완료: ${bitmap._url}`);
          // Bitmap 내부 이미지 교체
          bitmap._image = img;
          // __baseTexture의 이미지 소스도 갱신하고 needsUpdate 설정
          if (bitmap.__baseTexture) {
            bitmap.__baseTexture.image = img;
            if (bitmap.__baseTexture.needsUpdate !== undefined) {
              bitmap.__baseTexture.needsUpdate = true;
            }
            if (typeof bitmap.__baseTexture.update === 'function') {
              bitmap.__baseTexture.update();
            }
          }
          bitmap._setDirty();
          // 렌더링 갱신 커스텀 이벤트
          window.dispatchEvent(new CustomEvent('imageReloaded', { detail: { file: basename, folder } }));
        };
        img.src = cacheBustUrl;
        reloadCount++;
      }
    }
  }

  console.log(`[FileWatcher] 이미지 ${reloadCount}개 재로드 시작: ${searchPath}`);
  showToast(`이미지 갱신됨: ${folder}/${basename}`, true);
  // 즉시 이벤트 발행 (타일맵 등 재로드 트리거)
  window.dispatchEvent(new CustomEvent('imageChanged', { detail: { file: basename, folder } }));
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
        showToast(buildMapDiffMessage(mapId, oldMap, map), true);
      }
      return;
    }

    // MapInfos.json - 맵 트리 리로드
    if (filename === 'MapInfos.json') {
      const oldMaps = store.maps;
      const maps = await apiClient.get<(MapInfo | null)[]>('/maps');
      useEditorStore.setState({ maps });
      console.log('[FileWatcher] 맵 목록 리로드 완료');
      showToast(buildMapInfosDiffMessage(oldMaps, maps), true);
      return;
    }

    // System.json - 시스템 데이터 리로드
    if (filename === 'System.json') {
      const oldSys = store.systemData;
      const sys = await apiClient.get<SystemData>('/database/system');
      useEditorStore.setState({ systemData: sys });
      console.log('[FileWatcher] 시스템 데이터 리로드 완료');
      showToast(buildSystemDiffMessage(oldSys, sys), true);
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
      showToast(buildTilesetDiffMessage(oldTilesetInfo, tilesetInfo), true);
      return;
    }

    // 기타 DB 파일 (Actors, Items 등) - 열려있는 다이얼로그가 있으면 알림
    // DB 다이얼로그는 자체적으로 데이터를 로드하므로, 변경 이벤트만 발행
    window.dispatchEvent(new CustomEvent('fileChanged', { detail: { file: filename } }));
    const label = filename.replace('.json', '');
    showToast(`${label} 데이터 갱신됨`, true);
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
  const oldEvMap = new Map<number, RPGEvent>();
  const newEvMap = new Map<number, RPGEvent>();
  for (const ev of oldMap.events) { if (ev) oldEvMap.set(ev.id, ev); }
  for (const ev of newMap.events) { if (ev) newEvMap.set(ev.id, ev); }

  for (const [id, newEv] of newEvMap) {
    const oldEv = oldEvMap.get(id);
    const label = newEv.name || `EV${String(id).padStart(3, '0')}`;
    if (!oldEv) {
      lines.push(`이벤트 추가: ${label}`);
    } else if (JSON.stringify(oldEv) !== JSON.stringify(newEv)) {
      const details = diffEvent(oldEv, newEv);
      lines.push(`이벤트 수정: ${label} (${details})`);
    }
  }
  for (const [id, oldEv] of oldEvMap) {
    if (!newEvMap.has(id)) {
      const label = oldEv.name || `EV${String(id).padStart(3, '0')}`;
      lines.push(`이벤트 삭제: ${label}`);
    }
  }

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

/** 이벤트 두 개를 비교하여 변경된 부분을 짧은 문자열로 반환 */
function diffEvent(oldEv: RPGEvent, newEv: RPGEvent): string {
  const parts: string[] = [];
  if (oldEv.name !== newEv.name) parts.push(`이름 '${oldEv.name}'→'${newEv.name}'`);
  if (oldEv.x !== newEv.x || oldEv.y !== newEv.y) parts.push(`위치 (${oldEv.x},${oldEv.y})→(${newEv.x},${newEv.y})`);
  if (oldEv.note !== newEv.note) parts.push('노트');

  const oldPages = oldEv.pages.length;
  const newPages = newEv.pages.length;
  if (oldPages !== newPages) {
    parts.push(`페이지 ${oldPages}→${newPages}`);
  } else {
    // 각 페이지별 상세 비교
    for (let i = 0; i < newPages; i++) {
      const op = oldEv.pages[i];
      const np = newEv.pages[i];
      if (JSON.stringify(op) === JSON.stringify(np)) continue;

      const pageParts: string[] = [];
      if (JSON.stringify(op.conditions) !== JSON.stringify(np.conditions)) pageParts.push('조건');
      if (JSON.stringify(op.image) !== JSON.stringify(np.image)) pageParts.push('이미지');
      if (op.trigger !== np.trigger) pageParts.push('트리거');
      if (op.moveType !== np.moveType || op.moveSpeed !== np.moveSpeed || op.moveFrequency !== np.moveFrequency) pageParts.push('이동');
      if (JSON.stringify(op.moveRoute) !== JSON.stringify(np.moveRoute)) pageParts.push('이동루트');
      if (op.priorityType !== np.priorityType) pageParts.push('우선순위');
      if (op.directionFix !== np.directionFix || op.stepAnime !== np.stepAnime || op.walkAnime !== np.walkAnime || op.through !== np.through) pageParts.push('옵션');

      // 커맨드 비교
      const oldCmds = op.list;
      const newCmds = np.list;
      if (JSON.stringify(oldCmds) !== JSON.stringify(newCmds)) {
        const diff = Math.abs(newCmds.length - oldCmds.length);
        if (newCmds.length > oldCmds.length) pageParts.push(`커맨드 +${diff}`);
        else if (newCmds.length < oldCmds.length) pageParts.push(`커맨드 -${diff}`);
        else pageParts.push('커맨드 수정');
      }

      if (pageParts.length > 0) {
        const pageLabel = newPages > 1 ? `p${i + 1}:` : '';
        parts.push(`${pageLabel}${pageParts.join(',')}`);
      }
    }
  }

  return parts.length > 0 ? parts.join(', ') : '내용 변경';
}
