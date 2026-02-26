import fs from 'fs';
import path from 'path';
import express from 'express';
import projectManager from '../../services/projectManager';

const router = express.Router();

const FONT_EXTS = ['.ttf', '.otf', '.woff', '.woff2'];

function getFontsConfigPath(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'data', 'UIEditorFonts.json');
}

function loadFontsConfig(): { defaultFontFace: string } {
  const p = getFontsConfigPath();
  if (!p || !fs.existsSync(p)) return { defaultFontFace: '' };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { defaultFontFace: '' }; }
}

/** GET /api/ui-editor/fonts — fonts/ 폴더 파일 목록 + 현재 설정 반환 */
router.get('/', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const fontsDir = path.join(projectManager.currentPath!, 'fonts');
  let files: Array<{ name: string; file: string; family: string }> = [];
  if (fs.existsSync(fontsDir)) {
    files = fs.readdirSync(fontsDir)
      .filter((f) => FONT_EXTS.includes(path.extname(f).toLowerCase()))
      .map((file) => {
        const base = path.basename(file, path.extname(file));
        // gamefont.css에서 family 이름 추출 시도
        const cssPath = path.join(fontsDir, 'gamefont.css');
        let family = base;
        if (file.toLowerCase().includes('mplus') || file.toLowerCase().includes('gamefont')) {
          family = 'GameFont';
        }
        return { name: base, file, family };
      });

    // gamefont.css에서 추가 font-face 파싱
    const cssPath = path.join(fontsDir, 'gamefont.css');
    if (fs.existsSync(cssPath)) {
      const cssText = fs.readFileSync(cssPath, 'utf8');
      const faceRegex = /@font-face\s*\{([^}]+)\}/g;
      let match;
      while ((match = faceRegex.exec(cssText)) !== null) {
        const block = match[1];
        const familyM = /font-family\s*:\s*['"]?([^;'"]+)['"]?/i.exec(block);
        const srcM = /src\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i.exec(block);
        if (familyM && srcM) {
          const familyName = familyM[1].trim();
          const srcFile = path.basename(srcM[1].trim());
          // 이미 있는 파일 엔트리의 family 업데이트
          const existing = files.find((f) => f.file === srcFile);
          if (existing) existing.family = familyName;
        }
      }
    }
  }
  const config = loadFontsConfig();
  res.json({ fonts: files, ...config });
});

/** PUT /api/ui-editor/fonts — 폰트 설정 저장 */
router.put('/', (req, res) => {
  const p = getFontsConfigPath();
  if (!p) return res.status(404).json({ error: 'No project' });
  try {
    const existing = loadFontsConfig();
    const updated = { ...existing, ...req.body };
    fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
