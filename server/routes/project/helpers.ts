import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import http from 'http';
import { execFile, exec, spawn } from 'child_process';

/** Collect all files under a directory recursively, returning relative paths (always with forward slashes) */
export function collectFiles(dir: string, base: string = dir): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      results.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return results;
}

export function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

export interface MigrationFile {
  file: string;       // relative path like "js/rpg_core.js"
  status: 'add' | 'update' | 'same';
  editorSize?: number;
  projectSize?: number;
  editorMtime?: string;
  projectMtime?: string;
}

export function openInExplorer(targetPath: string) {
  const resolved = path.resolve(targetPath);
  if (process.platform === 'darwin') {
    execFile('open', [resolved]);
  } else if (process.platform === 'win32') {
    execFile('explorer.exe', [resolved]);
  } else {
    execFile('xdg-open', [resolved]);
  }
}

export function openInVSCode(projectPath: string | null, filePath?: string) {
  const args = [projectPath, filePath].filter(Boolean) as string[];
  execFile('code', args);
}

export const CHROME_DEBUG_PORT = 9876;

/** 9876 포트가 Chrome remote debugging으로 응답할 때까지 최대 timeout ms 대기 */
export function waitForDebugPort(port: number, timeout = 10000): Promise<boolean> {
  return new Promise(resolve => {
    const deadline = Date.now() + timeout;
    function tryOnce() {
      const req = http.get({ hostname: '127.0.0.1', port, path: '/json/version', timeout: 800 }, res => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => {
        if (Date.now() < deadline) setTimeout(tryOnce, 400);
        else resolve(false);
      });
      req.on('timeout', () => { req.destroy(); });
    }
    tryOnce();
  });
}

/** Chrome을 --remote-debugging-port=${CHROME_DEBUG_PORT} 로 실행하여 VSCode attach 가능 상태로 만듦 */
export function openChromeWithDebugPort(url: string): string | null {
  const userDataDir =
    process.platform === 'win32'
      ? path.join(require('os').tmpdir(), 'chrome-rpgmaker-debug')
      : '/tmp/chrome-rpgmaker-debug';

  const args = [
    `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    url,
  ];

  let chromePath: string | undefined;
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ];
    chromePath = candidates.find(p => fs.existsSync(p));
    if (!chromePath) return 'Chrome을 찾을 수 없습니다. Google Chrome을 설치해 주세요.';
  } else if (process.platform === 'win32') {
    const winCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    chromePath = winCandidates.find(p => fs.existsSync(p));
  }

  // 같은 user-data-dir로 실행 중인 기존 Chrome을 먼저 종료한 뒤 새로 실행
  // (기존 인스턴스가 살아있으면 --remote-debugging-port 플래그가 무시됨)
  const killCmd = process.platform === 'win32'
    ? `taskkill /F /FI "IMAGENAME eq chrome.exe" 2>nul`
    : `pkill -f "chrome-rpgmaker-debug" 2>/dev/null`;

  exec(killCmd, () => {
    setTimeout(() => {
      if (process.platform === 'win32') {
        if (chromePath) spawn(chromePath, args, { detached: true, stdio: 'ignore' }).unref();
        else exec(`start chrome ${args.join(' ')}`);
      } else {
        spawn(chromePath!, args, { detached: true, stdio: 'ignore' }).unref();
      }
    }, 800); // kill 후 프로세스가 완전히 종료될 시간 대기
  });

  return null;
}

export function openInTerminal(targetPath: string) {
  const resolved = path.resolve(targetPath);
  if (process.platform === 'darwin') {
    execFile('osascript', ['-e', `tell application "Terminal" to do script "cd '${resolved.replace(/'/g, "'\\''")}'"`, '-e', 'tell application "Terminal" to activate']);
  } else if (process.platform === 'win32') {
    const winPath = resolved.replace(/\//g, '\\');
    exec(`start cmd /K cd /d "${winPath}"`);
  } else {
    // 일반적인 Linux 터미널 에뮬레이터 시도
    exec(`x-terminal-emulator -e bash -c "cd '${resolved.replace(/'/g, "'\\''")}'; exec bash" &`);
  }
}

export function collectJsFiles(baseDir: string, prefix: string): string[] {
  if (!fs.existsSync(baseDir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(fullPath, relPath));
    } else if (entry.name.endsWith('.js')) {
      results.push(relPath);
    }
  }
  return results;
}
