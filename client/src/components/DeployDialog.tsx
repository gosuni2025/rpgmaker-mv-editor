import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';
import FolderBrowser from './common/FolderBrowser';

type Platform = 'web' | 'windows' | 'macos';

export default function DeployDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowDeployDialog);
  useEscClose(useCallback(() => setShow(false), [setShow]));
  const projectPath = useEditorStore((s) => s.projectPath);
  const [platform, setPlatform] = useState<Platform>('web');
  const [excludeUnused, setExcludeUnused] = useState(true);
  const [outputPath, setOutputPath] = useState('');
  const [showBrowse, setShowBrowse] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const handleDeploy = async () => {
    if (!outputPath.trim()) {
      setError(t('deploy.pathRequired'));
      return;
    }
    setDeploying(true);
    setError('');
    setProgress(t('deploy.preparing'));
    try {
      await apiClient.post('/project/deploy', {
        platform,
        outputPath,
        excludeUnused,
        projectPath,
      });
      setProgress(t('deploy.complete'));
    } catch (e) {
      setError((e as Error).message);
      setProgress('');
    } finally {
      setDeploying(false);
    }
  };

  const platforms: { key: Platform; label: string; desc: string }[] = [
    { key: 'web', label: 'Web (HTML5)', desc: t('deploy.platformDesc.web') },
    { key: 'windows', label: 'Windows', desc: t('deploy.platformDesc.windows') },
    { key: 'macos', label: 'macOS', desc: t('deploy.platformDesc.macos') },
  ];

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 520, height: 'auto', minHeight: 0 }}>
        <div className="db-dialog-header">{t('deploy.title')}</div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8 }}>{t('deploy.platform')}</div>
            {platforms.map(p => (
              <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" name="platform" checked={platform === p.key}
                  onChange={() => setPlatform(p.key)} />
                <span style={{ color: '#ddd' }}>{p.label}</span>
                <span style={{ color: '#888', fontSize: 11 }}>— {p.desc}</span>
              </label>
            ))}
          </div>

          <div>
            <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8 }}>{t('deploy.options')}</div>
            <label className="db-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={excludeUnused}
                onChange={e => setExcludeUnused(e.target.checked)} />
              <span style={{ color: '#ddd' }}>{t('deploy.excludeUnused')}</span>
            </label>
          </div>

          <div>
            <span style={{ color: '#aaa', fontSize: 12 }}>{t('deploy.outputPath')}</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input type="text" value={outputPath} readOnly
                style={{ flex: 1, background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '6px 8px', color: '#ddd', fontSize: 13 }} />
              <button className="db-btn" onClick={() => setShowBrowse(true)}>{t('deploy.browse')}</button>
            </div>
          </div>

          {showBrowse && (
            <FolderBrowser
              onSelect={(path) => { setOutputPath(path); setShowBrowse(false); }}
              style={{ border: '1px solid #555', borderRadius: 3, background: '#333', maxHeight: 250 }}
            />
          )}

          {progress && <div style={{ color: '#6c6', fontSize: 12 }}>{progress}</div>}
          {error && <div style={{ color: '#e55', fontSize: 12 }}>{error}</div>}
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleDeploy} disabled={deploying}
            style={{ background: '#0078d4', borderColor: '#0078d4' }}>
            {deploying ? t('deploy.deploying') : t('deploy.deploy')}
          </button>
          <button className="db-btn" onClick={() => setShow(false)}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
