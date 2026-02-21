import React, { useState, useEffect, useRef } from 'react';
import { selectStyle } from './messageEditors';

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function FlashColorPreview({ r, g, b, a }: { r: number; g: number; b: number; a: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    // 무지개 그라데이션 배경 생성
    const imgData = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const hue = (px / w) * 360;
        const lightness = 1 - (py / h);
        const [baseR, baseG, baseB] = hslToRgb(hue, 1, lightness * 0.5 + 0.25);

        // 플래시 색상 오버레이 (alpha 블렌딩)
        const t = a / 255;
        const fr = baseR * (1 - t) + r * t;
        const fg = baseG * (1 - t) + g * t;
        const fb = baseB * (1 - t) + b * t;

        const idx = (py * w + px) * 4;
        imgData.data[idx] = Math.max(0, Math.min(255, fr));
        imgData.data[idx + 1] = Math.max(0, Math.min(255, fg));
        imgData.data[idx + 2] = Math.max(0, Math.min(255, fb));
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [r, g, b, a]);

  return <canvas ref={canvasRef} width={120} height={120} style={{ borderRadius: 4, border: '1px solid #555' }} />;
}

// ─── 화면의 플래시 (Flash Screen, code 224) ───
// parameters: [[R,G,B,A(진한정도)], 지속시간, 완료까지대기]
export function FlashScreenEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const color = (p[0] as number[] | undefined) || [255, 255, 255, 170];
  const [red, setRed] = useState<number>(color[0] ?? 255);
  const [green, setGreen] = useState<number>(color[1] ?? 255);
  const [blue, setBlue] = useState<number>(color[2] ?? 255);
  const [alpha, setAlpha] = useState<number>(color[3] ?? 170);
  const [duration, setDuration] = useState<number>((p[1] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[2] as boolean) ?? true);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <>
      {/* 플래쉬 색깔 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>플래쉬 색깔</legend>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 60 }}>빨강:</span>
              <input type="range" min={0} max={255} value={red}
                onChange={e => setRed(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={red}
                onChange={e => setRed(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 60 }}>초록:</span>
              <input type="range" min={0} max={255} value={green}
                onChange={e => setGreen(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={green}
                onChange={e => setGreen(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 60 }}>파랑:</span>
              <input type="range" min={0} max={255} value={blue}
                onChange={e => setBlue(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={blue}
                onChange={e => setBlue(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 60 }}>진한 정도:</span>
              <input type="range" min={0} max={255} value={alpha}
                onChange={e => setAlpha(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={255} value={alpha}
                onChange={e => setAlpha(Math.max(0, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
          </div>
          <FlashColorPreview r={red} g={green} b={blue} a={alpha} />
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
        <button className="db-btn" onClick={() => onOk([[red, green, blue, alpha], duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}
