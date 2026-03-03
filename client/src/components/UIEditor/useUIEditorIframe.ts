import { useEffect, useRef, useState } from 'react';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo, UIWindowOverride } from '../../store/types';

export function useUIEditorIframe(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  const projectPath = useEditorStore((s) => s.projectPath);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiEditorIframeReady = useEditorStore((s) => s.uiEditorIframeReady);
  const uiSkinsReloadToken = useEditorStore((s) => s.uiSkinsReloadToken);
  const sceneRedirects = useEditorStore((s) => s.sceneRedirects);
  const uiEditorConfigLoaded = useEditorStore((s) => s.uiEditorConfigLoaded);
  const showStats = useEditorStore((s) => s.showStats);
  const setUiEditorIframeReady = useEditorStore((s) => s.setUiEditorIframeReady);
  const setUiEditorWindows = useEditorStore((s) => s.setUiEditorWindows);
  const setUiEditorSelectedWindowId = useEditorStore((s) => s.setUiEditorSelectedWindowId);
  const loadUiEditorOverrides = useEditorStore((s) => s.loadUiEditorOverrides);
  const setSceneRedirects = useEditorStore((s) => s.setSceneRedirects);
  const setUiEditorConfigLoaded = useEditorStore((s) => s.setUiEditorConfigLoaded);

  const [statsData, setStatsData] = useState<Record<string, number | string | null> | null>(null);

  // Stats: showStats 변경 시 iframe 내 RendererStatsPanel에 postMessage로 토글 전달
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'setStats', show: showStats }, '*');
  }, [showStats, uiEditorIframeReady]);

  // 저장된 config 로드
  useEffect(() => {
    if (!projectPath) return;
    setUiEditorConfigLoaded(false);
    if (Object.keys(useEditorStore.getState().uiEditorOverrides).length > 0) {
      // 이미 오버라이드가 로드된 상태 → config도 로드된 것으로 간주
      setUiEditorConfigLoaded(true);
      return;
    }
    apiClient.get<{ overrides?: Record<string, UIWindowOverride>; sceneRedirects?: Record<string, string> }>('/ui-editor/config')
      .then((data) => {
        if (data.overrides && Object.keys(data.overrides).length > 0) {
          loadUiEditorOverrides(data.overrides);
        }
        if (data.sceneRedirects) {
          setSceneRedirects(data.sceneRedirects);
        }
        setUiEditorConfigLoaded(true);
      })
      .catch(() => { setUiEditorConfigLoaded(true); });
  }, [projectPath, loadUiEditorOverrides, setSceneRedirects, setUiEditorConfigLoaded]);

  // postMessage 수신
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const { type } = e.data ?? {};
      if (type === 'bridgeReady') {
        setUiEditorIframeReady(true);
      } else if (type === 'sceneReady') {
        const wins: UIWindowInfo[] = e.data.windows ?? [];
        setUiEditorWindows(wins);
        // originalX/Y/W/H는 UITheme.js가 applyLayout 전 저장한 진짜 RMMV 원본값
        useEditorStore.getState().setUiEditorOriginalWindows(
          wins.map((w) => ({
            ...w,
            x: w.originalX ?? w.x, y: w.originalY ?? w.y,
            width: w.originalWidth ?? w.width, height: w.originalHeight ?? w.height,
          }))
        );
        // 씬 로드 후 저장된 오버라이드를 iframe에 적용
        // rotation 계열 먼저 적용 → pivot이 설정된 후 x, y가 계산되어야 위치 오류 없음
        const ROTATION_FIRST = ['rotationX', 'rotationY', 'rotationZ', 'animPivot', 'renderCamera'];
        const overrides = useEditorStore.getState().uiEditorOverrides;
        Object.values(overrides).forEach((ov) => {
          const entries = Object.entries(ov).filter(([p]) => p !== 'className');
          const sorted = [
            ...entries.filter(([p]) => ROTATION_FIRST.includes(p)),
            ...entries.filter(([p]) => !ROTATION_FIRST.includes(p)),
          ];
          sorted.forEach(([prop, value]) => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'applyOverride', className: ov.className, prop, value }, '*'
            );
          });
        });
      } else if (type === 'windowUpdated') {
        setUiEditorWindows(e.data.windows ?? []);
      } else if (type === 'windowClicked') {
        setUiEditorSelectedWindowId(e.data.windowId ?? null);
      } else if (type === 'sceneDefUpdated') {
        // 엔진이 nativeDefault 위치를 서버에 저장했으므로 씬 재로드
        useEditorStore.getState().loadCustomScenes();
      } else if (type === 'statsUpdate') {
        setStatsData(e.data.data ?? null);
      } else if (type === 'cmdSave') {
        const s = useEditorStore.getState();
        apiClient.put('/ui-editor/config', { overrides: s.uiEditorOverrides, sceneRedirects: s.sceneRedirects })
        .then(() => {
          s.setUiEditorDirty(false);
          s.showToast('UI 테마 저장 완료');
        }).catch(() => s.showToast('저장 실패', true));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setUiEditorIframeReady, setUiEditorWindows, setUiEditorSelectedWindowId]);

  // iframe ready 후 씬 로드 (sceneRedirects 포함 — API 로드 후 redirect 후킹이 올바르게 복원되도록)
  useEffect(() => {
    if (!uiEditorIframeReady) return;
    if (!uiEditorConfigLoaded) return; // config 로드 완료 전엔 씬 로드 대기
    const currentRedirect = sceneRedirects[uiEditorScene];
    const hasCustomRedirect = currentRedirect?.startsWith('Scene_CS_');
    // 커스텀 씬이거나, 현재 씬이 커스텀 씬으로 리다이렉트된 경우 reloadCustomScenes 먼저 전송
    if (uiEditorScene.startsWith('Scene_CS_') || hasCustomRedirect) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
    }
    // 저장된 리다이렉트 재적용 (씬 전환 시 초기화되므로)
    // 현재 씬의 리다이렉트가 커스텀 씬이면 포함 (커스텀 씬으로 교체된 씬은 커스텀 씬을 프리뷰)
    // 원본 씬 편집 중이거나 비커스텀 리다이렉트인 경우 현재 씬 리다이렉트 제외
    const previewRedirects = hasCustomRedirect
      ? sceneRedirects
      : Object.fromEntries(Object.entries(sceneRedirects).filter(([k]) => k !== uiEditorScene));
    iframeRef.current?.contentWindow?.postMessage({ type: 'updateSceneRedirects', redirects: previewRedirects }, '*');
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'loadScene', sceneName: uiEditorScene }, '*'
    );
  }, [uiEditorIframeReady, uiEditorScene, sceneRedirects, uiEditorConfigLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 스킨 데이터 변경(기본 스킨 변경 등) 시 씬 재로드
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!uiEditorIframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'loadScene', sceneName: uiEditorScene }, '*'
    );
  }, [uiSkinsReloadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return { statsData };
}
