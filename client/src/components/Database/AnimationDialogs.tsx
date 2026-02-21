import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';

// 이미지 선택 팝업
export function ImageSelectPopup({ type, value, hue, onSelect, onClose }: {
  type: 'animations';
  value: string;
  hue: number;
  onSelect: (name: string, hue: number) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [selectedHue, setSelectedHue] = useState(hue);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient.get<string[]>(`/resources/${type}`).then(setFiles).catch(() => setFiles([]));
  }, [type]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay">
      <div className="anim-img-popup" ref={popupRef}>
        <div className="anim-img-popup-header">이미지 선택</div>
        <div className="anim-img-popup-body">
          <div className="anim-img-popup-list">
            <div
              className={`anim-img-popup-item${selected === '' ? ' selected' : ''}`}
              onClick={() => setSelected('')}
            >(None)</div>
            {files.map(f => {
              const name = f.replace(/\.png$/i, '');
              return (
                <div
                  key={f}
                  className={`anim-img-popup-item${selected === name ? ' selected' : ''}`}
                  onClick={() => setSelected(name)}
                >{name}</div>
              );
            })}
          </div>
          <div className="anim-img-popup-preview">
            {selected && (
              <img
                src={`/api/resources/${type}/${selected}.png`}
                alt={selected}
                style={{ maxWidth: '100%', maxHeight: 260, imageRendering: 'pixelated' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
        </div>
        <div className="anim-img-popup-hue">
          <label>
            색조
            <input type="range" min={0} max={360} value={selectedHue} onChange={(e) => setSelectedHue(Number(e.target.value))} />
            <span>{selectedHue}</span>
          </label>
        </div>
        <div className="anim-img-popup-footer">
          <button className="db-btn" onClick={() => { onSelect(selected, selectedHue); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

// 적 이미지 선택 팝업 (대상 변경)
export function EnemyImageSelectPopup({ value, onSelect, onClose }: {
  value: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState(value);
  const [selectedHue, setSelectedHue] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient.get<string[]>('/resources/enemies').then(list => {
      setFiles(list.filter(f => /\.png$/i.test(f)).map(f => f.replace(/\.png$/i, '')));
    }).catch(() => setFiles([]));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay">
      <div className="anim-img-popup" ref={popupRef}>
        <div className="anim-img-popup-header">이미지 선택</div>
        <div className="anim-img-popup-body">
          <div className="anim-img-popup-list">
            {files.map(name => (
              <div
                key={name}
                className={`anim-img-popup-item${selected === name ? ' selected' : ''}`}
                onClick={() => setSelected(name)}
                ref={selected === name ? (el) => { el?.scrollIntoView({ block: 'nearest' }); } : undefined}
              >{name}</div>
            ))}
          </div>
          <div className="anim-img-popup-preview anim-enemy-preview-bg">
            {selected && (
              <img
                src={`/api/resources/enemies/${selected}.png`}
                alt={selected}
                style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
        </div>
        <div className="anim-img-popup-hue">
          <label>
            색조
            <input type="range" min={0} max={360} value={selectedHue} onChange={(e) => setSelectedHue(Number(e.target.value))} />
            <span>{selectedHue}</span>
          </label>
        </div>
        <div className="anim-img-popup-footer">
          <button className="db-btn" onClick={() => { onSelect(selected); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

// 최대 프레임 팝업
export function MaxFrameDialog({ value, onConfirm, onClose }: {
  value: number;
  onConfirm: (v: number) => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(value);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') { onConfirm(count); onClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onConfirm, count]);

  return (
    <div className="modal-overlay">
      <div className="anim-maxframe-dialog" ref={popupRef}>
        <div className="anim-maxframe-header">최대 프레임</div>
        <div className="anim-maxframe-body">
          <label>
            갯수:
            <input type="number" min={1} max={999} value={count} onChange={(e) => setCount(Number(e.target.value))} autoFocus />
          </label>
        </div>
        <div className="anim-maxframe-footer">
          <button className="db-btn" onClick={() => { onConfirm(count); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

// 보완 (Tween) 팝업
export interface TweenOptions {
  frameStart: number;
  frameEnd: number;
  cellStart: number;
  cellEnd: number;
  pattern: boolean;
  x: boolean;
  y: boolean;
  scale: boolean;
  rotation: boolean;
  mirror: boolean;
  opacity: boolean;
  blendMode: boolean;
}

export function TweenDialog({ totalFrames, maxCells, onConfirm, onClose }: {
  totalFrames: number;
  maxCells: number;
  onConfirm: (opts: TweenOptions) => void;
  onClose: () => void;
}) {
  const [opts, setOpts] = useState<TweenOptions>({
    frameStart: 1, frameEnd: totalFrames,
    cellStart: 1, cellEnd: maxCells || 16,
    pattern: true, x: true, y: true, scale: true,
    rotation: true, mirror: true, opacity: true, blendMode: true,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const update = (field: keyof TweenOptions, value: number | boolean) => {
    setOpts(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="anim-tween-dialog">
        <div className="anim-tween-header">보완</div>
        <div className="anim-tween-body">
          <fieldset className="anim-tween-fieldset">
            <legend>범위</legend>
            <div className="anim-tween-range-row">
              <label>프레임:</label>
              <input type="number" min={1} max={totalFrames} value={opts.frameStart} onChange={e => update('frameStart', Number(e.target.value))} autoFocus />
              <span>~</span>
              <input type="number" min={1} max={totalFrames} value={opts.frameEnd} onChange={e => update('frameEnd', Number(e.target.value))} />
            </div>
            <div className="anim-tween-range-row">
              <label>셀:</label>
              <input type="number" min={1} max={16} value={opts.cellStart} onChange={e => update('cellStart', Number(e.target.value))} />
              <span>~</span>
              <input type="number" min={1} max={16} value={opts.cellEnd} onChange={e => update('cellEnd', Number(e.target.value))} />
            </div>
          </fieldset>
          <div className="anim-tween-checks">
            <label><input type="checkbox" checked={opts.pattern} onChange={e => update('pattern', e.target.checked)} /> 패턴</label>
            <label><input type="checkbox" checked={opts.x} onChange={e => update('x', e.target.checked)} /> X</label>
            <label><input type="checkbox" checked={opts.y} onChange={e => update('y', e.target.checked)} /> Y</label>
            <label><input type="checkbox" checked={opts.scale} onChange={e => update('scale', e.target.checked)} /> 배율</label>
            <label><input type="checkbox" checked={opts.rotation} onChange={e => update('rotation', e.target.checked)} /> 회전</label>
            <label><input type="checkbox" checked={opts.mirror} onChange={e => update('mirror', e.target.checked)} /> 좌우 반전</label>
            <label><input type="checkbox" checked={opts.opacity} onChange={e => update('opacity', e.target.checked)} /> 불투명도</label>
            <label><input type="checkbox" checked={opts.blendMode} onChange={e => update('blendMode', e.target.checked)} /> 합성 방법</label>
          </div>
        </div>
        <div className="anim-tween-footer">
          <button className="db-btn" onClick={() => { onConfirm(opts); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

// 일괄 설정 (Batch Setting) 팝업
export interface BatchSettingData {
  frameStart: number;
  frameEnd: number;
  cellStart: number;
  cellEnd: number;
  patternEnabled: boolean; pattern: number;
  xEnabled: boolean; x: number;
  yEnabled: boolean; y: number;
  scaleEnabled: boolean; scale: number;
  rotationEnabled: boolean; rotation: number;
  mirrorEnabled: boolean; mirror: number;
  opacityEnabled: boolean; opacity: number;
  blendModeEnabled: boolean; blendMode: number;
}

export function BatchSettingDialog({ totalFrames, maxCells, onConfirm, onClose }: {
  totalFrames: number;
  maxCells: number;
  onConfirm: (data: BatchSettingData) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<BatchSettingData>({
    frameStart: 1, frameEnd: totalFrames,
    cellStart: 1, cellEnd: maxCells || 16,
    patternEnabled: false, pattern: 0,
    xEnabled: false, x: 0,
    yEnabled: false, y: 0,
    scaleEnabled: false, scale: 100,
    rotationEnabled: false, rotation: 0,
    mirrorEnabled: false, mirror: 0,
    opacityEnabled: false, opacity: 255,
    blendModeEnabled: false, blendMode: 0,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const update = (field: keyof BatchSettingData, value: number | boolean) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="anim-tween-dialog">
        <div className="anim-tween-header">일괄 설정</div>
        <div className="anim-tween-body">
          <fieldset className="anim-tween-fieldset">
            <legend>범위</legend>
            <div className="anim-tween-range-row">
              <label>프레임:</label>
              <input type="number" min={1} max={totalFrames} value={data.frameStart} onChange={e => update('frameStart', Number(e.target.value))} autoFocus />
              <span>~</span>
              <input type="number" min={1} max={totalFrames} value={data.frameEnd} onChange={e => update('frameEnd', Number(e.target.value))} />
            </div>
            <div className="anim-tween-range-row">
              <label>셀:</label>
              <input type="number" min={1} max={16} value={data.cellStart} onChange={e => update('cellStart', Number(e.target.value))} />
              <span>~</span>
              <input type="number" min={1} max={16} value={data.cellEnd} onChange={e => update('cellEnd', Number(e.target.value))} />
            </div>
          </fieldset>
          <fieldset className="anim-tween-fieldset">
            <legend>데이터</legend>
            <div className="anim-batch-grid">
              <label><input type="checkbox" checked={data.patternEnabled} onChange={e => update('patternEnabled', e.target.checked)} /> 패턴</label>
              <input type="number" value={data.pattern} onChange={e => update('pattern', Number(e.target.value))} disabled={!data.patternEnabled} />
              <label><input type="checkbox" checked={data.xEnabled} onChange={e => update('xEnabled', e.target.checked)} /> X</label>
              <input type="number" value={data.x} onChange={e => update('x', Number(e.target.value))} disabled={!data.xEnabled} />
              <label><input type="checkbox" checked={data.yEnabled} onChange={e => update('yEnabled', e.target.checked)} /> Y</label>
              <input type="number" value={data.y} onChange={e => update('y', Number(e.target.value))} disabled={!data.yEnabled} />
              <label><input type="checkbox" checked={data.scaleEnabled} onChange={e => update('scaleEnabled', e.target.checked)} /> 배율</label>
              <input type="number" value={data.scale} onChange={e => update('scale', Number(e.target.value))} disabled={!data.scaleEnabled} />
              <label><input type="checkbox" checked={data.rotationEnabled} onChange={e => update('rotationEnabled', e.target.checked)} /> 회전</label>
              <input type="number" value={data.rotation} onChange={e => update('rotation', Number(e.target.value))} disabled={!data.rotationEnabled} />
              <label><input type="checkbox" checked={data.mirrorEnabled} onChange={e => update('mirrorEnabled', e.target.checked)} /> 좌우 반전</label>
              <input type="number" min={0} max={1} value={data.mirror} onChange={e => update('mirror', Number(e.target.value))} disabled={!data.mirrorEnabled} />
              <label><input type="checkbox" checked={data.opacityEnabled} onChange={e => update('opacityEnabled', e.target.checked)} /> 불투명도</label>
              <input type="number" min={0} max={255} value={data.opacity} onChange={e => update('opacity', Number(e.target.value))} disabled={!data.opacityEnabled} />
              <label><input type="checkbox" checked={data.blendModeEnabled} onChange={e => update('blendModeEnabled', e.target.checked)} /> 합성 방법</label>
              <input type="number" min={0} max={2} value={data.blendMode} onChange={e => update('blendMode', Number(e.target.value))} disabled={!data.blendModeEnabled} />
            </div>
          </fieldset>
        </div>
        <div className="anim-tween-footer">
          <button className="db-btn" onClick={() => { onConfirm(data); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

// 시프트 (Shift) 팝업
export interface ShiftData {
  frameStart: number;
  frameEnd: number;
  cellStart: number;
  cellEnd: number;
  offsetX: number;
  offsetY: number;
}

export function ShiftDialog({ totalFrames, maxCells, onConfirm, onClose }: {
  totalFrames: number;
  maxCells: number;
  onConfirm: (data: ShiftData) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ShiftData>({
    frameStart: 1, frameEnd: totalFrames,
    cellStart: 1, cellEnd: maxCells || 16,
    offsetX: 0, offsetY: 0,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const update = (field: keyof ShiftData, value: number) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="anim-tween-dialog" style={{ width: 320 }}>
        <div className="anim-tween-header">시프트</div>
        <div className="anim-tween-body">
          <fieldset className="anim-tween-fieldset">
            <legend>범위</legend>
            <div className="anim-tween-range-row">
              <label>프레임:</label>
              <input type="number" min={1} max={totalFrames} value={data.frameStart} onChange={e => update('frameStart', Number(e.target.value))} autoFocus />
              <span>~</span>
              <input type="number" min={1} max={totalFrames} value={data.frameEnd} onChange={e => update('frameEnd', Number(e.target.value))} />
            </div>
            <div className="anim-tween-range-row">
              <label>셀:</label>
              <input type="number" min={1} max={16} value={data.cellStart} onChange={e => update('cellStart', Number(e.target.value))} />
              <span>~</span>
              <input type="number" min={1} max={16} value={data.cellEnd} onChange={e => update('cellEnd', Number(e.target.value))} />
            </div>
          </fieldset>
          <fieldset className="anim-tween-fieldset">
            <legend>오프셋</legend>
            <div className="anim-tween-range-row">
              <label>X:</label>
              <input type="number" value={data.offsetX} onChange={e => update('offsetX', Number(e.target.value))} />
            </div>
            <div className="anim-tween-range-row">
              <label>Y:</label>
              <input type="number" value={data.offsetY} onChange={e => update('offsetY', Number(e.target.value))} />
            </div>
          </fieldset>
        </div>
        <div className="anim-tween-footer">
          <button className="db-btn" onClick={() => { onConfirm(data); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
