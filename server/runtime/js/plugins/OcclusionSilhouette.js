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
            '// 가려진 영역 판정: 캐릭터 마스크 > 0 AND 오브젝트 마스크 > 0',
            'float getOccluded(vec2 uv) {',
            '    float charA = texture2D(tCharMask, uv).a;',
            '    float objA = texture2D(tObjMask, uv).a;',
            '    return step(0.01, charA) * step(0.01, objA);',
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
            format: THREE.RGBAFormat
        };

        if (this._charMaskRT) this._charMaskRT.dispose();
        if (this._objMaskRT) this._objMaskRT.dispose();

        this._charMaskRT = new THREE.WebGLRenderTarget(width, height, params);
        this._objMaskRT = new THREE.WebGLRenderTarget(width, height, params);
        this._maskWidth = width;
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

        // === Pass 1: 캐릭터 마스크 렌더 ===
        for (var ci = 0; ci < charSprites.length; ci++) {
            if (charSprites[ci]._threeObj) charSprites[ci]._threeObj.visible = true;
        }

        renderer.setRenderTarget(this._charMaskRT);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);

        // 캐릭터 숨김
        for (var ci2 = 0; ci2 < charSprites.length; ci2++) {
            if (charSprites[ci2]._threeObj) charSprites[ci2]._threeObj.visible = false;
        }

        // === Pass 2: 오브젝트 마스크 렌더 (upperZLayer + _objectSprites) ===
        // upper 타일 레이어 (나무/지붕 등)
        if (upperZObj) {
            var uidx = tmChildren.indexOf(upperZObj);
            if (uidx >= 0 && tmChildVis[uidx]) {
                upperZObj.visible = true;
            }
        }
        // 에디터 이미지 오브젝트 - depth 비교하여 플레이어보다 앞에 있는 것만 마스크에 포함
        // depth = x*sin(yaw) + y*cos(yaw) (카메라 yaw 반영, yaw=0이면 y 기준)
        if (spriteset._objectSprites) {
            var _yaw = (typeof ConfigManager !== 'undefined' && ConfigManager.mode3d && Mode3D && Mode3D._yawRad) ? Mode3D._yawRad : 0;
            var _cosY = Math.cos(_yaw);
            var _sinY = Math.sin(_yaw);

            // 플레이어 depth 계산 ($gamePlayer 기준, 없으면 첫 번째 캐릭터)
            var _playerSpr = null;
            for (var _pi = 0; _pi < charSprites.length; _pi++) {
                if (charSprites[_pi]._character === $gamePlayer) { _playerSpr = charSprites[_pi]; break; }
            }
            if (!_playerSpr && charSprites.length > 0) _playerSpr = charSprites[0];
            var _playerDepth = (_playerSpr && _playerSpr._threeObj)
                ? _playerSpr._threeObj.position.x * _sinY + _playerSpr._threeObj.position.y * _cosY
                : -Infinity;

            for (var oi2 = 0; oi2 < spriteset._objectSprites.length; oi2++) {
                var os = spriteset._objectSprites[oi2];
                if (os._threeObj) {
                    var idx = tmChildren.indexOf(os._threeObj);
                    if (idx >= 0 && tmChildVis[idx]) {
                        // 오브젝트가 플레이어보다 앞에(depth 큰) 있을 때만 마스크에 포함
                        var _objDepth = os._threeObj.position.x * _sinY + os._threeObj.position.y * _cosY;
                        if (_objDepth > _playerDepth) {
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
    OcclusionSilhouette._syncUniforms = function() {
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
            pass.uniforms.tObjMask.value = this._objMaskRT.texture;
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
                if (hasMasks) OcclusionSilhouette._syncUniforms();
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
                    if (hasMasks) OcclusionSilhouette._syncUniforms();
                }
            }
        }
    };

    //=========================================================================
    // 리소스 정리
    //=========================================================================
    OcclusionSilhouette.dispose = function() {
        if (this._charMaskRT) {
            this._charMaskRT.dispose();
            this._charMaskRT = null;
        }
        if (this._objMaskRT) {
            this._objMaskRT.dispose();
            this._objMaskRT = null;
        }
        this._maskWidth = 0;
        this._maskHeight = 0;
    };

})();
