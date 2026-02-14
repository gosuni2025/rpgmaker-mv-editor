import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import ImagePicker from '../common/ImagePicker';
import { TINT_PRESETS, TintColorPreview } from './screenEffectEditors';
import { ShaderEditorDialog, ShaderEntry, SHADER_DEFINITIONS } from './shaderEditor';

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

  // 프리셋 위치 데이터 초기화
  const existingPreset = p[11] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
  const [presetX, setPresetX] = useState<number>(existingPreset?.presetX ?? 3);
  const [presetY, setPresetY] = useState<number>(existingPreset?.presetY ?? 3);
  const [presetOffsetX, setPresetOffsetX] = useState<number>(existingPreset?.offsetX ?? 0);
  const [presetOffsetY, setPresetOffsetY] = useState<number>(existingPreset?.offsetY ?? 0);

  // 셰이더 데이터 초기화 (배열 지원)
  const initShaderList = (): ShaderEntry[] => {
    const raw = p[10];
    if (!raw) return [];
    // 배열 형태
    if (Array.isArray(raw)) return (raw as ShaderEntry[]).map(s => ({ ...s, params: { ...s.params } }));
    // 단일 객체 (하위 호환)
    const single = raw as ShaderEntry;
    if (single.enabled) return [{ ...single, params: { ...single.params } }];
    return [];
  };
  const [shaderList, setShaderList] = useState<ShaderEntry[]>(initShaderList);
  const [showShaderDialog, setShowShaderDialog] = useState(false);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const inputStyle: React.CSSProperties = { ...selectStyle, width: 80 };

  return (
    <>
      {/* 그림 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={labelStyle}>
            번호:
            <input type="number" min={1} max={100} value={pictureNumber}
              onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
          <div style={{ ...labelStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>이미지:</span>
            <ImagePicker type="pictures" value={imageName} onChange={setImageName} />
          </div>
        </div>
      </fieldset>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* 위치 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0, flex: 1 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              원점:
              <select value={origin} onChange={e => setOrigin(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                <option value={0}>왼쪽 위</option>
                <option value={1}>중앙</option>
              </select>
            </label>

            {/* 직접 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 0} onChange={() => setPositionType(0)} />
              직접 지정
            </label>
            {positionType === 0 && (
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <input type="number" min={-9999} max={9999} value={posX}
                  onChange={e => setPosX(Number(e.target.value))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <input type="number" min={-9999} max={9999} value={posY}
                  onChange={e => setPosY(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
            )}

            {/* 변수로 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
              변수로 지정
            </label>
            {positionType === 1 && (
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <VariableSwitchPicker type="variable" value={posX || 1}
                  onChange={setPosX} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <VariableSwitchPicker type="variable" value={posY || 1}
                  onChange={setPosY} style={{ flex: 1 }} />
              </div>
            </div>
            )}

            {/* 프리셋 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 2} onChange={() => setPositionType(2)} />
              프리셋 지정
            </label>
            {positionType === 2 && (
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <select value={presetX} onChange={e => setPresetX(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70 }}>
                  <option value={1}>0%</option>
                  <option value={2}>25%</option>
                  <option value={3}>50%</option>
                  <option value={4}>75%</option>
                  <option value={5}>100%</option>
                </select>
                <span style={{ ...labelStyle, marginLeft: 4 }}>+</span>
                <input type="number" min={-9999} max={9999} value={presetOffsetX}
                  onChange={e => setPresetOffsetX(Number(e.target.value))}
                  style={{ ...selectStyle, width: 60 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <select value={presetY} onChange={e => setPresetY(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70 }}>
                  <option value={1}>0%</option>
                  <option value={2}>25%</option>
                  <option value={3}>50%</option>
                  <option value={4}>75%</option>
                  <option value={5}>100%</option>
                </select>
                <span style={{ ...labelStyle, marginLeft: 4 }}>+</span>
                <input type="number" min={-9999} max={9999} value={presetOffsetY}
                  onChange={e => setPresetOffsetY(Number(e.target.value))}
                  style={{ ...selectStyle, width: 60 }} />
              </div>
            </div>
            )}
          </div>
        </fieldset>

        {/* 배율 + 합성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>배율</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                넓이:
                <input type="number" min={0} max={2000} value={scaleWidth}
                  onChange={e => setScaleWidth(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
              <label style={labelStyle}>
                높이:
                <input type="number" min={0} max={2000} value={scaleHeight}
                  onChange={e => setScaleHeight(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
            </div>
          </fieldset>

          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>합성</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                불투명도:
                <input type="number" min={0} max={255} value={opacity}
                  onChange={e => setOpacity(Math.max(0, Math.min(255, Number(e.target.value))))}
                  style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
              </label>
              <label style={labelStyle}>
                합성 방법:
                <select value={blendMode} onChange={e => setBlendMode(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                  <option value={0}>일반</option>
                  <option value={1}>추가 합성</option>
                  <option value={2}>곱하기</option>
                  <option value={3}>스크린</option>
                </select>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      {/* 셰이더 이펙트 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>셰이더 이펙트</legend>
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
      </fieldset>
      {showShaderDialog && (
        <ShaderEditorDialog
          imageName={imageName}
          shaderList={shaderList}
          onOk={(list) => { setShaderList(list); setShowShaderDialog(false); }}
          onCancel={() => setShowShaderDialog(false)}
        />
      )}

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => {
          const shaderData = shaderList.length > 0 ? shaderList.map(s => ({ type: s.type, enabled: true, params: { ...s.params } })) : null;
          const presetData = positionType === 2 ? { presetX, presetY, offsetX: presetOffsetX, offsetY: presetOffsetY } : null;
          onOk([pictureNumber, imageName, origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, shaderData, presetData]);
        }}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 그림 이동 (Move Picture, code 232) ───
// parameters: [번호, (unused), 원점, 위치지정방식, X, Y, 넓이%, 높이%, 불투명도, 합성방법, 지속시간, 완료까지대기]
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

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const inputStyle: React.CSSProperties = { ...selectStyle, width: 80 };

  return (
    <>
      {/* 그림 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
        <label style={labelStyle}>
          번호:
          <input type="number" min={1} max={100} value={pictureNumber}
            onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
        </label>
      </fieldset>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* 위치 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0, flex: 1 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              원점:
              <select value={origin} onChange={e => setOrigin(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                <option value={0}>왼쪽 위</option>
                <option value={1}>중앙</option>
              </select>
            </label>

            {/* 직접 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="movepic-pos-type" checked={positionType === 0} onChange={() => setPositionType(0)} />
              직접 지정
            </label>
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, opacity: positionType === 0 ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <input type="number" min={-9999} max={9999} value={positionType === 0 ? posX : 0}
                  onChange={e => setPosX(Number(e.target.value))}
                  disabled={positionType !== 0} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <input type="number" min={-9999} max={9999} value={positionType === 0 ? posY : 0}
                  onChange={e => setPosY(Number(e.target.value))}
                  disabled={positionType !== 0} style={inputStyle} />
              </div>
            </div>

            {/* 변수로 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="movepic-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
              변수로 지정
            </label>
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, opacity: positionType === 1 ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <VariableSwitchPicker type="variable" value={positionType === 1 ? (posX || 1) : 1}
                  onChange={setPosX} disabled={positionType !== 1} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <VariableSwitchPicker type="variable" value={positionType === 1 ? (posY || 1) : 1}
                  onChange={setPosY} disabled={positionType !== 1} style={{ flex: 1 }} />
              </div>
            </div>
          </div>
        </fieldset>

        {/* 배율 + 합성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>배율</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                넓이:
                <input type="number" min={0} max={2000} value={scaleWidth}
                  onChange={e => setScaleWidth(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
              <label style={labelStyle}>
                높이:
                <input type="number" min={0} max={2000} value={scaleHeight}
                  onChange={e => setScaleHeight(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
            </div>
          </fieldset>

          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>합성</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                불투명도:
                <input type="number" min={0} max={255} value={opacity}
                  onChange={e => setOpacity(Math.max(0, Math.min(255, Number(e.target.value))))}
                  style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
              </label>
              <label style={labelStyle}>
                합성 방법:
                <select value={blendMode} onChange={e => setBlendMode(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                  <option value={0}>일반</option>
                  <option value={1}>추가 합성</option>
                  <option value={2}>곱하기</option>
                  <option value={3}>스크린</option>
                </select>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([pictureNumber, '', origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 그림 회전 (Rotate Picture, code 233) ───
// parameters: [번호, 속도]
export function RotatePictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [speed, setSpeed] = useState<number>((p[1] as number) || 0);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* 그림 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
          <label style={labelStyle}>
            번호:
            <input type="number" min={1} max={100} value={pictureNumber}
              onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
        </fieldset>

        {/* 회전 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>회전</legend>
          <label style={labelStyle}>
            속도:
            <input type="number" min={-90} max={90} value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
        </fieldset>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([pictureNumber, speed])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
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

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  const applyPreset = (name: string) => {
    const [pr, pg, pb, pgray] = TINT_PRESETS[name];
    setRed(pr);
    setGreen(pg);
    setBlue(pb);
    setGray(pgray);
  };

  return (
    <>
      {/* 그림 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
        <label style={labelStyle}>
          번호:
          <input type="number" min={1} max={100} value={pictureNumber}
            onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
        </label>
      </fieldset>

      {/* 색조 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>색조</legend>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>빨강:</span>
              <input type="range" min={-255} max={255} value={red}
                onChange={e => setRed(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={red}
                onChange={e => setRed(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>초록:</span>
              <input type="range" min={-255} max={255} value={green}
                onChange={e => setGreen(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={green}
                onChange={e => setGreen(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>파랑:</span>
              <input type="range" min={-255} max={255} value={blue}
                onChange={e => setBlue(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={blue}
                onChange={e => setBlue(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>그레이:</span>
              <input type="range" min={0} max={255} value={gray}
                onChange={e => setGray(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={gray}
                onChange={e => setGray(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
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
      </fieldset>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([pictureNumber, [red, green, blue, gray], duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}
