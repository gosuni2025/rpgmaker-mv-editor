import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './FogOfWarTestPage.css';

declare const THREE: any;

// ─────────────────────────────────────────────
// Parallax UV Fragment Shader (game용과 동일)
// ─────────────────────────────────────────────
const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PARALLAX_FRAG = `
  uniform sampler2D map;
  uniform float uTime;
  uniform float uScale;
  uniform float uStrength;
  uniform float uAnimSpeed;
  uniform float uAngleX;
  uniform float uAngleY;
  uniform float uInvert;
  uniform float uLayers;
  uniform float uShowHeight;   // 1 = 높이맵 디버그 표시
  varying vec2 vUv;

  void main() {
    vec2 viewDir;
    if (uAnimSpeed > 0.0) {
      viewDir = vec2(sin(uTime * uAnimSpeed), cos(uTime * uAnimSpeed * 0.7)) * 0.5;
    } else {
      viewDir = vec2(uAngleX, uAngleY);
    }

    // 반복 샘플로 정확도 향상
    vec2 uv = vUv;
    float h;
    float effectiveScale = uScale * uStrength;
    int steps = int(clamp(uLayers, 1.0, 4.0));
    for (int i = 0; i < 4; i++) {
      if (i >= steps) break;
      h = dot(texture2D(map, uv).rgb, vec3(0.299, 0.587, 0.114));
      if (uInvert > 0.5) h = 1.0 - h;
      uv = vUv - viewDir * h * effectiveScale;
    }

    if (uShowHeight > 0.5) {
      // 높이맵 시각화
      float lum = dot(texture2D(map, vUv).rgb, vec3(0.299, 0.587, 0.114));
      if (uInvert > 0.5) lum = 1.0 - lum;
      gl_FragColor = vec4(vec3(lum), 1.0);
    } else {
      gl_FragColor = texture2D(map, uv);
    }
  }
`;

// ─────────────────────────────────────────────
// 프로시저럴 테스트 텍스처 종류
// ─────────────────────────────────────────────
type TexturePreset = 'coin' | 'bricks' | 'hexagons' | 'landscape';

function generateTestTexture(preset: TexturePreset, size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  if (preset === 'coin') {
    // 중심이 밝고(높고), 테두리로 갈수록 어두운 동전 릴리프
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    bg.addColorStop(0.0, '#e8d8a0');
    bg.addColorStop(0.5, '#c0a060');
    bg.addColorStop(1.0, '#604020');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // 동심원 릴리프 링
    for (let r = 30; r < cx - 10; r += 48) {
      const grad = ctx.createRadialGradient(cx, cy, r - 12, cx, cy, r + 12);
      grad.addColorStop(0, 'rgba(255,230,150,0)');
      grad.addColorStop(0.4, 'rgba(255,240,180,0.55)');
      grad.addColorStop(0.6, 'rgba(255,240,180,0.55)');
      grad.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = grad as any;
      ctx.lineWidth = 20;
      ctx.stroke();
    }

    // 별 모양 장식 (높은 영역)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(255,245,200,0.7)';
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(0, -cx * 0.3, 6, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

  } else if (preset === 'bricks') {
    // 벽돌 패턴 (벽돌=밝음, 줄눈=어두움)
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, size, size);
    const bw = 80, bh = 36, mortar = 6;
    for (let row = 0; row < Math.ceil(size / bh) + 1; row++) {
      const offsetX = (row % 2) * (bw / 2);
      for (let col = -1; col < Math.ceil(size / bw) + 1; col++) {
        const x = col * bw + offsetX;
        const y = row * bh;
        const g = ctx.createLinearGradient(x, y, x + bw, y + bh);
        g.addColorStop(0, '#c87850');
        g.addColorStop(0.3, '#e09060');
        g.addColorStop(0.7, '#d08050');
        g.addColorStop(1, '#a06030');
        ctx.fillStyle = g;
        ctx.fillRect(x + mortar, y + mortar, bw - mortar * 2, bh - mortar * 2);
      }
    }

  } else if (preset === 'hexagons') {
    // 육각형 타일 패턴
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);
    const hr = 40;
    const hh = hr * Math.sqrt(3);
    for (let row = -1; row < Math.ceil(size / hh) + 2; row++) {
      for (let col = -1; col < Math.ceil(size / (hr * 1.5)) + 2; col++) {
        const hx = col * hr * 1.5;
        const hy = row * hh + (col % 2) * (hh / 2);
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr * 0.85);
        g.addColorStop(0, '#a0d0ff');
        g.addColorStop(0.6, '#4080c0');
        g.addColorStop(1, '#102040');
        ctx.fillStyle = g;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = hx + (hr - 3) * Math.cos(angle);
          const py = hy + (hr - 3) * Math.sin(angle);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

  } else if (preset === 'landscape') {
    // 지형 높이맵 느낌 (펄린 노이즈 근사)
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / size, ny = y / size;
        // 여러 주파수 합성으로 자연스러운 지형
        let v = 0;
        v += Math.sin(nx * 8 + 1.2) * Math.cos(ny * 6 + 0.5) * 0.4;
        v += Math.sin(nx * 16 + 0.7) * Math.cos(ny * 14 + 1.1) * 0.2;
        v += Math.sin(nx * 32 + 2.1) * Math.cos(ny * 28 + 0.8) * 0.1;
        v += Math.sin((nx + ny) * 12 + 0.3) * 0.15;
        v += Math.cos((nx - ny) * 9 + 1.7) * 0.15;
        // 중앙 산 형태
        const dx = nx - 0.5, dy = ny - 0.5;
        v += Math.exp(-(dx * dx + dy * dy) * 8) * 0.8;
        v = (v + 1) / 2;
        v = Math.max(0, Math.min(1, v));
        // 고도별 색상 (녹→갈→흰)
        let r, g, b;
        if (v < 0.3) { r = 20 + v * 60; g = 80 + v * 100; b = 20; }
        else if (v < 0.6) { r = 100 + (v - 0.3) * 300; g = 110 + (v - 0.3) * 100; b = 60; }
        else { r = 190 + (v - 0.6) * 160; g = 180 + (v - 0.6) * 160; b = 170 + (v - 0.6) * 200; }
        const idx = (y * size + x) * 4;
        data[idx] = Math.min(255, r);
        data[idx + 1] = Math.min(255, g);
        data[idx + 2] = Math.min(255, b);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas;
}

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────
export default function ParallaxUVTestPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const sceneRef = useRef<any>(null);

  const [scale, setScale] = useState(0.08);
  const [animSpeed, setAnimSpeed] = useState(0.5);
  const [angleX, setAngleX] = useState(0);
  const [angleY, setAngleY] = useState(0);
  const [invert, setInvert] = useState(false);
  const [layers, setLayers] = useState(3);
  const [showHeight, setShowHeight] = useState(false);
  const [preset, setPreset] = useState<TexturePreset>('coin');

  const paramsRef = useRef({ scale, animSpeed, angleX, angleY, invert, layers, showHeight });
  useEffect(() => {
    paramsRef.current = { scale, animSpeed, angleX, angleY, invert, layers, showHeight };
  });

  const presetRef = useRef<TexturePreset>(preset);

  const rebuild = useCallback((newPreset: TexturePreset) => {
    presetRef.current = newPreset;
    if (!sceneRef.current) return;
    const s = sceneRef.current;
    const texCanvas = generateTestTexture(newPreset);
    const tex = new THREE.CanvasTexture(texCanvas);
    tex.needsUpdate = true;
    s.material.uniforms.map.value = tex;
  }, []);

  const initScene = useCallback(() => {
    if (!canvasRef.current || typeof THREE === 'undefined') return;
    const container = canvasRef.current;

    const W = container.clientWidth || 800;
    const H = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // 프로시저럴 텍스처 생성
    const texCanvas = generateTestTexture(presetRef.current);
    const texture = new THREE.CanvasTexture(texCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: PARALLAX_FRAG,
      uniforms: {
        map:         { value: texture },
        uTime:       { value: 0 },
        uScale:      { value: paramsRef.current.scale },
        uStrength:   { value: 1.0 },
        uAnimSpeed:  { value: paramsRef.current.animSpeed },
        uAngleX:     { value: paramsRef.current.angleX },
        uAngleY:     { value: paramsRef.current.angleY },
        uInvert:     { value: 0 },
        uLayers:     { value: paramsRef.current.layers },
        uShowHeight: { value: 0 },
      },
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);

    // 마우스 이동 → 수동 시선 방향
    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const my = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
      paramsRef.current.angleX = mx * 0.8;
      paramsRef.current.angleY = my * 0.8;
    };
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    sceneRef.current = { renderer, scene, camera, material };

    const clock = new THREE.Clock();
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const p = paramsRef.current;
      const u = material.uniforms;
      u.uTime.value = t;
      u.uScale.value = p.scale;
      u.uAnimSpeed.value = p.animSpeed;
      u.uAngleX.value = p.angleX;
      u.uAngleY.value = p.angleY;
      u.uInvert.value = p.invert ? 1 : 0;
      u.uLayers.value = p.layers;
      u.uShowHeight.value = p.showHeight ? 1 : 0;
      renderer.render(scene, camera);
    };
    animate();
  }, []);

  useEffect(() => {
    initScene();
    return () => {
      cancelAnimationFrame(rafRef.current);
      sceneRef.current?.renderer?.dispose();
      sceneRef.current = null;
    };
  }, [initScene]);

  const PRESETS: { key: TexturePreset; label: string }[] = [
    { key: 'coin',      label: '동전 릴리프' },
    { key: 'bricks',    label: '벽돌' },
    { key: 'hexagons',  label: '육각형 타일' },
    { key: 'landscape', label: '지형' },
  ];

  return (
    <div className="fow-test-page">
      <div className="fow-test-header">
        <button className="fow-back-btn" onClick={() => navigate('/editor')}>← 뒤로</button>
        <h2>Parallax UV 테스트</h2>
        <span className="fow-test-hint">
          마우스를 캔버스 위에서 움직이면 시차 효과 확인 (애니메이션 꺼야 수동 제어)
        </span>
      </div>

      <div className="fow-test-body">
        <div className="fow-test-canvas" ref={canvasRef} />

        <div className="fow-test-controls">

          {/* 프리셋 */}
          <div className="fow-control-group">
            <h3>테스트 텍스처</h3>
            <div className="fow-mode-buttons" style={{ flexWrap: 'wrap', gap: 4 }}>
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  className={`fow-mode-btn ${preset === p.key ? 'active' : ''}`}
                  onClick={() => { setPreset(p.key); rebuild(p.key); }}
                  style={{ flex: '1 1 calc(50% - 4px)' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 시차 설정 */}
          <div className="fow-control-group">
            <h3>시차 설정</h3>
            <label>
              깊이 (Scale): {scale.toFixed(3)}
              <input type="range" min={0} max={0.2} step={0.001}
                value={scale} onChange={e => setScale(+e.target.value)} />
            </label>
            <label>
              샘플 수 (Layers): {layers}
              <input type="range" min={1} max={4} step={1}
                value={layers} onChange={e => setLayers(+e.target.value)} />
            </label>
          </div>

          {/* 시선 방향 */}
          <div className="fow-control-group">
            <h3>시선 방향</h3>
            <label>
              자동 회전 속도: {animSpeed.toFixed(2)}
              <input type="range" min={0} max={3} step={0.05}
                value={animSpeed} onChange={e => setAnimSpeed(+e.target.value)} />
            </label>
            {animSpeed === 0 && (
              <>
                <label>
                  수동 X 각도: {angleX.toFixed(2)}
                  <input type="range" min={-1} max={1} step={0.01}
                    value={angleX} onChange={e => setAngleX(+e.target.value)} />
                </label>
                <label>
                  수동 Y 각도: {angleY.toFixed(2)}
                  <input type="range" min={-1} max={1} step={0.01}
                    value={angleY} onChange={e => setAngleY(+e.target.value)} />
                </label>
                <p className="fow-info">※ 속도=0 일 때 마우스 이동으로도 제어 가능</p>
              </>
            )}
          </div>

          {/* 디버그 */}
          <div className="fow-control-group">
            <h3>디버그</h3>
            <label style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={invert} onChange={e => setInvert(e.target.checked)} />
              높이맵 반전
            </label>
            <label style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={showHeight} onChange={e => setShowHeight(e.target.checked)} />
              높이맵 미리보기
            </label>
          </div>

          {/* 설명 */}
          <div className="fow-control-group">
            <h3>원리</h3>
            <p className="fow-info">
              텍스처의 <b>휘도(밝기)</b>를 높이맵으로 사용.
              밝은 영역이 "높은" 곳, 어두운 영역이 "낮은" 곳.
              시선 방향에 따라 UV가 오프셋되어 입체감이 생김.
            </p>
            <p className="fow-info" style={{ marginTop: 4 }}>
              <b>PictureShader.js</b>에 <code>parallaxUV</code> 이름으로 등록됨.
              게임 이벤트 커맨드로 픽처에 적용 가능.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
