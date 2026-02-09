import React from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import {
  ShowTextEditor, TextEditor, SingleTextEditor, SingleNumberEditor,
  ControlSwitchesEditor, ControlVariablesEditor, ControlSelfSwitchEditor, ControlTimerEditor,
  ChangeGoldEditor, ChangeItemEditor, TransferPlayerEditor, AudioEditor,
  ChangePartyMemberEditor, ChangeNameEditor,
} from './commandEditors';

interface CommandParamEditorProps {
  code: number;
  command?: EventCommand;
  onOk: (params: unknown[], extraCommands?: EventCommand[]) => void;
  onCancel: () => void;
}

export default function CommandParamEditor({ code, command, onOk, onCancel }: CommandParamEditorProps) {
  const p = command?.parameters || [];
  const content = getEditorContent(code, p, onOk, onCancel);
  if (!content) {
    onOk(p);
    return null;
  }
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="image-picker-dialog" onClick={e => e.stopPropagation()} style={{ width: 480, maxHeight: '70vh' }}>
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
    105: 'Show Scrolling Text', 108: 'Comment', 111: 'Conditional Branch',
    117: 'Common Event', 118: 'Label', 119: 'Jump to Label',
    121: 'Control Switches', 122: 'Control Variables', 123: 'Control Self Switch',
    124: 'Control Timer', 125: 'Change Gold', 126: 'Change Items',
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
  code: number, p: unknown[],
  onOk: (params: unknown[], extraCommands?: EventCommand[]) => void,
  onCancel: () => void
): React.ReactNode | null {
  switch (code) {
    case 101: return <ShowTextEditor p={p} onOk={onOk} onCancel={onCancel} />;
    case 108: return <TextEditor p={p} onOk={onOk} onCancel={onCancel} followCode={408} label="Comment" />;
    case 355: return <TextEditor p={p} onOk={onOk} onCancel={onCancel} followCode={655} label="Script" />;
    case 356: return <SingleTextEditor p={p} onOk={onOk} onCancel={onCancel} label="Plugin Command" />;
    case 105: return <TextEditor p={p} onOk={onOk} onCancel={onCancel} followCode={405} label="Scrolling Text" showSpeed />;
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

