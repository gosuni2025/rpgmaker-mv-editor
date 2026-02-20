import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import projectManager from '../../services/projectManager';
import { collectFiles, fileHash, MigrationFile } from './helpers';

const runtimePath = path.join(__dirname, '..', '..', 'runtime');

const router = express.Router();

// Migration: compare editor runtime files with project js/3d/ folder
// Runtime files are placed in js/3d/ to coexist with PIXI originals in js/
router.get('/migration-check', (req: Request, res: Response) => {
  try {
    const projectPath = req.query.path as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'path is required' });
    }

    const runtimeJsDir = path.join(runtimePath, 'js');
    const projectJsDir = path.join(projectPath, 'js', '3d');

    // Collect all runtime js files
    const runtimeFiles = collectFiles(runtimeJsDir, runtimeJsDir);

    const files: MigrationFile[] = [];
    let needsMigration = false;

    for (const relFile of runtimeFiles) {
      // Skip plugins-related files (those are project-specific)
      if (relFile === 'plugins.js' || relFile.startsWith('plugins/') || relFile.startsWith('plugins\\')) continue;
      // libs/ go to js/libs/ (shared), other files go to js/3d/
      const isLib = relFile.startsWith('libs/') || relFile.startsWith('libs\\');
      // Skip non-Three.js libs (fpsmeter, lz-string, iphone-inline-video are already in PIXI projects)
      if (isLib && !relFile.includes('three')) continue;

      const editorFile = path.join(runtimeJsDir, relFile);
      // libs go to js/libs/, everything else to js/3d/
      const projectFile = isLib
        ? path.join(projectPath, 'js', relFile)
        : path.join(projectJsDir, relFile);
      const displayPath = isLib ? `js/${relFile}` : `js/3d/${relFile}`;
      const editorStat = fs.statSync(editorFile);
      const editorSize = editorStat.size;
      const editorMtime = editorStat.mtime.toISOString();

      if (!fs.existsSync(projectFile)) {
        files.push({ file: displayPath, status: 'add', editorSize, editorMtime });
        needsMigration = true;
      } else {
        const projectStat = fs.statSync(projectFile);
        const projectSize = projectStat.size;
        const projectMtime = projectStat.mtime.toISOString();
        const editorHash = fileHash(editorFile);
        const projectHash = fileHash(projectFile);
        if (editorHash !== projectHash) {
          files.push({ file: displayPath, status: 'update', editorSize, projectSize, editorMtime, projectMtime });
          needsMigration = true;
        } else {
          files.push({ file: displayPath, status: 'same', editorSize, projectSize, editorMtime, projectMtime });
        }
      }
    }

    // Check index_3d.html
    const runtimeIndex3d = path.join(runtimePath, 'index_3d.html');
    const projectIndex3d = path.join(projectPath, 'index_3d.html');
    if (fs.existsSync(runtimeIndex3d)) {
      const editorStat = fs.statSync(runtimeIndex3d);
      const editorSize = editorStat.size;
      const editorMtime = editorStat.mtime.toISOString();
      if (!fs.existsSync(projectIndex3d)) {
        files.push({ file: 'index_3d.html', status: 'add', editorSize, editorMtime });
        needsMigration = true;
      } else {
        const projectStat = fs.statSync(projectIndex3d);
        const projectSize = projectStat.size;
        const projectMtime = projectStat.mtime.toISOString();
        if (fileHash(runtimeIndex3d) !== fileHash(projectIndex3d)) {
          files.push({ file: 'index_3d.html', status: 'update', editorSize, projectSize, editorMtime, projectMtime });
          needsMigration = true;
        } else {
          files.push({ file: 'index_3d.html', status: 'same', editorSize, projectSize, editorMtime, projectMtime });
        }
      }
    }

    // Sort: add/update first, then same
    files.sort((a, b) => {
      const order = { add: 0, update: 1, same: 2 };
      return order[a.status] - order[b.status];
    });

    // Check editor plugins (server/runtime/js/plugins/ vs project js/plugins/)
    const editorPluginsDir = path.join(runtimePath, 'js', 'plugins');
    const projectPluginsDir = path.join(projectPath, 'js', 'plugins');
    const editorPluginFiles: MigrationFile[] = [];
    let needsPluginMigration = false;
    if (fs.existsSync(editorPluginsDir)) {
      const epFiles = fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js'));
      for (const epFile of epFiles) {
        const editorFile = path.join(editorPluginsDir, epFile);
        const projectFile = path.join(projectPluginsDir, epFile);
        const editorStat = fs.statSync(editorFile);
        const displayPath = `js/plugins/${epFile}`;
        if (!fs.existsSync(projectFile)) {
          editorPluginFiles.push({ file: displayPath, status: 'add', editorSize: editorStat.size, editorMtime: editorStat.mtime.toISOString() });
          needsPluginMigration = true;
        } else {
          const projectStat = fs.statSync(projectFile);
          const eHash = fileHash(editorFile);
          const pHash = fileHash(projectFile);
          if (eHash !== pHash) {
            editorPluginFiles.push({ file: displayPath, status: 'update', editorSize: editorStat.size, projectSize: projectStat.size, editorMtime: editorStat.mtime.toISOString(), projectMtime: projectStat.mtime.toISOString() });
            needsPluginMigration = true;
          } else {
            editorPluginFiles.push({ file: displayPath, status: 'same', editorSize: editorStat.size, projectSize: projectStat.size, editorMtime: editorStat.mtime.toISOString(), projectMtime: projectStat.mtime.toISOString() });
          }
        }
      }
    }

    // Check if git is available
    let gitAvailable = false;
    try {
      execSync('git --version', { stdio: 'ignore' });
      gitAvailable = true;
    } catch { /* git not installed */ }

    res.json({ needsMigration: needsMigration || needsPluginMigration, files, editorPluginFiles, gitAvailable });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Migration step: git backup only
// Migration git backup step 1: init repo if needed
router.post('/migrate-git-init', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    const projectRoot = projectManager.currentPath!;
    let initialized = false;
    try {
      execSync('git rev-parse --git-dir', { cwd: projectRoot, stdio: 'ignore' });
    } catch {
      execSync('git init', { cwd: projectRoot, stdio: 'ignore' });
      initialized = true;
    }
    res.json({ success: true, initialized });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Migration git backup step 2: stage all files
router.post('/migrate-git-add', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    const projectRoot = projectManager.currentPath!;
    execSync('git add -A', { cwd: projectRoot, stdio: 'ignore' });

    // Count staged files
    let stagedCount = 0;
    try {
      const out = execSync('git diff --cached --name-only', {
        cwd: projectRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      stagedCount = out ? out.split('\n').length : 0;
    } catch { /* ignore */ }

    res.json({ success: true, stagedCount });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Migration git backup step 3: commit
router.post('/migrate-git-commit', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    const projectRoot = projectManager.currentPath!;

    // Check if there's anything staged
    let hasStaged = false;
    try {
      execSync('git diff --cached --quiet', { cwd: projectRoot, stdio: 'ignore' });
    } catch {
      hasStaged = true;
    }

    let hasHead = false;
    try {
      execSync('git rev-parse HEAD', { cwd: projectRoot, stdio: 'ignore' });
      hasHead = true;
    } catch { /* no commits yet */ }

    if (!hasStaged && hasHead) {
      // Nothing to commit
      return res.json({ success: true, committed: false, message: '변경 사항 없음 (이미 최신)' });
    }

    const message = hasHead
      ? 'Backup before runtime migration'
      : 'Initial commit (before runtime migration)';
    execSync(`git commit -m "${message}"`, { cwd: projectRoot, stdio: 'ignore' });

    let hash = '';
    try {
      hash = execSync('git rev-parse --short HEAD', {
        cwd: projectRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
    } catch { /* ignore */ }

    res.json({ success: true, committed: true, message, hash });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Migration step: copy a single file
router.post('/migrate-file', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    const projectRoot = projectManager.currentPath!;
    const runtimeJsDir = path.join(runtimePath, 'js');
    const projectJsDir = path.join(projectRoot, 'js', '3d');
    const file: string = (req.body.file as string)?.replace(/\\/g, '/');

    if (!file) {
      return res.status(400).json({ error: 'file is required' });
    }

    let src: string;
    let dest: string;

    if (file === 'index_3d.html') {
      src = path.join(runtimePath, 'index_3d.html');
      dest = path.join(projectRoot, 'index_3d.html');
    } else if (file.startsWith('js/libs/')) {
      const relFile = file.replace(/^js\//, '');
      src = path.join(runtimeJsDir, relFile);
      dest = path.join(projectRoot, 'js', relFile);
    } else if (file.startsWith('js/plugins/')) {
      const relFile = file.replace(/^js\/plugins\//, '');
      src = path.join(runtimePath, 'js', 'plugins', relFile);
      dest = path.join(projectRoot, 'js', 'plugins', relFile);
    } else {
      // js/3d/...
      const relFile = file.replace(/^js\/3d\//, '');
      src = path.join(runtimeJsDir, relFile);
      dest = path.join(projectJsDir, relFile);
    }

    if (!fs.existsSync(src)) {
      return res.status(400).json({ error: `Source file not found: ${src}` });
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);

    res.json({ success: true, from: src, to: dest });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Migration step: collect plugin files to copy and register
router.get('/migrate-plugin-files', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    const projectRoot = projectManager.currentPath!;
    const editorPluginsDir = path.join(runtimePath, 'js', 'plugins');
    const projectPluginsDir = path.join(projectRoot, 'js', 'plugins');

    if (!fs.existsSync(editorPluginsDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js')).map(f => {
      return {
        file: `js/plugins/${f}`,
        from: path.join(editorPluginsDir, f),
        to: path.join(projectPluginsDir, f),
      };
    });

    res.json({ files });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Migration step: register plugins in plugins.js
router.post('/migrate-register-plugins', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    const projectRoot = projectManager.currentPath!;
    const editorPluginsDir = path.join(runtimePath, 'js', 'plugins');

    if (!fs.existsSync(editorPluginsDir)) {
      return res.json({ success: true, modified: false });
    }

    const pluginsJsPath = path.join(projectRoot, 'js', 'plugins.js');
    let pluginList: { name: string; status: boolean; description: string; parameters: Record<string, string> }[] = [];
    if (fs.existsSync(pluginsJsPath)) {
      const content = fs.readFileSync(pluginsJsPath, 'utf8');
      const match = content.match(/\$plugins\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        try { pluginList = JSON.parse(match[1]); } catch { /* parse error */ }
      }
    }

    const registeredNames = new Set(pluginList.map(p => p.name));
    let modified = false;
    for (const epFile of fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js'))) {
      const pluginName = epFile.replace('.js', '');
      if (!registeredNames.has(pluginName)) {
        pluginList.push({ name: pluginName, status: true, description: '', parameters: {} });
        modified = true;
      }
    }
    if (modified) {
      const lines = pluginList.map(p => JSON.stringify(p));
      const content = `// Generated by RPG Maker.\n// Do not edit this file directly.\nvar $plugins =\n[\n${lines.join(',\n')}\n];\n`;
      fs.writeFileSync(pluginsJsPath, content, 'utf8');
    }

    res.json({ success: true, modified });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Migration: copy editor runtime files to project js/3d/ folder
router.post('/migrate', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }

    const projectRoot = projectManager.currentPath!;
    const runtimeJsDir = path.join(runtimePath, 'js');
    const projectJsDir = path.join(projectRoot, 'js', '3d');
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
        // Handle index_3d.html (project root)
        if (file === 'index_3d.html') {
          const src = path.join(runtimePath, 'index_3d.html');
          const dest = path.join(projectRoot, 'index_3d.html');
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            copied.push('index_3d.html');
          }
          continue;
        }

        // Handle js/libs/* files (Three.js libs go to project js/libs/)
        if (file.startsWith('js/libs/')) {
          const relFile = file.replace(/^js\//, '');
          const src = path.join(runtimeJsDir, relFile);
          const dest = path.join(projectRoot, 'js', relFile);
          if (fs.existsSync(src)) {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
            copied.push(file);
          }
          continue;
        }

        // file is like "js/3d/rpg_core.js" – strip the leading "js/3d/"
        const relFile = file.replace(/^js\/3d\//, '');
        if (relFile === 'plugins.js' || relFile.startsWith('plugins/') || relFile.startsWith('plugins\\')) continue;

        const src = path.join(runtimeJsDir, relFile);
        const dest = path.join(projectJsDir, relFile);

        if (!fs.existsSync(src)) continue;

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        copied.push(`js/3d/${relFile}`);
      }
    } else {
      // Legacy: copy all changed files
      const runtimeFiles = collectFiles(runtimeJsDir, runtimeJsDir);
      for (const relFile of runtimeFiles) {
        if (relFile === 'plugins.js' || relFile.startsWith('plugins/') || relFile.startsWith('plugins\\')) continue;
        const isLib = relFile.startsWith('libs/') || relFile.startsWith('libs\\');
        if (isLib && !relFile.includes('three')) continue;

        const src = path.join(runtimeJsDir, relFile);
        const dest = isLib
          ? path.join(projectRoot, 'js', relFile)
          : path.join(projectJsDir, relFile);
        const displayPath = isLib ? `js/${relFile}` : `js/3d/${relFile}`;

        if (fs.existsSync(dest)) {
          if (fileHash(src) === fileHash(dest)) continue;
        }

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        copied.push(displayPath);
      }

      // Also copy index_3d.html
      const runtimeIndex3d = path.join(runtimePath, 'index_3d.html');
      const projectIndex3d = path.join(projectRoot, 'index_3d.html');
      if (fs.existsSync(runtimeIndex3d)) {
        if (!fs.existsSync(projectIndex3d) || fileHash(runtimeIndex3d) !== fileHash(projectIndex3d)) {
          fs.copyFileSync(runtimeIndex3d, projectIndex3d);
          copied.push('index_3d.html');
        }
      }
    }

    // Copy editor plugins (server/runtime/js/plugins/ -> project js/plugins/)
    const editorPluginsDir = path.join(runtimePath, 'js', 'plugins');
    const projectPluginsDir = path.join(projectRoot, 'js', 'plugins');
    const copiedPlugins: string[] = [];
    if (fs.existsSync(editorPluginsDir)) {
      fs.mkdirSync(projectPluginsDir, { recursive: true });
      const epFiles = fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js'));
      for (const epFile of epFiles) {
        const src = path.join(editorPluginsDir, epFile);
        const dest = path.join(projectPluginsDir, epFile);
        if (!fs.existsSync(dest) || fileHash(src) !== fileHash(dest)) {
          fs.copyFileSync(src, dest);
          copiedPlugins.push(epFile.replace('.js', ''));
          copied.push(`js/plugins/${epFile}`);
        }
      }

      // Register editor plugins in plugins.js if not already registered
      // Always check registration (even if no files were copied — plugin may exist on disk but not in plugins.js)
      {
        const pluginsJsPath = path.join(projectRoot, 'js', 'plugins.js');
        let pluginList: { name: string; status: boolean; description: string; parameters: Record<string, string> }[] = [];
        if (fs.existsSync(pluginsJsPath)) {
          const content = fs.readFileSync(pluginsJsPath, 'utf8');
          const match = content.match(/\$plugins\s*=\s*(\[[\s\S]*?\]);/);
          if (match) {
            try { pluginList = JSON.parse(match[1]); } catch { /* parse error */ }
          }
        }
        const registeredNames = new Set(pluginList.map(p => p.name));
        let modified = false;
        for (const epFile of fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js'))) {
          const pluginName = epFile.replace('.js', '');
          if (!registeredNames.has(pluginName)) {
            pluginList.push({ name: pluginName, status: true, description: '', parameters: {} });
            modified = true;
          }
        }
        if (modified) {
          const lines = pluginList.map(p => JSON.stringify(p));
          const content = `// Generated by RPG Maker.\n// Do not edit this file directly.\nvar $plugins =\n[\n${lines.join(',\n')}\n];\n`;
          fs.writeFileSync(pluginsJsPath, content, 'utf8');
        }
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

// Git status: check if project is a git repo and git is available
router.get('/git-status', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.json({ gitAvailable: false, isGitRepo: false });
    }
    const projectRoot = projectManager.currentPath!;

    // Check if git is installed
    let gitAvailable = false;
    try {
      execSync('git --version', { stdio: 'ignore' });
      gitAvailable = true;
    } catch { /* git not installed */ }

    if (!gitAvailable) {
      return res.json({ gitAvailable: false, isGitRepo: false });
    }

    // Check if it's a git repo
    let isGitRepo = false;
    try {
      execSync('git rev-parse --git-dir', { cwd: projectRoot, stdio: 'ignore' });
      isGitRepo = true;
    } catch { /* not a git repo */ }

    res.json({ gitAvailable, isGitRepo });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Git commit: auto-save commit
router.post('/git-commit', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) {
      return res.status(404).json({ error: 'No project open' });
    }
    const projectRoot = projectManager.currentPath!;
    const { addAll } = req.body;

    // Check git available
    try {
      execSync('git --version', { stdio: 'ignore' });
    } catch {
      return res.status(400).json({ error: 'Git is not installed' });
    }

    // Init repo if not already
    try {
      execSync('git rev-parse --git-dir', { cwd: projectRoot, stdio: 'ignore' });
    } catch {
      execSync('git init', { cwd: projectRoot, stdio: 'ignore' });
    }

    // Stage files
    if (addAll) {
      execSync('git add -A', { cwd: projectRoot, stdio: 'ignore' });
    } else {
      // Only stage modified tracked files
      execSync('git add -u', { cwd: projectRoot, stdio: 'ignore' });
    }

    // Check if there's anything to commit
    try {
      execSync('git diff --cached --quiet', { cwd: projectRoot, stdio: 'ignore' });
      // No changes - nothing to commit
      return res.json({ success: true, committed: false, message: 'No changes to commit' });
    } catch {
      // There are staged changes, commit them
    }

    // Get diff stats before committing
    let added = 0, modified = 0, deleted = 0;
    let changedFiles: string[] = [];
    try {
      const diffOutput = execSync('git diff --cached --name-status', {
        cwd: projectRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      if (diffOutput) {
        const lines = diffOutput.split('\n');
        changedFiles = lines.map(l => l.split('\t').slice(1).join('\t'));
        for (const line of lines) {
          const status = line[0];
          if (status === 'A') added++;
          else if (status === 'M') modified++;
          else if (status === 'D') deleted++;
        }
      }
    } catch { /* ignore diff errors */ }

    const now = new Date();
    const timestamp = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const commitMessage = `Auto-save: ${timestamp}`;
    execSync(`git commit -m "${commitMessage}"`, { cwd: projectRoot, stdio: 'ignore' });

    res.json({ success: true, committed: true, message: commitMessage, stats: { added, modified, deleted }, files: changedFiles });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
