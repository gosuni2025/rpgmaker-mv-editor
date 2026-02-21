import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import useEscClose from '../../hooks/useEscClose';
import apiClient from '../../api/client';
import CacheBustSection, { CacheBustOpts, DEFAULT_CACHE_BUST_OPTS } from '../common/CacheBustSection';
import { Tab } from './types';
import NetlifyTab from './NetlifyTab';
import GhPagesTab from './GhPagesTab';
import LocalTab from './LocalTab';
import './DeployDialog.css';

export default function DeployDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowDeployDialog);
  useEscClose(useCallback(() => setShow(false), [setShow]));

  const [tab, setTab] = useState<Tab>('netlify');
  const [cbOpts, setCbOpts] = useState<CacheBustOpts>(DEFAULT_CACHE_BUST_OPTS);

  // 설정 초기값
  const [initialApiKey, setInitialApiKey] = useState('');
  const [initialSiteId, setInitialSiteId] = useState('');
  const [initialSiteUrl, setInitialSiteUrl] = useState('');
  const [initialGhRemote, setInitialGhRemote] = useState('pages');
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
    }).catch(() => {}).finally(() => setSettingsLoaded(true));
  }, []);

  if (!settingsLoaded) return null;

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog deploy-dialog">
        <div className="db-dialog-header">{t('deploy.title')}</div>

        <div className="deploy-tabs">
          {(['netlify', 'ghpages', 'local'] as Tab[]).map((id) => (
            <button key={id} className={`deploy-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {t(id === 'netlify' ? 'deploy.tabNetlify' : id === 'ghpages' ? 'deploy.tabGhPages' : 'deploy.tabLocal')}
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
          {tab === 'local' && (
            <LocalTab cbOpts={cbOpts} />
          )}

          <CacheBustSection opts={cbOpts} onChange={setCbOpts} />
        </div>

        <div className="db-dialog-footer">
          <button className="db-btn" onClick={() => setShow(false)}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
