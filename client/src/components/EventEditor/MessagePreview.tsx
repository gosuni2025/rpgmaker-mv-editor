import React, { useCallback, useEffect, useRef, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { GW, GH, PAD, LINE_H, VN_X, VN_Y, VN_W, VN_H, ThreeRefs } from './messagePreviewUtils';
import {
  initThreeScene, updateSceneMeshes, cleanupETOverlays,
  disposeThreeScene, buildTextRenderer,
  tickMapBackground, tickTextCanvas,
} from './messagePreviewScene';

interface MessagePreviewProps {
  faceName: string;
  faceIndex: number;
  background: number;
  positionType: number;
  text: string;
}

export function MessagePreview({ faceName, faceIndex, background, positionType, text }: MessagePreviewProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const threeRef    = useRef<ThreeRefs | null>(null);
  const rendererRef = useRef<any>(null);
  const rafRef      = useRef(0);
  const sceneDirtyRef = useRef(true);

  const currentMap      = useEditorStore((s) => s.currentMap);
  const selectedEventId = useEditorStore((s) => s.selectedEventId);
  const event           = currentMap?.events?.find((e) => e && e.id === selectedEventId);
  const eventTileX      = event?.x ?? null;
  const eventTileY      = event?.y ?? null;
  const eventTileRef    = useRef({ x: eventTileX, y: eventTileY });
  eventTileRef.current  = { x: eventTileX, y: eventTileY };

  const propsRef = useRef({ faceName, faceIndex, background, positionType, text });
  propsRef.current = { faceName, faceIndex, background, positionType, text };

  const [runtimeReady, setRuntimeReady] = useState(() =>
    !!(window as any).Window_Base && !!(window as any).Bitmap,
  );

  const isVNMode = text.split('\n').length > 4;
  const [vnScrollLine, setVnScrollLine] = useState(0);
  const vnScrollRef = useRef(0);
  useEffect(() => { vnScrollRef.current = vnScrollLine; sceneDirtyRef.current = true; }, [vnScrollLine]);

  // ─── 런타임 로드 대기 ───
  useEffect(() => {
    if (runtimeReady) return;
    const id = setInterval(() => {
      if ((window as any).Window_Base && (window as any).Bitmap) {
        setRuntimeReady(true); clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [runtimeReady]);

  // ─── Three.js 초기화 ───
  const initThree = useCallback(() => {
    if (!canvasRef.current || threeRef.current) return;
    const refs = initThreeScene(canvasRef.current);
    if (refs) {
      threeRef.current = refs;
      sceneDirtyRef.current = true;
    }
  }, []);

  // ─── 씬 메시 업데이트 ───
  const updateScene = useCallback(() => {
    const t = threeRef.current;
    if (!t) return;
    const { faceName: fn, faceIndex: fi, background: bg, positionType: pt, text: txt } = propsRef.current;
    updateSceneMeshes(t, fn, fi, bg, pt, txt, rendererRef.current, vnScrollRef.current);
  }, []);

  // ─── renderer(Window_Base) 생성 ───
  const doBuildRenderer = useCallback((resetScroll = false) => {
    if (!runtimeReady) return;
    cleanupETOverlays(rendererRef.current, threeRef.current?.scene);

    const r = buildTextRenderer(
      propsRef.current.text, propsRef.current.faceName,
      propsRef.current.background, propsRef.current.positionType,
      vnScrollRef.current, threeRef.current?.scene,
    );
    rendererRef.current = r;
    if (resetScroll) setVnScrollLine(0);
    sceneDirtyRef.current = true;
  }, [runtimeReady]);

  useEffect(() => { doBuildRenderer(true); }, [runtimeReady, text, faceName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sceneDirtyRef.current = true; }, [faceName, faceIndex, background, positionType, text]);

  const handleReplay = useCallback(() => { doBuildRenderer(true); }, [doBuildRenderer]);

  // ─── RAF 루프 ───
  useEffect(() => {
    if (!runtimeReady) return;

    initThree();
    updateScene();
    sceneDirtyRef.current = false;

    let running = true;
    const tick = () => {
      if (!running) return;
      const t = threeRef.current;
      const canvas = canvasRef.current;
      if (!t || !canvas) { rafRef.current = requestAnimationFrame(tick); return; }

      if (sceneDirtyRef.current) {
        updateScene();
        sceneDirtyRef.current = false;
      }

      // ExtendedText 시간 진행
      const ET = (window as any).ExtendedText;
      if (ET) ET._time += 1 / 60;

      const r = rendererRef.current;
      if (r && !r._etScene) r._etScene = t.scene;
      if (r?._etAnimSegs?.length > 0) {
        try { r._etRunAnimPass(); } catch (_) {}
      }

      tickMapBackground(t, eventTileRef.current.x, eventTileRef.current.y);
      tickTextCanvas(t, r);

      t.renderer.render(t.scene, t.camera);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(t.renderer.domElement, 0, 0, GW, GH, 0, 0, GW, GH);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeReady]);

  // ─── 언마운트 정리 ───
  useEffect(() => () => {
    cleanupETOverlays(rendererRef.current, threeRef.current?.scene);
    if (threeRef.current) {
      disposeThreeScene(threeRef.current);
      threeRef.current = null;
    }
  }, []);

  // VN 스크롤 계산
  const vnAllLines = isVNMode ? text.split('\n') : [];
  const vnHasFace  = isVNMode && !!faceName;
  const vnCurY     = VN_Y + PAD + (vnHasFace ? LINE_H : 0);
  const vnClipH    = VN_Y + VN_H - vnCurY - PAD;
  const vnMaxVisLines = Math.floor(vnClipH / LINE_H);
  const vnMaxScroll   = Math.max(0, vnAllLines.length - vnMaxVisLines);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isVNMode) return;
    e.preventDefault();
    setVnScrollLine(prev => Math.max(0, Math.min(vnMaxScroll, prev + (e.deltaY > 0 ? 1 : -1))));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 4 }}>
      <div style={{ fontSize: 11, color: isVNMode ? '#ffe066' : '#666', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {isVNMode
          ? <><span style={{ background: '#5a4200', border: '1px solid #ffe066', borderRadius: 3, padding: '1px 6px', color: '#ffe066', fontWeight: 'bold' }}>VN MODE</span> 4줄 초과 — Visual Novel 렌더링</>
          : <><span style={{ background: '#1a3a1a', border: '1px solid #4a8', borderRadius: 3, padding: '1px 6px', color: '#4da' }}>NORMAL</span> Window_Message 렌더링</>
        }
        <button
          onClick={handleReplay}
          style={{ marginLeft: 'auto', fontSize: 11, padding: '1px 8px', background: '#2a3a5a', border: '1px solid #4a6a9a', borderRadius: 3, color: '#9cf', cursor: 'pointer' }}
          title="애니메이션 다시 재생"
        >▶ 재생</button>
        {isVNMode && vnMaxScroll > 0 && (
          <>
            <button onClick={() => setVnScrollLine(p => Math.max(0, p - 1))} disabled={vnScrollLine <= 0}
              style={{ fontSize: 11, padding: '1px 6px', background: '#2a2a2a', border: '1px solid #555', borderRadius: 3, color: '#ccc', cursor: 'pointer' }}>▲</button>
            <span style={{ color: '#888', fontSize: 11 }}>{vnScrollLine + 1}/{vnAllLines.length}</span>
            <button onClick={() => setVnScrollLine(p => Math.min(vnMaxScroll, p + 1))} disabled={vnScrollLine >= vnMaxScroll}
              style={{ fontSize: 11, padding: '1px 6px', background: '#2a2a2a', border: '1px solid #555', borderRadius: 3, color: '#ccc', cursor: 'pointer' }}>▼</button>
          </>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={GW}
        height={GH}
        onWheel={handleWheel}
        style={{ width: '100%', aspectRatio: `${GW}/${GH}`, display: 'block', imageRendering: 'pixelated', background: '#222', cursor: isVNMode && vnMaxScroll > 0 ? 'ns-resize' : 'default' }}
      />

      {!runtimeReady && <div style={{ fontSize: 11, color: '#888' }}>런타임 로딩 중...</div>}
    </div>
  );
}
