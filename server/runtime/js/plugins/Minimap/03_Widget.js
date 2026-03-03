
  // ============================================================
  // Widget_Minimap — CustomSceneEngine 위젯 레지스트리에 등록
  // ============================================================

  function Widget_Minimap() {}

  // Widget_Base 상속 (CustomSceneEngine이 먼저 로드되어야 함)
  Widget_Minimap.prototype = Object.create((window.Widget_Base || Object).prototype);
  Widget_Minimap.prototype.constructor = Widget_Minimap;

  Widget_Minimap.prototype.initialize = function (def, parentWidget) {
    if (window.Widget_Base) window.Widget_Base.prototype.initialize.call(this, def, parentWidget);
    else {
      this._def = def || {};
      this._id = def ? def.id : '';
      this._x = def ? (def.x || 0) : 0;
      this._y = def ? (def.y || 0) : 0;
      this._width  = def ? (def.width  || 192) : 192;
      this._height = def ? (def.height || 192) : 192;
      this._visible = true;
      this._children = [];
    }

    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    this._displayObject = sprite;
    this._minimapSprite = sprite;
  };

  Widget_Minimap.prototype.displayObject = function () {
    return this._displayObject;
  };

  Widget_Minimap.prototype.update = function () {
    // MinimapManager가 렌더링한 최신 비트맵을 스프라이트에 연결
    if (this._minimapSprite && typeof MinimapManager !== 'undefined' && MinimapManager._bitmap) {
      this._minimapSprite.bitmap = MinimapManager._bitmap;
    }
  };

  Widget_Minimap.prototype.refresh = function () {};

  Widget_Minimap.prototype.collectFocusable = function () {};

  // CustomSceneEngine에 등록 (엔진이 로드된 경우)
  if (window.__customSceneEngine && window.__customSceneEngine.registerWidget) {
    window.__customSceneEngine.registerWidget('minimap', Widget_Minimap);
  }
