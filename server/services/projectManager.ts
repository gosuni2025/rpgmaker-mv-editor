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

  /** 확장 데이터 쓰기 (빈 객체면 {} 파일 생성, 파일이 이미 있으면 덮어쓰기) */
  writeExtJSON(mapFilename: string, data: Record<string, unknown>): void {
    const extFile = this.extFilename(mapFilename);
    const filePath = path.join(this.getDataPath(), extFile);
    fileWatcher.markApiWrite(extFile);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  },

  /** 확장 데이터 파일 삭제 */
  deleteExtJSON(mapFilename: string): void {
    const extFile = this.extFilename(mapFilename);
    const filePath = path.join(this.getDataPath(), extFile);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  },

  // ── 이벤트 외부 파일 관련 ──

  /** 이벤트 파일명 생성: "001-이름.json" (이름이 없으면 "001.json") */
  eventFileSlug(eventId: number, eventName: string): string {
    const idStr = String(eventId).padStart(3, '0');
    const slug = (eventName || '')
      .replace(/[/\\:*?"<>|\0]/g, '')  // 금지 문자 제거
      .replace(/\s+/g, '-')             // 공백 → -
      .replace(/-+/g, '-')              // 연속 - 압축
      .replace(/^-+|-+$/g, '')          // 앞뒤 - 제거
      .substring(0, 30);                // 30자 제한
    return slug ? `${idStr}-${slug}.json` : `${idStr}.json`;
  },

  /** 이벤트 폴더 경로: data/Map001/ */
  getEventFolderPath(mapId: number): string {
    const idStr = String(mapId).padStart(3, '0');
    return path.join(this.getDataPath(), `Map${idStr}`);
  },

  /** 이벤트 폴더 내에서 eventId로 파일 찾기 (앞의 숫자로 매핑) */
  findEventFilePath(mapId: number, eventId: number): string | null {
    const folderPath = this.getEventFolderPath(mapId);
    if (!fs.existsSync(folderPath)) return null;
    const prefix = String(eventId).padStart(3, '0');
    const files = fs.readdirSync(folderPath);
    const found = files.find(f => (f === `${prefix}.json` || f.startsWith(`${prefix}-`)) && f.endsWith('.json'));
    return found ? path.join(folderPath, found) : null;
  },

  /** 이벤트 파일 읽기 */
  readEventFile(mapId: number, eventId: number): unknown {
    const filePath = this.findEventFilePath(mapId, eventId);
    if (!filePath) throw new Error(`Event file not found: Map${String(mapId).padStart(3,'0')} #${eventId}`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  },

  /** 이벤트 파일 쓰기 (이름 변경 감지하여 파일명 갱신, 새 파일명 반환) */
  writeEventFile(mapId: number, eventId: number, eventName: string, data: unknown): string {
    const folderPath = this.getEventFolderPath(mapId);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    const newFilename = this.eventFileSlug(eventId, eventName);
    const newFilePath = path.join(folderPath, newFilename);
    // 기존 파일이 다른 이름이면 삭제 (이름 변경 대응)
    const oldFilePath = this.findEventFilePath(mapId, eventId);
    if (oldFilePath && path.resolve(oldFilePath) !== path.resolve(newFilePath)) {
      fs.unlinkSync(oldFilePath);
    }
    fs.writeFileSync(newFilePath, JSON.stringify(data, null, 2), 'utf8');
    return newFilename;
  },

  /** 이벤트 파일 삭제 */
  deleteEventFile(mapId: number, eventId: number): void {
    const filePath = this.findEventFilePath(mapId, eventId);
    if (filePath) fs.unlinkSync(filePath);
  },

  /** 이벤트 폴더 전체 삭제 */
  deleteEventFolder(mapId: number): void {
    const folderPath = this.getEventFolderPath(mapId);
    if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
  },

  /** 이벤트 폴더 복사 (duplicate 시 사용) */
  copyEventFolder(sourceMapId: number, destMapId: number): void {
    const srcFolder = this.getEventFolderPath(sourceMapId);
    if (!fs.existsSync(srcFolder)) return;
    const destFolder = this.getEventFolderPath(destMapId);
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
    const files = fs.readdirSync(srcFolder);
    for (const file of files) {
      fs.copyFileSync(path.join(srcFolder, file), path.join(destFolder, file));
    }
  },

  /** 이벤트 폴더 내 파일 목록 반환 */
  listEventFiles(mapId: number): { eventId: number; filename: string; filePath: string }[] {
    const folderPath = this.getEventFolderPath(mapId);
    if (!fs.existsSync(folderPath)) return [];
    const files = fs.readdirSync(folderPath);
    const result: { eventId: number; filename: string; filePath: string }[] = [];
    for (const file of files) {
      const match = file.match(/^(\d+)/);
      if (match && file.endsWith('.json')) {
        result.push({ eventId: parseInt(match[1], 10), filename: file, filePath: path.join(folderPath, file) });
      }
    }
    return result;
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
