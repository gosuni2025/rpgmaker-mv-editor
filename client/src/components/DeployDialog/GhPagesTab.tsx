import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CacheBustOpts, cacheBustToQuery } from '../common/CacheBustSection';
import apiClient from '../../api/client';
import { SSEEvent, GhPagesCheck } from './types';
import useDeployProgress from './useDeployProgress';
import { DeployProgressModal } from './StatusWidgets';

interface Props {
  cbOpts: CacheBustOpts;
  initialRemote: string;
}

export default function GhPagesTab({ cbOpts, initialRemote }: Props) {
  const { t } = useTranslation();
  const dp = useDeployProgress();

  const [ghRemote, setGhRemote] = useState(initialRemote);
  const [ghCheck, setGhCheck] = useState<GhPagesCheck | null>(null);
  const [ghSettingsSaved, setGhSettingsSaved] = useState(false);
  const [ghPageUrl, setGhPageUrl] = useState('');
  const [ghBuildId, setGhBuildId] = useState('');
  const [ghCommitHash, setGhCommitHash] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const ghCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runGhCheck = useCallback(() => {
    if (ghCheckTimer.current) clearTimeout(ghCheckTimer.current);
    ghCheckTimer.current = setTimeout(async () => {
      try {
        const result = await apiClient.get('/project/deploy-ghpages-check') as GhPagesCheck;
        setGhCheck(result);
        if (result.pageUrl) setGhPageUrl(result.pageUrl);
        if (result.selectedRemote) setGhRemote(result.selectedRemote);
      } catch {}
    }, 300);
  }, []);

  useEffect(() => { runGhCheck(); }, [runGhCheck]);

  const saveSettings = async () => {
    try {
      await apiClient.put('/project/ghpages-settings', { remote: ghRemote });
      setGhSettingsSaved(true);
      setTimeout(() => setGhSettingsSaved(false), 2000);
      runGhCheck();
    } catch (e) { dp.setError((e as Error).message); }
  };

  const handleDeploy = () => {
    dp.resetStatus();
    dp.setProgress(0);
    dp.setBusy(true);
    setShowProgressModal(true);
    let completed = false;
    const totalRef = { current: 0 };
    const params = new URLSearchParams(cacheBustToQuery(cbOpts));
    if (ghRemote) params.set('remote', ghRemote);
    const evtSource = new EventSource(`/api/project/deploy-ghpages-progress?${params}`);
    evtSource.onmessage = (e) => {
      const ev = JSON.parse(e.data) as SSEEvent;
      if (ev.type === 'done') {
        completed = true;
        dp.setProgress(1);
        dp.setStatus(t('deploy.ghPages.done'));
        if (ev.pageUrl) setGhPageUrl(ev.pageUrl);
        if (ev.buildId) setGhBuildId(ev.buildId);
        if (ev.commitHash) setGhCommitHash(ev.commitHash);
        dp.setBusy(false);
        evtSource.close();
        return;
      }
      if (!dp.handleSSEEvent(ev, totalRef, { copy: 0.85, zip: 0 })) {
        completed = true;
        evtSource.close();
      }
    };
    evtSource.onerror = () => {
      evtSource.close();
      if (!completed) {
        dp.setError(t('deploy.netlify.connectionError'));
        dp.setStatus(''); dp.setProgress(null); dp.setBusy(false);
      }
    };
  };

  const openUrl = async (url: string) => {
    try { await apiClient.post('/project/open-url', { url }); }
    catch (e) { dp.setError((e as Error).message); }
  };

  const ghSelectedRemoteExists = ghCheck?.remotes.some(r => r.name === ghRemote) ?? false;
  const ghPrereqOk = (ghCheck?.ghCli ?? false) && (ghCheck?.isGitRepo ?? false) && ghSelectedRemoteExists;

  const CheckBadge = ({ ok, label, warn }: { ok: boolean; label: string; warn?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={!ok && warn ? warn : ''}>
      <span style={{ color: ok ? '#6c6' : '#e55', fontSize: 12 }}>{ok ? '✓' : '✗'}</span>
      <span style={{ color: ok ? '#aaa' : '#e77', fontSize: 12 }}>{label}</span>
    </div>
  );

  return (
    <>
      <div className="deploy-howit-box">
        <div style={{ fontWeight: 600, color: '#aed6ae', marginBottom: 4 }}>{t('deploy.ghPages.howItWorks')}</div>
        <div>· {t('deploy.ghPages.howStep1')}</div>
        <div>· {t('deploy.ghPages.howStep2')}</div>
        <div>· {t('deploy.ghPages.howStep3')}</div>
        <div style={{ marginTop: 4, color: '#e8a040' }}>⚠ {t('deploy.ghPages.indexNote')}</div>
      </div>

      <div className="deploy-settings-box">
        <div>
          <div className="deploy-field-label">{t('deploy.ghPages.remote')}</div>
          {ghCheck && ghCheck.remotes.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={ghRemote} onChange={(e) => setGhRemote(e.target.value)}
                className="deploy-input" style={{ flex: 1, width: 'auto' }}>
                {ghCheck.remotes.map(r => (
                  <option key={r.name} value={r.name}>{r.name}  ({r.url})</option>
                ))}
              </select>
            </div>
          ) : (
            <input type="text" value={ghRemote} onChange={(e) => setGhRemote(e.target.value)}
              placeholder="pages" className="deploy-input" />
          )}
          {ghCheck?.remotes.find(r => r.name === ghRemote)?.pageUrl && (
            <div style={{ marginTop: 5, fontSize: 11, color: '#5af' }}>
              → {ghCheck.remotes.find(r => r.name === ghRemote)!.pageUrl}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          {ghSettingsSaved && <span style={{ color: '#6c6', fontSize: 12 }}>{t('deploy.ghPages.settingsSaved')}</span>}
          <button className="db-btn" onClick={saveSettings}>{t('common.save')}</button>
        </div>
      </div>

      <div className="deploy-info-box" style={{ padding: '10px 12px' }}>
        <div style={{ color: '#bbb', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{t('deploy.ghPages.prerequisites')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <CheckBadge ok={ghCheck?.ghCli ?? false} label={t('deploy.ghPages.checkGhCli')} warn={t('deploy.ghPages.ghCliMissing')} />
          <CheckBadge ok={ghCheck?.isGitRepo ?? false} label={t('deploy.ghPages.checkGitRepo')} warn={t('deploy.ghPages.notGitRepo')} />
          <CheckBadge ok={ghSelectedRemoteExists} label={t('deploy.ghPages.checkRemote', { remote: ghRemote })} warn={t('deploy.ghPages.remoteMissing', { remote: ghRemote })} />
        </div>
        {!ghCheck?.ghCli && ghCheck !== null && (
          <div style={{ marginTop: 8, color: '#e77', fontSize: 11 }}>{t('deploy.ghPages.ghCliMissing')}</div>
        )}
      </div>

      <button className="db-btn" onClick={handleDeploy} disabled={dp.busy || !ghPrereqOk}
        style={{
          width: '100%',
          background: ghPrereqOk ? '#1a6e2e' : undefined,
          borderColor: ghPrereqOk ? '#2a9a42' : undefined,
          opacity: ghPrereqOk ? 1 : 0.5,
        }}>
        {t('deploy.ghPages.deploy')}
      </button>

      {(ghPageUrl || ghCheck?.pageUrl) && (
        <div className="deploy-result-box" style={{ background: '#1e2e1e', borderColor: '#2a4a2a' }}>
          <div style={{ color: '#6c6', fontSize: 11, marginBottom: 4 }}>{t('deploy.ghPages.pageUrl')}</div>
          <a href={ghPageUrl || ghCheck?.pageUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: '#5af', fontSize: 13, wordBreak: 'break-all' }}>
            {ghPageUrl || ghCheck?.pageUrl}
          </a>
          {(ghBuildId || ghCommitHash) && (
            <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {ghBuildId && (
                <span style={{ color: '#888', fontSize: 11 }}>
                  빌드: <code style={{ color: '#aaa', fontFamily: 'monospace' }}>{ghBuildId}</code>
                </span>
              )}
              {ghCommitHash && (
                <span style={{ color: '#888', fontSize: 11 }}>
                  커밋: <code style={{ color: '#aaa', fontFamily: 'monospace' }}>{ghCommitHash}</code>
                </span>
              )}
            </div>
          )}
          <button className="db-btn" onClick={() => openUrl(ghPageUrl || ghCheck?.pageUrl || '')}
            style={{ marginTop: 8, width: '100%', background: '#0e5f1f', borderColor: '#1a8a30' }}>
            {t('deploy.ghPages.openPage')}
          </button>
        </div>
      )}

      <DeployProgressModal
        show={showProgressModal}
        busy={dp.busy}
        logs={dp.logs}
        status={dp.status}
        error={dp.error}
        progress={dp.progress}
        color="#2a9a42"
        titleBusy="배포 진행 중..."
        titleDone="배포 완료"
        titleFailed="배포 실패"
        resultUrl={ghPageUrl}
        resultLabel="페이지 열기"
        resultButtonStyle={{ background: '#0e5f1f', borderColor: '#1a8a30' }}
        onResultClick={() => openUrl(ghPageUrl)}
        onClose={() => setShowProgressModal(false)}
      />
    </>
  );
}
