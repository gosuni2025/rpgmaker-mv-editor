import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import Dialog from '../common/Dialog';
import apiClient from '../../api/client';
import CacheBustSection, { CacheBustOpts, DEFAULT_CACHE_BUST_OPTS } from '../common/CacheBustSection';
import { Tab } from './types';
import NetlifyTab from './NetlifyTab';
import GhPagesTab from './GhPagesTab';
import ItchioTab from './ItchioTab';
import LocalTab from './LocalTab';
import './DeployDialog.css';

export default function DeployDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowDeployDialog);

  const [tab, setTab] = useState<Tab>('itchio');
  const [cbOpts, setCbOpts] = useState<CacheBustOpts>(DEFAULT_CACHE_BUST_OPTS);

  // 설정 초기값
  const [initialApiKey, setInitialApiKey] = useState('');
  const [initialSiteId, setInitialSiteId] = useState('');
  const [initialSiteUrl, setInitialSiteUrl] = useState('');
  const [initialGhRemote, setInitialGhRemote] = useState('pages');
  const [initialItchioUsername, setInitialItchioUsername] = useState('');
  const [initialItchioProject, setInitialItchioProject] = useState('');
  const [initialItchioChannel, setInitialItchioChannel] = useState('html5');
  const [initialItchioGameId, setInitialItchioGameId] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [syncRuntime, setSyncRuntime] = useState(false);

  useEffect(() => {
    apiClient.get('/settings').then((data) => {
      const d = data as Record<string, unknown>;
      const netlify = d.netlify as { apiKey?: string; siteId?: string; siteUrl?: string } | undefined;
      if (netlify?.apiKey) setInitialApiKey(netlify.apiKey);
      if (netlify?.siteId) setInitialSiteId(netlify.siteId);
      if (netlify?.siteUrl) setInitialSiteUrl(netlify.siteUrl);
      const ghPages = d.ghPages as { remote?: string } | undefined;
      if (ghPages?.remote) setInitialGhRemote(ghPages.remote);
      const itchio = d.itchio as { username?: string; project?: string; channel?: string; gameId?: string } | undefined;
      if (itchio?.username) setInitialItchioUsername(itchio.username);
      if (itchio?.project) setInitialItchioProject(itchio.project);
      if (itchio?.channel) setInitialItchioChannel(itchio.channel);
      if (itchio?.gameId) setInitialItchioGameId(itchio.gameId);
    }).catch(() => {}).finally(() => setSettingsLoaded(true));
  }, []);

  const handleClose = useCallback(() => setShow(false), [setShow]);

  if (!settingsLoaded) return null;

  return (
    <Dialog
      title={t('deploy.title')}
      onClose={handleClose}
      className="deploy-dialog"
      noBody
      footer={
        <button className="db-btn" onClick={() => setShow(false)}>{t('common.cancel')}</button>
      }
    >
      <div className="deploy-tabs">
        {(['itchio', 'netlify', 'ghpages', 'local'] as Tab[]).map((id) => (
          <button key={id} className={`deploy-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {t(
              id === 'netlify' ? 'deploy.tabNetlify' :
              id === 'ghpages' ? 'deploy.tabGhPages' :
              id === 'itchio' ? 'deploy.tabItchio' :
              'deploy.tabLocal'
            )}
          </button>
        ))}
      </div>

      <div className="deploy-content">
        {tab === 'netlify' && (
          <NetlifyTab cbOpts={cbOpts} initialApiKey={initialApiKey} initialSiteId={initialSiteId} initialSiteUrl={initialSiteUrl} syncRuntime={syncRuntime} />
        )}
        {tab === 'ghpages' && (
          <GhPagesTab cbOpts={cbOpts} initialRemote={initialGhRemote} syncRuntime={syncRuntime} />
        )}
        {tab === 'itchio' && (
          <ItchioTab cbOpts={cbOpts} initialUsername={initialItchioUsername} initialProject={initialItchioProject} initialChannel={initialItchioChannel} initialGameId={initialItchioGameId} syncRuntime={syncRuntime} />
        )}
        {tab === 'local' && (
          <LocalTab cbOpts={cbOpts} syncRuntime={syncRuntime} />
        )}

        <div style={{ borderTop: '1px solid #333', paddingTop: 8, marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#aaa' }}>
            <input type="checkbox" checked={syncRuntime} onChange={(e) => setSyncRuntime(e.target.checked)} />
            배포 시 프로젝트 js/3d/ 런타임 동기화
          </label>
        </div>

        <CacheBustSection opts={cbOpts} onChange={setCbOpts} />
      </div>
    </Dialog>
  );
}
