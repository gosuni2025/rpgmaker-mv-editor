export type Tab = 'netlify' | 'ghpages' | 'itchio' | 'local';

export type SSEEvent =
  | { type: 'status'; phase: 'counting' | 'zipping' | 'uploading' | 'creating-site' | 'copying' | 'patching' | 'committing' | 'pushing' | 'pages-setup' | 'pages-setup-skipped'; detail?: string }
  | { type: 'log'; message: string }
  | { type: 'counted'; total: number }
  | { type: 'progress'; current: number; total: number }
  | { type: 'zip-progress'; current: number; total: number; name: string }
  | { type: 'upload-progress'; sent: number; total: number }
  | { type: 'site-created'; siteId: string; siteName: string }
  | { type: 'done'; zipPath?: string; deployUrl?: string; siteUrl?: string; commitHash?: string; pageUrl?: string; buildId?: string; gameId?: string }
  | { type: 'error'; message: string };

export interface GhPagesRemote {
  name: string;
  url: string;
  pageUrl: string;
}

export interface GhPagesCheck {
  ghCli: boolean;
  isGitRepo: boolean;
  remotes: GhPagesRemote[];
  selectedRemote: string;
  pageUrl: string;
}

export interface DeployProgressState {
  busy: boolean;
  status: string;
  error: string;
  progress: number | null;
}
