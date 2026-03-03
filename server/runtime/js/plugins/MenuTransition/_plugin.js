/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 (Canvas 2D)
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 맵 배경에 효과를 적용하면서
 * 동시에 메뉴 UI가 등장합니다. 메뉴를 닫으면 UI 사라짐과 동시에 효과가 해제됩니다.
 *
 * 렌더링 방식:
 *   열기: 메뉴씬 push → 배경 스냅샷(효과 없음) → Canvas 효과 0→최대 적용
 *         동시에 메뉴 UI fade-in (duration 프레임)
 *   닫기: 메뉴 UI fade-out + 배경 효과 최대→0 동시 진행
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 전환 효과 종류
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  blur         가우시안 블러.
 *               관련 파라미터: blur_amount
 *
 *  zoomBlur     블러 + 줌 인.
 *               관련 파라미터: zoomBlur_amount, zoomBlur_zoom
 *
 *  desaturation 채도 감소 → 흑백.
 *               관련 파라미터: desaturation_amount
 *
 *  sepia        세피아 색조.
 *               관련 파라미터: sepia_amount
 *
 *  brightness   화이트아웃 (점점 밝아짐).
 *               관련 파라미터: brightness_amount
 *
 *  darkness     블랙아웃 (점점 어두워짐).
 *               관련 파라미터: darkness_amount
 *
 *  contrast     대비 증가.
 *               관련 파라미터: contrast_amount
 *
 *  hue          색조 회전.
 *               관련 파라미터: hue_amount
 *
 *  invert       색상 반전.
 *               관련 파라미터: invert_amount
 *
 *  pixelation   픽셀화 (화면이 블록으로 뭉개짐).
 *               관련 파라미터: pixelation_amount
 *
 *  zoom         줌 인 (블러 없음).
 *               관련 파라미터: zoom_amount
 *
 *  chromatic    색수차 (R/B 채널 좌우 분리).
 *               관련 파라미터: chromatic_offset, chromatic_alpha
 *
 *  vignette     비네트 (주변부가 점점 어두워짐).
 *               관련 파라미터: vignette_amount, vignette_range
 *
 *  scanline     스캔라인 (CRT 모니터 효과).
 *               관련 파라미터: scanline_opacity, scanline_desaturation
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 공통 파라미터
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  overlayColor  배경 오버레이 색상 (R,G,B). 기본 0,0,0 (검정).
 *  overlayAlpha  오버레이 불투명도 (0=비활성, 255=완전 불투명).
 *  duration      전환 시간 (프레임, 60fps 기준). 40 ≒ 0.67초.
 *  easing        가속도 곡선.
 *  closeAnim     닫기 시 역방향 애니메이션 사용 여부.
 *
 * @param transitionEffect
 * @text 전환 효과 종류
 * @type select
 * @option blur
 * @option zoomBlur
 * @option desaturation
 * @option sepia
 * @option brightness
 * @option darkness
 * @option contrast
 * @option hue
 * @option invert
 * @option pixelation
 * @option zoom
 * @option chromatic
 * @option vignette
 * @option scanline
 * @default blur
 *
 * @param blur_amount
 * @text [blur] 블러 강도 (100=최대 20px)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param zoomBlur_amount
 * @text [zoomBlur] 블러 강도 (100=최대 20px)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param zoomBlur_zoom
 * @text [zoomBlur] 줌 배율 (100=최대 30% 확대)
 * @type number
 * @min 0
 * @max 100
 * @default 50
 *
 * @param desaturation_amount
 * @text [desaturation] 채도 감소량 (100=완전 흑백)
 * @type number
 * @min 0
 * @max 100
 * @default 100
 *
 * @param sepia_amount
 * @text [sepia] 세피아 강도 (100=완전 세피아)
 * @type number
 * @min 0
 * @max 100
 * @default 100
 *
 * @param brightness_amount
 * @text [brightness] 밝기 증가량 (100=+300%)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param darkness_amount
 * @text [darkness] 어두움 강도 (100=-90% 밝기)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param contrast_amount
 * @text [contrast] 대비 증가량 (100=+400%)
 * @type number
 * @min 0
 * @max 100
 * @default 70
 *
 * @param hue_amount
 * @text [hue] 색조 회전 각도 (100=360° 회전)
 * @type number
 * @min 0
 * @max 100
 * @default 60
 *
 * @param invert_amount
 * @text [invert] 반전 강도 (100=완전 반전)
 * @type number
 * @min 0
 * @max 100
 * @default 100
 *
 * @param pixelation_amount
 * @text [pixelation] 최대 픽셀 블록 크기 (100=50px)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param zoom_amount
 * @text [zoom] 최대 줌 배율 (100=60% 확대)
 * @type number
 * @min 0
 * @max 100
 * @default 60
 *
 * @param chromatic_offset
 * @text [chromatic] R/B 채널 오프셋 (100=28px)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param chromatic_alpha
 * @text [chromatic] 채널 알파 강도 (100=60%)
 * @type number
 * @min 0
 * @max 100
 * @default 70
 *
 * @param vignette_amount
 * @text [vignette] 주변 어둠 강도 (100=최대)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param vignette_range
 * @text [vignette] 비네트 범위 (0=넓게, 100=좁게 집중)
 * @type number
 * @min 0
 * @max 100
 * @default 50
 *
 * @param scanline_opacity
 * @text [scanline] 가로줄 불투명도 (100=70%)
 * @type number
 * @min 0
 * @max 100
 * @default 70
 *
 * @param scanline_desaturation
 * @text [scanline] 채도 감소량 (100=80%)
 * @type number
 * @min 0
 * @max 100
 * @default 60
 *
 * @param overlayColor
 * @text 오버레이 색상 (R,G,B)
 * @type string
 * @default 0,0,0
 *
 * @param overlayAlpha
 * @text 오버레이 불투명도 (0-255, 0이면 비활성)
 * @type number
 * @min 0
 * @max 255
 * @default 100
 *
 * @param duration
 * @text 전환 시간 (프레임 수, 60fps 기준)
 * @type number
 * @min 1
 * @max 120
 * @default 40
 *
 * @param easing
 * @text 이징
 * @type select
 * @option easeOut
 * @option easeIn
 * @option easeInOut
 * @option linear
 * @default easeOut
 *
 * @param closeAnim
 * @text 닫기 애니메이션 활성화
 * @type boolean
 * @default true
 */

(function () {
    'use strict';

    var params = PluginManager.parameters('MenuTransition');

    function _p(key, def) {
        var v = Number(params[key]);
        return (params[key] !== undefined && !isNaN(v)) ? v : def;
    }

    var Cfg = {
        transitionEffect: String(params.transitionEffect || 'blur'),
        // 효과별 파라미터
        blur_amount:              _p('blur_amount',              80),
        zoomBlur_amount:          _p('zoomBlur_amount',          80),
        zoomBlur_zoom:            _p('zoomBlur_zoom',            50),
        desaturation_amount:      _p('desaturation_amount',     100),
        sepia_amount:             _p('sepia_amount',            100),
        brightness_amount:        _p('brightness_amount',        80),
        darkness_amount:          _p('darkness_amount',          80),
        contrast_amount:          _p('contrast_amount',          70),
        hue_amount:               _p('hue_amount',               60),
        invert_amount:            _p('invert_amount',           100),
        pixelation_amount:        _p('pixelation_amount',        80),
        zoom_amount:              _p('zoom_amount',              60),
        chromatic_offset:         _p('chromatic_offset',         80),
        chromatic_alpha:          _p('chromatic_alpha',          70),
        vignette_amount:          _p('vignette_amount',          80),
        vignette_range:           _p('vignette_range',           50),
        scanline_opacity:         _p('scanline_opacity',         70),
        scanline_desaturation:    _p('scanline_desaturation',    60),
        // 공통
        overlayColor: String(params.overlayColor || '0,0,0'),
        overlayAlpha: _p('overlayAlpha', 100),
        duration:     _p('duration',      40) || 40,
        easing:       String(params.easing || 'easeOut'),
        closeAnim:    String(params.closeAnim) !== 'false'
    };

    var _overlayRGB = (function () {
        var parts = Cfg.overlayColor.split(',').map(function (s) {
            return Math.max(0, Math.min(255, Number(s) || 0));
        });
        while (parts.length < 3) parts.push(0);
        return parts;
    })();

