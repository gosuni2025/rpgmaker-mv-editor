import React, { useState } from 'react';
import type { MoveCommand } from '../../types/rpgMakerMV';
import AudioPicker from '../common/AudioPicker';

// 이동 명령 코드 (rpg_objects.js의 Game_Character.ROUTE_* 상수)
export const ROUTE_END = 0;
export const ROUTE_JUMP = 14;
export const ROUTE_WAIT = 15;
export const ROUTE_SWITCH_ON = 27;
export const ROUTE_SWITCH_OFF = 28;
export const ROUTE_CHANGE_SPEED = 29;
export const ROUTE_CHANGE_FREQ = 30;
export const ROUTE_CHANGE_IMAGE = 41;
export const ROUTE_CHANGE_OPACITY = 42;
export const ROUTE_CHANGE_BLEND_MODE = 43;
export const ROUTE_PLAY_SE = 44;
export const ROUTE_SCRIPT = 45;

// 명령 버튼의 코드 배열 (원본 RPG Maker MV 이동 루트 다이얼로그 순서)
export const COMMAND_CODES = [
  1, 2, 3, 4,       // 아래/왼쪽/오른쪽/위 이동
  5, 6, 7, 8,       // 대각선 이동
  9, 10, 11, 12,    // 랜덤/접근/멀어지기/앞으로
  13, 14, 15,       // 뒤로/점프/대기
  16, 17, 18, 19,   // 아래/왼쪽/오른쪽/위 보기
  20, 21, 22, 23,   // 90도 회전들
  24, 25, 26,       // 무작위/플레이어 향하기/등 향하기
  27, 28,           // 스위치 ON/OFF
  29, 30,           // 속도/빈도 변경
  31, 32, 33, 34,   // 보행/제자리 애니 ON/OFF
  35, 36, 37, 38,   // 방향 고정/통과 ON/OFF
  39, 40,           // 투명 ON/OFF
  41, 42, 43,       // 이미지/불투명도/합성방식 변경
  44, 45,           // SE 재생/스크립트
];

// 파라미터가 필요한 명령인지 확인
export function needsParams(code: number): boolean {
  return [
    ROUTE_JUMP, ROUTE_WAIT,
    ROUTE_SWITCH_ON, ROUTE_SWITCH_OFF,
    ROUTE_CHANGE_SPEED, ROUTE_CHANGE_FREQ,
    ROUTE_CHANGE_IMAGE, ROUTE_CHANGE_OPACITY,
    ROUTE_CHANGE_BLEND_MODE, ROUTE_PLAY_SE, ROUTE_SCRIPT,
  ].includes(code);
}

export function getDefaultParams(code: number): unknown[] {
  switch (code) {
    case ROUTE_JUMP: return [0, 0];
    case ROUTE_WAIT: return [60];
    case ROUTE_SWITCH_ON:
    case ROUTE_SWITCH_OFF: return [1];
    case ROUTE_CHANGE_SPEED: return [4];
    case ROUTE_CHANGE_FREQ: return [3];
    case ROUTE_CHANGE_IMAGE: return ['', 0];
    case ROUTE_CHANGE_OPACITY: return [255];
    case ROUTE_CHANGE_BLEND_MODE: return [0];
    case ROUTE_PLAY_SE: return [{ name: '', volume: 90, pitch: 100, pan: 0 }];
    case ROUTE_SCRIPT: return [''];
    default: return [];
  }
}

// 명령의 표시 텍스트 생성
export function getCommandDisplay(cmd: MoveCommand, t: (key: string) => string): string {
  const label = t(`moveRoute.commands.${cmd.code}`);
  const params = cmd.parameters || [];
  switch (cmd.code) {
    case ROUTE_END:
      return '';
    case ROUTE_JUMP:
      return `${label.replace('...', '')} (${params[0] ?? 0}, ${params[1] ?? 0})`;
    case ROUTE_WAIT:
      return `${label.replace('...', '')} (${params[0] ?? 60})`;
    case ROUTE_SWITCH_ON:
    case ROUTE_SWITCH_OFF:
      return `${label.replace('...', '')} [${String(params[0] ?? 1).padStart(4, '0')}]`;
    case ROUTE_CHANGE_SPEED:
      return `${label.replace('...', '')} (${params[0] ?? 3})`;
    case ROUTE_CHANGE_FREQ:
      return `${label.replace('...', '')} (${params[0] ?? 3})`;
    case ROUTE_CHANGE_IMAGE:
      return `${label.replace('...', '')} (${params[0] ?? ''}, ${params[1] ?? 0})`;
    case ROUTE_CHANGE_OPACITY:
      return `${label.replace('...', '')} (${params[0] ?? 255})`;
    case ROUTE_CHANGE_BLEND_MODE:
      return `${label.replace('...', '')} (${params[0] ?? 0})`;
    case ROUTE_PLAY_SE: {
      const se = params[0] as { name?: string } | undefined;
      return `${label.replace('...', '')} (${se?.name ?? ''})`;
    }
    case ROUTE_SCRIPT:
      return `${label.replace('...', '')} (${params[0] ?? ''})`;
    default:
      return label;
  }
}

// 파라미터 입력 다이얼로그
export function ParamInputDialog({ code, initialParams, onOk, onCancel, t }: {
  code: number;
  initialParams: unknown[];
  onOk: (params: unknown[]) => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const [params, setParams] = useState<unknown[]>(() => [...initialParams]);

  const handleOk = () => onOk(params);

  switch (code) {
    case ROUTE_JUMP:
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t('moveRoute.commands.14')}</div>
            <div className="move-route-param-row">
              <label>{t('moveRoute.jumpX')}<input type="number" value={Number(params[0] ?? 0)} onChange={e => setParams([Number(e.target.value), params[1] ?? 0])} className="event-editor-input" style={{ width: 60 }} /></label>
              <label>{t('moveRoute.jumpY')}<input type="number" value={Number(params[1] ?? 0)} onChange={e => setParams([params[0] ?? 0, Number(e.target.value)])} className="event-editor-input" style={{ width: 60 }} /></label>
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    case ROUTE_WAIT:
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t('moveRoute.commands.15')}</div>
            <div className="move-route-param-row">
              <label>{t('moveRoute.waitFrames')}<input type="number" min={1} value={Number(params[0] ?? 60)} onChange={e => setParams([Number(e.target.value)])} className="event-editor-input" style={{ width: 80 }} /></label>
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    case ROUTE_SWITCH_ON:
    case ROUTE_SWITCH_OFF:
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t(`moveRoute.commands.${code}`)}</div>
            <div className="move-route-param-row">
              <label>{t('moveRoute.switchId')}<input type="number" min={1} value={Number(params[0] ?? 1)} onChange={e => setParams([Number(e.target.value)])} className="event-editor-input" style={{ width: 80 }} /></label>
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    case ROUTE_CHANGE_SPEED:
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t('moveRoute.commands.29')}</div>
            <div className="move-route-param-row">
              <label>{t('moveRoute.speed')}
                <select value={Number(params[0] ?? 3)} onChange={e => setParams([Number(e.target.value)])} className="event-editor-select">
                  {[1, 2, 3, 4, 5, 6].map(v => <option key={v} value={v}>{t(`eventDetail.moveSpeeds.${v - 1}`)}</option>)}
                </select>
              </label>
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    case ROUTE_CHANGE_FREQ:
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t('moveRoute.commands.30')}</div>
            <div className="move-route-param-row">
              <label>{t('moveRoute.frequency')}
                <select value={Number(params[0] ?? 3)} onChange={e => setParams([Number(e.target.value)])} className="event-editor-select">
                  {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{t(`eventDetail.moveFreqs.${v - 1}`)}</option>)}
                </select>
              </label>
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    case ROUTE_CHANGE_OPACITY:
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t('moveRoute.commands.42')}</div>
            <div className="move-route-param-row">
              <label>{t('moveRoute.opacity')}<input type="number" min={0} max={255} value={Number(params[0] ?? 255)} onChange={e => setParams([Number(e.target.value)])} className="event-editor-input" style={{ width: 80 }} /></label>
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    case ROUTE_CHANGE_BLEND_MODE:
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t('moveRoute.commands.43')}</div>
            <div className="move-route-param-row">
              <label>{t('moveRoute.blendMode')}
                <select value={Number(params[0] ?? 0)} onChange={e => setParams([Number(e.target.value)])} className="event-editor-select">
                  {[0, 1, 2].map(v => <option key={v} value={v}>{t(`moveRoute.blendModes.${v}`)}</option>)}
                </select>
              </label>
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    case ROUTE_PLAY_SE: {
      const se = (params[0] as { name: string; volume: number; pitch: number; pan: number } | undefined) ?? { name: '', volume: 90, pitch: 100, pan: 0 };
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t('moveRoute.commands.44')}</div>
            <div className="move-route-param-row">
              <AudioPicker
                type="se"
                value={se}
                onChange={(v) => setParams([v])}
              />
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    }
    case ROUTE_SCRIPT:
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t('moveRoute.commands.45')}</div>
            <div className="move-route-param-row">
              <label style={{ width: '100%' }}>{t('moveRoute.script')}
                <textarea
                  value={String(params[0] ?? '')}
                  onChange={e => setParams([e.target.value])}
                  className="event-editor-input"
                  style={{ width: '100%', minHeight: 80, resize: 'vertical', fontFamily: 'monospace' }}
                />
              </label>
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    case ROUTE_CHANGE_IMAGE:
      return (
        <div className="move-route-param-overlay">
          <div className="move-route-param-dialog">
            <div className="move-route-param-title">{t('moveRoute.commands.41')}</div>
            <div className="move-route-param-row" style={{ flexDirection: 'column', gap: 6 }}>
              <label>이미지: <input type="text" value={String(params[0] ?? '')} onChange={e => setParams([e.target.value, params[1] ?? 0])} className="event-editor-input" style={{ width: 180 }} /></label>
              <label>인덱스: <input type="number" min={0} max={7} value={Number(params[1] ?? 0)} onChange={e => setParams([params[0] ?? '', Number(e.target.value)])} className="event-editor-input" style={{ width: 60 }} /></label>
            </div>
            <div className="move-route-param-buttons">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}
