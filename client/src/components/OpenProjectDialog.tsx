import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

const RECENT_KEY = 'rpg-editor-recent-projects';

interface RecentProject {
  path: string;
  name: string;
  time: number;
}

interface BrowseResult {
  path: string;
  parent: string;
  dirs: string[];
  isRpgProject: boolean;
}

function getRecentProjects(): RecentProject[] {
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

interface OpenProjectDialogProps {
  onOpen: (path: string) => void;
  onClose: () => void;
}

export default function OpenProjectDialog({ onOpen, onClose }: OpenProjectDialogProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [dirs, setDirs] = useState<string[]>([]);
  const [parentPath, setParentPath] = useState('');
  const [isRpgProject, setIsRpgProject] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'browse' | 'recent'>('browse');

  const browse = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError('');
    try {
      const query = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
      const res = await apiClient.get<BrowseResult>(`/project/browse${query}`);
      setCurrentPath(res.path);
      setParentPath(res.parent);
      setDirs(res.dirs);
      setIsRpgProject(res.isRpgProject);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    browse('');
  }, [browse]);

  const handleOpen = () => {
    if (currentPath) {
      onOpen(currentPath);
    }
  };

  const recentProjects = getRecentProjects();

  return (
    <div className="db-dialog-overlay" onClick={onClose}>
      <div className="open-project-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="db-dialog-header">프로젝트 열기</div>

        <div className="opd-tabs">
          <button
            className={`opd-tab${tab === 'browse' ? ' active' : ''}`}
            onClick={() => setTab('browse')}
          >
            폴더 탐색
          </button>
          <button
            className={`opd-tab${tab === 'recent' ? ' active' : ''}`}
            onClick={() => setTab('recent')}
          >
            최근 프로젝트
          </button>
        </div>

        {tab === 'browse' && (
          <div className="opd-body">
            <div className="opd-path-bar">
              <button
                className="opd-nav-btn"
                onClick={() => browse(parentPath)}
                disabled={currentPath === parentPath}
                title="상위 폴더"
              >
                ↑
              </button>
              <div className="opd-path-text">{currentPath}</div>
            </div>

            <div className="opd-dir-list">
              {loading && <div className="opd-loading">불러오는 중...</div>}
              {error && <div className="opd-error">{error}</div>}
              {!loading &&
                dirs.map((dir) => (
                  <div
                    key={dir}
                    className="opd-dir-item"
                    onDoubleClick={() => browse(currentPath + '/' + dir)}
                  >
                    <span className="opd-dir-icon">📁</span>
                    <span>{dir}</span>
                  </div>
                ))}
              {!loading && dirs.length === 0 && !error && (
                <div className="opd-empty">하위 폴더 없음</div>
              )}
            </div>

            {isRpgProject && (
              <div className="opd-project-badge">
                RPG Maker MV 프로젝트 감지됨
              </div>
            )}
          </div>
        )}

        {tab === 'recent' && (
          <div className="opd-body">
            <div className="opd-dir-list">
              {recentProjects.length === 0 && (
                <div className="opd-empty">최근 프로젝트 없음</div>
              )}
              {recentProjects.map((p) => (
                <div
                  key={p.path}
                  className="opd-dir-item"
                  onDoubleClick={() => onOpen(p.path)}
                  onClick={() => {
                    setCurrentPath(p.path);
                    setTab('browse');
                    browse(p.path);
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
            열기
          </button>
          <button className="db-btn" onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
