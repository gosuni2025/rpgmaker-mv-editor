// 런타임 초기화 완료
RendererFactory.setBackend('threejs');
RendererStrategy.setStrategy('threejs');
window._editorRuntimeReady = true;
console.log('[Editor] Runtime loaded successfully (Three.js r' + THREE.REVISION + ')');
