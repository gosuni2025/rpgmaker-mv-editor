/*:
 * @pluginname WASD 이동
 * @plugindesc WASD 키로 이동, Q/E 키로 PageUp/PageDown 매핑
 * @author gosuni2025
 *
 * @help
 * WASD 키를 방향키로, Q/E 키를 PageUp/PageDown으로 매핑합니다.
 * 원본 Q=PageUp, W=PageDown 매핑을 덮어씁니다.
 *
 * 키 매핑:
 *   W = 위 (up)
 *   A = 왼쪽 (left)
 *   S = 아래 (down)
 *   D = 오른쪽 (right)
 *   Q = PageUp
 *   E = PageDown
 */

(function() {
    Input.keyMapper[65] = 'left';     // A
    Input.keyMapper[68] = 'right';    // D
    Input.keyMapper[83] = 'down';     // S
    Input.keyMapper[87] = 'up';       // W
    Input.keyMapper[69] = 'pagedown'; // E
    Input.keyMapper[81] = 'pageup';   // Q
})();
