# MessagePreview Three.js 전환 작업 계획

## 목표
- Canvas 2D 기반 대화창/VN모드 프리뷰 → Three.js 렌더러 + ShaderMaterial 전환
- ExtendedText.js 효과(shake/hologram/dissolve/fade/gradient-wave/blur-fade) → GLSL 쉐이더
- 텍스트 입력 프리뷰(EventCommandEditor 내 MessagePreview) 포함
- 폰트: RPG Maker MV 기존 Bitmap 텍스트 유지 (CanvasTexture로 Three.js에 업로드)
  - 순수 Three.js 텍스트가 필요하면 troika-three-text 추가 가능하나 현 단계 불필요

---

## 현재 구조 (문제)

```
MessagePreview.tsx
  ├─ Canvas 2D (getContext('2d')) 로 전체 합성
  │   ├─ drawMapBackground()   ← Canvas 2D drawImage
  │   ├─ drawWindowPng()       ← Canvas 2D 9-slice
  │   ├─ drawImage(face)       ← Canvas 2D
  │   └─ drawImage(Bitmap)     ← Canvas 2D (Bitmap = Window_Base.drawTextEx 결과)
  └─ VN 모드도 동일

ExtendedText.js
  └─ _etRunAnimPass()
      ├─ _etRedrawShake()        ← bmp._context Canvas 2D 픽셀 조작
      ├─ _etRedrawHologramBase() ← bmp._context Canvas 2D
      ├─ _etOverlayScanlines()   ← bmp._context destination-out
      ├─ _etRedrawGradientWave() ← bmp._context Canvas 2D
      ├─ _etRedrawFade()         ← bmp._context globalAlpha
      ├─ _etRedrawDissolve()     ← bmp._context destination-out
      └─ _etRedrawBlurFade()     ← bmp._context Canvas 2D
```

---

## 목표 구조

```
MessagePreview.tsx
  └─ useMessagePreviewRenderer (custom hook)
      ├─ THREE.WebGLRenderer (off-screen, preview 전용)
      ├─ THREE.WebGLRenderTarget (816×624)
      ├─ THREE.OrthographicCamera (0, 816, 0, 624, -100, 100)  ← Y-down, 좌표=화면픽셀
      └─ THREE.Scene
          ├─ rO=0  MapBackgroundMesh     (816×624, MeshBasicMaterial, CanvasTexture ← game map)
          ├─ rO=1  DimOverlayMesh        (816×624, MeshBasicMaterial, rgba(0,0,0,0.25))
          ├─ rO=2  WindowFrameMesh       (GW×WIN_H 또는 VN_W×VN_H, Window9SliceMaterial)
          ├─ rO=3  FaceMesh              (FACE_SZ×FACE_SZ, MeshBasicMaterial, face.png)
          ├─ rO=4  TextBitmapMesh        (contentsW×contentsH, MeshBasicMaterial, CanvasTexture ← Bitmap)
          └─ rO=5+ EffectOverlayMesh[N]  (per segment, ShaderMaterial)

ExtendedText.js (_etRunAnimPass 교체)
  └─ 각 세그먼트 → THREE.PlaneGeometry + ShaderMaterial (overlay)
      ├─ texture = 세그먼트 문자 CanvasTexture (Bitmap 에서 복사)
      ├─ Bitmap에서 해당 픽셀 투명화 (clearRect)
      ├─ 게임 Three.js 씬에 직접 추가 (screen coords = world coords)
      └─ 효과 완료 시 dispose + 씬 제거
```

---

## 좌표계

```
ThreeRendererStrategy.createRenderer():
  OrthographicCamera(0, 816, 0, 624, -10000, 10000)
  → screen (x, y) = Three.js world (x, y)  ← 직접 매핑, Y-down

ExtendedText 오버레이 위치:
  worldX = window.x + window.padding + chars[0].x
  worldY = window.y + window.padding + chars[0].y
  PlaneGeometry position.x = worldX + segW/2
  PlaneGeometry position.y = worldY + segH/2
```

---

## 파일별 변경 내용

### 1. `client/src/components/EventEditor/MessagePreview.tsx` (전면 재작성)

#### 1-A. Three.js 렌더러 초기화 (hook)
```typescript
function useMessagePreviewRenderer() {
  // window.THREE 사용 (index.html에 이미 로드됨)
  // 별도 THREE.WebGLRenderer 생성 (game renderer와 독립)
  // WebGLRenderTarget(816, 624)
  // OrthographicCamera(0, 816, 0, 624, -100, 100)
  // 컴포넌트 언마운트 시 dispose
}
```

#### 1-B. 씬 오브젝트 관리
- **MapBackground**: CanvasTexture → `window._editorRendererObj?.view` 캔버스에서 매 프레임 복사
  ```typescript
  mapTexture.image = mapCanvas;
  mapTexture.needsUpdate = true;
  ```
- **WindowFrame**: Window9SliceMaterial (§ 쉐이더 참조)
  - normal mode: (0, winY, 816, 180)
  - VN mode: (VN_X, VN_Y, VN_W, VN_H)
- **Face**: `THREE.TextureLoader` 또는 `THREE.CanvasTexture`
- **TextBitmap**: `Window_Base.drawTextEx` 결과 Bitmap → CanvasTexture
- **Effects**: ExtendedText _etAnimSegs의 ShaderMaterial 오버레이

#### 1-C. VN 모드
- 씬 오브젝트 위치/크기만 다름 (VN_X, VN_Y, VN_W, VN_H)
- TextBitmap UV 오프셋으로 스크롤:
  ```typescript
  textMesh.material.uniforms.uScrollY.value = scrollLine * LINE_H / bitmapH;
  ```
- 스크롤 UI: 얇은 PlaneGeometry + MeshBasicMaterial (▲▼ indicator)

#### 1-D. RAF 루프
```typescript
function tick() {
  // 1. 맵 텍스처 업데이트
  // 2. ExtendedText._time 진행
  // 3. renderer._etAnimSegs 업데이트 (uniform 갱신)
  // 4. scene.render(renderTarget)
  // 5. 결과를 preview canvas에 복사
  //    renderer.readRenderTargetPixels() → putImageData
  //    또는 renderTarget.texture → canvas에 drawImage
}
```

#### 1-E. 텍스트 입력 프리뷰 통합
- MessagePreview는 EventCommandEditor에서 `<MessagePreview .../>` 로 사용됨
- Three.js 렌더러는 hook에 캡슐화 → props 변경 시 Bitmap 재생성, 씬 업데이트

---

### 2. `server/runtime/js/ExtendedText.js` (효과 함수 교체)

#### 2-A. 제거 대상 (Canvas 2D)
- `_etRedrawShake`
- `_etRedrawHologramBase`
- `_etOverlayScanlines`
- `_etRedrawGradientWave`
- `_etRedrawFade`
- `_etRedrawDissolve`
- `_etRedrawBlurFade`
- `_saveAdjacentPixels` / `_restoreAdjacentPixels`

#### 2-B. 신규 (Three.js 오버레이)
```javascript
ExtendedText._getGameScene = function() {
  return window._editorRendererObj && window._editorRendererObj.scene;
};

// 세그먼트 오버레이 메시 생성/업데이트
Window_Base.prototype._etEnsureOverlay = function(seg) {
  if (seg._overlayMesh) return;
  // 1. Bitmap에서 char 영역 픽셀 캡처 → 임시 canvas
  // 2. Bitmap에서 해당 픽셀 clearRect
  // 3. CanvasTexture 생성
  // 4. ShaderMaterial 생성 (효과 타입별)
  // 5. PlaneGeometry 생성 (segW × segH)
  // 6. Mesh 생성, position 설정
  // 7. renderOrder 설정 (window renderOrder + 100)
  // 8. scene.add(mesh)
  seg._overlayMesh = mesh;
};

Window_Base.prototype._etUpdateOverlayUniforms = function(seg, t) {
  var uniforms = seg._overlayMesh.material.uniforms;
  uniforms.uTime.value = t;
  // 효과별 progress, amplitude 등 업데이트
};

Window_Base.prototype._etRemoveOverlay = function(seg) {
  if (!seg._overlayMesh) return;
  ExtendedText._getGameScene().remove(seg._overlayMesh);
  seg._overlayMesh.geometry.dispose();
  seg._overlayMesh.material.dispose();
  seg._overlayMesh.material.uniforms.tTex.value.dispose();
  seg._overlayMesh = null;
};
```

#### 2-C. `_etRunAnimPass` 교체
```javascript
Window_Base.prototype._etRunAnimPass = function() {
  var segs = this._etAnimSegs;
  var t = ExtendedText._time;
  for (var i = 0; i < segs.length; i++) {
    var seg = segs[i];
    this._etEnsureOverlay(seg);
    this._etUpdateOverlayUniforms(seg, t);
    if (seg._etDone) this._etRemoveOverlay(seg);
  }
  // 완료 세그먼트 제거
  for (var k = segs.length - 1; k >= 0; k--) {
    if (segs[k]._etDone) segs.splice(k, 1);
  }
};
```

---

## GLSL 쉐이더 명세

### 공통 Vertex Shader
```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### Window 9-Slice Shader (fragment)
```glsl
uniform sampler2D tWindow;   // Window.png (192×192)
uniform vec2 uDstSize;       // 목적지 창 크기 (px)
const float BORDER = 12.0;   // border 두께 (px)
// Window.png 레이아웃:
//   (0,0,64,64)   = 배경 타일
//   (64,64,64,64) = 테두리 (9-slice)

varying vec2 vUv;

vec2 nineSliceUV(vec2 uv, vec2 dstSize, float border) {
  float bx = border / dstSize.x;
  float by = border / dstSize.y;
  // 9 영역 분류 → 소스 UV 계산
  float sx, sy;
  if (uv.x < bx) sx = uv.x / bx * (border / 64.0);
  else if (uv.x > 1.0 - bx) sx = (64.0 - border + (uv.x - (1.0 - bx)) / bx * border) / 64.0;
  else sx = (border + (uv.x - bx) / (1.0 - 2.0 * bx) * (64.0 - 2.0 * border)) / 64.0;
  if (uv.y < by) sy = uv.y / by * (border / 64.0);
  else if (uv.y > 1.0 - by) sy = (64.0 - border + (uv.y - (1.0 - by)) / by * border) / 64.0;
  else sy = (border + (uv.y - by) / (1.0 - 2.0 * by) * (64.0 - 2.0 * border)) / 64.0;
  return vec2(sx, sy);
}

void main() {
  // 배경 (tiled)
  vec2 bgUV = mod(vUv * uDstSize / 64.0, 1.0) * (64.0 / 192.0);
  vec4 bg = texture2D(tWindow, bgUV);
  bg.a *= 0.82;

  // 테두리 9-slice: (64,64) 오프셋
  vec2 borderUV = nineSliceUV(vUv, uDstSize, BORDER);
  borderUV.x = borderUV.x * (64.0/192.0) + 64.0/192.0;
  borderUV.y = borderUV.y * (64.0/192.0) + 64.0/192.0;
  vec4 border = texture2D(tWindow, borderUV);

  // 합성
  gl_FragColor = mix(bg, border, border.a);
}
```

### Shake Shader (fragment)
```glsl
uniform sampler2D tTex;
uniform float uTime;
uniform float uAmp;         // 픽셀 단위 흔들림 크기
uniform float uSpeed;
uniform float uCharCount;   // 세그먼트 내 글자 수 (근사치)
uniform float uTexH;        // 텍스처 높이 (px)

varying vec2 vUv;

void main() {
  float charIdx = floor(vUv.x * uCharCount);
  float offsetY = sin(uTime * uSpeed * 5.0 + charIdx * 0.8) * uAmp / uTexH;
  vec2 sUv = vec2(vUv.x, vUv.y + offsetY);
  if (sUv.y < 0.0 || sUv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  gl_FragColor = texture2D(tTex, sUv);
}
```

### Hologram Shader (fragment)
```glsl
uniform sampler2D tTex;
uniform float uTime;
uniform float uScanH;       // 스캔라인 높이 (px)
uniform float uFlicker;     // 깜빡임 속도
uniform float uTexH;

varying vec2 vUv;

void main() {
  vec4 c = texture2D(tTex, vUv);
  if (c.a < 0.01) { gl_FragColor = vec4(0.0); return; }

  // Cyan tint
  c.rgb = vec3(0.0, 1.0, 1.0) * c.a;

  // Scanlines (시간에 따라 아래로 이동)
  float lineY = mod(vUv.y * uTexH + uTime * 25.0, uScanH);
  if (lineY < uScanH * 0.45) c.a *= 0.3;

  // Flicker
  c.a *= (0.8 + 0.2 * sin(uTime * uFlicker * 10.0));

  c.rgb *= c.a;   // premultiplied
  gl_FragColor = c;
}
```

### Dissolve Shader (fragment)
```glsl
uniform sampler2D tTex;
uniform float uTime;
uniform float uSpeed;
uniform float uStartTime;

varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec4 c = texture2D(tTex, vUv);
  if (c.a < 0.01) { gl_FragColor = vec4(0.0); return; }

  float progress = clamp((uTime - uStartTime) * uSpeed * 0.5, 0.0, 1.0);
  float noise = hash(vUv + fract(uTime * 0.1));
  if (noise > progress) discard;

  gl_FragColor = c;
}
```

### Fade Shader (fragment)
```glsl
uniform sampler2D tTex;
uniform float uProgress;    // 0.0 (투명) → 1.0 (불투명)

varying vec2 vUv;

void main() {
  vec4 c = texture2D(tTex, vUv);
  c.a *= uProgress;
  c.rgb *= uProgress;
  gl_FragColor = c;
}
```

### Gradient Wave Shader (fragment)
```glsl
uniform sampler2D tTex;
uniform float uTime;
uniform float uSpeed;

varying vec2 vUv;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec4 c = texture2D(tTex, vUv);
  if (c.a < 0.01) { gl_FragColor = vec4(0.0); return; }

  float hue = mod(vUv.x + uTime * uSpeed * 0.075, 1.0);
  vec3 waveColor = hsv2rgb(vec3(hue, 1.0, 0.62));
  gl_FragColor = vec4(waveColor * c.a, c.a);
}
```

### Blur-Fade Shader (fragment)
```glsl
uniform sampler2D tTex;
uniform float uProgress;    // 0.0 (투명, 블러 최대) → 1.0 (선명, 불투명)
uniform vec2 uTexelSize;    // vec2(1.0/texW, 1.0/texH)

varying vec2 vUv;

void main() {
  float blurR = (1.0 - uProgress) * 4.0;
  vec4 c = vec4(0.0);
  c += texture2D(tTex, vUv);
  c += texture2D(tTex, vUv + vec2( blurR, 0.0) * uTexelSize);
  c += texture2D(tTex, vUv + vec2(-blurR, 0.0) * uTexelSize);
  c += texture2D(tTex, vUv + vec2(0.0,  blurR) * uTexelSize);
  c += texture2D(tTex, vUv + vec2(0.0, -blurR) * uTexelSize);
  c /= 5.0;
  c.a *= uProgress;
  c.rgb *= uProgress;
  gl_FragColor = c;
}
```

---

## 텍스트 색상 버그 해결

현재 `normalColor()` → windowskin 미로드 시 검은색 반환 문제.
Three.js 렌더러 전환 후 Window_Base는 오프스크린 전용이므로 아래 오버라이드 유지:
```javascript
r.normalColor = () => '#ffffff';
r.textColor = (n) => { /* windowskin 픽셀 샘플링 or 폴백 '#ffffff' */ };
```

---

## 구현 순서

```
[1] MessagePreview.tsx → useMessagePreviewRenderer hook 작성
    └─ Three.js 씬/카메라/RenderTarget 초기화
    └─ MapBackground, WindowFrame, Face, TextBitmap 메시 생성

[2] Window9SliceMaterial 쉐이더 작성 + 검증

[3] TextBitmapMesh (CanvasTexture from Bitmap) 연동
    └─ Window_Base.drawTextEx 결과를 CanvasTexture로 Three.js에 업로드

[4] VN 모드 지원 (창 크기 전환 + UV 스크롤)

[5] ExtendedText.js 쉐이더 오버레이 시스템
    └─ 각 효과 ShaderMaterial GLSL 작성
    └─ _etRunAnimPass 교체 (Canvas 2D 제거)

[6] 텍스트 입력 프리뷰 통합 확인
    └─ EventCommandEditor → MessagePreview props 흐름 검증

[7] 게임 런타임 동기화
    └─ server/runtime/js/ExtendedText.js → claudetest/js/3d/ExtendedText.js 복사

[8] 디버그 로그 제거 + 커밋
```

---

## 주의사항

- `window.THREE` : index.html에서 three.global.min.js로 로드됨. npm import 불필요.
- MessagePreview THREE.WebGLRenderer는 game renderer(`_editorRendererObj`)와 **별도** 생성
- ExtendedText 오버레이는 game renderer의 scene에 추가 (`window._editorRendererObj.scene`)
- Three.js OrthographicCamera Y-down (top=0, bottom=height) → `position.y = screenY` 직접 사용
- UI 메시는 `depthTest: false, depthWrite: false, transparent: true` 필수
- renderOrder로 레이어 순서 제어 (position.z 불필요)
- WebGLRenderTarget → preview canvas 복사: `readRenderTargetPixels` or drawImage (texture to canvas via renderer)

---

## 파일 목록 (변경 대상)

| 파일 | 변경 |
|------|------|
| `client/src/components/EventEditor/MessagePreview.tsx` | 전면 재작성 |
| `server/runtime/js/ExtendedText.js` | Canvas 2D 효과 → ShaderMaterial |
| `claudetest/js/3d/ExtendedText.js` | 동기화 |

패키지 추가 없음 (window.THREE 재사용).
troika-three-text는 현 단계 미사용 (Bitmap 텍스트 유지).
