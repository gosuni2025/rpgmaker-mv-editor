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
 * @text 텍스트 색상
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
 * 배포 시 script src에 삽입된 ?v=YYYYMMDDHHMMSS 쿼리를 읽어
 * 타이틀 화면 오른쪽 하단에 빌드 번호를 작게 표시합니다.
 *
 * 로컬 실행 시에는 버전 정보가 없으므로 아무것도 표시되지 않습니다.
 */

(function() {
    'use strict';

    var params = PluginManager.parameters('BuildVersion');
    var _fontSize    = parseInt(params['fontSize']    || 14, 10);
    var _textColor   = (params['textColor']  || 'rgba(255,255,255,0.5)').trim();
    var _marginRight = parseInt(params['marginRight'] || 12, 10);
    var _marginBottom= parseInt(params['marginBottom']|| 8,  10);

    // ── 빌드 ID 읽기 ─────────────────────────────────────────────────────────
    // 배포 스크립트가 script src에 ?v=YYYYMMDDHHMMSS 를 삽입하므로,
    // 이 파일 자신의 <script> 태그 src에서 파라미터를 읽는다.
    function _readBuildId() {
        var scripts = document.querySelectorAll('script[src*="BuildVersion.js"]');
        for (var i = 0; i < scripts.length; i++) {
            var m = scripts[i].src.match(/\?v=(\d{14})/);
            if (m) return m[1];
        }
        return null;
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
        var text     = _buildText;
        var fontSize = _fontSize;
        var padding  = 6;

        // Canvas로 텍스트 크기 측정
        var bmp = new Bitmap(1, 1);
        bmp.fontSize = fontSize;
        var textWidth = bmp.measureTextWidth(text);
        var w = textWidth + padding * 2;
        var h = fontSize + padding * 2;

        var bitmap = new Bitmap(w, h);
        bitmap.fontSize    = fontSize;
        bitmap.fontItalic  = false;

        // 텍스트 그리기
        bitmap.drawText(text, 0, 0, w, h, 'center');

        // 색상 적용을 위해 canvas context를 직접 사용
        var ctx = bitmap._context || (bitmap.canvas && bitmap.canvas.getContext('2d'));
        if (ctx) {
            ctx.clearRect(0, 0, w, h);
            ctx.font = fontSize + 'px GameFont, sans-serif';
            ctx.fillStyle = _textColor;
            ctx.textBaseline = 'top';
            ctx.fillText(text, padding, padding);
            bitmap._setDirty && bitmap._setDirty();
        }

        var sprite = new Sprite(bitmap);
        sprite.x = Graphics.boxWidth  - w - _marginRight;
        sprite.y = Graphics.boxHeight - h - _marginBottom;
        return sprite;
    };

})();
