import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './FogOfWarTestPage.css';

declare const THREE: any;

export default function SilhouetteTestPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef<any>(null);

  const [fillColor, setFillColor] = useState('#3366ff');
  const [fillOpacity, setFillOpacity] = useState(0.35);
  const [outlineColor, setOutlineColor] = useState('#ffffff');
  const [outlineOpacity, setOutlineOpacity] = useState(0.8);
  const [outlineWidth, setOutlineWidth] = useState(2);
  const [pattern, setPattern] = useState(0);
  const [patternScale, setPatternScale] = useState(8);
  const [charOpacity, setCharOpacity] = useState(1);
  const [objOpacity, setObjOpacity] = useState(0.8);
  const [objScale, setObjScale] = useState(2);
  const [showDebug, setShowDebug] = useState(true);
  const [silhouetteEnabled, setSilhouetteEnabled] = useState(true);

  const initScene = useCallback(() => {
    if (!canvasRef.current || typeof THREE === 'undefined') return;
    const container = canvasRef.current;
    const rect = container.getBoundingClientRect();
    let W = rect.width || window.innerWidth;
    let H = rect.height || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.autoClear = false;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const sceneBgColor = new THREE.Color(0x224433);

    const camH = 600;
    let aspect = W / H;
    const camera = new THREE.OrthographicCamera(
      -camH * aspect / 2, camH * aspect / 2,
      camH / 2, -camH / 2, -1000, 1000
    );
    camera.position.z = 10;

    // 배경: 체커보드
    (function() {
      const gridSize = 48;
      const cols = Math.ceil(camH * aspect / gridSize) + 2;
      const rows = Math.ceil(camH / gridSize) + 2;
      const canvas = document.createElement('canvas');
      canvas.width = cols * gridSize;
      canvas.height = rows * gridSize;
      const ctx = canvas.getContext('2d')!;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#2a3a2a' : '#1e2e1e';
          ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      const bgMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(canvas.width, canvas.height),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      bgMesh.renderOrder = 0;
      bgMesh.position.z = -5;
      scene.add(bgMesh);
      scene._bgMesh = bgMesh;
    })();

    // 캐릭터 (파란 원)
    const charGroup = new THREE.Group();
    (function() {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#4488ff';
      ctx.beginPath(); ctx.ellipse(32, 55, 20, 30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#66aaff';
      ctx.beginPath(); ctx.arc(32, 20, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(26, 18, 4, 0, Math.PI * 2); ctx.arc(38, 18, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(27, 18, 2, 0, Math.PI * 2); ctx.arc(39, 18, 2, 0, Math.PI * 2); ctx.fill();
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(64, 96), mat);
      mesh.renderOrder = 2;
      charGroup.add(mesh);
      charGroup._mainMesh = mesh;
      charGroup._material = mat;
    })();
    charGroup.position.set(-100, 0, 0);
    scene.add(charGroup);

    // 오브젝트 1: 건물
    const objGroup = new THREE.Group();
    (function() {
      const canvas = document.createElement('canvas');
      canvas.width = 192; canvas.height = 192;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#884422'; ctx.fillRect(10, 40, 172, 142);
      ctx.fillStyle = '#aa3322';
      ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(96, 0); ctx.lineTo(192, 50); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#553311'; ctx.fillRect(76, 120, 40, 62);
      ctx.fillStyle = '#aaccff'; ctx.fillRect(26, 70, 36, 30); ctx.fillRect(130, 70, 36, 30);
      ctx.strokeStyle = '#553311'; ctx.lineWidth = 2;
      [26, 130].forEach((sx) => {
        ctx.beginPath(); ctx.moveTo(sx + 18, 70); ctx.lineTo(sx + 18, 100); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx, 85); ctx.lineTo(sx + 36, 85); ctx.stroke();
      });
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(192, 192), mat);
      mesh.renderOrder = 5;
      objGroup.add(mesh);
      objGroup._mainMesh = mesh;
      objGroup._material = mat;
    })();
    objGroup.position.set(50, 0, 0);
    scene.add(objGroup);

    // 오브젝트 2: 나무
    const objGroup2 = new THREE.Group();
    (function() {
      const canvas = document.createElement('canvas');
      canvas.width = 96; canvas.height = 144;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#664422'; ctx.fillRect(38, 80, 20, 64);
      ctx.fillStyle = '#228844'; ctx.beginPath(); ctx.arc(48, 50, 40, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#33aa55'; ctx.beginPath(); ctx.arc(48, 40, 30, 0, Math.PI * 2); ctx.fill();
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(96, 144), mat);
      mesh.renderOrder = 5;
      objGroup2.add(mesh);
      objGroup2._mainMesh = mesh;
      objGroup2._material = mat;
    })();
    objGroup2.position.set(-150, -80, 0);
    scene.add(objGroup2);

    // RenderTargets
    const pr = renderer.getPixelRatio();
    let rtW = Math.floor(W * pr);
    let rtH = Math.floor(H * pr);
    const rtParams = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
    let charMaskRT = new THREE.WebGLRenderTarget(rtW, rtH, rtParams);
    let objMaskRT = new THREE.WebGLRenderTarget(rtW, rtH, rtParams);
    let sceneRT = new THREE.WebGLRenderTarget(rtW, rtH, rtParams);

    // 실루엣 합성 셰이더
    const quadScene = new THREE.Scene();
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor:          { value: null },
        tCharMask:       { value: null },
        tObjMask:        { value: null },
        uFillColor:      { value: new THREE.Vector3(0.2, 0.4, 1.0) },
        uFillOpacity:    { value: 0.35 },
        uOutlineColor:   { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        uOutlineOpacity: { value: 0.8 },
        uOutlineWidth:   { value: 2.0 },
        uPattern:        { value: 0 },
        uPatternScale:   { value: 8.0 },
        uResolution:     { value: new THREE.Vector2(rtW, rtH) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tColor, tCharMask, tObjMask;
        uniform vec3 uFillColor, uOutlineColor;
        uniform float uFillOpacity, uOutlineOpacity, uOutlineWidth;
        uniform int uPattern;
        uniform float uPatternScale;
        uniform vec2 uResolution;
        varying vec2 vUv;

        float getOccluded(vec2 uv) {
          return step(0.01, texture2D(tCharMask, uv).a) * step(0.01, texture2D(tObjMask, uv).a);
        }
        float getPattern(vec2 p) {
          float s = uPatternScale;
          if (uPattern == 0) return 1.0;
          if (uPattern == 1) return 0.0;
          if (uPattern == 2) { float d = length(mod(p, vec2(s)) - vec2(s * 0.5)); return smoothstep(s*0.3, s*0.25, d); }
          if (uPattern == 3) { float d = mod(p.x + p.y, s); return smoothstep(s*0.4, s*0.35, d); }
          if (uPattern == 4) { float d1 = mod(p.x+p.y,s); float d2 = mod(p.x-p.y,s); return max(smoothstep(s*0.4,s*0.35,d1), smoothstep(s*0.4,s*0.35,d2)); }
          if (uPattern == 5) { return max(smoothstep(s*0.4,s*0.35,mod(p.x,s)), smoothstep(s*0.4,s*0.35,mod(p.y,s))); }
          return 1.0;
        }
        float edgeDetect(vec2 uv) {
          vec2 tx = 1.0 / uResolution;
          float center = getOccluded(uv);
          float maxN = 0.0;
          for (int dx = -1; dx <= 1; dx++)
            for (int dy = -1; dy <= 1; dy++)
              if (dx != 0 || dy != 0)
                maxN = max(maxN, getOccluded(uv + vec2(float(dx), float(dy)) * tx * uOutlineWidth));
          return maxN * (1.0 - center);
        }
        void main() {
          vec4 orig = texture2D(tColor, vUv);
          float occ = getOccluded(vUv);
          float edge = edgeDetect(vUv);
          vec3 col = mix(orig.rgb, uFillColor, occ * getPattern(vUv * uResolution) * uFillOpacity);
          col = mix(col, uOutlineColor, edge * uOutlineOpacity);
          gl_FragColor = vec4(col, orig.a);
        }
      `,
    });
    quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));

    // 디버그 캔버스
    const debugCharCanvas = document.createElement('canvas');
    debugCharCanvas.width = 160; debugCharCanvas.height = 120;
    debugCharCanvas.style.cssText = 'border:1px solid #444;';
    const debugObjCanvas = document.createElement('canvas');
    debugObjCanvas.width = 160; debugObjCanvas.height = 120;
    debugObjCanvas.style.cssText = 'border:1px solid #444;';

    function drawLabel(ctx: CanvasRenderingContext2D, text: string) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, ctx.canvas.width, 16);
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(text, 4, 12);
    }

    function updateDebugCanvas(ctx: CanvasRenderingContext2D, rt: any) {
      const dw = ctx.canvas.width, dh = ctx.canvas.height;
      const readW = Math.min(dw, rtW), readH = Math.min(dh, rtH);
      const buf = new Uint8Array(readW * readH * 4);
      renderer.readRenderTargetPixels(rt, 0, rtH - readH, readW, readH, buf);
      const imgData = ctx.createImageData(readW, readH);
      for (let y = 0; y < readH; y++) {
        const srcRow = (readH - 1 - y) * readW * 4;
        const dstRow = y * readW * 4;
        for (let x = 0; x < readW * 4; x++) imgData.data[dstRow + x] = buf[srcRow + x];
      }
      ctx.putImageData(imgData, 0, 0);
    }

    function hexToVec3(hex: string) {
      hex = hex.replace('#', '');
      return new THREE.Vector3(
        parseInt(hex.substr(0, 2), 16) / 255,
        parseInt(hex.substr(2, 2), 16) / 255,
        parseInt(hex.substr(4, 2), 16) / 255
      );
    }

    // 마우스 위치 추적
    let mouseX = 0, mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouseX = ((e.clientX - r.left) / r.width - 0.5) * camH * aspect;
      mouseY = -((e.clientY - r.top) / r.height - 0.5) * camH;
    };
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    const clearColor = new THREE.Color(0x000000);

    // stateRef에 현재 컨트롤 값 접근
    const s = stateRef.current;

    const animate = () => {
      const st = stateRef.current;
      charGroup.position.x = mouseX;
      charGroup.position.y = mouseY;

      const sc = st.objScale;
      objGroup.scale.set(sc, sc, 1);
      objGroup2.scale.set(sc * 0.7, sc * 0.7, 1);
      objGroup._material.opacity = st.objOpacity;
      objGroup2._material.opacity = st.objOpacity;
      charGroup._material.opacity = st.charOpacity;

      if (st.silhouetteEnabled) {
        scene._bgMesh.visible = false;
        renderer.setClearColor(clearColor, 0);

        objGroup.visible = false; objGroup2.visible = false;
        renderer.setRenderTarget(charMaskRT);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);

        charGroup.visible = false; objGroup.visible = true; objGroup2.visible = true;
        renderer.setRenderTarget(objMaskRT);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);

        charGroup.visible = true;
        scene._bgMesh.visible = true;

        renderer.setClearColor(sceneBgColor, 1);
        renderer.setRenderTarget(sceneRT);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);

        const u = quadMat.uniforms;
        u.tColor.value = sceneRT.texture;
        u.tCharMask.value = charMaskRT.texture;
        u.tObjMask.value = objMaskRT.texture;
        u.uFillColor.value = hexToVec3(st.fillColor);
        u.uFillOpacity.value = st.fillOpacity;
        u.uOutlineColor.value = hexToVec3(st.outlineColor);
        u.uOutlineOpacity.value = st.outlineOpacity;
        u.uOutlineWidth.value = st.outlineWidth;
        u.uPattern.value = st.pattern;
        u.uPatternScale.value = st.patternScale;
        u.uResolution.value.set(rtW, rtH);

        renderer.clear(true, true, true);
        renderer.render(quadScene, quadCamera);

        if (st.showDebug) {
          updateDebugCanvas(debugCharCanvas.getContext('2d')!, charMaskRT);
          drawLabel(debugCharCanvas.getContext('2d')!, 'CharMask');
          updateDebugCanvas(debugObjCanvas.getContext('2d')!, objMaskRT);
          drawLabel(debugObjCanvas.getContext('2d')!, 'ObjMask');
        }
      } else {
        renderer.setClearColor(sceneBgColor, 1);
        renderer.setRenderTarget(null);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    const onResize = () => {
      const r = container.getBoundingClientRect();
      W = r.width; H = r.height;
      aspect = W / H;
      renderer.setSize(W, H);
      camera.left = -camH * aspect / 2;
      camera.right = camH * aspect / 2;
      camera.top = camH / 2;
      camera.bottom = -camH / 2;
      camera.updateProjectionMatrix();
      const newPr = renderer.getPixelRatio();
      rtW = Math.floor(W * newPr);
      rtH = Math.floor(H * newPr);
      charMaskRT.setSize(rtW, rtH);
      objMaskRT.setSize(rtW, rtH);
      sceneRT.setSize(rtW, rtH);
    };
    window.addEventListener('resize', onResize);

    return { renderer, debugCharCanvas, debugObjCanvas, onResize, onMouseMove };
  }, []);

  // stateRef를 항상 최신 state로 동기화
  useEffect(() => {
    stateRef.current = {
      fillColor, fillOpacity, outlineColor, outlineOpacity, outlineWidth,
      pattern, patternScale, charOpacity, objOpacity, objScale,
      showDebug, silhouetteEnabled,
    };
  });

  const debugContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const result = initScene();
      if (!result) return;
      if (debugContainerRef.current) {
        debugContainerRef.current.innerHTML = '';
        debugContainerRef.current.style.cssText = 'display:flex;gap:4px;';
        debugContainerRef.current.appendChild(result.debugCharCanvas);
        debugContainerRef.current.appendChild(result.debugObjCanvas);
      }
      return () => {
        window.removeEventListener('resize', result.onResize);
        result.renderer.domElement.removeEventListener('mousemove', result.onMouseMove);
        result.renderer.dispose();
      };
    }, 100);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [initScene]);

  return (
    <div className="fow-test-page">
      <div className="fow-test-header">
        <button className="fow-back-btn" onClick={() => navigate('/')}>
          &larr; 메인
        </button>
        <h2>OcclusionSilhouette 테스트</h2>
        <span className="fow-test-hint">
          마우스로 캐릭터(파란 원) 이동 | 오브젝트 뒤로 가리면 실루엣 확인
        </span>
      </div>
      <div className="fow-test-body">
        <div style={{ position: 'relative', flex: 1, background: '#111', overflow: 'hidden' }}>
          <div className="fow-test-canvas" ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
          <div
            ref={debugContainerRef}
            style={{
              position: 'absolute', bottom: 10, right: 10,
              display: showDebug && silhouetteEnabled ? 'flex' : 'none',
              gap: 4, pointerEvents: 'none',
            }}
          />
        </div>
        <div className="fow-test-controls">
          <div className="fow-control-group">
            <h3>채우기</h3>
            <label>
              색상
              <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)}
                style={{ width: 40, height: 22, border: 'none', cursor: 'pointer', background: 'none' }} />
            </label>
            <label>
              불투명도: {fillOpacity.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={fillOpacity}
                onChange={(e) => setFillOpacity(Number(e.target.value))} />
            </label>
          </div>
          <div className="fow-control-group">
            <h3>외곽선</h3>
            <label>
              색상
              <input type="color" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)}
                style={{ width: 40, height: 22, border: 'none', cursor: 'pointer', background: 'none' }} />
            </label>
            <label>
              불투명도: {outlineOpacity.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={outlineOpacity}
                onChange={(e) => setOutlineOpacity(Number(e.target.value))} />
            </label>
            <label>
              두께: {outlineWidth}
              <input type="range" min={0} max={10} step={0.5} value={outlineWidth}
                onChange={(e) => setOutlineWidth(Number(e.target.value))} />
            </label>
          </div>
          <div className="fow-control-group">
            <h3>패턴</h3>
            <label>
              종류
              <select value={pattern} onChange={(e) => setPattern(Number(e.target.value))}
                style={{ background: '#333', color: '#ddd', border: '1px solid #555', padding: '2px 4px', marginTop: 2 }}>
                <option value={0}>solid</option>
                <option value={1}>empty</option>
                <option value={2}>dot</option>
                <option value={3}>diagonal</option>
                <option value={4}>cross</option>
                <option value={5}>hatch</option>
              </select>
            </label>
            <label>
              크기: {patternScale}
              <input type="range" min={2} max={32} step={1} value={patternScale}
                onChange={(e) => setPatternScale(Number(e.target.value))} />
            </label>
          </div>
          <div className="fow-control-group">
            <h3>씬 컨트롤</h3>
            <label>
              캐릭터 불투명도: {charOpacity.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={charOpacity}
                onChange={(e) => setCharOpacity(Number(e.target.value))} />
            </label>
            <label>
              오브젝트 불투명도: {objOpacity.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={objOpacity}
                onChange={(e) => setObjOpacity(Number(e.target.value))} />
            </label>
            <label>
              오브젝트 크기: {objScale.toFixed(1)}
              <input type="range" min={0.5} max={5} step={0.1} value={objScale}
                onChange={(e) => setObjScale(Number(e.target.value))} />
            </label>
          </div>
          <div className="fow-control-group">
            <h3>디버그</h3>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={silhouetteEnabled} onChange={(e) => setSilhouetteEnabled(e.target.checked)} />
              실루엣 효과 ON
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
              마스크 디버그 표시
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
