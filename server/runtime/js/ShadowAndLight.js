//=============================================================================
// ShadowAndLight.js - Three.js 3D Shadow & Lighting System
//=============================================================================
// 캐릭터/이벤트 스프라이트에 실제 3D 그림자와 광원 효과를 적용합니다.
//
// - 그림자: DirectionalLight 방향 기반 planar shadow projection
//   (캐릭터 메시를 바닥 평면에 투영한 별도 shadow mesh)
// - 광원: DirectionalLight + AmbientLight + PointLight(캐릭터/이벤트)
//   material을 MeshLambertMaterial로 교체하여 실제 3D 조명을 받음
//   (MeshStandardMaterial은 타일맵 텍스처와 호환 문제가 있어 Lambert 사용)
//
// 게임 옵션에서 ON/OFF 가능
//=============================================================================

(function() {

//=============================================================================
// ConfigManager - 그림자/광원 설정 추가
//=============================================================================

ConfigManager.shadowLight = true;

var _ConfigManager_makeData = ConfigManager.makeData;
ConfigManager.makeData = function() {
    var config = _ConfigManager_makeData.call(this);
    config.shadowLight = this.shadowLight;
    return config;
};

var _ConfigManager_applyData = ConfigManager.applyData;
ConfigManager.applyData = function(config) {
    _ConfigManager_applyData.call(this, config);
    this.shadowLight = this.readFlag(config, 'shadowLight');
};

//=============================================================================
// Window_Options - "그림자/광원" 옵션 추가
//=============================================================================

var _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
Window_Options.prototype.addGeneralOptions = function() {
    _Window_Options_addGeneralOptions.call(this);
    this.addCommand('그림자/광원', 'shadowLight');
};

//=============================================================================
// ShadowLight 시스템 관리
//=============================================================================

var ShadowLight = {};
window.ShadowLight = ShadowLight;

ShadowLight._active = false;
ShadowLight._spriteset = null;

// 3D 조명 오브젝트
ShadowLight._directionalLight = null;
ShadowLight._ambientLight = null;
ShadowLight._pointLights = [];       // 동적 포인트 라이트 풀
ShadowLight._pointLightIndex = 0;    // 현재 프레임 사용 인덱스

// 그림자
ShadowLight._shadowMeshes = [];      // 캐릭터별 shadow mesh
ShadowLight._shadowMaterial = null;

// 설정
ShadowLight.config = {
    // 광원 설정
    ambientColor: 0x667788,           // 환경광 (어두운 푸른 톤 - 달빛 느낌)
    ambientIntensity: 0.4,
    directionalColor: 0xfff8ee,       // 햇빛 색상 (따뜻한 톤)
    directionalIntensity: 0.1,
    lightDirection: new THREE.Vector3(-1, -1, -2).normalize(), // 광원 방향 (Z 성분 크게)

    // 플레이어 포인트 라이트
    playerLightColor: 0xa25f06,       // 횃불 색상
    playerLightIntensity: 1.2,
    playerLightDistance: 200,          // 범위 (pixel 단위, decay=0에서 이 범위 밖은 영향 없음)
    playerLightZ: 30,                 // 높이

    // 그림자 설정
    shadowOpacity: 0.4,
    shadowColor: 0x000000,
    shadowOffsetScale: 0.6,           // 광원 방향에 따른 오프셋 스케일
};

//=============================================================================
// Material 교체 시스템
// MeshBasicMaterial -> MeshLambertMaterial (조명 영향을 받도록)
//=============================================================================

ShadowLight._convertedMaterials = new WeakMap();

/**
 * MeshBasicMaterial을 MeshLambertMaterial로 교체
 * 기존 텍스처, 투명도, 블렌딩 등 속성을 모두 유지
 */
ShadowLight._convertMaterial = function(sprite) {
    if (!sprite || !sprite._material) return;
    if (sprite._material.isMeshPhongMaterial) return;
    if (this._convertedMaterials.has(sprite._material)) return;

    var oldMat = sprite._material;
    var newMat = new THREE.MeshPhongMaterial({
        map: oldMat.map,
        transparent: oldMat.transparent,
        depthTest: true,
        depthWrite: true,
        side: oldMat.side,
        opacity: oldMat.opacity,
        blending: oldMat.blending,
        emissive: new THREE.Color(0x111111),
        specular: new THREE.Color(0x000000),  // 반사광 없음
        shininess: 0,
        alphaTest: 0.5,  // 투명 배경은 그림자 생성하지 않음
    });
    newMat.visible = oldMat.visible;
    newMat.needsUpdate = true;

    // Mesh에 새 material 적용
    sprite._threeObj.material = newMat;
    sprite._material = newMat;

    // Shadow Map: 캐릭터가 그림자를 드리우도록 설정
    sprite._threeObj.castShadow = true;
    // customDepthMaterial: alpha-tested shadow silhouette
    sprite._threeObj.customDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        map: newMat.map,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
    });
    // Z 위치를 올려서 shadow map depth에서 타일맵과 분리
    if (sprite._threeObj.position.z < 48) {
        sprite._shadowOrigZ = sprite._threeObj.position.z;
        sprite._threeObj.position.z = 48;
    }

    this._convertedMaterials.set(newMat, true);
};

/**
 * MeshLambertMaterial을 MeshBasicMaterial로 되돌리기
 */
ShadowLight._revertMaterial = function(sprite) {
    if (!sprite || !sprite._material) return;
    if (!sprite._material.isMeshPhongMaterial) return;

    var oldMat = sprite._material;
    var newMat = new THREE.MeshBasicMaterial({
        map: oldMat.map,
        transparent: oldMat.transparent,
        depthTest: false,
        depthWrite: false,
        side: oldMat.side,
        opacity: oldMat.opacity,
        blending: oldMat.blending,
    });
    newMat.visible = oldMat.visible;
    newMat.needsUpdate = true;

    sprite._threeObj.material = newMat;
    sprite._material = newMat;
    sprite._threeObj.castShadow = false;
    sprite._threeObj.customDepthMaterial = null;
    // Z 위치 복원
    if (sprite._shadowOrigZ !== undefined) {
        sprite._threeObj.position.z = sprite._shadowOrigZ;
        delete sprite._shadowOrigZ;
    }
};

//=============================================================================
// 타일맵 메시 재생성
// 기존 메시를 삭제하여 _flush에서 올바른 material로 다시 생성하도록 강제
//=============================================================================

/**
 * 타일맵 메시를 모두 삭제하여 _flush에서 올바른 material로 재생성하도록 강제
 * (ThreeTilemap._flush에서 ShadowLight._active 여부에 따라 material 결정)
 */
ShadowLight._resetTilemapMeshes = function(tilemap) {
    if (!tilemap) return;
    var zLayers = [tilemap.lowerZLayer, tilemap.upperZLayer];
    for (var z = 0; z < zLayers.length; z++) {
        var zLayer = zLayers[z];
        if (!zLayer || !zLayer.children) continue;
        for (var c = 0; c < zLayer.children.length; c++) {
            var composite = zLayer.children[c];
            if (!composite || !composite.children) continue;
            for (var r = 0; r < composite.children.length; r++) {
                var rectLayer = composite.children[r];
                if (!rectLayer || !rectLayer._meshes) continue;
                // 기존 메시 제거
                for (var key in rectLayer._meshes) {
                    var mesh = rectLayer._meshes[key];
                    if (mesh) {
                        if (mesh.geometry) mesh.geometry.dispose();
                        if (mesh.material) mesh.material.dispose();
                        rectLayer._threeObj.remove(mesh);
                    }
                }
                rectLayer._meshes = {};
                rectLayer._needsRebuild = true;
            }
        }
    }
};

// _revertTilemapMaterials도 _resetTilemapMeshes로 통합 (메시 재생성 방식)
ShadowLight._revertTilemapMaterials = function(tilemap) {
    this._resetTilemapMeshes(tilemap);
};

//=============================================================================
// Scene에 조명 추가/제거
//=============================================================================

ShadowLight._addLightsToScene = function(scene) {
    if (this._ambientLight) return; // 이미 추가됨

    // editorLights 맵별 설정 (에디터에서 저장한 커스텀 데이터)
    var el = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;

    // AmbientLight - 전체적인 환경광
    var ambColor = el ? parseInt(el.ambient.color.replace('#', ''), 16) : this.config.ambientColor;
    var ambIntensity = el ? el.ambient.intensity : this.config.ambientIntensity;
    this._ambientLight = new THREE.AmbientLight(ambColor, ambIntensity);
    scene.add(this._ambientLight);

    // DirectionalLight - 태양/달빛 (그림자 방향 결정)
    var dirColor = el ? parseInt(el.directional.color.replace('#', ''), 16) : this.config.directionalColor;
    var dirIntensity = el ? el.directional.intensity : this.config.directionalIntensity;
    this._directionalLight = new THREE.DirectionalLight(dirColor, dirIntensity);
    // 위치는 방향의 반대 (광원이 오는 방향)
    var dir;
    if (el && el.directional.direction) {
        dir = new THREE.Vector3(el.directional.direction[0], el.directional.direction[1], el.directional.direction[2]).normalize();
    } else {
        dir = this.config.lightDirection;
    }
    this._directionalLight.position.set(-dir.x * 1000, -dir.y * 1000, -dir.z * 1000);

    // Shadow Map 설정
    this._directionalLight.castShadow = true;
    this._directionalLight.shadow.mapSize.width = 2048;
    this._directionalLight.shadow.mapSize.height = 2048;
    // OrthographicCamera 범위 (맵 크기에 맞게 타이트하게)
    var shadowCamSize = Math.max(
        (typeof Graphics !== 'undefined' ? Graphics._width : 1000),
        (typeof Graphics !== 'undefined' ? Graphics._height : 1000)
    );
    var halfSize = shadowCamSize / 2 + 100; // 약간 여유
    this._directionalLight.shadow.camera.left = -halfSize;
    this._directionalLight.shadow.camera.right = halfSize;
    this._directionalLight.shadow.camera.top = halfSize;
    this._directionalLight.shadow.camera.bottom = -halfSize;
    this._directionalLight.shadow.camera.near = 1;
    this._directionalLight.shadow.camera.far = 5000;
    this._directionalLight.shadow.bias = -0.001;

    // target을 맵 중심으로 설정
    var cx = shadowCamSize / 2;
    var cy = shadowCamSize / 2;
    this._directionalLight.target.position.set(cx, cy, 0);

    // target을 scene에 추가해야 DirectionalLight 방향이 올바르게 동작
    scene.add(this._directionalLight);
    scene.add(this._directionalLight.target);
};

ShadowLight._removeLightsFromScene = function(scene) {
    if (this._ambientLight) {
        scene.remove(this._ambientLight);
        this._ambientLight = null;
    }
    if (this._directionalLight) {
        scene.remove(this._directionalLight.target);
        scene.remove(this._directionalLight);
        this._directionalLight = null;
    }
    // 포인트 라이트 제거
    for (var i = 0; i < this._pointLights.length; i++) {
        if (this._pointLights[i].parent) {
            this._pointLights[i].parent.remove(this._pointLights[i]);
        }
    }
    this._pointLights = [];
};

//=============================================================================
// PointLight 풀 관리
//=============================================================================

ShadowLight._getPointLight = function() {
    var idx = this._pointLightIndex;
    if (idx >= this._pointLights.length) {
        var light = new THREE.PointLight(0xffffff, 0, 200, 0);  // decay=0: distance 기반 linear cutoff (1/d² 물리 감쇠 아님)
        this._pointLights.push(light);
    }
    var light = this._pointLights[idx];
    // scene에 직접 추가 (타일맵과 동일한 좌표계에서 작동하도록)
    var rendererObj = Graphics._rendererObj || Graphics._renderer;
    if (rendererObj && rendererObj.scene && light.parent !== rendererObj.scene) {
        if (light.parent) light.parent.remove(light);
        rendererObj.scene.add(light);
    }
    light.visible = true;
    this._pointLightIndex++;
    return light;
};

ShadowLight._lastPointLightCount = 0;

ShadowLight._hideUnusedPointLights = function() {
    for (var i = this._pointLightIndex; i < this._pointLights.length; i++) {
        this._pointLights[i].visible = false;
    }
    this._pointLightIndex = 0;
};

//=============================================================================
// Planar Shadow Projection
// 광원 방향에 따라 캐릭터 형태를 바닥에 투영한 shadow mesh
//=============================================================================

ShadowLight._ensureShadowMaterial = function() {
    if (this._shadowMaterial) return;
    this._shadowMaterial = new THREE.MeshBasicMaterial({
        color: this.config.shadowColor,
        transparent: true,
        opacity: this.config.shadowOpacity,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
};

/**
 * 캐릭터 스프라이트용 shadow mesh 생성
 * - 원본 스프라이트와 같은 PlaneGeometry를 복제하여 바닥에 눕힘
 * - 광원 방향으로 비스듬히 투영 (shear transform)
 */
ShadowLight._createShadowMesh = function() {
    this._ensureShadowMaterial();
    var geo = new THREE.PlaneGeometry(1, 1);
    var mesh = new THREE.Mesh(geo, this._shadowMaterial);
    return mesh;
};

/**
 * shadow mesh를 캐릭터 스프라이트 위치에 맞게 업데이트
 * @param {THREE.Mesh} shadowMesh
 * @param {ThreeSprite} charSprite - 캐릭터 스프라이트 래퍼
 */
ShadowLight._updateShadowMesh = function(shadowMesh, charSprite) {
    var spriteObj = charSprite._threeObj;
    if (!spriteObj || !spriteObj.visible) {
        shadowMesh.visible = false;
        return;
    }

    // 씬 그래프에 아직 추가되지 않았으면 추가
    // (_threeObj.parent는 _syncHierarchy 이후에야 설정됨)
    if (!shadowMesh.parent && spriteObj.parent) {
        spriteObj.parent.add(shadowMesh);
    }
    if (!shadowMesh.parent) {
        shadowMesh.visible = false;
        return;
    }

    var fw = charSprite._frameWidth;
    var fh = charSprite._frameHeight;
    if (fw <= 0 || fh <= 0) {
        shadowMesh.visible = false;
        return;
    }

    shadowMesh.visible = true;

    // 광원 방향에서 그림자 오프셋 계산 (XY 평면 투영)
    var dir = this.config.lightDirection;
    var offsetX = -dir.x / Math.abs(dir.z || 0.01) * fh * this.config.shadowOffsetScale;
    var offsetY = -dir.y / Math.abs(dir.z || 0.01) * fh * this.config.shadowOffsetScale * 0.3;

    // shadow mesh 위치 = 캐릭터 발밑 + 광원 오프셋
    shadowMesh.position.x = spriteObj.position.x + offsetX * 0.3;
    shadowMesh.position.y = spriteObj.position.y + offsetY;
    shadowMesh.position.z = spriteObj.position.z - 0.5; // 캐릭터보다 약간 뒤에

    // shadow mesh 크기: 캐릭터 너비 유지, 높이는 압축 (바닥에 눕히기)
    shadowMesh.scale.x = spriteObj.scale.x;
    shadowMesh.scale.y = spriteObj.scale.y * 0.4; // 납작하게

    // shadow mesh 기하: 캐릭터 기하를 기반으로 shear
    var posAttr = shadowMesh.geometry.attributes.position;
    var anchorX = charSprite._anchorX;
    var anchorY = charSprite._anchorY;

    var left   = -anchorX * fw;
    var right  = (1 - anchorX) * fw;
    // 그림자는 발밑에서 펼쳐짐
    var shadowTop = -fh * 0.15;      // 살짝 위
    var shadowBottom = fh * 0.25;    // 발 아래로

    // shear: 위쪽 정점을 광원 반대쪽으로 밀기
    var shearX = offsetX * 0.5;

    posAttr.setXY(0, left + shearX,  shadowTop);     // top-left (sheared)
    posAttr.setXY(1, right + shearX, shadowTop);     // top-right (sheared)
    posAttr.setXY(2, left,           shadowBottom);   // bottom-left (바닥)
    posAttr.setXY(3, right,          shadowBottom);   // bottom-right (바닥)
    posAttr.needsUpdate = true;

    // UV: 캐릭터와 동일한 UV (실루엣 형태)
    var srcUV = charSprite._geometry.attributes.uv;
    var dstUV = shadowMesh.geometry.attributes.uv;
    if (srcUV && dstUV) {
        for (var i = 0; i < 4; i++) {
            dstUV.setXY(i, srcUV.getX(i), srcUV.getY(i));
        }
        dstUV.needsUpdate = true;
    }

    // 텍스처: 캐릭터와 같은 텍스처 사용 (알파 채널로 실루엣)
    if (charSprite._material.map !== shadowMesh.material.map) {
        // 개별 material 사용 (텍스처 다를 수 있으므로)
        shadowMesh.material = this._shadowMaterial.clone();
        shadowMesh.material.map = charSprite._material.map;
        shadowMesh.material.needsUpdate = true;
    }

    // opacity: 캐릭터 투명도에 비례
    shadowMesh.material.opacity = this.config.shadowOpacity *
        (charSprite.worldAlpha || 1);
};

//=============================================================================
// Spriteset_Map 통합
//=============================================================================

var _Spriteset_Map_initialize = Spriteset_Map.prototype.initialize;
Spriteset_Map.prototype.initialize = function() {
    _Spriteset_Map_initialize.call(this);
    ShadowLight._spriteset = this;
};

var _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
Spriteset_Map.prototype.createCharacters = function() {
    _Spriteset_Map_createCharacters.call(this);
    // 각 캐릭터 스프라이트에 shadow mesh 생성
    // 주의: 이 시점에서는 _threeObj.parent가 아직 null이므로
    // 씬 그래프 추가는 update 루프에서 수행
    this._shadowMeshes = [];
    for (var i = 0; i < this._characterSprites.length; i++) {
        var shadowMesh = ShadowLight._createShadowMesh();
        this._shadowMeshes.push(shadowMesh);
    }
};

var _Spriteset_Map_update = Spriteset_Map.prototype.update;
Spriteset_Map.prototype.update = function() {
    _Spriteset_Map_update.call(this);
    this._updateShadowLight();
};

Spriteset_Map.prototype._updateShadowLight = function() {
    var enabled = ConfigManager.shadowLight;

    if (enabled && !ShadowLight._active) {
        // 활성화
        this._activateShadowLight();
        ShadowLight._active = true;
    } else if (!enabled && ShadowLight._active) {
        // 비활성화
        this._deactivateShadowLight();
        ShadowLight._active = false;
    }

    if (!enabled) return;

    // shadow mesh 업데이트
    if (this._shadowMeshes) {
        for (var i = 0; i < this._characterSprites.length; i++) {
            if (i < this._shadowMeshes.length) {
                ShadowLight._updateShadowMesh(
                    this._shadowMeshes[i],
                    this._characterSprites[i]
                );
            }
        }
    }

    // 플레이어 포인트 라이트
    this._updatePointLights();
};

Spriteset_Map.prototype._activateShadowLight = function() {
    // scene에 접근하려면 rendererObj가 필요
    var rendererObj = Graphics._rendererObj || Graphics._renderer;
    if (rendererObj && rendererObj.scene) {
        ShadowLight._addLightsToScene(rendererObj.scene);
    }
    // 캐릭터 스프라이트 material 교체
    if (this._characterSprites) {
        for (var i = 0; i < this._characterSprites.length; i++) {
            ShadowLight._convertMaterial(this._characterSprites[i]);
        }
    }

    // 타일맵 메시 재생성 (MeshPhongMaterial로 새로 생성되도록)
    ShadowLight._resetTilemapMeshes(this._tilemap);

    // 디버그 UI 생성
    ShadowLight._createDebugUI();

    // shadow mesh는 _updateShadowMesh에서 parent 설정 및 표시됨
};

Spriteset_Map.prototype._deactivateShadowLight = function() {
    ShadowLight._removeDebugUI();
    var rendererObj = Graphics._rendererObj || Graphics._renderer;
    if (rendererObj && rendererObj.scene) {
        ShadowLight._removeLightsFromScene(rendererObj.scene);
    }
    // material 복원
    if (this._characterSprites) {
        for (var i = 0; i < this._characterSprites.length; i++) {
            ShadowLight._revertMaterial(this._characterSprites[i]);
        }
    }

    // 타일맵 material 복원
    ShadowLight._revertTilemapMaterials(this._tilemap);

    // shadow mesh 숨기기 및 씬 그래프에서 제거
    if (this._shadowMeshes) {
        for (var i = 0; i < this._shadowMeshes.length; i++) {
            this._shadowMeshes[i].visible = false;
            if (this._shadowMeshes[i].parent) {
                this._shadowMeshes[i].parent.remove(this._shadowMeshes[i]);
            }
        }
    }
};

/**
 * wrapper hierarchy의 _x, _y를 부모 체인 따라 합산하여 월드 좌표 계산
 * (Three.js의 matrixWorld는 syncTransform 이전에 호출하면 부정확)
 */
ShadowLight._getWrapperWorldPos = function(wrapper) {
    var wx = 0, wy = 0;
    var cur = wrapper;
    while (cur) {
        wx += (cur._x || 0);
        wy += (cur._y || 0);
        cur = cur.parent;
    }
    return { x: wx, y: wy };
};

Spriteset_Map.prototype._updatePointLights = function() {
    ShadowLight._pointLightIndex = 0;

    // 플레이어 라이트
    if ($gamePlayer && !$gamePlayer.isTransparent()) {
        var playerSprite = this._getPlayerSprite();
        if (playerSprite) {
            var light = ShadowLight._getPointLight();
            light.color.setHex(ShadowLight.config.playerLightColor);
            light.intensity = ShadowLight.config.playerLightIntensity;
            light.distance = ShadowLight.config.playerLightDistance;
            light.decay = ShadowLight._debugDecay !== undefined ? ShadowLight._debugDecay : 0;
            var wp = ShadowLight._getWrapperWorldPos(playerSprite);
            light.position.set(wp.x, wp.y - 24, ShadowLight.config.playerLightZ);
        }
    }

    // 이벤트 라이트 (<light> 노트 태그)
    var events = $gameMap.events();
    for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        if (!ev || ev.isTransparent()) continue;
        var note = ev.event() ? ev.event().note || '' : '';
        var lightMatch = note.match(/<light(?:\s*:\s*(\d+)(?:\s*,\s*#?([0-9a-fA-F]{6}))?)?>/i);
        if (lightMatch) {
            var evSprite = this._getEventSprite(ev);
            if (evSprite) {
                var light = ShadowLight._getPointLight();
                var dist = lightMatch[1] ? parseInt(lightMatch[1]) : 150;
                var color = lightMatch[2] ? parseInt(lightMatch[2], 16) : 0xffcc88;
                light.color.setHex(color);
                light.intensity = 1.0;
                light.distance = dist;
                light.decay = ShadowLight._debugDecay !== undefined ? ShadowLight._debugDecay : 0;
                var wp = ShadowLight._getWrapperWorldPos(evSprite);
                light.position.set(wp.x, wp.y - 24, ShadowLight.config.playerLightZ);
            }
        }
    }

    // 에디터에서 배치한 포인트 라이트 ($dataMap.editorLights.points)
    var el = (typeof $dataMap !== 'undefined' && $dataMap) ? $dataMap.editorLights : null;
    if (el && el.points) {
        var tw = $gameMap.tileWidth();
        var th = $gameMap.tileHeight();
        for (var j = 0; j < el.points.length; j++) {
            var pl = el.points[j];
            var light = ShadowLight._getPointLight();
            light.color.setHex(parseInt(pl.color.replace('#', ''), 16));
            light.intensity = pl.intensity;
            light.distance = pl.distance;
            light.decay = pl.decay || 0;
            // 타일 좌표 → 화면 좌표 (스크롤 반영)
            var sx = Math.round($gameMap.adjustX(pl.x) * tw + tw / 2);
            var sy = Math.round($gameMap.adjustY(pl.y) * th + th / 2);
            light.position.set(sx, sy, pl.z || ShadowLight.config.playerLightZ);
        }
    }

    // PointLight 개수 변경 시 타일맵 material 셰이더 재컴파일
    // (_hideUnusedPointLights가 _pointLightIndex를 0으로 리셋하므로 먼저 저장)
    var activeCount = ShadowLight._pointLightIndex;
    ShadowLight._hideUnusedPointLights();

    if (activeCount !== ShadowLight._lastPointLightCount) {
        ShadowLight._lastPointLightCount = activeCount;
        ShadowLight._invalidateTilemapMaterials(this._tilemap);
    }
};

/**
 * 타일맵 MeshLambertMaterial의 needsUpdate를 설정하여 셰이더 재컴파일 트리거
 * (scene의 라이트 구성이 변경되면 셰이더에 새 라이트를 반영해야 함)
 */
ShadowLight._invalidateTilemapMaterials = function(tilemap) {
    if (!tilemap) return;
    var zLayers = [tilemap.lowerZLayer, tilemap.upperZLayer];
    for (var z = 0; z < zLayers.length; z++) {
        var zLayer = zLayers[z];
        if (!zLayer || !zLayer.children) continue;
        for (var c = 0; c < zLayer.children.length; c++) {
            var composite = zLayer.children[c];
            if (!composite || !composite.children) continue;
            for (var r = 0; r < composite.children.length; r++) {
                var rectLayer = composite.children[r];
                if (!rectLayer || !rectLayer._meshes) continue;
                for (var key in rectLayer._meshes) {
                    var mesh = rectLayer._meshes[key];
                    if (mesh && mesh.material && mesh.material.isMeshPhongMaterial) {
                        mesh.material.needsUpdate = true;
                    }
                }
            }
        }
    }
};

Spriteset_Map.prototype._getPlayerSprite = function() {
    if (!this._characterSprites) return null;
    for (var i = 0; i < this._characterSprites.length; i++) {
        if (this._characterSprites[i]._character === $gamePlayer) {
            return this._characterSprites[i];
        }
    }
    return null;
};

Spriteset_Map.prototype._getEventSprite = function(event) {
    if (!this._characterSprites) return null;
    for (var i = 0; i < this._characterSprites.length; i++) {
        if (this._characterSprites[i]._character === event) {
            return this._characterSprites[i];
        }
    }
    return null;
};

//=============================================================================
// Sprite_Character - 새로 생성된 캐릭터도 material 교체
//=============================================================================

var _Sprite_Character_updateBitmap = Sprite_Character.prototype.updateBitmap;
Sprite_Character.prototype.updateBitmap = function() {
    _Sprite_Character_updateBitmap.call(this);
    // material이 교체되면 다시 변환
    if (ShadowLight._active && this._material && !this._material.isMeshPhongMaterial) {
        ShadowLight._convertMaterial(this);
    }
};

//=============================================================================
// Graphics - rendererObj 참조 저장
//=============================================================================

var _Graphics_createRenderer = Graphics._createRenderer;
Graphics._createRenderer = function() {
    _Graphics_createRenderer.call(this);
    // rendererObj 참조를 저장 (scene 접근용)
    Graphics._rendererObj = this._renderer;
};

//=============================================================================
// 디버그 UI - 화면 오른쪽 상단에 라이팅 파라미터 실시간 조절
//=============================================================================

ShadowLight._createDebugUI = function() {
    if (this._debugPanel) return;

    var panel = document.createElement('div');
    panel.id = 'sl-debug-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:rgba(0,0,0,0.85);color:#eee;font:12px monospace;padding:10px;border-radius:6px;min-width:220px;pointer-events:auto;';

    var title = document.createElement('div');
    title.textContent = 'ShadowLight Debug';
    title.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#ffcc88;';
    panel.appendChild(title);

    var self = this;
    var controls = [
        { label: 'Intensity', key: 'playerLightIntensity', min: 0, max: 5, step: 0.1 },
        { label: 'Distance', key: 'playerLightDistance', min: 50, max: 2000, step: 50 },
        { label: 'Light Z', key: 'playerLightZ', min: 0, max: 500, step: 10 },
        { label: 'Ambient', key: 'ambientIntensity', min: 0, max: 2, step: 0.05 },
        { label: 'Dir Light', key: 'directionalIntensity', min: 0, max: 2, step: 0.05 },
    ];

    controls.forEach(function(c) {
        var row = document.createElement('div');
        row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';

        var lbl = document.createElement('span');
        lbl.textContent = c.label;
        lbl.style.cssText = 'width:70px;font-size:11px;';

        var slider = document.createElement('input');
        slider.type = 'range';
        slider.min = c.min;
        slider.max = c.max;
        slider.step = c.step;
        slider.value = self.config[c.key];
        slider.style.cssText = 'width:90px;height:14px;';

        var val = document.createElement('span');
        val.textContent = parseFloat(self.config[c.key]).toFixed(1);
        val.style.cssText = 'width:40px;font-size:11px;text-align:right;';

        slider.addEventListener('input', function() {
            var v = parseFloat(slider.value);
            self.config[c.key] = v;
            val.textContent = v.toFixed(c.step < 1 ? 2 : 0);
            // 실시간 반영
            if (c.key === 'ambientIntensity' && self._ambientLight) {
                self._ambientLight.intensity = v;
            }
            if (c.key === 'directionalIntensity' && self._directionalLight) {
                self._directionalLight.intensity = v;
            }
        });

        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(val);
        panel.appendChild(row);
    });

    // Decay 토글 (0 또는 1)
    var decayRow = document.createElement('div');
    decayRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';
    var decayLbl = document.createElement('span');
    decayLbl.textContent = 'Decay';
    decayLbl.style.cssText = 'width:70px;font-size:11px;';
    var decaySelect = document.createElement('select');
    decaySelect.style.cssText = 'font:11px monospace;background:#333;color:#eee;border:1px solid #555;';
    [0, 1, 2].forEach(function(d) {
        var opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        decaySelect.appendChild(opt);
    });
    decaySelect.value = '0';
    self._debugDecay = 0;
    decaySelect.addEventListener('change', function() {
        self._debugDecay = parseInt(decaySelect.value);
    });
    decayRow.appendChild(decayLbl);
    decayRow.appendChild(decaySelect);
    panel.appendChild(decayRow);

    // 정수 색상값을 #rrggbb 문자열로 변환하는 헬퍼
    function intToHex(colorInt) {
        if (typeof colorInt === 'string') return colorInt;
        return '#' + ('000000' + (colorInt >>> 0).toString(16)).slice(-6);
    }

    // 빛 색깔 피커
    var colorControls = [
        { label: 'Light Color', key: 'playerLightColor' },
        { label: 'Ambient Color', key: 'ambientColor' },
    ];

    colorControls.forEach(function(cc) {
        var row = document.createElement('div');
        row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px;';

        var lbl = document.createElement('span');
        lbl.textContent = cc.label;
        lbl.style.cssText = 'width:70px;font-size:11px;';

        var initColor = intToHex(self.config[cc.key]);
        var colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = initColor;
        colorInput.style.cssText = 'width:40px;height:20px;border:1px solid #555;background:#333;cursor:pointer;';

        var hexVal = document.createElement('span');
        hexVal.textContent = initColor;
        hexVal.style.cssText = 'font-size:11px;color:#aaa;';

        colorInput.addEventListener('input', function() {
            var hex = colorInput.value;
            var colorInt = parseInt(hex.replace('#', ''), 16);
            self.config[cc.key] = colorInt;
            hexVal.textContent = hex;
            if (cc.key === 'playerLightColor') {
                // 모든 활성 포인트라이트 색상 업데이트
                if (self._lightPool) {
                    self._lightPool.forEach(function(l) {
                        if (l.parent) l.color.setHex(colorInt);
                    });
                }
            }
            if (cc.key === 'ambientColor' && self._ambientLight) {
                self._ambientLight.color.setHex(colorInt);
            }
        });

        row.appendChild(lbl);
        row.appendChild(colorInput);
        row.appendChild(hexVal);
        panel.appendChild(row);
    });

    // 현재값 복사 버튼
    var copyBtn = document.createElement('button');
    copyBtn.textContent = '현재값 복사';
    copyBtn.style.cssText = 'margin-top:8px;width:100%;padding:4px 8px;font:11px monospace;background:#446;color:#eee;border:1px solid #668;border-radius:3px;cursor:pointer;';
    copyBtn.addEventListener('click', function() {
        var cfg = self.config;
        var text = [
            'playerLightIntensity: ' + cfg.playerLightIntensity,
            'playerLightDistance: ' + cfg.playerLightDistance,
            'playerLightZ: ' + cfg.playerLightZ,
            'playerLightColor: 0x' + ('000000' + ((cfg.playerLightColor || 0xffffff) >>> 0).toString(16)).slice(-6),
            'ambientIntensity: ' + cfg.ambientIntensity,
            'ambientColor: 0x' + ('000000' + ((cfg.ambientColor || 0xffffff) >>> 0).toString(16)).slice(-6),
            'directionalIntensity: ' + cfg.directionalIntensity,
            'decay: ' + (self._debugDecay !== undefined ? self._debugDecay : 0),
        ].join('\n');

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
                copyBtn.textContent = '복사 완료!';
                setTimeout(function() { copyBtn.textContent = '현재값 복사'; }, 1500);
            });
        } else {
            // fallback
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copyBtn.textContent = '복사 완료!';
            setTimeout(function() { copyBtn.textContent = '현재값 복사'; }, 1500);
        }
    });
    copyBtn.addEventListener('mouseover', function() { copyBtn.style.background = '#557'; });
    copyBtn.addEventListener('mouseout', function() { copyBtn.style.background = '#446'; });
    panel.appendChild(copyBtn);

    document.body.appendChild(panel);
    this._debugPanel = panel;
};

ShadowLight._removeDebugUI = function() {
    if (this._debugPanel) {
        this._debugPanel.remove();
        this._debugPanel = null;
    }
};

//=============================================================================
// Plugin Commands
//=============================================================================

var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function(command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (command === 'ShadowLight') {
        if (args[0] === 'on') ConfigManager.shadowLight = true;
        if (args[0] === 'off') ConfigManager.shadowLight = false;
        if (args[0] === 'ambient' && args[1]) {
            ShadowLight.config.ambientIntensity = parseFloat(args[1]);
            if (ShadowLight._ambientLight) {
                ShadowLight._ambientLight.intensity = parseFloat(args[1]);
            }
        }
        if (args[0] === 'direction' && args.length >= 4) {
            ShadowLight.config.lightDirection = new THREE.Vector3(
                parseFloat(args[1]), parseFloat(args[2]), parseFloat(args[3])
            ).normalize();
        }
    }
};

})();
