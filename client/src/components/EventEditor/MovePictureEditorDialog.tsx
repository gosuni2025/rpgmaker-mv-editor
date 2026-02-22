import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

export function MovePictureEditorDialog({ p, onOk, onCancel }: {
  p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void;
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
  const [fromSource, setFromSource] = useState<'manual' | 'command'>('manual');
  const [fromPosX, setFromPosX] = useState<number>(0);
  const [fromPosY, setFromPosY] = useState<number>(0);
  const [fromOrigin, setFromOrigin] = useState<number>(origin);
  const [fromPositionType, setFromPositionType] = useState<number>(0);
  const [fromPresetX, setFromPresetX] = useState<number>(3);
  const [fromPresetY, setFromPresetY] = useState<number>(3);
  const [fromPresetOffsetX, setFromPresetOffsetX] = useState<number>(0);
  const [fromPresetOffsetY, setFromPresetOffsetY] = useState<number>(0);
  const [fromScaleWidth, setFromScaleWidth] = useState<number>(100);
  const [fromScaleHeight, setFromScaleHeight] = useState<number>(100);
  const [fromOpacity, setFromOpacity] = useState<number>(255);

  // 이벤트 커맨드 목록에서 그림 표시/이동 커맨드 가져오기
  const currentMap = useEditorStore(s => s.currentMap);
  const selectedEventId = useEditorStore(s => s.selectedEventId);

  const pictureCommands = useMemo(() => {
    const event = currentMap?.events?.find(e => e?.id === selectedEventId);
    if (!event) return [];
    // 모든 페이지에서 해당 pictureNumber의 231/232 커맨드 수집
    const cmds: Array<{ code: number; params: unknown[]; pageIndex: number; cmdIndex: number }> = [];
    const pages = (event as any).pages || [];
    pages.forEach((page: any, pi: number) => {
      (page?.list || []).forEach((cmd: any, ci: number) => {
        if ((cmd.code === 231 || cmd.code === 232) && cmd.parameters?.[0] === pictureNumber) {
          cmds.push({ code: cmd.code, params: cmd.parameters, pageIndex: pi, cmdIndex: ci });
        }
      });
    });
    return cmds;
  }, [currentMap, selectedEventId, pictureNumber]);

  // 커맨드 선택 시 시작 위치 자동 설정
  const [selectedCmdIdx, setSelectedCmdIdx] = useState<number>(-1);

  const applyCommandAsFrom = useCallback((idx: number) => {
    setSelectedCmdIdx(idx);
    if (idx < 0 || idx >= pictureCommands.length) { setFromSource('manual'); return; }
    setFromSource('command');
    const cmd = pictureCommands[idx];
    const pp = cmd.params;
    setFromOrigin((pp[2] as number) || 0);
    setFromPositionType((pp[3] as number) || 0);
    setFromPosX((pp[4] as number) || 0);
    setFromPosY((pp[5] as number) || 0);
    setFromScaleWidth((pp[6] as number) ?? 100);
    setFromScaleHeight((pp[7] as number) ?? 100);
    setFromOpacity((pp[8] as number) ?? 255);
    const ep = pp[12] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
    if (ep) {
      setFromPresetX(ep.presetX ?? 3);
      setFromPresetY(ep.presetY ?? 3);
      setFromPresetOffsetX(ep.offsetX ?? 0);
      setFromPresetOffsetY(ep.offsetY ?? 0);
    }
  }, [pictureCommands]);

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

  // 재생 트리거
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [showWindow, setShowWindow] = useState(true);

  const handlePositionDrag = useCallback((x: number, y: number) => {
    setPositionType(0);
    setPosX(x);
    setPosY(y);
  }, []);

  // PicturePreview에 전달할 상태들 (이미지명은 현재 커맨드에서 가져올 수 없으므로 빈 문자열)
  // "이미지명"은 ShowPicture에서 설정되므로 MovePicture 에디터에서는 없음
  // 프리뷰에서는 imageName 없이 위치만 표시 (이미지 없이 위치 박스 표시)
  // 단, 이전 ShowPicture 커맨드에서 imageName을 가져올 수 있음
  const previewImageName = useMemo(() => {
    // pictureNumber에 해당하는 가장 마지막 231 커맨드의 이미지명
    const showCmds = pictureCommands.filter(c => c.code === 231);
    if (showCmds.length > 0) return (showCmds[showCmds.length - 1].params[1] as string) || '';
    return '';
  }, [pictureCommands]);

  const currentSnap: PictureSnapshot = {
    imageName: previewImageName,
    origin, positionType, posX, posY,
    presetX, presetY, presetOffsetX, presetOffsetY,
    scaleWidth, scaleHeight, opacity, blendMode,
  };

  const fromSnap: PictureSnapshot = {
    imageName: previewImageName,
    origin: fromOrigin,
    positionType: fromPositionType,
    posX: fromPosX,
    posY: fromPosY,
    presetX: fromPresetX,
    presetY: fromPresetY,
    presetOffsetX: fromPresetOffsetX,
    presetOffsetY: fromPresetOffsetY,
    scaleWidth: fromScaleWidth,
    scaleHeight: fromScaleHeight,
    opacity: fromOpacity,
    blendMode,
  };

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

            <Fieldset legend="이동 시작 위치">
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
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={labelStyle}>원점:</span>
                    <label style={radioStyle}>
                      <input type="radio" name="from-pic-origin" checked={fromOrigin === 0} onChange={() => { setFromOrigin(0); setFromSource('manual'); setSelectedCmdIdx(-1); }} />
                      왼쪽 위
                    </label>
                    <label style={radioStyle}>
                      <input type="radio" name="from-pic-origin" checked={fromOrigin === 1} onChange={() => { setFromOrigin(1); setFromSource('manual'); setSelectedCmdIdx(-1); }} />
                      중앙
                    </label>
                  </div>
                  <label style={radioStyle}>
                    <input type="radio" name="from-pic-pos-type" checked={fromPositionType === 0} onChange={() => { setFromPositionType(0); setFromSource('manual'); setSelectedCmdIdx(-1); }} />
                    직접 지정
                  </label>
                  {fromPositionType === 0 && (
                    <DirectPositionInputs posX={fromPosX} posY={fromPosY}
                      onPosXChange={x => { setFromPosX(x); setFromSource('manual'); setSelectedCmdIdx(-1); }}
                      onPosYChange={y => { setFromPosY(y); setFromSource('manual'); setSelectedCmdIdx(-1); }} />
                  )}
                  <label style={radioStyle}>
                    <input type="radio" name="from-pic-pos-type" checked={fromPositionType === 1} onChange={() => { setFromPositionType(1); setFromSource('manual'); setSelectedCmdIdx(-1); }} />
                    변수로 지정
                  </label>
                  {fromPositionType === 1 && (
                    <VariablePositionInputs posX={fromPosX} posY={fromPosY}
                      onPosXChange={x => { setFromPosX(x); setFromSource('manual'); setSelectedCmdIdx(-1); }}
                      onPosYChange={y => { setFromPosY(y); setFromSource('manual'); setSelectedCmdIdx(-1); }} />
                  )}
                  <label style={radioStyle}>
                    <input type="radio" name="from-pic-pos-type" checked={fromPositionType === 2} onChange={() => { setFromPositionType(2); setFromSource('manual'); setSelectedCmdIdx(-1); }} />
                    프리셋 지정
                  </label>
                  {fromPositionType === 2 && (
                    <PresetPositionInputs
                      presetX={fromPresetX} presetY={fromPresetY}
                      offsetX={fromPresetOffsetX} offsetY={fromPresetOffsetY}
                      onPresetXChange={v => { setFromPresetX(v); setFromSource('manual'); setSelectedCmdIdx(-1); }}
                      onPresetYChange={v => { setFromPresetY(v); setFromSource('manual'); setSelectedCmdIdx(-1); }}
                      onOffsetXChange={v => { setFromPresetOffsetX(v); setFromSource('manual'); setSelectedCmdIdx(-1); }}
                      onOffsetYChange={v => { setFromPresetOffsetY(v); setFromSource('manual'); setSelectedCmdIdx(-1); }} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ScaleFields
                    width={fromScaleWidth} height={fromScaleHeight}
                    onWidthChange={w => { setFromScaleWidth(w); setFromSource('manual'); setSelectedCmdIdx(-1); }}
                    onHeightChange={h => { setFromScaleHeight(h); setFromSource('manual'); setSelectedCmdIdx(-1); }} />
                  <Fieldset legend="투명도">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={labelStyle}>불투명도:</span>
                      <input type="number" min={0} max={255} value={fromOpacity}
                        onChange={e => { setFromOpacity(Math.max(0, Math.min(255, Number(e.target.value)))); setFromSource('manual'); setSelectedCmdIdx(-1); }}
                        style={{ ...selectStyle, width: 60 }} />
                    </div>
                  </Fieldset>
                </div>
              </div>
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
                title="대화창 표시/숨기기"
              >
                창
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
                onPositionDrag={handlePositionDrag}
              />
            </div>
          </div>
        </div>

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
