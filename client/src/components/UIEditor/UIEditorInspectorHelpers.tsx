import React, { useRef, useCallback, useState } from 'react';
import type { WidgetDef } from '../../store/uiEditorTypes';
import { inputStyle, selectStyle, smallBtnStyle, sectionStyle, labelStyle, rowStyle } from './UIEditorSceneStyles';
import HelpButton from '../common/HelpButton';
import { ScriptEditor } from '../EventEditor/ScriptEditor';
import type { EventCommand } from '../../types/rpgMakerMV';

// ── 공통 인라인 스타일 상수 ──
export const detailsSummaryStyle: React.CSSProperties = {
  ...labelStyle, cursor: 'pointer', padding: '5px 10px', background: '#252525', userSelect: 'none',
};
export const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0',
  fontSize: 11, color: '#bbb', cursor: 'pointer', userSelect: 'none',
};
export const colorPickerInputStyle: React.CSSProperties = {
  width: 28, height: 22, padding: 1, border: '1px solid #555',
  background: 'none', cursor: 'pointer', borderRadius: 2, flexShrink: 0,
};
export const inlineLabelStyle: React.CSSProperties = { fontSize: 11, color: '#888', whiteSpace: 'nowrap' };
export const accentCheckboxStyle: React.CSSProperties = { accentColor: '#4af', cursor: 'pointer' };
export const badgeStyle: React.CSSProperties = {
  background: '#2675bf', color: '#fff', fontSize: 9, padding: '1px 5px',
  borderRadius: 8, marginLeft: 4, verticalAlign: 'middle',
};

// ── SectionDetails — <details><summary> 반복 패턴 헬퍼 ──
export function SectionDetails({ title, open, badge, children }: {
  title: string; open?: boolean; badge?: boolean; children: React.ReactNode;
}) {
  return (
    <details open={open}>
      <summary style={detailsSummaryStyle}>
        {title}
        {badge && <span style={badgeStyle}>설정됨</span>}
      </summary>
      <div style={sectionStyle}>{children}</div>
    </details>
  );
}

// ── useTextInsert — textarea 커서 위치에 코드 삽입 훅 ──
export function useTextInsert(text: string, update: (u: any) => void) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = useCallback((code: string) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    update({ text: text.slice(0, s) + code + text.slice(e) });
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + code.length; ta.focus(); });
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ref, insert };
}

// ── ColorInput — 컬러피커 + 텍스트 + × 버튼 콤보 ──
export function ColorInput({ value, placeholder = '없음', onChange, clearable = true }: {
  value: string | undefined; placeholder?: string;
  onChange: (v: string | undefined) => void; clearable?: boolean;
}) {
  return <>
    <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} style={colorPickerInputStyle} />
    <input style={{ ...inputStyle, flex: 1 }} value={value || ''} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value || undefined)} />
    {clearable && value && <button style={smallBtnStyle} onClick={() => onChange(undefined)}>×</button>}
  </>;
}

// ── AlignSelects — 가로/세로 정렬 select 쌍 ──
export function AlignSelects({ align, verticalAlign, defVAlign = 'middle', update }: {
  align?: string; verticalAlign?: string; defVAlign?: string; update: (u: any) => void;
}) {
  return <>
    <div style={rowStyle}>
      <span style={{ ...inlineLabelStyle, width: 50 }}>가로정렬</span>
      <select style={{ ...selectStyle, flex: 1 }} value={align || 'left'}
        onChange={(e) => update({ align: e.target.value })}>
        <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
      </select>
    </div>
    <div style={rowStyle}>
      <span style={{ ...inlineLabelStyle, width: 50 }}>세로정렬</span>
      <select style={{ ...selectStyle, flex: 1 }} value={verticalAlign || defVAlign}
        onChange={(e) => update({ verticalAlign: e.target.value })}>
        <option value="top">위</option><option value="middle">가운데</option><option value="bottom">아래</option>
      </select>
    </div>
  </>;
}

// ── 위젯 경로 계산 헬퍼 ──
export function findWidgetPath(root: WidgetDef | undefined, targetId: string): string[] | null {
  if (!root) return null;
  if (root.id === targetId) return [root.id];
  for (const child of root.children ?? []) {
    const sub = findWidgetPath(child, targetId);
    if (sub) return [root.id, ...sub];
  }
  return null;
}

// ── ScriptPreviewField — 헤더(레이블+편집) + 코드 미리보기 블록 ──
export function ScriptPreviewField({ label, helpText, value, onChange, initialSampleTab }: {
  label: string; helpText: string;
  value: string; onChange: (v: string) => void;
  initialSampleTab?: string;
}) {
  const [showEditor, setShowEditor] = useState(false);
  const lines = value.split('\n');

  const p: unknown[] = [lines[0] ?? ''];
  const followCommands: EventCommand[] = lines.slice(1).map(line => ({
    code: 655, indent: 0, parameters: [line],
  }));

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: '#888' }}>{label}</span>
        <HelpButton text={helpText} />
        <span style={{ flex: 1 }} />
        <button style={smallBtnStyle} onClick={() => setShowEditor(true)}>편집</button>
      </div>
      <div
        style={{
          fontFamily: 'monospace', fontSize: 11, lineHeight: '16px',
          background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: 3,
          padding: '3px 6px', color: '#9cdcfe',
          maxHeight: 48, overflow: 'hidden',
          whiteSpace: 'pre', cursor: 'pointer',
        }}
        onClick={() => setShowEditor(true)}
        title="클릭하여 편집"
      >
        {value || <span style={{ fontStyle: 'italic', color: '#444' }}>비어 있음</span>}
      </div>
      {showEditor && (
        <ScriptEditor
          p={p}
          followCommands={followCommands}
          initialSampleTab={initialSampleTab}
          onOk={(params, extra) => {
            const first = (params[0] as string) ?? '';
            const rest = (extra ?? []).map(e => e.parameters[0] as string);
            onChange([first, ...rest].join('\n'));
            setShowEditor(false);
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
