import React, { useState, useEffect, useRef } from 'react';
import { selectStyle } from './messageEditors';

export { TintScreenEditor } from './TintScreenEditor';
export { FlashScreenEditor } from './FlashScreenEditor';

// ─── 창 색깔 변경 (Change Window Color, code 138) ───
// parameters: [[R,G,B]]  범위: -255 ~ 255
export function ChangeWindowColorEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const color = (p[0] as number[] | undefined) || [0, 0, 0];
  const [red, setRed] = useState<number>(color[0] || 0);
  const [green, setGreen] = useState<number>(color[1] || 0);
  const [blue, setBlue] = useState<number>(color[2] || 0);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>창 색깔</legend>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>빨강:</span>
              <input type="range" min={-255} max={255} value={red}
                onChange={e => setRed(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={red}
                onChange={e => setRed(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>초록:</span>
              <input type="range" min={-255} max={255} value={green}
                onChange={e => setGreen(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={green}
                onChange={e => setGreen(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
            <div style={sliderRowStyle}>
              <span style={{ ...labelStyle, minWidth: 40 }}>파랑:</span>
              <input type="range" min={-255} max={255} value={blue}
                onChange={e => setBlue(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={-255} max={255} value={blue}
                onChange={e => setBlue(Math.max(-255, Math.min(255, Number(e.target.value))))}
                style={{ ...selectStyle, width: 60 }} />
            </div>
          </div>
          <WindowColorPreview r={red} g={green} b={blue} />
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([[red, green, blue]])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

function WindowColorPreview({ r, g, b }: { r: number; g: number; b: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skinRef = useRef<HTMLImageElement | null>(null);
  const [skinLoaded, setSkinLoaded] = useState(false);

  // Window.png 스킨 로드
  useEffect(() => {
    const img = new Image();
    img.onload = () => { skinRef.current = img; setSkinLoaded(true); };
    img.onerror = () => setSkinLoaded(false);
    img.src = '/img/system/Window.png';
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const skin = skinRef.current;
    if (skin && skinLoaded) {
      // Window.png 배경 영역(0,0,96,96)을 캔버스에 그린 뒤 tone 적용
      // 1단계: 배경1(stretch) + 배경2(tile) 합성
      const p = 96;
      ctx.drawImage(skin, 0, 0, p, p, 0, 0, w, h);
      for (let y = 0; y < h; y += p) {
        for (let x = 0; x < w; x += p) {
          ctx.drawImage(skin, 0, p, p, p, x, y, p, p);
        }
      }
      // 2단계: adjustTone - 각 픽셀 RGB에 오프셋 적용
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, data[i] + r));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + g));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + b));
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      // 스킨 미로드 시 단색 대체
      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, 50 + r))}, ${Math.max(0, Math.min(255, 50 + g))}, ${Math.max(0, Math.min(255, 80 + b))})`;
      ctx.fillRect(0, 0, w, h);
    }
  }, [r, g, b, skinLoaded]);

  return <canvas ref={canvasRef} width={120} height={120} style={{ borderRadius: 4, border: '1px solid #555' }} />;
}

// ─── 화면 흔들리기 (Shake Screen, code 225) ───
// parameters: [강도, 속도, 지속시간, 완료까지대기]
export function ShakeScreenEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [power, setPower] = useState<number>((p[0] as number) ?? 5);
  const [speed, setSpeed] = useState<number>((p[1] as number) ?? 5);
  const [duration, setDuration] = useState<number>((p[2] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[3] as boolean) ?? true);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <>
      {/* 흔들리기 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>흔들리기</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={sliderRowStyle}>
            <span style={{ ...labelStyle, minWidth: 40 }}>강도:</span>
            <input type="range" min={1} max={9} value={power}
              onChange={e => setPower(Number(e.target.value))} style={{ flex: 1 }} />
            <input type="number" min={1} max={9} value={power}
              onChange={e => setPower(Math.max(1, Math.min(9, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60 }} />
          </div>
          <div style={sliderRowStyle}>
            <span style={{ ...labelStyle, minWidth: 40 }}>속도:</span>
            <input type="range" min={1} max={9} value={speed}
              onChange={e => setSpeed(Number(e.target.value))} style={{ flex: 1 }} />
            <input type="number" min={1} max={9} value={speed}
              onChange={e => setSpeed(Math.max(1, Math.min(9, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60 }} />
          </div>
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
        <button className="db-btn" onClick={() => onOk([power, speed, duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 날씨 효과 설정 (Set Weather Effect, code 236) ───
// parameters: [type, power, duration, waitForCompletion]
// type: 0=없음, 1=비, 2=폭풍, 3=눈
const WEATHER_TYPES = [
  { value: 'none', label: '없음' },
  { value: 'rain', label: '비' },
  { value: 'storm', label: '폭풍' },
  { value: 'snow', label: '눈' },
];

export function SetWeatherEffectEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [type, setType] = useState<string>((p[0] as string) ?? 'none');
  const [power, setPower] = useState<number>((p[1] as number) ?? 5);
  const [duration, setDuration] = useState<number>((p[2] as number) ?? 60);
  const [waitForCompletion, setWaitForCompletion] = useState<boolean>((p[3] as boolean) ?? true);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aaa' };
  const sliderRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <>
      {/* 날씨 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>날씨</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={sliderRowStyle}>
            <span style={{ ...labelStyle, minWidth: 40 }}>유형:</span>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
              {WEATHER_TYPES.map(w => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
          <div style={sliderRowStyle}>
            <span style={{ ...labelStyle, minWidth: 40 }}>강도:</span>
            <input type="range" min={1} max={9} value={power}
              onChange={e => setPower(Number(e.target.value))} style={{ flex: 1 }} />
            <input type="number" min={1} max={9} value={power}
              onChange={e => setPower(Math.max(1, Math.min(9, Number(e.target.value))))}
              style={{ ...selectStyle, width: 60 }} />
          </div>
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
        <button className="db-btn" onClick={() => onOk([type, power, duration, waitForCompletion])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

// ─── 그림의 색조 변경 (Tint Picture, code 234) ───
// parameters: [번호, [R,G,B,Gray], 지속시간, 완료까지대기]
export const TINT_PRESETS: Record<string, [number, number, number, number]> = {
  '보통': [0, 0, 0, 0],
  '다크': [-68, -68, -68, 0],
  '세피아': [34, -34, -68, 170],
  '석양': [68, -34, -34, 0],
  '밤': [-68, -68, 0, 68],
};

export function TintColorPreview({ r, g, b, gray }: { r: number; g: number; b: number; gray: number }) {
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

        // 색조 적용
        let fr = Math.max(0, Math.min(255, baseR + r));
        let fg = Math.max(0, Math.min(255, baseG + g));
        let fb = Math.max(0, Math.min(255, baseB + b));

        // 그레이 필터 적용
        if (gray > 0) {
          const grayVal = fr * 0.299 + fg * 0.587 + fb * 0.114;
          const t = gray / 255;
          fr = fr * (1 - t) + grayVal * t;
          fg = fg * (1 - t) + grayVal * t;
          fb = fb * (1 - t) + grayVal * t;
        }

        const idx = (py * w + px) * 4;
        imgData.data[idx] = Math.max(0, Math.min(255, fr));
        imgData.data[idx + 1] = Math.max(0, Math.min(255, fg));
        imgData.data[idx + 2] = Math.max(0, Math.min(255, fb));
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [r, g, b, gray]);

  return <canvas ref={canvasRef} width={120} height={120} style={{ borderRadius: 4, border: '1px solid #555' }} />;
}

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
