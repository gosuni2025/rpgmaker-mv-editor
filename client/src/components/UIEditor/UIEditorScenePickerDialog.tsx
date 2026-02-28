import React, { useState, useMemo, useEffect, useRef } from 'react';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import useEscClose from '../../hooks/useEscClose';

type SceneCategory = 'original' | 'custom' | 'sub' | 'plugin';

interface SceneEntry {
  value: string;
  label: string;
  category: SceneCategory;
  isCustom: boolean;
  /** sceneRedirects에서 이 씬을 가리키는 오리지널 씬 이름 */
  redirectsFrom?: string;
}

interface Props {
  currentScene: string;
  availableScenes: { value: string; label: string; category?: string }[];
  customScenes: { id: string; displayName: string }[];
  sceneRedirects?: Record<string, string>;
  onSelect: (scene: string) => void;
  onClose: () => void;
}

const TAB_DEFS: { id: SceneCategory; label: string }[] = [
  { id: 'original', label: '오리지널' },
  { id: 'custom',   label: '커스텀 복제' },
  { id: 'sub',      label: '서브씬' },
  { id: 'plugin',   label: '플러그인' },
];

export default function UIEditorScenePickerDialog({
  currentScene,
  availableScenes,
  customScenes,
  sceneRedirects,
  onSelect,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(currentScene);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [previewLayout, setPreviewLayout] = useState({ scale: 1, left: 0, top: 0 });

  const GAME_W = 816;
  const GAME_H = 624;

  useEscClose(onClose);

  // redirectsFrom 역인덱스: 커스텀씬값 → 오리지널씬명
  const redirectFromMap = useMemo<Record<string, string>>(() => {
    if (!sceneRedirects) return {};
    return Object.fromEntries(
      Object.entries(sceneRedirects).map(([orig, cs]) => [cs, orig])
    );
  }, [sceneRedirects]);

  const allScenes = useMemo<SceneEntry[]>(() => [
    ...availableScenes.map((s) => ({
      value: s.value,
      label: s.label,
      category: (s.category ?? 'original') as SceneCategory,
      isCustom: false,
    })),
    ...customScenes.map((s) => {
      const csKey = `Scene_CS_${s.id}`;
      return {
        value: csKey,
        label: `${s.displayName} (${csKey})`,
        category: 'custom' as SceneCategory,
        isCustom: true,
        redirectsFrom: redirectFromMap[csKey],
      };
    }),
  ], [availableScenes, customScenes, redirectFromMap]);

  // 비어있지 않은 탭 목록
  const activeTabs = useMemo(
    () => TAB_DEFS.filter((t) => allScenes.some((s) => s.category === t.id)),
    [allScenes],
  );

  // 초기 탭: currentScene의 카테고리
  const initialTab = useMemo<SceneCategory>(() => {
    if (currentScene.startsWith('Scene_CS_')) return 'custom';
    const entry = allScenes.find((s) => s.value === currentScene);
    return (entry?.category as SceneCategory) ?? activeTabs[0]?.id ?? 'original';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeTab, setActiveTab] = useState<SceneCategory>(initialTab);

  // 탭 내 검색 필터
  const tabScenes = useMemo<SceneEntry[]>(() => {
    const inTab = allScenes.filter((s) => s.category === activeTab);
    if (!search.trim()) return inTab;
    const q = search.trim();
    return inTab.filter((s) => fuzzyMatch(s.label, q) || fuzzyMatch(s.value, q));
  }, [allScenes, activeTab, search]);

  // 탭 전환 시 focused 보정
  useEffect(() => {
    if (tabScenes.length === 0) return;
    if (!tabScenes.find((s) => s.value === focused)) {
      setFocused(tabScenes[0].value);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 검색 결과 변경 시 focused 보정
  useEffect(() => {
    if (tabScenes.length === 0) return;
    if (!tabScenes.find((s) => s.value === focused)) {
      setFocused(tabScenes[0].value);
    }
  }, [tabScenes]); // eslint-disable-line react-hooks/exhaustive-deps

  // iframe 메시지 수신
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'bridgeReady') setIframeReady(true);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // 프리뷰 영역 크기에 맞춰 동적 스케일 계산
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => {
      const s = Math.min(wrap.clientWidth / GAME_W, wrap.clientHeight / GAME_H);
      setPreviewLayout({
        scale: s,
        left: Math.max(0, (wrap.clientWidth - GAME_W * s) / 2),
        top: Math.max(0, (wrap.clientHeight - GAME_H * s) / 2),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // 포커스 씬 변경 시 iframe 로드
  useEffect(() => {
    if (!iframeReady || !focused) return;
    if (focused.startsWith('Scene_CS_')) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
    }
    iframeRef.current?.contentWindow?.postMessage({ type: 'loadScene', sceneName: focused }, '*');
  }, [iframeReady, focused]);

  // 포커스된 항목 스크롤 뷰
  const focusedIdx = tabScenes.findIndex((s) => s.value === focused);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll<HTMLElement>('.sp-item');
    items[focusedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = tabScenes.findIndex((s) => s.value === focused);
      const next = e.key === 'ArrowDown'
        ? Math.min(Math.max(idx, 0) + 1, tabScenes.length - 1)
        : Math.max(Math.min(idx, tabScenes.length) - 1, 0);
      if (tabScenes[next]) setFocused(tabScenes[next].value);
    } else if (e.key === 'Enter') {
      if (focused) { onSelect(focused); onClose(); }
    }
  };

  const showTabs = activeTabs.length >= 2;

  return (
    <div className="sp-overlay" onKeyDown={handleKeyDown}>
      <div className="sp-dialog">
        <div className="sp-header">
          씬 선택
          <button className="sp-close" onClick={onClose} title="닫기">×</button>
        </div>

        <div className="sp-body">
          {/* ── 왼쪽: 탭 + 검색 + 목록 ── */}
          <div className="sp-left">
            {showTabs && (
              <div className="sp-tabs">
                {activeTabs.map((t) => {
                  const count = allScenes.filter((s) => s.category === t.id).length;
                  return (
                    <button
                      key={t.id}
                      className={`sp-tab${activeTab === t.id ? ' active' : ''}`}
                      onClick={() => { setActiveTab(t.id); setSearch(''); }}
                    >
                      {t.label}
                      <span className="sp-tab-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="sp-search-wrap">
              <input
                autoFocus
                type="text"
                className="sp-search-input"
                placeholder="씬 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); }
                }}
              />
              {search && (
                <span className="sp-search-clear" onClick={() => setSearch('')}>×</span>
              )}
            </div>

            <div className="sp-list" ref={listRef}>
              {tabScenes.length === 0 && (
                <div className="sp-empty">결과 없음</div>
              )}
              {tabScenes.map((s) => (
                <div
                  key={s.value}
                  className={`sp-item${s.value === focused ? ' focused' : ''}${s.value === currentScene ? ' current' : ''}`}
                  onClick={() => { onSelect(s.value); onClose(); }}
                  onMouseEnter={() => setFocused(s.value)}
                >
                  <span className="sp-item-label">{s.label}</span>
                  {s.redirectsFrom && (
                    <span className="sp-badge sp-badge-redirect" title={`${s.redirectsFrom} 교체`}>
                      ↩ {s.redirectsFrom.replace('Scene_', '')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── 오른쪽: 프리뷰 ── */}
          <div className="sp-preview">
            <div className="sp-preview-scene-name">{focused}</div>
            <div className="sp-preview-wrap" ref={wrapRef}>
              <iframe
                ref={iframeRef}
                src="/api/ui-editor/preview"
                className="sp-preview-iframe"
                title="씬 미리보기"
                style={{
                  transform: `scale(${previewLayout.scale})`,
                  left: previewLayout.left,
                  top: previewLayout.top,
                }}
              />
              {!iframeReady && (
                <div className="sp-preview-loading">로딩 중...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
