export interface MigrationFile {
  file: string;
  status: 'add' | 'update' | 'same';
  editorSize?: number;
  projectSize?: number;
  editorMtime?: string;
  projectMtime?: string;
}

export interface MigrationCheckResult {
  needsMigration: boolean;
  files: MigrationFile[];
  gitAvailable: boolean;
}

export interface MigrationBackup {
  hash: string;
  date: string;
  message: string;
}

export interface PluginFileInfo {
  file: string;
  from: string;
  to: string;
}

export interface MigrationProgress {
  phase: 'gitInit' | 'gitAdd' | 'gitCommit' | 'copying' | 'registerPlugins';
  current: number;
  total: number;
  currentFile: string;
  from: string;
  to: string;
  detail?: string;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}
