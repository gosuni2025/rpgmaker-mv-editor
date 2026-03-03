import React, { useState, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { WidgetDef, WidgetDef_Label, WidgetDef_TextArea, WidgetDef_Image, WidgetDef_Gauge, WidgetDef_List, WidgetDef_Button, WidgetDef_Scene, WidgetDef_Options } from '../../store/uiEditorTypes';
import { inputStyle, smallBtnStyle, rowStyle } from './UIEditorSceneStyles';
import { WIDGET_TYPE_COLORS, WIDGET_TYPE_LABELS } from './UIEditorWidgetTree';
import HelpButton from '../common/HelpButton';
import { AnimEffectSection } from './UIEditorAnimEffectSection';
import { SectionDetails, ColorInput, findWidgetPath, inlineLabelStyle } from './UIEditorInspectorHelpers';
import { WINDOW_BASED_TYPES, WindowStyleSection } from './UIEditorWindowStyleSection';
import { ButtonWidgetInspector } from './UIEditorButtonWidgetSection';
import { ListWidgetInspector } from './UIEditorListWidgetSection';
import {
  LabelTypeSection, TextAreaTypeSection, GaugeWidgetContent, ImageWidgetContent,
  SceneWidgetInspector, OptionsWidgetInspector,
  FocusableNavigationSection, WidgetScriptsSection,
} from './UIEditorWidgetTypeSections';

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

      <SectionDetails title="기본 속성" open>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>표시이름</span>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={(widget as any).displayName || ''}
            placeholder="(id 사용)"
            onChange={(e) => update({ displayName: e.target.value || undefined } as any)}
            title="에디터 트리에 표시할 이름. 비우면 id가 표시됩니다."
          />
        </div>
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
          <label style={{ fontSize: 11, color: '#aaa', marginLeft: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
            <input type="checkbox" checked={!!widget.topLayer}
              onChange={(e) => update({ topLayer: e.target.checked || undefined } as any)} />
            최상단(topLayer)
            <HelpButton text={
              'rowOverlay / windowLayer 위에 직접 렌더링합니다.\n\n' +
              '팝업, 전체화면 오버레이 등 항상 다른 위젯 위에 표시되어야 하는 위젯에 사용합니다.'
            } />
          </label>
        </div>
      </SectionDetails>

      <SectionDetails title="스타일 (배경 / 테두리)">
        <div style={rowStyle}>
          <span style={{ ...inlineLabelStyle, width: 60 }}>배경색</span>
          <ColorInput value={widget.bgColor} onChange={(v) => update({ bgColor: v } as any)} />
        </div>
        <div style={rowStyle}>
          <span style={{ ...inlineLabelStyle, width: 60 }}>불투명도</span>
          <input type="range" min="0" max="1" step="0.01" value={widget.bgAlpha ?? 1} style={{ flex: 1 }}
            onChange={(e) => { const v = parseFloat(e.target.value); update({ bgAlpha: v >= 1 ? undefined : v } as any); }} />
          <span style={{ fontSize: 11, color: '#ccc', width: 32, textAlign: 'right' }}>{Math.round((widget.bgAlpha ?? 1) * 100)}%</span>
        </div>
        <div style={rowStyle}>
          <span style={{ ...inlineLabelStyle, width: 60 }}>테두리 두께</span>
          <input style={{ ...inputStyle, width: 55 }} type="number" min="0" value={widget.borderWidth ?? ''} placeholder="없음"
            onChange={(e) => { const v = e.target.value.trim(); update({ borderWidth: v === '' ? undefined : (parseInt(v) || 0) } as any); }} />
        </div>
        {!!(widget.borderWidth && widget.borderWidth > 0) && (
          <div style={rowStyle}>
            <span style={{ ...inlineLabelStyle, width: 60 }}>테두리 색</span>
            <ColorInput value={widget.borderColor} clearable={false} onChange={(v) => update({ borderColor: v } as any)} />
          </div>
        )}
        {(widget.bgColor || (widget.borderWidth && widget.borderWidth > 0)) && (
          <div style={rowStyle}>
            <span style={{ ...inlineLabelStyle, width: 60 }}>모서리 곡률</span>
            <input style={{ ...inputStyle, width: 55 }} type="number" min="0" value={widget.borderRadius ?? ''} placeholder="0"
              onChange={(e) => { const v = e.target.value.trim(); update({ borderRadius: v === '' ? undefined : (parseInt(v) || 0) } as any); }} />
            <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>px</span>
          </div>
        )}
      </SectionDetails>

      {WINDOW_BASED_TYPES.includes(widget.type) && (
        <SectionDetails title="창 스타일">
          <WindowStyleSection widget={widget} update={update} />
        </SectionDetails>
      )}

      {widget.type !== 'panel' && (
        <SectionDetails title={`콘텐츠 (${widget.type})`} open>
          {widget.type === 'label' && <LabelTypeSection widget={widget as WidgetDef_Label} update={update} />}
          {widget.type === 'textArea' && <TextAreaTypeSection widget={widget as WidgetDef_TextArea} update={update} />}
          {widget.type === 'gauge' && <GaugeWidgetContent widget={widget as WidgetDef_Gauge} update={update} gaugeSkinNames={gaugeSkinNames} />}
          {widget.type === 'image' && <ImageWidgetContent widget={widget as WidgetDef_Image} update={update} />}
          {widget.type === 'button' && <ButtonWidgetInspector sceneId={sceneId} widget={widget as WidgetDef_Button} update={update} />}
          {isListLike && <ListWidgetInspector sceneId={sceneId} widget={widget as WidgetDef_List} update={update} />}
          {widget.type === 'scene' && <SceneWidgetInspector widget={widget as WidgetDef_Scene} update={update} />}
          {widget.type === 'options' && <OptionsWidgetInspector widget={widget as WidgetDef_Options} update={update} />}
        </SectionDetails>
      )}

      <FocusableNavigationSection widget={widget} update={update} />
      <WidgetScriptsSection widget={widget} update={update} />

      <SectionDetails title="애니메이션">
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
      </SectionDetails>
    </div>
  );
}
