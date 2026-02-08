import React, { useState } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import CommandParamEditor from './CommandParamEditor';

interface EventCommandEditorProps {
  commands: EventCommand[];
  onChange: (commands: EventCommand[]) => void;
}

const COMMAND_CATEGORIES = {
  'Tab 1 - Messages': [
    { code: 101, name: 'Show Text...' },
    { code: 102, name: 'Show Choices...' },
    { code: 103, name: 'Input Number...' },
    { code: 104, name: 'Select Item...' },
    { code: 105, name: 'Show Scrolling Text...' },
  ],
  'Tab 1 - Flow Control': [
    { code: 111, name: 'Conditional Branch...' },
    { code: 112, name: 'Loop' },
    { code: 113, name: 'Break Loop' },
    { code: 115, name: 'Exit Event Processing' },
    { code: 117, name: 'Common Event...' },
    { code: 118, name: 'Label...' },
    { code: 119, name: 'Jump to Label...' },
    { code: 108, name: 'Comment...' },
  ],
  'Tab 1 - Game Progression': [
    { code: 121, name: 'Control Switches...' },
    { code: 122, name: 'Control Variables...' },
    { code: 123, name: 'Control Self Switch...' },
    { code: 124, name: 'Control Timer...' },
  ],
  'Tab 2 - Party': [
    { code: 125, name: 'Change Gold...' },
    { code: 126, name: 'Change Items...' },
    { code: 127, name: 'Change Weapons...' },
    { code: 128, name: 'Change Armors...' },
    { code: 129, name: 'Change Party Member...' },
  ],
  'Tab 2 - Actor': [
    { code: 311, name: 'Change HP...' },
    { code: 312, name: 'Change MP...' },
    { code: 313, name: 'Change TP...' },
    { code: 314, name: 'Change State...' },
    { code: 315, name: 'Recover All...' },
    { code: 316, name: 'Change EXP...' },
    { code: 317, name: 'Change Level...' },
    { code: 318, name: 'Change Parameter...' },
    { code: 319, name: 'Change Skill...' },
    { code: 320, name: 'Change Equipment...' },
    { code: 321, name: 'Change Name...' },
    { code: 322, name: 'Change Class...' },
  ],
  'Tab 2 - Movement': [
    { code: 201, name: 'Transfer Player...' },
    { code: 202, name: 'Set Vehicle Location...' },
    { code: 203, name: 'Set Event Location...' },
    { code: 204, name: 'Scroll Map...' },
    { code: 205, name: 'Set Movement Route...' },
    { code: 206, name: 'Get On/Off Vehicle' },
  ],
  'Tab 3 - Screen': [
    { code: 221, name: 'Fadeout Screen' },
    { code: 222, name: 'Fadein Screen' },
    { code: 223, name: 'Tint Screen...' },
    { code: 224, name: 'Flash Screen...' },
    { code: 225, name: 'Shake Screen...' },
    { code: 230, name: 'Wait...' },
  ],
  'Tab 3 - Picture/Weather': [
    { code: 231, name: 'Show Picture...' },
    { code: 232, name: 'Move Picture...' },
    { code: 233, name: 'Rotate Picture...' },
    { code: 234, name: 'Tint Picture...' },
    { code: 235, name: 'Erase Picture...' },
    { code: 236, name: 'Set Weather...' },
  ],
  'Tab 3 - Audio/Video': [
    { code: 241, name: 'Play BGM...' },
    { code: 242, name: 'Fadeout BGM...' },
    { code: 243, name: 'Save BGM' },
    { code: 244, name: 'Resume BGM' },
    { code: 245, name: 'Play BGS...' },
    { code: 246, name: 'Fadeout BGS...' },
    { code: 249, name: 'Play ME...' },
    { code: 250, name: 'Play SE...' },
    { code: 251, name: 'Stop SE' },
    { code: 261, name: 'Play Movie...' },
  ],
  'Tab 3 - Scene Control': [
    { code: 301, name: 'Battle Processing...' },
    { code: 302, name: 'Shop Processing...' },
    { code: 303, name: 'Name Input Processing...' },
    { code: 351, name: 'Open Menu Screen' },
    { code: 352, name: 'Open Save Screen' },
    { code: 353, name: 'Game Over' },
    { code: 354, name: 'Return to Title Screen' },
  ],
  'Tab 3 - Advanced': [
    { code: 355, name: 'Script...' },
    { code: 356, name: 'Plugin Command...' },
  ],
};

// Commands that have no parameters and can be inserted directly
const NO_PARAM_CODES = new Set([112, 113, 115, 206, 221, 222, 243, 244, 251, 351, 352, 353, 354]);

// Commands that need a parameter editor
const HAS_PARAM_EDITOR = new Set([
  101, 105, 108, 117, 118, 119, 121, 122, 123, 124, 125, 126, 127, 128, 129,
  201, 230, 241, 242, 245, 246, 249, 250, 321, 325, 355, 356,
]);

export default function EventCommandEditor({ commands, onChange }: EventCommandEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingCode, setPendingCode] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const insertCommandWithParams = (code: number, params: unknown[], extraCommands?: EventCommand[]) => {
    const insertAt = selectedIndex >= 0 ? selectedIndex : commands.length - 1;
    const indent = commands[insertAt]?.indent || 0;
    const newCmd: EventCommand = { code, indent, parameters: params };

    const newCommands = [...commands];
    if (code === 111) {
      newCommands.splice(insertAt, 0, newCmd, { code: 0, indent: indent + 1, parameters: [] }, { code: 412, indent, parameters: [] });
    } else if (code === 112) {
      newCommands.splice(insertAt, 0, newCmd, { code: 0, indent: indent + 1, parameters: [] }, { code: 413, indent, parameters: [] });
    } else if (code === 102) {
      newCommands.splice(insertAt, 0,
        { code: 102, indent, parameters: params.length ? params : [['Yes', 'No'], 0] },
        { code: 402, indent, parameters: [0, 'Yes'] },
        { code: 0, indent: indent + 1, parameters: [] },
        { code: 402, indent, parameters: [1, 'No'] },
        { code: 0, indent: indent + 1, parameters: [] },
        { code: 404, indent, parameters: [] },
      );
    } else if (extraCommands && extraCommands.length > 0) {
      const extras = extraCommands.map(ec => ({ ...ec, indent }));
      newCommands.splice(insertAt, 0, newCmd, ...extras);
    } else {
      newCommands.splice(insertAt, 0, newCmd);
    }
    onChange(newCommands);
    setShowAddDialog(false);
    setPendingCode(null);
  };

  const handleCommandSelect = (code: number) => {
    if (NO_PARAM_CODES.has(code)) {
      insertCommandWithParams(code, []);
    } else if (HAS_PARAM_EDITOR.has(code)) {
      setShowAddDialog(false);
      setPendingCode(code);
    } else {
      // No editor yet — insert with empty params
      insertCommandWithParams(code, []);
    }
  };

  const updateCommandParams = (index: number, params: unknown[]) => {
    const newCommands = [...commands];
    newCommands[index] = { ...newCommands[index], parameters: params };
    onChange(newCommands);
    setEditingIndex(null);
  };

  const handleDoubleClick = (index: number) => {
    const cmd = commands[index];
    if (cmd.code === 0) {
      setShowAddDialog(true);
      return;
    }
    // For commands with param editors, open the editor
    if (HAS_PARAM_EDITOR.has(cmd.code)) {
      setEditingIndex(index);
    }
  };

  const deleteCommand = () => {
    if (selectedIndex < 0 || selectedIndex >= commands.length) return;
    const cmd = commands[selectedIndex];
    if (cmd.code === 0 && selectedIndex === commands.length - 1) return;
    const newCommands = commands.filter((_, i) => i !== selectedIndex);
    onChange(newCommands);
    setSelectedIndex(Math.min(selectedIndex, newCommands.length - 1));
  };

  const getCommandDisplay = (cmd: EventCommand): string => {
    const code = cmd.code;
    if (code === 0) return '';
    const DESCS: Record<number, string> = {
      101: 'Show Text', 102: 'Show Choices', 103: 'Input Number', 104: 'Select Item',
      105: 'Show Scrolling Text', 108: 'Comment', 111: 'If', 112: 'Loop',
      113: 'Break Loop', 115: 'Exit Event', 117: 'Common Event', 118: 'Label',
      119: 'Jump to Label', 121: 'Control Switches', 122: 'Control Variables',
      123: 'Control Self Switch', 124: 'Control Timer', 125: 'Change Gold',
      126: 'Change Items', 127: 'Change Weapons', 128: 'Change Armors',
      129: 'Change Party Member', 201: 'Transfer Player', 202: 'Set Vehicle Location',
      203: 'Set Event Location', 204: 'Scroll Map', 205: 'Set Movement Route',
      206: 'Get On/Off Vehicle', 211: 'Change Transparency', 212: 'Show Animation',
      213: 'Show Balloon Icon', 214: 'Erase Event', 221: 'Fadeout Screen',
      222: 'Fadein Screen', 223: 'Tint Screen', 224: 'Flash Screen',
      225: 'Shake Screen', 230: 'Wait', 231: 'Show Picture', 232: 'Move Picture',
      233: 'Rotate Picture', 234: 'Tint Picture', 235: 'Erase Picture',
      236: 'Set Weather', 241: 'Play BGM', 242: 'Fadeout BGM', 243: 'Save BGM',
      244: 'Resume BGM', 245: 'Play BGS', 246: 'Fadeout BGS', 249: 'Play ME',
      250: 'Play SE', 251: 'Stop SE', 261: 'Play Movie', 281: 'Change Map Name Display',
      282: 'Change Tileset', 283: 'Change Battle Back', 284: 'Change Parallax',
      285: 'Get Location Info', 301: 'Battle Processing', 302: 'Shop Processing',
      303: 'Name Input Processing', 311: 'Change HP', 312: 'Change MP',
      313: 'Change TP', 314: 'Change State', 315: 'Recover All',
      316: 'Change EXP', 317: 'Change Level', 318: 'Change Parameter',
      319: 'Change Skill', 320: 'Change Equipment', 321: 'Change Name',
      322: 'Change Class', 323: 'Change Actor Images', 324: 'Change Vehicle Image',
      325: 'Change Nickname', 326: 'Change Profile', 331: 'Change Enemy HP',
      332: 'Change Enemy MP', 333: 'Change Enemy TP', 334: 'Change Enemy State',
      335: 'Enemy Recover All', 336: 'Enemy Appear', 337: 'Enemy Transform',
      338: 'Show Battle Animation', 339: 'Force Action', 340: 'Abort Battle',
      351: 'Open Menu Screen', 352: 'Open Save Screen', 353: 'Game Over',
      354: 'Return to Title Screen', 355: 'Script', 356: 'Plugin Command',
      401: ':', 402: 'When', 403: 'When Cancel', 404: 'End', 405: ':',
      408: ':', 411: 'Else', 412: 'End', 413: 'Repeat Above',
      601: 'If Win', 602: 'If Escape', 603: 'If Lose', 604: 'End',
      655: ':',
    };
    let text = DESCS[code] || `@${code}`;
    if (cmd.parameters && cmd.parameters.length > 0) {
      const params = cmd.parameters.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(', ');
      if (params.length > 60) {
        text += `: ${params.substring(0, 60)}...`;
      } else {
        text += `: ${params}`;
      }
    }
    return text;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="db-form-section">Event Commands</div>
      <div className="event-commands-list">
        {commands.map((cmd, i) => {
          const display = getCommandDisplay(cmd);
          return (
            <div
              key={i}
              className={`event-command-row${i === selectedIndex ? ' selected' : ''}`}
              style={{ paddingLeft: 8 + cmd.indent * 20 }}
              onClick={() => setSelectedIndex(i)}
              onDoubleClick={() => handleDoubleClick(i)}
            >
              {display || <span style={{ color: '#555' }}>&loz;</span>}
            </div>
          );
        })}
      </div>
      <div className="event-commands-toolbar">
        <button className="db-btn-small" onClick={() => setShowAddDialog(true)}>Add</button>
        <button className="db-btn-small" onClick={deleteCommand} disabled={selectedIndex < 0}>Delete</button>
      </div>

      {showAddDialog && (
        <div className="modal-overlay" onClick={() => setShowAddDialog(false)}>
          <div className="image-picker-dialog" onClick={e => e.stopPropagation()} style={{ width: 500, height: 500 }}>
            <div className="image-picker-header">Insert Command</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {Object.entries(COMMAND_CATEGORIES).map(([category, cmds]) => (
                <div key={category}>
                  <div style={{ fontWeight: 'bold', fontSize: 12, color: '#bbb', padding: '8px 4px 4px', borderBottom: '1px solid #444' }}>{category}</div>
                  {cmds.map(c => (
                    <div
                      key={c.code}
                      className="context-menu-item"
                      onClick={() => handleCommandSelect(c.code)}
                    >
                      {c.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="image-picker-footer">
              <button className="db-btn" onClick={() => setShowAddDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Parameter editor for new commands */}
      {pendingCode !== null && (
        <CommandParamEditor
          code={pendingCode}
          onOk={(params, extra) => insertCommandWithParams(pendingCode, params, extra)}
          onCancel={() => setPendingCode(null)}
        />
      )}

      {/* Parameter editor for editing existing commands */}
      {editingIndex !== null && (
        <CommandParamEditor
          code={commands[editingIndex].code}
          command={commands[editingIndex]}
          onOk={(params) => updateCommandParams(editingIndex, params)}
          onCancel={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}
