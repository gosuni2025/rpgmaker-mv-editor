import express, { Request, Response } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import { exec, execSync } from 'child_process';
import projectManager from '../services/projectManager';
import fileWatcher from '../services/fileWatcher';

const runtimePath = path.join(__dirname, '..', 'runtime');

/** Collect all files under a directory recursively, returning relative paths */
function collectFiles(dir: string, base: string = dir): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      results.push(path.relative(base, full));
    }
  }
  return results;
}

function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

interface MigrationFile {
  file: string;       // relative path like "js/rpg_core.js"
  status: 'add' | 'update' | 'same';
  editorSize?: number;
  projectSize?: number;
  editorMtime?: string;
  projectMtime?: string;
}

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

router.post('/reveal', (req: Request, res: Response) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath || !fs.existsSync(dirPath)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    const cmd = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    exec(`${cmd} "${dirPath}"`);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/mkdir', (req: Request, res: Response) => {
  try {
    const { path: dirPath, name } = req.body;
    if (!dirPath || !name) {
      return res.status(400).json({ error: 'path and name are required' });
    }
    if (/[/\\]/.test(name) || name === '.' || name === '..') {
      return res.status(400).json({ error: 'Invalid folder name' });
    }
    const fullPath = path.join(dirPath, name);
    if (fs.existsSync(fullPath)) {
      return res.status(400).json({ error: 'Folder already exists' });
    }
    fs.mkdirSync(fullPath, { recursive: true });
    res.json({ success: true, path: fullPath });
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
  const subfolder = req.body?.subfolder;
  let targetPath = projectManager.currentPath!;
  if (subfolder) {
    const resolved = path.join(targetPath, subfolder);
    if (fs.existsSync(resolved)) targetPath = resolved;
  }
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  exec(`${cmd} "${targetPath}"`);
  res.json({ success: true });
});

router.post('/open-editor-folder', (_req: Request, res: Response) => {
  const editorPath = path.join(__dirname, '..', '..');
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  exec(`${cmd} "${editorPath}"`);
  res.json({ success: true });
});

router.post('/open-vscode', (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    return res.status(404).json({ error: 'No project open' });
  }
  exec(`code "${projectManager.currentPath}"`);
  res.json({ success: true });
});

router.get('/check-path', (req: Request, res: Response) => {
  const p = req.query.path as string;
  if (!p) return res.status(400).json({ error: 'path is required' });
  const exists = fs.existsSync(p) && fs.existsSync(path.join(p, 'data', 'System.json'));
  res.json({ exists });
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

// Migration: compare editor runtime files with project js/ folder
router.get('/migration-check', (req: Request, res: Response) => {
  try {
    const projectPath = req.query.path as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'path is required' });
    }

    const runtimeJsDir = path.join(runtimePath, 'js');
    const projectJsDir = path.join(projectPath, 'js');

    // Collect all runtime js files
    const runtimeFiles = collectFiles(runtimeJsDir, runtimeJsDir);

    const files: MigrationFile[] = [];
    let needsMigration = false;

    for (const relFile of runtimeFiles) {
      // Skip plugins-related files (those are project-specific)
      if (relFile === 'plugins.js' || relFile.startsWith('plugins/') || relFile.startsWith('plugins\\')) continue;

      const editorFile = path.join(runtimeJsDir, relFile);
      const projectFile = path.join(projectJsDir, relFile);
      const editorStat = fs.statSync(editorFile);
      const editorSize = editorStat.size;
      const editorMtime = editorStat.mtime.toISOString();

      if (!fs.existsSync(projectFile)) {
        files.push({ file: `js/${relFile}`, status: 'add', editorSize, editorMtime });
        needsMigration = true;
      } else {
        const projectStat = fs.statSync(projectFile);
        const projectSize = projectStat.size;
        const projectMtime = projectStat.mtime.toISOString();
        const editorHash = fileHash(editorFile);
        const projectHash = fileHash(projectFile);
        if (editorHash !== projectHash) {
          files.push({ file: `js/${relFile}`, status: 'update', editorSize, projectSize, editorMtime, projectMtime });
          needsMigration = true;
        } else {
          files.push({ file: `js/${relFile}`, status: 'same', editorSize, projectSize, editorMtime, projectMtime });
        }
      }
    }

    // Sort: add/update first, then same
    files.sort((a, b) => {
      const order = { add: 0, update: 1, same: 2 };
      return order[a.status] - order[b.status];
    });

    // Check if git is available
    let gitAvailable = false;
    try {
      execSync('git --version', { stdio: 'ignore' });
      gitAvailable = true;
    } catch { /* git not installed */ }

    res.json({ needsMigration, files, gitAvailable });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Migration: copy editor runtime files to project js/ folder
router.post('/migrate', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }

    const projectRoot = projectManager.currentPath!;
    const runtimeJsDir = path.join(runtimePath, 'js');
    const projectJsDir = path.join(projectRoot, 'js');
    const selectedFiles: string[] | undefined = req.body.files;
    const gitBackup: boolean = req.body.gitBackup === true;

    // Git backup: commit current state before migration
    if (gitBackup) {
      try {
        // Init repo if not already a git repo
        try {
          execSync('git rev-parse --git-dir', { cwd: projectRoot, stdio: 'ignore' });
        } catch {
          execSync('git init', { cwd: projectRoot, stdio: 'ignore' });
        }
        execSync('git add -A', { cwd: projectRoot, stdio: 'ignore' });
        // Check if there's anything to commit
        try {
          execSync('git diff --cached --quiet', { cwd: projectRoot, stdio: 'ignore' });
          // No changes staged - check if there are any commits at all
          try {
            execSync('git rev-parse HEAD', { cwd: projectRoot, stdio: 'ignore' });
          } catch {
            // No commits yet, create initial commit
            execSync('git commit -m "Initial commit (before runtime migration)"', { cwd: projectRoot, stdio: 'ignore' });
          }
        } catch {
          // There are staged changes, commit them
          execSync('git commit -m "Backup before runtime migration"', { cwd: projectRoot, stdio: 'ignore' });
        }
      } catch (gitErr) {
        return res.status(500).json({ error: `Git backup failed: ${(gitErr as Error).message}` });
      }
    }

    const copied: string[] = [];

    if (selectedFiles && selectedFiles.length > 0) {
      // Copy only selected files
      for (const file of selectedFiles) {
        // file is like "js/rpg_core.js" – strip the leading "js/"
        const relFile = file.replace(/^js\//, '');
        if (relFile === 'plugins.js' || relFile.startsWith('plugins/') || relFile.startsWith('plugins\\')) continue;

        const src = path.join(runtimeJsDir, relFile);
        const dest = path.join(projectJsDir, relFile);

        if (!fs.existsSync(src)) continue;

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        copied.push(`js/${relFile}`);
      }
    } else {
      // Legacy: copy all changed files
      const runtimeFiles = collectFiles(runtimeJsDir, runtimeJsDir);
      for (const relFile of runtimeFiles) {
        if (relFile === 'plugins.js' || relFile.startsWith('plugins/') || relFile.startsWith('plugins\\')) continue;

        const src = path.join(runtimeJsDir, relFile);
        const dest = path.join(projectJsDir, relFile);

        if (fs.existsSync(dest)) {
          if (fileHash(src) === fileHash(dest)) continue;
        }

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        copied.push(`js/${relFile}`);
      }
    }

    res.json({ success: true, copied });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List git backup commits for migration rollback
router.get('/migration-backups', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.json({ backups: [] });
    }
    const projectRoot = projectManager.currentPath!;

    // Check if it's a git repo
    try {
      execSync('git rev-parse --git-dir', { cwd: projectRoot, stdio: 'ignore' });
    } catch {
      return res.json({ backups: [] });
    }

    // Find backup commits
    let output = '';
    try {
      output = execSync(
        'git log --all --format="%H|%aI|%s" --grep="before runtime migration"',
        { cwd: projectRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();
    } catch {
      return res.json({ backups: [] });
    }

    if (!output) {
      return res.json({ backups: [] });
    }

    const backups = output.split('\n').map(line => {
      const [hash, date, ...messageParts] = line.split('|');
      return { hash, date, message: messageParts.join('|') };
    });

    res.json({ backups });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Rollback migration by restoring js/ from a backup commit
router.post('/migration-rollback', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }

    const { commitHash } = req.body;
    if (!commitHash || !/^[0-9a-f]{7,40}$/i.test(commitHash)) {
      return res.status(400).json({ error: 'Invalid commit hash' });
    }

    const projectRoot = projectManager.currentPath!;

    // Verify commit exists
    try {
      execSync(`git cat-file -t ${commitHash}`, { cwd: projectRoot, stdio: 'ignore' });
    } catch {
      return res.status(400).json({ error: 'Commit not found' });
    }

    // Restore js/ folder from the backup commit
    execSync(`git checkout ${commitHash} -- js/`, { cwd: projectRoot, stdio: 'ignore' });

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
