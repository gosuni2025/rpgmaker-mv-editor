/*:
 * @pluginname NPC 이름 표시
 * @plugindesc 이벤트 캐릭터 머리 위에 NPC 이름을 표시합니다.
 * @author gosuni2025
 *
 * @param Font Size
 * @type number
 * @min 8
 * @max 48
 * @desc 이름 텍스트 폰트 크기 (픽셀)
 * @default 16
 *
 * @param Text Color
 * @type color
 * @desc 이름 텍스트 색상 (CSS 색상 코드)
 * @default #ffffff
 *
 * @param Outline Color
 * @type color
 * @desc 이름 텍스트 외곽선 색상
 * @default rgba(0,0,0,0.85)
 *
 * @param Outline Width
 * @type number
 * @min 0
 * @max 10
 * @desc 이름 텍스트 외곽선 두께
 * @default 3
 *
 * @param Offset Y
 * @type number
 * @min -200
 * @max 200
 * @desc 캐릭터 머리 위 Y 오프셋 (픽셀, 음수 = 위로)
 * @default -4
 *
 * @param Minimap Icon Mode
 * @text 미니맵 아이콘 표시
 * @type select
 * @option 출력 안함
 * @value none
 * @option 에디터에서만
 * @value editor
 * @option 인게임에서도
 * @value always
 * @desc NPC 이름 앞에 미니맵 마커(도형/아이콘)를 표시할지 여부
 * @default editor
 */

(function () {
  'use strict';

  var parameters = PluginManager.parameters('NPCNameDisplay');
  var fontSize      = parseInt(parameters['Font Size']    || '16');
  var textColor     = parameters['Text Color']            || '#ffffff';
  var outlineColor  = parameters['Outline Color']         || 'rgba(0,0,0,0.85)';
  var outlineWidth  = parseInt(parameters['Outline Width']|| '3');
  var offsetY       = parseInt(parameters['Offset Y']     || '-4');
  var minimapIconMode = parameters['Minimap Icon Mode']   || 'editor';

  var BITMAP_W  = 200;
  var BITMAP_H  = fontSize + outlineWidth * 2 + 8;
  var MARKER_R  = Math.floor(Math.min(BITMAP_H - 4, fontSize + 4) / 2);
  var MARKER_D  = MARKER_R * 2;
  var MARKER_GAP = 5;

  // ─── 헬퍼 ────────────────────────────────────────────────────

  function _shouldShowMarker() {
    if (minimapIconMode === 'none')   return false;
    if (minimapIconMode === 'editor') return !!window.__editorMode;
    return true; // 'always'
  }

  function _getMarkerData(eventId) {
    if (!$dataMap || !$dataMap.minimapData) return null;
    var d = $dataMap.minimapData[eventId];
    return (d && d.enabled) ? d : null;
  }

  function _markerKey(d) {
    if (!d) return '';
    return (d.iconIndex !== undefined ? 'i' + d.iconIndex : '') +
           '|' + (d.shape || 'circle') + '|' + (d.color || '');
  }

  function _drawShape(ctx, shape, cx, cy, r, color) {
    ctx.fillStyle   = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth   = 1;

    if (shape === 'cross') {
      var t = r * 0.32;
      ctx.fillRect(cx - t, cy - r, t * 2, r * 2);
      ctx.fillRect(cx - r, cy - t, r * 2, t * 2);
      return;
    }

    ctx.beginPath();
    switch (shape) {
      case 'square':
        ctx.rect(cx - r, cy - r, r * 2, r * 2);
        break;
      case 'diamond':
        ctx.moveTo(cx,     cy - r);
        ctx.lineTo(cx + r, cy    );
        ctx.lineTo(cx,     cy + r);
        ctx.lineTo(cx - r, cy    );
        ctx.closePath();
        break;
      case 'star': {
        var ir = r * 0.45;
        for (var i = 0; i < 10; i++) {
          var a = (Math.PI / 5) * i - Math.PI / 2;
          var rad = (i % 2 === 0) ? r : ir;
          if (i === 0) ctx.moveTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
          else         ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
        }
        ctx.closePath();
        break;
      }
      case 'triangle':
        ctx.moveTo(cx,               cy - r);
        ctx.lineTo(cx + r * 0.866,   cy + r * 0.5);
        ctx.lineTo(cx - r * 0.866,   cy + r * 0.5);
        ctx.closePath();
        break;
      case 'heart': {
        var hs = r * 0.5;
        ctx.moveTo(cx, cy + r * 0.7);
        ctx.bezierCurveTo(cx - r, cy + hs,      cx - r, cy - r * 0.7, cx, cy - hs);
        ctx.bezierCurveTo(cx + r, cy - r * 0.7, cx + r, cy + hs,      cx, cy + r * 0.7);
        ctx.closePath();
        break;
      }
      default: // circle
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
    }
    ctx.fill();
    ctx.stroke();
  }

  // ─── Sprite_Character ────────────────────────────────────────

  var _initMembers = Sprite_Character.prototype.initMembers;
  Sprite_Character.prototype.initMembers = function () {
    _initMembers.call(this);
    this._npcNameSprite       = null;
    this._npcNameCurrent      = null;
    this._npcIconPending      = false;
    this._npcNameMarkerOffset = 0;
  };

  var _update = Sprite_Character.prototype.update;
  Sprite_Character.prototype.update = function () {
    _update.call(this);
    this._updateNpcName();
  };

  Sprite_Character.prototype._updateNpcName = function () {
    var character = this._character;
    if (!character || typeof character.event !== 'function') {
      this._destroyNpcName(); return;
    }
    var event = character.event();
    if (!event) { this._destroyNpcName(); return; }

    var npcEntry = $dataMap && $dataMap.npcData && $dataMap.npcData[event.id];
    var name = (npcEntry && npcEntry.showName && npcEntry.name) ? npcEntry.name : null;
    if (!name) { this._destroyNpcName(); return; }

    // 마커 데이터 결정
    var markerData = _shouldShowMarker() ? _getMarkerData(event.id) : null;

    // iconIndex: IconSet 로딩 완료 전에는 도형 없이 표시 → 로드 완료 시 재생성
    if (markerData && markerData.iconIndex !== undefined) {
      var iconBmp = ImageManager.loadSystem('IconSet');
      if (!iconBmp.isReady()) {
        if (!this._npcIconPending) {
          this._npcIconPending = true;
          iconBmp.addLoadListener(function () {
            this._npcIconPending = false;
            this._npcNameCurrent = null; // 재생성 트리거
          }.bind(this));
        }
        markerData = null; // 로딩 중엔 마커 없이
      }
    }

    var fullKey = name + '|' + _markerKey(markerData);
    if (!this._npcNameSprite || this._npcNameCurrent !== fullKey) {
      this._destroyNpcName();
      this._createNpcName(name, markerData);
      this._npcNameCurrent = fullKey;
    }

    if (this._npcNameSprite) {
      this._npcNameSprite.x = this._npcNameMarkerOffset;
      var h = (this.bitmap ? this.patternHeight() : 48);
      this._npcNameSprite.y = -h + offsetY;
    }
  };

  Sprite_Character.prototype._createNpcName = function (name, markerData) {
    var hasMarker = !!markerData;
    var totalW    = hasMarker ? MARKER_D + MARKER_GAP + BITMAP_W : BITMAP_W;
    var bitmap    = new Bitmap(totalW, BITMAP_H);
    var ctx       = bitmap._context;
    var cy        = Math.floor(BITMAP_H / 2);

    if (hasMarker) {
      var cx = MARKER_R;
      if (markerData.iconIndex !== undefined) {
        var iconBmp = ImageManager.loadSystem('IconSet');
        var iw = Window_Base._iconWidth  || 32;
        var ih = Window_Base._iconHeight || 32;
        var sx = (markerData.iconIndex % 16) * iw;
        var sy = Math.floor(markerData.iconIndex / 16) * ih;
        ctx.drawImage(iconBmp._canvas, sx, sy, iw, ih,
                      cx - MARKER_R, cy - MARKER_R, MARKER_D, MARKER_D);
      } else {
        _drawShape(ctx, markerData.shape || 'circle', cx, cy, MARKER_R - 1,
                   markerData.color || '#ffcc00');
      }
    }

    // drawText가 내부적으로 _setDirty() 호출 → ctx 변경분도 함께 업로드됨
    bitmap.fontSize     = fontSize;
    bitmap.outlineColor = outlineColor;
    bitmap.outlineWidth = outlineWidth;
    bitmap.textColor    = textColor;
    // 텍스트는 항상 'center' 정렬 — sprite.x 보정과 함께 캐릭터 중앙에 위치
    var textX = hasMarker ? MARKER_D + MARKER_GAP : 0;
    bitmap.drawText(name, textX, 0, BITMAP_W, BITMAP_H, 'center');

    var sprite    = new Sprite(bitmap);
    sprite.anchor.x = 0.5;
    sprite.anchor.y = 1.0;
    this.addChild(sprite);
    this._npcNameSprite = sprite;
    // 마커로 bitmap이 왼쪽으로 확장됐으므로, 텍스트 중앙을 캐릭터 중앙에 맞추기 위해
    // anchor.x=0.5 기준으로 +12.5 이동된 텍스트를 -12.5 보정 → sprite.x = -(MARKER_D+GAP)/2
    this._npcNameMarkerOffset = hasMarker ? -Math.round((MARKER_D + MARKER_GAP) / 2) : 0;
  };

  Sprite_Character.prototype._destroyNpcName = function () {
    if (this._npcNameSprite) {
      this.removeChild(this._npcNameSprite);
      this._npcNameSprite  = null;
      this._npcNameCurrent = null;
    }
  };
})();
