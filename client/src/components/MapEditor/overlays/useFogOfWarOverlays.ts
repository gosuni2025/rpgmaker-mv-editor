import { useEffect } from 'react';
import useEditorStore from '../../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../../utils/tileHelper';
import { requestRenderFrames } from '../initGameGlobals';
import type { OverlayRefs } from './types';

type FogRefs = OverlayRefs & { fogOfWarMeshRef: React.MutableRefObject<any> };

function getPlayerStart(mapWidth: number, mapHeight: number) {
  const $dataSystem = (window as any).$dataSystem;
  return {
    startX: $dataSystem?.startX ?? Math.floor(mapWidth / 2),
    startY: $dataSystem?.startY ?? Math.floor(mapHeight / 2),
  };
}

/** Fog of War 2D 에디터 미리보기 오버레이 */
export function useFogOfWarOverlay(refs: FogRefs, rendererReady: number) {
  const mapWidth = useEditorStore((s) => s.currentMap?.width ?? 0);
  const mapHeight = useEditorStore((s) => s.currentMap?.height ?? 0);
  const disableFow = useEditorStore((s) => s.disableFow);
  const mode3d = useEditorStore((s) => s.mode3d);
  const fogOfWar = useEditorStore((s) => (s.currentMap as any)?.fogOfWar);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    const FogOfWarMod = (window as any).FogOfWar;
    if (!THREE || !FogOfWarMod) return;

    if (refs.fogOfWarMeshRef.current) {
      rendererObj.scene.remove(refs.fogOfWarMeshRef.current);
      const prev = refs.fogOfWarMeshRef.current;
      if (prev.traverse) {
        prev.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      } else {
        prev.geometry?.dispose();
        prev.material?.dispose();
      }
      refs.fogOfWarMeshRef.current = null;
    }
    FogOfWarMod._fogGroup = null;
    FogOfWarMod._fogMesh = null;

    if (disableFow || !fogOfWar?.enabled2D || mapWidth <= 0 || mapHeight <= 0 || mode3d) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    FogOfWarMod.setup(mapWidth, mapHeight, fogOfWar);

    const { startX, startY } = getPlayerStart(mapWidth, mapHeight);
    FogOfWarMod.updateVisibilityAt(startX, startY);

    if (!FogOfWarMod._fogTexture) return;

    const totalW = mapWidth * TILE_SIZE_PX;
    const totalH = mapHeight * TILE_SIZE_PX;
    const group = FogOfWarMod._createMesh();
    if (!group) return;

    group.position.set(totalW / 2, totalH / 2, 0);
    group.userData.editorGrid = true;
    rendererObj.scene.add(group);
    refs.fogOfWarMeshRef.current = group;

    const fogMesh = group.children[0];
    if (fogMesh?.material?.uniforms) {
      const u = fogMesh.material.uniforms;
      u.cameraWorldPos.value.set(0, 0, FogOfWarMod._fogHeight + 100);
      u.isOrtho.value = 1.0;
      u.scrollOffset.value.set(0, 0);
      u.playerPixelPos.value.set((startX + 0.5) * TILE_SIZE_PX, (startY + 0.5) * TILE_SIZE_PX);
    }

    const currentMap = (window as any).$dataMap;
    if (fogMesh?.material?.uniforms && currentMap?.editorLights?.points) {
      FogOfWarMod._updateLightUniforms(fogMesh.material.uniforms);
    }

    let animId = 0;
    const animate = () => {
      if (!refs.fogOfWarMeshRef.current || refs.fogOfWarMeshRef.current !== group) return;
      FogOfWarMod._time += 1.0 / 60.0;
      if (fogMesh?.material?.uniforms) {
        const u = fogMesh.material.uniforms;
        u.uTime.value = FogOfWarMod._time;
        u.cameraWorldPos.value.set(0, 0, FogOfWarMod._fogHeight + 100);
        const so = FogOfWarMod._shaderOverrides || {};
        if (u.dissolveStrength) u.dissolveStrength.value = so.dissolveStrength ?? 2.0;
        if (u.fadeSmoothness) u.fadeSmoothness.value = so.fadeSmoothness ?? 0.3;
        if (u.tentacleSharpness) u.tentacleSharpness.value = so.tentacleSharpness ?? 3.0;
      }
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => { cancelAnimationFrame(animId); };
  }, [
    rendererReady, mapWidth, mapHeight, disableFow, mode3d,
    fogOfWar?.enabled2D, fogOfWar?.radius, fogOfWar?.fogColor, fogOfWar?.unexploredAlpha,
    fogOfWar?.exploredAlpha, fogOfWar?.fogHeight, fogOfWar?.lineOfSight, fogOfWar?.absorption,
    fogOfWar?.visibilityBrightness, fogOfWar?.edgeAnimation, fogOfWar?.edgeAnimationSpeed,
    fogOfWar?.fogColorTop, fogOfWar?.heightGradient, fogOfWar?.godRay, fogOfWar?.godRayIntensity,
    fogOfWar?.vortex, fogOfWar?.vortexSpeed, fogOfWar?.lightScattering, fogOfWar?.lightScatterIntensity,
  ]);
}

/** Fog of War 3D Volume 에디터 미리보기 오버레이 */
export function useFogOfWar3DVolumeOverlay(refs: FogRefs, rendererReady: number) {
  const mapWidth = useEditorStore((s) => s.currentMap?.width ?? 0);
  const mapHeight = useEditorStore((s) => s.currentMap?.height ?? 0);
  const disableFow = useEditorStore((s) => s.disableFow);
  const mode3d = useEditorStore((s) => s.mode3d);
  const fogOfWar = useEditorStore((s) => (s.currentMap as any)?.fogOfWar);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const FogOfWarMod = (window as any).FogOfWar;
    const FogOfWar3DVolumeMod = (window as any).FogOfWar3DVolume;
    if (!FogOfWarMod || !FogOfWar3DVolumeMod) return;

    FogOfWar3DVolumeMod.dispose();

    if (disableFow || !fogOfWar?.enabled3D || !mode3d || mapWidth <= 0 || mapHeight <= 0) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    FogOfWarMod.setup(mapWidth, mapHeight, fogOfWar);

    const { startX, startY } = getPlayerStart(mapWidth, mapHeight);
    FogOfWarMod.updateVisibilityAt(startX, startY);

    if (!FogOfWarMod._fogTexture) return;

    const hexToRgb = (hex: string) => {
      const c = parseInt(hex.replace('#', ''), 16);
      return { r: ((c >> 16) & 0xff) / 255, g: ((c >> 8) & 0xff) / 255, b: (c & 0xff) / 255 };
    };
    const fogColorRgb = hexToRgb(fogOfWar.fogColor ?? '#000000');
    const fogColorTopRgb = (fogOfWar.heightGradient !== false)
      ? hexToRgb(fogOfWar.fogColorTop ?? '#1a1a26')
      : fogColorRgb;

    const renderer = rendererObj.renderer;
    const size = renderer.getSize(new (window as any).THREE.Vector2());

    FogOfWar3DVolumeMod.setup(mapWidth, mapHeight, size.x, size.y, {
      resolution: fogOfWar.volumeResolution ?? 4,
      fogHeight: fogOfWar.fogHeight ?? 200,
      absorption: fogOfWar.absorption ?? 0.018,
      fogColor: fogColorRgb,
      fogColorTop: fogColorTopRgb,
    });

    let animId = 0;
    const animate = () => {
      if (!FogOfWar3DVolumeMod._active) return;

      if (FogOfWarMod._active) {
        FogOfWarMod._lerpDisplay(1.0 / 60.0);
        FogOfWarMod._computeEdgeData(1.0 / 60.0);
        FogOfWarMod._updateTexture();
      }

      const camera = rendererObj.camera;
      if (camera) FogOfWar3DVolumeMod.render(renderer, camera, 1.0 / 60.0);

      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      FogOfWar3DVolumeMod.dispose();
    };
  }, [
    rendererReady, mapWidth, mapHeight, disableFow, mode3d,
    fogOfWar?.enabled3D, fogOfWar?.radius, fogOfWar?.fogColor, fogOfWar?.unexploredAlpha,
    fogOfWar?.exploredAlpha, fogOfWar?.fogHeight, fogOfWar?.lineOfSight, fogOfWar?.absorption,
    fogOfWar?.edgeAnimation, fogOfWar?.edgeAnimationSpeed, fogOfWar?.fogColorTop,
    fogOfWar?.heightGradient, fogOfWar?.volumeResolution,
  ]);
}
