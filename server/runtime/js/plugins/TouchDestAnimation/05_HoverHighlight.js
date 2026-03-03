    //=========================================================================
    // 타일 호버 하이라이트
    //=========================================================================

    Spriteset_Map.prototype.updateHoverHighlight = function() {
        if (!this._hoverHighlightSprite) return;

        if (!ConfigManager.showHoverHighlight || $gameMap.isEventRunning()) {
            this._hoverHighlightSprite.visible = false;
            return;
        }

        var tile = getHoverTile();
        if (!tile) {
            this._hoverHighlightSprite.visible = false;
            return;
        }

        var tileX = tile.x;
        var tileY = tile.y;
        var tw = $gameMap.tileWidth();
        var th = $gameMap.tileHeight();

        this._hoverHighlightSprite.x = $gameMap.adjustX(tileX) * tw;
        this._hoverHighlightSprite.y = $gameMap.adjustY(tileY) * th;
        this._hoverHighlightSprite.visible = true;
    };

    Spriteset_Map.prototype.drawHoverHighlight = function() {
        if (!this._hoverHighlightSprite) return;
        var bitmap = this._hoverHighlightSprite.bitmap;
        var ctx = bitmap._context;
        var w = bitmap.width;
        var h = bitmap.height;

        bitmap.clear();
        ctx.save();

        // 검은 외곽선 (두꺼운 바깥 테두리)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);

        // 흰선 (안쪽 강조선)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, w - 4, h - 4);

        ctx.restore();
        bitmap._setDirty();
    };

    //=========================================================================
    // 이벤트 호버 내곽선 (이미지가 있는 이벤트 위에 점멸 border)
    //=========================================================================

    // 현재 호버 중인 타일 좌표를 계산하는 공통 함수
    function getHoverTile() {
        var mx = _hoverMouseX;
        var my = _hoverMouseY;
        if (mx < 0 || my < 0 || mx >= Graphics.width || my >= Graphics.height) return null;

        var tw = $gameMap.tileWidth();
        var th = $gameMap.tileHeight();

        if (typeof Mode3D !== 'undefined' &&
                ConfigManager.mode3d && Mode3D._active && Mode3D._perspCamera) {
            var world = Mode3D.screenToWorld(mx, my);
            if (!world) return null;
            return {
                x: $gameMap.roundX(Math.floor(($gameMap._displayX * tw + world.x) / tw)),
                y: $gameMap.roundY(Math.floor(($gameMap._displayY * th + world.y) / th))
            };
        } else {
            return {
                x: $gameMap.canvasToMapX(mx),
                y: $gameMap.canvasToMapY(my)
            };
        }
    }

