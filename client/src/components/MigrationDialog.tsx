import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';
import { MigrationFile, MigrationCheckResult, MigrationBackup, PluginFileInfo, MigrationProgress } from './MigrationDialogTypes';
import { ProgressOverlay, GitWarningOverlay, RollbackConfirmOverlay, RollbackSection, MigrationFileTable } from './MigrationDialogOverlays';

interface MigrationDialogProps {
  projectPath: string;
  onComplete: () => void;
  onSkip: () => void;
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
      if (next.has(file)) next.delete(file); else next.add(file);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === changedFiles.length ? new Set() : new Set(changedFiles.map(f => f.file)));
  };

  const handleMigrateClick = () => {
    if (!gitBackup) { setShowNoGitWarning(true); return; }
    doMigrate();
  };

  const doMigrate = async () => {
    setShowNoGitWarning(false);
    setMigrating(true);
    setError('');

    try {
      if (gitBackup && gitAvailable) {
        setProgress({ phase: 'gitInit', current: 0, total: 0, currentFile: '', from: '', to: '' });
        const initRes = await apiClient.post<{ success: boolean; initialized: boolean }>('/project/migrate-git-init', {});
        setProgress(prev => prev ? { ...prev, detail: initRes.initialized ? '새 저장소를 초기화했습니다' : '기존 저장소 사용' } : prev);

        setProgress({ phase: 'gitAdd', current: 0, total: 0, currentFile: '', from: '', to: '' });
        const addRes = await apiClient.post<{ success: boolean; stagedCount: number }>('/project/migrate-git-add', {});
        setProgress(prev => prev ? { ...prev, detail: `${addRes.stagedCount}개 파일 스테이징됨` } : prev);

        setProgress({ phase: 'gitCommit', current: 0, total: 0, currentFile: '', from: '', to: '' });
        const commitRes = await apiClient.post<{ success: boolean; committed: boolean; message: string; hash: string }>('/project/migrate-git-commit', {});
        setProgress(prev => prev ? { ...prev, detail: commitRes.committed ? `커밋 완료 — ${commitRes.hash} "${commitRes.message}"` : commitRes.message } : prev);
      }

      const pluginRes = await apiClient.get<{ files: PluginFileInfo[] }>('/project/migrate-plugin-files');
      const filesToCopy: { file: string; from?: string; to?: string }[] = [
        ...Array.from(selected).map(f => ({ file: f })),
        ...pluginRes.files.map(p => ({ file: p.file, from: p.from, to: p.to })),
      ];
      const total = filesToCopy.length;

      for (let i = 0; i < filesToCopy.length; i++) {
        const item = filesToCopy[i];
        setProgress({ phase: 'copying', current: i + 1, total, currentFile: item.file, from: item.from ?? '', to: item.to ?? '' });
        const res = await apiClient.post<{ success: boolean; from: string; to: string }>('/project/migrate-file', { file: item.file });
        setProgress(prev => prev ? { ...prev, from: res.from, to: res.to } : prev);
      }

      setProgress({ phase: 'registerPlugins', current: total, total, currentFile: 'plugins.js', from: '', to: '' });
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
      const res = await apiClient.get<MigrationCheckResult>(`/project/migration-check?path=${encodeURIComponent(projectPath)}`);
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
              <p style={{ color: '#ddd', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px 0' }}>{t('migration.description')}</p>
              <MigrationFileTable files={files} selected={selected} toggleFile={toggleFile} toggleAll={toggleAll} changedCount={changedFiles.length} />
              <p style={{ color: '#999', fontSize: 11, margin: '8px 0 0 0' }}>
                {t('migration.summary', { changed: selected.size, total: files.length })}
              </p>
              <div style={{ margin: '12px 0 0 0', padding: '8px 10px', background: '#333', borderRadius: 3, border: '1px solid #555' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ddd', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={gitBackup} onChange={e => setGitBackup(e.target.checked)} disabled={!gitAvailable} />
                  {t('migration.gitBackup')}
                </label>
                {!gitAvailable && (
                  <p style={{ color: '#e88', fontSize: 11, margin: '4px 0 0 22px' }}>{t('migration.gitNotAvailable')}</p>
                )}
              </div>
              <RollbackSection
                backups={backups} selectedBackup={selectedBackup} setSelectedBackup={setSelectedBackup}
                rollingBack={rollingBack} onRollbackClick={() => setShowRollbackConfirm(true)}
              />
            </>
          )}
        </div>
        <div className="db-dialog-footer">
          {!loading && !error && (
            <button className="db-btn" onClick={handleMigrateClick}
              disabled={migrating || selected.size === 0 || (gitBackup && !gitAvailable)}
              style={{ background: '#0078d4', borderColor: '#0078d4' }}>
              {migrating ? t('migration.migrating') : t('migration.migrate')}
            </button>
          )}
          <button className="db-btn" onClick={onSkip} disabled={migrating}>{t('common.cancel')}</button>
        </div>
      </div>

      {progress && <ProgressOverlay progress={progress} />}
      {showNoGitWarning && <GitWarningOverlay onProceed={doMigrate} onCancel={() => setShowNoGitWarning(false)} />}
      {showRollbackConfirm && <RollbackConfirmOverlay onProceed={doRollback} onCancel={() => setShowRollbackConfirm(false)} />}
    </div>
  );
}
