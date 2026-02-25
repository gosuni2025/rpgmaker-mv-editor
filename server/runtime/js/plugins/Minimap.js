/*:
 * @plugindesc [v1.0] 미니맵 — FoW, 리전 색상, 2D/3D 지원
 * @author Claude
 *
 * @param enabled
 * @text 활성화
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
 * @type string
 * @default #1a2030
 *
 * @param wallColor
 * @text 벽 색상
 * @type string
 * @default #445566
 *
 * @param floorColor
 * @text 바닥 색상
 * @type string
 * @default #7799aa
 *
 * @param playerColor
 * @text 플레이어 마커 색상
 * @type string
 * @default #ffffff
 *
 * @param eventMarkerColor
 * @text 이벤트 마커 기본 색상
 * @type string
 * @default #ffcc00
 *
 * @param showEvents
 * @text 이벤트 마커 표시
 * @type boolean
 * @default true
 *
 * @param regionColors
 * @text 리전별 색상 (JSON)
 * @desc {"리전ID":"색상"} 형식. 예: {"1":"#ff4444","2":"#44ff44","3":"#4444ff"}
 * @type string
 * @default {}
 *
 * @param terrainColors
 * @text 지형 태그별 색상 (JSON)
 * @desc {"지형태그":"색상"} 형식. 예: {"1":"#226633","2":"#334488"}
 * @type string
 * @default {}
 *
 * @param borderColor
 * @text 테두리 색상
 * @type string
 * @default #aabbcc
 *
 * @param borderWidth
 * @text 테두리 두께 (px)
 * @type number
 * @min 0
 * @max 8
 * @default 2
 *
 * @help
 * 미니맵을 화면 우측 상단에 표시합니다.
 *
 * --- 이벤트 마커 ---
 * 이벤트 노트란에 다음 태그를 입력하면 미니맵에 마커가 표시됩니다:
 *   <minimap>           기본 마커 색상으로 표시
 *   <minimap:#ff4444>   지정한 색상으로 표시
 *
 * --- 플러그인 커맨드 ---
 *   Minimap show        미니맵 표시
 *   Minimap hide        미니맵 숨기기
 *   Minimap toggle      미니맵 토글
 *   Minimap clearFow    현재 맵 안개 초기화
 *   Minimap revealAll   현재 맵 전체 탐험 처리
 */

(function () {
  'use strict';

  const PLUGIN_NAME = 'Minimap';
  const p = PluginManager.parameters(PLUGIN_NAME);

  const CFG = {
    enabled:          p['enabled'] !== 'false',
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
    borderColor:      p['borderColor'] || '#aabbcc',
    borderWidth:      parseInt(p['borderWidth']) || 2,
    regionColors:     {},
    terrainColors:    {},
  };

  try { CFG.regionColors  = JSON.parse(p['regionColors']  || '{}'); } catch(e) {}
  try { CFG.terrainColors = JSON.parse(p['terrainColors'] || '{}'); } catch(e) {}

  // 회전 시 코너 잘림 방지: 대각선 길이로 캔버스 확보
  const DIAG_SIZE = Math.ceil(CFG.size * Math.SQRT2);
  const HALF_DIAG = DIAG_SIZE / 2;
  const HALF_SIZE = CFG.size / 2;
  // 캔버스 중심 → 마스크 중심 오프셋 (양수이면 캔버스가 더 크므로 바깥쪽)
  const CANVAS_OFFSET = (DIAG_SIZE - CFG.size) / 2;

  // ============================================================
  // Game_System — FoW 데이터 세이브/로드
  // ============================================================

  const _Game_System_initialize = Game_System.prototype.initialize;
  Game_System.prototype.initialize = function () {
    _Game_System_initialize.call(this);
    this._minimapFow     = {};  // { mapId: Array }
    this._minimapVisible = CFG.enabled;
  };

  // ============================================================
  // Game_Player — 이동 시 탐험 처리
  // ============================================================

  const _Game_Player_increaseSteps = Game_Player.prototype.increaseSteps;
  Game_Player.prototype.increaseSteps = function () {
    _Game_Player_increaseSteps.call(this);
    MinimapManager.explore(this.x, this.y);
  };

  // 맵 이동 후 초기 탐험
  const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
  Game_Player.prototype.performTransfer = function () {
    _Game_Player_performTransfer.call(this);
    // performTransfer가 완료된 다음 프레임에 탐험 (맵 로드 후)
    MinimapManager._pendingExplore = true;
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
      case 'show':      MinimapManager.setVisible(true);  break;
      case 'hide':      MinimapManager.setVisible(false); break;
      case 'toggle':    MinimapManager.toggleVisible();   break;
      case 'clearfow':  MinimapManager.clearFow();        break;
      case 'revealall': MinimapManager.revealAll();       break;
    }
  };

  // ============================================================
  // Scene_Map — 미니맵 스프라이트 생성/갱신/해제
  // ============================================================

  const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
  Scene_Map.prototype.createAllWindows = function () {
    _Scene_Map_createAllWindows.call(this);
    if ($gameSystem._minimapVisible !== false) {
      MinimapManager.createSprite(this);
    }
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
    _canvas:       null,
    _ctx:          null,
    _baseTexture:  null,
    _texture:      null,
    _sprite:       null,
    _maskGraphics: null,
    _scene:        null,
    _dirty:        true,
    _lastPx:       -999,
    _lastPy:       -999,
    _lastYaw:      -999,
    _lastDir:      -999,
    _frameCount:   0,
    _visible:      true,
    _pendingExplore: false,

    UPDATE_INTERVAL: 3, // N 프레임마다 갱신

    // ----------------------------------------------------------
    // 초기화
    // ----------------------------------------------------------
    initialize() {
      this._canvas = document.createElement('canvas');
      this._canvas.width  = DIAG_SIZE;
      this._canvas.height = DIAG_SIZE;
      this._ctx = this._canvas.getContext('2d');
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
      const w = $gameMap.width();
      const h = $gameMap.height();
      const fow = this._getFowData(mapId, w, h);
      const r  = CFG.viewRadius;
      const r2 = r * r;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const nx = $gameMap.isLoopHorizontal() ? ((x + dx) % w + w) % w : x + dx;
          const ny = $gameMap.isLoopVertical()   ? ((y + dy) % h + h) % h : y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            fow[ny * w + nx] = 1;
          }
        }
      }
      this._dirty = true;
    },

    clearFow() {
      if (!$gameMap) return;
      const mapId = $gameMap.mapId();
      if ($gameSystem._minimapFow) delete $gameSystem._minimapFow[mapId];
      this._dirty = true;
    },

    revealAll() {
      if (!$gameMap) return;
      const mapId = $gameMap.mapId();
      const w = $gameMap.width();
      const h = $gameMap.height();
      const fow = this._getFowData(mapId, w, h);
      fow.fill(1);
      this._dirty = true;
    },

    _isInSight(tx, ty, px, py) {
      const dx = tx - px;
      const dy = ty - py;
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
      // 통행 가능 여부로 벽/바닥 구분 (4방향 모두 막혀 있으면 벽)
      const passable = [2, 4, 6, 8].some(d => $gameMap.isPassable(x, y, d));
      return passable ? CFG.floorColor : CFG.wallColor;
    },

    // ----------------------------------------------------------
    // 이벤트 마커 색상 (노트 태그 기반)
    // ----------------------------------------------------------
    _getEventMarkerColor(event) {
      if (!event || !event.event()) return null;
      const meta = event.event().meta;
      if (!meta || meta.minimap === undefined) return null;
      // <minimap> → 기본색, <minimap:#rrggbb> → 지정 색상
      const val = String(meta.minimap).trim();
      return val === 'true' || val === '' ? CFG.eventMarkerColor : val;
    },

    // ----------------------------------------------------------
    // 렌더링
    // ----------------------------------------------------------
    _render() {
      if (!$gameMap || !$gamePlayer) return;

      const ctx     = this._ctx;
      const mapId   = $gameMap.mapId();
      const mapW    = $gameMap.width();
      const mapH    = $gameMap.height();
      const px      = $gamePlayer.x;
      const py      = $gamePlayer.y;
      const ts      = CFG.tileSize;
      const fow     = CFG.fowEnabled ? this._getFowData(mapId, mapW, mapH) : null;

      // 카메라 yaw (rotate 모드 + 3D 모드 활성 시)
      let yaw = 0;
      if (CFG.rotation === 'rotate' &&
          typeof Mode3D !== 'undefined' && Mode3D._active) {
        yaw = (Mode3D._yawDeg || 0) * Math.PI / 180;
      }

      ctx.clearRect(0, 0, DIAG_SIZE, DIAG_SIZE);

      // ── 배경 ──────────────────────────────────────────────
      ctx.fillStyle = CFG.bgColor;
      ctx.fillRect(0, 0, DIAG_SIZE, DIAG_SIZE);

      // ── 회전 컨텍스트 시작 ─────────────────────────────────
      ctx.save();
      ctx.translate(HALF_DIAG, HALF_DIAG);
      ctx.rotate(yaw);
      ctx.translate(-HALF_DIAG, -HALF_DIAG);

      // 뷰포트: 플레이어 중심
      const viewW = DIAG_SIZE / ts;
      const viewH = DIAG_SIZE / ts;
      const startX = px - viewW / 2;
      const startY = py - viewH / 2;
      const startXI = Math.floor(startX) - 1;
      const startYI = Math.floor(startY) - 1;
      const endXI   = Math.ceil(startX + viewW) + 1;
      const endYI   = Math.ceil(startY + viewH) + 1;

      // ── 타일 ─────────────────────────────────────────────
      for (let ty = startYI; ty <= endYI; ty++) {
        for (let tx = startXI; tx <= endXI; tx++) {
          // 루프 맵 좌표 변환
          const mx = $gameMap.isLoopHorizontal()
            ? ((tx % mapW) + mapW) % mapW : tx;
          const my = $gameMap.isLoopVertical()
            ? ((ty % mapH) + mapH) % mapH : ty;

          // 맵 범위 밖
          if (!$gameMap.isLoopHorizontal() && (tx < 0 || tx >= mapW)) continue;
          if (!$gameMap.isLoopVertical()   && (ty < 0 || ty >= mapH)) continue;

          const idx      = my * mapW + mx;
          const explored = fow ? !!fow[idx] : true;
          if (!explored) continue;

          const inSight  = this._isInSight(mx, my, px, py);
          const color    = this._getTileColor(mx, my);

          ctx.globalAlpha = inSight ? 1.0 : 0.35;
          ctx.fillStyle   = color;

          const sx = (tx - startX) * ts;
          const sy = (ty - startY) * ts;
          ctx.fillRect(sx, sy, ts, ts);
        }
      }

      // ── 이벤트 마커 ────────────────────────────────────────
      if (CFG.showEvents && $gameMap.events) {
        const markerR = Math.max(2, ts * 0.8);
        $gameMap.events().forEach(event => {
          const color = this._getEventMarkerColor(event);
          if (!color) return;

          const ex = event.x;
          const ey = event.y;
          // FoW 체크 (실제 맵 좌표로)
          const mx = $gameMap.isLoopHorizontal()
            ? ((ex % mapW) + mapW) % mapW : ex;
          const my = $gameMap.isLoopVertical()
            ? ((ey % mapH) + mapH) % mapH : ey;
          if (mx < 0 || mx >= mapW || my < 0 || my >= mapH) return;
          if (fow && !fow[my * mapW + mx]) return;

          const sx = (ex - startX) * ts + ts * 0.5;
          const sy = (ey - startY) * ts + ts * 0.5;
          ctx.globalAlpha = 1.0;
          ctx.fillStyle   = color;
          ctx.beginPath();
          ctx.arc(sx, sy, markerR, 0, Math.PI * 2);
          ctx.fill();
          // 테두리
          ctx.strokeStyle = '#000000';
          ctx.lineWidth   = 1;
          ctx.stroke();
        });
      }

      // ── 플레이어 마커 ─────────────────────────────────────
      // 항상 캔버스 중앙에 고정
      const playerR = Math.max(3, ts * 1.0);

      // 방향 화살표 (플레이어 이동 방향)
      // direction: 2=남, 4=서, 6=동, 8=북
      // 화살표 각도 (화면 좌표계 기준: 위=북)
      const dirAngle = {2: Math.PI / 2, 4: Math.PI, 6: 0, 8: -Math.PI / 2};
      // rotate 모드에서는 캔버스 자체가 yaw 회전됐으므로 역보정 필요
      const arrowAngle = (dirAngle[$gamePlayer.direction()] || 0) - yaw;

      ctx.save();
      ctx.translate(HALF_DIAG, HALF_DIAG);
      ctx.rotate(arrowAngle);

      // 화살표 본체
      ctx.globalAlpha = 1.0;
      ctx.fillStyle   = CFG.playerColor;
      const aw = playerR * 0.9;
      const ah = playerR * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -ah);         // 앞 뾰족점
      ctx.lineTo(aw, ah * 0.4);   // 오른쪽
      ctx.lineTo(0, ah * 0.0);    // 뒤 중앙
      ctx.lineTo(-aw, ah * 0.4);  // 왼쪽
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.restore();

      // ── 회전 컨텍스트 종료 ─────────────────────────────────
      ctx.restore();

      // ── 테두리 (회전 없이 마스크 경계에 그림) ───────────────
      if (CFG.borderWidth > 0) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = CFG.borderColor;
        ctx.lineWidth   = CFG.borderWidth;
        if (CFG.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(HALF_DIAG, HALF_DIAG, HALF_SIZE - CFG.borderWidth / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const rx = CANVAS_OFFSET + CFG.borderWidth / 2;
          const ry = CANVAS_OFFSET + CFG.borderWidth / 2;
          const rw = CFG.size - CFG.borderWidth;
          const rh = CFG.size - CFG.borderWidth;
          ctx.strokeRect(rx, ry, rw, rh);
        }
      }
    },

    // ----------------------------------------------------------
    // PIXI 스프라이트 생성
    // ----------------------------------------------------------
    createSprite(scene) {
      this._scene = scene;
      if (!this._canvas) this.initialize();

      this._baseTexture = new PIXI.BaseTexture(this._canvas);
      this._texture     = new PIXI.Texture(this._baseTexture);
      this._sprite      = new PIXI.Sprite(this._texture);

      // 마스크 생성
      this._maskGraphics = new PIXI.Graphics();
      this._buildMask();
      this._sprite.mask = this._maskGraphics;

      // 스프라이트 위치: 캔버스 중심이 마스크 중심과 일치하도록
      const gw = Graphics.width || Graphics.boxWidth;
      // 마스크 중심 = (gw - MARGIN - HALF_SIZE, MARGIN + HALF_SIZE)
      // 스프라이트 좌상단 = 마스크 중심 - HALF_DIAG
      this._sprite.x = (gw - CFG.margin - HALF_SIZE) - HALF_DIAG;
      this._sprite.y = (CFG.margin + HALF_SIZE) - HALF_DIAG;

      this._sprite.alpha = CFG.opacity / 255;

      scene.addChild(this._maskGraphics);
      scene.addChild(this._sprite);

      this._visible = true;
      this._dirty   = true;

      // 초기 탐험
      if ($gamePlayer) this.explore($gamePlayer.x, $gamePlayer.y);
    },

    _buildMask() {
      const gw    = Graphics.width || Graphics.boxWidth;
      const cx    = gw - CFG.margin - HALF_SIZE;
      const cy    = CFG.margin + HALF_SIZE;

      this._maskGraphics.clear();
      this._maskGraphics.beginFill(0xffffff);
      if (CFG.shape === 'circle') {
        this._maskGraphics.drawCircle(cx, cy, HALF_SIZE);
      } else {
        this._maskGraphics.drawRect(cx - HALF_SIZE, cy - HALF_SIZE, CFG.size, CFG.size);
      }
      this._maskGraphics.endFill();
    },

    // ----------------------------------------------------------
    // 스프라이트 해제
    // ----------------------------------------------------------
    destroySprite() {
      if (this._sprite && this._scene) {
        this._scene.removeChild(this._sprite);
        this._scene.removeChild(this._maskGraphics);
      }
      if (this._baseTexture) this._baseTexture.destroy();
      this._sprite       = null;
      this._maskGraphics = null;
      this._texture      = null;
      this._baseTexture  = null;
      this._scene        = null;
    },

    // ----------------------------------------------------------
    // 매 프레임 갱신
    // ----------------------------------------------------------
    update() {
      if (!this._sprite || !$gamePlayer) return;

      // 맵 이동 후 초기 탐험 처리
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
        ? Math.round(Mode3D._yawDeg || 0)
        : 0;

      if (px  !== this._lastPx  || py  !== this._lastPy ||
          dir !== this._lastDir || yaw !== this._lastYaw ||
          this._dirty) {
        this._lastPx  = px;
        this._lastPy  = py;
        this._lastDir = dir;
        this._lastYaw = yaw;
        this._dirty   = false;
        this._render();
        this._baseTexture.update();
      }
    },

    // ----------------------------------------------------------
    // 표시/숨김 제어
    // ----------------------------------------------------------
    setVisible(visible) {
      this._visible = visible;
      if ($gameSystem) $gameSystem._minimapVisible = visible;
      if (this._sprite) {
        this._sprite.visible       = visible;
        this._maskGraphics.visible = visible;
      }
    },

    toggleVisible() {
      this.setVisible(!this._visible);
    },
  };

  // ============================================================
  // 外部参照用 (デバッグ等)
  // ============================================================
  window.MinimapManager = MinimapManager;

})();
