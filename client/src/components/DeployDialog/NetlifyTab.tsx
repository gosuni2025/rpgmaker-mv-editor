import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CacheBustOpts, cacheBustToQuery } from '../common/CacheBustSection';
import apiClient from '../../api/client';
import { SSEEvent } from './types';
import { readSSEStream } from './sseUtils';
import useDeployProgress from './useDeployProgress';
import { DeployProgressModal } from './StatusWidgets';

interface Props {
  cbOpts: CacheBustOpts;
  initialApiKey: string;
  initialSiteId: string;
  initialSiteUrl: string;
}

export default function NetlifyTab({ cbOpts, initialApiKey, initialSiteId, initialSiteUrl }: Props) {
  const { t } = useTranslation();
  const dp = useDeployProgress();

  const [apiKey, setApiKey] = useState(initialApiKey);
  const [siteId, setSiteId] = useState(initialSiteId);
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl);
  const [manualSiteId, setManualSiteId] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [deployUrl, setDeployUrl] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [deployMode, setDeployMode] = useState<'zip' | 'netlify'>('netlify');
  const [bundle, setBundle] = useState(true);

  const handleSSEEventWithSiteId = useCallback(
    (ev: SSEEvent, totalRef: { current: number }, weights: { copy: number; zip: number }): boolean => {
      if (ev.type === 'site-created') {
        setSiteId(ev.siteId);
      }
      return dp.handleSSEEvent(ev, totalRef, weights);
    },
    [dp.handleSSEEvent],
  );

  const saveSettings = async () => {
    try {
      await apiClient.put('/project/netlify-settings', { apiKey, siteId });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) { dp.setError((e as Error).message); }
  };

  const handleMakeZip = () => {
    dp.resetStatus();
    setDeployUrl('');
    dp.setProgress(0);
    dp.setStatus(t('deploy.netlify.analyzing'));
    dp.setBusy(true);
    setDeployMode('zip');
    setShowProgressModal(true);
    let completed = false;
    const totalRef = { current: 0 };
    const params = new URLSearchParams(cacheBustToQuery(cbOpts));
    if (bundle) params.set('bundle', '1');
    const evtSource = new EventSource(`/api/project/deploy-zip-progress?${params}`);
    evtSource.onmessage = (e) => {
      const ev = JSON.parse(e.data) as SSEEvent;
      if (ev.type === 'done') {
        completed = true;
        dp.setProgress(1);
        dp.setStatus(t('deploy.netlify.zipDone'));
        dp.setBusy(false);
        evtSource.close();
        return;
      }
      if (!handleSSEEventWithSiteId(ev, totalRef, { copy: 0.75, zip: 0.25 })) {
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

  const handleAutoDeploy = async () => {
    if (!apiKey.trim()) { dp.setError(t('deploy.netlify.apiKeyRequired')); return; }
    dp.resetStatus();
    setDeployUrl('');
    dp.setProgress(0);
    dp.setStatus(t('deploy.netlify.analyzing'));
    dp.setBusy(true);
    setDeployMode('netlify');
    setShowProgressModal(true);
    const totalRef = { current: 0 };
    try {
      await readSSEStream(
        '/api/project/deploy-netlify-progress',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: apiKey.trim(),
            siteId: manualSiteId ? siteId.trim() : siteId,
            cacheBust: { ...cbOpts, bundle },
          }),
        },
        (ev) => {
          if (ev.type === 'done') {
            dp.setProgress(1);
            dp.setStatus(t('deploy.netlify.deployDone'));
            setDeployUrl(ev.deployUrl || '');
            if (ev.siteUrl) setSiteUrl(ev.siteUrl);
            return false;
          }
          return handleSSEEventWithSiteId(ev, totalRef, { copy: 0.55, zip: 0.1 });
        },
      );
    } catch (e) {
      dp.setError((e as Error).message);
      dp.setStatus(''); dp.setProgress(null);
    } finally {
      dp.setBusy(false);
    }
  };

  const openUrl = async (url: string) => {
    try { await apiClient.post('/project/open-url', { url }); }
    catch (e) { dp.setError((e as Error).message); }
  };

  const guideSteps = [
    t('deploy.netlify.guide1'),
    t('deploy.netlify.guide2'),
    t('deploy.netlify.guide3'),
    t('deploy.netlify.guide4'),
    t('deploy.netlify.guide5'),
  ];

  return (
    <>
      <div className="deploy-info-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ color: '#777', fontSize: 11, lineHeight: 1.4 }}>{t('deploy.netlify.disclaimer')}</span>
        <button className="db-btn" onClick={() => openUrl('https://www.netlify.com')} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          {t('deploy.netlify.visitSite')} ↗
        </button>
      </div>

      <div className="deploy-settings-box">
        <div style={{ color: '#bbb', fontSize: 12, fontWeight: 600 }}>{t('deploy.netlify.settingsTitle')}</div>
        <div>
          <div className="deploy-field-label">{t('deploy.netlify.apiKey')}</div>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('deploy.netlify.apiKeyPlaceholder')} className="deploy-input" />
          <div className="deploy-security-note">
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('deploy.netlify.securityTitle')}</div>
            <div>· {t('deploy.netlify.security1')}</div>
            <div>· {t('deploy.netlify.security2')}</div>
            <div>· {t('deploy.netlify.security3')}</div>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="deploy-field-label">Site ID</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <input type="checkbox" checked={manualSiteId} onChange={(e) => setManualSiteId(e.target.checked)} />
              <span style={{ color: '#888', fontSize: 11 }}>{t('deploy.netlify.siteManualInput')}</span>
            </label>
          </div>
          {manualSiteId ? (
            <input type="text" value={siteId} onChange={(e) => setSiteId(e.target.value)}
              placeholder={t('deploy.netlify.siteIdPlaceholder')} className="deploy-input" />
          ) : (
            <div className="deploy-site-status">
              {siteId
                ? <span style={{ color: '#6c6' }}>✓ {t('deploy.netlify.siteConnected')}: <code style={{ fontSize: 11, color: '#aaa' }}>{siteId.slice(0, 8)}…</code></span>
                : <span style={{ color: '#777' }}>{t('deploy.netlify.siteAutoDesc')}</span>
              }
            </div>
          )}
          {siteUrl && !deployUrl && (
            <button className="db-btn" onClick={() => openUrl(siteUrl)} style={{ marginTop: 6, width: '100%' }}>
              {t('deploy.netlify.openSite')} ↗
            </button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          {settingsSaved && <span style={{ color: '#6c6', fontSize: 12 }}>{t('deploy.netlify.saved')}</span>}
          <button className="db-btn" onClick={saveSettings}>{t('common.save')}</button>
        </div>
      </div>

      <div style={{ border: '1px solid #444', borderRadius: 4, overflow: 'hidden' }}>
        <button onClick={() => setGuideOpen(!guideOpen)} className="deploy-guide-toggle">
          <span>{t('deploy.netlify.guideTitle')}</span>
          <span style={{ fontSize: 10 }}>{guideOpen ? '▲' : '▼'}</span>
        </button>
        {guideOpen && (
          <div style={{ padding: '10px 12px', background: '#252525' }}>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {guideSteps.map((step, i) => (
                <li key={i} style={{ color: '#ccc', fontSize: 12, lineHeight: 1.6 }}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* 번들링 옵션 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={bundle} onChange={(e) => setBundle(e.target.checked)} />
          SW 번들링 (img/audio/data → ZIP)
        </label>
      </div>

      <div>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 6 }}>수동 업로드</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="db-btn" onClick={handleMakeZip} disabled={dp.busy} style={{ flex: 1 }}>
            {t('deploy.netlify.makeZip')}
          </button>
          <button className="db-btn" onClick={() => apiClient.post('/project/open-netlify-drop', {}).catch((e) => dp.setError((e as Error).message))} disabled={dp.busy} style={{ flex: 1 }}>
            {t('deploy.netlify.openDrop')}
          </button>
        </div>
      </div>

      <button className="db-btn" onClick={handleAutoDeploy} disabled={dp.busy}
        style={{ width: '100%', background: '#0078d4', borderColor: '#0078d4' }}>
        {t('deploy.netlify.autoDeploy')}
      </button>

      {deployUrl && (
        <div className="deploy-result-box">
          <div style={{ color: '#6c6', fontSize: 11, marginBottom: 4 }}>{t('deploy.netlify.deployUrl')}</div>
          <a href={deployUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#5af', fontSize: 13, wordBreak: 'break-all' }}>{deployUrl}</a>
          <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>{t('deploy.netlify.deployUrlDesc')}</div>
          <button className="db-btn" onClick={() => openUrl(deployUrl || siteUrl)}
            style={{ marginTop: 8, width: '100%', background: '#0e5f1f', borderColor: '#1a8a30' }}>
            {t('deploy.netlify.openSite')} ↗
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
        color="#2675bf"
        titleBusy={deployMode === 'zip' ? 'ZIP 생성 중...' : 'Netlify 배포 중...'}
        titleDone={deployMode === 'zip' ? 'ZIP 생성 완료' : 'Netlify 배포 완료'}
        titleFailed={deployMode === 'zip' ? 'ZIP 생성 실패' : 'Netlify 배포 실패'}
        resultUrl={deployMode === 'netlify' ? deployUrl : ''}
        resultLabel={t('deploy.netlify.openSite')}
        resultButtonStyle={{ background: '#0e5f1f', borderColor: '#1a8a30' }}
        onResultClick={() => openUrl(deployUrl || siteUrl)}
        onClose={() => setShowProgressModal(false)}
      />
    </>
  );
}
