
  var _EASE_FNS = {
    linear:function(t){return t;}, easeIn:function(t){return t*t;},
    easeInOut:function(t){return t<0.5?2*t*t:1-2*(1-t)*(1-t);},
    bounce:function(t){
      if(t<1/2.75)  return 7.5625*t*t;
      if(t<2/2.75)  return 7.5625*(t-=1.5/2.75)*t+0.75;
      if(t<2.5/2.75)return 7.5625*(t-=2.25/2.75)*t+0.9375;
      return               7.5625*(t-=2.625/2.75)*t+0.984375;
    },
  };
  function uiEase(t,easing){t=Math.max(0,Math.min(1,t));var f=_EASE_FNS[easing];return f?f(t):1-(1-t)*(1-t);}

  var _AM={'top-left':[0,0],'top':[0.5,0],'top-right':[1,0],'left':[0,0.5],'center':[0.5,0.5],'right':[1,0.5],'bottom-left':[0,1],'bottom':[0.5,1],'bottom-right':[1,1]};
  function _parsePivotAnchor(anchor,w,h){var a=_AM[anchor]||[0.5,0.5];return{x:Math.floor((w||0)*a[0]),y:Math.floor((h||0)*a[1])};}

  function _setupAnimPivot(win, effects, cn, sx, sy) {
    var np=effects.some(function(e){return e.type==='zoom'||e.type==='rotate'||e.type==='bounce'||e.type==='rotateX'||e.type==='rotateY';}), px=0,py=0;
    if (np&&win.pivot) { var pv=_parsePivotAnchor((_ov[cn]&&_ov[cn].animPivot)||'center',win.width,win.height); px=pv.x;py=pv.y; win.pivot.x=px;win.pivot.y=py; win.x=sx+px;win.y=sy+py; }
    return {pivotX:px,pivotY:py};
  }

  function _makeAnimState(win, effects, cn, sx, sy, pv) {
    return {effects:effects,elapsed:0,screenX:sx,screenY:sy,baseX:win.x,baseY:win.y,
      baseAlpha:win.alpha!==undefined?win.alpha:1,baseRotation:win.rotation||0,
      baseRotationX:win.rotationX!==undefined?win.rotationX:0,
      baseRotationY:win.rotationY!==undefined?win.rotationY:0,
      pivotX:pv.pivotX,pivotY:pv.pivotY,className:cn};
  }

  function startEntranceAnimation(win, entrances, cn) {
    if (!entrances||!entrances.length) return;
    var pv=_setupAnimPivot(win,entrances,cn,win.x,win.y);
    win._uiEntrance=_makeAnimState(win,entrances,cn,win.x,win.y,pv);
    _applyEntranceFrame(win,0);
  }

  function _gfxW(){return typeof Graphics!=='undefined'?Graphics.width:816;} function _gfxH(){return typeof Graphics!=='undefined'?Graphics.height:624;}

  function _writeAnimResult(win, st, tX, tY, tA, tSX, tSY, tR, tRX, tRY, pvx, pvy) {
    win.alpha=st.baseAlpha*tA; win.x=Math.round(tX)+pvx; win.y=Math.round(tY)+pvy;
    if(win.scale){win.scale.x=tSX;win.scale.y=tSY;}
    win.rotation=(st.baseRotation||0)+tR;
    if(win.rotationX!==undefined)win.rotationX=(st.baseRotationX||0)+tRX;
    if(win.rotationY!==undefined)win.rotationY=(st.baseRotationY||0)+tRY;
  }

  function _applyEntranceFrame(win, elapsed) {
    var st=win._uiEntrance; if(!st) return;
    var tX=st.screenX,tY=st.screenY,tA=1,tSX=1,tSY=1,tR=0,tRX=0,tRY=0,sw=_gfxW(),sh=_gfxH();
    for(var i=0;i<st.effects.length;i++){
      var e=st.effects[i],le=elapsed-(e.delay||0),p=le<=0?0:uiEase(Math.min(le/e.duration,1),e.easing),fs,s,a;
      switch(e.type){
        case 'fade':case 'fadeIn': tA*=p; break; case 'fadeOut': tA*=(1-p); break;
        case 'slideLeft': tX=st.screenX-(1-p)*(st.screenX+sw); break; case 'slideRight': tX=st.screenX+(1-p)*sw; break;
        case 'slideTop':  tY=st.screenY-(1-p)*(st.screenY+sh); break; case 'slideBottom':tY=st.screenY+(1-p)*sh; break;
        case 'zoom':case 'bounce': fs=e.fromScale!==undefined?e.fromScale:0;s=fs+p*(1-fs);tSX*=s;tSY*=s; break;
        case 'rotate':  a=e.fromAngle!==undefined?e.fromAngle:180;tR +=a*(1-p)*Math.PI/180; break;
        case 'rotateX': a=e.fromAngle!==undefined?e.fromAngle:90; tRX+=a*(1-p)*Math.PI/180; break;
        case 'rotateY': a=e.fromAngle!==undefined?e.fromAngle:90; tRY+=a*(1-p)*Math.PI/180; break;
      }
    }
    _writeAnimResult(win,st,tX,tY,tA,tSX,tSY,tR,tRX,tRY,st.pivotX,st.pivotY);
  }

  function _applyExitFrame(win, elapsed) {
    var st=win._uiExit; if(!st) return;
    var tX=st.screenX,tY=st.screenY,tA=1,tSX=1,tSY=1,tR=0,tRX=0,tRY=0,sw=_gfxW(),sh=_gfxH();
    for(var i=0;i<st.effects.length;i++){
      // p: 0=시작(원래 상태) → 1=끝(사라진 상태)
      var e=st.effects[i],le=elapsed-(e.delay||0),p=le<=0?0:uiEase(Math.min(le/e.duration,1),e.easing),to,s,a;
      switch(e.type){
        case 'fade':case 'fadeOut': tA*=(1-p); break; case 'fadeIn': tA*=p; break;
        case 'slideLeft': tX=st.screenX-p*(st.screenX+sw); break; case 'slideRight': tX=st.screenX+p*sw; break;
        case 'slideTop':  tY=st.screenY-p*(st.screenY+sh); break; case 'slideBottom':tY=st.screenY+p*sh; break;
        case 'zoom':case 'bounce': to=e.fromScale!==undefined?e.fromScale:0;s=1-p*(1-to);tSX*=s;tSY*=s; break;
        case 'rotate':  a=e.fromAngle!==undefined?e.fromAngle:180;tR +=a*p*Math.PI/180; break;
        case 'rotateX': a=e.fromAngle!==undefined?e.fromAngle:90; tRX+=a*p*Math.PI/180; break;
        case 'rotateY': a=e.fromAngle!==undefined?e.fromAngle:90; tRY+=a*p*Math.PI/180; break;
      }
    }
    _writeAnimResult(win,st,tX,tY,tA,tSX,tSY,tR,tRX,tRY,(win.pivot&&win.pivot.x)||0,(win.pivot&&win.pivot.y)||0);
  }

  function _isAnimDone(elapsed, effects) {
    for (var i=0; i<effects.length; i++)
      if (elapsed < (effects[i].delay||0) + effects[i].duration) return false;
    return true;
  }

  function _resetAnimRot(win, st) {
    win.rotation=st.baseRotation||0;
    if(win.rotationX!==undefined)win.rotationX=st.baseRotationX||0;
    if(win.rotationY!==undefined)win.rotationY=st.baseRotationY||0;
  }

  var _WB_update = Window_Base.prototype.update;
  Window_Base.prototype.update = function () {
    _WB_update.call(this);
    if (this._uiExit) {
      var xs=this._uiExit; xs.elapsed+=1000/60;
      if (_isAnimDone(xs.elapsed,xs.effects)) { this.alpha=0; _resetAnimRot(this,xs); this._uiExit=null; }
      else _applyExitFrame(this,xs.elapsed);
    }
    if (!this._uiEntrance) return;
    var st=this._uiEntrance; st.elapsed+=1000/60;
    if (_isAnimDone(st.elapsed,st.effects)) {
      if (this.pivot&&st.pivotX) { this.pivot.x=0;this.pivot.y=0;this.x=st.screenX;this.y=st.screenY; }
      else { this.x=st.baseX;this.y=st.baseY; }
      this.alpha=st.baseAlpha; if(this.scale){this.scale.x=1;this.scale.y=1;}
      _resetAnimRot(this,st); this._uiEntrance=null;
    } else _applyEntranceFrame(this,st.elapsed);
  };

  function startExitAnimation(win, exits, cn) {
    if (!exits || exits.length === 0) return;
    var sx = win.x-(win.pivot?win.pivot.x:0), sy = win.y-(win.pivot?win.pivot.y:0);
    var pv = _setupAnimPivot(win, exits, cn, sx, sy);
    win._uiEntrance = null;
    win._uiExit = _makeAnimState(win, exits, cn, sx, sy, pv);
    _applyExitFrame(win, 0);
  }

  function collectSceneWindows(scene) {
    var wins=[];
    (function tr(obj) {
      if (!obj||!obj.children) return;
      for (var i=0;i<obj.children.length;i++) { var c=obj.children[i]; if(c instanceof Window_Base)wins.push(c); tr(c); }
    })(scene);
    return wins;
  }

  function startSceneExitAnimations(scene) {
    var maxMs=0;
    collectSceneWindows(scene).forEach(function(win) {
      var cn=win.constructor&&win.constructor.name, ov=(_config.overrides||{})[cn];
      if (ov&&Array.isArray(ov.exits)&&ov.exits.length>0) {
        startExitAnimation(win,ov.exits,cn);
        maxMs=Math.max(maxMs,ov.exits.reduce(function(a,e){return Math.max(a,(e.delay||0)+e.duration);},0));
      }
    });
    return maxMs;
  }

  var _SBase_stop = Scene_Base.prototype.stop;
  Scene_Base.prototype.stop = function () {
    _SBase_stop.call(this);
    var maxMs = startSceneExitAnimations(this);
    if (maxMs > 0) { this._uiExiting=true; this._uiExitMaxMs=maxMs; this._uiExitElapsed=0; }
  };

  var _SBase_isBusy = Scene_Base.prototype.isBusy;
  Scene_Base.prototype.isBusy = function () { return this._uiExiting || _SBase_isBusy.call(this); };

  var _SBase_update = Scene_Base.prototype.update;
  Scene_Base.prototype.update = function () {
    _SBase_update.call(this);
    if (this._uiExiting) {
      this._uiExitElapsed += 1000/60;
      if (this._uiExitElapsed >= this._uiExitMaxMs) this._uiExiting = false;
    }
  };

  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || !data.type) return;
    var scene = typeof SceneManager !== 'undefined' ? SceneManager._scene : null;
    if (!scene) return;
    collectSceneWindows(scene).forEach(function (win) {
      var cn = win.constructor && win.constructor.name;
      if (data.className && cn !== data.className) return;
      var ov = (data.override && data.override.className === cn) ? data.override : (_config.overrides || {})[cn];
      if (data.type === 'previewEntrance') {
        if (!ov || !Array.isArray(ov.entrances) || ov.entrances.length === 0) return;
        if (win._uiEntrance && win.pivot) { win.pivot.x=0; win.pivot.y=0; win.x=win._uiEntrance.screenX; win.y=win._uiEntrance.screenY; }
        win._uiEntrance=null; win._uiExit=null; win.alpha=1;
        if (win.scale) { win.scale.x=1; win.scale.y=1; }
        win.rotation=0;
        startEntranceAnimation(win, ov.entrances, cn);
      } else if (data.type === 'previewExit') {
        if (!ov || !Array.isArray(ov.exits) || ov.exits.length === 0) return;
        win._uiEntrance=null;
        startExitAnimation(win, ov.exits, cn);
      }
    });
  });

  window.UIEditorSkins = _skins.skins || [];
