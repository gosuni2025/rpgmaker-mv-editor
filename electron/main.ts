import { app, BrowserWindow, Menu } from 'electron';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createApp, attachWebSocket } from '../server/index';

// 게임 테스트 창 크기 저장 경로
const gameWindowSizeFile = () => path.join(app.getPath('userData'), 'game-window-size.json');

function loadGameWindowSize(): { width: number; height: number } {
  try {
    const raw = fs.readFileSync(gameWindowSizeFile(), 'utf8');
    const { width, height } = JSON.parse(raw);
    if (typeof width === 'number' && typeof height === 'number') return { width, height };
  } catch {}
  return { width: 880, height: 680 }; // 기본값 (RPG MV 기본 해상도 816x624 + 여유)
}

function saveGameWindowSize(width: number, height: number) {
  try {
    fs.writeFileSync(gameWindowSizeFile(), JSON.stringify({ width, height }));
  } catch {}
}

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
  // 패키징된 앱에서 버전 정보를 서버에 전달 (server/routes/version.ts에서 사용)
  process.env.APP_VERSION = app.getVersion();

  const runtimePath = getUnpackedPath('server', 'runtime');
  const clientDistPath = getAsarPath('client', 'dist');

  const expressApp = createApp({ runtimePath, clientDistPath });
  server = http.createServer(expressApp);
  attachWebSocket(server);

  // 고정 포트 사용 — 랜덤 포트는 재실행 시 origin이 바뀌어 localStorage가 초기화됨
  const PREFERRED_PORT = 49321;
  return new Promise((resolve) => {
    const tryListen = (port: number) => {
      server!.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') tryListen(port + 1);
      });
      server!.listen(port, '127.0.0.1', () => {
        console.log(`Server listening on port ${port}`);
        resolve(port);
      });
    };
    tryListen(PREFERRED_PORT);
  });
}

function createWindow(port: number) {
  // Electron 기본 네이티브 메뉴 제거 (React 앱의 MenuBar를 사용)
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'RPG Maker MV Editor',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // F12 / Ctrl+Shift+I 로 에디터 창 개발자 도구 토글
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow!.webContents.isDevToolsOpened()
        ? mainWindow!.webContents.closeDevTools()
        : mainWindow!.webContents.openDevTools();
      event.preventDefault();
    }
    if (input.key === 'I' && input.control && input.shift && input.type === 'keyDown') {
      mainWindow!.webContents.isDevToolsOpened()
        ? mainWindow!.webContents.closeDevTools()
        : mainWindow!.webContents.openDevTools();
      event.preventDefault();
    }
  });

  // /game/ URL을 window.open으로 열 때 게임 테스트 창으로 제어
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('/game/')) {
      const { width, height } = loadGameWindowSize();
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width,
          height,
          minWidth: 816,
          minHeight: 624,
          title: 'RPG Maker MV - 플레이테스트',
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true,
          },
        },
      };
    }
    // 그 외 외부 URL은 기본 브라우저로
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // 게임 테스트 창이 열리면 크기 저장 및 개발자 도구 단축키 등록
  mainWindow.webContents.on('did-create-window', (gameWin) => {
    // 창 크기 변경 시 저장
    gameWin.on('resized', () => {
      const [w, h] = gameWin.getSize();
      saveGameWindowSize(w, h);
    });

    // F12 / Ctrl+Shift+I 로 개발자 도구 토글
    gameWin.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        gameWin.webContents.isDevToolsOpened()
          ? gameWin.webContents.closeDevTools()
          : gameWin.webContents.openDevTools();
        event.preventDefault();
      }
      if (input.key === 'I' && input.control && input.shift && input.type === 'keyDown') {
        gameWin.webContents.isDevToolsOpened()
          ? gameWin.webContents.closeDevTools()
          : gameWin.webContents.openDevTools();
        event.preventDefault();
      }
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// GPU 블랙리스트 무시 — 일부 Windows GPU/드라이버가 블랙리스트에 올라
// 소프트웨어 렌더링으로 폴백되면 WebGL 2.0 기능이 제한됨
app.commandLine.appendSwitch('ignore-gpu-blocklist');

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
