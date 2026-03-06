import fs from 'fs';
import path from 'path';
import { Response } from 'express';

// ─── 캐시 버스팅 옵션 ─────────────────────────────────────────────────────────
export interface CacheBustOptions {
  scripts?:      boolean;
  images?:       boolean;
  audio?:        boolean;
  video?:        boolean;
  data?:         boolean;
  filterUnused?: boolean;
  convertWebp?:  boolean;
  bundle?:       boolean;
}

// 배포 시 동기 XHR 없이 접근할 수 있도록 embed하는 data/ 파일 목록
const EMBED_DATA_FILES = [
  'data/UIEditorConfig.json',
  'data/UIEditorSkins.json',
  'data/UIEditorFonts.json',
  'data/Quests.json',
];

/** staging의 data/ 파일들을 읽어 window.__RPGDATA__ 초기화 스크립트 생성 */
function buildRPGDataScript(stagingDir: string): string {
  const entries: string[] = [];

  for (const rel of EMBED_DATA_FILES) {
    const filePath = path.join(stagingDir, rel);
    if (!fs.existsSync(filePath)) continue;
    try {
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      JSON.parse(content); // validate
      entries.push(`"${rel}":${content}`);
    } catch {}
  }

  // UIScenes: _index.json + 각 씬 파일
  const indexPath = path.join(stagingDir, 'data/UIScenes/_index.json');
  if (fs.existsSync(indexPath)) {
    try {
      const indexContent = fs.readFileSync(indexPath, 'utf-8').trim();
      const index = JSON.parse(indexContent);
      entries.push(`"data/UIScenes/_index.json":${indexContent}`);
      if (Array.isArray(index)) {
        for (const id of index) {
          const scenePath = path.join(stagingDir, `data/UIScenes/${id}.json`);
          if (!fs.existsSync(scenePath)) continue;
          try {
            const sc = fs.readFileSync(scenePath, 'utf-8').trim();
            JSON.parse(sc);
            entries.push(`"data/UIScenes/${id}.json":${sc}`);
          } catch {}
        }
      }
    } catch {}
  }

  if (entries.length === 0) return '';
  return `window.__RPGDATA__={${entries.join(',')}};`;
}

/** HTML 파일에 캐시 버스팅 쿼리 및 window.__CACHE_BUST__ 주입 */
export function applyCacheBusting(stagingDir: string, buildId: string, opts: CacheBustOptions = {}) {
  const doScripts = opts.scripts !== false;
  const cb = JSON.stringify({
    buildId,
    scripts: opts.scripts !== false,
    images:  opts.images  !== false,
    audio:   opts.audio   !== false,
    video:   opts.video   !== false,
    data:    opts.data    !== false,
    webp:    opts.convertWebp === true,
  });

  const rpgDataScript = buildRPGDataScript(stagingDir);

  const htmlFiles = fs.readdirSync(stagingDir).filter((f: string) => f.endsWith('.html'));
  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(stagingDir, htmlFile);
    let html = fs.readFileSync(htmlPath, 'utf-8');

    if (doScripts) {
      html = html.replace(
        /((?:src|href)="[^"?]+\.(?:js|css))(?:\?[^"]*)?"/g,
        (_: string, base: string) => `${base}?v=${buildId}"`,
      );
    }

    const inlineScript = rpgDataScript
      ? `window.__BUILD_ID__='${buildId}';window.__CACHE_BUST__=${cb};${rpgDataScript}`
      : `window.__BUILD_ID__='${buildId}';window.__CACHE_BUST__=${cb};`;

    html = html.replace(
      '<head>',
      `<head>\n    <script>${inlineScript}</script>`,
    );

    fs.writeFileSync(htmlPath, html, 'utf-8');
  }
}

export function makeBuildId(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}

export function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

export function sseWrite(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** query string에서 CacheBustOptions 파싱 */
export function parseCacheBustQuery(query: Record<string, unknown>): CacheBustOptions {
  const flag = (key: string) => query[key] !== '0';
  return {
    scripts: flag('cbScripts'),
    images:  flag('cbImages'),
    audio:   flag('cbAudio'),
    video:   flag('cbVideo'),
    data:    flag('cbData'),
    filterUnused: query['cbFilterUnused'] === '1' || query['filterUnused'] === true,
    convertWebp: query['cbConvertWebp'] === '1' || query['convertWebp'] === true,
    bundle: query['bundle'] === '1' || query['bundle'] === true,
  };
}
