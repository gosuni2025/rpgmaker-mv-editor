import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CacheBustOpts, cacheBustToQuery } from '../common/CacheBustSection';
import apiClient from '../../api/client';
import { SSEEvent, GhPagesCheck } from './types';
import useDeployProgress from './useDeployProgress';
import { ProgressBar, StatusMessage, ErrorMessage } from './StatusWidgets';

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
  const [logCopied, setLogCopied] = useState(false);
  const ghCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logPanelRef = useRef<HTMLDivElement>(null);

  const copyLogs = () => {
    navigator.clipboard.writeText(dp.logs.join('\n'));
    setLogCopied(true);
    setTimeout(() => setLogCopied(false), 1500);
  };

  // 로그 패널 자동 스크롤
  useEffect(() => {
    if (logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [dp.logs]);

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

  const deployDone = !dp.busy && dp.logs.length > 0;
  const deployFailed = !dp.busy && !!dp.error;

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

      {/* 배포 진행 상황 모달 팝업 */}
      {showProgressModal && (
        <div className="deploy-progress-overlay">
          <div className="deploy-progress-modal">
            <div className="deploy-progress-header">
              {dp.busy ? '배포 진행 중...' : deployFailed ? '배포 실패' : '배포 완료'}
              {dp.busy && <span className="deploy-spinner" />}
            </div>

            {dp.status && (
              <div className="deploy-progress-status">
                {dp.status}
              </div>
            )}

            <ProgressBar progress={dp.progress} color={deployFailed ? '#e55' : '#2a9a42'} />

            <div style={{ position: 'relative' }}>
              {dp.logs.length > 0 && (
                <button onClick={copyLogs} style={{
                  position: 'absolute', top: 4, right: 4, zIndex: 1,
                  padding: '2px 8px', fontSize: 11, cursor: 'pointer',
                  background: logCopied ? '#1a6e2e' : '#3a3a3a',
                  border: '1px solid #555', borderRadius: 3, color: '#ccc',
                }}>
                  {logCopied ? '✓ 복사됨' : '복사'}
                </button>
              )}
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
            </div>

            <ErrorMessage error={dp.error} />

            {/* 완료/실패 시 결과 + 닫기 버튼 */}
            {!dp.busy && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                {deployDone && !deployFailed && ghPageUrl && (
                  <button className="db-btn" onClick={() => openUrl(ghPageUrl)}
                    style={{ marginRight: 8, background: '#0e5f1f', borderColor: '#1a8a30' }}>
                    페이지 열기 ↗
                  </button>
                )}
                <button className="db-btn" onClick={() => setShowProgressModal(false)}>
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
