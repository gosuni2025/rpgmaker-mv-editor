    //=========================================================================
    // 경로 화살표 업데이트
    //=========================================================================
    var _pathLastPlayerX = -1;
    var _pathLastPlayerY = -1;
    var _pathLastDestX = -1;
    var _pathLastDestY = -1;
    var _indicatorFrame = 0;

    Spriteset_Map.prototype.updatePathArrow = function() {
        if (!this._pathArrowSprite && !this._destIndicatorSprite) return;

        if ($gameMap.isEventRunning()) {
            if (this._pathArrowSprite && this._currentPath && this._currentPath.length > 0) {
                this._currentPath = [];
                this._pathArrowSprite.bitmap.clear();
            }
            if (this._destIndicatorSprite) {
                this._destIndicatorSprite.visible = false;
            }
            _pathLastPlayerX = -1;
            _pathLastPlayerY = -1;
            _pathLastDestX = -1;
            _pathLastDestY = -1;
            return;
        }

        if (!$gameTemp.isDestinationValid()) {
            if (this._pathArrowSprite && this._currentPath && this._currentPath.length > 0) {
                this._currentPath = [];
                this._pathArrowSprite.bitmap.clear();
            }
            if (this._destIndicatorSprite) {
                this._destIndicatorSprite.visible = false;
            }
            _pathLastPlayerX = -1;
            _pathLastPlayerY = -1;
            _pathLastDestX = -1;
            _pathLastDestY = -1;
            _indicatorFrame = 0;
            return;
        }

        _indicatorFrame = (_indicatorFrame + 1) % 360;

        var destX = $gameTemp.destinationX();
        var destY = $gameTemp.destinationY();
        var playerX = $gamePlayer.x;
        var playerY = $gamePlayer.y;

        // 플레이어 위치나 목적지가 변경되면 경로 재계산
        if (playerX !== _pathLastPlayerX || playerY !== _pathLastPlayerY ||
            destX !== _pathLastDestX || destY !== _pathLastDestY) {
            _pathLastPlayerX = playerX;
            _pathLastPlayerY = playerY;
            _pathLastDestX = destX;
            _pathLastDestY = destY;
            this._currentPath = findPath(playerX, playerY, destX, destY);
        }

        // 경로 화살표: 매 프레임 화면 좌표로 다시 그리기 (스크롤 대응)
        if (this._pathArrowSprite) {
            this.drawPathArrow();
        }

        // 인디케이터: tilemap 좌표 기준으로 위치 갱신 (3D 카메라 변환 자동 반영)
        if (this._destIndicatorSprite) {
            var tw = $gameMap.tileWidth();
            var th = $gameMap.tileHeight();
            this._destIndicatorSprite.x = $gameMap.adjustX(_pathLastDestX) * tw + tw / 2;
            this._destIndicatorSprite.y = $gameMap.adjustY(_pathLastDestY) * th + th / 2;
            this._destIndicatorSprite.visible = true;
            this.drawDestIndicator();
        }
    };

    Spriteset_Map.prototype.drawPathArrow = function() {
        var bitmap = this._pathArrowSprite.bitmap;
        bitmap.clear();

        var path = this._currentPath;
        if (path.length === 0) return;

        var tw  = $gameMap.tileWidth();
        var th  = $gameMap.tileHeight();
        var ctx = bitmap._context;
        var dpr = this._pathArrowDPR || 1;

        // 정수 스냅으로 선명한 경계
        function screenX(tileX) {
            return Math.round(($gameMap.adjustX(tileX) * tw + tw / 2) * dpr);
        }
        function screenY(tileY) {
            return Math.round(($gameMap.adjustY(tileY) * th + th / 2) * dpr);
        }

        ctx.save();
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';

        // arrowWidth(1~10)를 타일 크기에 대한 삼각형 크기로 환산
        var tileMin  = Math.min(tw, th);
        var baseSize = Math.round(tileMin * (0.10 + arrowWidth * 0.018) * dpr);
        var playerPos = { x: _pathLastPlayerX, y: _pathLastPlayerY };

        for (var i = 0; i < path.length; i++) {
            var from  = (i === 0) ? playerPos : path[i - 1];
            var to    = path[i];
            var angle = Math.atan2(to.y - from.y, to.x - from.x);
            var cx    = screenX(to.x);
            var cy    = screenY(to.y);
            // 마지막 타일은 1.5배
            var sz    = (i === path.length - 1) ? Math.round(baseSize * 1.5) : baseSize;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);

            // 오른쪽을 향하는 삼각형 (픽셀 스냅 좌표)
            ctx.beginPath();
            ctx.moveTo( sz,              0);
            ctx.lineTo(-Math.round(sz * 0.55), -Math.round(sz * 0.72));
            ctx.lineTo(-Math.round(sz * 0.55),  Math.round(sz * 0.72));
            ctx.closePath();

            if (arrowOutline) {
                ctx.strokeStyle = arrowOutlineColor;
                ctx.lineWidth   = Math.max(1, Math.round(arrowOutlineWidth * dpr));
                ctx.stroke();
            }
            ctx.fillStyle = arrowColor;
            ctx.fill();

            ctx.restore();
        }

        ctx.restore();
        bitmap._setDirty();
    };

