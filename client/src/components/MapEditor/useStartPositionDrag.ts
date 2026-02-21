import React, { useRef, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';

export interface StartPositionDragResult {
  playerStartDragPos: { x: number; y: number } | null;
  testStartDragPos: { x: number; y: number } | null;
  vehicleStartDragPos: { x: number; y: number; vehicle: 'boat' | 'ship' | 'airship' } | null;
  tryStartPositionMouseDown: (tile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>) => boolean;
  handleStartPositionDragMove: (tile: { x: number; y: number }) => boolean;
  handleStartPositionDragUp: () => boolean;
  handleStartPositionDragLeave: () => void;
}

export function useStartPositionDrag(): StartPositionDragResult {
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const currentMap = useEditorStore((s) => s.currentMap);
  const setSelectedEventIds = useEditorStore((s) => s.setSelectedEventIds);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);
  const setSelectedStartPosition = useEditorStore((s) => s.setSelectedStartPosition);
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);
  const setTestStartPosition = useEditorStore((s) => s.setTestStartPosition);
  const setVehicleStartPosition = useEditorStore((s) => s.setVehicleStartPosition);

  // Player start position drag
  const isDraggingPlayerStart = useRef(false);
  const playerStartDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const playerStartDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [playerStartDragPos, setPlayerStartDragPos] = useState<{ x: number; y: number } | null>(null);

  // Test start position drag
  const isDraggingTestStart = useRef(false);
  const testStartDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const testStartDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [testStartDragPos, setTestStartDragPos] = useState<{ x: number; y: number } | null>(null);

  // Vehicle start position drag
  const isDraggingVehicleStart = useRef<'boat' | 'ship' | 'airship' | null>(null);
  const vehicleStartDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const vehicleStartDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [vehicleStartDragPos, setVehicleStartDragPos] = useState<{ x: number; y: number; vehicle: 'boat' | 'ship' | 'airship' } | null>(null);

  const tryStartPositionMouseDown = useCallback((tile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>): boolean => {
    if (e.metaKey || e.ctrlKey) return false;

    const isPlayerStart = systemData && currentMapId === systemData.startMapId
      && tile.x === systemData.startX && tile.y === systemData.startY;

    if (isPlayerStart) {
      isDraggingPlayerStart.current = true;
      playerStartDragPosRef.current = { x: tile.x, y: tile.y };
      playerStartDragOriginRef.current = { x: tile.x, y: tile.y };
      setPlayerStartDragPos({ x: tile.x, y: tile.y });
      setSelectedEventIds([]);
      setSelectedEventId(null);
      setSelectedStartPosition('player');
      return true;
    }

    // 탈것 시작 위치 확인
    if (systemData) {
      for (const vk of ['boat', 'ship', 'airship'] as const) {
        const vData = systemData[vk];
        if (vData && vData.startMapId === currentMapId && tile.x === vData.startX && tile.y === vData.startY) {
          isDraggingVehicleStart.current = vk;
          vehicleStartDragPosRef.current = { x: tile.x, y: tile.y };
          vehicleStartDragOriginRef.current = { x: tile.x, y: tile.y };
          setVehicleStartDragPos({ x: tile.x, y: tile.y, vehicle: vk });
          setSelectedEventIds([]);
          setSelectedEventId(null);
          setSelectedStartPosition(vk);
          return true;
        }
      }
    }

    // 테스트 시작 위치
    const testPos = currentMap?.testStartPosition;
    if (testPos && tile.x === testPos.x && tile.y === testPos.y) {
      isDraggingTestStart.current = true;
      testStartDragPosRef.current = { x: tile.x, y: tile.y };
      testStartDragOriginRef.current = { x: tile.x, y: tile.y };
      setTestStartDragPos({ x: tile.x, y: tile.y });
      setSelectedEventIds([]);
      setSelectedEventId(null);
      setSelectedStartPosition(null);
      return true;
    }

    return false;
  }, [systemData, currentMapId, currentMap, setSelectedEventIds, setSelectedEventId, setSelectedStartPosition]);

  const handleStartPositionDragMove = useCallback((tile: { x: number; y: number }): boolean => {
    if (isDraggingPlayerStart.current) {
      playerStartDragPosRef.current = { x: tile.x, y: tile.y };
      setPlayerStartDragPos({ x: tile.x, y: tile.y });
      return true;
    }
    if (isDraggingTestStart.current) {
      testStartDragPosRef.current = { x: tile.x, y: tile.y };
      setTestStartDragPos({ x: tile.x, y: tile.y });
      return true;
    }
    if (isDraggingVehicleStart.current) {
      vehicleStartDragPosRef.current = { x: tile.x, y: tile.y };
      setVehicleStartDragPos({ x: tile.x, y: tile.y, vehicle: isDraggingVehicleStart.current });
      return true;
    }
    return false;
  }, []);

  const handleStartPositionDragUp = useCallback((): boolean => {
    if (isDraggingPlayerStart.current) {
      isDraggingPlayerStart.current = false;
      const dragPos = playerStartDragPosRef.current;
      const origin = playerStartDragOriginRef.current;
      const moved = dragPos && origin && (dragPos.x !== origin.x || dragPos.y !== origin.y);
      if (moved && currentMapId) {
        setPlayerStartPosition(currentMapId, dragPos!.x, dragPos!.y).then(() => {
          playerStartDragPosRef.current = null;
          playerStartDragOriginRef.current = null;
          setPlayerStartDragPos(null);
        });
      } else {
        playerStartDragPosRef.current = null;
        playerStartDragOriginRef.current = null;
        setPlayerStartDragPos(null);
      }
      return true;
    }
    if (isDraggingTestStart.current) {
      isDraggingTestStart.current = false;
      const dragPos = testStartDragPosRef.current;
      const origin = testStartDragOriginRef.current;
      const moved = dragPos && origin && (dragPos.x !== origin.x || dragPos.y !== origin.y);
      if (moved) setTestStartPosition(dragPos!.x, dragPos!.y);
      testStartDragPosRef.current = null;
      testStartDragOriginRef.current = null;
      setTestStartDragPos(null);
      return true;
    }
    if (isDraggingVehicleStart.current) {
      const vehicle = isDraggingVehicleStart.current;
      isDraggingVehicleStart.current = null;
      const dragPos = vehicleStartDragPosRef.current;
      const origin = vehicleStartDragOriginRef.current;
      const moved = dragPos && origin && (dragPos.x !== origin.x || dragPos.y !== origin.y);
      if (moved && currentMapId) {
        setVehicleStartPosition(vehicle, currentMapId, dragPos!.x, dragPos!.y).then(() => {
          vehicleStartDragPosRef.current = null;
          vehicleStartDragOriginRef.current = null;
          setVehicleStartDragPos(null);
        });
      } else {
        vehicleStartDragPosRef.current = null;
        vehicleStartDragOriginRef.current = null;
        setVehicleStartDragPos(null);
      }
      return true;
    }
    return false;
  }, [currentMapId, setPlayerStartPosition, setTestStartPosition, setVehicleStartPosition]);

  const handleStartPositionDragLeave = useCallback(() => {
    if (isDraggingPlayerStart.current) {
      isDraggingPlayerStart.current = false;
      playerStartDragPosRef.current = null;
      playerStartDragOriginRef.current = null;
      setPlayerStartDragPos(null);
    }
    if (isDraggingTestStart.current) {
      isDraggingTestStart.current = false;
      testStartDragPosRef.current = null;
      testStartDragOriginRef.current = null;
      setTestStartDragPos(null);
    }
    if (isDraggingVehicleStart.current) {
      isDraggingVehicleStart.current = null;
      vehicleStartDragPosRef.current = null;
      vehicleStartDragOriginRef.current = null;
      setVehicleStartDragPos(null);
    }
  }, []);

  return {
    playerStartDragPos, testStartDragPos, vehicleStartDragPos,
    tryStartPositionMouseDown, handleStartPositionDragMove,
    handleStartPositionDragUp, handleStartPositionDragLeave,
  };
}
