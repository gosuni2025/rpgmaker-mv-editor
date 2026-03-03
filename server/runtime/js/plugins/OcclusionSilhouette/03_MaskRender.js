    //=========================================================================
    // 마스크 렌더링 공통
    //=========================================================================
    // 씬 계층:
    //   scene → stage._threeObj → spriteset._threeObj → _baseSprite._threeObj
    //     _baseSprite 자식: _blackScreen, _parallax, _tilemap
    //     _tilemap 자식: lowerZLayer, upperZLayer, characterSprites, objectSprites
    //
    // 오브젝트 마스크 대상:
    //   1) upperZLayer (z=4) — 나무 상단, 지붕 등 캐릭터를 가리는 타일
    //   2) _objectSprites — 에디터 이미지 오브젝트 (z=5)
    //
    // 마스크 RT에는 대상 스프라이트만 렌더해야 하므로,
    // _baseSprite의 모든 자식을 숨기고 → tilemap만 켜고 →
    // tilemap 안에서 대상만 선택적으로 visible 설정.
    OcclusionSilhouette._renderMasks = function(renderer, scene, camera, spriteset) {
        if (!spriteset || !spriteset._characterSprites) return false;
        if (!scene || !camera) return false;

        var tilemap = spriteset._tilemap;
        var tilemapObj = tilemap && tilemap._threeObj;
        if (!tilemapObj) return false;
        var baseSpriteObj = spriteset._baseSprite && spriteset._baseSprite._threeObj;
        if (!baseSpriteObj) return false;

        // upperZLayer 참조 (타일맵의 upper 타일 레이어, z=4)
        var upperZLayer = tilemap.upperZLayer;
        var upperZObj = upperZLayer && upperZLayer._threeObj;

        // 가림 대상(오브젝트 마스크에 넣을 것)이 있는지 확인
        var hasUpperTiles = upperZObj && upperZObj.visible;
        var hasVisibleObj = false;
        if (spriteset._objectSprites) {
            for (var oi = 0; oi < spriteset._objectSprites.length; oi++) {
                var objSpr = spriteset._objectSprites[oi];
                if (objSpr._threeObj && objSpr._threeObj.visible) {
                    hasVisibleObj = true;
                    break;
                }
            }
        }
        if (!hasUpperTiles && !hasVisibleObj) return false;

        // 플레이어/파티원 스프라이트 식별
        var charSprites = this._getPlayerSprites(spriteset);
        if (!charSprites.length) return false;

        var size = renderer.getSize(new THREE.Vector2());
        var pr = renderer.getPixelRatio();
        var w = Math.floor(size.x * pr);
        var h = Math.floor(size.y * pr);
        this._ensureRenderTargets(w, h);

        // scene 직계 자식 중 stage만 유지, 나머지 숨김 (sky, fow 등)
        var stageObj = scene._stageObj || null;
        var sceneChildVis = [];
        for (var i = 0; i < scene.children.length; i++) {
            sceneChildVis.push(scene.children[i].visible);
            if (scene.children[i] !== stageObj) {
                scene.children[i].visible = false;
            }
        }

        // stage 자식 중 spritesetObj 외 모두 숨김 (Window_MapName, WindowLayer 등 UI 요소)
        var spritesetObj = spriteset._threeObj;
        var stageChildren = stageObj ? stageObj.children : [];
        var stageChildVis = [];
        for (var sti = 0; sti < stageChildren.length; sti++) {
            stageChildVis.push(stageChildren[sti].visible);
            // spritesetObj를 직접 포함하거나 spritesetObj의 부모인 경우 유지
            // (Stage → Scene_Map → Spriteset 계층이므로 Scene_Map._threeObj는 유지)
            var isSpriteset = stageChildren[sti] === spritesetObj;
            var containsSpriteset = false;
            if (!isSpriteset && stageChildren[sti].children) {
                for (var sci = 0; sci < stageChildren[sti].children.length; sci++) {
                    if (stageChildren[sti].children[sci] === spritesetObj) {
                        containsSpriteset = true;
                        break;
                    }
                }
            }
            if (!isSpriteset && !containsSpriteset) {
                stageChildren[sti].visible = false;
            }
        }

        // Scene_Map._threeObj 자식 중 spritesetObj 외 모두 숨김 (Window_MapName, WindowLayer 등)
        var sceneMapObj = spritesetObj ? spritesetObj.parent : null;
        var sceneMapChildren = sceneMapObj ? sceneMapObj.children : [];
        var sceneMapChildVis = [];
        for (var smi = 0; smi < sceneMapChildren.length; smi++) {
            sceneMapChildVis.push(sceneMapChildren[smi].visible);
            if (sceneMapChildren[smi] !== spritesetObj) {
                sceneMapChildren[smi].visible = false;
            }
        }

        // spriteset 자식 가시성 백업 & baseSprite 외 모두 숨김 (pictureContainer 등)
        var ssChildren = spritesetObj ? spritesetObj.children : [];
        var ssChildVis = [];
        for (var si = 0; si < ssChildren.length; si++) {
            ssChildVis.push(ssChildren[si].visible);
            if (ssChildren[si] !== baseSpriteObj) {
                ssChildren[si].visible = false;
            }
        }

        // _baseSprite 자식 가시성 백업 & 모두 숨김 (_blackScreen, _parallax 등)
        var bsChildren = baseSpriteObj.children;
        var bsChildVis = [];
        for (var bi = 0; bi < bsChildren.length; bi++) {
            bsChildVis.push(bsChildren[bi].visible);
            bsChildren[bi].visible = false;
        }
        // tilemap만 다시 켜기 (내부 자식은 아래에서 개별 제어)
        tilemapObj.visible = true;

        // tilemap 자식 가시성 백업 & 모두 숨김
        var tmChildren = tilemapObj.children;
        var tmChildVis = [];
        for (var ti = 0; ti < tmChildren.length; ti++) {
            tmChildVis.push(tmChildren[ti].visible);
            tmChildren[ti].visible = false;
        }

        var oldClearColor = renderer.getClearColor(new THREE.Color());
        var oldClearAlpha = renderer.getClearAlpha();
        renderer.setClearColor(0x000000, 0);

        // depth 계산용 yaw 파라미터 (Mode3D._sortChildren과 동일 기준)
        var _yaw = (typeof ConfigManager !== 'undefined' && ConfigManager.mode3d && Mode3D && Mode3D._yawRad) ? Mode3D._yawRad : 0;
        var _cosY = Math.cos(_yaw);
        var _sinY = Math.sin(_yaw);
        var _th3d = ($gameMap && $gameMap.tileHeight) ? $gameMap.tileHeight() : 48;

        // charMask 대상 캐릭터 선별:
        //   - upperZLayer가 있으면(naïve): 모든 캐릭터 포함 (타일별 depth 계산 불가)
        //   - _objectSprites만 있으면: max(obj_depth) >= char_depth 인 캐릭터만 포함
        //     (적어도 하나의 오브젝트보다 앞에 있지 않은 캐릭터 = 오브젝트 뒤에 있을 수 있음)
        var charMaskSprites = [];
        var _minCharDepth = -Infinity; // objMask 포함 임계값: obj_depth >= _minCharDepth

        if (hasUpperTiles) {
            // upper tile은 모든 캐릭터를 가릴 수 있으므로 전원 포함
            for (var _ui = 0; _ui < charSprites.length; _ui++) {
                if (charSprites[_ui]._threeObj) charMaskSprites.push(charSprites[_ui]);
            }
            _minCharDepth = -Infinity; // 모든 오브젝트 포함
        } else if (hasVisibleObj && spriteset._objectSprites) {
            // 최대 오브젝트 depth 계산
            var _maxObjDepth = -Infinity;
            for (var _preiO = 0; _preiO < spriteset._objectSprites.length; _preiO++) {
                var _preOs = spriteset._objectSprites[_preiO];
                if (_preOs._threeObj) {
                    var _preIdx = tmChildren.indexOf(_preOs._threeObj);
                    if (_preIdx >= 0 && tmChildVis[_preIdx]) {
                        var _preOsY = (_preOs._mapObjH > 1)
                            ? _preOs._y + 1.5 * _th3d * (_preOs._mapObjH - 1)
                            : (_preOs._mapObjH === 1) ? _preOs._y + _th3d / 2 : _preOs._y;
                        var _preOd = _preOs._x * _sinY + _preOsY * _cosY;
                        if (_preOd > _maxObjDepth) _maxObjDepth = _preOd;
                    }
                }
            }
            // 적어도 하나의 오브젝트가 앞에 있는 캐릭터만 charMask에 포함
            _minCharDepth = Infinity;
            for (var _ci = 0; _ci < charSprites.length; _ci++) {
                var _ch = charSprites[_ci];
                if (!_ch._threeObj) continue;
                var _cd = _ch._x * _sinY + _ch._y * _cosY;
                if (_maxObjDepth >= _cd) { // 이 캐릭터보다 앞에 있는 오브젝트 존재
                    charMaskSprites.push(_ch);
                    if (_cd < _minCharDepth) _minCharDepth = _cd;
                }
            }
            if (!charMaskSprites.length || _minCharDepth === Infinity) {
                // 아무 캐릭터도 오브젝트 뒤에 없음 → 실루엣 불필요
                for (var _tri = 0; _tri < tmChildren.length; _tri++) tmChildren[_tri].visible = tmChildVis[_tri];
                for (var _bri = 0; _bri < bsChildren.length; _bri++) bsChildren[_bri].visible = bsChildVis[_bri];
                for (var _ssi = 0; _ssi < ssChildren.length; _ssi++) ssChildren[_ssi].visible = ssChildVis[_ssi];
                for (var _smri = 0; _smri < sceneMapChildren.length; _smri++) sceneMapChildren[_smri].visible = sceneMapChildVis[_smri];
                for (var _stri = 0; _stri < stageChildren.length; _stri++) stageChildren[_stri].visible = stageChildVis[_stri];
                for (var _ri = 0; _ri < scene.children.length; _ri++) scene.children[_ri].visible = sceneChildVis[_ri];
                renderer.setClearColor(oldClearColor, oldClearAlpha);
                return false;
            }
        }

        // === Pass 1: 캐릭터 마스크 렌더 ===
        for (var ci = 0; ci < charMaskSprites.length; ci++) {
            if (charMaskSprites[ci]._threeObj) charMaskSprites[ci]._threeObj.visible = true;
        }

        renderer.setRenderTarget(this._charMaskRT);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);

        // 캐릭터 숨김
        for (var ci2 = 0; ci2 < charMaskSprites.length; ci2++) {
            if (charMaskSprites[ci2]._threeObj) charMaskSprites[ci2]._threeObj.visible = false;
        }

        // === Pass 2: 오브젝트 마스크 렌더 (upperZLayer + _objectSprites) ===
        // upper 타일 레이어 (나무/지붕 등)
        if (upperZObj) {
            var uidx = tmChildren.indexOf(upperZObj);
            if (uidx >= 0 && tmChildVis[uidx]) {
                upperZObj.visible = true;
            }
        }
        // 이미지 오브젝트 - charMask 캐릭터 중 적어도 하나보다 앞에 있는 것만 마스크에 포함
        // depth = x*sin(yaw) + y*cos(yaw) (카메라 yaw 반영, yaw=0이면 y 기준)
        // Mode3D._sortChildren과 동일한 foot 보정: 멀티타일은 foot 기준 depth 사용
        if (spriteset._objectSprites) {
            for (var oi2 = 0; oi2 < spriteset._objectSprites.length; oi2++) {
                var os = spriteset._objectSprites[oi2];
                if (os._threeObj) {
                    var idx = tmChildren.indexOf(os._threeObj);
                    if (idx >= 0 && tmChildVis[idx]) {
                        // 멀티타일 오브젝트는 발 기준 depth로 보정 (_sortChildren와 동일)
                        var _osY = (os._mapObjH > 1)
                            ? os._y + 1.5 * _th3d * (os._mapObjH - 1)
                            : (os._mapObjH === 1) ? os._y + _th3d / 2 : os._y;
                        var _objDepth = os._x * _sinY + _osY * _cosY;
                        // charMask 캐릭터 중 적어도 하나보다 앞에 있을 때만 포함
                        if (_objDepth >= _minCharDepth) {
                            os._threeObj.visible = true;
                        }
                    }
                }
            }
        }

        renderer.setRenderTarget(this._objMaskRT);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);

        // === 가시성 복원 ===
        renderer.setRenderTarget(null);
        renderer.setClearColor(oldClearColor, oldClearAlpha);

        for (var tri = 0; tri < tmChildren.length; tri++) {
            tmChildren[tri].visible = tmChildVis[tri];
        }
        for (var bri = 0; bri < bsChildren.length; bri++) {
            bsChildren[bri].visible = bsChildVis[bri];
        }
        for (var ssi = 0; ssi < ssChildren.length; ssi++) {
            ssChildren[ssi].visible = ssChildVis[ssi];
        }
        // Scene_Map 자식 가시성 복원 (Window_MapName, WindowLayer 등)
        for (var smri = 0; smri < sceneMapChildren.length; smri++) {
            sceneMapChildren[smri].visible = sceneMapChildVis[smri];
        }
        // Stage 자식 가시성 복원
        for (var stri = 0; stri < stageChildren.length; stri++) {
            stageChildren[stri].visible = stageChildVis[stri];
        }
        for (var ri = 0; ri < scene.children.length; ri++) {
            scene.children[ri].visible = sceneChildVis[ri];
        }

        return true;
    };

    // _renderMasks3D, _renderMasks2D는 공통 _renderMasks로 대체됨

