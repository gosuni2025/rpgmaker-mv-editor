import fs from 'fs';
import path from 'path';
import express from 'express';
import projectManager from '../../services/projectManager';
import fileWatcher from '../../services/fileWatcher';

const router = express.Router();

function getTemplatesDir(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'data', 'UITemplates');
}

/** UITemplates/ 디렉터리를 스캔해 { [id]: templateDef } 반환 */
function readAllTemplates(dir: string): Record<string, unknown> {
  const templates: Record<string, unknown> = {};
  if (!fs.existsSync(dir)) return templates;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json') || file.startsWith('_')) continue;
    try {
      const template = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (template.id) templates[template.id] = template;
    } catch { /* skip invalid */ }
  }
  return templates;
}

/** _index.json 재생성 */
function updateIndex(dir: string): void {
  const ids = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => f.replace('.json', ''));
  fs.writeFileSync(path.join(dir, '_index.json'), JSON.stringify(ids, null, 2), 'utf8');
}

/** GET /api/ui-editor/templates — 모든 템플릿 로드 */
router.get('/', (req, res) => {
  const dir = getTemplatesDir();
  if (!dir) return res.status(404).json({ error: 'No project' });

  if (!fs.existsSync(dir)) {
    return res.json({ templates: {} });
  }
  res.json({ templates: readAllTemplates(dir) });
});

/** PUT /api/ui-editor/templates — 전체 템플릿 저장 (템플릿별 분리) */
router.put('/', (req, res) => {
  const dir = getTemplatesDir();
  if (!dir) return res.status(404).json({ error: 'No project' });

  const { templates } = req.body as { templates: Record<string, unknown> };
  if (!templates) return res.status(400).json({ error: 'Missing templates' });

  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 삭제된 템플릿 처리
    const existing = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    const newIds = new Set(Object.keys(templates));
    for (const file of existing) {
      if (!newIds.has(file.replace('.json', ''))) {
        fileWatcher.markApiWrite(file);
        fs.unlinkSync(path.join(dir, file));
      }
    }

    // 템플릿별 저장
    for (const [id, template] of Object.entries(templates)) {
      fileWatcher.markApiWrite(id + '.json');
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(template, null, 2), 'utf8');
    }

    updateIndex(dir);
    fileWatcher.markApiWrite('UIEditorTemplates.json');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** PUT /api/ui-editor/templates/:id — 개별 템플릿 저장 */
router.put('/:id', (req, res) => {
  const dir = getTemplatesDir();
  if (!dir) return res.status(404).json({ error: 'No project' });

  const { id } = req.params;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fileWatcher.markApiWrite(id + '.json');
    fileWatcher.markApiWrite('UIEditorTemplates.json');
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(req.body, null, 2), 'utf8');
    updateIndex(dir);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** DELETE /api/ui-editor/templates/:id — 템플릿 삭제 */
router.delete('/:id', (req, res) => {
  const dir = getTemplatesDir();
  if (!dir) return res.status(404).json({ error: 'No project' });

  const filePath = path.join(dir, `${req.params.id}.json`);
  if (fs.existsSync(filePath)) {
    fileWatcher.markApiWrite(req.params.id + '.json');
    fileWatcher.markApiWrite('UIEditorTemplates.json');
    fs.unlinkSync(filePath);
    updateIndex(dir);
  }
  res.json({ ok: true });
});

export default router;
