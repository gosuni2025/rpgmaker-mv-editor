import useEditorStore from '../../store/useEditorStore';
import { syncEditorLightsToScene, syncSunLightsToScene } from './threeSceneSync';

// Runtime globals (loaded via index.html script tags)
declare const Mode3D: any;
declare const ShadowLight: any;
declare const ThreeWaterShader: any;

export function createStoreSubscription(params: {
  rendererObj: any;
  spriteset: any;
  requestRender: () => void;
}): () => void {
  const { rendererObj, spriteset, requestRender } = params;
  const w = window as any;

  return useEditorStore.subscribe((state, prevState) => {
    if (state.currentMap !== prevState.currentMap) {
      // 이벤트 변경 시 캐릭터 스프라이트 재생성
      if (state.currentMap && prevState.currentMap &&
          state.currentMap.events !== prevState.currentMap.events) {
        w.$dataMap.events = state.currentMap.events || [];
        try {
          w.$gameMap.setupEvents();
          if (spriteset._characterSprites) {
            for (const cs of spriteset._characterSprites) {
              if (spriteset._tilemap) spriteset._tilemap.removeChild(cs);
            }
          }
          spriteset.createCharacters();
          // 캐릭터 이미지 비동기 로드 후 렌더링 재요청
          if (spriteset._characterSprites) {
            for (const cs of spriteset._characterSprites) {
              const charName = typeof cs._character?.characterName === 'function'
                ? cs._character.characterName() : cs._character?.characterName;
              if (charName && w.ImageManager?.loadCharacter) {
                const bmp = w.ImageManager.loadCharacter(charName);
                if (bmp && !bmp.isReady()) {
                  bmp.addLoadListener(() => {
                    requestRender();
                  });
                }
              }
            }
          }
        } catch (_e) {
          console.warn('[Editor] Failed to recreate characters:', _e);
        }
      }
      // 오브젝트 변경 시 오브젝트 스프라이트 재생성
      if (state.currentMap && prevState.currentMap &&
          state.currentMap.objects !== prevState.currentMap.objects) {
        w.$dataMap.objects = state.currentMap.objects || [];
        try {
          if (spriteset._objectSprites) {
            for (const os of spriteset._objectSprites) {
              if (spriteset._tilemap) spriteset._tilemap.removeChild(os);
            }
          }
          spriteset.createMapObjects();
        } catch (_e) {
          console.warn('[Editor] Failed to recreate map objects:', _e);
        }
      }
      requestRender();
    }

    if (state.mode3d !== prevState.mode3d) {
      if (!state.mode3d) {
        Mode3D._perspCamera = null;
      }
      if (state.shadowLight && state.currentMap?.editorLights) {
        syncEditorLightsToScene(rendererObj.scene, state.currentMap.editorLights, state.mode3d);
      }
      if (spriteset._tilemap) spriteset._tilemap._needsRepaint = true;
      requestRender();
    }

    if (state.shadowLight !== prevState.shadowLight) {
      w.ConfigManager.shadowLight = state.shadowLight;
      if (!state.shadowLight) {
        spriteset._deactivateShadowLight();
        ShadowLight._active = false;
        if (spriteset._tilemap) {
          spriteset._tilemap._needsRepaint = true;
        }
      } else {
        ShadowLight._active = false;
        syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
      }
      requestRender();
    }

    if (state.postProcessConfig !== prevState.postProcessConfig) {
      const DOF = (window as any).PostProcess;
      if (DOF && DOF.applyPostProcessConfig) {
        DOF.applyPostProcessConfig(state.postProcessConfig);
      }
      requestRender();
    }

    if (state.currentMap?.editorLights !== prevState.currentMap?.editorLights) {
      w.$dataMap.editorLights = state.currentMap?.editorLights;
      if (state.shadowLight) {
        syncEditorLightsToScene(rendererObj.scene, state.currentMap?.editorLights, state.mode3d);
      }
      requestRender();
    }

    if (state.currentMap?.animTileSettings !== prevState.currentMap?.animTileSettings) {
      if (typeof ThreeWaterShader !== 'undefined') {
        ThreeWaterShader.setAllKindSettings(state.currentMap?.animTileSettings || {});
        if (spriteset._tilemap) spriteset._tilemap._needsRepaint = true;
      }
      requestRender();
    }

    if (state.currentMap?.bloomConfig !== prevState.currentMap?.bloomConfig) {
      const DOF = (window as any).PostProcess;
      if (DOF) {
        const bc = state.currentMap?.bloomConfig;
        const def = { enabled: true, threshold: 0.5, strength: 0.8, radius: 1.0, downscale: 4 };
        DOF.bloomConfig.threshold = bc?.threshold ?? def.threshold;
        DOF.bloomConfig.strength = bc?.strength ?? def.strength;
        DOF.bloomConfig.radius = bc?.radius ?? def.radius;
        DOF.bloomConfig.downscale = bc?.downscale ?? def.downscale;
        if (DOF._bloomPass) {
          DOF._bloomPass.enabled = bc ? bc.enabled !== false : true;
        }
      }
      requestRender();
    }

    if (state.currentMap?.dofConfig !== prevState.currentMap?.dofConfig) {
      const DOF = (window as any).PostProcess;
      if (DOF) {
        const dc = state.currentMap?.dofConfig;
        DOF.config.focusY = dc?.focusY ?? 0.14;
        DOF.config.focusRange = dc?.focusRange ?? 0;
        DOF.config.maxblur = dc?.maxBlur ?? 0.13;
        DOF.config.blurPower = dc?.blurPower ?? 2.4;
        if ((window as any).ConfigManager) (window as any).ConfigManager.depthOfField = dc?.enabled ?? false;
      }
      requestRender();
    }

    if (state.currentMap?.weatherType !== prevState.currentMap?.weatherType ||
        state.currentMap?.weatherPower !== prevState.currentMap?.weatherPower) {
      const wt = state.currentMap?.weatherType ?? 0;
      const wp = state.currentMap?.weatherPower ?? 0;
      const weatherNames = ['none', 'rain', 'storm', 'snow'];
      w.$gameScreen.changeWeather(weatherNames[wt] || 'none', wp, 0);
      requestRender();
    }

    // 패럴랙스 설정 변경 시 런타임 동기화
    if (state.currentMap && prevState.currentMap && (
        state.currentMap.parallaxName !== prevState.currentMap.parallaxName ||
        state.currentMap.parallaxLoopX !== prevState.currentMap.parallaxLoopX ||
        state.currentMap.parallaxLoopY !== prevState.currentMap.parallaxLoopY ||
        state.currentMap.parallaxSx !== prevState.currentMap.parallaxSx ||
        state.currentMap.parallaxSy !== prevState.currentMap.parallaxSy ||
        state.currentMap.parallaxShow !== prevState.currentMap.parallaxShow)) {
      const cm = state.currentMap;
      w.$dataMap.parallaxName = cm.parallaxName || '';
      w.$dataMap.parallaxLoopX = cm.parallaxLoopX || false;
      w.$dataMap.parallaxLoopY = cm.parallaxLoopY || false;
      w.$dataMap.parallaxSx = cm.parallaxSx || 0;
      w.$dataMap.parallaxSy = cm.parallaxSy || 0;
      w.$dataMap.parallaxShow = cm.parallaxShow || false;
      if (w.$gameMap) {
        w.$gameMap._parallaxName = cm.parallaxName || '';
        w.$gameMap._parallaxLoopX = cm.parallaxLoopX || false;
        w.$gameMap._parallaxLoopY = cm.parallaxLoopY || false;
        w.$gameMap._parallaxSx = cm.parallaxSx || 0;
        w.$gameMap._parallaxSy = cm.parallaxSy || 0;
        w.$gameMap._parallaxShow = cm.parallaxShow || false;
        // 패럴랙스 이미지 변경 시 스프라이트셋에서 재로드
        if (cm.parallaxName !== prevState.currentMap.parallaxName) {
          w.$gameMap._parallaxZero = w.ImageManager.isZeroParallax(cm.parallaxName);
          if (spriteset._parallax) {
            spriteset._parallax.bitmap = cm.parallaxName
              ? w.ImageManager.loadParallax(cm.parallaxName) : null;
          }
        }
      }
      requestRender();
    }

    // 타일 레이어 높이(elevation) 옵션 변경 시
    if (state.currentMap?.tileLayerElevation !== prevState.currentMap?.tileLayerElevation) {
      w.$dataMap.tileLayerElevation = state.currentMap?.tileLayerElevation || false;
      if (spriteset._tilemap) {
        spriteset._tilemap._needsRepaint = true;
        // ZLayer의 z 위치도 즉시 갱신
        if (spriteset._tilemap.lowerZLayer) {
          spriteset._tilemap.lowerZLayer._transformDirty = true;
        }
        if (spriteset._tilemap.upperZLayer) {
          const elevation = state.currentMap?.tileLayerElevation;
          if (w.ShadowLight && w.ShadowLight._active) {
            spriteset._tilemap.upperZLayer._zIndex = elevation ? w.ShadowLight.config.upperLayerZ : 0;
          } else {
            spriteset._tilemap.upperZLayer._zIndex = elevation ? 4 : 0;
          }
          spriteset._tilemap.upperZLayer._transformDirty = true;
        }
      }
      requestRender();
    }

    if (state.currentMap?.skyBackground !== prevState.currentMap?.skyBackground) {
      w.$dataMap.skyBackground = state.currentMap?.skyBackground || null;
      if (w._skyBoxApplySettings) {
        w._skyBoxApplySettings(state.currentMap?.skyBackground);
      }
      if (state.shadowLight) {
        syncSunLightsToScene(rendererObj.scene, state.currentMap?.skyBackground?.sunLights);
      }
      requestRender();
    }

    // NPC 이름 데이터 변경 시 $dataMap에 즉시 반영
    if (state.currentMap?.npcData !== prevState.currentMap?.npcData) {
      if (w.$dataMap) {
        w.$dataMap.npcData = state.currentMap?.npcData;
      }
      requestRender();
    }
  });
}
