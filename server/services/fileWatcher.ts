import fs from 'fs';
import { WebSocket } from 'ws';

let watcher: fs.FSWatcher | null = null;
const clients = new Set<WebSocket>();

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

function watch(dataPath: string): void {
  stop();
  watcher = fs.watch(dataPath, { recursive: false }, (eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
      broadcast({ type: 'fileChanged', file: filename });
    }
  });
}

function stop(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

export default { addClient, watch, stop };
