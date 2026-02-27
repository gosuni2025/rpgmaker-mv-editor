import React, { useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { CustomSceneDefV2 } from '../../store/uiEditorTypes';

interface Props {
  sourceScene: CustomSceneDefV2;
  onClose: () => void;
  onDuplicated: (newSceneId: string) => void;
}

export default function UIEditorDuplicateSceneDialog({ sourceScene, onClose, onDuplicated }: Props) {
  const [sceneId, setSceneId] = useState(`${sourceScene.id}_copy`);
  const [displayName, setDisplayName] = useState(`${sourceScene.displayName} 복사본`);
  const [error, setError] = useState('');

  const customScenes = useEditorStore((s) => s.customScenes);
  const addCustomScene = useEditorStore((s) => s.addCustomScene);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);

  const handleDuplicate = async () => {
    const id = sceneId.trim();
    if (!id) { setError('ID를 입력해주세요'); return; }
    if (!/^[a-z][a-z0-9_]*$/.test(id)) { setError('ID는 영문 소문자, 숫자, 언더스코어만 사용 가능합니다 (소문자로 시작)'); return; }
    if (customScenes.scenes[id]) { setError('이미 존재하는 ID입니다'); return; }

    // 소스 씬 deep copy 후 id/displayName 교체
    const duplicated: CustomSceneDefV2 = JSON.parse(JSON.stringify(sourceScene));
    duplicated.id = id;
    duplicated.displayName = displayName.trim() || id;

    // addCustomScene은 CustomSceneDef를 받으므로 windows/windowLinks 기본값 보장
    const toAdd = { ...duplicated, windows: duplicated.windows ?? [], windowLinks: duplicated.windowLinks ?? {} };
    addCustomScene(toAdd);

    setTimeout(async () => {
      await saveCustomScenes();
      onDuplicated(id);
      onClose();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleDuplicate();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ minWidth: 400, minHeight: 'auto', padding: 20 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 style={{ margin: '0 0 16px', color: '#ddd' }}>씬 복제</h3>
        <div style={{ marginBottom: 12, fontSize: 12, color: '#aaa' }}>
          <strong style={{ color: '#bbb' }}>{sourceScene.displayName}</strong> 씬을 복제합니다.
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>새 씬 ID (영문 소문자)</label>
          <input
            style={{ width: '100%', background: '#3c3c3c', border: '1px solid #555', color: '#ddd', padding: '6px 8px', borderRadius: 2, boxSizing: 'border-box' }}
            value={sceneId}
            onChange={(e) => { setSceneId(e.target.value); setError(''); }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>표시 이름</label>
          <input
            style={{ width: '100%', background: '#3c3c3c', border: '1px solid #555', color: '#ddd', padding: '6px 8px', borderRadius: 2, boxSizing: 'border-box' }}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        {error && <div style={{ color: '#f88', fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            style={{ padding: '6px 16px', background: '#555', border: 'none', color: '#ddd', borderRadius: 2, cursor: 'pointer' }}
            onClick={onClose}
          >
            취소
          </button>
          <button
            style={{ padding: '6px 16px', background: '#2675bf', border: 'none', color: '#fff', borderRadius: 2, cursor: 'pointer' }}
            onClick={handleDuplicate}
          >
            복제
          </button>
        </div>
      </div>
    </div>
  );
}
