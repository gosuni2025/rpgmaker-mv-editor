import React, { useState, useCallback } from 'react';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';

export default function NewProjectDialog() {
  const setShow = useEditorStore((s) => s.setShowNewProjectDialog);
  const openProject = useEditorStore((s) => s.openProject);
  const [projectName, setProjectName] = useState('');
  const [gameTitle, setGameTitle] = useState('');
  const [savePath, setSavePath] = useState('');
  const [browseDirs, setBrowseDirs] = useState<string[]>([]);
  const [currentBrowsePath, setCurrentBrowsePath] = useState('');
  const [showBrowse, setShowBrowse] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const browse = useCallback(async (dirPath: string) => {
    try {
      const query = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
      const res = await apiClient.get<{ path: string; parent: string; dirs: string[] }>(`/project/browse${query}`);
      setCurrentBrowsePath(res.path);
      setBrowseDirs(res.dirs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const handleCreate = async () => {
    if (!projectName.trim() || !savePath.trim()) {
      setError('프로젝트 이름과 저장 경로를 입력해주세요');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const fullPath = `${savePath}/${projectName}`;
      await apiClient.post('/project/new', { name: projectName, gameTitle: gameTitle || projectName, path: fullPath });
      await openProject(fullPath);
      setShow(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="db-dialog-overlay" onClick={() => setShow(false)}>
      <div className="db-dialog" style={{ width: 500, height: 'auto', minHeight: 0 }} onClick={e => e.stopPropagation()}>
        <div className="db-dialog-header">새 프로젝트</div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="db-form" style={{ gap: 4 }}>
            <span style={{ color: '#aaa', fontSize: 12 }}>프로젝트 이름</span>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="MyGame" style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '6px 8px', color: '#ddd', fontSize: 13 }} />
          </label>
          <label className="db-form" style={{ gap: 4 }}>
            <span style={{ color: '#aaa', fontSize: 12 }}>게임 타이틀</span>
            <input type="text" value={gameTitle} onChange={e => setGameTitle(e.target.value)}
              placeholder="My RPG Game" style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '6px 8px', color: '#ddd', fontSize: 13 }} />
          </label>
          <div>
            <span style={{ color: '#aaa', fontSize: 12 }}>저장 위치</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input type="text" value={savePath} onChange={e => setSavePath(e.target.value)} readOnly
                style={{ flex: 1, background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '6px 8px', color: '#ddd', fontSize: 13 }} />
              <button className="db-btn" onClick={() => { setShowBrowse(true); browse(''); }}>찾아보기</button>
            </div>
          </div>
          {showBrowse && (
            <div style={{ border: '1px solid #555', borderRadius: 3, background: '#333', maxHeight: 200, overflow: 'auto' }}>
              <div style={{ padding: '4px 8px', fontSize: 11, color: '#888', borderBottom: '1px solid #444', display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="db-btn-small" onClick={() => browse(currentBrowsePath + '/..')}>↑</button>
                <span>{currentBrowsePath}</span>
              </div>
              {browseDirs.map(d => (
                <div key={d} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
                  onClick={() => browse(currentBrowsePath + '/' + d)}
                  onDoubleClick={() => { setSavePath(currentBrowsePath + '/' + d); setShowBrowse(false); }}>
                  📁 {d}
                </div>
              ))}
              <div style={{ padding: 4, borderTop: '1px solid #444', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button className="db-btn-small" onClick={() => { setSavePath(currentBrowsePath); setShowBrowse(false); }}>이 폴더 선택</button>
              </div>
            </div>
          )}
          {error && <div style={{ color: '#e55', fontSize: 12 }}>{error}</div>}
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleCreate} disabled={creating}
            style={{ background: '#0078d4', borderColor: '#0078d4' }}>
            {creating ? '생성 중...' : '생성'}
          </button>
          <button className="db-btn" onClick={() => setShow(false)}>취소</button>
        </div>
      </div>
    </div>
  );
}
