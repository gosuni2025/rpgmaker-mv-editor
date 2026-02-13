import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<MigrationCheckResult>(
          `/project/migration-check?path=${encodeURIComponent(projectPath)}`
        );
        setFiles(res.files);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectPath]);

  const changedFiles = files.filter(f => f.status !== 'same');

  const handleMigrate = async () => {
    setMigrating(true);
    setError('');
    try {
      await apiClient.post('/project/migrate', {});
      onComplete();
    } catch (e) {
      setError((e as Error).message);
      setMigrating(false);
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
              <p style={{ color: '#ddd', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px 0' }}>
                {t('migration.description')}
              </p>
              <div style={{ border: '1px solid #555', borderRadius: 3, background: '#2b2b2b', maxHeight: 300, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #555', background: '#333' }}>
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
                {t('migration.summary', { changed: changedFiles.length, total: files.length })}
              </p>
            </>
          )}
        </div>
        <div className="db-dialog-footer">
          {!loading && !error && (
            <button
              className="db-btn"
              onClick={handleMigrate}
              disabled={migrating || changedFiles.length === 0}
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
    </div>
  );
}
