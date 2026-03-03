  var WidgetAnimator = (function() {
    var _tasks = [];
    function easeFunc(name, t) {
      t = Math.min(Math.max(t, 0), 1);
      switch (name) {
        case 'easeIn':    return t * t; case 'easeInOut': return t < 0.5 ? 2*t*t : 1-2*(1-t)*(1-t); case 'linear':    return t;
        case 'bounce': {
          if      (t < 1/2.75)  { return 7.5625*t*t; }
          else if (t < 2/2.75)  { t -= 1.5/2.75;  return 7.5625*t*t+0.75; }
          else if (t < 2.5/2.75){ t -= 2.25/2.75; return 7.5625*t*t+0.9375; }
          else                  { t -= 2.625/2.75; return 7.5625*t*t+0.984375; }
        }
        default: return 1-(1-t)*(1-t);
      }
    }
    function applyTask(task, t) {
      var e = easeFunc(task.easing || 'easeOut', t); var obj = task.obj, p = task.props;      if (p.x        !== undefined) obj.x        = p.x.from        + (p.x.to        - p.x.from)        * e;
      if (p.y        !== undefined) obj.y        = p.y.from        + (p.y.to        - p.y.from)        * e;
      if (p.opacity  !== undefined) obj.opacity  = Math.round(p.opacity.from  + (p.opacity.to  - p.opacity.from)  * e);
      if (p.scaleY   !== undefined && obj.scale)  obj.scale.y = p.scaleY.from  + (p.scaleY.to  - p.scaleY.from)  * e;
      if (p.scaleX   !== undefined && obj.scale)  obj.scale.x = p.scaleX.from  + (p.scaleX.to  - p.scaleX.from)  * e;
      if (p.rotation !== undefined) obj.rotation = p.rotation.from + (p.rotation.to - p.rotation.from) * e;
      if (p.openness !== undefined && obj.openness !== undefined) obj.openness = Math.round(p.openness.from + (p.openness.to - p.openness.from) * e);
    }
    function buildPropsForEffect(eff, obj, isEnter) {
      var type = (eff && eff.type) || 'none'; if (type === 'none') return null;
      var origX = obj.x || 0, origY = obj.y || 0; var origOp = (obj.opacity !== undefined) ? obj.opacity : 255;
      var w = obj.width || 0, h = obj.height || 0; var offset, fromScale, fromAngle;
      function op() { return isEnter ? {from:0,to:origOp} : {from:origOp,to:0}; }
      function sc(f,t) { return isEnter ? {from:f,to:t} : {from:t,to:f}; }
      switch (type) {
        case 'fade': case 'fadeIn': return { opacity: op() }; case 'fadeOut': return { opacity: isEnter ? {from:origOp,to:0} : {from:0,to:origOp} };
        case 'slideDown': case 'slideBottom':
          offset = eff.offset !== undefined ? eff.offset : Math.max(h, 40);
          return { y: isEnter ? {from:origY-offset,to:origY} : {from:origY,to:origY+offset}, opacity: op() };
        case 'slideUp': case 'slideTop':
          offset = eff.offset !== undefined ? eff.offset : Math.max(h, 40);
          return { y: isEnter ? {from:origY+offset,to:origY} : {from:origY,to:origY-offset}, opacity: op() };
        case 'slideLeft':
          offset = eff.offset !== undefined ? eff.offset : Math.max(w, 40);
          return { x: isEnter ? {from:origX+offset,to:origX} : {from:origX,to:origX-offset}, opacity: op() };
        case 'slideRight':
          offset = eff.offset !== undefined ? eff.offset : Math.max(w, 40);
          return { x: isEnter ? {from:origX-offset,to:origX} : {from:origX,to:origX+offset}, opacity: op() };
        case 'openness':
          if (typeof obj.openness !== 'undefined') return { openness: sc(0, 255) };
          return { scaleY: sc(0, 1), y: isEnter ? {from:origY+h/2,to:origY} : {from:origY,to:origY+h/2} };
        case 'zoom':
          fromScale = eff.fromScale !== undefined ? eff.fromScale : 0.5; return { scaleX: sc(fromScale,1), scaleY: sc(fromScale,1), opacity: op() };
        case 'bounce':
          fromScale = eff.fromScale !== undefined ? eff.fromScale : 0; return { scaleX: sc(fromScale,1), scaleY: sc(fromScale,1), opacity: op() };
        case 'rotate':
          fromAngle = eff.fromAngle !== undefined ? eff.fromAngle : 180;
          return { rotation: isEnter ? {from:fromAngle*Math.PI/180,to:0} : {from:0,to:fromAngle*Math.PI/180}, opacity: op() };
        case 'rotateX': return { scaleY: sc(0,1), opacity: op() }; case 'rotateY': return { scaleX: sc(0,1), opacity: op() }; default: return null;
      }
    }
    return {
      play: function(obj, animDef, isEnter, onComplete) {
        if (!obj) { if (onComplete) onComplete(); return; }
        this.clear(obj); var isNew = Array.isArray(animDef); var effects = isNew ? animDef : (animDef ? [animDef] : []);
        var valid = effects.filter(function(e) { return e && e.type && e.type !== 'none'; });
        if (valid.length === 0) { if (onComplete) onComplete(); return; }
        var maxEnd = -1, maxIdx = 0; for (var i = 0; i < valid.length; i++) {
          var dur0 = valid[i].duration !== undefined ? valid[i].duration : (isNew ? 300 : 15); var del0 = valid[i].delay || 0;
          if (dur0 + del0 > maxEnd) { maxEnd = dur0 + del0; maxIdx = i; }
        }
        for (var j = 0; j < valid.length; j++) {
          var eff = valid[j]; var props = buildPropsForEffect(eff, obj, isEnter);
          if (!props) continue; var duration = eff.duration !== undefined ? eff.duration : (isNew ? 300 : 15);
          var frames   = isNew ? Math.max(1, Math.round(duration / 1000 * 60)) : Math.max(1, duration);
          var delay    = eff.delay || 0; var delayF   = isNew ? Math.max(0, Math.round(delay / 1000 * 60)) : Math.max(0, delay);
          var easing   = eff.easing || 'easeOut'; if (j === 0 && delayF === 0) applyTask({obj:obj, props:props, easing:easing}, 0);
          _tasks.push({
            obj: obj, props: props,
            frame: 0, duration: frames, delay: delayF,
            easing: easing,
            onComplete: j === maxIdx ? (onComplete || null) : null,
          });
        }
      },
      clear: function(obj) {
        _tasks = _tasks.filter(function(t) { return t.obj !== obj; });
      },
      isActive: function(obj) {
        return _tasks.some(function(t) { return t.obj === obj; });
      },
      update: function() {
        if (!_tasks.length) return; var done = [];
        for (var i = 0; i < _tasks.length; i++) {
          var task = _tasks[i];
          if (task.delay > 0) { task.delay--; continue; }
          task.frame++; applyTask(task, task.frame / task.duration); if (task.frame >= task.duration) done.push(i);
        }
        for (var j = done.length - 1; j >= 0; j--) {
          var cb = _tasks[done[j]].onComplete; _tasks.splice(done[j], 1); if (cb) cb();
        }
      },
    };
  })(); window.WidgetAnimator = WidgetAnimator;
