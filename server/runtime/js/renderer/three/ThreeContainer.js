//=============================================================================
// ThreeContainer.js - PIXI.Container-compatible wrapper around THREE.Group
//=============================================================================

/**
 * A container object that wraps THREE.Group to provide PIXI.Container-like
 * interface for the RPG Maker MV rendering pipeline.
 *
 * Properties mirror PIXI.Container: x, y, scale, rotation, pivot, alpha,
 * visible, children, parent, filters, worldAlpha, worldVisible, worldTransform.
 *
 * @class ThreeContainer
 * @constructor
 */
function ThreeContainer() {
    this._threeObj = new THREE.Group();
    this._threeObj._wrapper = this;

    // Position
    this._x = 0;
    this._y = 0;

    // Scale (PIXI uses {x, y} object)
    this._scaleX = 1;
    this._scaleY = 1;
    this.scale = this._createScaleProxy();

    // Rotation in radians
    this._rotation = 0;

    // Pivot point (center of rotation/scaling, in local coords)
    this._pivotX = 0;
    this._pivotY = 0;
    this.pivot = this._createPivotProxy();

    // Alpha / visibility
    this._alpha = 1;
    this._visible = true;

    // World-computed values (updated during traversal)
    this.worldAlpha = 1;
    this.worldVisible = true;

    // Parent reference
    this.parent = null;

    // Children array
    this.children = [];

    // Filters (PIXI compat - stored but not applied in Three.js path yet)
    this._filters = null;

    // Interactive flag (PIXI compat, memory optimization)
    this.interactive = false;

    // PIXI compat: transform update flag
    this._transformDirty = true;

    // Z-index for draw order (maps to THREE position.z)
    this._zIndex = 0;
}

// ---------------------------------------------------------------------------
// Property definitions (PIXI.Container-compatible)
// ---------------------------------------------------------------------------

Object.defineProperties(ThreeContainer.prototype, {
    x: {
        get: function() { return this._x; },
        set: function(value) {
            if (this._x !== value) {
                this._x = value;
                this._transformDirty = true;
            }
        },
        configurable: true
    },
    y: {
        get: function() { return this._y; },
        set: function(value) {
            if (this._y !== value) {
                this._y = value;
                this._transformDirty = true;
            }
        },
        configurable: true
    },
    rotation: {
        get: function() { return this._rotation; },
        set: function(value) {
            if (this._rotation !== value) {
                this._rotation = value;
                this._transformDirty = true;
            }
        },
        configurable: true
    },
    alpha: {
        get: function() { return this._alpha; },
        set: function(value) {
            this._alpha = value;
        },
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
        set: function(value) {
            this._filters = value;
            // Filters are stored for API compat; Three.js shader application is future work
        },
        configurable: true
    },
    zIndex: {
        get: function() { return this._zIndex; },
        set: function(value) {
            this._zIndex = value;
            this._transformDirty = true;
        },
        configurable: true
    }
});

// ---------------------------------------------------------------------------
// Scale/Pivot proxy objects (mimic PIXI Point-like {x, y})
// ---------------------------------------------------------------------------

ThreeContainer.prototype._createScaleProxy = function() {
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

ThreeContainer.prototype._createPivotProxy = function() {
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
// Child management (PIXI.Container-compatible API)
// ---------------------------------------------------------------------------

/**
 * Adds a child to the container.
 * @param {ThreeContainer|ThreeSprite|*} child
 * @return {*} The child that was added
 */
ThreeContainer.prototype.addChild = function(child) {
    if (child.parent) {
        child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
    if (child._threeObj) {
        this._threeObj.add(child._threeObj);
    }
    return child;
};

/**
 * Adds a child at a specific index.
 * @param {*} child
 * @param {Number} index
 * @return {*} The child that was added
 */
ThreeContainer.prototype.addChildAt = function(child, index) {
    if (child.parent) {
        child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.splice(index, 0, child);
    if (child._threeObj) {
        this._threeObj.add(child._threeObj);
    }
    return child;
};

/**
 * Removes a child from the container.
 * @param {*} child
 * @return {*} The child that was removed
 */
ThreeContainer.prototype.removeChild = function(child) {
    var index = this.children.indexOf(child);
    if (index >= 0) {
        this.children.splice(index, 1);
        child.parent = null;
        if (child._threeObj) {
            this._threeObj.remove(child._threeObj);
        }
    }
    return child;
};

/**
 * Removes a child at a specific index.
 * @param {Number} index
 * @return {*} The removed child
 */
ThreeContainer.prototype.removeChildAt = function(index) {
    if (index >= 0 && index < this.children.length) {
        var child = this.children[index];
        this.children.splice(index, 1);
        child.parent = null;
        if (child._threeObj) {
            this._threeObj.remove(child._threeObj);
        }
        return child;
    }
    return null;
};

/**
 * Removes all children from the container.
 * @return {Array} The removed children
 */
ThreeContainer.prototype.removeChildren = function() {
    var removed = this.children.slice();
    for (var i = 0; i < removed.length; i++) {
        removed[i].parent = null;
        if (removed[i]._threeObj) {
            this._threeObj.remove(removed[i]._threeObj);
        }
    }
    this.children.length = 0;
    return removed;
};

/**
 * Returns the index of a child.
 * @param {*} child
 * @return {Number}
 */
ThreeContainer.prototype.getChildIndex = function(child) {
    return this.children.indexOf(child);
};

/**
 * Sets the index of a child (reorders).
 * @param {*} child
 * @param {Number} index
 */
ThreeContainer.prototype.setChildIndex = function(child, index) {
    var currentIndex = this.children.indexOf(child);
    if (currentIndex >= 0) {
        this.children.splice(currentIndex, 1);
        this.children.splice(index, 0, child);
    }
};

/**
 * Swaps two children.
 * @param {*} child1
 * @param {*} child2
 */
ThreeContainer.prototype.swapChildren = function(child1, child2) {
    var i1 = this.children.indexOf(child1);
    var i2 = this.children.indexOf(child2);
    if (i1 >= 0 && i2 >= 0) {
        this.children[i1] = child2;
        this.children[i2] = child1;
    }
};

// ---------------------------------------------------------------------------
// Transform synchronization
// ---------------------------------------------------------------------------

/**
 * Syncs the wrapper properties to the underlying THREE.Group.
 * Called during render traversal.
 */
ThreeContainer.prototype.syncTransform = function() {
    var obj = this._threeObj;
    // Position: x, y in screen coords; z for draw order
    obj.position.x = this._x - this._pivotX;
    obj.position.y = this._y - this._pivotY;
    obj.position.z = this._zIndex;

    // Scale
    obj.scale.x = this._scaleX;
    obj.scale.y = this._scaleY;

    // Rotation (around Z axis for 2D)
    obj.rotation.z = -this._rotation; // negate because Three.js Z rotation is CCW, PIXI is CW

    // Visibility
    obj.visible = this._visible;
};

/**
 * Recursively updates world alpha and syncs transforms for the hierarchy.
 * Called before each render pass.
 * @param {Number} parentAlpha - The accumulated alpha from ancestors
 */
ThreeContainer.prototype.updateTransform = function(parentAlpha) {
    if (parentAlpha === undefined) parentAlpha = 1;

    this.worldAlpha = this._alpha * parentAlpha;
    this.worldVisible = this._visible;

    this.syncTransform();

    // Update children
    for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i];
        if (child.updateTransform) {
            child.updateTransform(this.worldAlpha);
        }
    }
};

// ---------------------------------------------------------------------------
// PIXI compatibility stubs
// ---------------------------------------------------------------------------

/**
 * PIXI compat: getBounds stub.
 * @return {{ x: Number, y: Number, width: Number, height: Number }}
 */
ThreeContainer.prototype.getBounds = function() {
    return { x: this._x, y: this._y, width: 0, height: 0 };
};

/**
 * PIXI compat: getLocalBounds stub.
 */
ThreeContainer.prototype.getLocalBounds = function() {
    return { x: 0, y: 0, width: 0, height: 0 };
};

/**
 * PIXI compat: toGlobal stub.
 */
ThreeContainer.prototype.toGlobal = function(position) {
    return { x: this._x + position.x, y: this._y + position.y };
};

/**
 * PIXI compat: toLocal stub.
 */
ThreeContainer.prototype.toLocal = function(position) {
    return { x: position.x - this._x, y: position.y - this._y };
};

/**
 * PIXI compat: renderWebGL stub (Three.js handles rendering differently).
 */
ThreeContainer.prototype.renderWebGL = function(renderer) {
    // No-op: Three.js renders via scene graph traversal
};

/**
 * PIXI compat: renderCanvas stub.
 */
ThreeContainer.prototype.renderCanvas = function(renderer) {
    // No-op
};

/**
 * PIXI compat: destroy.
 */
ThreeContainer.prototype.destroy = function(options) {
    if (this.parent) {
        this.parent.removeChild(this);
    }
    this.removeChildren();
    this._threeObj = null;
};
