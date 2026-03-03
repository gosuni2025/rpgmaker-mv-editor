import React from 'react';
import type {
  WidgetDef, WidgetDef_Button,
  ButtonTransitionType, ButtonTransitionConfig, TransitionColor, CommandActionType,
} from '../../store/uiEditorTypes';
import { inputStyle, selectStyle, smallBtnStyle, labelStyle, rowStyle } from './UIEditorSceneStyles';
import HelpButton from '../common/HelpButton';
import { inlineLabelStyle, ColorInput } from './UIEditorInspectorHelpers';
import { ActionHandlerEditor } from './UIEditorActionHandlerEditor';

// ── ButtonTransitionSection ─────────────────────────────────

export const TRANSITION_LABELS: Record<ButtonTransitionType, string> = {
  system:    '시스템 커서',
  colorTint: '컬러 틴트',
  spriteSwap: '이미지 교체',
};

export const TRANSITION_STATES: { key: string; label: string }[] = [
  { key: 'normal',      label: '기본 (Normal)' },
  { key: 'highlighted', label: '호버/포커스 (Highlighted)' },
  { key: 'pressed',     label: '클릭 (Pressed)' },
  { key: 'disabled',    label: '비활성 (Disabled)' },
];

export function colorToHex(c: TransitionColor): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return '#' + hex(c[0]) + hex(c[1]) + hex(c[2]);
}
export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function ButtonTransitionSection({ widget, update }: {
  widget: WidgetDef_Button; update: (u: Partial<WidgetDef>) => void;
}) {
  const transition: ButtonTransitionType = widget.transition || 'system';
  const cfg: ButtonTransitionConfig = widget.transitionConfig || {};

  const setTransition = (t: ButtonTransitionType) => {
    update({ transition: t, transitionConfig: t === 'system' ? undefined : {} } as any);
  };

  const setCfg = (patch: Partial<ButtonTransitionConfig>) => {
    update({ transitionConfig: { ...cfg, ...patch } } as any);
  };

  return (
    <div>
      <label style={labelStyle}>Transition</label>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 60 }}>방식</span>
        <select style={{ ...selectStyle, flex: 1 }} value={transition}
          onChange={(e) => setTransition(e.target.value as ButtonTransitionType)}>
          {(Object.keys(TRANSITION_LABELS) as ButtonTransitionType[]).map(k => (
            <option key={k} value={k}>{TRANSITION_LABELS[k]}</option>
          ))}
        </select>
        <HelpButton text={
          '시스템 커서: RPG Maker MV 기본 커서 동작.\n' +
          '컬러 틴트: 상태마다 반투명 색상 오버레이 적용.\n' +
          '이미지 교체: 상태마다 img/system/ 이미지로 배경 교체.'
        } />
      </div>

      {transition === 'colorTint' && (
        <div style={{ marginTop: 4 }}>
          {TRANSITION_STATES.map(({ key, label }) => {
            const colorKey = (key + 'Color') as keyof ButtonTransitionConfig;
            const cur = (cfg[colorKey] as TransitionColor | undefined) || [255, 255, 255, 0];
            return (
              <div key={key} style={{ ...rowStyle, marginTop: 3 }}>
                <span style={{ fontSize: 11, color: '#888', width: 120, flexShrink: 0 }}>{label}</span>
                <input type="color" value={colorToHex(cur)}
                  onChange={(e) => setCfg({ [colorKey]: [...hexToRgb(e.target.value), cur[3]] as TransitionColor } as any)}
                  style={{ width: 32, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                <input type="range" min={0} max={255} value={cur[3]}
                  onChange={(e) => setCfg({ [colorKey]: [cur[0], cur[1], cur[2], +e.target.value] as TransitionColor } as any)}
                  style={{ flex: 1, margin: '0 4px' }} />
                <span style={{ fontSize: 10, color: '#aaa', width: 24 }}>{cur[3]}</span>
              </div>
            );
          })}
        </div>
      )}

      {transition === 'spriteSwap' && (
        <div style={{ marginTop: 4 }}>
          {TRANSITION_STATES.map(({ key, label }) => {
            const imgKey = (key + 'Image') as keyof ButtonTransitionConfig;
            const cur = (cfg[imgKey] as string | undefined) || '';
            return (
              <div key={key} style={{ ...rowStyle, marginTop: 3 }}>
                <span style={{ fontSize: 11, color: '#888', width: 120, flexShrink: 0 }}>{label}</span>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="img/system/ 파일명"
                  value={cur}
                  onChange={(e) => setCfg({ [imgKey]: e.target.value || undefined } as any)} />
                {cur && (
                  <button style={smallBtnStyle} onClick={() => setCfg({ [imgKey]: undefined } as any)}>×</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ButtonWidgetInspector ──────────────────────────────────

export function ButtonWidgetInspector({ sceneId: _sceneId, widget, update }: {
  sceneId: string; widget: WidgetDef_Button; update: (u: Partial<WidgetDef>) => void;
}) {
  const currentAction = widget.action || { action: 'popScene' as CommandActionType };
  const hasChildren = !!(widget.children && widget.children.length > 0);
  return (
    <div>
      {!hasChildren && (
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>레이블</span>
          <input style={{ ...inputStyle, flex: 1 }}
            value={widget.label}
            onChange={(e) => update({ label: e.target.value } as any)} />
        </div>
      )}
      {hasChildren && (
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
          자식 위젯이 있어 레이블 불사용 (커서 행 모드)
        </div>
      )}
      {/* windowed=false(기본) 텍스트 버튼의 Label 스타일 */}
      {!hasChildren && widget.windowed !== true && (
        <div>
          <label style={labelStyle}>레이블 스타일</label>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 60 }}>크기</span>
            <input type="number" style={{ ...inputStyle, width: 60 }} min={8} max={72}
              value={widget.fontSize ?? 28}
              onChange={(e) => update({ fontSize: +e.target.value || undefined } as any)} />
            <label style={{ marginLeft: 10, fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={!!widget.bold}
                onChange={(e) => update({ bold: e.target.checked || undefined } as any)} />
              Bold
            </label>
          </div>
          <div style={rowStyle}>
            <span style={{ ...inlineLabelStyle, width: 60 }}>색상</span>
            <ColorInput value={widget.color} placeholder="#ffffff" onChange={(v) => update({ color: v } as any)} />
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 60 }}>정렬</span>
            <select style={{ ...selectStyle, flex: 1 }}
              value={widget.align || 'center'}
              onChange={(e) => update({ align: e.target.value as any || undefined } as any)}>
              <option value="left">왼쪽</option>
              <option value="center">가운데</option>
              <option value="right">오른쪽</option>
            </select>
          </div>
        </div>
      )}
      <label style={{ ...labelStyle, marginTop: 6 }}>OK 동작</label>
      <ActionHandlerEditor handler={currentAction}
        onChange={(updates) => update({ action: { ...currentAction, ...updates } } as any)} />
      {(['left', 'right'] as const).map((dir) => {
        const key = dir === 'left' ? 'leftAction' : 'rightAction';
        const lbl = dir === 'left' ? '◀ 동작 (좌 키, 볼륨 감소 등)' : '▶ 동작 (우 키, 볼륨 증가 등)';
        const cur = (widget as any)[key] || { action: 'popScene' as CommandActionType };
        return (
          <div key={dir}>
            <label style={{ ...labelStyle, marginTop: 6 }}>{lbl}</label>
            <ActionHandlerEditor handler={cur}
              onChange={(updates) => update({ [key]: { ...cur, ...updates } } as any)} />
            {(widget as any)[key] && (
              <button className="ui-canvas-toolbar-btn" style={{ fontSize: 11, color: '#f88', marginTop: 2 }}
                onClick={() => update({ [key]: undefined } as any)}>
                {dir === 'left' ? '◀' : '▶'} 동작 제거
              </button>
            )}
          </div>
        );
      })}
      <div style={{ marginTop: 8 }}>
        <ButtonTransitionSection widget={widget} update={update} />
      </div>
    </div>
  );
}
