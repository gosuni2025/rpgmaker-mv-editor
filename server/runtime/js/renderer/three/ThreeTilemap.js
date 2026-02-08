//=============================================================================
// ThreeTilemap.js - Canvas-based tilemap rendering for Three.js backend
//=============================================================================

/**
 * A canvas-based tilemap layer for the Three.js renderer.
 * Since ShaderTilemap (pixi-tilemap) is not available in Three.js,
 * this provides a fallback that renders tiles to a canvas and displays
 * the result as a textured plane.
 *
 * This is used by the base Tilemap class (not ShaderTilemap) when the
 * Three.js backend is active.
 *
 * @class ThreeTilemapLayer
 * @constructor
 * @param {Number} width - Layer width in pixels
 * @param {Number} height - Layer height in pixels
 */
function ThreeTilemapLayer(width, height) {
    this._threeObj = new THREE.Group();
    this._threeObj._wrapper = this;

    // Position
    this._x = 0;
    this._y = 0;

    // Scale
    this._scaleX = 1;
    this._scaleY = 1;
    this.scale = this._createScaleProxy();

    // Rotation
    this._rotation = 0;

    // Pivot
    this._pivotX = 0;
    this._pivotY = 0;
    this.pivot = this._createPivotProxy();

    // Alpha / visibility
    this._alpha = 1;
    this._visible = true;

    // World values
    this.worldAlpha = 1;
    this.worldVisible = true;

    // Parent
    this.parent = null;

    // Children
    this.children = [];

    // Filters
    this._filters = null;

    // Z-index
    this._zIndex = 0;

    // Canvas for tile rendering
    this._layerWidth = Math.max(width || 816, 1);
    this._layerHeight = Math.max(height || 624, 1);
    this._canvas = document.createElement('canvas');
    this._canvas.width = this._layerWidth;
    this._canvas.height = this._layerHeight;
    this._context = this._canvas.getContext('2d');

    // Three.js texture and mesh from the canvas
    this._canvasTexture = new THREE.CanvasTexture(this._canvas);
    this._canvasTexture.magFilter = THREE.NearestFilter;
    this._canvasTexture.minFilter = THREE.NearestFilter;
    this._canvasTexture.generateMipmaps = false;

    this._material = new THREE.MeshBasicMaterial({
        map: this._canvasTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });

    this._geometry = new THREE.PlaneGeometry(1, 1);

    // Adjust UV to map correctly (Y-down)
    var uvAttr = this._geometry.attributes.uv;
    if (uvAttr) {
        uvAttr.setXY(0, 0, 0); // top-left
        uvAttr.setXY(1, 1, 0); // top-right
        uvAttr.setXY(2, 0, 1); // bottom-left
        uvAttr.setXY(3, 1, 1); // bottom-right
        uvAttr.needsUpdate = true;
    }

    this._mesh = new THREE.Mesh(this._geometry, this._material);
    // Position so top-left corner is at origin
    this._mesh.position.x = this._layerWidth / 2;
    this._mesh.position.y = this._layerHeight / 2;
    this._mesh.scale.x = this._layerWidth;
    this._mesh.scale.y = this._layerHeight;
    this._threeObj.add(this._mesh);

    // Dirty flag for canvas content
    this._dirty = true;

    // Transform dirty
    this._transformDirty = true;
}

// ---------------------------------------------------------------------------
// Property definitions
// ---------------------------------------------------------------------------

Object.defineProperties(ThreeTilemapLayer.prototype, {
    x: {
        get: function() { return this._x; },
        set: function(value) { this._x = value; this._transformDirty = true; },
        configurable: true
    },
    y: {
        get: function() { return this._y; },
        set: function(value) { this._y = value; this._transformDirty = true; },
        configurable: true
    },
    rotation: {
        get: function() { return this._rotation; },
        set: function(value) { this._rotation = value; this._transformDirty = true; },
        configurable: true
    },
    alpha: {
        get: function() { return this._alpha; },
        set: function(value) { this._alpha = value; },
        configurable: true
    },
    visible: {
        get: function() { return this._visible; },
        set: function(value) {
            this._visible = value;
            this._threeObj.visible = value;
        },
        configurable: true
    },
    filters: {
        get: function() { return this._filters; },
        set: function(value) { this._filters = value; },
        configurable: true
    },
    zIndex: {
        get: function() { return this._zIndex; },
        set: function(value) { this._zIndex = value; this._transformDirty = true; },
        configurable: true
    },
    width: {
        get: function() { return this._layerWidth; },
        configurable: true
    },
    height: {
        get: function() { return this._layerHeight; },
        configurable: true
    }
});

// ---------------------------------------------------------------------------
// Proxy creators
// ---------------------------------------------------------------------------

ThreeTilemapLayer.prototype._createScaleProxy = function() {
    var self = this;
    return {
        get x() { return self._scaleX; },
        set x(v) { self._scaleX = v; self._transformDirty = true; },
        get y() { return self._scaleY; },
        set y(v) { self._scaleY = v; self._transformDirty = true; },
        set: function(x, y) {
            self._scaleX = x;
            self._scaleY = (y !== undefined) ? y : x;
            self._transformDirty = true;
        }
    };
};

ThreeTilemapLayer.prototype._createPivotProxy = function() {
    var self = this;
    return {
        get x() { return self._pivotX; },
        set x(v) { self._pivotX = v; self._transformDirty = true; },
        get y() { return self._pivotY; },
        set y(v) { self._pivotY = v; self._transformDirty = true; },
        set: function(x, y) {
            self._pivotX = x;
            self._pivotY = (y !== undefined) ? y : x;
            self._transformDirty = true;
        }
    };
};

// ---------------------------------------------------------------------------
// Canvas drawing API (for Tilemap._paintTiles)
// ---------------------------------------------------------------------------

/**
 * Clears the layer canvas.
 */
ThreeTilemapLayer.prototype.clear = function() {
    this._context.clearRect(0, 0, this._layerWidth, this._layerHeight);
    this._dirty = true;
};

/**
 * Resizes the layer canvas.
 * @param {Number} width
 * @param {Number} height
 */
ThreeTilemapLayer.prototype.resize = function(width, height) {
    this._layerWidth = Math.max(width || 1, 1);
    this._layerHeight = Math.max(height || 1, 1);
    this._canvas.width = this._layerWidth;
    this._canvas.height = this._layerHeight;

    // Update mesh size
    this._mesh.position.x = this._layerWidth / 2;
    this._mesh.position.y = this._layerHeight / 2;
    this._mesh.scale.x = this._layerWidth;
    this._mesh.scale.y = this._layerHeight;

    this._dirty = true;
};

/**
 * Draws a tile from a source bitmap/canvas onto the layer.
 * @param {HTMLCanvasElement|HTMLImageElement} source - Source image/canvas
 * @param {Number} sx - Source x
 * @param {Number} sy - Source y
 * @param {Number} sw - Source width
 * @param {Number} sh - Source height
 * @param {Number} dx - Destination x
 * @param {Number} dy - Destination y
 * @param {Number} dw - Destination width
 * @param {Number} dh - Destination height
 */
ThreeTilemapLayer.prototype.drawImage = function(source, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (dw === undefined) {
        // 5-argument form: drawImage(source, dx, dy, dw, dh)
        this._context.drawImage(source, sx, sy, sw, sh);
    } else {
        // 9-argument form
        this._context.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    this._dirty = true;
};

/**
 * Gets the 2D rendering context of the layer canvas.
 * @return {CanvasRenderingContext2D}
 */
ThreeTilemapLayer.prototype.getContext = function() {
    return this._context;
};

/**
 * Marks the canvas texture as needing update.
 */
ThreeTilemapLayer.prototype.updateTexture = function() {
    if (this._dirty) {
        this._canvasTexture.needsUpdate = true;
        this._dirty = false;
    }
};

// ---------------------------------------------------------------------------
// PIXI.tilemap.RectTileLayer-compatible API stubs
// (Used by Tilemap._createLayers for canvas tilemap)
// ---------------------------------------------------------------------------

/**
 * PIXI tilemap compat: addRect
 */
ThreeTilemapLayer.prototype.addRect = function(textureId, u, v, x, y, tileWidth, tileHeight) {
    // Canvas tilemap draws directly; this is a stub for API compat
};

/**
 * PIXI tilemap compat: clear (alias)
 */
ThreeTilemapLayer.prototype.clearRects = function() {
    this.clear();
};

// ---------------------------------------------------------------------------
// Transform synchronization
// ---------------------------------------------------------------------------

ThreeTilemapLayer.prototype.syncTransform = function() {
    var obj = this._threeObj;
    obj.position.x = this._x - this._pivotX;
    obj.position.y = this._y - this._pivotY;
    obj.position.z = this._zIndex;
    obj.scale.x = this._scaleX;
    obj.scale.y = this._scaleY;
    obj.rotation.z = -this._rotation;
    obj.visible = this._visible;

    // Update material alpha
    this._material.opacity = this.worldAlpha;

    // Flush canvas texture if dirty
    this.updateTexture();
};

ThreeTilemapLayer.prototype.updateTransform = function(parentAlpha) {
    if (parentAlpha === undefined) parentAlpha = 1;
    this.worldAlpha = this._alpha * parentAlpha;
    this.worldVisible = this._visible;
    this.syncTransform();

    for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i];
        if (child.updateTransform) {
            child.updateTransform(this.worldAlpha);
        }
    }
};

// ---------------------------------------------------------------------------
// Child management
// ---------------------------------------------------------------------------

ThreeTilemapLayer.prototype.addChild = function(child) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
    if (child._threeObj) this._threeObj.add(child._threeObj);
    return child;
};

ThreeTilemapLayer.prototype.addChildAt = function(child, index) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.splice(index, 0, child);
    if (child._threeObj) this._threeObj.add(child._threeObj);
    return child;
};

ThreeTilemapLayer.prototype.removeChild = function(child) {
    var index = this.children.indexOf(child);
    if (index >= 0) {
        this.children.splice(index, 1);
        child.parent = null;
        if (child._threeObj) this._threeObj.remove(child._threeObj);
    }
    return child;
};

ThreeTilemapLayer.prototype.removeChildren = function() {
    var removed = this.children.slice();
    for (var i = 0; i < removed.length; i++) {
        removed[i].parent = null;
        if (removed[i]._threeObj) this._threeObj.remove(removed[i]._threeObj);
    }
    this.children.length = 0;
    return removed;
};

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

ThreeTilemapLayer.prototype.getBounds = function() {
    return { x: this._x, y: this._y, width: this._layerWidth, height: this._layerHeight };
};

ThreeTilemapLayer.prototype.renderWebGL = function(renderer) {};
ThreeTilemapLayer.prototype.renderCanvas = function(renderer) {};

ThreeTilemapLayer.prototype.destroy = function() {
    if (this.parent) this.parent.removeChild(this);
    this.removeChildren();
    if (this._geometry) this._geometry.dispose();
    if (this._material) this._material.dispose();
    if (this._canvasTexture) this._canvasTexture.dispose();
    this._canvas = null;
    this._context = null;
    this._threeObj = null;
};
