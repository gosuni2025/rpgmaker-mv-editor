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

