import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { collectFiles, fileHash, MigrationFile } from './helpers';

let runtimePath = path.join(__dirname, '..', '..', 'runtime');

export function setRuntimePath(p: string) { runtimePath = p; }
export function getRuntimePath() { return runtimePath; }

// ─── 파일 비교 ───
export function compareFile(editorFile: string, projectFile: string, displayPath: string): MigrationFile {
  const editorStat = fs.statSync(editorFile);
  const editorSize = editorStat.size;
  const editorMtime = editorStat.mtime.toISOString();

  if (!fs.existsSync(projectFile)) {
    return { file: displayPath, status: 'add', editorSize, editorMtime };
  }
  const projectStat = fs.statSync(projectFile);
  const projectSize = projectStat.size;
  const projectMtime = projectStat.mtime.toISOString();
  if (fileHash(editorFile) !== fileHash(projectFile)) {
    return { file: displayPath, status: 'update', editorSize, projectSize, editorMtime, projectMtime };
  }
  return { file: displayPath, status: 'same', editorSize, projectSize, editorMtime, projectMtime };
}

// ─── 런타임 파일 비교 (migration-check) ───
export function checkRuntimeFiles(projectPath: string): { files: MigrationFile[]; needsMigration: boolean } {
  const runtimeJsDir = path.join(runtimePath, 'js');
  const projectJsDir = path.join(projectPath, 'js', '3d');
  const runtimeFiles = collectFiles(runtimeJsDir, runtimeJsDir);
  const files: MigrationFile[] = [];
  let needsMigration = false;

  for (const relFile of runtimeFiles) {
    if (relFile === 'plugins.js' || relFile.startsWith('plugins/') || relFile.startsWith('plugins\\')) continue;
    const isLib = relFile.startsWith('libs/') || relFile.startsWith('libs\\');
    if (isLib && !relFile.includes('three')) continue;

    const editorFile = path.join(runtimeJsDir, relFile);
    const projectFile = isLib ? path.join(projectPath, 'js', relFile) : path.join(projectJsDir, relFile);
    const displayPath = isLib ? `js/${relFile}` : `js/3d/${relFile}`;
    const mf = compareFile(editorFile, projectFile, displayPath);
    files.push(mf);
    if (mf.status !== 'same') needsMigration = true;
  }

  // index_3d.html
  const runtimeIndex3d = path.join(runtimePath, 'index_3d.html');
  if (fs.existsSync(runtimeIndex3d)) {
    const projectIndex3d = path.join(projectPath, 'index_3d.html');
    const mf = compareFile(runtimeIndex3d, projectIndex3d, 'index_3d.html');
    files.push(mf);
    if (mf.status !== 'same') needsMigration = true;
  }

  files.sort((a, b) => {
    const order = { add: 0, update: 1, same: 2 };
    return order[a.status] - order[b.status];
  });

  return { files, needsMigration };
}

// ─── 에디터 플러그인 비교 ───
export function checkEditorPlugins(projectPath: string): { files: MigrationFile[]; needsMigration: boolean } {
  const editorPluginsDir = path.join(runtimePath, 'js', 'plugins');
  const projectPluginsDir = path.join(projectPath, 'js', 'plugins');
  const files: MigrationFile[] = [];
  let needsMigration = false;

  if (!fs.existsSync(editorPluginsDir)) return { files, needsMigration };

  for (const epFile of fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js'))) {
    const editorFile = path.join(editorPluginsDir, epFile);
    const projectFile = path.join(projectPluginsDir, epFile);
    const mf = compareFile(editorFile, projectFile, `js/plugins/${epFile}`);
    files.push(mf);
    if (mf.status !== 'same') needsMigration = true;
  }

  return { files, needsMigration };
}

// ─── 단일 파일 복사 ───
export function copyMigrationFile(projectRoot: string, file: string): { from: string; to: string } {
  const runtimeJsDir = path.join(runtimePath, 'js');
  const projectJsDir = path.join(projectRoot, 'js', '3d');
  let src: string, dest: string;

  if (file === 'index_3d.html') {
    src = path.join(runtimePath, 'index_3d.html');
    dest = path.join(projectRoot, 'index_3d.html');
  } else if (file.startsWith('js/libs/')) {
    const relFile = file.replace(/^js\//, '');
    src = path.join(runtimeJsDir, relFile);
    dest = path.join(projectRoot, 'js', relFile);
  } else if (file.startsWith('js/plugins/')) {
    const relFile = file.replace(/^js\/plugins\//, '');
    src = path.join(runtimePath, 'js', 'plugins', relFile);
    dest = path.join(projectRoot, 'js', 'plugins', relFile);
  } else {
    const relFile = file.replace(/^js\/3d\//, '');
    src = path.join(runtimeJsDir, relFile);
    dest = path.join(projectJsDir, relFile);
  }

  if (!fs.existsSync(src)) throw new Error(`Source file not found: ${src}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);

  return { from: src, to: dest };
}

// ─── 플러그인 등록 (plugins.js) ───
export function registerPluginsInJs(projectRoot: string): boolean {
  const editorPluginsDir = path.join(runtimePath, 'js', 'plugins');
  if (!fs.existsSync(editorPluginsDir)) return false;

  const pluginsJsPath = path.join(projectRoot, 'js', 'plugins.js');
  let pluginList: { name: string; status: boolean; description: string; parameters: Record<string, string> }[] = [];
  if (fs.existsSync(pluginsJsPath)) {
    const content = fs.readFileSync(pluginsJsPath, 'utf8');
    const match = content.match(/\$plugins\s*=\s*(\[[\s\S]*?\]);/);
    if (match) {
      try { pluginList = JSON.parse(match[1]); } catch { /* parse error */ }
    }
  }

  const registeredNames = new Set(pluginList.map(p => p.name));
  let modified = false;
  for (const epFile of fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js'))) {
    const pluginName = epFile.replace('.js', '');
    if (!registeredNames.has(pluginName)) {
      pluginList.push({ name: pluginName, status: true, description: '', parameters: {} });
      modified = true;
    }
  }

  if (modified) {
    const lines = pluginList.map(p => JSON.stringify(p));
    const content = `// Generated by RPG Maker.\n// Do not edit this file directly.\nvar $plugins =\n[\n${lines.join(',\n')}\n];\n`;
    fs.writeFileSync(pluginsJsPath, content, 'utf8');
  }

  return modified;
}

// ─── 전체 마이그레이션 (레거시 + 선택 파일) ───
export function migrateFiles(projectRoot: string, selectedFiles?: string[]): string[] {
  const runtimeJsDir = path.join(runtimePath, 'js');
  const projectJsDir = path.join(projectRoot, 'js', '3d');
  const copied: string[] = [];

  if (selectedFiles && selectedFiles.length > 0) {
    for (const file of selectedFiles) {
      if (file === 'index_3d.html') {
        const src = path.join(runtimePath, 'index_3d.html');
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(projectRoot, 'index_3d.html'));
          copied.push('index_3d.html');
        }
        continue;
      }
      if (file.startsWith('js/libs/')) {
        const relFile = file.replace(/^js\//, '');
        const src = path.join(runtimeJsDir, relFile);
        if (fs.existsSync(src)) {
          const dest = path.join(projectRoot, 'js', relFile);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
          copied.push(file);
        }
        continue;
      }
      const relFile = file.replace(/^js\/3d\//, '');
      if (relFile === 'plugins.js' || relFile.startsWith('plugins/') || relFile.startsWith('plugins\\')) continue;
      const src = path.join(runtimeJsDir, relFile);
      if (!fs.existsSync(src)) continue;
      const dest = path.join(projectJsDir, relFile);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      copied.push(`js/3d/${relFile}`);
    }
  } else {
    // Legacy: copy all changed files
    const runtimeFiles = collectFiles(runtimeJsDir, runtimeJsDir);
    for (const relFile of runtimeFiles) {
      if (relFile === 'plugins.js' || relFile.startsWith('plugins/') || relFile.startsWith('plugins\\')) continue;
      const isLib = relFile.startsWith('libs/') || relFile.startsWith('libs\\');
      if (isLib && !relFile.includes('three')) continue;
      const src = path.join(runtimeJsDir, relFile);
      const dest = isLib ? path.join(projectRoot, 'js', relFile) : path.join(projectJsDir, relFile);
      if (fs.existsSync(dest) && fileHash(src) === fileHash(dest)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      copied.push(isLib ? `js/${relFile}` : `js/3d/${relFile}`);
    }
    // index_3d.html
    const runtimeIndex3d = path.join(runtimePath, 'index_3d.html');
    const projectIndex3d = path.join(projectRoot, 'index_3d.html');
    if (fs.existsSync(runtimeIndex3d) && (!fs.existsSync(projectIndex3d) || fileHash(runtimeIndex3d) !== fileHash(projectIndex3d))) {
      fs.copyFileSync(runtimeIndex3d, projectIndex3d);
      copied.push('index_3d.html');
    }
  }

  // Copy editor plugins
  const editorPluginsDir = path.join(runtimePath, 'js', 'plugins');
  const projectPluginsDir = path.join(projectRoot, 'js', 'plugins');
  if (fs.existsSync(editorPluginsDir)) {
    fs.mkdirSync(projectPluginsDir, { recursive: true });
    for (const epFile of fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js'))) {
      const src = path.join(editorPluginsDir, epFile);
      const dest = path.join(projectPluginsDir, epFile);
      if (!fs.existsSync(dest) || fileHash(src) !== fileHash(dest)) {
        fs.copyFileSync(src, dest);
        copied.push(`js/plugins/${epFile}`);
      }
    }
    registerPluginsInJs(projectRoot);
  }

  return copied;
}

// ─── Git 유틸리티 ───
export function isGitAvailable(): boolean {
  try { execSync('git --version', { stdio: 'ignore' }); return true; } catch { return false; }
}

export function isGitRepo(projectRoot: string): boolean {
  try { execSync('git rev-parse --git-dir', { cwd: projectRoot, stdio: 'ignore' }); return true; } catch { return false; }
}

export function ensureGitRepo(projectRoot: string): boolean {
  if (isGitRepo(projectRoot)) return false;
  execSync('git init', { cwd: projectRoot, stdio: 'ignore' });
  return true;
}

export function gitBackup(projectRoot: string) {
  ensureGitRepo(projectRoot);
  execSync('git add -A', { cwd: projectRoot, stdio: 'ignore' });
  let hasStaged = false;
  try { execSync('git diff --cached --quiet', { cwd: projectRoot, stdio: 'ignore' }); } catch { hasStaged = true; }
  let hasHead = false;
  try { execSync('git rev-parse HEAD', { cwd: projectRoot, stdio: 'ignore' }); hasHead = true; } catch {}
  if (!hasStaged && hasHead) return;
  const message = hasHead ? 'Backup before runtime migration' : 'Initial commit (before runtime migration)';
  execSync(`git commit -m "${message}"`, { cwd: projectRoot, stdio: 'ignore' });
}
