import fs from 'fs';
import path from 'path';

/**
 * 런타임 JS 파일을 대상 디렉터리에 동기화.
 * server/runtime/js/ → destRoot/js/3d/ (plugins 제외)
 * server/runtime/js/libs/ → destRoot/js/libs/
 * server/runtime/index_3d.html → destRoot/index_3d.html
 */
export function syncRuntimeFiles(destRoot: string): void {
  const runtimeJsDir = path.resolve(__dirname, '../../../runtime/js');
  if (!fs.existsSync(runtimeJsDir)) return;

  function copyDir(srcDir: string, destDir: string) {
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const srcFull = path.join(srcDir, entry.name);
      const destFull = path.join(destDir, entry.name);
      const rel = path.relative(runtimeJsDir, srcFull);
      if (rel === 'plugins' || rel.startsWith('plugins' + path.sep) || rel === 'plugins.js') continue;
      if (entry.isDirectory()) {
        fs.mkdirSync(destFull, { recursive: true });
        copyDir(srcFull, destFull);
      } else {
        fs.mkdirSync(path.dirname(destFull), { recursive: true });
        fs.copyFileSync(srcFull, destFull);
      }
    }
  }

  const js3dDir = path.join(destRoot, 'js', '3d');
  fs.mkdirSync(js3dDir, { recursive: true });

  for (const entry of fs.readdirSync(runtimeJsDir, { withFileTypes: true })) {
    if (entry.name === 'plugins' || entry.name === 'plugins.js') continue;
    const srcFull = path.join(runtimeJsDir, entry.name);
    if (entry.name === 'libs') {
      const destFull = path.join(destRoot, 'js', 'libs');
      fs.mkdirSync(destFull, { recursive: true });
      if (entry.isDirectory()) copyDir(srcFull, destFull);
    } else {
      const destFull = path.join(js3dDir, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destFull, { recursive: true });
        copyDir(srcFull, destFull);
      } else {
        fs.copyFileSync(srcFull, destFull);
      }
    }
  }

  const runtimeIdx3d = path.resolve(__dirname, '../../../runtime/index_3d.html');
  if (fs.existsSync(runtimeIdx3d)) {
    fs.copyFileSync(runtimeIdx3d, path.join(destRoot, 'index_3d.html'));
  }
}

export function applyIndexHtmlRename(stagingDir: string) {
  const idx3d = path.join(stagingDir, 'index_3d.html');
  const idxMain = path.join(stagingDir, 'index.html');
  const idxPixi = path.join(stagingDir, 'index_pixi.html');
  if (fs.existsSync(idxMain) && !fs.existsSync(idxPixi)) {
    fs.renameSync(idxMain, idxPixi);
  }
  if (fs.existsSync(idx3d)) {
    fs.renameSync(idx3d, idxMain);
  }
}
