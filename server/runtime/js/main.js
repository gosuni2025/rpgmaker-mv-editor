//=============================================================================
// main.js
//=============================================================================

PluginManager.setup($plugins);

if (document.readyState === 'complete') {
    SceneManager.run(Scene_Boot);
} else {
    window.addEventListener('load', function() {
        SceneManager.run(Scene_Boot);
    });
}
