import React, { useState } from 'react';
import useEditorStore from '../../store/useEditorStore';

interface Props {
  onClose: () => void;
  onCreated: (sceneId: string) => void;
}

export default function UIEditorNewSceneDialog({ onClose, onCreated }: Props) {
  const [sceneId, setSceneId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [baseScene, setBaseScene] = useState<'Base' | 'MenuBase'>('MenuBase');
  const [error, setError] = useState('');

  const customScenes = useEditorStore((s) => s.customScenes);
  const addCustomScene = useEditorStore((s) => s.addCustomScene);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);

  const handleCreate = async () => {
    const id = sceneId.trim();
    if (!id) { setError('ID를 입력해주세요'); return; }
    if (!/^[a-z][a-z0-9_]*$/.test(id)) { setError('ID는 영문 소문자, 숫자, 언더스코어만 사용 가능합니다 (소문자로 시작)'); return; }
    if (customScenes.scenes[id]) { setError('이미 존재하는 ID입니다'); return; }

    addCustomScene({
      id,
      displayName: displayName.trim() || id,
      baseScene,
      prepareArgs: [],
      windows: [],
      windowLinks: {},
    });

    // 저장 후 콜백
    setTimeout(async () => {
      await saveCustomScenes();
      onCreated(id);
      onClose();
    }, 0);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ minWidth: 400, minHeight: 'auto', padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', color: '#ddd' }}>새 커스텀 씬</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>씬 ID (영문 소문자)</label>
          <input
            style={{ width: '100%', background: '#3c3c3c', border: '1px solid #555', color: '#ddd', padding: '6px 8px', borderRadius: 2, boxSizing: 'border-box' }}
            value={sceneId}
            onChange={(e) => { setSceneId(e.target.value); setError(''); }}
            placeholder="my_menu"
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>표시 이름</label>
          <input
            style={{ width: '100%', background: '#3c3c3c', border: '1px solid #555', color: '#ddd', padding: '6px 8px', borderRadius: 2, boxSizing: 'border-box' }}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="나의 메뉴"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>기반 씬</label>
          <select
            style={{ width: '100%', background: '#3c3c3c', border: '1px solid #555', color: '#ddd', padding: '6px 8px', borderRadius: 2 }}
            value={baseScene}
            onChange={(e) => setBaseScene(e.target.value as 'Base' | 'MenuBase')}
          >
            <option value="MenuBase">MenuBase (배경에 맵 표시)</option>
            <option value="Base">Base (빈 배경)</option>
          </select>
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
            onClick={handleCreate}
          >
            만들기
          </button>
        </div>
      </div>
    </div>
  );
}
