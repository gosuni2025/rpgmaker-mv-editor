/*:
 * @pluginname 실루엣 효과
 * @plugindesc 플레이어가 오브젝트 뒤에 가려졌을 때 실루엣으로 위치를 표시합니다.
 * @author gosuni2025
 *
 * @param Fill Color
 * @type color
 * @desc 실루엣 내부 채움 색 (CSS hex)
 * @default #3366ff
 *
 * @param Fill Opacity
 * @type number
 * @desc 내부 채움 투명도 (0.0 ~ 1.0)
 * @min 0
 * @max 1
 * @default 0.35
 *
 * @param Outline Color
 * @type color
 * @desc 외곽선 색 (CSS hex)
 * @default #ffffff
 *
 * @param Outline Opacity
 * @type number
 * @desc 외곽선 투명도 (0.0 ~ 1.0)
 * @min 0
 * @max 1
 * @default 0.8
 *
 * @param Outline Width
 * @type number
 * @desc 외곽선 두께 (px)
 * @min 0
 * @max 10
 * @default 2
 *
 * @param Pattern
 * @type select
 * @desc 채움 패턴
 * @option solid
 * @option empty
 * @option dot
 * @option diagonal
 * @option cross
 * @option hatch
 * @default solid
 *
 * @param Pattern Scale
 * @type number
 * @desc 패턴 크기 (px)
 * @min 2
 * @max 32
 * @default 8
 *
 * @param Include Followers
 * @type boolean
 * @desc 파티원도 실루엣 대상에 포함
 * @default false
 *
 * @help
 * 플레이어 캐릭터가 이미지 오브젝트(z=5) 뒤에 가려졌을 때,
 * 가려진 부분을 실루엣으로 표시하여 플레이어 위치를 알 수 있게 합니다.
 *
 * 브라우저 콘솔에서 실시간 설정 변경 가능:
 *   OcclusionSilhouette.config.fillColor = [1, 0, 0];  // 빨간색
 *   OcclusionSilhouette.config.pattern = 'diagonal';    // 사선 패턴
 *   OcclusionSilhouette.config.outlineWidth = 3;        // 외곽선 두께
 */

(function() {
    'use strict';

    // Three.js 없는 환경(PIXI 런타임)에서는 로드 스킵
    if (typeof THREE === 'undefined') return;


    // 플러그인 파라미터 읽기
    var parameters = PluginManager.parameters('OcclusionSilhouette');

    function hexToRgb(hex) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        var r = parseInt(hex.substr(0, 2), 16) / 255;
        var g = parseInt(hex.substr(2, 2), 16) / 255;
        var b = parseInt(hex.substr(4, 2), 16) / 255;
        return [r, g, b];
    }

    var fillColorParam = parameters['Fill Color'] || '#3366ff';
    var fillOpacityParam = parseFloat(parameters['Fill Opacity'] || '0.35');
    var outlineColorParam = parameters['Outline Color'] || '#ffffff';
    var outlineOpacityParam = parseFloat(parameters['Outline Opacity'] || '0.8');
    var outlineWidthParam = parseFloat(parameters['Outline Width'] || '2');
    var patternParam = parameters['Pattern'] || 'solid';
    var patternScaleParam = parseFloat(parameters['Pattern Scale'] || '8');
    var includeFollowersParam = String(parameters['Include Followers']) !== 'false';

    var OcclusionSilhouette = {};
    window.OcclusionSilhouette = OcclusionSilhouette;

    OcclusionSilhouette._active = true;
    OcclusionSilhouette._charMaskRT = null;
    OcclusionSilhouette._objMaskRT = null;
    OcclusionSilhouette._silhouettePass = null;
    OcclusionSilhouette._maskWidth = 0;
    OcclusionSilhouette._maskHeight = 0;

    // 설정
    OcclusionSilhouette.config = {
        fillColor: hexToRgb(fillColorParam),
        fillOpacity: fillOpacityParam,
        outlineColor: hexToRgb(outlineColorParam),
        outlineOpacity: outlineOpacityParam,
        outlineWidth: outlineWidthParam,
        pattern: patternParam,
        patternScale: patternScaleParam,
        includeFollowers: includeFollowersParam
    };

    // 패턴 ID 매핑
    var PATTERN_MAP = {
        'solid': 0,
        'empty': 1,
        'dot': 2,
        'diagonal': 3,
        'cross': 4,
        'hatch': 5
    };

