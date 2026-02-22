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

  const [tab, setTab] = useState<Tab>('netlify');
  const [cbOpts, setCbOpts] = useState<CacheBustOpts>(DEFAULT_CACHE_BUST_OPTS);

  // 설정 초기값
  const [initialApiKey, setInitialApiKey] = useState('');
  const [initialSiteId, setInitialSiteId] = useState('');
  const [initialSiteUrl, setInitialSiteUrl] = useState('');
  const [initialGhRemote, setInitialGhRemote] = useState('pages');
  const [initialItchioProject, setInitialItchioProject] = useState('');
  const [initialItchioChannel, setInitialItchioChannel] = useState('html5');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    apiClient.get('/settings').then((data) => {
      const d = data as Record<string, unknown>;
      const netlify = d.netlify as { apiKey?: string; siteId?: string; siteUrl?: string } | undefined;
      if (netlify?.apiKey) setInitialApiKey(netlify.apiKey);
      if (netlify?.siteId) setInitialSiteId(netlify.siteId);
      if (netlify?.siteUrl) setInitialSiteUrl(netlify.siteUrl);
      const ghPages = d.ghPages as { remote?: string } | undefined;
      if (ghPages?.remote) setInitialGhRemote(ghPages.remote);
      const itchio = d.itchio as { project?: string; channel?: string } | undefined;
      if (itchio?.project) setInitialItchioProject(itchio.project);
      if (itchio?.channel) setInitialItchioChannel(itchio.channel);
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
        <button className="db-btn" onClick={() => setShow(false)}>{t('common.close')}</button>
      }
    >
      <div className="deploy-tabs">
        {(['netlify', 'ghpages', 'itchio', 'local'] as Tab[]).map((id) => (
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
          <NetlifyTab cbOpts={cbOpts} initialApiKey={initialApiKey} initialSiteId={initialSiteId} initialSiteUrl={initialSiteUrl} />
        )}
        {tab === 'ghpages' && (
          <GhPagesTab cbOpts={cbOpts} initialRemote={initialGhRemote} />
        )}
        {tab === 'itchio' && (
          <ItchioTab cbOpts={cbOpts} initialProject={initialItchioProject} initialChannel={initialItchioChannel} />
        )}
        {tab === 'local' && (
          <LocalTab cbOpts={cbOpts} />
        )}

        <CacheBustSection opts={cbOpts} onChange={setCbOpts} />
      </div>
    </Dialog>
  );
}
