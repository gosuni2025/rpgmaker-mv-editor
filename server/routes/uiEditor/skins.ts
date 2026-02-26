import fs from 'fs';
import path from 'path';
import express from 'express';
import projectManager from '../../services/projectManager';
import fileWatcher from '../../services/fileWatcher';

const router = express.Router();

interface SkinEntry {
  name: string; label?: string; file?: string; cornerSize: number;
  frameX?: number; frameY?: number; frameW?: number; frameH?: number;
  fillX?: number; fillY?: number; fillW?: number; fillH?: number;
  useCenterFill?: boolean;
  cursorX?: number; cursorY?: number; cursorW?: number; cursorH?: number;
  cursorCornerSize?: number; cursorRenderMode?: 'nineSlice' | 'stretch' | 'tile';
  cursorBlendMode?: 'normal' | 'add' | 'multiply' | 'screen';
  cursorOpacity?: number; cursorBlink?: boolean; cursorPadding?: number;
  cursorToneR?: number; cursorToneG?: number; cursorToneB?: number;
}
interface SkinsData { defaultSkin: string; defaultFrameSkin?: string; defaultCursorSkin?: string; skins: SkinEntry[]; }

const DEFAULT_SKINS: SkinEntry[] = [{ name: 'Window', file: 'Window', cornerSize: 24, useCenterFill: false }];
const DEFAULT_SKINS_DATA: SkinsData = { defaultSkin: 'Window', skins: DEFAULT_SKINS };

function getSkinsPath(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'data', 'UIEditorSkins.json');
}

function readSkinsData(): SkinsData {
  const p = getSkinsPath();
  if (!p || !fs.existsSync(p)) return { ...DEFAULT_SKINS_DATA, skins: [...DEFAULT_SKINS] };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const skins = Array.isArray(data.skins) && data.skins.length > 0 ? data.skins : [...DEFAULT_SKINS];
    const windowSkin = skins.find((s: SkinEntry) => s.name === 'Window');
    if (windowSkin && windowSkin.useCenterFill === undefined) windowSkin.useCenterFill = false;
    for (const s of skins) { if (!s.file) s.file = s.name; }
    return { defaultSkin: data.defaultSkin || 'Window', defaultFrameSkin: data.defaultFrameSkin, defaultCursorSkin: data.defaultCursorSkin, skins };
  } catch {}
  return { ...DEFAULT_SKINS_DATA, skins: [...DEFAULT_SKINS] };
}

function writeSkinsData(data: SkinsData): void {
  const p = getSkinsPath();
  if (!p) return;
  fileWatcher.markApiWrite('UIEditorSkins.json');
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

type SkinUpdateBody = Partial<Omit<SkinEntry, 'name' | 'file'>>;

/** GET /api/ui-editor/skins */
router.get('/', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  res.json(readSkinsData());
});

/** PUT /api/ui-editor/skins/default */
router.put('/default', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const body = req.body as { defaultSkin?: string; defaultFrameSkin?: string; defaultCursorSkin?: string };
  const data = readSkinsData();
  if (body.defaultSkin) data.defaultSkin = body.defaultSkin;
  if (body.defaultFrameSkin !== undefined) data.defaultFrameSkin = body.defaultFrameSkin || undefined;
  if (body.defaultCursorSkin !== undefined) data.defaultCursorSkin = body.defaultCursorSkin || undefined;
  if (!body.defaultSkin && !body.defaultFrameSkin && !body.defaultCursorSkin) {
    return res.status(400).json({ error: 'at least one default field required' });
  }
  writeSkinsData(data);
  res.json({ ok: true });
});

/** POST /api/ui-editor/skins — 스킨 등록 */
router.post('/', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const { name, file, label, cornerSize = 24 } = req.body as { name?: string; file?: string; label?: string; cornerSize?: number };
  if (!name) return res.status(400).json({ error: 'name required' });
  const data = readSkinsData();
  if (data.skins.find((s) => s.name === name)) return res.status(409).json({ error: 'Already exists' });
  const entry: SkinEntry = { name, cornerSize };
  if (file) entry.file = file;
  if (label) entry.label = label;
  data.skins.push(entry);
  writeSkinsData(data);
  res.json({ ok: true });
});

/** PUT /api/ui-editor/skins/:name — 스킨 속성 업데이트 */
router.put('/:name', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const data = readSkinsData();
  const idx = data.skins.findIndex((s) => s.name === req.params.name);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const updates = req.body as SkinUpdateBody;
  const skin = data.skins[idx];
  const fields: (keyof SkinUpdateBody)[] = [
    'cornerSize', 'label', 'frameX', 'frameY', 'frameW', 'frameH',
    'fillX', 'fillY', 'fillW', 'fillH', 'useCenterFill',
    'cursorX', 'cursorY', 'cursorW', 'cursorH', 'cursorCornerSize',
    'cursorRenderMode', 'cursorBlendMode', 'cursorOpacity', 'cursorBlink',
    'cursorPadding', 'cursorToneR', 'cursorToneG', 'cursorToneB',
  ];
  for (const f of fields) {
    if (updates[f] !== undefined) (skin as any)[f] = updates[f];
  }
  writeSkinsData(data);
  res.json({ ok: true });
});

/** DELETE /api/ui-editor/skins/:name */
router.delete('/:name', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const data = readSkinsData();
  const idx = data.skins.findIndex((s) => s.name === req.params.name);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  data.skins.splice(idx, 1);
  writeSkinsData(data);
  res.json({ ok: true });
});

/** POST /api/ui-editor/upload-skin */
router.post('/upload', express.raw({ type: 'image/png', limit: '10mb' }), (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const name = (req.query.name as string || '').replace(/[^a-zA-Z0-9_\-가-힣]/g, '');
  if (!name) return res.status(400).json({ error: 'name required' });
  const systemDir = path.join(projectManager.currentPath!, 'img', 'system');
  if (!fs.existsSync(systemDir)) fs.mkdirSync(systemDir, { recursive: true });
  const dest = path.join(systemDir, `${name}.png`);
  try {
    fs.writeFileSync(dest, req.body as Buffer);
    const data = readSkinsData();
    if (!data.skins.find((s) => s.name === name)) {
      data.skins.push({ name, cornerSize: 24 });
      writeSkinsData(data);
    }
    res.json({ ok: true, name });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
