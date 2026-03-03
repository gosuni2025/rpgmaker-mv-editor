  var BATTLE_WIN_PROXY_MAP = [
    { widgetId: 'logWindow',    winProp: '_logWindow'    },
    { widgetId: 'statusWindow', winProp: '_statusWindow' },
    { widgetId: 'helpWindow',   winProp: '_helpWindow'   },
    { widgetId: 'skillWindow',  winProp: '_skillWindow'  },
    { widgetId: 'itemWindow',   winProp: '_itemWindow'   },
    { widgetId: 'actorWindow',  winProp: '_actorWindow'  },
    { widgetId: 'enemyWindow',  winProp: '_enemyWindow'  },
  ];
  function installBattleWindowProxy(win, widget, widgetId) {
    if (!win) return; win._csProxied = true; if (win.move) win.move(-9999, win.y); else win.x = -9999;
    if (!widget) {
      console.error('[CSE:battle] 위젯 누락: id="' + widgetId + '" — battle.json에 해당 id의 위젯을 추가하세요.');
      ['show', 'open', 'activate'].forEach(function(m) {
        if (!win[m]) return;
        win[m] = function() {
          console.warn('[CSE:battle] ' + widgetId + '.' + m + '() — 위젯 없음');
        };
      }); return;
    }
    var DELEGATE = ['show', 'hide', 'open', 'close', 'activate', 'deactivate',
                    'refresh', 'select', 'deselect', 'setActor', 'setStypeId', 'setItem'];
    DELEGATE.forEach(function(method) {
      if (!win[method]) return; var orig = win[method].bind(win);
      win[method] = function() {
          try { orig.apply(win, arguments); } catch(e) {}
        if (method === 'activate') win.active = false; win.x = -9999; if (widget[method]) widget[method].apply(widget, arguments);
      };
    });
    if (win.setHandler) {
      var origSH = win.setHandler.bind(win);
      win.setHandler = function(symbol, fn) {
        origSH(symbol, fn); if (widget.setHandler) widget.setHandler(symbol, fn);
      };
    }
    if (widgetId === 'helpWindow' && win.setItem) {
      var _prevSetItem = win.setItem.bind(win);
      win.setItem = function(item) {
        _prevSetItem(item); var scene = SceneManager._scene;
        if (scene && scene._ctx) {
          var text = (item && item.description) ? item.description : '';
          if (item && item.stypeId !== undefined) {
            var actor = BattleManager.actor();
            if (actor) {
              var mpCost = actor.skillMpCost(item); var tpCost = actor.skillTpCost(item); var costs = []; if (mpCost > 0) costs.push('MP ' + mpCost);
              if (tpCost > 0) costs.push('TP ' + tpCost); if (costs.length > 0) text += '\n소비: ' + costs.join(' / ');
            }
          }
          scene._ctx.helpText = text;
        }
      };
    }
    if (widgetId === 'skillWindow' || widgetId === 'itemWindow') {
      win.item = function() { return widget._window ? widget._window.currentExt() : null; };
    }
    if (widgetId === 'actorWindow') {
      win.actor = function() {
        if (widget._window) return widget._window.currentExt(); return widget.currentExt ? widget.currentExt() : null;
      };
      win.index = function() {
        if (widget._window) return widget._window.index(); return widget.index ? widget.index() : -1;
      };
    }
    if (widgetId === 'enemyWindow') {
      win.enemy = function() { return widget._window ? widget._window.currentExt() : null; };
      win.enemyIndex = function() { return widget._window ? widget._window.index() : -1; };
    }
    if (widget._window && widget._window !== win && win._handlers) {   for (var _sym in win._handlers) if (Object.prototype.hasOwnProperty.call(win._handlers, _sym)) widget._window.setHandler(_sym, win._handlers[_sym]); }
  }
  function applyBattleOverrides(Klass, sceneId) {
    var SCU = Scene_CustomUI.prototype; var SCB = Scene_Battle.prototype;
    for (var key in SCU) if (SCU.hasOwnProperty(key) && !SCB.hasOwnProperty(key)) Klass.prototype[key] = SCU[key]; var origInit = Klass.prototype.initialize;
    Klass.prototype.initialize = function() {
      origInit.call(this); this._ctx = this._ctx || {}; this._widgetMap = {}; this._rootWidget = null;
    }; Klass.prototype._getSceneDef = function() { return (_scenesData.scenes || {})[sceneId] || null; }; var origCreateAllWindows = Klass.prototype.createAllWindows;
    Klass.prototype.createAllWindows = function() {
      var sceneDef = this._getSceneDef(); if (sceneDef && sceneDef.root) this._createWidgetTree(sceneDef); origCreateAllWindows.call(this); var nativePositions = {};
      for (var pi = 0; pi < BATTLE_WIN_PROXY_MAP.length; pi++) {
        var pentry = BATTLE_WIN_PROXY_MAP[pi]; var pwin = this[pentry.winProp];
        if (pwin) {
          nativePositions[pentry.widgetId] = {
            x: pwin.x, y: pwin.y, width: pwin.width, height: pwin.height
          };
        }
      }
      var wmap = this._widgetMap || {};
      for (var i = 0; i < BATTLE_WIN_PROXY_MAP.length; i++) {
        var entry = BATTLE_WIN_PROXY_MAP[i]; var win = this[entry.winProp]; var widget = wmap[entry.widgetId] || null; installBattleWindowProxy(win, widget, entry.widgetId);
      }
      if (this._messageWindow) this._messageWindow.x = -9999;
      if (sceneDef && sceneDef.root) {
        var needsSave = false;
        for (var widgetId in nativePositions) {
          var widgetDef = _findWidgetDefById(sceneDef.root, widgetId);
          if (widgetDef && widgetDef.nativeDefault) {
            var pos = nativePositions[widgetId]; widgetDef.x = pos.x; widgetDef.y = pos.y; widgetDef.width = pos.width;
            widgetDef.height = pos.height; var nwgt = wmap[widgetId]; if (nwgt) _applyPosToWidget(nwgt, pos); needsSave = true;
          }
        }
        if (needsSave) {
          _saveSceneDef(sceneDef, function() {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'sceneDefUpdated', sceneId: sceneDef.id }, '*');
            }
          });
        }
      }
      var _hiddenAtStart = ['skillWindow', 'itemWindow', 'actorWindow', 'enemyWindow', 'helpWindow', 'actorCommand'];
      for (var hi = 0; hi < _hiddenAtStart.length; hi++) {
        var hw = wmap[_hiddenAtStart[hi]]; if (hw && hw.hide) hw.hide();
      }
      var rootObj = this._rootWidget && this._rootWidget.displayObject(); if (rootObj && !(rootObj instanceof Window_Base)) this.addChild(rootObj);
    };
    Klass.prototype.createPartyCommandWindow = function() {
      var widget = this._widgetMap && this._widgetMap['partyCommand'];
      if (widget && widget._window) {
        var win = widget._window; win.setup = function() { this.refresh(); this.select(0); this.activate(); this.open(); }; this._partyCommandWindow = win;
      } else {
        this._partyCommandWindow = new Window_PartyCommand(); this.addWindow(this._partyCommandWindow);
      }
      this._partyCommandWindow.setHandler('fight',  this.commandFight.bind(this));
      this._partyCommandWindow.setHandler('escape', this.commandEscape.bind(this));
      this._partyCommandWindow.setHandler('cancel', function() { SoundManager.playBuzzer(); this._partyCommandWindow.activate(); }.bind(this));
      this._partyCommandWindow.deselect();
    };
    Klass.prototype.createActorCommandWindow = function() {
      var widget = this._widgetMap && this._widgetMap['actorCommand'];
      if (widget && widget._window) {
        var win = widget._window; var actorWidget = widget;
        win.setup = function(actor) {
          if (actorWidget._rebuildFromScript) actorWidget._rebuildFromScript(); if (actorWidget.show) actorWidget.show(); this.select(0); this.activate(); this.open();
        }; this._actorCommandWindow = win;
      } else {
        this._actorCommandWindow = new Window_ActorCommand(); this.addWindow(this._actorCommandWindow);
      }
      this._actorCommandWindow.setHandler('attack', this.commandAttack.bind(this)); this._actorCommandWindow.setHandler('skill',  this.commandSkill.bind(this));
      this._actorCommandWindow.setHandler('guard',  this.commandGuard.bind(this)); this._actorCommandWindow.setHandler('item',   this.commandItem.bind(this));
      this._actorCommandWindow.setHandler('cancel', this.selectPreviousCommand.bind(this));
    };
    Klass.prototype.commandAttack = function() {
      this._ctx.lastActorCommand = 'attack'; this._csInSubSelection = true;
      BattleManager.inputtingAction().setAttack(); this._actorCommandWindow.deactivate(); this.selectEnemySelection();
    };
    Klass.prototype.commandSkill = function() {
      var stypeId = 1;
      if (this._actorCommandWindow && typeof this._actorCommandWindow.currentExt === 'function') {
        var ext = this._actorCommandWindow.currentExt(); if (typeof ext === 'number') stypeId = ext;
      }
      this._ctx.lastActorCommand = 'skill'; this._ctx.currentSkillStypeId = stypeId; this._csInSubSelection = true; this._actorCommandWindow.deactivate();
      this._skillWindow.setActor(BattleManager.actor()); this._skillWindow.setStypeId(stypeId);
      this._skillWindow.refresh(); this._skillWindow.show(); this._skillWindow.activate(); this._helpWindow.show();
    };
    Klass.prototype.commandItem = function() {
      this._ctx.lastActorCommand = 'item'; this._csInSubSelection = true; this._actorCommandWindow.deactivate(); this._itemWindow.refresh();
      this._itemWindow.show(); this._itemWindow.activate(); this._helpWindow.show();
    }; var origSES = SCB.selectEnemySelection || function() {};
    Klass.prototype.selectEnemySelection = function() {
      this._csInSubSelection = true; var wmap = this._widgetMap || {}; if (wmap.actorCommand && wmap.actorCommand.deactivate) wmap.actorCommand.deactivate();
      ['statusWindow', 'actorWindow'].forEach(function(id) {
        var w = wmap[id]; if (w && w._rowOverlay) w._rowOverlay.alpha = 0.35; if (w && w._window) w._window.alpha = 0.35;
      }); var enemyWidget = wmap['enemyWindow'];
      if (enemyWidget && enemyWidget._window) {
        if (!enemyWidget._window._csBattleLifted) {
          if (enemyWidget._window.parent) enemyWidget._window.parent.removeChild(enemyWidget._window);
          SceneManager._scene.addChild(enemyWidget._window); enemyWidget._window._csBattleLifted = true;
        }
        if (!enemyWidget._window._csBattleBlinkHooked) {
          enemyWidget._window._csBattleBlinkHooked = true; var self = this;          var origWinSel = enemyWidget._window.select.bind(enemyWidget._window);
          enemyWidget._window.select = function(index) {
            origWinSel(index); if (self._enemyWindow && typeof self._enemyWindow.select === 'function') self._enemyWindow.select(index);
          };
        }
      }
      origSES.call(this);
    }; var origSAS = SCB.selectActorSelection || function() {};
    Klass.prototype.selectActorSelection = function() {
      this._csInSubSelection = true; var wmap = this._widgetMap || {};
      if (wmap.actorCommand && wmap.actorCommand.deactivate) wmap.actorCommand.deactivate(); origSAS.call(this);
    };
    Klass.prototype.onSkillCancel = function() {
      this._csInSubSelection = false; this._skillWindow.hide(); this._helpWindow.hide(); this._actorCommandWindow.activate();
    };
    Klass.prototype.onItemCancel = function() {
      this._csInSubSelection = false; this._itemWindow.hide(); this._helpWindow.hide(); this._actorCommandWindow.activate();
    };
    Klass.prototype.onActorCancel = function() {
      this._csInSubSelection = false; var actorWidget = this._widgetMap && this._widgetMap['actorWindow'];
      if (actorWidget && actorWidget.deactivate) actorWidget.deactivate(); var last = this._ctx.lastActorCommand;
      if (last === 'skill') { this._skillWindow.show(); this._skillWindow.activate(); }
      else if (last === 'item') { this._itemWindow.show(); this._itemWindow.activate(); }
      else { this._actorCommandWindow.activate(); }
    }; var origSPCS = SCB.startPartyCommandSelection || function() {};
    Klass.prototype.startPartyCommandSelection = function() {
      this._csInSubSelection = false; this._csActorCursorActive = false; var wmap = this._widgetMap || {};
      if (wmap.actorCommand) {
        if (wmap.actorCommand.deactivate) wmap.actorCommand.deactivate(); if (wmap.actorCommand.hide) wmap.actorCommand.hide();
      }
      if (wmap.actorWindow) if (wmap.actorWindow.hide) wmap.actorWindow.hide(); origSPCS.call(this);
    }; var origCIW = SCB.changeInputWindow || function() {};
    Klass.prototype.changeInputWindow = function() {
      if (this._csInSubSelection) return; origCIW.call(this);
    }; var origSACS = SCB.startActorCommandSelection || function() {};
    Klass.prototype.startActorCommandSelection = function() {
      var wmap = this._widgetMap || {}; if (wmap.partyCommand && wmap.partyCommand.deactivate) wmap.partyCommand.deactivate();
      origSACS.call(this); var actorWidget = wmap['actorWindow']; var actor = BattleManager.actor();
      if (actorWidget) {
        actorWidget.show(); if (actorWidget._window && actorWidget._window.open) actorWidget._window.open(); if (actor) actorWidget.select(actor.index());
      }
    };
    function _restoreStatusAlpha(wmap, alpha) {
      ['statusWindow', 'actorWindow'].forEach(function(id) {
        var w = wmap[id]; if (w && w._rowOverlay) w._rowOverlay.alpha = alpha; if (w && w._window) w._window.alpha = alpha;
      });
    }
    function _lowerEnemyWindow(inst, wmap) {
      var ew = wmap['enemyWindow'];
      if (ew && ew._window && ew._window._csBattleLifted) {
        if (ew._window.parent) ew._window.parent.removeChild(ew._window); if (inst._windowLayer) inst._windowLayer.addChild(ew._window); ew._window._csBattleLifted = false;
      }
    }
    Klass.prototype.onEnemyCancel = function() {
      this._csInSubSelection = false; if (this._enemyWindow && typeof this._enemyWindow.select === 'function') this._enemyWindow.select(-1);
      this._enemyWindow.hide(); var wmap = this._widgetMap || {}; _restoreStatusAlpha(wmap, 1); _lowerEnemyWindow(this, wmap);
      if (wmap.actorCommand && wmap.actorCommand.show) wmap.actorCommand.show(); var last = this._ctx.lastActorCommand || 'attack';
      if (last === 'attack') this._actorCommandWindow.activate();
      else if (last === 'skill') { this._skillWindow.show(); this._skillWindow.activate(); }
      else if (last === 'item') { this._itemWindow.show(); this._itemWindow.activate(); }
    }; var origOEO = SCB.onEnemyOk || function() {};
    Klass.prototype.onEnemyOk = function() {
      this._csInSubSelection = false; var wmap = this._widgetMap || {}; _restoreStatusAlpha(wmap, 1); _lowerEnemyWindow(this, wmap); origOEO.call(this);
    }; var origOAO = SCB.onActorOk || function() {};
    Klass.prototype.onActorOk = function() {
      if (!BattleManager.inputtingAction()) return; this._csInSubSelection = false; origOAO.call(this);
    }; var origStart = SCB.start;
    Klass.prototype.start = function() {
      if (window._uiEditorPreview) {
        this._isEditorPreview = true; Scene_Base.prototype.start.call(this);
      } else {
        this._isEditorPreview = false; origStart.call(this);
      }
    }; var origUpdate = Klass.prototype.update;
    Klass.prototype.update = function() {
      if (this._isEditorPreview) {
        Scene_Base.prototype.update.call(this);
      } else {
        origUpdate.call(this); if (this._logWindow && this._logWindow._lines) this._ctx.battleLog = this._logWindow._lines.join('\n'); this._csUpdateActorCursor();
      }
      if (this._widgetMap) {   for (var id in this._widgetMap) if (this._widgetMap[id].update) this._widgetMap[id].update(); }
    };
    Klass.prototype._csUpdateActorCursor = function() {
      var wmap = this._widgetMap || {}; var actorWidget = wmap['actorWindow']; if (!actorWidget) return;
      if (BattleManager.isInputting()) {
        if (!BattleManager.actor()) {
          if (actorWidget._csCursorOverlayVisible !== false) actorWidget.hide(); if (actorWidget._rowOverlay) actorWidget._rowOverlay.visible = false;
        }
        return;
      }
      var subject = BattleManager._subject;
      if (subject && subject.isActor && subject.isActor()) {
        var idx = subject.index();
        if (!this._csActorCursorActive) {
          this._csActorCursorActive = true; this._csActorCursorIdx = -1; actorWidget.show();
          if (actorWidget._window && actorWidget._window.open) actorWidget._window.open(); if (actorWidget._window) actorWidget._window.activate();
        }
        if (this._csActorCursorIdx !== idx) {
          this._csActorCursorIdx = idx; actorWidget.select(idx);
        }
      } else {
        if (this._csActorCursorActive) {
          this._csActorCursorActive = false; this._csActorCursorIdx = -1; actorWidget.hide();
        }
      }
    };
  }
