import React, { useState, useEffect, useCallback } from 'react';
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
      </div>

      <div className="folder-browser-list">
        {loading && <div className="folder-browser-loading">{t('openProject.loading')}</div>}
        {error && <div className="folder-browser-error">{error}</div>}
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
        {!loading && dirs.length === 0 && !error && (
          <div className="folder-browser-empty">{t('openProject.noSubfolders')}</div>
        )}
      </div>
    </div>
  );
}
