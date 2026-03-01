//=============================================================================
// EnemyHPBar.js
// 전투 씬 적 체력바 표시 플러그인 (Three.js 런타임 전용)
//
// 기능:
//   - 각 적 이미지 상단에 체력바 표시
//   - HP 비율에 따라 녹색 → 노랑 → 빨강 그라디언트
//   - 다크소울 스타일 지연 감소 (황금색 잔상 바)
//   - 버프/디버프 상태 아이콘 체력바 위에 일렬 표시
//=============================================================================

/*:
 * @plugindesc 적 체력바 표시 (지연 감소 + 버프/디버프 아이콘)
 * @author Claude
 *
 * @param barHeight
 * @text 바 높이
 * @type number
 * @min 4
 * @max 32
 * @default 10
 *
 * @param barOffset
 * @text 이미지 위 여백
 * @desc 체력바를 적 이미지 상단에서 얼마나 위에 배치할지 (px)
 * @type number
 * @min 0
 * @max 40
 * @default 6
 *
 * @param iconSize
 * @text 아이콘 크기
 * @type number
 * @min 12
 * @max 32
 * @default 22
 *
 * @param maxIcons
 * @text 최대 아이콘 수
 * @type number
 * @min 1
 * @max 20
 * @default 10
 *
 * @param delaySpeed
 * @text 지연 감소 속도
 * @desc 초당 감소 비율 (1.0 = 1초에 100% 감소, 0.5 = 2초에 100%)
 * @type number
 * @decimals 2
 * @min 0.1
 * @max 5.0
 * @default 0.6
 *
 * @help
 * 전투 씬에서 각 적 이미지 위에 체력바를 표시합니다.
 *
 * - HP가 줄면 먼저 현재 HP 바가 즉시 줄어들고,
 *   황금색 지연 바가 천천히 따라옵니다 (다크소울 스타일).
 * - 버프/디버프 상태 아이콘은 체력바 바로 위에 일렬로 표시됩니다.
 * - 기존 회전 상태 아이콘(Sprite_StateIcon)은 자동으로 숨겨집니다.
 */

(function () {
    'use strict';

    var params = PluginManager.parameters('EnemyHPBar');
    var BAR_HEIGHT  = parseInt(params['barHeight']  || 10);
    var BAR_OFFSET  = parseInt(params['barOffset']  || 6);
    var ICON_SIZE   = parseInt(params['iconSize']   || 22);
    var MAX_ICONS   = parseInt(params['maxIcons']   || 10);
    var DELAY_SPEED = parseFloat(params['delaySpeed'] || 0.6);

    //-------------------------------------------------------------------------
    // HP 비율에 따른 색상 (0.0~1.0)
    //-------------------------------------------------------------------------
    function hpBarColor(rate) {
        var r, g;
        if (rate >= 0.5) {
            // 녹색(0,255,0) → 노랑(255,255,0)
            r = Math.round((1.0 - rate) * 2 * 255);
            g = 255;
        } else {
            // 노랑(255,255,0) → 빨강(255,0,0)
            r = 255;
            g = Math.round(rate * 2 * 255);
        }
        return 'rgb(' + r + ',' + g + ',0)';
    }

    //=========================================================================
    // Sprite_EnemyHPBar
    //=========================================================================
    function Sprite_EnemyHPBar() {
        this.initialize.apply(this, arguments);
    }

    Sprite_EnemyHPBar.prototype = Object.create(Sprite.prototype);
    Sprite_EnemyHPBar.prototype.constructor = Sprite_EnemyHPBar;

    Sprite_EnemyHPBar.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        this._battler     = null;
        this._currRate    = 1.0;  // 현재 HP 비율 (즉시 반영)
        this._delayRate   = 1.0;  // 지연 바 비율 (천천히 따라옴)
        this._barWidth    = 0;
        this._iconsKey    = '';
        this._needsRefresh = false;
        this.anchor.x = 0.5;
        this.anchor.y = 1.0;
        this.bitmap = new Bitmap(1, 1);
    };

    Sprite_EnemyHPBar.prototype.setup = function (battler) {
        this._battler   = battler;
        this._currRate  = battler.hpRate();
        this._delayRate = battler.hpRate();
        this._iconsKey  = '';
        this._needsRefresh = true;
    };

    Sprite_EnemyHPBar.prototype.update = function () {
        Sprite.prototype.update.call(this);
        if (!this._battler) return;

        this.updateHPRates();
        this.updateIconsDirty();
        this.updateBarWidth();
        this.updateVisibility();
        this.updateBarY();

        if (this._needsRefresh) {
            this.refresh();
            this._needsRefresh = false;
        }
    };

    Sprite_EnemyHPBar.prototype.updateHPRates = function () {
        var newRate = this._battler.hpRate();

        // HP 감소: 현재 바는 즉시, 지연 바는 서서히
        if (newRate < this._delayRate) {
            this._delayRate -= DELAY_SPEED / 60;
            if (this._delayRate < newRate) this._delayRate = newRate;
            this._needsRefresh = true;
        }
        // HP 회복: 지연 바도 즉시 동기화
        if (newRate > this._delayRate) {
            this._delayRate = newRate;
            this._needsRefresh = true;
        }
        if (newRate !== this._currRate) {
            this._currRate = newRate;
            this._needsRefresh = true;
        }
    };

    Sprite_EnemyHPBar.prototype.updateIconsDirty = function () {
        var key = this._battler.allIcons().join(',');
        if (key !== this._iconsKey) {
            this._iconsKey = key;
            this._needsRefresh = true;
        }
    };

    Sprite_EnemyHPBar.prototype.updateBarWidth = function () {
        var parent = this.parent;
        if (!parent || !parent.bitmap || !parent.bitmap.isReady()) return;
        var w = Math.max(parent.bitmap.width, 80);
        if (w !== this._barWidth) {
            this._barWidth = w;
            this._needsRefresh = true;
        }
    };

    Sprite_EnemyHPBar.prototype.updateBarY = function () {
        var parent = this.parent;
        if (!parent || !parent.bitmap || !parent.bitmap.isReady()) return;
        this.y = -parent.bitmap.height - BAR_OFFSET;
    };

    Sprite_EnemyHPBar.prototype.updateVisibility = function () {
        var b = this._battler;
        var parent = this.parent;
        this.visible = !!(b && b.isAlive() && parent && parent._appeared);
    };

    Sprite_EnemyHPBar.prototype.refresh = function () {
        if (this._barWidth <= 0) return;

        var icons = this._battler ? this._battler.allIcons().slice(0, MAX_ICONS) : [];
        var barW  = this._barWidth;
        var barH  = BAR_HEIGHT;
        var iconH = icons.length > 0 ? ICON_SIZE + 2 : 0;
        var totalH = iconH + barH + 2;  // +2 하단 여유

        // 크기가 바뀌면 비트맵 재생성
        if (!this.bitmap || this.bitmap.width !== barW || this.bitmap.height !== totalH) {
            this.bitmap = new Bitmap(barW, totalH);
        }

        var bmp = this.bitmap;
        bmp.clear();

        // ── 아이콘 그리기 ──────────────────────────────────────────────────
        if (icons.length > 0) {
            var iconSet = ImageManager.loadSystem('IconSet');
            if (iconSet.isReady()) {
                var srcSz = Window_Base._iconWidth || 32;
                var cols  = Math.floor(iconSet.width / srcSz);
                for (var i = 0; i < icons.length; i++) {
                    var idx = icons[i];
                    var sx  = (idx % cols) * srcSz;
                    var sy  = Math.floor(idx / cols) * srcSz;
                    var dx  = i * (ICON_SIZE + 1);
                    bmp.blt(iconSet, sx, sy, srcSz, srcSz, dx, 0, ICON_SIZE, ICON_SIZE);
                }
            }
        }

        // ── 체력바 그리기 ──────────────────────────────────────────────────
        var by = iconH;

        // 배경 (어두운 회색)
        bmp.fillRect(0, by, barW, barH, '#1a1a1a');

        // 지연 바 (황금색 잔상)
        var delayW = Math.floor(barW * Math.max(0, Math.min(1, this._delayRate)));
        if (delayW > 0) {
            bmp.fillRect(0, by, delayW, barH, '#c8920a');
        }

        // 현재 HP 바 (녹색~빨강 그라디언트)
        var currW = Math.floor(barW * Math.max(0, Math.min(1, this._currRate)));
        if (currW > 0) {
            bmp.fillRect(0, by, currW, barH, hpBarColor(this._currRate));
        }

        // 테두리 (1px)
        var bc = '#000000';
        bmp.fillRect(0,         by,          barW, 1,    bc);
        bmp.fillRect(0,         by + barH-1, barW, 1,    bc);
        bmp.fillRect(0,         by,          1,    barH, bc);
        bmp.fillRect(barW - 1,  by,          1,    barH, bc);
    };

    //=========================================================================
    // Sprite_Enemy — HP 바 추가 오버라이드
    //=========================================================================
    var _Sprite_Enemy_initMembers = Sprite_Enemy.prototype.initMembers;
    Sprite_Enemy.prototype.initMembers = function () {
        _Sprite_Enemy_initMembers.call(this);
        this._hpBarSprite = new Sprite_EnemyHPBar();
        this.addChild(this._hpBarSprite);
    };

    var _Sprite_Enemy_setBattler = Sprite_Enemy.prototype.setBattler;
    Sprite_Enemy.prototype.setBattler = function (battler) {
        _Sprite_Enemy_setBattler.call(this, battler);
        if (battler) {
            this._hpBarSprite.setup(battler);
            // 기존 회전 상태 아이콘 숨김 (HP 바에 통합)
            if (this._stateIconSprite) {
                this._stateIconSprite.visible = false;
            }
        }
    };

    //=========================================================================
    // 툴팁 시스템
    //=========================================================================
    var _tooltipEl = null;

    function ensureTooltip() {
        if (_tooltipEl) return;
        _tooltipEl = document.createElement('div');
        _tooltipEl.id = 'ehpbar-tooltip';
        _tooltipEl.style.cssText = [
            'position:fixed',
            'display:none',
            'background:rgba(10,10,10,0.92)',
            'border:1px solid #555',
            'border-radius:5px',
            'padding:7px 11px',
            'color:#eee',
            'font-size:13px',
            'line-height:1.55',
            'pointer-events:none',
            'z-index:99999',
            'max-width:240px',
            'box-shadow:0 3px 10px rgba(0,0,0,0.7)'
        ].join(';');
        document.body.appendChild(_tooltipEl);
    }

    function showTooltip(mx, my, html) {
        ensureTooltip();
        _tooltipEl.innerHTML = html;
        _tooltipEl.style.display = 'block';
        var tw = _tooltipEl.offsetWidth;
        var th = _tooltipEl.offsetHeight;
        var tx = mx + 16;
        var ty = my - 10;
        if (tx + tw > window.innerWidth)  tx = mx - tw - 8;
        if (ty + th > window.innerHeight) ty = my - th - 8;
        if (ty < 0) ty = 4;
        _tooltipEl.style.left = tx + 'px';
        _tooltipEl.style.top  = ty + 'px';
    }

    function hideTooltip() {
        if (_tooltipEl) _tooltipEl.style.display = 'none';
    }

    //-------------------------------------------------------------------------
    // 아이콘 인덱스(표시 순서) → 이름/설명/남은 턴 정보 반환
    //-------------------------------------------------------------------------
    function getIconInfo(battler, iconIdx) {
        // stateIcons 순서대로 먼저 확인
        var stateList = battler.states().filter(function (s) {
            return s.iconIndex > 0;
        });
        if (iconIdx < stateList.length) {
            var st = stateList[iconIdx];
            var turns = battler._stateTurns ? battler._stateTurns[st.id] : undefined;
            return {
                name:  st.name,
                desc:  (st.note || '').trim(),
                turns: (turns > 0) ? turns : null
            };
        }
        // buffIcons 확인 (파라미터 인덱스 순)
        var buffOrd = iconIdx - stateList.length;
        var cnt = 0;
        for (var i = 0; i < (battler._buffs ? battler._buffs.length : 0); i++) {
            if (battler._buffs[i] !== 0) {
                if (cnt === buffOrd) {
                    var t = battler._buffTurns ? battler._buffTurns[i] : null;
                    return {
                        name:  TextManager.param(i) + (battler._buffs[i] > 0 ? ' 상승' : ' 하락'),
                        desc:  '',
                        turns: (t > 0) ? t : null
                    };
                }
                cnt++;
            }
        }
        return null;
    }

    //-------------------------------------------------------------------------
    // 마우스 좌표에서 아이콘 스프라이트 히트 테스트
    //-------------------------------------------------------------------------
    function findIconAtMouse(mx, my) {
        if (!(SceneManager._scene instanceof Scene_Battle)) return null;
        var spriteset = SceneManager._scene._spriteset;
        if (!spriteset || !spriteset._enemySprites) return null;

        var canvas = Graphics._canvas || document.querySelector('canvas');
        if (!canvas) return null;
        var rect = canvas.getBoundingClientRect();
        var sx = rect.width  / Graphics.width;
        var sy = rect.height / Graphics.height;

        var sprites = spriteset._enemySprites;
        for (var si = 0; si < sprites.length; si++) {
            var spr = sprites[si];
            var bar = spr._hpBarSprite;
            if (!bar || !bar.visible || !bar.bitmap || !bar._battler) continue;

            var icons = bar._battler.allIcons().slice(0, MAX_ICONS);
            if (icons.length === 0) continue;

            var barW   = bar._barWidth;
            var totalH = bar.bitmap.height;
            if (barW <= 0 || totalH <= 0) continue;

            // HPBar의 게임 내 좌상단 좌표 (anchor (0.5, 1.0))
            var worldLeft = spr.x + bar.x - barW * 0.5;
            var worldTop  = spr.y + bar.y - totalH;

            var screenLeft = rect.left + worldLeft * sx;
            var screenTop  = rect.top  + worldTop  * sy;
            var scaledIcon = ICON_SIZE * sx;

            for (var ii = 0; ii < icons.length; ii++) {
                var ix = screenLeft + ii * (ICON_SIZE + 1) * sx;
                if (mx >= ix && mx <= ix + scaledIcon &&
                    my >= screenTop && my <= screenTop + scaledIcon) {
                    return { battler: bar._battler, iconIdx: ii };
                }
            }
        }
        return null;
    }

    //-------------------------------------------------------------------------
    // mousemove — 아이콘 호버 감지
    //-------------------------------------------------------------------------
    document.addEventListener('mousemove', function (e) {
        var hit = findIconAtMouse(e.clientX, e.clientY);
        if (!hit) { hideTooltip(); return; }

        var info = getIconInfo(hit.battler, hit.iconIdx);
        if (!info) { hideTooltip(); return; }

        var html = '<strong style="color:#fff;font-size:14px">' + info.name + '</strong>';
        if (info.desc) {
            html += '<br><span style="color:#bbb;font-size:11px">' + info.desc + '</span>';
        }
        if (info.turns !== null) {
            html += '<br><span style="color:#ffe066">남은 턴: ' + info.turns + '</span>';
        }
        showTooltip(e.clientX, e.clientY, html);
    });

    // 씬 전환 시 툴팁 숨기기
    var _SceneManager_goto = SceneManager.goto;
    SceneManager.goto = function (sceneClass) {
        hideTooltip();
        _SceneManager_goto.call(this, sceneClass);
    };

})();
