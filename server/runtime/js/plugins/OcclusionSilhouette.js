/*:
 * @pluginname 실루엣 효과
 * @plugindesc 플레이어가 오브젝트 뒤에 가려졌을 때 실루엣으로 위치를 표시합니다.
 * @author gosuni2025
 *
 * @param Fill Color
 * @type color
 * @desc 실루엣 내부 채움 색 (CSS hex)
 * @default #3366ff
 *
 * @param Fill Opacity
 * @type number
 * @desc 내부 채움 투명도 (0.0 ~ 1.0)
 * @min 0
 * @max 1
 * @default 0.35
 *
 * @param Outline Color
 * @type color
 * @desc 외곽선 색 (CSS hex)
 * @default #ffffff
 *
 * @param Outline Opacity
 * @type number
 * @desc 외곽선 투명도 (0.0 ~ 1.0)
 * @min 0
 * @max 1
 * @default 0.8
 *
 * @param Outline Width
 * @type number
 * @desc 외곽선 두께 (px)
 * @min 0
 * @max 10
 * @default 2
 *
 * @param Pattern
 * @type select
 * @desc 채움 패턴
 * @option solid
 * @option empty
 * @option dot
 * @option diagonal
 * @option cross
 * @option hatch
 * @default solid
 *
 * @param Pattern Scale
 * @type number
 * @desc 패턴 크기 (px)
 * @min 2
 * @max 32
 * @default 8
 *
 * @param Include Followers
 * @type boolean
 * @desc 파티원도 실루엣 대상에 포함
 * @default false
 *
 * @help
 * 플레이어 캐릭터가 이미지 오브젝트(z=5) 뒤에 가려졌을 때,
 * 가려진 부분을 실루엣으로 표시하여 플레이어 위치를 알 수 있게 합니다.
 *
 * 브라우저 콘솔에서 실시간 설정 변경 가능:
 *   OcclusionSilhouette.config.fillColor = [1, 0, 0];  // 빨간색
 *   OcclusionSilhouette.config.pattern = 'diagonal';    // 사선 패턴
 *   OcclusionSilhouette.config.outlineWidth = 3;        // 외곽선 두께
 */

(function() {
    'use strict';

    // 플러그인 파라미터 읽기
    var parameters = PluginManager.parameters('OcclusionSilhouette');

    function hexToRgb(hex) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        var r = parseInt(hex.substr(0, 2), 16) / 255;
        var g = parseInt(hex.substr(2, 2), 16) / 255;
        var b = parseInt(hex.substr(4, 2), 16) / 255;
        return [r, g, b];
    }

    var fillColorParam = parameters['Fill Color'] || '#3366ff';
    var fillOpacityParam = parseFloat(parameters['Fill Opacity'] || '0.35');
    var outlineColorParam = parameters['Outline Color'] || '#ffffff';
    var outlineOpacityParam = parseFloat(parameters['Outline Opacity'] || '0.8');
    var outlineWidthParam = parseFloat(parameters['Outline Width'] || '2');
    var patternParam = parameters['Pattern'] || 'solid';
    var patternScaleParam = parseFloat(parameters['Pattern Scale'] || '8');
    var includeFollowersParam = String(parameters['Include Followers']) !== 'false';

    var OcclusionSilhouette = {};
    window.OcclusionSilhouette = OcclusionSilhouette;

    OcclusionSilhouette._active = true;
    OcclusionSilhouette._charMaskRT = null;
    OcclusionSilhouette._objMaskRT = null;
    OcclusionSilhouette._silhouettePass = null;
    OcclusionSilhouette._maskWidth = 0;
    OcclusionSilhouette._maskHeight = 0;

    // 설정
    OcclusionSilhouette.config = {
        fillColor: hexToRgb(fillColorParam),
        fillOpacity: fillOpacityParam,
        outlineColor: hexToRgb(outlineColorParam),
        outlineOpacity: outlineOpacityParam,
        outlineWidth: outlineWidthParam,
        pattern: patternParam,
        patternScale: patternScaleParam,
        includeFollowers: includeFollowersParam
    };

    // 패턴 ID 매핑
    var PATTERN_MAP = {
        'solid': 0,
        'empty': 1,
        'dot': 2,
        'diagonal': 3,
        'cross': 4,
        'hatch': 5
    };

    //=========================================================================
    // 실루엣 합성 셰이더
    //=========================================================================
    var SilhouetteShader = {
        uniforms: {
            tColor:         { value: null },                          // 원본 렌더 결과
            tCharMask:      { value: null },                          // 캐릭터 마스크
            tObjMask:       { value: null },                          // 오브젝트 마스크
            tCharDepth:     { value: null },                          // 캐릭터 depth texture
            tObjDepth:      { value: null },                          // 오브젝트 depth texture
            uUseDepthTest:  { value: 0 },                             // 1=depth 비교 활성화 (3D)
            uFillColor:     { value: new THREE.Vector3(0.2, 0.4, 1.0) },
            uFillOpacity:   { value: 0.35 },
            uOutlineColor:  { value: new THREE.Vector3(1.0, 1.0, 1.0) },
            uOutlineOpacity:{ value: 0.8 },
            uOutlineWidth:  { value: 2.0 },
            uPattern:       { value: 0 },                             // 패턴 타입 (int)
            uPatternScale:  { value: 8.0 },
            uResolution:    { value: new THREE.Vector2(1, 1) }
        },
        vertexShader: [
            'varying vec2 vUv;',
            'void main() {',
            '    vUv = uv;',
            '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform sampler2D tColor;',
            'uniform sampler2D tCharMask;',
            'uniform sampler2D tObjMask;',
            'uniform sampler2D tCharDepth;',
            'uniform sampler2D tObjDepth;',
            'uniform int uUseDepthTest;',
            'uniform vec3 uFillColor;',
            'uniform float uFillOpacity;',
            'uniform vec3 uOutlineColor;',
            'uniform float uOutlineOpacity;',
            'uniform float uOutlineWidth;',
            'uniform int uPattern;',
            'uniform float uPatternScale;',
            'uniform vec2 uResolution;',
            'varying vec2 vUv;',
            '',
            '// 가려진 영역 판정: 픽셀 겹침 + (3D 모드) 오브젝트가 캐릭터보다 앞에 있는지 depth 비교',
            'float getOccluded(vec2 uv) {',
            '    float charA = texture2D(tCharMask, uv).a;',
            '    float objA = texture2D(tObjMask, uv).a;',
            '    if (charA < 0.01 || objA < 0.01) return 0.0;',
            '    if (uUseDepthTest == 1) {',
            '        // NDC depth: 값이 작을수록 카메라에 가까움',
            '        // 오브젝트 depth <= 캐릭터 depth → 오브젝트가 앞에 있음 → 실루엣',
            '        float charZ = texture2D(tCharDepth, uv).r;',
            '        float objZ  = texture2D(tObjDepth,  uv).r;',
            '        return step(objZ, charZ);',
            '    }',
            '    return 1.0;',
            '}',
            '',
            '// 채움 패턴 함수',
            'float getPattern(vec2 screenPos) {',
            '    float scale = uPatternScale;',
            '    if (uPattern == 0) return 1.0;',           // solid
            '    if (uPattern == 1) return 0.0;',           // empty
            '    if (uPattern == 2) {',                     // dot
            '        vec2 cell = mod(screenPos, vec2(scale));',
            '        float d = length(cell - vec2(scale * 0.5));',
            '        return smoothstep(scale * 0.3, scale * 0.25, d);',
            '    }',
            '    if (uPattern == 3) {',                     // diagonal
            '        float d = mod(screenPos.x + screenPos.y, scale);',
            '        return smoothstep(scale * 0.4, scale * 0.35, d);',
            '    }',
            '    if (uPattern == 4) {',                     // cross
            '        float d1 = mod(screenPos.x + screenPos.y, scale);',
            '        float d2 = mod(screenPos.x - screenPos.y, scale);',
            '        float p1 = smoothstep(scale * 0.4, scale * 0.35, d1);',
            '        float p2 = smoothstep(scale * 0.4, scale * 0.35, d2);',
            '        return max(p1, p2);',
            '    }',
            '    if (uPattern == 5) {',                     // hatch
            '        float dx = mod(screenPos.x, scale);',
            '        float dy = mod(screenPos.y, scale);',
            '        float p1 = smoothstep(scale * 0.4, scale * 0.35, dx);',
            '        float p2 = smoothstep(scale * 0.4, scale * 0.35, dy);',
            '        return max(p1, p2);',
            '    }',
            '    return 1.0;',
            '}',
            '',
            '// 외곽선 검출: 주변 8방향 샘플링',
            'float edgeDetect(vec2 uv) {',
            '    vec2 texelSize = 1.0 / uResolution;',
            '    float width = uOutlineWidth;',
            '    float center = getOccluded(uv);',
            '    float maxN = 0.0;',
            '    for (int dx = -1; dx <= 1; dx++) {',
            '        for (int dy = -1; dy <= 1; dy++) {',
            '            if (dx == 0 && dy == 0) continue;',
            '            vec2 offset = vec2(float(dx), float(dy)) * texelSize * width;',
            '            maxN = max(maxN, getOccluded(uv + offset));',
            '        }',
            '    }',
            '    // 주변에 가려진 영역이 있지만 현재 픽셀은 아닌 경우 = 외곽선',
            '    return maxN * (1.0 - center);',
            '}',
            '',
            'void main() {',
            '    vec4 original = texture2D(tColor, vUv);',
            '    float occluded = getOccluded(vUv);',
            '    float edge = edgeDetect(vUv);',
            '',
            '    // 채움 효과',
            '    vec2 screenPos = vUv * uResolution;',
            '    float pat = getPattern(screenPos);',
            '    float fillMask = occluded * pat * uFillOpacity;',
            '    vec3 col = mix(original.rgb, uFillColor, fillMask);',
            '',
            '    // 외곽선 효과',
            '    col = mix(col, uOutlineColor, edge * uOutlineOpacity);',
            '',
            '    gl_FragColor = vec4(col, original.a);',
            '}'
        ].join('\n')
    };

    //=========================================================================
    // RenderTarget 관리
    //=========================================================================
    OcclusionSilhouette._ensureRenderTargets = function(width, height) {
        if (this._charMaskRT && this._maskWidth === width && this._maskHeight === height) return;

        var params = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            depthBuffer: true,
            depthTexture: null  // 아래에서 개별 생성
        };

        if (this._charMaskRT) {
            if (this._charMaskRT.depthTexture) this._charMaskRT.depthTexture.dispose();
            this._charMaskRT.dispose();
        }
        if (this._objMaskRT) {
            if (this._objMaskRT.depthTexture) this._objMaskRT.depthTexture.dispose();
            this._objMaskRT.dispose();
        }

        var charParams = Object.assign({}, params, {
            depthTexture: new THREE.DepthTexture(width, height)
        });
        var objParams = Object.assign({}, params, {
            depthTexture: new THREE.DepthTexture(width, height)
        });

        this._charMaskRT = new THREE.WebGLRenderTarget(width, height, charParams);
        this._objMaskRT  = new THREE.WebGLRenderTarget(width, height, objParams);
        this._maskWidth  = width;
        this._maskHeight = height;
    };

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

    //=========================================================================
    // 플레이어/파티원 스프라이트 추출
    //=========================================================================
    OcclusionSilhouette._getPlayerSprites = function(spriteset) {
        var result = [];
        var chars = spriteset._characterSprites;
        if (!chars) return result;

        // 파티원 목록 캐시 (constructor.name 대신 인스턴스 비교)
        var followers = null;
        if (this.config.includeFollowers && $gamePlayer && $gamePlayer.followers()) {
            followers = $gamePlayer.followers()._data;
        }

        for (var i = 0; i < chars.length; i++) {
            var spr = chars[i];
            if (!spr._character) continue;

            // Game_Player
            if (spr._character === $gamePlayer) {
                result.push(spr);
                continue;
            }

            // Game_Follower (파티원) - 인스턴스 비교
            if (followers) {
                for (var fi = 0; fi < followers.length; fi++) {
                    if (spr._character === followers[fi]) {
                        result.push(spr);
                        break;
                    }
                }
            }
        }

        return result;
    };

    //=========================================================================
    // Uniforms 동기화
    //=========================================================================
    OcclusionSilhouette._syncUniforms = function(useDepthTest) {
        var pass = this._silhouettePass;
        if (!pass) return;

        var cfg = this.config;
        pass.uniforms.uFillColor.value.set(cfg.fillColor[0], cfg.fillColor[1], cfg.fillColor[2]);
        pass.uniforms.uFillOpacity.value = cfg.fillOpacity;
        pass.uniforms.uOutlineColor.value.set(cfg.outlineColor[0], cfg.outlineColor[1], cfg.outlineColor[2]);
        pass.uniforms.uOutlineOpacity.value = cfg.outlineOpacity;
        pass.uniforms.uOutlineWidth.value = cfg.outlineWidth;
        pass.uniforms.uPattern.value = PATTERN_MAP[cfg.pattern] || 0;
        pass.uniforms.uPatternScale.value = cfg.patternScale;

        if (this._charMaskRT) {
            pass.uniforms.tCharMask.value = this._charMaskRT.texture;
            pass.uniforms.tObjMask.value  = this._objMaskRT.texture;
            // depth texture: 3D 모드에서는 depthTexture가 있으므로 depth 비교 활성화
            var hasDepth = !!(this._charMaskRT.depthTexture && this._objMaskRT.depthTexture && useDepthTest);
            pass.uniforms.tCharDepth.value    = hasDepth ? this._charMaskRT.depthTexture : null;
            pass.uniforms.tObjDepth.value     = hasDepth ? this._objMaskRT.depthTexture  : null;
            pass.uniforms.uUseDepthTest.value = hasDepth ? 1 : 0;
            pass.uniforms.uResolution.value.set(this._maskWidth, this._maskHeight);
        }
    };

    //=========================================================================
    // PostProcess Composer Hook - 3D 모드
    //=========================================================================
    var _PostProcess_createComposer = PostProcess._createComposer;
    PostProcess._createComposer = function(rendererObj, stage) {
        _PostProcess_createComposer.call(this, rendererObj, stage);

        if (!OcclusionSilhouette._active) return;

        // SilhouettePass 생성 - MapRenderPass(index 0) 다음, BloomPass 앞에 삽입
        var silPass = OcclusionSilhouette._createSilhouettePass();
        var passes = this._composer.passes;
        // index 1에 삽입 (MapRenderPass 바로 다음)
        passes.splice(1, 0, silPass);

        OcclusionSilhouette._silhouettePass = silPass;
    };

    //=========================================================================
    // PostProcess Composer Hook - 2D 모드
    //=========================================================================
    var _PostProcess_createComposer2D = PostProcess._createComposer2D;
    PostProcess._createComposer2D = function(rendererObj, stage) {
        _PostProcess_createComposer2D.call(this, rendererObj, stage);

        if (!OcclusionSilhouette._active) return;

        // SilhouettePass 생성 - Simple2DRenderPass(index 0) 다음에 삽입
        var silPass = OcclusionSilhouette._createSilhouettePass();
        var passes = this._composer.passes;
        passes.splice(1, 0, silPass);

        OcclusionSilhouette._silhouettePass = silPass;
    };

    //=========================================================================
    // SilhouettePass 생성 헬퍼
    //=========================================================================
    OcclusionSilhouette._createSilhouettePass = function() {
        var uniforms = THREE.UniformsUtils.clone(SilhouetteShader.uniforms);
        var material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: SilhouetteShader.vertexShader,
            fragmentShader: SilhouetteShader.fragmentShader
        });

        var pass = {
            enabled: true,
            needsSwap: true,
            renderToScreen: false,
            uniforms: uniforms,
            material: material,
            fsQuad: new FullScreenQuad(material),
            setSize: function() {},
            render: function(renderer, writeBuffer, readBuffer) {
                this.uniforms.tColor.value = readBuffer.texture;
                if (this.renderToScreen) {
                    renderer.setRenderTarget(null);
                } else {
                    renderer.setRenderTarget(writeBuffer);
                    renderer.clear();
                }
                this.fsQuad.render(renderer);
            },
            dispose: function() {
                this.material.dispose();
                this.fsQuad.dispose();
            }
        };

        return pass;
    };

    //=========================================================================
    // MapRenderPass Hook - 3D 마스크 렌더
    //=========================================================================
    var _MapRenderPass_render = MapRenderPass.prototype.render;
    MapRenderPass.prototype.render = function(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        _MapRenderPass_render.call(this, renderer, writeBuffer, readBuffer, deltaTime, maskActive);

        if (OcclusionSilhouette._active) {
            var hasMasks = OcclusionSilhouette._renderMasks(renderer, this.scene, this.perspCamera, this.spriteset);
            if (OcclusionSilhouette._silhouettePass) {
                OcclusionSilhouette._silhouettePass.enabled = hasMasks;
                // 3D 모드에서는 depth 비교 활성화
                if (hasMasks) OcclusionSilhouette._syncUniforms(true);
            }
        }
    };

    //=========================================================================
    // Simple2DRenderPass Hook - 2D 마스크 렌더
    //=========================================================================
    var _Simple2DRenderPass_render = Simple2DRenderPass.prototype.render;
    Simple2DRenderPass.prototype.render = function(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        _Simple2DRenderPass_render.call(this, renderer, writeBuffer, readBuffer, deltaTime, maskActive);

        if (OcclusionSilhouette._active) {
            var rendererObj = this._rendererObj;
            if (rendererObj) {
                var spriteset = Mode3D._spriteset;
                var hasMasks = OcclusionSilhouette._renderMasks(renderer, rendererObj.scene, rendererObj.camera, spriteset);
                if (OcclusionSilhouette._silhouettePass) {
                    OcclusionSilhouette._silhouettePass.enabled = hasMasks;
                    // 2D 모드: depth 비교 비활성화
                    if (hasMasks) OcclusionSilhouette._syncUniforms(false);
                }
            }
        }
    };

    //=========================================================================
    // 리소스 정리
    //=========================================================================
    OcclusionSilhouette.dispose = function() {
        if (this._charMaskRT) {
            if (this._charMaskRT.depthTexture) this._charMaskRT.depthTexture.dispose();
            this._charMaskRT.dispose();
            this._charMaskRT = null;
        }
        if (this._objMaskRT) {
            if (this._objMaskRT.depthTexture) this._objMaskRT.depthTexture.dispose();
            this._objMaskRT.dispose();
            this._objMaskRT = null;
        }
        this._maskWidth = 0;
        this._maskHeight = 0;
    };

})();
