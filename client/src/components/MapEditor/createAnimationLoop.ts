import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { syncEditorLightsToScene } from './threeSceneSync';

// Runtime globals (loaded via index.html script tags)
declare const RendererStrategy: any;
declare const ThreeWaterShader: any;

export function createAnimationLoop(params: {
  rendererObj: any;
  spriteset: any;
  stage: any;
  mapPxW: number;
  mapPxH: number;
  renderRequestedRef: React.MutableRefObject<boolean>;
  lastMapDataRef: React.MutableRefObject<number[] | null>;
  standalone: boolean;
}): { start: () => void; stop: () => void } {
  const { rendererObj, spriteset, stage, mapPxW, mapPxH,
    renderRequestedRef, lastMapDataRef, standalone } = params;
  const w = window as any;

  let disposed = false;
  let animFrameId: number | null = null;
  let initFrameCount = 0;
  let shadowSynced = false;
  let lastAnimFrame = -1;
  let skySphereRef: any = null;
  let lastMode3d: boolean | null = null;

  function renderOnce() {
    if (!rendererObj || disposed) return;

    if (!standalone) {
      const latestMap = useEditorStore.getState().currentMap;
      if (latestMap && (latestMap.width * TILE_SIZE_PX !== mapPxW || latestMap.height * TILE_SIZE_PX !== mapPxH)) return;

      if (latestMap && latestMap.data !== lastMapDataRef.current) {
        w.$dataMap.data = [...latestMap.data];
        if (spriteset._tilemap) {
          spriteset._tilemap._mapData = w.$dataMap.data;
          spriteset._tilemap._needsRepaint = true;
        }
        lastMapDataRef.current = latestMap.data;
      }
    }

    const strategy = RendererStrategy.getStrategy();
    strategy.render(rendererObj, stage);
  }

  function animationLoop() {
    if (disposed) return;
    animFrameId = requestAnimationFrame(animationLoop);

    if (!spriteset._tilemap || !spriteset._tilemap.isReady()) return;

    // 초기 프레임: 타일맵 강제 repaint
    if (initFrameCount < 10) {
      spriteset._tilemap._needsRepaint = true;
      initFrameCount++;
    }

    if (standalone) {
      // standalone 모드: 간소화된 렌더 루프 (spriteset.update + render만)
      try { spriteset.update(); } catch (_e) {}
      const strategy = RendererStrategy.getStrategy();
      strategy.render(rendererObj, stage);
      return;
    }

    // ShadowLight 초기화 대기
    const _SL = w.ShadowLight;
    const shadowPending = _SL && w.ConfigManager?.shadowLight && !_SL._active;
    if (shadowPending && initFrameCount < 60) {
      spriteset._tilemap._needsRepaint = true;
      initFrameCount++;
    }
    if (!shadowSynced && _SL && _SL._active && w.ConfigManager?.shadowLight) {
      shadowSynced = true;
      const es = useEditorStore.getState();
      syncEditorLightsToScene(rendererObj.scene, es.currentMap?.editorLights, es.mode3d);
    }

    // 2D 모드에서 스카이 스피어 숨기기 (비동기 로딩 후 추가될 수 있으므로 렌더 루프에서 체크)
    const curMode3d = !!w.ConfigManager?.mode3d;
    // mode3d 변경 시 skySphereRef 캐시 무효화
    if (curMode3d !== lastMode3d) {
      skySphereRef = null;
      lastMode3d = curMode3d;
    }
    if (!skySphereRef || !skySphereRef.parent) {
      skySphereRef = null;
      rendererObj.scene.traverse((obj: any) => {
        if (obj._isParallaxSky) skySphereRef = obj;
      });
    }
    if (skySphereRef) skySphereRef.visible = curMode3d;

    // spriteset.update()로 Tilemap.animationCount 증가
    try {
      spriteset.update();
    } catch (_e) {}

    // 물 타일 애니메이션: animationFrame이 변경되었으면 repaint
    const tilemap = spriteset._tilemap;
    if (tilemap.animationFrame !== lastAnimFrame) {
      lastAnimFrame = tilemap.animationFrame;
      tilemap._needsRepaint = true;
    }

    // 물 셰이더 시간 업데이트 + 물 메시 uTime 갱신 + 라이트 방향 동기화
    if (typeof ThreeWaterShader !== 'undefined') {
      ThreeWaterShader._time += 1 / 60;
      ThreeWaterShader.updateAllWaterMeshes(tilemap, ThreeWaterShader._time);
      ThreeWaterShader.syncLightDirection(tilemap);
    }

    // 물 타일이 있는 맵이면 매 프레임 렌더 (wave 연속 애니메이션)
    const hasWaterShader = typeof ThreeWaterShader !== 'undefined' && ThreeWaterShader._hasWaterMesh;
    // 날씨가 활성화된 경우 매 프레임 렌더 (파티클 애니메이션)
    const hasWeather = w.$gameScreen && w.$gameScreen.weatherType() !== 'none';

    // repaint가 필요한 경우에만 렌더링
    if (tilemap._needsRepaint || renderRequestedRef.current || hasWaterShader || hasWeather) {
      renderRequestedRef.current = false;
      renderOnce();
    }
  }

  return {
    start: () => { animationLoop(); },
    stop: () => {
      disposed = true;
      if (animFrameId != null) cancelAnimationFrame(animFrameId);
    },
  };
}
