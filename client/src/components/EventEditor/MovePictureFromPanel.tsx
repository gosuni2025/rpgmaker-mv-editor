import React, { useRef } from 'react';
import type { FromState } from './movePictureTypes';
import {
  radioStyle, labelStyle, Fieldset,
  ScaleFields,
  DirectPositionInputs, VariablePositionInputs, PresetPositionInputs,
} from './pictureEditorCommon';
import { selectStyle } from './messageEditors';
import { MovePictureHelpPopup } from './MovePictureHelpPopup';

interface PictureCommandItem {
  code: number;
  params: unknown[];
  pageIndex: number;
  cmdIndex: number;
}

interface MovePictureFromPanelProps {
  from: FromState;
  setFromManual: (patch: Partial<FromState>) => void;
  pictureCommands: PictureCommandItem[];
  selectedCmdIdx: number;
  applyCommandAsFrom: (idx: number) => void;
  ghostOpacity: number;
  handleGhostOpacity: (v: number) => void;
  showFromHelp: boolean;
  setShowFromHelp: (v: boolean | ((prev: boolean) => boolean)) => void;
  helpPos: { top: number; left: number };
  setHelpPos: (pos: { top: number; left: number }) => void;
}

export function MovePictureFromPanel({
  from,
  setFromManual,
  pictureCommands,
  selectedCmdIdx,
  applyCommandAsFrom,
  ghostOpacity,
  handleGhostOpacity,
  showFromHelp,
  setShowFromHelp,
  helpPos,
  setHelpPos,
}: MovePictureFromPanelProps) {
  const helpBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
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

      {showFromHelp && <MovePictureHelpPopup pos={helpPos} onClose={() => setShowFromHelp(false)} />}
    </>
  );
}
