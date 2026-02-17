import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { selectStyle } from './messageEditors';
import { SHADER_DEFINITIONS } from './shaderDefinitions';

export { SHADER_DEFINITIONS } from './shaderDefinitions';

// ─── 셰이더 프리뷰 컴포넌트 ───
declare const THREE: any;
declare const PictureShader: any;

export interface ShaderEntry { type: string; enabled: boolean; params: Record<string, number> }

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

// ─── 셰이더 에디터 다이얼로그 (전체화면) ───
export function ShaderEditorDialog({ imageName, shaderList: initialList, transitionOnly, onOk, onCancel }: {
  imageName: string;
  shaderList: ShaderEntry[];
  transitionOnly?: boolean;
  onOk: (shaderList: ShaderEntry[]) => void;
  onCancel: () => void;
}) {
  const availableShaders = transitionOnly
    ? SHADER_DEFINITIONS.filter(sd => sd.params.some(p => p.key === 'threshold'))
    : SHADER_DEFINITIONS;
  const [shaderList, setShaderList] = useState<ShaderEntry[]>(initialList.map(s => ({ ...s, params: { ...s.params } })));
  const [selectedShaderIdx, setSelectedShaderIdx] = useState<number>(0);

  const addShader = () => {
    const def = availableShaders[0];
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
                    {availableShaders.map(sd => (
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
