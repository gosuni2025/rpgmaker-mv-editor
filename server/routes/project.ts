import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import projectManager from '../services/projectManager';
import fileWatcher from '../services/fileWatcher';

const router = express.Router();

router.get('/browse', (req: Request, res: Response) => {
  try {
    let dirPath = (req.query.path as string) || os.homedir();
    dirPath = path.resolve(dirPath);

    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return res.status(400).json({ error: 'Invalid directory' });
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const dirs: string[] = [];
    let isRpgProject = false;

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        dirs.push(entry.name);
      }
      if (entry.name === 'Game.rpgproject' || entry.name === 'game.rpgproject') {
        isRpgProject = true;
      }
    }

    if (!isRpgProject && fs.existsSync(path.join(dirPath, 'data', 'System.json'))) {
      isRpgProject = true;
    }

    dirs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    res.json({
      path: dirPath,
      parent: path.dirname(dirPath),
      dirs,
      isRpgProject,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/open', (req: Request, res: Response) => {
  try {
    const { path: projectPath } = req.body;
    if (!projectPath) {
      return res.status(400).json({ error: 'path is required' });
    }
    projectManager.open(projectPath);
    fileWatcher.watch(projectManager.getDataPath());

    const system = projectManager.readJSON('System.json') as { gameTitle?: string };
    const mapInfos = projectManager.readJSON('MapInfos.json');
    const name = system.gameTitle || path.basename(projectPath);

    // Validate all data JSON files
    const parseErrors: { file: string; error: string }[] = [];
    const dataDir = projectManager.getDataPath();
    try {
      const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(dataDir, file), 'utf8');
          JSON.parse(raw);
        } catch (e) {
          parseErrors.push({ file, error: (e as Error).message });
        }
      }
    } catch { /* data dir read error - ignore */ }

    res.json({ path: projectPath, name, system, mapInfos, parseErrors: parseErrors.length > 0 ? parseErrors : undefined });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/info', (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    return res.status(404).json({ error: 'No project open' });
  }
  res.json({ path: projectManager.currentPath });
});

router.post('/close', (req: Request, res: Response) => {
  fileWatcher.stop();
  projectManager.close();
  res.json({ success: true });
});

router.post('/new', (req: Request, res: Response) => {
  try {
    const { name, gameTitle, path: projectPath } = req.body;
    if (!name || !projectPath) {
      return res.status(400).json({ error: 'name and path are required' });
    }

    const fullPath = path.join(projectPath, name);
    const dirs = [
      'data',
      'img', 'img/characters', 'img/faces', 'img/tilesets', 'img/parallaxes',
      'img/battlebacks1', 'img/battlebacks2', 'img/enemies', 'img/sv_actors',
      'img/sv_enemies', 'img/system', 'img/titles1', 'img/titles2',
      'img/animations', 'img/pictures',
      'audio', 'audio/bgm', 'audio/bgs', 'audio/me', 'audio/se',
      'js', 'js/plugins',
    ];

    for (const dir of dirs) {
      fs.mkdirSync(path.join(fullPath, dir), { recursive: true });
    }

    // Default System.json
    const system = {
      gameTitle: gameTitle || name,
      versionId: 1,
      locale: 'en_US',
      partyMembers: [1],
      currencyUnit: 'G',
      windowTone: [0, 0, 0, 0],
      attackMotions: [],
      elements: ['', 'Physical', 'Fire', 'Ice', 'Thunder', 'Water', 'Earth', 'Wind', 'Light', 'Dark'],
      switches: ['', ''],
      variables: ['', ''],
    };
    fs.writeFileSync(path.join(fullPath, 'data', 'System.json'), JSON.stringify(system, null, 2));

    // Default MapInfos.json
    const mapInfos = [null, { id: 1, expanded: false, name: 'MAP001', order: 1, parentId: 0, scrollX: 0, scrollY: 0 }];
    fs.writeFileSync(path.join(fullPath, 'data', 'MapInfos.json'), JSON.stringify(mapInfos, null, 2));

    // Default Map001.json
    const map001 = {
      autoplayBgm: false, autoplayBgs: false, battleback1Name: '', battleback2Name: '',
      bgm: { name: '', pan: 0, pitch: 100, volume: 90 },
      bgs: { name: '', pan: 0, pitch: 100, volume: 90 },
      disableDashing: false, displayName: '', encounterList: [], encounterStep: 30,
      height: 13, note: '', parallaxLoopX: false, parallaxLoopY: false,
      parallaxName: '', parallaxShow: true, parallaxSx: 0, parallaxSy: 0,
      scrollType: 0, specifyBattleback: false, tilesetId: 1, width: 17,
      data: new Array(17 * 13 * 6).fill(0),
      events: [null],
    };
    fs.writeFileSync(path.join(fullPath, 'data', 'Map001.json'), JSON.stringify(map001, null, 2));

    // Default data files
    const defaults: Record<string, unknown> = {
      'Actors.json': [null, { id: 1, battlerName: '', characterIndex: 0, characterName: '', classId: 1, equips: [0, 0, 0, 0, 0], faceIndex: 0, faceName: '', traits: [], initialLevel: 1, maxLevel: 99, name: 'Actor1', nickname: '', note: '', profile: '' }],
      'Classes.json': [null, { id: 1, expParams: [30, 20, 30, 30], traits: [], learnings: [], name: 'Class1', note: '', params: [[300,300],[100,100],[30,30],[30,30],[30,30],[30,30],[30,30],[30,30]] }],
      'Skills.json': [null],
      'Items.json': [null],
      'Weapons.json': [null],
      'Armors.json': [null],
      'Enemies.json': [null],
      'Troops.json': [null],
      'States.json': [null],
      'Animations.json': [null],
      'Tilesets.json': [null, { id: 1, mode: 1, name: 'Tileset', note: '', tilesetNames: ['', '', '', '', '', '', '', '', ''], flags: [] }],
      'CommonEvents.json': [null],
    };
    for (const [filename, data] of Object.entries(defaults)) {
      fs.writeFileSync(path.join(fullPath, 'data', filename), JSON.stringify(data, null, 2));
    }

    // Game.rpgproject marker
    fs.writeFileSync(path.join(fullPath, 'Game.rpgproject'), 'RPGMV 1.6.2');

    res.json({ path: fullPath, name });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/open-folder', (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    return res.status(404).json({ error: 'No project open' });
  }
  exec(`open "${projectManager.currentPath}"`);
  res.json({ success: true });
});

// Deploy project
router.post('/deploy', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    const { outputPath, excludeUnusedFiles = false } = req.body;
    if (!outputPath) {
      return res.status(400).json({ error: 'outputPath is required' });
    }

    const srcPath = projectManager.currentPath!;
    const destPath = path.resolve(outputPath);

    // Recursive copy
    const copyDir = (src: string, dest: string) => {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const srcEntry = path.join(src, entry.name);
        const destEntry = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcEntry, destEntry);
        } else {
          fs.copyFileSync(srcEntry, destEntry);
        }
      }
    };

    copyDir(srcPath, destPath);
    res.json({ success: true, outputPath: destPath });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
