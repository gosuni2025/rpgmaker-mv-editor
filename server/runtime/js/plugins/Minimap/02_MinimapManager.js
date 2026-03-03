
  // ============================================================
  // MinimapManager
  // ============================================================

  const MinimapManager = {
    _bitmap:         null,
    _scene:          null,
    _dirty:          true,
    _lastPx:         -999,
    _lastPy:         -999,
    _lastYaw:        -999,
    _lastDir:        -999,
    _frameCount:     0,
    _visible:        true,
    _pendingExplore: false,
    _lastEventPos:   {},  // { eventId: 'x,y' }

    UPDATE_INTERVAL: 3,

    // ----------------------------------------------------------
    // 초기화
    // ----------------------------------------------------------
    initialize() {
      const bw = CFG.size + N_PAD * 2;
      if (this._bitmap) this._bitmap.destroy();
      this._bitmap = new Bitmap(bw, bw);
    },

    // ----------------------------------------------------------
    // FoW
    // ----------------------------------------------------------
    _getFowData(mapId, w, h) {
      if (!$gameSystem._minimapFow) $gameSystem._minimapFow = {};
      if (!$gameSystem._minimapFow[mapId]) {
        $gameSystem._minimapFow[mapId] = new Array(w * h).fill(0);
      }
      return $gameSystem._minimapFow[mapId];
    },

    explore(x, y) {
      if (!CFG.fowEnabled || !$gameMap) return;
      const mapId = $gameMap.mapId();
      const w     = $gameMap.width();
      const h     = $gameMap.height();
      const fow   = this._getFowData(mapId, w, h);
      const r2    = CFG.viewRadius * CFG.viewRadius;
      for (let dy = -CFG.viewRadius; dy <= CFG.viewRadius; dy++) {
        for (let dx = -CFG.viewRadius; dx <= CFG.viewRadius; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const nx = $gameMap.isLoopHorizontal()
            ? ((x + dx) % w + w) % w : x + dx;
          const ny = $gameMap.isLoopVertical()
            ? ((y + dy) % h + h) % h : y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            fow[ny * w + nx] = 1;
          }
        }
      }
      this._dirty = true;
    },

    clearFow() {
      if (!$gameMap) return;
      if ($gameSystem._minimapFow) delete $gameSystem._minimapFow[$gameMap.mapId()];
      this._dirty = true;
    },

    revealAll() {
      if (!$gameMap) return;
      const w = $gameMap.width(), h = $gameMap.height();
      this._getFowData($gameMap.mapId(), w, h).fill(1);
      this._dirty = true;
    },

    _isInSight(tx, ty, px, py) {
      const dx = tx - px, dy = ty - py;
      return dx * dx + dy * dy <= CFG.viewRadius * CFG.viewRadius;
    },

    // ----------------------------------------------------------
    // 타일 색상
    // ----------------------------------------------------------
    _getTileColor(x, y) {
      const regionId = $gameMap.regionId(x, y);
      if (regionId > 0) {
        const c = CFG.regionColors[String(regionId)];
        if (c) return c;
      }
      const tag = $gameMap.terrainTag(x, y);
      if (tag > 0) {
        const c = CFG.terrainColors[String(tag)];
        if (c) return c;
      }
      const passable = [2, 4, 6, 8].some(d => $gameMap.isPassable(x, y, d));
      return passable ? CFG.floorColor : CFG.wallColor;
    },

    // ----------------------------------------------------------
    // 이벤트 마커 (EXT: $dataMap.minimapData[eventId])
    // ----------------------------------------------------------
    _getEventMarker(event) {
      if (!event) return null;
      const data = $dataMap && $dataMap.minimapData && $dataMap.minimapData[event.eventId()];
      if (!data || !data.enabled) return null;
      return {
        color: data.color || CFG.eventMarkerColor,
        shape: data.shape || 'circle',
        iconIndex: data.iconIndex,
      };
    },

    // ----------------------------------------------------------
    // 마커 그리기 헬퍼
    // ----------------------------------------------------------
    _drawMarker(ctx, sx, sy, r, color, shape, iconBitmap, iconIndex) {
      // 아이콘 모드: IconSet에서 해당 아이콘을 축소하여 표시
      if (iconIndex !== undefined && iconBitmap && iconBitmap._canvas) {
        const col  = iconIndex % 16;
        const row  = Math.floor(iconIndex / 16);
        // iconFixedSize=true(기본): 줌에 관계없이 항상 16px 고정
        // iconFixedSize=false: tileSize에 비례
        const size = CFG.iconFixedSize ? 16 : r * 2.4;
        ctx.globalAlpha = 1.0;
        ctx.drawImage(iconBitmap._canvas, col * 32, row * 32, 32, 32,
                      sx - size / 2, sy - size / 2, size, size);
        return;
      }

      ctx.globalAlpha = 1.0;
      ctx.fillStyle   = color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth   = 1;

      if (shape === 'square') {
        ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
        ctx.strokeRect(sx - r + 0.5, sy - r + 0.5, r * 2 - 1, r * 2 - 1);
      } else if (shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(sx,     sy - r * 1.3);
        ctx.lineTo(sx + r, sy);
        ctx.lineTo(sx,     sy + r * 1.3);
        ctx.lineTo(sx - r, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (shape === 'star') {
        const outer = r * 1.2;
        const inner = r * 0.48;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const outerAngle = (i * 2 * Math.PI / 5) - Math.PI / 2;
          const innerAngle = outerAngle + Math.PI / 5;
          const ox = sx + outer * Math.cos(outerAngle);
          const oy = sy + outer * Math.sin(outerAngle);
          const ix = sx + inner * Math.cos(innerAngle);
          const iy = sy + inner * Math.sin(innerAngle);
          if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(sx,            sy - r * 1.3);
        ctx.lineTo(sx + r * 1.1,  sy + r * 0.8);
        ctx.lineTo(sx - r * 1.1,  sy + r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (shape === 'cross') {
        const w = r * 0.42;
        ctx.fillRect(sx - w, sy - r, w * 2, r * 2);
        ctx.fillRect(sx - r, sy - w, r * 2, w * 2);
        ctx.strokeRect(sx - r + 0.5, sy - w + 0.5, r * 2 - 1, w * 2 - 1);
        ctx.strokeRect(sx - w + 0.5, sy - r + 0.5, w * 2 - 1, r * 2 - 1);
      } else if (shape === 'heart') {
        const s = r * 0.9;
        ctx.beginPath();
        ctx.moveTo(sx, sy + s * 0.9);
        ctx.bezierCurveTo(sx - s * 1.5, sy + s * 0.1, sx - s * 1.5, sy - s, sx, sy - s * 0.3);
        ctx.bezierCurveTo(sx + s * 1.5, sy - s, sx + s * 1.5, sy + s * 0.1, sx, sy + s * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else { // circle (기본)
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    },

    _getIconBitmap() {
      if (!this._iconBitmap) {
        this._iconBitmap = ImageManager.loadSystem('IconSet');
      }
      return this._iconBitmap;
    },

    // ----------------------------------------------------------
    // 렌더링
    // ----------------------------------------------------------
    _render() {
      if (!$gameMap || !$gamePlayer) return;

      const bitmap = this._bitmap;
      const ctx    = bitmap._context;
      const s      = CFG.size;
      const hs     = s / 2;
      const ts     = CFG.tileSize;
      const mapId  = $gameMap.mapId();
      const mapW   = $gameMap.width();
      const mapH   = $gameMap.height();
      const px     = $gamePlayer.x;
      const py     = $gamePlayer.y;
      const fow    = CFG.fowEnabled ? this._getFowData(mapId, mapW, mapH) : null;

      let yaw = 0;
      if (CFG.rotation === 'rotate' &&
          typeof Mode3D !== 'undefined' && Mode3D._active) {
        yaw = (Mode3D._yawDeg || 0) * Math.PI / 180;
      }

      ctx.clearRect(0, 0, s + N_PAD * 2, s + N_PAD * 2);

      // N_PAD 여백 안쪽을 (0,0) 기준으로 사용
      ctx.save(); // === PAD translate ===
      ctx.translate(N_PAD, N_PAD);

      // ── 클리핑 ───────────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      if (CFG.shape === 'circle') {
        ctx.arc(hs, hs, hs, 0, Math.PI * 2);
      } else {
        ctx.rect(0, 0, s, s);
      }
      ctx.clip();

      ctx.fillStyle = CFG.bgColor;
      ctx.fillRect(0, 0, s, s);

      // ── 회전 변환 ─────────────────────────────────────────────
      ctx.save();
      if (yaw !== 0) {
        ctx.translate(hs, hs);
        ctx.rotate(yaw);
        ctx.translate(-hs, -hs);
      }

      const viewW   = s / ts;
      const viewH   = s / ts;
      const startX  = px - viewW / 2;
      const startY  = py - viewH / 2;
      const iStartX = Math.floor(startX) - 1;
      const iStartY = Math.floor(startY) - 1;
      const iEndX   = Math.ceil(startX + viewW) + 1;
      const iEndY   = Math.ceil(startY + viewH) + 1;

      // ── 타일 ─────────────────────────────────────────────────
      for (let ty = iStartY; ty <= iEndY; ty++) {
        for (let tx = iStartX; tx <= iEndX; tx++) {
          const mx = $gameMap.isLoopHorizontal()
            ? ((tx % mapW) + mapW) % mapW : tx;
          const my = $gameMap.isLoopVertical()
            ? ((ty % mapH) + mapH) % mapH : ty;

          if (!$gameMap.isLoopHorizontal() && (tx < 0 || tx >= mapW)) continue;
          if (!$gameMap.isLoopVertical()   && (ty < 0 || ty >= mapH)) continue;

          const explored = fow ? !!fow[my * mapW + mx] : true;
          if (!explored) continue;

          const inSight = this._isInSight(mx, my, px, py);
          ctx.globalAlpha = inSight ? 1.0 : 0.35;
          ctx.fillStyle   = this._getTileColor(mx, my);
          ctx.fillRect((tx - startX) * ts, (ty - startY) * ts, ts, ts);
        }
      }

      const markerR    = Math.max(2, ts * 0.8);
      const iconBitmap = this._getIconBitmap();

      // ── 이벤트 마커 (EXT: minimapData) ──────────────────────────
      if (CFG.showEvents && $gameMap.events) {
        $gameMap.events().forEach(event => {
          const marker = this._getEventMarker(event);
          if (!marker) return;
          const ex = event.x, ey = event.y;
          const mx = $gameMap.isLoopHorizontal()
            ? ((ex % mapW) + mapW) % mapW : ex;
          const my = $gameMap.isLoopVertical()
            ? ((ey % mapH) + mapH) % mapH : ey;
          if (mx < 0 || mx >= mapW || my < 0 || my >= mapH) return;
          if (fow && !fow[my * mapW + mx]) return;
          this._drawMarker(ctx,
            (ex - startX) * ts + ts * 0.5,
            (ey - startY) * ts + ts * 0.5,
            markerR, marker.color, marker.shape, iconBitmap, marker.iconIndex);
        });
      }

      // ── 커스텀 마커 ───────────────────────────────────────────
      const customMarkers = ($gameSystem._minimapMarkers || []);
      customMarkers.forEach(m => {
        const mx = $gameMap.isLoopHorizontal()
          ? ((m.x % mapW) + mapW) % mapW : m.x;
        const my = $gameMap.isLoopVertical()
          ? ((m.y % mapH) + mapH) % mapH : m.y;
        if (mx < 0 || mx >= mapW || my < 0 || my >= mapH) return;
        if (fow && !fow[my * mapW + mx]) return;
        this._drawMarker(ctx,
          (m.x - startX) * ts + ts * 0.5,
          (m.y - startY) * ts + ts * 0.5,
          markerR, m.color || CFG.eventMarkerColor, m.shape || 'circle');
      });

      // ── 플레이어 마커 (항상 중앙) ─────────────────────────────
      // 화살표 팁이 (0, -r) 즉 ↑ 방향이 기저(0°)이므로,
      // 각 방향을 올바른 화면 방향으로 돌리려면 +π/2가 필요
      const DIR_ANGLE  = {2: Math.PI, 4: -Math.PI / 2, 6: Math.PI / 2, 8: 0};
      const arrowAngle = (DIR_ANGLE[$gamePlayer.direction()] || 0);
      const ar         = Math.max(3, ts);

      ctx.save();
      ctx.translate(hs, hs);
      ctx.rotate(arrowAngle);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle   = CFG.playerColor;
      ctx.beginPath();
      ctx.moveTo(0,          -ar * 2.2);
      ctx.lineTo(ar * 0.9,   ar * 0.5);
      ctx.lineTo(0,          0);
      ctx.lineTo(-ar * 0.9,  ar * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.restore();

      ctx.restore(); // 회전 취소
      ctx.restore(); // 클리핑 취소

      // ── 테두리 ────────────────────────────────────────────────
      if (CFG.borderWidth > 0) {
        ctx.strokeStyle = CFG.borderColor;
        ctx.lineWidth   = CFG.borderWidth;
        ctx.globalAlpha = 0.85;
        if (CFG.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(hs, hs, hs - CFG.borderWidth / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const hw = CFG.borderWidth / 2;
          ctx.strokeRect(hw, hw, s - CFG.borderWidth, s - CFG.borderWidth);
        }
      }

      // ── 북쪽 N 표시 (회전 모드) ──────────────────────────────
      if (CFG.rotation === 'rotate') {
        this._drawNorthIndicator(ctx, s, hs, yaw);
      }

      ctx.restore(); // === undo PAD translate ===

      bitmap._dirty = true;
      if (bitmap._baseTexture) bitmap._baseTexture.update();
    },

    // ----------------------------------------------------------
    // 북쪽 N 표시 (회전 모드 전용)
    // ----------------------------------------------------------
    _drawNorthIndicator(ctx, s, hs, yaw) {
      const sinY = Math.sin(yaw);
      const cosY = Math.cos(yaw);

      // ctx.rotate(yaw) 후 (0,-r) 점은 화면에서 (+sinY, -cosY) 방향에 나타남
      let nx, ny;
      if (CFG.shape === 'circle') {
        nx = hs + hs * sinY;
        ny = hs - hs * cosY;
      } else {
        // 사각형 테두리: 중심 → +sinY/-cosY 방향 ray cast
        const dx = sinY, dy = -cosY;
        let t = Infinity;
        if (Math.abs(dx) > 1e-6) t = Math.min(t, (dx > 0 ? (s - hs) : hs) / Math.abs(dx));
        if (Math.abs(dy) > 1e-6) t = Math.min(t, (dy > 0 ? (s - hs) : hs) / Math.abs(dy));
        nx = hs + t * dx;
        ny = hs + t * dy;
      }

      ctx.save();
      ctx.globalAlpha  = 1.0;
      ctx.font         = 'bold 15px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      // 검정 윤곽선으로 가독성 확보
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth   = 4;
      ctx.lineJoin    = 'round';
      ctx.strokeText('N', nx, ny);

      // 빨간 본문
      ctx.fillStyle = '#ff5555';
      ctx.fillText('N', nx, ny);

      ctx.restore();
    },

    // ----------------------------------------------------------
    // 초기화 (맵 진입 시) — 비트맵 생성만 담당, 스프라이트는 Widget_Minimap이 처리
    // ----------------------------------------------------------
    createSprite(scene) {
      this._scene = scene;
      this.initialize();
      this._dirty = true;
      if ($gamePlayer) this.explore($gamePlayer.x, $gamePlayer.y);
    },

    // ----------------------------------------------------------
    // 해제
    // ----------------------------------------------------------
    destroySprite() {
      this._scene = null;
      if (this._bitmap) { this._bitmap.destroy(); this._bitmap = null; }
    },

    // ----------------------------------------------------------
    // 매 프레임 갱신
    // ----------------------------------------------------------
    update() {
      if (!this._bitmap || !$gamePlayer) return;

      if (this._pendingExplore) {
        this._pendingExplore = false;
        this.explore($gamePlayer.x, $gamePlayer.y);
        this._dirty = true;
      }

      this._frameCount++;
      if (this._frameCount < this.UPDATE_INTERVAL) return;
      this._frameCount = 0;

      const px  = $gamePlayer.x;
      const py  = $gamePlayer.y;
      const dir = $gamePlayer.direction();
      const yaw = (CFG.rotation === 'rotate' &&
                   typeof Mode3D !== 'undefined' && Mode3D._active)
        ? Math.round(Mode3D._yawDeg || 0) : 0;

      // 이벤트 위치 변화 감지
      if (CFG.showEvents && $gameMap && $gameMap.events) {
        const evs = $gameMap.events();
        for (let i = 0; i < evs.length; i++) {
          const ev = evs[i];
          if (!ev) continue;
          const key = ev.eventId();
          const pos = ev.x + ',' + ev.y;
          if (this._lastEventPos[key] !== pos) {
            this._lastEventPos[key] = pos;
            this._dirty = true;
          }
        }
      }

      if (px  !== this._lastPx  || py  !== this._lastPy  ||
          dir !== this._lastDir || yaw !== this._lastYaw  ||
          this._dirty) {
        this._lastPx  = px;
        this._lastPy  = py;
        this._lastDir = dir;
        this._lastYaw = yaw;
        this._dirty   = false;
        this._render();
      }
    },

    // ----------------------------------------------------------
    // 표시/숨김
    // ----------------------------------------------------------
    setVisible(visible) {
      this._visible = visible;
      if ($gameSystem) $gameSystem._minimapVisible = visible;
      if (visible) {
        this._dirty = true;
        this._frameCount = this.UPDATE_INTERVAL;
        if ($gameMap && $gamePlayer) this._render();
      }
      // 오버레이 씬 연동
      if (typeof OverlayManager !== 'undefined') {
        if (visible) OverlayManager.show(CFG.overlaySceneId);
        else OverlayManager.hide(CFG.overlaySceneId);
      }
    },

    toggleVisible() {
      this.setVisible(!this._visible);
    },

    // ----------------------------------------------------------
    // 설정 변경
    // ----------------------------------------------------------
    setShape(shape) {
      if (shape !== 'circle' && shape !== 'square') return;
      CFG.shape = shape;
      this._dirty = true;
    },

    setRotation(mode) {
      if (mode !== 'north_fixed' && mode !== 'rotate') return;
      CFG.rotation = mode;
      this._dirty = true;
    },

    setTileSize(val) {
      const n = parseInt(val);
      if (!n || n < 1 || n > 16) return;
      CFG.tileSize = n;
      this._dirty  = true;
    },

    // ----------------------------------------------------------
    // 커스텀 마커
    // ----------------------------------------------------------
    addMarker(id, x, y, color, shape) {
      if (!id) return;
      if (!$gameSystem._minimapMarkers) $gameSystem._minimapMarkers = [];
      // 같은 ID 덮어쓰기
      $gameSystem._minimapMarkers = $gameSystem._minimapMarkers.filter(m => m.id !== id);
      $gameSystem._minimapMarkers.push({
        id,
        x:     parseInt(x)  || 0,
        y:     parseInt(y)  || 0,
        color: color        || CFG.eventMarkerColor,
        shape: shape        || 'circle',
      });
      this._dirty = true;
    },

    removeMarker(id) {
      if (!id || !$gameSystem._minimapMarkers) return;
      $gameSystem._minimapMarkers = $gameSystem._minimapMarkers.filter(m => m.id !== id);
      this._dirty = true;
    },

    clearMarkers() {
      if ($gameSystem) $gameSystem._minimapMarkers = [];
      this._dirty = true;
    },

    // ----------------------------------------------------------
    // 맵 이름
    // ----------------------------------------------------------
    getMapName() {
      if ($gameSystem && $gameSystem._minimapCustomName != null) {
        return $gameSystem._minimapCustomName;
      }
      if (!$gameMap) return '';
      const info = $dataMapInfos && $dataMapInfos[$gameMap.mapId()];
      return info ? (info.name || '') : '';
    },

    setMapName(name) {
      if ($gameSystem) $gameSystem._minimapCustomName = (name || null);
    },

    resetMapName() {
      if ($gameSystem) $gameSystem._minimapCustomName = null;
    },

    // ----------------------------------------------------------
    // 확대/축소 공개 API (Button 위젯 등에서 호출)
    // ----------------------------------------------------------
    zoomIn() {
      this.setTileSize(CFG.tileSize + 1);
    },

    zoomOut() {
      this.setTileSize(CFG.tileSize - 1);
    },
  };

  window.MinimapManager = MinimapManager;
