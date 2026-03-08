import fs from 'fs';
import path from 'path';
import os from 'os';
import { collectFilesForDeploy } from './assetFilter';
import { syncRuntimeFiles, applyIndexHtmlRename } from './runtimeSync';
import { CacheBustOptions, applyCacheBusting, makeBuildId } from './cacheBusting';
import { inlineEventRefs } from './deployZip';

export interface LocalPreviewState {
  dir: string | null;
  srcPath: string | null;
}

/** 로컬 미리보기 서빙 상태 (서버 수명 동안 유지) */
export const localPreviewState: LocalPreviewState = { dir: null, srcPath: null };

export async function buildLocalPreview(
  srcPath: string,
  opts: CacheBustOptions,
  onEvent: (data: object) => void,
): Promise<string> {
  // 이전 preview 폴더 정리
  if (localPreviewState.dir && fs.existsSync(localPreviewState.dir)) {
    try { fs.rmSync(localPreviewState.dir, { recursive: true, force: true }); } catch {}
  }
  localPreviewState.dir = null;
  localPreviewState.srcPath = null;

  onEvent({ type: 'status', phase: 'counting' });
  onEvent({ type: 'log', message: '── 파일 수집 ──' });

  const allFiles = collectFilesForDeploy(srcPath, '');
  // img/, audio/는 원본 프로젝트에서 직접 서빙 → staging 복사 생략
  const LARGE_DIRS = ['img', 'audio'];
  const stagingFiles = allFiles.filter((rel) => !LARGE_DIRS.includes(rel.split('/')[0].toLowerCase()));

  onEvent({ type: 'counted', total: stagingFiles.length });
  onEvent({ type: 'log', message: `파일 ${stagingFiles.length}개 복사 중... (img/audio는 원본에서 직접 서빙)` });

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpgpreview-'));

  let current = 0;
  for (const rel of stagingFiles) {
    const destFile = path.join(stagingDir, rel);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(path.join(srcPath, rel), destFile);
    current++;
    if (current % 20 === 0 || current === stagingFiles.length) {
      onEvent({ type: 'progress', current, total: stagingFiles.length });
    }
  }
  onEvent({ type: 'log', message: '✓ 복사 완료' });

  onEvent({ type: 'log', message: '런타임 동기화 중...' });
  syncRuntimeFiles(stagingDir);
  onEvent({ type: 'log', message: '✓ 런타임 동기화 완료' });

  onEvent({ type: 'log', message: '이벤트 외부파일 인라인 병합 중...' });
  inlineEventRefs(stagingDir);

  applyIndexHtmlRename(stagingDir);
  const buildId = makeBuildId();
  applyCacheBusting(stagingDir, buildId, opts);
  onEvent({ type: 'log', message: '✓ 처리 완료' });

  localPreviewState.dir = stagingDir;
  localPreviewState.srcPath = srcPath;

  return stagingDir;
}
