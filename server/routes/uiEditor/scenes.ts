import fs from 'fs';
import path from 'path';
import express from 'express';
import projectManager from '../../services/projectManager';

const router = express.Router();

function getScenesPath(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'data', 'UIEditorScenes.json');
}

/** GET /api/ui-editor/scenes — UIEditorScenes.json 읽기 */
router.get('/', (req, res) => {
  const scenesPath = getScenesPath();
  if (!scenesPath) return res.status(404).json({ error: 'No project' });
  if (!fs.existsSync(scenesPath)) return res.json({ scenes: {} });
  try {
    const data = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
    res.json(data);
  } catch {
    res.json({ scenes: {} });
  }
});

/** PUT /api/ui-editor/scenes — UIEditorScenes.json 저장 */
router.put('/', (req, res) => {
  const scenesPath = getScenesPath();
  if (!scenesPath) return res.status(404).json({ error: 'No project' });
  try {
    fs.writeFileSync(scenesPath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
