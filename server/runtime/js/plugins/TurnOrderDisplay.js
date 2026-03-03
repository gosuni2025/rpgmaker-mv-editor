//=============================================================================
// TurnOrderDisplay.js
// 전투 씬 턴 순서 아이콘 바 표시 플러그인
//=============================================================================

/*:
 * @plugindesc 전투 화면 상단에 턴 순서 아이콘 바를 표시합니다.
 * @author Claude
 *
 * @param iconSize
 * @text 아이콘 크기 (px)
 * @type number
 * @min 20
 * @max 100
 * @default 52
 *
 * @param barY
 * @text 바 Y 위치 (px, 상단 기준)
 * @type number
 * @min 0
 * @max 200
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
 * @type boolean
 * @default true
 *
 * @param curveAttack
 * @text 물리공격 선 색
 * @default rgba(255,70,40,0.9)
 *
 * @param curveMagic
 * @text 마법 선 색
 * @default rgba(140,80,255,0.9)
 *
 * @param curveHeal
 * @text 회복/아군 선 색
 * @default rgba(60,210,120,0.9)
 *
 * @param curveItem
 * @text 아이템 선 색
 * @default rgba(255,200,50,0.9)
 *
 * @param curveOther
 * @text 기타 선 색
 * @default rgba(180,180,220,0.85)
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
 *   예: A B C D E | a b c d e
 *
 * [플러그인 커맨드]
 *   TurnOrderDisplay show / hide
 *   TurnOrderDisplay direction horizontal / vertical
 *   TurnOrderDisplay position top-center
 *   TurnOrderDisplay iconSize 48
 *   TurnOrderDisplay indicator triangle / dot / bar / none
 *   TurnOrderDisplay clip circle / square / roundRect / diamond
 *   TurnOrderDisplay curves on / off
 *   TurnOrderDisplay tentacle on / off
 */

(function () {
    'use strict';
    console.log('[TOD] v7 loaded');

    //=========================================================================
    // 이번 턴에 행동 완료한 배틀러 직접 추적
    // BattleManager 추론(_actionBattlers) 대신 hook으로 정확히 기록
    //=========================================================================
    var _doneThisTurn = [];
    var _turnTransitionPending = false;
    var _inputPreviewOrder = null;
    var _enemyTargetPreview = null; // { enemyIndex: [target battlers] }

    // 랜덤 없이 결정적 속도 계산 (agi + 스킬속도 + 공격속도)
    function _calcSpeedDeterministic(battler) {
        var action = battler.currentAction();
        if (!action || !action.item()) return battler.agi;
        var speed = battler.agi;
        if (action.item()) speed += action.item().speed;
        if (action.isAttack && action.isAttack()) speed += battler.attackSpeed();
        return speed;
    }

    // 커맨드 입력 중 속도 미리보기 계산 (랜덤 없음 → 안정적 순서)
    function _recalcInputPreview() {
        var battlers = [];
        if (!BattleManager._surprise) battlers = battlers.concat($gameParty.members());
        if (!BattleManager._preemptive) battlers = battlers.concat($gameTroop.members());
        battlers.forEach(function (b, i) {
            b._speed = _calcSpeedDeterministic(b);
            b._sortIndex = i; // 안정 정렬용 원래 인덱스
        });
        battlers.sort(function (a, b) {
            return b._speed - a._speed || a._sortIndex - b._sortIndex;
        });
        _inputPreviewOrder = battlers.filter(function (b) {
            return b.isBattleMember() && b.isAlive();
        });
    }

    // startInput: 턴 종료 후 커맨드 입력 진입 시 턴 전환 애니메이션 트리거
    var _BM_startInput = BattleManager.startInput;
    BattleManager.startInput = function () {
        if (_doneThisTurn.length > 0) {
            _turnTransitionPending = true;
        }
        _doneThisTurn = [];
        _BM_startInput.call(this);
        // makeActions() 이후 초기 속도 미리보기 + 적 타겟 미리보기
        if (this._phase === 'input') {
            _recalcInputPreview();
            _calcEnemyTargets();
        }
    };

    function _calcEnemyTargets() {
        _enemyTargetPreview = {};
        $gameTroop.aliveMembers().forEach(function (enemy) {
            var action = enemy.currentAction();
            if (!action || !action.item()) return;
            var targets = action.makeTargets();
            // 중복 제거
            var unique = [];
            targets.forEach(function (t) {
                if (unique.indexOf(t) < 0) unique.push(t);
            });
            _enemyTargetPreview[enemy.index()] = {
                targets: unique,
                action: action
            };
        });
    }

    // selectNextCommand: 각 액터 커맨드 확정 시 속도 재계산
    var _BM_selectNextCommand = BattleManager.selectNextCommand;
    BattleManager.selectNextCommand = function () {
        _BM_selectNextCommand.call(this);
        if (this._phase === 'input') {
            _recalcInputPreview();
        }
    };

    // selectPreviousCommand: 커맨드 취소 시 속도 재계산
    var _BM_selectPreviousCommand = BattleManager.selectPreviousCommand;
    BattleManager.selectPreviousCommand = function () {
        _BM_selectPreviousCommand.call(this);
        if (this._phase === 'input') {
            _recalcInputPreview();
        }
    };

    var _BM_startTurn = BattleManager.startTurn;
    BattleManager.startTurn = function () {
        // input 미리보기 순서 + 속도 저장
        var savedOrder = _inputPreviewOrder ? _inputPreviewOrder.slice() : null;
        _inputPreviewOrder = null;
        _BM_startTurn.call(this); // makeActionOrders → makeSpeed 재랜덤
        // 미리보기 순서 그대로 적용 → 표시된 순서 = 실제 순서
        if (savedOrder) {
            var actionSet = this._actionBattlers;
            this._actionBattlers = savedOrder.filter(function (b) {
                return actionSet.indexOf(b) >= 0;
            });
            // 속도도 복원 (다른 코드가 speed() 참조할 수 있으므로)
            savedOrder.forEach(function (b) {
                b._speed = _calcSpeedDeterministic(b);
            });
        }
    };

    var _BM_endAction = BattleManager.endAction;
    BattleManager.endAction = function () {
        var subj = this._subject;
        if (subj && _doneThisTurn.indexOf(subj) < 0) {
            _doneThisTurn.push(subj);
        }
        _BM_endAction.call(this);
    };

    //=========================================================================
    // 설정
    //=========================================================================
    var _p = PluginManager.parameters('TurnOrderDisplay');

    var Config = {
        direction:      String(_p['direction']      || 'horizontal'),
        position:       String(_p['position']       || 'top-center'),
        iconSize:       parseInt(_p['iconSize']      || 52),
        barY:           parseInt(_p['barY']          || 8),
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
        curveAttack:    String(_p['curveAttack']    || 'rgba(255,70,40,0.9)'),
        curveMagic:     String(_p['curveMagic']     || 'rgba(140,80,255,0.9)'),
        curveHeal:      String(_p['curveHeal']      || 'rgba(60,210,120,0.9)'),
        curveItem:      String(_p['curveItem']      || 'rgba(255,200,50,0.9)'),
        curveOther:     String(_p['curveOther']     || 'rgba(180,180,220,0.85)'),
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
            var targetOp = this._status === 'done' ? 160 : 255;
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
            var fi   = this._battler.faceIndex();
            var fx   = (fi % 4) * 96;
            var fy   = Math.floor(fi / 4) * 96;
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

        // done 상태: 어두운 반투명 오버레이
        if (this._status === 'done') {
            ctx.save();
            applyClipPath(ctx, size, shape);
            ctx.clip();
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(0, 0, size, size);
            ctx.restore();
        }

        var bc, bw;
        switch (this._status) {
            case 'active': bc = '#ffdd44';                bw = 3;   break;
            case 'done':   bc = 'rgba(150,150,150,0.5)';  bw = 1.5; break;
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

        this._bgBitmap = new Bitmap(Graphics.width, Graphics.height);
        this._bgSprite = new Sprite(this._bgBitmap);
        this.addChild(this._bgSprite);

        this._overlayBitmap = new Bitmap(Graphics.width, Graphics.height);
        this._overlaySprite = new Sprite(this._overlayBitmap);
        this.addChild(this._overlaySprite);

        this._divSprite = new Sprite();
        this._divSprite.anchor.x = 0.5;
        this._divSprite.anchor.y = 0.5;
        this.addChild(this._divSprite);

        this._indSprite = new Sprite();
        this._indSprite.visible = false;
        this.addChild(this._indSprite);
    };

    //=========================================================================
    // 매 프레임 업데이트
    //=========================================================================
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

        // 턴 전환 감지
        if (_turnTransitionPending) {
            _turnTransitionPending = false;
            this._turnTransition = true;
            this._orderKey = ''; // 강제 _syncIcons 호출
        }

        // 매 프레임 순서 계산 (캐시 — _updateOrder/_updateLayout 공유)
        this._order = this._calcTurnOrder();
        this._updateOrder();
        this._updateIconStatuses();
        this._updateLayout();
        this._updateIndicatorPos();
        this._updateOverlay();
        this._cleanExiting();
    };

    //=========================================================================
    // 구분선 / 인디케이터 재생성
    //=========================================================================
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

    //=========================================================================
    // 턴 순서 계산
    // 반환: { curOrder, curSubject, curPending, next }
    //
    // curOrder 규칙:
    //   turn/action/turnEnd: done(반투명) + subject(active) + pending — 모두 유지
    //     done 판별: _doneThisTurn 배열 (BattleManager.endAction hook으로 기록)
    //   input/기타: done 배틀러 유지 + AGI 기반 pending (순서 안정화)
    //     ※ 이전 코드는 input에서 AGI 전체 재정렬 → 아이콘이 이동하는 버그 있었음
    //     ※ done 유지로 turnEnd→input 전환 시 아이콘 이동 없음
    //
    // next는 turn/action/turnEnd에서만 표시
    //   input에서 next=[]이면 _syncIcons에서 next 아이콘들이 cur로 자연스럽게 승격됨
    //=========================================================================
    Sprite_TurnOrderBar.prototype._calcTurnOrder = function () {
        var phase   = BattleManager._phase;
        var subject = BattleManager._subject;

        var partyAlive = $gameParty.battleMembers().filter(function (b) { return b.isAlive(); });
        var troopAlive = ($gameTroop.aliveMembers
            ? $gameTroop.aliveMembers()
            : $gameTroop.members().filter(function (b) { return b.isAlive(); }));
        var allAlive = partyAlive.concat(troopAlive);

        var curOrder, curSubject, curPending;

        if (phase === 'turn' || phase === 'action' || phase === 'turnEnd') {
            // done: 이번 턴에 이미 endAction을 마친 배틀러 (행동 완료 순서 유지)
            var done = _doneThisTurn.filter(function (b) {
                return allAlive.indexOf(b) >= 0;
            });
            // pending: done도 아니고 active(subject)도 아닌 배틀러
            // _actionBattlers 순서를 따르되, 없으면 allAlive 순서
            var actionBattlers = BattleManager._actionBattlers || [];
            var pending = allAlive.filter(function (b) {
                return _doneThisTurn.indexOf(b) < 0 && b !== subject;
            }).sort(function (a, b) {
                var ai = actionBattlers.indexOf(a); if (ai < 0) ai = 9999;
                var bi = actionBattlers.indexOf(b); if (bi < 0) bi = 9999;
                return ai - bi;
            });
            // subject가 이미 done에 포함되면 중복 추가하지 않음
            // (endAction 직후 subject가 아직 남아있어 중복 발생 방지)
            var subjectSlot = (subject && _doneThisTurn.indexOf(subject) < 0) ? [subject] : [];
            curOrder   = done.concat(subjectSlot).concat(pending);
            curSubject = (subject && _doneThisTurn.indexOf(subject) < 0) ? subject : null;
            curPending = pending;
        } else {
            // input / 기타: 속도 미리보기 순서 사용 (없으면 AGI 순서)
            var done2 = _doneThisTurn.filter(function (b) {
                return allAlive.indexOf(b) >= 0;
            });
            var pending2;
            if (_inputPreviewOrder && _inputPreviewOrder.length > 0) {
                pending2 = _inputPreviewOrder.filter(function (b) {
                    return allAlive.indexOf(b) >= 0 && _doneThisTurn.indexOf(b) < 0;
                });
            } else {
                pending2 = allAlive.filter(function (b) {
                    return _doneThisTurn.indexOf(b) < 0;
                }).sort(function (a, b) { return b.agi - a.agi; });
            }
            curOrder   = done2.concat(pending2);
            curSubject = null;
            curPending = pending2;
        }

        // 다음 턴 예측: 항상 표시
        // startTurn 시 턴 전환 애니메이션으로 next→cur 승격이 필요하므로
        // input phase에서도 next를 유지해야 함
        var next = allAlive.slice().sort(function (a, b) {
            if (b.agi !== a.agi) return b.agi - a.agi;
            var aKey = a.isActor() ? a.index() : 1000 + a.index();
            var bKey = b.isActor() ? b.index() : 1000 + b.index();
            return aKey - bKey;
        });

        return { curOrder: curOrder, curSubject: curSubject, curPending: curPending, next: next };
    };

    Sprite_TurnOrderBar.prototype._orderKeyOf = function (order) {
        var subKey = order.curSubject
            ? order.curSubject.name() + order.curSubject.index()
            : '-';
        return [
            order.curOrder.map(function (b) { return b.name() + b.index(); }).join(','),
            subKey,
            order.next.map(function (b) { return b.name() + b.index(); }).join(',')
        ].join('|');
    };

    Sprite_TurnOrderBar.prototype._updateOrder = function () {
        var order = this._order;
        var key   = this._orderKeyOf(order);
        if (key === this._orderKey) return;
        this._orderKey = key;
        this._syncIcons(order);
    };

    //=========================================================================
    // 배틀러 고유 키
    //=========================================================================
    Sprite_TurnOrderBar.prototype._bKey = function (battler) {
        return battler.isActor() ? 'a' + battler.actorId() : 'e' + battler.index();
    };

    //=========================================================================
    // 아이콘 동기화
    //
    // 핵심 원칙:
    //   1. 기존 'cur' 항목 재사용 (변경 없음)
    //   2. 기존 'next' 항목을 'cur'로 승격 (새 아이콘 생성 없음 → 슬라이드 없음)
    //   3. 남은 경우에만 새 아이콘 생성
    //   4. next 항목: 기존 재사용, 없으면 신규 (오른쪽에서 슬라이드 인)
    //=========================================================================
    Sprite_TurnOrderBar.prototype._syncIcons = function (order) {
        var isH  = Config.direction === 'horizontal';
        var self = this;

        // 기존 엔트리를 (bKey, role) 기준으로 분류
        var oldCur  = {};  // bKey → entry
        var oldNext = {};  // bKey → entry
        this._iconEntries.forEach(function (e) {
            var k = self._bKey(e.b);
            if (e.role === 'cur')  oldCur[k]  = e;
            else                   oldNext[k] = e;
        });

        // ── 턴 전환 애니메이션 ──
        // startTurn 시: 이전 cur 아이콘을 모두 왼쪽으로 exit,
        // oldCur를 비워서 next→cur 승격이 발생하도록 함
        if (this._turnTransition) {
            this._turnTransition = false;
            for (var tk in oldCur) {
                oldCur[tk].ic.startExit(isH);
                self._exitingIcons.push(oldCur[tk].ic);
            }
            oldCur = {};
        }

        var newEntries = [];
        var sc_next = Config.nextScale;

        // ── cur 아이콘 처리 ──
        // 기존 cur 재사용 → 없으면 기존 next 승격 (이동 애니만, 새 아이콘 아님) → 없으면 신규
        order.curOrder.forEach(function (b) {
            var s   = b === order.curSubject ? 'active' :
                      (order.curPending.indexOf(b) >= 0 ? 'pending' : 'done');
            var k   = self._bKey(b);
            var entry;

            if (oldCur[k]) {
                // 기존 cur 항목 재사용
                entry = oldCur[k];
                delete oldCur[k];
                entry.ic.setStatus(s);
                entry.ic.scale.x = 1.0; entry.ic.scale.y = 1.0;

            } else if (oldNext[k]) {
                // next → cur 승격: 아이콘 재사용, 위치는 lerp로 자연스럽게 이동
                entry = oldNext[k];
                delete oldNext[k];
                entry.role = 'cur';
                entry.ic.setStatus(s);
                // scale은 즉시 변경 (위치 lerp로 자연스러운 전환 느낌)
                entry.ic.scale.x = 1.0; entry.ic.scale.y = 1.0;

            } else {
                // 신규 생성 (배틀 중간에 소환 등 예외 케이스)
                var ic = new Sprite_TurnOrderIcon(b);
                ic.setStatus(s);
                ic.opacity = 0;
                ic._isNew  = true;
                ic.scale.x = 1.0; ic.scale.y = 1.0;
                self.addChild(ic);
                entry = { b: b, ic: ic, role: 'cur' };
            }
            newEntries.push(entry);
        });

        // ── next 아이콘 처리 ──
        // 기존 next 재사용 (cur 승격에서 사용되지 않은 것) → 없으면 신규
        order.next.forEach(function (b) {
            var k   = self._bKey(b);
            var entry;

            if (oldNext[k]) {
                // 기존 next 재사용
                entry = oldNext[k];
                delete oldNext[k];
                entry.ic.setStatus('next');
                entry.ic.scale.x = sc_next; entry.ic.scale.y = sc_next;

            } else {
                // 신규 생성 (next→cur 승격 이후 새 next 슬롯)
                var ic = new Sprite_TurnOrderIcon(b);
                ic.setStatus('next');
                ic.opacity = 0;
                ic._isNew  = true;
                ic.scale.x = sc_next; ic.scale.y = sc_next;
                self.addChild(ic);
                entry = { b: b, ic: ic, role: 'next' };
            }
            newEntries.push(entry);
        });

        // ── 남은 old 항목 처리 ──
        // curOrder에서 빠진 cur 아이콘: 살아있으면 done 유지, 죽었으면 퇴장
        var k;
        for (k in oldCur) {
            var oe = oldCur[k];
            if (oe.b.isAlive && oe.b.isAlive()) {
                oe.ic.setStatus('done');
                oe.ic.scale.x = 1.0; oe.ic.scale.y = 1.0;
                newEntries.push(oe);
            } else {
                oe.ic.startExit(isH);
                self._exitingIcons.push(oe.ic);
            }
        }
        for (k in oldNext) { oldNext[k].ic.startExit(isH); self._exitingIcons.push(oldNext[k].ic); }

        self._iconEntries = newEntries;

        // 구분선·인디케이터를 최상위로
        self.removeChild(self._divSprite);
        self.removeChild(self._indSprite);
        self.addChild(self._divSprite);
        self.addChild(self._indSprite);
    };

    // role 포함 검색
    Sprite_TurnOrderBar.prototype._findEntry = function (battler, role) {
        for (var i = 0; i < this._iconEntries.length; i++) {
            var e = this._iconEntries[i];
            if (e.b === battler && e.role === role) return e;
        }
        return null;
    };

    //=========================================================================
    // 상태 동기화 (매 프레임, role 기반)
    //=========================================================================
    Sprite_TurnOrderBar.prototype._updateIconStatuses = function () {
        var subject = BattleManager._subject;

        this._iconEntries.forEach(function (e) {
            if (e.role === 'next') {
                if (e.ic._status !== 'next') e.ic.setStatus('next');
                return;
            }
            // cur role — done이 active보다 우선
            // (endAction 직후 subject가 아직 남아있어도 done으로 처리)
            var b = e.b;
            if (_doneThisTurn.indexOf(b) >= 0) {
                if (e.ic._status !== 'done') e.ic.setStatus('done');
            } else if (b === subject) {
                if (e.ic._status !== 'active') e.ic.setStatus('active');
            } else {
                if (e.ic._status !== 'pending') e.ic.setStatus('pending');
            }
        });
    };

    //=========================================================================
    // 레이아웃
    //=========================================================================
    Sprite_TurnOrderBar.prototype._updateLayout = function () {
        var order = this._order;
        var isH   = Config.direction === 'horizontal';
        if (isH) this._layoutH(order.curOrder, order.next);
        else     this._layoutV(order.curOrder, order.next);
    };

    Sprite_TurnOrderBar.prototype._layoutH = function (curList, nextList) {
        var size = Config.iconSize, gap = Config.gap;
        var nSz  = Math.round(size * Config.nextScale);
        var lw   = Config.dividerWidth, dg = Config.dividerGap;
        var dBSz = lw > 0 ? lw + 8 : 0;
        var hasDiv = lw > 0 && curList.length > 0 && nextList.length > 0;

        var curW  = curList.length  > 0 ? curList.length  * (size + gap) - gap : 0;
        var nxtW  = nextList.length > 0 ? nextList.length * (nSz  + gap) - gap : 0;
        var midW  = hasDiv
            ? dg + dBSz + dg
            : (curList.length > 0 && nextList.length > 0 ? gap : 0);
        var total = curW + midW + nxtW;

        var sx = this._startX(total);
        var cy = this._centerY(size);
        var x  = sx;

        curList.forEach(function (b) {
            var e = this._findEntry(b, 'cur'); if (!e) return;
            this._setTarget(e.ic, x + Math.round(size / 2), cy, true);
            x += size + gap;
        }, this);

        if (hasDiv) {
            x += dg - gap;
            this._divSprite.x = x + Math.round(dBSz / 2);
            this._divSprite.y = cy;
            x += dBSz + dg;
        } else {
            this._divSprite.x = -999;
        }

        nextList.forEach(function (b) {
            var e = this._findEntry(b, 'next'); if (!e) return;
            this._setTarget(e.ic, x + Math.round(nSz / 2), cy, true);
            x += nSz + gap;
        }, this);

        this._redrawBackground(sx - 10, cy - Math.round(size / 2) - 9, total + 20, size + 18);
    };

    Sprite_TurnOrderBar.prototype._layoutV = function (curList, nextList) {
        var size = Config.iconSize, gap = Config.gap;
        var nSz  = Math.round(size * Config.nextScale);
        var lw   = Config.dividerWidth, dg = Config.dividerGap;
        var dBSz = lw > 0 ? lw + 8 : 0;
        var hasDiv = lw > 0 && curList.length > 0 && nextList.length > 0;

        var curH  = curList.length  > 0 ? curList.length  * (size + gap) - gap : 0;
        var nxtH  = nextList.length > 0 ? nextList.length * (nSz  + gap) - gap : 0;
        var midH  = hasDiv
            ? dg + dBSz + dg
            : (curList.length > 0 && nextList.length > 0 ? gap : 0);
        var total = curH + midH + nxtH;

        var cx = this._centerX(size);
        var sy = this._startY(total);
        var y  = sy;

        curList.forEach(function (b) {
            var e = this._findEntry(b, 'cur'); if (!e) return;
            this._setTarget(e.ic, cx, y + Math.round(size / 2), false);
            y += size + gap;
        }, this);

        if (hasDiv) {
            y += dg - gap;
            this._divSprite.x = cx;
            this._divSprite.y = y + Math.round(dBSz / 2);
            y += dBSz + dg;
        } else {
            this._divSprite.x = -999;
        }

        nextList.forEach(function (b) {
            var e = this._findEntry(b, 'next'); if (!e) return;
            this._setTarget(e.ic, cx, y + Math.round(nSz / 2), false);
            y += nSz + gap;
        }, this);

        this._redrawBackground(cx - Math.round(size / 2) - 9, sy - 10, size + 18, total + 20);
    };

    // _isNew인 아이콘: 항상 즉시 배치 (슬라이드 없음)
    // 단, 배틀 중간에 새로 생긴 경우(_isNew && frame > 10)만 오른쪽에서 슬라이드
    Sprite_TurnOrderBar.prototype._setTarget = function (ic, tx, ty, isH) {
        if (ic._exiting) return;
        if (ic._isNew) {
            ic._isNew = false;
            if (this._frame <= 4) {
                // 첫 배치: 즉시 표시
                ic.x = tx; ic.y = ty; ic.opacity = 255;
            } else {
                // 배틀 중 추가 (next→cur 승격 후 새 next 등): 오른쪽/아래에서 슬라이드 인
                ic.x = isH ? tx + Config.iconSize * 3 : tx;
                ic.y = isH ? ty : ty + Config.iconSize * 3;
                ic.opacity = 0;
            }
        }
        ic._targetX = tx;
        ic._targetY = ty;
    };

    //=========================================================================
    // 인디케이터 위치
    //=========================================================================
    Sprite_TurnOrderBar.prototype._updateIndicatorPos = function () {
        if (Config.indicatorStyle === 'none') return;
        var activeIc = null;
        for (var i = 0; i < this._iconEntries.length; i++) {
            var e = this._iconEntries[i];
            if (e.role === 'cur' && e.ic._status === 'active' && !e.ic._exiting) {
                activeIc = e.ic; break;
            }
        }
        if (!activeIc) { this._indSprite.visible = false; return; }

        var isH  = Config.direction === 'horizontal';
        var half = Math.round(Config.iconSize / 2);
        var pad  = 3;
        this._indSprite.visible = true;
        this._indSprite.x = isH ? activeIc.x : activeIc.x - half - pad;
        this._indSprite.y = isH ? activeIc.y - half - pad : activeIc.y;
    };

    //=========================================================================
    // 퇴장 아이콘 정리
    //=========================================================================
    Sprite_TurnOrderBar.prototype._cleanExiting = function () {
        this._exitingIcons = this._exitingIcons.filter(function (ic) {
            if (ic._exitDone) { this.removeChild(ic); return false; }
            return true;
        }, this);
    };

    //=========================================================================
    // 오버레이 (촉수 + 연결선)
    //=========================================================================
    Sprite_TurnOrderBar.prototype._updateOverlay = function () {
        if (!Config.showTentacle && !Config.showCurves) {
            this._overlayBitmap.clear();
            return;
        }
        var bmp = this._overlayBitmap;
        bmp.clear();
        var ctx = bmp._context;

        if (Config.showTentacle) this._drawTentacles(ctx);
        if (Config.showCurves)   this._drawActionCurves(ctx);
        if (Config.showCurves)   this._drawEnemyTargetPreview(ctx);

        bmp._setDirty();
    };

    Sprite_TurnOrderBar.prototype._drawTentacles = function (ctx) {
        var activeIc = null;
        for (var i = 0; i < this._iconEntries.length; i++) {
            var e = this._iconEntries[i];
            if (e.role === 'cur' && e.ic._status === 'active' && !e.ic._exiting && e.ic.opacity > 100) {
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
            var baseAngle = (i / cnt) * Math.PI * 2 + t * 0.018;
            var phase     = (i / cnt) * Math.PI * 2;
            var pulse     = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.042 + phase * 1.5));
            var len       = maxL * pulse;
            var wiggle    = Math.sin(t * 0.057 + phase * 2.1) * maxL * 0.28;
            var perpA     = baseAngle + Math.PI / 2;
            var cpx       = cx + Math.cos(baseAngle) * len * 0.5 + Math.cos(perpA) * wiggle;
            var cpy       = cy + Math.sin(baseAngle) * len * 0.5 + Math.sin(perpA) * wiggle;
            var ex        = cx + Math.cos(baseAngle) * len;
            var ey        = cy + Math.sin(baseAngle) * len;
            var alpha     = 0.12 + 0.55 * pulse;
            var lineW     = Math.max(0.4, 1.6 * (1.0 - pulse * 0.25));

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.quadraticCurveTo(cpx, cpy, ex, ey);
            ctx.strokeStyle = withAlpha(col, alpha);
            ctx.lineWidth   = lineW;
            ctx.stroke();
        }

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

    Sprite_TurnOrderBar.prototype._drawActionCurves = function (ctx) {
        if (BattleManager._phase !== 'action') return;
        var subject = BattleManager._subject;
        var targets = BattleManager._targets || [];
        if (!subject || targets.length === 0) return;

        var subEntry = this._findEntry(subject, 'cur');
        if (!subEntry || subEntry.ic._exiting) return;

        var action    = subject.currentAction ? subject.currentAction() : null;
        var color     = this._curveColor(action);
        var iconIndex = (action && action.item()) ? action.item().iconIndex : -1;
        var isH       = Config.direction === 'horizontal';
        var half      = Math.round(Config.iconSize / 2);

        targets.forEach(function (target) {
            var tEntry = this._findEntry(target, 'cur');
            if (!tEntry || tEntry.ic._exiting) return;

            var sx = subEntry.ic.x, sy = subEntry.ic.y;
            var tx = tEntry.ic.x,   ty = tEntry.ic.y;

            if (isH) {
                var p1x = sx, p1y = sy + half + 4;
                var p2x = tx, p2y = ty + half + 4;
                var drop = Math.max(20, Math.abs(p2x - p1x) * 0.35);
                this._strokeBezier(ctx, p1x, p1y,
                    p1x + (p2x-p1x)*0.25, p1y + drop,
                    p1x + (p2x-p1x)*0.75, p2y + drop,
                    p2x, p2y, color, iconIndex);
            } else {
                var p1x = sx + half + 4, p1y = sy;
                var p2x = tx + half + 4, p2y = ty;
                var drift = Math.max(20, Math.abs(p2y - p1y) * 0.35);
                this._strokeBezier(ctx, p1x, p1y,
                    p1x + drift, p1y + (p2y-p1y)*0.25,
                    p2x + drift, p1y + (p2y-p1y)*0.75,
                    p2x, p2y, color, iconIndex);
            }
        }, this);
    };

    Sprite_TurnOrderBar.prototype._strokeBezier = function (ctx, x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1, color, iconIndex) {
        var lw = Config.curveWidth;

        // 배경(두꺼운) + 전경(본선)
        ctx.save();
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
        ctx.strokeStyle = withAlpha(color, 0.25);
        ctx.lineWidth   = lw * 3.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
        ctx.strokeStyle = color;
        ctx.lineWidth   = lw;
        ctx.stroke();
        ctx.restore();

        // 시작점 원형 도트
        ctx.beginPath();
        ctx.arc(x0, y0, lw + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();

        // 끝점 화살표 (베지어 접선 방향)
        var arrowAngle = Math.atan2(y1 - cp2y, x1 - cp2x);
        var aLen = lw * 4 + 8;
        ctx.save();
        ctx.translate(x1, y1);
        ctx.rotate(arrowAngle);
        ctx.beginPath();
        ctx.moveTo(aLen, 0);
        ctx.lineTo(-aLen * 0.55, aLen * 0.48);
        ctx.lineTo(-aLen * 0.3,  0);
        ctx.lineTo(-aLen * 0.55, -aLen * 0.48);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();

        // 베지어 중점(t=0.5)에 액션 아이콘
        if (iconIndex != null && iconIndex >= 0) {
            var mx = 0.125*x0 + 0.375*cp1x + 0.375*cp2x + 0.125*x1;
            var my = 0.125*y0 + 0.375*cp1y + 0.375*cp2y + 0.125*y1;
            var iconR  = lw * 3 + 11;
            var iconSz = 32;
            var srcX   = (iconIndex % 16) * iconSz;
            var srcY   = Math.floor(iconIndex / 16) * iconSz;
            var iconBmp = ImageManager.loadSystem('IconSet');
            if (iconBmp && iconBmp.isReady()) {
                ctx.save();
                // 원형 배경
                ctx.beginPath();
                ctx.arc(mx, my, iconR, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill();
                ctx.strokeStyle = withAlpha(color, 0.85);
                ctx.lineWidth = 1.5; ctx.stroke();
                // 아이콘 클리핑 후 그리기
                ctx.beginPath();
                ctx.arc(mx, my, iconR - 1, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(iconBmp._canvas,
                    srcX, srcY, iconSz, iconSz,
                    mx - iconR, my - iconR, iconR * 2, iconR * 2);
                ctx.restore();
            }
        }
    };

    Sprite_TurnOrderBar.prototype._drawEnemyTargetPreview = function (ctx) {
        if (!_enemyTargetPreview) return;
        var self = this;
        var isH  = Config.direction === 'horizontal';
        var half = Math.round(Config.iconSize / 2);
        var subject = BattleManager._subject;

        $gameTroop.aliveMembers().forEach(function (enemy) {
            // 행동 완료했거나 현재 행동중인 적은 건너뛰기
            if (_doneThisTurn.indexOf(enemy) >= 0) return;
            if (subject === enemy && BattleManager._phase === 'action') return;
            var info = _enemyTargetPreview[enemy.index()];
            if (!info || !info.targets.length) return;
            var eEntry = self._findEntry(enemy, 'cur');
            if (!eEntry || eEntry.ic._exiting) return;

            var color     = withAlpha(self._curveColor(info.action), 0.6);
            var iconIndex = info.action.item() ? info.action.item().iconIndex : -1;

            info.targets.forEach(function (target) {
                var tEntry = self._findEntry(target, 'cur');
                if (!tEntry || tEntry.ic._exiting) return;

                var sx = eEntry.ic.x, sy = eEntry.ic.y;
                var tx = tEntry.ic.x, ty = tEntry.ic.y;

                if (isH) {
                    var p1y = sy + half + 4, p2y = ty + half + 4;
                    var drop = Math.max(20, Math.abs(tx - sx) * 0.35);
                    self._strokeBezier(ctx, sx, p1y,
                        sx + (tx-sx)*0.25, p1y + drop,
                        sx + (tx-sx)*0.75, p2y + drop,
                        tx, p2y, color, iconIndex);
                } else {
                    var p1x = sx + half + 4, p2x = tx + half + 4;
                    var drift = Math.max(20, Math.abs(ty - sy) * 0.35);
                    self._strokeBezier(ctx, p1x, sy,
                        p1x + drift, sy + (ty-sy)*0.25,
                        p2x + drift, sy + (ty-sy)*0.75,
                        p2x, ty, color, iconIndex);
                }
            });
        });
    };

    Sprite_TurnOrderBar.prototype._curveColor = function (action) {
        if (!action || !action.item()) return Config.curveOther;
        if (action.isAttack && action.isAttack()) return Config.curveAttack;
        if (action.isItem  && action.isItem())   return Config.curveItem;
        var item = action.item();
        if (item.hitType === 2) return Config.curveMagic;
        if (action.isMagicSkill && action.isMagicSkill()) return Config.curveMagic;
        if (action.isForFriend && action.isForFriend()) return Config.curveHeal;
        return Config.curveOther;
    };

    //=========================================================================
    // 배경 패널
    //=========================================================================
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
        ctx.quadraticCurveTo(bx+bw, by, bx+bw, by+r);
        ctx.lineTo(bx+bw, by+bh-r);
        ctx.quadraticCurveTo(bx+bw, by+bh, bx+bw-r, by+bh);
        ctx.lineTo(bx+r, by+bh);
        ctx.quadraticCurveTo(bx, by+bh, bx, by+bh-r);
        ctx.lineTo(bx, by+r);
        ctx.quadraticCurveTo(bx, by, bx+r, by);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.restore();
        bmp._setDirty();
    };

    //=========================================================================
    // 위치 계산 헬퍼
    //=========================================================================
    Sprite_TurnOrderBar.prototype._startX = function (totalW) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('right') >= 0 && pos.indexOf('left') < 0) return Graphics.width - totalW - m;
        if (pos.indexOf('left')  >= 0 && pos.indexOf('right') < 0) return m;
        return Math.round((Graphics.width - totalW) / 2);
    };
    Sprite_TurnOrderBar.prototype._centerY = function (s) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('bottom') >= 0) return Graphics.height - m - Math.round(s / 2);
        if (pos === 'left-center' || pos === 'right-center') return Math.round(Graphics.height / 2);
        return m + Math.round(s / 2);
    };
    Sprite_TurnOrderBar.prototype._centerX = function (s) {
        var pos = Config.position, m = Config.margin;
        if (pos.indexOf('right') >= 0) return Graphics.width - m - Math.round(s / 2);
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
            case 'show':      Config.visible = true;  break;
            case 'hide':      Config.visible = false; break;
            case 'direction':
                if (val === 'horizontal' || val === 'vertical') Config.direction = val;
                break;
            case 'position':  Config.position = val;  break;
            case 'iconsize':
                n = parseInt(val, 10);
                if (!isNaN(n) && n >= 20) Config.iconSize = n;
                break;
            case 'indicator': Config.indicatorStyle = val; break;
            case 'clip':      Config.clipShape = val;       break;
            case 'curves':
                Config.showCurves   = (val === 'on' || val === 'true'); break;
            case 'tentacle':
                Config.showTentacle = (val === 'on' || val === 'true'); break;
        }
    };

})();
