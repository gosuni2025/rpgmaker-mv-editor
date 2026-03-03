
  function G(key, def) { var g = _ov['Global']; return (g && g[key] !== undefined) ? g[key] : def; }
  function hasOv(cn)   { return !!_ov[cn]; }
  function OV(cn, key) { return (_ov[cn] || {})[key]; }

  window._uiThemeUpdateOv = function(cn, prop, val) {
    if (!_ov[cn]) _ov[cn] = { className: cn };
    _ov[cn][prop] = val;
  };

  function _setWindowLayer(win, layer) {
    if (win && win._threeObj && win._threeObj.traverse)
      win._threeObj.traverse(function(c) { c.layers.set(layer); });
  }
  window._uiSetWindowLayer = _setWindowLayer;

  // Perspective 카메라로 렌더링되는 창의 화면 좌표를 창 로컬 좌표로 역변환
  function _uiPerspScreenToLocal(win, sx, sy) {
    var threeObj = win && win._threeObj;
    var cam = window.Mode3D && Mode3D._uiPerspCamera;
    if (!threeObj || !cam || typeof THREE === 'undefined') return null;
    var ndcX = (sx / (Graphics.width||816)) * 2 - 1;
    var ndcY = 1 - (sy / (Graphics.height||624)) * 2;
    if (!_uiPerspScreenToLocal._rc) {
      _uiPerspScreenToLocal._rc  = new THREE.Raycaster();
      _uiPerspScreenToLocal._pl  = new THREE.Plane();
      _uiPerspScreenToLocal._n   = new THREE.Vector3();
      _uiPerspScreenToLocal._pt  = new THREE.Vector3();
      _uiPerspScreenToLocal._hit = new THREE.Vector3();
    }
    var rc = _uiPerspScreenToLocal._rc, pl = _uiPerspScreenToLocal._pl;
    var n  = _uiPerspScreenToLocal._n,  pt = _uiPerspScreenToLocal._pt, hit = _uiPerspScreenToLocal._hit;
    rc.setFromCamera({ x: ndcX, y: ndcY }, cam);
    threeObj.updateMatrixWorld(true);
    n.set(0, 0, 1).transformDirection(threeObj.matrixWorld);
    threeObj.getWorldPosition(pt);
    pl.setFromNormalAndCoplanarPoint(n, pt);
    if (!rc.ray.intersectPlane(pl, hit)) return null;
    threeObj.worldToLocal(hit);
    return { x: hit.x, y: hit.y };
  }

  function _perspOnTouch(win, local, triggered) {
    var li=win.index(), hi=win.hitTest(local.x,local.y);
    if (hi>=0) { if(hi===win.index()){if(triggered&&win.isTouchOkEnabled())win.processOk();}else if(win.isCursorMovable())win.select(hi); }
    else if (win._stayCount>=10) { if(local.y<win.padding)win.cursorUp();else if(local.y>=win.height-win.padding)win.cursorDown(); }
    if (win.index()!==li) SoundManager.playCursor();
  }

  function _applyPerspHitTest(win) {
    win.processTouch = function() {
      if (!this.isOpenAndActive()) { this._touching=false; return; }
      if (TouchInput.isTriggered()) {
        var l=_uiPerspScreenToLocal(this,TouchInput.x,TouchInput.y);
        if (l&&l.x>=0&&l.y>=0&&l.x<this.width&&l.y<this.height) { this._touching=true; _perspOnTouch(this,l,true); }
      } else if (TouchInput.isCancelled()) { if(this.isCancelEnabled())this.processCancel(); }
      if (this._touching) {
        if (TouchInput.isPressed()) { var l2=_uiPerspScreenToLocal(this,TouchInput.x,TouchInput.y); if(l2)_perspOnTouch(this,l2,false); }
        else this._touching=false;
      }
    };
    var _ou=win.update;
    win.update=function(){_ou.call(this);_perspUpdateHoverDebug(this);};
  }

  if (!window._uiPerspMouse) {
    window._uiPerspMouse = { x: 0, y: 0 };
    document.addEventListener('mousemove', function(e) {
      window._uiPerspMouse.x = Graphics.pageToCanvasX(e.pageX);
      window._uiPerspMouse.y = Graphics.pageToCanvasY(e.pageY);
    });
  }
  window._uiPerspHoverDebug = false;

  function _dbgMeshRemove(win) {
    if (!win._dbgHoverMesh) return;
    win._threeObj.remove(win._dbgHoverMesh);
    win._dbgHoverMesh.geometry.dispose(); win._dbgHoverMesh.material.dispose();
    win._dbgHoverMesh = null;
  }

  function _perspUpdateHoverDebug(win) {
    if (!window._uiPerspHoverDebug) { _dbgMeshRemove(win); win._dbgHoverIdx = undefined; return; }
    if (!win._threeObj || typeof THREE === 'undefined') return;
    var m = window._uiPerspMouse, local = win.isOpen() ? _uiPerspScreenToLocal(win, m.x, m.y) : null;
    var hitIdx = (local && local.x>=0 && local.y>=0 && local.x<win.width && local.y<win.height)
      ? win.hitTest(local.x, local.y) : -1;
    if (hitIdx === win._dbgHoverIdx) return;
    win._dbgHoverIdx = hitIdx; _dbgMeshRemove(win);
    if (hitIdx < 0) return;
    var rect = win.itemRect(hitIdx);
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(rect.width, rect.height),
      new THREE.MeshBasicMaterial({ color:0x00ff00, transparent:true, opacity:0.5, depthTest:false, depthWrite:false, side:THREE.DoubleSide })
    );
    mesh.position.set(rect.x+rect.width/2, rect.y+rect.height/2, 0.5);
    mesh.layers.set(1); mesh.renderOrder = 9000;
    win._threeObj.add(mesh); win._dbgHoverMesh = mesh;
  }

  window._uiGetOv           = function(cn)   { return _ov[cn] || {}; };
  window._uiThemeClearOv    = function(cn)   { delete _ov[cn]; };
  window._uiThemeClearAllOv = function()     { Object.keys(_ov).forEach(function(k) { delete _ov[k]; }); };
