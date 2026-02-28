import path from 'path';
import { watch as chokidarWatch, type FSWatcher } from 'chokidar';
import { WebSocket } from 'ws';

let dataWatcher: FSWatcher | null = null;
let imgWatcher: FSWatcher | null = null;
let scenesWatcher: FSWatcher | null = null;
const clients = new Set<WebSocket>();

// API를 통한 저장 시 일정 시간 동안 해당 파일의 fileChanged를 무시
const recentApiWrites = new Map<string, number>();
const API_WRITE_COOLDOWN = 2000; // 2초

// 이미지 파일 확장자
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp']);

function addClient(ws: WebSocket): void {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
}

function broadcast(message: { type: string; file: string; folder?: string }): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

/** API를 통해 파일을 저장했음을 기록 (외부 변경과 구분하기 위해) */
function markApiWrite(filename: string): void {
  recentApiWrites.set(filename, Date.now());
}

function handleDataChange(filePath: string): void {
  const filename = path.basename(filePath);
  if (!filename.endsWith('.json')) return;

  // API를 통한 저장인 경우 무시
  const lastWrite = recentApiWrites.get(filename);
  if (lastWrite && Date.now() - lastWrite < API_WRITE_COOLDOWN) {
    return;
  }

  broadcast({ type: 'fileChanged', file: filename });
}

function handleImageChange(filePath: string, imgBasePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) return;

  // imgBasePath 기준 상대경로에서 folder와 basename 추출
  const rel = path.relative(imgBasePath, filePath);
  const parts = rel.split(path.sep);
  const folder = parts.length > 1 ? parts[0] : '';
  const basename = path.basename(filePath, ext);
  broadcast({ type: 'imageChanged', file: basename, folder });
}

function watch(dataPath: string): void {
  // 이전 watcher를 동기적으로 정리 (close는 비동기지만 새 watcher 생성에 영향 없음)
  if (dataWatcher) { dataWatcher.close(); dataWatcher = null; }
  if (imgWatcher) { imgWatcher.close(); imgWatcher = null; }
  if (scenesWatcher) { scenesWatcher.close(); scenesWatcher = null; }
  recentApiWrites.clear();

  // data/ 폴더 감시 (JSON 파일) - depth 0 = 직접 하위만
  dataWatcher = chokidarWatch(dataPath, {
    depth: 0,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });
  dataWatcher.on('change', (fp) => handleDataChange(fp));
  dataWatcher.on('add', (fp) => handleDataChange(fp));

  // UIScenes/ 서브디렉터리 감시 → 가상 UIEditorScenes.json 이벤트 발생
  const uiScenesPath = path.join(dataPath, 'UIScenes');
  scenesWatcher = chokidarWatch(uiScenesPath, {
    depth: 0,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });
  const virtualPath = path.join(dataPath, 'UIEditorScenes.json');
  scenesWatcher.on('change', () => handleDataChange(virtualPath));
  scenesWatcher.on('add',    () => handleDataChange(virtualPath));
  scenesWatcher.on('unlink', () => handleDataChange(virtualPath));

  // img/ 폴더 감시 (이미지 파일)
  const imgPath = path.join(path.dirname(dataPath), 'img');
  imgWatcher = chokidarWatch(imgPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });
  imgWatcher.on('change', (fp) => handleImageChange(fp, imgPath));
  imgWatcher.on('add', (fp) => handleImageChange(fp, imgPath));
}

async function stop(): Promise<void> {
  if (dataWatcher) { await dataWatcher.close(); dataWatcher = null; }
  if (imgWatcher) { await imgWatcher.close(); imgWatcher = null; }
  if (scenesWatcher) { await scenesWatcher.close(); scenesWatcher = null; }
  recentApiWrites.clear();
}

export default { addClient, watch, stop, markApiWrite };
