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

    if (state.depthOfField !== prevState.depthOfField) {
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

    if (state.currentMap?.weatherType !== prevState.currentMap?.weatherType ||
        state.currentMap?.weatherPower !== prevState.currentMap?.weatherPower) {
      const wt = state.currentMap?.weatherType ?? 0;
      const wp = state.currentMap?.weatherPower ?? 0;
      const weatherNames = ['none', 'rain', 'storm', 'snow'];
      w.$gameScreen.changeWeather(weatherNames[wt] || 'none', wp, 0);
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
  });
}
