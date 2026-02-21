import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import { ShaderEditorDialog, ShaderEntry, SHADER_DEFINITIONS } from './shaderEditor';
import type { ShaderTransition } from './pictureEditorCommon';
import {
  radioStyle, labelStyle, Fieldset, PictureNumberField,
  ScaleFields, BlendFields, EditorFooter,
  DirectPositionInputs, VariablePositionInputs, PresetPositionInputs,
} from './pictureEditorCommon';

// ─── 그림 이동 (Move Picture, code 232) ───
// parameters: [번호, (unused), 원점, 위치지정방식, X, Y, 넓이%, 높이%, 불투명도, 합성방법, 지속시간, 완료까지대기, 프리셋데이터?, 이동모드?, 셰이더트랜지션?]
export function MovePictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [origin, setOrigin] = useState<number>((p[2] as number) || 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) || 0);
  const [posX, setPosX] = useState<number>((p[4] as number) || 0);
  const [posY, setPosY] = useState<number>((p[5] as number) || 0);
  const [scaleWidth, setScaleWidth] = useState<number>((p[6] as number) ?? 100);
  const [scaleHeight, setScaleHeight] = useState<number>((p[7] as number) ?? 100);
  const [opacity, setOpacity] = useState<number>((p[8] as number) ?? 255);
  const [blendMode, setBlendMode] = useState<number>((p[9] as number) || 0);
  const [duration, setDuration] = useState<number>((p[10] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>(p[11] !== undefined ? !!p[11] : true);

  // 프리셋 좌표 (p[12])
  const existingPreset = p[12] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
  const [presetX, setPresetX] = useState<number>(existingPreset?.presetX ?? 3);
  const [presetY, setPresetY] = useState<number>(existingPreset?.presetY ?? 3);
  const [presetOffsetX, setPresetOffsetX] = useState<number>(existingPreset?.offsetX ?? 0);
  const [presetOffsetY, setPresetOffsetY] = useState<number>(existingPreset?.offsetY ?? 0);

  // 이동 모드 (p[13]): 'interpolate' (보간, 기본값) | 'instant' (즉시)
  const [moveMode, setMoveMode] = useState<'interpolate' | 'instant'>(
    (p[13] as string) === 'instant' ? 'instant' : 'interpolate'
  );

  // 셰이더 트랜지션 (p[14]) - 보간 이동 시에만 사용
  const existingTransition = p[14] as ShaderTransition | null;
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

  return (
    <>
      <Fieldset legend="그림">
        <PictureNumberField value={pictureNumber} onChange={setPictureNumber} />
      </Fieldset>

      <div style={{ display: 'flex', gap: 8 }}>
        <Fieldset legend="위치" style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={labelStyle}>원점:</span>
              <label style={radioStyle}>
                <input type="radio" name="move-pic-origin" checked={origin === 0} onChange={() => setOrigin(0)} />
                왼쪽 위
              </label>
              <label style={radioStyle}>
                <input type="radio" name="move-pic-origin" checked={origin === 1} onChange={() => setOrigin(1)} />
                중앙
              </label>
            </div>

            <label style={radioStyle}>
              <input type="radio" name="movepic-pos-type" checked={positionType === 0} onChange={() => setPositionType(0)} />
              직접 지정
            </label>
            {positionType === 0 && (
              <DirectPositionInputs posX={posX} posY={posY} onPosXChange={setPosX} onPosYChange={setPosY} />
            )}

            <label style={radioStyle}>
              <input type="radio" name="movepic-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
              변수로 지정
            </label>
            {positionType === 1 && (
              <VariablePositionInputs posX={posX} posY={posY} onPosXChange={setPosX} onPosYChange={setPosY} />
            )}

            <label style={radioStyle}>
              <input type="radio" name="movepic-pos-type" checked={positionType === 2} onChange={() => setPositionType(2)} />
              프리셋 지정
            </label>
            {positionType === 2 && (
              <PresetPositionInputs
                presetX={presetX} presetY={presetY} offsetX={presetOffsetX} offsetY={presetOffsetY}
                onPresetXChange={setPresetX} onPresetYChange={setPresetY}
                onOffsetXChange={setPresetOffsetX} onOffsetYChange={setPresetOffsetY}
              />
            )}
          </div>
        </Fieldset>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ScaleFields width={scaleWidth} height={scaleHeight} onWidthChange={setScaleWidth} onHeightChange={setScaleHeight} />
          <BlendFields opacity={opacity} blendMode={blendMode} onOpacityChange={setOpacity} onBlendModeChange={setBlendMode} />
        </div>
      </div>

      <Fieldset legend="이동 방식">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={radioStyle}>
              <input type="radio" name="move-pic-mode" checked={moveMode === 'interpolate'} onChange={() => setMoveMode('interpolate')} />
              보간 이동
            </label>
            <label style={radioStyle}>
              <input type="radio" name="move-pic-mode" checked={moveMode === 'instant'} onChange={() => setMoveMode('instant')} />
              즉시 이동
            </label>
          </div>
          {moveMode === 'interpolate' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 20 }}>
              <span style={labelStyle}>지속 시간:</span>
              <input type="number" min={1} max={999} value={duration}
                onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
              <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
              <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
                <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
                완료까지 대기
              </label>
            </div>
          )}
        </div>
      </Fieldset>

      {moveMode === 'interpolate' && (
        <>
          <Fieldset legend="셰이더 트랜지션">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={transitionEnabled} onChange={e => setTransitionEnabled(e.target.checked)} />
                셰이더 트랜지션 사용
              </label>
              {transitionEnabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="db-btn" onClick={() => setShowTransitionShaderDialog(true)}>
                      셰이더 설정...
                    </button>
                    <span style={{ fontSize: 12, color: transitionShaderList.length > 0 ? '#7cb3ff' : '#666' }}>
                      {transitionShaderList.length > 0
                        ? transitionShaderList.map(s => SHADER_DEFINITIONS.find(d => d.type === s.type)?.label ?? s.type).join(' + ')
                        : '없음'}
                    </span>
                    {transitionShaderList.length > 0 && (
                      <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px', color: '#f88' }}
                        onClick={() => setTransitionShaderList([])}>초기화</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={labelStyle}>적용 방식:</span>
                    <label style={radioStyle}>
                      <input type="radio" name="move-pic-transition-mode" checked={transitionApplyMode === 'interpolate'}
                        onChange={() => setTransitionApplyMode('interpolate')} />
                      보간 적용
                    </label>
                    <label style={radioStyle}>
                      <input type="radio" name="move-pic-transition-mode" checked={transitionApplyMode === 'instant'}
                        onChange={() => setTransitionApplyMode('instant')} />
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
          {showTransitionShaderDialog && (
            <ShaderEditorDialog
              shaderList={transitionShaderList}
              transitionOnly
              onOk={(list) => { setTransitionShaderList(list); setShowTransitionShaderDialog(false); }}
              onCancel={() => setShowTransitionShaderDialog(false)}
            />
          )}
        </>
      )}

      <EditorFooter onCancel={onCancel} onOk={() => {
        const presetData = positionType === 2 ? { presetX, presetY, offsetX: presetOffsetX, offsetY: presetOffsetY } : null;
        const effectiveDuration = moveMode === 'instant' ? 1 : duration;
        const transitionData: ShaderTransition | null = moveMode === 'interpolate' && transitionEnabled && transitionShaderList.length > 0
          ? { shaderList: transitionShaderList.map(s => ({ ...s, params: { ...s.params } })), applyMode: transitionApplyMode, duration: transitionApplyMode === 'interpolate' ? transitionDuration : 0 }
          : null;
        onOk([pictureNumber, '', origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, effectiveDuration, waitForCompletion, presetData, moveMode, transitionData]);
      }} />
    </>
  );
}
