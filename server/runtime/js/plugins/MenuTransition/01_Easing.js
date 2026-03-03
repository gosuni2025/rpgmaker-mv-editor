    // ── Easing ────────────────────────────────────────────────────────────────

    var EasingFn = {
        linear:    function (t) { return t; },
        easeIn:    function (t) { return t * t; },
        easeOut:   function (t) { return t * (2 - t); },
        easeInOut: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
    };

    function applyEase(t) {
        t = Math.min(1, Math.max(0, t));
        return (EasingFn[Cfg.easing] || EasingFn.easeOut)(t);
    }

    // ── 상태 변수 ─────────────────────────────────────────────────────────────

    var _phase     = 0;       // 0=비활성, 2=메뉴 열림
    var _srcCanvas = null;    // 스냅샷 캔버스 (메뉴 배경용)

    var _bgBlurT      = 0;    // 현재 효과 진행값 (0~1)
    var _bgBlurStartT = 1;    // 닫기 시작 시점의 값
    var _bgBlurDir    = 0;    // 0=정지, 1=열기(증가), -1=닫기(감소)
    var _bgElapsed    = 0;    // 진행 프레임
    var _bgBitmap     = null; // 현재 배경 비트맵 참조

    var _suppressMenuFadeOut = false;
    var _suppressGameFadeOut = false;
    var _suppressGameFadeIn  = false;

