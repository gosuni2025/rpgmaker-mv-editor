/**
 * pluginBundler.ts — 디렉토리 기반 다중 파일 플러그인 번들러
 *
 * 플러그인 디렉토리 구조:
 *   plugins/Name/         ← 디렉토리 플러그인 (_plugin.js 존재 시 인식)
 *     _plugin.js          ← 메타데이터 + IIFE 열기 + 공유 변수 선언
 *     01_Foo.js           ← 숫자 접두사 순서
 *     02_Bar.js
 *     BazAlpha.js         ← 접두사 없는 파일 (알파벳순)
 *     _end.js             ← IIFE 닫기
 *
 * 번들 결과는 단일 .js 파일과 동일한 내용이 됨.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface BundleCache {
  content: string;
  hash: string;
  mtimes: Record<string, number>; // 파일 경로 → mtime ms
}

const _cache = new Map<string, BundleCache>();

/** 디렉토리 플러그인인지 확인 (_plugin.js 존재 여부) */
export function isDirectoryPlugin(dirPath: string): boolean {
  return fs.existsSync(path.join(dirPath, '_plugin.js'));
}

/**
 * 디렉토리 플러그인 파일 로딩 순서 반환
 * 순서: _plugin.js → 숫자 접두사 순 파일 → 접두사 없는 파일 알파벳순 → _end.js
 */
export function getPluginFileOrder(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));

  const numbered: string[] = [];
  const alpha: string[] = [];

  for (const f of entries) {
    if (f === '_plugin.js' || f === '_end.js') continue;
    if (/^\d/.test(f)) {
      numbered.push(f);
    } else {
      alpha.push(f);
    }
  }

  numbered.sort((a, b) => {
    const na = parseInt(a) || 0;
    const nb = parseInt(b) || 0;
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });
  alpha.sort((a, b) => a.localeCompare(b));

  const result: string[] = [];
  if (entries.includes('_plugin.js')) result.push('_plugin.js');
  result.push(...numbered, ...alpha);
  if (entries.includes('_end.js')) result.push('_end.js');

  return result;
}

/** mtime 맵 계산 */
function getMtimes(dirPath: string, files: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const f of files) {
    const fp = path.join(dirPath, f);
    try {
      result[fp] = fs.statSync(fp).mtimeMs;
    } catch {
      result[fp] = 0;
    }
  }
  return result;
}

/** mtime 변경 여부 확인 */
function isCacheStale(cached: BundleCache, newMtimes: Record<string, number>): boolean {
  const cachedKeys = Object.keys(cached.mtimes);
  const newKeys = Object.keys(newMtimes);
  if (cachedKeys.length !== newKeys.length) return true;
  for (const k of newKeys) {
    if (cached.mtimes[k] !== newMtimes[k]) return true;
  }
  return false;
}

/**
 * 디렉토리 플러그인을 번들링하여 단일 문자열로 반환
 * mtime 기반 캐시 적용 (변경 없으면 캐시 반환)
 */
export function bundleDirectoryPlugin(dirPath: string): { content: string; hash: string } {
  const files = getPluginFileOrder(dirPath);
  const mtimes = getMtimes(dirPath, files);

  const cached = _cache.get(dirPath);
  if (cached && !isCacheStale(cached, mtimes)) {
    return { content: cached.content, hash: cached.hash };
  }

  const parts: string[] = [];
  for (const f of files) {
    const fp = path.join(dirPath, f);
    try {
      parts.push(fs.readFileSync(fp, 'utf8'));
    } catch (e) {
      console.warn(`[pluginBundler] 파일 읽기 실패: ${fp}`);
    }
  }

  const content = parts.join('');
  const hash = crypto.createHash('md5').update(content).digest('hex');

  _cache.set(dirPath, { content, hash, mtimes });
  return { content, hash };
}

/**
 * 플러그인 이름으로 실제 경로 해석
 * 우선순위: Name.js 파일 → Name/ 디렉토리 (_plugin.js 있는 경우)
 */
export function resolvePlugin(
  pluginsDir: string,
  name: string
): { type: 'file'; path: string } | { type: 'directory'; path: string } | null {
  const filePath = path.join(pluginsDir, `${name}.js`);
  if (fs.existsSync(filePath)) {
    return { type: 'file', path: filePath };
  }
  const dirPath = path.join(pluginsDir, name);
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory() && isDirectoryPlugin(dirPath)) {
    return { type: 'directory', path: dirPath };
  }
  return null;
}

/**
 * 플러그인 디렉토리 내 모든 플러그인 이름 열거
 * (단일 .js 파일 + _plugin.js가 있는 디렉토리 모두 포함)
 */
export function listPluginNames(pluginsDir: string): string[] {
  if (!fs.existsSync(pluginsDir)) return [];
  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  const names: string[] = [];

  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.js')) {
      names.push(e.name.replace('.js', ''));
    } else if (e.isDirectory()) {
      const dirPath = path.join(pluginsDir, e.name);
      if (isDirectoryPlugin(dirPath)) {
        names.push(e.name);
      }
    }
  }

  return names;
}

/**
 * Express 미들웨어: /plugins/Name.js 요청 시
 * pluginsDir 내에서 Name.js 파일 또는 Name/ 디렉토리를 찾아 서빙
 */
export function createPluginBundleMiddleware(pluginsDir: string) {
  return function(req: any, res: any, next: any) {
    const urlPath: string = req.path || req.url || '';
    // /Name.js 패턴만 처리
    const match = urlPath.match(/^\/([^/]+)\.js$/);
    if (!match) return next();

    const name = match[1];
    const dirPath = path.join(pluginsDir, name);

    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory() && isDirectoryPlugin(dirPath)) {
      try {
        const { content } = bundleDirectoryPlugin(dirPath);
        res.set('Content-Type', 'application/javascript');
        res.set('Cache-Control', 'no-store');
        return res.send(content);
      } catch (e) {
        console.error(`[pluginBundler] 번들링 실패: ${dirPath}`, e);
        return res.status(500).send('Plugin bundle error');
      }
    }

    next();
  };
}
