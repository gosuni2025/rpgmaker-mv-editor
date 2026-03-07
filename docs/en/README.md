# RPG Maker MV Web Editor — Documentation

A reimplementation of the RPG Maker MV editor for use in a web browser.
Provides all the features of the original editor while adding extended features such as **3D rendering**, **lighting system**, and **UI customization**.

---

## Table of Contents

### Core Editor

| Document | Contents |
|------|------|
| [Editor Overview](01-overview.md) | UI layout, menu bar, shortcuts |
| [Map Editor](02-map-editor.md) | Tile drawing, event editing, objects, lighting, camera zones, FOW |
| [3D Mode](03-3d-mode.md) | HD-2D rendering, skybox, camera controls |
| [UI Editor](04-ui-editor.md) | UITheme skin system, custom scene engine |

### Tools

| Document | Contents |
|------|------|
| [Event Editor](06-event-editor.md) | Command editing, waypoint move routes, script templates |
| [Deploy](07-deploy.md) | itch.io · Netlify · GitHub Pages · Local folder deployment |

### Built-in Plugins

| Document | Plugin | Summary |
|------|----------|------|
| [Touch Camera Control](../plugins/touch-camera.md) | TouchCameraControl | 3D camera drag/pinch controls |
| [Skybox](../plugins/skybox.md) | SkyBox | Panoramic sky background |
| [Occlusion Silhouette](../plugins/occlusion-silhouette.md) | OcclusionSilhouette | Silhouette display for hidden characters |
| [Minimap](../plugins/minimap.md) | Minimap | FoW · Region colors · Markers |
| [Auto Save](../plugins/autosave.md) | AutoSave | Auto-save after map transitions/battles |
| [Visual Novel Mode](../plugins/visual-novel-mode.md) | VisualNovelMode | VN-style messages |
| [Menu Transition](../plugins/menu-transition.md) | MenuTransition | Menu background blur/sepia effects |
| [WASD Movement](../plugins/wasd-movement.md) | WASD_Movement | WASD keyboard movement |
| [Item Book](../plugins/item-book.md) | ItemBook | Item/weapon/armor encyclopedia |
| [Enemy Book](../plugins/enemy-book.md) | EnemyBook | Enemy information encyclopedia |
| [Text Log](../plugins/text-log.md) | TextLog | Dialogue log viewer |
| [Title Credit](../plugins/title-credit.md) | TitleCredit | Title screen credits |
| [Quest](../plugins/quest.md) | QuestSystem | Quest definition, objectives, and reward management |

---

## Key Differences from the Original

### ✅ Added Features

- **3D Rendering Mode** — Display maps in HD-2D perspective view
- **Lighting System (EXT)** — Per-map dynamic point lights / ambient settings
- **Skybox (EXT)** — Panoramic sky background in 3D mode
- **Camera Zones (EXT)** — Camera lock / angle change when entering specific areas
- **Object System (EXT)** — Layer placement of images/tiles/animations
- **FOW (EXT)** — Per-map fog effect (Fog of War) settings
- **UI Editor** — Visual editing of window layout · 9-slice skins · fonts
- **Custom Scene Engine** — Define in-game UI scenes via JSON with real-time preview
- **MCP Integration** — Claude AI directly writes/modifies event commands

### 🔄 Compatibility

- Uses the original RPG Maker MV `Map*.json` format as-is
- Extended data stored separately in `Map*_ext.json` (fully compatible with original editor)
- PIXI.js runtime (`index.html`) and Three.js runtime (`index_3d.html`) coexist

---

## Quick Start

1. `npm run dev` — Runs editor server (3001) + client (5173) simultaneously
2. Open `http://localhost:5173` in your browser
3. **File → Open Project** — Select your RPG Maker MV project folder
4. Double-click a map in the map tree to start editing
