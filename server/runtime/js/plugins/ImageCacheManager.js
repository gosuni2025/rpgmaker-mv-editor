/*:
 * @plugindesc Manages the image cache system. Allows tuning cache size, cleanup interval, or disabling cache entirely (like RPG Maker MZ).
 * @author RPG Maker MV Editor
 *
 * @param cacheMode
 * @type select
 * @option normal
 * @option aggressive
 * @option disabled
 * @desc Cache mode. normal=MV default, aggressive=frequent cleanup, disabled=no cache (MZ-style)
 * @default normal
 *
 * @param imageCacheLimit
 * @type number
 * @min 1
 * @desc ImageCache size limit in megapixels. Applies in normal/aggressive mode. (default: 10)
 * @default 10
 *
 * @param cleanupInterval
 * @type number
 * @min 5
 * @desc Seconds between cache cleanup. Applies in aggressive mode only. (default: 30)
 * @default 30
 *
 * @help
 * == ImageCacheManager ==
 *
 * RPG Maker MV의 이미지 캐시 시스템을 조정합니다.
 *
 * [cacheMode]
 *   normal    - MV 기본 동작. SceneManager가 씬 전환 시 정리.
 *               imageCacheLimit으로 용량 조정 가능.
 *   aggressive - 주기적으로 강제 정리. 메모리가 적은 환경에 적합.
 *               imageCacheLimit + cleanupInterval 모두 적용.
 *   disabled  - 캐시 비활성화. 이미지를 캐시에 저장하지 않음.
 *               RPG Maker MZ와 유사한 동작. 메모리 사용 최소화.
 *               씬 전환이 잦은 경우 로딩 부하가 증가할 수 있음.
 *
 * [imageCacheLimit]
 *   이미지 캐시 최대 용량 (메가픽셀 단위, 기본값 10).
 *   픽셀 수 기준이므로 실제 메모리(RGBA 4바이트) = 값 * 4MB 정도.
 *
 * [cleanupInterval]
 *   aggressive 모드에서 캐시 정리를 실행하는 주기 (초).
 *
 * 플러그인 커맨드 없음.
 */

/*:ko
 * @plugindesc 이미지 캐시 관리자. 캐시 용량·정리 주기를 조정하거나 캐시를 완전히 끌 수 있습니다 (MZ 방식).
 * @author RPG Maker MV Editor
 *
 * @param cacheMode
 * @type select
 * @option normal
 * @option aggressive
 * @option disabled
 * @desc 캐시 모드. normal=MV 기본, aggressive=주기적 강제 정리, disabled=캐시 끄기 (MZ 방식)
 * @default normal
 *
 * @param imageCacheLimit
 * @type number
 * @min 1
 * @desc ImageCache 용량 상한 (메가픽셀). normal/aggressive 모드에서 적용. (기본값: 10)
 * @default 10
 *
 * @param cleanupInterval
 * @type number
 * @min 5
 * @desc 캐시 정리 주기 (초). aggressive 모드에서만 적용. (기본값: 30)
 * @default 30
 *
 * @help
 * == ImageCacheManager ==
 *
 * RPG Maker MV의 이미지 캐시 시스템을 조정합니다.
 *
 * [cacheMode]
 *   normal    - MV 기본 동작. SceneManager가 씬 전환 시 정리.
 *               imageCacheLimit으로 용량 조정 가능.
 *   aggressive - 주기적으로 강제 정리. 메모리가 적은 환경에 적합.
 *               imageCacheLimit + cleanupInterval 모두 적용.
 *   disabled  - 캐시 비활성화. 이미지를 캐시에 저장하지 않음.
 *               RPG Maker MZ와 유사한 동작. 메모리 사용 최소화.
 *               씬 전환이 잦은 경우 로딩 부하가 증가할 수 있음.
 *
 * [imageCacheLimit]
 *   이미지 캐시 최대 용량 (메가픽셀 단위, 기본값 10).
 *   픽셀 수 기준이므로 실제 메모리(RGBA 4바이트) = 값 * 4MB 정도.
 *
 * [cleanupInterval]
 *   aggressive 모드에서 캐시 정리를 실행하는 주기 (초).
 *
 * 플러그인 커맨드 없음.
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('ImageCacheManager');
    var cacheMode = (parameters['cacheMode'] || 'normal').toLowerCase().trim();
    var imageCacheLimit = Math.max(1, parseInt(parameters['imageCacheLimit']) || 10);
    var cleanupInterval = Math.max(5, parseInt(parameters['cleanupInterval']) || 30);

    // --- disabled 모드: loadNormalBitmap 오버라이드 ---
    // 캐시에서 꺼내지도, 저장하지도 않음. 항상 새 Bitmap 로드.
    if (cacheMode === 'disabled') {
        var _ImageManager_loadNormalBitmap = ImageManager.loadNormalBitmap;
        ImageManager.loadNormalBitmap = function(path, hue) {
            return Bitmap.load(path);
        };

        // 혹시 남아있는 기존 캐시도 즉시 비움
        if (ImageManager._imageCache) {
            ImageManager._imageCache._items = {};
        }

        console.log('[ImageCacheManager] mode=disabled (MZ-style, no image caching)');
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
