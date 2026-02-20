import { app, BrowserWindow } from 'electron';
import http from 'http';
import path from 'path';
import { createApp, attachWebSocket } from '../server/index';

let mainWindow: BrowserWindow | null = null;
let server: http.Server | null = null;

function getAsarPath(...segments: string[]) {
  // asar 내부 파일 (client/dist 등)
  return path.join(__dirname, '..', ...segments);
}

function getUnpackedPath(...segments: string[]) {
  // asar 외부 파일 (server/runtime 등 - asarUnpack 설정된 파일)
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked')
    : path.join(__dirname, '..');
  return path.join(base, ...segments);
}

async function startServer(): Promise<number> {
  const runtimePath = getUnpackedPath('server', 'runtime');
  const clientDistPath = getAsarPath('client', 'dist');

  const expressApp = createApp({ runtimePath, clientDistPath });
  server = http.createServer(expressApp);
  attachWebSocket(server);

  return new Promise((resolve) => {
    server!.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      console.log(`Server listening on port ${port}`);
      resolve(port);
    });
  });
}

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'RPG Maker MV Editor',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  const port = await startServer();
  createWindow(port);
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
    server = null;
  }
  app.quit();
});

app.on('activate', async () => {
  if (mainWindow === null) {
    const port = await startServer();
    createWindow(port);
  }
});
