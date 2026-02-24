//=============================================================================
// ScriptFileRef.js
// 브라우저 플레이테스트 환경에서 @script-file 마커를 처리합니다.
// NW.js 환경(스탠드얼론 게임)에서는 require()가 있으므로 이 오버라이드가 실행되지 않습니다.
//=============================================================================

(function() {
  'use strict';

  // NW.js 환경(require 존재)에서는 원본 그대로 사용
  if (typeof require !== 'undefined') return;

  var _orig_command355 = Game_Interpreter.prototype.command355;

  Game_Interpreter.prototype.command355 = function() {
    var firstLine = this.currentCommand().parameters[0];
    var m = firstLine.match(/^\/\* @script-file: (.+?) \*\//);

    // @script-file 마커 없으면 원본 실행
    if (!m) return _orig_command355.call(this);

    var filePath = m[1];

    // 연속 655 커맨드 스킵 (NW.js eval 코드 — 브라우저에서 대체)
    while (this.nextEventCode() === 655) {
      this._index++;
    }

    // 동기 XHR로 서버에서 파일 내용 가져오기
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/project/js-file-content?path=' + encodeURIComponent(filePath), false);
    try {
      xhr.send();
    } catch (e) {
      console.error('[ScriptFileRef] XHR 오류 (' + filePath + '):', e);
      return true;
    }

    if (xhr.status === 200) {
      try {
        /*jshint evil:true*/
        // eslint-disable-next-line no-eval
        (0, eval)(xhr.responseText);
        console.log('[ScriptFileRef] 로드 완료:', filePath);
      } catch (e) {
        console.error('[ScriptFileRef] 실행 오류 (' + filePath + '):', e);
      }
    } else {
      console.error('[ScriptFileRef] 파일 로드 실패:', filePath, '(' + xhr.status + ')');
    }

    return true;
  };

})();
