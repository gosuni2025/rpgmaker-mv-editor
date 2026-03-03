// UI 에디터 프리뷰: StorageManager/AudioManager 억제 (저장/오디오 불필요)
(function() {
  function noop() {}
  StorageManager.save = noop;
  StorageManager.load = function() { return null; };
  StorageManager.exists = function() { return false; };
  StorageManager.isLocalMode = function() { return false; };
  AudioManager.playBgm = noop;
  AudioManager.playBgs = noop;
  AudioManager.playMe = noop;
  AudioManager.playSe = noop;
  AudioManager.stopAll = noop;
})();
