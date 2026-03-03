import React, { useState, useEffect } from 'react';
import type {
  WidgetDef, WidgetDef_Label, WidgetDef_TextArea, WidgetDef_Image,
  WidgetDef_Gauge, WidgetDef_Scene, WidgetDef_Options,
  OptionItemDef, ImageSource,
} from '../../store/uiEditorTypes';
import { inputStyle, selectStyle, deleteBtnStyle, labelStyle, rowStyle } from './UIEditorSceneStyles';
import HelpButton from '../common/HelpButton';
import { ExpressionPickerButton } from './UIEditorExpressionPicker';
import {
  checkboxLabelStyle, accentCheckboxStyle, inlineLabelStyle,
  useTextInsert, AlignSelects, ColorInput,
} from './UIEditorInspectorHelpers';

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
