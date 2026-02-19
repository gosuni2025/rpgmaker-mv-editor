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
 * @desc 이름 텍스트 색상 (CSS 색상 코드)
 * @default #ffffff
 *
 * @param Outline Color
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
 */

(function () {
  'use strict';

  var parameters = PluginManager.parameters('NPCNameDisplay');
  var fontSize = parseInt(parameters['Font Size'] || '16');
  var textColor = parameters['Text Color'] || '#ffffff';
  var outlineColor = parameters['Outline Color'] || 'rgba(0,0,0,0.85)';
  var outlineWidth = parseInt(parameters['Outline Width'] || '3');
  var offsetY = parseInt(parameters['Offset Y'] || '-4');

  var BITMAP_W = 200;
  var BITMAP_H = fontSize + outlineWidth * 2 + 8;

  //-----------------------------------------------------------------------------
  // Sprite_Character
  //-----------------------------------------------------------------------------

  var _initMembers = Sprite_Character.prototype.initMembers;
  Sprite_Character.prototype.initMembers = function () {
    _initMembers.call(this);
    this._npcNameSprite = null;
    this._npcNameCurrent = null;
  };

  var _update = Sprite_Character.prototype.update;
  Sprite_Character.prototype.update = function () {
    _update.call(this);
    this._updateNpcName();
  };

  Sprite_Character.prototype._updateNpcName = function () {
    var character = this._character;
    // Game_Event 여부: event() 메서드가 있으면 이벤트 캐릭터
    if (!character || typeof character.event !== 'function') {
      this._destroyNpcName();
      return;
    }

    var event = character.event();
    if (!event) {
      this._destroyNpcName();
      return;
    }

    var npcEntry = $dataMap && $dataMap.npcData && $dataMap.npcData[event.id];
    var name = (npcEntry && npcEntry.showName && npcEntry.name) ? npcEntry.name : null;

    if (!name) {
      this._destroyNpcName();
      return;
    }

    // 이름이 바뀐 경우 스프라이트 재생성
    if (!this._npcNameSprite || this._npcNameCurrent !== name) {
      this._destroyNpcName();
      this._createNpcName(name);
    }

    // 위치 갱신: 앵커가 하단 중앙이므로 patternHeight() 위에 표시
    if (this._npcNameSprite) {
      this._npcNameSprite.x = 0;
      var h = (this.bitmap ? this.patternHeight() : 48);
      this._npcNameSprite.y = -h + offsetY;
    }
  };

  Sprite_Character.prototype._createNpcName = function (name) {
    var bitmap = new Bitmap(BITMAP_W, BITMAP_H);
    bitmap.fontSize = fontSize;
    bitmap.outlineColor = outlineColor;
    bitmap.outlineWidth = outlineWidth;
    bitmap.textColor = textColor;
    bitmap.drawText(name, 0, 0, BITMAP_W, BITMAP_H, 'center');

    var sprite = new Sprite(bitmap);
    sprite.anchor.x = 0.5;
    sprite.anchor.y = 1.0;

    this.addChild(sprite);
    this._npcNameSprite = sprite;
    this._npcNameCurrent = name;
  };

  Sprite_Character.prototype._destroyNpcName = function () {
    if (this._npcNameSprite) {
      this.removeChild(this._npcNameSprite);
      this._npcNameSprite = null;
      this._npcNameCurrent = null;
    }
  };
})();
