import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useEditorStore from '../../store/useEditorStore';
import { ShaderEditorDialog, ShaderEntry, SHADER_DEFINITIONS } from './shaderEditor';
import { PicturePreview, PictureSnapshot } from './PicturePreview';
import type { ShaderTransition } from './pictureEditorCommon';
import {
  radioStyle, labelStyle, Fieldset, PictureNumberField,
  ScaleFields, BlendFields,
  DirectPositionInputs, VariablePositionInputs, PresetPositionInputs,
} from './pictureEditorCommon';
import { selectStyle } from './messageEditors';
import './ShowChoicesEditor.css';

// MovePicture(232) parameters:
// [번호, (unused), 원점, 위치지정방식, X, Y, 넓이%, 높이%, 불투명도, 합성방법, 지속시간, 완료까지대기, 프리셋데이터?, 이동모드?, 셰이더트랜지션?]

interface FromState {
  origin: number;
  positionType: number;
  posX: number;
  posY: number;
  presetX: number;
  presetY: number;
  presetOffsetX: number;
  presetOffsetY: number;
  scaleWidth: number;
  scaleHeight: number;
  opacity: number;
}

function HelpPopup({ pos, onClose }: { pos: { top: number; left: number }; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
      background: '#1a2535', border: '1px solid #4a7aaa', borderRadius: 8,
      padding: '12px 16px', fontSize: 12, color: '#ccc', lineHeight: 1.7,
      maxWidth: 320, boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontWeight: 'bold', color: '#9cf', marginBottom: 8, fontSize: 13 }}>이동 시작 위치란?</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <li>현재 이벤트에서 같은 그림 번호의 <b>[그림 표시]</b> / <b>[그림 이동]</b> 커맨드 목록입니다.</li>
        <li>위치·배율·투명도 값이 동일한 커맨드는 하나로 묶어 표시하며, 가장 최근 커맨드가 자동으로 선택됩니다.</li>
        <li>선택하면 해당 커맨드의 설정값이 시작 위치에 자동으로 입력됩니다.</li>
      </ul>
      <div style={{ marginTop: 10, padding: '8px 10px', background: '#2a1a1a', border: '1px solid #7a4a3a', borderRadius: 4, color: '#fa9', fontSize: 11, lineHeight: 1.6 }}>
        ⚠ 프리뷰의 반투명 이미지는 참고용 예시일 뿐입니다.<br />
        실제 게임에서 그림이 반드시 이 위치에서 시작하는 것은 아닙니다.
      </div>
      <div style={{ textAlign: 'right', marginTop: 10 }}>
        <button onClick={onClose}
          style={{ fontSize: 11, padding: '2px 14px', background: '#2a3a5a', border: '1px solid #4a6a9a', borderRadius: 3, color: '#9cf', cursor: 'pointer' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

export function MovePictureEditorDialog({ p, commandIndex, pageIndex, onOk, onCancel }: {
  p: unknown[]; commandIndex?: number; pageIndex?: number; onOk: (params: unknown[]) => void; onCancel: () => void;
}) {
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

  const existingPreset = p[12] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
  const [presetX, setPresetX] = useState<number>(existingPreset?.presetX ?? 3);
  const [presetY, setPresetY] = useState<number>(existingPreset?.presetY ?? 3);
  const [presetOffsetX, setPresetOffsetX] = useState<number>(existingPreset?.offsetX ?? 0);
  const [presetOffsetY, setPresetOffsetY] = useState<number>(existingPreset?.offsetY ?? 0);

  const [moveMode, setMoveMode] = useState<'interpolate' | 'instant'>(
    (p[13] as string) === 'instant' ? 'instant' : 'interpolate'
  );

  const existingTransition = p[14] as ShaderTransition | null;
  const initTransitionShaderList = (): ShaderEntry[] => {
    if (!existingTransition?.shaderList) return [];
    return existingTransition.shaderList.map(s => ({ ...s, params: { ...s.params } }));
  };
  const [transitionEnabled, setTransitionEnabled] = useState<boolean>(!!existingTransition);
  const [transitionShaderList, setTransitionShaderList] = useState<ShaderEntry[]>(initTransitionShaderList);
  const [transitionApplyMode, setTransitionApplyMode] = useState<'instant' | 'interpolate'>(
    existingTransition?.applyMode ?? 'interpolate'
  );
  const [transitionDuration, setTransitionDuration] = useState<number>(existingTransition?.duration ?? 1);
  const [showTransitionShaderDialog, setShowTransitionShaderDialog] = useState(false);

  // ─── 시작 위치 ───
  const [from, setFrom] = useState<FromState>({
    origin, positionType: 0,
    posX: 0, posY: 0,
    presetX: 3, presetY: 3, presetOffsetX: 0, presetOffsetY: 0,
    scaleWidth: 100, scaleHeight: 100, opacity: 255,
  });
  const [fromSource, setFromSource] = useState<'manual' | 'command'>('manual');
  const setFromManual = (patch: Partial<FromState>) => {
    setFrom(prev => ({ ...prev, ...patch }));
    setFromSource('manual');
    setSelectedCmdIdx(-1);
  };

  const { currentMap, selectedEventId } = useEditorStore(useShallow(s => ({
    currentMap: s.currentMap,
    selectedEventId: s.selectedEventId,
  })));

  const pictureCommands = useMemo(() => {
    const event = currentMap?.events?.find(e => e?.id === selectedEventId);
    if (!event) return [];
    const cmds: Array<{ code: number; params: unknown[]; pageIndex: number; cmdIndex: number }> = [];
    const pages = (event as any).pages || [];
    pages.forEach((page: any, pi: number) => {
      if (pageIndex !== undefined && pi !== pageIndex) return;
      (page?.list || []).forEach((cmd: any, ci: number) => {
        if (commandIndex !== undefined && ci >= commandIndex) return;
        if ((cmd.code === 231 || cmd.code === 232) && cmd.parameters?.[0] === pictureNumber) {
          cmds.push({ code: cmd.code, params: cmd.parameters, pageIndex: pi, cmdIndex: ci });
        }
      });
    });
    cmds.reverse();
    const seen = new Set<string>();
    return cmds.filter(cmd => {
      const pp = cmd.params;
      const key = [pp[2], pp[3], pp[4], pp[5], pp[6], pp[7], pp[8], JSON.stringify(pp[12])].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [currentMap, selectedEventId, pictureNumber, commandIndex, pageIndex]);

  const [selectedCmdIdx, setSelectedCmdIdx] = useState<number>(-1);

  const applyCommandAsFrom = useCallback((idx: number) => {
    setSelectedCmdIdx(idx);
    if (idx < 0 || idx >= pictureCommands.length) { setFromSource('manual'); return; }
    setFromSource('command');
    const cmd = pictureCommands[idx];
    const pp = cmd.params;
    const ep = pp[12] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
    setFrom({
      origin: (pp[2] as number) || 0,
      positionType: (pp[3] as number) || 0,
      posX: (pp[4] as number) || 0,
      posY: (pp[5] as number) || 0,
      scaleWidth: (pp[6] as number) ?? 100,
      scaleHeight: (pp[7] as number) ?? 100,
      opacity: (pp[8] as number) ?? 255,
      presetX: ep?.presetX ?? 3,
      presetY: ep?.presetY ?? 3,
      presetOffsetX: ep?.offsetX ?? 0,
      presetOffsetY: ep?.offsetY ?? 0,
    });
  }, [pictureCommands]);

  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!autoSelectedRef.current && pictureCommands.length > 0) {
      autoSelectedRef.current = true;
      applyCommandAsFrom(0);
    }
  }, [pictureCommands, applyCommandAsFrom]);

  // 시작 위치 도움말 팝업
  const [showFromHelp, setShowFromHelp] = useState(false);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const [helpPos, setHelpPos] = useState({ top: 0, left: 0 });

  // 프리뷰 분리선 드래그
  const [previewWidth, setPreviewWidth] = useState(() => {
    const saved = localStorage.getItem('movepicture-preview-width');
    return saved ? Math.max(220, Math.min(900, parseInt(saved, 10))) : 420;
  });
  const splitDragging = useRef(false);
  const splitStartX = useRef(0);
  const splitStartW = useRef(previewWidth);
  const onSplitDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    splitDragging.current = true;
    splitStartX.current = e.clientX;
    splitStartW.current = previewWidth;
  }, [previewWidth]);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!splitDragging.current) return;
      const delta = splitStartX.current - e.clientX;
      const w = Math.max(220, Math.min(900, splitStartW.current + delta));
      setPreviewWidth(w);
      localStorage.setItem('movepicture-preview-width', String(w));
    };
    const onUp = () => { splitDragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  const [replayTrigger, setReplayTrigger] = useState(0);
  const [showWindow, setShowWindow] = useState(true);

  const [ghostOpacity, setGhostOpacity] = useState(() => {
    const v = localStorage.getItem('movepicture.ghostOpacity');
    return v !== null ? parseFloat(v) : 0.35;
  });
  const handleGhostOpacity = (v: number) => {
    setGhostOpacity(v);
    localStorage.setItem('movepicture.ghostOpacity', String(v));
  };

  // 드래그 undo 스택
  const undoStack = useRef<{ posX: number; posY: number; positionType: number }[]>([]);
  const posXRef = useRef(posX); posXRef.current = posX;
  const posYRef = useRef(posY); posYRef.current = posY;
  const positionTypeRef = useRef(positionType); positionTypeRef.current = positionType;

  const handleDragStart = useCallback(() => {
    undoStack.current.push({ posX: posXRef.current, posY: posYRef.current, positionType: positionTypeRef.current });
  }, []);
  const handlePositionDrag = useCallback((x: number, y: number) => {
    setPositionType(0); setPosX(x); setPosY(y);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key === 'z')) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const prev = undoStack.current.pop();
      if (prev) { e.preventDefault(); setPositionType(prev.positionType); setPosX(prev.posX); setPosY(prev.posY); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const previewImageName = useMemo(() => {
    const showCmds = pictureCommands.filter(c => c.code === 231);
    return showCmds.length > 0 ? (showCmds[0].params[1] as string) || '' : '';
  }, [pictureCommands]);

  const currentSnap: PictureSnapshot = {
    imageName: previewImageName,
    origin, positionType, posX, posY,
    presetX, presetY, presetOffsetX, presetOffsetY,
    scaleWidth, scaleHeight, opacity, blendMode,
  };
  const fromSnap: PictureSnapshot = { imageName: previewImageName, blendMode, ...from };

  const moveDurationMs = moveMode === 'interpolate' ? duration / 60 * 1000 : 300;

  const handleOk = () => {
    const effectiveDuration = moveMode === 'instant' ? 1 : duration;
    const presetData = positionType === 2 ? { presetX, presetY, offsetX: presetOffsetX, offsetY: presetOffsetY } : null;
    const transitionData: ShaderTransition | null = moveMode === 'interpolate' && transitionEnabled && transitionShaderList.length > 0
      ? { shaderList: transitionShaderList.map(s => ({ ...s, params: { ...s.params } })), applyMode: transitionApplyMode, duration: transitionApplyMode === 'interpolate' ? transitionDuration : 0 }
      : null;
    onOk([pictureNumber, '', origin, positionType, posX, posY, scaleWidth, scaleHeight, opacity, blendMode, effectiveDuration, waitForCompletion, presetData, moveMode, transitionData]);
  };

  return (
    <div className="modal-overlay">
      <div className="show-text-fullscreen-dialog">
        <div className="image-picker-header">그림 이동</div>
        <div className="show-text-body">
          {/* 왼쪽: 설정 패널 */}
          <div className="show-text-settings">
            <Fieldset legend="그림">
              <PictureNumberField value={pictureNumber} onChange={setPictureNumber} />
            </Fieldset>

            <div style={{ display: 'flex', gap: 8 }}>
              <Fieldset legend="이동 후 위치" style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={labelStyle}>원점:</span>
                    <label style={radioStyle}>
                      <input type="radio" name="move-pic-origin" checked={origin === 0} onChange={() => setOrigin(0)} />
                      왼쪽 위
                    </label>
                    <label style={radioStyle}>
                      <input type="radio" name="move-pic-origin" checked={origin === 1} onChange={() => setOrigin(1)} />
                      중앙
                    </label>
                  </div>
                  <label style={radioStyle}>
                    <input type="radio" name="movepic-pos-type" checked={positionType === 0} onChange={() => setPositionType(0)} />
                    직접 지정
                  </label>
                  {positionType === 0 && <DirectPositionInputs posX={posX} posY={posY} onPosXChange={setPosX} onPosYChange={setPosY} />}
                  <label style={radioStyle}>
                    <input type="radio" name="movepic-pos-type" checked={positionType === 1} onChange={() => setPositionType(1)} />
                    변수로 지정
                  </label>
                  {positionType === 1 && <VariablePositionInputs posX={posX} posY={posY} onPosXChange={setPosX} onPosYChange={setPosY} />}
                  <label style={radioStyle}>
                    <input type="radio" name="movepic-pos-type" checked={positionType === 2} onChange={() => setPositionType(2)} />
                    프리셋 지정
                  </label>
                  {positionType === 2 && (
                    <PresetPositionInputs presetX={presetX} presetY={presetY} offsetX={presetOffsetX} offsetY={presetOffsetY}
                      onPresetXChange={setPresetX} onPresetYChange={setPresetY}
                      onOffsetXChange={setPresetOffsetX} onOffsetYChange={setPresetOffsetY} />
                  )}
                </div>
              </Fieldset>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ScaleFields width={scaleWidth} height={scaleHeight} onWidthChange={setScaleWidth} onHeightChange={setScaleHeight} />
                <BlendFields opacity={opacity} blendMode={blendMode} onOpacityChange={setOpacity} onBlendModeChange={setBlendMode} />
              </div>
            </div>

            <Fieldset legend="이동 방식">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={radioStyle}>
                    <input type="radio" name="move-pic-mode" checked={moveMode === 'interpolate'} onChange={() => setMoveMode('interpolate')} />
                    보간 이동
                  </label>
                  <label style={radioStyle}>
                    <input type="radio" name="move-pic-mode" checked={moveMode === 'instant'} onChange={() => setMoveMode('instant')} />
                    즉시 이동
                  </label>
                </div>
                {moveMode === 'interpolate' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 20 }}>
                    <span style={labelStyle}>지속 시간:</span>
                    <input type="number" min={1} max={999} value={duration}
                      onChange={e => setDuration(Math.max(1, Math.min(999, Number(e.target.value))))}
                      style={{ ...selectStyle, width: 60 }} />
                    <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
                    <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 16 }}>
                      <input type="checkbox" checked={waitForCompletion} onChange={e => setWaitForCompletion(e.target.checked)} />
                      완료까지 대기
                    </label>
                  </div>
                )}
              </div>
            </Fieldset>

            {moveMode === 'interpolate' && (
              <Fieldset legend="셰이더 트랜지션">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={transitionEnabled} onChange={e => setTransitionEnabled(e.target.checked)} />
                    셰이더 트랜지션 사용
                  </label>
                  {transitionEnabled && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="db-btn" onClick={() => setShowTransitionShaderDialog(true)}>셰이더 설정...</button>
                        <span style={{ fontSize: 12, color: transitionShaderList.length > 0 ? '#7cb3ff' : '#666' }}>
                          {transitionShaderList.length > 0 ? transitionShaderList.map(s => SHADER_DEFINITIONS.find(d => d.type === s.type)?.label ?? s.type).join(' + ') : '없음'}
                        </span>
                        {transitionShaderList.length > 0 && (
                          <button className="db-btn" style={{ fontSize: 11, padding: '1px 6px', color: '#f88' }} onClick={() => setTransitionShaderList([])}>초기화</button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={labelStyle}>적용 방식:</span>
                        <label style={radioStyle}>
                          <input type="radio" name="move-pic-transition-mode" checked={transitionApplyMode === 'interpolate'} onChange={() => setTransitionApplyMode('interpolate')} />
                          보간 적용
                        </label>
                        <label style={radioStyle}>
                          <input type="radio" name="move-pic-transition-mode" checked={transitionApplyMode === 'instant'} onChange={() => setTransitionApplyMode('instant')} />
                          즉시 적용
                        </label>
                      </div>
                      {transitionApplyMode === 'interpolate' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={labelStyle}>소요 시간:</span>
                          <input type="number" min={0.1} max={60} step={0.1} value={transitionDuration}
                            onChange={e => setTransitionDuration(Math.max(0.1, Math.min(60, Number(e.target.value))))}
                            style={{ ...selectStyle, width: 70 }} />
                          <span style={{ fontSize: 12, color: '#aaa' }}>초</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Fieldset>
            )}
          </div>

          {/* 스플릿 핸들 */}
          <div className="show-text-split-handle" onMouseDown={onSplitDown} title="드래그하여 미리보기 크기 조절" />

          {/* 오른쪽: 프리뷰 패널 */}
          <div className="show-text-preview-panel" style={{ width: previewWidth, overflow: 'auto' }}>
            <div className="show-text-preview-header">
              미리보기
              <span style={{ fontSize: 11, color: '#555', marginLeft: 8 }}>816×624</span>
              <button
                onClick={() => setReplayTrigger(t => t + 1)}
                style={{ marginLeft: 'auto', fontSize: 11, padding: '1px 8px', background: '#2a3a5a', border: '1px solid #4a6a9a', borderRadius: 3, color: '#9cf', cursor: 'pointer' }}
                title="이동 애니메이션 재생"
              >
                ▶ 재생
              </button>
              <button
                onClick={() => setShowWindow(w => !w)}
                style={{ fontSize: 11, padding: '1px 8px', background: showWindow ? '#1a3a2a' : '#2b2b2b', border: `1px solid ${showWindow ? '#3a7a4a' : '#555'}`, borderRadius: 3, color: showWindow ? '#6da' : '#666', cursor: 'pointer' }}
                title="대사창 표시/숨기기"
              >
                대사창
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#111', borderRadius: 4, padding: 6 }}>
              <PicturePreview
                current={currentSnap}
                from={fromSnap}
                durationMs={moveDurationMs}
                replayTrigger={replayTrigger}
                showWindow={showWindow}
                showFromGhost
                ghostOpacity={ghostOpacity}
                onPositionDrag={handlePositionDrag}
                onDragStart={handleDragStart}
              />
            </div>

            {/* 이동 시작 위치 */}
            <div style={{ marginTop: 8, overflow: 'auto' }}>
              <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
                <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>
                  이동 시작 위치
                  <button
                    ref={helpBtnRef}
                    onClick={() => {
                      const r = helpBtnRef.current?.getBoundingClientRect();
                      if (r) setHelpPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 340) });
                      setShowFromHelp(h => !h);
                    }}
                    style={{ marginLeft: 6, fontSize: 11, width: 18, height: 18, borderRadius: '50%', border: '1px solid #556', background: '#2a3a4a', color: '#8ab', cursor: 'pointer', verticalAlign: 'middle', lineHeight: '16px', padding: 0 }}
                    title="이 기능 설명 보기"
                  >?</button>
                </legend>
                {pictureCommands.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={labelStyle}>커맨드:</span>
                    <select value={selectedCmdIdx} onChange={e => applyCommandAsFrom(Number(e.target.value))}
                      style={{ ...selectStyle, flex: 1, fontSize: 11 }}>
                      <option value={-1}>직접 입력</option>
                      {pictureCommands.map((cmd, i) => (
                        <option key={i} value={i}>
                          {cmd.code === 231 ? '[그림 표시]' : '[그림 이동]'} pg{cmd.pageIndex + 1} #{cmd.cmdIndex + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* 위치 */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={labelStyle}>원점:</span>
                      <label style={radioStyle}>
                        <input type="radio" name="from-pic-origin" checked={from.origin === 0} onChange={() => setFromManual({ origin: 0 })} />
                        왼쪽 위
                      </label>
                      <label style={radioStyle}>
                        <input type="radio" name="from-pic-origin" checked={from.origin === 1} onChange={() => setFromManual({ origin: 1 })} />
                        중앙
                      </label>
                    </div>
                    <label style={radioStyle}>
                      <input type="radio" name="from-pic-pos-type" checked={from.positionType === 0} onChange={() => setFromManual({ positionType: 0 })} />
                      직접 지정
                    </label>
                    {from.positionType === 0 && (
                      <DirectPositionInputs posX={from.posX} posY={from.posY}
                        onPosXChange={x => setFromManual({ posX: x })}
                        onPosYChange={y => setFromManual({ posY: y })} />
                    )}
                    <label style={radioStyle}>
                      <input type="radio" name="from-pic-pos-type" checked={from.positionType === 1} onChange={() => setFromManual({ positionType: 1 })} />
                      변수로 지정
                    </label>
                    {from.positionType === 1 && (
                      <VariablePositionInputs posX={from.posX} posY={from.posY}
                        onPosXChange={x => setFromManual({ posX: x })}
                        onPosYChange={y => setFromManual({ posY: y })} />
                    )}
                    <label style={radioStyle}>
                      <input type="radio" name="from-pic-pos-type" checked={from.positionType === 2} onChange={() => setFromManual({ positionType: 2 })} />
                      프리셋 지정
                    </label>
                    {from.positionType === 2 && (
                      <PresetPositionInputs
                        presetX={from.presetX} presetY={from.presetY}
                        offsetX={from.presetOffsetX} offsetY={from.presetOffsetY}
                        onPresetXChange={v => setFromManual({ presetX: v })}
                        onPresetYChange={v => setFromManual({ presetY: v })}
                        onOffsetXChange={v => setFromManual({ presetOffsetX: v })}
                        onOffsetYChange={v => setFromManual({ presetOffsetY: v })} />
                    )}
                  </div>
                  {/* 배율 + 투명도 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ScaleFields
                      width={from.scaleWidth} height={from.scaleHeight}
                      onWidthChange={w => setFromManual({ scaleWidth: w })}
                      onHeightChange={h => setFromManual({ scaleHeight: h })} />
                    <Fieldset legend="투명도">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={labelStyle}>불투명도:</span>
                        <input type="number" min={0} max={255} value={from.opacity}
                          onChange={e => setFromManual({ opacity: Math.max(0, Math.min(255, Number(e.target.value))) })}
                          style={{ ...selectStyle, width: 60 }} />
                      </div>
                    </Fieldset>
                  </div>
                </div>

                {/* 고스트 불투명도 슬라이더 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid #444' }}>
                  <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>고스트 불투명도</span>
                  <input type="range" min={0} max={1} step={0.05} value={ghostOpacity}
                    onChange={e => handleGhostOpacity(parseFloat(e.target.value))}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#aaa', width: 34, textAlign: 'right' }}>
                    {Math.round(ghostOpacity * 100)}%
                  </span>
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        {showFromHelp && <HelpPopup pos={helpPos} onClose={() => setShowFromHelp(false)} />}

        <div className="image-picker-footer">
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>

      {showTransitionShaderDialog && (
        <ShaderEditorDialog
          shaderList={transitionShaderList}
          transitionOnly
          onOk={(list) => { setTransitionShaderList(list); setShowTransitionShaderDialog(false); }}
          onCancel={() => setShowTransitionShaderDialog(false)}
        />
      )}
    </div>
  );
}
