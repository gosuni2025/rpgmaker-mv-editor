import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import projectManager from '../../services/projectManager';
import {
  getRuntimePath, checkRuntimeFiles, checkEditorPlugins, copyMigrationFile,
  registerPluginsInJs, migrateFiles, isGitAvailable, isGitRepo, ensureGitRepo, gitBackup,
} from './migrationUtils';

const router = express.Router();

function requireProject(res: Response): string | null {
  if (!projectManager.isOpen()) { res.status(404).json({ error: 'No project open' }); return null; }
  return projectManager.currentPath!;
}

router.get('/migration-check', (req: Request, res: Response) => {
  try {
    const projectPath = req.query.path as string;
    if (!projectPath) return res.status(400).json({ error: 'path is required' });
    const runtime = checkRuntimeFiles(projectPath);
    const plugins = checkEditorPlugins(projectPath);
    res.json({
      needsMigration: runtime.needsMigration || plugins.needsMigration,
      files: runtime.files, editorPluginFiles: plugins.files, gitAvailable: isGitAvailable(),
    });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.post('/migrate-git-init', (req: Request, res: Response) => {
  try {
    const root = requireProject(res); if (!root) return;
    const initialized = ensureGitRepo(root);
    res.json({ success: true, initialized });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.post('/migrate-git-add', (req: Request, res: Response) => {
  try {
    const root = requireProject(res); if (!root) return;
    execSync('git add -A', { cwd: root, stdio: 'ignore' });
    let stagedCount = 0;
    try {
      const out = execSync('git diff --cached --name-only', { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      stagedCount = out ? out.split('\n').length : 0;
    } catch {}
    res.json({ success: true, stagedCount });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.post('/migrate-git-commit', (req: Request, res: Response) => {
  try {
    const root = requireProject(res); if (!root) return;
    let hasStaged = false;
    try { execSync('git diff --cached --quiet', { cwd: root, stdio: 'ignore' }); } catch { hasStaged = true; }
    let hasHead = false;
    try { execSync('git rev-parse HEAD', { cwd: root, stdio: 'ignore' }); hasHead = true; } catch {}
    if (!hasStaged && hasHead) return res.json({ success: true, committed: false, message: '변경 사항 없음 (이미 최신)' });
    const message = hasHead ? 'Backup before runtime migration' : 'Initial commit (before runtime migration)';
    execSync(`git commit -m "${message}"`, { cwd: root, stdio: 'ignore' });
    let hash = '';
    try { hash = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim(); } catch {}
    res.json({ success: true, committed: true, message, hash });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.post('/migrate-file', (req: Request, res: Response) => {
  try {
    const root = requireProject(res); if (!root) return;
    const file = (req.body.file as string)?.replace(/\\/g, '/');
    if (!file) return res.status(400).json({ error: 'file is required' });
    const result = copyMigrationFile(root, file);
    res.json({ success: true, ...result });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.get('/migrate-plugin-files', (req: Request, res: Response) => {
  try {
    const root = requireProject(res); if (!root) return;
    const editorPluginsDir = path.join(getRuntimePath(), 'js', 'plugins');
    const projectPluginsDir = path.join(root, 'js', 'plugins');
    if (!fs.existsSync(editorPluginsDir)) return res.json({ files: [] });
    const files = fs.readdirSync(editorPluginsDir).filter(f => f.endsWith('.js')).map(f => ({
      file: `js/plugins/${f}`,
      from: path.join(editorPluginsDir, f),
      to: path.join(projectPluginsDir, f),
    }));
    res.json({ files });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.post('/migrate-register-plugins', (req: Request, res: Response) => {
  try {
    const root = requireProject(res); if (!root) return;
    const modified = registerPluginsInJs(root);
    res.json({ success: true, modified });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.post('/migrate', (req: Request, res: Response) => {
  try {
    const root = requireProject(res); if (!root) return;
    if (req.body.gitBackup === true) {
      try { gitBackup(root); } catch (gitErr) {
        return res.status(500).json({ error: `Git backup failed: ${(gitErr as Error).message}` });
      }
    }
    const copied = migrateFiles(root, req.body.files);
    res.json({ success: true, copied });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.get('/migration-backups', (req: Request, res: Response) => {
  try {
    const root = projectManager.isOpen() ? projectManager.currentPath! : null;
    if (!root || !isGitRepo(root)) return res.json({ backups: [] });
    let output = '';
    try {
      output = execSync('git log --all --format="%H|%aI|%s" --grep="before runtime migration"',
        { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch { return res.json({ backups: [] }); }
    if (!output) return res.json({ backups: [] });
    const backups = output.split('\n').map(line => {
      const [hash, date, ...msg] = line.split('|');
      return { hash, date, message: msg.join('|') };
    });
    res.json({ backups });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.post('/migration-rollback', (req: Request, res: Response) => {
  try {
    const root = requireProject(res); if (!root) return;
    const { commitHash } = req.body;
    if (!commitHash || !/^[0-9a-f]{7,40}$/i.test(commitHash))
      return res.status(400).json({ error: 'Invalid commit hash' });
    try { execSync(`git cat-file -t ${commitHash}`, { cwd: root, stdio: 'ignore' }); }
    catch { return res.status(400).json({ error: 'Commit not found' }); }
    execSync(`git checkout ${commitHash} -- js/`, { cwd: root, stdio: 'ignore' });
    res.json({ success: true });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.get('/git-status', (req: Request, res: Response) => {
  try {
    const gitAvail = isGitAvailable();
    if (!projectManager.isOpen() || !gitAvail) return res.json({ gitAvailable: gitAvail, isGitRepo: false });
    res.json({ gitAvailable: true, isGitRepo: isGitRepo(projectManager.currentPath!) });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

router.post('/git-commit', (req: Request, res: Response) => {
  try {
    const root = requireProject(res); if (!root) return;
    if (!isGitAvailable()) return res.status(400).json({ error: 'Git is not installed' });
    ensureGitRepo(root);
    execSync(req.body.addAll ? 'git add -A' : 'git add -u', { cwd: root, stdio: 'ignore' });
    try {
      execSync('git diff --cached --quiet', { cwd: root, stdio: 'ignore' });
      return res.json({ success: true, committed: false, message: 'No changes to commit' });
    } catch {}
    let added = 0, modified = 0, deleted = 0;
    let changedFiles: string[] = [];
    try {
      const diffOutput = execSync('git diff --cached --name-status',
        { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (diffOutput) {
        const lines = diffOutput.split('\n');
        changedFiles = lines.map(l => l.split('\t').slice(1).join('\t'));
        for (const line of lines) {
          const s = line[0];
          if (s === 'A') added++; else if (s === 'M') modified++; else if (s === 'D') deleted++;
        }
      }
    } catch {}
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const commitMessage = `Auto-save: ${timestamp}`;
    execSync(`git commit -m "${commitMessage}"`, { cwd: root, stdio: 'ignore' });
    res.json({ success: true, committed: true, message: commitMessage, stats: { added, modified, deleted }, files: changedFiles });
  } catch (err: unknown) { res.status(500).json({ error: (err as Error).message }); }
});

export default router;
