/*:
 * @plugindesc UI 테마 — data/UIEditorConfig.json 으로 게임 UI 전체 커스터마이징
 * @author RPG Maker MV Web Editor
 *
 * @help UITheme.js
 *
 * RPG Maker MV 웹 에디터의 UI 에디터 기능과 연동합니다.
 * data/UIEditorConfig.json 의 설정을 읽어 게임 내 모든 Window의
 * 스타일(폰트, 투명도, 색조, 스킨)과 배치(위치, 크기)를 변경합니다.
 *
 * ● 기본 동작
 *   설정 파일이 없거나 overrides가 비어있으면 RPG Maker MV 원본과
 *   완전히 동일하게 동작합니다.
 *
 * ● 호환성
 *   RPG Maker MV 1.6.x 이상, NW.js 및 웹 브라우저 배포 모두 지원.
 *   이 플러그인은 에디터에서 자동으로 관리됩니다.
 */
(function () {
  'use strict';

  // 배포 embed 우선, 없으면 동기 XHR (NW.js + 브라우저 양쪽 호환)
  function loadJson(url) {
    var key = url.split('?')[0];
    if (window.__RPGDATA__ && window.__RPGDATA__[key] !== undefined) return window.__RPGDATA__[key] || {};
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url + '?_=' + Date.now(), false);
      xhr.send();
      if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
    } catch (e) {}
    return {};
  }

  var _config = loadJson('data/UIEditorConfig.json');
  var _skins  = loadJson('data/UIEditorSkins.json');
  var _fonts  = loadJson('data/UIEditorFonts.json');
  var _ov     = _config.overrides || {};
