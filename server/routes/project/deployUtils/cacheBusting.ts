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

    html = html.replace(
      '<head>',
      `<head>\n    <script>window.__BUILD_ID__='${buildId}';window.__CACHE_BUST__=${cb};</script>`,
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
