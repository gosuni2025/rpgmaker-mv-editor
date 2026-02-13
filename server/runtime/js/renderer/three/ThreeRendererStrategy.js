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

        // Assign render order for proper 2D layering
        if (node._threeObj) {
            // THREE.Mesh objects get renderOrder for depth-independent sorting
            if (node._threeObj.isMesh) {
                node._threeObj.renderOrder = rendererObj._drawOrderCounter++;
            }
            // For Groups, traverse their direct THREE children that are meshes
            // (e.g., internal meshes of ThreeGraphicsNode)
            if (node._threeObj.isGroup) {
                var threeChildren = node._threeObj.children;
                for (var t = 0; t < threeChildren.length; t++) {
                    if (threeChildren[t].isMesh && !threeChildren[t]._wrapper) {
                        // This is an internal mesh (not a wrapper child)
                        threeChildren[t].renderOrder = rendererObj._drawOrderCounter++;
                    }
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
            format: THREE.RGBAFormat,
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

        // Render to the render target (3D 2-pass or 2D single-pass)
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

            // Pass 1: PerspectiveCamera로 맵만 렌더
            var stageObj = stage._threeObj;
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
            renderer.autoClear = true;
            renderer.render(scene, Mode3D._perspCamera);

            // Pass 2: OrthographicCamera로 UI 합성
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

})();
