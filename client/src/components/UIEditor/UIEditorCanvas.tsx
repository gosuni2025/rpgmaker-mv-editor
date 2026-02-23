import React, { useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo } from '../../store/types';
import './UIEditor.css';

export default function UIEditorCanvas() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const projectPath = useEditorStore((s) => s.projectPath);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiEditorIframeReady = useEditorStore((s) => s.uiEditorIframeReady);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const setUiEditorIframeReady = useEditorStore((s) => s.setUiEditorIframeReady);
  const setUiEditorWindows = useEditorStore((s) => s.setUiEditorWindows);
  const setUiEditorSelectedWindowId = useEditorStore((s) => s.setUiEditorSelectedWindowId);

  // postMessage 수신
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const { type } = e.data ?? {};

      if (type === 'bridgeReady') {
        setUiEditorIframeReady(true);
      } else if (type === 'sceneReady') {
        const windows: UIWindowInfo[] = e.data.windows ?? [];
        setUiEditorWindows(windows);
      } else if (type === 'windowUpdated') {
        const windows: UIWindowInfo[] = e.data.windows ?? [];
        setUiEditorWindows(windows);
      } else if (type === 'windowClicked') {
        setUiEditorSelectedWindowId(e.data.windowId ?? null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setUiEditorIframeReady, setUiEditorWindows, setUiEditorSelectedWindowId]);

  // iframe ready 후 씬 로드
  useEffect(() => {
    if (!uiEditorIframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'loadScene', sceneName: uiEditorScene },
      '*'
    );
  }, [uiEditorIframeReady, uiEditorScene]);

  // 씬 변경 시 iframe에 알림 (이미 ready인 경우)
  const prevScene = useRef('');
  useEffect(() => {
    if (prevScene.current === uiEditorScene) return;
    prevScene.current = uiEditorScene;
    if (!uiEditorIframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'loadScene', sceneName: uiEditorScene },
      '*'
    );
  }, [uiEditorScene, uiEditorIframeReady]);

  // 씬 새로고침 시 현재 오버라이드 적용
  const applyOverrides = useCallback(() => {
    if (!uiEditorIframeReady) return;
    Object.values(uiEditorOverrides).forEach((ov) => {
      Object.entries(ov).forEach(([prop, value]) => {
        if (prop === 'className') return;
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'applyOverride', className: ov.className, prop, value },
          '*'
        );
      });
    });
  }, [uiEditorIframeReady, uiEditorOverrides]);

  // 오버라이드 변경 시 iframe 반영 (씬 새로고침 후 적용은 bridge에서 처리)
  useEffect(() => {
    applyOverrides();
  }, [applyOverrides]);

  if (!projectPath) {
    return (
      <div className="ui-editor-canvas">
        <div className="ui-editor-no-project">프로젝트를 먼저 열어주세요</div>
      </div>
    );
  }

  return (
    <div className="ui-editor-canvas">
      <div className="ui-editor-canvas-toolbar">
        <span>씬: {uiEditorScene}</span>
        <button
          style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 12, background: '#3c3c3c', border: '1px solid #555', color: '#ddd', borderRadius: 2, cursor: 'pointer' }}
          onClick={() => {
            setUiEditorIframeReady(false);
            if (iframeRef.current) {
              // 새로고침
              iframeRef.current.src = iframeRef.current.src;
            }
          }}
        >
          새로고침
        </button>
      </div>
      <div className="ui-editor-canvas-wrapper">
        <iframe
          id="ui-editor-iframe"
          ref={iframeRef}
          className="ui-editor-iframe"
          src="/api/ui-editor/preview"
          title="UI 에디터 미리보기"
        />
        {!uiEditorIframeReady && (
          <div className="ui-editor-loading">게임 런타임 로딩 중...</div>
        )}
      </div>
    </div>
  );
}
