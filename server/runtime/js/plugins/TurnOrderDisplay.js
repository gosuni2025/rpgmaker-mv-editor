//=============================================================================
// TurnOrderDisplay.js
// 전투 씬 턴 순서 아이콘 바 표시 플러그인
//
// 기능:
//   - 화면 임의 위치에 현재 턴 행동 순서 + 다음 턴 예측 아이콘 표시
//   - 가로/세로 배치, 위치, 간격, 인디케이터, 클리핑 도형 등 커스터마이즈
//   - 완료 아이콘 슬라이드+페이드 퇴장, 신규 아이콘 슬라이드 진입 애니메이션
//   - 플러그인 커맨드로 런타임 중 설정 변경 가능
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
 * @desc 아이콘을 가로로 나열할지 세로로 나열할지 선택합니다.
 * @type select
 * @option 가로
 * @value horizontal
 * @option 세로
 * @value vertical
 * @default horizontal
 *
 * @param position
 * @text 표시 위치
 * @desc 화면에서 턴 순서 바의 기준 위치
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
 * @desc 아이콘과 아이콘 사이의 픽셀 간격
 * @type number
 * @min 0
 * @max 40
 * @default 4
 *
 * @param margin
 * @text 화면 여백 (px)
 * @desc 화면 가장자리에서 아이콘 바까지의 여백
 * @type number
 * @min 0
 * @max 100
 * @default 8
 *
 * @param nextScale
 * @text 다음 턴 아이콘 크기 비율
 * @desc 현재 턴 아이콘 대비 다음 턴 예측 아이콘의 크기 비율 (0.3~1.0)
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
 * @desc 아이콘 이미지를 자를 도형 모양
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
 * @desc 액터 얼굴 이미지를 아이콘 안에 얼마나 확대해 넣을지 (1.0=꽉 맞춤, 1.3=30% 확대 후 원형 크롭)
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
 * @desc 현재 턴과 다음 턴 사이 구분선의 두께. 0이면 숨김.
 * @type number
 * @min 0
 * @max 10
 * @default 2
 *
 * @param dividerColor
 * @text 구분선 색
 * @desc 구분선 색 (CSS 색상 문자열)
 * @default rgba(200,200,200,0.6)
 *
 * @param dividerGap
 * @text 구분선 여백 (px)
 * @desc 구분선 좌우(가로 모드) 또는 상하(세로 모드)의 빈 공간
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
 * @desc 현재 행동 중인 배틀러 아이콘 위(가로) 또는 왼쪽(세로)에 표시할 마커
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
 * @desc 인디케이터 색 (CSS 색상 문자열)
 * @default #ffdd44
 *
 * @help
 * ============================================================
 * TurnOrderDisplay — 전투 턴 순서 표시 플러그인
 * ============================================================
 *
 * 전투 화면에 현재 턴 행동 순서와 다음 턴 예측을 아이콘으로
 * 표시합니다.
 *
 * [아이콘 의미]
 *   완료(반투명) → 행동중(강조) → 대기 ▶ 다음 턴 예측(작게)
 *
 * [애니메이션]
 *   아이콘 퇴장: 완료 후 가로=왼쪽, 세로=위로 슬라이드+페이드
 *   아이콘 진입: 가로=오른쪽, 세로=아래에서 슬라이드인
 *   위치 이동: 부드럽게 lerp 이동
 *
 * [콘솔에서 실시간 변경]
 *   TurnOrderDisplay.Config.direction = 'vertical';
 *   TurnOrderDisplay.Config.clipShape = 'diamond';
 *   TurnOrderDisplay.Config.faceZoom  = 1.4;
 *
 * ============================================================
 * 플러그인 커맨드
 * ============================================================
 *
 * TurnOrderDisplay show
 *   → 턴 순서 바 표시
 *
 * TurnOrderDisplay hide
 *   → 턴 순서 바 숨김
 *
 * TurnOrderDisplay direction horizontal
 * TurnOrderDisplay direction vertical
 *   → 배치 방향 변경
 *
 * TurnOrderDisplay position top-center
 *   → 위치 변경
 *     top-center / top-left / top-right
 *     bottom-center / bottom-left / bottom-right
 *     left-center / right-center
 *
 * TurnOrderDisplay iconSize 48
 *   → 아이콘 크기 변경 (숫자)
 *
 * TurnOrderDisplay indicator triangle
 *   → 인디케이터 변경 (none / triangle / dot / bar)
 *
 * TurnOrderDisplay clip circle
 *   → 클리핑 도형 변경 (circle / square / roundRect / diamond)
 */

(function () {
    'use strict';

    //=========================================================================
    // 설정 (파라미터 초기값, 런타임 변경 가능)
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
        visible:        true
    };

    window.TurnOrderDisplay = { Config: Config };

    //=========================================================================
    // 유틸: 클리핑 패스 설정
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
        this._targetX   = null;   // null이면 아직 배치 전
        this._targetY   = null;
        this._isNew     = true;   // 첫 배치 시 진입 위치 계산에 사용
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
            if (this.opacity <= 0) {
                this.opacity   = 0;
                this._exitDone = true;
            }
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

    // 퇴장 애니메이션 시작 (가로: 왼쪽, 세로: 위쪽)
    Sprite_TurnOrderIcon.prototype.startExit = function (isHorizontal) {
        if (this._exiting) return;
        this._exiting = true;
        var dist = Config.iconSize * 1.5;
        if (this._targetX !== null) {
            this._targetX = isHorizontal ? (this._targetX - dist) : this._targetX;
            this._targetY = isHorizontal ? this._targetY : (this._targetY - dist);
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

        // 배경 그라디언트
        var bg1  = isActor ? '#1a2a4a' : '#3a1a1a';
        var bg2  = isActor ? '#0d1828' : '#280d0d';
        var grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, bg1);
        grad.addColorStop(1, bg2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        // 이미지 그리기
        if (isActor) {
            // face 96×96 → faceZoom 배율로 확대 후 원형 크롭
            // (축소된 아이콘 위에 zoom 배율로 키운 face를 중앙에 배치)
            var fi   = this._battler.faceIndex();
            var fx   = (fi % 4) * 96;
            var fy   = Math.floor(fi / 4) * 96;
            var zoom = Config.faceZoom;
            var dw   = size * zoom;
            var dh   = size * zoom;
            var ox   = (size - dw) / 2;
            var oy   = (size - dh) / 2;
            ctx.drawImage(src._canvas, fx, fy, 96, 96, ox, oy, dw, dh);
        } else {
            // enemy 이미지: 비율 유지하며 90% 크기로 축소
            var sw  = src.width, sh  = src.height;
            var fit = Math.min((size * 0.9) / sw, (size * 0.9) / sh);
            var dw2 = sw * fit, dh2 = sh * fit;
            ctx.drawImage(src._canvas, 0, 0, sw, sh,
                (size - dw2) / 2, (size - dh2) / 2, dw2, dh2);
        }
        ctx.restore();

        // 테두리
        var bc, bw;
        switch (this._status) {
            case 'active': bc = '#ffdd44';                bw = 3;   break;
            case 'done':   bc = 'rgba(200,200,200,0.25)'; bw = 1.5; break;
            case 'next':   bc = 'rgba(120,180,255,0.5)';  bw = 1.5; break;
            default:       bc = 'rgba(255,255,255,0.65)'; bw = 2;
        }
        ctx.save();
        applyClipPath(ctx, size, shape);
        ctx.strokeStyle = bc;
        ctx.lineWidth   = bw;
        ctx.stroke();
        if (this._status === 'active') {
            ctx.lineWidth   = 7;
            ctx.strokeStyle = 'rgba(255,220,50,0.28)';
            ctx.stroke();
        }
        ctx.restore();

        bmp._setDirty();
    };

    //=========================================================================
    // 유틸: 구분선 비트맵 생성
    //=========================================================================
    function buildDividerBitmap(isHorizontal, iconSize, lineW, color) {
        var bmp, ctx;
        if (isHorizontal) {
            bmp = new Bitmap(lineW + 8, iconSize);
            ctx = bmp._context;
            ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo((lineW + 8) / 2, 4);
            ctx.lineTo((lineW + 8) / 2, iconSize - 4);
            ctx.stroke();
        } else {
            bmp = new Bitmap(iconSize, lineW + 8);
            ctx = bmp._context;
            ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(4,           (lineW + 8) / 2);
            ctx.lineTo(iconSize - 4,(lineW + 8) / 2);
            ctx.stroke();
        }
        bmp._setDirty();
        return bmp;
    }

    //=========================================================================
    // 유틸: 인디케이터 비트맵 생성
    //=========================================================================
    function buildIndicatorBitmap(style, color, iconSize, isHorizontal) {
        var sz  = Math.round(iconSize * 0.3);
        var bmp = new Bitmap(sz, sz);
        var ctx = bmp._context;
        ctx.fillStyle = color;
        ctx.beginPath();
        switch (style) {
            case 'triangle':
                if (isHorizontal) {
                    ctx.moveTo(0, 0); ctx.lineTo(sz, 0); ctx.lineTo(sz / 2, sz);
                } else {
                    ctx.moveTo(0, 0); ctx.lineTo(sz, sz / 2); ctx.lineTo(0, sz);
                }
                ctx.closePath(); ctx.fill();
                break;
            case 'dot':
                ctx.arc(sz / 2, sz / 2, sz / 2, 0, Math.PI * 2); ctx.fill();
                break;
            case 'bar':
                if (isHorizontal) {
                    ctx.fillRect(0, Math.round(sz * 0.55), sz, Math.round(sz * 0.4));
                } else {
                    ctx.fillRect(Math.round(sz * 0.55), 0, Math.round(sz * 0.4), sz);
                }
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
        // battler → Sprite_TurnOrderIcon 매핑 (배열로 관리, battler 객체 키)
        this._iconEntries  = [];   // [{b: battler, ic: Sprite_TurnOrderIcon, role: 'cur'|'next'}]
        this._exitingIcons = [];   // 퇴장 애니메이션 중인 아이콘
        this._orderKey     = '';
        this._configKey    = '';
        this._frame        = 0;

        this._bgBitmap = new Bitmap(Graphics.width, Graphics.height);
        this._bgSprite = new Sprite(this._bgBitmap);
        this.addChild(this._bgSprite);

        this._divSprite = new Sprite();
        this._divSprite.anchor.x = 0.5;
        this._divSprite.anchor.y = 0.5;
        this.addChild(this._divSprite);

        this._indSprite = new Sprite();
        this._indSprite.visible = false;
        this.addChild(this._indSprite);
    };

    // ── 매 프레임 ────────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype.update = function () {
        Sprite.prototype.update.call(this);

        if (!Config.visible || !$gameParty || !$gameTroop || !BattleManager._phase) {
            this.visible = false;
            return;
        }
        this.visible = true;
        this._frame++;

        // 설정 변경 감지
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
        this._cleanExiting();
    };

    // ── 구분선 재생성 ─────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._rebuildDivider = function () {
        var lw = Config.dividerWidth;
        if (lw <= 0) { this._divSprite.bitmap = new Bitmap(1, 1); return; }
        this._divSprite.bitmap = buildDividerBitmap(
            Config.direction === 'horizontal', Config.iconSize, lw, Config.dividerColor
        );
    };

    // ── 인디케이터 재생성 ─────────────────────────────────────────────────────

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

    // ── 인디케이터 위치 추적 ──────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._updateIndicatorPos = function () {
        if (Config.indicatorStyle === 'none') return;
        var activeIc = null;
        for (var i = 0; i < this._iconEntries.length; i++) {
            var e = this._iconEntries[i];
            if (e.ic._status === 'active' && !e.ic._exiting) { activeIc = e.ic; break; }
        }
        if (!activeIc) { this._indSprite.visible = false; return; }

        var isH = Config.direction === 'horizontal';
        var half = Math.round(Config.iconSize / 2);
        var pad  = 3;
        this._indSprite.visible = true;
        this._indSprite.x = isH ? activeIc.x            : activeIc.x - half - pad;
        this._indSprite.y = isH ? activeIc.y - half - pad : activeIc.y;
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

        return {
            subject: showCurrent ? subject : null,
            pending: showCurrent ? pending : [],
            done:    done,
            next:    next
        };
    };

    Sprite_TurnOrderBar.prototype._orderKeyOf = function (order) {
        return [
            order.subject ? order.subject.name() + order.subject.index() : '-',
            order.done.map(function (b) { return b.name() + b.index(); }).join(','),
            order.pending.map(function (b) { return b.name() + b.index(); }).join(','),
            order.next.map(function (b) { return b.name() + b.index(); }).join(',')
        ].join('|');
    };

    Sprite_TurnOrderBar.prototype._updateOrder = function () {
        var order = this._calcTurnOrder();
        var key   = this._orderKeyOf(order);
        if (key === this._orderKey) return;
        this._orderKey = key;
        this._syncIcons(order);
    };

    // ── 아이콘 동기화 (애니메이션 포함) ──────────────────────────────────────

    Sprite_TurnOrderBar.prototype._syncIcons = function (order) {
        var isH = Config.direction === 'horizontal';

        // 새 배열 구성: [{b, status, role}]
        var newItems = [];
        order.done.forEach(function (b) { newItems.push({ b: b, s: 'done',    role: 'cur' }); });
        if (order.subject)  newItems.push({ b: order.subject, s: 'active', role: 'cur' });
        order.pending.forEach(function (b) { newItems.push({ b: b, s: 'pending', role: 'cur' }); });
        order.next.forEach(function (b)    { newItems.push({ b: b, s: 'next',    role: 'next' }); });

        var newBattlers = newItems.map(function (i) { return i.b; });

        // 사라져야 할 아이콘 → exit 애니메이션
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

        // 새 아이콘 생성 / 기존 아이콘 상태 업데이트
        newItems.forEach(function (item) {
            var entry = this._findEntry(item.b);
            if (!entry) {
                var ic = new Sprite_TurnOrderIcon(item.b);
                ic.setStatus(item.s);
                ic.opacity = 0;
                ic._isNew  = true;
                // scale 설정
                var sc = item.role === 'next' ? Config.nextScale : 1.0;
                ic.scale.x = sc;
                ic.scale.y = sc;
                this.addChild(ic);
                this._iconEntries.push({ b: item.b, ic: ic });
            } else {
                entry.ic.setStatus(item.s);
                var sc = item.role === 'next' ? Config.nextScale : 1.0;
                entry.ic.scale.x = sc;
                entry.ic.scale.y = sc;
            }
        }, this);

        // 구분선·인디케이터는 항상 최상위 z-order
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

    Sprite_TurnOrderBar.prototype._updateIconStatuses = function () {
        var subject = BattleManager._subject;
        var pending = BattleManager._actionBattlers || [];
        this._iconEntries.forEach(function (e) {
            var b = e.b;
            if (b === subject)                e.ic.setStatus('active');
            else if (pending.indexOf(b) >= 0) e.ic.setStatus('pending');
            else if (e.ic._status === 'next') { /* next는 유지 */ }
            else                              e.ic.setStatus('done');
        });
    };

    // 퇴장 완료 아이콘 정리
    Sprite_TurnOrderBar.prototype._cleanExiting = function () {
        this._exitingIcons = this._exitingIcons.filter(function (ic) {
            if (ic._exitDone) { this.removeChild(ic); return false; }
            return true;
        }, this);
    };

    // ── 레이아웃: targetX/Y 계산 후 아이콘에 설정 ────────────────────────────

    Sprite_TurnOrderBar.prototype._updateLayout = function () {
        var order = this._calcTurnOrder();
        var isH   = Config.direction === 'horizontal';

        // 현재 배치 목록 (퇴장 중은 제외)
        var curList  = [];
        var nextList = [];
        order.done.forEach(function (b) { curList.push(b); });
        if (order.subject) curList.push(order.subject);
        order.pending.forEach(function (b) { curList.push(b); });
        order.next.forEach(function (b) { nextList.push(b); });

        if (isH) {
            this._layoutHorizontal(curList, nextList);
        } else {
            this._layoutVertical(curList, nextList);
        }
    };

    Sprite_TurnOrderBar.prototype._layoutHorizontal = function (curList, nextList) {
        var size    = Config.iconSize;
        var gap     = Config.gap;
        var nSz     = Math.round(size * Config.nextScale);
        var divW    = Config.dividerWidth;
        var divGap  = Config.dividerGap;
        var divBSz  = divW > 0 ? (divW + 8) : 0;
        var hasDiv  = divW > 0 && curList.length > 0 && nextList.length > 0;

        var curW   = curList.length  > 0 ? curList.length  * (size + gap) - gap : 0;
        var nextW  = nextList.length > 0 ? nextList.length * (nSz  + gap) - gap : 0;
        var midW   = hasDiv ? (divGap + divBSz + divGap) : (curList.length > 0 && nextList.length > 0 ? gap : 0);
        var totalW = curW + midW + nextW;

        var startX  = this._startX(totalW);
        var centerY = this._centerY(size);
        var x = startX;

        curList.forEach(function (b) {
            var ic = this._findEntry(b); if (!ic) return; ic = ic.ic;
            var tx = x + Math.round(size / 2);
            var ty = centerY;
            this._setTarget(ic, tx, ty, true);
            x += size + gap;
        }, this);

        if (hasDiv) {
            x += divGap - gap;
            this._divSprite.x = x + Math.round(divBSz / 2);
            this._divSprite.y = centerY;
            x += divBSz + divGap;
        } else {
            this._divSprite.x = -999;
        }

        nextList.forEach(function (b) {
            var ic = this._findEntry(b); if (!ic) return; ic = ic.ic;
            var tx = x + Math.round(nSz / 2);
            var ty = centerY;
            this._setTarget(ic, tx, ty, true);
            x += nSz + gap;
        }, this);

        var bgX = startX - 10;
        var bgY = centerY - Math.round(size / 2) - 9;
        this._redrawBackground(bgX, bgY, totalW + 20, size + 18);
    };

    Sprite_TurnOrderBar.prototype._layoutVertical = function (curList, nextList) {
        var size    = Config.iconSize;
        var gap     = Config.gap;
        var nSz     = Math.round(size * Config.nextScale);
        var divW    = Config.dividerWidth;
        var divGap  = Config.dividerGap;
        var divBSz  = divW > 0 ? (divW + 8) : 0;
        var hasDiv  = divW > 0 && curList.length > 0 && nextList.length > 0;

        var curH   = curList.length  > 0 ? curList.length  * (size + gap) - gap : 0;
        var nextH  = nextList.length > 0 ? nextList.length * (nSz  + gap) - gap : 0;
        var midH   = hasDiv ? (divGap + divBSz + divGap) : (curList.length > 0 && nextList.length > 0 ? gap : 0);
        var totalH = curH + midH + nextH;

        var centerX = this._centerX(size);
        var startY  = this._startY(totalH);
        var y = startY;

        curList.forEach(function (b) {
            var ic = this._findEntry(b); if (!ic) return; ic = ic.ic;
            var tx = centerX;
            var ty = y + Math.round(size / 2);
            this._setTarget(ic, tx, ty, false);
            y += size + gap;
        }, this);

        if (hasDiv) {
            y += divGap - gap;
            this._divSprite.x = centerX;
            this._divSprite.y = y + Math.round(divBSz / 2);
            y += divBSz + divGap;
        } else {
            this._divSprite.x = -999;
        }

        nextList.forEach(function (b) {
            var ic = this._findEntry(b); if (!ic) return; ic = ic.ic;
            var tx = centerX;
            var ty = y + Math.round(nSz / 2);
            this._setTarget(ic, tx, ty, false);
            y += nSz + gap;
        }, this);

        var bgX = centerX - Math.round(size / 2) - 9;
        var bgY = startY - 10;
        this._redrawBackground(bgX, bgY, size + 18, totalH + 20);
    };

    // targetX/Y 설정. 신규 아이콘은 진입 방향 오프셋에서 시작
    Sprite_TurnOrderBar.prototype._setTarget = function (ic, tx, ty, isH) {
        if (ic._exiting) return;
        if (ic._isNew) {
            ic._isNew  = false;
            // 진입 시작 위치: 가로=오른쪽 끝, 세로=아래쪽 끝
            ic.x = isH ? tx + Config.iconSize * 3 : tx;
            ic.y = isH ? ty : ty + Config.iconSize * 3;
            ic.opacity = 0;
        }
        ic._targetX = tx;
        ic._targetY = ty;
    };

    // ── 위치 계산 헬퍼 ───────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._startX = function (totalW) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('right')  >= 0 && pos.indexOf('left') < 0) return Graphics.width - totalW - m;
        if (pos.indexOf('left')   >= 0 && pos.indexOf('right') < 0) return m;
        return Math.round((Graphics.width - totalW) / 2);
    };

    Sprite_TurnOrderBar.prototype._centerY = function (iconSize) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('bottom') >= 0) return Graphics.height - m - Math.round(iconSize / 2);
        if (pos === 'left-center' || pos === 'right-center') return Math.round(Graphics.height / 2);
        return m + Math.round(iconSize / 2);
    };

    Sprite_TurnOrderBar.prototype._centerX = function (iconSize) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('right') >= 0) return Graphics.width - m - Math.round(iconSize / 2);
        if (pos === 'top-center' || pos === 'bottom-center') return Math.round(Graphics.width / 2);
        return m + Math.round(iconSize / 2);
    };

    Sprite_TurnOrderBar.prototype._startY = function (totalH) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('bottom') >= 0) return Graphics.height - totalH - m;
        if (pos === 'left-center' || pos === 'right-center') return Math.round((Graphics.height - totalH) / 2);
        return m;
    };

    Sprite_TurnOrderBar.prototype._redrawBackground = function (bx, by, bw, bh) {
        var bmp = this._bgBitmap;
        bmp.clear();
        if (bx < 0) { bw += bx; bx = 0; }
        if (by < 0) { bh += by; by = 0; }
        bw = Math.min(bw, bmp.width  - bx);
        bh = Math.min(bh, bmp.height - by);
        if (bw <= 0 || bh <= 0) return;

        var ctx = bmp._context, r = 10;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(bx + r,      by);
        ctx.lineTo(bx + bw - r, by);
        ctx.quadraticCurveTo(bx + bw, by,      bx + bw, by + r);
        ctx.lineTo(bx + bw,     by + bh - r);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
        ctx.lineTo(bx + r,      by + bh);
        ctx.quadraticCurveTo(bx, by + bh,      bx, by + bh - r);
        ctx.lineTo(bx,          by + r);
        ctx.quadraticCurveTo(bx, by,            bx + r, by);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.restore();
        bmp._setDirty();
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
        }
    };

})();
