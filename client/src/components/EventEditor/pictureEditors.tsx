import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import { ShaderEditorDialog, ShaderEntry, SHADER_DEFINITIONS } from './shaderEditor';
import { TINT_PRESETS, TintColorPreview } from './screenEffectEditors';
import type { ShaderTransition } from './pictureEditorCommon';
import {
  radioStyle, labelStyle, inputStyle, Fieldset, PictureNumberField,
  ScaleFields, BlendFields, DurationFields, EditorFooter,
  DirectPositionInputs, VariablePositionInputs, PresetPositionInputs,
} from './pictureEditorCommon';
export type { ShaderTransition } from './pictureEditorCommon';
export { ShowPictureEditor } from './ShowPictureEditor';
export { MovePictureEditor } from './MovePictureEditor';

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

// ─── 그림 제거 (Erase Picture, code 235) ───
// parameters: [번호, 제거모드?, 셰이더트랜지션?]
export function ErasePictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);

  // 제거 모드 (p[1]): 'interpolate' (보간, 기본값) | 'instant' (즉시)
  const [eraseMode, setEraseMode] = useState<'interpolate' | 'instant'>(
    (p[1] as string) === 'instant' ? 'instant' : 'interpolate'
  );

  // 셰이더 트랜지션 (p[2]) - 보간 제거 시에만 사용
  const existingTransition = p[2] as ShaderTransition | null;
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

      <Fieldset legend="제거 방식">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={radioStyle}>
            <input type="radio" name="erase-pic-mode" checked={eraseMode === 'interpolate'} onChange={() => setEraseMode('interpolate')} />
            보간 제거
          </label>
          <label style={radioStyle}>
            <input type="radio" name="erase-pic-mode" checked={eraseMode === 'instant'} onChange={() => setEraseMode('instant')} />
            즉시 제거
          </label>
        </div>
      </Fieldset>

      {eraseMode === 'interpolate' && (
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
                      <input type="radio" name="erase-pic-transition-mode" checked={transitionApplyMode === 'interpolate'}
                        onChange={() => setTransitionApplyMode('interpolate')} />
                      보간 적용
                    </label>
                    <label style={radioStyle}>
                      <input type="radio" name="erase-pic-transition-mode" checked={transitionApplyMode === 'instant'}
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
        const transitionData: ShaderTransition | null = eraseMode === 'interpolate' && transitionEnabled && transitionShaderList.length > 0
          ? { shaderList: transitionShaderList.map(s => ({ ...s, params: { ...s.params } })), applyMode: transitionApplyMode, duration: transitionApplyMode === 'interpolate' ? transitionDuration : 0 }
          : null;
        onOk([pictureNumber, eraseMode, transitionData]);
      }} />
    </>
  );
}
