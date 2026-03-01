import React, { useState, useCallback, useRef } from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import AnimationPickerDialog from '../EventEditor/AnimationPickerDialog';
import ObjectImagePickerDialog from './ObjectImagePickerDialog';
import ObjectTilePickerDialog from './ObjectTilePickerDialog';
import { ObjectAnimSection, ObjectImagePreviewSection, ObjectImageScaleSection, ObjectShaderSection, ObjectPassabilitySection } from './ObjectInspectorSections';
import './InspectorPanel.css';

export default function ObjectInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const updateObject = useEditorStore((s) => s.updateObject);
  const deleteObject = useEditorStore((s) => s.deleteObject);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const addObjectFromImage = useEditorStore((s) => s.addObjectFromImage);
  const addObjectFromAnimation = useEditorStore((s) => s.addObjectFromAnimation);
  const setObjectBrush = useEditorStore((s) => s.setObjectBrush);
  const commitDragUndo = useEditorStore((s) => s.commitDragUndo);
  const dragSnapshotRef = useRef<any[] | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showAnimationPicker, setShowAnimationPicker] = useState(false);
  const [showTilePicker, setShowTilePicker] = useState(false);

  const onDragStart = useCallback(() => {
    dragSnapshotRef.current = useEditorStore.getState().currentMap?.objects || null;
  }, []);
  const onDragEnd = useCallback(() => {
    if (dragSnapshotRef.current) { commitDragUndo(dragSnapshotRef.current); dragSnapshotRef.current = null; }
  }, [commitDragUndo]);

  const objects = currentMap?.objects;
  const selectedObj = selectedObjectId != null && objects
    ? objects.find((o) => o.id === selectedObjectId)
    : null;

  const handleImageSelect = (imageName: string) => {
    const img = new Image();
    img.onload = () => { addObjectFromImage(imageName, img.naturalWidth, img.naturalHeight); };
    img.onerror = () => { addObjectFromImage(imageName, 48, 48); };
    img.src = `/api/resources/pictures/${imageName}.png`;
  };

  if (!selectedObj) {
    return (
      <div className="light-inspector">
        <div style={{ color: '#666', fontSize: 12, padding: 8 }}>
          <span style={{ color: '#4a4' }}>맵에서 오브젝트를 선택하세요.</span>
          <div style={{ color: '#aaa', marginTop: 8, lineHeight: 1.6 }}>
            오브젝트는 맵 위에 배치하는 3D 렌더링 요소입니다.
            런타임에서 타일맵과 별도로 관리되어, 높이(Z)와 회전 등
            3D 변환이 적용된 상태로 렌더링됩니다.
            <br /><br />
            <b>타일 오브젝트</b> — 타일셋에서 선택한 타일을 오브젝트로 배치합니다.
            <br />
            <b>외곽선 오브젝트</b> — 맵에서 타일 영역을 칠하여 오브젝트 범위를 지정합니다.
            <br />
            <b>이미지 오브젝트</b> — 이미지 파일을 직접 삽입하여 오브젝트로 사용합니다.
            <br />
            <b>애니메이션 오브젝트</b> — 데이터베이스 애니메이션을 맵에서 루프 재생합니다.
          </div>
        </div>
        <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="camera-zone-action-btn" onClick={() => setShowTilePicker(true)}>
            타일로 오브젝트 생성
          </button>
          <button className="camera-zone-action-btn" onClick={() => setShowImagePicker(true)}>
            이미지로 오브젝트 생성
          </button>
          <button className="camera-zone-action-btn" onClick={() => setShowAnimationPicker(true)}>
            애니메이션 오브젝트 생성
          </button>
        </div>
        {showTilePicker && (
          <ObjectTilePickerDialog
            onConfirm={(tiles, w, h) => { setObjectBrush(tiles, w, h); setShowTilePicker(false); }}
            onClose={() => setShowTilePicker(false)} />
        )}
        {showImagePicker && (
          <ObjectImagePickerDialog onSelect={handleImageSelect} onClose={() => setShowImagePicker(false)} />
        )}
        {showAnimationPicker && (
          <AnimationPickerDialog
            value={0}
            onChange={(animId) => {
              const w = window as any;
              const anims = w.$dataAnimations;
              const name = anims?.[animId]?.name || `Anim${animId}`;
              addObjectFromAnimation(animId, name);
            }}
            onClose={() => setShowAnimationPicker(false)}
          />
        )}
      </div>
    );
  }

  const isImageObj = !!selectedObj.imageName;
  const isAnimObj = !!selectedObj.animationId;

  return (
    <div className="light-inspector">
      {/* Header */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">오브젝트 #{selectedObj.id}</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">이름</span>
          <input type="text" className="light-inspector-input" style={{ width: '100%' }}
            value={selectedObj.name} onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })} />
        </div>
        <div className="light-inspector-row" style={{ marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
            <input type="checkbox" checked={selectedObj.visible !== false}
              onChange={(e) => updateObject(selectedObj.id, { visible: e.target.checked })} />
            화면에 표시
          </label>
          <span style={{ fontSize: 10, color: '#888', marginLeft: 'auto' }}>
            {selectedObj.visible === false ? '숨김 (충돌 비활성)' : ''}
          </span>
        </div>
      </div>

      {isAnimObj && (
        <ObjectAnimSection selectedObj={selectedObj} updateObject={updateObject}
          onDragStart={onDragStart} onDragEnd={onDragEnd}
          showAnimationPicker={showAnimationPicker} setShowAnimationPicker={setShowAnimationPicker} />
      )}

      {isImageObj && (
        <ObjectImagePreviewSection selectedObj={selectedObj} updateObject={updateObject}
          onDragStart={onDragStart} onDragEnd={onDragEnd} />
      )}

      {/* Position */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">위치</div>
        <div className="light-inspector-row">
          <DragLabel label="X" value={selectedObj.x} step={1}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateObject(selectedObj.id, { x: Math.round(v) }, true)} />
          <input type="number" className="light-inspector-input"
            value={selectedObj.x} onChange={(e) => updateObject(selectedObj.id, { x: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="light-inspector-row">
          <DragLabel label="Y" value={selectedObj.y} step={1}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateObject(selectedObj.id, { y: Math.round(v) }, true)} />
          <input type="number" className="light-inspector-input"
            value={selectedObj.y} onChange={(e) => updateObject(selectedObj.id, { y: parseInt(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Z Height */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">Z 높이</div>
        <div className="light-inspector-row">
          <DragLabel label="높이" value={selectedObj.zHeight} step={0.5} min={0} max={200}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateObject(selectedObj.id, { zHeight: v }, true)} />
          <input type="number" className="light-inspector-input" min={0} max={200} step={0.5}
            value={selectedObj.zHeight}
            onChange={(e) => updateObject(selectedObj.id, { zHeight: parseFloat(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Size */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">크기</div>
        <div className="light-inspector-row">
          <DragLabel label="W" value={selectedObj.width} step={1} min={1} max={99}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateObject(selectedObj.id, { width: Math.max(1, Math.round(v)) }, true)} />
          <input type="number" className="light-inspector-input" min={1} max={99} step={1}
            style={{ width: 50 }} value={selectedObj.width}
            onChange={(e) => updateObject(selectedObj.id, { width: Math.max(1, parseInt(e.target.value) || 1) })} />
          <DragLabel label="H" value={selectedObj.height} step={1} min={1} max={99}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateObject(selectedObj.id, { height: Math.max(1, Math.round(v)) }, true)} />
          <input type="number" className="light-inspector-input" min={1} max={99} step={1}
            style={{ width: 50 }} value={selectedObj.height}
            onChange={(e) => updateObject(selectedObj.id, { height: Math.max(1, parseInt(e.target.value) || 1) })} />
        </div>
        {isImageObj && <ObjectImageScaleSection selectedObj={selectedObj} updateObject={updateObject} />}
      </div>

      {isImageObj && <ObjectShaderSection selectedObj={selectedObj} updateObject={updateObject} />}

      <ObjectPassabilitySection selectedObj={selectedObj} updateObject={updateObject} />

      <button className="light-inspector-delete"
        onClick={() => { deleteObject(selectedObj.id); setSelectedObjectId(null); }}>삭제</button>
    </div>
  );
}
