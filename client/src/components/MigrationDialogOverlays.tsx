import React from 'react';
import { useTranslation } from 'react-i18next';
import { MigrationProgress, MigrationBackup, formatSize, formatDate } from './MigrationDialogTypes';

// ─── Progress popup ───
export function ProgressOverlay({ progress }: { progress: MigrationProgress }) {
  const { t } = useTranslation();

  const phaseLabel =
    progress.phase === 'gitInit'     ? t('migration.phaseGitInit')
    : progress.phase === 'gitAdd'    ? t('migration.phaseGitAdd')
    : progress.phase === 'gitCommit' ? t('migration.phaseGitCommit')
    : progress.phase === 'registerPlugins' ? t('migration.phaseRegisterPlugins')
    : t('migration.phaseCopying', { current: progress.current, total: progress.total });

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const GIT_STEPS = ['gitInit', 'gitAdd', 'gitCommit'] as const;

  return (
    <div className="db-dialog-overlay" style={{ zIndex: 10002 }}>
      <div className="db-dialog" style={{ width: 560, height: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="db-dialog-header">{t('migration.progressTitle')}</div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#ddd', fontSize: 13, fontWeight: 'bold' }}>{phaseLabel}</span>
            {progress.total > 0 && (
              <span style={{ color: '#aaa', fontSize: 12 }}>{progress.current} / {progress.total}</span>
            )}
          </div>

          {progress.total > 0 && (
            <div style={{ background: '#444', borderRadius: 3, height: 6, overflow: 'hidden' }}>
              <div style={{ background: '#0078d4', height: '100%', width: `${pct}%`, transition: 'width 0.15s ease' }} />
            </div>
          )}

          {(progress.phase === 'gitInit' || progress.phase === 'gitAdd' || progress.phase === 'gitCommit') && (
            <div style={{ background: '#2b2b2b', borderRadius: 3, border: '1px solid #444', padding: '10px 12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: '6px 10px', fontSize: 12, alignItems: 'start' }}>
                {GIT_STEPS.map((step) => {
                  const stepIdx = GIT_STEPS.indexOf(step);
                  const curIdx = GIT_STEPS.indexOf(progress.phase as typeof step);
                  const isDone = stepIdx < curIdx;
                  const isActive = stepIdx === curIdx;
                  const labels: Record<typeof step, string> = {
                    gitInit:   t('migration.phaseGitInit'),
                    gitAdd:    t('migration.phaseGitAdd'),
                    gitCommit: t('migration.phaseGitCommit'),
                  };
                  return (
                    <React.Fragment key={step}>
                      <span style={{ fontSize: 14, lineHeight: '16px' }}>
                        {isDone ? '\u2713' : isActive ? '\u25B6' : '\u25CB'}
                      </span>
                      <div>
                        <span style={{
                          color: isDone ? '#6c6' : isActive ? '#ddd' : '#666',
                          fontWeight: isActive ? 'bold' : 'normal',
                        }}>
                          {labels[step]}
                        </span>
                        {isActive && progress.detail && (
                          <span style={{ color: '#aaa', marginLeft: 8, fontSize: 11 }}>{progress.detail}</span>
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
            </div>
          )}

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
  );
}

// ─── Git warning popup ───
export function GitWarningOverlay({ onProceed, onCancel }: { onProceed: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="db-dialog-overlay" style={{ zIndex: 10001 }}>
      <div className="db-dialog" style={{ width: 420, height: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="db-dialog-header">{t('migration.gitWarningTitle')}</div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ color: '#fc6', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{t('migration.gitWarningMessage')}</p>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={onProceed} style={{ background: '#c44', borderColor: '#c44' }}>{t('migration.gitWarningProceed')}</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Rollback confirm popup ───
export function RollbackConfirmOverlay({ onProceed, onCancel }: { onProceed: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="db-dialog-overlay" style={{ zIndex: 10001 }}>
      <div className="db-dialog" style={{ width: 420, height: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="db-dialog-header">{t('migration.rollbackConfirmTitle')}</div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ color: '#fc6', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{t('migration.rollbackConfirmMessage')}</p>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={onProceed} style={{ background: '#c44', borderColor: '#c44' }}>{t('migration.rollbackConfirmProceed')}</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Rollback section (backup list) ───
export function RollbackSection({ backups, selectedBackup, setSelectedBackup, rollingBack, onRollbackClick }: {
  backups: MigrationBackup[];
  selectedBackup: string;
  setSelectedBackup: (hash: string) => void;
  rollingBack: boolean;
  onRollbackClick: () => void;
}) {
  const { t } = useTranslation();
  if (backups.length === 0) return null;
  return (
    <div style={{ margin: '12px 0 0 0', padding: '10px', background: '#333', borderRadius: 3, border: '1px solid #555' }}>
      <div style={{ color: '#ddd', fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>{t('migration.rollbackTitle')}</div>
      <p style={{ color: '#aaa', fontSize: 12, margin: '0 0 8px 0' }}>{t('migration.rollbackDescription')}</p>
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
        <button className="db-btn" onClick={onRollbackClick} disabled={!selectedBackup || rollingBack} style={{ background: '#c44', borderColor: '#c44' }}>
          {rollingBack ? t('migration.rollingBack') : t('migration.rollback')}
        </button>
      </div>
    </div>
  );
}

// ─── File table ───
export function MigrationFileTable({ files, selected, toggleFile, toggleAll, changedCount }: {
  files: { file: string; status: 'add' | 'update' | 'same'; editorSize?: number; projectSize?: number; editorMtime?: string; projectMtime?: string }[];
  selected: Set<string>;
  toggleFile: (file: string) => void;
  toggleAll: () => void;
  changedCount: number;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ border: '1px solid #555', borderRadius: 3, background: '#2b2b2b', maxHeight: 300, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #555', background: '#333' }}>
            <th style={{ padding: '6px 8px', textAlign: 'center', color: '#aaa', width: 30 }}>
              <input type="checkbox" checked={changedCount > 0 && selected.size === changedCount} onChange={toggleAll} />
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
                {f.status !== 'same' ? <input type="checkbox" checked={selected.has(f.file)} onChange={() => toggleFile(f.file)} /> : null}
              </td>
              <td style={{ padding: '4px 8px', color: f.status === 'same' ? '#888' : '#ddd' }}>{f.file}</td>
              <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                {f.status === 'add' && <span style={{ color: '#6c6', fontWeight: 'bold' }}>{t('migration.statusAdd')}</span>}
                {f.status === 'update' && <span style={{ color: '#fc6', fontWeight: 'bold' }}>{t('migration.statusUpdate')}</span>}
                {f.status === 'same' && <span style={{ color: '#888' }}>{t('migration.statusSame')}</span>}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#aaa' }}>{f.editorSize != null ? formatSize(f.editorSize) : '-'}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#aaa', fontSize: 11 }}>{f.editorMtime ? formatDate(f.editorMtime) : '-'}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#aaa' }}>{f.projectSize != null ? formatSize(f.projectSize) : '-'}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#aaa', fontSize: 11 }}>{f.projectMtime ? formatDate(f.projectMtime) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
