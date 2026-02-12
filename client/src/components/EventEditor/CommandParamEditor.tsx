import React from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import {
  ShowTextEditor, TextEditor, SingleTextEditor, SingleNumberEditor,
  ControlSwitchesEditor, ControlVariablesEditor, ControlSelfSwitchEditor, ControlTimerEditor,
  ChangeGoldEditor, ChangeItemEditor, TransferPlayerEditor, AudioEditor,
  ChangePartyMemberEditor, ChangeNameEditor, ShowChoicesEditor, InputNumberEditor, SelectItemEditor,
  ScrollingTextEditor, ConditionalBranchEditor,
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
  const dialogWidth = code === 102 ? 560 : code === 111 ? 540 : 480;
  return (
    <div className="modal-overlay">
      <div className="image-picker-dialog" style={{ width: dialogWidth, maxHeight: '70vh' }}>
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
    124: '타이머 조작', 125: 'Change Gold', 126: 'Change Items',
    127: 'Change Weapons', 128: 'Change Armors', 129: 'Change Party Member',
    201: 'Transfer Player', 230: 'Wait',
    241: 'Play BGM', 242: 'Fadeout BGM', 245: 'Play BGS', 246: 'Fadeout BGS',
    249: 'Play ME', 250: 'Play SE',
    301: 'Battle Processing', 311: 'Change HP', 312: 'Change MP',
    314: 'Change State', 315: 'Recover All', 316: 'Change EXP', 317: 'Change Level',
    321: 'Change Name', 325: 'Change Nickname',
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
    case 127: return <ChangeItemEditor p={p} onOk={onOk} onCancel={onCancel} label="Weapon" />;
    case 128: return <ChangeItemEditor p={p} onOk={onOk} onCancel={onCancel} label="Armor" />;
    case 201: return <TransferPlayerEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 230: return <SingleNumberEditor p={p} onOk={onOk} onCancel={onCancel} label="Wait (frames)" />;
    case 241: return <AudioEditor p={p} onOk={onOk} onCancel={onCancel} type="bgm" />;
    case 245: return <AudioEditor p={p} onOk={onOk} onCancel={onCancel} type="bgs" />;
    case 249: return <AudioEditor p={p} onOk={onOk} onCancel={onCancel} type="me" />;
    case 250: return <AudioEditor p={p} onOk={onOk} onCancel={onCancel} type="se" />;
    case 242: return <SingleNumberEditor p={p} onOk={onOk} onCancel={onCancel} label="Fadeout Duration (seconds)" />;
    case 246: return <SingleNumberEditor p={p} onOk={onOk} onCancel={onCancel} label="Fadeout Duration (seconds)" />;
    case 129: return <ChangePartyMemberEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 321: return <ChangeNameEditor p={p} onOk={onOk} onCancel={onCancel} label="Name" />;
    case 325: return <ChangeNameEditor p={p} onOk={onOk} onCancel={onCancel} label="Nickname" />;
    default: return null;
  }
}

