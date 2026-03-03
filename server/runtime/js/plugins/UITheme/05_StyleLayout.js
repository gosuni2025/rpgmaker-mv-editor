
  function applyStyle(cls, cn) {
    if (!cls || !hasOv(cn)) return;
    var ov = _ov[cn], p = cls.prototype;
    if (ov.width       !== undefined) p.windowWidth        = function(){return ov.width;};
    if (ov.height      !== undefined) p.windowHeight       = function(){return ov.height;};
    if (ov.fontSize    !== undefined) p.standardFontSize   = function(){return ov.fontSize;};
    if (ov.fontFace    !== undefined) p.standardFontFace   = function(){return ov.fontFace;};
    if (ov.backOpacity !== undefined) p.standardBackOpacity= function(){return ov.backOpacity;};
    if (ov.padding     !== undefined) p.standardPadding    = function(){return ov.padding;};
    if (ov.windowskinName !== undefined || ov.imageFile !== undefined) {
      p.loadWindowskin = function() {
        this.windowskin = ImageManager.loadSystem('Window');
        var sf = ov.windowStyle==='image' ? ov.imageFile : ov.windowskinName;
        this._themeSkin = sf && sf!=='Window' ? ImageManager.loadSystem(sf) : null;
      };
    }
    if (ov.opacity !== undefined || ov.colorTone) {
      var _o = p.initialize;
      p.initialize = function() {
        _o.apply(this, arguments);
        if (ov.opacity!==undefined) this.opacity=ov.opacity;
        if (Array.isArray(ov.colorTone)) this.setTone(ov.colorTone[0]||0,ov.colorTone[1]||0,ov.colorTone[2]||0);
      };
    }
  }

  function applyLayout(win, cn) {
    if (!win || !hasOv(cn)) return;
    var ov = _ov[cn];
    if (!win._uiThemeOriginal) win._uiThemeOriginal = {x:win.x,y:win.y,width:win.width,height:win.height};
    if (ov.x!==undefined) win.x=ov.x; if (ov.y!==undefined) win.y=ov.y;
    var nr=false;
    if (ov.width !==undefined && win.width !==ov.width)  { win.width =ov.width;  nr=true; }
    if (ov.height!==undefined && win.height!==ov.height) { win.height=ov.height; nr=true; }
    if (nr) { if (win.createContents) win.createContents(); if (win.refresh) win.refresh(); }
    var D = Math.PI/180;
    if (ov.rotationX!==undefined) win.rotationX=ov.rotationX*D;
    if (ov.rotationY!==undefined) win.rotationY=ov.rotationY*D;
    if (ov.rotationZ!==undefined) win.rotation =ov.rotationZ*D;
    if (win.pivot) {
      if (ov.rotationX||ov.rotationY||ov.rotationZ) {
        var pv=_parsePivotAnchor(ov.animPivot||'center',win.width,win.height);
        win.pivot.x=pv.x; win.pivot.y=pv.y;
        win.x=(ov.x!==undefined?ov.x:win._uiThemeOriginal.x)+pv.x;
        win.y=(ov.y!==undefined?ov.y:win._uiThemeOriginal.y)+pv.y;
      } else { win.pivot.x=0; win.pivot.y=0; }
    }
    _setWindowLayer(win,(ov.renderCamera||(ov.rotationX||ov.rotationY?'perspective':'orthographic'))==='perspective'?1:0);
    if (ov.rotationX||ov.rotationY) _applyPerspHitTest(win);
    if (!window._uiEditorPreview && Array.isArray(ov.entrances) && ov.entrances.length>0)
      startEntranceAnimation(win,ov.entrances,cn);
  }

  ['Window_Gold','Window_Help','Window_MenuCommand','Window_MenuStatus','Window_ItemCategory',
   'Window_ItemList','Window_SkillType','Window_SkillStatus','Window_SkillList',
   'Window_EquipStatus','Window_EquipCommand','Window_EquipSlot','Window_EquipItem',
   'Window_Status','Window_Options','Window_SavefileList','Window_ShopCommand',
   'Window_ShopBuy','Window_ShopSell','Window_ShopNumber','Window_ShopStatus',
   'Window_NameEdit','Window_NameInput','Window_Message','Window_ScrollText',
   'Window_MapName','Window_BattleLog','Window_PartyCommand','Window_ActorCommand',
   'Window_BattleStatus','Window_BattleActor','Window_BattleEnemy','Window_TitleCommand','Window_GameEnd',
  ].forEach(function(cn) { applyStyle(window[cn], cn); });

  // Graphics 기반 기본값 — windowWidth/Height 원본 보존하면서 오버라이드
  if (!OV('Window_MenuStatus','width'))   Window_MenuStatus.prototype.windowWidth    = function(){return Graphics.boxWidth-240;};
  if (!OV('Window_MenuStatus','height'))  Window_MenuStatus.prototype.windowHeight   = function(){return Graphics.boxHeight;};
  if (!OV('Window_ItemCategory','width')) Window_ItemCategory.prototype.windowWidth  = function(){return Graphics.boxWidth;};
  if (!OV('Window_BattleStatus','width')) Window_BattleStatus.prototype.windowWidth  = function(){return Graphics.boxWidth-192;};
  if (!OV('Window_BattleEnemy','width'))  Window_BattleEnemy.prototype.windowWidth   = function(){return Graphics.boxWidth-192;};
  if (!OV('Window_Message','width'))      Window_Message.prototype.windowWidth       = function(){return Graphics.boxWidth;};
  if (!OV('Window_BattleLog','width'))    Window_BattleLog.prototype.windowWidth     = function(){return Graphics.boxWidth;};

  // updatePlacement 오버라이드 (Window_Options, Window_TitleCommand, Window_GameEnd)
  function _wupd(cls, cn) {
    if (!hasOv(cn)) return;
    var _o = cls.prototype.updatePlacement;
    cls.prototype.updatePlacement = function() {
      _o.call(this);
      if (!this._uiThemeOriginal)
        this._uiThemeOriginal = { x:this.x, y:this.y, width:this.width, height:this.height };
      var x=OV(cn,'x'), y=OV(cn,'y');
      if (x!==undefined) this.x=x; if (y!==undefined) this.y=y;
    };
  }
  _wupd(Window_Options,'Window_Options'); _wupd(Window_TitleCommand,'Window_TitleCommand'); _wupd(Window_GameEnd,'Window_GameEnd');

  // [SceneClass, [[winProp, WinClass], ...]]
  var SCENE_LAYOUTS = [
    [Scene_Map,     [['_mapNameWindow','Window_MapName']]],
    [Scene_Menu,    [['_goldWindow','Window_Gold'],['_commandWindow','Window_MenuCommand'],['_statusWindow','Window_MenuStatus']]],
    [Scene_Item,    [['_helpWindow','Window_Help'],['_categoryWindow','Window_ItemCategory'],['_itemWindow','Window_ItemList']]],
    [Scene_Skill,   [['_helpWindow','Window_Help'],['_skillTypeWindow','Window_SkillType'],['_statusWindow','Window_SkillStatus'],['_itemWindow','Window_SkillList']]],
    [Scene_Equip,   [['_helpWindow','Window_Help'],['_statusWindow','Window_EquipStatus'],['_commandWindow','Window_EquipCommand'],['_slotWindow','Window_EquipSlot'],['_itemWindow','Window_EquipItem']]],
    [Scene_Status,  [['_statusWindow','Window_Status']]],
    [Scene_Options, [['_optionsWindow','Window_Options']]],
    [Scene_File,    [['_helpWindow','Window_Help'],['_listWindow','Window_SavefileList']]],
    [Scene_Shop,    [['_helpWindow','Window_Help'],['_goldWindow','Window_Gold'],['_commandWindow','Window_ShopCommand'],['_buyWindow','Window_ShopBuy'],['_sellWindow','Window_ShopSell'],['_numberWindow','Window_ShopNumber'],['_statusWindow','Window_ShopStatus']]],
    [Scene_Name,    [['_editWindow','Window_NameEdit'],['_inputWindow','Window_NameInput']]],
    [Scene_GameEnd, [['_commandWindow','Window_GameEnd']]],
    [Scene_Battle,  [['_logWindow','Window_BattleLog'],['_partyCommandWindow','Window_PartyCommand'],['_actorCommandWindow','Window_ActorCommand'],['_statusWindow','Window_BattleStatus'],['_actorWindow','Window_BattleActor'],['_enemyWindow','Window_BattleEnemy'],['_skillWindow','Window_BattleSkill'],['_itemWindow','Window_BattleItem'],['_helpWindow','Window_Help']]],
  ];
  SCENE_LAYOUTS.forEach(function(pair) {
    var cls = pair[0], maps = pair[1], _orig = cls.prototype.create;
    cls.prototype.create = function() {
      _orig.call(this);
      for (var i=0; i<maps.length; i++) applyLayout(this[maps[i][0]], maps[i][1]);
    };
  });

  // [cls, className, method, elemType, argX, argY, argW, argH]
  [[Window_Status,'Window_Status','drawActorName','actorName',1,2,3,null],
   [Window_Status,'Window_Status','drawActorClass','actorClass',1,2,3,null],
   [Window_Status,'Window_Status','drawActorNickname','actorNickname',1,2,3,null],
   [Window_Status,'Window_Status','drawActorFace','actorFace',1,2,3,4],
   [Window_Status,'Window_Status','drawActorLevel','actorLevel',1,2,null,null],
   [Window_Status,'Window_Status','drawActorIcons','actorIcons',1,2,3,null],
   [Window_Status,'Window_Status','drawActorHp','actorHp',1,2,3,null],
   [Window_Status,'Window_Status','drawActorMp','actorMp',1,2,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorName','actorName',1,null,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorIcons','actorIcons',1,null,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorHp','actorHp',1,null,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorMp','actorMp',1,null,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorTp','actorTp',1,null,3,null],
   [Window_MenuStatus,'Window_MenuStatus','drawActorFace','actorFace',1,null,3,4],
   [Window_MenuStatus,'Window_MenuStatus','drawSimpleStatus','simpleStatus',1,null,3,null],
  ].forEach(function(a) { wrapDraw(a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7]); });

  var ELEM_TO_METHOD = {
    actorName:'drawActorName', actorClass:'drawActorClass', actorNickname:'drawActorNickname',
    actorFace:'drawActorFace', actorLevel:'drawActorLevel', actorIcons:'drawActorIcons',
    actorHp:'drawActorHp', actorMp:'drawActorMp', actorTp:'drawActorTp', simpleStatus:'drawSimpleStatus',
  };

  var _origWBCC = Window_Base.prototype.createContents;
  Window_Base.prototype.createContents = function () {
    _origWBCC.call(this);
    var classOv = _ov[this.constructor.name];
    if (!classOv || !classOv.elements) return;
    var self = this;
    Object.keys(classOv.elements).forEach(function (et) {
      var cfg = classOv.elements[et];
      if (!cfg || (!cfg.fontFace && cfg.visible !== false)) return;
      var mn = ELEM_TO_METHOD[et] || et;
      if (typeof self[mn] !== 'function' || self.hasOwnProperty(mn)) return;
      var orig = self[mn];
      self[mn] = (function (fn, c) {
        return function () {
          if (c.visible === false) return;
          var pf = this.contents && this.contents.fontFace;
          if (c.fontFace && this.contents) this.contents.fontFace = c.fontFace;
          var r = fn.apply(this, arguments);
          if (c.fontFace && this.contents) this.contents.fontFace = pf;
          return r;
        };
      })(orig, cfg);
    });
  };
