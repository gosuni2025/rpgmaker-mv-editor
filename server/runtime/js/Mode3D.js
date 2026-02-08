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
    Mode3D._renderTarget = null;
    Mode3D._ssaaScale = 2; // 수퍼샘플링 배율
    Mode3D._quadScene = null;
    Mode3D._quadCamera = null;
    Mode3D._quadMesh = null;

    window.Mode3D = Mode3D;

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
    // projection matrix의 Y를 뒤집어 Y-down 좌표계에 맞춤
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
    // projection matrix Y 반전으로 Y-down 좌표계 대응
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

        // Y-down 좌표계 보정: projection matrix의 Y 스케일 반전
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
    // SSAA RenderTarget - 맵을 고해상도로 렌더 후 NearestFilter로 표시
    //=========================================================================

    Mode3D._ensureRenderTarget = function(w, h) {
        var scale = this._ssaaScale;
        var tw = w * scale;
        var th = h * scale;

        if (this._renderTarget &&
            this._renderTarget.width === tw &&
            this._renderTarget.height === th) {
            return;
        }

        // 이전 것 정리
        if (this._renderTarget) {
            this._renderTarget.dispose();
        }

        this._renderTarget = new THREE.WebGLRenderTarget(tw, th, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            depthBuffer: true,
            stencilBuffer: false
        });

        // RenderTarget을 화면에 그릴 풀스크린 쿼드
        if (!this._quadScene) {
            this._quadScene = new THREE.Scene();
            this._quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        }

        // 기존 쿼드 정리
        if (this._quadMesh) {
            this._quadScene.remove(this._quadMesh);
            this._quadMesh.geometry.dispose();
            this._quadMesh.material.dispose();
        }

        var quadGeo = new THREE.PlaneGeometry(2, 2);
        var quadMat = new THREE.MeshBasicMaterial({
            map: this._renderTarget.texture,
            depthTest: false,
            depthWrite: false
        });
        // NearestFilter로 다운스케일 (크리스피 유지)
        this._renderTarget.texture.minFilter = THREE.NearestFilter;
        this._renderTarget.texture.magFilter = THREE.NearestFilter;
        this._renderTarget.texture.generateMipmaps = false;

        this._quadMesh = new THREE.Mesh(quadGeo, quadMat);
        this._quadScene.add(this._quadMesh);
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
    // 3D 모드: 2-pass 렌더링
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

        // stage를 scene에 연결
        if (stage._threeObj && stage._threeObj.parent !== scene) {
            while (scene.children.length > 0) {
                scene.remove(scene.children[0]);
            }
            scene.add(stage._threeObj);
        }

        // updateTransform + hierarchy sync
        if (stage.updateTransform) {
            stage.updateTransform();
        }
        this._syncHierarchy(rendererObj, stage);

        if (is3D) {
            var scale = Mode3D._ssaaScale;

            // PerspectiveCamera 준비
            if (!Mode3D._perspCamera) {
                Mode3D._perspCamera = Mode3D._createPerspCamera(w, h);
            }
            Mode3D._positionCamera(Mode3D._perspCamera, w, h);
            Mode3D._applyBillboards();
            Mode3D._enforceNearestFilter(scene);

            // SSAA RenderTarget 준비
            Mode3D._ensureRenderTarget(w, h);

            // --- Pass 1: 맵을 고해상도 RenderTarget에 렌더 ---
            var stageObj = stage._threeObj;
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

            // RenderTarget에 렌더 (고해상도)
            renderer.setRenderTarget(Mode3D._renderTarget);
            renderer.setViewport(0, 0, w * scale, h * scale);
            renderer.autoClear = true;
            renderer.render(scene, Mode3D._perspCamera);
            renderer.setRenderTarget(null);
            renderer.setViewport(0, 0, w, h);

            // --- Pass 2: RenderTarget을 화면에 NearestFilter로 출력 ---
            renderer.autoClear = true;
            renderer.render(Mode3D._quadScene, Mode3D._quadCamera);

            // --- Pass 3: UI (OrthographicCamera) ---
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
        // RenderTarget도 새 크기로 재생성
        if (Mode3D._renderTarget) {
            Mode3D._renderTarget.dispose();
            Mode3D._renderTarget = null;
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

})();
