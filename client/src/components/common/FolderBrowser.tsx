import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';
import './FolderBrowser.css';

interface BrowseResult {
  path: string;
  parent: string;
  dirs: string[];
  isRpgProject: boolean;
}

export interface FolderBrowserProps {
  /** 초기 경로 (비어있으면 서버 기본 경로) */
  initialPath?: string;
  /** 현재 경로가 변경될 때 호출 */
  onPathChange?: (path: string, isRpgProject: boolean) => void;
  /** 폴더를 선택(더블클릭)했을 때 호출 */
  onSelect?: (path: string) => void;
  /** 컴포넌트 마운트 시 자동으로 browse 실행 (기본 true) */
  autoLoad?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 추가 스타일 */
  style?: React.CSSProperties;
}

export default function FolderBrowser({
  initialPath = '',
  onPathChange,
  onSelect,
  autoLoad = true,
  className,
  style,
}: FolderBrowserProps) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [dirs, setDirs] = useState<string[]>([]);
  const [isRpgProject, setIsRpgProject] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderInputRef = useRef<HTMLInputElement>(null);

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
      onPathChange?.(res.path, res.isRpgProject);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onPathChange]);

  useEffect(() => {
    if (autoLoad) {
      browse(initialPath);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (newFolderMode) {
      newFolderInputRef.current?.focus();
    }
  }, [newFolderMode]);

  const handleReveal = async () => {
    if (!currentPath) return;
    try {
      await apiClient.post('/project/reveal', { path: currentPath });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleNewFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setNewFolderMode(false);
      return;
    }
    try {
      await apiClient.post('/project/mkdir', { path: currentPath, name });
      setNewFolderMode(false);
      setNewFolderName('');
      await browse(currentPath);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const cls = ['folder-browser', className].filter(Boolean).join(' ');

  return (
    <div className={cls} style={style}>
      <div className="folder-browser-path-bar">
        <button
          className="folder-browser-nav-btn"
          onClick={() => browse(parentPath)}
          disabled={currentPath === parentPath}
          title={t('openProject.parentFolder')}
        >
          ↑
        </button>
        <div className="folder-browser-path-text">{currentPath}</div>
        <button
          className="folder-browser-nav-btn"
          onClick={handleReveal}
          disabled={!currentPath}
          title={t('folderBrowser.openInExplorer')}
        >
          ⎋
        </button>
        <button
          className="folder-browser-nav-btn"
          onClick={() => { setNewFolderMode(true); setNewFolderName(''); setError(''); }}
          title={t('folderBrowser.newFolder')}
        >
          +
        </button>
      </div>

      <div className="folder-browser-list">
        {loading && <div className="folder-browser-loading">{t('openProject.loading')}</div>}
        {error && <div className="folder-browser-error">{error}</div>}
        {newFolderMode && (
          <div className="folder-browser-item folder-browser-new-folder">
            <span className="folder-browser-icon">📁</span>
            <input
              ref={newFolderInputRef}
              className="folder-browser-new-input"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewFolder();
                if (e.key === 'Escape') { setNewFolderMode(false); setNewFolderName(''); }
              }}
              onBlur={handleNewFolder}
              placeholder={t('folderBrowser.newFolderPlaceholder')}
            />
          </div>
        )}
        {!loading &&
          dirs.map((dir) => (
            <div
              key={dir}
              className="folder-browser-item"
              onClick={() => browse(currentPath + '/' + dir)}
              onDoubleClick={() => onSelect?.(currentPath + '/' + dir)}
            >
              <span className="folder-browser-icon">📁</span>
              <span>{dir}</span>
            </div>
          ))}
        {!loading && dirs.length === 0 && !newFolderMode && !error && (
          <div className="folder-browser-empty">{t('openProject.noSubfolders')}</div>
        )}
      </div>
    </div>
  );
}
