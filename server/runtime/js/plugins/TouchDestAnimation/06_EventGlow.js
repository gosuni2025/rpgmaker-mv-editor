    //=========================================================================
    // 이벤트 글로우 — Sprite_Character에 child 스프라이트를 직접 붙임
    // 알파 채널 경계 검출(inner line shader)로 캐릭터 실루엣을 따라 빛남
    //=========================================================================

    function disposeBitmapTexture(bmp) {
        if (bmp && bmp.__baseTexture && bmp.__baseTexture.dispose) {
            bmp.__baseTexture.dispose();
        }
    }

    function removeGlowFromSprite(sp) {
        if (sp && sp._eventGlowChild) {
            var glow = sp._eventGlowChild;
            sp._eventGlowChild = null;
            sp._glowFrameKey = null;
            disposeBitmapTexture(glow.bitmap);
            if (glow.destroy) {
                glow.destroy(); // geometry + material dispose, 부모에서도 제거
            } else {
                sp.removeChild(glow);
            }
        }
    }

    function addGlowToSprite(sp) {
        var pw = sp.patternWidth ? sp.patternWidth() : $gameMap.tileWidth();
        var ph = sp.patternHeight ? sp.patternHeight() : $gameMap.tileHeight();

        var glow = new Sprite();
        glow.bitmap = new Bitmap(pw, ph);
        // Sprite_Character local 좌표계:
        //   anchor (0.5, 1) → bottom-center = (0, 0)
        //   이미지 영역: x=[-pw/2, pw/2], y=[-ph, 0]
        glow.anchor.x = 0;
        glow.anchor.y = 0;
        glow.x = -pw / 2;
        glow.y = -ph;
        sp.addChild(glow);
        sp._eventGlowChild = glow;
        sp._glowFrameKey = null; // 첫 프레임에서 강제 재드로우
        return glow;
    }

    // 알파 경계 기반 inner line 비트맵 생성
    // 애니메이션 프레임이 바뀔 때만 실행 (캐시 키: _frame 좌표)
    function buildInnerLineBitmap(sp) {
        if (!sp.bitmap || !sp.bitmap.isReady()) return;
        if (!sp._eventGlowChild) return;

        var frame = sp._frame;
        if (!frame || !frame.width || !frame.height) return;

        var frameKey = frame.x + ',' + frame.y + ',' + frame.width + ',' + frame.height;
        if (sp._glowFrameKey === frameKey) return; // 프레임 미변경 → 스킵
        sp._glowFrameKey = frameKey;

        var pw = Math.ceil(frame.width);
        var ph = Math.ceil(frame.height);

        // 캐릭터 시트에서 현재 프레임만 임시 캔버스에 추출
        var tmpCanvas = document.createElement('canvas');
        tmpCanvas.width  = pw;
        tmpCanvas.height = ph;
        var tmpCtx = tmpCanvas.getContext('2d');
        try {
            tmpCtx.drawImage(
                sp.bitmap._canvas,
                Math.floor(frame.x), Math.floor(frame.y), pw, ph,
                0, 0, pw, ph
            );
        } catch (e) { return; }

        var srcData;
        try { srcData = tmpCtx.getImageData(0, 0, pw, ph).data; }
        catch (e) { return; }

        var ATHRESH = 10;
        // inner edge mask: 불투명 픽셀 중 4-이웃에 투명이 하나라도 있으면 경계
        var edgeMask = new Uint8Array(pw * ph);
        for (var y = 0; y < ph; y++) {
            for (var x = 0; x < pw; x++) {
                var i4 = (y * pw + x) * 4;
                if (srcData[i4 + 3] < ATHRESH) continue;
                var isEdge = (x === 0)    || srcData[i4 - 4 + 3]       < ATHRESH
                          || (x === pw-1) || srcData[i4 + 4 + 3]       < ATHRESH
                          || (y === 0)    || srcData[i4 - pw*4 + 3]    < ATHRESH
                          || (y === ph-1) || srcData[i4 + pw*4 + 3]    < ATHRESH;
                if (isEdge) edgeMask[y * pw + x] = 1;
            }
        }

        // 글로우 child 비트맵 크기 확인 / 재생성
        var glowBitmap = sp._eventGlowChild.bitmap;
        if (glowBitmap.width !== pw || glowBitmap.height !== ph) {
            disposeBitmapTexture(glowBitmap);
            sp._eventGlowChild.bitmap = new Bitmap(pw, ph);
            sp._eventGlowChild.x = -pw / 2;
            sp._eventGlowChild.y = -ph;
            glowBitmap = sp._eventGlowChild.bitmap;
        }

        glowBitmap.clear();
        var ctx = glowBitmap._context;
        var lw = eventHoverLineWidth;

        ctx.save();
        ctx.fillStyle   = eventHoverLineColor;
        ctx.shadowColor = eventHoverLineColor;
        ctx.shadowBlur  = Math.max(3, lw * 2);

        // 경계 픽셀을 수평 런으로 묶어 fillRect — shadowBlur가 글로우 퍼짐 담당
        for (var y = 0; y < ph; y++) {
            var rx = -1;
            for (var x = 0; x <= pw; x++) {
                var onEdge = (x < pw) && edgeMask[y * pw + x];
                if (onEdge && rx < 0) { rx = x; }
                else if (!onEdge && rx >= 0) {
                    ctx.fillRect(rx, y, x - rx, 1);
                    rx = -1;
                }
            }
        }
        ctx.restore();
        glowBitmap._setDirty();
    }

    Spriteset_Map.prototype.updateEventHoverLine = function() {
        if (!showEventHoverLine) return;

        if ($gameMap.isEventRunning()) {
            removeGlowFromSprite(_currentGlowSprite);
            _currentGlowSprite = null;
            return;
        }

        var tile = getHoverTile();
        if (!tile) {
            removeGlowFromSprite(_currentGlowSprite);
            _currentGlowSprite = null;
            return;
        }

        // 해당 타일의 이미지가 있는 이벤트 검색
        var events = $gameMap.eventsXy(tile.x, tile.y);
        var targetEvent = null;
        for (var i = 0; i < events.length; i++) {
            if (events[i].characterName() !== '' && events[i].opacity() > 0) {
                targetEvent = events[i];
                break;
            }
        }

        if (!targetEvent) {
            removeGlowFromSprite(_currentGlowSprite);
            _currentGlowSprite = null;
            return;
        }

        // 이벤트에 대응하는 Sprite_Character 찾기
        var charSprites = this._characterSprites || [];
        var targetSprite = null;
        for (var j = 0; j < charSprites.length; j++) {
            if (charSprites[j]._character === targetEvent) {
                targetSprite = charSprites[j];
                break;
            }
        }

        if (!targetSprite || !targetSprite.bitmap || !targetSprite.bitmap.isReady()) {
            removeGlowFromSprite(_currentGlowSprite);
            _currentGlowSprite = null;
            return;
        }

        // 대상이 바뀌면 기존 글로우 제거 후 새 글로우 부착
        if (_currentGlowSprite !== targetSprite) {
            removeGlowFromSprite(_currentGlowSprite);
            addGlowToSprite(targetSprite);
            _currentGlowSprite = targetSprite;
            _glowFrame = 0;
        }

        // 애니메이션 프레임 변화 감지 → inner line 재계산
        buildInnerLineBitmap(targetSprite);

        // 점멸: 사인파로 min~max alpha 왕복
        _glowFrame++;
        var t = 0.5 + 0.5 * Math.cos((_glowFrame / eventHoverLineSpeed) * Math.PI);
        var alpha = eventHoverLineMinAlpha + (eventHoverLineMaxAlpha - eventHoverLineMinAlpha) * t;
        if (targetSprite._eventGlowChild) {
            targetSprite._eventGlowChild.opacity = Math.round(alpha * 255);
        }
    };

    //=========================================================================
    // 목적지 인디케이터 그리기 (tilemap 좌표계 - DPR 불필요)
    //=========================================================================
    Spriteset_Map.prototype.drawDestIndicator = function() {
        var bitmap = this._destIndicatorSprite.bitmap;
        bitmap.clear();

        var tw = $gameMap.tileWidth();
        var th = $gameMap.tileHeight();
        var tileSize = Math.min(tw, th);
        var ctx = bitmap._context;

        // 스프라이트 anchor=0.5이므로 중심 = bitmap 중앙
        var cx = bitmap.width / 2;
        var cy = bitmap.height / 2;

        var orbitR = tileSize * 0.38;
        var triH   = tileSize * 0.20;
        var triW   = triH;

        var path = this._currentPath || [];
        var destReachable = path.length > 0 &&
            path[path.length - 1].x === _pathLastDestX &&
            path[path.length - 1].y === _pathLastDestY;

        var iColor        = destReachable ? arrowColor        : 'rgba(255, 80, 80, 0.9)';
        var iOutlineColor = destReachable ? arrowOutlineColor : 'rgba(80, 0, 0, 0.7)';

        // 공전 각속도: 360프레임에 1바퀴
        var baseRot = (_indicatorFrame / 360) * Math.PI * 2;

        ctx.save();
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        for (var t = 0; t < 3; t++) {
            var orbitAngle = baseRot + (t * Math.PI * 2 / 3);
            var tx = Math.round(cx + orbitR * Math.cos(orbitAngle));
            var ty = Math.round(cy + orbitR * Math.sin(orbitAngle));
            var triRot = orbitAngle + Math.PI / 2;

            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(triRot);

            ctx.beginPath();
            ctx.moveTo(0,                       Math.round(triH));
            ctx.lineTo(-Math.round(triW), -Math.round(triH * 0.5));
            ctx.lineTo( Math.round(triW), -Math.round(triH * 0.5));
            ctx.closePath();

            if (arrowOutline) {
                ctx.strokeStyle = iOutlineColor;
                ctx.lineWidth   = Math.max(1, Math.round(arrowOutlineWidth));
                ctx.stroke();
            }
            ctx.fillStyle = iColor;
            ctx.fill();

            ctx.restore();
        }
        ctx.restore();
        bitmap._setDirty();
    };

