import fs from 'fs';
import { WebSocket } from 'ws';

let watcher: fs.FSWatcher | null = null;
const clients = new Set<WebSocket>();

// API를 통한 저장 시 일정 시간 동안 해당 파일의 fileChanged를 무시
const recentApiWrites = new Map<string, number>();
const API_WRITE_COOLDOWN = 2000; // 2초

// debounce 타이머
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 300;

function addClient(ws: WebSocket): void {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
}

function broadcast(message: { type: string; file: string }): void {
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

function watch(dataPath: string): void {
  stop();
  watcher = fs.watch(dataPath, { recursive: false }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.json')) return;

    // API를 통한 저장인 경우 무시
    const lastWrite = recentApiWrites.get(filename);
    if (lastWrite && Date.now() - lastWrite < API_WRITE_COOLDOWN) {
      return;
    }

    // debounce: 같은 파일의 연속 변경을 하나로 합침
    const existing = debounceTimers.get(filename);
    if (existing) clearTimeout(existing);

    debounceTimers.set(filename, setTimeout(() => {
      debounceTimers.delete(filename);
      broadcast({ type: 'fileChanged', file: filename });
    }, DEBOUNCE_MS));
  });
}

function stop(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
  recentApiWrites.clear();
}

export default { addClient, watch, stop, markApiWrite };
