import React, { useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent, EventPage, EventConditions, EventImage, EventCommand, MoveRoute, MapData } from '../../types/rpgMakerMV';
import EventCommandEditor from './EventCommandEditor';
import ImagePicker from '../common/ImagePicker';

interface EventDetailProps {
  eventId: number;
  onClose: () => void;
}

const MOVE_TYPES = ['Fixed', 'Random', 'Approach', 'Custom'];
const MOVE_SPEEDS = ['x8 Slower', 'x4 Slower', 'x2 Slower', 'Normal', 'x2 Faster', 'x4 Faster'];
const MOVE_FREQS = ['Lowest', 'Lower', 'Normal', 'Higher', 'Highest'];
const PRIORITY_TYPES = ['Below characters', 'Same as characters', 'Above characters'];
const TRIGGER_TYPES = ['Action Button', 'Player Touch', 'Event Touch', 'Autorun', 'Parallel'];

function getDefaultPage(): EventPage {
  return {
    conditions: {
      actorId: 1, actorValid: false, itemId: 1, itemValid: false,
      selfSwitchCh: 'A', selfSwitchValid: false,
      switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
      variableId: 1, variableValid: false, variableValue: 0,
    },
    directionFix: false,
    image: { characterIndex: 0, characterName: '', direction: 2, pattern: 1, tileId: 0 },
    list: [{ code: 0, indent: 0, parameters: [] }],
    moveFrequency: 3,
    moveRoute: { list: [{ code: 0 }], repeat: true, skippable: false, wait: false },
    moveSpeed: 3,
    moveType: 0,
    priorityType: 1,
    stepAnime: false,
    through: false,
    trigger: 0,
    walkAnime: true,
  };
}

function getCommandDescription(cmd: EventCommand): string {
  const code = cmd.code;
  if (code === 0) return '';
  const descs: Record<number, string> = {
    101: 'Show Text',
    102: 'Show Choices',
    103: 'Input Number',
    104: 'Select Item',
    105: 'Show Scrolling Text',
    108: 'Comment',
    111: 'Conditional Branch',
    112: 'Loop',
    113: 'Break Loop',
    115: 'Exit Event Processing',
    117: 'Common Event',
    118: 'Label',
    119: 'Jump to Label',
    121: 'Control Switches',
    122: 'Control Variables',
    123: 'Control Self Switch',
    124: 'Control Timer',
    125: 'Change Gold',
    126: 'Change Items',
    127: 'Change Weapons',
    128: 'Change Armors',
    129: 'Change Party Member',
    132: 'Change Battle BGM',
    133: 'Change Victory ME',
    134: 'Change Save Access',
    135: 'Change Menu Access',
    136: 'Change Encounter',
    137: 'Change Formation Access',
    138: 'Change Window Color',
    201: 'Transfer Player',
    202: 'Set Vehicle Location',
    203: 'Set Event Location',
    204: 'Scroll Map',
    205: 'Set Movement Route',
    206: 'Get On/Off Vehicle',
    211: 'Change Transparency',
    212: 'Show Animation',
    213: 'Show Balloon Icon',
    214: 'Erase Event',
    216: 'Change Player Followers',
    217: 'Gather Followers',
    221: 'Fadeout Screen',
    222: 'Fadein Screen',
    223: 'Tint Screen',
    224: 'Flash Screen',
    225: 'Shake Screen',
    230: 'Wait',
    231: 'Show Picture',
    232: 'Move Picture',
    233: 'Rotate Picture',
    234: 'Tint Picture',
    235: 'Erase Picture',
    236: 'Set Weather',
    241: 'Play BGM',
    242: 'Fadeout BGM',
    243: 'Save BGM',
    244: 'Resume BGM',
    245: 'Play BGS',
    246: 'Fadeout BGS',
    249: 'Play ME',
    250: 'Play SE',
    251: 'Stop SE',
    261: 'Play Movie',
    281: 'Change Map Name Display',
    282: 'Change Tileset',
    283: 'Change Battle Back',
    284: 'Change Parallax',
    285: 'Get Location Info',
    301: 'Battle Processing',
    302: 'Shop Processing',
    303: 'Name Input Processing',
    311: 'Change HP',
    312: 'Change MP',
    313: 'Change TP',
    314: 'Change State',
    315: 'Recover All',
    316: 'Change EXP',
    317: 'Change Level',
    318: 'Change Parameter',
    319: 'Change Skill',
    320: 'Change Equipment',
    321: 'Change Name',
    322: 'Change Class',
    323: 'Change Actor Images',
    324: 'Change Vehicle Image',
    325: 'Change Nickname',
    326: 'Change Profile',
    331: 'Change Enemy HP',
    332: 'Change Enemy MP',
    333: 'Change Enemy TP',
    334: 'Change Enemy State',
    335: 'Enemy Recover All',
    336: 'Enemy Appear',
    337: 'Enemy Transform',
    338: 'Show Battle Animation',
    339: 'Force Action',
    340: 'Abort Battle',
    351: 'Open Menu Screen',
    352: 'Open Save Screen',
    353: 'Game Over',
    354: 'Return to Title Screen',
    355: 'Script',
    356: 'Plugin Command',
    401: '(Text data)',
    402: 'When [Choice]',
    403: 'When Cancel',
    404: '(Branch End)',
    405: '(Scrolling text data)',
    408: '(Comment data)',
    411: 'Else',
    412: '(Branch End)',
    413: 'Repeat Above',
    601: 'If Win',
    602: 'If Escape',
    603: 'If Lose',
    604: '(Battle Branch End)',
  };
  return descs[code] || `Command ${code}`;
}

export default function EventDetail({ eventId, onClose }: EventDetailProps) {
  const currentMap = useEditorStore((s) => s.currentMap);
  const event = currentMap?.events?.find((e) => e && e.id === eventId) as RPGEvent | undefined;

  const [editEvent, setEditEvent] = useState<RPGEvent>(() => event ? JSON.parse(JSON.stringify(event)) : null!);
  const [activePage, setActivePage] = useState(0);

  if (!editEvent) {
    return (
      <div className="db-dialog-overlay" onClick={onClose}>
        <div className="db-dialog" onClick={(e) => e.stopPropagation()} style={{ width: '70vw', height: '75vh' }}>
          <div className="db-dialog-header">Event #{eventId}</div>
          <div className="db-dialog-body">
            <div className="db-placeholder">Event not found</div>
          </div>
          <div className="db-dialog-footer">
            <button className="db-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const page = editEvent.pages?.[activePage];

  const updateEvent = (partial: Partial<RPGEvent>) => {
    setEditEvent((prev) => ({ ...prev, ...partial }));
  };

  const updatePage = (pageIndex: number, partial: Partial<EventPage>) => {
    const pages = [...editEvent.pages];
    pages[pageIndex] = { ...pages[pageIndex], ...partial };
    updateEvent({ pages });
  };

  const updateConditions = (partial: Partial<EventConditions>) => {
    if (!page) return;
    updatePage(activePage, { conditions: { ...page.conditions, ...partial } });
  };

  const updateImage = (partial: Partial<EventImage>) => {
    if (!page) return;
    updatePage(activePage, { image: { ...page.image, ...partial } });
  };

  const addPage = () => {
    const pages = [...editEvent.pages, getDefaultPage()];
    updateEvent({ pages });
    setActivePage(pages.length - 1);
  };

  const copyPage = () => {
    if (!page) return;
    const pages = [...editEvent.pages, JSON.parse(JSON.stringify(page))];
    updateEvent({ pages });
    setActivePage(pages.length - 1);
  };

  const deletePage = () => {
    if (editEvent.pages.length <= 1) return;
    const pages = editEvent.pages.filter((_: EventPage, i: number) => i !== activePage);
    updateEvent({ pages });
    setActivePage(Math.min(activePage, pages.length - 1));
  };

  const handleOk = () => {
    if (!currentMap) return;
    const events = [...(currentMap.events || [])];
    const idx = events.findIndex((e) => e && e.id === eventId);
    if (idx >= 0) {
      events[idx] = editEvent;
    }
    useEditorStore.setState({ currentMap: { ...currentMap, events } as MapData & { tilesetNames?: string[] } });
    onClose();
  };

  const selectStyle = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 } as const;

  return (
    <div className="db-dialog-overlay" onClick={onClose}>
      <div className="db-dialog" onClick={(e) => e.stopPropagation()} style={{ width: '75vw', height: '80vh' }}>
        <div className="db-dialog-header">Event - {editEvent.name} (ID: {editEvent.id})</div>
        <div className="db-dialog-body" style={{ flexDirection: 'column' }}>
          {/* Event properties */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #555', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#aaa' }}>
              Name
              <input
                type="text"
                value={editEvent.name || ''}
                onChange={(e) => updateEvent({ name: e.target.value })}
                style={{ ...selectStyle, width: 150 }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#aaa' }}>
              Note
              <input
                type="text"
                value={editEvent.note || ''}
                onChange={(e) => updateEvent({ note: e.target.value })}
                style={{ ...selectStyle, width: 200 }}
              />
            </label>
          </div>

          {/* Page tabs */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #555', padding: '4px 8px', gap: 4, flexShrink: 0 }}>
            {editEvent.pages.map((_: EventPage, i: number) => (
              <button
                key={i}
                className={`db-btn-small`}
                style={i === activePage ? { background: '#2675bf', borderColor: '#2675bf', color: '#fff' } : {}}
                onClick={() => setActivePage(i)}
              >
                {i + 1}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button className="db-btn-small" onClick={addPage}>New</button>
            <button className="db-btn-small" onClick={copyPage}>Copy</button>
            <button className="db-btn-small" onClick={deletePage} disabled={editEvent.pages.length <= 1}>Delete</button>
          </div>

          {/* Page content */}
          {page && (
            <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px', display: 'flex', gap: 16 }}>
              {/* Left column - conditions, image, movement, options */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="db-form-section">Conditions</div>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.switch1Valid} onChange={(e) => updateConditions({ switch1Valid: e.target.checked })} />
                  Switch 1
                  <input type="number" value={page.conditions.switch1Id} onChange={(e) => updateConditions({ switch1Id: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.switch1Valid} />
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.switch2Valid} onChange={(e) => updateConditions({ switch2Valid: e.target.checked })} />
                  Switch 2
                  <input type="number" value={page.conditions.switch2Id} onChange={(e) => updateConditions({ switch2Id: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.switch2Valid} />
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.variableValid} onChange={(e) => updateConditions({ variableValid: e.target.checked })} />
                  Variable
                  <input type="number" value={page.conditions.variableId} onChange={(e) => updateConditions({ variableId: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.variableValid} />
                  &ge;
                  <input type="number" value={page.conditions.variableValue} onChange={(e) => updateConditions({ variableValue: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.variableValid} />
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.selfSwitchValid} onChange={(e) => updateConditions({ selfSwitchValid: e.target.checked })} />
                  Self Switch
                  <select value={page.conditions.selfSwitchCh} onChange={(e) => updateConditions({ selfSwitchCh: e.target.value })} style={selectStyle} disabled={!page.conditions.selfSwitchValid}>
                    {['A', 'B', 'C', 'D'].map((ch) => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.itemValid} onChange={(e) => updateConditions({ itemValid: e.target.checked })} />
                  Item
                  <input type="number" value={page.conditions.itemId} onChange={(e) => updateConditions({ itemId: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.itemValid} />
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.actorValid} onChange={(e) => updateConditions({ actorValid: e.target.checked })} />
                  Actor
                  <input type="number" value={page.conditions.actorId} onChange={(e) => updateConditions({ actorId: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.actorValid} />
                </label>

                <div className="db-form-section">Image</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  Character
                  <ImagePicker
                    type="characters"
                    value={page.image.characterName || ''}
                    onChange={(name) => updateImage({ characterName: name })}
                    index={page.image.characterIndex}
                    onIndexChange={(idx) => updateImage({ characterIndex: idx })}
                    direction={page.image.direction}
                    onDirectionChange={(dir) => updateImage({ direction: dir })}
                    pattern={page.image.pattern}
                    onPatternChange={(pat) => updateImage({ pattern: pat })}
                  />
                </div>

                <div className="db-form-section">Autonomous Movement</div>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  Type
                  <select value={page.moveType} onChange={(e) => updatePage(activePage, { moveType: Number(e.target.value) })} style={selectStyle}>
                    {MOVE_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  Speed
                  <select value={page.moveSpeed - 1} onChange={(e) => updatePage(activePage, { moveSpeed: Number(e.target.value) + 1 })} style={selectStyle}>
                    {MOVE_SPEEDS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  Frequency
                  <select value={page.moveFrequency - 1} onChange={(e) => updatePage(activePage, { moveFrequency: Number(e.target.value) + 1 })} style={selectStyle}>
                    {MOVE_FREQS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </label>

                <div className="db-form-section">Options</div>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.walkAnime} onChange={(e) => updatePage(activePage, { walkAnime: e.target.checked })} />
                  Walking Animation
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.stepAnime} onChange={(e) => updatePage(activePage, { stepAnime: e.target.checked })} />
                  Stepping Animation
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.directionFix} onChange={(e) => updatePage(activePage, { directionFix: e.target.checked })} />
                  Direction Fix
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.through} onChange={(e) => updatePage(activePage, { through: e.target.checked })} />
                  Through
                </label>

                <div className="db-form-section">Priority & Trigger</div>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  Priority
                  <select value={page.priorityType} onChange={(e) => updatePage(activePage, { priorityType: Number(e.target.value) })} style={selectStyle}>
                    {PRIORITY_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  Trigger
                  <select value={page.trigger} onChange={(e) => updatePage(activePage, { trigger: Number(e.target.value) })} style={selectStyle}>
                    {TRIGGER_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </label>
              </div>

              {/* Right column - Event commands */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <EventCommandEditor
                  commands={page.list || []}
                  onChange={(newList) => updatePage(activePage, { list: newList })}
                />
              </div>
            </div>
          )}
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
