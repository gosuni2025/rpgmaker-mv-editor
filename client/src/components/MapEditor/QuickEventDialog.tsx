import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent, EventPage, EventCommand, MapData } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';

interface QuickEventDialogProps {
  type: 'transfer' | 'door' | 'treasure' | 'inn';
  tileX: number;
  tileY: number;
  onClose: () => void;
}

const defaultPage = (): EventPage => ({
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
});

// ─── Transfer (시프트) ───
function TransferForm({ onConfirm, onClose }: { onConfirm: (cmds: EventCommand[]) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const maps = useEditorStore((s) => s.maps);
  const [mapId, setMapId] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [dir, setDir] = useState(0);
  const [fade, setFade] = useState(0);

  const handleOk = () => {
    // Transfer Player: code 201, params: [0=direct, mapId, x, y, direction, fadeType]
    const cmds: EventCommand[] = [
      { code: 201, indent: 0, parameters: [0, mapId, x, y, dir, fade] },
      { code: 0, indent: 0, parameters: [] },
    ];
    onConfirm(cmds);
  };

  return (
    <div className="quick-event-form">
      <h3>{t('quickEvent.transfer.title')}</h3>
      <div className="qe-field">
        <label>{t('quickEvent.transfer.map')}</label>
        <select value={mapId} onChange={(e) => setMapId(Number(e.target.value))}>
          {maps.filter((m) => m != null).map((m) => (
            <option key={m!.id} value={m!.id}>{String(m!.id).padStart(3, '0')}: {m!.name}</option>
          ))}
        </select>
      </div>
      <div className="qe-row">
        <div className="qe-field">
          <label>{t('quickEvent.transfer.x')}</label>
          <input type="number" min={0} value={x} onChange={(e) => setX(Number(e.target.value))} />
        </div>
        <div className="qe-field">
          <label>{t('quickEvent.transfer.y')}</label>
          <input type="number" min={0} value={y} onChange={(e) => setY(Number(e.target.value))} />
        </div>
      </div>
      <div className="qe-field">
        <label>{t('quickEvent.transfer.direction')}</label>
        <select value={dir} onChange={(e) => setDir(Number(e.target.value))}>
          {[0, 2, 4, 6, 8].map((d) => (
            <option key={d} value={d}>{t(`quickEvent.transfer.directions.${d}`)}</option>
          ))}
        </select>
      </div>
      <div className="qe-field">
        <label>{t('quickEvent.transfer.fadeType')}</label>
        <select value={fade} onChange={(e) => setFade(Number(e.target.value))}>
          {[0, 1, 2].map((f) => (
            <option key={f} value={f}>{t(`quickEvent.transfer.fadeTypes.${f}`)}</option>
          ))}
        </select>
      </div>
      <div className="qe-buttons">
        <button onClick={handleOk}>{t('common.ok')}</button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

// ─── Door (문) ───
function DoorForm({ onConfirm, onClose }: { onConfirm: (cmds: EventCommand[], image?: { characterName: string; characterIndex: number; direction: number }) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const maps = useEditorStore((s) => s.maps);
  const [charName, setCharName] = useState('!Door1');
  const [charIndex, setCharIndex] = useState(0);
  const [mapId, setMapId] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  const handleOk = () => {
    // Door event: trigger=Player Touch, priority=Below Characters
    // Page 1: SE play (Open1), Set Move Route (pattern changes for door opening animation), Wait, Transfer, Set Move Route (close)
    // Simplified version matching RPG Maker MV Quick Event
    const cmds: EventCommand[] = [
      // Play SE: Open1
      { code: 250, indent: 0, parameters: [{ name: 'Open1', pan: 0, pitch: 100, volume: 90 }] },
      // Wait 15 frames
      { code: 230, indent: 0, parameters: [15] },
      // Set Move Route (this event - step anime)
      { code: 205, indent: 0, parameters: [-1, { list: [
        { code: 33 },  // Stepping Animation ON
        { code: 15, parameters: [3] },  // Wait 3 frames
        { code: 15, parameters: [3] },  // Wait 3 frames
        { code: 15, parameters: [3] },  // Wait 3 frames
        { code: 0 },
      ], repeat: false, skippable: false, wait: true }] },
      // Transfer Player
      { code: 201, indent: 0, parameters: [0, mapId, x, y, 0, 0] },
      // Set Move Route (close door)
      { code: 205, indent: 0, parameters: [-1, { list: [
        { code: 34 },  // Stepping Animation OFF
        { code: 41, parameters: [charName, charIndex, 2, 1] },  // Set Image (pattern 1 = closed)
        { code: 0 },
      ], repeat: false, skippable: false, wait: false }] },
      { code: 0, indent: 0, parameters: [] },
    ];
    onConfirm(cmds, { characterName: charName, characterIndex: charIndex, direction: 2 });
  };

  return (
    <div className="quick-event-form">
      <h3>{t('quickEvent.door.title')}</h3>
      <div className="qe-field">
        <label>{t('quickEvent.door.image')}</label>
        <ImagePicker type="characters" value={charName} onChange={setCharName} index={charIndex} onIndexChange={setCharIndex} />
      </div>
      <h4>{t('quickEvent.door.destination')}</h4>
      <div className="qe-field">
        <label>{t('quickEvent.door.map')}</label>
        <select value={mapId} onChange={(e) => setMapId(Number(e.target.value))}>
          {maps.filter((m) => m != null).map((m) => (
            <option key={m!.id} value={m!.id}>{String(m!.id).padStart(3, '0')}: {m!.name}</option>
          ))}
        </select>
      </div>
      <div className="qe-row">
        <div className="qe-field">
          <label>{t('quickEvent.door.x')}</label>
          <input type="number" min={0} value={x} onChange={(e) => setX(Number(e.target.value))} />
        </div>
        <div className="qe-field">
          <label>{t('quickEvent.door.y')}</label>
          <input type="number" min={0} value={y} onChange={(e) => setY(Number(e.target.value))} />
        </div>
      </div>
      <div className="qe-buttons">
        <button onClick={handleOk}>{t('common.ok')}</button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

// ─── Treasure (보물) ───
function TreasureForm({ onConfirm, onClose }: { onConfirm: (pages: EventPage[]) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [charName, setCharName] = useState('!Chest');
  const [charIndex, setCharIndex] = useState(0);
  const [rewardType, setRewardType] = useState<'gold' | 'item' | 'weapon' | 'armor'>('gold');
  const [amount, setAmount] = useState(100);
  const [itemId, setItemId] = useState(1);

  const handleOk = () => {
    // Page 1: closed chest (selfSwitch A = false) -> open and give reward, set selfSwitch A
    // Page 2: opened chest (selfSwitch A = true) -> empty
    const page1 = defaultPage();
    page1.image = { characterIndex: charIndex, characterName: charName, direction: 2, pattern: 1, tileId: 0 };
    page1.trigger = 0; // Action Button
    page1.priorityType = 1; // Same as characters

    const cmds: EventCommand[] = [];
    // Play SE
    cmds.push({ code: 250, indent: 0, parameters: [{ name: 'Chest1', pan: 0, pitch: 100, volume: 90 }] });
    // Set Move Route (open animation - change to opened pattern)
    cmds.push({ code: 205, indent: 0, parameters: [-1, { list: [
      { code: 41, parameters: [charName, charIndex, 2, 0] },  // Set Image (direction 2, pattern 0 = open)
      { code: 0 },
    ], repeat: false, skippable: false, wait: true }] });

    if (rewardType === 'gold') {
      // Change Gold
      cmds.push({ code: 125, indent: 0, parameters: [0, 0, amount] });
      // Show Text: "X골드를 손에 넣었다!"
      cmds.push({ code: 101, indent: 0, parameters: ['', 0, 0, 2] });
      cmds.push({ code: 401, indent: 0, parameters: [`${amount}\\G を手に入れた！`] });
    } else if (rewardType === 'item') {
      // Change Items
      cmds.push({ code: 126, indent: 0, parameters: [itemId, 0, 0, 1] });
      cmds.push({ code: 101, indent: 0, parameters: ['', 0, 0, 2] });
      cmds.push({ code: 401, indent: 0, parameters: [`\\I[0] を手に入れた！`] });
    } else if (rewardType === 'weapon') {
      // Change Weapons
      cmds.push({ code: 127, indent: 0, parameters: [itemId, 0, 0, 1, false] });
      cmds.push({ code: 101, indent: 0, parameters: ['', 0, 0, 2] });
      cmds.push({ code: 401, indent: 0, parameters: [`\\I[0] を手に入れた！`] });
    } else if (rewardType === 'armor') {
      // Change Armors
      cmds.push({ code: 128, indent: 0, parameters: [itemId, 0, 0, 1, false] });
      cmds.push({ code: 101, indent: 0, parameters: ['', 0, 0, 2] });
      cmds.push({ code: 401, indent: 0, parameters: [`\\I[0] を手に入れた！`] });
    }

    // Self Switch A = ON
    cmds.push({ code: 123, indent: 0, parameters: ['A', 0] });
    cmds.push({ code: 0, indent: 0, parameters: [] });
    page1.list = cmds;

    // Page 2: opened chest (condition: Self Switch A)
    const page2 = defaultPage();
    page2.conditions = { ...page2.conditions, selfSwitchCh: 'A', selfSwitchValid: true };
    page2.image = { characterIndex: charIndex, characterName: charName, direction: 2, pattern: 0, tileId: 0 };
    page2.trigger = 0;
    page2.priorityType = 1;

    onConfirm([page1, page2]);
  };

  return (
    <div className="quick-event-form">
      <h3>{t('quickEvent.treasure.title')}</h3>
      <div className="qe-field">
        <label>{t('quickEvent.treasure.image')}</label>
        <ImagePicker type="characters" value={charName} onChange={setCharName} index={charIndex} onIndexChange={setCharIndex} />
      </div>
      <div className="qe-field">
        <label>{t('quickEvent.treasure.rewardType')}</label>
        <select value={rewardType} onChange={(e) => setRewardType(e.target.value as any)}>
          {(['gold', 'item', 'weapon', 'armor'] as const).map((rt) => (
            <option key={rt} value={rt}>{t(`quickEvent.treasure.rewardTypes.${rt}`)}</option>
          ))}
        </select>
      </div>
      {rewardType === 'gold' ? (
        <div className="qe-field">
          <label>{t('quickEvent.treasure.amount')}</label>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
      ) : (
        <div className="qe-field">
          <label>{t('quickEvent.treasure.item')} ID</label>
          <input type="number" min={1} value={itemId} onChange={(e) => setItemId(Number(e.target.value))} />
        </div>
      )}
      <div className="qe-buttons">
        <button onClick={handleOk}>{t('common.ok')}</button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

// ─── Inn (여관) ───
function InnForm({ onConfirm, onClose }: { onConfirm: (cmds: EventCommand[], image?: { characterName: string; characterIndex: number; direction: number }) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [charName, setCharName] = useState('People1');
  const [charIndex, setCharIndex] = useState(0);
  const [price, setPrice] = useState(100);

  const handleOk = () => {
    const cmds: EventCommand[] = [
      // Show Text (invitation)
      { code: 101, indent: 0, parameters: [charName, charIndex, 0, 2] },
      { code: 401, indent: 0, parameters: [`한 밤에 ${price}\\G입니다.\n묵어 가시겠습니까?`] },
      // Show Choices: [예, 아니오]
      { code: 102, indent: 0, parameters: [['예', '아니오'], 1] },
      // When "예"
      { code: 402, indent: 0, parameters: [0, '예'] },
      // Conditional Branch: Gold >= price
      { code: 111, indent: 1, parameters: [7, price, 0] },
      // Change Gold: -price
      { code: 125, indent: 2, parameters: [1, 0, price] },
      // Fadeout Screen
      { code: 221, indent: 2, parameters: [] },
      // Recover All (entire party)
      { code: 314, indent: 2, parameters: [0, 0] },
      // Wait 60 frames
      { code: 230, indent: 2, parameters: [60] },
      // Fadein Screen
      { code: 222, indent: 2, parameters: [] },
      // Play SE
      { code: 250, indent: 2, parameters: [{ name: 'Recovery', pan: 0, pitch: 100, volume: 90 }] },
      // Show Text (after stay)
      { code: 101, indent: 2, parameters: [charName, charIndex, 0, 2] },
      { code: 401, indent: 2, parameters: ['좋은 아침입니다.\n또 오세요.'] },
      // Else
      { code: 411, indent: 1, parameters: [] },
      // Play SE (Buzzer)
      { code: 250, indent: 2, parameters: [{ name: 'Buzzer1', pan: 0, pitch: 100, volume: 90 }] },
      // Show Text (not enough money)
      { code: 101, indent: 2, parameters: [charName, charIndex, 0, 2] },
      { code: 401, indent: 2, parameters: ['소지금이 부족합니다.'] },
      // Branch End
      { code: 412, indent: 1, parameters: [] },
      // When "아니오"
      { code: 402, indent: 0, parameters: [1, '아니오'] },
      // Branch End (choices)
      { code: 404, indent: 0, parameters: [] },
      { code: 0, indent: 0, parameters: [] },
    ];
    onConfirm(cmds, { characterName: charName, characterIndex: charIndex, direction: 2 });
  };

  return (
    <div className="quick-event-form">
      <h3>{t('quickEvent.inn.title')}</h3>
      <div className="qe-field">
        <label>{t('quickEvent.inn.image')}</label>
        <ImagePicker type="characters" value={charName} onChange={setCharName} index={charIndex} onIndexChange={setCharIndex} />
      </div>
      <div className="qe-field">
        <label>{t('quickEvent.inn.price')}</label>
        <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
      </div>
      <div className="qe-buttons">
        <button onClick={handleOk}>{t('common.ok')}</button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

// ─── Main Dialog ───
export default function QuickEventDialog({ type, tileX, tileY, onClose }: QuickEventDialogProps) {
  const currentMap = useEditorStore((s) => s.currentMap);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);

  const createEvent = useCallback((pages: EventPage[]) => {
    if (!currentMap) return;
    const oldEvents = [...(currentMap.events || [])];
    const events = [...oldEvents];
    const maxId = events.reduce((max: number, e) => (e && e.id > max ? e.id : max), 0);
    const newEvent: RPGEvent = {
      id: maxId + 1,
      name: `EV${String(maxId + 1).padStart(3, '0')}`,
      x: tileX, y: tileY,
      note: '',
      pages,
    };
    while (events.length <= maxId + 1) events.push(null as any);
    events[maxId + 1] = newEvent;
    const state = useEditorStore.getState();
    useEditorStore.setState({ currentMap: { ...currentMap, events } as MapData & { tilesetNames?: string[] } });
    if (currentMapId) {
      const undoStack = [...state.undoStack, {
        mapId: currentMapId, type: 'event' as const,
        oldEvents, newEvents: events,
        oldSelectedEventId: state.selectedEventId,
        oldSelectedEventIds: state.selectedEventIds,
      }];
      if (undoStack.length > state.maxUndo) undoStack.shift();
      useEditorStore.setState({ undoStack, redoStack: [] });
    }
    setSelectedEventId(maxId + 1);
    onClose();
  }, [currentMap, currentMapId, tileX, tileY, setSelectedEventId, onClose]);

  const handleCmdsConfirm = useCallback((cmds: EventCommand[], image?: { characterName: string; characterIndex: number; direction: number }) => {
    const page = defaultPage();
    page.list = cmds;
    if (image) {
      page.image = { ...page.image, characterName: image.characterName, characterIndex: image.characterIndex, direction: image.direction };
    }
    if (type === 'door') {
      page.trigger = 1; // Player Touch
      page.priorityType = 0; // Below characters
    }
    createEvent([page]);
  }, [type, createEvent]);

  const handlePagesConfirm = useCallback((pages: EventPage[]) => {
    createEvent(pages);
  }, [createEvent]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ minWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        {type === 'transfer' && <TransferForm onConfirm={handleCmdsConfirm} onClose={onClose} />}
        {type === 'door' && <DoorForm onConfirm={handleCmdsConfirm} onClose={onClose} />}
        {type === 'treasure' && <TreasureForm onConfirm={handlePagesConfirm} onClose={onClose} />}
        {type === 'inn' && <InnForm onConfirm={handleCmdsConfirm} onClose={onClose} />}
      </div>
    </div>
  );
}
