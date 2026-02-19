/*:
 * @pluginname 터치 목적지 설정
 * @plugindesc 터치/클릭 목적지 애니메이션 및 이동경로 화살표 표시
 * @author gosuni2025
 *
 * @param Animation ID
 * @type animation
 * @desc 터치 시 재생할 애니메이션 ID (0 = 비활성)
 * @default 0
 *
 * @param Hide Default
 * @type boolean
 * @desc 기존 흰색 펄스 목적지 스프라이트를 숨길지 여부
 * @default true
 *
 * @param Show Path Arrow
 * @type boolean
 * @desc 플레이어에서 목적지까지 이동경로 화살표를 표시할지 여부
 * @default true
 *
 * @param Arrow Color
 * @type color
 * @desc 화살표 색상 (CSS 색상값)
 * @default rgba(255, 255, 255, 0.7)
 *
 * @param Arrow Width
 * @type number
 * @desc 화살표 선 굵기 (px)
 * @min 1
 * @max 10
 * @default 3
 *
 * @param Arrow Outline
 * @type boolean
 * @desc 화살표 테두리 표시 여부
 * @default true
 *
 * @param Arrow Outline Color
 * @type color
 * @desc 화살표 테두리 색상
 * @default rgba(0, 0, 0, 0.5)
 *
 * @param Arrow Outline Width
 * @type number
 * @desc 화살표 테두리 굵기 (px, 선 굵기에 추가)
 * @min 1
 * @max 10
 * @default 2
 *
 * @param Show Destination Indicator
 * @type boolean
 * @desc 실제 목적지 타일에 인디케이터를 표시할지 여부 (이동불가 시 빨간색 X, 이동가능 시 원+십자 표시)
 * @default true
 *
 * @help
 * 맵을 터치/클릭하면 기본 흰색 사각형 펄스 대신
 * 지정한 RPG Maker 애니메이션을 해당 위치에 재생합니다.
 *
 * Animation ID: $dataAnimations에서 사용할 애니메이션 번호
 * Hide Default: true이면 기존 Sprite_Destination 숨김
 * Show Path Arrow: true이면 이동경로를 화살표로 표시
 * Arrow Color: 화살표 색상
 * Arrow Width: 화살표 선 굵기
 * Arrow Outline: 화살표 테두리 표시 여부
 * Arrow Outline Color: 테두리 색상
 * Arrow Outline Width: 테두리 굵기
 */

(function() {

    var parameters = PluginManager.parameters('TouchDestAnimation');
    var animationId = Number(parameters['Animation ID'] || 0);
    var hideDefault = String(parameters['Hide Default']) !== 'false';
    var showPathArrow = String(parameters['Show Path Arrow']) !== 'false';
    var arrowColor = String(parameters['Arrow Color'] || 'rgba(255, 255, 255, 0.7)');
    var arrowWidth = Number(parameters['Arrow Width'] || 3);
    var arrowOutline = String(parameters['Arrow Outline']) !== 'false';
    var arrowOutlineColor = String(parameters['Arrow Outline Color'] || 'rgba(0, 0, 0, 0.5)');
    var arrowOutlineWidth = Number(parameters['Arrow Outline Width'] || 2);
    var showDestIndicator = String(parameters['Show Destination Indicator']) !== 'false';

    var _lastDestX = -1;
    var _lastDestY = -1;

    // Hide Default: Sprite_Destination.update를 차단하여 visible=true 방지
    if (hideDefault) {
        Sprite_Destination.prototype.update = function() {
            this.visible = false;
        };
    }

    //=========================================================================
    // A* 경로 탐색 - 전체 경로를 배열로 반환
    //=========================================================================
    function findPath(startX, startY, goalX, goalY) {
        var searchLimit = $gamePlayer.searchLimit();
        var mapWidth = $gameMap.width();
        var nodeList = [];
        var openList = [];
        var closedList = [];
        var start = {};
        var best = start;

        if (startX === goalX && startY === goalY) return [];

        start.parent = null;
        start.x = startX;
        start.y = startY;
        start.g = 0;
        start.f = $gameMap.distance(startX, startY, goalX, goalY);
        nodeList.push(start);
        openList.push(start.y * mapWidth + start.x);

        while (nodeList.length > 0) {
            var bestIndex = 0;
            for (var i = 0; i < nodeList.length; i++) {
                if (nodeList[i].f < nodeList[bestIndex].f) {
                    bestIndex = i;
                }
            }

            var current = nodeList[bestIndex];
            var x1 = current.x;
            var y1 = current.y;
            var pos1 = y1 * mapWidth + x1;
            var g1 = current.g;

            nodeList.splice(bestIndex, 1);
            openList.splice(openList.indexOf(pos1), 1);
            closedList.push(pos1);

            if (current.x === goalX && current.y === goalY) {
                best = current;
                break;
            }

            if (g1 >= searchLimit) continue;

            for (var j = 0; j < 4; j++) {
                var direction = 2 + j * 2;
                var x2 = $gameMap.roundXWithDirection(x1, direction);
                var y2 = $gameMap.roundYWithDirection(y1, direction);
                var pos2 = y2 * mapWidth + x2;

                if (closedList.indexOf(pos2) >= 0) continue;
                if (!$gamePlayer.canPass(x1, y1, direction)) continue;

                var g2 = g1 + 1;
                var index2 = openList.indexOf(pos2);

                if (index2 < 0 || g2 < nodeList[index2].g) {
                    var neighbor;
                    if (index2 >= 0) {
                        neighbor = nodeList[index2];
                    } else {
                        neighbor = {};
                        nodeList.push(neighbor);
                        openList.push(pos2);
                    }
                    neighbor.parent = current;
                    neighbor.x = x2;
                    neighbor.y = y2;
                    neighbor.g = g2;
                    neighbor.f = g2 + $gameMap.distance(x2, y2, goalX, goalY);
                    if (!best || neighbor.f - neighbor.g < best.f - best.g) {
                        best = neighbor;
                    }
                }
            }
        }

        // best에서 start까지 역추적하여 경로 생성
        var path = [];
        var node = best;
        while (node && node !== start) {
            path.unshift({ x: node.x, y: node.y });
            node = node.parent;
        }
        return path;
    }

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

        _lastDestX = -1;
        _lastDestY = -1;
    };

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        this.updateTouchDestAnimation();
        this.updatePathArrow();
    };

    //=========================================================================
    // 목적지 애니메이션 업데이트
    //=========================================================================
    Spriteset_Map.prototype.updateTouchDestAnimation = function() {
        if (!this._touchAnimSprite) return;
        if (animationId <= 0) return;

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

        var tw = $gameMap.tileWidth();
        var th = $gameMap.tileHeight();
        var ctx = bitmap._context;
        var dpr = this._pathArrowDPR || 1;

        // 타일 좌표 → 화면 좌표 변환 함수 (DPR 반영)
        function screenX(tileX) {
            return ($gameMap.adjustX(tileX) * tw + tw / 2) * dpr;
        }
        function screenY(tileY) {
            return ($gameMap.adjustY(tileY) * th + th / 2) * dpr;
        }

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (path.length > 0) {
            // 시작점: 플레이어 위치 (화면 좌표)
            var sx = screenX(_pathLastPlayerX);
            var sy = screenY(_pathLastPlayerY);

            // 화살촉 계산 (테두리, 메인 모두 같은 좌표 사용)
            var last = path[path.length - 1];
            var prev = path.length >= 2 ? path[path.length - 2] :
                       { x: _pathLastPlayerX, y: _pathLastPlayerY };
            var endX = screenX(last.x);
            var endY = screenY(last.y);
            var adx = last.x - prev.x;
            var ady = last.y - prev.y;
            var angle = Math.atan2(ady, adx);
            var arrowSize = 10 * dpr;
            var arrowHeadPoints = {
                tip: [endX, endY],
                left: [endX - arrowSize * Math.cos(angle - Math.PI / 6),
                       endY - arrowSize * Math.sin(angle - Math.PI / 6)],
                right: [endX - arrowSize * Math.cos(angle + Math.PI / 6),
                        endY - arrowSize * Math.sin(angle + Math.PI / 6)]
            };

            // 테두리 (아래 레이어)
            if (arrowOutline) {
                ctx.strokeStyle = arrowOutlineColor;
                ctx.fillStyle = arrowOutlineColor;
                ctx.lineWidth = (arrowWidth + arrowOutlineWidth * 2) * dpr;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                for (var oi = 0; oi < path.length; oi++) {
                    ctx.lineTo(screenX(path[oi].x), screenY(path[oi].y));
                }
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(arrowHeadPoints.tip[0], arrowHeadPoints.tip[1]);
                ctx.lineTo(arrowHeadPoints.left[0], arrowHeadPoints.left[1]);
                ctx.lineTo(arrowHeadPoints.right[0], arrowHeadPoints.right[1]);
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }

            // 메인 화살표 (위 레이어)
            ctx.strokeStyle = arrowColor;
            ctx.fillStyle = arrowColor;
            ctx.lineWidth = arrowWidth * dpr;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            for (var i = 0; i < path.length; i++) {
                ctx.lineTo(screenX(path[i].x), screenY(path[i].y));
            }
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(arrowHeadPoints.tip[0], arrowHeadPoints.tip[1]);
            ctx.lineTo(arrowHeadPoints.left[0], arrowHeadPoints.left[1]);
            ctx.lineTo(arrowHeadPoints.right[0], arrowHeadPoints.right[1]);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
        bitmap._setDirty();
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
        for (var t = 0; t < 3; t++) {
            var orbitAngle = baseRot + (t * Math.PI * 2 / 3);
            var tx = cx + orbitR * Math.cos(orbitAngle);
            var ty = cy + orbitR * Math.sin(orbitAngle);
            // 꼭짓점이 중심을 향하도록: 기본 꼭짓점 방향(+y) → orbitAngle + π/2
            var triRot = orbitAngle + Math.PI / 2;

            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(triRot);

            ctx.beginPath();
            ctx.moveTo(0,      triH);
            ctx.lineTo(-triW, -triH * 0.5);
            ctx.lineTo( triW, -triH * 0.5);
            ctx.closePath();

            if (arrowOutline) {
                ctx.strokeStyle = iOutlineColor;
                ctx.lineWidth = arrowWidth + arrowOutlineWidth * 2;
                ctx.stroke();
            }
            ctx.fillStyle = iColor;
            ctx.fill();

            ctx.restore();
        }
        ctx.restore();
        bitmap._setDirty();
    };

})();
