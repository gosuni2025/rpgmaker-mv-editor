import React, { useState } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import { radioStyle } from './condBranchHelpers';
import { getTabForType } from './condBranchHelpers';
import { CondBranchTab1 } from './CondBranchTab1';
import { CondBranchTab2 } from './CondBranchTab2';
import { CondBranchTab3 } from './CondBranchTab3';
import { CondBranchTab4 } from './CondBranchTab4';
import './ConditionalBranchEditor.css';

export function ConditionalBranchEditor({ p, onOk, onCancel, hasElse: initHasElse }: {
  p: unknown[];
  onOk: (params: unknown[], extra?: EventCommand[]) => void;
  onCancel: () => void;
  hasElse?: boolean;
}) {
  const initType = (p[0] as number) ?? 0;
  const [tab, setTab] = useState(getTabForType(initType));
  const [condType, setCondType] = useState(initType);
  const [hasElse, setHasElse] = useState(initHasElse ?? false);

  // --- 탭1: 스위치 (type=0) ---
  const [switchId, setSwitchId] = useState(initType === 0 ? ((p[1] as number) || 1) : 1);
  const [switchValue, setSwitchValue] = useState(initType === 0 ? ((p[2] as number) || 0) : 0);
  // --- 탭1: 변수 (type=1) ---
  const [varId, setVarId] = useState(initType === 1 ? ((p[1] as number) || 1) : 1);
  const [varOperandType, setVarOperandType] = useState(initType === 1 ? ((p[2] as number) || 0) : 0);
  const [varOperand, setVarOperand] = useState(initType === 1 ? ((p[3] as number) || 0) : 0);
  const [varCompare, setVarCompare] = useState(initType === 1 ? ((p[4] as number) || 0) : 0);
  // --- 탭1: 셀프 스위치 (type=2) ---
  const [selfSwitch, setSelfSwitch] = useState(initType === 2 ? ((p[1] as string) || 'A') : 'A');
  const [selfSwitchValue, setSelfSwitchValue] = useState(initType === 2 ? ((p[2] as number) || 0) : 0);
  // --- 탭1: 타이머 (type=3) ---
  const initTimerSec = initType === 3 ? ((p[1] as number) || 0) : 0;
  const [timerMin, setTimerMin] = useState(Math.floor(initTimerSec / 60));
  const [timerSec, setTimerSec] = useState(initTimerSec % 60);
  const [timerCompare, setTimerCompare] = useState(initType === 3 ? ((p[2] as number) || 0) : 0);
  // --- 탭2: 액터 (type=4) ---
  const [actorId, setActorId] = useState(initType === 4 ? ((p[1] as number) || 1) : 1);
  const [actorSubType, setActorSubType] = useState(initType === 4 ? ((p[2] as number) || 0) : 0);
  const [actorParam, setActorParam] = useState<string | number>(initType === 4 ? ((p[3] as string | number) ?? '') : '');
  // --- 탭3: 적 (type=5) ---
  const [enemyIndex, setEnemyIndex] = useState(initType === 5 ? ((p[1] as number) || 0) : 0);
  const [enemySubType, setEnemySubType] = useState(initType === 5 ? ((p[2] as number) || 0) : 0);
  const [enemyStateId, setEnemyStateId] = useState(initType === 5 ? ((p[3] as number) || 1) : 1);
  // --- 탭3: 캐릭터 (type=6) ---
  const [charId, setCharId] = useState(initType === 6 ? ((p[1] as number) || -1) : -1);
  const [charDir, setCharDir] = useState(initType === 6 ? ((p[2] as number) || 2) : 2);
  // --- 탭3: 탈것 (type=13) ---
  const [vehicleId, setVehicleId] = useState(initType === 13 ? ((p[1] as number) || 0) : 0);
  // --- 탭4: 소지금 (type=7) ---
  const [goldAmount, setGoldAmount] = useState(initType === 7 ? ((p[1] as number) || 0) : 0);
  const [goldCompare, setGoldCompare] = useState(initType === 7 ? ((p[2] as number) || 0) : 0);
  // --- 탭4: 아이템 (type=8) ---
  const [itemId, setItemId] = useState(initType === 8 ? ((p[1] as number) || 1) : 1);
  // --- 탭4: 무기 (type=9) ---
  const [weaponId, setWeaponId] = useState(initType === 9 ? ((p[1] as number) || 1) : 1);
  const [weaponIncludeEquip, setWeaponIncludeEquip] = useState(initType === 9 ? !!(p[2]) : false);
  // --- 탭4: 방어구 (type=10) ---
  const [armorId, setArmorId] = useState(initType === 10 ? ((p[1] as number) || 1) : 1);
  const [armorIncludeEquip, setArmorIncludeEquip] = useState(initType === 10 ? !!(p[2]) : false);
  // --- 탭4: 버튼 (type=11) ---
  const [buttonName, setButtonName] = useState(initType === 11 ? ((p[1] as string) || 'ok') : 'ok');
  // --- 탭4: 스크립트 (type=12) ---
  const [scriptText, setScriptText] = useState(initType === 12 ? ((p[1] as string) || '') : '');
  const [scriptComment, setScriptComment] = useState(initType === 12 ? ((p[2] as string) || '') : '');

  const handleOk = () => {
    let params: unknown[];
    switch (condType) {
      case 0: params = [0, switchId, switchValue]; break;
      case 1: params = [1, varId, varOperandType, varOperand, varCompare]; break;
      case 2: params = [2, selfSwitch, selfSwitchValue]; break;
      case 3: params = [3, timerMin * 60 + timerSec, timerCompare]; break;
      case 4: params = [4, actorId, actorSubType, actorSubType === 0 ? 0 : actorParam]; break;
      case 5: params = enemySubType === 0 ? [5, enemyIndex, 0] : [5, enemyIndex, 1, enemyStateId]; break;
      case 6: params = [6, charId, charDir]; break;
      case 7: params = [7, goldAmount, goldCompare]; break;
      case 8: params = [8, itemId]; break;
      case 9: params = [9, weaponId, weaponIncludeEquip]; break;
      case 10: params = [10, armorId, armorIncludeEquip]; break;
      case 11: params = [11, buttonName]; break;
      case 12: params = scriptComment ? [12, scriptText, scriptComment] : [12, scriptText]; break;
      case 13: params = [13, vehicleId]; break;
      default: params = [condType]; break;
    }
    const elseMarker: EventCommand[] | undefined = hasElse
      ? [{ code: 411, indent: 0, parameters: [] }]
      : undefined;
    onOk(params, elseMarker);
  };

  return (
    <>
      {/* 탭 버튼 */}
      <div className="cond-branch-tabs">
        {[1, 2, 3, 4].map(t => (
          <button key={t} className={`cond-branch-tab${tab === t - 1 ? ' active' : ''}`}
            onClick={() => setTab(t - 1)}>{t}</button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div style={{ minHeight: 180 }}>
        {tab === 0 && (
          <CondBranchTab1
            condType={condType} onCondTypeChange={setCondType}
            switchId={switchId} setSwitchId={setSwitchId}
            switchValue={switchValue} setSwitchValue={setSwitchValue}
            varId={varId} setVarId={setVarId}
            varOperandType={varOperandType} setVarOperandType={setVarOperandType}
            varOperand={varOperand} setVarOperand={setVarOperand}
            varCompare={varCompare} setVarCompare={setVarCompare}
            selfSwitch={selfSwitch} setSelfSwitch={setSelfSwitch}
            selfSwitchValue={selfSwitchValue} setSelfSwitchValue={setSelfSwitchValue}
            timerMin={timerMin} setTimerMin={setTimerMin}
            timerSec={timerSec} setTimerSec={setTimerSec}
            timerCompare={timerCompare} setTimerCompare={setTimerCompare}
          />
        )}
        {tab === 1 && (
          <CondBranchTab2
            condType={condType} onCondTypeChange={setCondType}
            actorId={actorId} setActorId={setActorId}
            actorSubType={actorSubType} setActorSubType={setActorSubType}
            actorParam={actorParam} setActorParam={setActorParam}
          />
        )}
        {tab === 2 && (
          <CondBranchTab3
            condType={condType} onCondTypeChange={setCondType}
            enemyIndex={enemyIndex} setEnemyIndex={setEnemyIndex}
            enemySubType={enemySubType} setEnemySubType={setEnemySubType}
            enemyStateId={enemyStateId} setEnemyStateId={setEnemyStateId}
            charId={charId} setCharId={setCharId}
            charDir={charDir} setCharDir={setCharDir}
            vehicleId={vehicleId} setVehicleId={setVehicleId}
          />
        )}
        {tab === 3 && (
          <CondBranchTab4
            condType={condType} onCondTypeChange={setCondType}
            goldAmount={goldAmount} setGoldAmount={setGoldAmount}
            goldCompare={goldCompare} setGoldCompare={setGoldCompare}
            itemId={itemId} setItemId={setItemId}
            weaponId={weaponId} setWeaponId={setWeaponId}
            weaponIncludeEquip={weaponIncludeEquip} setWeaponIncludeEquip={setWeaponIncludeEquip}
            armorId={armorId} setArmorId={setArmorId}
            armorIncludeEquip={armorIncludeEquip} setArmorIncludeEquip={setArmorIncludeEquip}
            buttonName={buttonName} setButtonName={setButtonName}
            scriptText={scriptText} setScriptText={setScriptText}
            scriptComment={scriptComment} setScriptComment={setScriptComment}
          />
        )}
      </div>

      {/* 그 밖의 경우 */}
      <label className="db-checkbox-label" style={{ ...radioStyle, marginTop: 8, borderTop: '1px solid #444', paddingTop: 8 }}>
        <input type="checkbox" checked={hasElse} onChange={e => setHasElse(e.target.checked)} />
        그 밖의 경우에 대한 지점 작성
      </label>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}
