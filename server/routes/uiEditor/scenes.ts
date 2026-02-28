import fs from 'fs';
import path from 'path';
import express from 'express';
import projectManager from '../../services/projectManager';
import fileWatcher from '../../services/fileWatcher';

const router = express.Router();

function getScenesDir(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'data', 'UIScenes');
}

/** UIScenes/ 디렉터리를 스캔해 { [id]: sceneDef } 반환 */
function readAllScenes(dir: string): Record<string, unknown> {
  const scenes: Record<string, unknown> = {};
  if (!fs.existsSync(dir)) return scenes;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json') || file.startsWith('_')) continue;
    try {
      const scene = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (scene.id) scenes[scene.id] = scene;
    } catch { /* skip invalid */ }
  }
  return scenes;
}

/** _index.json 재생성 */
function updateIndex(dir: string): void {
  const ids = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => f.replace('.json', ''));
  fs.writeFileSync(path.join(dir, '_index.json'), JSON.stringify(ids, null, 2), 'utf8');
}

/** GET /api/ui-editor/scenes — 모든 씬 로드 */
router.get('/', (req, res) => {
  const dir = getScenesDir();
  if (!dir) return res.status(404).json({ error: 'No project' });

  if (fs.existsSync(dir)) {
    return res.json({ scenes: readAllScenes(dir) });
  }

  // 구 방식 폴백 (UIEditorScenes.json)
  const oldPath = path.join(path.dirname(dir), 'UIEditorScenes.json');
  if (fs.existsSync(oldPath)) {
    try { return res.json(JSON.parse(fs.readFileSync(oldPath, 'utf8'))); }
    catch { return res.json({ scenes: {} }); }
  }
  res.json({ scenes: {} });
});

/** PUT /api/ui-editor/scenes — 전체 씬 저장 (씬별 분리) */
router.put('/', (req, res) => {
  const dir = getScenesDir();
  if (!dir) return res.status(404).json({ error: 'No project' });

  const { scenes } = req.body as { scenes: Record<string, unknown> };
  if (!scenes) return res.status(400).json({ error: 'Missing scenes' });

  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 삭제된 씬 처리
    const existing = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    const newIds = new Set(Object.keys(scenes));
    for (const file of existing) {
      if (!newIds.has(file.replace('.json', ''))) {
        fileWatcher.markApiWrite(file);
        fs.unlinkSync(path.join(dir, file));
      }
    }

    // 씬별 저장
    for (const [id, scene] of Object.entries(scenes)) {
      fileWatcher.markApiWrite(id + '.json');
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(scene, null, 2), 'utf8');
    }

    updateIndex(dir);
    fileWatcher.markApiWrite('UIEditorScenes.json');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** PUT /api/ui-editor/scenes/:id — 개별 씬 저장 */
router.put('/:id', (req, res) => {
  const dir = getScenesDir();
  if (!dir) return res.status(404).json({ error: 'No project' });

  const { id } = req.params;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fileWatcher.markApiWrite(id + '.json');
    fileWatcher.markApiWrite('UIEditorScenes.json');
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(req.body, null, 2), 'utf8');
    updateIndex(dir);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** DELETE /api/ui-editor/scenes/:id — 씬 삭제 */
router.delete('/:id', (req, res) => {
  const dir = getScenesDir();
  if (!dir) return res.status(404).json({ error: 'No project' });

  const filePath = path.join(dir, `${req.params.id}.json`);
  if (fs.existsSync(filePath)) {
    fileWatcher.markApiWrite(req.params.id + '.json');
    fileWatcher.markApiWrite('UIEditorScenes.json');
    fs.unlinkSync(filePath);
    updateIndex(dir);
  }
  res.json({ ok: true });
});

export default router;
