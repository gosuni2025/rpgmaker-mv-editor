/*:
 * @pluginname 빌드 버전 표시
 * @plugindesc 타이틀 화면 오른쪽 하단에 빌드 번호를 표시합니다.
 * @author gosuni2025
 *
 * @param fontSize
 * @text 폰트 크기
 * @type number
 * @min 8
 * @max 24
 * @default 14
 *
 * @param textColor
 * @text 텍스트 색상 (CSS color)
 * @type string
 * @default rgba(255,255,255,0.5)
 *
 * @param marginRight
 * @text 우측 여백
 * @type number
 * @default 12
 *
 * @param marginBottom
 * @text 하단 여백
 * @type number
 * @default 8
 *
 * @help
 * 배포 시 HTML에 주입된 window.__BUILD_ID__ (YYYYMMDDHHMMSS) 를 읽어
 * 타이틀 화면 오른쪽 하단에 "Build YYYY-MM-DD HH:MM" 형식으로 표시합니다.
 *
 * 로컬 실행 시 window.__BUILD_ID__ 가 없으면 아무것도 표시되지 않습니다.
 */

(function() {
    'use strict';

    var params        = PluginManager.parameters('BuildVersion');
    var _fontSize     = parseInt(params['fontSize']     || 14, 10);
    var _textColor    = (params['textColor']   || 'rgba(255,255,255,0.5)').trim();
    var _marginRight  = parseInt(params['marginRight']  || 12, 10);
    var _marginBottom = parseInt(params['marginBottom'] || 8,  10);

    // ── 빌드 ID 읽기 ─────────────────────────────────────────────────────────
    // 배포 스크립트가 <head>에 window.__BUILD_ID__ = 'YYYYMMDDHHMMSS' 를 주입한다.
    // PluginManager는 플러그인을 동적 script 태그로 로드하므로 src 속성에
    // ?v= 쿼리가 붙지 않음 → 전역 변수로 빌드 ID를 전달하는 방식 사용.
    function _readBuildId() {
        return (typeof window !== 'undefined' && window.__BUILD_ID__) || null;
    }

    // YYYYMMDDHHMMSS → "YYYY-MM-DD HH:MM" 형식으로 변환
    function _formatBuildId(id) {
        if (!id || id.length < 12) return id;
        return id.slice(0,4) + '-' + id.slice(4,6) + '-' + id.slice(6,8)
             + ' ' + id.slice(8,10) + ':' + id.slice(10,12);
    }

    var _buildText = (function() {
        var raw = _readBuildId();
        return raw ? 'Build ' + _formatBuildId(raw) : null;
    })();

    if (!_buildText) return; // 빌드 ID 없으면 아무것도 하지 않음

    // ── Scene_Title 오버라이드 ────────────────────────────────────────────────
    var _Scene_Title_create = Scene_Title.prototype.create;
    Scene_Title.prototype.create = function() {
        _Scene_Title_create.call(this);
        this._buildVersionSprite = this._createBuildVersionSprite();
        this.addChild(this._buildVersionSprite);
    };

    Scene_Title.prototype._createBuildVersionSprite = function() {
        var text   = _buildText;
        var w      = Graphics.boxWidth;
        var h      = _fontSize + 8;

        var bitmap = new Bitmap(w, h);
        bitmap.fontSize  = _fontSize;
        bitmap.textColor = _textColor;
        bitmap.drawText(text, 0, 0, w - _marginRight, h, 'right');

        var sprite = new Sprite(bitmap);
        sprite.x = 0;
        sprite.y = Graphics.boxHeight - h - _marginBottom;
        return sprite;
    };

})();
