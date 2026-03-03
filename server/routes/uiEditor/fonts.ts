import fs from 'fs';
import path from 'path';
import express from 'express';
import { exec } from 'child_process';
import projectManager from '../../services/projectManager';

const router = express.Router();

const FONT_EXTS = ['.ttf', '.otf', '.woff', '.woff2'];

function getFontsConfigPath(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'data', 'UIEditorFonts.json');
}

function loadFontsConfig(): { defaultFontFace: string; sceneFonts?: Record<string, string> } {
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

/** POST /api/ui-editor/fonts/open-folder — fonts/ 폴더를 OS 파일 탐색기로 열기 */
router.post('/open-folder', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const fontsDir = path.join(projectManager.currentPath!, 'fonts');
  if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  exec(`${cmd} "${fontsDir}"`);
  res.json({ success: true });
});

/** POST /api/ui-editor/fonts/register — fonts/ 폴더 재스캔 + 새 파일 자동 등록 */
router.post('/register', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const fontsDir = path.join(projectManager.currentPath!, 'fonts');
  if (!fs.existsSync(fontsDir)) return res.json({ fonts: [], registered: 0 });

  const cssPath = path.join(fontsDir, 'gamefont.css');

  // 기존 CSS에서 등록된 src 파일 목록 추출
  const registeredFiles = new Set<string>();
  let cssText = '';
  if (fs.existsSync(cssPath)) {
    cssText = fs.readFileSync(cssPath, 'utf8');
    const srcRegex = /src\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
    let m;
    while ((m = srcRegex.exec(cssText)) !== null) {
      registeredFiles.add(path.basename(m[1].trim()));
    }
  }

  // 폴더 내 폰트 파일 중 미등록 파일 찾기
  const allFontFiles = fs.readdirSync(fontsDir)
    .filter((f) => FONT_EXTS.includes(path.extname(f).toLowerCase()));
  const newFiles = allFontFiles.filter((f) => !registeredFiles.has(f));

  // 새 파일에 대해 @font-face 추가
  if (newFiles.length > 0) {
    const newEntries = newFiles.map((file) => {
      const family = path.basename(file, path.extname(file));
      return `\n@font-face {\n    font-family: '${family}';\n    src: url('${file}');\n}\n`;
    }).join('');
    fs.writeFileSync(cssPath, cssText + newEntries, 'utf8');
  }

  // 최신 목록 반환 (GET / 와 동일 로직 재사용)
  // re-read to get updated list
  const updatedCss = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  const files = allFontFiles.map((file) => {
    const base = path.basename(file, path.extname(file));
    let family = base;
    if (file.toLowerCase().includes('mplus') || file.toLowerCase().includes('gamefont')) {
      family = 'GameFont';
    }
    return { name: base, file, family };
  });
  // CSS에서 family 이름 반영
  const faceRegex = /@font-face\s*\{([^}]+)\}/g;
  let match;
  while ((match = faceRegex.exec(updatedCss)) !== null) {
    const block = match[1];
    const familyM = /font-family\s*:\s*['"]?([^;'"]+)['"]?/i.exec(block);
    const srcM = /src\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i.exec(block);
    if (familyM && srcM) {
      const familyName = familyM[1].trim();
      const srcFile = path.basename(srcM[1].trim());
      const existing = files.find((f) => f.file === srcFile);
      if (existing) existing.family = familyName;
    }
  }

  const config = loadFontsConfig();
  res.json({ fonts: files, ...config, registered: newFiles.length });
});

/** DELETE /api/ui-editor/fonts/:fileName — 폰트 파일 삭제 + gamefont.css에서 제거 */
router.delete('/:fileName', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const fontsDir = path.join(projectManager.currentPath!, 'fonts');
  const fileName = req.params.fileName;
  const filePath = path.join(fontsDir, fileName);

  // 파일 삭제
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // gamefont.css에서 해당 파일의 @font-face 블록 제거
  const cssPath = path.join(fontsDir, 'gamefont.css');
  if (fs.existsSync(cssPath)) {
    let cssText = fs.readFileSync(cssPath, 'utf8');
    // 해당 파일을 참조하는 @font-face 블록 제거
    const escapedFile = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRegex = new RegExp(`\\s*@font-face\\s*\\{[^}]*url\\(['"]?${escapedFile}['"]?\\)[^}]*\\}`, 'g');
    cssText = cssText.replace(blockRegex, '');
    fs.writeFileSync(cssPath, cssText.trim() + '\n', 'utf8');
  }

  // 삭제된 폰트가 기본 폰트였으면 GameFont로 리셋
  const config = loadFontsConfig();
  const deletedFamily = path.basename(fileName, path.extname(fileName));
  if (config.defaultFontFace === deletedFamily) {
    config.defaultFontFace = 'GameFont';
    const configPath = getFontsConfigPath();
    if (configPath) {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }
  }

  res.json({ ok: true });
});

export default router;
