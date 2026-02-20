#!/usr/bin/env node
/**
 * RPG Maker MV 3D 프로젝트 gh-pages 배포 스크립트
 *
 * 역할:
 *  1. 프로젝트 파일을 gh-pages 저장소로 복사 (save/ 제외)
 *  2. index_3d.html → index.html / 원본 index.html → index_pixi.html
 *  3. git 커밋 & 푸시
 *
 * 주의: _ext.json 파일은 그대로 포함됨.
 *       rpg_managers.js가 런타임에 자동으로 병합함.
 *
 * 사용법:
 *   node scripts/deploy-gh-pages.js <프로젝트경로> <gh-pages저장소경로>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── 인자 파싱 ───────────────────────────────────────────────────────────────
const [,, projectDir, repoDir] = process.argv;
if (!projectDir || !repoDir) {
  console.error('사용법: node deploy-gh-pages.js <프로젝트경로> <저장소경로>');
  process.exit(1);
}

const src = path.resolve(projectDir);
const dst = path.resolve(repoDir);

// ─── 제외 목록 ───────────────────────────────────────────────────────────────
const EXCLUDE_DIRS  = new Set(['save', '.git', 'node_modules']);
const EXCLUDE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'Game.rpgproject']);

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function copyRecursive(srcPath, dstPath) {
  const entries = fs.readdirSync(srcPath, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE_FILES.has(entry.name)) continue;
    if (entry.isDirectory() && EXCLUDE_DIRS.has(entry.name)) continue;

    const s = path.join(srcPath, entry.name);
    const d = path.join(dstPath, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyRecursive(s, d);
    } else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  }
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
// ─── 빌드 ID (캐시 버스팅용) ─────────────────────────────────────────────────
const _now = new Date();
const buildId = [
  _now.getFullYear(),
  String(_now.getMonth() + 1).padStart(2, '0'),
  String(_now.getDate()).padStart(2, '0'),
  String(_now.getHours()).padStart(2, '0'),
  String(_now.getMinutes()).padStart(2, '0'),
  String(_now.getSeconds()).padStart(2, '0'),
].join('');

console.log(`\n=== RPG Maker MV gh-pages 배포 ===`);
console.log(`소스: ${src}`);
console.log(`대상: ${dst}`);
console.log(`빌드 ID: ${buildId}\n`);

// 1. 기존 파일 정리 후 복사 (.git 제외)
console.log('[1/4] 파일 복사 중...');
const existing = fs.existsSync(dst) ? fs.readdirSync(dst) : [];
for (const entry of existing) {
  if (entry === '.git') continue;
  fs.rmSync(path.join(dst, entry), { recursive: true, force: true });
}
copyRecursive(src, dst);
console.log('  완료');

// 2. index_3d.html → index.html 처리
console.log('\n[2/4] index.html 처리 중...');
const idx3d   = path.join(dst, 'index_3d.html');
const idxMain = path.join(dst, 'index.html');
const idxPixi = path.join(dst, 'index_pixi.html');

if (fs.existsSync(idxMain) && !fs.existsSync(idxPixi)) {
  fs.renameSync(idxMain, idxPixi);
  console.log('  index.html → index_pixi.html');
}
if (fs.existsSync(idx3d)) {
  fs.renameSync(idx3d, idxMain);
  console.log('  index_3d.html → index.html');
}

// 3. HTML 파일 캐시 버스팅 처리
console.log('\n[3/4] 캐시 버스팅 처리 중...');
const htmlFiles = fs.readdirSync(dst).filter(f => f.endsWith('.html'));
for (const htmlFile of htmlFiles) {
  const htmlPath = path.join(dst, htmlFile);
  let html = fs.readFileSync(htmlPath, 'utf-8');
  // src="...js" 또는 href="...css" 에 ?v=buildId 삽입 (기존 쿼리 교체)
  html = html.replace(/((?:src|href)="[^"?]+\.(?:js|css))(?:\?[^"]*)?"/g,
    (_, base) => `${base}?v=${buildId}"`);
  // <head> 직후에 window.__BUILD_ID__ 전역 변수 주입
  // (PluginManager가 동적으로 로드하는 플러그인 파일에는 ?v= 쿼리를 붙일 수 없으므로,
  //  플러그인이 이 변수를 읽어 빌드 번호를 얻도록 함)
  html = html.replace('<head>', `<head>\n    <script>window.__BUILD_ID__='${buildId}';</script>`);
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`  ${htmlFile}`);
}

// 4. git 커밋 & 푸시
console.log('\n[4/4] git 커밋 & 푸시 중...');
const now = _now.toLocaleString('ko-KR');
try {
  execSync(`git -C "${dst}" add -A`, { stdio: 'inherit' });
  execSync(`git -C "${dst}" commit -m "Deploy: ${now}"`, { stdio: 'inherit' });
  execSync(`git -C "${dst}" push origin main`, { stdio: 'inherit' });
  console.log('\n✓ 배포 완료!');
} catch (e) {
  if (e.status === 1 && e.stderr && e.stderr.toString().includes('nothing to commit')) {
    console.log('\n  변경 사항 없음 — 이미 최신 상태입니다');
  } else {
    throw e;
  }
}

const remote = execSync(`git -C "${dst}" remote get-url origin`, { encoding: 'utf-8' }).trim();
const ghUrl = remote.replace('https://github.com/', '').replace('.git', '').replace('/', '.github.io/');
console.log(`접속 URL: https://${ghUrl}`);
