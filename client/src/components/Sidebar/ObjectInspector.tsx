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
  const [showAnchorHelp, setShowAnchorHelp] = useState(false);

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

  const isImageObj = !!selectedObj.imageName;
  const anchorY = selectedObj.anchorY ?? 1.0;

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

      {/* Image preview with anchor marker (이미지 오브젝트 전용) */}
      {isImageObj && (
        <div className="light-inspector-section">
          <div className="light-inspector-title">이미지</div>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img
              src={`/api/resources/pictures/${selectedObj.imageName}.png`}
              alt={selectedObj.imageName}
              style={{ maxWidth: '100%', maxHeight: 120, imageRendering: 'pixelated', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                const marker = img.parentElement?.querySelector('.anchor-marker') as HTMLElement;
                if (marker) {
                  marker.style.left = `${img.clientWidth / 2}px`;
                  marker.style.top = `${img.clientHeight * anchorY}px`;
                }
              }}
            />
            <div
              className="anchor-marker"
              style={{
                position: 'absolute',
                width: 12, height: 12,
                borderRadius: '50%',
                background: 'rgba(255, 50, 50, 0.8)',
                border: '2px solid #ffcc00',
                transform: 'translate(-50%, -50%)',
                left: '50%',
                top: `${anchorY * 100}%`,
                pointerEvents: 'none',
                boxShadow: '0 0 4px rgba(0,0,0,0.5)',
              }}
            />
          </div>
        </div>
      )}

      {/* Anchor Y (이미지 오브젝트 전용) */}
      {isImageObj && (
        <div className="light-inspector-section">
          <div className="light-inspector-title">
            앵커
            <button
              className="sky-type-help"
              style={{ marginLeft: 6 }}
              onClick={() => setShowAnchorHelp(!showAnchorHelp)}
              title="앵커 도움말"
            >?</button>
          </div>
          {showAnchorHelp && (
            <div className="sky-help-popup" onClick={() => setShowAnchorHelp(false)}>
              <strong>앵커</strong>는 3D 모드에서 이미지가 타일 맵과 수직으로 세워질 때의 <strong>기준점</strong>입니다.<br/><br/>
              <strong>1.0 (하단)</strong>: 이미지 하단이 지면에 닿음 — 나무, 건물 등<br/>
              <strong>0.5 (중앙)</strong>: 이미지 중심이 지면 높이 — 공중 부유 오브젝트<br/>
              <strong>0.0 (상단)</strong>: 이미지 상단이 지면 높이<br/><br/>
              프리뷰의 <span style={{ color: '#ff3232' }}>빨간 원</span>이 앵커 위치입니다.
            </div>
          )}
          <div className="light-inspector-row">
            <DragLabel label="Y" value={anchorY} step={0.05} min={0} max={1}
              onChange={(v) => updateObject(selectedObj.id, { anchorY: Math.round(v * 100) / 100 })} />
            <input type="range" className="light-inspector-slider"
              min={0} max={1} step={0.05}
              value={anchorY}
              onChange={(e) => updateObject(selectedObj.id, { anchorY: parseFloat(e.target.value) })} />
            <input type="number" className="light-inspector-input" min={0} max={1} step={0.05}
              style={{ width: 50 }}
              value={anchorY}
              onChange={(e) => updateObject(selectedObj.id, { anchorY: parseFloat(e.target.value) || 0 })} />
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button className="light-inspector-input"
              style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 10 }}
              onClick={() => updateObject(selectedObj.id, { anchorY: 1.0 })}>하단</button>
            <button className="light-inspector-input"
              style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 10 }}
              onClick={() => updateObject(selectedObj.id, { anchorY: 0.5 })}>중앙</button>
            <button className="light-inspector-input"
              style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 10 }}
              onClick={() => updateObject(selectedObj.id, { anchorY: 0.0 })}>상단</button>
          </div>
        </div>
      )}

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

      {/* Size / Scale */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">크기</div>
        <div className="light-inspector-row">
          <span className="light-inspector-label" style={{ width: 'auto' }}>{selectedObj.width} x {selectedObj.height} 타일</span>
        </div>
        {isImageObj && (() => {
          const scale = selectedObj.imageScale ?? 1.0;
          const handleScaleChange = (newScale: number) => {
            newScale = Math.max(0.1, Math.round(newScale * 100) / 100);
            // 이미지 원본 크기를 로드해서 타일 영역 재계산
            const img = new Image();
            img.onload = () => {
              const tileSize = 48;
              const scaledW = img.naturalWidth * newScale;
              const scaledH = img.naturalHeight * newScale;
              const newW = Math.max(1, Math.ceil(scaledW / tileSize));
              const newH = Math.max(1, Math.ceil(scaledH / tileSize));
              // passability 배열 리사이즈
              const oldPass = selectedObj.passability;
              const newPass: boolean[][] = [];
              for (let row = 0; row < newH; row++) {
                const newRow: boolean[] = [];
                for (let col = 0; col < newW; col++) {
                  // 기존 값 유지, 새 셀은 하단 행만 불통
                  newRow.push(oldPass[row]?.[col] ?? (row < newH - 1));
                }
                newPass.push(newRow);
              }
              // tileIds도 리사이즈 (이미지 오브젝트는 모두 빈 타일)
              const newTileIds: number[][][] = [];
              for (let row = 0; row < newH; row++) {
                const tileRow: number[][] = [];
                for (let col = 0; col < newW; col++) {
                  tileRow.push([0, 0, 0, 0]);
                }
                newTileIds.push(tileRow);
              }
              updateObject(selectedObj.id, {
                imageScale: newScale,
                width: newW,
                height: newH,
                passability: newPass,
                tileIds: newTileIds,
              });
            };
            img.onerror = () => {
              updateObject(selectedObj.id, { imageScale: newScale });
            };
            img.src = `/api/resources/pictures/${selectedObj.imageName}.png`;
          };
          return (
            <>
              <div className="light-inspector-row" style={{ marginTop: 4 }}>
                <DragLabel label="스케일" value={scale} step={0.05} min={0.1} max={10}
                  onChange={handleScaleChange} />
                <input type="range" className="light-inspector-slider"
                  min={0.1} max={5} step={0.05}
                  value={scale}
                  onChange={(e) => handleScaleChange(parseFloat(e.target.value))} />
                <input type="number" className="light-inspector-input" min={0.1} max={10} step={0.05}
                  style={{ width: 55 }}
                  value={scale}
                  onChange={(e) => handleScaleChange(parseFloat(e.target.value) || 1)} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button className="light-inspector-input"
                  style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 10 }}
                  onClick={() => handleScaleChange(0.5)}>0.5x</button>
                <button className="light-inspector-input"
                  style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 10 }}
                  onClick={() => handleScaleChange(1.0)}>1x</button>
                <button className="light-inspector-input"
                  style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 10 }}
                  onClick={() => handleScaleChange(2.0)}>2x</button>
              </div>
            </>
          );
        })()}
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
