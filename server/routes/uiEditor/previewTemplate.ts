import fs from 'fs';
import path from 'path';
import projectManager from '../../services/projectManager';

export function detectWebp(): boolean {
  const imgDir = path.join(projectManager.currentPath!, 'img');
  if (!fs.existsSync(imgDir)) return false;
  const check = (dir: string): boolean => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (check(path.join(dir, e.name))) return true; }
      else if (e.name.toLowerCase().endsWith('.webp')) return true;
    }
    return false;
  };
  return check(imgDir);
}

export function buildPreviewHTML(useWebp: boolean): string {
  const cb = `?v=${Date.now()}`;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="viewport" content="user-scalable=no">
    <base href="/game/">
    <link rel="stylesheet" type="text/css" href="fonts/gamefont.css">
    <title>UI Editor Preview</title>
    <style>body { margin: 0; background: black; overflow: hidden; }</style>
    <script>window.__CACHE_BUST__={webp:${useWebp}};</script>
  </head>
  <body>
    <script src="js/libs/three.global.min.js"></script>
    <script defer src="js/libs/fpsmeter.js"></script>
    <script defer src="js/libs/lz-string.js"></script>
    <script defer src="js/libs/iphone-inline-video.browser.js"></script>
    <script defer src="js/renderer/RendererFactory.js${cb}"></script>
    <script defer src="js/renderer/RendererStrategy.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeRendererFactory.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeRendererStrategy.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeContainer.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeSprite.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeGraphicsNode.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeTilemap.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeWaterShader.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeFilters.js${cb}"></script>
    <script defer src="js/rpg_core.js${cb}"></script>
    <script defer src="js/rpg_managers.js${cb}"></script>
    <script defer src="js/uiEditorNoop.js${cb}"></script>
    <script defer src="js/DevPanelUtils.js${cb}"></script>
    <script defer src="js/RendererStatsPanel.js${cb}"></script>
    <script defer src="js/rpg_objects.js${cb}"></script>
    <script defer src="js/rpg_scenes.js${cb}"></script>
    <script defer src="js/rpg_sprites.js${cb}"></script>
    <script defer src="js/rpg_windows.js${cb}"></script>
    <script defer src="js/PluginTween.js${cb}"></script>
    <script defer src="js/Mode3D.js${cb}"></script>
    <script defer src="js/ShadowAndLight.js${cb}"></script>
    <script defer src="js/PostProcessEffects.js${cb}"></script>
    <script defer src="js/PostProcess.js${cb}"></script>
    <script defer src="js/PictureShader.js${cb}"></script>
    <script defer src="js/FogOfWar.js${cb}"></script>
    <script defer src="js/FogOfWar3DVolume.js${cb}"></script>
    <script defer src="js/ExtendedText.js${cb}"></script>
    <script defer src="js/plugins.js"></script>
    <script defer src="js/plugins/CustomSceneEngine.js${cb}"></script>
    <script defer src="js/uiEditorBridge.js${cb}"></script>
    <script defer src="js/main.js${cb}"></script>
  </body>
</html>`;
}
