    //=========================================================================
    // 화살표 스프라이트
    //=========================================================================
    var _Spriteset_Map_createDestination = Spriteset_Map.prototype.createDestination;
    Spriteset_Map.prototype.createDestination = function() {
        _Spriteset_Map_createDestination.call(this);

        // 애니메이션용 스프라이트
        if (animationId > 0) {
            this._touchAnimSprite = new Sprite_Base();
            this._touchAnimSprite.anchor.x = 0.5;
            this._touchAnimSprite.anchor.y = 0.5;
            this._touchAnimSprite.bitmap = new Bitmap(48, 48);
            this._touchAnimSprite.z = 9;
            this._tilemap.addChild(this._touchAnimSprite);
        }

        // 경로 화살표 스프라이트 - tilemap 밖, 화면 좌표 기준
        if (showPathArrow) {
            var dpr = window.devicePixelRatio || 1;
            this._pathArrowSprite = new Sprite();
            this._pathArrowSprite.bitmap = new Bitmap(Graphics.width * dpr, Graphics.height * dpr);
            this._pathArrowSprite.scale.x = 1 / dpr;
            this._pathArrowSprite.scale.y = 1 / dpr;
            this._pathArrowDPR = dpr;
            this._baseSprite.addChild(this._pathArrowSprite);
            this._currentPath = [];
        }

        // 목적지 인디케이터 스프라이트 - tilemap 안, 타일 좌표 기준
        // z=1(Lower chars)로 캐릭터(z=3) 뒤에 그려지며 3D 카메라 변환도 자동 반영
        if (showDestIndicator) {
            var tw = $gameMap.tileWidth();
            var th = $gameMap.tileHeight();
            var tileSize = Math.min(tw, th);
            var indicSize = Math.ceil(tileSize * 1.6);
            this._destIndicatorSprite = new Sprite();
            this._destIndicatorSprite.bitmap = new Bitmap(indicSize, indicSize);
            this._destIndicatorSprite.anchor.x = 0.5;
            this._destIndicatorSprite.anchor.y = 0.5;
            this._destIndicatorSprite.z = 1;
            this._destIndicatorSprite.visible = false;
            this._tilemap.addChild(this._destIndicatorSprite);
            if (!this._currentPath) this._currentPath = [];
        }

        // 타일 호버 하이라이트 스프라이트 - tilemap 안, 타일 좌표 기준
        if (showHoverHighlight) {
            var tw = $gameMap.tileWidth();
            var th = $gameMap.tileHeight();
            this._hoverHighlightSprite = new Sprite();
            this._hoverHighlightSprite.bitmap = new Bitmap(tw, th);
            this._hoverHighlightSprite.anchor.x = 0;
            this._hoverHighlightSprite.anchor.y = 0;
            this._hoverHighlightSprite.z = 9;
            this._hoverHighlightSprite.visible = false;
            this._tilemap.addChild(this._hoverHighlightSprite);
            this.drawHoverHighlight();
        }

        _lastDestX = -1;
        _lastDestY = -1;
    };

    // 현재 글로우 중인 Sprite_Character (updateEventHoverLine → updateHoverHighlight 공유)
    var _currentGlowSprite = null;
    var _glowFrame = 0;

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        this.updateTouchDestAnimation();
        this.updatePathArrow();
        // 이벤트 글로우를 먼저 결정한 뒤 타일 하이라이트에서 참조
        this.updateEventHoverLine();
        this.updateHoverHighlight();
    };

    //=========================================================================
    // 목적지 애니메이션 업데이트
    //=========================================================================
    Spriteset_Map.prototype.updateTouchDestAnimation = function() {
        if (!this._touchAnimSprite) return;
        if (animationId <= 0) return;
        if ($gameMap.isEventRunning()) return;

        if ($gameTemp.isDestinationValid()) {
            var destX = $gameTemp.destinationX();
            var destY = $gameTemp.destinationY();
            var tw = $gameMap.tileWidth();
            var th = $gameMap.tileHeight();

            if (destX !== _lastDestX || destY !== _lastDestY) {
                _lastDestX = destX;
                _lastDestY = destY;
                this._touchAnimSprite.x = $gameMap.adjustX(destX) * tw + tw / 2;
                this._touchAnimSprite.y = $gameMap.adjustY(destY) * th + th / 2;
                var anim = $dataAnimations[animationId];
                if (anim) {
                    this._touchAnimSprite.startAnimation(anim, false, 0);
                }
            } else {
                this._touchAnimSprite.x = $gameMap.adjustX(destX) * tw + tw / 2;
                this._touchAnimSprite.y = $gameMap.adjustY(destY) * th + th / 2;
            }
        } else {
            _lastDestX = -1;
            _lastDestY = -1;
        }
    };

