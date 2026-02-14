import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import ImagePicker from '../common/ImagePicker';
import { TINT_PRESETS, TintColorPreview } from './screenEffectEditors';

// ─── 셰이더 프리뷰 컴포넌트 ───
declare const THREE: any;
declare const PictureShader: any;

interface ShaderEntry { type: string; enabled: boolean; params: Record<string, number> }

function ShaderPreviewCanvas({ imageName, shaderList, size = 280 }: {
  imageName: string; shaderList: ShaderEntry[]; size?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: any; scene: any; camera: any; mesh: any;
    originalMaterial: any; texture: any;
    materials: any[]; renderTargets: any[]; outputMaterial: any;
    fullscreenQuad: any; fullscreenScene: any;
    animId: number; startTime: number; loadedImage: string;
    hasShake: boolean; canvasSize: number;
  } | null>(null);

  // Three.js 씬 초기화
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof THREE === 'undefined') return;

    const W = size, H = size;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setClearColor(0x1a1a1a, 1);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1, 1);

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // 체커보드 배경
    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 256; checkerCanvas.height = 256;
    const ctx = checkerCanvas.getContext('2d')!;
    const cSize = 16;
    for (let y = 0; y < 256; y += cSize) {
      for (let x = 0; x < 256; x += cSize) {
        ctx.fillStyle = ((x + y) / cSize) % 2 === 0 ? '#333' : '#444';
        ctx.fillRect(x, y, cSize, cSize);
      }
    }
    const checkerTex = new THREE.CanvasTexture(checkerCanvas);
    checkerTex.wrapS = THREE.RepeatWrapping;
    checkerTex.wrapT = THREE.RepeatWrapping;
    const bgMat = new THREE.MeshBasicMaterial({ map: checkerTex, depthTest: false });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), bgMat);
    bgMesh.position.z = -0.5;
    bgMesh.frustumCulled = false;
    scene.add(bgMesh);

    // 풀스크린 쿼드 (멀티패스용)
    const fsScene = new THREE.Scene();
    const fsGeo = new THREE.PlaneGeometry(2, 2);
    const fsMat = new THREE.MeshBasicMaterial();
    const fsQuad = new THREE.Mesh(fsGeo, fsMat);
    fsQuad.frustumCulled = false;
    fsScene.add(fsQuad);

    stateRef.current = {
      renderer, scene, camera, mesh,
      originalMaterial: mat, texture: null,
      materials: [], renderTargets: [], outputMaterial: mat,
      fullscreenQuad: fsQuad, fullscreenScene: fsScene,
      animId: 0, startTime: performance.now() / 1000, loadedImage: '',
      hasShake: false, canvasSize: W,
    };

    const fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    const animate = () => {
      const s = stateRef.current;
      if (!s) return;
      const time = performance.now() / 1000 - s.startTime;

      // 멀티패스 렌더링
      if (s.materials.length > 0 && s.texture) {
        let inputTex = s.texture;
        for (let i = 0; i < s.materials.length; i++) {
          const m = s.materials[i];
          if (m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = time;
          if (m.uniforms && m.uniforms.map) m.uniforms.map.value = inputTex;
          s.fullscreenQuad.material = m;
          const rt = s.renderTargets[i];
          s.renderer.setRenderTarget(rt);
          s.renderer.render(s.fullscreenScene, fsCamera);
          inputTex = rt.texture;
        }
        s.renderer.setRenderTarget(null);
        s.outputMaterial.map = inputTex;
        s.outputMaterial.needsUpdate = true;
      }

      // shake offset
      if (s.hasShake) {
        const shakeEntry = shaderList.find(e => e.type === 'shake' && e.enabled);
        if (shakeEntry) {
          const p = shakeEntry.params;
          const power = p.power ?? 5;
          const speed = p.speed ?? 10;
          const dir = p.direction ?? 2;
          const t = time * speed;
          let dx = 0, dy = 0;
          if (dir === 0 || dir === 2) dx = (Math.sin(t * 7.13) + Math.sin(t * 5.71) * 0.5) * power;
          if (dir === 1 || dir === 2) dy = (Math.sin(t * 6.47) + Math.sin(t * 4.93) * 0.5) * power;
          s.mesh.position.x = dx;
          s.mesh.position.y = -dy;
        }
      } else {
        s.mesh.position.x = 0;
        s.mesh.position.y = 0;
      }

      s.renderer.render(s.scene, s.camera);
      s.animId = requestAnimationFrame(animate);
    };
    stateRef.current.animId = requestAnimationFrame(animate);

    return () => {
      const s = stateRef.current;
      if (s) {
        cancelAnimationFrame(s.animId);
        s.materials.forEach((m: any) => m.dispose());
        s.renderTargets.forEach((rt: any) => rt.dispose());
        s.renderer.dispose();
        s.renderer.domElement.remove();
        if (s.texture) s.texture.dispose();
        if (s.originalMaterial) s.originalMaterial.dispose();
        stateRef.current = null;
      }
    };
  }, []);

  // 이미지 로드
  useEffect(() => {
    const s = stateRef.current;
    if (!s || typeof THREE === 'undefined') return;
    if (!imageName) {
      s.mesh.visible = false;
      s.loadedImage = '';
      return;
    }
    if (s.loadedImage === imageName) return;
    s.loadedImage = imageName;

    const loader = new THREE.TextureLoader();
    loader.load(`/img/pictures/${imageName}.png`, (tex: any) => {
      if (!stateRef.current || stateRef.current.loadedImage !== imageName) {
        tex.dispose();
        return;
      }
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      if (stateRef.current.texture) stateRef.current.texture.dispose();
      stateRef.current.texture = tex;

      const img = tex.image;
      const CS = stateRef.current.canvasSize;
      const scale = Math.min(CS / img.width, CS / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      stateRef.current.mesh.geometry.dispose();
      stateRef.current.mesh.geometry = new THREE.PlaneGeometry(w, h);
      stateRef.current.mesh.visible = true;

      // material에 텍스처 설정 (셰이더 없는 경우)
      const mat = stateRef.current.outputMaterial;
      if (mat === stateRef.current.originalMaterial) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
    });
  }, [imageName]);

  // 셰이더 변경 - 멀티패스 지원
  useEffect(() => {
    const s = stateRef.current;
    if (!s || typeof PictureShader === 'undefined' || typeof THREE === 'undefined') return;

    // 기존 리소스 정리
    s.materials.forEach((m: any) => m.dispose());
    s.renderTargets.forEach((rt: any) => rt.dispose());
    s.materials = [];
    s.renderTargets = [];

    const renderPasses = shaderList.filter(e => e.enabled && e.type !== 'shake');
    s.hasShake = shaderList.some(e => e.enabled && e.type === 'shake');

    if (renderPasses.length === 0) {
      // 셰이더 없음 - 원래 material 사용
      s.outputMaterial = s.originalMaterial;
      s.mesh.material = s.originalMaterial;
      if (s.texture) {
        s.originalMaterial.map = s.texture;
        s.originalMaterial.needsUpdate = true;
      }
      if (!s.hasShake) {
        s.mesh.position.x = 0;
        s.mesh.position.y = 0;
      }
      return;
    }

    // 멀티패스 셋업
    const CS = s.canvasSize;
    for (const entry of renderPasses) {
      const mat = PictureShader.createMaterial(entry.type, entry.params, s.texture);
      if (mat) {
        s.materials.push(mat);
        const rt = new THREE.WebGLRenderTarget(CS, CS, {
          minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
        });
        s.renderTargets.push(rt);
      }
    }

    // 출력 material (MeshBasicMaterial)
    const outMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide });
    s.outputMaterial = outMat;
    s.mesh.material = outMat;
  }, [shaderList]);

  return (
    <div ref={containerRef} style={{
      width: size, height: size, flexShrink: 0,
      border: '1px solid #555', borderRadius: 4, overflow: 'hidden',
    }} />
  );
}

// ─── 셰이더 정의 ───
interface ShaderParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  type?: 'slider' | 'select';
  options?: { value: number; label: string }[];
}

interface ShaderDef {
  type: string;
  label: string;
  params: ShaderParamDef[];
}

const SHADER_DEFINITIONS: ShaderDef[] = [
  { type: 'wave', label: '물결', params: [
    { key: 'amplitude', label: '진폭', min: 0, max: 50, step: 1, defaultValue: 10 },
    { key: 'frequency', label: '빈도', min: 0.1, max: 20, step: 0.1, defaultValue: 5 },
    { key: 'speed', label: '속도', min: 0.1, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'direction', label: '방향', min: 0, max: 2, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '수평' }, { value: 1, label: '수직' }, { value: 2, label: '양방향' }
    ]},
  ]},
  { type: 'glitch', label: '글리치', params: [
    { key: 'intensity', label: '강도', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'rgbShift', label: 'RGB 쉬프트', min: 0, max: 30, step: 1, defaultValue: 5 },
    { key: 'lineSpeed', label: '라인 속도', min: 0.1, max: 10, step: 0.1, defaultValue: 3 },
    { key: 'blockSize', label: '블록 크기', min: 1, max: 50, step: 1, defaultValue: 8 },
  ]},
  { type: 'dissolve', label: '디졸브', params: [
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'animSpeed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 1 },
    { key: 'thresholdMin', label: '임계값 최소', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'thresholdMax', label: '임계값 최대', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'threshold', label: '임계값 (고정)', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'edgeWidth', label: '경계 넓이', min: 0, max: 0.2, step: 0.01, defaultValue: 0.05 },
    { key: 'edgeColorR', label: '경계색 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'edgeColorG', label: '경계색 G', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'edgeColorB', label: '경계색 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'noiseScale', label: '노이즈 크기', min: 1, max: 50, step: 1, defaultValue: 10 },
  ]},
  { type: 'glow', label: '발광', params: [
    { key: 'intensity', label: '강도', min: 0, max: 3, step: 0.1, defaultValue: 1 },
    { key: 'radius', label: '반경', min: 0, max: 20, step: 1, defaultValue: 4 },
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
  ]},
  { type: 'chromatic', label: '색수차', params: [
    { key: 'offset', label: '오프셋', min: 0, max: 20, step: 1, defaultValue: 3 },
    { key: 'angle', label: '각도', min: 0, max: 360, step: 1, defaultValue: 0 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
  ]},
  { type: 'pixelate', label: '픽셀화', params: [
    { key: 'size', label: '크기 (고정)', min: 1, max: 64, step: 1, defaultValue: 8 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'minSize', label: '최소 크기', min: 1, max: 64, step: 1, defaultValue: 2 },
    { key: 'maxSize', label: '최대 크기', min: 1, max: 64, step: 1, defaultValue: 16 },
  ]},
  { type: 'shake', label: '흔들림', params: [
    { key: 'power', label: '파워', min: 0, max: 50, step: 1, defaultValue: 5 },
    { key: 'speed', label: '속도', min: 0.1, max: 30, step: 0.1, defaultValue: 10 },
    { key: 'direction', label: '방향', min: 0, max: 2, step: 1, defaultValue: 2, type: 'select', options: [
      { value: 0, label: '수평' }, { value: 1, label: '수직' }, { value: 2, label: '양방향' }
    ]},
  ]},
  { type: 'blur', label: '흐림', params: [
    { key: 'strength', label: '강도 (고정)', min: 0, max: 20, step: 1, defaultValue: 4 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'minStrength', label: '최소 강도', min: 0, max: 20, step: 1, defaultValue: 0 },
    { key: 'maxStrength', label: '최대 강도', min: 0, max: 20, step: 1, defaultValue: 8 },
  ]},
  { type: 'rainbow', label: '무지개', params: [
    { key: 'speed', label: '속도', min: 0.1, max: 10, step: 0.1, defaultValue: 1 },
    { key: 'saturation', label: '채도', min: 0, max: 2, step: 0.01, defaultValue: 0.5 },
    { key: 'brightness', label: '밝기', min: 0, max: 2, step: 0.01, defaultValue: 0.1 },
  ]},
  { type: 'hologram', label: '홀로그램', params: [
    { key: 'scanlineSpacing', label: '스캔라인 간격', min: 1, max: 20, step: 1, defaultValue: 4 },
    { key: 'scanlineAlpha', label: '스캔라인 투명도', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'flickerSpeed', label: '깜빡임 속도', min: 0, max: 20, step: 1, defaultValue: 5 },
    { key: 'flickerIntensity', label: '깜빡임 강도', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { key: 'rgbShift', label: 'RGB 쉬프트', min: 0, max: 10, step: 1, defaultValue: 2 },
    { key: 'tintR', label: '틴트 R', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'tintG', label: '틴트 G', min: 0, max: 1, step: 0.01, defaultValue: 0.8 },
    { key: 'tintB', label: '틴트 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'outline', label: '외곽선', params: [
    { key: 'thickness', label: '두께', min: 1, max: 10, step: 1, defaultValue: 3 },
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { key: 'intensity', label: '강도', min: 0, max: 3, step: 0.1, defaultValue: 1.5 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'animSpeed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMin', label: '애니 최소', min: 0, max: 3, step: 0.1, defaultValue: 0.8 },
    { key: 'animMax', label: '애니 최대', min: 0, max: 3, step: 0.1, defaultValue: 2.0 },
  ]},
  { type: 'fireAura', label: '불꽃 오라', params: [
    { key: 'radius', label: '반경', min: 1, max: 20, step: 1, defaultValue: 12 },
    { key: 'intensity', label: '강도', min: 0, max: 3, step: 0.1, defaultValue: 1.2 },
    { key: 'speed', label: '불꽃 속도', min: 0.1, max: 5, step: 0.1, defaultValue: 1.5 },
    { key: 'noiseScale', label: '노이즈 크기', min: 1, max: 30, step: 1, defaultValue: 8 },
    { key: 'innerColorR', label: '안쪽 색 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'innerColorG', label: '안쪽 색 G', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
    { key: 'innerColorB', label: '안쪽 색 B', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'outerColorR', label: '바깥 색 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'outerColorG', label: '바깥 색 G', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'outerColorB', label: '바깥 색 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'turbulence', label: '난류', min: 0, max: 5, step: 0.1, defaultValue: 1.5 },
    { key: 'flameHeight', label: '불꽃 높이', min: 0, max: 3, step: 0.1, defaultValue: 1.0 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'animSpeed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 1 },
  ]},
  // ── 새 셰이더 (AllIn1SpriteShader 기반) ──
  { type: 'greyscale', label: '그레이스케일', params: [
    { key: 'luminosity', label: '밝기 보정', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'tintR', label: '틴트 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'tintG', label: '틴트 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'tintB', label: '틴트 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'negative', label: '네거티브', params: [
    { key: 'amount', label: '적용량', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'hitEffect', label: '히트 플래시', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'glow', label: '발광 강도', min: 1, max: 100, step: 1, defaultValue: 5 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'shine', label: '광택', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'location', label: '위치', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'rotate', label: '회전 (라디안)', min: 0, max: 6.28, step: 0.01, defaultValue: 0 },
    { key: 'width', label: '너비', min: 0.05, max: 1, step: 0.01, defaultValue: 0.1 },
    { key: 'glowAmount', label: '발광', min: 0, max: 100, step: 1, defaultValue: 1 },
    { key: 'speed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 1 },
  ]},
  { type: 'flicker', label: '깜빡임', params: [
    { key: 'percent', label: '깜빡임 비율', min: 0, max: 1, step: 0.01, defaultValue: 0.05 },
    { key: 'freq', label: '빈도', min: 0, max: 5, step: 0.01, defaultValue: 0.2 },
    { key: 'alpha', label: '최소 알파', min: 0, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'gradient', label: '그래디언트', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftR', label: '좌상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftG', label: '좌상 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftB', label: '좌상 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftA', label: '좌상 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topRightR', label: '우상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topRightG', label: '우상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topRightB', label: '우상 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topRightA', label: '우상 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftR', label: '좌하 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftG', label: '좌하 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftB', label: '좌하 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftA', label: '좌하 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botRightR', label: '우하 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botRightG', label: '우하 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botRightB', label: '우하 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botRightA', label: '우하 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'boostX', label: 'X축 부스트', min: 0.1, max: 5, step: 0.1, defaultValue: 1.2 },
    { key: 'boostY', label: 'Y축 부스트', min: 0.1, max: 5, step: 0.1, defaultValue: 1.2 },
    { key: 'radial', label: '방사형', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '선형' }, { value: 1, label: '방사형' }
    ]},
  ]},
  { type: 'gradient2col', label: '2색 그래디언트', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftR', label: '상단 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftG', label: '상단 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftB', label: '상단 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftA', label: '상단 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftR', label: '하단 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftG', label: '하단 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftB', label: '하단 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftA', label: '하단 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'boostY', label: 'Y축 부스트', min: 0.1, max: 5, step: 0.1, defaultValue: 1.2 },
  ]},
  { type: 'radialGradient', label: '방사형 그래디언트', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftR', label: '중심 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftG', label: '중심 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftB', label: '중심 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftA', label: '중심 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftR', label: '외곽 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftG', label: '외곽 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftB', label: '외곽 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftA', label: '외곽 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'boostX', label: '부스트', min: 0.1, max: 5, step: 0.1, defaultValue: 1.2 },
  ]},
  { type: 'colorSwap', label: '색상 스왑', params: [
    { key: 'redNewR', label: 'R→새R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'redNewG', label: 'R→새G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'redNewB', label: 'R→새B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'greenNewR', label: 'G→새R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'greenNewG', label: 'G→새G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'greenNewB', label: 'G→새B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueNewR', label: 'B→새R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueNewG', label: 'B→새G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueNewB', label: 'B→새B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'redLum', label: 'R 밝기', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'greenLum', label: 'G 밝기', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueLum', label: 'B 밝기', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'hsv', label: 'HSV 시프트', params: [
    { key: 'hsvShift', label: '색조 시프트', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'hsvSaturation', label: '채도', min: -2, max: 2, step: 0.01, defaultValue: 0 },
    { key: 'hsvBright', label: '밝기', min: -2, max: 2, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'contrast', label: '명도/대비', params: [
    { key: 'contrast', label: '대비', min: 0, max: 3, step: 0.01, defaultValue: 1 },
    { key: 'brightness', label: '밝기', min: -1, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'motionBlur', label: '모션 블러', params: [
    { key: 'angle', label: '각도', min: -1, max: 1, step: 0.01, defaultValue: 0.1 },
    { key: 'dist', label: '거리', min: -3, max: 3, step: 0.01, defaultValue: 1.25 },
  ]},
  { type: 'ghost', label: '고스트', params: [
    { key: 'colorBoost', label: '색상 부스트', min: 0, max: 5, step: 0.1, defaultValue: 1 },
    { key: 'transparency', label: '투명도', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'shadow', label: '드롭 섀도우', params: [
    { key: 'shadowX', label: 'X 오프셋', min: -0.5, max: 0.5, step: 0.01, defaultValue: 0.1 },
    { key: 'shadowY', label: 'Y 오프셋', min: -0.5, max: 0.5, step: 0.01, defaultValue: -0.05 },
    { key: 'shadowAlpha', label: '그림자 알파', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'shadowColorR', label: '그림자 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'shadowColorG', label: '그림자 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'shadowColorB', label: '그림자 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'doodle', label: '손그림', params: [
    { key: 'amount', label: '양', min: 0, max: 20, step: 1, defaultValue: 10 },
    { key: 'speed', label: '속도', min: 1, max: 15, step: 1, defaultValue: 5 },
  ]},
  { type: 'warp', label: '워프', params: [
    { key: 'strength', label: '강도', min: 0, max: 0.1, step: 0.001, defaultValue: 0.025 },
    { key: 'speed', label: '속도', min: 0, max: 25, step: 0.5, defaultValue: 8 },
    { key: 'scale', label: '스케일', min: 0.05, max: 3, step: 0.05, defaultValue: 0.5 },
  ]},
  { type: 'twist', label: '트위스트', params: [
    { key: 'amount', label: '회전량', min: 0, max: 3.14, step: 0.01, defaultValue: 1 },
    { key: 'posX', label: '중심 X', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'posY', label: '중심 Y', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'radius', label: '반경', min: 0, max: 3, step: 0.01, defaultValue: 0.75 },
    { key: 'speed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'roundWave', label: '원형 파동', params: [
    { key: 'strength', label: '강도', min: 0, max: 1, step: 0.01, defaultValue: 0.7 },
    { key: 'speed', label: '속도', min: 0, max: 5, step: 0.1, defaultValue: 2 },
  ]},
  { type: 'fisheye', label: '어안 렌즈', params: [
    { key: 'amount', label: '왜곡량', min: 0, max: 0.5, step: 0.01, defaultValue: 0.35 },
    { key: 'speed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'pinch', label: '핀치', params: [
    { key: 'amount', label: '왜곡량', min: 0, max: 0.5, step: 0.01, defaultValue: 0.35 },
    { key: 'speed', label: '애니 속도', min: 0, max: 10, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'overlay', label: '오버레이', params: [
    { key: 'overlayColorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'overlayColorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'overlayColorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'overlayGlow', label: '발광', min: 0, max: 25, step: 0.1, defaultValue: 1 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'multiply', label: '모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '가산' }, { value: 1, label: '곱하기' }
    ]},
  ]},
  { type: 'wind', label: '바람', params: [
    { key: 'speed', label: '속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'wind', label: '바람 세기', min: 0, max: 20, step: 0.5, defaultValue: 5 },
  ]},
  { type: 'textureScroll', label: '텍스처 스크롤', params: [
    { key: 'speedX', label: 'X 속도', min: -5, max: 5, step: 0.01, defaultValue: 0.25 },
    { key: 'speedY', label: 'Y 속도', min: -5, max: 5, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'zoomUV', label: 'UV 줌', params: [
    { key: 'zoom', label: '줌', min: 0.1, max: 5, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'rotateUV', label: 'UV 회전', params: [
    { key: 'angle', label: '각도 (라디안)', min: 0, max: 6.28, step: 0.01, defaultValue: 0 },
    { key: 'speed', label: '회전 속도', min: 0, max: 5, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'polarUV', label: '극좌표 변환', params: [
    { key: 'speed', label: '회전 속도', min: 0, max: 5, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'offsetUV', label: 'UV 오프셋', params: [
    { key: 'offsetX', label: 'X 오프셋', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'offsetY', label: 'Y 오프셋', min: -1, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'clipping', label: '사각형 클리핑', params: [
    { key: 'left', label: '왼쪽', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'right', label: '오른쪽', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'up', label: '위', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'down', label: '아래', min: 0, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'radialClipping', label: '방사형 클리핑', params: [
    { key: 'startAngle', label: '시작 각도', min: 0, max: 360, step: 1, defaultValue: 0 },
    { key: 'clip', label: '클리핑', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'innerOutline', label: '내부 아웃라인', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'width', label: '두께', min: 1, max: 10, step: 1, defaultValue: 2 },
    { key: 'alpha', label: '알파', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'onlyOutline', label: '아웃라인만', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '아니오' }, { value: 1, label: '예' }
    ]},
  ]},
  { type: 'alphaOutline', label: '알파 아웃라인', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'glow', label: '발광', min: 0, max: 25, step: 0.1, defaultValue: 1 },
    { key: 'power', label: '파워', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'minAlpha', label: '최소 알파', min: 0, max: 1, step: 0.01, defaultValue: 0.1 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'distort', label: '왜곡', params: [
    { key: 'amount', label: '왜곡량', min: 0, max: 3, step: 0.01, defaultValue: 0.5 },
    { key: 'speedX', label: 'X 속도', min: -5, max: 5, step: 0.1, defaultValue: 0.5 },
    { key: 'speedY', label: 'Y 속도', min: -5, max: 5, step: 0.1, defaultValue: 0.3 },
    { key: 'scale', label: '스케일', min: 1, max: 30, step: 1, defaultValue: 5 },
  ]},
  { type: 'colorRamp', label: '컬러 램프', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'luminosity', label: '밝기 보정', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'colorDarkR', label: '어두운 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'colorDarkG', label: '어두운 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'colorDarkB', label: '어두운 B', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'colorMidR', label: '중간 R', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'colorMidG', label: '중간 G', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { key: 'colorMidB', label: '중간 B', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'colorLightR', label: '밝은 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorLightG', label: '밝은 G', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
    { key: 'colorLightB', label: '밝은 B', min: 0, max: 1, step: 0.01, defaultValue: 0.7 },
  ]},
  { type: 'onlyOutline', label: '외곽선만', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'thickness', label: '두께', min: 1, max: 10, step: 1, defaultValue: 2 },
    { key: 'glow', label: '발광', min: 0, max: 5, step: 0.1, defaultValue: 1 },
  ]},
  { type: 'shakeUV', label: 'UV 떨림', params: [
    { key: 'speed', label: '속도', min: 0, max: 15, step: 0.5, defaultValue: 5 },
    { key: 'shakeX', label: 'X 떨림', min: 0, max: 20, step: 0.5, defaultValue: 5 },
    { key: 'shakeY', label: 'Y 떨림', min: 0, max: 20, step: 0.5, defaultValue: 5 },
  ]},
];

// ─── 셰이더 에디터 다이얼로그 (전체화면) ───
function ShaderEditorDialog({ imageName, shaderList: initialList, onOk, onCancel }: {
  imageName: string;
  shaderList: ShaderEntry[];
  onOk: (shaderList: ShaderEntry[]) => void;
  onCancel: () => void;
}) {
  const [shaderList, setShaderList] = useState<ShaderEntry[]>(initialList.map(s => ({ ...s, params: { ...s.params } })));
  const [selectedShaderIdx, setSelectedShaderIdx] = useState<number>(0);

  const addShader = () => {
    const def = SHADER_DEFINITIONS[0];
    const params: Record<string, number> = {};
    def.params.forEach(pd => { params[pd.key] = pd.defaultValue; });
    const newList = [...shaderList, { type: def.type, enabled: true, params }];
    setShaderList(newList);
    setSelectedShaderIdx(newList.length - 1);
  };

  const removeShader = (idx: number) => {
    const newList = shaderList.filter((_, i) => i !== idx);
    setShaderList(newList);
    setSelectedShaderIdx(Math.min(selectedShaderIdx, Math.max(0, newList.length - 1)));
  };

  const updateShaderType = (idx: number, newType: string) => {
    const def = SHADER_DEFINITIONS.find(d => d.type === newType);
    const params: Record<string, number> = {};
    def?.params.forEach(pd => { params[pd.key] = pd.defaultValue; });
    setShaderList(prev => prev.map((s, i) => i === idx ? { ...s, type: newType, params } : s));
  };

  const updateShaderParam = (idx: number, key: string, value: number) => {
    setShaderList(prev => prev.map((s, i) => i === idx ? { ...s, params: { ...s.params, [key]: value } } : s));
  };

  const moveShader = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= shaderList.length) return;
    const newList = [...shaderList];
    [newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]];
    setShaderList(newList);
    setSelectedShaderIdx(newIdx);
  };

  const selectedShader = shaderList[selectedShaderIdx];
  const selectedShaderDef = selectedShader ? SHADER_DEFINITIONS.find(d => d.type === selectedShader.type) : null;
  const labelStyle: React.CSSProperties = { fontSize: 13, color: '#aaa' };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: '90vw', maxWidth: 1200, height: '85vh', maxHeight: 900, display: 'flex', flexDirection: 'column' }}>
        <div className="image-picker-header">셰이더 이펙트 설정</div>
        <div style={{ flex: 1, overflow: 'hidden', padding: 16, display: 'flex', gap: 16 }}>
          {/* 좌측: 프리뷰 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <ShaderPreviewCanvas imageName={imageName} shaderList={shaderList} size={480} />
          </div>
          {/* 우측: 셰이더 리스트 + 파라미터 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            {/* 셰이더 리스트 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#ddd', flex: 1 }}>이펙트 목록</span>
              <button className="db-btn" onClick={addShader}>추가</button>
            </div>
            <div style={{
              border: '1px solid #444', borderRadius: 4, background: '#1e1e1e',
              minHeight: 80, maxHeight: 200, overflowY: 'auto', flexShrink: 0,
            }}>
              {shaderList.length === 0 && (
                <div style={{ color: '#666', fontSize: 13, padding: '20px 12px', textAlign: 'center' }}>
                  셰이더 없음 - 추가 버튼으로 이펙트를 추가하세요
                </div>
              )}
              {shaderList.map((entry, idx) => {
                const def = SHADER_DEFINITIONS.find(d => d.type === entry.type);
                return (
                  <div key={idx}
                    onClick={() => setSelectedShaderIdx(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', cursor: 'pointer', fontSize: 13,
                      background: idx === selectedShaderIdx ? '#2675bf' : 'transparent',
                      color: idx === selectedShaderIdx ? '#fff' : '#ccc',
                    }}>
                    <span style={{ flex: 1 }}>{idx + 1}. {def?.label ?? entry.type}</span>
                    <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px' }}
                      onClick={e => { e.stopPropagation(); moveShader(idx, -1); }}
                      disabled={idx === 0} title="위로">▲</button>
                    <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px' }}
                      onClick={e => { e.stopPropagation(); moveShader(idx, 1); }}
                      disabled={idx === shaderList.length - 1} title="아래로">▼</button>
                    <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px', color: '#f88' }}
                      onClick={e => { e.stopPropagation(); removeShader(idx); }}
                      title="삭제">✕</button>
                  </div>
                );
              })}
            </div>
            {/* 선택된 셰이더 파라미터 */}
            {selectedShader && selectedShaderDef && (
              <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #444', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ ...labelStyle, fontSize: 14 }}>
                  타입:
                  <select value={selectedShader.type}
                    onChange={e => updateShaderType(selectedShaderIdx, e.target.value)}
                    style={{ ...selectStyle, marginLeft: 8, fontSize: 13 }}>
                    {SHADER_DEFINITIONS.map(sd => (
                      <option key={sd.type} value={sd.type}>{sd.label}</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                  {selectedShaderDef.params.map(pd => (
                    <label key={pd.key} style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ minWidth: 90, flexShrink: 0 }}>{pd.label}:</span>
                      {pd.type === 'select' && pd.options ? (
                        <select value={selectedShader.params[pd.key] ?? pd.defaultValue}
                          onChange={e => updateShaderParam(selectedShaderIdx, pd.key, Number(e.target.value))}
                          style={{ ...selectStyle, flex: 1 }}>
                          {pd.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input type="range" min={pd.min} max={pd.max} step={pd.step}
                            value={selectedShader.params[pd.key] ?? pd.defaultValue}
                            onChange={e => updateShaderParam(selectedShaderIdx, pd.key, Number(e.target.value))}
                            style={{ flex: 1 }} />
                          <input type="number" min={pd.min} max={pd.max} step={pd.step}
                            value={selectedShader.params[pd.key] ?? pd.defaultValue}
                            onChange={e => updateShaderParam(selectedShaderIdx, pd.key, Number(e.target.value))}
                            style={{ ...selectStyle, width: 60 }} />
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => onOk(shaderList)}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── 그림 표시 (Show Picture, code 231) ───
// parameters: [번호, 이미지명, 원점, 위치지정방식, X, Y, 넓이%, 높이%, 불투명도, 합성방법, 셰이더데이터?]
export function ShowPictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [imageName, setImageName] = useState<string>((p[1] as string) || '');
  const [origin, setOrigin] = useState<number>((p[2] as number) || 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) || 0);
  const [posX, setPosX] = useState<number>((p[4] as number) || 0);
  const [posY, setPosY] = useState<number>((p[5] as number) || 0);
  const [scaleWidth, setScaleWidth] = useState<number>((p[6] as number) ?? 100);
  const [scaleHeight, setScaleHeight] = useState<number>((p[7] as number) ?? 100);
  const [opacity, setOpacity] = useState<number>((p[8] as number) ?? 255);
  const [blendMode, setBlendMode] = useState<number>((p[9] as number) || 0);

  // 프리셋 위치 데이터 초기화
  const existingPreset = p[11] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
  const [presetX, setPresetX] = useState<number>(existingPreset?.presetX ?? 3);
  const [presetY, setPresetY] = useState<number>(existingPreset?.presetY ?? 3);
  const [presetOffsetX, setPresetOffsetX] = useState<number>(existingPreset?.offsetX ?? 0);
  const [presetOffsetY, setPresetOffsetY] = useState<number>(existingPreset?.offsetY ?? 0);

  // 셰이더 데이터 초기화 (배열 지원)
  const initShaderList = (): ShaderEntry[] => {
    const raw = p[10];
    if (!raw) return [];
    // 배열 형태
    if (Array.isArray(raw)) return (raw as ShaderEntry[]).map(s => ({ ...s, params: { ...s.params } }));
    // 단일 객체 (하위 호환)
    const single = raw as ShaderEntry;
    if (single.enabled) return [{ ...single, params: { ...single.params } }];
    return [];
  };
  const [shaderList, setShaderList] = useState<ShaderEntry[]>(initShaderList);
  const [showShaderDialog, setShowShaderDialog] = useState(false);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const inputStyle: React.CSSProperties = { ...selectStyle, width: 80 };

  return (
    <>
      {/* 그림 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={labelStyle}>
            번호:
            <input type="number" min={1} max={100} value={pictureNumber}
              onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
          <div style={{ ...labelStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>이미지:</span>
            <ImagePicker type="pictures" value={imageName} onChange={setImageName} />
          </div>
        </div>
      </fieldset>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* 위치 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0, flex: 1 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              원점:
              <select value={origin} onChange={e => setOrigin(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                <option value={0}>왼쪽 위</option>
                <option value={1}>중앙</option>
              </select>
            </label>

            {/* 직접 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 0} onChange={() => setPositionType(0)} />
              직접 지정
            </label>
            {positionType === 0 && (
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <input type="number" min={-9999} max={9999} value={posX}
                  onChange={e => setPosX(Number(e.target.value))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <input type="number" min={-9999} max={9999} value={posY}
                  onChange={e => setPosY(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
            )}

            {/* 변수로 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
              변수로 지정
            </label>
            {positionType === 1 && (
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <VariableSwitchPicker type="variable" value={posX || 1}
                  onChange={setPosX} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <VariableSwitchPicker type="variable" value={posY || 1}
                  onChange={setPosY} style={{ flex: 1 }} />
              </div>
            </div>
            )}

            {/* 프리셋 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="picture-pos-type" checked={positionType === 2} onChange={() => setPositionType(2)} />
              프리셋 지정
            </label>
            {positionType === 2 && (
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <select value={presetX} onChange={e => setPresetX(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70 }}>
                  <option value={1}>0%</option>
                  <option value={2}>25%</option>
                  <option value={3}>50%</option>
                  <option value={4}>75%</option>
                  <option value={5}>100%</option>
                </select>
                <span style={{ ...labelStyle, marginLeft: 4 }}>+</span>
                <input type="number" min={-9999} max={9999} value={presetOffsetX}
                  onChange={e => setPresetOffsetX(Number(e.target.value))}
                  style={{ ...selectStyle, width: 60 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <select value={presetY} onChange={e => setPresetY(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70 }}>
                  <option value={1}>0%</option>
                  <option value={2}>25%</option>
                  <option value={3}>50%</option>
                  <option value={4}>75%</option>
                  <option value={5}>100%</option>
                </select>
                <span style={{ ...labelStyle, marginLeft: 4 }}>+</span>
                <input type="number" min={-9999} max={9999} value={presetOffsetY}
                  onChange={e => setPresetOffsetY(Number(e.target.value))}
                  style={{ ...selectStyle, width: 60 }} />
              </div>
            </div>
            )}
          </div>
        </fieldset>

        {/* 배율 + 합성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>배율</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                넓이:
                <input type="number" min={0} max={2000} value={scaleWidth}
                  onChange={e => setScaleWidth(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
              <label style={labelStyle}>
                높이:
                <input type="number" min={0} max={2000} value={scaleHeight}
                  onChange={e => setScaleHeight(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
            </div>
          </fieldset>

          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>합성</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                불투명도:
                <input type="number" min={0} max={255} value={opacity}
                  onChange={e => setOpacity(Math.max(0, Math.min(255, Number(e.target.value))))}
                  style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
              </label>
              <label style={labelStyle}>
                합성 방법:
                <select value={blendMode} onChange={e => setBlendMode(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                  <option value={0}>일반</option>
                  <option value={1}>추가 합성</option>
                  <option value={2}>곱하기</option>
                  <option value={3}>스크린</option>
                </select>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      {/* 셰이더 이펙트 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>셰이더 이펙트</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="db-btn" onClick={() => setShowShaderDialog(true)}>
            셰이더 설정...
          </button>
          <span style={{ fontSize: 12, color: shaderList.length > 0 ? '#7cb3ff' : '#666' }}>
            {shaderList.length > 0
              ? shaderList.map(s => SHADER_DEFINITIONS.find(d => d.type === s.type)?.label ?? s.type).join(' + ')
              : '없음'}
          </span>
          {shaderList.length > 0 && (
            <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px', color: '#f88' }}
              onClick={() => setShaderList([])}>초기화</button>
          )}
        </div>
      </fieldset>
      {showShaderDialog && (
        <ShaderEditorDialog
          imageName={imageName}
          shaderList={shaderList}
          onOk={(list) => { setShaderList(list); setShowShaderDialog(false); }}
          onCancel={() => setShowShaderDialog(false)}
        />
      )}

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => {
          const shaderData = shaderList.length > 0 ? shaderList.map(s => ({ type: s.type, enabled: true, params: { ...s.params } })) : null;
          const presetData = positionType === 2 ? { presetX, presetY, offsetX: presetOffsetX, offsetY: presetOffsetY } : null;
          onOk([pictureNumber, imageName, origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, shaderData, presetData]);
        }}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 그림 이동 (Move Picture, code 232) ───
// parameters: [번호, (unused), 원점, 위치지정방식, X, Y, 넓이%, 높이%, 불투명도, 합성방법, 지속시간, 완료까지대기]
export function MovePictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [origin, setOrigin] = useState<number>((p[2] as number) || 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) || 0);
  const [posX, setPosX] = useState<number>((p[4] as number) || 0);
  const [posY, setPosY] = useState<number>((p[5] as number) || 0);
  const [scaleWidth, setScaleWidth] = useState<number>((p[6] as number) ?? 100);
  const [scaleHeight, setScaleHeight] = useState<number>((p[7] as number) ?? 100);
  const [opacity, setOpacity] = useState<number>((p[8] as number) ?? 255);
  const [blendMode, setBlendMode] = useState<number>((p[9] as number) || 0);
  const [duration, setDuration] = useState<number>((p[10] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>(p[11] !== undefined ? !!p[11] : true);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const inputStyle: React.CSSProperties = { ...selectStyle, width: 80 };

  return (
    <>
      {/* 그림 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
        <label style={labelStyle}>
          번호:
          <input type="number" min={1} max={100} value={pictureNumber}
            onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
        </label>
      </fieldset>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* 위치 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0, flex: 1 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>위치</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              원점:
              <select value={origin} onChange={e => setOrigin(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                <option value={0}>왼쪽 위</option>
                <option value={1}>중앙</option>
              </select>
            </label>

            {/* 직접 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="movepic-pos-type" checked={positionType === 0} onChange={() => setPositionType(0)} />
              직접 지정
            </label>
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, opacity: positionType === 0 ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <input type="number" min={-9999} max={9999} value={positionType === 0 ? posX : 0}
                  onChange={e => setPosX(Number(e.target.value))}
                  disabled={positionType !== 0} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <input type="number" min={-9999} max={9999} value={positionType === 0 ? posY : 0}
                  onChange={e => setPosY(Number(e.target.value))}
                  disabled={positionType !== 0} style={inputStyle} />
              </div>
            </div>

            {/* 변수로 지정 */}
            <label style={radioStyle}>
              <input type="radio" name="movepic-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
              변수로 지정
            </label>
            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, opacity: positionType === 1 ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>X:</span>
                <VariableSwitchPicker type="variable" value={positionType === 1 ? (posX || 1) : 1}
                  onChange={setPosX} disabled={positionType !== 1} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, minWidth: 16 }}>Y:</span>
                <VariableSwitchPicker type="variable" value={positionType === 1 ? (posY || 1) : 1}
                  onChange={setPosY} disabled={positionType !== 1} style={{ flex: 1 }} />
              </div>
            </div>
          </div>
        </fieldset>

        {/* 배율 + 합성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>배율</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                넓이:
                <input type="number" min={0} max={2000} value={scaleWidth}
                  onChange={e => setScaleWidth(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
              <label style={labelStyle}>
                높이:
                <input type="number" min={0} max={2000} value={scaleHeight}
                  onChange={e => setScaleHeight(Number(e.target.value))}
                  style={{ ...selectStyle, width: 70, marginLeft: 4 }} />
                <span style={{ marginLeft: 2, color: '#aaa', fontSize: 12 }}>%</span>
              </label>
            </div>
          </fieldset>

          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>합성</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>
                불투명도:
                <input type="number" min={0} max={255} value={opacity}
                  onChange={e => setOpacity(Math.max(0, Math.min(255, Number(e.target.value))))}
                  style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
              </label>
              <label style={labelStyle}>
                합성 방법:
                <select value={blendMode} onChange={e => setBlendMode(Number(e.target.value))} style={{ ...selectStyle, marginLeft: 4 }}>
                  <option value={0}>일반</option>
                  <option value={1}>추가 합성</option>
                  <option value={2}>곱하기</option>
                  <option value={3}>스크린</option>
                </select>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([pictureNumber, '', origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 그림 회전 (Rotate Picture, code 233) ───
// parameters: [번호, 속도]
export function RotatePictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [speed, setSpeed] = useState<number>((p[1] as number) || 0);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* 그림 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
          <label style={labelStyle}>
            번호:
            <input type="number" min={1} max={100} value={pictureNumber}
              onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
        </fieldset>

        {/* 회전 */}
        <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
          <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>회전</legend>
          <label style={labelStyle}>
            속도:
            <input type="number" min={-90} max={90} value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
          </label>
        </fieldset>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([pictureNumber, speed])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function TintPictureEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const tone = (p[1] as number[] | undefined) || [0, 0, 0, 0];
  const [pictureNumber, setPictureNumber] = useState<number>((p[0] as number) || 1);
  const [red, setRed] = useState<number>(tone[0] || 0);
  const [green, setGreen] = useState<number>(tone[1] || 0);
  const [blue, setBlue] = useState<number>(tone[2] || 0);
  const [gray, setGray] = useState<number>(tone[3] || 0);
  const [duration, setDuration] = useState<number>((p[2] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[3] as boolean) ?? true);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  const applyPreset = (name: string) => {
    const [pr, pg, pb, pgray] = TINT_PRESETS[name];
    setRed(pr);
    setGreen(pg);
    setBlue(pb);
    setGray(pgray);
  };

  return (
    <>
      {/* 그림 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>그림</legend>
        <label style={labelStyle}>
          번호:
          <input type="number" min={1} max={100} value={pictureNumber}
            onChange={e => setPictureNumber(Math.max(1, Math.min(100, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60, marginLeft: 4 }} />
        </label>
      </fieldset>

      {/* 색조 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>색조</legend>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>빨강:</span>
              <input type="range" min={-255} max={255} value={red}
                onChange={e => setRed(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={red}
                onChange={e => setRed(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>초록:</span>
              <input type="range" min={-255} max={255} value={green}
                onChange={e => setGreen(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={green}
                onChange={e => setGreen(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>파랑:</span>
              <input type="range" min={-255} max={255} value={blue}
                onChange={e => setBlue(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={blue}
                onChange={e => setBlue(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>그레이:</span>
              <input type="range" min={0} max={255} value={gray}
                onChange={e => setGray(Number(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={gray}
                onChange={e => setGray(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
          </div>
          <TintColorPreview r={red} g={green} b={blue} gray={gray} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {Object.keys(TINT_PRESETS).map(name => (
            <button key={name} className="db-btn" style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
              onClick={() => applyPreset(name)}>
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 지속 시간 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>지속 시간</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" min={1} max={999} value={duration}
            onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
            style={{ ...selectStyle, width: 60 }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
            완료까지 대기
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([pictureNumber, [red, green, blue, gray], duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}
