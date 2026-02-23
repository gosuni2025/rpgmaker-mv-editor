import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CacheBustOpts } from '../common/CacheBustSection';
import apiClient from '../../api/client';
import FolderBrowser from '../common/FolderBrowser';
import useDeployProgress from './useDeployProgress';
import { StatusMessage, ErrorMessage } from './StatusWidgets';

interface Props {
  cbOpts: CacheBustOpts;
  syncRuntime: boolean;
}

export default function LocalTab({ cbOpts, syncRuntime }: Props) {
  const { t } = useTranslation();
  const dp = useDeployProgress();

  const [outputPath, setOutputPath] = useState('');
  const [showBrowse, setShowBrowse] = useState(false);
  const [browsePath, setBrowsePath] = useState('');

  const handleDeploy = async () => {
    if (!outputPath.trim()) { dp.setError(t('deploy.pathRequired')); return; }
    dp.resetStatus();
    dp.setStatus(t('deploy.preparing'));
    dp.setBusy(true);
    try {
      if (syncRuntime) await apiClient.post('/project/sync-runtime', {});
      await apiClient.post('/project/deploy', { platform: 'web', outputPath, cacheBust: cbOpts });
      dp.setStatus(t('deploy.complete'));
    } catch (e) {
      dp.setError((e as Error).message); dp.setStatus('');
    } finally {
      dp.setBusy(false);
    }
  };

  return (
    <>
      <div>
        <div className="deploy-field-label">{t('deploy.outputPath')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={outputPath} readOnly
            className="deploy-input" style={{ fontFamily: undefined, flex: 1, width: 'auto' }} />
          <button className="db-btn" onClick={() => setShowBrowse(true)}>{t('deploy.browse')}</button>
        </div>
      </div>

      <StatusMessage status={dp.status} />
      <ErrorMessage error={dp.error} />

      <div className="deploy-local-footer">
        <button className="db-btn" onClick={handleDeploy} disabled={dp.busy}
          style={{ background: '#0078d4', borderColor: '#0078d4' }}>
          {dp.busy ? t('deploy.deploying') : t('deploy.deploy')}
        </button>
      </div>

      {showBrowse && (
        <div className="db-dialog-overlay" style={{ zIndex: 1001 }}>
          <div className="db-dialog" style={{ width: 500, height: 420, display: 'flex', flexDirection: 'column' }}>
            <div className="db-dialog-header">{t('deploy.outputPath')}</div>
            <FolderBrowser
              onPathChange={(p) => setBrowsePath(p)}
              onSelect={(p) => { setOutputPath(p); setShowBrowse(false); }}
              style={{ flex: 1, overflow: 'hidden' }}
              toolbarExtra={<>
                <button className="db-btn-small" style={{ background: '#0078d4', borderColor: '#0078d4' }}
                  onClick={() => { if (browsePath) { setOutputPath(browsePath); setShowBrowse(false); } }}
                  disabled={!browsePath}>
                  {t('deploy.selectFolder')}
                </button>
                <button className="db-btn-small" onClick={() => setShowBrowse(false)}>{t('common.cancel')}</button>
              </>}
            />
          </div>
        </div>
      )}
    </>
  );
}
