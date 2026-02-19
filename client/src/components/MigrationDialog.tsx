import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';

interface MigrationFile {
  file: string;
  status: 'add' | 'update' | 'same';
  editorSize?: number;
  projectSize?: number;
  editorMtime?: string;
  projectMtime?: string;
}

interface MigrationCheckResult {
  needsMigration: boolean;
  files: MigrationFile[];
  gitAvailable: boolean;
}

interface MigrationBackup {
  hash: string;
  date: string;
  message: string;
}

interface PluginFileInfo {
  file: string;
  from: string;
  to: string;
}

interface MigrationProgress {
  phase: 'gitInit' | 'gitAdd' | 'gitCommit' | 'copying' | 'registerPlugins';
  current: number;
  total: number;
  currentFile: string;
  from: string;
  to: string;
  detail?: string;   // 단계별 부가 정보 (파일 수, 커밋 해시 등)
}

interface MigrationDialogProps {
  projectPath: string;
  onComplete: () => void;
  onSkip: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

export default function MigrationDialog({ projectPath, onComplete, onSkip }: MigrationDialogProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<MigrationFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [error, setError] = useState('');
  const [gitAvailable, setGitAvailable] = useState(false);
  const [gitBackup, setGitBackup] = useState(true);
  const [showNoGitWarning, setShowNoGitWarning] = useState(false);
  const [backups, setBackups] = useState<MigrationBackup[]>([]);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [rollingBack, setRollingBack] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);

  useEscClose(useCallback(() => {
    if (migrating) return;
    if (showRollbackConfirm) setShowRollbackConfirm(false);
    else if (showNoGitWarning) setShowNoGitWarning(false);
    else onSkip();
  }, [migrating, showRollbackConfirm, showNoGitWarning, onSkip]));

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<MigrationCheckResult>(
          `/project/migration-check?path=${encodeURIComponent(projectPath)}`
        );
        setFiles(res.files);
        setSelected(new Set(res.files.filter(f => f.status !== 'same').map(f => f.file)));
        setGitAvailable(res.gitAvailable);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectPath]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<{ backups: MigrationBackup[] }>('/project/migration-backups');
        setBackups(res.backups);
        if (res.backups.length > 0) setSelectedBackup(res.backups[0].hash);
      } catch { /* ignore */ }
    })();
  }, []);

  const changedFiles = files.filter(f => f.status !== 'same');

  const toggleFile = (file: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === changedFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(changedFiles.map(f => f.file)));
    }
  };

  const handleMigrateClick = () => {
    if (!gitBackup && !gitAvailable) {
      setShowNoGitWarning(true);
      return;
    }
    if (!gitBackup) {
      setShowNoGitWarning(true);
      return;
    }
    doMigrate();
  };

  const doMigrate = async () => {
    setShowNoGitWarning(false);
    setMigrating(true);
    setError('');

    try {
      // Step 1: Git backup (3 substeps)
      if (gitBackup && gitAvailable) {
        // 1-1. init
        setProgress({ phase: 'gitInit', current: 0, total: 0, currentFile: '', from: '', to: '' });
        const initRes = await apiClient.post<{ success: boolean; initialized: boolean }>(
          '/project/migrate-git-init', {}
        );
        setProgress(prev => prev ? {
          ...prev,
          detail: initRes.initialized ? '새 저장소를 초기화했습니다' : '기존 저장소 사용',
        } : prev);

        // 1-2. add
        setProgress({ phase: 'gitAdd', current: 0, total: 0, currentFile: '', from: '', to: '' });
        const addRes = await apiClient.post<{ success: boolean; stagedCount: number }>(
          '/project/migrate-git-add', {}
        );
        setProgress(prev => prev ? {
          ...prev,
          detail: `${addRes.stagedCount}개 파일 스테이징됨`,
        } : prev);

        // 1-3. commit
        setProgress({ phase: 'gitCommit', current: 0, total: 0, currentFile: '', from: '', to: '' });
        const commitRes = await apiClient.post<{ success: boolean; committed: boolean; message: string; hash: string }>(
          '/project/migrate-git-commit', {}
        );
        setProgress(prev => prev ? {
          ...prev,
          detail: commitRes.committed
            ? `커밋 완료 — ${commitRes.hash} "${commitRes.message}"`
            : commitRes.message,
        } : prev);
      }

      // Step 2: Collect plugin files
      const pluginRes = await apiClient.get<{ files: PluginFileInfo[] }>('/project/migrate-plugin-files');
      const pluginFiles = pluginRes.files;

      // Build full list of files to copy: selected 3d/index.html files + all plugin files
      const filesToCopy: { file: string; from?: string; to?: string }[] = [
        ...Array.from(selected).map(f => ({ file: f })),
        ...pluginFiles.map(p => ({ file: p.file, from: p.from, to: p.to })),
      ];
      const total = filesToCopy.length;

      // Step 3: Copy files one by one
      for (let i = 0; i < filesToCopy.length; i++) {
        const item = filesToCopy[i];
        setProgress({
          phase: 'copying',
          current: i + 1,
          total,
          currentFile: item.file,
          from: item.from ?? '',
          to: item.to ?? '',
        });

        const res = await apiClient.post<{ success: boolean; from: string; to: string }>(
          '/project/migrate-file',
          { file: item.file }
        );
        // Update from/to with actual paths from server response
        setProgress(prev => prev ? { ...prev, from: res.from, to: res.to } : prev);
      }

      // Step 4: Register plugins
      setProgress({
        phase: 'registerPlugins',
        current: total,
        total,
        currentFile: 'plugins.js',
        from: '',
        to: '',
      });
      await apiClient.post('/project/migrate-register-plugins', {});

      setProgress(null);
      onComplete();
    } catch (e) {
      setError((e as Error).message);
      setProgress(null);
      setMigrating(false);
    }
  };

  const refreshMigrationCheck = async () => {
    try {
      const res = await apiClient.get<MigrationCheckResult>(
        `/project/migration-check?path=${encodeURIComponent(projectPath)}`
      );
      setFiles(res.files);
      setSelected(new Set(res.files.filter(f => f.status !== 'same').map(f => f.file)));
    } catch { /* ignore */ }
  };

  const doRollback = async () => {
    setShowRollbackConfirm(false);
    setRollingBack(true);
    setError('');
    try {
      await apiClient.post('/project/migration-rollback', { commitHash: selectedBackup });
      await refreshMigrationCheck();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRollingBack(false);
    }
  };

  const phaseLabel = progress
    ? progress.phase === 'gitInit'     ? t('migration.phaseGitInit')
    : progress.phase === 'gitAdd'      ? t('migration.phaseGitAdd')
    : progress.phase === 'gitCommit'   ? t('migration.phaseGitCommit')
    : progress.phase === 'registerPlugins' ? t('migration.phaseRegisterPlugins')
    : t('migration.phaseCopying', { current: progress.current, total: progress.total })
    : '';

  const progressPct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 800, height: 'auto', minHeight: 0, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="db-dialog-header">{t('migration.title')}</div>
        <div style={{ padding: '16px 20px', flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>{t('common.loading')}</div>
          ) : error ? (
            <div style={{ color: '#e55', padding: 8 }}>{error}</div>
          ) : (
            <>
              <p style={{ color: '#ddd', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px 0' }}>
                {t('migration.description')}
              </p>
              <div style={{ border: '1px solid #555', borderRadius: 3, background: '#2b2b2b', maxHeight: 300, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #555', background: '#333' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: '#aaa', width: 30 }}>
                        <input
                          type="checkbox"
                          checked={changedFiles.length > 0 && selected.size === changedFiles.length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', color: '#aaa' }}>{t('migration.file')}</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: '#aaa', width: 80 }}>{t('migration.status')}</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: '#aaa', width: 100 }}>{t('migration.editorSize')}</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: '#aaa', width: 120 }}>{t('migration.editorMtime')}</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: '#aaa', width: 100 }}>{t('migration.projectSize')}</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', color: '#aaa', width: 120 }}>{t('migration.projectMtime')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(f => (
                      <tr key={f.file} style={{ borderBottom: '1px solid #444' }}>
                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                          {f.status !== 'same' ? (
                            <input
                              type="checkbox"
                              checked={selected.has(f.file)}
                              onChange={() => toggleFile(f.file)}
                            />
                          ) : null}
                        </td>
                        <td style={{ padding: '4px 8px', color: f.status === 'same' ? '#888' : '#ddd' }}>
                          {f.file}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                          {f.status === 'add' && <span style={{ color: '#6c6', fontWeight: 'bold' }}>{t('migration.statusAdd')}</span>}
                          {f.status === 'update' && <span style={{ color: '#fc6', fontWeight: 'bold' }}>{t('migration.statusUpdate')}</span>}
                          {f.status === 'same' && <span style={{ color: '#888' }}>{t('migration.statusSame')}</span>}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: '#aaa' }}>
                          {f.editorSize != null ? formatSize(f.editorSize) : '-'}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: '#aaa', fontSize: 11 }}>
                          {f.editorMtime ? formatDate(f.editorMtime) : '-'}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: '#aaa' }}>
                          {f.projectSize != null ? formatSize(f.projectSize) : '-'}
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: '#aaa', fontSize: 11 }}>
                          {f.projectMtime ? formatDate(f.projectMtime) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ color: '#999', fontSize: 11, margin: '8px 0 0 0' }}>
                {t('migration.summary', { changed: selected.size, total: files.length })}
              </p>
              <div style={{ margin: '12px 0 0 0', padding: '8px 10px', background: '#333', borderRadius: 3, border: '1px solid #555' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ddd', fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={gitBackup}
                    onChange={e => setGitBackup(e.target.checked)}
                    disabled={!gitAvailable}
                  />
                  {t('migration.gitBackup')}
                </label>
                {!gitAvailable && (
                  <p style={{ color: '#e88', fontSize: 11, margin: '4px 0 0 22px' }}>
                    {t('migration.gitNotAvailable')}
                  </p>
                )}
              </div>
              {backups.length > 0 && (
                <div style={{ margin: '12px 0 0 0', padding: '10px', background: '#333', borderRadius: 3, border: '1px solid #555' }}>
                  <div style={{ color: '#ddd', fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
                    {t('migration.rollbackTitle')}
                  </div>
                  <p style={{ color: '#aaa', fontSize: 12, margin: '0 0 8px 0' }}>
                    {t('migration.rollbackDescription')}
                  </p>
                  <div style={{ border: '1px solid #555', borderRadius: 3, background: '#2b2b2b', maxHeight: 150, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #555', background: '#333' }}>
                          <th style={{ padding: '4px 8px', width: 30 }}></th>
                          <th style={{ padding: '4px 8px', textAlign: 'left', color: '#aaa' }}>{t('migration.rollbackDate')}</th>
                          <th style={{ padding: '4px 8px', textAlign: 'left', color: '#aaa', width: 80 }}>{t('migration.rollbackHash')}</th>
                          <th style={{ padding: '4px 8px', textAlign: 'left', color: '#aaa' }}>{t('migration.rollbackMessage')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backups.map(b => (
                          <tr key={b.hash} style={{ borderBottom: '1px solid #444', cursor: 'pointer' }} onClick={() => setSelectedBackup(b.hash)}>
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                              <input type="radio" name="rollbackBackup" checked={selectedBackup === b.hash} onChange={() => setSelectedBackup(b.hash)} />
                            </td>
                            <td style={{ padding: '4px 8px', color: '#ddd', fontSize: 11 }}>{formatDate(b.date)}</td>
                            <td style={{ padding: '4px 8px', color: '#8cf', fontFamily: 'monospace', fontSize: 11 }}>{b.hash.slice(0, 8)}</td>
                            <td style={{ padding: '4px 8px', color: '#aaa' }}>{b.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <button
                      className="db-btn"
                      onClick={() => setShowRollbackConfirm(true)}
                      disabled={!selectedBackup || rollingBack}
                      style={{ background: '#c44', borderColor: '#c44' }}
                    >
                      {rollingBack ? t('migration.rollingBack') : t('migration.rollback')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="db-dialog-footer">
          {!loading && !error && (
            <button
              className="db-btn"
              onClick={handleMigrateClick}
              disabled={migrating || selected.size === 0 || (gitBackup && !gitAvailable)}
              style={{ background: '#0078d4', borderColor: '#0078d4' }}
            >
              {migrating ? t('migration.migrating') : t('migration.migrate')}
            </button>
          )}
          <button className="db-btn" onClick={onSkip} disabled={migrating}>
            {t('common.cancel')}
          </button>
        </div>
      </div>

      {/* Migration progress popup */}
      {progress && (
        <div className="db-dialog-overlay" style={{ zIndex: 10002 }}>
          <div className="db-dialog" style={{ width: 560, height: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="db-dialog-header">{t('migration.progressTitle')}</div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Phase label + progress counter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#ddd', fontSize: 13, fontWeight: 'bold' }}>{phaseLabel}</span>
                {progress.total > 0 && (
                  <span style={{ color: '#aaa', fontSize: 12 }}>{progress.current} / {progress.total}</span>
                )}
              </div>

              {/* Progress bar */}
              {progress.total > 0 && (
                <div style={{ background: '#444', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    background: '#0078d4',
                    height: '100%',
                    width: `${progressPct}%`,
                    transition: 'width 0.15s ease',
                  }} />
                </div>
              )}

              {/* Git 단계 정보 */}
              {(progress.phase === 'gitInit' || progress.phase === 'gitAdd' || progress.phase === 'gitCommit') && (
                <div style={{ background: '#2b2b2b', borderRadius: 3, border: '1px solid #444', padding: '10px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: '6px 10px', fontSize: 12, alignItems: 'start' }}>
                    {/* 각 단계 상태 행 */}
                    {(['gitInit', 'gitAdd', 'gitCommit'] as const).map((step) => {
                      const phases = ['gitInit', 'gitAdd', 'gitCommit'] as const;
                      const stepIdx = phases.indexOf(step);
                      const curIdx = phases.indexOf(progress.phase as typeof step);
                      const isDone = stepIdx < curIdx;
                      const isActive = stepIdx === curIdx;
                      const isPending = stepIdx > curIdx;
                      const labels: Record<typeof step, string> = {
                        gitInit:   t('migration.phaseGitInit'),
                        gitAdd:    t('migration.phaseGitAdd'),
                        gitCommit: t('migration.phaseGitCommit'),
                      };
                      return (
                        <React.Fragment key={step}>
                          <span style={{ fontSize: 14, lineHeight: '16px' }}>
                            {isDone ? '✓' : isActive ? '▶' : '○'}
                          </span>
                          <div>
                            <span style={{
                              color: isDone ? '#6c6' : isActive ? '#ddd' : '#666',
                              fontWeight: isActive ? 'bold' : 'normal',
                            }}>
                              {labels[step]}
                            </span>
                            {isActive && progress.detail && (
                              <span style={{ color: '#aaa', marginLeft: 8, fontSize: 11 }}>
                                {progress.detail}
                              </span>
                            )}
                            {isDone && (
                              <span style={{ color: '#555', marginLeft: 8, fontSize: 11 }}>
                                {step === 'gitInit' && t('migration.gitStepInitDone')}
                                {step === 'gitAdd'  && t('migration.gitStepAddDone')}
                                {step === 'gitCommit' && t('migration.gitStepCommitDone')}
                              </span>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {/* detail은 active 단계 아래에 표시 — 이미 행에 포함했으므로 생략 */}
                </div>
              )}

              {/* Current file (복사 단계에서만) */}
              {progress.currentFile && progress.phase === 'copying' && (
                <div style={{ background: '#2b2b2b', borderRadius: 3, border: '1px solid #444', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: '4px 8px', fontSize: 12 }}>
                    <span style={{ color: '#888' }}>{t('migration.progressFile')}</span>
                    <span style={{ color: '#ddd', wordBreak: 'break-all' }}>{progress.currentFile}</span>

                    {progress.from && (
                      <>
                        <span style={{ color: '#888' }}>{t('migration.progressFrom')}</span>
                        <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{progress.from}</span>
                      </>
                    )}

                    {progress.to && (
                      <>
                        <span style={{ color: '#888' }}>{t('migration.progressTo')}</span>
                        <span style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{progress.to}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showNoGitWarning && (
        <div className="db-dialog-overlay" style={{ zIndex: 10001 }}>
          <div className="db-dialog" style={{ width: 420, height: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="db-dialog-header">{t('migration.gitWarningTitle')}</div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ color: '#fc6', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                {t('migration.gitWarningMessage')}
              </p>
            </div>
            <div className="db-dialog-footer">
              <button
                className="db-btn"
                onClick={doMigrate}
                style={{ background: '#c44', borderColor: '#c44' }}
              >
                {t('migration.gitWarningProceed')}
              </button>
              <button className="db-btn" onClick={() => setShowNoGitWarning(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRollbackConfirm && (
        <div className="db-dialog-overlay" style={{ zIndex: 10001 }}>
          <div className="db-dialog" style={{ width: 420, height: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="db-dialog-header">{t('migration.rollbackConfirmTitle')}</div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ color: '#fc6', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                {t('migration.rollbackConfirmMessage')}
              </p>
            </div>
            <div className="db-dialog-footer">
              <button
                className="db-btn"
                onClick={doRollback}
                style={{ background: '#c44', borderColor: '#c44' }}
              >
                {t('migration.rollbackConfirmProceed')}
              </button>
              <button className="db-btn" onClick={() => setShowRollbackConfirm(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
