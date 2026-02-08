//=============================================================================
// ThreeRendererFactory.js - Three.js backend for RendererFactory
//=============================================================================
// Depends on:
//   - THREE (global, from js/libs/three.min.js)
//   - RendererFactory (js/renderer/RendererFactory.js)
//   - ThreeContainer (js/renderer/three/ThreeContainer.js)
//   - ThreeSprite (js/renderer/three/ThreeSprite.js)
//   - ThreeGraphicsNode (js/renderer/three/ThreeGraphicsNode.js)
//   - ThreeTilemapLayer (js/renderer/three/ThreeTilemap.js)
//   - ThreeVoidFilter, ThreeColorMatrixFilter (js/renderer/three/ThreeFilters.js)
//=============================================================================

(function() {

    /**
     * The Three.js renderer factory backend.
     * Registered as 'threejs' with RendererFactory.
     */
    var ThreeRendererFactory = {};

    // -----------------------------------------------------------------------
    // Scale modes (PIXI-compatible constants)
    // -----------------------------------------------------------------------

    ThreeRendererFactory.SCALE_MODES = {
        LINEAR:  THREE.LinearFilter,
        NEAREST: THREE.NearestFilter,
        linear:  THREE.LinearFilter,
        nearest: THREE.NearestFilter
    };

    // -----------------------------------------------------------------------
    // Container creation
    // -----------------------------------------------------------------------

    /**
     * Creates a new container (PIXI.Container equivalent).
     * @return {ThreeContainer}
     */
    ThreeRendererFactory.createContainer = function() {
        return new ThreeContainer();
    };

    // -----------------------------------------------------------------------
    // Sprite creation
    // -----------------------------------------------------------------------

    /**
     * Creates a new sprite (PIXI.Sprite equivalent).
     * @param {Object} [texture] - Texture object with baseTexture and frame
     * @return {ThreeSprite}
     */
    ThreeRendererFactory.createSprite = function(texture) {
        return new ThreeSprite(texture);
    };

    // -----------------------------------------------------------------------
    // Base texture creation
    // -----------------------------------------------------------------------

    /**
     * Creates a base texture from a canvas or image source.
     * Returns a THREE.Texture configured for 2D pixel rendering.
     *
     * The returned texture has PIXI-compatible properties:
     *   - scaleMode (maps to minFilter/magFilter)
     *   - width, height
     *   - update() method
     *   - mipmap property
     *   - _threeTexture (reference to itself, for wrapper compat)
     *
     * @param {HTMLCanvasElement|HTMLImageElement} source
     * @return {THREE.Texture} Enhanced Three.js texture
     */
    ThreeRendererFactory.createBaseTexture = function(source) {
        var texture;

        if (source instanceof HTMLCanvasElement) {
            texture = new THREE.CanvasTexture(source);
        } else if (source instanceof HTMLImageElement) {
            texture = new THREE.Texture(source);
            texture.needsUpdate = true;
        } else {
            // Fallback: try to use as-is
            texture = new THREE.Texture(source);
            texture.needsUpdate = true;
        }

        // Disable mipmaps for pixel-perfect 2D rendering
        texture.generateMipmaps = false;
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;

        // Prevent texture wrapping artifacts
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // Flip Y to match canvas coordinate system (top-left origin)
        // THREE.js textures are flipped by default for WebGL;
        // CanvasTexture sets flipY=true already. For regular Texture,
        // we keep the default (flipY=true) which matches canvas orientation.

        // Store dimensions (PIXI compat)
        texture.width = source.width || 0;
        texture.height = source.height || 0;

        // Self-reference for the wrapper layer
        texture._threeTexture = texture;

        // PIXI compat: scaleMode property
        Object.defineProperty(texture, 'scaleMode', {
            get: function() {
                return this.magFilter === THREE.LinearFilter ?
                    ThreeRendererFactory.SCALE_MODES.LINEAR :
                    ThreeRendererFactory.SCALE_MODES.NEAREST;
            },
            set: function(mode) {
                if (mode === ThreeRendererFactory.SCALE_MODES.LINEAR ||
                    mode === THREE.LinearFilter) {
                    this.minFilter = THREE.LinearFilter;
                    this.magFilter = THREE.LinearFilter;
                } else {
                    this.minFilter = THREE.NearestFilter;
                    this.magFilter = THREE.NearestFilter;
                }
                this.needsUpdate = true;
            },
            configurable: true
        });

        // PIXI compat: mipmap property
        Object.defineProperty(texture, 'mipmap', {
            get: function() {
                return this.generateMipmaps;
            },
            set: function(value) {
                this.generateMipmaps = value;
            },
            configurable: true
        });

        // PIXI compat: update method (forces texture re-upload)
        var originalUpdate = texture.update;
        texture.update = function() {
            // Update dimensions from source
            if (this.image) {
                this.width = this.image.width || 0;
                this.height = this.image.height || 0;
            }
            this.needsUpdate = true;
        };

        // PIXI compat: hasLoaded flag
        texture.hasLoaded = true;

        // PIXI compat: resolution
        texture.resolution = 1;

        return texture;
    };

    // -----------------------------------------------------------------------
    // Texture (frame reference) creation
    // -----------------------------------------------------------------------

    /**
     * Creates a lightweight texture reference (PIXI.Texture equivalent).
     * This is NOT a Three.js texture; it is a wrapper that references a
     * base texture and defines a frame (sub-rectangle).
     *
     * @param {THREE.Texture} baseTexture - The base texture (from createBaseTexture)
     * @return {Object} Texture wrapper { baseTexture, frame, _updateID, orig, trim }
     */
    ThreeRendererFactory.createTexture = function(baseTexture) {
        var texture = {
            baseTexture: baseTexture,
            frame: {
                x: 0,
                y: 0,
                width: baseTexture ? (baseTexture.width || 0) : 0,
                height: baseTexture ? (baseTexture.height || 0) : 0
            },
            orig: {
                x: 0,
                y: 0,
                width: baseTexture ? (baseTexture.width || 0) : 0,
                height: baseTexture ? (baseTexture.height || 0) : 0
            },
            trim: null,
            _updateID: 0,
            noFrame: true,
            valid: !!(baseTexture && baseTexture.width > 0 && baseTexture.height > 0),

            // PIXI compat: update tracking
            requiresUpdate: false,

            // Method to update the frame and increment _updateID
            _updateUvs: function() {
                this._updateID++;
            },

            // PIXI compat: clone
            clone: function() {
                var cloned = ThreeRendererFactory.createTexture(this.baseTexture);
                cloned.frame = {
                    x: this.frame.x,
                    y: this.frame.y,
                    width: this.frame.width,
                    height: this.frame.height
                };
                cloned._updateID = 0;
                return cloned;
            },

            // PIXI compat: destroy
            destroy: function(destroyBase) {
                if (destroyBase && this.baseTexture) {
                    this.baseTexture.dispose();
                }
                this.baseTexture = null;
            },

            // PIXI compat: update
            update: function() {
                if (this.baseTexture) {
                    this.frame.width = this.baseTexture.width || 0;
                    this.frame.height = this.baseTexture.height || 0;
                }
                this._updateID++;
            }
        };

        return texture;
    };

    // -----------------------------------------------------------------------
    // Render texture creation (for Bitmap.snap and similar)
    // -----------------------------------------------------------------------

    /**
     * Creates a render texture that can capture rendered output.
     * Uses an offscreen canvas approach for simplicity.
     *
     * @param {Number} width
     * @param {Number} height
     * @return {Object} Render texture wrapper
     */
    ThreeRendererFactory.createRenderTexture = function(width, height) {
        // Create an offscreen canvas to serve as the render target
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(width || 1, 1);
        canvas.height = Math.max(height || 1, 1);
        var context = canvas.getContext('2d');

        var baseTexture = ThreeRendererFactory.createBaseTexture(canvas);

        var renderTexture = {
            baseTexture: baseTexture,
            frame: { x: 0, y: 0, width: canvas.width, height: canvas.height },
            _updateID: 0,
            width: canvas.width,
            height: canvas.height,

            // The underlying canvas for direct pixel manipulation
            _canvas: canvas,
            _context: context,

            // Three.js WebGLRenderTarget for GPU-side rendering
            _renderTarget: null,

            // PIXI compat: resize
            resize: function(w, h) {
                this.width = w;
                this.height = h;
                this._canvas.width = w;
                this._canvas.height = h;
                this.frame.width = w;
                this.frame.height = h;
                this.baseTexture.width = w;
                this.baseTexture.height = h;
                this._updateID++;

                if (this._renderTarget) {
                    this._renderTarget.setSize(w, h);
                }
            },

            // PIXI compat: destroy
            destroy: function(destroyBase) {
                if (destroyBase && this.baseTexture) {
                    this.baseTexture.dispose();
                }
                if (this._renderTarget) {
                    this._renderTarget.dispose();
                }
                this._canvas = null;
                this._context = null;
            },

            // Ensure a WebGLRenderTarget exists (lazy creation)
            _ensureRenderTarget: function() {
                if (!this._renderTarget) {
                    this._renderTarget = new THREE.WebGLRenderTarget(
                        this.width, this.height, {
                            minFilter: THREE.NearestFilter,
                            magFilter: THREE.NearestFilter,
                            format: THREE.RGBAFormat,
                            depthBuffer: false,
                            stencilBuffer: false
                        }
                    );
                }
                return this._renderTarget;
            }
        };

        return renderTexture;
    };

    // -----------------------------------------------------------------------
    // Graphics node creation
    // -----------------------------------------------------------------------

    /**
     * Creates a graphics node (PIXI.Graphics equivalent).
     * Used by ScreenSprite for colored overlay rectangles.
     *
     * @return {ThreeGraphicsNode}
     */
    ThreeRendererFactory.createGraphicsNode = function() {
        return new ThreeGraphicsNode();
    };

    // -----------------------------------------------------------------------
    // Tiling sprite creation
    // -----------------------------------------------------------------------

    /**
     * Creates a tiling sprite (PIXI.extras.TilingSprite equivalent).
     * Uses RepeatWrapping on the texture to handle tiling.
     *
     * @param {Object} [texture] - Texture wrapper with baseTexture
     * @return {ThreeSprite} A sprite configured for tiling
     */
    ThreeRendererFactory.createTilingSprite = function(texture) {
        var sprite = new ThreeSprite(texture);

        // Add tiling-specific properties
        sprite._tilePosition = { x: 0, y: 0 };
        sprite._tileScale = { x: 1, y: 1 };

        // PIXI compat: tilePosition and tileScale
        Object.defineProperty(sprite, 'tilePosition', {
            get: function() { return this._tilePosition; },
            set: function(value) { this._tilePosition = value; },
            configurable: true
        });

        Object.defineProperty(sprite, 'tileScale', {
            get: function() { return this._tileScale; },
            set: function(value) { this._tileScale = value; },
            configurable: true
        });

        // Override texture update to set repeat wrapping
        var originalUpdateTexture = sprite._updateTexture.bind(sprite);
        sprite._updateTexture = function() {
            originalUpdateTexture();
            if (this._threeTexture) {
                this._threeTexture.wrapS = THREE.RepeatWrapping;
                this._threeTexture.wrapT = THREE.RepeatWrapping;
                this._threeTexture.needsUpdate = true;
            }
        };

        // Override syncTransform to handle tile offset via UV manipulation
        var originalSyncTransform = sprite.syncTransform.bind(sprite);
        sprite.syncTransform = function() {
            originalSyncTransform();

            // Update UV coordinates based on tile position and scale
            if (this._threeTexture && this._frameWidth > 0 && this._frameHeight > 0) {
                var tw = this._threeTexture.width || this._frameWidth;
                var th = this._threeTexture.height || this._frameHeight;

                if (tw > 0 && th > 0) {
                    var offsetX = (this._tilePosition.x / tw) || 0;
                    var offsetY = (this._tilePosition.y / th) || 0;
                    var repeatX = (this._frameWidth / (tw * this._tileScale.x)) || 1;
                    var repeatY = (this._frameHeight / (th * this._tileScale.y)) || 1;

                    this._threeTexture.offset.set(-offsetX, -offsetY);
                    this._threeTexture.repeat.set(repeatX, repeatY);
                }
            }
        };

        return sprite;
    };

    // -----------------------------------------------------------------------
    // Filter creation
    // -----------------------------------------------------------------------

    /**
     * Creates a void filter (no-op).
     * @return {ThreeVoidFilter}
     */
    ThreeRendererFactory.createVoidFilter = function() {
        return new ThreeVoidFilter();
    };

    /**
     * Creates a color matrix filter.
     * @return {ThreeColorMatrixFilter}
     */
    ThreeRendererFactory.createColorMatrixFilter = function() {
        return new ThreeColorMatrixFilter();
    };

    // -----------------------------------------------------------------------
    // Tilemap layer creation
    // -----------------------------------------------------------------------

    /**
     * Creates a tilemap layer (GPU-native).
     * Returns { zLayer, layer } for ShaderTilemap compatibility.
     *
     * @param {Number} zIndex
     * @param {Array} bitmaps
     * @param {Boolean} useSquareShader
     * @return {{ zLayer: ThreeTilemapZLayer, layer: ThreeTilemapCompositeLayer }}
     */
    ThreeRendererFactory.createTilemapLayer = function(zIndex, bitmaps, useSquareShader) {
        var zLayer = new ThreeTilemapZLayer(zIndex);
        return { zLayer: zLayer, layer: zLayer._compositeLayer };
    };

    /**
     * Whether this backend supports shader-based tilemap rendering.
     * @return {Boolean} true - Three.js backend uses GPU-native tilemap
     */
    ThreeRendererFactory.supportsShaderTilemap = function() {
        return true;
    };

    // -----------------------------------------------------------------------
    // Scale mode utilities
    // -----------------------------------------------------------------------

    /**
     * Sets the scale mode on a texture.
     * @param {THREE.Texture} texture - The texture to modify
     * @param {Number} mode - THREE.LinearFilter or THREE.NearestFilter
     */
    ThreeRendererFactory.setScaleMode = function(texture, mode) {
        if (!texture) return;

        var filter;
        if (mode === 'linear' || mode === THREE.LinearFilter) {
            filter = THREE.LinearFilter;
        } else {
            filter = THREE.NearestFilter;
        }

        // Handle both Three.js textures and wrapper textures
        if (texture.minFilter !== undefined) {
            texture.minFilter = filter;
            texture.magFilter = filter;
            texture.needsUpdate = true;
        }
        if (texture._threeTexture && texture._threeTexture !== texture) {
            texture._threeTexture.minFilter = filter;
            texture._threeTexture.magFilter = filter;
            texture._threeTexture.needsUpdate = true;
        }
    };

    // -----------------------------------------------------------------------
    // Register with RendererFactory
    // -----------------------------------------------------------------------

    RendererFactory.register('threejs', ThreeRendererFactory);

})();
