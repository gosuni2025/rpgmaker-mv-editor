import fs from 'fs';
import path from 'path';
import fileWatcher from './fileWatcher';

const projectManager = {
  currentPath: null as string | null,

  open(projectPath: string): void {
    const dataPath = path.join(projectPath, 'data');
    if (!fs.existsSync(dataPath)) {
      throw new Error('Invalid project: data/ directory not found');
    }
    this.currentPath = projectPath;
  },

  isOpen(): boolean {
    return this.currentPath !== null;
  },

  getDataPath(): string {
    return path.join(this.currentPath!, 'data');
  },

  getImgPath(): string {
    return path.join(this.currentPath!, 'img');
  },

  readJSON(filename: string): unknown {
    const filePath = path.join(this.getDataPath(), filename);
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  },

  writeJSON(filename: string, data: unknown): void {
    fileWatcher.markApiWrite(filename);
    const filePath = path.join(this.getDataPath(), filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  },

  close(): void {
    this.currentPath = null;
  },

  getAudioPath(): string {
    return path.join(this.currentPath!, 'audio');
  },

  getJsPath(): string {
    return path.join(this.currentPath!, 'js');
  },
};

export default projectManager;
