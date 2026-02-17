import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import ImagePicker from '../common/ImagePicker';
import { TINT_PRESETS, TintColorPreview } from './screenEffectEditors';
import { ShaderEditorDialog, ShaderEntry, SHADER_DEFINITIONS } from './shaderEditor';

// ─── 셰이더 트랜지션 타입 ───
export interface ShaderTransition {
  shaderList: ShaderEntry[];
  applyMode: 'instant' | 'interpolate';
  duration: number;
}

// ─── 공통 스타일 ───
const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
const inputStyle: React.CSSProperties = { ...selectStyle, width: 80 };

// ─── 공통 컴포넌트 ───

function Fieldset({ legend, children, style }: { legend: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0, ...style }}>
      <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>{legend}</legend>
      {children}
    </fieldset>
  );
}

function PictureNumberField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label style={labelStyle}>
      번호:
      <input type="number" min={1} max={100} value={value}
        onChange={e => onChange(Math.max(1, Math.min(100, Number(e.target.value))))}
        style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
    </label>
  );
}

function ScaleFields({ width, height, onWidthChange, onHeightChange }: {
  width: number; height: number; onWidthChange: (v: number) => void; onHeightChange: (v: number) => void;
}) {
  return (
    <Fieldset legend="배율">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={labelStyle}>
          넓이:
          <input type="number" min={0} max={2000} value={width}
            onChange={e => onWidthChange(Number(e.target.value))}
            style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
          <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
        </label>
        <label style={labelStyle}>
          높이:
          <input type="number" min={0} max={2000} value={height}
            onChange={e => onHeightChange(Number(e.target.value))}
            style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
          <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
        </label>
      </div>
    </Fieldset>
  );
}

function BlendFields({ opacity, blendMode, onOpacityChange, onBlendModeChange }: {
  opacity: number; blendMode: number; onOpacityChange: (v: number) => void; onBlendModeChange: (v: number) => void;
}) {
  return (
    <Fieldset legend="합성">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={labelStyle}>
          불투명도:
          <input type="number" min={0} max={255} value={opacity}
            onChange={e => onOpacityChange(Math.max(0, Math.min(255, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
        </label>
        <label style={labelStyle}>
          합성 방법:
          <select value={blendMode} onChange={e => onBlendModeChange(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
            <option value={0}>일반</option>
            <option value={1}>추가 합성</option>
            <option value={2}>곱하기</option>
            <option value={3}>스크린</option>
          </select>
        </label>
      </div>
    </Fieldset>
  );
}

function DurationFields({ duration, waitForCompletion, onDurationChange, onWaitChange }: {
  duration: number; waitForCompletion: boolean; onDurationChange: (v: number) => void; onWaitChange: (v: boolean) => void;
}) {
  return (
    <Fieldset legend="지속 시간">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" min={1} max={999} value={duration}
          onChange={e => onDurationChange(Math.max(1, Math.min(999, Number(e.target.value))))}
          style={{ ...selectStyle, width: 60 }} />
        <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
        <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
          <input type="checkbox" checked={waitForCompletion} onChange={e => onWaitChange(e.target.checked)} />
          완료까지 대기
        </label>
      </div>
    </Fieldset>
  );
}

function EditorFooter({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  return (
    <div className="image-picker-footer">
      <button className="db-btn" onClick={onOk}>OK</button>
      <button className="db-btn" onClick={onCancel}>취소</button>
    </div>
  );
}

function DirectPositionInputs({ posX, posY, onPosXChange, onPosYChange, disabled }: {
  posX: number; posY: number; onPosXChange: (v: number) => void; onPosYChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
        <input type="number" min={-9999} max={9999} value={posX}
          onChange={e => onPosXChange(Number(e.target.value))} disabled={disabled} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
        <input type="number" min={-9999} max={9999} value={posY}
          onChange={e => onPosYChange(Number(e.target.value))} disabled={disabled} style={inputStyle} />
      </div>
    </div>
  );
}

function VariablePositionInputs({ posX, posY, onPosXChange, onPosYChange, disabled }: {
  posX: number; posY: number; onPosXChange: (v: number) => void; onPosYChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
        <VariableSwitchPicker type="variable" value={posX || 1}
          onChange={onPosXChange} disabled={disabled} style={{ flex: 1 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
        <VariableSwitchPicker type="variable" value={posY || 1}
          onChange={onPosYChange} disabled={disabled} style={{ flex: 1 }} />
      </div>
    </div>
  );
}

const PRESET_OPTIONS = [
  { value: 1, label: '0%' },
  { value: 2, label: '25%' },
  { value: 3, label: '50%' },
  { value: 4, label: '75%' },
  { value: 5, label: '100%' },
];

function PresetPositionInputs({ presetX, presetY, offsetX, offsetY, onPresetXChange, onPresetYChange, onOffsetXChange, onOffsetYChange }: {
  presetX: number; presetY: number; offsetX: number; offsetY: number;
  onPresetXChange: (v: number) => void; onPresetYChange: (v: number) => void;
  onOffsetXChange: (v: number) => void; onOffsetYChange: (v: number) => void;
}) {
  return (
    <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {[{ label: 'X', preset: presetX, offset: offsetX, onPreset: onPresetXChange, onOffset: onOffsetXChange },
        { label: 'Y', preset: presetY, offset: offsetY, onPreset: onPresetYChange, onOffset: onOffsetYChange }].map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...labelStyle, minWidth: 16 }}>{row.label}:</span>
          <select value={row.preset} onChange={e => row.onPreset(Number(e.target.value))}
            style={{ ...selectStyle, width: 70 }}>
            {PRESET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span style={{ ...labelStyle, marginLeft: 4 }}>+</span>
          <input type="number" min={-9999} max={9999} value={row.offset}
            onChange={e => row.onOffset(Number(e.target.value))}
            style={{ ...selectStyle, width: 60 }} />
        </div>
      ))}
    </div>
  );
}

// ─── 그림 표시 (Show Picture, code 231) ───
// parameters: [번호, 이미지명, 원점, 위치지정방식, X, Y, 넓이%, 높이%, 불투명도, 합성방법, 셰이더데이터?]
export function ShowPictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
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

  // 셰이더로 나타나기 (p[12])
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

  return (
    <>
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
            {positionType === 0 && (
              <DirectPositionInputs posX={posX} posY={posY} onPosXChange={setPosX} onPosYChange={setPosY} />
            )}

            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
              변수로 지정
            </label>
            {positionType === 1 && (
              <VariablePositionInputs posX={posX} posY={posY} onPosXChange={setPosX} onPosYChange={setPosY} />
            )}

            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 2} onChange={() => setPositionType(2)} />
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

      <Fieldset legend="셰이더 이펙트">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="db-btn" onClick={() => setShowShaderDialog(true)}>
            셰이더 설정...
          </button>
          <span style={{ fontSize: 12, color: shaderList.length > 0 ? '#7cb3ff' : '#666' }}>
            {shaderList.length > 0
              ? shaderList.map(s => SHADER_DEFINITIONS.find(d => d.type === s.type)?.label ?? s.type).join(' + ')
              : '없음'}
          </span>
          {shaderList.length > 0 && (
            <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px', color: '#f88' }}
              onClick={() => setShaderList([])}>초기화</button>
          )}
        </div>
      </Fieldset>
      {showShaderDialog && (
        <ShaderEditorDialog
          imageName={imageName}
          shaderList={shaderList}
          onOk={(list) => { setShaderList(list); setShowShaderDialog(false); }}
          onCancel={() => setShowShaderDialog(false)}
        />
      )}

      <Fieldset legend="셰이더로 나타나기">
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
                  <input type="radio" name="show-pic-transition-mode" checked={transitionApplyMode === 'interpolate'}
                    onChange={() => setTransitionApplyMode('interpolate')} />
                  보간 적용
                </label>
                <label style={radioStyle}>
                  <input type="radio" name="show-pic-transition-mode" checked={transitionApplyMode === 'instant'}
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
          imageName={imageName}
          shaderList={transitionShaderList}
          transitionOnly
          onOk={(list) => { setTransitionShaderList(list); setShowTransitionShaderDialog(false); }}
          onCancel={() => setShowTransitionShaderDialog(false)}
        />
      )}

      <EditorFooter onCancel={onCancel} onOk={() => {
        const shaderData = shaderList.length > 0 ? shaderList.map(s => ({ type: s.type, enabled: true, params: { ...s.params } })) : null;
        const presetData = positionType === 2 ? { presetX, presetY, offsetX: presetOffsetX, offsetY: presetOffsetY } : null;
        const transitionData: ShaderTransition | null = transitionEnabled && transitionShaderList.length > 0
          ? { shaderList: transitionShaderList.map(s => ({ ...s, params: { ...s.params } })), applyMode: transitionApplyMode, duration: transitionApplyMode === 'interpolate' ? transitionDuration : 0 }
          : null;
        onOk([pictureNumber, imageName, origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, shaderData, presetData, transitionData]);
      }} />
    </>
  );
}

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

// ─── 그림 회전 (Rotate Picture, code 233) ───
// parameters: [번호, 속도]
export function RotatePictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [speed, setSpeed] = useState<number>((p[1] as number) || 0);

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <Fieldset legend="그림">
          <PictureNumberField value={pictureNumber} onChange={setPictureNumber} />
        </Fieldset>
        <Fieldset legend="회전">
          <label style={labelStyle}>
            속도:
            <input type="number" min={-90} max={90} value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
        </Fieldset>
      </div>

      <EditorFooter onCancel={onCancel} onOk={() => onOk([pictureNumber, speed])} />
    </>
  );
}

export function TintPictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const tone = (p[1] as number[] | undefined) || [0, 0, 0, 0];
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [red, setRed] = useState<number>(tone[0] || 0);
  const [green, setGreen] = useState<number>(tone[1] || 0);
  const [blue, setBlue] = useState<number>(tone[2] || 0);
  const [gray, setGray] = useState<number>(tone[3] || 0);
  const [duration, setDuration] = useState<number>((p[2] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[3] as boolean) ?? true);

  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  const applyPreset = (name: string) => {
    const [pr, pg, pb, pgray] = TINT_PRESETS[name];
    setRed(pr); setGreen(pg); setBlue(pb); setGray(pgray);
  };

  const tintSliders: { label: string; value: number; min: number; onChange: (v: number) => void }[] = [
    { label: '빨강', value: red, min: -255, onChange: setRed },
    { label: '초록', value: green, min: -255, onChange: setGreen },
    { label: '파랑', value: blue, min: -255, onChange: setBlue },
    { label: '그레이', value: gray, min: 0, onChange: setGray },
  ];

  return (
    <>
      <Fieldset legend="그림">
        <PictureNumberField value={pictureNumber} onChange={setPictureNumber} />
      </Fieldset>

      <Fieldset legend="색조">
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {tintSliders.map(s => (
              <div key={s.label} style={sliderRowStyle}>
                <span style={{ ...labelStyle, minWidth: 40 }}>{s.label}:</span>
                <input type="range" min={s.min} max={255} value={s.value}
                  onChange={e => s.onChange(Number(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min={s.min} max={255} value={s.value}
                  onChange={e => s.onChange(Math.max(s.min, Math.min(255, Number(e.target.value))))}
                  style={{ ...selectStyle, width: 60 }} />
              </div>
            ))}
          </div>
          <TintColorPreview r={red} g={green} b={blue} gray={gray} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {Object.keys(TINT_PRESETS).map(name => (
            <button key={name} className="db-btn" style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
              onClick={() => applyPreset(name)}>
              {name}
            </button>
          ))}
        </div>
      </Fieldset>

      <DurationFields duration={duration} waitForCompletion={waitForCompletion}
        onDurationChange={setDuration} onWaitChange={setWaitForCompletion} />

      <EditorFooter onCancel={onCancel} onOk={() =>
        onOk([pictureNumber, [red, green, blue, gray], duration, waitForCompletion])
      } />
    </>
  );
}
