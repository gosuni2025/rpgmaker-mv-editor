import React, { useState } from 'react';
import DragLabel from '../common/DragLabel';
import HelpButton from '../common/HelpButton';
import { ShaderEditorDialog, ShaderEntry } from '../EventEditor/shaderEditor';
import { SHADER_DEFINITIONS } from '../EventEditor/shaderDefinitions';
import AnimationPickerDialog from '../EventEditor/AnimationPickerDialog';

interface ObjSectionProps {
  selectedObj: any;
  updateObject: (id: number, partial: any, isDrag?: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

// ─── Animation Section ───
export function ObjectAnimSection({ selectedObj, updateObject, showAnimationPicker, setShowAnimationPicker }: ObjSectionProps & {
  showAnimationPicker: boolean;
  setShowAnimationPicker: (v: boolean) => void;
}) {
  return (
    <div className="light-inspector-section">
      <div className="light-inspector-title">애니메이션</div>
      <div className="light-inspector-row">
        <span style={{ fontSize: 12, color: '#ddd', flex: 1 }}>
          {String(selectedObj.animationId).padStart(4, '0')}: {(() => {
            const w = window as any;
            const anims = w.$dataAnimations;
            const anim = anims && anims[selectedObj.animationId!];
            return anim?.name || '(알 수 없음)';
          })()}
        </span>
        <button
          className="light-inspector-input"
          style={{ cursor: 'pointer', fontSize: 10, padding: '2px 8px' }}
          onClick={() => setShowAnimationPicker(true)}
        >변경</button>
      </div>
      {showAnimationPicker && (
        <AnimationPickerDialog
          value={selectedObj.animationId!}
          onChange={(animId) => {
            const w = window as any;
            const anims = w.$dataAnimations;
            const name = anims?.[animId]?.name || `Anim${animId}`;
            updateObject(selectedObj.id, { animationId: animId, name });
          }}
          onClose={() => setShowAnimationPicker(false)}
        />
      )}
      <div className="light-inspector-row" style={{ marginTop: 4 }}>
        <span className="light-inspector-label">재생 모드</span>
        <select
          className="light-inspector-input"
          style={{ flex: 1 }}
          value={selectedObj.animationLoop || 'forward'}
          onChange={(e) => updateObject(selectedObj.id, { animationLoop: e.target.value as any })}
        >
          <option value="forward">일방향 루프</option>
          <option value="pingpong">핑퐁 루프</option>
          <option value="once">원샷</option>
        </select>
      </div>
      {[
        { key: 'animationSe', label: 'SE 재생' },
        { key: 'animationPlayInEditor', label: '에디터에서 재생' },
        { key: 'animationPauseOnMessage', label: '이벤트 진행 중 일시정지' },
      ].map(({ key, label }) => (
        <div key={key} className="light-inspector-row" style={{ marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={selectedObj[key] !== false}
              onChange={(e) => updateObject(selectedObj.id, { [key]: e.target.checked })}
            />
            {label}
          </label>
        </div>
      ))}
    </div>
  );
}

// ─── Image Preview + Anchor ───
export function ObjectImagePreviewSection({ selectedObj, updateObject, onDragStart, onDragEnd }: ObjSectionProps) {
  const anchorY = selectedObj.anchorY ?? 1.0;

  return (
    <>
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
              position: 'absolute', width: 12, height: 12, borderRadius: '50%',
              background: 'rgba(255, 50, 50, 0.8)', border: '2px solid #ffcc00',
              transform: 'translate(-50%, -50%)', left: '50%', top: `${anchorY * 100}%`,
              pointerEvents: 'none', boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      </div>

      <div className="light-inspector-section">
        <div className="light-inspector-title">
          앵커
          <HelpButton placement="bottom">
            <strong>앵커</strong>는 3D 모드에서 이미지가 타일 맵과 수직으로 세워질 때의 <strong>기준점</strong>입니다.<br/><br/>
            <strong>1.0 (하단)</strong>: 이미지 하단이 지면에 닿음 — 나무, 건물 등<br/>
            <strong>0.5 (중앙)</strong>: 이미지 중심이 지면 높이 — 공중 부유 오브젝트<br/>
            <strong>0.0 (상단)</strong>: 이미지 상단이 지면 높이<br/><br/>
            프리뷰의 <span style={{ color: '#ff3232' }}>빨간 원</span>이 앵커 위치입니다.
          </HelpButton>
        </div>
        <div className="light-inspector-row">
          <DragLabel label="Y" value={anchorY} step={0.05} min={0} max={1}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onChange={(v) => updateObject(selectedObj.id, { anchorY: Math.round(v * 100) / 100 }, true)} />
          <input type="range" className="light-inspector-slider" min={0} max={1} step={0.05}
            value={anchorY} onChange={(e) => updateObject(selectedObj.id, { anchorY: parseFloat(e.target.value) })} />
          <input type="number" className="light-inspector-input" min={0} max={1} step={0.05}
            style={{ width: 50 }} value={anchorY}
            onChange={(e) => updateObject(selectedObj.id, { anchorY: parseFloat(e.target.value) || 0 })} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {[{ v: 1.0, l: '하단' }, { v: 0.5, l: '중앙' }, { v: 0.0, l: '상단' }].map(({ v, l }) => (
            <button key={v} className="light-inspector-input"
              style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 10 }}
              onClick={() => updateObject(selectedObj.id, { anchorY: v })}>{l}</button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Image Scale (inside Size section) ───
export function ObjectImageScaleSection({ selectedObj, updateObject }: Pick<ObjSectionProps, 'selectedObj' | 'updateObject'>) {
  const scale = selectedObj.imageScale ?? 1.0;

  const handleScaleChange = (newScale: number) => {
    newScale = Math.max(0.1, Math.round(newScale * 100) / 100);
    const img = new Image();
    img.onload = () => {
      const tileSize = 48;
      const scaledW = img.naturalWidth * newScale;
      const scaledH = img.naturalHeight * newScale;
      const newW = Math.max(1, Math.ceil(scaledW / tileSize));
      const newH = Math.max(1, Math.ceil(scaledH / tileSize));
      const oldPass = selectedObj.passability;
      const newPass: boolean[][] = [];
      for (let row = 0; row < newH; row++) {
        const newRow: boolean[] = [];
        for (let col = 0; col < newW; col++) {
          newRow.push(oldPass[row]?.[col] ?? (row < newH - 1));
        }
        newPass.push(newRow);
      }
      const newTileIds: number[][][] = [];
      for (let row = 0; row < newH; row++) {
        const tileRow: number[][] = [];
        for (let col = 0; col < newW; col++) {
          tileRow.push([0, 0, 0, 0]);
        }
        newTileIds.push(tileRow);
      }
      updateObject(selectedObj.id, { imageScale: newScale, width: newW, height: newH, passability: newPass, tileIds: newTileIds });
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
        <input type="range" className="light-inspector-slider" min={0.1} max={5} step={0.05}
          value={scale} onChange={(e) => handleScaleChange(parseFloat(e.target.value))} />
        <input type="number" className="light-inspector-input" min={0.1} max={10} step={0.05}
          style={{ width: 55 }} value={scale}
          onChange={(e) => handleScaleChange(parseFloat(e.target.value) || 1)} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {[0.5, 1.0, 2.0].map(v => (
          <button key={v} className="light-inspector-input"
            style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 10 }}
            onClick={() => handleScaleChange(v)}>{v}x</button>
        ))}
      </div>
    </>
  );
}

// ─── Shader Section ───
export function ObjectShaderSection({ selectedObj, updateObject }: Pick<ObjSectionProps, 'selectedObj' | 'updateObject'>) {
  const [showShaderEditor, setShowShaderEditor] = useState(false);
  const shaderList = selectedObj.shaderData || [];
  const enabledShaders = shaderList.filter((s: any) => s.enabled);

  return (
    <div className="light-inspector-section">
      <div className="light-inspector-title">셰이더</div>
      {enabledShaders.length > 0 ? (
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>
          {enabledShaders.map((s: any) => {
            const def = SHADER_DEFINITIONS.find(d => d.type === s.type);
            return def?.label || s.type;
          }).join(' + ')}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>셰이더 없음</div>
      )}
      <button className="light-inspector-input"
        style={{ width: '100%', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => setShowShaderEditor(true)}>셰이더 편집...</button>
      {enabledShaders.length > 0 && (
        <button className="light-inspector-input"
          style={{ width: '100%', cursor: 'pointer', textAlign: 'center', marginTop: 4, color: '#f88' }}
          onClick={() => updateObject(selectedObj.id, { shaderData: [] })}>셰이더 제거</button>
      )}
      {showShaderEditor && (
        <ShaderEditorDialog
          imageName={selectedObj.imageName!}
          shaderList={(selectedObj.shaderData || []) as ShaderEntry[]}
          onOk={(newList) => {
            updateObject(selectedObj.id, { shaderData: newList.map(s => ({ type: s.type, enabled: true, params: { ...s.params } })) });
            setShowShaderEditor(false);
          }}
          onCancel={() => setShowShaderEditor(false)}
        />
      )}
    </div>
  );
}

// ─── Passability Section ───
export function ObjectPassabilitySection({ selectedObj, updateObject }: Pick<ObjSectionProps, 'selectedObj' | 'updateObject'>) {
  return (
    <div className="light-inspector-section">
      <div className="light-inspector-title">통행 설정</div>
      <div className="passability-grid" style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${selectedObj.width}, 24px)`,
        gap: 2, marginBottom: 6,
      }}>
        {selectedObj.passability.map((row: boolean[], ri: number) =>
          row.map((passable: boolean, ci: number) => (
            <div
              key={`${ri}-${ci}`}
              className={`passability-cell ${passable ? 'passable' : 'impassable'}`}
              onClick={() => {
                const newPass = selectedObj.passability.map((r: boolean[], rr: number) =>
                  r.map((v: boolean, cc: number) => (rr === ri && cc === ci ? !v : v))
                );
                updateObject(selectedObj.id, { passability: newPass });
              }}
              title={passable ? '통행 가능 (클릭하여 변경)' : '통행 불가 (클릭하여 변경)'}
            />
          ))
        )}
      </div>
      <button className="light-inspector-input"
        style={{ width: '100%', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => {
          const newPass: boolean[][] = [];
          for (let row = 0; row < selectedObj.height; row++) {
            newPass.push(Array(selectedObj.width).fill(row < selectedObj.height - 1));
          }
          updateObject(selectedObj.id, { passability: newPass });
        }}>스마트 초기화</button>
    </div>
  );
}
