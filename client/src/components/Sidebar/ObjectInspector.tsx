import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import './InspectorPanel.css';

export default function ObjectInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const updateObject = useEditorStore((s) => s.updateObject);
  const deleteObject = useEditorStore((s) => s.deleteObject);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);

  const objects = currentMap?.objects;
  const selectedObj = selectedObjectId != null && objects
    ? objects.find((o) => o.id === selectedObjectId)
    : null;

  if (!selectedObj) {
    return (
      <div className="light-inspector">
        <div style={{ color: '#666', fontSize: 12, padding: 8 }}>오브젝트를 선택하세요</div>
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
