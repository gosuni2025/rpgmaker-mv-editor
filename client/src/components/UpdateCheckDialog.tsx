import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import './UpdateCheckDialog.css';

const REPO = 'gosuni2025/rpgmaker-mv-editor';
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
const GH_RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const GH_COMMITS_API = `https://api.github.com/repos/${REPO}/commits?sha=main&per_page=1`;

type InstallType = 'release' | 'git';

interface VersionInfo {
  type: InstallType;
  // 릴리즈
  version?: string;
  // git
  commitDate?: string;
  commitHash?: string;
}

interface CheckResult {
  upToDate: boolean;
  current: string;
  latest: string;
  latestUrl?: string;
}

interface Props {
  onClose: () => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '?';
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** semver 비교: a < b → true */
function isOlderVersion(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if (aMaj !== bMaj) return aMaj < bMaj;
  if (aMin !== bMin) return aMin < bMin;
  return (aPatch ?? 0) < (bPatch ?? 0);
}

export default function UpdateCheckDialog({ onClose }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      setLoading(true);
      setError(null);

      try {
        // 서버에서 현재 버전 정보
        const info = await apiClient.get<VersionInfo>('/version/info');
        if (cancelled) return;
        setVersionInfo(info);

        if (info.type === 'release') {
          // GitHub 최신 릴리즈 조회
          const ghRes = await fetch(GH_RELEASES_API, {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (cancelled) return;
          if (!ghRes.ok) throw new Error(`GitHub API: ${ghRes.status}`);
          const ghData = await ghRes.json();
          const latestTag: string = ghData.tag_name ?? '';
          const currentVer = info.version ?? '0.0.0';
          setResult({
            upToDate: !isOlderVersion(currentVer, latestTag),
            current: `v${currentVer}`,
            latest: latestTag || '?',
            latestUrl: ghData.html_url ?? RELEASES_PAGE,
          });
        } else {
          // GitHub 최신 커밋 조회
          const ghRes = await fetch(GH_COMMITS_API, {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (cancelled) return;
          if (!ghRes.ok) throw new Error(`GitHub API: ${ghRes.status}`);
          const ghData = await ghRes.json();
          const latestDate: string = ghData[0]?.commit?.committer?.date ?? '';
          const currentDate = info.commitDate ?? '';
          const upToDate = currentDate >= latestDate; // ISO 8601 문자열 비교
          setResult({
            upToDate,
            current: formatDate(currentDate),
            latest: formatDate(latestDate),
            latestUrl: RELEASES_PAGE,
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  const isGit = versionInfo?.type === 'git';

  return (
    <div className="db-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="db-dialog update-check-dialog">
        <div className="db-dialog-header">
          <span>{t('update.title', '업데이트 확인')}</span>
          <button className="db-dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="update-check-body">
          {loading ? (
            <div className="update-check-loading">
              <span className="update-check-spinner" />
              <span>{t('update.checking', '확인 중...')}</span>
            </div>
          ) : error ? (
            <div className="update-check-error">
              <div className="update-check-error-icon">✕</div>
              <div>{t('update.error', '버전 확인에 실패했습니다.')}</div>
              <div className="update-check-error-detail">{error}</div>
            </div>
          ) : result ? (
            <>
              <div className={`update-check-badge ${result.upToDate ? 'up-to-date' : 'outdated'}`}>
                {result.upToDate
                  ? t('update.upToDate', '최신 버전입니다')
                  : t('update.available', '업데이트가 있습니다')}
              </div>

              <div className="update-check-rows">
                <div className="update-check-row">
                  <span className="update-check-label">
                    {isGit
                      ? t('update.currentCommit', '현재 커밋 날짜')
                      : t('update.currentVersion', '현재 버전')}
                  </span>
                  <span className="update-check-value">{result.current}</span>
                </div>
                <div className="update-check-row">
                  <span className="update-check-label">
                    {isGit
                      ? t('update.latestCommit', '최신 커밋 날짜')
                      : t('update.latestVersion', '최신 버전')}
                  </span>
                  <span className={`update-check-value ${!result.upToDate ? 'update-check-highlight' : ''}`}>
                    {result.latest}
                  </span>
                </div>
                {isGit && versionInfo?.commitHash && (
                  <div className="update-check-row">
                    <span className="update-check-label">{t('update.currentHash', '현재 커밋')}</span>
                    <span className="update-check-value update-check-mono">{versionInfo.commitHash}</span>
                  </div>
                )}
              </div>

              {isGit && (
                <div className="update-check-hint">
                  {t('update.gitHint', 'git pull 명령으로 최신 변경사항을 받을 수 있습니다.')}
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="db-dialog-footer">
          {!loading && !error && result && !result.upToDate && (
            <a
              className="db-btn db-btn-primary update-check-download"
              href={result.latestUrl ?? RELEASES_PAGE}
              target="_blank"
              rel="noopener noreferrer"
            >
              {isGit
                ? t('update.viewChanges', '변경사항 보기')
                : t('update.download', '다운로드')}
            </a>
          )}
          <button className="db-btn" onClick={onClose}>
            {t('common.close', '닫기')}
          </button>
        </div>
      </div>
    </div>
  );
}
