import React, { useState, useMemo, useEffect, useRef } from 'react';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import useEscClose from '../../hooks/useEscClose';

interface SceneEntry {
  value: string;
  label: string;
  isCustom: boolean;
}

interface Props {
  currentScene: string;
  availableScenes: { value: string; label: string }[];
  customScenes: { id: string; displayName: string }[];
  onSelect: (scene: string) => void;
  onClose: () => void;
}

export default function UIEditorScenePickerDialog({
  currentScene,
  availableScenes,
  customScenes,
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

  const allScenes = useMemo<SceneEntry[]>(() => [
    ...availableScenes.map((s) => ({ ...s, isCustom: false })),
    ...customScenes.map((s) => ({
      value: `Scene_CS_${s.id}`,
      label: `${s.displayName} (Scene_CS_${s.id})`,
      isCustom: true,
    })),
  ], [availableScenes, customScenes]);

  const filtered = useMemo<SceneEntry[]>(() => {
    if (!search.trim()) return allScenes;
    const q = search.trim();
    return allScenes.filter((s) => fuzzyMatch(s.label, q) || fuzzyMatch(s.value, q));
  }, [allScenes, search]);

  // 필터 결과가 바뀌면 focused 보정
  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.find((s) => s.value === focused)) {
      setFocused(filtered[0].value);
    }
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const focusedIdx = filtered.findIndex((s) => s.value === focused);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll<HTMLElement>('.sp-item');
    items[focusedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = filtered.findIndex((s) => s.value === focused);
      const next = e.key === 'ArrowDown'
        ? Math.min(Math.max(idx, 0) + 1, filtered.length - 1)
        : Math.max(Math.min(idx, filtered.length) - 1, 0);
      if (filtered[next]) setFocused(filtered[next].value);
    } else if (e.key === 'Enter') {
      if (focused) { onSelect(focused); onClose(); }
    }
  };

  return (
    <div className="sp-overlay" onKeyDown={handleKeyDown}>
      <div className="sp-dialog">
        <div className="sp-header">
          씬 선택
          <button className="sp-close" onClick={onClose} title="닫기">×</button>
        </div>

        <div className="sp-body">
          {/* ── 왼쪽: 검색 + 목록 ── */}
          <div className="sp-left">
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
              {filtered.length === 0 && (
                <div className="sp-empty">결과 없음</div>
              )}
              {filtered.map((s) => (
                <div
                  key={s.value}
                  className={`sp-item${s.value === focused ? ' focused' : ''}${s.value === currentScene ? ' current' : ''}`}
                  onClick={() => { onSelect(s.value); onClose(); }}
                  onMouseEnter={() => setFocused(s.value)}
                >
                  <span className="sp-item-label">{s.label}</span>
                  {s.isCustom && <span className="sp-badge">커스텀</span>}
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
