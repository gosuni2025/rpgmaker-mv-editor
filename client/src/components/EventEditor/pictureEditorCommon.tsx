import React from 'react';
import ExtBadge from '../common/ExtBadge';
import { selectStyle, radioStyle, labelStyle, inputStyle } from '../../styles/editorStyles';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import type { ShaderEntry } from './shaderEditor';

// ─── 셰이더 트랜지션 타입 ───
export interface ShaderTransition {
  shaderList: ShaderEntry[];
  applyMode: 'instant' | 'interpolate';
  duration: number;
}

// ─── 그림 변환 타입 ───
export interface PictureTransform {
  flipH: boolean;
  flipV: boolean;
  rotX: number;  // 도(-180~180), 3D 전용
  rotY: number;  // 도(-180~180), 3D 전용
  rotZ: number;  // 도(-180~180)
}

export const DEFAULT_TRANSFORM: PictureTransform = { flipH: false, flipV: false, rotX: 0, rotY: 0, rotZ: 0 };

// ─── 공통 스타일 (editorStyles.ts에서 re-export) ───
export { radioStyle, labelStyle, inputStyle } from '../../styles/editorStyles';

// ─── 공통 컴포넌트 ───

export function Fieldset({ legend, children, style }: { legend: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0, ...style }}>
      <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>{legend}</legend>
      {children}
    </fieldset>
  );
}

export function PictureNumberField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label style={labelStyle}>
      번호:
      <input type="number" min={1} max={100} value={value}
        onChange={e => onChange(Math.max(1, Math.min(100, Number(e.target.value))))}
        style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
    </label>
  );
}

export function ScaleFields({ width, height, onWidthChange, onHeightChange }: {
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

export function BlendFields({ opacity, blendMode, onOpacityChange, onBlendModeChange }: {
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

export function DurationFields({ duration, waitForCompletion, onDurationChange, onWaitChange }: {
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

export function EditorFooter({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  return (
    <div className="image-picker-footer">
      <button className="db-btn" onClick={onOk}>OK</button>
      <button className="db-btn" onClick={onCancel}>취소</button>
    </div>
  );
}

export function DirectPositionInputs({ posX, posY, onPosXChange, onPosYChange, disabled }: {
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

export function VariablePositionInputs({ posX, posY, onPosXChange, onPosYChange, disabled }: {
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

export const PRESET_OPTIONS = [
  { value: 1, label: '0%' },
  { value: 2, label: '25%' },
  { value: 3, label: '50%' },
  { value: 4, label: '75%' },
  { value: 5, label: '100%' },
];

export function TransformFields({ transform, onChange }: {
  transform: PictureTransform;
  onChange: (t: PictureTransform) => void;
}) {
  const set = (key: keyof PictureTransform, val: boolean | number) =>
    onChange({ ...transform, [key]: val });
  return (
    <Fieldset legend={<>변환 <ExtBadge inline /></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="checkbox" checked={transform.flipH} onChange={e => set('flipH', e.target.checked)} />
            좌우 반전
          </label>
          <label style={radioStyle}>
            <input type="checkbox" checked={transform.flipV} onChange={e => set('flipV', e.target.checked)} />
            상하 반전
          </label>
        </div>
        {([
          { key: 'rotZ', label: 'Z축 회전' },
          { key: 'rotX', label: 'X축 회전 (3D 전용)' },
          { key: 'rotY', label: 'Y축 회전 (3D 전용)' },
        ] as { key: keyof PictureTransform; label: string }[]).map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...labelStyle, minWidth: 110 }}>{label}:</span>
            <input type="range" min={-180} max={180}
              value={transform[key] as number}
              onChange={e => set(key, Number(e.target.value))}
              style={{ flex: 1, minWidth: 80 }} />
            <input type="number" min={-180} max={180}
              value={transform[key] as number}
              onChange={e => set(key, Math.max(-180, Math.min(180, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60 }} />
            <span style={{ fontSize: 12, color: '#aaa' }}>°</span>
          </div>
        ))}
      </div>
    </Fieldset>
  );
}

export function PresetPositionInputs({ presetX, presetY, offsetX, offsetY, onPresetXChange, onPresetYChange, onOffsetXChange, onOffsetYChange }: {
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
