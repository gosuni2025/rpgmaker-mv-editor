import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';

interface AutoSaveSettings {
  enabled: boolean;
  intervalMinutes: number;
  gitCommit: boolean;
  gitAddAll: boolean;
}

interface GitCommitResponse {
  success: boolean;
  committed: boolean;
  message: string;
  stats?: { added: number; modified: number; deleted: number };
  files?: string[];
}

export default function useAutoSave() {
  const { t } = useTranslation();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef<AutoSaveSettings | null>(null);

  const doAutoSave = useCallback(async () => {
    if (document.hidden) return;
    const { currentMapId, currentMap, showToast } = useEditorStore.getState();
    if (!currentMapId || !currentMap) return;

    try {
      // Save current map
      await apiClient.put(`/maps/${currentMapId}`, currentMap);

      const settings = settingsRef.current;
      let gitInfo = '';

      // Git commit if enabled
      if (settings?.gitCommit) {
        try {
          const res = await apiClient.post<GitCommitResponse>('/project/git-commit', { addAll: settings.gitAddAll });
          if (res.committed && res.stats) {
            const parts: string[] = [];
            if (res.stats.added > 0) parts.push(t('options.gitStatsAdded', { count: res.stats.added }));
            if (res.stats.modified > 0) parts.push(t('options.gitStatsModified', { count: res.stats.modified }));
            if (res.stats.deleted > 0) parts.push(t('options.gitStatsDeleted', { count: res.stats.deleted }));
            if (parts.length > 0) {
              gitInfo = ` (Git: ${parts.join(', ')})`;
            }
          }
        } catch {
          // Git commit failed silently
        }
      }

      showToast(t('options.autoSaved') + gitInfo);
    } catch {
      // Save failed silently
    }
  }, [t]);

  const startTimer = useCallback((settings: AutoSaveSettings) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!settings.enabled) return;

    settingsRef.current = settings;
    const intervalMs = settings.intervalMinutes * 60 * 1000;
    timerRef.current = setInterval(doAutoSave, intervalMs);
  }, [doAutoSave]);

  // Load settings and start timer
  useEffect(() => {
    let mounted = true;

    const loadAndStart = async () => {
      try {
        const data = await apiClient.get<{ autoSave?: AutoSaveSettings }>('/settings');
        if (!mounted) return;
        const settings = data.autoSave || {
          enabled: true,
          intervalMinutes: 5,
          gitCommit: true,
          gitAddAll: true,
        };
        startTimer(settings);
      } catch {
        // Settings load failed
      }
    };

    loadAndStart();

    // Listen for settings changes (reload on settings save)
    const handleSettingsChange = () => {
      loadAndStart();
    };
    window.addEventListener('autosave-settings-changed', handleSettingsChange);

    // 탭으로 돌아올 때 타이머 리셋 (백그라운드에서 쌓인 tick 방지)
    const handleVisibilityChange = () => {
      if (!document.hidden && settingsRef.current) {
        startTimer(settingsRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      window.removeEventListener('autosave-settings-changed', handleSettingsChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startTimer]);
}
