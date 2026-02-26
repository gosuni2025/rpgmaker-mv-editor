import fs from 'fs';
import path from 'path';
import express from 'express';
import projectManager from '../../services/projectManager';
import fileWatcher from '../../services/fileWatcher';

const router = express.Router();

function getConfigPath(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'data', 'UIEditorConfig.json');
}

/** GET /api/ui-editor/config — UIEditorConfig.json 읽기 */
router.get('/', (req, res) => {
  const configPath = getConfigPath();
  if (!configPath) return res.status(404).json({ error: 'No project' });
  if (!fs.existsSync(configPath)) return res.json({ overrides: {} });
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json(data);
  } catch {
    res.json({ overrides: {} });
  }
});

/** PUT /api/ui-editor/config — UIEditorConfig.json 저장 */
router.put('/', (req, res) => {
  const configPath = getConfigPath();
  if (!configPath) return res.status(404).json({ error: 'No project' });
  try {
    fileWatcher.markApiWrite('UIEditorConfig.json');
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
