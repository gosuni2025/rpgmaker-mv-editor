/*:
 * @pluginname ImageCacheManager
 * @plugindesc Manages the image cache. Adjust cache size, cleanup interval, or disable caching entirely (MZ-style).
 * @author RPG Maker MV Editor
 *
 * @param cacheMode
 * @text Cache Mode
 * @type select
 * @option normal — MV default (auto cleanup on scene change)
 * @value normal
 * @option aggressive — periodic force-cleanup (low-memory environments)
 * @value aggressive
 * @option disabled — browser-cache style (no expiry, imageCacheLimit applies)
 * @value disabled
 * @desc Cache behavior mode.
 * @default normal
 *
 * @param imageCacheLimit
 * @text Cache Size Limit (MPix)
 * @type number
 * @min 1
 * @desc Maximum image cache size in megapixels. Applies in normal/aggressive mode.
 * @default 10
 *
 * @param cleanupInterval
 * @text Cleanup Interval (sec)
 * @type number
 * @min 5
 * @desc Seconds between forced cache cleanup. Applies in aggressive mode only.
 * @default 30
 *
 * @help
 * ============================================================
 *  ImageCacheManager
 *  Author: RPG Maker MV Editor
 *  Version: 1.0.0
 * ============================================================
 *
 * RPG Maker MV의 이미지 캐시 시스템을 조정하는 플러그인입니다.
 * 캐시 용량·정리 주기를 세밀하게 제어하거나, 캐시를 완전히
 * 비활성화하여 RPG Maker MZ와 유사한 동작을 구현할 수 있습니다.
 *
 * ============================================================
 *  MV의 이미지 캐시 구조
 * ============================================================
 *
 * MV는 두 겹의 캐시 레이어를 사용합니다.
 *
 *  ┌─ CacheMap ────────────────────────────────────────────┐
 *  │  SceneManager.updateManagers()가 매 프레임 호출하는    │
 *  │  TTL(Time-To-Live) 기반 캐시.                         │
 *  │  일정 시간 접근이 없으면 항목을 만료·제거합니다.       │
 *  └───────────────────────────────────────────────────────┘
 *  ┌─ ImageCache ──────────────────────────────────────────┐
 *  │  총 용량(MPix) 제한 기반 캐시.                        │
 *  │  초과 시 오래된 항목부터 제거합니다. (기본 10 MPix)   │
 *  └───────────────────────────────────────────────────────┘
 *
 * ============================================================
 *  캐시 모드 (cacheMode)
 * ============================================================
 *
 *  normal
 *    MV 기본 동작입니다.
 *    SceneManager가 씬 전환 시 CacheMap을 자동 정리하고,
 *    imageCacheLimit 파라미터로 용량 상한만 조정합니다.
 *    → 대부분의 게임에 권장되는 설정입니다.
 *
 *  aggressive
 *    cleanupInterval 간격으로 CacheMap TTL 만료 처리와
 *    ImageCache 용량 초과분 제거를 강제 실행합니다.
 *    → 메모리가 제한된 환경(저사양 PC, 모바일 등)에 적합합니다.
 *    → 에디터(SceneManager 스텁 환경)에서도 올바르게 동작합니다.
 *
 *  disabled
 *    MV의 캐시 만료 로직(씬 전환 시 clear, CacheMap TTL)을 비활성화합니다.
 *    한 번 로드한 이미지는 imageCacheLimit 이하인 한 씬 전환 후에도 유지됩니다.
 *    → 브라우저 HTTP 캐시처럼 동작합니다.
 *    → 씬 전환이 잦아도 이미지를 재로드하지 않습니다.
 *    → imageCacheLimit으로 메모리 상한을 제어하세요.
 *
 * ============================================================
 *  캐시 용량 (imageCacheLimit)
 * ============================================================
 *
 *  단위: 메가픽셀 (MPix), 기본값 10
 *  실제 메모리 소비 = imageCacheLimit × 4MB (RGBA 4바이트 기준)
 *
 *    10 MPix → 약 40MB
 *    20 MPix → 약 80MB
 *     5 MPix → 약 20MB
 *
 *  모든 모드에서 적용됩니다.
 *
 * ============================================================
 *  정리 주기 (cleanupInterval)
 * ============================================================
 *
 *  단위: 초, 기본값 30, 최솟값 5
 *  aggressive 모드에서만 적용됩니다.
 *  값을 낮출수록 메모리 절약 효과가 크지만 처리 빈도가 증가합니다.
 *
 * ============================================================
 *  플러그인 커맨드
 * ============================================================
 *
 *  없음
 *
 * ============================================================
 *  주의사항
 * ============================================================
 *
 *  - Community_Basic 플러그인의 cacheLimit과 중복 적용될 수 있습니다.
 *    ImageCacheManager를 사용하는 경우 Community_Basic의 cacheLimit은
 *    무시되도록 본 플러그인을 Community_Basic보다 아래에 배치하세요.
 *
 *  - disabled 모드에서는 씬 전환 시 캐시가 초기화되지 않으므로
 *    imageCacheLimit를 적절히 설정하여 메모리를 관리하세요.
 */

/*:ko
 * @pluginname 이미지 캐시 관리자
 * @plugindesc 이미지 캐시를 제어합니다. 용량·정리 주기 조정 및 캐시 완전 비활성화(MZ 방식) 지원.
 * @author RPG Maker MV Editor
 *
 * @param cacheMode
 * @text 캐시 모드
 * @type select
 * @option normal — MV 기본 (씬 전환 시 자동 정리)
 * @value normal
 * @option aggressive — 주기적 강제 정리 (저사양·모바일 환경 권장)
 * @value aggressive
 * @option disabled — 브라우저 캐시 방식 (MV 만료 없음, imageCacheLimit 적용)
 * @value disabled
 * @desc 이미지 캐시 동작 방식을 선택합니다.
 * @default normal
 *
 * @param imageCacheLimit
 * @text 캐시 용량 상한 (메가픽셀)
 * @type number
 * @min 1
 * @desc 이미지 캐시 최대 용량 (메가픽셀). normal/aggressive 모드에서 적용됩니다.
 * @default 10
 *
 * @param cleanupInterval
 * @text 정리 주기 (초)
 * @type number
 * @min 5
 * @desc 강제 캐시 정리 실행 주기 (초). aggressive 모드에서만 적용됩니다.
 * @default 30
 *
 * @help
 * ============================================================
 *  이미지 캐시 관리자 (ImageCacheManager)
 *  Author: RPG Maker MV Editor
 *  Version: 1.0.0
 * ============================================================
 *
 * RPG Maker MV의 이미지 캐시 시스템을 조정하는 플러그인입니다.
 * 캐시 용량·정리 주기를 세밀하게 제어하거나, 캐시를 완전히
 * 비활성화하여 RPG Maker MZ와 유사한 동작을 구현할 수 있습니다.
 *
 * ============================================================
 *  MV의 이미지 캐시 구조
 * ============================================================
 *
 * MV는 두 겹의 캐시 레이어를 사용합니다.
 *
 *  ┌─ CacheMap ────────────────────────────────────────────┐
 *  │  SceneManager.updateManagers()가 매 프레임 호출하는    │
 *  │  TTL(Time-To-Live) 기반 캐시.                         │
 *  │  일정 시간 접근이 없으면 항목을 만료·제거합니다.       │
 *  └───────────────────────────────────────────────────────┘
 *  ┌─ ImageCache ──────────────────────────────────────────┐
 *  │  총 용량(MPix) 제한 기반 캐시.                        │
 *  │  초과 시 오래된 항목부터 제거합니다. (기본 10 MPix)   │
 *  └───────────────────────────────────────────────────────┘
 *
 * ============================================================
 *  캐시 모드 (cacheMode)
 * ============================================================
 *
 *  normal
 *    MV 기본 동작입니다.
 *    SceneManager가 씬 전환 시 CacheMap을 자동 정리하고,
 *    imageCacheLimit 파라미터로 용량 상한만 조정합니다.
 *    → 대부분의 게임에 권장되는 설정입니다.
 *
 *  aggressive
 *    cleanupInterval 간격으로 CacheMap TTL 만료 처리와
 *    ImageCache 용량 초과분 제거를 강제 실행합니다.
 *    → 메모리가 제한된 환경(저사양 PC, 모바일 등)에 적합합니다.
 *    → 에디터(SceneManager 스텁 환경)에서도 올바르게 동작합니다.
 *
 *  disabled
 *    MV의 캐시 만료 로직(씬 전환 시 clear, CacheMap TTL)을 비활성화합니다.
 *    한 번 로드한 이미지는 imageCacheLimit 이하인 한 씬 전환 후에도 유지됩니다.
 *    → 브라우저 HTTP 캐시처럼 동작합니다.
 *    → 씬 전환이 잦아도 이미지를 재로드하지 않습니다.
 *    → imageCacheLimit으로 메모리 상한을 제어하세요.
 *
 * ============================================================
 *  캐시 용량 (imageCacheLimit)
 * ============================================================
 *
 *  단위: 메가픽셀 (MPix), 기본값 10
 *  실제 메모리 소비 = imageCacheLimit × 4MB (RGBA 4바이트 기준)
 *
 *    10 MPix → 약 40MB
 *    20 MPix → 약 80MB
 *     5 MPix → 약 20MB
 *
 *  모든 모드에서 적용됩니다.
 *
 * ============================================================
 *  정리 주기 (cleanupInterval)
 * ============================================================
 *
 *  단위: 초, 기본값 30, 최솟값 5
 *  aggressive 모드에서만 적용됩니다.
 *  값을 낮출수록 메모리 절약 효과가 크지만 처리 빈도가 증가합니다.
 *
 * ============================================================
 *  플러그인 커맨드
 * ============================================================
 *
 *  없음
 *
 * ============================================================
 *  주의사항
 * ============================================================
 *
 *  - Community_Basic 플러그인의 cacheLimit과 중복 적용될 수 있습니다.
 *    ImageCacheManager를 사용하는 경우 Community_Basic의 cacheLimit은
 *    무시되도록 본 플러그인을 Community_Basic보다 아래에 배치하세요.
 *
 *  - disabled 모드에서는 씬 전환 시 캐시가 초기화되지 않으므로
 *    imageCacheLimit를 적절히 설정하여 메모리를 관리하세요.
 */

(function() {
    'use strict';

    // editor-runtime-bootstrap.js의 기본 캐시 cleanup이 중복 실행되지 않도록 플래그 설정
    window._imageCacheManagerActive = true;

    var parameters = PluginManager.parameters('ImageCacheManager');
    var cacheMode = (parameters['cacheMode'] || 'normal').toLowerCase().trim();
    var imageCacheLimit = Math.max(1, parseInt(parameters['imageCacheLimit']) || 10);
    var cleanupInterval = Math.max(5, parseInt(parameters['cleanupInterval']) || 30);

    // --- disabled 모드: MV 자체 캐시 만료를 끄고 브라우저 HTTP 캐시에 위임 ---
    // loadNormalBitmap은 수정하지 않음 (ImageCache 정상 사용, GPU 텍스처 재사용).
    // 씬 전환 시 ImageManager.clear()와 CacheMap TTL을 비활성화하여
    // 한 번 로드된 이미지가 씬 전환 후에도 캐시에 유지되도록 함.
    if (cacheMode === 'disabled') {
        // 씬 전환 시 캐시를 비우는 clear()를 무력화
        ImageManager.clear = function() { /* no-op */ };

        // CacheMap TTL 만료 비활성화
        if (ImageManager.cache && ImageManager.cache.update) {
            ImageManager.cache.update = function() { /* no-op */ };
        }

        // ImageCache limit은 파라미터로 제어
        if (typeof ImageCache !== 'undefined') {
            ImageCache.limit = imageCacheLimit * 1000 * 1000;
        }

        console.log('[ImageCacheManager] mode=disabled (browser-cache style, limit=' + imageCacheLimit + 'Mpx)');
        return; // 이하 normal/aggressive 처리 불필요
    }

    // --- normal / aggressive 공통: ImageCache limit 적용 ---
    // ImageCache.limit은 mpixel 단위 (기본 10 * 1000 * 1000)
    if (typeof ImageCache !== 'undefined') {
        ImageCache.limit = imageCacheLimit * 1000 * 1000;
    }

    // --- aggressive 모드: 주기적 강제 정리 ---
    if (cacheMode === 'aggressive') {
        var intervalMs = cleanupInterval * 1000;

        setInterval(function() {
            // CacheMap TTL 만료 처리 (SceneManager 스텁 환경에서도 동작하도록)
            if (ImageManager.cache && ImageManager.cache.update) {
                ImageManager.cache.update(1, 1);
            }
            // ImageCache 용량 초과분 제거
            if (ImageManager._imageCache && ImageManager._imageCache._truncateCache) {
                ImageManager._imageCache._truncateCache();
            }
        }, intervalMs);

        console.log('[ImageCacheManager] mode=aggressive, limit=' + imageCacheLimit + 'Mpx, interval=' + cleanupInterval + 's');
        return;
    }

    // normal 모드
    console.log('[ImageCacheManager] mode=normal, limit=' + imageCacheLimit + 'Mpx');
})();
