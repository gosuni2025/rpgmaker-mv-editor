  var CSHelper = {
    actorFace: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null; var actor = $gameParty.members()[actorIndex || 0]; return actor ? ImageManager.loadFace(actor.faceName()) : null;
    },
    actorFaceSrcRect: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null; var actor = $gameParty.members()[actorIndex || 0];
      if (!actor) return null; var i = actor.faceIndex(); return { x: i % 4 * 144, y: Math.floor(i / 4) * 144, w: 144, h: 144 };
    },
    actorCharacter: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null; var actor = $gameParty.members()[actorIndex || 0];
      return actor ? ImageManager.loadCharacter(actor.characterName()) : null;
    },
    actorCharacterSrcRect: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null; var actor = $gameParty.members()[actorIndex || 0]; if (!actor) return null; var charName  = actor.characterName();
      var charIndex = actor.characterIndex(); var bitmap    = ImageManager.loadCharacter(charName); var isBig     = ImageManager.isBigCharacter(charName); var cw, ch, sx, sy;
      if (isBig) {
        cw = Math.floor(bitmap.width  / 3); ch = Math.floor(bitmap.height / 4); sx = cw; sy = 0;
      } else {
        cw = Math.floor(bitmap.width  / 12); ch = Math.floor(bitmap.height / 8); sx = (charIndex % 4 * 3 + 1) * cw; sy = Math.floor(charIndex / 4) * 4 * ch;
      }
      return { x: sx, y: sy, w: cw, h: ch };
    },
    enemyBattler: function(enemy) {
      if (!enemy) return null;
      return (typeof $gameSystem !== 'undefined' && $gameSystem.isSideView())
        ? ImageManager.loadSvEnemy(enemy.battlerName, enemy.battlerHue)
        : ImageManager.loadEnemy(enemy.battlerName, enemy.battlerHue);
    },
    bitmap: function(folder, name) { return ImageManager.loadBitmap(folder, name);     },
    savefileCount: function() { return (typeof DataManager !== 'undefined') ? DataManager.maxSavefiles() : 0;     },
    savefileInfo: function(fileId) { return (typeof DataManager !== 'undefined') ? DataManager.loadSavefileInfo(fileId) : null;     },
    savefileValid: function(fileId) { return (typeof DataManager !== 'undefined') ? DataManager.isThisGameFile(fileId) : false;     },
    lastSavefileId: function() {
      return (typeof DataManager !== 'undefined' && DataManager.lastAccessedSavefileId())
        ? DataManager.lastAccessedSavefileId() : 1;
    },
  }; window.CSHelper = CSHelper; var _widgetRegistry = {};
