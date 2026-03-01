//=============================================================================
// ItemDetail.js
// 아이템 선택 시 우측 패널에 이미지와 상세 텍스트를 표시합니다.
//=============================================================================

/*:
 * @plugindesc v1.0 아이템 선택 시 우측 패널에 이미지와 상세 텍스트를 표시합니다.
 * @author Claude
 *
 * @param itemWindowWidthRate
 * @text 아이템창 너비 비율
 * @desc 아이템 목록창의 너비 비율 (0.30 ~ 0.90)
 * @type number
 * @decimals 2
 * @min 0.30
 * @max 0.90
 * @default 0.50
 *
 * @param defaultImgHAlign
 * @text 기본 이미지 가로 정렬
 * @type select
 * @option 왼쪽
 * @value left
 * @option 가운데
 * @value center
 * @option 오른쪽
 * @value right
 * @default center
 *
 * @param defaultImgVAlign
 * @text 기본 이미지 세로 정렬
 * @type select
 * @option 위
 * @value top
 * @option 가운데
 * @value middle
 * @option 아래
 * @value bottom
 * @default middle
 *
 * @param defaultTextHAlign
 * @text 기본 텍스트 가로 정렬
 * @type select
 * @option 왼쪽
 * @value left
 * @option 가운데
 * @value center
 * @option 오른쪽
 * @value right
 * @default left
 *
 * @param defaultTextVAlign
 * @text 기본 텍스트 세로 정렬
 * @type select
 * @option 위
 * @value top
 * @option 가운데
 * @value middle
 * @option 아래
 * @value bottom
 * @default bottom
 *
 * @param textBackground
 * @text 텍스트 배경 표시
 * @desc 이미지 위 텍스트 가독성을 위한 반투명 배경
 * @type boolean
 * @default true
 *
 * @help
 * ============================================================
 * 아이템 노트 태그
 * ============================================================
 *
 * <detailImg: 파일명>
 *   img/pictures/ 폴더의 이미지를 표시합니다. 확장자 생략 가능.
 *   예) <detailImg: Crystal>
 *
 * <detailImgAlign: 가로, 세로>
 *   이미지 정렬 (left/center/right, top/middle/bottom)
 *   예) <detailImgAlign: center, middle>
 *
 * <detailText>
 * 텍스트 내용
 * 여러 줄 가능. \c[색번호] 등 제어문자 사용 가능.
 * </detailText>
 *
 * <detailTextAlign: 가로, 세로>
 *   텍스트 정렬 (left/center/right, top/middle/bottom)
 *   예) <detailTextAlign: left, bottom>
 *
 * ============================================================
 */

(function () {
    'use strict';

    var p = PluginManager.parameters('ItemDetail');
    var ITEM_WIDTH_RATE = parseFloat(p['itemWindowWidthRate'] || '0.5');
    var DEF_IMG_HALIGN  = p['defaultImgHAlign']  || 'center';
    var DEF_IMG_VALIGN  = p['defaultImgVAlign']  || 'middle';
    var DEF_TXT_HALIGN  = p['defaultTextHAlign'] || 'left';
    var DEF_TXT_VALIGN  = p['defaultTextVAlign'] || 'bottom';
    var TEXT_BG         = p['textBackground'] !== 'false';

    //-------------------------------------------------------------------------
    // 노트 태그 파싱
    //-------------------------------------------------------------------------
    function parseDetail(item) {
        if (!item) return null;
        var note = item.note || '';

        var imgM      = note.match(/<detailImg:\s*(.+?)>/i);
        var imgAlignM = note.match(/<detailImgAlign:\s*(\w+)\s*,\s*(\w+)>/i);
        var textM     = note.match(/<detailText>([\s\S]*?)<\/detailText>/i);
        var txtAlignM = note.match(/<detailTextAlign:\s*(\w+)\s*,\s*(\w+)>/i);

        if (!imgM && !textM) return null;

        return {
            image:      imgM      ? imgM[1].trim()       : null,
            imgHAlign:  imgAlignM ? imgAlignM[1].toLowerCase() : DEF_IMG_HALIGN,
            imgVAlign:  imgAlignM ? imgAlignM[2].toLowerCase() : DEF_IMG_VALIGN,
            text:       textM     ? textM[1].trim()      : null,
            textHAlign: txtAlignM ? txtAlignM[1].toLowerCase() : DEF_TXT_HALIGN,
            textVAlign: txtAlignM ? txtAlignM[2].toLowerCase() : DEF_TXT_VALIGN
        };
    }

    //=========================================================================
    // Window_ItemDetail
    //=========================================================================
    function Window_ItemDetail() {
        this.initialize.apply(this, arguments);
    }

    Window_ItemDetail.prototype = Object.create(Window_Base.prototype);
    Window_ItemDetail.prototype.constructor = Window_ItemDetail;

    Window_ItemDetail.prototype.initialize = function (x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._item   = null;
        this._detail = null;
    };

    Window_ItemDetail.prototype.setItem = function (item) {
        if (this._item === item) return;
        this._item   = item;
        this._detail = item ? parseDetail(item) : null;
        this.refresh();
    };

    Window_ItemDetail.prototype.refresh = function () {
        this.contents.clear();
        var detail = this._detail;
        if (!detail) return;

        var cw = this.contentsWidth();
        var ch = this.contentsHeight();

        if (detail.image) {
            var bmp = ImageManager.loadPicture(detail.image);
            if (bmp.isReady()) {
                this._drawImage(bmp, detail, cw, ch);
                this._drawText(detail, cw, ch);
            } else {
                bmp.addLoadListener(function () {
                    this.contents.clear();
                    this._drawImage(bmp, detail, cw, ch);
                    this._drawText(detail, cw, ch);
                }.bind(this));
            }
        } else {
            this._drawText(detail, cw, ch);
        }
    };

    Window_ItemDetail.prototype._drawImage = function (bmp, detail, cw, ch) {
        var bw = bmp.width;
        var bh = bmp.height;
        // 창을 벗어나지 않는 최대 스케일 (확대는 하지 않음)
        var scale = Math.min(cw / bw, ch / bh, 1);
        var dw = Math.floor(bw * scale);
        var dh = Math.floor(bh * scale);

        var dx = 0;
        if (detail.imgHAlign === 'center') dx = Math.floor((cw - dw) / 2);
        else if (detail.imgHAlign === 'right') dx = cw - dw;

        var dy = 0;
        if (detail.imgVAlign === 'middle') dy = Math.floor((ch - dh) / 2);
        else if (detail.imgVAlign === 'bottom') dy = ch - dh;

        this.contents.blt(bmp, 0, 0, bw, bh, dx, dy, dw, dh);
    };

    // 제어문자를 제거한 순수 텍스트 너비 측정
    Window_ItemDetail.prototype._measureLine = function (text) {
        var plain = text.replace(/\\[A-Za-z]\[\d*\]/g, '').replace(/\\/g, '');
        return this.contents.measureTextWidth(plain);
    };

    Window_ItemDetail.prototype._drawText = function (detail, cw, ch) {
        if (!detail.text) return;

        var lines = detail.text.split('\n');
        var lh    = this.lineHeight();
        var total = lines.length * lh;
        var pad   = 6;

        var startY = pad;
        if (detail.textVAlign === 'middle') startY = Math.max(pad, Math.floor((ch - total) / 2));
        else if (detail.textVAlign === 'bottom') startY = Math.max(pad, ch - total - pad);

        // 이미지가 있을 때 텍스트 영역 반투명 배경
        if (TEXT_BG && detail.image) {
            this.contents.fillRect(0, startY - 2, cw, total + 4, 'rgba(0,0,0,0.55)');
        }

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var y    = startY + i * lh;
            var tw   = this._measureLine(line);

            var x = pad;
            if (detail.textHAlign === 'center') x = Math.floor((cw - tw) / 2);
            else if (detail.textHAlign === 'right') x = cw - tw - pad;

            this.drawTextEx(line, x, y);
        }
    };

    //=========================================================================
    // Window_ItemList — 상세창 연동
    //=========================================================================
    Window_ItemList.prototype.setDetailWindow = function (win) {
        this._detailWindow = win;
        this.callUpdateHelp();
    };

    var _ItemList_callUpdateHelp = Window_ItemList.prototype.callUpdateHelp;
    Window_ItemList.prototype.callUpdateHelp = function () {
        _ItemList_callUpdateHelp.call(this);
        if (this._detailWindow) {
            this._detailWindow.setItem(this.item());
        }
    };

    //=========================================================================
    // Scene_Item — 레이아웃 재구성
    //=========================================================================

    // 아이템 목록창을 왼쪽 ITEM_WIDTH_RATE 비율로 생성
    Scene_Item.prototype.createItemWindow = function () {
        var wy = this._categoryWindow.y + this._categoryWindow.height;
        var wh = Graphics.boxHeight - wy;
        var ww = Math.floor(Graphics.boxWidth * ITEM_WIDTH_RATE);
        this._itemWindow = new Window_ItemList(0, wy, ww, wh);
        this._itemWindow.setHelpWindow(this._helpWindow);
        this._itemWindow.setHandler('ok',     this.onItemOk.bind(this));
        this._itemWindow.setHandler('cancel', this.onItemCancel.bind(this));
        this._categoryWindow.setItemWindow(this._itemWindow);
        this.addWindow(this._itemWindow);
    };

    Scene_Item.prototype.createDetailWindow = function () {
        var wy = this._categoryWindow.y + this._categoryWindow.height;
        var wx = Math.floor(Graphics.boxWidth * ITEM_WIDTH_RATE);
        var ww = Graphics.boxWidth - wx;
        var wh = Graphics.boxHeight - wy;
        this._detailWindow = new Window_ItemDetail(wx, wy, ww, wh);
        this._itemWindow.setDetailWindow(this._detailWindow);
        this.addWindow(this._detailWindow);
    };

    var _Scene_Item_create = Scene_Item.prototype.create;
    Scene_Item.prototype.create = function () {
        _Scene_Item_create.call(this);
        this.createDetailWindow();
    };

})();
