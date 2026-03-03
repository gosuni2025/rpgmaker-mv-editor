import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const BUNDLE_MAX_BYTES = 99 * 1024 * 1024;

export interface BundleFileEntry {
  absPath: string;
  zipName: string;
  size: number;
}

export function collectBundleEntries(dirPath: string): BundleFileEntry[] {
  const result: BundleFileEntry[] = [];
  function walk(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
      } else {
        result.push({ absPath: full, zipName: rel, size: fs.statSync(full).size });
      }
    }
  }
  walk(dirPath, '');
  return result;
}

async function writeZip(zipPath: string, entries: BundleFileEntry[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 0 } });
    archive.on('error', reject);
    output.on('close', resolve);
    archive.pipe(output);
    for (const e of entries) archive.file(e.absPath, { name: e.zipName });
    archive.finalize();
  });
}

/** 배포 디렉터리에 SW 번들 파일 생성
 * @param extDirs staging에 없는 디렉터리 항목 (img/, audio/ 등 직접 스트리밍용)
 */
export async function generateBundleFiles(
  stagingDir: string,
  buildId: string,
  log?: (msg: string) => void,
  extDirs?: Map<string, BundleFileEntry[]>,
): Promise<void> {
  const l = (msg: string) => { if (log) log(msg); };
  l('── SW 번들 ZIP 생성 ──');

  const bundlesDir = path.join(stagingDir, 'bundles');
  fs.mkdirSync(bundlesDir, { recursive: true });

  const manifestBundles: { file: string; prefix: string }[] = [];

  for (const dir of ['img', 'audio', 'data']) {
    let entries: BundleFileEntry[];
    if (extDirs?.has(dir)) {
      entries = extDirs.get(dir)!;
    } else {
      const dirPath = path.join(stagingDir, dir);
      if (!fs.existsSync(dirPath)) continue;
      entries = collectBundleEntries(dirPath);
    }
    if (entries.length === 0) continue;
    const prefix = `${dir}/`;

    const chunks: BundleFileEntry[][] = [];
    let chunk: BundleFileEntry[] = [];
    let chunkSize = 0;
    for (const entry of entries) {
      if (chunk.length > 0 && chunkSize + entry.size > BUNDLE_MAX_BYTES) {
        chunks.push(chunk);
        chunk = [];
        chunkSize = 0;
      }
      chunk.push(entry);
      chunkSize += entry.size;
    }
    if (chunk.length > 0) chunks.push(chunk);

    for (let i = 0; i < chunks.length; i++) {
      const fileName = i === 0 ? `${dir}.zip` : `${dir}_${i + 1}.zip`;
      const zipPath = path.join(bundlesDir, fileName);
      const sizeMb = (chunks[i].reduce((s, e) => s + e.size, 0) / 1024 / 1024).toFixed(1);
      l(`  ${dir}/ → bundles/${fileName} (${sizeMb} MB, ${chunks[i].length}개 파일)`);
      await writeZip(zipPath, chunks[i]);
      manifestBundles.push({ file: fileName, prefix });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jszipPath: string = require.resolve('jszip/dist/jszip.min.js');
  fs.copyFileSync(jszipPath, path.join(bundlesDir, 'jszip.min.js'));

  fs.writeFileSync(
    path.join(bundlesDir, 'manifest.json'),
    JSON.stringify({ version: buildId, bundles: manifestBundles }),
    'utf-8',
  );

  const swSrcPath = path.resolve(__dirname, '../../../runtime/sw.js');
  if (fs.existsSync(swSrcPath)) {
    const swContent = `// build: ${buildId}\n` + fs.readFileSync(swSrcPath, 'utf-8');
    fs.writeFileSync(path.join(stagingDir, 'sw.js'), swContent, 'utf-8');
  }

  l(`✓ 번들 ZIP 생성 완료 (${manifestBundles.length}개 파일)`);
}
