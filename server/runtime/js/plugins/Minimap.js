/*:
 * @plugindesc [v1.1] 미니맵 — FoW, 리전 색상, 커스텀 마커, 2D/3D 지원
 * @author Claude
 *
 * @param showOnStart
 * @text 시작 시 표시
 * @desc 게임 시작(맵 진입) 시 미니맵을 표시할지 여부. false로 하면 숨겨진 상태로 시작하며 플러그인 커맨드로 표시할 수 있습니다.
 * @type boolean
 * @default true
 *
 * @param shape
 * @text 모양
 * @type select
 * @option 원형
 * @value circle
 * @option 사각형
 * @value square
 * @default circle
 *
 * @param size
 * @text 크기 (px)
 * @type number
 * @min 64
 * @max 512
 * @default 160
 *
 * @param margin
 * @text 여백 (px)
 * @type number
 * @min 0
 * @default 10
 *
 * @param opacity
 * @text 불투명도 (0~255)
 * @type number
 * @min 0
 * @max 255
 * @default 210
 *
 * @param rotation
 * @text 회전 모드
 * @type select
 * @option 북쪽 고정
 * @value north_fixed
 * @option 카메라 방향 (3D)
 * @value rotate
 * @default north_fixed
 *
 * @param tileSize
 * @text 타일 크기 (px)
 * @desc 미니맵 상에서 한 타일이 차지하는 픽셀 크기
 * @type number
 * @min 1
 * @max 16
 * @default 4
 *
 * @param viewRadius
 * @text 시야 반경 (타일)
 * @desc FoW 현재 시야 반경. 이 범위 내 타일이 밝게 표시됨.
 * @type number
 * @min 1
 * @default 6
 *
 * @param fowEnabled
 * @text 안개 효과 사용
 * @type boolean
 * @default true
 *
 * @param bgColor
 * @text 배경색
 * @type color
 * @default #1a2030
 *
 * @param wallColor
 * @text 벽 색상
 * @type color
 * @default #445566
 *
 * @param floorColor
 * @text 바닥 색상
 * @type color
 * @default #7799aa
 *
 * @param playerColor
 * @text 플레이어 마커 색상
 * @type color
 * @default #ffffff
 *
 * @param eventMarkerColor
 * @text 이벤트 마커 기본 색상
 * @type color
 * @default #ffcc00
 *
 * @param showEvents
 * @text 이벤트 마커 표시
 * @type boolean
 * @default true
 *
 * @param iconFixedSize
 * @text 아이콘 마커 고정 크기
 * @desc 활성화 시 아이콘 마커가 줌에 관계없이 항상 일정한 크기로 표시됩니다.
 * @type boolean
 * @default true
 *
 * @param regionColors
 * @text 리전별 색상 (JSON)
 * @desc {"리전ID":"색상"} 형식. 리전 ID(1~255)를 색상에 매핑합니다.\n예: {"1":"#ff4444","2":"#44cc44","3":"#4488ff"}\n리전 ID는 에디터 → 그리기 → 리전 탭에서 타일에 지정한 번호입니다.
 * @type json
 * @default {"1":"#ff4444","2":"#44cc44","3":"#4488ff","4":"#ffaa00","5":"#cc44cc"}
 *
 * @param terrainColors
 * @text 지형 태그별 색상 (JSON)
 * @desc {"지형태그":"색상"} 형식. 타일의 지형 태그(0~7)를 색상에 매핑합니다.\n예: {"1":"#226633","2":"#5588aa","3":"#887766"}\n지형 태그는 타일셋 편집기 → 지형 탭에서 각 타일에 부여한 숫자입니다.
 * @type json
 * @default {"1":"#226633","2":"#5588aa","3":"#887766","4":"#aaaaaa","5":"#ffeecc"}
 *
 * @param borderColor
 * @text 테두리 색상
 * @type color
 * @default #aabbcc
 *
 * @param borderWidth
 * @text 테두리 두께 (px)
 * @type number
 * @min 0
 * @max 8
 * @default 2
 *
 * @param showMapName
 * @text 맵 이름 표시
 * @desc 미니맵에 현재 맵 이름을 표시합니다.
 * @type boolean
 * @default true
 *
 * @param mapNameFontSize
 * @text 맵 이름 폰트 크기
 * @type number
 * @min 8
 * @max 32
 * @default 13
 *
 * @param mapNameFont
 * @text 맵 이름 폰트
 * @desc 비워두면 게임 기본 폰트를 사용합니다.
 * @type font
 * @default
 *
 * @param mapNameColor
 * @text 맵 이름 색상
 * @type color
 * @default #ffffff
 *
 * @param mapNamePosition
 * @text 맵 이름 위치
 * @type select
 * @option 아래 (버튼 아래)
 * @value bottom
 * @option 위 (미니맵 위)
 * @value top
 * @default bottom
 *
 * @param resetNameOnTransfer
 * @text 맵 이동 시 커스텀 이름 초기화
 * @desc 맵 이동 시 setMapName으로 지정한 커스텀 이름을 자동 초기화할지 여부.
 * @type boolean
 * @default true
 *
 * @param overlaySceneId
 * @text 오버레이 씬 ID
 * @desc UIEditor에서 만든 오버레이 씬의 ID. show/hide 커맨드가 이 씬을 OVERLAY SHOW/HIDE로 연동합니다.
 * @type string
 * @default minimap_hud
 *
 * @command show
 * @text 미니맵 표시
 * @desc 미니맵을 화면에 표시합니다.
 *
 * @command hide
 * @text 미니맵 숨기기
 * @desc 미니맵을 숨깁니다.
 *
 * @command toggle
 * @text 표시/숨김 전환
 * @desc 미니맵 표시 상태를 토글합니다.
 *
 * @command clearFow
 * @text 안개 초기화
 * @desc 현재 맵의 탐험 안개를 초기화합니다.
 *
 * @command revealAll
 * @text 전체 탐험 처리
 * @desc 현재 맵의 모든 타일을 탐험 상태로 만듭니다.
 *
 * @command shape
 * @text 모양 변경
 * @desc 미니맵의 모양을 변경합니다.
 *
 * @arg value
 * @text 모양
 * @type select
 * @default circle
 *
 * @option 원형
 * @value circle
 *
 * @option 사각형
 * @value square
 *
 * @command rotation
 * @text 회전 모드 변경
 * @desc 미니맵 회전 모드를 변경합니다.
 *
 * @arg value
 * @text 회전 모드
 * @type select
 * @default north_fixed
 *
 * @option 북쪽 고정
 * @value north_fixed
 *
 * @option 카메라 방향 (3D)
 * @value rotate
 *
 * @command tileSize
 * @text 타일 크기 변경
 * @desc 미니맵에서 한 타일이 차지하는 픽셀 크기를 변경합니다.
 *
 * @arg value
 * @text 크기 (px)
 * @type number
 * @min 1
 * @max 16
 * @default 4
 *
 * @command addMarker
 * @text 마커 추가
 * @desc 미니맵에 커스텀 마커를 추가합니다. 같은 ID가 있으면 덮어씁니다.
 *
 * @arg id
 * @text 마커 ID
 * @desc 고유 식별자. 나중에 이 ID로 마커를 삭제할 수 있습니다.
 * @type string
 * @default marker1
 *
 * @arg x
 * @text X 좌표
 * @type number
 * @min 0
 * @default 0
 *
 * @arg y
 * @text Y 좌표
 * @type number
 * @min 0
 * @default 0
 *
 * @arg color
 * @text 색상
 * @desc CSS 색상값. 예: #ff4444, rgba(255,100,0,0.8)
 * @type string
 * @default #ff4444
 *
 * @arg shape
 * @text 모양
 * @type select
 * @default circle
 *
 * @option 원형
 * @value circle
 *
 * @option 사각형
 * @value square
 *
 * @option 다이아몬드
 * @value diamond
 *
 * @command removeMarker
 * @text 마커 삭제
 * @desc ID로 마커를 삭제합니다.
 *
 * @arg id
 * @text 마커 ID
 * @type string
 * @default marker1
 *
 * @command clearMarkers
 * @text 마커 전체 삭제
 * @desc 모든 커스텀 마커를 삭제합니다.
 *
 * @command setMapName
 * @text 맵 이름 변경
 * @desc 미니맵에 표시할 이름을 커스텀으로 설정합니다. resetMapName으로 원래 이름으로 되돌릴 수 있습니다.
 *
 * @arg name
 * @text 이름
 * @type string
 * @default 커스텀 이름
 *
 * @command resetMapName
 * @text 맵 이름 초기화
 * @desc 미니맵 이름을 실제 맵 이름으로 되돌립니다.
 *
 * @help
 * 미니맵을 화면 우측 상단에 표시합니다.
 * 미니맵 하단의 -/+ 버튼으로 확대/축소할 수 있습니다.
 *
 * --- 이벤트 마커 ---
 * 에디터 이벤트 에디터에서 "미니맵" 항목으로 색상·모양을 설정하면
 * $dataMap.minimapData[eventId]에 저장되어 자동으로 표시됩니다.
 *
 * --- 커스텀 마커 (스크립트/커맨드) ---
 * 플러그인 커맨드로 임의 좌표에 마커를 추가할 수 있습니다:
 *   Minimap addMarker npc1 5 10 #ff4444 circle
 *   Minimap addMarker boss 20 15 #ff0000 diamond
 *   Minimap removeMarker npc1
 *   Minimap clearMarkers
 *
 * 커스텀 마커는 세이브 데이터에 저장됩니다.
 */

(function () {
  'use strict';

  const PLUGIN_NAME = 'Minimap';
  const p = PluginManager.parameters(PLUGIN_NAME);

  const CFG = {
    showOnStart:      p['showOnStart'] !== 'false',
    shape:            p['shape'] || 'circle',
    size:             parseInt(p['size']) || 160,
    margin:           parseInt(p['margin']) || 10,
    opacity:          parseInt(p['opacity']) || 210,
    rotation:         p['rotation'] || 'north_fixed',
    tileSize:         parseInt(p['tileSize']) || 4,
    viewRadius:       parseInt(p['viewRadius']) || 6,
    fowEnabled:       p['fowEnabled'] !== 'false',
    bgColor:          p['bgColor'] || '#1a2030',
    wallColor:        p['wallColor'] || '#445566',
    floorColor:       p['floorColor'] || '#7799aa',
    playerColor:      p['playerColor'] || '#ffffff',
    eventMarkerColor: p['eventMarkerColor'] || '#ffcc00',
    showEvents:       p['showEvents'] !== 'false',
    iconFixedSize:    p['iconFixedSize'] !== 'false',
    borderColor:      p['borderColor'] || '#aabbcc',
    borderWidth:      parseInt(p['borderWidth']) || 2,
    overlaySceneId:   p['overlaySceneId'] || 'minimap_hud',
    resetNameOnTransfer: p['resetNameOnTransfer'] !== 'false',
    regionColors:     {},
    terrainColors:    {},
  };

  try { CFG.regionColors  = JSON.parse(p['regionColors']  || '{}'); } catch(e) {}
  try { CFG.terrainColors = JSON.parse(p['terrainColors'] || '{}'); } catch(e) {}

  const N_PAD = 16; // 북쪽 N 표시를 위한 비트맵 여백 (px)

  // ============================================================
  // Game_System — 세이브 데이터
  // ============================================================

  const _Game_System_initialize = Game_System.prototype.initialize;
  Game_System.prototype.initialize = function () {
    _Game_System_initialize.call(this);
    this._minimapFow        = {};
    this._minimapVisible    = CFG.showOnStart;
    this._minimapMarkers    = []; // [{id, x, y, color, shape}]
    this._minimapCustomName = null; // 커스텀 맵 이름 (null이면 실제 맵 이름 사용)
  };

  // ============================================================
  // Game_Player — 이동 시 탐험 처리
  // ============================================================

  const _Game_Player_increaseSteps = Game_Player.prototype.increaseSteps;
  Game_Player.prototype.increaseSteps = function () {
    _Game_Player_increaseSteps.call(this);
    MinimapManager.explore(this.x, this.y);
  };

  const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
  Game_Player.prototype.performTransfer = function () {
    _Game_Player_performTransfer.call(this);
    MinimapManager._pendingExplore = true;
    MinimapManager._lastEventPos   = {};
    if (CFG.resetNameOnTransfer && $gameSystem) {
      $gameSystem._minimapCustomName = null;
    }
    MinimapManager._lastMapId = -1; // 맵 이름 강제 갱신
  };

  // ============================================================
  // Game_Interpreter — 플러그인 커맨드
  // ============================================================

  const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command !== 'Minimap') return;
    const sub = (args[0] || '').toLowerCase();
    switch (sub) {
      case 'show':    MinimapManager.setVisible(true);  break;
      case 'hide':    MinimapManager.setVisible(false); break;
      case 'toggle':  MinimapManager.toggleVisible();   break;
      case 'clearfow':      MinimapManager.clearFow();                                    break;
      case 'revealall':     MinimapManager.revealAll();                                   break;
      case 'shape':         MinimapManager.setShape(args[1]);                             break;
      case 'rotation':      MinimapManager.setRotation(args[1]);                          break;
      case 'tilesize':      MinimapManager.setTileSize(args[1]);                          break;
      case 'addmarker':     MinimapManager.addMarker(args[1], args[2], args[3], args[4], args[5]); break;
      case 'removemarker':  MinimapManager.removeMarker(args[1]);                         break;
      case 'clearmarkers':  MinimapManager.clearMarkers();                                break;
      case 'setmapname':    MinimapManager.setMapName(args.slice(1).join(' '));            break;
      case 'resetmapname':  MinimapManager.resetMapName();                                break;
    }
  };

  // ============================================================
  // Scene_Map
  // ============================================================

  const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
  Scene_Map.prototype.createAllWindows = function () {
    _Scene_Map_createAllWindows.call(this);
    var savedVisible = ($gameSystem ? $gameSystem._minimapVisible : CFG.showOnStart);
    MinimapManager.createSprite(this);
    MinimapManager.setVisible(savedVisible);
  };

  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function () {
    _Scene_Map_update.call(this);
    MinimapManager.update();
  };

  const _Scene_Map_terminate = Scene_Map.prototype.terminate;
  Scene_Map.prototype.terminate = function () {
    _Scene_Map_terminate.call(this);
    MinimapManager.destroySprite();
  };

  // ============================================================
  // MinimapManager
  // ============================================================

  const MinimapManager = {
    _bitmap:         null,
    _scene:          null,
    _dirty:          true,
    _lastPx:         -999,
    _lastPy:         -999,
    _lastYaw:        -999,
    _lastDir:        -999,
    _frameCount:     0,
    _visible:        true,
    _pendingExplore: false,
    _lastEventPos:   {},  // { eventId: 'x,y' }

    UPDATE_INTERVAL: 3,

    // ----------------------------------------------------------
    // 초기화
    // ----------------------------------------------------------
    initialize() {
      const bw = CFG.size + N_PAD * 2;
      if (this._bitmap) this._bitmap.destroy();
      this._bitmap = new Bitmap(bw, bw);
    },

    // ----------------------------------------------------------
    // FoW
    // ----------------------------------------------------------
    _getFowData(mapId, w, h) {
      if (!$gameSystem._minimapFow) $gameSystem._minimapFow = {};
      if (!$gameSystem._minimapFow[mapId]) {
        $gameSystem._minimapFow[mapId] = new Array(w * h).fill(0);
      }
      return $gameSystem._minimapFow[mapId];
    },

    explore(x, y) {
      if (!CFG.fowEnabled || !$gameMap) return;
      const mapId = $gameMap.mapId();
      const w     = $gameMap.width();
      const h     = $gameMap.height();
      const fow   = this._getFowData(mapId, w, h);
      const r2    = CFG.viewRadius * CFG.viewRadius;
      for (let dy = -CFG.viewRadius; dy <= CFG.viewRadius; dy++) {
        for (let dx = -CFG.viewRadius; dx <= CFG.viewRadius; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const nx = $gameMap.isLoopHorizontal()
            ? ((x + dx) % w + w) % w : x + dx;
          const ny = $gameMap.isLoopVertical()
            ? ((y + dy) % h + h) % h : y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            fow[ny * w + nx] = 1;
          }
        }
      }
      this._dirty = true;
    },

    clearFow() {
      if (!$gameMap) return;
      if ($gameSystem._minimapFow) delete $gameSystem._minimapFow[$gameMap.mapId()];
      this._dirty = true;
    },

    revealAll() {
      if (!$gameMap) return;
      const w = $gameMap.width(), h = $gameMap.height();
      this._getFowData($gameMap.mapId(), w, h).fill(1);
      this._dirty = true;
    },

    _isInSight(tx, ty, px, py) {
      const dx = tx - px, dy = ty - py;
      return dx * dx + dy * dy <= CFG.viewRadius * CFG.viewRadius;
    },

    // ----------------------------------------------------------
    // 타일 색상
    // ----------------------------------------------------------
    _getTileColor(x, y) {
      const regionId = $gameMap.regionId(x, y);
      if (regionId > 0) {
        const c = CFG.regionColors[String(regionId)];
        if (c) return c;
      }
      const tag = $gameMap.terrainTag(x, y);
      if (tag > 0) {
        const c = CFG.terrainColors[String(tag)];
        if (c) return c;
      }
      const passable = [2, 4, 6, 8].some(d => $gameMap.isPassable(x, y, d));
      return passable ? CFG.floorColor : CFG.wallColor;
    },

    // ----------------------------------------------------------
    // 이벤트 마커 (EXT: $dataMap.minimapData[eventId])
    // ----------------------------------------------------------
    _getEventMarker(event) {
      if (!event) return null;
      const data = $dataMap && $dataMap.minimapData && $dataMap.minimapData[event.eventId()];
      if (!data || !data.enabled) return null;
      return {
        color: data.color || CFG.eventMarkerColor,
        shape: data.shape || 'circle',
        iconIndex: data.iconIndex,
      };
    },

    // ----------------------------------------------------------
    // 마커 그리기 헬퍼
    // ----------------------------------------------------------
    _drawMarker(ctx, sx, sy, r, color, shape, iconBitmap, iconIndex) {
      // 아이콘 모드: IconSet에서 해당 아이콘을 축소하여 표시
      if (iconIndex !== undefined && iconBitmap && iconBitmap._canvas) {
        const col  = iconIndex % 16;
        const row  = Math.floor(iconIndex / 16);
        // iconFixedSize=true(기본): 줌에 관계없이 항상 16px 고정
        // iconFixedSize=false: tileSize에 비례
        const size = CFG.iconFixedSize ? 16 : r * 2.4;
        ctx.globalAlpha = 1.0;
        ctx.drawImage(iconBitmap._canvas, col * 32, row * 32, 32, 32,
                      sx - size / 2, sy - size / 2, size, size);
        return;
      }

      ctx.globalAlpha = 1.0;
      ctx.fillStyle   = color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth   = 1;

      if (shape === 'square') {
        ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
        ctx.strokeRect(sx - r + 0.5, sy - r + 0.5, r * 2 - 1, r * 2 - 1);
      } else if (shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(sx,     sy - r * 1.3);
        ctx.lineTo(sx + r, sy);
        ctx.lineTo(sx,     sy + r * 1.3);
        ctx.lineTo(sx - r, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (shape === 'star') {
        const outer = r * 1.2;
        const inner = r * 0.48;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const outerAngle = (i * 2 * Math.PI / 5) - Math.PI / 2;
          const innerAngle = outerAngle + Math.PI / 5;
          const ox = sx + outer * Math.cos(outerAngle);
          const oy = sy + outer * Math.sin(outerAngle);
          const ix = sx + inner * Math.cos(innerAngle);
          const iy = sy + inner * Math.sin(innerAngle);
          if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(sx,            sy - r * 1.3);
        ctx.lineTo(sx + r * 1.1,  sy + r * 0.8);
        ctx.lineTo(sx - r * 1.1,  sy + r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (shape === 'cross') {
        const w = r * 0.42;
        ctx.fillRect(sx - w, sy - r, w * 2, r * 2);
        ctx.fillRect(sx - r, sy - w, r * 2, w * 2);
        ctx.strokeRect(sx - r + 0.5, sy - w + 0.5, r * 2 - 1, w * 2 - 1);
        ctx.strokeRect(sx - w + 0.5, sy - r + 0.5, w * 2 - 1, r * 2 - 1);
      } else if (shape === 'heart') {
        const s = r * 0.9;
        ctx.beginPath();
        ctx.moveTo(sx, sy + s * 0.9);
        ctx.bezierCurveTo(sx - s * 1.5, sy + s * 0.1, sx - s * 1.5, sy - s, sx, sy - s * 0.3);
        ctx.bezierCurveTo(sx + s * 1.5, sy - s, sx + s * 1.5, sy + s * 0.1, sx, sy + s * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else { // circle (기본)
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    },

    _getIconBitmap() {
      if (!this._iconBitmap) {
        this._iconBitmap = ImageManager.loadSystem('IconSet');
      }
      return this._iconBitmap;
    },

    // ----------------------------------------------------------
    // 렌더링
    // ----------------------------------------------------------
    _render() {
      if (!$gameMap || !$gamePlayer) return;

      const bitmap = this._bitmap;
      const ctx    = bitmap._context;
      const s      = CFG.size;
      const hs     = s / 2;
      const ts     = CFG.tileSize;
      const mapId  = $gameMap.mapId();
      const mapW   = $gameMap.width();
      const mapH   = $gameMap.height();
      const px     = $gamePlayer.x;
      const py     = $gamePlayer.y;
      const fow    = CFG.fowEnabled ? this._getFowData(mapId, mapW, mapH) : null;

      let yaw = 0;
      if (CFG.rotation === 'rotate' &&
          typeof Mode3D !== 'undefined' && Mode3D._active) {
        yaw = (Mode3D._yawDeg || 0) * Math.PI / 180;
      }

      ctx.clearRect(0, 0, s + N_PAD * 2, s + N_PAD * 2);

      // N_PAD 여백 안쪽을 (0,0) 기준으로 사용
      ctx.save(); // === PAD translate ===
      ctx.translate(N_PAD, N_PAD);

      // ── 클리핑 ───────────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      if (CFG.shape === 'circle') {
        ctx.arc(hs, hs, hs, 0, Math.PI * 2);
      } else {
        ctx.rect(0, 0, s, s);
      }
      ctx.clip();

      ctx.fillStyle = CFG.bgColor;
      ctx.fillRect(0, 0, s, s);

      // ── 회전 변환 ─────────────────────────────────────────────
      ctx.save();
      if (yaw !== 0) {
        ctx.translate(hs, hs);
        ctx.rotate(yaw);
        ctx.translate(-hs, -hs);
      }

      const viewW   = s / ts;
      const viewH   = s / ts;
      const startX  = px - viewW / 2;
      const startY  = py - viewH / 2;
      const iStartX = Math.floor(startX) - 1;
      const iStartY = Math.floor(startY) - 1;
      const iEndX   = Math.ceil(startX + viewW) + 1;
      const iEndY   = Math.ceil(startY + viewH) + 1;

      // ── 타일 ─────────────────────────────────────────────────
      for (let ty = iStartY; ty <= iEndY; ty++) {
        for (let tx = iStartX; tx <= iEndX; tx++) {
          const mx = $gameMap.isLoopHorizontal()
            ? ((tx % mapW) + mapW) % mapW : tx;
          const my = $gameMap.isLoopVertical()
            ? ((ty % mapH) + mapH) % mapH : ty;

          if (!$gameMap.isLoopHorizontal() && (tx < 0 || tx >= mapW)) continue;
          if (!$gameMap.isLoopVertical()   && (ty < 0 || ty >= mapH)) continue;

          const explored = fow ? !!fow[my * mapW + mx] : true;
          if (!explored) continue;

          const inSight = this._isInSight(mx, my, px, py);
          ctx.globalAlpha = inSight ? 1.0 : 0.35;
          ctx.fillStyle   = this._getTileColor(mx, my);
          ctx.fillRect((tx - startX) * ts, (ty - startY) * ts, ts, ts);
        }
      }

      const markerR    = Math.max(2, ts * 0.8);
      const iconBitmap = this._getIconBitmap();

      // ── 이벤트 마커 (EXT: minimapData) ──────────────────────────
      if (CFG.showEvents && $gameMap.events) {
        $gameMap.events().forEach(event => {
          const marker = this._getEventMarker(event);
          if (!marker) return;
          const ex = event.x, ey = event.y;
          const mx = $gameMap.isLoopHorizontal()
            ? ((ex % mapW) + mapW) % mapW : ex;
          const my = $gameMap.isLoopVertical()
            ? ((ey % mapH) + mapH) % mapH : ey;
          if (mx < 0 || mx >= mapW || my < 0 || my >= mapH) return;
          if (fow && !fow[my * mapW + mx]) return;
          this._drawMarker(ctx,
            (ex - startX) * ts + ts * 0.5,
            (ey - startY) * ts + ts * 0.5,
            markerR, marker.color, marker.shape, iconBitmap, marker.iconIndex);
        });
      }

      // ── 커스텀 마커 ───────────────────────────────────────────
      const customMarkers = ($gameSystem._minimapMarkers || []);
      customMarkers.forEach(m => {
        const mx = $gameMap.isLoopHorizontal()
          ? ((m.x % mapW) + mapW) % mapW : m.x;
        const my = $gameMap.isLoopVertical()
          ? ((m.y % mapH) + mapH) % mapH : m.y;
        if (mx < 0 || mx >= mapW || my < 0 || my >= mapH) return;
        if (fow && !fow[my * mapW + mx]) return;
        this._drawMarker(ctx,
          (m.x - startX) * ts + ts * 0.5,
          (m.y - startY) * ts + ts * 0.5,
          markerR, m.color || CFG.eventMarkerColor, m.shape || 'circle');
      });

      // ── 플레이어 마커 (항상 중앙) ─────────────────────────────
      // 화살표 팁이 (0, -r) 즉 ↑ 방향이 기저(0°)이므로,
      // 각 방향을 올바른 화면 방향으로 돌리려면 +π/2가 필요
      const DIR_ANGLE  = {2: Math.PI, 4: -Math.PI / 2, 6: Math.PI / 2, 8: 0};
      const arrowAngle = (DIR_ANGLE[$gamePlayer.direction()] || 0);
      const ar         = Math.max(3, ts);

      ctx.save();
      ctx.translate(hs, hs);
      ctx.rotate(arrowAngle);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle   = CFG.playerColor;
      ctx.beginPath();
      ctx.moveTo(0,          -ar * 2.2);
      ctx.lineTo(ar * 0.9,   ar * 0.5);
      ctx.lineTo(0,          0);
      ctx.lineTo(-ar * 0.9,  ar * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.restore();

      ctx.restore(); // 회전 취소
      ctx.restore(); // 클리핑 취소

      // ── 테두리 ────────────────────────────────────────────────
      if (CFG.borderWidth > 0) {
        ctx.strokeStyle = CFG.borderColor;
        ctx.lineWidth   = CFG.borderWidth;
        ctx.globalAlpha = 0.85;
        if (CFG.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(hs, hs, hs - CFG.borderWidth / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const hw = CFG.borderWidth / 2;
          ctx.strokeRect(hw, hw, s - CFG.borderWidth, s - CFG.borderWidth);
        }
      }

      // ── 북쪽 N 표시 (회전 모드) ──────────────────────────────
      if (CFG.rotation === 'rotate') {
        this._drawNorthIndicator(ctx, s, hs, yaw);
      }

      ctx.restore(); // === undo PAD translate ===

      bitmap._dirty = true;
      if (bitmap._baseTexture) bitmap._baseTexture.update();
    },

    // ----------------------------------------------------------
    // 북쪽 N 표시 (회전 모드 전용)
    // ----------------------------------------------------------
    _drawNorthIndicator(ctx, s, hs, yaw) {
      const sinY = Math.sin(yaw);
      const cosY = Math.cos(yaw);

      // ctx.rotate(yaw) 후 (0,-r) 점은 화면에서 (+sinY, -cosY) 방향에 나타남
      let nx, ny;
      if (CFG.shape === 'circle') {
        nx = hs + hs * sinY;
        ny = hs - hs * cosY;
      } else {
        // 사각형 테두리: 중심 → +sinY/-cosY 방향 ray cast
        const dx = sinY, dy = -cosY;
        let t = Infinity;
        if (Math.abs(dx) > 1e-6) t = Math.min(t, (dx > 0 ? (s - hs) : hs) / Math.abs(dx));
        if (Math.abs(dy) > 1e-6) t = Math.min(t, (dy > 0 ? (s - hs) : hs) / Math.abs(dy));
        nx = hs + t * dx;
        ny = hs + t * dy;
      }

      ctx.save();
      ctx.globalAlpha  = 1.0;
      ctx.font         = 'bold 15px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      // 검정 윤곽선으로 가독성 확보
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth   = 4;
      ctx.lineJoin    = 'round';
      ctx.strokeText('N', nx, ny);

      // 빨간 본문
      ctx.fillStyle = '#ff5555';
      ctx.fillText('N', nx, ny);

      ctx.restore();
    },

    // ----------------------------------------------------------
    // 초기화 (맵 진입 시) — 비트맵 생성만 담당, 스프라이트는 Widget_Minimap이 처리
    // ----------------------------------------------------------
    createSprite(scene) {
      this._scene = scene;
      this.initialize();
      this._dirty = true;
      if ($gamePlayer) this.explore($gamePlayer.x, $gamePlayer.y);
    },

    // ----------------------------------------------------------
    // 해제
    // ----------------------------------------------------------
    destroySprite() {
      this._scene = null;
      if (this._bitmap) { this._bitmap.destroy(); this._bitmap = null; }
    },

    // ----------------------------------------------------------
    // 매 프레임 갱신
    // ----------------------------------------------------------
    update() {
      if (!this._bitmap || !$gamePlayer) return;

      if (this._pendingExplore) {
        this._pendingExplore = false;
        this.explore($gamePlayer.x, $gamePlayer.y);
        this._dirty = true;
      }

      this._frameCount++;
      if (this._frameCount < this.UPDATE_INTERVAL) return;
      this._frameCount = 0;

      const px  = $gamePlayer.x;
      const py  = $gamePlayer.y;
      const dir = $gamePlayer.direction();
      const yaw = (CFG.rotation === 'rotate' &&
                   typeof Mode3D !== 'undefined' && Mode3D._active)
        ? Math.round(Mode3D._yawDeg || 0) : 0;

      // 이벤트 위치 변화 감지
      if (CFG.showEvents && $gameMap && $gameMap.events) {
        const evs = $gameMap.events();
        for (let i = 0; i < evs.length; i++) {
          const ev = evs[i];
          if (!ev) continue;
          const key = ev.eventId();
          const pos = ev.x + ',' + ev.y;
          if (this._lastEventPos[key] !== pos) {
            this._lastEventPos[key] = pos;
            this._dirty = true;
          }
        }
      }

      if (px  !== this._lastPx  || py  !== this._lastPy  ||
          dir !== this._lastDir || yaw !== this._lastYaw  ||
          this._dirty) {
        this._lastPx  = px;
        this._lastPy  = py;
        this._lastDir = dir;
        this._lastYaw = yaw;
        this._dirty   = false;
        this._render();
      }
    },

    // ----------------------------------------------------------
    // 표시/숨김
    // ----------------------------------------------------------
    setVisible(visible) {
      this._visible = visible;
      if ($gameSystem) $gameSystem._minimapVisible = visible;
      if (visible) {
        this._dirty = true;
        this._frameCount = this.UPDATE_INTERVAL;
        if ($gameMap && $gamePlayer) this._render();
      }
      // 오버레이 씬 연동
      if (typeof OverlayManager !== 'undefined') {
        if (visible) OverlayManager.show(CFG.overlaySceneId);
        else OverlayManager.hide(CFG.overlaySceneId);
      }
    },

    toggleVisible() {
      this.setVisible(!this._visible);
    },

    // ----------------------------------------------------------
    // 설정 변경
    // ----------------------------------------------------------
    setShape(shape) {
      if (shape !== 'circle' && shape !== 'square') return;
      CFG.shape = shape;
      this._dirty = true;
    },

    setRotation(mode) {
      if (mode !== 'north_fixed' && mode !== 'rotate') return;
      CFG.rotation = mode;
      this._dirty = true;
    },

    setTileSize(val) {
      const n = parseInt(val);
      if (!n || n < 1 || n > 16) return;
      CFG.tileSize = n;
      this._dirty  = true;
    },

    // ----------------------------------------------------------
    // 커스텀 마커
    // ----------------------------------------------------------
    addMarker(id, x, y, color, shape) {
      if (!id) return;
      if (!$gameSystem._minimapMarkers) $gameSystem._minimapMarkers = [];
      // 같은 ID 덮어쓰기
      $gameSystem._minimapMarkers = $gameSystem._minimapMarkers.filter(m => m.id !== id);
      $gameSystem._minimapMarkers.push({
        id,
        x:     parseInt(x)  || 0,
        y:     parseInt(y)  || 0,
        color: color        || CFG.eventMarkerColor,
        shape: shape        || 'circle',
      });
      this._dirty = true;
    },

    removeMarker(id) {
      if (!id || !$gameSystem._minimapMarkers) return;
      $gameSystem._minimapMarkers = $gameSystem._minimapMarkers.filter(m => m.id !== id);
      this._dirty = true;
    },

    clearMarkers() {
      if ($gameSystem) $gameSystem._minimapMarkers = [];
      this._dirty = true;
    },

    // ----------------------------------------------------------
    // 맵 이름
    // ----------------------------------------------------------
    getMapName() {
      if ($gameSystem && $gameSystem._minimapCustomName != null) {
        return $gameSystem._minimapCustomName;
      }
      if (!$gameMap) return '';
      const info = $dataMapInfos && $dataMapInfos[$gameMap.mapId()];
      return info ? (info.name || '') : '';
    },

    setMapName(name) {
      if ($gameSystem) $gameSystem._minimapCustomName = (name || null);
    },

    resetMapName() {
      if ($gameSystem) $gameSystem._minimapCustomName = null;
    },

    // ----------------------------------------------------------
    // 확대/축소 공개 API (Button 위젯 등에서 호출)
    // ----------------------------------------------------------
    zoomIn() {
      this.setTileSize(CFG.tileSize + 1);
    },

    zoomOut() {
      this.setTileSize(CFG.tileSize - 1);
    },
  };

  window.MinimapManager = MinimapManager;

  // ============================================================
  // Widget_Minimap — CustomSceneEngine 위젯 레지스트리에 등록
  // ============================================================

  function Widget_Minimap() {}

  // Widget_Base 상속 (CustomSceneEngine이 먼저 로드되어야 함)
  Widget_Minimap.prototype = Object.create((window.Widget_Base || Object).prototype);
  Widget_Minimap.prototype.constructor = Widget_Minimap;

  Widget_Minimap.prototype.initialize = function (def, parentWidget) {
    if (window.Widget_Base) window.Widget_Base.prototype.initialize.call(this, def, parentWidget);
    else {
      this._def = def || {};
      this._id = def ? def.id : '';
      this._x = def ? (def.x || 0) : 0;
      this._y = def ? (def.y || 0) : 0;
      this._width  = def ? (def.width  || 192) : 192;
      this._height = def ? (def.height || 192) : 192;
      this._visible = true;
      this._children = [];
    }

    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    this._displayObject = sprite;
    this._minimapSprite = sprite;
  };

  Widget_Minimap.prototype.displayObject = function () {
    return this._displayObject;
  };

  Widget_Minimap.prototype.update = function () {
    // MinimapManager가 렌더링한 최신 비트맵을 스프라이트에 연결
    if (this._minimapSprite && typeof MinimapManager !== 'undefined' && MinimapManager._bitmap) {
      this._minimapSprite.bitmap = MinimapManager._bitmap;
    }
  };

  Widget_Minimap.prototype.refresh = function () {};

  Widget_Minimap.prototype.collectFocusable = function () {};

  // CustomSceneEngine에 등록 (엔진이 로드된 경우)
  if (window.__customSceneEngine && window.__customSceneEngine.registerWidget) {
    window.__customSceneEngine.registerWidget('minimap', Widget_Minimap);
  }

})();
