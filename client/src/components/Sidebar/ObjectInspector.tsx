import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import useEscClose from '../../hooks/useEscClose';
import DragLabel from '../common/DragLabel';
import './InspectorPanel.css';

function ObjectImagePickerDialog({ onSelect, onClose }: {
  onSelect: (imageName: string) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  useEscClose(useCallback(() => onClose(), [onClose]));

  useEffect(() => {
    apiClient.get<string[]>('/resources/pictures').then(setFiles).catch(() => setFiles([]));
  }, []);

  const handleOk = () => {
    if (!selected) return;
    const name = selected.replace(/\.png$/i, '');
    // 이미지 로드하여 크기 얻기
    const img = new Image();
    img.onload = () => {
      onSelect(name);
      onClose();
    };
    img.onerror = () => {
      onSelect(name);
      onClose();
    };
    img.src = `/api/resources/pictures/${selected}`;
  };

  return (
    <div className="modal-overlay">
      <div className="image-picker-dialog">
        <div className="image-picker-header">이미지로 오브젝트 생성</div>
        <div className="image-picker-body">
          <div className="image-picker-list">
            {files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f)).map(f => {
              const name = f.replace(/\.(png|jpg|jpeg|webp)$/i, '');
              return (
                <div
                  key={f}
                  className={`image-picker-item${selected === f ? ' selected' : ''}`}
                  onClick={() => setSelected(f)}
                >
                  {name}
                </div>
              );
            })}
          </div>
          <div className="image-picker-preview-area">
            {selected && (
              <img
                src={`/api/resources/pictures/${selected}`}
                alt={selected}
                style={{ maxWidth: '100%', maxHeight: 300, imageRendering: 'pixelated' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
        </div>
        <div style={{ color: '#888', fontSize: '0.85em', padding: '4px 12px' }}>img/pictures 폴더의 이미지 파일을 오브젝트로 생성합니다.</div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => {
            apiClient.post('/resources/pictures/open-folder', {}).catch(() => {});
          }} style={{ marginRight: 'auto' }}>폴더 열기</button>
          <button className="db-btn" onClick={handleOk} disabled={!selected}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

export default function ObjectInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const updateObject = useEditorStore((s) => s.updateObject);
  const deleteObject = useEditorStore((s) => s.deleteObject);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const addObjectFromImage = useEditorStore((s) => s.addObjectFromImage);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const objects = currentMap?.objects;
  const selectedObj = selectedObjectId != null && objects
    ? objects.find((o) => o.id === selectedObjectId)
    : null;

  const handleImageSelect = (imageName: string) => {
    // 이미지 크기를 얻어서 오브젝트 생성
    const img = new Image();
    img.onload = () => {
      addObjectFromImage(imageName, img.naturalWidth, img.naturalHeight);
    };
    img.onerror = () => {
      // 크기를 알 수 없으면 기본 1x1 타일
      addObjectFromImage(imageName, 48, 48);
    };
    img.src = `/api/resources/pictures/${imageName}.png`;
  };

  if (!selectedObj) {
    return (
      <div className="light-inspector">
        <div style={{ color: '#666', fontSize: 12, padding: 8 }}>오브젝트를 선택하세요</div>
        <div style={{ padding: '0 8px' }}>
          <button
            className="camera-zone-action-btn"
            onClick={() => setShowImagePicker(true)}
          >
            이미지로 오브젝트 생성
          </button>
        </div>
        {showImagePicker && (
          <ObjectImagePickerDialog
            onSelect={handleImageSelect}
            onClose={() => setShowImagePicker(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="light-inspector">
      {/* Header */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">오브젝트 #{selectedObj.id}</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">이름</span>
          <input
            type="text"
            className="light-inspector-input"
            style={{ width: '100%' }}
            value={selectedObj.name}
            onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })}
          />
        </div>
      </div>

      {/* Position */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">위치</div>
        <div className="light-inspector-row">
          <DragLabel label="X" value={selectedObj.x} step={1}
            onChange={(v) => updateObject(selectedObj.id, { x: Math.round(v) })} />
          <input type="number" className="light-inspector-input"
            value={selectedObj.x}
            onChange={(e) => updateObject(selectedObj.id, { x: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="Y" value={selectedObj.y} step={1}
            onChange={(v) => updateObject(selectedObj.id, { y: Math.round(v) })} />
          <input type="number" className="light-inspector-input"
            value={selectedObj.y}
            onChange={(e) => updateObject(selectedObj.id, { y: parseInt(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Z Height */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">Z 높이</div>
        <div className="light-inspector-row">
          <DragLabel label="높이" value={selectedObj.zHeight} step={0.5} min={0} max={200}
            onChange={(v) => updateObject(selectedObj.id, { zHeight: v })} />
          <input type="number" className="light-inspector-input" min={0} max={200} step={0.5}
            value={selectedObj.zHeight}
            onChange={(e) => updateObject(selectedObj.id, { zHeight: parseFloat(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Size info */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">크기</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label" style={{ width: 'auto' }}>{selectedObj.width} x {selectedObj.height} 타일</span>
        </div>
      </div>

      {/* Passability */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">통행 설정</div>
        <div className="passability-grid" style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${selectedObj.width}, 24px)`,
          gap: 2,
          marginBottom: 6,
        }}>
          {selectedObj.passability.map((row, ri) =>
            row.map((passable, ci) => (
              <div
                key={`${ri}-${ci}`}
                className={`passability-cell ${passable ? 'passable' : 'impassable'}`}
                onClick={() => {
                  const newPass = selectedObj.passability.map((r, rr) =>
                    r.map((v, cc) => (rr === ri && cc === ci ? !v : v))
                  );
                  updateObject(selectedObj.id, { passability: newPass });
                }}
                title={passable ? '통행 가능 (클릭하여 변경)' : '통행 불가 (클릭하여 변경)'}
              />
            ))
          )}
        </div>
        <button
          className="light-inspector-input"
          style={{ width: '100%', cursor: 'pointer', textAlign: 'center' }}
          onClick={() => {
            const newPass: boolean[][] = [];
            for (let row = 0; row < selectedObj.height; row++) {
              newPass.push(Array(selectedObj.width).fill(row < selectedObj.height - 1));
            }
            updateObject(selectedObj.id, { passability: newPass });
          }}
        >
          스마트 초기화
        </button>
      </div>

      {/* Delete */}
      <button
        className="light-inspector-delete"
        onClick={() => {
          deleteObject(selectedObj.id);
          setSelectedObjectId(null);
        }}
      >
        삭제
      </button>
    </div>
  );
}
