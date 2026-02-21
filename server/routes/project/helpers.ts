import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { execFile } from 'child_process';
import { exec } from 'child_process';

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
