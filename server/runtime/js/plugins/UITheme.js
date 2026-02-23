/*:
 * @plugindesc UI 테마 — data/UIEditorConfig.json 으로 게임 UI 전체 커스터마이징
 * @author RPG Maker MV Web Editor
 *
 * @help UITheme.js
 *
 * RPG Maker MV 웹 에디터의 UI 에디터 기능과 연동합니다.
 * data/UIEditorConfig.json 의 설정을 읽어 게임 내 모든 Window의
 * 스타일(폰트, 투명도, 색조, 스킨)과 배치(위치, 크기)를 변경합니다.
 *
 * ● 기본 동작
 *   설정 파일이 없거나 overrides가 비어있으면 RPG Maker MV 원본과
 *   완전히 동일하게 동작합니다.
 *
 * ● 호환성
 *   RPG Maker MV 1.6.x 이상, NW.js 및 웹 브라우저 배포 모두 지원.
 *   이 플러그인은 에디터에서 자동으로 관리됩니다.
 */

(function () {
  'use strict';

  //===========================================================================
  // UIEditorConfig.json 로드
  // 동기 XHR: NW.js(로컬 파일) + 브라우저(서버) 양쪽 호환
  //===========================================================================
  var _config = {};
  (function () {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'data/UIEditorConfig.json', false);
      xhr.send();
      if (xhr.status === 200 || xhr.status === 0) {
        _config = JSON.parse(xhr.responseText);
      }
    } catch (e) {
      // 파일 없음 → 기본값 사용
    }
  })();

  var _ov = _config.overrides || {};

  /** 전역(Global) 설정값 취득 */
  function G(key, defaultVal) {
    var g = _ov['Global'];
    return (g && g[key] !== undefined) ? g[key] : defaultVal;
  }

  /** 클래스별 오버라이드 존재 여부 확인 */
  function hasOv(className) {
    return !!_ov[className];
  }

  /** 클래스별 오버라이드에서 값 취득 */
  function OV(className, key) {
    return (_ov[className] || {})[key];
  }

  //===========================================================================
  // Window_Base — 전역 스타일 (모든 Window에 적용)
  //===========================================================================

  Window_Base.prototype.standardFontSize = function () {
    return G('fontSize', 28);
  };

  Window_Base.prototype.standardPadding = function () {
    return G('padding', 18);
  };

  Window_Base.prototype.standardBackOpacity = function () {
    return G('backOpacity', 192);
  };

  Window_Base.prototype.loadWindowskin = function () {
    var skin = _config.defaultSkin || G('windowskin', 'Window');
    this.windowskin = ImageManager.loadSystem(skin);
  };

  // 전역 colorTone / opacity
  var _WB_initialize = Window_Base.prototype.initialize;
  Window_Base.prototype.initialize = function (x, y, width, height) {
    _WB_initialize.call(this, x, y, width, height);
    var tone = G('colorTone', null);
    if (Array.isArray(tone)) {
      this.setTone(tone[0] || 0, tone[1] || 0, tone[2] || 0);
    }
    var op = G('opacity', null);
    if (op !== null) this.opacity = op;
  };

  //===========================================================================
  // 헬퍼 — 클래스 프로토타입 스타일 오버라이드
  //
  // windowWidth / windowHeight : Scene이 생성 시 호출하는 메서드 오버라이드
  // fontSize / backOpacity     : standardXxx() 메서드 오버라이드
  // opacity / colorTone        : initialize 훅으로 인스턴스에 적용
  //===========================================================================
  function applyStyle(cls, className) {
    if (!cls || !hasOv(className)) return;
    var ov = _ov[className];

    if (ov.width !== undefined) {
      cls.prototype.windowWidth = function () { return ov.width; };
    }
    if (ov.height !== undefined) {
      cls.prototype.windowHeight = function () { return ov.height; };
    }
    if (ov.fontSize !== undefined) {
      cls.prototype.standardFontSize = function () { return ov.fontSize; };
    }
    if (ov.backOpacity !== undefined) {
      cls.prototype.standardBackOpacity = function () { return ov.backOpacity; };
    }
    if (ov.padding !== undefined) {
      cls.prototype.standardPadding = function () { return ov.padding; };
    }
    if (ov.opacity !== undefined || ov.colorTone) {
      var _orig = cls.prototype.initialize;
      cls.prototype.initialize = function () {
        _orig.apply(this, arguments);
        if (ov.opacity !== undefined) this.opacity = ov.opacity;
        if (Array.isArray(ov.colorTone)) {
          this.setTone(ov.colorTone[0] || 0, ov.colorTone[1] || 0, ov.colorTone[2] || 0);
        }
      };
    }
  }

  //===========================================================================
  // 헬퍼 — Scene.create() 이후 인스턴스에 위치/크기 적용
  //
  // Scene이 Window를 생성한 뒤 x/y를 덮어쓰는 경우를 처리.
  // width/height 도 보정 (windowWidth()가 없는 pass-through 창 대응).
  //===========================================================================
  function applyLayout(win, className) {
    if (!win || !hasOv(className)) return;
    var ov = _ov[className];

    if (ov.x !== undefined) win.x = ov.x;
    if (ov.y !== undefined) win.y = ov.y;

    var needResize = false;
    if (ov.width !== undefined && win.width !== ov.width) {
      win.width = ov.width;
      needResize = true;
    }
    if (ov.height !== undefined && win.height !== ov.height) {
      win.height = ov.height;
      needResize = true;
    }
    if (needResize) {
      if (win.createContents) win.createContents();
      if (win.refresh) win.refresh();
    }
  }

  //===========================================================================
  // 클래스별 스타일 적용
  //===========================================================================
  applyStyle(Window_Gold,         'Window_Gold');
  applyStyle(Window_Help,         'Window_Help');
  applyStyle(Window_MenuCommand,  'Window_MenuCommand');
  applyStyle(Window_MenuStatus,   'Window_MenuStatus');
  applyStyle(Window_ItemCategory, 'Window_ItemCategory');
  applyStyle(Window_ItemList,     'Window_ItemList');
  applyStyle(Window_SkillType,    'Window_SkillType');
  applyStyle(Window_SkillStatus,  'Window_SkillStatus');
  applyStyle(Window_SkillList,    'Window_SkillList');
  applyStyle(Window_EquipStatus,  'Window_EquipStatus');
  applyStyle(Window_EquipCommand, 'Window_EquipCommand');
  applyStyle(Window_EquipSlot,    'Window_EquipSlot');
  applyStyle(Window_EquipItem,    'Window_EquipItem');
  applyStyle(Window_Status,       'Window_Status');
  applyStyle(Window_Options,      'Window_Options');
  applyStyle(Window_SavefileList, 'Window_SavefileList');
  applyStyle(Window_ShopCommand,  'Window_ShopCommand');
  applyStyle(Window_ShopBuy,      'Window_ShopBuy');
  applyStyle(Window_ShopSell,     'Window_ShopSell');
  applyStyle(Window_ShopNumber,   'Window_ShopNumber');
  applyStyle(Window_ShopStatus,   'Window_ShopStatus');
  applyStyle(Window_NameEdit,     'Window_NameEdit');
  applyStyle(Window_NameInput,    'Window_NameInput');
  applyStyle(Window_Message,      'Window_Message');
  applyStyle(Window_ScrollText,   'Window_ScrollText');
  applyStyle(Window_MapName,      'Window_MapName');
  applyStyle(Window_BattleLog,    'Window_BattleLog');
  applyStyle(Window_PartyCommand, 'Window_PartyCommand');
  applyStyle(Window_ActorCommand, 'Window_ActorCommand');
  applyStyle(Window_BattleStatus, 'Window_BattleStatus');
  applyStyle(Window_BattleActor,  'Window_BattleActor');
  applyStyle(Window_BattleEnemy,  'Window_BattleEnemy');
  applyStyle(Window_TitleCommand, 'Window_TitleCommand');
  applyStyle(Window_GameEnd,      'Window_GameEnd');

  // Graphics 기반 기본값을 가지는 클래스 — windowWidth/Height 원본 보존하면서 오버라이드
  // (applyStyle에서 이미 처리하지 않은 경우에만 아래 기본값 주입)
  if (!OV('Window_MenuStatus', 'width')) {
    Window_MenuStatus.prototype.windowWidth = function () {
      return Graphics.boxWidth - 240;
    };
  }
  if (!OV('Window_MenuStatus', 'height')) {
    Window_MenuStatus.prototype.windowHeight = function () {
      return Graphics.boxHeight;
    };
  }
  if (!OV('Window_ItemCategory', 'width')) {
    Window_ItemCategory.prototype.windowWidth = function () {
      return Graphics.boxWidth;
    };
  }
  if (!OV('Window_BattleStatus', 'width')) {
    Window_BattleStatus.prototype.windowWidth = function () {
      return Graphics.boxWidth - 192;
    };
  }
  if (!OV('Window_BattleEnemy', 'width')) {
    Window_BattleEnemy.prototype.windowWidth = function () {
      return Graphics.boxWidth - 192;
    };
  }
  if (!OV('Window_Message', 'width')) {
    Window_Message.prototype.windowWidth = function () {
      return Graphics.boxWidth;
    };
  }
  if (!OV('Window_BattleLog', 'width')) {
    Window_BattleLog.prototype.windowWidth = function () {
      return Graphics.boxWidth;
    };
  }

  //===========================================================================
  // 위치 오버라이드 — updatePlacement() 보유 클래스
  // (updatePlacement 내부에서 x/y를 계산하므로 그 뒤에 덮어씀)
  //===========================================================================

  // Window_Options — 기본: 화면 중앙
  if (hasOv('Window_Options')) {
    var _WOpt_up = Window_Options.prototype.updatePlacement;
    Window_Options.prototype.updatePlacement = function () {
      _WOpt_up.call(this);
      var x = OV('Window_Options', 'x'), y = OV('Window_Options', 'y');
      if (x !== undefined) this.x = x;
      if (y !== undefined) this.y = y;
    };
  }

  // Window_TitleCommand — 기본: 수평 중앙, 하단 96px
  if (hasOv('Window_TitleCommand')) {
    var _WTC_up = Window_TitleCommand.prototype.updatePlacement;
    Window_TitleCommand.prototype.updatePlacement = function () {
      _WTC_up.call(this);
      var x = OV('Window_TitleCommand', 'x'), y = OV('Window_TitleCommand', 'y');
      if (x !== undefined) this.x = x;
      if (y !== undefined) this.y = y;
    };
  }

  // Window_GameEnd — 기본: 화면 중앙
  if (hasOv('Window_GameEnd')) {
    var _WGE_up = Window_GameEnd.prototype.updatePlacement;
    Window_GameEnd.prototype.updatePlacement = function () {
      _WGE_up.call(this);
      var x = OV('Window_GameEnd', 'x'), y = OV('Window_GameEnd', 'y');
      if (x !== undefined) this.x = x;
      if (y !== undefined) this.y = y;
    };
  }

  //===========================================================================
  // 위치/크기 오버라이드 — Scene.create() 훅
  // Scene이 Window를 생성하고 x/y를 결정한 뒤 applyLayout으로 덮어씀.
  //===========================================================================

  // Scene_Map
  var _SMap_create = Scene_Map.prototype.create;
  Scene_Map.prototype.create = function () {
    _SMap_create.call(this);
    applyLayout(this._mapNameWindow, 'Window_MapName');
  };

  // Scene_Menu
  var _SMenu_create = Scene_Menu.prototype.create;
  Scene_Menu.prototype.create = function () {
    _SMenu_create.call(this);
    applyLayout(this._goldWindow,    'Window_Gold');
    applyLayout(this._commandWindow, 'Window_MenuCommand');
    applyLayout(this._statusWindow,  'Window_MenuStatus');
  };

  // Scene_Item
  var _SItem_create = Scene_Item.prototype.create;
  Scene_Item.prototype.create = function () {
    _SItem_create.call(this);
    applyLayout(this._helpWindow,     'Window_Help');
    applyLayout(this._categoryWindow, 'Window_ItemCategory');
    applyLayout(this._itemWindow,     'Window_ItemList');
  };

  // Scene_Skill
  var _SSk_create = Scene_Skill.prototype.create;
  Scene_Skill.prototype.create = function () {
    _SSk_create.call(this);
    applyLayout(this._helpWindow,      'Window_Help');
    applyLayout(this._skillTypeWindow, 'Window_SkillType');
    applyLayout(this._statusWindow,    'Window_SkillStatus');
    applyLayout(this._itemWindow,      'Window_SkillList');
  };

  // Scene_Equip
  var _SEq_create = Scene_Equip.prototype.create;
  Scene_Equip.prototype.create = function () {
    _SEq_create.call(this);
    applyLayout(this._helpWindow,    'Window_Help');
    applyLayout(this._statusWindow,  'Window_EquipStatus');
    applyLayout(this._commandWindow, 'Window_EquipCommand');
    applyLayout(this._slotWindow,    'Window_EquipSlot');
    applyLayout(this._itemWindow,    'Window_EquipItem');
  };

  // Scene_Status
  var _SSt_create = Scene_Status.prototype.create;
  Scene_Status.prototype.create = function () {
    _SSt_create.call(this);
    applyLayout(this._statusWindow, 'Window_Status');
  };

  // Scene_Options
  var _SOpt_create = Scene_Options.prototype.create;
  Scene_Options.prototype.create = function () {
    _SOpt_create.call(this);
    applyLayout(this._optionsWindow, 'Window_Options');
  };

  // Scene_File (공통 — Save/Load 양쪽에 _helpWindow, _listWindow 존재)
  var _SF_create = Scene_File.prototype.create;
  Scene_File.prototype.create = function () {
    _SF_create.call(this);
    applyLayout(this._helpWindow, 'Window_Help');
    applyLayout(this._listWindow, 'Window_SavefileList');
  };

  // Scene_Shop
  var _SSh_create = Scene_Shop.prototype.create;
  Scene_Shop.prototype.create = function () {
    _SSh_create.call(this);
    applyLayout(this._helpWindow,    'Window_Help');
    applyLayout(this._goldWindow,    'Window_Gold');
    applyLayout(this._commandWindow, 'Window_ShopCommand');
    applyLayout(this._buyWindow,     'Window_ShopBuy');
    applyLayout(this._sellWindow,    'Window_ShopSell');
    applyLayout(this._numberWindow,  'Window_ShopNumber');
    applyLayout(this._statusWindow,  'Window_ShopStatus');
  };

  // Scene_Name
  var _SNm_create = Scene_Name.prototype.create;
  Scene_Name.prototype.create = function () {
    _SNm_create.call(this);
    applyLayout(this._editWindow,  'Window_NameEdit');
    applyLayout(this._inputWindow, 'Window_NameInput');
  };

  // Scene_GameEnd
  var _SGE_create = Scene_GameEnd.prototype.create;
  Scene_GameEnd.prototype.create = function () {
    _SGE_create.call(this);
    applyLayout(this._commandWindow, 'Window_GameEnd');
  };

  // Scene_Battle
  var _SBt_create = Scene_Battle.prototype.create;
  Scene_Battle.prototype.create = function () {
    _SBt_create.call(this);
    applyLayout(this._logWindow,          'Window_BattleLog');
    applyLayout(this._partyCommandWindow, 'Window_PartyCommand');
    applyLayout(this._actorCommandWindow, 'Window_ActorCommand');
    applyLayout(this._statusWindow,       'Window_BattleStatus');
    applyLayout(this._actorWindow,        'Window_BattleActor');
    applyLayout(this._enemyWindow,        'Window_BattleEnemy');
    applyLayout(this._skillWindow,        'Window_BattleSkill');
    applyLayout(this._itemWindow,         'Window_BattleItem');
    applyLayout(this._helpWindow,         'Window_Help');
  };

})();
