import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import express from 'express';
import sharp from 'sharp';
import projectManager from '../../services/projectManager';

const router = express.Router();

function getSystemDir(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'img', 'system');
}

/** GET /api/ui-editor/images/list — img/system/ PNG 목록 */
router.get('/list', (req, res) => {
  const dir = getSystemDir();
  if (!dir) return res.status(404).json({ error: 'No project' });
  if (!fs.existsSync(dir)) return res.json({ files: [] });
  const files = fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .map((f) => path.basename(f, '.png'));
  res.json({ files });
});

/** POST /api/ui-editor/images/create-placeholder — 플레이스홀더 이미지 생성 */
router.post('/create-placeholder', async (req, res) => {
  const dir = getSystemDir();
  if (!dir) return res.status(404).json({ error: 'No project' });

  const { className, width, height } = req.body as {
    className?: string;
    width?: number;
    height?: number;
  };
  if (!className || !width || !height) {
    return res.status(400).json({ error: 'className, width, height required' });
  }

  const w = Math.max(32, Math.round(width));
  const h = Math.max(32, Math.round(height));
  const shortName = className.replace(/^Window_/, '');
  const filename = `${className}_img`;

  // SVG로 검은 배경 + 흰 텍스트 플레이스홀더 생성
  const fontSize = Math.max(12, Math.min(22, Math.round(w / 20)));
  const subFontSize = Math.max(10, Math.round(fontSize * 0.65));
  const cy = Math.round(h / 2);

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="#111111"/>
  <rect x="3" y="3" width="${w - 6}" height="${h - 6}" fill="none" stroke="#333333" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="${Math.round(w / 2)}" y="${cy - Math.round(fontSize * 0.6)}" text-anchor="middle"
    font-family="monospace,sans-serif" font-size="${fontSize}" fill="#eeeeee">${shortName}</text>
  <text x="${Math.round(w / 2)}" y="${cy + Math.round(subFontSize * 1.2)}" text-anchor="middle"
    font-family="monospace,sans-serif" font-size="${subFontSize}" fill="#666666">${w} x ${h} px</text>
</svg>`;

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${filename}.png`);

  try {
    await sharp({
      create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toFile(dest);

    res.json({ ok: true, filename });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/ui-editor/images/open-folder — img/system/ 폴더 열기 */
router.post('/open-folder', (req, res) => {
  const dir = getSystemDir();
  if (!dir) return res.status(404).json({ error: 'No project' });
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const platform = process.platform;
  let cmd: string;
  if (platform === 'darwin') cmd = `open "${dir}"`;
  else if (platform === 'win32') cmd = `explorer "${dir}"`;
  else cmd = `xdg-open "${dir}"`;

  exec(cmd, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

export default router;
