import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import apiClient from '../api/client';
import FolderBrowser from './common/FolderBrowser';

type Tab = 'netlify' | 'local';

type SSEEvent =
  | { type: 'status'; phase: 'counting' | 'zipping' | 'uploading' }
  | { type: 'counted'; total: number }
  | { type: 'progress'; current: number; total: number }
  | { type: 'done'; zipPath?: string; deployUrl?: string; deployId?: string }
  | { type: 'error'; message: string };

/** fetch 기반 SSE 스트림 읽기 (POST body 지원) */
async function readSSEStream(
  url: string,
  options: RequestInit,
  onEvent: (data: SSEEvent) => boolean, // false 반환 시 중단
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
            const ev = JSON.parse(line.slice(6)) as SSEEvent;
            if (!onEvent(ev)) return;
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
  const [settingsSaved, setSettingsSaved] = useState(false);

  // 작업 상태
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [deployUrl, setDeployUrl] = useState('');
  const [progress, setProgress] = useState<number | null>(null); // 0~1

  // 로컬 배포
  const [outputPath, setOutputPath] = useState('');
  const [showBrowse, setShowBrowse] = useState(false);
  const [browsePath, setBrowsePath] = useState('');

  // 가이드 열기/닫기
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    apiClient.get('/settings').then((data) => {
      const d = data as Record<string, unknown>;
      const netlify = d.netlify as { apiKey?: string; siteId?: string } | undefined;
      if (netlify?.apiKey) setApiKey(netlify.apiKey);
      if (netlify?.siteId) setSiteId(netlify.siteId);
    }).catch(() => {});
  }, []);

  const resetStatus = () => { setError(''); setStatus(''); setDeployUrl(''); setProgress(null); };

  const saveNetlifySettings = async () => {
    try {
      await apiClient.put('/project/netlify-settings', { apiKey, siteId });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** SSE 이벤트를 공통 처리 → progress/status 업데이트, true=계속 false=에러중단 */
  const handleSSEEvent = useCallback(
    (ev: SSEEvent, totalRef: { current: number }, phaseWeight: { copy: number; zip: number }): boolean => {
      if (ev.type === 'status') {
        if (ev.phase === 'counting') setStatus(t('deploy.netlify.analyzing'));
        if (ev.phase === 'zipping') {
          setProgress(phaseWeight.copy);
          setStatus(t('deploy.netlify.zipping'));
        }
        if (ev.phase === 'uploading') {
          setProgress(phaseWeight.copy + phaseWeight.zip);
          setStatus(t('deploy.netlify.uploading'));
        }
      } else if (ev.type === 'counted') {
        totalRef.current = ev.total;
        setStatus(`${t('deploy.netlify.copying')} (0/${ev.total})`);
        setProgress(0);
      } else if (ev.type === 'progress') {
        const pct = (ev.current / Math.max(totalRef.current, 1)) * phaseWeight.copy;
        setProgress(pct);
        setStatus(`${t('deploy.netlify.copying')} (${ev.current}/${totalRef.current})`);
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

  const handleMakeZip = () => {
    resetStatus();
    setProgress(0);
    setStatus(t('deploy.netlify.analyzing'));
    setBusy(true);

    let completed = false;
    const totalRef = { current: 0 };
    const evtSource = new EventSource('/api/project/deploy-zip-progress');

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
      handleSSEEvent(ev, totalRef, { copy: 0.8, zip: 0.2 });
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
    try {
      await apiClient.post('/project/open-netlify-drop', {});
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleOpenNetlifySite = async () => {
    try {
      await apiClient.post('/project/open-url', { url: 'https://www.netlify.com' });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleAutoDeploy = async () => {
    if (!apiKey.trim()) { setError(t('deploy.netlify.apiKeyRequired')); return; }
    if (!siteId.trim()) { setError(t('deploy.netlify.siteIdRequired')); return; }
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
          body: JSON.stringify({ apiKey: apiKey.trim(), siteId: siteId.trim() }),
        },
        (ev) => {
          if (ev.type === 'done') {
            setProgress(1);
            setStatus(t('deploy.netlify.deployDone'));
            setDeployUrl(ev.deployUrl || '');
            setTimeout(() => setProgress(null), 800);
            return false; // 스트림 종료
          }
          return handleSSEEvent(ev, totalRef, { copy: 0.6, zip: 0.15 });
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
      await apiClient.post('/project/deploy', { platform: 'web', outputPath });
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
    flex: 1,
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
    t('deploy.netlify.guide6'),
  ];

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 560, height: 'auto', minHeight: 0 }}>
        <div className="db-dialog-header">{t('deploy.title')}</div>

        {/* 탭 */}
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
              {/* 면책 고지 + netlify.com 링크 */}
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

                <div>
                  <div style={fieldLabel}>{t('deploy.netlify.apiKey')}</div>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t('deploy.netlify.apiKeyPlaceholder')} style={inputStyle} />
                </div>

                <div>
                  <div style={fieldLabel}>{t('deploy.netlify.siteId')}</div>
                  <input type="text" value={siteId} onChange={(e) => setSiteId(e.target.value)}
                    placeholder={t('deploy.netlify.siteIdPlaceholder')} style={inputStyle} />
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
                        <li key={i} style={{ color: '#ccc', fontSize: 12, lineHeight: 1.5 }}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* 수동 업로드 */}
              <div>
                <div style={{ color: '#777', fontSize: 11, marginBottom: 8 }}>수동 업로드</div>
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
              <div>
                <div style={{ color: '#777', fontSize: 11, marginBottom: 8 }}>자동 배포</div>
                <button className="db-btn" onClick={handleAutoDeploy} disabled={busy}
                  style={{ width: '100%', background: '#0078d4', borderColor: '#0078d4' }}>
                  {t('deploy.netlify.autoDeploy')}
                </button>
              </div>

              {/* 프로그레스 바 */}
              {progress !== null && (
                <div style={{ background: '#3a3a3a', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round(progress * 100)}%`,
                    background: '#2675bf',
                    transition: 'width 0.15s ease-out',
                  }} />
                </div>
              )}

              {/* 상태 */}
              {status && <div style={{ color: '#6c6', fontSize: 12 }}>{status}</div>}
              {error && <div style={{ color: '#e55', fontSize: 12 }}>{error}</div>}

              {/* 배포 URL */}
              {deployUrl && (
                <div style={{ background: '#2a3a2a', border: '1px solid #3a5a3a', borderRadius: 4, padding: '8px 12px' }}>
                  <div style={{ color: '#6c6', fontSize: 11, marginBottom: 4 }}>{t('deploy.netlify.deployUrl')}</div>
                  <a href={deployUrl} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#5af', fontSize: 13, wordBreak: 'break-all' }}>
                    {deployUrl}
                  </a>
                  <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
                    {t('deploy.netlify.deployUrlDesc')}
                  </div>
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
                    style={{ ...inputStyle, fontFamily: undefined }} />
                  <button className="db-btn" onClick={() => setShowBrowse(true)}>{t('deploy.browse')}</button>
                </div>
              </div>
              {status && <div style={{ color: '#6c6', fontSize: 12 }}>{status}</div>}
              {error && <div style={{ color: '#e55', fontSize: 12 }}>{error}</div>}
            </>
          )}
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
