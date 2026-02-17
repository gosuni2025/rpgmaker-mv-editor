import React from 'react';
import apiClient from '../../api/client';

// Runtime globals (loaded via index.html script tags)
declare const DataManager: any;

/** Request a render frame (shared helper for all overlay effects) */
export function requestRenderFrames(
  _rendererObjRef: React.MutableRefObject<any>,
  _stageRef: React.MutableRefObject<any>,
  renderRequestedRef: React.MutableRefObject<boolean>,
  _frames = 1,
) {
  // 연속 animationLoop가 돌고 있으므로 플래그만 설정
  renderRequestedRef.current = true;
}

/** 게임 런타임 전역 데이터($data*, $game*) 초기화 */
export async function initGameGlobals() {
  const w = window as any;
  if (w._editorGameInitialized) return;

  try {
    const sys = await apiClient.get<any>('/database/system');
    w.$dataSystem = sys;
    const tilesets = await apiClient.get<any>('/database/tilesets');
    w.$dataTilesets = tilesets;
    const actors = await apiClient.get<any>('/database/actors');
    w.$dataActors = actors;
    try {
      const ce = await apiClient.get<any>('/database/commonEvents');
      w.$dataCommonEvents = ce;
    } catch { w.$dataCommonEvents = []; }

    if (!w.$dataClasses) w.$dataClasses = [null];
    if (!w.$dataSkills) w.$dataSkills = [null];
    if (!w.$dataItems) w.$dataItems = [null];
    if (!w.$dataWeapons) w.$dataWeapons = [null];
    if (!w.$dataArmors) w.$dataArmors = [null];
    if (!w.$dataEnemies) w.$dataEnemies = [null];
    if (!w.$dataTroops) w.$dataTroops = [null];
    if (!w.$dataStates) w.$dataStates = [null];
    try {
      const anims = await apiClient.get<any>('/database/animations');
      w.$dataAnimations = anims;
    } catch { w.$dataAnimations = [null]; }
    if (!w.$dataMapInfos) w.$dataMapInfos = [null];

    DataManager.createGameObjects();

    // 에디터에서는 플레이어/followers/vehicles 스프라이트를 생성하지 않음 (이벤트만)
    w.Spriteset_Map.prototype.createCharacters = function(this: any) {
      this._characterSprites = [];
      w.$gameMap.events().forEach(function(this: any, event: any) {
        this._characterSprites.push(new w.Sprite_Character(event));
      }, this);
      for (let i = 0; i < this._characterSprites.length; i++) {
        this._tilemap.addChild(this._characterSprites[i]);
      }
    };

    w._editorGameInitialized = true;
    console.log('[Editor] Game globals initialized');
  } catch (e) {
    console.error('[Editor] Failed to initialize game globals:', e);
  }
}
