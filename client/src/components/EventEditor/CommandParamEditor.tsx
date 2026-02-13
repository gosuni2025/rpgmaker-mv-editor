import React from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import {
  ShowTextEditor, TextEditor, SingleTextEditor, SingleNumberEditor, WaitEditor,
  ControlSwitchesEditor, ControlVariablesEditor, ControlSelfSwitchEditor, ControlTimerEditor,
  ChangeGoldEditor, ChangeItemEditor, TransferPlayerEditor, SetVehicleLocationEditor, SetEventLocationEditor, AudioEditor,
  ChangePartyMemberEditor, ChangeClassEditor, ChangeEquipmentEditor, ChangeNameEditor, NameInputEditor, ChangeProfileEditor, ChangeTransparencyEditor, ChangeSaveAccessEditor, ChangeMenuAccessEditor, ChangeEncounterEditor, ChangeFormationAccessEditor, ChangePlayerFollowersEditor, ChangeHPEditor, ChangeMPEditor, ChangeTPEditor, ChangeEXPEditor, ChangeLevelEditor, ChangeStateEditor, ChangeSkillEditor, RecoverAllEditor, ChangeParameterEditor, ShowChoicesEditor, InputNumberEditor, SelectItemEditor, ScrollMapEditor, ShowAnimationEditor, ShowBalloonIconEditor,
  ScrollingTextEditor, ConditionalBranchEditor, ShowPictureEditor, MovePictureEditor, RotatePictureEditor, TintPictureEditor, TintScreenEditor, FlashScreenEditor, ShakeScreenEditor, SetWeatherEffectEditor,
} from './commandEditors';

interface CommandParamEditorProps {
  code: number;
  command?: EventCommand;
  followCommands?: EventCommand[];
  hasElse?: boolean;
  onOk: (params: unknown[], extraCommands?: EventCommand[]) => void;
  onCancel: () => void;
}

export default function CommandParamEditor({ code, command, followCommands, hasElse, onOk, onCancel }: CommandParamEditorProps) {
  const p = command?.parameters || [];
  const content = getEditorContent(code, p, followCommands || [], onOk, onCancel, hasElse);
  if (!content) {
    onOk(p);
    return null;
  }
  const dialogWidth = code === 102 ? 560 : code === 111 ? 540 : code === 231 ? 720 : (code === 223 || code === 224 || code === 234) ? 520 : 480;
  return (
    <div className="modal-overlay">
      <div className="image-picker-dialog" style={{ width: dialogWidth, maxHeight: '90vh' }}>
        <div className="image-picker-header">{getCommandName(code)}</div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {content}
        </div>
      </div>
    </div>
  );
}

function getCommandName(code: number): string {
  const names: Record<number, string> = {
    101: 'Show Text', 102: 'Show Choices', 103: 'Input Number', 104: 'Select Item',
    105: '텍스트의 스크롤 표시', 108: 'Comment', 111: '조건 분기',
    117: 'Common Event', 118: 'Label', 119: 'Jump to Label',
    121: '스위치 조작', 122: '변수 조작', 123: 'Control Self Switch',
    124: '타이머 조작', 125: '소지 금액 증감', 126: '아이템 증감',
    127: '무기 변경', 128: '방어구 변경', 129: '파티원 변경',
    134: '저장 금지 변경', 135: '메뉴 금지 변경', 136: '조우 금지 변경', 137: '진형 금지 변경',
    201: '장소 이동', 202: '탈 것 위치 설정', 204: '지도 스크롤', 211: '투명 상태 변경', 212: '애니메이션 표시', 213: '말풍선 아이콘 표시', 216: '대열 보행 변경', 223: '화면의 색조 변경', 224: '화면의 플래쉬', 225: '화면 흔들리기', 230: '대기', 231: '그림 표시', 233: '그림 회전', 234: '그림의 색조 변경', 235: '그림 제거', 236: '날씨 효과 설정',
    241: 'Play BGM', 242: 'Fadeout BGM', 245: 'Play BGS', 246: 'Fadeout BGS',
    249: 'Play ME', 250: 'Play SE',
    301: 'Battle Processing', 303: '이름 입력 처리', 311: 'HP 증감', 312: 'MP 증감', 326: 'TP 증감',
    313: '스테이트 변경', 314: '전체 회복', 315: 'EXP 증감', 316: '레벨 증감', 317: '능력치 증감',
    318: '스킬 증감', 319: '장비 변경', 320: '이름 변경', 321: '직업 변경', 324: '닉네임 변경', 325: '프로필 변경',
    355: 'Script', 356: 'Plugin Command',
  };
  return names[code] || `Command ${code}`;
}

function getEditorContent(
  code: number, p: unknown[], followCommands: EventCommand[],
  onOk: (params: unknown[], extraCommands?: EventCommand[]) => void,
  onCancel: () => void,
  hasElse?: boolean,
): React.ReactNode | null {
  // 후속 라인 텍스트 추출 헬퍼
  const followText = (followCode: number) =>
    followCommands.filter(c => c.code === followCode).map(c => c.parameters[0] as string);

  switch (code) {
    case 111: return <ConditionalBranchEditor p={p} onOk={onOk} onCancel={onCancel} hasElse={hasElse} />;
    case 102: return <ShowChoicesEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 103: return <InputNumberEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 104: return <SelectItemEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 101: return <ShowTextEditor p={p} onOk={onOk} onCancel={onCancel} existingLines={followText(401)} />;
    case 108: return <TextEditor p={p} onOk={onOk} onCancel={onCancel} followCode={408} label="Comment" existingLines={followText(408)} />;
    case 355: return <TextEditor p={p} onOk={onOk} onCancel={onCancel} followCode={655} label="Script" existingLines={followText(655)} />;
    case 356: return <SingleTextEditor p={p} onOk={onOk} onCancel={onCancel} label="Plugin Command" />;
    case 105: return <ScrollingTextEditor p={p} onOk={onOk} onCancel={onCancel} existingLines={followText(405)} />;
    case 121: return <ControlSwitchesEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 122: return <ControlVariablesEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 123: return <ControlSelfSwitchEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 124: return <ControlTimerEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 117: return <SingleNumberEditor p={p} onOk={onOk} onCancel={onCancel} label="Common Event ID" />;
    case 118: return <SingleTextEditor p={p} onOk={onOk} onCancel={onCancel} label="Label Name" />;
    case 119: return <SingleTextEditor p={p} onOk={onOk} onCancel={onCancel} label="Label Name" />;
    case 125: return <ChangeGoldEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 126: return <ChangeItemEditor p={p} onOk={onOk} onCancel={onCancel} label="Item" />;
    case 127: return <ChangeItemEditor p={p} onOk={onOk} onCancel={onCancel} label="Weapon" showIncludeEquip />;
    case 128: return <ChangeItemEditor p={p} onOk={onOk} onCancel={onCancel} label="Armor" showIncludeEquip />;
    case 201: return <TransferPlayerEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 202: return <SetVehicleLocationEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 203: return <SetEventLocationEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 204: return <ScrollMapEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 211: return <ChangeTransparencyEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 212: return <ShowAnimationEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 213: return <ShowBalloonIconEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 223: return <TintScreenEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 224: return <FlashScreenEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 225: return <ShakeScreenEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 236: return <SetWeatherEffectEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 230: return <WaitEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 231: return <ShowPictureEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 232: return <MovePictureEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 233: return <RotatePictureEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 234: return <TintPictureEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 235: return <SingleNumberEditor p={p} onOk={onOk} onCancel={onCancel} label="번호" min={1} max={100} />;
    case 241: return <AudioEditor p={p} onOk={onOk} onCancel={onCancel} type="bgm" />;
    case 245: return <AudioEditor p={p} onOk={onOk} onCancel={onCancel} type="bgs" />;
    case 249: return <AudioEditor p={p} onOk={onOk} onCancel={onCancel} type="me" />;
    case 250: return <AudioEditor p={p} onOk={onOk} onCancel={onCancel} type="se" />;
    case 242: return <SingleNumberEditor p={p} onOk={onOk} onCancel={onCancel} label="Fadeout Duration (seconds)" />;
    case 246: return <SingleNumberEditor p={p} onOk={onOk} onCancel={onCancel} label="Fadeout Duration (seconds)" />;
    case 129: return <ChangePartyMemberEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 311: return <ChangeHPEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 312: return <ChangeMPEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 313: return <ChangeStateEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 314: return <RecoverAllEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 315: return <ChangeEXPEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 316: return <ChangeLevelEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 317: return <ChangeParameterEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 318: return <ChangeSkillEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 319: return <ChangeEquipmentEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 326: return <ChangeTPEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 303: return <NameInputEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 320: return <ChangeNameEditor p={p} onOk={onOk} onCancel={onCancel} label="이름:" />;
    case 321: return <ChangeClassEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 324: return <ChangeNameEditor p={p} onOk={onOk} onCancel={onCancel} label="닉네임:" />;
    case 325: return <ChangeProfileEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 134: return <ChangeSaveAccessEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 135: return <ChangeMenuAccessEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 136: return <ChangeEncounterEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 137: return <ChangeFormationAccessEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 216: return <ChangePlayerFollowersEditor p={p} onOk={onOk} onCancel={onCancel} />;
    default: return null;
  }
}

