import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';
import FolderBrowser from './common/FolderBrowser';

type Tab = 'netlify' | 'local';

type SSEEvent =
  | { type: 'status'; phase: 'counting' | 'zipping' | 'uploading' | 'creating-site' }
  | { type: 'counted'; total: number }
  | { type: 'progress'; current: number; total: number }
  | { type: 'zip-progress'; current: number; total: number; name: string }
  | { type: 'upload-progress'; sent: number; total: number }
  | { type: 'site-created'; siteId: string; siteName: string }
  | { type: 'done'; zipPath?: string; deployUrl?: string; siteUrl?: string }
  | { type: 'error'; message: string };

interface CacheBustOpts {
  scripts: boolean;
  images:  boolean;
  audio:   boolean;
  video:   boolean;
  data:    boolean;
}

const CB_KEYS = ['scripts', 'images', 'audio', 'video', 'data'] as const;

async function readSSEStream(
  url: string,
  options: RequestInit,
  onEvent: (data: SSEEvent) => boolean,
): Promise<void> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try { msg = ((await response.json()) as { error?: string }).error || msg; } catch {}
    throw new Error(msg);
  }
  if (!response.body) throw new Error('No response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            if (!onEvent(JSON.parse(line.slice(6)) as SSEEvent)) return;
          } catch {}
        }
      }
    }
  }
}

export default function DeployDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowDeployDialog);
  useEscClose(useCallback(() => setShow(false), [setShow]));

  const [tab, setTab] = useState<Tab>('netlify');

  // Netlify 설정
  const [apiKey, setApiKey] = useState('');
  const [siteId, setSiteId] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [manualSiteId, setManualSiteId] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // 작업 상태
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [deployUrl, setDeployUrl] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [zipFile, setZipFile] = useState('');

  // 로컬 배포
  const [outputPath, setOutputPath] = useState('');
  const [showBrowse, setShowBrowse] = useState(false);
  const [browsePath, setBrowsePath] = useState('');

  const [guideOpen, setGuideOpen] = useState(false);

  // 캐시 버스팅 옵션
  const [cbOpts, setCbOpts] = useState<CacheBustOpts>({
    scripts: true,
    images:  true,
    audio:   true,
    video:   true,
    data:    true,
  });
  const [cbHelpOpen, setCbHelpOpen] = useState(false);

  useEffect(() => {
    apiClient.get('/settings').then((data) => {
      const d = data as Record<string, unknown>;
      const netlify = d.netlify as { apiKey?: string; siteId?: string; siteUrl?: string } | undefined;
      if (netlify?.apiKey) setApiKey(netlify.apiKey);
      if (netlify?.siteId) setSiteId(netlify.siteId);
      if (netlify?.siteUrl) setSiteUrl(netlify.siteUrl);
    }).catch(() => {});
  }, []);

  const resetStatus = () => { setError(''); setStatus(''); setDeployUrl(''); setProgress(null); setZipFile(''); };

  const handleOpenMySite = async () => {
    const url = deployUrl || siteUrl;
    if (!url) return;
    try { await apiClient.post('/project/open-url', { url }); }
    catch (e) { setError((e as Error).message); }
  };

  const saveNetlifySettings = async () => {
    try {
      await apiClient.put('/project/netlify-settings', { apiKey, siteId });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSSEEvent = useCallback(
    (ev: SSEEvent, totalRef: { current: number }, weights: { copy: number; zip: number }): boolean => {
      const uploadStart = weights.copy + weights.zip;
      if (ev.type === 'status') {
        if (ev.phase === 'creating-site') setStatus(t('deploy.netlify.creatingSite'));
        if (ev.phase === 'counting') setStatus(t('deploy.netlify.analyzing'));
        if (ev.phase === 'zipping') { setProgress(weights.copy); setStatus(t('deploy.netlify.zipping')); }
        if (ev.phase === 'uploading') { setProgress(uploadStart); setStatus(t('deploy.netlify.uploading')); }
      } else if (ev.type === 'site-created') {
        setSiteId(ev.siteId);
        setStatus(`${t('deploy.netlify.siteCreatedMsg')}: ${ev.siteName}.netlify.app`);
      } else if (ev.type === 'counted') {
        totalRef.current = ev.total;
        setStatus(`${t('deploy.netlify.copying')} (0/${ev.total})`);
        setProgress(0);
      } else if (ev.type === 'progress') {
        setProgress((ev.current / Math.max(totalRef.current, 1)) * weights.copy);
        setStatus(`${t('deploy.netlify.copying')} (${ev.current}/${totalRef.current})`);
      } else if (ev.type === 'zip-progress') {
        const pct = ev.current / Math.max(ev.total, 1);
        setProgress(weights.copy + pct * weights.zip);
        setStatus(`${t('deploy.netlify.zipping')} (${ev.current}/${ev.total})`);
        if (ev.name) setZipFile(ev.name);
      } else if (ev.type === 'upload-progress') {
        const pct = ev.sent / Math.max(ev.total, 1);
        setProgress(uploadStart + pct * (1 - uploadStart));
        const sentMb = (ev.sent / 1048576).toFixed(1);
        const totalMb = (ev.total / 1048576).toFixed(1);
        setStatus(`${t('deploy.netlify.uploading')} (${sentMb} / ${totalMb} MB)`);
      } else if (ev.type === 'error') {
        setError(ev.message);
        setStatus('');
        setProgress(null);
        setBusy(false);
        return false;
      }
      return true;
    },
    [t],
  );

  // 캐시 버스팅 옵션을 query string으로 변환
  const cbQuery = () => {
    const p = new URLSearchParams();
    for (const key of CB_KEYS) p.set(`cb${key.charAt(0).toUpperCase()}${key.slice(1)}`, cbOpts[key] ? '1' : '0');
    return p.toString();
  };

  const handleMakeZip = () => {
    resetStatus();
    setProgress(0);
    setStatus(t('deploy.netlify.analyzing'));
    setBusy(true);
    let completed = false;
    const totalRef = { current: 0 };
    const evtSource = new EventSource(`/api/project/deploy-zip-progress?${cbQuery()}`);
    evtSource.onmessage = (e) => {
      const ev = JSON.parse(e.data) as SSEEvent;
      if (ev.type === 'done') {
        completed = true;
        setProgress(1);
        setStatus(t('deploy.netlify.zipDone'));
        setBusy(false);
        setTimeout(() => setProgress(null), 800);
        evtSource.close();
        return;
      }
      handleSSEEvent(ev, totalRef, { copy: 0.75, zip: 0.25 });
    };
    evtSource.onerror = () => {
      evtSource.close();
      if (!completed) {
        setError(t('deploy.netlify.connectionError'));
        setStatus('');
        setProgress(null);
        setBusy(false);
      }
    };
  };

  const handleOpenDrop = async () => {
    try { await apiClient.post('/project/open-netlify-drop', {}); }
    catch (e) { setError((e as Error).message); }
  };

  const handleOpenNetlifySite = async () => {
    try { await apiClient.post('/project/open-url', { url: 'https://www.netlify.com' }); }
    catch (e) { setError((e as Error).message); }
  };

  const handleAutoDeploy = async () => {
    if (!apiKey.trim()) { setError(t('deploy.netlify.apiKeyRequired')); return; }
    resetStatus();
    setProgress(0);
    setStatus(t('deploy.netlify.analyzing'));
    setBusy(true);
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
            cacheBust: cbOpts,
          }),
        },
        (ev) => {
          if (ev.type === 'done') {
            setProgress(1);
            setStatus(t('deploy.netlify.deployDone'));
            setDeployUrl(ev.deployUrl || '');
            if (ev.siteUrl) setSiteUrl(ev.siteUrl);
            setTimeout(() => setProgress(null), 800);
            return false;
          }
          return handleSSEEvent(ev, totalRef, { copy: 0.55, zip: 0.1 });
        },
      );
    } catch (e) {
      setError((e as Error).message);
      setStatus('');
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const handleLocalDeploy = async () => {
    if (!outputPath.trim()) { setError(t('deploy.pathRequired')); return; }
    resetStatus();
    setStatus(t('deploy.preparing'));
    setBusy(true);
    try {
      await apiClient.post('/project/deploy', { platform: 'web', outputPath, cacheBust: cbOpts });
      setStatus(t('deploy.complete'));
    } catch (e) {
      setError((e as Error).message);
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    background: active ? '#3c3f41' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #2675bf' : '2px solid transparent',
    color: active ? '#ddd' : '#888',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
  });

  const fieldLabel: React.CSSProperties = { color: '#aaa', fontSize: 11, marginBottom: 4 };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: '#2b2b2b',
    border: '1px solid #555',
    borderRadius: 3,
    padding: '5px 8px',
    color: '#ddd',
    fontSize: 13,
    fontFamily: 'monospace',
  };

  const guideSteps = [
    t('deploy.netlify.guide1'),
    t('deploy.netlify.guide2'),
    t('deploy.netlify.guide3'),
    t('deploy.netlify.guide4'),
    t('deploy.netlify.guide5'),
  ];

  // 캐시 버스팅 옵션 섹션 (두 탭 공통)
  const cacheBustSection = (
    <div style={{ background: '#2e2e2e', border: '1px solid #3e3e3e', borderRadius: 4, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: cbHelpOpen ? 8 : 6 }}>
        <span style={{ color: '#bbb', fontSize: 12, fontWeight: 600 }}>{t('deploy.cacheBust.title')}</span>
        <button
          onClick={() => setCbHelpOpen(!cbHelpOpen)}
          title={t('deploy.cacheBust.helpTitle')}
          style={{
            background: cbHelpOpen ? '#2675bf' : '#444',
            border: '1px solid #555',
            borderRadius: '50%',
            width: 16,
            height: 16,
            color: '#ddd',
            fontSize: 10,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >?</button>
      </div>

      {cbHelpOpen && (
        <div style={{
          background: '#252525',
          border: '1px solid #3a3a3a',
          borderRadius: 3,
          padding: '8px 10px',
          marginBottom: 8,
          fontSize: 11,
          color: '#aaa',
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, color: '#ccc', marginBottom: 2 }}>{t('deploy.cacheBust.helpTitle')}</div>
          <div>{t('deploy.cacheBust.helpDesc')}</div>
          <div style={{ marginTop: 4, color: '#e8a040' }}>⚠ {t('deploy.cacheBust.helpDisabled')}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 18px' }}>
        {CB_KEYS.map((key) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={cbOpts[key]}
              onChange={(e) => setCbOpts((prev) => ({ ...prev, [key]: e.target.checked }))}
            />
            <span style={{ color: '#ccc', fontSize: 12 }}>{t(`deploy.cacheBust.${key}`)}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 560, height: 'auto', minHeight: 0 }}>
        <div className="db-dialog-header">{t('deploy.title')}</div>

        <div style={{ display: 'flex', borderBottom: '1px solid #444', paddingTop: 4 }}>
          <button style={tabStyle(tab === 'netlify')} onClick={() => { setTab('netlify'); resetStatus(); }}>
            {t('deploy.tabNetlify')}
          </button>
          <button style={tabStyle(tab === 'local')} onClick={() => { setTab('local'); resetStatus(); }}>
            {t('deploy.tabLocal')}
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {tab === 'netlify' && (
            <>
              {/* 면책 고지 */}
              <div style={{ background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: 4, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: '#777', fontSize: 11, lineHeight: 1.4 }}>
                  {t('deploy.netlify.disclaimer')}
                </span>
                <button className="db-btn" onClick={handleOpenNetlifySite} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {t('deploy.netlify.visitSite')} ↗
                </button>
              </div>

              {/* 설정 */}
              <div style={{ background: '#333', borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ color: '#bbb', fontSize: 12, fontWeight: 600 }}>{t('deploy.netlify.settingsTitle')}</div>

                {/* API Key */}
                <div>
                  <div style={fieldLabel}>{t('deploy.netlify.apiKey')}</div>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t('deploy.netlify.apiKeyPlaceholder')} style={inputStyle} />
                  <div style={{ marginTop: 6, background: '#1e2a1e', border: '1px solid #2a3a2a', borderRadius: 3, padding: '7px 10px', fontSize: 11, color: '#7a9a7a', lineHeight: 1.7 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('deploy.netlify.securityTitle')}</div>
                    <div>· {t('deploy.netlify.security1')}</div>
                    <div>· {t('deploy.netlify.security2')}</div>
                    <div>· {t('deploy.netlify.security3')}</div>
                  </div>
                </div>

                {/* Site ID - 자동/수동 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={fieldLabel}>Site ID</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={manualSiteId}
                        onChange={(e) => setManualSiteId(e.target.checked)} />
                      <span style={{ color: '#888', fontSize: 11 }}>{t('deploy.netlify.siteManualInput')}</span>
                    </label>
                  </div>

                  {manualSiteId ? (
                    <input type="text" value={siteId} onChange={(e) => setSiteId(e.target.value)}
                      placeholder={t('deploy.netlify.siteIdPlaceholder')} style={inputStyle} />
                  ) : (
                    <div style={{ padding: '5px 8px', background: '#2b2b2b', border: '1px solid #444', borderRadius: 3, fontSize: 12 }}>
                      {siteId
                        ? <span style={{ color: '#6c6' }}>✓ {t('deploy.netlify.siteConnected')}: <code style={{ fontSize: 11, color: '#aaa' }}>{siteId.slice(0, 8)}…</code></span>
                        : <span style={{ color: '#777' }}>{t('deploy.netlify.siteAutoDesc')}</span>
                      }
                    </div>
                  )}

                  {siteUrl && !deployUrl && (
                    <button className="db-btn" onClick={handleOpenMySite}
                      style={{ marginTop: 6, width: '100%' }}>
                      {t('deploy.netlify.openSite')} ↗
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                  {settingsSaved && <span style={{ color: '#6c6', fontSize: 12 }}>{t('deploy.netlify.saved')}</span>}
                  <button className="db-btn" onClick={saveNetlifySettings}>{t('common.save')}</button>
                </div>
              </div>

              {/* 가이드 */}
              <div style={{ border: '1px solid #444', borderRadius: 4, overflow: 'hidden' }}>
                <button onClick={() => setGuideOpen(!guideOpen)} style={{
                  width: '100%', background: '#2e2e2e', border: 'none', padding: '8px 12px',
                  color: '#aaa', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
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

              {/* 수동 업로드 */}
              <div>
                <div style={{ color: '#666', fontSize: 11, marginBottom: 6 }}>수동 업로드</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="db-btn" onClick={handleMakeZip} disabled={busy} style={{ flex: 1 }}>
                    {t('deploy.netlify.makeZip')}
                  </button>
                  <button className="db-btn" onClick={handleOpenDrop} disabled={busy} style={{ flex: 1 }}>
                    {t('deploy.netlify.openDrop')}
                  </button>
                </div>
              </div>

              {/* 자동 배포 */}
              <button className="db-btn" onClick={handleAutoDeploy} disabled={busy}
                style={{ width: '100%', background: '#0078d4', borderColor: '#0078d4' }}>
                {t('deploy.netlify.autoDeploy')}
              </button>

              {/* 프로그레스 바 */}
              {progress !== null && (
                <div style={{ background: '#3a3a3a', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: '#2675bf', transition: 'width 0.15s ease-out' }} />
                </div>
              )}

              {status && <div style={{ color: '#6c6', fontSize: 12 }}>{status}</div>}
              {zipFile && !deployUrl && (
                <div style={{ color: '#ddd', fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {zipFile}
                </div>
              )}
              {error && <div style={{ color: '#e55', fontSize: 12 }}>{error}</div>}

              {deployUrl && (
                <div style={{ background: '#2a3a2a', border: '1px solid #3a5a3a', borderRadius: 4, padding: '8px 12px' }}>
                  <div style={{ color: '#6c6', fontSize: 11, marginBottom: 4 }}>{t('deploy.netlify.deployUrl')}</div>
                  <a href={deployUrl} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#5af', fontSize: 13, wordBreak: 'break-all' }}>
                    {deployUrl}
                  </a>
                  <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>
                    {t('deploy.netlify.deployUrlDesc')}
                  </div>
                  <button className="db-btn" onClick={handleOpenMySite}
                    style={{ marginTop: 8, width: '100%', background: '#0e5f1f', borderColor: '#1a8a30' }}>
                    {t('deploy.netlify.openSite')} ↗
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'local' && (
            <>
              <div>
                <div style={fieldLabel}>{t('deploy.outputPath')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={outputPath} readOnly
                    style={{ ...inputStyle, fontFamily: undefined, flex: 1, width: 'auto' }} />
                  <button className="db-btn" onClick={() => setShowBrowse(true)}>{t('deploy.browse')}</button>
                </div>
              </div>
              {status && <div style={{ color: '#6c6', fontSize: 12 }}>{status}</div>}
              {error && <div style={{ color: '#e55', fontSize: 12 }}>{error}</div>}
            </>
          )}

          {/* 캐시 버스팅 옵션 — 두 탭 공통 */}
          {cacheBustSection}

        </div>

        <div className="db-dialog-footer">
          {tab === 'local' && (
            <button className="db-btn" onClick={handleLocalDeploy} disabled={busy}
              style={{ background: '#0078d4', borderColor: '#0078d4' }}>
              {busy ? t('deploy.deploying') : t('deploy.deploy')}
            </button>
          )}
          <button className="db-btn" onClick={() => setShow(false)}>{t('common.close')}</button>
        </div>
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
    </div>
  );
}
