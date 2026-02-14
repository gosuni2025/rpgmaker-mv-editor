//=============================================================================
// FogOfWar.js - Fog of War 시스템 (런타임 + 에디터)
//=============================================================================
// 3단계 시야: 미탐험(검은색) → 탐험완료(반투명) → 현재 시야(투명)
// 맵 바닥면(Z=3.5)에 PlaneGeometry 메쉬를 배치하여 3D 카메라 원근/회전 자동 반영
//
// 의존: THREE (global), PostProcess.js, $gameMap, $gamePlayer
//=============================================================================

(function() {

//=============================================================================
// FogOfWar 전역 객체
//=============================================================================

var FogOfWar = {};
window.FogOfWar = FogOfWar;

FogOfWar._active = false;
FogOfWar._fogTexture = null;       // DataTexture (mapWidth x mapHeight, RGBA)
FogOfWar._visibilityData = null;   // Float32Array — 현재 프레임 가시성 (0~1)
FogOfWar._exploredData = null;     // Uint8Array — 탐험 기록 (0 or 1)
FogOfWar._mapWidth = 0;
FogOfWar._mapHeight = 0;
FogOfWar._radius = 5;              // 시야 반경 (타일)
FogOfWar._fogColor = { r: 0, g: 0, b: 0 };
FogOfWar._unexploredAlpha = 1.0;   // 미탐험 불투명도
FogOfWar._exploredAlpha = 0.6;     // 탐험완료 불투명도
FogOfWar._prevPlayerX = -1;
FogOfWar._prevPlayerY = -1;
FogOfWar._fogMesh = null;          // 3D 메쉬

//=============================================================================
// 초기화 / 해제
//=============================================================================

FogOfWar.setup = function(mapWidth, mapHeight, config) {
    this._mapWidth = mapWidth;
    this._mapHeight = mapHeight;
    this._active = true;

    if (config) {
        this._radius = config.radius != null ? config.radius : 5;
        if (config.fogColor) {
            var c = this._parseColor(config.fogColor);
            this._fogColor = c;
        }
        this._unexploredAlpha = config.unexploredAlpha != null ? config.unexploredAlpha : 1.0;
        this._exploredAlpha = config.exploredAlpha != null ? config.exploredAlpha : 0.6;
    }

    // 가시성 / 탐험 버퍼
    var size = mapWidth * mapHeight;
    this._visibilityData = new Float32Array(size);
    this._exploredData = new Uint8Array(size);

    // fog 텍스처: RG 채널 (R=visibility, G=explored)
    var texData = new Uint8Array(size * 4);
    this._fogTexture = new THREE.DataTexture(texData, mapWidth, mapHeight, THREE.RGBAFormat);
    this._fogTexture.magFilter = THREE.LinearFilter;
    this._fogTexture.minFilter = THREE.LinearFilter;
    this._fogTexture.needsUpdate = true;

    this._prevPlayerX = -1;
    this._prevPlayerY = -1;
};

FogOfWar.dispose = function() {
    this._disposeMesh();
    if (this._fogTexture) {
        this._fogTexture.dispose();
        this._fogTexture = null;
    }
    this._visibilityData = null;
    this._exploredData = null;
    this._active = false;
    this._prevPlayerX = -1;
    this._prevPlayerY = -1;
};

FogOfWar._parseColor = function(hex) {
    if (typeof hex === 'string' && hex.charAt(0) === '#') {
        var v = parseInt(hex.substring(1), 16);
        return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
    }
    if (typeof hex === 'object' && hex !== null) {
        return { r: hex.r || 0, g: hex.g || 0, b: hex.b || 0 };
    }
    return { r: 0, g: 0, b: 0 };
};

//=============================================================================
// 가시성 계산 (CPU, 프레임당)
//=============================================================================

FogOfWar.updateVisibility = function(playerTileX, playerTileY) {
    if (!this._active || !this._visibilityData) return;

    // 플레이어가 이동하지 않았으면 스킵
    if (playerTileX === this._prevPlayerX && playerTileY === this._prevPlayerY) return;
    this._prevPlayerX = playerTileX;
    this._prevPlayerY = playerTileY;

    var w = this._mapWidth;
    var h = this._mapHeight;
    var radius = this._radius;
    var radiusSq = radius * radius;
    var vis = this._visibilityData;
    var explored = this._exploredData;

    // 가시성 초기화
    for (var i = 0; i < vis.length; i++) vis[i] = 0;

    // 원형 반경 계산
    var minX = Math.max(0, Math.floor(playerTileX - radius));
    var maxX = Math.min(w - 1, Math.ceil(playerTileX + radius));
    var minY = Math.max(0, Math.floor(playerTileY - radius));
    var maxY = Math.min(h - 1, Math.ceil(playerTileY + radius));

    for (var ty = minY; ty <= maxY; ty++) {
        for (var tx = minX; tx <= maxX; tx++) {
            var dx = tx - playerTileX;
            var dy = ty - playerTileY;
            var distSq = dx * dx + dy * dy;
            if (distSq <= radiusSq) {
                var idx = ty * w + tx;
                // 부드러운 경계: 거리에 따라 0~1
                var dist = Math.sqrt(distSq);
                var t = dist / radius;
                vis[idx] = 1.0 - t * t; // quadratic falloff
                explored[idx] = 1;
            }
        }
    }

    this._updateTexture();
};

// 에디터 미리보기용: 특정 좌표 기준 가시성
FogOfWar.updateVisibilityAt = function(tileX, tileY) {
    this.updateVisibility(tileX, tileY);
};

FogOfWar._updateTexture = function() {
    if (!this._fogTexture) return;

    var data = this._fogTexture.image.data;
    var w = this._mapWidth;
    var h = this._mapHeight;
    var vis = this._visibilityData;
    var explored = this._exploredData;

    for (var i = 0; i < w * h; i++) {
        var pi = i * 4;
        data[pi + 0] = Math.round(vis[i] * 255);     // R = visibility
        data[pi + 1] = explored[i] * 255;              // G = explored
        data[pi + 2] = 0;
        data[pi + 3] = 255;
    }

    this._fogTexture.needsUpdate = true;
};

//=============================================================================
// 전체 공개 / 전체 숨김
//=============================================================================

FogOfWar.revealAll = function() {
    if (!this._visibilityData) return;
    for (var i = 0; i < this._visibilityData.length; i++) {
        this._visibilityData[i] = 1.0;
        this._exploredData[i] = 1;
    }
    this._updateTexture();
};

FogOfWar.hideAll = function() {
    if (!this._visibilityData) return;
    for (var i = 0; i < this._visibilityData.length; i++) {
        this._visibilityData[i] = 0;
        this._exploredData[i] = 0;
    }
    this._prevPlayerX = -1;
    this._prevPlayerY = -1;
    this._updateTexture();
};

FogOfWar.revealRect = function(x, y, w, h) {
    if (!this._visibilityData) return;
    var mw = this._mapWidth;
    var mh = this._mapHeight;
    for (var ty = y; ty < y + h && ty < mh; ty++) {
        for (var tx = x; tx < x + w && tx < mw; tx++) {
            if (tx >= 0 && ty >= 0) {
                var idx = ty * mw + tx;
                this._visibilityData[idx] = 1.0;
                this._exploredData[idx] = 1;
            }
        }
    }
    this._updateTexture();
};

//=============================================================================
// 3D 메쉬 기반 FOW
//=============================================================================

FogOfWar._createMesh = function() {
    if (this._fogMesh) this._disposeMesh();
    if (!this._fogTexture) return null;

    var totalW = this._mapWidth * 48;
    var totalH = this._mapHeight * 48;

    var material = new THREE.ShaderMaterial({
        uniforms: {
            tFog:            { value: this._fogTexture },
            fogColor:        { value: new THREE.Vector3(this._fogColor.r, this._fogColor.g, this._fogColor.b) },
            unexploredAlpha: { value: this._unexploredAlpha },
            exploredAlpha:   { value: this._exploredAlpha }
        },
        vertexShader: [
            'varying vec2 vUv;',
            'void main() {',
            '    vUv = uv;',
            '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'varying vec2 vUv;',
            'uniform sampler2D tFog;',
            'uniform vec3 fogColor;',
            'uniform float unexploredAlpha;',
            'uniform float exploredAlpha;',
            '',
            'void main() {',
            '    vec4 fogSample = texture2D(tFog, vUv);',
            '    float visibility = fogSample.r;',
            '    float explored = fogSample.g;',
            '',
            '    float fogAlpha;',
            '    if (visibility > 0.01) {',
            '        fogAlpha = mix(exploredAlpha, 0.0, visibility);',
            '    } else if (explored > 0.5) {',
            '        fogAlpha = exploredAlpha;',
            '    } else {',
            '        fogAlpha = unexploredAlpha;',
            '    }',
            '',
            '    gl_FragColor = vec4(fogColor, fogAlpha);',
            '}'
        ].join('\n'),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    var geometry = new THREE.PlaneGeometry(totalW, totalH);
    var mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 9990;
    mesh.frustumCulled = false;
    mesh._isFogOfWar = true;  // UIRenderPass에서 숨기기 위한 마커

    this._fogMesh = mesh;
    return mesh;
};

FogOfWar._disposeMesh = function() {
    if (this._fogMesh) {
        if (this._fogMesh.parent) {
            this._fogMesh.parent.remove(this._fogMesh);
        }
        this._fogMesh.geometry.dispose();
        this._fogMesh.material.dispose();
        this._fogMesh = null;
    }
};

FogOfWar._updateMeshPosition = function() {
    if (!this._fogMesh || !this._active) return;

    var totalW = this._mapWidth * 48;
    var totalH = this._mapHeight * 48;

    // 맵 스크롤 오프셋
    var ox = 0, oy = 0;
    if (typeof $gameMap !== 'undefined' && $gameMap) {
        ox = $gameMap.displayX() * 48;
        oy = $gameMap.displayY() * 48;
    }

    this._fogMesh.position.set(totalW / 2 - ox, totalH / 2 - oy, 3.5);
};

FogOfWar._updateMeshUniforms = function() {
    if (!this._fogMesh || !this._active) return;

    var u = this._fogMesh.material.uniforms;
    u.tFog.value = this._fogTexture;
    u.fogColor.value.set(this._fogColor.r, this._fogColor.g, this._fogColor.b);
    u.unexploredAlpha.value = this._unexploredAlpha;
    u.exploredAlpha.value = this._exploredAlpha;
};

//=============================================================================
// PostProcess 후킹 - 3D 메쉬 통합
//=============================================================================

// _updateUniforms에 FOW 업데이트 추가
var _PostProcess_updateUniforms = PostProcess._updateUniforms;
PostProcess._updateUniforms = function() {
    _PostProcess_updateUniforms.call(this);

    if (!FogOfWar._active) return;

    // 메쉬가 아직 생성되지 않았으면 scene에 lazy 추가
    if (!FogOfWar._fogMesh && FogOfWar._fogTexture) {
        var scene = this._renderPass ? this._renderPass.scene : null;
        if (scene) {
            var mesh = FogOfWar._createMesh();
            if (mesh) {
                scene.add(mesh);
            }
        }
    }

    if (FogOfWar._fogMesh) {
        // 플레이어 가시성 갱신
        if (typeof $gamePlayer !== 'undefined' && $gamePlayer) {
            FogOfWar.updateVisibility($gamePlayer.x, $gamePlayer.y);
        }
        FogOfWar._updateMeshPosition();
        FogOfWar._updateMeshUniforms();
    }
};

//=============================================================================
// _applyMapSettings 후킹 - 맵별 FOW 설정 로드
//=============================================================================

var _PostProcess_applyMapSettings = PostProcess._applyMapSettings;
PostProcess._applyMapSettings = function() {
    _PostProcess_applyMapSettings.call(this);

    // 에디터 모드에서는 런타임 FOW를 적용하지 않음 (오버레이 메쉬로 미리보기)
    if (window._editorRuntimeReady) return;

    if (!$dataMap) return;

    var fow = $dataMap.fogOfWar;
    if (fow && fow.enabled) {
        FogOfWar.setup($dataMap.width, $dataMap.height, fow);
        // 메쉬 생성은 _updateUniforms에서 lazy하게 수행 (scene 참조 보장)
    } else {
        FogOfWar.dispose();
    }
};

//=============================================================================
// Plugin Command 지원
//=============================================================================

if (typeof Game_Interpreter !== 'undefined') {
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'FogOfWar') {
            var sub = args[0];
            if (sub === 'Enable') {
                if (!FogOfWar._active && $dataMap) {
                    FogOfWar.setup($dataMap.width, $dataMap.height, $dataMap.fogOfWar || {});
                    // 메쉬 생성은 _updateUniforms에서 lazy하게 수행
                }
            } else if (sub === 'Disable') {
                FogOfWar.dispose();
            } else if (sub === 'Radius') {
                FogOfWar._radius = parseInt(args[1]) || 5;
                FogOfWar._prevPlayerX = -1; // 강제 재계산
            } else if (sub === 'RevealAll') {
                FogOfWar.revealAll();
            } else if (sub === 'HideAll') {
                FogOfWar.hideAll();
            } else if (sub === 'RevealRect') {
                var rx = parseInt(args[1]) || 0;
                var ry = parseInt(args[2]) || 0;
                var rw = parseInt(args[3]) || 1;
                var rh = parseInt(args[4]) || 1;
                FogOfWar.revealRect(rx, ry, rw, rh);
            }
        }
    };
}

})();
