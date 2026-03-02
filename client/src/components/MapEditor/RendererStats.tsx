import React, { useEffect, useRef, useState } from 'react';

interface Stats {
  fps: number;
  renderer: string;
  calls: number;
  triangles: number;
  points: number;
  textures: number;
  geometries: number;
  programs: number;
  memMB?: number;
}

interface Props {
  rendererObjRef: React.MutableRefObject<any>;
  visible: boolean;
}

export default function RendererStats({ rendererObjRef, visible }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!visible) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      return;
    }

    function update() {
      animFrameRef.current = requestAnimationFrame(update);

      const now = performance.now();
      frameTimesRef.current.push(now);
      // 1초 슬라이딩 윈도우로 FPS 계산
      const cutoff = now - 1000;
      while (frameTimesRef.current.length > 0 && frameTimesRef.current[0] < cutoff) {
        frameTimesRef.current.shift();
      }
      const fps = frameTimesRef.current.length;

      // 200ms마다 stats 갱신 (렌더 부담 최소화)
      if (now - lastUpdateRef.current < 200) return;
      lastUpdateRef.current = now;

      const rendererObj = rendererObjRef.current;
      if (!rendererObj?.renderer) {
        setStats({ fps, renderer: 'N/A', calls: 0, triangles: 0, points: 0, textures: 0, geometries: 0, programs: 0 });
        return;
      }

      const r = rendererObj.renderer;
      const info = r.info;

      // WebGL 버전 판별
      let rendererType = 'WebGL';
      try {
        const gl = r.getContext?.();
        if (gl instanceof WebGL2RenderingContext) rendererType = 'WebGL2';
        else if (gl && (gl as any).constructor?.name?.toLowerCase().includes('webgpu')) rendererType = 'WebGPU';
      } catch (_) {}

      // JS 힙 메모리 (Chrome 전용)
      let memMB: number | undefined;
      const perf = performance as any;
      if (perf.memory) {
        memMB = Math.round(perf.memory.usedJSHeapSize / 1048576);
      }

      setStats({
        fps,
        renderer: rendererType,
        calls: info.render.calls,
        triangles: info.render.triangles,
        points: info.render.points || 0,
        textures: info.memory.textures,
        geometries: info.memory.geometries,
        programs: info.programs?.length ?? 0,
        memMB,
      });
    }

    animFrameRef.current = requestAnimationFrame(update);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    };
  }, [visible, rendererObjRef]);

  if (!visible || !stats) return null;

  const fmtNum = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      background: 'rgba(0,0,0,0.82)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: 11,
      padding: '6px 10px',
      borderRadius: 4,
      border: '1px solid #2a2a2a',
      pointerEvents: 'none',
      zIndex: 100,
      lineHeight: 1.7,
      minWidth: 110,
      userSelect: 'none',
    }}>
      <div><span style={{ color: '#ff4' }}>FPS</span>{'  '}<span style={{ color: '#fff' }}>{stats.fps}</span></div>
      <div><span style={{ color: '#888' }}>Rndr</span> <span style={{ color: '#ccc' }}>{stats.renderer}</span></div>
      <div style={{ borderTop: '1px solid #333', marginTop: 3, paddingTop: 3 }}>
        <span style={{ color: '#4cf' }}>DC</span>{'   '}<span style={{ color: '#fff' }}>{stats.calls}</span>
      </div>
      <div><span style={{ color: '#4cf' }}>Tri</span>{'  '}<span style={{ color: '#fff' }}>{fmtNum(stats.triangles)}</span></div>
      <div><span style={{ color: '#4cf' }}>Tex</span>{'  '}<span style={{ color: '#fff' }}>{stats.textures}</span></div>
      <div><span style={{ color: '#4cf' }}>Geo</span>{'  '}<span style={{ color: '#fff' }}>{stats.geometries}</span></div>
      <div><span style={{ color: '#4cf' }}>Prg</span>{'  '}<span style={{ color: '#fff' }}>{stats.programs}</span></div>
      {stats.memMB !== undefined && (
        <div style={{ borderTop: '1px solid #333', marginTop: 3, paddingTop: 3 }}>
          <span style={{ color: '#fa6' }}>Mem</span>{'  '}<span style={{ color: '#fff' }}>{stats.memMB}MB</span>
        </div>
      )}
    </div>
  );
}
