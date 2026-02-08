import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';

const router = express.Router();

const GENERATOR_PATH = path.join(
  process.env.HOME || '',
  'Library/Application Support/Steam/steamapps/common/RPG Maker MV/RPG Maker MV.app/Contents/MacOS/Generator'
);

const VALID_GENDERS = ['Male', 'Female', 'Kid'];
const VALID_OUTPUT_TYPES = ['Face', 'TV', 'SV', 'TVD'];

// Generator 경로 결정: 프로젝트 내 generator/ 폴더 우선, 없으면 Steam 경로
function getGeneratorPath(): string {
  if (projectManager.isOpen()) {
    const projectGen = path.join(projectManager.currentPath!, 'generator');
    if (fs.existsSync(projectGen) && fs.existsSync(path.join(projectGen, 'gradients.png'))) {
      return projectGen;
    }
  }
  return GENERATOR_PATH;
}

// GET /api/generator/status - Check if Generator resources are available
router.get('/status', (_req: Request, res: Response) => {
  const genPath = getGeneratorPath();
  const exists = fs.existsSync(genPath) && fs.existsSync(path.join(genPath, 'gradients.png'));
  const inProject = projectManager.isOpen() && genPath !== GENERATOR_PATH;
  res.json({ available: exists, path: genPath, inProject, steamAvailable: fs.existsSync(GENERATOR_PATH) });
});

// POST /api/generator/copy-to-project - Copy Generator resources into project
router.post('/copy-to-project', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    if (!fs.existsSync(GENERATOR_PATH)) {
      return res.status(404).json({ error: 'Generator resources not found at Steam path' });
    }

    const destDir = path.join(projectManager.currentPath!, 'generator');
    copyDirRecursive(GENERATOR_PATH, destDir);

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
    const filePath = path.join(getGeneratorPath(), 'gradients.png');
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
    part: match[1],
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
    part: match[1],
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

    const dirPath = path.join(getGeneratorPath(), outputType, gender);
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

    const dirPath = path.join(getGeneratorPath(), 'Variation', gender);
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

    const filePath = path.join(getGeneratorPath(), outputType, gender, filename);
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
