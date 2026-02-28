import React from 'react';
import ReactDOM from 'react-dom';
import useEditorStore from '../../store/useEditorStore';
import type { CustomSceneDefV2, NavigationConfig, WidgetDef } from '../../store/uiEditorTypes';
import { WidgetTreeNode, AddWidgetMenu } from './UIEditorWidgetTree';
import { inputStyle, selectStyle, smallBtnStyle, deleteBtnStyle, sectionStyle, labelStyle, rowStyle } from './UIEditorSceneStyles';
import UIEditorDuplicateSceneDialog from './UIEditorDuplicateSceneDialog';
import { regenerateWidgetIds, WIDGET_CLIPBOARD_MARKER, getWidgetClipboard, setWidgetClipboard } from './UIEditorSceneUtils';
import { AnimEffectSection } from './UIEditorAnimEffectSection';

// ── NavigationConfigSection ──────────────────────────────────

export function NavigationConfigSection({ sceneId, nav }: { sceneId: string; nav: NavigationConfig }) {
  const updateNavigation = useEditorStore((s) => s.updateNavigation);
  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>네비게이션 설정</label>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>기본 포커스</span>
        <input style={{ ...inputStyle, flex: 1 }} value={nav.defaultFocus || ''}
          placeholder="widget id"
          onChange={(e) => updateNavigation(sceneId, { defaultFocus: e.target.value || undefined })} />
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>취소 위젯</span>
        <input style={{ ...inputStyle, flex: 1 }} value={nav.cancelWidget || ''}
          placeholder="widget id"
          onChange={(e) => updateNavigation(sceneId, { cancelWidget: e.target.value || undefined })} />
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>포커스 순서</span>
        <input style={{ ...inputStyle, flex: 1 }}
          placeholder="쉼표로 구분 (id1, id2, ...)"
          value={(nav.focusOrder || []).join(', ')}
          onChange={(e) => {
            const order = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
            updateNavigation(sceneId, { focusOrder: order.length > 0 ? order : undefined });
          }} />
      </div>
    </div>
  );
}

// ── V2ScenePanel ─────────────────────────────────────────────

export function V2ScenePanel({ sceneId, scene }: { sceneId: string; scene: CustomSceneDefV2 }) {
  const selectedId = useEditorStore((s) => s.customSceneSelectedWidget);
  const setSelectedId = useEditorStore((s) => s.setCustomSceneSelectedWidget);
  const removeWidget = useEditorStore((s) => s.removeWidget);
  const addWidget = useEditorStore((s) => s.addWidget);
  const pushCustomSceneUndo = useEditorStore((s) => s.pushCustomSceneUndo);
  const reorderWidgetInTree = useEditorStore((s) => s.reorderWidgetInTree);
  const updateCustomScene = useEditorStore((s) => s.updateCustomScene);
  const removeCustomScene = useEditorStore((s) => s.removeCustomScene);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);
  const setUiEditorScene = useEditorStore((s) => s.setUiEditorScene);
  const customSceneDirty = useEditorStore((s) => s.customSceneDirty);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const showToast = useEditorStore((s) => s.showToast);
  const [addMenuParent, setAddMenuParent] = React.useState<string | null>(null);
  const [addMenuBtnRect, setAddMenuBtnRect] = React.useState<DOMRect | null>(null);
  const addBtnRef = React.useRef<HTMLButtonElement>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = React.useState(false);
  const [treeKey, setTreeKey] = React.useState(0);
  const [treeInitialExpanded, setTreeInitialExpanded] = React.useState(true);

  // 위젯 선택 중 Delete/Backspace → 삭제 (입력 요소 포커스 시 무시)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId || selectedId === 'root') return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      pushCustomSceneUndo();
      removeWidget(sceneId, selectedId);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, sceneId, removeWidget, pushCustomSceneUndo]); // eslint-disable-line react-hooks/exhaustive-deps

  // scene/selectedId를 ref로 관리 — useEffect 클로저에서 항상 최신값 참조
  const sceneRef = React.useRef(scene);
  sceneRef.current = scene;
  const selectedIdRef = React.useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Ctrl+C: 위젯 복사 / Ctrl+V: 위젯 붙여넣기
  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'c' && !isInput) {
        const curScene = sceneRef.current;
        const curSelectedId = selectedIdRef.current;
        if (!curSelectedId || !curScene.root) return;
        function findW(w: WidgetDef): WidgetDef | null {
          if (w.id === curSelectedId) return w;
          for (const c of w.children || []) { const r = findW(c); if (r) return r; }
          return null;
        }
        const widget = findW(curScene.root);
        if (!widget) return;
        e.preventDefault();
        setWidgetClipboard(widget); // 내부 클립보드에 저장 (시스템 클립보드 실패 시 fallback)
        try {
          await navigator.clipboard.writeText(
            JSON.stringify({ _type: WIDGET_CLIPBOARD_MARKER, widget })
          );
        } catch { /* 시스템 클립보드 쓰기 실패해도 내부 클립보드에는 저장됨 */ }
        showToast(`"${widget.id}" 복사됨`);
        return;
      }

      if (e.key === 'v' && !isInput) {
        e.preventDefault();
        const curScene = sceneRef.current;
        const curSelectedId = selectedIdRef.current;

        // 1. 시스템 클립보드에서 위젯 JSON 읽기 시도
        let sourceWidget = getWidgetClipboard();
        try {
          const text = await navigator.clipboard.readText();
          const parsed = JSON.parse(text);
          if (parsed?._type === WIDGET_CLIPBOARD_MARKER && parsed.widget) {
            sourceWidget = parsed.widget;
            setWidgetClipboard(parsed.widget);
          }
        } catch { /* 시스템 클립보드 읽기 실패 → 내부 클립보드 fallback */ }

        if (!sourceWidget) return;

        const parentId = curSelectedId && curScene.root ? curSelectedId : (curScene.root?.id || 'root');
        const newWidget = regenerateWidgetIds(sourceWidget);
        pushCustomSceneUndo();
        addWidget(sceneId, parentId, newWidget);
        setSelectedId(newWidget.id);
        showToast(`위젯 붙여넣기 완료`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sceneId, addWidget, pushCustomSceneUndo, setSelectedId, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // 씬 데이터 변경 → debounce 자동저장 + iframe 프리뷰 갱신
  // customSceneDirty 대신 scene 자체를 의존성으로 사용 — 이미 dirty=true인 상태에서 재변경 시에도 타이머 리셋
  React.useEffect(() => {
    if (!customSceneDirty) return;
    const timer = setTimeout(async () => {
      await saveCustomScenes();
      const curScene = useEditorStore.getState().uiEditorScene;
      const curRedirects = useEditorStore.getState().sceneRedirects;
      const isActive = curScene === `Scene_CS_${sceneId}` || curRedirects[curScene] === `Scene_CS_${sceneId}`;
      if (isActive) {
        const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
        iframe?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
        iframe?.contentWindow?.postMessage({ type: 'loadScene', sceneName: curScene }, '*');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedWidget = React.useMemo(() => {
    if (!selectedId || !scene.root) return null;
    function find(w: WidgetDef): WidgetDef | null {
      if (w.id === selectedId) return w;
      for (const c of w.children || []) {
        const found = find(c);
        if (found) return found;
      }
      return null;
    }
    return find(scene.root);
  }, [selectedId, scene.root]);

  const handleDeleteScene = async () => {
    if (!confirm(`씬 "${scene.displayName}"을 삭제하시겠습니까?`)) return;
    removeCustomScene(sceneId);
    await saveCustomScenes();
    setUiEditorScene('Scene_Menu');
  };

  const addableParentId = selectedId && scene.root ? selectedId : (scene.root?.id || 'root');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* 씬 속성 */}
      <div style={sectionStyle}>
        <label style={labelStyle}>씬 속성</label>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>ID</span>
          <span style={{ fontSize: 12, color: '#ddd', flex: 1, fontFamily: 'monospace' }}>Scene_CS_{scene.id}</span>
          <button
            style={{ ...smallBtnStyle, padding: '2px 6px' }}
            title="클립보드에 복사"
            onClick={() => navigator.clipboard.writeText(`Scene_CS_${scene.id}`)}
          >복사</button>
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>이름</span>
          <input style={{ ...inputStyle, flex: 1 }} value={scene.displayName}
            onChange={(e) => updateCustomScene(sceneId, { displayName: e.target.value })} />
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>분류</span>
          <select
            style={{ ...selectStyle, flex: 1 }}
            value={scene.category ?? ''}
            onChange={(e) => updateCustomScene(sceneId, { category: (e.target.value || undefined) as 'sub' | 'plugin' | undefined })}
          >
            <option value="">커스텀 복제</option>
            <option value="sub">서브씬 (행 렌더링용)</option>
            <option value="plugin">플러그인 씬</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button
            style={{ ...smallBtnStyle, flex: 1, background: '#3a6ea8', padding: '4px 8px' }}
            onClick={() => setShowDuplicateDialog(true)}
          >
            씬 복제
          </button>
          <button style={{ ...deleteBtnStyle, flex: 1 }} onClick={handleDeleteScene}>
            씬 삭제
          </button>
        </div>
      </div>

      {/* 씬 레벨 애니메이션 (위젯 개별 설정의 fallback) */}
      <div style={sectionStyle}>
        <label style={labelStyle}>씬 애니메이션 (기본값)</label>
        <AnimEffectSection
          label="등장 효과"
          value={scene.enterAnimation ?? []}
          onChange={(v) => updateCustomScene(sceneId, { enterAnimation: v.length > 0 ? v : undefined } as any)}
          onUndoPush={pushCustomSceneUndo}
        />
        <AnimEffectSection
          label="퇴장 효과"
          isExit
          value={scene.exitAnimation ?? []}
          onChange={(v) => updateCustomScene(sceneId, { exitAnimation: v.length > 0 ? v : undefined } as any)}
          onUndoPush={pushCustomSceneUndo}
          entranceValue={scene.enterAnimation ?? []}
        />
        <span style={{ fontSize: 10, color: '#666' }}>위젯에 개별 설정이 없을 때 이 값이 적용됩니다.</span>
      </div>

      {/* 네비게이션 설정 */}
      <NavigationConfigSection sceneId={sceneId} nav={scene.navigation || {}} />

      {/* 위젯 계층 */}
      <div style={{ ...sectionStyle, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, flexShrink: 0, gap: 4 }}>
          <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>위젯 계층</label>
          <button
            style={{ ...smallBtnStyle, padding: '2px 5px', fontSize: 10 }}
            title="모두 펼치기"
            onClick={() => { setTreeInitialExpanded(true); setTreeKey(k => k + 1); }}
          >▾▾</button>
          <button
            style={{ ...smallBtnStyle, padding: '2px 5px', fontSize: 10 }}
            title="모두 접기"
            onClick={() => { setTreeInitialExpanded(false); setTreeKey(k => k + 1); }}
          >▸▸</button>
          <button
            ref={addBtnRef}
            style={{ ...smallBtnStyle, background: '#2675bf' }}
            onClick={() => {
              if (addMenuParent) {
                setAddMenuParent(null);
                setAddMenuBtnRect(null);
              } else {
                const rect = addBtnRef.current?.getBoundingClientRect() ?? null;
                setAddMenuBtnRect(rect);
                setAddMenuParent(addableParentId);
              }
            }}
          >
            + 위젯
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', background: '#222', borderRadius: 3, padding: 4, minHeight: 0 }}>
          {scene.root ? (
            <WidgetTreeNode
              key={treeKey}
              widget={scene.root} depth={0} sceneId={sceneId}
              selectedId={selectedId}
              initialExpanded={treeInitialExpanded}
              onSelect={(id) => { setSelectedId(id); setAddMenuParent(null); }}
              onRemove={(id) => { pushCustomSceneUndo(); removeWidget(sceneId, id); }}
              onReorder={(dragId, targetId, pos) => { pushCustomSceneUndo(); reorderWidgetInTree(sceneId, dragId, targetId, pos); }}
            />
          ) : (
            <div style={{ padding: 8, color: '#888', fontSize: 12 }}>위젯 없음</div>
          )}
        </div>
      </div>

      {/* 씬 복제 다이얼로그 */}
      {showDuplicateDialog && (
        <UIEditorDuplicateSceneDialog
          sourceScene={scene}
          onClose={() => setShowDuplicateDialog(false)}
          onDuplicated={(newId) => setUiEditorScene(`Scene_CS_${newId}`)}
        />
      )}

      {/* +위젯 팝업 (portal) */}
      {addMenuParent && addMenuBtnRect && ReactDOM.createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
            onClick={() => { setAddMenuParent(null); setAddMenuBtnRect(null); }}
          />
          <div
            style={{ position: 'fixed', left: addMenuBtnRect.left, top: addMenuBtnRect.bottom + 2, zIndex: 10000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <AddWidgetMenu
              sceneId={sceneId}
              parentId={addMenuParent}
              onClose={() => { setAddMenuParent(null); setAddMenuBtnRect(null); }}
            />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
