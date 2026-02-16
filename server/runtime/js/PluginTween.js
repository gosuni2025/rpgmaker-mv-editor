/**
 * PluginTween - 플러그인 커맨드용 시간 기반 보간(tween) 시스템
 *
 * 사용법:
 *   PluginTween.add({ target: obj, key: 'intensity', to: 0.5, duration: 2.0 });
 *   // duration: 초 단위. 0이면 즉시 적용.
 *
 * 매 프레임 update()를 호출해야 합니다.
 * RPG Maker MV의 SceneManager.update 루프에 자동 연결됩니다.
 */

(function() {
    'use strict';

    var PluginTween = {};
    window.PluginTween = PluginTween;

    // 활성 tween 목록
    PluginTween._tweens = [];

    /**
     * 새 tween을 추가한다.
     * @param {Object} opts
     * @param {Object} opts.target - 값을 변경할 대상 객체
     * @param {string} opts.key - 변경할 프로퍼티 키
     * @param {number} opts.to - 목표 값
     * @param {number} opts.duration - 보간 시간(초). 0이면 즉시 적용.
     * @param {function} [opts.onUpdate] - 매 프레임 콜백(현재값)
     * @param {function} [opts.onComplete] - 완료 콜백
     */
    PluginTween.add = function(opts) {
        if (!opts.target || !opts.key) return;

        var duration = opts.duration || 0;
        var to = opts.to;

        // 같은 target+key에 대한 기존 tween 제거
        for (var i = this._tweens.length - 1; i >= 0; i--) {
            var t = this._tweens[i];
            if (t.target === opts.target && t.key === opts.key) {
                this._tweens.splice(i, 1);
            }
        }

        // duration 0이면 즉시 적용
        if (duration <= 0) {
            opts.target[opts.key] = to;
            if (opts.onUpdate) opts.onUpdate(to);
            if (opts.onComplete) opts.onComplete();
            return;
        }

        var from = opts.target[opts.key];
        if (from === undefined || from === null) from = 0;

        this._tweens.push({
            target: opts.target,
            key: opts.key,
            from: from,
            to: to,
            duration: duration,
            elapsed: 0,
            onUpdate: opts.onUpdate || null,
            onComplete: opts.onComplete || null,
        });
    };

    /**
     * 색상(hex number) tween을 추가한다.
     * RGB 각 채널을 개별적으로 보간한다.
     * @param {Object} opts
     * @param {Object} opts.target - 대상 객체
     * @param {string} opts.key - hex 숫자를 담고 있는 프로퍼티 키
     * @param {number} opts.to - 목표 hex 색상 (예: 0x6677FF)
     * @param {number} opts.duration - 초
     * @param {function} [opts.onUpdate] - 매 프레임 콜백(현재 hex값)
     * @param {function} [opts.onComplete] - 완료 콜백
     */
    PluginTween.addColor = function(opts) {
        if (!opts.target || !opts.key) return;

        var duration = opts.duration || 0;
        var to = opts.to;

        // 같은 target+key에 대한 기존 tween 제거
        for (var i = this._tweens.length - 1; i >= 0; i--) {
            var t = this._tweens[i];
            if (t.target === opts.target && t.key === opts.key) {
                this._tweens.splice(i, 1);
            }
        }

        if (duration <= 0) {
            opts.target[opts.key] = to;
            if (opts.onUpdate) opts.onUpdate(to);
            if (opts.onComplete) opts.onComplete();
            return;
        }

        var from = opts.target[opts.key];
        if (from === undefined || from === null) from = 0;

        this._tweens.push({
            target: opts.target,
            key: opts.key,
            from: from,
            to: to,
            duration: duration,
            elapsed: 0,
            isColor: true,
            fromR: (from >> 16) & 0xFF,
            fromG: (from >> 8) & 0xFF,
            fromB: from & 0xFF,
            toR: (to >> 16) & 0xFF,
            toG: (to >> 8) & 0xFF,
            toB: to & 0xFF,
            onUpdate: opts.onUpdate || null,
            onComplete: opts.onComplete || null,
        });
    };

    /**
     * 매 프레임 호출. delta는 초 단위.
     */
    PluginTween.update = function(deltaSec) {
        if (this._tweens.length === 0) return;

        for (var i = this._tweens.length - 1; i >= 0; i--) {
            var tw = this._tweens[i];
            tw.elapsed += deltaSec;

            var progress = Math.min(tw.elapsed / tw.duration, 1.0);
            // ease-in-out (smoothstep)
            var t = progress * progress * (3 - 2 * progress);

            if (tw.isColor) {
                var r = Math.round(tw.fromR + (tw.toR - tw.fromR) * t);
                var g = Math.round(tw.fromG + (tw.toG - tw.fromG) * t);
                var b = Math.round(tw.fromB + (tw.toB - tw.fromB) * t);
                var hex = (r << 16) | (g << 8) | b;
                tw.target[tw.key] = hex;
                if (tw.onUpdate) tw.onUpdate(hex);
            } else {
                var value = tw.from + (tw.to - tw.from) * t;
                tw.target[tw.key] = value;
                if (tw.onUpdate) tw.onUpdate(value);
            }

            if (progress >= 1.0) {
                if (tw.onComplete) tw.onComplete();
                this._tweens.splice(i, 1);
            }
        }
    };

    /**
     * 모든 tween을 제거한다.
     */
    PluginTween.clear = function() {
        this._tweens = [];
    };

    // SceneManager.update에 연결 (RPG Maker MV 런타임)
    PluginTween._lastTime = 0;

    PluginTween._hookUpdate = function() {
        if (typeof SceneManager === 'undefined') return;

        var _SceneManager_update = SceneManager.update;
        SceneManager.update = function() {
            _SceneManager_update.apply(this, arguments);

            var now = performance.now();
            if (PluginTween._lastTime === 0) {
                PluginTween._lastTime = now;
            }
            var delta = (now - PluginTween._lastTime) / 1000;
            PluginTween._lastTime = now;

            // 60fps 기준 최대 delta 제한 (탭 비활성 시 갑작스런 점프 방지)
            if (delta > 0.1) delta = 0.1;

            PluginTween.update(delta);
        };
    };

    // DOM 로드 후 SceneManager 훅 시도
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(function() { PluginTween._hookUpdate(); }, 0);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            PluginTween._hookUpdate();
        });
    }

})();
