import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CacheBustOpts } from '../common/CacheBustSection';
import apiClient from '../../api/client';
import { SSEEvent } from './types';
import useDeployProgress from './useDeployProgress';
import { ProgressBar, ErrorMessage } from './StatusWidgets';

interface ItchioCheck {
  butler: boolean;
  loggedIn: boolean;
  username: string | null;
  gameSlug: string;
}

interface Props {
  cbOpts: CacheBustOpts;
  initialUsername: string;
  initialProject: string;
  initialChannel: string;
}

export default function ItchioTab({ cbOpts, initialUsername, initialProject, initialChannel }: Props) {
  const { t } = useTranslation();
  const dp = useDeployProgress();

  const [username, setUsername] = useState(initialUsername);
  const [project, setProject] = useState(initialProject);
  const [channel, setChannel] = useState(initialChannel || 'html5');
  const [check, setCheck] = useState<ItchioCheck | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [itchUrl, setItchUrl] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const logPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [dp.logs]);

  useEffect(() => {
    apiClient.get('/project/deploy-itchio-check')
      .then((data) => {
        const d = data as ItchioCheck;
        setCheck(d);
        // project가 비어있고 username 저장값 있으면 자동완성
        if (!project.trim() && d.username) {
          setProject(`${d.username}/${d.gameSlug}`);
        } else if (!project.trim() && d.gameSlug) {
          setProject(d.gameSlug);
        }
      })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    try {
      await apiClient.put('/project/itchio-settings', { username, project, channel });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) { dp.setError((e as Error).message); }
  };

  const handleDeploy = () => {
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
      body: JSON.stringify({ project: project.trim(), channel, cacheBust: cbOpts }),
    }).then((response) => {
      if (!response.body) throw new Error('응답 스트림 없음');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      const pump = (): Promise<void> =>
        reader.read().then(({ done, value }) => {
          if (done) { dp.setBusy(false); return; }
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
        dp.setStatus(''); dp.setProgress(null); dp.setBusy(false);
      }
    });
  };

  const openUrl = async (url: string) => {
    try { await apiClient.post('/project/open-url', { url }); }
    catch (e) { dp.setError((e as Error).message); }
  };

  const butlerOk = check?.butler ?? false;
  const loggedIn = check?.loggedIn ?? false;
  const prereqOk = butlerOk && loggedIn;
  const deployDone = !dp.busy && dp.logs.length > 0;
  const deployFailed = !dp.busy && !!dp.error;

  return (
    <>
      {/* ── 사전 조건 ── */}
      <div className="deploy-info-box" style={{ padding: '10px 12px' }}>
        <div style={{ color: '#bbb', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{t('deploy.ghPages.prerequisites')}</div>

        {/* butler 설치 여부 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: butlerOk ? '#6c6' : '#e55', fontSize: 12 }}>{butlerOk ? '✓' : '✗'}</span>
            <span style={{ color: butlerOk ? '#aaa' : '#e77', fontSize: 12 }}>
              {check === null ? '확인 중...' : butlerOk ? 'butler 설치됨' : 'butler 미설치'}
            </span>
          </div>
          {check !== null && !butlerOk && (
            <button className="db-btn" onClick={() => openUrl('https://itchio.itch.io/butler')}
              style={{ fontSize: 11, padding: '2px 8px' }}>
              다운로드 ↗
            </button>
          )}
        </div>

        {/* 로그인 여부 */}
        {butlerOk && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: loggedIn ? '#6c6' : '#e55', fontSize: 12 }}>{loggedIn ? '✓' : '✗'}</span>
              <span style={{ color: loggedIn ? '#aaa' : '#e77', fontSize: 12 }}>
                {loggedIn ? `butler 로그인: ${check!.username}` : 'butler 미로그인'}
              </span>
            </div>
            {!loggedIn && (
              <code style={{ fontSize: 11, color: '#fc8', background: '#333', padding: '2px 6px', borderRadius: 3 }}>
                butler login
              </code>
            )}
          </div>
        )}
      </div>

      {/* ── 설정 (prereq OK일 때만 표시) ── */}
      {prereqOk && (
        <div className="deploy-settings-box">
          <div>
            <div className="deploy-field-label">itch.io Username</div>
            <input type="text" value={username} onChange={(e) => {
              const u = e.target.value;
              setUsername(u);
              // project의 username 부분만 교체
              setProject((prev) => {
                const slug = prev.includes('/') ? prev.split('/').slice(1).join('/') : prev;
                return u ? `${u}/${slug}` : slug;
              });
            }} placeholder="your-username" className="deploy-input" />
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
      )}

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

            {dp.status && <div className="deploy-progress-status">{dp.status}</div>}

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
