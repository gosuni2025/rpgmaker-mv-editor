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

  /** ext 파일명 생성: Map001.json → Map001_ext.json */
  extFilename(mapFilename: string): string {
    return mapFilename.replace(/\.json$/, '_ext.json');
  },

  /** 확장 데이터 읽기 (없으면 빈 객체 반환) */
  readExtJSON(mapFilename: string): Record<string, unknown> {
    const extFile = this.extFilename(mapFilename);
    const filePath = path.join(this.getDataPath(), extFile);
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  },

  /** 확장 데이터 쓰기 (빈 객체면 파일 삭제) */
  writeExtJSON(mapFilename: string, data: Record<string, unknown>): void {
    const extFile = this.extFilename(mapFilename);
    const filePath = path.join(this.getDataPath(), extFile);
    if (Object.keys(data).length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    }
    fileWatcher.markApiWrite(extFile);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  },

  /** 확장 데이터 파일 삭제 */
  deleteExtJSON(mapFilename: string): void {
    const extFile = this.extFilename(mapFilename);
    const filePath = path.join(this.getDataPath(), extFile);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
