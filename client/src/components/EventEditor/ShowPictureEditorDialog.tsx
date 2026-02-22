import React, { useState, useRef, useEffect, useCallback } from 'react';
import ImagePicker from '../common/ImagePicker';
import { ShaderEditorDialog, ShaderEntry, SHADER_DEFINITIONS } from './shaderEditor';
import { PicturePreview, PictureSnapshot } from './PicturePreview';
import type { ShaderTransition } from './pictureEditorCommon';
import {
  radioStyle, labelStyle, Fieldset, PictureNumberField,
  ScaleFields, BlendFields,
  DirectPositionInputs, VariablePositionInputs, PresetPositionInputs,
} from './pictureEditorCommon';
import { selectStyle } from './messageEditors';
import './ShowChoicesEditor.css';

// ShowPicture(231) parameters:
// [번호, 이미지명, 원점, 위치지정방식, X, Y, 넓이%, 높이%, 불투명도, 합성방법, 셰이더데이터?, 프리셋데이터?, 트랜지션?]

export function ShowPictureEditorDialog({ p, onOk, onCancel }: {
  p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void;
}) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [imageName, setImageName] = useState<string>((p[1] as string) || '');
  const [origin, setOrigin] = useState<number>((p[2] as number) || 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) || 0);
  const [posX, setPosX] = useState<number>((p[4] as number) || 0);
  const [posY, setPosY] = useState<number>((p[5] as number) || 0);
  const [scaleWidth, setScaleWidth] = useState<number>((p[6] as number) ?? 100);
  const [scaleHeight, setScaleHeight] = useState<number>((p[7] as number) ?? 100);
  const [opacity, setOpacity] = useState<number>((p[8] as number) ?? 255);
  const [blendMode, setBlendMode] = useState<number>((p[9] as number) || 0);

  const existingPreset = p[11] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
  const [presetX, setPresetX] = useState<number>(existingPreset?.presetX ?? 3);
  const [presetY, setPresetY] = useState<number>(existingPreset?.presetY ?? 3);
  const [presetOffsetX, setPresetOffsetX] = useState<number>(existingPreset?.offsetX ?? 0);
  const [presetOffsetY, setPresetOffsetY] = useState<number>(existingPreset?.offsetY ?? 0);

  const initShaderList = (): ShaderEntry[] => {
    const raw = p[10];
    if (!raw) return [];
    if (Array.isArray(raw)) return (raw as ShaderEntry[]).map(s => ({ ...s, params: { ...s.params } }));
    const single = raw as ShaderEntry;
    if (single.enabled) return [{ ...single, params: { ...single.params } }];
    return [];
  };
  const [shaderList, setShaderList] = useState<ShaderEntry[]>(initShaderList);
  const [showShaderDialog, setShowShaderDialog] = useState(false);

  const existingTransition = p[12] as ShaderTransition | null;
  const initTransitionShaderList = (): ShaderEntry[] => {
    if (!existingTransition?.shaderList) return [];
    return existingTransition.shaderList.map(s => ({ ...s, params: { ...s.params } }));
  };
  const [transitionEnabled, setTransitionEnabled] = useState<boolean>(!!existingTransition);
  const [transitionShaderList, setTransitionShaderList] = useState<ShaderEntry[]>(initTransitionShaderList);
  const [transitionApplyMode, setTransitionApplyMode] = useState<'instant' | 'interpolate'>(
    existingTransition?.applyMode ?? 'interpolate'
  );
  const [transitionDuration, setTransitionDuration] = useState<number>(existingTransition?.duration ?? 1);
  const [showTransitionShaderDialog, setShowTransitionShaderDialog] = useState(false);

  // 프리뷰 분리선 드래그
  const [previewWidth, setPreviewWidth] = useState(() => {
    const saved = localStorage.getItem('showpicture-preview-width');
    return saved ? Math.max(220, Math.min(900, parseInt(saved, 10))) : 420;
  });
  const splitDragging = useRef(false);
  const splitStartX = useRef(0);
  const splitStartW = useRef(previewWidth);
  const onSplitDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    splitDragging.current = true;
    splitStartX.current = e.clientX;
    splitStartW.current = previewWidth;
  }, [previewWidth]);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!splitDragging.current) return;
      const delta = splitStartX.current - e.clientX;
      const w = Math.max(220, Math.min(900, splitStartW.current + delta));
      setPreviewWidth(w);
      localStorage.setItem('showpicture-preview-width', String(w));
    };
    const onUp = () => { splitDragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  // 재생 트리거 (트랜지션 애니메이션 재생)
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [showWindow, setShowWindow] = useState(true);

  const handlePositionDrag = useCallback((x: number, y: number) => {
    setPositionType(0);
    setPosX(x);
    setPosY(y);
  }, []);

  // PicturePreview에 전달할 현재 상태
  const currentSnap: PictureSnapshot = {
    imageName, origin, positionType, posX, posY,
    presetX, presetY, presetOffsetX, presetOffsetY,
    scaleWidth, scaleHeight, opacity, blendMode,
  };

  // 트랜지션 시작 상태 (opacity=0에서 시작)
  const fromSnap: PictureSnapshot | null = transitionEnabled
    ? { ...currentSnap, opacity: 0 }
    : null;

  // 트랜지션 지속 시간 (ms)
  const transitionDurationMs = transitionApplyMode === 'interpolate' ? transitionDuration * 1000 : 300;

  const handleOk = () => {
    const shaderData = shaderList.length > 0 ? shaderList.map(s => ({ type: s.type, enabled: true, params: { ...s.params } })) : null;
    const presetData = positionType === 2 ? { presetX, presetY, offsetX: presetOffsetX, offsetY: presetOffsetY } : null;
    const transitionData: ShaderTransition | null = transitionEnabled && transitionShaderList.length > 0
      ? { shaderList: transitionShaderList.map(s => ({ ...s, params: { ...s.params } })), applyMode: transitionApplyMode, duration: transitionApplyMode === 'interpolate' ? transitionDuration : 0 }
      : null;
    onOk([pictureNumber, imageName, origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, shaderData, presetData, transitionData]);
  };

  return (
    <div className="modal-overlay">
      <div className="show-text-fullscreen-dialog">
        <div className="image-picker-header">그림 표시</div>
        <div className="show-text-body">
          {/* 왼쪽: 설정 패널 */}
          <div className="show-text-settings">
            <Fieldset legend="그림">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PictureNumberField value={pictureNumber} onChange={setPictureNumber} />
                <div style={{ ...labelStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>이미지:</span>
                  <ImagePicker type="pictures" value={imageName} onChange={setImageName} />
                </div>
              </div>
            </Fieldset>

            <div style={{ display: 'flex', gap: 8 }}>
              <Fieldset legend="위치" style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={labelStyle}>원점:</span>
                    <label style={radioStyle}>
                      <input type="radio" name="show-pic-origin" checked={origin === 0} onChange={() => setOrigin(0)} />
                      왼쪽 위
                    </label>
                    <label style={radioStyle}>
                      <input type="radio" name="show-pic-origin" checked={origin === 1} onChange={() => setOrigin(1)} />
                      중앙
                    </label>
                  </div>
                  <label style={radioStyle}>
                    <input type="radio" name="picture-pos-type" checked={positionType === 0} onChange={() => setPositionType(0)} />
                    직접 지정
                  </label>
                  {positionType === 0 && <DirectPositionInputs posX={posX} posY={posY} onPosXChange={setPosX} onPosYChange={setPosY} />}
                  <label style={radioStyle}>
                    <input type="radio" name="picture-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
                    변수로 지정
                  </label>
                  {positionType === 1 && <VariablePositionInputs posX={posX} posY={posY} onPosXChange={setPosX} onPosYChange={setPosY} />}
                  <label style={radioStyle}>
                    <input type="radio" name="picture-pos-type" checked={positionType === 2} onChange={() => setPositionType(2)} />
                    프리셋 지정
                  </label>
                  {positionType === 2 && (
                    <PresetPositionInputs presetX={presetX} presetY={presetY} offsetX={presetOffsetX} offsetY={presetOffsetY}
                      onPresetXChange={setPresetX} onPresetYChange={setPresetY}
                      onOffsetXChange={setPresetOffsetX} onOffsetYChange={setPresetOffsetY} />
                  )}
                </div>
              </Fieldset>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ScaleFields width={scaleWidth} height={scaleHeight} onWidthChange={setScaleWidth} onHeightChange={setScaleHeight} />
                <BlendFields opacity={opacity} blendMode={blendMode} onOpacityChange={setOpacity} onBlendModeChange={setBlendMode} />
              </div>
            </div>

            <Fieldset legend="셰이더 이펙트">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="db-btn" onClick={() => setShowShaderDialog(true)}>셰이더 설정...</button>
                <span style={{ fontSize: 12, color: shaderList.length > 0 ? '#7cb3ff' : '#666' }}>
                  {shaderList.length > 0 ? shaderList.map(s => SHADER_DEFINITIONS.find(d => d.type === s.type)?.label ?? s.type).join(' + ') : '없음'}
                </span>
                {shaderList.length > 0 && (
                  <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px', color: '#f88' }} onClick={() => setShaderList([])}>초기화</button>
                )}
              </div>
            </Fieldset>

            <Fieldset legend="셰이더로 나타나기">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={transitionEnabled} onChange={e => setTransitionEnabled(e.target.checked)} />
                  셰이더 트랜지션 사용
                </label>
                {transitionEnabled && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="db-btn" onClick={() => setShowTransitionShaderDialog(true)}>셰이더 설정...</button>
                      <span style={{ fontSize: 12, color: transitionShaderList.length > 0 ? '#7cb3ff' : '#666' }}>
                        {transitionShaderList.length > 0 ? transitionShaderList.map(s => SHADER_DEFINITIONS.find(d => d.type === s.type)?.label ?? s.type).join(' + ') : '없음'}
                      </span>
                      {transitionShaderList.length > 0 && (
                        <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px', color: '#f88' }} onClick={() => setTransitionShaderList([])}>초기화</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={labelStyle}>적용 방식:</span>
                      <label style={radioStyle}>
                        <input type="radio" name="show-pic-transition-mode" checked={transitionApplyMode === 'interpolate'} onChange={() => setTransitionApplyMode('interpolate')} />
                        보간 적용
                      </label>
                      <label style={radioStyle}>
                        <input type="radio" name="show-pic-transition-mode" checked={transitionApplyMode === 'instant'} onChange={() => setTransitionApplyMode('instant')} />
                        즉시 적용
                      </label>
                    </div>
                    {transitionApplyMode === 'interpolate' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={labelStyle}>소요 시간:</span>
                        <input type="number" min={0.1} max={60} step={0.1} value={transitionDuration}
                          onChange={e => setTransitionDuration(Math.max(0.1, Math.min(60, Number(e.target.value))))}
                          style={{ ...selectStyle, width: 70 }} />
                        <span style={{ fontSize: 12, color: '#aaa' }}>초</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Fieldset>
          </div>

          {/* 스플릿 핸들 */}
          <div className="show-text-split-handle" onMouseDown={onSplitDown} title="드래그하여 미리보기 크기 조절" />

          {/* 오른쪽: 프리뷰 패널 */}
          <div className="show-text-preview-panel" style={{ width: previewWidth }}>
            <div className="show-text-preview-header">
              미리보기
              <span style={{ fontSize: 11, color: '#555', marginLeft: 8 }}>816×624</span>
              <button
                onClick={() => setReplayTrigger(t => t + 1)}
                style={{ marginLeft: 'auto', fontSize: 11, padding: '1px 8px', background: '#2a3a5a', border: '1px solid #4a6a9a', borderRadius: 3, color: '#9cf', cursor: 'pointer' }}
                title={transitionEnabled ? '트랜지션 재생' : '현재 상태 표시'}
              >
                ▶ 재생
              </button>
              <button
                onClick={() => setShowWindow(w => !w)}
                style={{ fontSize: 11, padding: '1px 8px', background: showWindow ? '#1a3a2a' : '#2b2b2b', border: `1px solid ${showWindow ? '#3a7a4a' : '#555'}`, borderRadius: 3, color: showWindow ? '#6da' : '#666', cursor: 'pointer' }}
                title="대화창 표시/숨기기"
              >
                창
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#111', borderRadius: 4, padding: 6 }}>
              <PicturePreview
                current={currentSnap}
                from={fromSnap}
                durationMs={transitionDurationMs}
                replayTrigger={replayTrigger}
                showWindow={showWindow}
                onPositionDrag={handlePositionDrag}
              />
            </div>
          </div>
        </div>

        <div className="image-picker-footer">
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>

      {showShaderDialog && (
        <ShaderEditorDialog
          imageName={imageName}
          shaderList={shaderList}
          onOk={(list) => { setShaderList(list); setShowShaderDialog(false); }}
          onCancel={() => setShowShaderDialog(false)}
        />
      )}
      {showTransitionShaderDialog && (
        <ShaderEditorDialog
          imageName={imageName}
          shaderList={transitionShaderList}
          transitionOnly
          onOk={(list) => { setTransitionShaderList(list); setShowTransitionShaderDialog(false); }}
          onCancel={() => setShowTransitionShaderDialog(false)}
        />
      )}
    </div>
  );
}
