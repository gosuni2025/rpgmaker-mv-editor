import { app, BrowserWindow } from 'electron';
import http from 'http';
import path from 'path';
import { createApp, attachWebSocket } from '../server/index';

let mainWindow: BrowserWindow | null = null;
let server: http.Server | null = null;

function getResourcePath(...segments: string[]) {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '..');
  return path.join(base, ...segments);
}

async function startServer(): Promise<number> {
  const runtimePath = getResourcePath('server', 'runtime');
  const clientDistPath = getResourcePath('client', 'dist');

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
