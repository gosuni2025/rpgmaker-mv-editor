import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Animation, AnimationTiming, AudioFile } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
import AudioPicker from '../common/AudioPicker';
import AnimationPreview from './AnimationPreview';
import type { AnimationPreviewHandle } from './AnimationPreview';
import DatabaseList from './DatabaseList';
import './AnimationsTab.css';
import './AnimationPreview.css';

// 마지막으로 사용된 애니메이션 이미지를 기억하기 위한 모듈 변수
let lastUsedAnimation1Name: string | null = null;

// 이미지 선택 팝업
function ImageSelectPopup({ type, value, hue, onSelect, onClose }: {
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
function EnemyImageSelectPopup({ value, onSelect, onClose }: {
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
function MaxFrameDialog({ value, onConfirm, onClose }: {
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
interface TweenOptions {
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

function TweenDialog({ totalFrames, maxCells, onConfirm, onClose }: {
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
interface BatchSettingData {
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

function BatchSettingDialog({ totalFrames, maxCells, onConfirm, onClose }: {
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
interface ShiftData {
  frameStart: number;
  frameEnd: number;
  cellStart: number;
  cellEnd: number;
  offsetX: number;
  offsetY: number;
}

function ShiftDialog({ totalFrames, maxCells, onConfirm, onClose }: {
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

interface AnimationsTabProps {
  data: (Animation | null)[] | undefined;
  onChange: (data: (Animation | null)[]) => void;
}

export default function AnimationsTab({ data, onChange }: AnimationsTabProps) {
  const { t } = useTranslation();
  const POSITION_OPTIONS = [t('animations.positions.0'), t('animations.positions.1'), t('animations.positions.2'), t('animations.positions.3')];
  const [selectedId, setSelectedId] = useState(1);
  const [selectedTimingIdx, setSelectedTimingIdx] = useState<number>(-1);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);
  const [showImg1Popup, setShowImg1Popup] = useState(false);
  const [showImg2Popup, setShowImg2Popup] = useState(false);
  const [showMaxFrameDialog, setShowMaxFrameDialog] = useState(false);
  const [showEnemyImagePopup, setShowEnemyImagePopup] = useState(false);
  const [showTweenDialog, setShowTweenDialog] = useState(false);
  const [showBatchSettingDialog, setShowBatchSettingDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [targetImageName, setTargetImageName] = useState('Dragon');
  const previewRef = useRef<AnimationPreviewHandle>(null);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const initRef = useRef(false);

  // 처음 열 때 마지막 사용 이미지 추적
  useEffect(() => {
    if (initRef.current || !data) return;
    initRef.current = true;
    const items = data.filter(Boolean) as Animation[];
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].animation1Name) {
        lastUsedAnimation1Name = items[i].animation1Name;
        break;
      }
    }
  }, [data]);

  const handleFieldChange = (field: keyof Animation, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        const updated = { ...item, [field]: value };
        if (field === 'animation1Name' && typeof value === 'string' && value) {
          lastUsedAnimation1Name = value;
        }
        return updated;
      }
      return item;
    });
    onChange(newData);
  };

  const handleMultiFieldChange = (fields: Partial<Animation>) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        const updated = { ...item, ...fields };
        if ('animation1Name' in fields && typeof fields.animation1Name === 'string' && fields.animation1Name) {
          lastUsedAnimation1Name = fields.animation1Name;
        }
        return updated;
      }
      return item;
    });
    onChange(newData);
  };

  const handleMaxFrameChange = (newMax: number) => {
    if (!selectedItem || newMax < 1) return;
    const frames = [...(selectedItem.frames || [])];
    if (newMax > frames.length) {
      while (frames.length < newMax) frames.push([]);
    } else {
      frames.length = newMax;
    }
    handleFieldChange('frames', frames);
    if (selectedFrameIdx >= newMax) setSelectedFrameIdx(newMax - 1);
  };

  const handleTween = (opts: TweenOptions) => {
    if (!selectedItem || !selectedItem.frames) return;
    const frames = selectedItem.frames.map(f => f.map(c => [...c]));
    const fi = opts.frameStart - 1; // 0-based 시작 프레임
    const fe = opts.frameEnd - 1;   // 0-based 끝 프레임
    if (fi < 0 || fe >= frames.length || fi >= fe) return;
    const ci = opts.cellStart - 1;  // 0-based 시작 셀
    const ce = opts.cellEnd - 1;    // 0-based 끝 셀
    const totalSteps = fe - fi;

    for (let c = ci; c <= ce; c++) {
      const startCell = frames[fi]?.[c];
      const endCell = frames[fe]?.[c];
      if (!startCell || startCell.length < 8 || !endCell || endCell.length < 8) continue;
      // cell: [pattern, x, y, scale, rotation, mirror, opacity, blendMode]
      for (let f = fi + 1; f < fe; f++) {
        const t = (f - fi) / totalSteps;
        if (!frames[f]) frames[f] = [];
        const existing = frames[f][c] ? [...frames[f][c]] : [...startCell];
        if (opts.pattern) existing[0] = Math.round(startCell[0] + (endCell[0] - startCell[0]) * t);
        if (opts.x) existing[1] = Math.round(startCell[1] + (endCell[1] - startCell[1]) * t);
        if (opts.y) existing[2] = Math.round(startCell[2] + (endCell[2] - startCell[2]) * t);
        if (opts.scale) existing[3] = Math.round(startCell[3] + (endCell[3] - startCell[3]) * t);
        if (opts.rotation) existing[4] = Math.round(startCell[4] + (endCell[4] - startCell[4]) * t);
        if (opts.mirror) existing[5] = t < 0.5 ? startCell[5] : endCell[5];
        if (opts.opacity) existing[6] = Math.round(startCell[6] + (endCell[6] - startCell[6]) * t);
        if (opts.blendMode) existing[7] = t < 0.5 ? startCell[7] : endCell[7];
        frames[f][c] = existing;
      }
    }
    handleFieldChange('frames', frames);
  };

  const handleBatchSetting = (batchData: BatchSettingData) => {
    if (!selectedItem || !selectedItem.frames) return;
    const frames = selectedItem.frames.map(f => f.map(c => [...c]));
    const fi = batchData.frameStart - 1;
    const fe = batchData.frameEnd - 1;
    const ci = batchData.cellStart - 1;
    const ce = batchData.cellEnd - 1;

    for (let f = fi; f <= fe && f < frames.length; f++) {
      if (!frames[f]) frames[f] = [];
      for (let c = ci; c <= ce; c++) {
        if (!frames[f][c] || frames[f][c].length < 8) continue;
        const cell = [...frames[f][c]];
        // cell: [pattern, x, y, scale, rotation, mirror, opacity, blendMode]
        if (batchData.patternEnabled) cell[0] = batchData.pattern;
        if (batchData.xEnabled) cell[1] = batchData.x;
        if (batchData.yEnabled) cell[2] = batchData.y;
        if (batchData.scaleEnabled) cell[3] = batchData.scale;
        if (batchData.rotationEnabled) cell[4] = batchData.rotation;
        if (batchData.mirrorEnabled) cell[5] = batchData.mirror;
        if (batchData.opacityEnabled) cell[6] = batchData.opacity;
        if (batchData.blendModeEnabled) cell[7] = batchData.blendMode;
        frames[f][c] = cell;
      }
    }
    handleFieldChange('frames', frames);
  };

  const handleShift = (shiftData: ShiftData) => {
    if (!selectedItem || !selectedItem.frames) return;
    const frames = selectedItem.frames.map(f => f.map(c => [...c]));
    const fi = shiftData.frameStart - 1;
    const fe = shiftData.frameEnd - 1;
    const ci = shiftData.cellStart - 1;
    const ce = shiftData.cellEnd - 1;

    for (let f = fi; f <= fe && f < frames.length; f++) {
      if (!frames[f]) continue;
      for (let c = ci; c <= ce; c++) {
        if (!frames[f][c] || frames[f][c].length < 8) continue;
        frames[f][c][1] += shiftData.offsetX; // X
        frames[f][c][2] += shiftData.offsetY; // Y
      }
    }
    handleFieldChange('frames', frames);
  };

  const handleAddNew = useCallback(() => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const defaultImage = lastUsedAnimation1Name || 'Dragon';
    const newAnim: Animation = {
      id: maxId + 1, name: '', animation1Name: defaultImage, animation1Hue: 0,
      animation2Name: '', animation2Hue: 0, position: 1, frames: [[]], timings: [],
    };
    const newData = [...data];
    while (newData.length <= maxId + 1) newData.push(null);
    newData[maxId + 1] = newAnim;
    onChange(newData);
    setSelectedId(maxId + 1);
  }, [data, onChange]);

  const handleDelete = useCallback((id: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Animation[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== id);
    onChange(newData);
    if (id === selectedId) {
      const remaining = newData.filter(Boolean) as Animation[];
      if (remaining.length > 0) setSelectedId(remaining[0].id);
    }
  }, [data, onChange, selectedId]);

  const handleDuplicate = useCallback((id: number) => {
    if (!data) return;
    const source = data.find((item) => item && item.id === id);
    if (!source) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newId = maxId + 1;
    const newData = [...data];
    while (newData.length <= newId) newData.push(null);
    newData[newId] = {
      ...source, id: newId,
      frames: source.frames.map(f => f.map(c => [...c])),
      timings: source.timings.map(ti => ({ ...ti, flashColor: [...(ti.flashColor || [255, 255, 255, 170])], se: { ...(ti.se || { name: '', pan: 0, pitch: 100, volume: 90 }) } })),
    };
    onChange(newData);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleReorder = useCallback((fromId: number, toId: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Animation[];
    const fromIdx = items.findIndex(item => item.id === fromId);
    if (fromIdx < 0) return;
    const [moved] = items.splice(fromIdx, 1);
    if (toId === -1) {
      items.push(moved);
    } else {
      const toIdx = items.findIndex(item => item.id === toId);
      if (toIdx < 0) items.push(moved);
      else items.splice(toIdx, 0, moved);
    }
    onChange([null, ...items]);
  }, [data, onChange]);

  const handleTimingChange = (index: number, field: keyof AnimationTiming, value: unknown) => {
    const timings = [...(selectedItem?.timings || [])];
    timings[index] = { ...timings[index], [field]: value };
    handleFieldChange('timings', timings);
  };

  const addTiming = () => {
    const timings = [...(selectedItem?.timings || []), { flashColor: [255, 255, 255, 170], flashDuration: 5, flashScope: 1, frame: 0, se: { name: '', pan: 0, pitch: 100, volume: 90 } }];
    handleFieldChange('timings', timings);
    setSelectedTimingIdx(timings.length - 1);
  };

  const removeTiming = (index: number) => {
    handleFieldChange('timings', (selectedItem?.timings || []).filter((_: unknown, i: number) => i !== index));
    setSelectedTimingIdx(-1);
  };

  const getTimingSeText = (timing: AnimationTiming): string => {
    if (timing.se && timing.se.name) return timing.se.name;
    return t('animations.noSe');
  };

  const getTimingFlashText = (timing: AnimationTiming): string => {
    if (timing.flashScope === 3) return t('animations.hideTarget');
    if (timing.flashScope === 0 || (!timing.flashColor && timing.flashScope !== 3)) return t('animations.noFlash');
    const c = timing.flashColor || [255, 255, 255, 170];
    const d = timing.flashDuration || 0;
    if (timing.flashScope === 2) return `화면(${c[0]},${c[1]},${c[2]},${c[3]}), ${d}프레임들`;
    return `대상(${c[0]},${c[1]},${c[2]},${c[3]}), ${d}프레임들`;
  };

  const totalFrames = selectedItem?.frames?.length || 0;

  return (
    <div className="db-tab-layout">
      <DatabaseList
        items={data}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAddNew}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
      />
      <div className="db-form anim-form-layout">
        {selectedItem && (
          <>
            {/* ===== 상단: 일반 설정 + SE와 Flash 타이밍 ===== */}
            <div className="anim-upper-section">
              {/* 왼쪽: 일반 설정 (테두리 박스) */}
              <fieldset className="anim-fieldset anim-general-settings">
                <legend>{t('animations.generalSettings')}</legend>
                <div className="anim-field-row">
                  <label className="anim-field-label">{t('common.name')}:</label>
                  <input type="text" className="anim-field-input" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
                </div>

                <div className="anim-field-row">
                  <label className="anim-field-label">{t('animations.image1')}:</label>
                  <div className="anim-img-btn-row">
                    <input type="text" className="anim-field-input" value={selectedItem.animation1Name || '(None)'} readOnly />
                    <button className="db-btn-small" onClick={() => setShowImg1Popup(true)}>...</button>
                  </div>
                </div>
                <div className="anim-field-row">
                  <label className="anim-field-label">{t('animations.image2')}:</label>
                  <div className="anim-img-btn-row">
                    <input type="text" className="anim-field-input" value={selectedItem.animation2Name || '(None)'} readOnly />
                    <button className="db-btn-small" onClick={() => setShowImg2Popup(true)}>...</button>
                  </div>
                </div>

                <div className="anim-field-row">
                  <label className="anim-field-label">{t('animations.position')}:</label>
                  <select className="anim-field-select" value={selectedItem.position || 0} onChange={(e) => handleFieldChange('position', Number(e.target.value))}>
                    {POSITION_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
                  </select>
                  <label className="anim-field-label" style={{ marginLeft: 12 }}>최대 프레임:</label>
                  <input type="text" className="anim-maxframe-input" value={totalFrames} readOnly />
                  <button className="db-btn-small" onClick={() => setShowMaxFrameDialog(true)}>...</button>
                </div>
              </fieldset>

              {/* 오른쪽: SE와 Flash 타이밍 (테두리 박스) */}
              <fieldset className="anim-fieldset anim-timing-section">
                <legend>{t('animations.seAndFlashTiming')}</legend>
                <div className="anim-timing-table-wrapper">
                  <table className="anim-timing-table">
                    <thead>
                      <tr>
                        <th className="anim-timing-col-no">{t('animations.timingNo')}</th>
                        <th className="anim-timing-col-se">{t('animations.timingSe')}</th>
                        <th className="anim-timing-col-flash">{t('animations.timingFlash')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedItem.timings || []).map((timing: AnimationTiming, i: number) => (
                        <tr
                          key={i}
                          className={selectedTimingIdx === i ? 'selected' : ''}
                          onClick={() => setSelectedTimingIdx(i)}
                          onDoubleClick={() => setSelectedTimingIdx(i)}
                        >
                          <td className="anim-timing-col-no">#{String(i + 1).padStart(3, '0')}</td>
                          <td className="anim-timing-col-se">{getTimingSeText(timing)}</td>
                          <td className="anim-timing-col-flash">{getTimingFlashText(timing)}, {timing.frame}프레임들</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 선택된 타이밍 편집 */}
                {selectedTimingIdx >= 0 && selectedItem.timings && selectedItem.timings[selectedTimingIdx] && (
                  <div className="anim-timing-edit">
                    <div className="anim-timing-edit-row">
                      <label>
                        {t('animations.frame')}
                        <input type="number" min={0} value={selectedItem.timings[selectedTimingIdx].frame} onChange={(e) => handleTimingChange(selectedTimingIdx, 'frame', Number(e.target.value))} style={{ width: 60 }} />
                      </label>
                      <label>
                        {t('animations.flashScope')}
                        <select value={selectedItem.timings[selectedTimingIdx].flashScope} onChange={(e) => handleTimingChange(selectedTimingIdx, 'flashScope', Number(e.target.value))}>
                          <option value={0}>{t('animations.flashScopes.0')}</option>
                          <option value={1}>{t('animations.flashScopes.1')}</option>
                          <option value={2}>{t('animations.flashScopes.2')}</option>
                          <option value={3}>{t('animations.flashScopes.3')}</option>
                        </select>
                      </label>
                      <label>
                        {t('animations.duration')}
                        <input type="number" min={0} value={selectedItem.timings[selectedTimingIdx].flashDuration || 0} onChange={(e) => handleTimingChange(selectedTimingIdx, 'flashDuration', Number(e.target.value))} style={{ width: 50 }} />
                      </label>
                      <button className="db-btn-small" style={{ marginLeft: 'auto' }} onClick={addTiming}>+</button>
                      <button className="db-btn-small" onClick={() => removeTiming(selectedTimingIdx)}>-</button>
                    </div>
                    <div className="anim-timing-edit-row">
                      <label style={{ flex: 1 }}>
                        SE
                        <AudioPicker type="se" value={selectedItem.timings[selectedTimingIdx].se || { name: '', pan: 0, pitch: 100, volume: 90 }} onChange={(a: AudioFile) => handleTimingChange(selectedTimingIdx, 'se', a)} />
                      </label>
                    </div>
                    <div className="anim-timing-edit-row">
                      <label>{t('animations.flashColor')}
                        <div className="anim-flash-color-inputs">
                          {[0, 1, 2, 3].map((ci) => (
                            <input key={ci} type="number" value={(selectedItem.timings![selectedTimingIdx].flashColor || [255, 255, 255, 170])[ci]}
                              onChange={(e) => { const c = [...(selectedItem.timings![selectedTimingIdx].flashColor || [255, 255, 255, 170])]; c[ci] = Number(e.target.value); handleTimingChange(selectedTimingIdx, 'flashColor', c); }}
                              min={0} max={255} />
                          ))}
                        </div>
                      </label>
                    </div>
                  </div>
                )}
                {/* 타이밍이 없거나 선택 안 됐을 때 +/- 버튼 */}
                {(selectedTimingIdx < 0 || !selectedItem.timings || !selectedItem.timings[selectedTimingIdx]) && (
                  <div className="anim-timing-edit-row" style={{ padding: '4px 0' }}>
                    <button className="db-btn-small" style={{ marginLeft: 'auto' }} onClick={addTiming}>+</button>
                  </div>
                )}
              </fieldset>
            </div>

            {/* ===== 하단: 프레임 (테두리 박스) ===== */}
            <fieldset className="anim-fieldset anim-lower-section">
              <legend>{t('animations.frames')}</legend>
              <div className="anim-frame-area">
                {/* 왼쪽: 프레임 목록 */}
                <div className="anim-frame-list">
                  {Array.from({ length: totalFrames }, (_, i) => (
                    <div
                      key={i}
                      className={`anim-frame-item${selectedFrameIdx === i ? ' selected' : ''}`}
                      onClick={() => setSelectedFrameIdx(i)}
                    >
                      #{String(i + 1).padStart(3, '0')}
                    </div>
                  ))}
                  {totalFrames === 0 && (
                    <div className="anim-frame-empty">-----</div>
                  )}
                </div>

                {/* 가운데: 미리보기 캔버스 */}
                <div className="anim-frame-preview">
                  <AnimationPreview ref={previewRef} animation={selectedItem} initialFrame={selectedFrameIdx} targetImageName={targetImageName} />
                </div>

                {/* 오른쪽: 버튼 */}
                <div className="anim-frame-buttons">
                  <button className="anim-frame-btn" onClick={() => setShowEnemyImagePopup(true)}>대상 변경...</button>
                  <button className="anim-frame-btn">전 프레임 붙이기</button>
                  <button className="anim-frame-btn" onClick={() => setShowTweenDialog(true)}>보완...</button>
                  <button className="anim-frame-btn" onClick={() => setShowBatchSettingDialog(true)}>일괄 설정...</button>
                  <button className="anim-frame-btn" onClick={() => setShowShiftDialog(true)}>시프트...</button>
                  <button className="anim-frame-btn anim-frame-btn-play" onClick={() => previewRef.current?.play()}>재생</button>
                </div>
              </div>

              {/* 하단: 셀 팔레트 (이미지1의 스프라이트 시트) */}
              <div className="anim-cell-palette">
                {selectedItem.animation1Name && (
                  <img
                    src={`/api/resources/animations/${selectedItem.animation1Name}.png`}
                    alt="Cell palette"
                    className="anim-cell-palette-img"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            </fieldset>

            {/* ===== 팝업들 ===== */}
            {showImg1Popup && (
              <ImageSelectPopup
                type="animations"
                value={selectedItem.animation1Name || ''}
                hue={selectedItem.animation1Hue || 0}
                onSelect={(name, hue) => handleMultiFieldChange({ animation1Name: name, animation1Hue: hue })}
                onClose={() => setShowImg1Popup(false)}
              />
            )}
            {showImg2Popup && (
              <ImageSelectPopup
                type="animations"
                value={selectedItem.animation2Name || ''}
                hue={selectedItem.animation2Hue || 0}
                onSelect={(name, hue) => handleMultiFieldChange({ animation2Name: name, animation2Hue: hue })}
                onClose={() => setShowImg2Popup(false)}
              />
            )}
            {showMaxFrameDialog && (
              <MaxFrameDialog
                value={totalFrames}
                onConfirm={handleMaxFrameChange}
                onClose={() => setShowMaxFrameDialog(false)}
              />
            )}
            {showEnemyImagePopup && (
              <EnemyImageSelectPopup
                value={targetImageName}
                onSelect={(name) => setTargetImageName(name || 'Dragon')}
                onClose={() => setShowEnemyImagePopup(false)}
              />
            )}
            {showTweenDialog && (
              <TweenDialog
                totalFrames={totalFrames}
                maxCells={Math.max(...(selectedItem.frames || []).map(f => f.length), 16)}
                onConfirm={handleTween}
                onClose={() => setShowTweenDialog(false)}
              />
            )}
            {showBatchSettingDialog && (
              <BatchSettingDialog
                totalFrames={totalFrames}
                maxCells={Math.max(...(selectedItem.frames || []).map(f => f.length), 16)}
                onConfirm={handleBatchSetting}
                onClose={() => setShowBatchSettingDialog(false)}
              />
            )}
            {showShiftDialog && (
              <ShiftDialog
                totalFrames={totalFrames}
                maxCells={Math.max(...(selectedItem.frames || []).map(f => f.length), 16)}
                onConfirm={handleShift}
                onClose={() => setShowShiftDialog(false)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
