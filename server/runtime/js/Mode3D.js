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
    // Mode3D 상태 관리
    //=========================================================================

    var Mode3D = {};
    Mode3D._active = false;
    Mode3D._tiltDeg = 60;
    Mode3D._tiltRad = Mode3D._tiltDeg * Math.PI / 180;
    Mode3D._yawDeg = 0;
    Mode3D._yawRad = 0;
    Mode3D._billboardTargets = [];
    Mode3D._spriteset = null;
    Mode3D._perspCamera = null;
    Mode3D._extraRows = 6;  // 에디터에서 참조
    Mode3D._extraCols = 4;  // 에디터에서 참조
    // 에디터 카메라 팬 오프셋 (픽셀 단위)
    Mode3D._editorPanX = 0;
    Mode3D._editorPanY = 0;
    Mode3D._editorPanZ = 0; // 높이 오프셋
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
    // ShaderTilemap margin/size 확장
    // 3D perspective에서 화면 가장자리가 매우 먼 월드 좌표를 보므로
    // 타일맵의 margin을 대폭 늘려 더 넓은 영역의 타일을 렌더링
    //=========================================================================

    var _3D_MARGIN = 48 * 40; // 40타일분의 여유 (1920px)

    var _ShaderTilemap_updateTransform2 = ShaderTilemap.prototype.updateTransform;
    ShaderTilemap.prototype.updateTransform = function() {
        // 에디터 모드에서는 margin을 직접 관리하므로 건드리지 않음
        if (!window.__editorMode) {
            // 3D 모드 전환 시 margin 동적 조정
            if (ConfigManager.mode3d) {
                if (this._margin !== _3D_MARGIN) {
                    this._margin = _3D_MARGIN;
                    this._width = Graphics.width + this._margin * 2;
                    this._height = Graphics.height + this._margin * 2;
                    this._needsRepaint = true;
                }
            } else {
                if (this._margin !== 20) {
                    this._margin = 20;
                    this._width = Graphics.width + this._margin * 2;
                    this._height = Graphics.height + this._margin * 2;
                    this._needsRepaint = true;
                }
            }
        }
        _ShaderTilemap_updateTransform2.call(this);
    };

    //=========================================================================
    // Tilemap._sortChildren - 3D 모드에서 카메라 yaw 반영 depth 정렬
    // yaw=0: depth = y (기존 동작), yaw=θ: depth = x*sin(θ) + y*cos(θ)
    //=========================================================================

    var _Tilemap_sortChildren = Tilemap.prototype._sortChildren;
    Tilemap.prototype._sortChildren = function() {
        if (!ConfigManager.mode3d) {
            _Tilemap_sortChildren.call(this);
            return;
        }
        var yaw = Mode3D._yawRad || 0;
        var cosY = Math.cos(yaw);
        var sinY = Math.sin(yaw);
        var th3d = ($gameMap && $gameMap.tileHeight) ? $gameMap.tileHeight() : 48;
        var children = this.children;
        if (children.length > 0) {
            children.sort(function(a, b) {
                // 멀티타일 오브젝트(h>1)의 center y는 시각 범위보다 위에 있으므로
                // foot tile center로 변환: foot_ref = y + 1.5 * th * (h - 1)
                // 캐릭터는 Mode3D updatePosition에서 y -= th/2로 tile center 기준 사용.
                // h=1 오브젝트는 container.y = tile center → 보정 불필요.
                var ayD = (a._mapObjH > 1) ? a.y + 1.5 * th3d * (a._mapObjH - 1) : a.y;
                var byD = (b._mapObjH > 1) ? b.y + 1.5 * th3d * (b._mapObjH - 1) : b.y;
                var dA = a.x * sinY + ayD * cosY;
                var dB = b.x * sinY + byD * cosY;
                // 3D 모드 렌더 순서:
                //   [버킷 0] 타일 (z=0 lower, z=4 upper): 항상 캐릭터/오브젝트 아래
                //   [버킷 1] 캐릭터·오브젝트 (z=1,2,3,5 등): depth만으로 앞뒤 결정
                var tA = (a.z === 0 || a.z === 4) ? 0 : 1;
                var tB = (b.z === 0 || b.z === 4) ? 0 : 1;
                if (tA !== tB) return tA - tB;
                if (tA === 0) return (a.z - b.z) || (dA - dB); // 타일끼리: z→depth
                return (dA - dB) || (a.x - b.x);               // 캐릭터/오브젝트: depth만
            });
        }
    };

    //=========================================================================
    // Spriteset_Map 참조 저장
    //=========================================================================

    var _Spriteset_Map_initialize = Spriteset_Map.prototype.initialize;
    Spriteset_Map.prototype.initialize = function() {
        // 게임 플레이 시 맵 데이터의 is3D 플래그로 모드 자동 설정 (에디터 모드 제외)
        if (!window.__editorMode && typeof $dataMap !== 'undefined' && $dataMap) {
            ConfigManager.mode3d = !!$dataMap.is3D;
        }
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
        var halfFov = fovRad / 2;
        var aspect = w / h;
        var tilt = this._tiltRad;
        var yaw = this._yawRad || 0;

        // 높이 기준 거리
        var distH = (h / 2) / Math.tan(halfFov);
        // 너비 기준 거리 (수평 FOV 고려)
        var hFovHalf = Math.atan(Math.tan(halfFov) * aspect);
        var distW = (w / 2) / Math.tan(hFovHalf);
        // 에디터 모드: tilt 시 Z=0 평면에서 수평 가시 영역이 줄어드므로
        // 너비 기준 거리에 tilt 보정 (cos(tilt)만큼 유효 거리 감소)
        var dist = distH;
        if (window.__editorMode && tilt > 0) {
            var distWCorrected = distW / Math.cos(tilt);
            dist = Math.max(distH, distWCorrected);
        }

        // zoom 적용: 카메라 거리를 줄여서 확대 효과
        var zoom = this._zoomScale || 1.0;
        if (zoom !== 1.0) {
            dist = dist / zoom;
        }

        var cx = w / 2;
        var cy = h / 2;

        // 에디터 카메라 팬 오프셋 적용
        var panZ = 0;
        if (window.__editorMode) {
            cx += (this._editorPanX || 0);
            cy += (this._editorPanY || 0);
            panZ = (this._editorPanZ || 0);
        }

        // yaw 회전: 카메라를 맵 중심(cx, cy, 0) 주위로 Z축(높이축) 회전
        // tilt: 수평(0°)→탑다운(90°) 각도. Z축으로부터의 각도와 동일.
        // 1) tilt만으로 기본 오프셋: 수평 거리 + 높이
        var horizDist = dist * Math.sin(tilt);  // tilt=0 → 0(수평), tilt=90 → 최대(탑다운)
        var vertZ = dist * Math.cos(tilt);      // tilt=0 → 최대(수평에서 봄), tilt=90 → 0(바로 위)
        // 2) 수평 오프셋을 yaw로 XY 평면에서 회전 (Z축 중심)
        // yaw=0 → 카메라가 Y 양의 방향(화면 아래 뒤편)에서 봄 (기존 동작 호환)
        var offX = horizDist * Math.sin(yaw);
        var offY = horizDist * Math.cos(yaw);
        var offZ = vertZ;

        camera.position.set(
            cx + offX,
            cy + offY,
            offZ + panZ
        );

        // far plane도 충분히 넓게
        camera.far = dist * 4;
        camera.up.set(0, 0, -1);
        camera.lookAt(new THREE.Vector3(cx, cy, panZ));
        camera.updateProjectionMatrix();

        // Y-down 좌표계: projectionMatrix의 Y축 반전
        var m = camera.projectionMatrix.elements;
        m[5] = -m[5];
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    };

    //=========================================================================
    // 프러스텀 월드 바운드 계산
    // 카메라 프러스텀 8꼭짓점의 월드 좌표 X,Y 범위 반환 (픽셀 단위)
    // 카메라 존 클램핑에 사용
    //=========================================================================

    Mode3D._frustumBoundsCache = null;
    Mode3D._frustumBoundsCacheTilt = -1;
    Mode3D._frustumBoundsCacheYaw = -1;
    Mode3D._frustumBoundsCacheW = -1;
    Mode3D._frustumBoundsCacheH = -1;

    Mode3D.getFrustumWorldBounds = function() {
        var camera = this._perspCamera;
        if (!camera) return null;

        var w = Graphics.width;
        var h = Graphics.height;
        var tilt = this._tiltRad;
        var yaw = this._yawRad || 0;

        // 캐시: tilt, yaw, 화면 크기가 같으면 재사용
        if (this._frustumBoundsCache &&
            this._frustumBoundsCacheTilt === tilt &&
            this._frustumBoundsCacheYaw === yaw &&
            this._frustumBoundsCacheW === w &&
            this._frustumBoundsCacheH === h) {
            return this._frustumBoundsCache;
        }

        // matrixWorld 최신화
        camera.updateMatrixWorld(true);

        var invProj = camera.projectionMatrixInverse;
        var matWorld = camera.matrixWorld;

        // NDC 꼭짓점 8개 (near z=-1, far z=1)
        var ndcCorners = [
            [-1, -1, -1], [ 1, -1, -1], [-1,  1, -1], [ 1,  1, -1],
            [-1, -1,  1], [ 1, -1,  1], [-1,  1,  1], [ 1,  1,  1]
        ];

        var minX = Infinity, maxX = -Infinity;
        var minY = Infinity, maxY = -Infinity;
        var v = new THREE.Vector3();

        for (var i = 0; i < 8; i++) {
            var c = ndcCorners[i];
            v.set(c[0], c[1], c[2]);
            v.applyMatrix4(invProj);
            v.applyMatrix4(matWorld);
            // X, Y가 맵 좌표 (Z는 높이축, 무시)
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
        }

        var bounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
        this._frustumBoundsCache = bounds;
        this._frustumBoundsCacheTilt = tilt;
        this._frustumBoundsCacheYaw = yaw;
        this._frustumBoundsCacheW = w;
        this._frustumBoundsCacheH = h;
        return bounds;
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
        var yaw = this._yawRad || 0;
        for (var i = 0; i < this._billboardTargets.length; i++) {
            var sprite = this._billboardTargets[i];
            if (sprite._threeObj && sprite._visible !== false) {
                // 이벤트 캐릭터인 경우 현재 페이지의 billboard 설정을 확인
                var billboardEnabled = true;
                if (sprite._character && typeof sprite._character.page === 'function') {
                    try {
                        var page = sprite._character.page();
                        if (page && page.billboard === false) {
                            billboardEnabled = false;
                        }
                    } catch (e) { /* page 접근 실패 시 기본값 유지 */ }
                }
                if (billboardEnabled) {
                    // yaw + tilt 순서로 회전: Z축 yaw 회전 → X축 tilt 회전
                    sprite._threeObj.rotation.order = 'ZXY';
                    sprite._threeObj.rotation.x = tilt;
                    sprite._threeObj.rotation.z = -yaw;
                } else {
                    sprite._threeObj.rotation.x = 0;
                    sprite._threeObj.rotation.z = 0;
                }
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
                var billboardEnabled = true;
                if (sprite._character && typeof sprite._character.page === 'function') {
                    try {
                        var page = sprite._character.page();
                        if (page && page.billboard === false) {
                            billboardEnabled = false;
                        }
                    } catch (e) { /* ignore */ }
                }
                sprite._threeObj.rotation.x = billboardEnabled ? shadowTilt : 0;
            }
        }
    };

    Mode3D._resetBillboards = function() {
        for (var i = 0; i < this._billboardTargets.length; i++) {
            var sprite = this._billboardTargets[i];
            if (sprite._threeObj) {
                sprite._threeObj.rotation.x = 0;
                sprite._threeObj.rotation.z = 0;
            }
        }
    };

    //=========================================================================
    // 애니메이션 빌보드: 3D 모드에서 Sprite_Animation을 2D HUD로 렌더
    // 대상 캐릭터의 3D 월드 좌표를 화면 좌표로 투영한 뒤,
    // 애니메이션 스프라이트를 stageObj(2D)에 배치하여 빌보드 효과 구현
    //=========================================================================

    /**
     * tilemap 자식에서 Sprite_Animation 인스턴스를 모두 수집
     */
    Mode3D._collectAnimationSprites = function() {
        var results = [];
        var spriteset = this._spriteset;
        if (!spriteset || !spriteset._tilemap) return results;
        var tilemap = spriteset._tilemap;
        var children = tilemap.children;
        for (var i = 0; i < children.length; i++) {
            if (children[i] instanceof Sprite_Animation) {
                results.push(children[i]);
            }
        }
        return results;
    };

    /**
     * 3D 월드 좌표(x,y)를 화면 좌표(px)로 투영
     * worldX, worldY: OrthographicCamera 공간의 픽셀 좌표 (= ThreeJS 2D 공간)
     * 반환: { x: screenX, y: screenY } (픽셀 단위, 화면 좌측 상단 기준)
     */
    Mode3D.worldToScreen = function(worldX, worldY) {
        var camera = this._perspCamera;
        if (!camera) return null;

        camera.updateMatrixWorld(true);

        // 월드 좌표 (z=0 평면)
        var v = new THREE.Vector3(worldX, worldY, 0);

        // 투영 (클립 공간 → NDC)
        v.applyMatrix4(camera.matrixWorldInverse);
        v.applyMatrix4(camera.projectionMatrix);

        // NDC (-1~1) → 화면 좌표
        // Y는 projectionMatrix에서 이미 반전되어 있으므로 추가 반전 불필요
        var w = Graphics.width;
        var h = Graphics.height;
        var sx = (v.x + 1) / 2 * w;
        var sy = (v.y + 1) / 2 * h;

        return { x: sx, y: sy };
    };

    /**
     * 애니메이션 스프라이트를 3D 맵에서 숨기고 정보를 보존
     * Pass 1 직전에 호출
     * 반환: 복원에 필요한 정보 배열
     */
    Mode3D._hideAnimationsForPass1 = function() {
        var anims = this._collectAnimationSprites();
        var info = [];
        for (var i = 0; i < anims.length; i++) {
            var anim = anims[i];
            var threeObj = anim._threeObj;
            if (threeObj) {
                info.push({
                    sprite: anim,
                    wasVisible: threeObj.visible,
                    parent: anim.parent,
                    target: anim._target
                });
                threeObj.visible = false;
            }
        }
        return info;
    };

    /**
     * 애니메이션 스프라이트를 2D HUD로 렌더하기 위해 stageObj로 이동
     * Pass 2 직전에 호출
     * animInfo: _hideAnimationsForPass1의 반환값
     * stageObj: stage._threeObj
     */
    Mode3D._moveAnimationsToHUD = function(animInfo, stageObj) {
        for (var i = 0; i < animInfo.length; i++) {
            var entry = animInfo[i];
            var anim = entry.sprite;
            var threeObj = anim._threeObj;
            if (!threeObj) continue;

            // 타겟의 화면 좌표 계산
            var target = entry.target;
            var screenPos = null;
            if (target && target._threeObj) {
                // 타겟의 절대 월드 좌표 가져오기
                target._threeObj.updateWorldMatrix(true, false);
                var worldPos = new THREE.Vector3();
                worldPos.setFromMatrixPosition(target._threeObj.matrixWorld);
                screenPos = this.worldToScreen(worldPos.x, worldPos.y);
            }

            if (screenPos) {
                // tilemap에서 제거, stageObj에 추가
                var parentObj = threeObj.parent;
                if (parentObj) parentObj.remove(threeObj);
                stageObj.add(threeObj);

                // 화면 좌표에 배치
                // 애니메이션의 원래 position offset (위/중심/아래) 적용
                var offsetY = 0;
                if (anim._animation && target) {
                    var pos = anim._animation.position;
                    if (pos === 0) {
                        offsetY = -(target.height || 0);
                    } else if (pos === 1) {
                        offsetY = -(target.height || 0) / 2;
                    }
                    // pos === 2: 아래 (offset 0)
                    // pos === 3: 화면 중심 (별도 처리)
                }

                if (anim._animation && anim._animation.position === 3) {
                    // 화면 중심에 표시
                    threeObj.position.set(
                        Graphics.width / 2,
                        Graphics.height / 2,
                        threeObj.position.z
                    );
                } else {
                    threeObj.position.set(
                        screenPos.x,
                        screenPos.y + offsetY,
                        threeObj.position.z
                    );
                }
                threeObj.visible = entry.wasVisible;

                entry._movedToStage = true;
                entry._prevParent = parentObj;
            }
        }
    };

    /**
     * 애니메이션 스프라이트를 원래 위치로 복원
     * Pass 2 후에 호출
     */
    Mode3D._restoreAnimations = function(animInfo) {
        for (var i = 0; i < animInfo.length; i++) {
            var entry = animInfo[i];
            var anim = entry.sprite;
            var threeObj = anim._threeObj;
            if (!threeObj) continue;

            if (entry._movedToStage && entry._prevParent) {
                // stageObj에서 제거, 원래 부모로 복원
                var currentParent = threeObj.parent;
                if (currentParent) currentParent.remove(threeObj);
                entry._prevParent.add(threeObj);
            }

            threeObj.visible = entry.wasVisible;
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

            Mode3D._updateCameraZoneParams();
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
                renderer.state.buffers.color.setMask(false);
                renderer.state.buffers.depth.setMask(false);
                renderer.render(scene, Mode3D._perspCamera);
                renderer.state.buffers.color.setMask(true);
                renderer.state.buffers.depth.setMask(true);
                Mode3D._applyBillboards();
            } else {
                renderer.shadowMap.needsUpdate = true;
            }

            // --- Pass 0: Sky background (PerspectiveCamera) ---
            if (skyMesh) {
                // 렌더 직전에 sky mesh 위치를 카메라에 동기화 (update 타이밍 차이로 인한 떨림 방지)
                var cam = Mode3D._perspCamera;
                if (skyMesh._isSkyMeshSphere) {
                    // 구체형 sky: 카메라가 구 내부에 위치하도록 중심을 카메라에 맞춤
                    skyMesh.position.copy(cam.position);
                } else {
                    // 평면형 sky: far plane 앞에 배치
                    var skyDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
                    var skyFarDist = cam.far * 0.8;
                    skyMesh.position.copy(cam.position).addScaledVector(skyDir, skyFarDist);
                    skyMesh.quaternion.copy(cam.quaternion);
                }

                // Hide everything except sky
                if (stageObj) stageObj.visible = false;
                skyMesh.visible = true;
                renderer.autoClear = true;
                renderer.render(scene, Mode3D._perspCamera);
                skyMesh.visible = false;
                if (stageObj) stageObj.visible = true;
            }

            // --- Pass 1: PerspectiveCamera로 맵(Spriteset_Map)만 렌더 ---
            // Picture는 Pass 1에서 숨기고 Pass 2(2D)에서 렌더
            var picContainer = Mode3D._spriteset._pictureContainer;
            var picObj = picContainer && picContainer._threeObj;
            var picWasVisible = picObj ? picObj.visible : false;
            if (picObj) picObj.visible = false;
            // ScreenSprite(fade/flash)는 Pass 1,2에서 숨기고 Pass 3에서 별도 렌더
            var fadeSprite = Mode3D._spriteset._fadeSprite;
            var fadeObj = fadeSprite && fadeSprite._threeObj;
            var fadeWasVisible = fadeObj ? fadeObj.visible : false;
            if (fadeObj) fadeObj.visible = false;
            var flashSprite = Mode3D._spriteset._flashSprite;
            var flashObj = flashSprite && flashSprite._threeObj;
            var flashWasVisible = flashObj ? flashObj.visible : false;
            if (flashObj) flashObj.visible = false;
            // Weather는 Pass 1에서 숨기고 Pass 2(2D)에서 렌더
            var weatherContainer = Mode3D._spriteset._weather;
            var weatherObj = weatherContainer && weatherContainer._threeObj;
            var weatherWasVisible = weatherObj ? weatherObj.visible : false;
            if (weatherObj) weatherObj.visible = false;
            // 애니메이션 스프라이트를 Pass 1에서 숨김 (Pass 2에서 2D HUD로 렌더)
            var animInfo = Mode3D._hideAnimationsForPass1();
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

            // Editor overlay visibility for Pass 1 (PerspectiveCamera)
            // - editorGrid: SHOW in Pass 1 (3D perspective grid)
            // - other overlays (renderOrder >= 9998): HIDE in Pass 1
            var overlayVisibility = [];
            var gridVisibility = [];
            for (var oi = 0; oi < scene.children.length; oi++) {
                var obj = scene.children[oi];
                if (obj === stageObj) continue;
                if (obj.userData && obj.userData.editorGrid) {
                    // Grid: save state, keep visible for Pass 1
                    gridVisibility.push({ idx: oi, visible: obj.visible });
                } else if (obj.renderOrder >= 9998) {
                    // Other overlays: hide for Pass 1
                    overlayVisibility.push({ idx: oi, visible: obj.visible });
                    obj.visible = false;
                }
            }

            renderer.autoClear = !skyMesh;  // Don't clear if sky was drawn
            renderer.render(scene, Mode3D._perspCamera);

            // Restore _blackScreen
            if (blackScreenObj) {
                blackScreenObj.visible = blackScreenWasVisible;
            }

            // Pass 2 prep: hide grid, restore other overlays
            for (var oi = 0; oi < gridVisibility.length; oi++) {
                scene.children[gridVisibility[oi].idx].visible = false;
            }
            for (var oi = 0; oi < overlayVisibility.length; oi++) {
                scene.children[overlayVisibility[oi].idx].visible =
                    overlayVisibility[oi].visible;
            }

            // --- Pass 2: OrthographicCamera로 UI 렌더 (합성) ---
            // Picture를 spritesetObj에서 stageObj로 옮겨서 2D 렌더
            if (picObj) {
                spritesetObj.remove(picObj);
                stageObj.add(picObj);
                picObj.visible = picWasVisible;
            }
            // Weather를 spritesetObj에서 stageObj로 옮겨서 2D 렌더
            if (weatherObj) {
                spritesetObj.remove(weatherObj);
                stageObj.add(weatherObj);
                weatherObj.visible = weatherWasVisible;
            }
            // fade/flash를 spritesetObj에서 stageObj로 옮겨서 2D 렌더
            if (fadeObj && fadeWasVisible && fadeSprite.alpha > 0) {
                spritesetObj.remove(fadeObj);
                stageObj.add(fadeObj);
                fadeObj.visible = true;
            }
            if (flashObj && flashWasVisible && flashSprite.alpha > 0) {
                spritesetObj.remove(flashObj);
                stageObj.add(flashObj);
                flashObj.visible = true;
            }
            // 애니메이션을 stageObj로 이동 (2D HUD로 렌더)
            Mode3D._moveAnimationsToHUD(animInfo, stageObj);

            if (stageObj) {
                for (var i = 0; i < stageObj.children.length; i++) {
                    var child = stageObj.children[i];
                    if (child === picObj || child === weatherObj ||
                        child === fadeObj || child === flashObj) continue; // 새로 추가됨, visible 이미 설정
                    if (child === spritesetObj) {
                        child.visible = false;
                    } else if (i < childVisibility.length) {
                        child.visible = childVisibility[i];
                    }
                }
            }

            renderer.autoClear = false;
            renderer.render(scene, camera);

            // Picture를 원래 spritesetObj로 복원
            if (picObj) {
                stageObj.remove(picObj);
                spritesetObj.add(picObj);
                picObj.visible = picWasVisible;
            }
            // Weather를 원래 spritesetObj로 복원
            if (weatherObj && weatherObj.parent === stageObj) {
                stageObj.remove(weatherObj);
                spritesetObj.add(weatherObj);
                weatherObj.visible = weatherWasVisible;
            }
            // fade/flash를 원래 spritesetObj로 복원
            if (fadeObj && fadeObj.parent === stageObj) {
                stageObj.remove(fadeObj);
                spritesetObj.add(fadeObj);
                fadeObj.visible = fadeWasVisible;
            }
            if (flashObj && flashObj.parent === stageObj) {
                stageObj.remove(flashObj);
                spritesetObj.add(flashObj);
                flashObj.visible = flashWasVisible;
            }
            // 애니메이션을 원래 위치로 복원
            Mode3D._restoreAnimations(animInfo);

            // 가시성 복원
            if (stageObj) {
                for (var i = 0; i < childVisibility.length; i++) {
                    stageObj.children[i].visible = childVisibility[i];
                }
            }
            // Restore grid visibility after Pass 2
            for (var oi = 0; oi < gridVisibility.length; oi++) {
                scene.children[gridVisibility[oi].idx].visible =
                    gridVisibility[oi].visible;
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

    var _Sprite_Character_updatePosition = Sprite_Character.prototype.updatePosition;
    Sprite_Character.prototype.updatePosition = function() {
        _Sprite_Character_updatePosition.call(this);
        // 현재 이벤트 페이지의 billboardZ(타일 단위)를 _heightOffset에 반영
        if (this._character && typeof this._character.page === 'function') {
            try {
                var page = this._character.page();
                var bz = (page && page.billboardZ) ? page.billboardZ : 0;
                var th = ($gameMap && $gameMap.tileHeight) ? $gameMap.tileHeight() : 48;
                this._heightOffset = bz * th;
            } catch (e) { /* ignore */ }
        }
        // 3D 모드에서 빌보드 캐릭터는 z=5로 설정 (upper layer 타일 z=4 위에 그리기)
        // 플레이어, 팔로워, billboard 활성화된 이벤트 모두 해당
        if (ConfigManager.mode3d && this._character) {
            var isBillboard = true;
            // 이벤트인 경우 페이지의 billboard 설정 확인
            if (typeof this._character.page === 'function') {
                try {
                    var page = this._character.page();
                    if (page && page.billboard === false) {
                        isBillboard = false;
                    }
                } catch (e) { /* ignore */ }
            }
            if (isBillboard) {
                // screenY가 타일 하단(bottom) 기준이라 빌보드가 타일 경계에 나타남
                // th/2만큼 보정하여 타일 중심에 위치하도록 수정
                var th = ($gameMap && $gameMap.tileHeight) ? $gameMap.tileHeight() : 48;
                this.y -= th / 2;
            }
        }
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

    //=========================================================================
    // 카메라 존 → tilt / fov / yaw / zoom lerp 보간
    // 매 프레임 렌더 직전에 호출하여 Mode3D 전역 값을
    // 활성 카메라 존의 값으로 부드럽게 전환
    //=========================================================================

    Mode3D._currentTilt = null;   // lerp 중인 현재 tilt
    Mode3D._currentFov = null;    // lerp 중인 현재 fov
    Mode3D._currentYaw = null;    // lerp 중인 현재 yaw (rad)
    Mode3D._currentZoom = null;   // lerp 중인 현재 zoom

    // 카메라 존 진입 전 상태 저장 (존 탈출 시 복원용)
    Mode3D._prevActiveCameraZoneId = null;
    Mode3D._savedTiltBeforeZone = null;
    Mode3D._savedFovBeforeZone = null;
    Mode3D._savedYawBeforeZone = null;
    Mode3D._savedZoomBeforeZone = null;

    Mode3D._updateCameraZoneParams = function() {
        if (!this._perspCamera) return;
        if (window.__editorMode) return; // 에디터에서는 적용하지 않음

        var nowActiveId = ($gameMap && $gameMap._activeCameraZoneId != null)
            ? $gameMap._activeCameraZoneId : null;
        var prevActiveId = this._prevActiveCameraZoneId;

        // 카메라 존에 새로 진입하는 순간: 현재 상태 저장
        if (prevActiveId == null && nowActiveId != null) {
            this._savedTiltBeforeZone = this._tiltDeg != null ? this._tiltDeg : 60;
            this._savedFovBeforeZone  = this._perspCamera.fov || 60;
            this._savedYawBeforeZone  = this._yawDeg != null ? this._yawDeg : 0;
            this._savedZoomBeforeZone = this._zoomScale != null ? this._zoomScale : 1.0;
        }
        this._prevActiveCameraZoneId = nowActiveId;

        // 타겟 결정
        var targetTilt, targetFov, targetYaw, targetZoom;
        var transitionSpeed = 1.0;

        if (nowActiveId != null) {
            // 존 안: 존의 값으로 전환
            targetTilt = this._tiltDeg != null ? this._tiltDeg : 60;
            targetFov  = 60;
            targetYaw  = this._yawDeg != null ? this._yawDeg : 0;
            targetZoom = 1.0;
            var zone = $gameMap.getCameraZoneById(nowActiveId);
            if (zone) {
                targetTilt = zone.tilt != null ? zone.tilt : targetTilt;
                targetFov  = zone.fov  != null ? zone.fov  : 60;
                targetYaw  = zone.yaw  != null ? zone.yaw  : targetYaw;
                targetZoom = zone.zoom != null ? zone.zoom : 1.0;
                transitionSpeed = zone.transitionSpeed || 1.0;
            }
        } else if (this._savedTiltBeforeZone != null) {
            // 존 탈출 직후: 저장된 진입 전 상태로 복원
            targetTilt = this._savedTiltBeforeZone;
            targetFov  = this._savedFovBeforeZone  != null ? this._savedFovBeforeZone  : 60;
            targetYaw  = this._savedYawBeforeZone  != null ? this._savedYawBeforeZone  : 0;
            targetZoom = this._savedZoomBeforeZone != null ? this._savedZoomBeforeZone : 1.0;
        } else {
            // 맵 시작부터 존 밖 (저장 값 없음): 현재 값 그대로 유지
            targetTilt = this._tiltDeg != null ? this._tiltDeg : 60;
            targetFov  = 60;
            targetYaw  = this._yawDeg != null ? this._yawDeg : 0;
            targetZoom = 1.0;
        }

        // 초기화 (최초 호출 시)
        if (this._currentTilt === null) {
            this._currentTilt = targetTilt;
            this._currentFov  = targetFov;
            this._currentYaw  = targetYaw;
            this._currentZoom = targetZoom;
        }

        // lerp로 부드럽게 전환
        var lerpRate = Math.min(0.1 * transitionSpeed, 1.0);

        this._currentTilt += (targetTilt - this._currentTilt) * lerpRate;
        this._currentFov  += (targetFov  - this._currentFov ) * lerpRate;
        this._currentYaw  += (targetYaw  - this._currentYaw ) * lerpRate;
        this._currentZoom += (targetZoom - this._currentZoom) * lerpRate;

        // 수렴 체크 (0.01 이하면 스냅)
        if (Math.abs(targetTilt - this._currentTilt) < 0.01)  this._currentTilt = targetTilt;
        if (Math.abs(targetFov  - this._currentFov ) < 0.01)  this._currentFov  = targetFov;
        if (Math.abs(targetYaw  - this._currentYaw ) < 0.01)  this._currentYaw  = targetYaw;
        if (Math.abs(targetZoom - this._currentZoom) < 0.001) this._currentZoom = targetZoom;

        // 존 밖 복원 완료 시 저장 값 클리어 → 이후 사용자 입력을 다시 target으로
        if (nowActiveId == null && this._savedTiltBeforeZone != null) {
            if (this._currentTilt === targetTilt && this._currentYaw === targetYaw &&
                this._currentZoom === targetZoom) {
                this._savedTiltBeforeZone = null;
                this._savedFovBeforeZone  = null;
                this._savedYawBeforeZone  = null;
                this._savedZoomBeforeZone = null;
            }
        }

        // Mode3D 전역에 반영: tilt
        this._tiltDeg = this._currentTilt;
        this._tiltRad = this._currentTilt * Math.PI / 180;

        // Mode3D 전역에 반영: yaw
        this._yawDeg = this._currentYaw;
        this._yawRad = this._currentYaw * Math.PI / 180;

        // Mode3D 전역에 반영: zoom (카메라 거리 조절에 사용)
        this._zoomScale = this._currentZoom;

        // PerspectiveCamera fov 업데이트
        if (this._perspCamera.fov !== this._currentFov) {
            this._perspCamera.fov = this._currentFov;
            this._perspCamera.updateProjectionMatrix();
        }
    };

    //=========================================================================
    // Plugin Commands
    //=========================================================================

    var _Game_Interpreter_pluginCommand_m3d = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand_m3d.call(this, command, args);

        if (command === 'Mode3D') {
            if (args[0] === 'on') ConfigManager.mode3d = true;
            if (args[0] === 'off') ConfigManager.mode3d = false;
            if (args[0] === 'tilt' && args[1]) {
                var tiltVal = parseFloat(args[1]);
                var tiltDur = args[2] ? parseFloat(args[2]) : 0;
                if (tiltDur > 0 && window.PluginTween) {
                    PluginTween.add({
                        target: Mode3D, key: '_tiltDeg', to: tiltVal, duration: tiltDur,
                        onUpdate: function() { Mode3D._tiltRad = Mode3D._tiltDeg * Math.PI / 180; }
                    });
                } else {
                    Mode3D._tiltDeg = tiltVal;
                    Mode3D._tiltRad = tiltVal * Math.PI / 180;
                }
            }
            if (args[0] === 'yaw' && args[1]) {
                var yawVal = parseFloat(args[1]);
                var yawDur = args[2] ? parseFloat(args[2]) : 0;
                if (yawDur > 0 && window.PluginTween) {
                    PluginTween.add({ target: Mode3D, key: '_yawDeg', to: yawVal, duration: yawDur });
                } else {
                    Mode3D._yawDeg = yawVal;
                }
            }
        }
    };

})();
