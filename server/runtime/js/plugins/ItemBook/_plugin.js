//=============================================================================
// ItemBook.js — 아이템 도감
//=============================================================================

/*:
 * @plugindesc 아이템/무기/방어구 도감. 획득한 아이템을 기록하여 목록으로 열람.
 * @author custom
 *
 * @param Unknown Data
 * @desc 미확인 아이템에 표시할 텍스트
 * @default ??????
 *
 * @param Price Text
 * @default 가격
 *
 * @param Equip Text
 * @default 장비
 *
 * @param Type Text
 * @default 타입
 *
 * @param Show In Menu
 * @desc 메뉴에 아이템 도감 항목 표시 여부
 * @type boolean
 * @default true
 *
 * @param Menu Text
 * @desc 메뉴에 표시할 텍스트
 * @default 아이템 도감
 *
 * @help
 * 아이템 메모:
 *   <book:no>   # 도감에 표시하지 않음
 *
 * @command open
 * @text 도감 열기
 * @desc 아이템 도감 화면을 엽니다.
 *
 * @command complete
 * @text 전체 등록
 * @desc 모든 아이템/무기/방어구를 도감에 등록합니다.
 *
 * @command clear
 * @text 초기화
 * @desc 도감을 초기화합니다.
 *
 * @command addItem
 * @text 아이템 등록
 * @arg dataId
 * @text 아이템
 * @type item
 * @default 1
 *
 * @command addWeapon
 * @text 무기 등록
 * @arg dataId
 * @text 무기
 * @type weapon
 * @default 1
 *
 * @command addArmor
 * @text 방어구 등록
 * @arg dataId
 * @text 방어구
 * @type armor
 * @default 1
 *
 * @command removeItem
 * @text 아이템 제거
 * @arg dataId
 * @text 아이템
 * @type item
 * @default 1
 *
 * @command removeWeapon
 * @text 무기 제거
 * @arg dataId
 * @text 무기
 * @type weapon
 * @default 1
 *
 * @command removeArmor
 * @text 방어구 제거
 * @arg dataId
 * @text 방어구
 * @type armor
 * @default 1
 */

/* @UITemplates
[
  {
    "group": "아이템 도감 $ctx",
    "pluginLabel": "ItemBook.js",
    "items": [
      {"label":"아이템 이름",    "code":"{$ctx.item&&$ctx.item.name||''}",          "desc":"선택된 아이템/무기/방어구 이름 (item_book 씬)",       "modes":["text"]},
      {"label":"아이템 설명",    "code":"{$ctx.item&&$ctx.item.description||''}",   "desc":"선택된 아이템 설명 (textArea용)",                     "modes":["text"]},
      {"label":"아이템 가격",    "code":"{$ctx.item&&$ctx.item.price||0}",          "desc":"선택된 아이템 가격",                                  "modes":["text"]},
      {"label":"아이템 타입",    "code":"{$ctx.item&&$ctx.item.itypeId?'아이템':$ctx.item.wtypeId?'무기':'방어구'}", "desc":"아이템/무기/방어구 구분 텍스트", "modes":["text"]},
      {"label":"아이콘 bitmap",  "code":"ImageManager.loadSystem('IconSet')",        "desc":"아이콘셋 Bitmap (srcRectExpr로 잘라냄, bitmapExpr용)", "modes":["bitmap"]},
      {"label":"아이콘 rect",    "code":"{x:($ctx.item&&$ctx.item.iconIndex%16||0)*32,y:($ctx.item&&Math.floor($ctx.item.iconIndex/16)||0)*32,w:32,h:32}", "desc":"선택된 아이템 아이콘 srcRect (srcRectExpr용)", "modes":["srcRect"]},
      {"label":"ATK 파라미터",   "code":"{$ctx.item&&$ctx.item.params&&$ctx.item.params[2]||0}", "desc":"무기/방어구 ATK (params[2])", "modes":["text"]},
      {"label":"DEF 파라미터",   "code":"{$ctx.item&&$ctx.item.params&&$ctx.item.params[3]||0}", "desc":"무기/방어구 DEF (params[3])", "modes":["text"]}
    ]
  }
]
*/

(function() {

    var parameters  = PluginManager.parameters('ItemBook');
    var unknownData = String(parameters['Unknown Data'] || '??????');
    var priceText   = String(parameters['Price Text']   || '가격');
    var equipText   = String(parameters['Equip Text']   || '장비');
    var typeText    = String(parameters['Type Text']    || '타입');
    var showInMenu  = String(parameters['Show In Menu'] || 'true') === 'true';
    var menuText    = String(parameters['Menu Text']    || '아이템 도감');

    // CustomSceneEngine이 켜져 있으면 커스텀 씬 사용
    function hasCSEngine() { return typeof window.__customSceneEngine !== 'undefined'; }
    function openItemBook() {
        if (hasCSEngine() && window['Scene_CS_item_book']) {
            SceneManager.push(window['Scene_CS_item_book']);
        } else {
            SceneManager.push(Scene_ItemBook);
        }
    }

