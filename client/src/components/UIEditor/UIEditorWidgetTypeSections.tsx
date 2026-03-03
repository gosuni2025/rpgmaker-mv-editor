import React, { useState, useEffect } from 'react';
import type {
  WidgetDef, WidgetType, WidgetDef_Label, WidgetDef_TextArea, WidgetDef_Image,
  WidgetDef_Gauge, WidgetDef_Scene, WidgetDef_Options,
  OptionItemDef, ImageSource,
} from '../../store/uiEditorTypes';
import { inputStyle, selectStyle, deleteBtnStyle, labelStyle, rowStyle, sectionStyle } from './UIEditorSceneStyles';
import HelpButton from '../common/HelpButton';
import { ExpressionPickerButton } from './UIEditorExpressionPicker';
import {
  checkboxLabelStyle, accentCheckboxStyle, inlineLabelStyle, badgeStyle, detailsSummaryStyle,
  SectionDetails, useTextInsert, AlignSelects, ColorInput, ScriptPreviewField,
} from './UIEditorInspectorHelpers';
import { dragState } from './UIEditorSceneUtils';

// ── LabelTypeSection ───────────────────────────────────────

export function LabelTypeSection({ widget, update }: { widget: WidgetDef_Label; update: (u: Partial<WidgetDef>) => void }) {
  const { ref, insert } = useTextInsert(widget.text, update as any);
  return (
    <div>
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <span style={inlineLabelStyle}>텍스트</span>
        <ExpressionPickerButton mode="text" onInsert={insert} />
      </div>
      <textarea ref={ref} style={{ ...inputStyle, height: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
        value={widget.text} placeholder="{actor[0].name}, {gold}, {var:1} 사용 가능"
        onChange={(e) => update({ text: e.target.value } as any)} />
      <AlignSelects align={widget.align} verticalAlign={widget.verticalAlign} defVAlign="middle" update={update as any} />
      <label style={checkboxLabelStyle}>
        <input type="checkbox" checked={widget.useTextEx === true}
          onChange={(e) => update({ useTextEx: e.target.checked || undefined } as any)}
          style={accentCheckboxStyle} />
        확장 텍스트 (\c[N] 지원)
        <HelpButton text={'true로 설정하면 \\c[N], \\i[N] 등 확장 텍스트 코드를 지원합니다.\n일반 텍스트보다 렌더링 비용이 높습니다.'} />
      </label>
      <div style={rowStyle}>
        <span style={{ ...inlineLabelStyle, width: 50 }}>텍스트 색</span>
        <ColorInput value={widget.color} onChange={(v) => update({ color: v } as any)} />
      </div>
    </div>
  );
}

// ── TextAreaTypeSection ────────────────────────────────────

export function TextAreaTypeSection({ widget, update }: { widget: WidgetDef_TextArea; update: (u: Partial<WidgetDef>) => void }) {
  const { ref, insert } = useTextInsert(widget.text, update as any);
  return (
    <div>
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <span style={inlineLabelStyle}>텍스트</span>
        <ExpressionPickerButton mode="text" onInsert={insert} />
      </div>
      <textarea ref={ref} style={{ ...inputStyle, height: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
        value={widget.text} placeholder="{$ctx.item&&$ctx.item.description||''} 등 표현식 사용 가능"
        onChange={(e) => update({ text: e.target.value } as any)} />
      <AlignSelects align={widget.align} verticalAlign={widget.verticalAlign} defVAlign="top" update={update as any} />
      <div style={rowStyle}>
        <span style={{ ...inlineLabelStyle, width: 50 }}>줄 높이</span>
        <input style={{ ...inputStyle, width: 60 }} type="number" value={widget.lineHeight ?? ''} placeholder="기본"
          onChange={(e) => { const v = e.target.value.trim(); update({ lineHeight: v === '' ? undefined : (parseInt(v) || undefined) } as any); }} />
        <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>px</span>
      </div>
    </div>
  );
}

// ── GaugeWidgetContent ─────────────────────────────────────

export function GaugeWidgetContent({ widget, update, gaugeSkinNames }: {
  widget: WidgetDef_Gauge; update: (u: Partial<WidgetDef>) => void; gaugeSkinNames: string[];
}) {
  return (
    <div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>현재값 식</span>
        <input style={{ ...inputStyle, flex: 1 }}
          placeholder="e.g. $gameParty.members()[0].hp"
          value={widget.valueExpr || ''}
          onChange={(e) => update({ valueExpr: e.target.value || undefined } as any)} />
        <ExpressionPickerButton mode="js" onInsert={(code) => update({ valueExpr: code } as any)} />
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>최대값 식</span>
        <input style={{ ...inputStyle, flex: 1 }}
          placeholder="e.g. $gameParty.members()[0].mhp"
          value={widget.maxExpr || ''}
          onChange={(e) => update({ maxExpr: e.target.value || undefined } as any)} />
        <ExpressionPickerButton mode="js" onInsert={(code) => update({ maxExpr: code } as any)} />
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>레이블 식</span>
        <input style={{ ...inputStyle, flex: 1 }}
          placeholder="e.g. 'HP'"
          value={widget.labelExpr || ''}
          onChange={(e) => update({ labelExpr: e.target.value || undefined } as any)} />
        <ExpressionPickerButton mode="js" onInsert={(code) => update({ labelExpr: code } as any)} />
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>액터 인덱스 식</span>
        <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
          placeholder="e.g. $ctx.actorIndex"
          value={widget.actorIndexExpr || ''}
          onChange={(e) => update({ actorIndexExpr: e.target.value || undefined } as any)} />
        <ExpressionPickerButton mode="js" onInsert={(code) => update({ actorIndexExpr: code } as any)} />
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>게이지 스킨</span>
        <select style={{ ...selectStyle, flex: 1 }}
          value={widget.gaugeSkinId || ''}
          onChange={(e) => update({ gaugeSkinId: e.target.value || undefined } as any)}>
          <option value="">(없음 — Window.png 폴백)</option>
          {gaugeSkinNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <label style={{ ...checkboxLabelStyle, padding: '2px 0 2px' }}>
        <input type="checkbox" checked={widget.showLabel !== false}
          onChange={(e) => update({ showLabel: e.target.checked } as any)}
          style={accentCheckboxStyle} />
        레이블 표시
      </label>
      <label style={{ ...checkboxLabelStyle, padding: '2px 0 2px' }}>
        <input type="checkbox" checked={widget.showValue !== false}
          onChange={(e) => update({ showValue: e.target.checked } as any)}
          style={accentCheckboxStyle} />
        수치 표시 (현재/최대)
      </label>
    </div>
  );
}

// ── ImageWidgetContent ─────────────────────────────────────

export function ImageWidgetContent({ widget, update }: {
  widget: WidgetDef_Image; update: (u: Partial<WidgetDef>) => void;
}) {
  const src: ImageSource = widget.imageSource || 'file';
  const hasBitmapExpr = !!widget.bitmapExpr;
  return (
    <div>
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#888' }}>비트맵 식</span>
        <ExpressionPickerButton mode="bitmap" onInsert={(code) => update({ bitmapExpr: code } as any)} />
      </div>
      <textarea
        style={{ ...inputStyle, height: 50, resize: 'vertical', fontFamily: 'monospace', fontSize: 10 }}
        value={widget.bitmapExpr || ''}
        placeholder="Bitmap을 반환하는 JS 식&#10;예: CSHelper.enemyBattler($ctx.enemy)&#10;비워두면 소스 타입 사용"
        onChange={(e) => update({ bitmapExpr: e.target.value || undefined } as any)}
      />
      {hasBitmapExpr && <>
        <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#888' }}>srcRect 식</span>
          <ExpressionPickerButton mode="srcRect" onInsert={(code) => update({ srcRectExpr: code } as any)} />
        </div>
        <textarea
          style={{ ...inputStyle, height: 40, resize: 'vertical', fontFamily: 'monospace', fontSize: 10 }}
          value={widget.srcRectExpr || ''}
          placeholder="{x,y,w,h}를 반환하는 JS 식&#10;예: CSHelper.actorFaceSrcRect($ctx.actor)"
          onChange={(e) => update({ srcRectExpr: e.target.value || undefined } as any)}
        />
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 70 }}>피팅</span>
          <select style={{ ...selectStyle, flex: 1 }}
            value={widget.fitMode || 'stretch'}
            onChange={(e) => update({ fitMode: e.target.value as any } as any)}>
            <option value="stretch">늘림</option>
            <option value="contain">비율 유지 (contain)</option>
            <option value="none">원본 크기</option>
          </select>
        </div>
      </>}
      {!hasBitmapExpr && <>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 70 }}>소스</span>
          <select style={{ ...selectStyle, flex: 1 }} value={src}
            onChange={(e) => update({ imageSource: e.target.value as ImageSource } as any)}>
            <option value="file">파일</option>
            <option value="actorFace">액터 얼굴</option>
            <option value="actorCharacter">액터 캐릭터</option>
          </select>
        </div>
        {src === 'file' && <>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 70 }}>이미지</span>
            <input style={{ ...inputStyle, flex: 1 }}
              value={widget.imageName || ''}
              onChange={(e) => update({ imageName: e.target.value } as any)} />
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 70 }}>폴더</span>
            <input style={{ ...inputStyle, flex: 1 }}
              value={widget.imageFolder || 'img/system/'}
              onChange={(e) => update({ imageFolder: e.target.value } as any)} />
          </div>
        </>}
        {(src === 'actorFace' || src === 'actorCharacter') && (
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 70 }}>파티 슬롯</span>
            <input style={{ ...inputStyle, width: 60 }} type="number" min={0} max={3}
              value={widget.actorIndex ?? 0}
              onChange={(e) => update({ actorIndex: parseInt(e.target.value) || 0 } as any)} />
            <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>0~3</span>
          </div>
        )}
      </>}
    </div>
  );
}

// ── SceneWidgetInspector ───────────────────────────────────

export function SceneWidgetInspector({ widget, update }: {
  widget: WidgetDef_Scene; update: (u: Partial<WidgetDef>) => void;
}) {
  const [jsonError, setJsonError] = useState('');
  const ctxJson = (() => {
    try { return JSON.stringify(widget.instanceCtx || {}, null, 2); } catch { return '{}'; }
  })();
  const [ctxText, setCtxText] = useState(ctxJson);

  // instanceCtx가 외부에서 바뀌면 textarea 동기화
  useEffect(() => {
    try { setCtxText(JSON.stringify(widget.instanceCtx || {}, null, 2)); setJsonError(''); } catch {}
  }, [widget.instanceCtx]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCtx = (text: string) => {
    setCtxText(text);
    try {
      const parsed = JSON.parse(text);
      update({ instanceCtx: parsed } as any);
      setJsonError('');
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  return (
    <div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 60 }}>씬 ID</span>
        <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
          placeholder="scene_id"
          value={widget.sceneId || ''}
          onChange={(e) => update({ sceneId: e.target.value || undefined } as any)} />
      </div>
      <label style={{ ...labelStyle, marginTop: 6 }}>
        인스턴스 컨텍스트 (instanceCtx)
        <HelpButton text={'씬 _ctx에 임시 주입할 키-값 JSON 오브젝트.\n예: {"actorIndex": 0}\n씬 내부에서 $ctx.actorIndex 등으로 접근합니다.'} />
      </label>
      <textarea
        style={{ ...inputStyle, height: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 11, border: jsonError ? '1px solid #f55' : undefined }}
        value={ctxText}
        onChange={(e) => applyCtx(e.target.value)}
      />
      {jsonError && <div style={{ fontSize: 10, color: '#f55', marginTop: 2 }}>{jsonError}</div>}
    </div>
  );
}

// ── OptionsWidgetInspector ─────────────────────────────────

export function OptionsWidgetInspector({ widget, update }: {
  widget: WidgetDef_Options; update: (u: Partial<WidgetDef>) => void;
}) {
  const opts = widget.options || [];

  const updateOpt = (i: number, field: keyof OptionItemDef, value: string) => {
    const next = opts.map((o, idx) => idx === i ? { ...o, [field]: value } : o);
    update({ options: next } as any);
  };

  const addOpt = () => {
    update({ options: [...opts, { name: '항목', symbol: 'newOption' }] } as any);
  };

  const removeOpt = (i: number) => {
    update({ options: opts.filter((_, idx) => idx !== i) } as any);
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
        옵션 항목 (ConfigManager 키와 일치해야 함)<br />
        <span style={{ color: '#666' }}>bool 키: ON/OFF 토글, 숫자 키: 볼륨(0~100)</span>
      </div>
      {opts.map((opt, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <input
            style={{ ...inputStyle, flex: 2 }}
            placeholder="표시 이름"
            value={opt.name}
            onChange={(e) => updateOpt(i, 'name', e.target.value)}
          />
          <input
            style={{ ...inputStyle, flex: 3, fontFamily: 'monospace', fontSize: 11 }}
            placeholder="symbol (예: bgmVolume)"
            value={opt.symbol}
            onChange={(e) => updateOpt(i, 'symbol', e.target.value)}
          />
          <button style={deleteBtnStyle} onClick={() => removeOpt(i)}>×</button>
        </div>
      ))}
      <button
        className="ui-canvas-toolbar-btn"
        style={{ fontSize: 11, marginTop: 2 }}
        onClick={addOpt}
      >
        + 항목 추가
      </button>
    </div>
  );
}

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
