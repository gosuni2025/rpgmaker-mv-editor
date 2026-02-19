//=============================================================================
// ThreeRendererStrategy.js - Three.js backend for RendererStrategy
//=============================================================================
// Depends on:
//   - THREE (global, from js/libs/three.min.js)
//   - RendererStrategy (js/renderer/RendererStrategy.js)
//   - ThreeContainer (js/renderer/three/ThreeContainer.js)
//=============================================================================

(function() {

    /**
     * The Three.js renderer strategy backend.
     * Manages the WebGLRenderer, Scene, and OrthographicCamera.
     * Registered as 'threejs' with RendererStrategy.
     */
    var ThreeRendererStrategy = {};

    // -----------------------------------------------------------------------
    // Color Matrix post-processing (for ToneFilter)
    // -----------------------------------------------------------------------

    var _colorMatrixShader = null;
    var _colorMatrixScene = null;
    var _colorMatrixCamera = null;
    var _colorMatrixQuad = null;

    /**
     * Lazily creates the color matrix post-processing resources.
     * Uses a fullscreen quad with a custom ShaderMaterial that applies
     * a 4x5 color matrix transformation.
     */
    function _ensureColorMatrixPass(rendererObj) {
        if (_colorMatrixScene) return;

        // Fullscreen quad scene + orthographic camera
        _colorMatrixScene = new THREE.Scene();
        _colorMatrixCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        _colorMatrixShader = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                colorMatrix: { value: new Float32Array(20) }
            },
            vertexShader: [
                'varying vec2 vUv;',
                'void main() {',
                '    vUv = uv;',
                '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform sampler2D tDiffuse;',
                'uniform float colorMatrix[20];',
                'varying vec2 vUv;',
                'void main() {',
                '    vec4 c = texture2D(tDiffuse, vUv);',
                '    vec4 result;',
                '    result.r = colorMatrix[0]*c.r + colorMatrix[1]*c.g + colorMatrix[2]*c.b + colorMatrix[3]*c.a + colorMatrix[4];',
                '    result.g = colorMatrix[5]*c.r + colorMatrix[6]*c.g + colorMatrix[7]*c.b + colorMatrix[8]*c.a + colorMatrix[9];',
                '    result.b = colorMatrix[10]*c.r + colorMatrix[11]*c.g + colorMatrix[12]*c.b + colorMatrix[13]*c.a + colorMatrix[14];',
                '    result.a = colorMatrix[15]*c.r + colorMatrix[16]*c.g + colorMatrix[17]*c.b + colorMatrix[18]*c.a + colorMatrix[19];',
                '    gl_FragColor = result;',
                '}'
            ].join('\n'),
            depthTest: false,
            depthWrite: false
        });

        var geom = new THREE.PlaneGeometry(2, 2);
        _colorMatrixQuad = new THREE.Mesh(geom, _colorMatrixShader);
        _colorMatrixQuad.frustumCulled = false;
        _colorMatrixScene.add(_colorMatrixQuad);
    }

    /**
     * Identity color matrix for comparison.
     */
    var _identityMatrix = [
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 1, 0
    ];

    /**
     * Checks if a color matrix is identity (no-op).
     */
    function _isIdentityMatrix(m) {
        for (var i = 0; i < 20; i++) {
            if (Math.abs(m[i] - _identityMatrix[i]) > 0.001) return false;
        }
        return true;
    }

    /**
     * Finds the first active ColorMatrixFilter in the stage hierarchy.
     * Returns the matrix array or null if no filter or identity.
     */
    function _findColorMatrixFilter(node) {
        if (node._filters) {
            for (var i = 0; i < node._filters.length; i++) {
                var f = node._filters[i];
                if (f && f._matrix && f.enabled !== false) {
                    if (!_isIdentityMatrix(f._matrix)) {
                        return f._matrix;
                    }
                }
            }
        }
        var children = node.children;
        if (children) {
            for (var i = 0; i < children.length; i++) {
                var result = _findColorMatrixFilter(children[i]);
                if (result) return result;
            }
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Renderer creation
    // -----------------------------------------------------------------------

    /**
     * Creates a Three.js renderer compound object containing the WebGLRenderer,
     * Scene, and OrthographicCamera configured for 2D rendering with Y-down
     * screen coordinates.
     *
     * @param {Number} width - Viewport width in pixels
     * @param {Number} height - Viewport height in pixels
     * @param {Object} options - Configuration options
     * @param {HTMLCanvasElement} options.view - The canvas element to render to
     * @return {Object} Renderer compound object { renderer, scene, camera, _width, _height }
     */
    ThreeRendererStrategy.createRenderer = function(width, height, options) {
        options = options || {};

        // Create WebGL renderer
        var rendererOptions = {
            canvas: options.view || undefined,
            antialias: false,
            alpha: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        };

        var renderer = new THREE.WebGLRenderer(rendererOptions);
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);

        // Enable shadow map for real-time shadow casting
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;

        // Disable auto-sorting; we control render order via z-position
        renderer.sortObjects = true;

        // Create the root scene
        var scene = new THREE.Scene();

        // Create orthographic camera for 2D rendering
        // Coordinate system: left=0, right=width, top=0, bottom=height (Y-down)
        // near/far define Z clipping range for draw-order layering
        var camera = new THREE.OrthographicCamera(
            0,      // left
            width,  // right
            0,      // top (Y=0 at top of screen)
            height, // bottom (Y=height at bottom)
            -10000, // near
            10000   // far
        );

        // Position camera to look down at the scene
        camera.position.z = 100;

        // The compound renderer object
        var rendererObj = {
            renderer: renderer,
            scene: scene,
            camera: camera,
            _width: width,
            _height: height,

            // Reference to the canvas element
            view: renderer.domElement,

            // PIXI compat: gl context reference
            gl: renderer.getContext(),

            // PIXI compat: textureGC stub
            textureGC: {
                maxIdle: 3600,
                run: function() {}
            },

            // PIXI compat: plugins stub (tileAnim used by ShaderTilemap._hackRenderer)
            plugins: {
                tilemap: {
                    tileAnim: [0, 0]
                }
            },

            // Draw order counter (incremented per-object per frame)
            _drawOrderCounter: 0
        };

        return rendererObj;
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    /**
     * Renders the stage hierarchy into the Three.js scene.
     *
     * This method traverses the wrapper hierarchy (ThreeContainer/ThreeSprite
     * tree), syncs their transforms to the underlying Three.js objects, then
     * calls renderer.render().
     *
     * @param {Object} rendererObj - The compound renderer object
     * @param {ThreeContainer} stage - The root stage container
     */
    ThreeRendererStrategy.render = function(rendererObj, stage) {
        if (!rendererObj || !stage) return;

        var scene = rendererObj.scene;
        var renderer = rendererObj.renderer;
        var camera = rendererObj.camera;

        // Reset draw order counter
        rendererObj._drawOrderCounter = 0;

        // Ensure the stage's Three.js object is in the scene
        if (stage._threeObj && stage._threeObj.parent !== scene) {
            // 기존 stage만 제거 (라이트 등 다른 children 보존)
            if (scene._stageObj) {
                scene.remove(scene._stageObj);
            }
            scene.add(stage._threeObj);
            scene._stageObj = stage._threeObj;
        }

        // Call updateTransform on the stage hierarchy first.
        // This triggers custom updateTransform overrides (e.g., Tilemap
        // paints tiles and updates scroll positions in its updateTransform).
        if (stage.updateTransform) {
            stage.updateTransform();
        }

        // Traverse the wrapper hierarchy for render order and bitmap updates
        this._syncHierarchy(rendererObj, stage);

        // Render
        renderer.render(scene, camera);
    };

    /**
     * Recursively syncs the wrapper hierarchy transforms and updates
     * draw order (render order) for proper 2D layering.
     *
     * @param {Object} rendererObj
     * @param {ThreeContainer|ThreeSprite|*} node
     * @param {Number} [parentAlpha=1]
     * @private
     */
    ThreeRendererStrategy._syncHierarchy = function(rendererObj, node, parentAlpha) {
        if (parentAlpha === undefined) parentAlpha = 1;

        // Compute world alpha
        var alpha = (node._alpha !== undefined ? node._alpha : (node.alpha !== undefined ? node.alpha : 1));
        var worldAlpha = alpha * parentAlpha;
        node.worldAlpha = worldAlpha;

        // Flush dirty bitmap canvases to their Three.js textures.
        // In PIXI mode this happens in _renderWebGL; in Three.js mode we do it here.
        if (node._bitmap) {
            if (node._bitmap.touch) {
                node._bitmap.touch();
            }
            if (node._bitmap.checkDirty) {
                // checkDirty calls _baseTexture.update() which increments PIXI's _updateID
                // but does NOT set Three.js texture needsUpdate. We must do it manually.
                var wasDirty = node._bitmap._dirty;
                node._bitmap.checkDirty();
                if (wasDirty && node._bitmap._baseTexture && node._bitmap._baseTexture._threeTexture) {
                    node._bitmap._baseTexture._threeTexture.needsUpdate = true;
                }
            }
        }

        // Check for texture updates (e.g., bitmap loaded, frame changed)
        if (node._texture && node._updateTexture && node._texture._updateID !== node._textureUpdateID) {
            node._updateTexture();
        }

        // Sync this node's transform
        if (node.syncTransform) {
            node.syncTransform();
        }

        // Assign render order and position.z for proper layering
        var _is3DMode = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d;
        if (node._threeObj) {
            // 3D 모드: PIXI .z 값을 position.z로 변환 (depth buffer 기반 깊이 판별)
            //   - position.z = -pixiZ * 0.01 (음수 = 카메라에 가까움)
            //   - renderOrder는 동일 z 레이어 내 코플래너 스태킹에 보조 사용
            if (_is3DMode) {
                var pixiZ = node.z || 0;
                var zStep = (window.DepthDebugConfig && window.DepthDebugConfig.zLayerStep) || -0.01;
                node._threeObj.position.z = pixiZ * zStep;
            }
            // THREE.Mesh objects get renderOrder for depth-independent sorting
            if (node._threeObj.isMesh) {
                // 오브젝트 물 메시는 container보다 먼저 렌더링 (물 → 일반 타일 순서)
                var meshChildren = node._threeObj.children;
                if (meshChildren) {
                    for (var t = 0; t < meshChildren.length; t++) {
                        if (meshChildren[t].isMesh && meshChildren[t].userData && meshChildren[t].userData.isObjectWater) {
                            meshChildren[t].renderOrder = rendererObj._drawOrderCounter++;
                        }
                    }
                }
                node._threeObj.renderOrder = rendererObj._drawOrderCounter++;
            }
            // For Groups, traverse their direct THREE children that are meshes
            // (e.g., internal meshes of ThreeGraphicsNode)
            // Water meshes render before normal meshes so decoration tiles overlay correctly
            if (node._threeObj.isGroup) {
                var threeChildren = node._threeObj.children;
                // 물 메시를 먼저, 일반 메시를 나중에 renderOrder 할당
                for (var t = 0; t < threeChildren.length; t++) {
                    if (threeChildren[t].isMesh && !threeChildren[t]._wrapper && threeChildren[t].userData && threeChildren[t].userData.isWaterMesh) {
                        threeChildren[t].renderOrder = rendererObj._drawOrderCounter++;
                    }
                }
                // 일반 메시: drawZ(maxDrawZ) 기준 정렬 후 renderOrder 할당
                // 낮은 drawZ가 먼저 렌더링되어 높은 drawZ가 위에 그려짐
                var normalMeshes = [];
                for (var t = 0; t < threeChildren.length; t++) {
                    if (threeChildren[t].isMesh && !threeChildren[t]._wrapper &&
                        !(threeChildren[t].userData && threeChildren[t].userData.isWaterMesh)) {
                        normalMeshes.push(threeChildren[t]);
                    }
                }
                normalMeshes.sort(function(a, b) {
                    return (a.userData.maxDrawZ || 0) - (b.userData.maxDrawZ || 0);
                });
                for (var t = 0; t < normalMeshes.length; t++) {
                    normalMeshes[t].renderOrder = rendererObj._drawOrderCounter++;
                }
            }
        }

        // Recurse into wrapper children
        var children = node.children;
        if (children) {
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                if (child._visible !== false && child.visible !== false) {
                    this._syncHierarchy(rendererObj, child, worldAlpha);
                } else if (child._threeObj) {
                    child._threeObj.visible = false;
                }
            }
        }
    };

    // -----------------------------------------------------------------------
    // Resize
    // -----------------------------------------------------------------------

    /**
     * Resizes the renderer and updates the camera projection.
     *
     * @param {Object} rendererObj - The compound renderer object
     * @param {Number} width - New width
     * @param {Number} height - New height
     */
    ThreeRendererStrategy.resize = function(rendererObj, width, height) {
        if (!rendererObj) return;

        rendererObj._width = width;
        rendererObj._height = height;

        // Resize the WebGL renderer
        rendererObj.renderer.setSize(width, height);

        // Update orthographic camera bounds
        var camera = rendererObj.camera;
        camera.left = 0;
        camera.right = width;
        camera.top = 0;
        camera.bottom = height;
        camera.updateProjectionMatrix();

        // Invalidate color matrix render target so it gets recreated at new size
        if (rendererObj._colorMatrixRT) {
            rendererObj._colorMatrixRT.dispose();
            rendererObj._colorMatrixRT = null;
        }
    };

    // -----------------------------------------------------------------------
    // Utility methods
    // -----------------------------------------------------------------------

    /**
     * Returns true since Three.js always uses WebGL.
     * @param {Object} rendererObj
     * @return {Boolean}
     */
    ThreeRendererStrategy.isWebGL = function(rendererObj) {
        return true;
    };

    /**
     * Garbage collection call. Three.js manages its own resources,
     * so this is largely a no-op. Can dispose unused textures if needed.
     *
     * @param {Object} rendererObj
     */
    ThreeRendererStrategy.callGC = function(rendererObj) {
        // Three.js does not have an equivalent GC mechanism like PIXI.
        // Texture disposal should be done explicitly when bitmaps are freed.
        // This is a no-op for now.
    };

    /**
     * Gets the WebGL rendering context.
     * @param {Object} rendererObj
     * @return {WebGLRenderingContext|null}
     */
    ThreeRendererStrategy.getGL = function(rendererObj) {
        if (rendererObj && rendererObj.renderer) {
            return rendererObj.renderer.getContext();
        }
        return null;
    };

    /**
     * Renders the current stage to a canvas element for snapshot purposes
     * (e.g., Bitmap.snap). Renders to a WebGLRenderTarget, reads back pixels,
     * and draws them onto a 2D canvas.
     *
     * @param {Object} rendererObj - The compound renderer object
     * @param {ThreeContainer} stage - The root stage
     * @param {Number} width - Output width
     * @param {Number} height - Output height
     * @return {HTMLCanvasElement} A canvas with the rendered image
     */
    ThreeRendererStrategy.renderToCanvas = function(rendererObj, stage, width, height) {
        if (!rendererObj) return null;

        var renderer = rendererObj.renderer;
        var scene = rendererObj.scene;
        var camera = rendererObj.camera;

        // Create a render target
        var renderTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            depthBuffer: false,
            stencilBuffer: false
        });

        // Sync the hierarchy before rendering
        if (stage) {
            rendererObj._drawOrderCounter = 0;
            if (stage._threeObj && stage._threeObj.parent !== scene) {
                if (scene._stageObj) {
                    scene.remove(scene._stageObj);
                }
                scene.add(stage._threeObj);
                scene._stageObj = stage._threeObj;
            }
            if (stage.updateTransform) {
                stage.updateTransform();
            }
            this._syncHierarchy(rendererObj, stage);
        }

        // Render to the render target (3D 3-pass or 2D single-pass)
        renderer.setRenderTarget(renderTarget);
        var is3D = typeof ConfigManager !== 'undefined' && ConfigManager.mode3d &&
            typeof Mode3D !== 'undefined' && Mode3D._spriteset && Mode3D._perspCamera;
        if (is3D) {
            Mode3D._positionCamera(Mode3D._perspCamera, width, height);
            Mode3D._applyBillboards();

            // Shadow Map: multi-pass에서 Pass 2(UI)가 shadow map을 비우지 않도록
            var prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
            renderer.shadowMap.autoUpdate = false;
            renderer.shadowMap.needsUpdate = true;

            // Find parallax sky mesh in scene
            var skyMesh = null;
            var stageObj = stage._threeObj;
            for (var si = 0; si < scene.children.length; si++) {
                if (scene.children[si]._isParallaxSky) {
                    skyMesh = scene.children[si];
                    break;
                }
            }

            // --- Pass 0: Sky background (PerspectiveCamera) ---
            if (skyMesh) {
                if (stageObj) stageObj.visible = false;
                skyMesh.visible = true;
                renderer.autoClear = true;
                renderer.render(scene, Mode3D._perspCamera);
                skyMesh.visible = false;
                if (stageObj) stageObj.visible = true;
            }

            // --- Pass 1: PerspectiveCamera로 맵만 렌더 ---
            var childVis = [];
            if (stageObj) {
                for (var ci = 0; ci < stageObj.children.length; ci++) {
                    childVis.push(stageObj.children[ci].visible);
                }
                var spritesetObj = Mode3D._spriteset._threeObj;
                for (var ci = 0; ci < stageObj.children.length; ci++) {
                    stageObj.children[ci].visible = (stageObj.children[ci] === spritesetObj);
                }
            }
            renderer.autoClear = !skyMesh;  // sky를 그렸으면 clear 안 함
            renderer.render(scene, Mode3D._perspCamera);

            // --- Pass 2: OrthographicCamera로 UI 합성 ---
            if (stageObj) {
                for (var ci = 0; ci < stageObj.children.length; ci++) {
                    var child = stageObj.children[ci];
                    child.visible = childVis[ci];
                    if (child === spritesetObj) child.visible = false;
                }
            }
            renderer.autoClear = false;
            renderer.render(scene, camera);

            // 가시성 복원
            if (stageObj) {
                for (var ci = 0; ci < stageObj.children.length; ci++) {
                    stageObj.children[ci].visible = childVis[ci];
                }
            }
            renderer.autoClear = true;
            renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;
        } else {
            renderer.render(scene, camera);
        }
        renderer.setRenderTarget(null);

        // Read pixels from the render target
        var pixels = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

        // Create output canvas
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var context = canvas.getContext('2d');
        var imageData = context.createImageData(width, height);

        // WebGL reads pixels bottom-to-top, so we need to flip Y
        for (var y = 0; y < height; y++) {
            var srcRow = (height - 1 - y) * width * 4;
            var dstRow = y * width * 4;
            for (var x = 0; x < width * 4; x++) {
                imageData.data[dstRow + x] = pixels[srcRow + x];
            }
        }

        context.putImageData(imageData, 0, 0);

        // Clean up
        renderTarget.dispose();

        return canvas;
    };

    /**
     * Returns the display mode text for the FPS/mode overlay.
     * @param {Object} rendererObj
     * @return {String}
     */
    ThreeRendererStrategy.getModeText = function(rendererObj) {
        return 'Three.js mode';
    };

    // -----------------------------------------------------------------------
    // Register with RendererStrategy
    // -----------------------------------------------------------------------

    RendererStrategy.register('threejs', ThreeRendererStrategy);

    // -----------------------------------------------------------------------
    // Color Matrix post-processing wrapper for RendererStrategy.render
    // Applied AFTER any backend-specific render (including Mode3D multi-pass
    // and PostProcess composer). Intercepts setRenderTarget(null) to redirect
    // final output to an offscreen buffer, then applies color matrix shader.
    // -----------------------------------------------------------------------

    var _origRSRender = RendererStrategy.render;
    RendererStrategy.render = function(rendererObj, stage) {
        if (!rendererObj || !stage || !rendererObj.renderer) {
            _origRSRender.call(this, rendererObj, stage);
            return;
        }

        // Check for color matrix filters (ToneFilter / Tint Screen)
        var colorMatrix = _findColorMatrixFilter(stage);

        if (colorMatrix) {
            _ensureColorMatrixPass(rendererObj);

            var w = rendererObj._width;
            var h = rendererObj._height;
            var renderer = rendererObj.renderer;

            // Create or reuse render target
            if (!rendererObj._colorMatrixRT ||
                rendererObj._colorMatrixRT.width !== w ||
                rendererObj._colorMatrixRT.height !== h) {
                if (rendererObj._colorMatrixRT) rendererObj._colorMatrixRT.dispose();
                rendererObj._colorMatrixRT = new THREE.WebGLRenderTarget(w, h, {
                    minFilter: THREE.LinearFilter,
                    magFilter: THREE.LinearFilter
                });
            }

            // Intercept setRenderTarget(null) so that the final output goes
            // to our offscreen buffer instead of the screen. This works with
            // PostProcess/Mode3D which internally call setRenderTarget(null)
            // for the final compositing pass.
            var rt = rendererObj._colorMatrixRT;
            var origSetRT = renderer.setRenderTarget.bind(renderer);
            renderer.setRenderTarget = function(target) {
                origSetRT(target === null ? rt : target);
            };

            // Call original render (may include Mode3D + PostProcess)
            _origRSRender.call(this, rendererObj, stage);

            // Restore original setRenderTarget
            renderer.setRenderTarget = origSetRT;

            // Apply color matrix post-processing to screen
            renderer.setRenderTarget(null);
            _colorMatrixShader.uniforms.tDiffuse.value = rt.texture;
            _colorMatrixShader.uniforms.colorMatrix.value.set(colorMatrix);
            renderer.render(_colorMatrixScene, _colorMatrixCamera);
        } else {
            _origRSRender.call(this, rendererObj, stage);
        }
    };

})();
