import React, { useState } from 'react';
import type { WidgetDef, WidgetType } from '../../store/uiEditorTypes';
import { inputStyle, deleteBtnStyle, rowStyle, sectionStyle } from './UIEditorSceneStyles';
import HelpButton from '../common/HelpButton';
import {
  checkboxLabelStyle, accentCheckboxStyle, inlineLabelStyle, badgeStyle, detailsSummaryStyle,
  SectionDetails, ScriptPreviewField,
} from './UIEditorInspectorHelpers';
import { dragState } from './UIEditorSceneUtils';

// ── FocusableNavigationSection — 모든 위젯 공통 네비게이션 설정 ──────────────

export const FOCUSABLE_BY_DEFAULT_TYPES = new Set<WidgetType>(['button', 'list', 'textList', 'options']);

export const NAV_DIRS = [
  { key: 'navUp',    label: '↑ 위',    color: '#4af' },
  { key: 'navDown',  label: '↓ 아래',  color: '#f84' },
  { key: 'navLeft',  label: '← 왼쪽',  color: '#4f4' },
  { key: 'navRight', label: '→ 오른쪽', color: '#fa4' },
] as const;

export function FocusableNavigationSection({ widget, update }: {
  widget: WidgetDef; update: (u: Partial<WidgetDef>) => void;
}) {
  const isFocusableByDefault = FOCUSABLE_BY_DEFAULT_TYPES.has(widget.type);
  const effectiveFocusable = widget.focusable !== undefined ? widget.focusable : isFocusableByDefault;
  const hasNavTargets = NAV_DIRS.some(d => !!(widget as any)[d.key]);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  return (
    <details open={effectiveFocusable || hasNavTargets}>
      <summary style={detailsSummaryStyle}>
        네비게이션
        {hasNavTargets && <span style={badgeStyle}>설정됨</span>}
      </summary>
      <div style={sectionStyle}>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={effectiveFocusable}
            onChange={(e) => {
              const newVal = e.target.checked;
              update({ focusable: newVal === isFocusableByDefault ? undefined : newVal } as any);
            }}
            style={accentCheckboxStyle} />
          포커스 가능 (Focusable)
          <HelpButton text={
            '이 위젯이 키보드 포커스를 받을 수 있는지 여부입니다.\n' +
            '방향키 네비게이션에 포함됩니다.\n\n' +
            'button / list / textList / options: 기본 true\n' +
            '그 외 위젯: 기본 false'
          } />
        </label>
        {effectiveFocusable && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>방향키 시 이동할 위젯 ID (트리에서 드래그하여 놓거나 직접 입력)</div>
            {NAV_DIRS.map(({ key, label, color }) => (
              <div key={key} style={rowStyle}
                onDragOver={(e) => {
                  const did = dragState.widgetId;
                  if (!did || did === widget.id) return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragOverKey !== key) setDragOverKey(key);
                }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => {
                  const did = dragState.widgetId;
                  if (!did || did === widget.id) { setDragOverKey(null); return; }
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverKey(null);
                  update({ [key]: did } as any);
                }}
              >
                <span style={{ fontSize: 11, color, width: 58, flexShrink: 0 }}>{label}</span>
                <input style={{
                  ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11,
                  ...(dragOverKey === key ? { outline: `2px solid ${color}`, background: '#1a2530' } : {}),
                }}
                  placeholder="widget-id (또는 드래그)"
                  value={(widget as any)[key] || ''}
                  onChange={(e) => update({ [key]: e.target.value || undefined } as any)} />
                {(widget as any)[key] && (
                  <button style={{ ...deleteBtnStyle, fontSize: 9, padding: '1px 4px' }}
                    onClick={() => update({ [key]: undefined } as any)}>×</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

// ── WidgetScriptsSection — 모든 위젯 공통 라이프사이클 스크립트 ──────────────

export const LIFECYCLE_EVENTS = [
  { key: 'onCreate',  label: 'onCreate',  help: '위젯 트리 구축 완료 후 1회 실행. Unity Start() / Godot _ready()에 대응.\n예: this._widgetMap[\'myLabel\']._window.setText(\'초기화 완료\');' },
  { key: 'onUpdate',  label: 'onUpdate',  help: '매 프레임 실행. Unity Update() / Godot _process()에 대응.\n성능에 주의할 것.' },
  { key: 'onRefresh', label: 'onRefresh', help: 'refresh() 호출 시 실행.\n콘텐츠 갱신 타이밍에 추가 로직을 삽입할 때 사용.' },
  { key: 'onDestroy', label: 'onDestroy', help: 'destroy() 호출 시 실행. Unity OnDestroy() / Godot _exit_tree()에 대응.' },
  { key: 'onFocus',   label: 'onFocus',   help: 'NavigationManager에 의해 이 위젯이 포커스를 얻을 때 실행.\nbutton / list 등 focusable 위젯에서 사용.' },
  { key: 'onBlur',    label: 'onBlur',    help: 'NavigationManager에 의해 이 위젯이 포커스를 잃을 때 실행.' },
] as const;

export function WidgetScriptsSection({ widget, update }: {
  widget: WidgetDef; update: (u: Partial<WidgetDef>) => void;
}) {
  const scripts = (widget as any).scripts as Record<string, string> | undefined;
  const hasAny = LIFECYCLE_EVENTS.some(ev => !!(scripts?.[ev.key]?.trim()));

  const setScript = (key: string, value: string) => {
    const next = { ...(scripts || {}), [key]: value };
    // 모두 비어있으면 undefined로 정리
    const anyFilled = Object.values(next).some(v => v.trim());
    update({ scripts: anyFilled ? next : undefined } as any);
  };

  return (
    <SectionDetails title="스크립트" badge={hasAny}>
      {LIFECYCLE_EVENTS.map(ev => (
        <ScriptPreviewField
          key={ev.key}
          label={ev.label}
          helpText={ev.help}
          value={scripts?.[ev.key] ?? ''}
          onChange={(v) => setScript(ev.key, v)}
        />
      ))}
    </SectionDetails>
  );
}
