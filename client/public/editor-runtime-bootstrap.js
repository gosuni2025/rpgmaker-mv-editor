//=============================================================================
// editor-runtime-bootstrap.js
// 에디터에서 게임 런타임을 사용하기 위한 글로벌 스텁 설정
// index.html에서 런타임 JS 로드 전에 실행되어야 함
//=============================================================================

// --- Point class (rpg_core.js Tilemap에서 사용) ---
if (typeof Point === 'undefined') {
    function Point(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
    Point.prototype.constructor = Point;
    window.Point = Point;
}

// --- Number.prototype.mod (rpg_core.js Tilemap._readMapData에서 사용) ---
if (!Number.prototype.mod) {
    Number.prototype.mod = function(n) {
        return ((this % n) + n) % n;
    };
}

// --- Graphics stub ---
window.Graphics = window.Graphics || {
    width: 816,
    height: 624,
    _renderer: null,
    _canvas: null,
    boxWidth: 816,
    boxHeight: 624,
};

// --- ConfigManager stub ---
window.ConfigManager = window.ConfigManager || {
    mode3d: false,
    shadowLight: false,
};

// --- PluginManager stub ---
window.PluginManager = window.PluginManager || {
    _scripts: [],
    _parameters: {},
    parameters: function(name) {
        return this._parameters[name] || {};
    },
    setup: function() {},
};

// --- ImageManager stub ---
window.ImageManager = window.ImageManager || {
    loadTileset: function() { return null; },
    loadCharacter: function() { return null; },
    loadSystem: function() { return null; },
};

// --- SceneManager stub ---
window.SceneManager = window.SceneManager || {
    _scene: null,
    _stopped: true,
};

// --- SoundManager stub ---
window.SoundManager = window.SoundManager || {
    playSystemSound: function() {},
};

// --- $gameMap stub (에디터에서 동적으로 교체) ---
window.$gameMap = window.$gameMap || {
    width: function() { return 0; },
    height: function() { return 0; },
    data: function() { return []; },
    tilesetId: function() { return 1; },
    isLoopHorizontal: function() { return false; },
    isLoopVertical: function() { return false; },
    tileEvents: function() { return []; },
    events: function() { return []; },
    displayX: function() { return 0; },
    displayY: function() { return 0; },
    parallaxOx: function() { return 0; },
    parallaxOy: function() { return 0; },
    screenTileX: function() { return 17; },
    screenTileY: function() { return 13; },
};

// --- $gamePlayer stub ---
window.$gamePlayer = window.$gamePlayer || {
    x: 0,
    y: 0,
    scrolledX: function() { return 0; },
    scrolledY: function() { return 0; },
    screenX: function() { return 0; },
    screenY: function() { return 0; },
    characterName: function() { return ''; },
    characterIndex: function() { return 0; },
};

// --- $dataMap stub ---
window.$dataMap = window.$dataMap || null;

// --- $dataTilesets stub ---
window.$dataTilesets = window.$dataTilesets || [];

// --- $dataSystem stub ---
window.$dataSystem = window.$dataSystem || {
    boat: { characterName: '', characterIndex: 0 },
    ship: { characterName: '', characterIndex: 0 },
    airship: { characterName: '', characterIndex: 0 },
};

// --- $gameSystem stub ---
window.$gameSystem = window.$gameSystem || {
    isSideView: function() { return false; },
};

// --- Bitmap stub (rpg_core.js에서 사용, 최소한의 호환) ---
if (typeof Bitmap === 'undefined') {
    function Bitmap(width, height) {
        this._canvas = document.createElement('canvas');
        this._canvas.width = Math.max(width || 0, 1);
        this._canvas.height = Math.max(height || 0, 1);
        this._context = this._canvas.getContext('2d');
        this._baseTexture = null;
        this._image = null;
        this._url = '';
        this._paintOpacity = 255;
        this._smooth = false;
        this._loadListeners = [];
        this._loadingState = 'none';
        this._decodeAfterRequest = false;
        this._dirty = false;
        this.fontFace = 'GameFont';
        this.fontSize = 28;
        this.fontItalic = false;
        this.textColor = '#ffffff';
        this.outlineColor = 'rgba(0, 0, 0, 0.5)';
        this.outlineWidth = 4;
        this.cacheEntry = null;
    }
    Bitmap.prototype.constructor = Bitmap;

    Object.defineProperty(Bitmap.prototype, 'width', {
        get: function() { return this._canvas ? this._canvas.width : 0; },
        configurable: true
    });
    Object.defineProperty(Bitmap.prototype, 'height', {
        get: function() { return this._canvas ? this._canvas.height : 0; },
        configurable: true
    });

    Bitmap.prototype.isReady = function() {
        return this._loadingState === 'loaded' || this._loadingState === 'none';
    };
    Bitmap.prototype.isError = function() {
        return this._loadingState === 'error';
    };
    Bitmap.prototype.touch = function() {};
    Bitmap.prototype.checkDirty = function() {
        if (this._dirty) {
            this._dirty = false;
            if (this._baseTexture && this._baseTexture.update) {
                this._baseTexture.update();
            }
        }
    };
    Bitmap.prototype.addLoadListener = function(listener) {
        if (this.isReady()) {
            listener(this);
        } else {
            this._loadListeners.push(listener);
        }
    };
    Bitmap.prototype._callLoadListeners = function() {
        while (this._loadListeners.length > 0) {
            var listener = this._loadListeners.shift();
            listener(this);
        }
    };

    window.Bitmap = Bitmap;
}

// --- Window_Options stub (Mode3D.js, ShadowAndLight.js에서 프로토타입 확장) ---
if (typeof Window_Options === 'undefined') {
    function Window_Options() {}
    Window_Options.prototype.addGeneralOptions = function() {};
    Window_Options.prototype.addCommand = function() {};
    Window_Options.prototype.statusText = function() { return ''; };
    Window_Options.prototype.processOk = function() {};
    Window_Options.prototype.cursorRight = function() {};
    Window_Options.prototype.cursorLeft = function() {};
    Window_Options.prototype.setConfigValue = function(symbol, value) { ConfigManager[symbol] = value; };
    window.Window_Options = Window_Options;
}

// --- Window_Base stub ---
if (typeof Window_Base === 'undefined') {
    function Window_Base() {}
    window.Window_Base = Window_Base;
}

// --- Scene_Map stub (Mode3D.js에서 참조) ---
if (typeof Scene_Map === 'undefined') {
    function Scene_Map() {}
    Scene_Map.prototype.createSpriteset = function() {};
    Scene_Map.prototype.updateMain = function() {};
    window.Scene_Map = Scene_Map;
}

// --- Spriteset_Map stub (Mode3D.js에서 참조) ---
if (typeof Spriteset_Map === 'undefined') {
    function Spriteset_Map() {}
    Spriteset_Map.prototype.createTilemap = function() {};
    Spriteset_Map.prototype.loadTileset = function() {};
    Spriteset_Map.prototype.updateTilemap = function() {};
    window.Spriteset_Map = Spriteset_Map;
}

// --- Sprite_Character stub ---
if (typeof Sprite_Character === 'undefined') {
    function Sprite_Character() {}
    window.Sprite_Character = Sprite_Character;
}

// --- Game_Interpreter stub (ShadowAndLight.js에서 pluginCommand 확장) ---
if (typeof Game_Interpreter === 'undefined') {
    function Game_Interpreter() {}
    Game_Interpreter.prototype.pluginCommand = function() {};
    window.Game_Interpreter = Game_Interpreter;
}

// --- Game_Map stub class ---
if (typeof Game_Map === 'undefined') {
    function Game_Map() {}
    Game_Map.prototype.canvasToMapX = function(x) { return Math.floor(x / 48); };
    Game_Map.prototype.canvasToMapY = function(y) { return Math.floor(y / 48); };
    window.Game_Map = Game_Map;
}

// 런타임 로드 완료 플래그
window._editorRuntimeReady = false;

// --- Three.js ShaderChunk 글로벌 패치: Y-flip 라이팅 수정 ---
// Y-flip(m[5]=-m[5])으로 인해 gl_FrontFacing이 반전 → DOUBLE_SIDED에서
// faceDirection=-1 → 노멀이 뒤집혀 빛 방향이 거꾸로 되는 문제 수정.
//
// 해결: normal_fragment_begin에서 faceDirection을 항상 1.0으로 강제.
// 우리 엔진은 이미 geometry 노멀을 Z=-1로 수동 설정하여 y-flip에 대응하므로
// gl_FrontFacing 기반 뒤집기가 필요 없음 (오히려 이중 반전이 됨).
if (typeof THREE !== 'undefined' && THREE.ShaderChunk) {
    // 1) normal_fragment_begin: faceDirection을 항상 1.0으로 강제
    var normalChunkKey = 'normal_fragment_begin';
    if (THREE.ShaderChunk[normalChunkKey]) {
        var normalOrig = 'float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;';
        var normalPatch = 'float faceDirection = 1.0;';
        if (THREE.ShaderChunk[normalChunkKey].indexOf(normalOrig) >= 0) {
            THREE.ShaderChunk[normalChunkKey] = THREE.ShaderChunk[normalChunkKey].replace(normalOrig, normalPatch);
            console.log('[Editor] ShaderChunk patched: normal_fragment_begin (faceDirection=1.0)');
        }
    }
    // 2) Lambert vertex shader: vLightBack을 vLightFront와 동일하게
    //    (fragment에서 gl_FrontFacing으로 vLightBack을 선택하더라도 동일한 값)
    var lambertChunkKey = 'lights_lambert_vertex';
    if (THREE.ShaderChunk[lambertChunkKey]) {
        var lambOriginal = 'vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;';
        var lambPatched = 'vLightBack += saturate( dotNL ) * directLightColor_Diffuse;';
        var chunk = THREE.ShaderChunk[lambertChunkKey];
        while (chunk.indexOf(lambOriginal) >= 0) {
            chunk = chunk.replace(lambOriginal, lambPatched);
        }
        if (chunk !== THREE.ShaderChunk[lambertChunkKey]) {
            THREE.ShaderChunk[lambertChunkKey] = chunk;
            console.log('[Editor] ShaderChunk patched: lights_lambert_vertex (bilateral)');
        }
    }
    // 3) Lambert fragment: gl_FrontFacing 선택도 항상 Front를 사용하도록
    var lambFragKey = 'meshlambert_frag';
    if (THREE.ShaderChunk[lambFragKey]) {
        // Direct diffuse
        var lfOrig1 = 'reflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;';
        var lfPatch1 = 'reflectedLight.directDiffuse = vLightFront;';
        // Indirect diffuse
        var lfOrig2 = 'reflectedLight.indirectDiffuse += ( gl_FrontFacing ) ? vIndirectFront : vIndirectBack;';
        var lfPatch2 = 'reflectedLight.indirectDiffuse += vIndirectFront;';
        var lfChunk = THREE.ShaderChunk[lambFragKey];
        if (lfChunk.indexOf(lfOrig1) >= 0 || lfChunk.indexOf(lfOrig2) >= 0) {
            lfChunk = lfChunk.replace(lfOrig1, lfPatch1).replace(lfOrig2, lfPatch2);
            THREE.ShaderChunk[lambFragKey] = lfChunk;
            console.log('[Editor] ShaderChunk patched: meshlambert_frag (bypass gl_FrontFacing)');
        }
    }
}

console.log('[Editor] Runtime bootstrap globals initialized');
