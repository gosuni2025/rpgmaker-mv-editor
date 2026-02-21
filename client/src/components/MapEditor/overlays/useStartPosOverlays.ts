import { useEffect } from 'react';
import useEditorStore from '../../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../../utils/tileHelper';
import { requestRenderFrames } from '../initGameGlobals';
import { disposeMeshes, createRectBorder, createTextLabel, addCharacterSprite, type TintFn } from './overlayHelpers';
import type { OverlayRefs } from './types';

function buildStartPosOverlay(
  THREE: any,
  rendererObj: any,
  meshesRef: React.MutableRefObject<any[]>,
  rendererObjRef: React.MutableRefObject<any>,
  stageRef: React.MutableRefObject<any>,
  renderRequestedRef: React.MutableRefObject<boolean>,
  tileX: number, tileY: number,
  borderColor: number,
  labelText: string, labelColor: string,
  charName: string | null, charIndex: number,
  tint?: Parameters<typeof addCharacterSprite>[9],
) {
  const px = tileX * TILE_SIZE_PX;
  const py = tileY * TILE_SIZE_PX;
  const cx = px + TILE_SIZE_PX / 2;
  const cy = py + TILE_SIZE_PX / 2;
  const hw = TILE_SIZE_PX / 2 - 1.5;
  const hh = TILE_SIZE_PX / 2 - 1.5;

  const line = createRectBorder(THREE, cx, cy, hw, hh, 5.2, borderColor, 9995);
  rendererObj.scene.add(line);
  meshesRef.current.push(line);

  const { mesh: labelMesh, labelH } = createTextLabel(THREE, labelText, cx, py - 0, 5.3, 9996, labelColor);
  // 레이블 y 보정 (타일 위에 표시)
  labelMesh.position.y = py - labelH / 2 - 2;
  rendererObj.scene.add(labelMesh);
  meshesRef.current.push(labelMesh);

  if (charName) {
    addCharacterSprite(
      THREE, rendererObjRef, meshesRef, charName, charIndex, cx, cy, 5.1, 9994,
      () => requestRenderFrames(rendererObjRef, stageRef, renderRequestedRef),
      tint,
    );
  }
}

/** Player start position overlay */
export function usePlayerStartOverlay(refs: OverlayRefs, rendererReady: number) {
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const playerCharacterName = useEditorStore((s) => s.playerCharacterName);
  const playerCharacterIndex = useEditorStore((s) => s.playerCharacterIndex);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    disposeMeshes(rendererObj, refs.startPosMeshesRef);

    if (!systemData || currentMapId !== systemData.startMapId) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    buildStartPosOverlay(
      THREE, rendererObj, refs.startPosMeshesRef,
      refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef,
      systemData.startX, systemData.startY,
      0x0078ff, '플레이어 시작점', '#4da6ff',
      playerCharacterName, playerCharacterIndex,
    );

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [systemData, currentMapId, playerCharacterName, playerCharacterIndex, rendererReady]);
}

/** Vehicle start position overlay */
export function useVehicleStartOverlay(refs: OverlayRefs, rendererReady: number) {
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const editMode = useEditorStore((s) => s.editMode);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    disposeMeshes(rendererObj, refs.vehicleStartPosMeshesRef);

    if (editMode !== 'event' || !systemData || !currentMapId) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const vehicles: { key: 'boat' | 'ship' | 'airship'; label: string; color: number; labelColor: string }[] = [
      { key: 'boat',    label: '보트',   color: 0xcc6600, labelColor: '#ff9933' },
      { key: 'ship',    label: '선박',   color: 0x6600cc, labelColor: '#9966ff' },
      { key: 'airship', label: '비행선', color: 0xcc0066, labelColor: '#ff3399' },
    ];

    for (const v of vehicles) {
      const vData = systemData[v.key];
      if (!vData || vData.startMapId !== currentMapId) continue;

      buildStartPosOverlay(
        THREE, rendererObj, refs.vehicleStartPosMeshesRef,
        refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef,
        vData.startX, vData.startY,
        v.color, v.label, v.labelColor,
        vData.characterName || null, vData.characterIndex || 0,
      );
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [systemData, currentMapId, editMode, rendererReady]);
}

/** Test start position overlay (green, EXT) */
export function useTestStartOverlay(refs: OverlayRefs, rendererReady: number) {
  const testStartPosition = useEditorStore((s) => s.currentMap?.testStartPosition ?? null);
  const playerCharacterName = useEditorStore((s) => s.playerCharacterName);
  const playerCharacterIndex = useEditorStore((s) => s.playerCharacterIndex);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    disposeMeshes(rendererObj, refs.testStartPosMeshesRef);

    if (!testStartPosition) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    // Green tint for test start character
    const greenTint: TintFn = (ctx, srcX, srcY, cw, ch, dx, dy, dw, dh, img) => {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, srcX, srcY, cw, ch, dx, dy, dw, dh);
      ctx.globalAlpha = 1.0;
      ctx.drawImage(img, srcX, srcY, cw, ch, dx, dy, dw, dh);
    };

    buildStartPosOverlay(
      THREE, rendererObj, refs.testStartPosMeshesRef,
      refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef,
      testStartPosition.x, testStartPosition.y,
      0x00cc66, '테스트 시작점', '#66ffaa',
      playerCharacterName, playerCharacterIndex,
      greenTint,
    );

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [testStartPosition, playerCharacterName, playerCharacterIndex, rendererReady]);
}
