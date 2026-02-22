import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CacheBustOpts } from '../common/CacheBustSection';
import apiClient from '../../api/client';
import { SSEEvent } from './types';
import useDeployProgress from './useDeployProgress';
import { ProgressBar, ErrorMessage } from './StatusWidgets';

interface ItchioCheck {
  butler: boolean;
  username: string | null;
  gameSlug: string;
}

interface Props {
  cbOpts: CacheBustOpts;
  initialApiKey: string;
  initialProject: string;
  initialChannel: string;
}

export default function ItchioTab({ cbOpts, initialApiKey, initialProject, initialChannel }: Props) {
  const { t } = useTranslation();
  const dp = useDeployProgress();

  const [apiKey, setApiKey] = useState(initialApiKey);
  const [project, setProject] = useState(initialProject);
  const [channel, setChannel] = useState(initialChannel || 'html5');
  const [check, setCheck] = useState<ItchioCheck | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [itchUrl, setItchUrl] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const logPanelRef = useRef<HTMLDivElement>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 로그 패널 자동 스크롤
  useEffect(() => {
    if (logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [dp.logs]);

  // butler 설치 확인 + API Key가 있으면 whoami도 같이 조회 (debounce 500ms)
  const runCheck = useCallback((key: string) => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      setCheckingKey(true);
      try {
        const params = key ? `?apiKey=${encodeURIComponent(key)}` : '';
        const data = await apiClient.get(`/project/deploy-itchio-check${params}`) as ItchioCheck;
        setCheck(data);
        // project가 비어있고 username + gameSlug를 얻으면 자동 채우기
        if (!project.trim()) {
          if (data.username && data.gameSlug) {
            setProject(`${data.username}/${data.gameSlug}`);
          } else if (data.username) {
            setProject(`${data.username}/`);
          }
        }
      } catch {}
      finally { setCheckingKey(false); }
    }, 500);
  }, [project]);

  useEffect(() => { runCheck(apiKey); }, []); // 초기 로드

  // API Key 변경 시 재조회
  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    runCheck(val);
  };

  const saveSettings = async () => {
    try {
      await apiClient.put('/project/itchio-settings', { apiKey, project, channel });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) { dp.setError((e as Error).message); }
  };

  const handleDeploy = useCallback(() => {
    if (!apiKey.trim()) { dp.setError(t('deploy.itchio.apiKeyRequired')); return; }
    if (!project.trim()) { dp.setError(t('deploy.itchio.projectRequired')); return; }

    dp.resetStatus();
    dp.setProgress(0);
    dp.setBusy(true);
    setItchUrl('');
    setShowProgressModal(true);

    let completed = false;
    const totalRef = { current: 0 };

    fetch('/api/project/deploy-itchio-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim(), project: project.trim(), channel, cacheBust: cbOpts }),
    }).then((response) => {
      if (!response.body) throw new Error('응답 스트림 없음');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      const pump = (): Promise<void> =>
        reader.read().then(({ done, value }) => {
          if (done) {
            dp.setBusy(false);
            return;
          }
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const part of parts) {
            const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const ev = JSON.parse(dataLine.slice(5).trim()) as SSEEvent;
              if (ev.type === 'done') {
                completed = true;
                dp.setProgress(1);
                dp.setStatus(t('deploy.itchio.done'));
                if (ev.pageUrl) setItchUrl(ev.pageUrl);
                dp.setBusy(false);
                return;
              }
              if (!dp.handleSSEEvent(ev, totalRef, { copy: 0.7, zip: 0 })) {
                completed = true;
                dp.setBusy(false);
                return;
              }
            } catch {}
          }
          return pump();
        });

      return pump();
    }).catch((e) => {
      if (!completed) {
        dp.setError((e as Error).message);
        dp.setStatus('');
        dp.setProgress(null);
        dp.setBusy(false);
      }
    });
  }, [apiKey, project, channel, cbOpts, dp, t]);

  const openUrl = async (url: string) => {
    try { await apiClient.post('/project/open-url', { url }); }
    catch (e) { dp.setError((e as Error).message); }
  };

  const prereqOk = check?.butler ?? false;
  const deployDone = !dp.busy && dp.logs.length > 0;
  const deployFailed = !dp.busy && !!dp.error;

  const CheckBadge = ({ ok, label, warn }: { ok: boolean; label: string; warn?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={!ok && warn ? warn : ''}>
      <span style={{ color: ok ? '#6c6' : '#e55', fontSize: 12 }}>{ok ? '✓' : '✗'}</span>
      <span style={{ color: ok ? '#aaa' : '#e77', fontSize: 12 }}>{label}</span>
    </div>
  );

  return (
    <>
      <div className="deploy-info-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ color: '#777', fontSize: 11, lineHeight: 1.4 }}>{t('deploy.itchio.disclaimer')}</span>
        <button className="db-btn" onClick={() => openUrl('https://itch.io')} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          itch.io ↗
        </button>
      </div>

      <div className="deploy-settings-box">
        <div style={{ color: '#bbb', fontSize: 12, fontWeight: 600 }}>{t('deploy.itchio.settingsTitle')}</div>

        <div>
          <div className="deploy-field-label">{t('deploy.itchio.apiKey')}</div>
          <input type="password" value={apiKey} onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder={t('deploy.itchio.apiKeyPlaceholder')} className="deploy-input" />
          {apiKey && (
            <div style={{ marginTop: 4, fontSize: 11 }}>
              {checkingKey
                ? <span style={{ color: '#888' }}>확인 중...</span>
                : check?.username
                  ? <span style={{ color: '#6c6' }}>✓ {check.username}</span>
                  : check && <span style={{ color: '#e77' }}>✗ {t('deploy.itchio.authFailed')}</span>
              }
            </div>
          )}
          <div className="deploy-security-note">
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('deploy.itchio.securityTitle')}</div>
            <div>· {t('deploy.itchio.security1')}</div>
            <div>· {t('deploy.itchio.security2')}</div>
          </div>
        </div>

        <div>
          <div className="deploy-field-label">{t('deploy.itchio.project')}</div>
          <input type="text" value={project} onChange={(e) => setProject(e.target.value)}
            placeholder="username/game-name" className="deploy-input" />
          {project && project.includes('/') && (
            <div style={{ marginTop: 5, fontSize: 11, color: '#5af' }}>
              → https://{project.split('/')[0]}.itch.io/{project.split('/')[1]}
            </div>
          )}
        </div>

        <div>
          <div className="deploy-field-label">{t('deploy.itchio.channel')}</div>
          <input type="text" value={channel} onChange={(e) => setChannel(e.target.value)}
            placeholder="html5" className="deploy-input" />
          <div style={{ color: '#666', fontSize: 11, marginTop: 3 }}>{t('deploy.itchio.channelDesc')}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          {settingsSaved && <span style={{ color: '#6c6', fontSize: 12 }}>{t('deploy.itchio.saved')}</span>}
          <button className="db-btn" onClick={saveSettings}>{t('common.save')}</button>
        </div>
      </div>

      <div className="deploy-info-box" style={{ padding: '10px 12px' }}>
        <div style={{ color: '#bbb', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{t('deploy.ghPages.prerequisites')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <CheckBadge ok={prereqOk} label={t('deploy.itchio.checkButler')} warn={t('deploy.itchio.butlerMissing')} />
        </div>
        {!prereqOk && check !== null && (
          <div style={{ marginTop: 8, color: '#e77', fontSize: 11 }}>{t('deploy.itchio.butlerMissing')}</div>
        )}
      </div>

      <button className="db-btn" onClick={handleDeploy} disabled={dp.busy || !prereqOk}
        style={{
          width: '100%',
          background: prereqOk ? '#d94f3c' : undefined,
          borderColor: prereqOk ? '#e85e4a' : undefined,
          opacity: prereqOk ? 1 : 0.5,
        }}>
        {t('deploy.itchio.deploy')}
      </button>

      {itchUrl && (
        <div className="deploy-result-box" style={{ background: '#2a1e1e', borderColor: '#4a2a2a' }}>
          <div style={{ color: '#e87', fontSize: 11, marginBottom: 4 }}>{t('deploy.itchio.gameUrl')}</div>
          <a href={itchUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: '#5af', fontSize: 13, wordBreak: 'break-all' }}>
            {itchUrl}
          </a>
          <button className="db-btn" onClick={() => openUrl(itchUrl)}
            style={{ marginTop: 8, width: '100%', background: '#6b1f1f', borderColor: '#9c2e2e' }}>
            {t('deploy.itchio.openGame')} ↗
          </button>
        </div>
      )}

      {/* 배포 진행 모달 */}
      {showProgressModal && (
        <div className="deploy-progress-overlay">
          <div className="deploy-progress-modal">
            <div className="deploy-progress-header">
              {dp.busy ? t('deploy.itchio.deploying') : deployFailed ? t('deploy.itchio.failed') : t('deploy.itchio.done')}
              {dp.busy && <span className="deploy-spinner" />}
            </div>

            {dp.status && (
              <div className="deploy-progress-status">{dp.status}</div>
            )}

            <ProgressBar progress={dp.progress} color={deployFailed ? '#e55' : '#d94f3c'} />

            <div className="deploy-log-panel" ref={logPanelRef}>
              {dp.logs.map((log, i) => (
                <div key={i} className={
                  log.startsWith('$') ? 'deploy-log-cmd' :
                  log.startsWith('──') ? 'deploy-log-step' :
                  log.startsWith('✓') || log.startsWith('→') ? 'deploy-log-ok' :
                  log.startsWith('✗') ? 'deploy-log-err' :
                  'deploy-log-info'
                }>
                  {log}
                </div>
              ))}
            </div>

            <ErrorMessage error={dp.error} />

            {!dp.busy && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                {deployDone && !deployFailed && itchUrl && (
                  <button className="db-btn" onClick={() => openUrl(itchUrl)}
                    style={{ marginRight: 8, background: '#6b1f1f', borderColor: '#9c2e2e' }}>
                    {t('deploy.itchio.openGame')} ↗
                  </button>
                )}
                <button className="db-btn" onClick={() => setShowProgressModal(false)}>
                  {t('common.close')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
