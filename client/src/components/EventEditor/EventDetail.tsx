import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent, EventPage, EventConditions, EventImage, EventCommand, MoveRoute, MapData } from '../../types/rpgMakerMV';
import EventCommandEditor from './EventCommandEditor';
import ImagePicker from '../common/ImagePicker';
import './EventEditor.css';

interface EventDetailProps {
  eventId: number;
  onClose: () => void;
}

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

export default function EventDetail({ eventId, onClose }: EventDetailProps) {
  const { t } = useTranslation();
  const currentMap = useEditorStore((s) => s.currentMap);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const event = currentMap?.events?.find((e) => e && e.id === eventId) as RPGEvent | undefined;

  const [editEvent, setEditEvent] = useState<RPGEvent>(() => event ? JSON.parse(JSON.stringify(event)) : null!);
  const [activePage, setActivePage] = useState(0);

  const MOVE_TYPES = useMemo(() => [
    t('eventDetail.moveTypes.0'), t('eventDetail.moveTypes.1'), t('eventDetail.moveTypes.2'), t('eventDetail.moveTypes.3'),
  ], [t]);

  const MOVE_SPEEDS = useMemo(() => [
    t('eventDetail.moveSpeeds.0'), t('eventDetail.moveSpeeds.1'), t('eventDetail.moveSpeeds.2'),
    t('eventDetail.moveSpeeds.3'), t('eventDetail.moveSpeeds.4'), t('eventDetail.moveSpeeds.5'),
  ], [t]);

  const MOVE_FREQS = useMemo(() => [
    t('eventDetail.moveFreqs.0'), t('eventDetail.moveFreqs.1'), t('eventDetail.moveFreqs.2'),
    t('eventDetail.moveFreqs.3'), t('eventDetail.moveFreqs.4'),
  ], [t]);

  const PRIORITY_TYPES = useMemo(() => [
    t('eventDetail.priorityTypes.0'), t('eventDetail.priorityTypes.1'), t('eventDetail.priorityTypes.2'),
  ], [t]);

  const TRIGGER_TYPES = useMemo(() => [
    t('eventDetail.triggerTypes.0'), t('eventDetail.triggerTypes.1'), t('eventDetail.triggerTypes.2'),
    t('eventDetail.triggerTypes.3'), t('eventDetail.triggerTypes.4'),
  ], [t]);

  if (!editEvent) {
    return (
      <div className="db-dialog-overlay" onClick={onClose}>
        <div className="db-dialog" onClick={(e) => e.stopPropagation()} style={{ width: '70vw', height: '75vh' }}>
          <div className="db-dialog-header">Event #{eventId}</div>
          <div className="db-dialog-body">
            <div className="db-placeholder">{t('eventDetail.eventNotFound')}</div>
          </div>
          <div className="db-dialog-footer">
            <button className="db-btn" onClick={onClose}>{t('common.close')}</button>
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
    setEditEvent((prev) => {
      const pages = [...prev.pages];
      pages[pageIndex] = { ...pages[pageIndex], ...partial };
      return { ...prev, pages };
    });
  };

  const updateConditions = (partial: Partial<EventConditions>) => {
    setEditEvent((prev) => {
      const pg = prev.pages?.[activePage];
      if (!pg) return prev;
      const pages = [...prev.pages];
      pages[activePage] = { ...pg, conditions: { ...pg.conditions, ...partial } };
      return { ...prev, pages };
    });
  };

  const updateImage = (partial: Partial<EventImage>) => {
    setEditEvent((prev) => {
      const pg = prev.pages?.[activePage];
      if (!pg) return prev;
      const pages = [...prev.pages];
      pages[activePage] = { ...pg, image: { ...pg.image, ...partial } };
      return { ...prev, pages };
    });
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
              {t('common.name')}
              <input
                type="text"
                value={editEvent.name || ''}
                onChange={(e) => updateEvent({ name: e.target.value })}
                style={{ ...selectStyle, width: 150 }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#aaa' }}>
              {t('common.note')}
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
            <button className="db-btn-small" onClick={addPage}>{t('common.new')}</button>
            <button className="db-btn-small" onClick={copyPage}>{t('common.copy')}</button>
            <button className="db-btn-small" onClick={deletePage} disabled={editEvent.pages.length <= 1}>{t('common.delete')}</button>
          </div>

          {/* Page content */}
          {page && (
            <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px', display: 'flex', gap: 16 }}>
              {/* Left column - conditions, image, movement, options */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="db-form-section">{t('fields.conditions')}</div>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.switch1Valid} onChange={(e) => updateConditions({ switch1Valid: e.target.checked })} />
                  {t('eventDetail.conditionSwitch1')}
                  <input type="number" value={page.conditions.switch1Id} onChange={(e) => updateConditions({ switch1Id: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.switch1Valid} />
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.switch2Valid} onChange={(e) => updateConditions({ switch2Valid: e.target.checked })} />
                  {t('eventDetail.conditionSwitch2')}
                  <input type="number" value={page.conditions.switch2Id} onChange={(e) => updateConditions({ switch2Id: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.switch2Valid} />
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.variableValid} onChange={(e) => updateConditions({ variableValid: e.target.checked })} />
                  {t('eventDetail.conditionVariable')}
                  <input type="number" value={page.conditions.variableId} onChange={(e) => updateConditions({ variableId: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.variableValid} />
                  &ge;
                  <input type="number" value={page.conditions.variableValue} onChange={(e) => updateConditions({ variableValue: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.variableValid} />
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.selfSwitchValid} onChange={(e) => updateConditions({ selfSwitchValid: e.target.checked })} />
                  {t('eventDetail.conditionSelfSwitch')}
                  <select value={page.conditions.selfSwitchCh} onChange={(e) => updateConditions({ selfSwitchCh: e.target.value })} style={selectStyle} disabled={!page.conditions.selfSwitchValid}>
                    {['A', 'B', 'C', 'D'].map((ch) => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.itemValid} onChange={(e) => updateConditions({ itemValid: e.target.checked })} />
                  {t('eventDetail.conditionItem')}
                  <input type="number" value={page.conditions.itemId} onChange={(e) => updateConditions({ itemId: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.itemValid} />
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.conditions.actorValid} onChange={(e) => updateConditions({ actorValid: e.target.checked })} />
                  {t('eventDetail.conditionActor')}
                  <input type="number" value={page.conditions.actorId} onChange={(e) => updateConditions({ actorId: Number(e.target.value) })} style={{ ...selectStyle, width: 60 }} disabled={!page.conditions.actorValid} />
                </label>

                <div className="db-form-section">{t('eventDetail.image')}</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {t('fields.character')}
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

                <div className="db-form-section">{t('eventDetail.autonomousMovement')}</div>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  {t('eventDetail.type')}
                  <select value={page.moveType} onChange={(e) => updatePage(activePage, { moveType: Number(e.target.value) })} style={selectStyle}>
                    {MOVE_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  {t('fields.speed')}
                  <select value={page.moveSpeed - 1} onChange={(e) => updatePage(activePage, { moveSpeed: Number(e.target.value) + 1 })} style={selectStyle}>
                    {MOVE_SPEEDS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  {t('eventDetail.frequency')}
                  <select value={page.moveFrequency - 1} onChange={(e) => updatePage(activePage, { moveFrequency: Number(e.target.value) + 1 })} style={selectStyle}>
                    {MOVE_FREQS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </label>

                <div className="db-form-section">{t('eventDetail.options')}</div>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.walkAnime} onChange={(e) => updatePage(activePage, { walkAnime: e.target.checked })} />
                  {t('eventDetail.walkingAnimation')}
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.stepAnime} onChange={(e) => updatePage(activePage, { stepAnime: e.target.checked })} />
                  {t('eventDetail.steppingAnimation')}
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.directionFix} onChange={(e) => updatePage(activePage, { directionFix: e.target.checked })} />
                  {t('eventDetail.directionFix')}
                </label>
                <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={page.through} onChange={(e) => updatePage(activePage, { through: e.target.checked })} />
                  {t('eventDetail.through')}
                </label>

                <div className="db-form-section">{t('eventDetail.priorityAndTrigger')}</div>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  {t('fields.priority')}
                  <select value={page.priorityType} onChange={(e) => updatePage(activePage, { priorityType: Number(e.target.value) })} style={selectStyle}>
                    {PRIORITY_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#aaa' }}>
                  {t('fields.trigger')}
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
                  context={{ mapId: currentMapId || undefined, eventId, pageIndex: activePage }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
