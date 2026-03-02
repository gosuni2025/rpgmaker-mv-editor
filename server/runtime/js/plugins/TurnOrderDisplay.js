//=============================================================================
// TurnOrderDisplay.js
// 전투 씬 턴 순서 아이콘 바 표시 플러그인
//
// 기능:
//   - 화면 상단 중앙에 현재 턴 행동 순서 + 다음 턴 예측 아이콘 표시
//   - 액터: 얼굴 이미지, 몬스터: 적 이미지 원형 아이콘
//   - 행동 완료한 배틀러: 반투명
//   - 현재 행동 중인 배틀러: 황금 테두리 + 확대
//   - 구분선(▶) 이후: 다음 턴 예측 (agility 기준, 약간 작게)
//=============================================================================

/*:
 * @plugindesc 전투 화면 상단에 턴 순서 아이콘 바를 표시합니다.
 * @author Claude
 *
 * @param iconSize
 * @text 아이콘 크기 (px)
 * @type number
 * @min 24
 * @max 80
 * @default 52
 *
 * @param barY
 * @text 상단 여백 (px)
 * @type number
 * @min 0
 * @max 100
 * @default 8
 *
 * @param nextScale
 * @text 다음 턴 아이콘 크기 비율
 * @desc 현재 턴 아이콘 대비 다음 턴 아이콘의 크기 비율 (0.5~1.0)
 * @type number
 * @decimals 2
 * @min 0.5
 * @max 1.0
 * @default 0.75
 *
 * @help
 * 전투 화면 상단에 현재 턴 행동 순서와 다음 턴 예측을 아이콘으로 표시합니다.
 *
 * - 큰 원형 아이콘: 현재 턴 배틀러 (행동 완료자는 반투명)
 * - 황금 테두리: 현재 행동 중인 배틀러
 * - ▶ 이후 작은 아이콘: 다음 턴 예측 (agility 기준 정렬)
 */

(function () {
    'use strict';

    var params    = PluginManager.parameters('TurnOrderDisplay');
    var ICON_SIZE  = parseInt(params['iconSize']  || 52);
    var BAR_Y      = parseInt(params['barY']      || 8);
    var NEXT_SCALE = parseFloat(params['nextScale'] || 0.75);
    var GAP        = 4;
    var DIV_GAP    = 10;

    //=========================================================================
    // Sprite_TurnOrderIcon — 배틀러 1명의 원형 아이콘
    //=========================================================================
    function Sprite_TurnOrderIcon() {
        this.initialize.apply(this, arguments);
    }

    Sprite_TurnOrderIcon.prototype = Object.create(Sprite.prototype);
    Sprite_TurnOrderIcon.prototype.constructor = Sprite_TurnOrderIcon;

    Sprite_TurnOrderIcon.prototype.initialize = function (battler) {
        Sprite.prototype.initialize.call(this);
        this._battler  = battler;
        this._status   = 'pending'; // 'done' | 'active' | 'pending' | 'next'
        this._imgReady = false;
        this.anchor.x  = 0.5;
        this.anchor.y  = 0.5;
        this.bitmap    = new Bitmap(ICON_SIZE, ICON_SIZE);

        if (battler.isActor()) {
            this._srcBitmap = ImageManager.loadFace(battler.faceName());
        } else {
            var bName = battler.enemy().battlerName();
            var bHue  = battler.enemy().battlerHue();
            this._srcBitmap = ImageManager.loadEnemy(bName, bHue);
        }
    };

    Sprite_TurnOrderIcon.prototype.update = function () {
        Sprite.prototype.update.call(this);

        if (!this._imgReady && this._srcBitmap.isReady()) {
            this._imgReady = true;
            this._redraw();
        }

        // opacity 스무딩 (done: 80, 나머지: 255)
        var target = this._status === 'done' ? 80 : 255;
        var diff   = target - this.opacity;
        if (Math.abs(diff) > 3) {
            this.opacity += Math.sign(diff) * Math.max(6, Math.abs(diff) * 0.18);
        } else {
            this.opacity = target;
        }
    };

    Sprite_TurnOrderIcon.prototype.setStatus = function (status) {
        if (this._status === status) return;
        this._status = status;
        if (this._imgReady) this._redraw();
    };

    Sprite_TurnOrderIcon.prototype._redraw = function () {
        var bmp  = this.bitmap;
        var size = ICON_SIZE;
        var ctx  = bmp._context;
        var src  = this._srcBitmap;

        ctx.clearRect(0, 0, size, size);

        // ── 1. 원형 클리핑 & 배경 ─────────────────────────────────────────
        var isActor = this._battler.isActor();
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.clip();

        // 배경색 (actor: 파란 계열, enemy: 붉은 계열)
        var bg1 = isActor ? '#1a2a4a' : '#3a1a1a';
        var bg2 = isActor ? '#0d1828' : '#280d0d';
        var grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, bg1);
        grad.addColorStop(1, bg2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        // ── 2. 이미지 그리기 ─────────────────────────────────────────────
        if (isActor) {
            // Face 이미지: 4열 2행, 각 96×96
            var fi  = this._battler.faceIndex();
            var fx  = (fi % 4) * 96;
            var fy  = Math.floor(fi / 4) * 96;
            ctx.drawImage(src._canvas, fx, fy, 96, 96, 0, 0, size, size);
        } else {
            // Enemy 이미지: 비율 유지하며 90% 크기로 축소 (여백 남김)
            var sw  = src.width;
            var sh  = src.height;
            var fit = Math.min((size * 0.9) / sw, (size * 0.9) / sh);
            var dw  = sw * fit;
            var dh  = sh * fit;
            ctx.drawImage(src._canvas, 0, 0, sw, sh,
                (size - dw) / 2, (size - dh) / 2, dw, dh);
        }

        ctx.restore();

        // ── 3. 테두리 ────────────────────────────────────────────────────
        var borderColor, borderWidth;
        if (this._status === 'active') {
            borderColor = '#ffdd44';
            borderWidth = 3;
        } else if (this._status === 'done') {
            borderColor = 'rgba(200,200,200,0.25)';
            borderWidth = 1.5;
        } else if (this._status === 'next') {
            borderColor = 'rgba(120,180,255,0.5)';
            borderWidth = 1.5;
        } else {
            borderColor = 'rgba(255,255,255,0.65)';
            borderWidth = 2;
        }

        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - borderWidth / 2, 0, Math.PI * 2);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth   = borderWidth;
        ctx.stroke();

        // ── 4. active: 황금 글로우 ────────────────────────────────────────
        if (this._status === 'active') {
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,220,50,0.35)';
            ctx.lineWidth   = 7;
            ctx.stroke();
        }

        bmp._setDirty();
    };

    //=========================================================================
    // Sprite_TurnOrderBar — 전체 턴 순서 바
    //=========================================================================
    function Sprite_TurnOrderBar() {
        this.initialize.apply(this, arguments);
    }

    Sprite_TurnOrderBar.prototype = Object.create(Sprite.prototype);
    Sprite_TurnOrderBar.prototype.constructor = Sprite_TurnOrderBar;

    Sprite_TurnOrderBar.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        this._curIcons  = [];
        this._nextIcons = [];
        this._orderKey  = '';
        this._frame     = 0;

        // 반투명 배경 패널
        this._bgBitmap = new Bitmap(Graphics.width, ICON_SIZE + 18);
        this._bgSprite = new Sprite(this._bgBitmap);
        this._bgSprite.x = 0;
        this._bgSprite.y = BAR_Y - 9;
        this.addChild(this._bgSprite);

        // 구분선(▶ 모양)
        this._divider = this._createDivider();
        this.addChild(this._divider);
    };

    Sprite_TurnOrderBar.prototype._createDivider = function () {
        var h   = ICON_SIZE;
        var bmp = new Bitmap(14, h);
        var ctx = bmp._context;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth   = 2;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo(3,   h / 2 - 6);
        ctx.lineTo(11,  h / 2);
        ctx.lineTo(3,   h / 2 + 6);
        ctx.stroke();
        bmp._setDirty();
        var sp    = new Sprite(bmp);
        sp.anchor.y = 0.5;
        return sp;
    };

    // ── 업데이트 ─────────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype.update = function () {
        Sprite.prototype.update.call(this);

        var phase = BattleManager._phase;
        if (!$gameParty || !$gameTroop || !phase) {
            this.visible = false;
            return;
        }
        this.visible = true;
        this._frame++;

        // 8프레임마다 순서 재계산
        if (this._frame % 8 === 0 || this._frame <= 3) {
            this._updateOrder();
        }
        this._updateIconStatuses();
        this._updateLayout();
    };

    // ── 턴 순서 계산 ────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._calcTurnOrder = function () {
        var subject = BattleManager._subject;
        var pending = (BattleManager._actionBattlers || []).slice();
        var phase   = BattleManager._phase;

        var partyAlive = $gameParty.battleMembers().filter(function (b) {
            return b.isAlive();
        });
        var troopAlive = ($gameTroop.aliveMembers
            ? $gameTroop.aliveMembers()
            : $gameTroop.members().filter(function (b) { return b.isAlive(); })
        );
        var allAlive = partyAlive.concat(troopAlive);

        // input 페이즈에서는 _actionBattlers가 비어있으므로 현재 턴 섹션 비움
        var showCurrent = (phase === 'turn' || phase === 'action') &&
                          (pending.length > 0 || !!subject);

        var done = showCurrent
            ? allAlive.filter(function (b) {
                  return pending.indexOf(b) < 0 && b !== subject;
              })
            : [];

        // 다음 턴 예측: 생존 배틀러 agi 내림차순
        var next = allAlive.slice().sort(function (a, b) {
            return b.agi - a.agi;
        });

        return {
            subject: showCurrent ? subject : null,
            pending: showCurrent ? pending : [],
            done:    done,
            next:    next
        };
    };

    Sprite_TurnOrderBar.prototype._orderKeyOf = function (order) {
        return [
            order.subject ? order.subject.name() : '-',
            order.done.map(function (b) { return b.name(); }).join(','),
            order.pending.map(function (b) { return b.name(); }).join(','),
            order.next.map(function (b) { return b.name(); }).join(',')
        ].join('|');
    };

    Sprite_TurnOrderBar.prototype._updateOrder = function () {
        var order = this._calcTurnOrder();
        var key   = this._orderKeyOf(order);
        if (key === this._orderKey) return;
        this._orderKey = key;
        this._rebuildIcons(order);
    };

    Sprite_TurnOrderBar.prototype._rebuildIcons = function (order) {
        this._curIcons.forEach(function (ic) { this.removeChild(ic); }, this);
        this._nextIcons.forEach(function (ic) { this.removeChild(ic); }, this);
        this._curIcons  = [];
        this._nextIcons = [];

        // 현재 턴: done → active(subject) → pending 순
        order.done.forEach(function (b) {
            var ic = new Sprite_TurnOrderIcon(b);
            ic.setStatus('done');
            ic.opacity = 80;
            this.addChild(ic);
            this._curIcons.push(ic);
        }, this);

        if (order.subject) {
            var subIc = new Sprite_TurnOrderIcon(order.subject);
            subIc.setStatus('active');
            this.addChild(subIc);
            this._curIcons.push(subIc);
        }

        order.pending.forEach(function (b) {
            var ic = new Sprite_TurnOrderIcon(b);
            ic.setStatus('pending');
            this.addChild(ic);
            this._curIcons.push(ic);
        }, this);

        // 다음 턴 예측
        order.next.forEach(function (b) {
            var ic = new Sprite_TurnOrderIcon(b);
            ic.setStatus('next');
            ic.scale.x = NEXT_SCALE;
            ic.scale.y = NEXT_SCALE;
            this.addChild(ic);
            this._nextIcons.push(ic);
        }, this);

        // 구분선을 항상 최상단 z-order로
        this.removeChild(this._divider);
        this.addChild(this._divider);
    };

    Sprite_TurnOrderBar.prototype._updateIconStatuses = function () {
        var subject = BattleManager._subject;
        var pending = BattleManager._actionBattlers || [];

        this._curIcons.forEach(function (ic) {
            var b = ic._battler;
            if (b === subject) {
                ic.setStatus('active');
            } else if (pending.indexOf(b) >= 0) {
                ic.setStatus('pending');
            } else {
                ic.setStatus('done');
            }
        });
    };

    // ── 레이아웃 배치 ────────────────────────────────────────────────────────

    Sprite_TurnOrderBar.prototype._updateLayout = function () {
        var nextSz   = Math.round(ICON_SIZE * NEXT_SCALE);
        var hasNext  = this._nextIcons.length > 0;
        var hasCur   = this._curIcons.length  > 0;

        var curW  = hasCur  ? this._curIcons.length  * (ICON_SIZE + GAP) - GAP : 0;
        var nextW = hasNext ? this._nextIcons.length * (nextSz    + GAP) - GAP : 0;
        var divW  = (hasCur && hasNext) ? 14 + DIV_GAP * 2 : 0;
        var totalW = curW + divW + nextW;
        if (totalW <= 0) {
            this._bgBitmap.clear();
            this._divider.x = -999;
            return;
        }

        var startX  = Math.round((Graphics.width - totalW) / 2);
        var centerY = BAR_Y + Math.round(ICON_SIZE / 2);
        var x       = startX;

        // 현재 턴 아이콘
        this._curIcons.forEach(function (ic) {
            ic.x = x + Math.round(ICON_SIZE / 2);
            ic.y = centerY;
            x += ICON_SIZE + GAP;
        });

        // 구분선
        if (hasCur && hasNext) {
            x += DIV_GAP - GAP;
            this._divider.x = x;
            this._divider.y = centerY;
            x += 14 + DIV_GAP;
        } else {
            this._divider.x = -999;
        }

        // 다음 턴 아이콘
        this._nextIcons.forEach(function (ic) {
            ic.x = x + Math.round(nextSz / 2);
            ic.y = centerY;
            x += nextSz + GAP;
        });

        // 배경 패널 갱신
        this._redrawBackground(startX - 10, totalW + 20);
    };

    Sprite_TurnOrderBar.prototype._redrawBackground = function (bx, bw) {
        var bmp = this._bgBitmap;
        bmp.clear();
        if (bw <= 0) return;

        var bh  = ICON_SIZE + 18;
        var ctx = bmp._context;
        var r   = 10;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(bx + r,      0);
        ctx.lineTo(bx + bw - r, 0);
        ctx.quadraticCurveTo(bx + bw, 0,  bx + bw, r);
        ctx.lineTo(bx + bw,     bh - r);
        ctx.quadraticCurveTo(bx + bw, bh, bx + bw - r, bh);
        ctx.lineTo(bx + r,      bh);
        ctx.quadraticCurveTo(bx, bh, bx, bh - r);
        ctx.lineTo(bx,          r);
        ctx.quadraticCurveTo(bx, 0, bx + r, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.restore();

        bmp._setDirty();
    };

    //=========================================================================
    // Scene_Battle — 최상위 레이어에 턴 순서 바 추가
    //=========================================================================
    var _Scene_Battle_createSpriteset = Scene_Battle.prototype.createSpriteset;
    Scene_Battle.prototype.createSpriteset = function () {
        _Scene_Battle_createSpriteset.call(this);
        this._turnOrderBar = new Sprite_TurnOrderBar();
        this.addChild(this._turnOrderBar);
    };

})();
