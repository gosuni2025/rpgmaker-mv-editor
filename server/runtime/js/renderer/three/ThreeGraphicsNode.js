//=============================================================================
// ThreeGraphicsNode.js - PIXI.Graphics-compatible wrapper for Three.js
//=============================================================================

/**
 * Emulates PIXI.Graphics for RPG Maker MV's ScreenSprite and other uses.
 * Provides beginFill, drawRect, endFill, and clear methods.
 * Internally creates colored plane meshes in a THREE.Group.
 *
 * @class ThreeGraphicsNode
 * @constructor
 */
function ThreeGraphicsNode() {
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

    // World alpha
    this.worldAlpha = 1;
    this.worldVisible = true;

    // Parent
    this.parent = null;

    // Children (PIXI compat)
    this.children = [];

    // Blend mode (PIXI compat)
    this._blendMode = 0;

    // Filters
    this._filters = null;

    // Z-index
    this._zIndex = 0;

    // Current fill state for drawing commands
    this._fillColor = 0x000000;
    this._fillAlpha = 1;
    this._isFilling = false;

    // Pool of meshes created by draw commands
    this._meshes = [];
    this._activeMeshCount = 0;

    // Transform dirty
    this._transformDirty = true;
}

// ---------------------------------------------------------------------------
// Property definitions
// ---------------------------------------------------------------------------

Object.defineProperties(ThreeGraphicsNode.prototype, {
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
    blendMode: {
        get: function() { return this._blendMode; },
        set: function(value) {
            this._blendMode = value;
            this._updateBlendModes();
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
    }
});

// ---------------------------------------------------------------------------
// Proxy creators
// ---------------------------------------------------------------------------

ThreeGraphicsNode.prototype._createScaleProxy = function() {
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

ThreeGraphicsNode.prototype._createPivotProxy = function() {
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
// PIXI.Graphics-compatible drawing API
// ---------------------------------------------------------------------------

/**
 * Begins a fill with the specified color and alpha.
 * @param {Number} color - Hex color (e.g., 0xFF0000)
 * @param {Number} [alpha=1] - Fill alpha
 * @return {ThreeGraphicsNode} this (for chaining)
 */
ThreeGraphicsNode.prototype.beginFill = function(color, alpha) {
    this._fillColor = color || 0x000000;
    this._fillAlpha = (alpha !== undefined) ? alpha : 1;
    this._isFilling = true;
    return this;
};

/**
 * Draws a rectangle using the current fill.
 * @param {Number} x - X position
 * @param {Number} y - Y position
 * @param {Number} width - Rectangle width
 * @param {Number} height - Rectangle height
 * @return {ThreeGraphicsNode} this (for chaining)
 */
ThreeGraphicsNode.prototype.drawRect = function(x, y, width, height) {
    if (!this._isFilling) return this;

    var mesh = this._getOrCreateMesh();

    // Configure the material
    mesh.material.color.setHex(this._fillColor);
    mesh.material.opacity = this._fillAlpha;
    mesh.material.transparent = true;
    mesh.material.depthTest = false;
    mesh.material.depthWrite = false;
    mesh.material.needsUpdate = true;

    // Position and scale the unit plane to match the rectangle
    // PlaneGeometry is 1x1 centered at origin
    mesh.position.x = x + width / 2;
    mesh.position.y = y + height / 2;
    mesh.position.z = 0;
    mesh.scale.x = width;
    mesh.scale.y = height;

    mesh.visible = true;

    // Apply blend mode
    this._applyBlendMode(mesh.material);

    return this;
};

/**
 * Draws a rounded rectangle.
 * @param {Number} x
 * @param {Number} y
 * @param {Number} width
 * @param {Number} height
 * @param {Number} radius - Corner radius (ignored in simplified impl)
 * @return {ThreeGraphicsNode} this
 */
ThreeGraphicsNode.prototype.drawRoundedRect = function(x, y, width, height, radius) {
    // Simplified: draw as regular rect (rounded corners require custom geometry)
    return this.drawRect(x, y, width, height);
};

/**
 * Draws a circle.
 * @param {Number} x - Center X
 * @param {Number} y - Center Y
 * @param {Number} radius
 * @return {ThreeGraphicsNode} this
 */
ThreeGraphicsNode.prototype.drawCircle = function(x, y, radius) {
    // Approximate as square for now (proper circle needs CircleGeometry)
    return this.drawRect(x - radius, y - radius, radius * 2, radius * 2);
};

/**
 * Ends the current fill.
 * @return {ThreeGraphicsNode} this
 */
ThreeGraphicsNode.prototype.endFill = function() {
    this._isFilling = false;
    return this;
};

/**
 * Clears all drawn graphics.
 * @return {ThreeGraphicsNode} this
 */
ThreeGraphicsNode.prototype.clear = function() {
    // Hide all pooled meshes
    for (var i = 0; i < this._meshes.length; i++) {
        this._meshes[i].visible = false;
    }
    this._activeMeshCount = 0;
    this._isFilling = false;
    return this;
};

/**
 * PIXI compat: lineStyle (stub).
 */
ThreeGraphicsNode.prototype.lineStyle = function(lineWidth, color, alpha) {
    // Line drawing not implemented for Three.js graphics
    return this;
};

/**
 * PIXI compat: moveTo (stub).
 */
ThreeGraphicsNode.prototype.moveTo = function(x, y) {
    return this;
};

/**
 * PIXI compat: lineTo (stub).
 */
ThreeGraphicsNode.prototype.lineTo = function(x, y) {
    return this;
};

// ---------------------------------------------------------------------------
// Internal mesh pool management
// ---------------------------------------------------------------------------

/**
 * Gets a mesh from the pool or creates a new one.
 * @return {THREE.Mesh}
 */
ThreeGraphicsNode.prototype._getOrCreateMesh = function() {
    var mesh;
    if (this._activeMeshCount < this._meshes.length) {
        mesh = this._meshes[this._activeMeshCount];
    } else {
        var geometry = new THREE.PlaneGeometry(1, 1);
        var material = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        mesh = new THREE.Mesh(geometry, material);
        this._meshes.push(mesh);
        this._threeObj.add(mesh);
    }
    this._activeMeshCount++;
    return mesh;
};

/**
 * Applies the current blend mode to a material.
 * @param {THREE.MeshBasicMaterial} material
 */
ThreeGraphicsNode.prototype._applyBlendMode = function(material) {
    switch (this._blendMode) {
        case 1: // ADD
            material.blending = THREE.AdditiveBlending;
            break;
        case 2: // MULTIPLY
            material.blending = THREE.MultiplyBlending;
            break;
        default: // NORMAL
            material.blending = THREE.NormalBlending;
            break;
    }
};

/**
 * Updates blend mode on all existing meshes.
 */
ThreeGraphicsNode.prototype._updateBlendModes = function() {
    for (var i = 0; i < this._meshes.length; i++) {
        this._applyBlendMode(this._meshes[i].material);
        this._meshes[i].material.needsUpdate = true;
    }
};

// ---------------------------------------------------------------------------
// Transform synchronization
// ---------------------------------------------------------------------------

ThreeGraphicsNode.prototype.syncTransform = function() {
    var obj = this._threeObj;
    obj.position.x = this._x - this._pivotX;
    obj.position.y = this._y - this._pivotY;
    obj.position.z = this._zIndex;
    obj.scale.x = this._scaleX;
    obj.scale.y = this._scaleY;
    obj.rotation.z = -this._rotation;
    obj.visible = this._visible;

    // Update alpha on all meshes
    for (var i = 0; i < this._activeMeshCount; i++) {
        this._meshes[i].material.opacity = this._meshes[i].material.opacity * this.worldAlpha;
    }
};

ThreeGraphicsNode.prototype.updateTransform = function(parentAlpha) {
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
// Child management (minimal, for PIXI compat)
// ---------------------------------------------------------------------------

ThreeGraphicsNode.prototype.addChild = function(child) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
    if (child._threeObj) this._threeObj.add(child._threeObj);
    return child;
};

ThreeGraphicsNode.prototype.addChildAt = function(child, index) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.splice(index, 0, child);
    if (child._threeObj) this._threeObj.add(child._threeObj);
    return child;
};

ThreeGraphicsNode.prototype.removeChild = function(child) {
    var index = this.children.indexOf(child);
    if (index >= 0) {
        this.children.splice(index, 1);
        child.parent = null;
        if (child._threeObj) this._threeObj.remove(child._threeObj);
    }
    return child;
};

ThreeGraphicsNode.prototype.removeChildren = function() {
    var removed = this.children.slice();
    for (var i = 0; i < removed.length; i++) {
        removed[i].parent = null;
        if (removed[i]._threeObj) this._threeObj.remove(removed[i]._threeObj);
    }
    this.children.length = 0;
    return removed;
};

// ---------------------------------------------------------------------------
// PIXI compatibility stubs
// ---------------------------------------------------------------------------

ThreeGraphicsNode.prototype.getBounds = function() {
    return { x: this._x, y: this._y, width: 0, height: 0 };
};

ThreeGraphicsNode.prototype.renderWebGL = function(renderer) {};
ThreeGraphicsNode.prototype.renderCanvas = function(renderer) {};

ThreeGraphicsNode.prototype.destroy = function(options) {
    if (this.parent) this.parent.removeChild(this);
    this.removeChildren();
    for (var i = 0; i < this._meshes.length; i++) {
        this._meshes[i].geometry.dispose();
        this._meshes[i].material.dispose();
    }
    this._meshes.length = 0;
    this._threeObj = null;
};
