//=============================================================================
// ItemDetail.js
// 아이템 선택 시 중앙 팝업으로 이미지와 상세 텍스트를 표시합니다.
//=============================================================================

/*:
 * @plugindesc v2.0 아이템 결정 키/터치 시 중앙 팝업으로 상세 이미지와 텍스트를 표시합니다.
 * @author Claude
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
 *   img/pictures/ 폴더의 이미지를 표시합니다.
 *   예) <detailImg: Crystal>
 *
 * <detailText>
 * 텍스트 내용 (여러 줄, \c[색번호] 제어문자 사용 가능)
 * </detailText>
 *
 * ============================================================
 */

(function () {
    'use strict';

    var p = PluginManager.parameters('ItemDetail');
    var DEF_IMG_HALIGN  = p['defaultImgHAlign']  || 'center';
    var DEF_IMG_VALIGN  = p['defaultImgVAlign']  || 'middle';
    var DEF_TXT_HALIGN  = p['defaultTextHAlign'] || 'left';
    var DEF_TXT_VALIGN  = p['defaultTextVAlign'] || 'bottom';

    //-------------------------------------------------------------------------
    // 노트 태그 파싱
    //-------------------------------------------------------------------------
    function parseDetail(item) {
        if (!item) return null;
        var note = item.note || '';

        var picM = note.match(/<detailPic>([\s\S]*?)<\/detailPic>/i);
        var txtM = note.match(/<detailTxt>([\s\S]*?)<\/detailTxt>/i);

        var legacyImgM      = !picM && note.match(/<detailImg:\s*(.+?)>/i);
        var legacyImgAlignM = !picM && note.match(/<detailImgAlign:\s*(\w+)\s*,\s*(\w+)>/i);
        var legacyTextM     = !txtM && note.match(/<detailText>([\s\S]*?)<\/detailText>/i);
        var legacyTxtAlignM = !txtM && note.match(/<detailTextAlign:\s*(\w+)\s*,\s*(\w+)>/i);

        var pic = null, txt = null;

        if (picM) {
            try { pic = JSON.parse(picM[1]); } catch(e) {}
        } else if (legacyImgM) {
            pic = {
                image: legacyImgM[1].trim(),
                opacity: 255, blendMode: 0,
                imgHAlign: legacyImgAlignM ? legacyImgAlignM[1].toLowerCase() : DEF_IMG_HALIGN,
                imgVAlign: legacyImgAlignM ? legacyImgAlignM[2].toLowerCase() : DEF_IMG_VALIGN
            };
        }

        if (txtM) {
            try { txt = JSON.parse(txtM[1]); } catch(e) {}
        } else if (legacyTextM) {
            txt = {
                text:       legacyTextM[1].trim(),
                textHAlign: legacyTxtAlignM ? legacyTxtAlignM[1].toLowerCase() : DEF_TXT_HALIGN,
                textVAlign: legacyTxtAlignM ? legacyTxtAlignM[2].toLowerCase() : DEF_TXT_VALIGN
            };
        }

        if (!pic && !txt) return null;

        return {
            image:      pic ? pic.image      : null,
            imgHAlign:  pic ? (pic.imgHAlign  || DEF_IMG_HALIGN) : DEF_IMG_HALIGN,
            imgVAlign:  pic ? (pic.imgVAlign  || DEF_IMG_VALIGN) : DEF_IMG_VALIGN,
            opacity:    pic ? (pic.opacity    != null ? pic.opacity : 255) : 255,
            blendMode:  pic ? (pic.blendMode  || 0) : 0,
            shaderData: pic ? (pic.shaderData || []) : [],
            text:       txt ? txt.text        : null,
            textHAlign: txt ? (txt.textHAlign || DEF_TXT_HALIGN) : DEF_TXT_HALIGN,
            textVAlign: txt ? (txt.textVAlign || DEF_TXT_VALIGN) : DEF_TXT_VALIGN
        };
    }

    //=========================================================================
    // 상세 팝업 dim overlay 헬퍼
    //=========================================================================
    function ensureDimOverlay(scene) {
        if (!scene._dimOverlay) {
            var bmp = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
            bmp.fillRect(0, 0, bmp.width, bmp.height, 'rgba(0,0,0,0.7)');
            scene._dimOverlay = new Sprite(bmp);
            scene._dimOverlay.visible = false;
            // topLayer 위젯들 바로 앞에 삽입
            var pp = scene._widgetMap && scene._widgetMap['id_popup'];
            if (pp) {
                var ppObj = pp.displayObject();
                var idx = scene.children.indexOf(ppObj);
                if (idx >= 0) { scene.addChildAt(scene._dimOverlay, idx); return; }
            }
            scene.addChild(scene._dimOverlay);
        }
    }

    function showDimOverlay(scene) {
        ensureDimOverlay(scene);
        scene._dimOverlay.visible = true;
    }

    function hideDimOverlay(scene) {
        if (scene._dimOverlay) scene._dimOverlay.visible = false;
    }

    //=========================================================================
    // Scene_CustomUI (CustomSceneEngine) — item 씬 연동
    // 팝업 위젯들은 data/UIScenes/item.json에 정의됨.
    // 플러그인은 useItem 인터셉트 + _execPendingUse 헬퍼 주입만 담당.
    //=========================================================================
    if (window.Scene_CustomUI) {
        // JSON script에서 호출 가능한 dim 헬퍼 주입
        Scene_CustomUI.prototype._showDimOverlay = function() { showDimOverlay(this); };
        Scene_CustomUI.prototype._hideDimOverlay = function() { hideDimOverlay(this); };

        var _exec_orig = Scene_CustomUI.prototype._executeWidgetHandler;

        if (_exec_orig) {
            Scene_CustomUI.prototype._executeWidgetHandler = function (handler, widget) {
                if (this._sceneId === 'item' && handler && handler.action === 'useItem') {
                    var ilId = handler.itemListWidget || 'item_list';
                    var ilW  = this._widgetMap && this._widgetMap[ilId];
                    var item = (ilW && ilW._window) ? ilW._window.item() : null;
                    if (!item) item = this._ctx && this._ctx.selectedItem;
                    var detail = item ? parseDetail(item) : null;

                    if (detail) {
                        this._ctx._detailD = detail;

                        // JSON script에서 호출 가능한 헬퍼 주입
                        var self = this;
                        this._execPendingUse = function() {
                            var h = self._pendingUseHandler;
                            var w = self._pendingUseWidget;
                            self._pendingUseHandler = null;
                            self._pendingUseWidget  = null;
                            if (h) _exec_orig.call(self, h, w);
                        };

                        if ($gameParty.canUse(item)) {
                            this._pendingUseHandler = handler;
                            this._pendingUseWidget  = widget;
                            var aw = this._widgetMap['id_action'];
                            if (aw) {
                                aw.show();
                                if (this._navManager) this._navManager.focusWidget('id_action');
                            }
                        } else {
                            showDimOverlay(this);
                            var pp = this._widgetMap['id_popup'];
                            var pc = this._widgetMap['id_popup_ctrl'];
                            if (pp) pp.show();
                            if (pc) pc.show();
                            var img = this._widgetMap['id_popup_img'];
                            if (img && img.refresh) img.refresh();
                            var txt = this._widgetMap['id_popup_text'];
                            if (txt && txt.refresh) txt.refresh();
                            if (this._navManager) this._navManager.focusWidget('id_popup_ctrl');
                        }
                        return;
                    }
                }
                _exec_orig.call(this, handler, widget);
            };
        }
    }

})();
