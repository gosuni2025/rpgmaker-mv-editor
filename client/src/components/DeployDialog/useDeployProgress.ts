import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SSEEvent, DeployProgressState } from './types';

// GH Pages 단계별 진행률
const GH_PHASE_PROGRESS: Record<string, number> = {
  copying: 0.10,
  patching: 0.35,
  committing: 0.55,
  pushing: 0.70,
  'pages-setup': 0.88,
  'pages-setup-skipped': 0.88,
};

export default function useDeployProgress() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const isGhPagesRef = useRef(false);

  const resetStatus = useCallback(() => {
    setError(''); setStatus(''); setProgress(null); setLogs([]); isGhPagesRef.current = false;
  }, []);

  const handleSSEEvent = useCallback(
    (ev: SSEEvent, totalRef: { current: number }, weights: { copy: number; zip: number }): boolean => {
      const uploadStart = weights.copy + weights.zip;

      if (ev.type === 'log') {
        setLogs(prev => [...prev, ev.message]);
        return true;
      }

      if (ev.type === 'status') {
        const phaseMap: Record<string, string> = {
          'creating-site':       t('deploy.netlify.creatingSite'),
          'counting':            t('deploy.netlify.analyzing'),
          'copying':             t('deploy.ghPages.copying'),
          'patching':            t('deploy.ghPages.patching'),
          'committing':          t('deploy.ghPages.committing'),
          'pushing':             t('deploy.ghPages.pushing'),
          'pages-setup':         t('deploy.ghPages.pagesSetup'),
          'pages-setup-skipped': t('deploy.ghPages.pagesSetupSkipped'),
        };
        if (phaseMap[ev.phase]) setStatus(phaseMap[ev.phase]);
        if (ev.phase === 'pages-setup-skipped' && ev.detail) setError(ev.detail);

        // GH Pages 단계별 진행률 업데이트
        if (ev.phase in GH_PHASE_PROGRESS) {
          isGhPagesRef.current = true;
          setProgress(GH_PHASE_PROGRESS[ev.phase]);
        }

        if (ev.phase === 'zipping')   { setProgress(weights.copy); setStatus(t('deploy.netlify.zipping')); }
        if (ev.phase === 'uploading') { setProgress(uploadStart); setStatus(t('deploy.netlify.uploading')); }
      } else if (ev.type === 'site-created') {
        setStatus(`${t('deploy.netlify.siteCreatedMsg')}: ${ev.siteName}.netlify.app`);
        return true;
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

  const state: DeployProgressState = { busy, status, error, progress };

  return { ...state, logs, setBusy, setStatus, setError, setProgress, resetStatus, handleSSEEvent };
}
