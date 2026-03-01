import React, { useState, useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type {
  CustomCommandDef, CustomCommandHandler, CommandActionType, WidgetDef, WidgetType, ImageSource,
  WidgetDef_Label, WidgetDef_TextArea, WidgetDef_Image, WidgetDef_Gauge,
  WidgetDef_List, WidgetDef_TextList, WidgetDef_RowSelector, WidgetDef_Options, OptionItemDef,
  WidgetDef_Button, WidgetDef_Scene, ImageRenderMode,
  ButtonTransitionType, ButtonTransitionConfig, TransitionColor,
} from '../../store/uiEditorTypes';
import type { EventCommand } from '../../types/rpgMakerMV';
import { FramePickerDialog, ImagePickerDialog } from './UIEditorPickerDialogs';
import { inputStyle, selectStyle, smallBtnStyle, deleteBtnStyle, sectionStyle, labelStyle, rowStyle } from './UIEditorSceneStyles';
import { WIDGET_TYPE_COLORS, WIDGET_TYPE_LABELS } from './UIEditorWidgetTree';
import HelpButton from '../common/HelpButton';
import { ExpressionPickerButton } from './UIEditorExpressionPicker';
import { ScriptEditor } from '../EventEditor/ScriptEditor';
import UIEditorScenePickerDialog from './UIEditorScenePickerDialog';
import { AnimEffectSection } from './UIEditorAnimEffectSection';

// ── 위젯 경로 계산 헬퍼 ──
function findWidgetPath(root: WidgetDef | undefined, targetId: string): string[] | null {
  if (!root) return null;
  if (root.id === targetId) return [root.id];
  for (const child of root.children ?? []) {
    const sub = findWidgetPath(child, targetId);
    if (sub) return [root.id, ...sub];
  }
  return null;
}

// ── ScriptPreviewField — 헤더(레이블+편집) + 코드 미리보기 블록 ──

function ScriptPreviewField({ label, helpText, value, onChange, initialSampleTab }: {
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

// ── ActionHandlerEditor ────────────────────────────────────

export function ActionHandlerEditor({ handler, onChange }: {
  handler: CustomCommandHandler;
  onChange: (updates: Partial<CustomCommandHandler>) => void;
}) {
  const action = handler.action || 'popScene';
  return (
    <div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>동작:</span>
        <select style={{ ...selectStyle, flex: 1 }} value={action}
          onChange={(e) => onChange({ action: e.target.value as CommandActionType })}>
          <option value="popScene">씬 닫기</option>
          <option value="gotoScene">씬 이동</option>
          <option value="customScene">커스텀 씬 이동</option>
          <option value="callCommonEvent">커먼 이벤트 호출</option>
          <option value="focusWidget">위젯 포커스</option>
          <option value="refreshWidgets">위젯 갱신</option>
          <option value="selectActor">액터 선택 → 씬 이동</option>
          <option value="formation">대형 (파티 순서 교체)</option>
          <option value="toggleConfig">설정 토글 (bool)</option>
          <option value="incrementConfig">설정 증가 (볼륨)</option>
          <option value="decrementConfig">설정 감소 (볼륨)</option>
          <option value="saveConfig">설정 저장</option>
          <option value="script">JS 스크립트 실행</option>
        </select>
      </div>
      {(action === 'gotoScene' || action === 'customScene' || action === 'focusWidget') && (
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>대상:</span>
          <input style={{ ...inputStyle, flex: 1 }}
            placeholder={action === 'focusWidget' ? '위젯 ID' : '씬 이름'}
            value={handler.target || ''}
            onChange={(e) => onChange({ target: e.target.value })} />
        </div>
      )}
      {(action === 'selectActor' || action === 'formation') && (
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>rowSelector ID:</span>
          <input style={{ ...inputStyle, flex: 1 }}
            placeholder="actor_select"
            value={handler.widget || ''}
            onChange={(e) => onChange({ widget: e.target.value })} />
        </div>
      )}
      {action === 'selectActor' && (
        <div>
          <label style={{ ...labelStyle, marginTop: 4 }}>액터 선택 후 이동할 씬</label>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>씬:</span>
            <input style={{ ...inputStyle, flex: 1 }}
              placeholder="Scene_Skill"
              value={handler.thenAction?.target || ''}
              onChange={(e) => onChange({ thenAction: { action: 'gotoScene', target: e.target.value } })} />
          </div>
        </div>
      )}
      {(action === 'toggleConfig' || action === 'incrementConfig' || action === 'decrementConfig') && (
        <div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>configKey:</span>
            <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
              placeholder="alwaysDash / bgmVolume …"
              value={handler.configKey || ''}
              onChange={(e) => onChange({ configKey: e.target.value })} />
          </div>
          {(action === 'incrementConfig' || action === 'decrementConfig') && (
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>step:</span>
              <input style={{ ...inputStyle, width: 60 }} type="number"
                placeholder="20"
                value={handler.step ?? ''}
                onChange={(e) => onChange({ step: parseInt(e.target.value) || undefined })} />
            </div>
          )}
        </div>
      )}
      {action === 'callCommonEvent' && (
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>이벤트 ID:</span>
          <input style={{ ...inputStyle, width: 60 }} type="number"
            value={handler.eventId || ''}
            onChange={(e) => onChange({ eventId: parseInt(e.target.value) || 0 })} />
        </div>
      )}
      {action === 'script' && (
        <ScriptPreviewField
          label="JS 코드"
          helpText="버튼 동작 시 실행할 JavaScript 코드.\n$ctx, $scene, $gameVariables 등 사용 가능."
          value={handler.code || ''}
          onChange={(v) => onChange({ code: v || undefined })}
          initialSampleTab="UI"
        />
      )}
    </div>
  );
}

// ── WindowStyleSection — 모든 window-based 위젯 공통 창 스타일 UI ─────────────

const WINDOW_BASED_TYPES: WidgetType[] = ['panel', 'button', 'list', 'textList', 'rowSelector', 'options'];

function LabelTypeSection({ widget, update }: { widget: WidgetDef_Label; update: (u: Partial<WidgetDef>) => void }) {
  const labelTextRef = useRef<HTMLTextAreaElement>(null);
  const insertLabelText = useCallback((code: string) => {
    const ta = labelTextRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    update({ text: widget.text.slice(0, s) + code + widget.text.slice(e) } as any);
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + code.length; ta.focus(); });
  }, [widget.text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#888' }}>텍스트</span>
        <ExpressionPickerButton mode="text" onInsert={insertLabelText} />
      </div>
      <textarea
        ref={labelTextRef}
        style={{ ...inputStyle, height: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
        value={widget.text}
        placeholder="{actor[0].name}, {gold}, {var:1} 사용 가능"
        onChange={(e) => update({ text: e.target.value } as any)}
      />
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 50 }}>가로정렬</span>
        <select style={{ ...selectStyle, flex: 1 }}
          value={widget.align || 'left'}
          onChange={(e) => update({ align: e.target.value as any } as any)}>
          <option value="left">왼쪽</option>
          <option value="center">가운데</option>
          <option value="right">오른쪽</option>
        </select>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 50 }}>세로정렬</span>
        <select style={{ ...selectStyle, flex: 1 }}
          value={widget.verticalAlign || 'middle'}
          onChange={(e) => update({ verticalAlign: e.target.value as any } as any)}>
          <option value="top">위</option>
          <option value="middle">가운데</option>
          <option value="bottom">아래</option>
        </select>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 11, color: '#bbb', cursor: 'pointer', userSelect: 'none' }}>
        <input type="checkbox" checked={widget.useTextEx === true}
          onChange={(e) => update({ useTextEx: e.target.checked || undefined } as any)}
          style={{ accentColor: '#4af', cursor: 'pointer' }} />
        확장 텍스트 (\c[N] 지원)
        <HelpButton text={'true로 설정하면 \\c[N], \\i[N] 등 확장 텍스트 코드를 지원합니다.\n일반 텍스트보다 렌더링 비용이 높습니다.'} />
      </label>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 50 }}>텍스트 색</span>
        <input type="color"
          value={widget.color || '#ffffff'}
          onChange={(e) => update({ color: e.target.value } as any)}
          style={{ width: 28, height: 22, padding: 1, border: '1px solid #555', background: 'none', cursor: 'pointer', borderRadius: 2, flexShrink: 0 }} />
        <input style={{ ...inputStyle, flex: 1 }}
          value={widget.color || ''}
          placeholder="없음 (기본색)"
          onChange={(e) => update({ color: e.target.value || undefined } as any)} />
        {widget.color && (
          <button style={smallBtnStyle} onClick={() => update({ color: undefined } as any)}>×</button>
        )}
      </div>
    </div>
  );
}

function TextAreaTypeSection({ widget, update }: { widget: WidgetDef_TextArea; update: (u: Partial<WidgetDef>) => void }) {
  const taTextRef = useRef<HTMLTextAreaElement>(null);
  const insertTaText = useCallback((code: string) => {
    const ta = taTextRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    update({ text: widget.text.slice(0, s) + code + widget.text.slice(e) } as any);
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + code.length; ta.focus(); });
  }, [widget.text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#888' }}>텍스트</span>
        <ExpressionPickerButton mode="text" onInsert={insertTaText} />
      </div>
      <textarea
        ref={taTextRef}
        style={{ ...inputStyle, height: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
        value={widget.text}
        placeholder="{$ctx.item&&$ctx.item.description||''} 등 표현식 사용 가능"
        onChange={(e) => update({ text: e.target.value } as any)}
      />
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 50 }}>가로정렬</span>
        <select style={{ ...selectStyle, flex: 1 }}
          value={widget.align || 'left'}
          onChange={(e) => update({ align: e.target.value as any } as any)}>
          <option value="left">왼쪽</option>
          <option value="center">가운데</option>
          <option value="right">오른쪽</option>
        </select>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 50 }}>세로정렬</span>
        <select style={{ ...selectStyle, flex: 1 }}
          value={widget.verticalAlign || 'top'}
          onChange={(e) => update({ verticalAlign: e.target.value as any } as any)}>
          <option value="top">위</option>
          <option value="middle">가운데</option>
          <option value="bottom">아래</option>
        </select>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 50 }}>줄 높이</span>
        <input style={{ ...inputStyle, width: 60 }} type="number"
          value={widget.lineHeight ?? ''}
          placeholder="기본"
          onChange={(e) => {
            const v = e.target.value.trim();
            update({ lineHeight: v === '' ? undefined : (parseInt(v) || undefined) } as any);
          }} />
        <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>px</span>
      </div>
    </div>
  );
}

function WindowStyleSection({ widget, update }: {
  widget: WidgetDef; update: (u: Partial<WidgetDef>) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  // button은 기본 off, 나머지(panel/list/rowSelector/options)는 기본 on
  const defaultWindowed = widget.type === 'button' ? false : true;
  const windowed = widget.windowed !== undefined ? widget.windowed : defaultWindowed;
  const windowStyle = widget.windowStyle ?? 'default';
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);

  const reloadPreview = async () => {
    await saveCustomScenes();
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
    iframe?.contentWindow?.postMessage({ type: 'loadScene', sceneName: uiEditorScene }, '*');
  };

  return (
    <div>
      <FramePickerDialog
        open={pickerOpen}
        current={widget.skinId ?? ''}
        onClose={() => setPickerOpen(false)}
        onSelect={(skinName, skinFile) => {
          update({ windowskinName: skinFile, skinId: skinName } as any);
          reloadPreview();
        }}
      />
      <ImagePickerDialog
        open={imagePickerOpen}
        current={widget.imageFile ?? ''}
        onClose={() => setImagePickerOpen(false)}
        onSelect={(filename) => { update({ imageFile: filename } as any); reloadPreview(); }}
      />
      <div style={rowStyle}>
        <label style={{ fontSize: 11, color: '#aaa' }}>
          <input type="checkbox" checked={windowed}
            onChange={(e) => {
              const v = e.target.checked;
              update({ windowed: v !== defaultWindowed ? v : undefined } as any);
              reloadPreview();
            }} /> 창 배경 표시
        </label>
      </div>
      {windowed && (
        <>
          <div className="ui-window-style-radios" style={{ margin: '4px 0' }}>
            {(['default', 'frame', 'image'] as const).map((style) => (
              <label key={style} className={`ui-radio-label${windowStyle === style ? ' active' : ''}`}>
                <input
                  type="radio"
                  name={`winstyle-${widget.id}`}
                  value={style}
                  checked={windowStyle === style}
                  onChange={() => { update({ windowStyle: style === 'default' ? undefined : style } as any); reloadPreview(); }}
                />
                {style === 'default' ? '기본' : style === 'frame' ? '프레임 변경' : '이미지로 변경'}
              </label>
            ))}
          </div>
          {windowStyle === 'frame' && (
            <div style={{ marginBottom: 4 }}>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: '#888', width: 70 }}>선택 프레임</span>
                <span style={{ fontSize: 11, color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {widget.skinId ?? widget.windowskinName ?? '(없음)'}
                </span>
              </div>
              <div style={rowStyle}>
                <button style={smallBtnStyle} onClick={() => setPickerOpen(true)}>프레임 선택…</button>
              </div>
            </div>
          )}
          {windowStyle === 'image' && (
            <div style={{ marginBottom: 4 }}>
              <div style={rowStyle}>
                <span style={{ fontSize: 11, color: '#888', width: 70 }}>선택 파일</span>
                <span style={{ fontSize: 11, color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {widget.imageFile ?? '(없음)'}
                </span>
              </div>
              <div style={rowStyle}>
                <button style={smallBtnStyle} onClick={() => setImagePickerOpen(true)}>파일 선택…</button>
              </div>
              <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 2 }}>
                {([['center', '원본'], ['stretch', '늘림'], ['tile', '타일'], ['fit', '비율맞춤'], ['cover', '비율채움']] as [ImageRenderMode, string][]).map(([mode, label]) => {
                  const cur = widget.imageRenderMode ?? 'center';
                  return (
                    <label key={mode} className={`ui-radio-label${cur === mode ? ' active' : ''}`} style={{ fontSize: 10 }}>
                      <input type="radio" name={`winstyle-imgmode-${widget.id}`} value={mode} checked={cur === mode}
                        onChange={() => { update({ imageRenderMode: mode } as any); reloadPreview(); }} />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 70 }}>패딩</span>
            <input style={{ ...inputStyle, width: 60 }} type="number"
              value={widget.padding ?? ''}
              placeholder="기본"
              onChange={(e) => {
                const v = e.target.value.trim();
                update({ padding: v === '' ? undefined : (parseInt(v) || 0) } as any);
              }} />
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 70 }}>배경 불투명도</span>
            <input style={{ ...inputStyle, width: 60 }} type="number" min="0" max="255"
              value={widget.backOpacity ?? ''}
              placeholder="기본"
              onChange={(e) => {
                const v = e.target.value.trim();
                update({ backOpacity: v === '' ? undefined : (parseInt(v) || 0) } as any);
              }} />
            <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>0~255</span>
          </div>
        </>
      )}
      {/* RowSelector transparent 모드: windowed=false여도 패딩 설정 가능 */}
      {!windowed && widget.type === 'rowSelector' && (
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 70 }}>패딩</span>
          <input style={{ ...inputStyle, width: 60 }} type="number"
            value={widget.padding ?? ''}
            placeholder="18"
            onChange={(e) => {
              const v = e.target.value.trim();
              update({ padding: v === '' ? undefined : (parseInt(v) || 0) } as any);
            }} />
          <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>0 = 커서 정렬</span>
        </div>
      )}
    </div>
  );
}

// ── OptionsWidgetInspector ─────────────────────────────────

function OptionsWidgetInspector({ widget, update }: {
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

// ── ButtonTransitionSection ─────────────────────────────────

const TRANSITION_LABELS: Record<ButtonTransitionType, string> = {
  system:    '시스템 커서',
  colorTint: '컬러 틴트',
  spriteSwap: '이미지 교체',
};

const TRANSITION_STATES: { key: string; label: string }[] = [
  { key: 'normal',      label: '기본 (Normal)' },
  { key: 'highlighted', label: '호버/포커스 (Highlighted)' },
  { key: 'pressed',     label: '클릭 (Pressed)' },
  { key: 'disabled',    label: '비활성 (Disabled)' },
];

function colorToHex(c: TransitionColor): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return '#' + hex(c[0]) + hex(c[1]) + hex(c[2]);
}
function hexToRgb(hex: string): [number, number, number] {
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

function ButtonWidgetInspector({ sceneId: _sceneId, widget, update }: {
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
            <span style={{ fontSize: 11, color: '#888', width: 60 }}>색상</span>
            <input type="color" value={widget.color || '#ffffff'}
              onChange={(e) => update({ color: e.target.value } as any)}
              style={{ width: 32, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
            <input style={{ ...inputStyle, flex: 1, marginLeft: 4 }}
              value={widget.color || ''}
              placeholder="#ffffff"
              onChange={(e) => update({ color: e.target.value || undefined } as any)} />
            {widget.color && (
              <button style={smallBtnStyle} onClick={() => update({ color: undefined } as any)}>×</button>
            )}
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
      <label style={{ ...labelStyle, marginTop: 6 }}>◀ 동작 (좌 키, 볼륨 감소 등)</label>
      <ActionHandlerEditor handler={widget.leftAction || { action: 'popScene' as CommandActionType }}
        onChange={(updates) => update({ leftAction: { ...(widget.leftAction || { action: 'popScene' as CommandActionType }), ...updates } } as any)} />
      {widget.leftAction && (
        <button className="ui-canvas-toolbar-btn" style={{ fontSize: 11, color: '#f88', marginTop: 2 }}
          onClick={() => update({ leftAction: undefined } as any)}>
          ◀ 동작 제거
        </button>
      )}
      <label style={{ ...labelStyle, marginTop: 6 }}>▶ 동작 (우 키, 볼륨 증가 등)</label>
      <ActionHandlerEditor handler={widget.rightAction || { action: 'popScene' as CommandActionType }}
        onChange={(updates) => update({ rightAction: { ...(widget.rightAction || { action: 'popScene' as CommandActionType }), ...updates } } as any)} />
      {widget.rightAction && (
        <button className="ui-canvas-toolbar-btn" style={{ fontSize: 11, color: '#f88', marginTop: 2 }}
          onClick={() => update({ rightAction: undefined } as any)}>
          ▶ 동작 제거
        </button>
      )}
      <div style={{ marginTop: 8 }}>
        <ButtonTransitionSection widget={widget} update={update} />
      </div>
    </div>
  );
}

// ── ListCommonSection — list / textList 공통 추가 프로퍼티 ─────────────────────

function ListCommonSection({ widget, update }: {
  widget: WidgetDef_List | WidgetDef_TextList; update: (u: Partial<WidgetDef>) => void;
}) {
  const [showScenePicker, setShowScenePicker] = useState(false);
  const customScenes = useEditorStore(s => s.customScenes);
  const customSceneEntries = Object.values(customScenes.scenes).map(s => ({
    id: s.id, displayName: s.displayName, category: s.category,
  }));

  return (
    <div>
      {/* dataScript */}
      <ScriptPreviewField
        label="dataScript"
        helpText={'행 배열을 반환하는 JS 식.\n예: $gameParty.items().map(i => ({name:i.name, iconIndex:i.iconIndex}))\n설정하면 items 목록 대신 동적으로 행을 생성합니다.'}
        value={widget.dataScript || ''}
        onChange={(v) => update({ dataScript: v || undefined } as any)}
      />

      {/* onCursor */}
      <ScriptPreviewField
        label="onCursor"
        helpText={'커서가 이동할 때 실행되는 JS 코드.\n예: $ctx.item = this._window.item();'}
        value={widget.onCursor?.code || ''}
        onChange={(v) => update({ onCursor: v ? { code: v } : undefined } as any)}
      />

      {/* itemScene (list 전용) */}
      {widget.type === 'list' && (
        <div style={{ ...rowStyle, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: '#888', width: 80, flexShrink: 0 }}>
            행 씬 ID
            <HelpButton text={'각 행을 렌더링할 UIScene ID.\n설정하면 각 행에 해당 씬을 임베드합니다.'} />
          </span>
          <span style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11,
            display: 'inline-flex', alignItems: 'center', minHeight: 22, padding: '2px 4px',
            color: (widget as WidgetDef_List).itemScene ? '#4af' : '#555',
          }}>
            {(widget as WidgetDef_List).itemScene || '(없음)'}
          </span>
          <button style={{ ...smallBtnStyle, marginLeft: 4, flexShrink: 0 }}
            onClick={() => setShowScenePicker(true)}
            title="행 씬 선택">선택</button>
          {(widget as WidgetDef_List).itemScene && (
            <button style={{ ...deleteBtnStyle, marginLeft: 2, flexShrink: 0 }}
              onClick={() => update({ itemScene: undefined } as any)}
              title="씬 제거">×</button>
          )}
          {showScenePicker && (
            <UIEditorScenePickerDialog
              currentScene={'Scene_CS_' + ((widget as WidgetDef_List).itemScene || '')}
              availableScenes={[]}
              customScenes={customSceneEntries}
              onSelect={(scene) => {
                const id = scene.replace(/^Scene_CS_/, '');
                update({ itemScene: id || undefined } as any);
              }}
              onClose={() => setShowScenePicker(false)}
            />
          )}
        </div>
      )}

      {/* autoRefresh */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 2px', fontSize: 11, color: '#bbb', cursor: 'pointer', userSelect: 'none' }}>
        <input type="checkbox" checked={widget.autoRefresh !== false}
          onChange={(e) => update({ autoRefresh: e.target.checked ? undefined : false } as any)}
          style={{ accentColor: '#4af', cursor: 'pointer' }} />
        자동 새로고침 (6프레임마다 rebuild)
        <HelpButton text={'true (기본): dataScript를 6프레임마다 재실행하여 목록을 갱신합니다.\nfalse: 자동 갱신 비활성화 (수동으로 refresh 호출 시에만 갱신).'} />
      </label>

    </div>
  );
}

// ── FocusableNavigationSection — 모든 위젯 공통 네비게이션 설정 ──────────────

const FOCUSABLE_BY_DEFAULT_TYPES = new Set<WidgetType>(['button', 'list', 'textList', 'rowSelector', 'options']);

const NAV_DIRS = [
  { key: 'navUp',    label: '↑ 위',    color: '#4af' },
  { key: 'navDown',  label: '↓ 아래',  color: '#f84' },
  { key: 'navLeft',  label: '← 왼쪽',  color: '#4f4' },
  { key: 'navRight', label: '→ 오른쪽', color: '#fa4' },
] as const;

function FocusableNavigationSection({ widget, update }: {
  widget: WidgetDef; update: (u: Partial<WidgetDef>) => void;
}) {
  const isFocusableByDefault = FOCUSABLE_BY_DEFAULT_TYPES.has(widget.type);
  const effectiveFocusable = widget.focusable !== undefined ? widget.focusable : isFocusableByDefault;
  const hasNavTargets = NAV_DIRS.some(d => !!(widget as any)[d.key]);

  return (
    <details open={effectiveFocusable || hasNavTargets}>
      <summary style={{ ...labelStyle, cursor: 'pointer', padding: '5px 10px', background: '#252525', userSelect: 'none' }}>
        네비게이션
        {hasNavTargets && <span style={{ background: '#2675bf', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 8, marginLeft: 4, verticalAlign: 'middle' }}>설정됨</span>}
      </summary>
      <div style={sectionStyle}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 11, color: '#bbb', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={effectiveFocusable}
            onChange={(e) => {
              const newVal = e.target.checked;
              update({ focusable: newVal === isFocusableByDefault ? undefined : newVal } as any);
            }}
            style={{ accentColor: '#4af', cursor: 'pointer' }} />
          포커스 가능 (Focusable)
          <HelpButton text={
            '이 위젯이 키보드 포커스를 받을 수 있는지 여부입니다.\n' +
            '방향키 네비게이션에 포함됩니다.\n\n' +
            'button / list / textList / rowSelector / options: 기본 true\n' +
            '그 외 위젯: 기본 false'
          } />
        </label>
        {effectiveFocusable && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>방향키 시 이동할 위젯 ID (비워두면 기본 동작)</div>
            {NAV_DIRS.map(({ key, label, color }) => (
              <div key={key} style={rowStyle}>
                <span style={{ fontSize: 11, color, width: 58, flexShrink: 0 }}>{label}</span>
                <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
                  placeholder="widget-id"
                  value={(widget as any)[key] || ''}
                  onChange={(e) => update({ [key]: e.target.value || undefined } as any)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

// ── WidgetScriptsSection — 모든 위젯 공통 라이프사이클 스크립트 ──────────────

const LIFECYCLE_EVENTS = [
  { key: 'onCreate',  label: 'onCreate',  help: '위젯 트리 구축 완료 후 1회 실행. Unity Start() / Godot _ready()에 대응.\n예: this._widgetMap[\'myLabel\']._window.setText(\'초기화 완료\');' },
  { key: 'onUpdate',  label: 'onUpdate',  help: '매 프레임 실행. Unity Update() / Godot _process()에 대응.\n성능에 주의할 것.' },
  { key: 'onRefresh', label: 'onRefresh', help: 'refresh() 호출 시 실행.\n콘텐츠 갱신 타이밍에 추가 로직을 삽입할 때 사용.' },
  { key: 'onDestroy', label: 'onDestroy', help: 'destroy() 호출 시 실행. Unity OnDestroy() / Godot _exit_tree()에 대응.' },
  { key: 'onFocus',   label: 'onFocus',   help: 'NavigationManager에 의해 이 위젯이 포커스를 얻을 때 실행.\nbutton / list / rowSelector 등 focusable 위젯에서 사용.' },
  { key: 'onBlur',    label: 'onBlur',    help: 'NavigationManager에 의해 이 위젯이 포커스를 잃을 때 실행.' },
] as const;

function WidgetScriptsSection({ widget, update }: {
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
    <details>
      <summary style={{ ...labelStyle, cursor: 'pointer', padding: '5px 10px', background: '#252525', userSelect: 'none' }}>
        스크립트 {hasAny && <span style={{ background: '#2675bf', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 8, marginLeft: 4, verticalAlign: 'middle' }}>설정됨</span>}
      </summary>
      <div style={sectionStyle}>
        {LIFECYCLE_EVENTS.map(ev => (
          <ScriptPreviewField
            key={ev.key}
            label={ev.label}
            helpText={ev.help}
            value={scripts?.[ev.key] ?? ''}
            onChange={(v) => setScript(ev.key, v)}
          />
        ))}
      </div>
    </details>
  );
}

// ── ListWidgetInspector ────────────────────────────────────

function ListWidgetInspector({ sceneId: _sceneId, widget, update }: {
  sceneId: string; widget: WidgetDef_List | WidgetDef_TextList; update: (u: Partial<WidgetDef>) => void;
}) {
  const items = widget.items || [];
  const handlers = widget.handlers || {};

  const addItem = () => {
    const newItems = [...items, { name: `항목${items.length + 1}`, symbol: `cmd${Date.now()}`, enabled: true }];
    update({ items: newItems } as any);
  };

  const updateItem = (idx: number, updates: Partial<CustomCommandDef>) => {
    const newItems = items.map((c, i) => i === idx ? { ...c, ...updates } : c);
    update({ items: newItems } as any);
  };

  const removeItem = (idx: number) => {
    const newItems = items.filter((_, i) => i !== idx);
    update({ items: newItems } as any);
  };

  const updateHandler = (symbol: string, updates: Partial<CustomCommandHandler>) => {
    const newHandlers = { ...handlers, [symbol]: { ...(handlers[symbol] || { action: 'popScene' as CommandActionType }), ...updates } };
    update({ handlers: newHandlers } as any);
  };

  return (
    <div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 50 }}>열 수</span>
        <input style={{ ...inputStyle, width: 55 }} type="number" value={widget.maxCols || 1}
          onChange={(e) => update({ maxCols: parseInt(e.target.value) || 1 } as any)} />
      </div>
      <label style={{ ...labelStyle, marginTop: 6 }}>커맨드 목록</label>
      {items.map((item, idx) => (
        <div key={idx} style={{ marginBottom: 8, padding: 6, background: '#2a2a2a', borderRadius: 3 }}>
          <div style={rowStyle}>
            <input style={{ ...inputStyle, flex: 1 }} value={item.name} placeholder="표시 이름"
              onChange={(e) => updateItem(idx, { name: e.target.value })} />
            <input style={{ ...inputStyle, flex: 1 }} value={item.symbol} placeholder="심볼"
              onChange={(e) => updateItem(idx, { symbol: e.target.value })} />
            {!item.enabledCondition && (
              <label style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={item.enabled !== false}
                  onChange={(e) => updateItem(idx, { enabled: e.target.checked })} /> 활성
              </label>
            )}
            <button style={deleteBtnStyle} onClick={() => removeItem(idx)}>×</button>
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>활성 조건:</span>
            <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 10 }}
              placeholder="JS 식 (비워두면 enabled 체크박스 사용)"
              value={item.enabledCondition || ''}
              onChange={(e) => updateItem(idx, { enabledCondition: e.target.value || undefined })} />
          </div>
          <ActionHandlerEditor
            handler={handlers[item.symbol] || { action: 'popScene' }}
            onChange={(updates) => updateHandler(item.symbol, updates)}
          />
        </div>
      ))}
      <button style={{ ...smallBtnStyle, width: '100%', marginTop: 4 }} onClick={addItem}>+ 항목</button>

      {/* 공통 추가 프로퍼티 섹션 */}
      <ListCommonSection widget={widget} update={update} />
    </div>
  );
}

// ── SceneWidgetInspector ───────────────────────────────────

function SceneWidgetInspector({ widget, update }: {
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

// ── WidgetInspector (main export) ─────────────────────────

const SCENE_W = 816, SCENE_H = 624;

export function WidgetInspector({ sceneId, widget }: { sceneId: string; widget: WidgetDef }) {
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const moveWidgetWithChildren = useEditorStore((s) => s.moveWidgetWithChildren);
  const renameWidget = useEditorStore((s) => s.renameWidget);
  const projectPath = useEditorStore((s) => s.projectPath);
  const pushCustomSceneUndo = useEditorStore((s) => s.pushCustomSceneUndo);
  const customScenes = useEditorStore((s) => s.customScenes);
  const showToast = useEditorStore((s) => s.showToast);
  const update = (updates: Partial<WidgetDef>) => updateWidget(sceneId, widget.id, updates);

  // 이름(ID) 변경 로컬 상태
  const [idDraft, setIdDraft] = useState(widget.id);
  useEffect(() => { setIdDraft(widget.id); }, [widget.id]);
  const applyRename = () => {
    const trimmed = idDraft.trim();
    if (trimmed && trimmed !== widget.id) {
      pushCustomSceneUndo();
      renameWidget(sceneId, widget.id, trimmed);
    } else {
      setIdDraft(widget.id);
    }
  };

  const [gaugeSkinNames, setGaugeSkinNames] = useState<string[]>([]);
  useEffect(() => {
    if (!projectPath || widget.type !== 'gauge') return;
    fetch('/api/ui-editor/skins').then(r => r.json()).then(d => {
      setGaugeSkinNames((d.skins || []).map((s: { name: string }) => s.name));
    }).catch(() => {});
  }, [projectPath, widget.type]);

  const w = widget.width;
  const h = widget.height ?? 0;
  const alignButtons = [
    { label: '가로 중앙', action: () => moveWidgetWithChildren(sceneId, widget.id, Math.round((SCENE_W - w) / 2), widget.y) },
    { label: '세로 중앙', action: () => moveWidgetWithChildren(sceneId, widget.id, widget.x, Math.round((SCENE_H - h) / 2)) },
    { label: '정중앙',    action: () => moveWidgetWithChildren(sceneId, widget.id, Math.round((SCENE_W - w) / 2), Math.round((SCENE_H - h) / 2)) },
  ];

  const isListLike = widget.type === 'list' || widget.type === 'textList';

  return (
    <div>
      {/* 위젯 타입 배지 + 복사 버튼 */}
      <div style={{ padding: '6px 10px 4px', borderBottom: '1px solid #3a3a3a', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 3,
          background: WIDGET_TYPE_COLORS[widget.type] || '#555', color: '#fff', fontWeight: 'bold',
        }}>
          {WIDGET_TYPE_LABELS[widget.type] || widget.type.toUpperCase()}
        </span>
        <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{widget.id}</span>
        <button
          style={{ ...smallBtnStyle, fontSize: 10, padding: '1px 7px', flexShrink: 0 }}
          title="위젯 경로(씬/부모/.../자신)를 클립보드에 복사"
          onClick={() => {
            const scene = customScenes?.scenes?.[sceneId] as any;
            const segments = findWidgetPath(scene?.root, widget.id);
            const path = segments
              ? `${sceneId}/${segments.join('/')}`
              : `${sceneId}/${widget.id}`;
            navigator.clipboard.writeText(path).then(() => {
              showToast(`경로 복사됨: ${path}`);
            });
          }}
        >경로 복사</button>
      </div>

      {/* ── 섹션: 기본 속성 ── */}
      <details open>
        <summary style={{ ...labelStyle, cursor: 'pointer', padding: '5px 10px', background: '#252525', userSelect: 'none' }}>기본 속성</summary>
        <div style={sectionStyle}>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 50 }}>ID</span>
            <input
              style={{ ...inputStyle, flex: 1, outline: idDraft !== widget.id ? '1px solid #f84' : undefined }}
              value={idDraft}
              onChange={(e) => setIdDraft(e.target.value)}
              onBlur={applyRename}
              onKeyDown={(e) => { if (e.key === 'Enter') { applyRename(); (e.target as HTMLInputElement).blur(); } else if (e.key === 'Escape') { setIdDraft(widget.id); } }}
              title="Enter로 확정. 모든 참조(nav 타겟, navigation 설정)가 함께 갱신됩니다."
            />
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 50 }}>X</span>
            <input style={{ ...inputStyle, width: 60 }} type="number" value={widget.x}
              onChange={(e) => update({ x: parseInt(e.target.value) || 0 } as any)} />
            <span style={{ fontSize: 11, color: '#888', width: 20 }}>Y</span>
            <input style={{ ...inputStyle, width: 60 }} type="number" value={widget.y}
              onChange={(e) => update({ y: parseInt(e.target.value) || 0 } as any)} />
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 50 }}>W</span>
            <input style={{ ...inputStyle, width: 60 }} type="number" value={widget.width}
              onChange={(e) => update({ width: parseInt(e.target.value) || 0 } as any)} />
            <span style={{ fontSize: 11, color: '#888', width: 20 }}>H</span>
            <input style={{ ...inputStyle, width: 60 }} type="number" value={widget.height ?? ''}
              placeholder="auto"
              onChange={(e) => {
                const v = e.target.value.trim();
                update({ height: v === '' ? undefined : (parseInt(v) || 0) } as any);
              }} />
          </div>
          <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 4 }}>
            {alignButtons.map(({ label, action }) => (
              <button key={label} style={smallBtnStyle} onClick={action}>{label}</button>
            ))}
          </div>
          <div style={rowStyle}>
            <label style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="checkbox" checked={widget.visible !== false}
                onChange={(e) => update({ visible: e.target.checked } as any)} />
              표시
              <HelpButton text={
                '런타임(게임)에서 이 위젯을 표시할지 여부입니다.\n\n' +
                '체크 해제 시 위젯이 화면에 보이지 않습니다.\n' +
                '스크립트로 나중에 동적으로 보이게 할 위젯에 사용합니다.'
              } />
            </label>
            <label style={{ fontSize: 11, color: '#aaa', marginLeft: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="checkbox" checked={widget.previewSelectable !== false}
                onChange={(e) => update({ previewSelectable: e.target.checked ? undefined : false } as any)} />
              preview 선택
              <HelpButton text={
                '에디터 preview에서 클릭으로 이 위젯을 선택할 수 있는지 여부입니다.\n\n' +
                '체크 해제 시 preview에서 클릭해도 이 위젯이 선택되지 않아,\n' +
                '뒤에 있는 다른 위젯을 쉽게 선택할 수 있습니다.\n\n' +
                '배경(background) 위젯처럼 클릭을 통해 실수로 선택될 경우에 유용합니다.'
              } />
            </label>
          </div>
        </div>
      </details>

      {/* ── 섹션: 스타일 (배경/테두리) ── */}
      <details>
        <summary style={{ ...labelStyle, cursor: 'pointer', padding: '5px 10px', background: '#252525', userSelect: 'none' }}>스타일 (배경 / 테두리)</summary>
        <div style={sectionStyle}>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 60 }}>배경색</span>
            <input type="color"
              value={widget.bgColor || '#000000'}
              onChange={(e) => update({ bgColor: e.target.value } as any)}
              style={{ width: 28, height: 22, padding: 1, border: '1px solid #555', background: 'none', cursor: 'pointer', borderRadius: 2, flexShrink: 0 }} />
            <input style={{ ...inputStyle, flex: 1 }}
              value={widget.bgColor || ''}
              placeholder="없음"
              onChange={(e) => update({ bgColor: e.target.value || undefined } as any)} />
            {widget.bgColor && (
              <button style={smallBtnStyle} onClick={() => update({ bgColor: undefined } as any)}>×</button>
            )}
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 60 }}>불투명도</span>
            <input type="range" min="0" max="1" step="0.01"
              value={widget.bgAlpha ?? 1}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                update({ bgAlpha: v >= 1 ? undefined : v } as any);
              }}
              style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#ccc', width: 32, textAlign: 'right' }}>
              {Math.round((widget.bgAlpha ?? 1) * 100)}%
            </span>
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 60 }}>테두리 두께</span>
            <input style={{ ...inputStyle, width: 55 }} type="number" min="0"
              value={widget.borderWidth ?? ''}
              placeholder="없음"
              onChange={(e) => {
                const v = e.target.value.trim();
                update({ borderWidth: v === '' ? undefined : (parseInt(v) || 0) } as any);
              }} />
          </div>
          {!!(widget.borderWidth && widget.borderWidth > 0) && (<>
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', width: 60 }}>테두리 색</span>
              <input type="color"
                value={widget.borderColor || '#ffffff'}
                onChange={(e) => update({ borderColor: e.target.value } as any)}
                style={{ width: 28, height: 22, padding: 1, border: '1px solid #555', background: 'none', cursor: 'pointer', borderRadius: 2, flexShrink: 0 }} />
              <input style={{ ...inputStyle, flex: 1 }}
                value={widget.borderColor || '#ffffff'}
                onChange={(e) => update({ borderColor: e.target.value } as any)} />
            </div>
          </>)}
          {(widget.bgColor || (widget.borderWidth && widget.borderWidth > 0)) && (
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', width: 60 }}>모서리 곡률</span>
              <input style={{ ...inputStyle, width: 55 }} type="number" min="0"
                value={widget.borderRadius ?? ''}
                placeholder="0"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  update({ borderRadius: v === '' ? undefined : (parseInt(v) || 0) } as any);
                }} />
              <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>px</span>
            </div>
          )}
        </div>
      </details>

      {/* ── 섹션: 창 스타일 (window-based 위젯만) ── */}
      {WINDOW_BASED_TYPES.includes(widget.type) && (
        <details>
          <summary style={{ ...labelStyle, cursor: 'pointer', padding: '5px 10px', background: '#252525', userSelect: 'none' }}>창 스타일</summary>
          <div style={sectionStyle}>
            <WindowStyleSection widget={widget} update={update} />
          </div>
        </details>
      )}

      {/* ── 섹션: 콘텐츠 (타입별 속성) ── */}
      {widget.type !== 'panel' && (
        <details open>
          <summary style={{ ...labelStyle, cursor: 'pointer', padding: '5px 10px', background: '#252525', userSelect: 'none' }}>
            콘텐츠 ({widget.type})
          </summary>
          <div style={sectionStyle}>
            {widget.type === 'label' && <LabelTypeSection widget={widget as WidgetDef_Label} update={update} />}
            {widget.type === 'textArea' && <TextAreaTypeSection widget={widget as WidgetDef_TextArea} update={update} />}
            {widget.type === 'gauge' && (() => {
              const g = widget as WidgetDef_Gauge;
              return (
                <div>
                  <div style={rowStyle}>
                    <span style={{ fontSize: 11, color: '#888', width: 70 }}>현재값 식</span>
                    <input style={{ ...inputStyle, flex: 1 }}
                      placeholder="e.g. $gameParty.members()[0].hp"
                      value={g.valueExpr || ''}
                      onChange={(e) => update({ valueExpr: e.target.value || undefined } as any)} />
                    <ExpressionPickerButton mode="js" onInsert={(code) => update({ valueExpr: code } as any)} />
                  </div>
                  <div style={rowStyle}>
                    <span style={{ fontSize: 11, color: '#888', width: 70 }}>최대값 식</span>
                    <input style={{ ...inputStyle, flex: 1 }}
                      placeholder="e.g. $gameParty.members()[0].mhp"
                      value={g.maxExpr || ''}
                      onChange={(e) => update({ maxExpr: e.target.value || undefined } as any)} />
                    <ExpressionPickerButton mode="js" onInsert={(code) => update({ maxExpr: code } as any)} />
                  </div>
                  <div style={rowStyle}>
                    <span style={{ fontSize: 11, color: '#888', width: 70 }}>레이블 식</span>
                    <input style={{ ...inputStyle, flex: 1 }}
                      placeholder="e.g. 'HP'"
                      value={g.labelExpr || ''}
                      onChange={(e) => update({ labelExpr: e.target.value || undefined } as any)} />
                    <ExpressionPickerButton mode="js" onInsert={(code) => update({ labelExpr: code } as any)} />
                  </div>
                  <div style={rowStyle}>
                    <span style={{ fontSize: 11, color: '#888', width: 70 }}>액터 인덱스 식</span>
                    <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
                      placeholder="e.g. $ctx.actorIndex"
                      value={g.actorIndexExpr || ''}
                      onChange={(e) => update({ actorIndexExpr: e.target.value || undefined } as any)} />
                    <ExpressionPickerButton mode="js" onInsert={(code) => update({ actorIndexExpr: code } as any)} />
                  </div>
                  <div style={rowStyle}>
                    <span style={{ fontSize: 11, color: '#888', width: 70 }}>게이지 스킨</span>
                    <select style={{ ...selectStyle, flex: 1 }}
                      value={g.gaugeSkinId || ''}
                      onChange={(e) => update({ gaugeSkinId: e.target.value || undefined } as any)}>
                      <option value="">(없음 — Window.png 폴백)</option>
                      {gaugeSkinNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0 2px', fontSize: 11, color: '#bbb', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={g.showLabel !== false}
                      onChange={(e) => update({ showLabel: e.target.checked } as any)}
                      style={{ accentColor: '#4af', cursor: 'pointer' }} />
                    레이블 표시
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0 2px', fontSize: 11, color: '#bbb', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={g.showValue !== false}
                      onChange={(e) => update({ showValue: e.target.checked } as any)}
                      style={{ accentColor: '#4af', cursor: 'pointer' }} />
                    수치 표시 (현재/최대)
                  </label>
                </div>
              );
            })()}
            {widget.type === 'image' && (() => {
              const img = widget as WidgetDef_Image;
              const src: ImageSource = img.imageSource || 'file';
              const hasBitmapExpr = !!img.bitmapExpr;
              return (
                <div>
                  {/* bitmapExpr 모드 */}
                  <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#888' }}>비트맵 식</span>
                    <ExpressionPickerButton mode="bitmap" onInsert={(code) => update({ bitmapExpr: code } as any)} />
                  </div>
                  <textarea
                    style={{ ...inputStyle, height: 50, resize: 'vertical', fontFamily: 'monospace', fontSize: 10 }}
                    value={img.bitmapExpr || ''}
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
                      value={img.srcRectExpr || ''}
                      placeholder="{x,y,w,h}를 반환하는 JS 식&#10;예: CSHelper.actorFaceSrcRect($ctx.actor)"
                      onChange={(e) => update({ srcRectExpr: e.target.value || undefined } as any)}
                    />
                    <div style={rowStyle}>
                      <span style={{ fontSize: 11, color: '#888', width: 70 }}>피팅</span>
                      <select style={{ ...selectStyle, flex: 1 }}
                        value={img.fitMode || 'stretch'}
                        onChange={(e) => update({ fitMode: e.target.value as any } as any)}>
                        <option value="stretch">늘림</option>
                        <option value="contain">비율 유지 (contain)</option>
                        <option value="none">원본 크기</option>
                      </select>
                    </div>
                  </>}
                  {/* 기존 소스 모드 (bitmapExpr 없을 때) */}
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
                          value={img.imageName || ''}
                          onChange={(e) => update({ imageName: e.target.value } as any)} />
                      </div>
                      <div style={rowStyle}>
                        <span style={{ fontSize: 11, color: '#888', width: 70 }}>폴더</span>
                        <input style={{ ...inputStyle, flex: 1 }}
                          value={img.imageFolder || 'img/system/'}
                          onChange={(e) => update({ imageFolder: e.target.value } as any)} />
                      </div>
                    </>}
                    {(src === 'actorFace' || src === 'actorCharacter') && (
                      <div style={rowStyle}>
                        <span style={{ fontSize: 11, color: '#888', width: 70 }}>파티 슬롯</span>
                        <input style={{ ...inputStyle, width: 60 }} type="number" min={0} max={3}
                          value={img.actorIndex ?? 0}
                          onChange={(e) => update({ actorIndex: parseInt(e.target.value) || 0 } as any)} />
                        <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>0~3</span>
                      </div>
                    )}
                  </>}
                </div>
              );
            })()}
            {widget.type === 'button' && <ButtonWidgetInspector sceneId={sceneId} widget={widget as WidgetDef_Button} update={update} />}
            {isListLike && <ListWidgetInspector sceneId={sceneId} widget={widget as WidgetDef_List} update={update} />}
            {widget.type === 'scene' && <SceneWidgetInspector widget={widget as WidgetDef_Scene} update={update} />}
            {widget.type === 'rowSelector' && (
              <>
                <div style={rowStyle}>
                  <span style={{ fontSize: 11, color: '#888', width: 80 }}>행 수</span>
                  <select style={{ ...selectStyle, width: 80 }}
                    value={(widget as WidgetDef_RowSelector).numRows === 'party' ? 'party' : 'number'}
                    onChange={(e) => update({ numRows: e.target.value === 'party' ? 'party' : 4 } as any)}>
                    <option value="party">파티 크기</option>
                    <option value="number">고정</option>
                  </select>
                  {(widget as WidgetDef_RowSelector).numRows !== 'party' && (
                    <input style={{ ...inputStyle, width: 50, marginLeft: 4 }} type="number"
                      value={(widget as WidgetDef_RowSelector).numRows as number ?? 4}
                      onChange={(e) => update({ numRows: parseInt(e.target.value) || 4 } as any)} />
                  )}
                </div>
                <div style={rowStyle}>
                  <span style={{ fontSize: 11, color: '#888', width: 80 }}>투명 선택기</span>
                  <input type="checkbox"
                    checked={(widget as WidgetDef_RowSelector).transparent ?? false}
                    onChange={(e) => update({ transparent: e.target.checked } as any)} />
                  <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>커서만 표시</span>
                </div>
                <label style={{ ...labelStyle, marginTop: 6 }}>OK 핸들러 <span style={{ color: '#666', fontWeight: 'normal' }}>(비워두면 selectActor 동작)</span></label>
                {(widget as WidgetDef_RowSelector).handlers?.['ok'] ? (
                  <>
                    <ActionHandlerEditor
                      handler={(widget as WidgetDef_RowSelector).handlers!['ok']}
                      onChange={(updates) => {
                        const h = (widget as WidgetDef_RowSelector).handlers || {};
                        update({ handlers: { ...h, ok: { ...h['ok']!, ...updates } } } as any);
                      }}
                    />
                    <button style={{ ...smallBtnStyle, color: '#c66', marginTop: 2 }}
                      onClick={() => {
                        const { ok: _ok, ...rest } = (widget as WidgetDef_RowSelector).handlers || {};
                        update({ handlers: Object.keys(rest).length ? rest : undefined } as any);
                      }}>OK 핸들러 제거</button>
                  </>
                ) : (
                  <button style={{ ...smallBtnStyle, marginTop: 2 }}
                    onClick={() => {
                      const h = (widget as WidgetDef_RowSelector).handlers || {};
                      update({ handlers: { ...h, ok: { action: 'popScene' as CommandActionType } } } as any);
                    }}>+ OK 핸들러 추가</button>
                )}
                <label style={{ ...labelStyle, marginTop: 6 }}>Cancel 핸들러 <span style={{ color: '#666', fontWeight: 'normal' }}>(비워두면 기본 네비게이션)</span></label>
                {(widget as WidgetDef_RowSelector).handlers?.['cancel'] ? (
                  <>
                    <ActionHandlerEditor
                      handler={(widget as WidgetDef_RowSelector).handlers!['cancel']}
                      onChange={(updates) => {
                        const h = (widget as WidgetDef_RowSelector).handlers || {};
                        update({ handlers: { ...h, cancel: { ...h['cancel']!, ...updates } } } as any);
                      }}
                    />
                    <button style={{ ...smallBtnStyle, color: '#c66', marginTop: 2 }}
                      onClick={() => {
                        const { cancel: _cancel, ...rest } = (widget as WidgetDef_RowSelector).handlers || {};
                        update({ handlers: Object.keys(rest).length ? rest : undefined } as any);
                      }}>Cancel 핸들러 제거</button>
                  </>
                ) : (
                  <button style={{ ...smallBtnStyle, marginTop: 2 }}
                    onClick={() => {
                      const h = (widget as WidgetDef_RowSelector).handlers || {};
                      update({ handlers: { ...h, cancel: { action: 'popScene' as CommandActionType } } } as any);
                    }}>+ Cancel 핸들러 추가</button>
                )}
              </>
            )}
            {widget.type === 'options' && <OptionsWidgetInspector widget={widget as WidgetDef_Options} update={update} />}
          </div>
        </details>
      )}

      {/* ── 섹션: 네비게이션 ── */}
      <FocusableNavigationSection widget={widget} update={update} />

      {/* ── 섹션: 스크립트 ── */}
      <WidgetScriptsSection widget={widget} update={update} />

      {/* ── 섹션: 애니메이션 ── */}
      <details>
        <summary style={{ ...labelStyle, cursor: 'pointer', padding: '5px 10px', background: '#252525', userSelect: 'none' }}>애니메이션</summary>
        <div style={sectionStyle}>
          <AnimEffectSection
            label="등장 효과"
            value={widget.enterAnimation ?? []}
            onChange={(v) => update({ enterAnimation: v.length > 0 ? v : undefined })}
            onUndoPush={pushCustomSceneUndo}
          />
          <AnimEffectSection
            label="퇴장 효과"
            isExit
            value={widget.exitAnimation ?? []}
            onChange={(v) => update({ exitAnimation: v.length > 0 ? v : undefined })}
            onUndoPush={pushCustomSceneUndo}
            entranceValue={widget.enterAnimation ?? []}
          />
        </div>
      </details>
    </div>
  );
}
