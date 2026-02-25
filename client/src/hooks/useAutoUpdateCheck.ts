import { useEffect } from 'react';
import apiClient from '../api/client';

const STORAGE_KEY = 'rpg-editor-last-update-check';
const ONE_DAY_MS = 86_400_000;
const REPO = 'gosuni2025/rpgmaker-mv-editor';

export function useAutoUpdateCheck(onUpdateFound: () => void) {
  useEffect(() => {
    const last = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
    if (Date.now() - last < ONE_DAY_MS) return;

    const timer = setTimeout(async () => {
      try {
        const info = await apiClient.get<{ type: string; version?: string; commitDate?: string }>('/version/info');
        let hasUpdate = false;

        if (info.type === 'release' && info.version) {
          const ghRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (ghRes.ok) {
            const gh = await ghRes.json();
            const latestTag: string = gh.tag_name ?? '';
            const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
            const [aMaj, aMin, aPatch] = parse(info.version);
            const [bMaj, bMin, bPatch] = parse(latestTag);
            hasUpdate = aMaj < bMaj || (aMaj === bMaj && (aMin < bMin || (aMin === bMin && (aPatch ?? 0) < (bPatch ?? 0))));
          }
        } else if (info.type === 'git' && info.commitDate) {
          const ghRes = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=main&per_page=1`, {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (ghRes.ok) {
            const gh = await ghRes.json();
            const latestDate: string = gh[0]?.commit?.committer?.date ?? '';
            hasUpdate = !!latestDate && info.commitDate < latestDate;
          }
        }

        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        if (hasUpdate) onUpdateFound();
      } catch {
        // 자동 체크 실패는 무시
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [onUpdateFound]);
}
