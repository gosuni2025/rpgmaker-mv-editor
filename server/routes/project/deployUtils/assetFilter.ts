import fs from 'fs';
import path from 'path';

// Generator: 에디터 전용 캐릭터 생성기 에셋, 웹 배포에 불필요
export const EXCLUDE_DIRS_LOWER = new Set(['save', '.git', 'node_modules', 'generator']);
export const EXCLUDE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'Game.rpgproject']);

// ─── 미사용 에셋 필터링 ───────────────────────────────────────────────────────

const FILTERABLE_DIRS = new Set([
  'audio/se', 'audio/bgm', 'audio/bgs', 'audio/me',
  'img/animations', 'img/battlebacks1', 'img/battlebacks2',
  'img/characters', 'img/enemies', 'img/faces', 'img/parallaxes',
  'img/pictures', 'img/sv_actors', 'img/sv_enemies',
  'img/titles1', 'img/titles2', 'img/tilesets',
]);

function extractStringValues(obj: unknown, out: Set<string>): void {
  if (typeof obj === 'string') {
    const s = obj.trim();
    if (s && s.length >= 1 && s.length <= 128 && !s.includes('/') && !s.includes('\\') && !s.includes('\n')) {
      out.add(s.toLowerCase());
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) extractStringValues(item, out);
  } else if (obj !== null && typeof obj === 'object') {
    for (const val of Object.values(obj as Record<string, unknown>)) extractStringValues(val, out);
  }
}

/** data/*.json + js/plugins/*.js 에서 참조되는 에셋 이름(소문자, 확장자 없음) 수집 */
export function collectUsedAssetNames(projectPath: string): Set<string> {
  const names = new Set<string>();

  const dataDir = path.join(projectPath, 'data');
  if (fs.existsSync(dataDir)) {
    for (const file of fs.readdirSync(dataDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        extractStringValues(JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')), names);
      } catch {}
    }
  }

  const pluginsDir = path.join(projectPath, 'js', 'plugins');
  if (fs.existsSync(pluginsDir)) {
    for (const file of fs.readdirSync(pluginsDir)) {
      if (!file.endsWith('.js')) continue;
      try {
        const content = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
        for (const m of content.matchAll(/["']([^"'\\/\n\r]{1,80})["']/g)) {
          names.add(m[1].trim().toLowerCase());
        }
      } catch {}
    }
  }

  return names;
}

/** 배포할 파일 목록을 상대경로 배열로 반환 */
export function collectFilesForDeploy(baseDir: string, subDir = '', usedNames?: Set<string>): string[] {
  const currentDir = subDir ? path.join(baseDir, subDir) : baseDir;
  const results: string[] = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (EXCLUDE_FILES.has(entry.name)) continue;
    const rel = subDir ? `${subDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS_LOWER.has(entry.name.toLowerCase())) continue;
      results.push(...collectFilesForDeploy(baseDir, rel, usedNames));
    } else {
      if (usedNames && subDir && FILTERABLE_DIRS.has(subDir.toLowerCase())) {
        const baseName = path.basename(entry.name, path.extname(entry.name)).toLowerCase();
        if (!usedNames.has(baseName)) continue;
      }
      results.push(rel);
    }
  }
  return results;
}
