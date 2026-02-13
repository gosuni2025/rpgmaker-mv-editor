import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';
import settingsManager from '../services/settingsManager';

const router = express.Router();

// 사용자 지정 경로 (런타임에 설정 가능, 세션 단위)
let customGeneratorPath: string | null = null;

const VALID_GENDERS = ['Male', 'Female', 'Kid'];
const VALID_OUTPUT_TYPES = ['Face', 'TV', 'SV', 'TVD'];

function findSteamGeneratorPath(): string | null {
  return settingsManager.getGeneratorPath();
}

function isValidGeneratorPath(p: string): boolean {
  return fs.existsSync(p) && fs.existsSync(path.join(p, 'gradients.png'));
}

// Generator 경로 결정: 1) 프로젝트 내 generator/ 2) 사용자 지정 3) settings 기반 Steam 탐색
function getGeneratorPath(): string | null {
  if (projectManager.isOpen()) {
    const projectGen = path.join(projectManager.currentPath!, 'generator');
    if (isValidGeneratorPath(projectGen)) return projectGen;
  }
  if (customGeneratorPath && isValidGeneratorPath(customGeneratorPath)) return customGeneratorPath;
  return findSteamGeneratorPath();
}

// GET /api/generator/status
router.get('/status', (_req: Request, res: Response) => {
  const genPath = getGeneratorPath();
  const steamPath = findSteamGeneratorPath();
  const available = genPath !== null;
  const inProject = available && projectManager.isOpen() &&
    genPath === path.join(projectManager.currentPath!, 'generator');
  res.json({
    available,
    path: genPath,
    inProject,
    steamAvailable: steamPath !== null,
    customPath: customGeneratorPath,
  });
});

// POST /api/generator/set-path - 사용자 지정 Generator 경로 설정
router.post('/set-path', (req: Request, res: Response) => {
  let { path: newPath } = req.body as { path: string };
  if (!newPath) {
    customGeneratorPath = null;
    return res.json({ success: true, cleared: true });
  }
  // ~ 를 홈 디렉토리로 확장
  if (newPath.startsWith('~')) {
    newPath = path.join(process.env.HOME || '', newPath.slice(1));
  }
  if (!isValidGeneratorPath(newPath)) {
    return res.status(400).json({ error: '유효하지 않은 Generator 경로입니다. gradients.png 파일이 포함된 폴더를 지정하세요.' });
  }
  customGeneratorPath = newPath;
  res.json({ success: true, path: newPath });
});

// POST /api/generator/copy-to-project - Copy Generator resources into project
router.post('/copy-to-project', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    const srcPath = getGeneratorPath();
    if (!srcPath) {
      return res.status(404).json({ error: 'Generator resources not found' });
    }
    // 이미 프로젝트 안에 있으면 복사 불필요
    const destDir = path.join(projectManager.currentPath!, 'generator');
    if (srcPath === destDir) {
      return res.json({ success: true, path: destDir, message: 'Already in project' });
    }
    copyDirRecursive(srcPath, destDir);

    res.json({ success: true, path: destDir });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// GET /api/generator/gradients - Serve gradients.png palette image
router.get('/gradients', (_req: Request, res: Response) => {
  try {
    const genPath = getGeneratorPath();
    if (!genPath) return res.status(404).json({ error: 'Generator not configured' });
    const filePath = path.join(genPath, 'gradients.png');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'gradients.png not found' });
    }
    res.sendFile(filePath);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

interface FaceColorLayer {
  index: number;
  defaultGradientRow: number | null;
  file: string;
}

interface FacePattern {
  id: string;
  colorLayers: FaceColorLayer[];
}

interface SpritePattern {
  id: string;
  baseFile: string;
  colorMapFile: string | null;
}

// Parse Face filename: FG_[Part]_p[pattern]_c[colorIndex]_m[gradientRow].png
// m value is optional (absent means fixed color, not recolorable)
// 파트명 첫 글자 대문자로 정규화 (SV의 body → Body 등)
function normalizePart(part: string): string {
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function parseFaceFilename(filename: string): {
  part: string;
  pattern: string;
  colorIndex: number;
  gradientRow: number | null;
} | null {
  const match = filename.match(
    /^FG_(.+?)_p(\d+)_c(\d+)(?:_m(\d+))?\.png$/
  );
  if (!match) return null;
  return {
    part: normalizePart(match[1]),
    pattern: `p${match[2]}`,
    colorIndex: parseInt(match[3], 10),
    gradientRow: match[4] != null ? parseInt(match[4], 10) : null,
  };
}

// Parse TV/SV/TVD filename:
//   TV_[Part]_p[pattern].png      (base image)
//   TV_[Part]_p[pattern]_c.png    (color map)
function parseSpriteFilename(
  filename: string,
  prefix: string
): { part: string; pattern: string; isColorMap: boolean } | null {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = filename.match(
    new RegExp(`^${escaped}_(.+?)_p(\\d+?)(_c)?\\.png$`)
  );
  if (!match) return null;
  return {
    part: normalizePart(match[1]),
    pattern: `p${match[2]}`,
    isColorMap: match[3] === '_c',
  };
}

function buildFaceManifest(
  dirPath: string
): Record<string, { patterns: FacePattern[] }> {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
  const partsMap = new Map<string, Map<string, FaceColorLayer[]>>();

  for (const file of files) {
    const parsed = parseFaceFilename(file);
    if (!parsed) continue;

    let patternMap = partsMap.get(parsed.part);
    if (!patternMap) {
      patternMap = new Map();
      partsMap.set(parsed.part, patternMap);
    }

    let layers = patternMap.get(parsed.pattern);
    if (!layers) {
      layers = [];
      patternMap.set(parsed.pattern, layers);
    }

    layers.push({
      index: parsed.colorIndex,
      defaultGradientRow: parsed.gradientRow,
      file,
    });
  }

  const result: Record<string, { patterns: FacePattern[] }> = {};
  for (const [part, patternMap] of partsMap) {
    const patterns: FacePattern[] = [];
    for (const [patternId, layers] of patternMap) {
      layers.sort((a, b) => a.index - b.index);
      patterns.push({ id: patternId, colorLayers: layers });
    }
    patterns.sort((a, b) => a.id.localeCompare(b.id));
    result[part] = { patterns };
  }
  return result;
}

function buildSpriteManifest(
  dirPath: string,
  prefix: string
): Record<string, { patterns: SpritePattern[] }> {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
  const partsMap = new Map<
    string,
    Map<string, { baseFile: string | null; colorMapFile: string | null }>
  >();

  for (const file of files) {
    const parsed = parseSpriteFilename(file, prefix);
    if (!parsed) continue;

    let patternMap = partsMap.get(parsed.part);
    if (!patternMap) {
      patternMap = new Map();
      partsMap.set(parsed.part, patternMap);
    }

    let entry = patternMap.get(parsed.pattern);
    if (!entry) {
      entry = { baseFile: null, colorMapFile: null };
      patternMap.set(parsed.pattern, entry);
    }

    if (parsed.isColorMap) {
      entry.colorMapFile = file;
    } else {
      entry.baseFile = file;
    }
  }

  const result: Record<string, { patterns: SpritePattern[] }> = {};
  for (const [part, patternMap] of partsMap) {
    const patterns: SpritePattern[] = [];
    for (const [patternId, entry] of patternMap) {
      if (!entry.baseFile) continue;
      patterns.push({
        id: patternId,
        baseFile: entry.baseFile,
        colorMapFile: entry.colorMapFile,
      });
    }
    patterns.sort((a, b) => a.id.localeCompare(b.id));
    result[part] = { patterns };
  }
  return result;
}

// GET /api/generator/parts/:gender/:outputType - Parts manifest
router.get('/parts/:gender/:outputType', (req: Request<{ gender: string; outputType: string }>, res: Response) => {
  try {
    const { gender, outputType } = req.params;

    if (!VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ error: `Invalid gender: ${gender}` });
    }
    if (!VALID_OUTPUT_TYPES.includes(outputType)) {
      return res.status(400).json({ error: `Invalid output type: ${outputType}` });
    }

    const genPath = getGeneratorPath();
    if (!genPath) return res.status(404).json({ error: 'Generator not configured' });
    const dirPath = path.join(genPath, outputType, gender);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    if (outputType === 'Face') {
      res.json(buildFaceManifest(dirPath));
    } else {
      const prefixMap: Record<string, string> = {
        TV: 'TV',
        SV: 'SV',
        TVD: 'TVD',
      };
      res.json(buildSpriteManifest(dirPath, prefixMap[outputType]));
    }
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/generator/variation/:gender/:part - Variation icons for a part
router.get('/variation/:gender/:part', (req: Request<{ gender: string; part: string }>, res: Response) => {
  try {
    const { gender, part } = req.params;

    if (!VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ error: `Invalid gender: ${gender}` });
    }

    const genPath = getGeneratorPath();
    if (!genPath) return res.status(404).json({ error: 'Generator not configured' });
    const dirPath = path.join(genPath, 'Variation', gender);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    const prefix = `icon_${part}_p`;
    const files = fs
      .readdirSync(dirPath)
      .filter(f => f.startsWith(prefix) && f.endsWith('.png'));

    const icons = files.map(file => {
      const match = file.match(/^icon_.+?_p(\d+)\.png$/);
      return {
        pattern: match ? `p${match[1]}` : file,
        file,
      };
    });
    icons.sort((a, b) => a.pattern.localeCompare(b.pattern));

    res.json(icons);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/generator/image/:outputType/:gender/:filename - Serve part image
router.get('/image/:outputType/:gender/:filename', (req: Request<{ outputType: string; gender: string; filename: string }>, res: Response) => {
  try {
    const { outputType, gender, filename } = req.params;

    if (!VALID_OUTPUT_TYPES.includes(outputType) && outputType !== 'Variation') {
      return res.status(400).json({ error: `Invalid output type: ${outputType}` });
    }
    if (!VALID_GENDERS.includes(gender)) {
      return res.status(400).json({ error: `Invalid gender: ${gender}` });
    }

    const genPath = getGeneratorPath();
    if (!genPath) return res.status(404).json({ error: 'Generator not configured' });
    const filePath = path.join(genPath, outputType, gender, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/generator/export - Export generated image to project resources
router.post('/export', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }

    const { type, name, data } = req.body as {
      type: string;
      name: string;
      data: string;
    };

    if (!type || !name || !data) {
      return res.status(400).json({ error: 'type, name, and data are required' });
    }

    const typeDirMap: Record<string, string> = {
      faces: 'img/faces',
      characters: 'img/characters',
      sv_actors: 'img/sv_actors',
    };
    const subDir = typeDirMap[type];
    if (!subDir) {
      return res.status(400).json({ error: `Invalid type: ${type}. Use faces, characters, or sv_actors` });
    }

    const dirPath = path.join(projectManager.currentPath!, subDir);
    fs.mkdirSync(dirPath, { recursive: true });

    const filename = name.endsWith('.png') ? name : `${name}.png`;
    const filePath = path.join(dirPath, filename);
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filePath, buffer);

    res.json({ success: true, path: `${subDir}/${filename}` });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
