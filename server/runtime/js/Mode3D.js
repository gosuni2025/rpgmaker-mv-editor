//=============================================================================
// Mode3D.js - 3D 보기 모드 (파판6 스타일 기울임 + 빌보드 캐릭터)
//=============================================================================
// 게임 옵션에서 ON/OFF 가능
// - PerspectiveCamera로 맵을 기울여서 원근감 부여
// - UI는 별도 OrthographicCamera로 렌더링하여 합성
// - 캐릭터/이벤트는 빌보드로 항상 카메라를 향함
// - 텍스처는 NearestFilter + anisotropy=1로 crispy 유지
//=============================================================================

(function() {

    //=========================================================================
    // ConfigManager - mode3d 설정 추가
    //=========================================================================

    ConfigManager.mode3d = false;

    var _ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function() {
        var config = _ConfigManager_makeData.call(this);
        config.mode3d = this.mode3d;
        return config;
    };

    var _ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function(config) {
        _ConfigManager_applyData.call(this, config);
        this.mode3d = this.readFlag(config, 'mode3d');
    };

    //=========================================================================
    // Window_Options - "3D 보기" 옵션 추가
    //=========================================================================

    var _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
    Window_Options.prototype.addGeneralOptions = function() {
        _Window_Options_addGeneralOptions.call(this);
        this.addCommand('3D 보기', 'mode3d');
    };

    //=========================================================================
    // Mode3D 상태 관리
    //=========================================================================

    var Mode3D = {};
    Mode3D._active = false;
    Mode3D._tiltDeg = 35;
    Mode3D._tiltRad = Mode3D._tiltDeg * Math.PI / 180;
    Mode3D._billboardTargets = [];
    Mode3D._spriteset = null;
    Mode3D._perspCamera = null;
    Mode3D._extraRows = 6;

    window.Mode3D = Mode3D;

    //=========================================================================
    // ShaderTilemap._hackRenderer 오버라이드
    // renderer.plugins.tilemap 대신 인스턴스에 직접 저장
    //=========================================================================

    ShaderTilemap.prototype._hackRenderer = function(renderer) {
        var af = this.animationFrame % 4;
        if (af == 3) af = 1;
        this._tileAnimX = af * this._tileWidth;
        this._tileAnimY = (this.animationFrame % 3) * this._tileHeight;
        return renderer;
    };

    //=========================================================================
    // ShaderTilemap.updateTransform 오버라이드
    // Three.js 경로에서는 renderWebGL/renderCanvas가 호출되지 않아
    // _hackRenderer가 실행 안됨 → updateTransform에서 애니메이션 갱신
    //=========================================================================

    var _ShaderTilemap_updateTransform = ShaderTilemap.prototype.updateTransform;
    ShaderTilemap.prototype.updateTransform = function() {
        this._hackRenderer(null);
        _ShaderTilemap_updateTransform.call(this);
    };

    //=========================================================================
    // ShaderTilemap._paintAllTiles 오버라이드
    // 3D 모드에서는 기울임으로 인해 더 넓은 영역이 보이므로
    // 상하 여분 타일을 추가로 그림
    //=========================================================================

    var _ShaderTilemap_paintAllTiles = ShaderTilemap.prototype._paintAllTiles;
    ShaderTilemap.prototype._paintAllTiles = function(startX, startY) {
        if (!ConfigManager.mode3d) {
            _ShaderTilemap_paintAllTiles.call(this, startX, startY);
            return;
        }
        this.lowerZLayer.clear();
        this.upperZLayer.clear();
        // 3D 기울임 보정: 상하로 여분 타일 추가
        var extraRows = Mode3D._extraRows;
        var tileCols = Math.ceil(this._width / this._tileWidth) + 1;
        var tileRows = Math.ceil(this._height / this._tileHeight) + 1 + extraRows * 2;
        for (var y = -extraRows; y < tileRows - extraRows; y++) {
            for (var x = 0; x < tileCols; x++) {
                this._paintTiles(startX, startY, x, y);
            }
        }
    };

    //=========================================================================
    // Spriteset_Map 참조 저장
    //=========================================================================

    var _Spriteset_Map_initialize = Spriteset_Map.prototype.initialize;
    Spriteset_Map.prototype.initialize = function() {
        _Spriteset_Map_initialize.call(this);
        Mode3D._spriteset = this;
    };

    //=========================================================================
    // PerspectiveCamera 생성
    // dist = (h/2) / tan(fov/2)로 OrthographicCamera와 같은 영역 커버
    //=========================================================================

    Mode3D._createPerspCamera = function(w, h) {
        var fovDeg = 60;
        var fovRad = fovDeg * Math.PI / 180;
        var aspect = w / h;
        var dist = (h / 2) / Math.tan(fovRad / 2);

        var camera = new THREE.PerspectiveCamera(fovDeg, aspect, 1, dist * 4);
        return camera;
    };

    //=========================================================================
    // 카메라 위치 설정
    // 화면 중심에서 tilt 각도만큼 위에서 내려다봄
    // projectionMatrix의 m[5]를 반전하여 Y-down 좌표계 대응
    //=========================================================================

    Mode3D._positionCamera = function(camera, w, h) {
        var fovRad = camera.fov * Math.PI / 180;
        var dist = (h / 2) / Math.tan(fovRad / 2);
        var tilt = this._tiltRad;

        var cx = w / 2;
        var cy = h / 2;

        camera.position.set(
            cx,
            cy + dist * Math.sin(tilt),
            dist * Math.cos(tilt)
        );

        camera.up.set(0, 1, 0);
        camera.lookAt(new THREE.Vector3(cx, cy, 0));
        camera.updateProjectionMatrix();

        // Y-down 좌표계: projectionMatrix의 Y축 반전
        var m = camera.projectionMatrix.elements;
        m[5] = -m[5];
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    };

    //=========================================================================
    // 텍스처 crispy - NearestFilter + anisotropy=1 강제
    //=========================================================================

    Mode3D._enforceNearestFilter = function(scene) {
        scene.traverse(function(obj) {
            if (obj.material && obj.material.map) {
                var tex = obj.material.map;
                if (tex.minFilter !== THREE.NearestFilter ||
                    tex.anisotropy !== 1) {
                    tex.minFilter = THREE.NearestFilter;
                    tex.magFilter = THREE.NearestFilter;
                    tex.generateMipmaps = false;
                    tex.anisotropy = 1;
                    tex.needsUpdate = true;
                }
            }
        });
    };

    //=========================================================================
    // 빌보드 - 캐릭터를 카메라 방향으로 세움
    //=========================================================================

    Mode3D.registerBillboard = function(sprite) {
        if (this._billboardTargets.indexOf(sprite) === -1) {
            this._billboardTargets.push(sprite);
        }
    };

    Mode3D._applyBillboards = function() {
        // 카메라가 위에서 내려다보므로 스프라이트를 -tilt만큼 역회전
        var tilt = -this._tiltRad;
        for (var i = 0; i < this._billboardTargets.length; i++) {
            var sprite = this._billboardTargets[i];
            if (sprite._threeObj && sprite._visible !== false) {
                sprite._threeObj.rotation.x = tilt;
            }
        }
    };

    /**
     * SpotLight 방향 기준 빌보드: shadow pass에서 캐릭터가 SpotLight를 향하도록 회전
     * SpotLight는 위(z=spotLightZ)에서 앞(direction)을 비추므로,
     * shadow camera 시점에서 캐릭터가 정면으로 보이도록 rotation.x를 조정
     */
    Mode3D._applyBillboardsForShadow = function() {
        if (!window.ShadowLight || !ShadowLight._playerSpotLight || !ShadowLight.config.spotLightEnabled) {
            return;
        }
        var spot = ShadowLight._playerSpotLight;
        var target = ShadowLight._playerSpotTarget;
        if (!spot || !target) return;

        // SpotLight에서 target까지의 방향으로 빌보드 회전 (shadow map 렌더링용)
        var dx = target.position.x - spot.position.x;
        var dy = target.position.y - spot.position.y;
        var dz = (target.position.z || 0) - (spot.position.z || 0);
        var lenXY = Math.sqrt(dx * dx + dy * dy);
        var shadowTilt = -Math.atan2(dz, lenXY);

        for (var i = 0; i < this._billboardTargets.length; i++) {
            var sprite = this._billboardTargets[i];
            if (sprite._threeObj && sprite._visible !== false) {
                sprite._threeObj.rotation.x = shadowTilt;
            }
        }
    };

    Mode3D._resetBillboards = function() {
        for (var i = 0; i < this._billboardTargets.length; i++) {
            var sprite = this._billboardTargets[i];
            if (sprite._threeObj) {
                sprite._threeObj.rotation.x = 0;
            }
        }
    };

    //=========================================================================
    // ThreeRendererStrategy.render 오버라이드
    // 3D 모드: 2-pass 렌더링 (SSAA 없음, 직접 렌더)
    //   1) PerspectiveCamera로 Spriteset_Map (맵+캐릭터) 렌더
    //   2) OrthographicCamera로 나머지 UI 렌더 (합성)
    //=========================================================================

    var _ThreeStrategy = RendererStrategy._strategies['threejs'];

    _ThreeStrategy.render = function(rendererObj, stage) {
        if (!rendererObj || !stage) return;

        var scene = rendererObj.scene;
        var renderer = rendererObj.renderer;
        var camera = rendererObj.camera;
        var w = rendererObj._width;
        var h = rendererObj._height;
        var is3D = ConfigManager.mode3d && Mode3D._spriteset;

        rendererObj._drawOrderCounter = 0;

        // stage를 scene에 연결 (라이트 등 다른 scene children 보존)
        if (stage._threeObj && stage._threeObj.parent !== scene) {
            // 기존 stage._threeObj (있다면) 만 제거하고 새 것을 추가
            // 라이트, 라이트 타겟 등 다른 children은 보존
            if (scene._stageObj) {
                scene.remove(scene._stageObj);
            }
            scene.add(stage._threeObj);
            scene._stageObj = stage._threeObj;
        }

        // updateTransform + hierarchy sync
        if (stage.updateTransform) {
            stage.updateTransform();
        }
        this._syncHierarchy(rendererObj, stage);

        if (is3D) {
            // PerspectiveCamera 준비
            if (!Mode3D._perspCamera) {
                Mode3D._perspCamera = Mode3D._createPerspCamera(w, h);
            }

            Mode3D._positionCamera(Mode3D._perspCamera, w, h);
            Mode3D._applyBillboards();
            Mode3D._enforceNearestFilter(scene);

            // Find parallax sky mesh in scene
            var skyMesh = null;
            for (var si = 0; si < scene.children.length; si++) {
                if (scene.children[si]._isParallaxSky) {
                    skyMesh = scene.children[si];
                    break;
                }
            }

            var stageObj = stage._threeObj;

            // Shadow Map: multi-pass 렌더링에서 shadow map은 별도 패스에서 갱신
            var prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
            renderer.shadowMap.autoUpdate = false;

            // --- Shadow Pass: SpotLight shadow용 빌보드 회전 → shadow map 갱신 ---
            if (window.ShadowLight && ShadowLight._playerSpotLight &&
                ShadowLight.config.spotLightEnabled && ShadowLight._active) {
                Mode3D._applyBillboardsForShadow();
                renderer.shadowMap.needsUpdate = true;
                var gl = renderer.getContext();
                gl.colorMask(false, false, false, false);
                gl.depthMask(false);
                renderer.render(scene, Mode3D._perspCamera);
                gl.colorMask(true, true, true, true);
                gl.depthMask(true);
                Mode3D._applyBillboards();
            } else {
                renderer.shadowMap.needsUpdate = true;
            }

            // --- Pass 0: Sky background (PerspectiveCamera) ---
            if (skyMesh) {
                // Hide everything except sky
                if (stageObj) stageObj.visible = false;
                skyMesh.visible = true;
                renderer.autoClear = true;
                renderer.render(scene, Mode3D._perspCamera);
                skyMesh.visible = false;
                if (stageObj) stageObj.visible = true;
            }

            // --- Pass 1: PerspectiveCamera로 맵(Spriteset_Map)만 렌더 ---
            // Hide _blackScreen so parallax sky shows through map edges
            var blackScreenObj = Mode3D._spriteset._blackScreen &&
                                 Mode3D._spriteset._blackScreen._threeObj;
            var blackScreenWasVisible = blackScreenObj ? blackScreenObj.visible : false;
            if (skyMesh && blackScreenObj) {
                blackScreenObj.visible = false;
            }

            var childVisibility = [];
            if (stageObj) {
                for (var i = 0; i < stageObj.children.length; i++) {
                    childVisibility.push(stageObj.children[i].visible);
                }
                var spritesetObj = Mode3D._spriteset._threeObj;
                for (var i = 0; i < stageObj.children.length; i++) {
                    stageObj.children[i].visible =
                        (stageObj.children[i] === spritesetObj);
                }
            }

            renderer.autoClear = !skyMesh;  // Don't clear if sky was drawn
            renderer.render(scene, Mode3D._perspCamera);

            // Restore _blackScreen
            if (blackScreenObj) {
                blackScreenObj.visible = blackScreenWasVisible;
            }

            // --- Pass 2: OrthographicCamera로 UI 렌더 (합성) ---
            if (stageObj) {
                for (var i = 0; i < stageObj.children.length; i++) {
                    var child = stageObj.children[i];
                    child.visible = childVisibility[i];
                    if (child === spritesetObj) {
                        child.visible = false;
                    }
                }
            }

            renderer.autoClear = false;
            renderer.render(scene, camera);

            // 가시성 복원
            if (stageObj) {
                for (var i = 0; i < stageObj.children.length; i++) {
                    stageObj.children[i].visible = childVisibility[i];
                }
            }
            renderer.autoClear = true;
            renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;

        } else {
            // 3D 해제
            if (Mode3D._active) {
                Mode3D._resetBillboards();
                Mode3D._perspCamera = null;
            }
            renderer.render(scene, camera);
        }

        Mode3D._active = is3D;
    };

    //=========================================================================
    // ThreeRendererStrategy.resize
    //=========================================================================

    var _ThreeStrategy_resize = _ThreeStrategy.resize;
    _ThreeStrategy.resize = function(rendererObj, width, height) {
        _ThreeStrategy_resize.call(this, rendererObj, width, height);
        if (Mode3D._perspCamera) {
            Mode3D._perspCamera = Mode3D._createPerspCamera(width, height);
        }
    };

    //=========================================================================
    // Spriteset_Map.update - 상태 전환 감지
    //=========================================================================

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        if (!ConfigManager.mode3d && Mode3D._active) {
            Mode3D._resetBillboards();
        }
    };

    //=========================================================================
    // Sprite_Character - 빌보드 등록
    //=========================================================================

    var _Sprite_Character_initialize = Sprite_Character.prototype.initialize;
    Sprite_Character.prototype.initialize = function(character) {
        _Sprite_Character_initialize.call(this, character);
        Mode3D.registerBillboard(this);
    };

    var _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function() {
        Mode3D._billboardTargets = [];
        _Spriteset_Map_createCharacters.call(this);
    };

    var _Spriteset_Map_createShadow = Spriteset_Map.prototype.createShadow;
    Spriteset_Map.prototype.createShadow = function() {
        _Spriteset_Map_createShadow.call(this);
        Mode3D.registerBillboard(this._shadowSprite);
    };

    var _Spriteset_Map_createDestination = Spriteset_Map.prototype.createDestination;
    Spriteset_Map.prototype.createDestination = function() {
        _Spriteset_Map_createDestination.call(this);
        Mode3D.registerBillboard(this._destinationSprite);
    };

    //=========================================================================
    // 화면 좌표 → 월드 좌표 변환 (3D 모드용)
    // PerspectiveCamera의 역투영으로 Z=0 평면 교점 계산
    //=========================================================================

    Mode3D._lastScreenToWorld = null;
    Mode3D._lastScreenX = -1;
    Mode3D._lastScreenY = -1;

    Mode3D.screenToWorld = function(screenX, screenY) {
        // 같은 좌표에 대해 캐시 반환 (canvasToMapX/Y가 별도 호출되므로)
        if (this._lastScreenX === screenX && this._lastScreenY === screenY &&
            this._lastScreenToWorld) {
            return this._lastScreenToWorld;
        }

        var camera = this._perspCamera;
        if (!camera) return null;

        // matrixWorld 최신화 (렌더 루프 밖에서 호출될 수 있으므로)
        camera.updateMatrixWorld(true);

        var w = Graphics.width;
        var h = Graphics.height;

        // NDC 좌표 (-1 ~ 1)
        // 화면 Y-down → NDC Y-up 변환
        var ndcX = (screenX / w) * 2 - 1;
        var ndcY = -((screenY / h) * 2 - 1);

        // near/far 두 점을 unproject
        var near = new THREE.Vector3(ndcX, ndcY, -1);
        var far  = new THREE.Vector3(ndcX, ndcY,  1);
        near.applyMatrix4(camera.projectionMatrixInverse);
        near.applyMatrix4(camera.matrixWorld);
        far.applyMatrix4(camera.projectionMatrixInverse);
        far.applyMatrix4(camera.matrixWorld);

        // ray direction
        var dir = new THREE.Vector3().subVectors(far, near).normalize();

        // Z=0 평면과의 교점: near.z + t * dir.z = 0
        if (Math.abs(dir.z) < 1e-6) return null;
        var t = -near.z / dir.z;

        var result = {
            x: near.x + t * dir.x,
            y: near.y + t * dir.y
        };

        this._lastScreenX = screenX;
        this._lastScreenY = screenY;
        this._lastScreenToWorld = result;
        return result;
    };

    //=========================================================================
    // Game_Map.canvasToMapX/Y 오버라이드
    // 3D 모드 활성 시 screenToWorld로 올바른 타일 좌표 계산
    // 원본: canvasToMapX(x) → (displayX * 48 + x) / 48
    // screenToWorld의 결과 world.x는 카메라 월드 공간의 X좌표이며,
    // 이는 2D OrthographicCamera에서의 screen pixel X와 동일한 좌표계
    //=========================================================================

    var _Game_Map_canvasToMapX = Game_Map.prototype.canvasToMapX;
    Game_Map.prototype.canvasToMapX = function(x) {
        if (ConfigManager.mode3d && Mode3D._active && Mode3D._perspCamera) {
            var world = Mode3D.screenToWorld(x, TouchInput.y);
            if (world) {
                var tileWidth = this.tileWidth();
                var originX = this._displayX * tileWidth;
                return this.roundX(Math.floor((originX + world.x) / tileWidth));
            }
        }
        return _Game_Map_canvasToMapX.call(this, x);
    };

    var _Game_Map_canvasToMapY = Game_Map.prototype.canvasToMapY;
    Game_Map.prototype.canvasToMapY = function(y) {
        if (ConfigManager.mode3d && Mode3D._active && Mode3D._perspCamera) {
            var world = Mode3D.screenToWorld(TouchInput.x, y);
            if (world) {
                var tileHeight = this.tileHeight();
                var originY = this._displayY * tileHeight;
                return this.roundY(Math.floor((originY + world.y) / tileHeight));
            }
        }
        return _Game_Map_canvasToMapY.call(this, y);
    };

})();
