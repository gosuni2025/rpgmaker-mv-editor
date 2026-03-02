//=============================================================================
// TurnOrderDisplay.js
// 전투 씬 턴 순서 아이콘 바 표시 플러그인
//
// 기능:
//   - 현재 턴 행동 순서 + 다음 턴 예측 아이콘 표시 (가로/세로 배치)
//   - 슬라이드+페이드 진입/퇴장 애니메이션
//   - 행동 대상 베지어 연결선 (공격/마법/회복 색상 구분)
//   - active 아이콘 주위 FOW 스타일 촉수 애니메이션
//=============================================================================

/*:
 * @plugindesc 전투 화면에 턴 순서 아이콘 바를 표시합니다.
 * @author Claude
 *
 * @param === 레이아웃 ===
 * @default
 *
 * @param direction
 * @text 배치 방향
 * @type select
 * @option 가로
 * @value horizontal
 * @option 세로
 * @value vertical
 * @default horizontal
 *
 * @param position
 * @text 표시 위치
 * @type select
 * @option 상단 중앙
 * @value top-center
 * @option 상단 좌
 * @value top-left
 * @option 상단 우
 * @value top-right
 * @option 하단 중앙
 * @value bottom-center
 * @option 하단 좌
 * @value bottom-left
 * @option 하단 우
 * @value bottom-right
 * @option 좌측 중앙
 * @value left-center
 * @option 우측 중앙
 * @value right-center
 * @default top-center
 *
 * @param iconSize
 * @text 아이콘 크기 (px)
 * @type number
 * @min 20
 * @max 100
 * @default 52
 *
 * @param gap
 * @text 아이콘 간격 (px)
 * @type number
 * @min 0
 * @max 40
 * @default 4
 *
 * @param margin
 * @text 화면 여백 (px)
 * @type number
 * @min 0
 * @max 100
 * @default 8
 *
 * @param nextScale
 * @text 다음 턴 아이콘 크기 비율
 * @type number
 * @decimals 2
 * @min 0.3
 * @max 1.0
 * @default 0.75
 *
 * @param === 아이콘 ===
 * @default
 *
 * @param clipShape
 * @text 클리핑 도형
 * @type select
 * @option 원형
 * @value circle
 * @option 정사각형
 * @value square
 * @option 둥근 사각형
 * @value roundRect
 * @option 마름모
 * @value diamond
 * @default circle
 *
 * @param faceZoom
 * @text 얼굴 이미지 확대율
 * @desc 1.0=꽉 맞춤, 1.3=30% 확대 후 클리핑
 * @type number
 * @decimals 2
 * @min 0.8
 * @max 2.0
 * @default 1.2
 *
 * @param === 구분선 ===
 * @default
 *
 * @param dividerWidth
 * @text 구분선 두께 (px)
 * @desc 0이면 숨김
 * @type number
 * @min 0
 * @max 10
 * @default 2
 *
 * @param dividerColor
 * @text 구분선 색
 * @default rgba(200,200,200,0.6)
 *
 * @param dividerGap
 * @text 구분선 여백 (px)
 * @type number
 * @min 0
 * @max 30
 * @default 8
 *
 * @param === 인디케이터 ===
 * @default
 *
 * @param indicatorStyle
 * @text 인디케이터 모양
 * @type select
 * @option 없음
 * @value none
 * @option 삼각형
 * @value triangle
 * @option 점
 * @value dot
 * @option 바
 * @value bar
 * @default triangle
 *
 * @param indicatorColor
 * @text 인디케이터 색
 * @default #ffdd44
 *
 * @param === 행동 연결선 ===
 * @default
 *
 * @param showCurves
 * @text 행동 연결선 표시
 * @desc 배틀러의 공격/마법/회복 대상을 아이콘 사이 베지어 곡선으로 연결
 * @type boolean
 * @default true
 *
 * @param curveAttack
 * @text 공격 선 색
 * @desc 일반 공격 대상 연결선 색
 * @default rgba(255,90,90,0.85)
 *
 * @param curveMagic
 * @text 마법 선 색
 * @desc 마법 스킬 대상 연결선 색
 * @default rgba(100,160,255,0.85)
 *
 * @param curveHeal
 * @text 회복 선 색
 * @desc 회복/아군 대상 연결선 색
 * @default rgba(100,220,100,0.85)
 *
 * @param curveOther
 * @text 기타 선 색
 * @desc 그 외 행동 연결선 색
 * @default rgba(210,210,210,0.85)
 *
 * @param curveWidth
 * @text 선 두께 (px)
 * @type number
 * @min 1
 * @max 8
 * @default 2
 *
 * @param === 촉수 애니메이션 ===
 * @default
 *
 * @param showTentacle
 * @text 촉수 애니메이션
 * @desc active 아이콘 주위에 FOW 스타일 촉수 애니메이션 표시
 * @type boolean
 * @default true
 *
 * @param tentacleCount
 * @text 촉수 수
 * @type number
 * @min 4
 * @max 24
 * @default 12
 *
 * @param tentacleLen
 * @text 촉수 최대 길이 (아이콘 크기 대비)
 * @type number
 * @decimals 2
 * @min 0.2
 * @max 1.5
 * @default 0.65
 *
 * @param tentacleColor
 * @text 촉수 색
 * @default #ffdd44
 *
 * @help
 * ============================================================
 * TurnOrderDisplay — 전투 턴 순서 표시 플러그인
 * ============================================================
 *
 * [아이콘 의미]
 *   완료(반투명) → 행동중(강조) → 대기 ▶ 다음 턴 예측(작게)
 *
 * [연결선]
 *   행동 중인 배틀러의 타겟 아이콘까지 베지어 곡선으로 연결됩니다.
 *   공격=빨강, 마법=파랑, 회복=초록, 기타=회색
 *
 * [촉수 애니메이션]
 *   현재 행동 중인 배틀러 아이콘 주위에 시야각 스타일의
 *   촉수가 파동치며 뻗어나가는 애니메이션이 표시됩니다.
 *
 * [콘솔에서 실시간 변경]
 *   TurnOrderDisplay.Config.showCurves   = false;
 *   TurnOrderDisplay.Config.showTentacle = false;
 *   TurnOrderDisplay.Config.tentacleLen  = 0.8;
 *
 * ============================================================
 * 플러그인 커맨드
 * ============================================================
 *
 * TurnOrderDisplay show / hide
 * TurnOrderDisplay direction horizontal / vertical
 * TurnOrderDisplay position top-center (등 8방향)
 * TurnOrderDisplay iconSize 48
 * TurnOrderDisplay indicator triangle / dot / bar / none
 * TurnOrderDisplay clip circle / square / roundRect / diamond
 * TurnOrderDisplay curves on / off
 * TurnOrderDisplay tentacle on / off
 */

(function () {
    'use strict';

    //=========================================================================
    // 설정
    //=========================================================================
    var _p = PluginManager.parameters('TurnOrderDisplay');

    var Config = {
        direction:      String(_p['direction']      || 'horizontal'),
        position:       String(_p['position']       || 'top-center'),
        iconSize:       parseInt(_p['iconSize']      || 52),
        gap:            parseInt(_p['gap']           || 4),
        margin:         parseInt(_p['margin']        || 8),
        nextScale:      parseFloat(_p['nextScale']   || 0.75),
        clipShape:      String(_p['clipShape']      || 'circle'),
        faceZoom:       parseFloat(_p['faceZoom']    || 1.2),
        dividerWidth:   parseInt(_p['dividerWidth']  || 2),
        dividerColor:   String(_p['dividerColor']   || 'rgba(200,200,200,0.6)'),
        dividerGap:     parseInt(_p['dividerGap']    || 8),
        indicatorStyle: String(_p['indicatorStyle'] || 'triangle'),
        indicatorColor: String(_p['indicatorColor'] || '#ffdd44'),
        showCurves:     String(_p['showCurves']     || 'true') !== 'false',
        curveAttack:    String(_p['curveAttack']    || 'rgba(255,90,90,0.85)'),
        curveMagic:     String(_p['curveMagic']     || 'rgba(100,160,255,0.85)'),
        curveHeal:      String(_p['curveHeal']      || 'rgba(100,220,100,0.85)'),
        curveOther:     String(_p['curveOther']     || 'rgba(210,210,210,0.85)'),
        curveWidth:     parseInt(_p['curveWidth']    || 2),
        showTentacle:   String(_p['showTentacle']   || 'true') !== 'false',
        tentacleCount:  parseInt(_p['tentacleCount'] || 12),
        tentacleLen:    parseFloat(_p['tentacleLen'] || 0.65),
        tentacleColor:  String(_p['tentacleColor']  || '#ffdd44'),
        visible:        true
    };

    window.TurnOrderDisplay = { Config: Config };

    //=========================================================================
    // 유틸
    //=========================================================================
    function applyClipPath(ctx, size, shape) {
        var r, h;
        ctx.beginPath();
        switch (shape) {
            case 'circle':
                ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
                break;
            case 'square':
                ctx.rect(0, 0, size, size);
                break;
            case 'roundRect':
                r = Math.round(size * 0.18);
                ctx.moveTo(r, 0);
                ctx.lineTo(size - r, 0); ctx.quadraticCurveTo(size, 0,    size, r);
                ctx.lineTo(size, size - r); ctx.quadraticCurveTo(size, size, size - r, size);
                ctx.lineTo(r, size);     ctx.quadraticCurveTo(0,    size, 0,    size - r);
                ctx.lineTo(0, r);        ctx.quadraticCurveTo(0,    0,    r,    0);
                ctx.closePath();
                break;
            case 'diamond':
                h = size / 2;
                ctx.moveTo(h, 0); ctx.lineTo(size, h);
                ctx.lineTo(h, size); ctx.lineTo(0, h);
                ctx.closePath();
                break;
            default:
                ctx.rect(0, 0, size, size);
        }
    }

    // CSS 색상 문자열의 alpha를 동적으로 교체
    function withAlpha(color, alpha) {
        var a = alpha.toFixed(2);
        if (color[0] === '#') {
            var hex = color.slice(1);
            if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
            var r = parseInt(hex.substr(0, 2), 16);
            var g = parseInt(hex.substr(2, 2), 16);
            var b = parseInt(hex.substr(4, 2), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        }
        // rgba(r,g,b,a) → alpha 교체
        return color.replace(/[\d.]+\)$/, a + ')');
    }

    //=========================================================================
    // Sprite_TurnOrderIcon
    //=========================================================================
    function Sprite_TurnOrderIcon() {
        this.initialize.apply(this, arguments);
    }
    Sprite_TurnOrderIcon.prototype = Object.create(Sprite.prototype);
    Sprite_TurnOrderIcon.prototype.constructor = Sprite_TurnOrderIcon;

    Sprite_TurnOrderIcon.prototype.initialize = function (battler) {
        Sprite.prototype.initialize.call(this);
        this._battler   = battler;
        this._status    = 'pending';
        this._imgReady  = false;
        this._shapeKey  = '';
        this._targetX   = null;
        this._targetY   = null;
        this._isNew     = true;
        this._exiting   = false;
        this._exitDone  = false;
        this.anchor.x   = 0.5;
        this.anchor.y   = 0.5;

        var size = Config.iconSize;
        this.bitmap = new Bitmap(size, size);

        if (battler.isActor()) {
            this._srcBitmap = ImageManager.loadFace(battler.faceName());
        } else {
            this._srcBitmap = ImageManager.loadEnemy(
                battler.enemy().battlerName,
                battler.enemy().battlerHue
            );
        }
    };

    Sprite_TurnOrderIcon.prototype.update = function () {
        Sprite.prototype.update.call(this);

        if (!this._imgReady && this._srcBitmap.isReady()) {
            this._imgReady = true;
            this._redraw();
        }
        if (this._imgReady && this._shapeKey !== Config.clipShape) {
            this._shapeKey = Config.clipShape;
            this._redraw();
        }

        // 위치 lerp
        if (this._targetX !== null) {
            var dx = this._targetX - this.x;
            var dy = this._targetY - this.y;
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                this.x += dx * 0.22;
                this.y += dy * 0.22;
            } else {
                this.x = this._targetX;
                this.y = this._targetY;
            }
        }

        // opacity
        if (this._exiting) {
            this.opacity -= 16;
            if (this.opacity <= 0) { this.opacity = 0; this._exitDone = true; }
        } else {
            var targetOp = this._status === 'done' ? 80 : 255;
            var diff = targetOp - this.opacity;
            if (Math.abs(diff) > 3) {
                this.opacity += Math.sign(diff) * Math.max(6, Math.abs(diff) * 0.18);
            } else {
                this.opacity = targetOp;
            }
        }
    };

    Sprite_TurnOrderIcon.prototype.setStatus = function (status) {
        if (this._status === status) return;
        this._status = status;
        if (this._imgReady) this._redraw();
    };

    Sprite_TurnOrderIcon.prototype.startExit = function (isH) {
        if (this._exiting) return;
        this._exiting = true;
        var dist = Config.iconSize * 1.5;
        if (this._targetX !== null) {
            this._targetX = isH ? this._targetX - dist : this._targetX;
            this._targetY = isH ? this._targetY : this._targetY - dist;
        }
    };

    Sprite_TurnOrderIcon.prototype._redraw = function () {
        var size  = Config.iconSize;
        var shape = Config.clipShape;
        var bmp   = this.bitmap;
        var ctx   = bmp._context;
        var src   = this._srcBitmap;

        if (bmp.width !== size || bmp.height !== size) {
            this.bitmap = new Bitmap(size, size);
            bmp = this.bitmap;
            ctx = bmp._context;
        }

        ctx.clearRect(0, 0, size, size);

        var isActor = this._battler.isActor();
        ctx.save();
        applyClipPath(ctx, size, shape);
        ctx.clip();

        var bg1  = isActor ? '#1a2a4a' : '#3a1a1a';
        var bg2  = isActor ? '#0d1828' : '#280d0d';
        var grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, bg1); grad.addColorStop(1, bg2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        if (isActor) {
            var fi  = this._battler.faceIndex();
            var fx  = (fi % 4) * 96;
            var fy  = Math.floor(fi / 4) * 96;
            var zoom = Config.faceZoom;
            var dw   = size * zoom, dh = size * zoom;
            ctx.drawImage(src._canvas, fx, fy, 96, 96, (size-dw)/2, (size-dh)/2, dw, dh);
        } else {
            var sw  = src.width, sh  = src.height;
            var fit = Math.min((size * 0.9) / sw, (size * 0.9) / sh);
            var dw2 = sw * fit, dh2 = sh * fit;
            ctx.drawImage(src._canvas, 0, 0, sw, sh,
                (size-dw2)/2, (size-dh2)/2, dw2, dh2);
        }
        ctx.restore();

        var bc, bw;
        switch (this._status) {
            case 'active': bc = '#ffdd44';                bw = 3;   break;
            case 'done':   bc = 'rgba(200,200,200,0.25)'; bw = 1.5; break;
            case 'next':   bc = 'rgba(120,180,255,0.5)';  bw = 1.5; break;
            default:       bc = 'rgba(255,255,255,0.65)'; bw = 2;
        }
        ctx.save();
        applyClipPath(ctx, size, shape);
        ctx.strokeStyle = bc; ctx.lineWidth = bw; ctx.stroke();
        if (this._status === 'active') {
            ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,220,50,0.28)'; ctx.stroke();
        }
        ctx.restore();
        bmp._setDirty();
    };

    //=========================================================================
    // 유틸: 구분선 / 인디케이터 비트맵
    //=========================================================================
    function buildDividerBitmap(isH, iconSize, lineW, color) {
        var bmp, ctx;
        if (isH) {
            bmp = new Bitmap(lineW + 8, iconSize); ctx = bmp._context;
            ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo((lineW+8)/2, 4); ctx.lineTo((lineW+8)/2, iconSize-4); ctx.stroke();
        } else {
            bmp = new Bitmap(iconSize, lineW + 8); ctx = bmp._context;
            ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(4, (lineW+8)/2); ctx.lineTo(iconSize-4, (lineW+8)/2); ctx.stroke();
        }
        bmp._setDirty();
        return bmp;
    }

    function buildIndicatorBitmap(style, color, iconSize, isH) {
        var sz  = Math.round(iconSize * 0.3);
        var bmp = new Bitmap(sz, sz);
        var ctx = bmp._context;
        ctx.fillStyle = color;
        ctx.beginPath();
        switch (style) {
            case 'triangle':
                if (isH) { ctx.moveTo(0,0); ctx.lineTo(sz,0); ctx.lineTo(sz/2,sz); }
                else     { ctx.moveTo(0,0); ctx.lineTo(sz,sz/2); ctx.lineTo(0,sz); }
                ctx.closePath(); ctx.fill(); break;
            case 'dot':
                ctx.arc(sz/2, sz/2, sz/2, 0, Math.PI*2); ctx.fill(); break;
            case 'bar':
                if (isH) ctx.fillRect(0, Math.round(sz*0.55), sz, Math.round(sz*0.4));
                else     ctx.fillRect(Math.round(sz*0.55), 0, Math.round(sz*0.4), sz);
                break;
        }
        bmp._setDirty();
        return bmp;
    }

    //=========================================================================
    // Sprite_TurnOrderBar
    //=========================================================================
    function Sprite_TurnOrderBar() {
        this.initialize.apply(this, arguments);
    }
    Sprite_TurnOrderBar.prototype = Object.create(Sprite.prototype);
    Sprite_TurnOrderBar.prototype.constructor = Sprite_TurnOrderBar;

    Sprite_TurnOrderBar.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        // entry: { b: battler, ic: Sprite_TurnOrderIcon, role: 'cur'|'next' }
        this._iconEntries  = [];
        this._exitingIcons = [];
        this._orderKey     = '';
        this._configKey    = '';
        this._frame        = 0;

        // 배경 패널
        this._bgBitmap = new Bitmap(Graphics.width, Graphics.height);
        this._bgSprite = new Sprite(this._bgBitmap);
        this.addChild(this._bgSprite);

        // 오버레이: 촉수 + 연결선 (아이콘 아래)
        this._overlayBitmap = new Bitmap(Graphics.width, Graphics.height);
        this._overlaySprite = new Sprite(this._overlayBitmap);
        this.addChild(this._overlaySprite);

        // 구분선
        this._divSprite = new Sprite();
        this._divSprite.anchor.x = 0.5;
        this._divSprite.anchor.y = 0.5;
        this.addChild(this._divSprite);

        // 인디케이터
        this._indSprite = new Sprite();
        this._indSprite.visible = false;
        this.addChild(this._indSprite);
    };

    // ── 매 프레임 ─────────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype.update = function () {
        Sprite.prototype.update.call(this);

        if (!Config.visible || !$gameParty || !$gameTroop || !BattleManager._phase) {
            this.visible = false;
            return;
        }
        this.visible = true;
        this._frame++;

        var ck = [Config.direction, Config.position, Config.iconSize, Config.gap,
                  Config.dividerWidth, Config.dividerColor, Config.dividerGap,
                  Config.indicatorStyle, Config.indicatorColor].join('|');
        if (ck !== this._configKey) {
            this._configKey = ck;
            this._rebuildDivider();
            this._rebuildIndicator();
            this._orderKey = '';
        }

        if (this._frame % 8 === 0 || this._frame <= 3) {
            this._updateOrder();
        }
        this._updateIconStatuses();
        this._updateLayout();
        this._updateIndicatorPos();
        this._updateOverlay();
        this._cleanExiting();
    };

    // ── 구분선 / 인디케이터 재생성 ───────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._rebuildDivider = function () {
        var lw = Config.dividerWidth;
        if (lw <= 0) { this._divSprite.bitmap = new Bitmap(1, 1); return; }
        this._divSprite.bitmap = buildDividerBitmap(
            Config.direction === 'horizontal', Config.iconSize, lw, Config.dividerColor
        );
    };

    Sprite_TurnOrderBar.prototype._rebuildIndicator = function () {
        var style = Config.indicatorStyle;
        if (style === 'none') {
            this._indSprite.bitmap  = new Bitmap(1, 1);
            this._indSprite.visible = false;
            return;
        }
        var isH = Config.direction === 'horizontal';
        this._indSprite.bitmap   = buildIndicatorBitmap(style, Config.indicatorColor, Config.iconSize, isH);
        this._indSprite.anchor.x = isH ? 0.5 : 1.0;
        this._indSprite.anchor.y = isH ? 1.0 : 0.5;
        this._indSprite.visible  = false;
    };

    // ── 턴 순서 계산 ─────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._calcTurnOrder = function () {
        var subject = BattleManager._subject;
        var pending = (BattleManager._actionBattlers || []).slice();
        var phase   = BattleManager._phase;

        var partyAlive = $gameParty.battleMembers().filter(function (b) { return b.isAlive(); });
        var troopAlive = ($gameTroop.aliveMembers
            ? $gameTroop.aliveMembers()
            : $gameTroop.members().filter(function (b) { return b.isAlive(); }));
        var allAlive = partyAlive.concat(troopAlive);

        var showCurrent = (phase === 'turn' || phase === 'action') &&
                          (pending.length > 0 || !!subject);
        var done = showCurrent
            ? allAlive.filter(function (b) { return pending.indexOf(b) < 0 && b !== subject; })
            : [];
        var next = allAlive.slice().sort(function (a, b) { return b.agi - a.agi; });

        return { subject: showCurrent ? subject : null, pending: showCurrent ? pending : [],
                 done: done, next: next };
    };

    Sprite_TurnOrderBar.prototype._orderKeyOf = function (order) {
        return [
            order.subject ? order.subject.name() + order.subject.index() : '-',
            order.done.map(function (b)    { return b.name() + b.index(); }).join(','),
            order.pending.map(function (b) { return b.name() + b.index(); }).join(','),
            order.next.map(function (b)    { return b.name() + b.index(); }).join(',')
        ].join('|');
    };

    Sprite_TurnOrderBar.prototype._updateOrder = function () {
        var order = this._calcTurnOrder();
        var key   = this._orderKeyOf(order);
        if (key === this._orderKey) return;
        this._orderKey = key;
        this._syncIcons(order);
    };

    // ── 아이콘 동기화 ─────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._syncIcons = function (order) {
        var isH = Config.direction === 'horizontal';

        // 새 배치 목록 구성
        var newItems = [];
        order.done.forEach(function (b)    { newItems.push({ b:b, s:'done',    role:'cur'  }); });
        if (order.subject)                   newItems.push({ b:order.subject, s:'active', role:'cur'  });
        order.pending.forEach(function (b) { newItems.push({ b:b, s:'pending', role:'cur'  }); });
        order.next.forEach(function (b)    { newItems.push({ b:b, s:'next',    role:'next' }); });

        var newBattlers = newItems.map(function (i) { return i.b; });

        // 사라질 아이콘 → exit
        var kept = [];
        this._iconEntries.forEach(function (e) {
            if (newBattlers.indexOf(e.b) < 0) {
                e.ic.startExit(isH);
                this._exitingIcons.push(e.ic);
            } else {
                kept.push(e);
            }
        }, this);
        this._iconEntries = kept;

        // 새 아이콘 생성 / 기존 아이콘 상태 갱신
        newItems.forEach(function (item) {
            var entry = this._findEntry(item.b);
            if (!entry) {
                var ic = new Sprite_TurnOrderIcon(item.b);
                ic.setStatus(item.s);
                ic.opacity = 0;
                ic._isNew  = true;
                var sc = item.role === 'next' ? Config.nextScale : 1.0;
                ic.scale.x = sc; ic.scale.y = sc;
                this.addChild(ic);
                this._iconEntries.push({ b: item.b, ic: ic, role: item.role });
            } else {
                entry.ic.setStatus(item.s);
                entry.role = item.role;  // role 갱신 (예: next→cur)
                var sc = item.role === 'next' ? Config.nextScale : 1.0;
                entry.ic.scale.x = sc; entry.ic.scale.y = sc;
            }
        }, this);

        // 구분선·인디케이터 최상위
        this.removeChild(this._divSprite);
        this.removeChild(this._indSprite);
        this.addChild(this._divSprite);
        this.addChild(this._indSprite);
    };

    Sprite_TurnOrderBar.prototype._findEntry = function (battler) {
        for (var i = 0; i < this._iconEntries.length; i++) {
            if (this._iconEntries[i].b === battler) return this._iconEntries[i];
        }
        return null;
    };

    // ── 상태 동기화 (role 기반으로 정확하게) ────────────────────────────────

    Sprite_TurnOrderBar.prototype._updateIconStatuses = function () {
        var subject = BattleManager._subject;
        var pending = BattleManager._actionBattlers || [];

        this._iconEntries.forEach(function (e) {
            var b = e.b;
            if (b === subject) {
                e.ic.setStatus('active');
            } else if (e.role === 'next') {
                // next role 아이콘은 next 상태 유지 (done으로 내려가지 않음)
                if (e.ic._status !== 'next') e.ic.setStatus('next');
            } else {
                // cur role: pending 여부로 판단
                if (pending.indexOf(b) >= 0) e.ic.setStatus('pending');
                else                         e.ic.setStatus('done');
            }
        });
    };

    // ── 레이아웃 ─────────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._updateLayout = function () {
        var order = this._calcTurnOrder();
        var isH   = Config.direction === 'horizontal';

        var curList  = [];
        var nextList = [];
        order.done.forEach(function (b) { curList.push(b); });
        if (order.subject) curList.push(order.subject);
        order.pending.forEach(function (b) { curList.push(b); });
        order.next.forEach(function (b)    { nextList.push(b); });

        if (isH) this._layoutH(curList, nextList);
        else     this._layoutV(curList, nextList);
    };

    Sprite_TurnOrderBar.prototype._layoutH = function (curList, nextList) {
        var size = Config.iconSize, gap = Config.gap;
        var nSz  = Math.round(size * Config.nextScale);
        var lw   = Config.dividerWidth, dg = Config.dividerGap;
        var dBSz = lw > 0 ? lw + 8 : 0;
        var hasDiv = lw > 0 && curList.length > 0 && nextList.length > 0;

        var curW  = curList.length  > 0 ? curList.length  * (size+gap) - gap : 0;
        var nxtW  = nextList.length > 0 ? nextList.length * (nSz+gap)  - gap : 0;
        var midW  = hasDiv ? dg+dBSz+dg : (curList.length>0 && nextList.length>0 ? gap : 0);
        var total = curW + midW + nxtW;

        var sx = this._startX(total), cy = this._centerY(size), x = sx;

        curList.forEach(function (b) {
            var e = this._findEntry(b); if (!e) return;
            this._setTarget(e.ic, x + Math.round(size/2), cy, true);
            x += size + gap;
        }, this);

        if (hasDiv) {
            x += dg - gap;
            this._divSprite.x = x + Math.round(dBSz/2);
            this._divSprite.y = cy;
            x += dBSz + dg;
        } else {
            this._divSprite.x = -999;
        }

        nextList.forEach(function (b) {
            var e = this._findEntry(b); if (!e) return;
            this._setTarget(e.ic, x + Math.round(nSz/2), cy, true);
            x += nSz + gap;
        }, this);

        this._redrawBackground(sx-10, cy - Math.round(size/2) - 9, total+20, size+18);
    };

    Sprite_TurnOrderBar.prototype._layoutV = function (curList, nextList) {
        var size = Config.iconSize, gap = Config.gap;
        var nSz  = Math.round(size * Config.nextScale);
        var lw   = Config.dividerWidth, dg = Config.dividerGap;
        var dBSz = lw > 0 ? lw + 8 : 0;
        var hasDiv = lw > 0 && curList.length > 0 && nextList.length > 0;

        var curH  = curList.length  > 0 ? curList.length  * (size+gap) - gap : 0;
        var nxtH  = nextList.length > 0 ? nextList.length * (nSz+gap)  - gap : 0;
        var midH  = hasDiv ? dg+dBSz+dg : (curList.length>0 && nextList.length>0 ? gap : 0);
        var total = curH + midH + nxtH;

        var cx = this._centerX(size), sy = this._startY(total), y = sy;

        curList.forEach(function (b) {
            var e = this._findEntry(b); if (!e) return;
            this._setTarget(e.ic, cx, y + Math.round(size/2), false);
            y += size + gap;
        }, this);

        if (hasDiv) {
            y += dg - gap;
            this._divSprite.x = cx;
            this._divSprite.y = y + Math.round(dBSz/2);
            y += dBSz + dg;
        } else {
            this._divSprite.x = -999;
        }

        nextList.forEach(function (b) {
            var e = this._findEntry(b); if (!e) return;
            this._setTarget(e.ic, cx, y + Math.round(nSz/2), false);
            y += nSz + gap;
        }, this);

        this._redrawBackground(cx - Math.round(size/2) - 9, sy-10, size+18, total+20);
    };

    // 첫 배치(frame<=2)는 즉시 위치, 이후는 진입 애니메이션
    Sprite_TurnOrderBar.prototype._setTarget = function (ic, tx, ty, isH) {
        if (ic._exiting) return;
        if (ic._isNew) {
            ic._isNew = false;
            if (this._frame <= 2) {
                ic.x = tx; ic.y = ty; ic.opacity = 255;
            } else {
                ic.x = isH ? tx + Config.iconSize * 3 : tx;
                ic.y = isH ? ty : ty + Config.iconSize * 3;
                ic.opacity = 0;
            }
        }
        ic._targetX = tx;
        ic._targetY = ty;
    };

    // ── 인디케이터 위치 ──────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._updateIndicatorPos = function () {
        if (Config.indicatorStyle === 'none') return;
        var activeIc = null;
        for (var i = 0; i < this._iconEntries.length; i++) {
            var e = this._iconEntries[i];
            if (e.ic._status === 'active' && !e.ic._exiting) { activeIc = e.ic; break; }
        }
        if (!activeIc) { this._indSprite.visible = false; return; }

        var isH  = Config.direction === 'horizontal';
        var half = Math.round(Config.iconSize / 2);
        var pad  = 3;
        this._indSprite.visible = true;
        this._indSprite.x = isH ? activeIc.x : activeIc.x - half - pad;
        this._indSprite.y = isH ? activeIc.y - half - pad : activeIc.y;
    };

    // ── 퇴장 아이콘 정리 ─────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._cleanExiting = function () {
        this._exitingIcons = this._exitingIcons.filter(function (ic) {
            if (ic._exitDone) { this.removeChild(ic); return false; }
            return true;
        }, this);
    };

    // ── 오버레이 (촉수 + 연결선) ─────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._updateOverlay = function () {
        var needsUpdate = Config.showTentacle || Config.showCurves;
        if (!needsUpdate) { this._overlayBitmap.clear(); return; }

        var bmp = this._overlayBitmap;
        bmp.clear();
        var ctx = bmp._context;

        // 1. 촉수 애니메이션
        if (Config.showTentacle) {
            this._drawTentacles(ctx);
        }

        // 2. 행동 연결선
        if (Config.showCurves) {
            this._drawActionCurves(ctx);
        }

        bmp._setDirty();
    };

    // ── 촉수 그리기 ──────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._drawTentacles = function (ctx) {
        var activeIc = null;
        for (var i = 0; i < this._iconEntries.length; i++) {
            var e = this._iconEntries[i];
            if (e.ic._status === 'active' && !e.ic._exiting && e.ic.opacity > 100) {
                activeIc = e.ic; break;
            }
        }
        if (!activeIc) return;

        var cx   = activeIc.x;
        var cy   = activeIc.y;
        var t    = this._frame;
        var cnt  = Config.tentacleCount;
        var maxL = Config.iconSize * Config.tentacleLen;
        var col  = Config.tentacleColor;

        ctx.save();
        ctx.lineCap = 'round';

        for (var i = 0; i < cnt; i++) {
            // 각 촉수의 기본 각도 (고르게 분산) + 시간에 따른 천천한 회전
            var baseAngle  = (i / cnt) * Math.PI * 2 + t * 0.018;
            var phase      = (i / cnt) * Math.PI * 2;

            // 길이 맥동: 서로 다른 주파수/위상으로 자연스럽게
            var pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.042 + phase * 1.5));
            var len   = maxL * pulse;

            // 촉수 구불거림: 중간 제어점을 수직 방향으로 흔들기
            var wiggle  = Math.sin(t * 0.057 + phase * 2.1) * maxL * 0.28;
            var perpA   = baseAngle + Math.PI / 2;
            var cpx     = cx + Math.cos(baseAngle) * len * 0.5 + Math.cos(perpA) * wiggle;
            var cpy     = cy + Math.sin(baseAngle) * len * 0.5 + Math.sin(perpA) * wiggle;
            var ex      = cx + Math.cos(baseAngle) * len;
            var ey      = cy + Math.sin(baseAngle) * len;

            // 알파: 맥동 + 중앙 근처는 더 밝게
            var alpha   = 0.12 + 0.55 * pulse;
            var lineW   = Math.max(0.4, 1.6 * (1.0 - pulse * 0.25));

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.quadraticCurveTo(cpx, cpy, ex, ey);
            ctx.strokeStyle = withAlpha(col, alpha);
            ctx.lineWidth   = lineW;
            ctx.stroke();
        }

        // 아이콘 중심에서 방사 광선 (FOW 스타일)
        var rayCount = Math.round(cnt * 0.6);
        for (var j = 0; j < rayCount; j++) {
            var rAngle = (j / rayCount) * Math.PI * 2 + t * 0.025 + 0.15;
            var rPulse = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 0.06 + j * 2.3));
            var rLen   = maxL * 0.45 * rPulse;
            var rAlpha = 0.06 + 0.2 * rPulse;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(rAngle) * rLen, cy + Math.sin(rAngle) * rLen);
            ctx.strokeStyle = withAlpha(col, rAlpha);
            ctx.lineWidth   = 0.8;
            ctx.stroke();
        }

        ctx.restore();
    };

    // ── 행동 연결선 ──────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._drawActionCurves = function (ctx) {
        if (BattleManager._phase !== 'action') return;
        var subject = BattleManager._subject;
        var targets = BattleManager._targets || [];
        if (!subject || targets.length === 0) return;

        var subEntry = this._findEntry(subject);
        if (!subEntry || subEntry.ic._exiting) return;

        var action = subject.currentAction ? subject.currentAction() : null;
        var color  = this._curveColor(action);
        var isH    = Config.direction === 'horizontal';
        var half   = Math.round(Config.iconSize / 2);

        targets.forEach(function (target) {
            var tEntry = this._findEntry(target);
            if (!tEntry || tEntry.ic._exiting) return;

            var sx = subEntry.ic.x, sy = subEntry.ic.y;
            var tx = tEntry.ic.x,   ty = tEntry.ic.y;

            if (isH) {
                // 아이콘 하단에서 시작, 아래로 처지는 베지어
                var p1x = sx, p1y = sy + half + 4;
                var p2x = tx, p2y = ty + half + 4;
                var drop = Math.max(20, Math.abs(p2x - p1x) * 0.35);
                this._strokeBezier(ctx, p1x, p1y,
                    p1x + (p2x-p1x)*0.25, p1y + drop,
                    p1x + (p2x-p1x)*0.75, p2y + drop,
                    p2x, p2y, color);
            } else {
                // 세로 모드: 아이콘 오른쪽에서 시작, 오른쪽으로 처지는 베지어
                var p1x = sx + half + 4, p1y = sy;
                var p2x = tx + half + 4, p2y = ty;
                var drift = Math.max(20, Math.abs(p2y - p1y) * 0.35);
                this._strokeBezier(ctx, p1x, p1y,
                    p1x + drift, p1y + (p2y-p1y)*0.25,
                    p2x + drift, p1y + (p2y-p1y)*0.75,
                    p2x, p2y, color);
            }
        }, this);
    };

    Sprite_TurnOrderBar.prototype._strokeBezier = function (ctx, x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1, color) {
        var lw = Config.curveWidth;

        // 발광 효과 (뒤에 두꺼운 반투명 선)
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
        ctx.strokeStyle = withAlpha(color, 0.25);
        ctx.lineWidth   = lw * 3.5;
        ctx.lineCap     = 'round';
        ctx.stroke();

        // 본선
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
        ctx.strokeStyle = color;
        ctx.lineWidth   = lw;
        ctx.stroke();

        // 시작점 원
        ctx.beginPath();
        ctx.arc(x0, y0, lw + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // 끝점 원 (타겟)
        ctx.beginPath();
        ctx.arc(x1, y1, lw + 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        // 끝점 테두리 (화살 느낌)
        ctx.beginPath();
        ctx.arc(x1, y1, lw + 4, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha(color, 0.5);
        ctx.lineWidth   = 1.5;
        ctx.stroke();
    };

    Sprite_TurnOrderBar.prototype._curveColor = function (action) {
        if (!action || !action.item()) return Config.curveOther;
        if (action.isAttack && action.isAttack()) return Config.curveAttack;
        var item = action.item();
        // hitType: 0=certain, 1=physical, 2=magical
        if (item.hitType === 2) return Config.curveMagic;
        if (action.isMagicSkill && action.isMagicSkill()) return Config.curveMagic;
        if (action.isForFriend && action.isForFriend()) return Config.curveHeal;
        return Config.curveOther;
    };

    // ── 배경 패널 ─────────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._redrawBackground = function (bx, by, bw, bh) {
        var bmp = this._bgBitmap;
        bmp.clear();
        if (bx < 0) { bw += bx; bx = 0; }
        if (by < 0) { bh += by; by = 0; }
        bw = Math.min(bw, bmp.width - bx);
        bh = Math.min(bh, bmp.height - by);
        if (bw <= 0 || bh <= 0) return;

        var ctx = bmp._context, r = 10;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(bx+r, by); ctx.lineTo(bx+bw-r, by);
        ctx.quadraticCurveTo(bx+bw, by,    bx+bw, by+r);
        ctx.lineTo(bx+bw, by+bh-r);
        ctx.quadraticCurveTo(bx+bw, by+bh, bx+bw-r, by+bh);
        ctx.lineTo(bx+r,  by+bh);
        ctx.quadraticCurveTo(bx, by+bh,    bx, by+bh-r);
        ctx.lineTo(bx,    by+r);
        ctx.quadraticCurveTo(bx, by,        bx+r, by);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.restore();
        bmp._setDirty();
    };

    // ── 위치 계산 헬퍼 ───────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._startX = function (totalW) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('right') >= 0 && pos.indexOf('left') < 0) return Graphics.width - totalW - m;
        if (pos.indexOf('left')  >= 0 && pos.indexOf('right') < 0) return m;
        return Math.round((Graphics.width - totalW) / 2);
    };
    Sprite_TurnOrderBar.prototype._centerY = function (s) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('bottom') >= 0) return Graphics.height - m - Math.round(s/2);
        if (pos === 'left-center' || pos === 'right-center') return Math.round(Graphics.height / 2);
        return m + Math.round(s / 2);
    };
    Sprite_TurnOrderBar.prototype._centerX = function (s) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('right') >= 0) return Graphics.width - m - Math.round(s/2);
        if (pos === 'top-center' || pos === 'bottom-center') return Math.round(Graphics.width / 2);
        return m + Math.round(s / 2);
    };
    Sprite_TurnOrderBar.prototype._startY = function (totalH) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('bottom') >= 0) return Graphics.height - totalH - m;
        if (pos === 'left-center' || pos === 'right-center') return Math.round((Graphics.height - totalH) / 2);
        return m;
    };

    //=========================================================================
    // Scene_Battle
    //=========================================================================
    var _Scene_Battle_createSpriteset = Scene_Battle.prototype.createSpriteset;
    Scene_Battle.prototype.createSpriteset = function () {
        _Scene_Battle_createSpriteset.call(this);
        this._turnOrderBar = new Sprite_TurnOrderBar();
        this.addChild(this._turnOrderBar);
    };

    //=========================================================================
    // 플러그인 커맨드
    //=========================================================================
    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _pluginCommand.call(this, command, args);
        if (command !== 'TurnOrderDisplay') return;

        var sub = (args[0] || '').toLowerCase();
        var val = (args[1] || '');
        var n;

        switch (sub) {
            case 'show':        Config.visible = true;  break;
            case 'hide':        Config.visible = false; break;
            case 'direction':
                if (val === 'horizontal' || val === 'vertical') Config.direction = val;
                break;
            case 'position':    Config.position = val;  break;
            case 'iconsize':
                n = parseInt(val, 10);
                if (!isNaN(n) && n >= 20) Config.iconSize = n;
                break;
            case 'indicator':   Config.indicatorStyle = val; break;
            case 'clip':        Config.clipShape = val;       break;
            case 'curves':
                Config.showCurves   = (val === 'on' || val === 'true');  break;
            case 'tentacle':
                Config.showTentacle = (val === 'on' || val === 'true');  break;
        }
    };

})();
