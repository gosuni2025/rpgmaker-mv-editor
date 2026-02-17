import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import './ObjectListPanel.css';

export default function ObjectListPanel() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const selectedObjectIds = useEditorStore((s) => s.selectedObjectIds);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const setSelectedObjectIds = useEditorStore((s) => s.setSelectedObjectIds);
  const deleteObject = useEditorStore((s) => s.deleteObject);
  const deleteObjects = useEditorStore((s) => s.deleteObjects);

  const objects = currentMap?.objects;

  const handleItemClick = (objId: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (selectedObjectIds.includes(objId)) {
        const newIds = selectedObjectIds.filter(id => id !== objId);
        setSelectedObjectIds(newIds);
        setSelectedObjectId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
      } else {
        const newIds = [...selectedObjectIds, objId];
        setSelectedObjectIds(newIds);
        setSelectedObjectId(objId);
      }
    } else {
      if (selectedObjectIds.length === 1 && selectedObjectIds[0] === objId) {
        setSelectedObjectIds([]);
        setSelectedObjectId(null);
      } else {
        setSelectedObjectIds([objId]);
        setSelectedObjectId(objId);
      }
    }
  };

  const handleDeleteSelected = () => {
    if (selectedObjectIds.length > 1) {
      deleteObjects(selectedObjectIds);
    } else if (selectedObjectId != null) {
      deleteObject(selectedObjectId);
      setSelectedObjectId(null);
    }
    setSelectedObjectIds([]);
    setSelectedObjectId(null);
  };

  return (
    <div className="object-list-panel">
      <div className="light-palette-section-title">
        오브젝트 목록
        {selectedObjectIds.length > 0 && (
          <span
            className="object-list-deselect"
            onClick={() => { setSelectedObjectIds([]); setSelectedObjectId(null); }}
          >
            선택 해제
          </span>
        )}
      </div>
      <div className="object-list">
        {objects && objects.length > 0 ? (
          objects.map((obj) => (
            <div
              key={obj.id}
              className={`object-list-item${selectedObjectIds.includes(obj.id) ? ' selected' : ''}${obj.visible === false ? ' hidden-obj' : ''}`}
              onClick={(e) => handleItemClick(obj.id, e)}
            >
              <span className="object-list-item-icon">
                {obj.imageName ? '\u{1F5BC}' : obj.animationId ? '\u{2728}' : '\u{1F9F1}'}
              </span>
              <span className="object-list-item-name">
                #{obj.id} {obj.name}
              </span>
              <span className="object-list-item-info">
                {obj.imageName
                  ? obj.imageName
                  : obj.animationId
                    ? `#${obj.animationId}`
                    : `${obj.width}x${obj.height}`
                }
              </span>
            </div>
          ))
        ) : (
          <div className="object-list-empty">
            맵에서 타일을 칠하거나 이미지를 추가하여<br />오브젝트를 생성하세요
          </div>
        )}
      </div>

      {selectedObjectIds.length > 0 && (
        <div className="object-list-actions">
          <button
            className="camera-zone-action-btn delete"
            onClick={handleDeleteSelected}
          >
            {selectedObjectIds.length > 1 ? `선택 오브젝트 ${selectedObjectIds.length}개 삭제` : '선택 오브젝트 삭제'}
          </button>
        </div>
      )}
    </div>
  );
}
