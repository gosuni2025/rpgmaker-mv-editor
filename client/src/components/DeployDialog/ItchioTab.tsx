import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CacheBustOpts, cacheBustToQuery } from '../common/CacheBustSection';
import apiClient from '../../api/client';
import { SSEEvent } from './types';
import useDeployProgress from './useDeployProgress';
import { DeployProgressModal } from './StatusWidgets';

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
  const [deployMode, setDeployMode] = useState<'deploy' | 'zip'>('deploy');
  const [gameExists, setGameExists] = useState<boolean | null | 'checking'>(null);
  const gameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // project 변경 시 itch.io 게임 존재 여부 확인 (debounce 600ms)
  useEffect(() => {
    if (gameCheckTimer.current) clearTimeout(gameCheckTimer.current);
    if (!project.trim() || !project.includes('/')) {
      setGameExists(null);
      return;
    }
    setGameExists('checking');
    gameCheckTimer.current = setTimeout(() => {
      apiClient.get(`/project/deploy-itchio-game-check?project=${encodeURIComponent(project.trim())}`)
        .then((d) => setGameExists((d as { exists: boolean | null }).exists))
        .catch(() => setGameExists(null));
    }, 600);
  }, [project]);

  const saveSettings = async () => {
    try {
      await apiClient.put('/project/itchio-settings', { username, project, channel });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) { dp.setError((e as Error).message); }
  };

  const handleMakeZip = () => {
    dp.resetStatus();
    dp.setProgress(0);
    dp.setBusy(true);
    setDeployMode('zip');
    setShowProgressModal(true);
    let completed = false;
    const totalRef = { current: 0 };
    const evtSource = new EventSource(`/api/project/deploy-zip-progress?${cacheBustToQuery(cbOpts)}`);
    evtSource.onmessage = (e) => {
      const ev = JSON.parse(e.data) as SSEEvent;
      if (ev.type === 'done') {
        completed = true;
        dp.setProgress(1);
        dp.setStatus('ZIP 생성 완료.');
        dp.setBusy(false);
        evtSource.close();
        return;
      }
      if (!dp.handleSSEEvent(ev, totalRef, { copy: 0.75, zip: 0.25 })) {
        completed = true;
        evtSource.close();
      }
    };
    evtSource.onerror = () => {
      evtSource.close();
      if (!completed) {
        dp.setError('연결 오류');
        dp.setStatus(''); dp.setProgress(null); dp.setBusy(false);
      }
    };
  };

  const handleDeploy = () => {
    if (!project.trim()) { dp.setError(t('deploy.itchio.projectRequired')); return; }

    dp.resetStatus();
    dp.setProgress(0);
    dp.setBusy(true);
    setItchUrl('');
    setDeployMode('deploy');
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span className="deploy-field-label" style={{ marginBottom: 0 }}>{t('deploy.itchio.project')}</span>
              <button className="db-btn" onClick={() => openUrl('https://itch.io/game/new')}
                style={{ fontSize: 11, padding: '2px 8px' }}>
                새 게임 만들기 ↗
              </button>
            </div>
            <div style={{ color: '#777', fontSize: 11, marginBottom: 6 }}>
              butler 배포 전 itch.io에 HTML 타입 게임 페이지가 있어야 합니다. 없으면 위 버튼으로 먼저 생성하세요.
            </div>
            <input type="text" value={project} onChange={(e) => setProject(e.target.value)}
              placeholder="username/game-name" className="deploy-input" />
            {project && project.includes('/') && (
              <div style={{ marginTop: 5, fontSize: 11, color: '#5af' }}>
                → https://{project.split('/')[0]}.itch.io/{project.split('/')[1]}
              </div>
            )}
            {gameExists === 'checking' && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>itch.io 게임 확인 중...</div>
            )}
            {gameExists === true && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#6c6' }}>✓ itch.io에서 게임을 찾았습니다</div>
            )}
            {gameExists === false && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#e77' }}>
                ✗ itch.io에서 게임을 찾을 수 없습니다. '새 게임 만들기'로 먼저 게임 페이지를 생성하세요.
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

      <div className="deploy-info-box" style={{ padding: '8px 12px' }}>
        <div style={{ color: '#e8a040', fontSize: 11, marginBottom: 4 }}>
          ⚠ itch.io는 파일 수가 1,000개를 초과하면 웹 플레이어에서 실행이 불가합니다.
        </div>
        <div style={{ color: '#777', fontSize: 11 }}>
          최초 업로드 시: ZIP 만들기 → 폴더 열기 → itch.io 게임 편집 페이지에 ZIP 드래그 업로드
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="db-btn" onClick={handleMakeZip} disabled={dp.busy} style={{ flex: 1 }}>
          ZIP 만들기
        </button>
        <button className="db-btn" onClick={() => apiClient.post('/project/open-deploys-dir', {}).catch((e) => dp.setError((e as Error).message))} style={{ flex: 1 }}>
          폴더 열기
        </button>
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

      <DeployProgressModal
        show={showProgressModal}
        busy={dp.busy}
        logs={dp.logs}
        status={dp.status}
        error={dp.error}
        progress={dp.progress}
        color="#d94f3c"
        titleBusy={deployMode === 'zip' ? 'ZIP 생성 중...' : t('deploy.itchio.deploying')}
        titleDone={deployMode === 'zip' ? 'ZIP 생성 완료' : t('deploy.itchio.done')}
        titleFailed={deployMode === 'zip' ? 'ZIP 생성 실패' : t('deploy.itchio.failed')}
        resultUrl={deployMode === 'deploy' ? itchUrl : ''}
        resultLabel={t('deploy.itchio.openGame')}
        resultButtonStyle={{ background: '#6b1f1f', borderColor: '#9c2e2e' }}
        onResultClick={() => openUrl(itchUrl)}
        onClose={() => setShowProgressModal(false)}
      />
    </>
  );
}
