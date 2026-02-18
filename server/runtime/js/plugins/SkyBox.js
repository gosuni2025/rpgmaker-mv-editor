/*:
 * @pluginname 스카이박스
 * @plugindesc Three.js SkySphere - 3D 모드에서 파노라마 하늘 배경 표시
 * @author Claude
 *
 * @param Skybox Folder
 * @type dir
 * @dir img/
 * @desc 스카이 이미지 폴더 (img/ 하위)
 * @default skybox
 *
 * @param Panorama File
 * @type file
 * @dir img/skybox/
 * @desc equirectangular 파노라마 파일명 (기본 폴백)
 * @default sky_panorama
 *
 * @help
 * 3D 모드(Mode3D) 활성 시 카메라 위치에 스카이 돔을 배치하여
 * 파노라마 하늘 배경을 표시합니다.
 *
 * $dataMap.skyBackground 확장 데이터를 지원합니다:
 *   { type: 'skysphere', skyImage: 'filename.png', rotationSpeed: 0.02 }
 *   - type이 'skysphere'이면 sky dome 활성화
 *   - type이 'parallax'이거나 없으면 sky dome 비활성화 (MV 기본 parallax 사용)
 *
 * Skybox images: "Cloudy Skyboxes" by Screaming Brain Studios
 * https://screamingbrainstudios.itch.io/cloudy-skyboxes-pack
 * License: CC0 (Public Domain)
 */

(function() {

    // Three.js / Mode3D가 없는 환경에서는 실행하지 않음
    if (typeof THREE === 'undefined' || typeof Mode3D === 'undefined') return;

    var parameters = PluginManager.parameters('SkyBox');
    var skyboxFolder = String(parameters['Skybox Folder'] || 'skybox');
    var defaultPanoramaFile = String(parameters['Panorama File'] || 'sky_panorama.png');

    var _skyMesh = null;
    var _skyReady = false;
    var _applied = false;
    var _rotationSpeed = 0.02; // deg/frame
    var _currentImage = '';     // 현재 로드된 이미지 파일명
    var _skyEnabled = true;    // skysphere 모드 활성 여부

    function getTexturePath(filename) {
        return 'img/' + skyboxFolder + '/' + filename;
    }

    function loadAndApply(imageFile) {
        var texPath = getTexturePath(imageFile || defaultPanoramaFile);

        // 같은 이미지가 이미 로드되어 있으면 스킵
        if (_skyMesh && _currentImage === (imageFile || defaultPanoramaFile)) {
            return;
        }

        // 기존 메시 정리
        cleanupMesh();

        var loader = new THREE.TextureLoader();
        loader.load(texPath, function(texture) {
            texture.colorSpace = THREE.SRGBColorSpace;

            texture.flipY = false;

            var geometry = new THREE.SphereGeometry(800, 60, 40);
            var material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            _skyMesh = new THREE.Mesh(geometry, material);
            _skyMesh.rotation.x = Math.PI / 2;
            _skyMesh._isParallaxSky = true;
            _skyMesh.renderOrder = -1;
            _skyMesh.frustumCulled = false;
            _skyMesh.visible = _skyEnabled;

            _skyReady = true;
            _applied = false;
            _currentImage = imageFile || defaultPanoramaFile;
            addToScene();
        }, null, function(error) {
            console.error('[SkyBox] 텍스처 로드 실패:', error);
        });
    }

    function cleanupMesh() {
        if (_skyMesh) {
            if (_skyMesh.parent) _skyMesh.parent.remove(_skyMesh);
            _skyMesh.geometry.dispose();
            if (_skyMesh.material.map) _skyMesh.material.map.dispose();
            _skyMesh.material.dispose();
        }
        _skyMesh = null;
        _skyReady = false;
        _applied = false;
        _currentImage = '';
    }

    function getRendererObj() {
        return Graphics._renderer || window._editorRendererObj || null;
    }

    function addToScene() {
        if (!_skyReady || _applied) return;
        var rendererObj = getRendererObj();
        if (!rendererObj || !rendererObj.scene) return;

        rendererObj.scene.add(_skyMesh);
        _applied = true;
    }

    function updateSkyPosition() {
        if (!_skyMesh || !Mode3D._perspCamera) return;
        _skyMesh.position.copy(Mode3D._perspCamera.position);
        if (_rotationSpeed !== 0) {
            _skyMesh.rotation.y += _rotationSpeed * Math.PI / 180;
        }
    }

    // skyBackground 설정 적용 (에디터에서 호출)
    function applySettings(skyBg) {
        if (!skyBg || skyBg.type !== 'skysphere') {
            // parallax 모드 또는 설정 없음 → sky sphere 숨기기
            _skyEnabled = false;
            if (_skyMesh) {
                _skyMesh.visible = false;
            }
            // parallax sky plane 복원 활성화
            restoreParallaxSky();
            return;
        }

        // skysphere 모드
        _skyEnabled = true;
        _rotationSpeed = skyBg.rotationSpeed != null ? skyBg.rotationSpeed : 0.02;

        if (skyBg.skyImage) {
            loadAndApply(skyBg.skyImage);
        } else {
            loadAndApply(defaultPanoramaFile);
        }

        if (_skyMesh) {
            _skyMesh.visible = true;
        }

        // parallax sky plane 제거
        suppressParallaxSky();
    }

    function suppressParallaxSky() {
        var rendererObj = getRendererObj();
        if (!rendererObj || !rendererObj.scene) return;
        rendererObj.scene.traverse(function(obj) {
            if (obj._isParallaxSky && obj !== _skyMesh) {
                obj.visible = false;
            }
        });
    }

    function restoreParallaxSky() {
        // _parallaxSkyMesh는 3D Pass 0에서 visible을 제어하므로
        // 여기서는 건드리지 않음 (visible=true로 만들면 2D 카메라에 렌더됨)
    }

    // $dataMap에서 skyBackground 읽어 자동 적용
    function readMapSettings() {
        if (typeof $dataMap !== 'undefined' && $dataMap && $dataMap.skyBackground) {
            applySettings($dataMap.skyBackground);
        } else if (typeof $dataMap !== 'undefined' && $dataMap && $dataMap.parallaxName) {
            // skyBackground 없지만 parallaxName 있으면 parallax 모드 사용
            applySettings(null);
        } else {
            // skyBackground도 parallax도 없으면 기본 sky sphere
            applySettings({ type: 'skysphere', skyImage: defaultPanoramaFile, rotationSpeed: 0.02 });
        }
    }

    // 기존 패럴랙스 하늘 차단 (skysphere 모드일 때만)
    var _origUpdateParallaxSkyPlane = Spriteset_Map.prototype._updateParallaxSkyPlane;
    Spriteset_Map.prototype._updateParallaxSkyPlane = function() {
        if (_skyEnabled) {
            // sky sphere 모드: parallax sky plane 제거
            var rendererObj = getRendererObj();
            if (rendererObj && rendererObj.scene && this._parallaxSkyMesh) {
                rendererObj.scene.remove(this._parallaxSkyMesh);
                this._parallaxSkyMesh.geometry.dispose();
                this._parallaxSkyMesh.material.dispose();
                this._parallaxSkyMesh = null;
            }
        } else if (_origUpdateParallaxSkyPlane) {
            // parallax 모드: 원래 동작 수행
            _origUpdateParallaxSkyPlane.call(this);
        }
    };

    var _Spriteset_Map_initialize = Spriteset_Map.prototype.initialize;
    Spriteset_Map.prototype.initialize = function() {
        _Spriteset_Map_initialize.call(this);
        _applied = false;
        readMapSettings();
    };

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        if (_skyEnabled) {
            if (!_applied) addToScene();
            // 2D 모드에서는 sky mesh 숨김 (orthographic 카메라에 렌더되는 것 방지)
            if (_skyMesh) {
                _skyMesh.visible = !!(ConfigManager.mode3d);
            }
            if (ConfigManager.mode3d) {
                updateSkyPosition();
            }
        }
    };

    //=========================================================================
    // 휠 클릭+드래그: 카메라 tilt/yaw 회전 (개발/테스트용)
    //=========================================================================
    var _orbiting = false;
    var _orbitStartX = 0;
    var _orbitStartY = 0;
    var _orbitStartTilt = 0;
    var _orbitStartYaw = 0;

    document.addEventListener('mousedown', function(e) {
        if (e.button !== 1) return;
        if (!ConfigManager.mode3d) return;
        e.preventDefault();
        _orbiting = true;
        _orbitStartX = e.clientX;
        _orbitStartY = e.clientY;
        _orbitStartTilt = Mode3D._tiltDeg || 60;
        _orbitStartYaw = Mode3D._yawDeg || 0;
    });

    document.addEventListener('mousemove', function(e) {
        if (!_orbiting) return;
        var dx = e.clientX - _orbitStartX;
        var dy = e.clientY - _orbitStartY;
        var newTilt = Math.max(20, Math.min(85, _orbitStartTilt + dy * 0.3));
        Mode3D._tiltDeg = newTilt;
        Mode3D._tiltRad = newTilt * Math.PI / 180;
        var newYaw = _orbitStartYaw - dx * 0.3;
        Mode3D._yawDeg = newYaw;
        Mode3D._yawRad = newYaw * Math.PI / 180;
    });

    document.addEventListener('mouseup', function(e) {
        if (e.button === 1) _orbiting = false;
    });

    // 에디터 인터페이스
    window._skyBoxGetRotationSpeed = function() { return _rotationSpeed; };
    window._skyBoxSetRotationSpeed = function(speed) { _rotationSpeed = speed; };
    window._skyBoxApplySettings = applySettings;

    window._skyBoxCleanup = function() {
        cleanupMesh();
    };

})();
