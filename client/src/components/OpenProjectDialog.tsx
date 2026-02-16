import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEscClose from '../hooks/useEscClose';
import FolderBrowser from './common/FolderBrowser';
import './OpenProjectDialog.css';

const RECENT_KEY = 'rpg-editor-recent-projects';

export interface RecentProject {
  path: string;
  name: string;
  time: number;
}

export function getRecentProjects(): RecentProject[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addRecentProject(path: string, name: string): void {
  const recent = getRecentProjects().filter((p) => p.path !== path);
  recent.unshift({ path, name, time: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
}

export function removeRecentProject(path: string): void {
  const recent = getRecentProjects().filter((p) => p.path !== path);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

interface OpenProjectDialogProps {
  onOpen: (path: string) => void;
  onClose: () => void;
}

export default function OpenProjectDialog({ onOpen, onClose }: OpenProjectDialogProps) {
  const { t } = useTranslation();
  useEscClose(onClose);
  const [currentPath, setCurrentPath] = useState('');
  const [isRpgProject, setIsRpgProject] = useState(false);
  const [tab, setTab] = useState<'browse' | 'recent'>('browse');
  const [browseInitialPath, setBrowseInitialPath] = useState('');
  const [browseKey, setBrowseKey] = useState(0);

  const handlePathChange = useCallback((path: string, isRpg: boolean) => {
    setCurrentPath(path);
    setIsRpgProject(isRpg);
  }, []);

  const handleOpen = () => {
    if (currentPath) {
      onOpen(currentPath);
    }
  };

  const recentProjects = getRecentProjects();

  return (
    <div className="db-dialog-overlay">
      <div className="open-project-dialog">
        <div className="db-dialog-header">{t('openProject.title')}</div>

        <div className="opd-tabs">
          <button
            className={`opd-tab${tab === 'browse' ? ' active' : ''}`}
            onClick={() => setTab('browse')}
          >
            {t('openProject.browseFolders')}
          </button>
          <button
            className={`opd-tab${tab === 'recent' ? ' active' : ''}`}
            onClick={() => setTab('recent')}
          >
            {t('openProject.recentProjects')}
          </button>
        </div>

        {tab === 'browse' && (
          <div className="opd-body">
            <FolderBrowser
              key={browseKey}
              initialPath={browseInitialPath}
              onPathChange={handlePathChange}
              onSelect={(path) => onOpen(path)}
              style={{ flex: 1 }}
            />

            {isRpgProject && (
              <div className="opd-project-badge">
                {t('openProject.projectDetected')}
              </div>
            )}
          </div>
        )}

        {tab === 'recent' && (
          <div className="opd-body">
            <div className="opd-dir-list">
              {recentProjects.length === 0 && (
                <div className="opd-empty">{t('openProject.noRecent')}</div>
              )}
              {recentProjects.map((p) => (
                <div
                  key={p.path}
                  className="opd-dir-item"
                  onDoubleClick={() => onOpen(p.path)}
                  onClick={() => {
                    setBrowseInitialPath(p.path);
                    setBrowseKey((k) => k + 1);
                    setTab('browse');
                  }}
                >
                  <span className="opd-dir-icon">📂</span>
                  <div className="opd-recent-info">
                    <span className="opd-recent-name">{p.name || p.path.split('/').pop()}</span>
                    <span className="opd-recent-path">{p.path}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="db-dialog-footer">
          <button
            className="db-btn"
            onClick={handleOpen}
            disabled={!currentPath}
            style={isRpgProject ? { background: '#0078d4', borderColor: '#0078d4' } : {}}
          >
            {t('openProject.open')}
          </button>
          <button className="db-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
