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

  const clearPage = () => {
    const pages = editEvent.pages.map((p: EventPage, i: number) => i === activePage ? getDefaultPage() : p);
    updateEvent({ pages });
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

  const handleApply = () => {
    if (!currentMap) return;
    const events = [...(currentMap.events || [])];
    const idx = events.findIndex((e) => e && e.id === eventId);
    if (idx >= 0) {
      events[idx] = JSON.parse(JSON.stringify(editEvent));
    }
    useEditorStore.setState({ currentMap: { ...currentMap, events } as MapData & { tilesetNames?: string[] } });
  };

  const padId = (id: number) => String(id).padStart(3, '0');

  return (
    <div className="db-dialog-overlay" onClick={onClose}>
      <div className="event-editor-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div className="event-editor-titlebar">
          ID:{padId(editEvent.id)} - {t('eventDetail.title', '이벤트 에디터')}
        </div>

        {/* Name / Note bar */}
        <div className="event-editor-namebar">
          <label className="event-editor-name-label">
            {t('common.name')}:
            <input
              type="text"
              value={editEvent.name || ''}
              onChange={(e) => updateEvent({ name: e.target.value })}
              className="event-editor-input"
              style={{ width: 140 }}
            />
          </label>
          <label className="event-editor-name-label">
            {t('common.note')}:
            <input
              type="text"
              value={editEvent.note || ''}
              onChange={(e) => updateEvent({ note: e.target.value })}
              className="event-editor-input"
              style={{ flex: 1, minWidth: 120 }}
            />
          </label>
        </div>

        {/* Page tabs bar */}
        <div className="event-editor-pagebar">
          <div className="event-editor-pagetabs">
            {editEvent.pages.map((_: EventPage, i: number) => (
              <button
                key={i}
                className={`event-page-tab${i === activePage ? ' active' : ''}`}
                onClick={() => setActivePage(i)}
              >
                {t('eventDetail.eventPage', '이벤트 페이지')} {i + 1}
              </button>
            ))}
          </div>
          <div className="event-editor-page-actions">
            <button className="event-editor-page-btn" onClick={addPage}>{t('eventDetail.newPage', '새로 만들기')}</button>
            <button className="event-editor-page-btn" onClick={copyPage}>{t('common.copy')}</button>
            <button className="event-editor-page-btn" onClick={deletePage} disabled={editEvent.pages.length <= 1}>{t('common.delete')}</button>
            <button className="event-editor-page-btn event-editor-clear-page" onClick={clearPage}>{t('eventDetail.clearPage', '이벤트 페이지 비우기')}</button>
          </div>
        </div>

        {/* Main content */}
        {page && (
          <div className="event-editor-body">
            {/* Left panel */}
            <div className="event-editor-left">
              {/* Row 1: Conditions (full width) */}
              <fieldset className="event-editor-fieldset">
                <legend>{t('fields.conditions')}</legend>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label">
                    <input type="checkbox" checked={page.conditions.switch1Valid} onChange={(e) => updateConditions({ switch1Valid: e.target.checked })} />
                    {t('eventDetail.conditionSwitch1')}
                  </label>
                  <input type="number" value={page.conditions.switch1Id} onChange={(e) => updateConditions({ switch1Id: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!page.conditions.switch1Valid} />
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label">
                    <input type="checkbox" checked={page.conditions.switch2Valid} onChange={(e) => updateConditions({ switch2Valid: e.target.checked })} />
                    {t('eventDetail.conditionSwitch2')}
                  </label>
                  <input type="number" value={page.conditions.switch2Id} onChange={(e) => updateConditions({ switch2Id: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!page.conditions.switch2Valid} />
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label">
                    <input type="checkbox" checked={page.conditions.variableValid} onChange={(e) => updateConditions({ variableValid: e.target.checked })} />
                    {t('eventDetail.conditionVariable')}
                  </label>
                  <input type="number" value={page.conditions.variableId} onChange={(e) => updateConditions({ variableId: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!page.conditions.variableValid} />
                  <span className="event-editor-cond-op">&ge;</span>
                  <input type="number" value={page.conditions.variableValue} onChange={(e) => updateConditions({ variableValue: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!page.conditions.variableValid} />
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label">
                    <input type="checkbox" checked={page.conditions.selfSwitchValid} onChange={(e) => updateConditions({ selfSwitchValid: e.target.checked })} />
                    {t('eventDetail.conditionSelfSwitch')}
                  </label>
                  <select value={page.conditions.selfSwitchCh} onChange={(e) => updateConditions({ selfSwitchCh: e.target.value })} className="event-editor-select" disabled={!page.conditions.selfSwitchValid}>
                    {['A', 'B', 'C', 'D'].map((ch) => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label">
                    <input type="checkbox" checked={page.conditions.itemValid} onChange={(e) => updateConditions({ itemValid: e.target.checked })} />
                    {t('eventDetail.conditionItem')}
                  </label>
                  <input type="number" value={page.conditions.itemId} onChange={(e) => updateConditions({ itemId: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!page.conditions.itemValid} />
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label">
                    <input type="checkbox" checked={page.conditions.actorValid} onChange={(e) => updateConditions({ actorValid: e.target.checked })} />
                    {t('eventDetail.conditionActor')}
                  </label>
                  <input type="number" value={page.conditions.actorId} onChange={(e) => updateConditions({ actorId: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!page.conditions.actorValid} />
                </div>
              </fieldset>

              {/* Row 2: Image (left) + Autonomous Movement (right) */}
              <div className="event-editor-hrow">
                <fieldset className="event-editor-fieldset event-editor-fieldset-half">
                  <legend>{t('eventDetail.image')}</legend>
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
                </fieldset>
                <fieldset className="event-editor-fieldset event-editor-fieldset-half">
                  <legend>{t('eventDetail.autonomousMovement')}</legend>
                  <div className="event-editor-form-row">
                    <span className="event-editor-form-label">{t('eventDetail.type')}:</span>
                    <select value={page.moveType} onChange={(e) => updatePage(activePage, { moveType: Number(e.target.value) })} className="event-editor-select">
                      {MOVE_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                    </select>
                  </div>
                  <div className="event-editor-form-row">
                    <span className="event-editor-form-label">{t('fields.speed')}:</span>
                    <select value={page.moveSpeed - 1} onChange={(e) => updatePage(activePage, { moveSpeed: Number(e.target.value) + 1 })} className="event-editor-select">
                      {MOVE_SPEEDS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                    </select>
                  </div>
                  <div className="event-editor-form-row">
                    <span className="event-editor-form-label">{t('eventDetail.frequency')}:</span>
                    <select value={page.moveFrequency - 1} onChange={(e) => updatePage(activePage, { moveFrequency: Number(e.target.value) + 1 })} className="event-editor-select">
                      {MOVE_FREQS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                    </select>
                  </div>
                </fieldset>
              </div>

              {/* Row 3: Options (left) + Priority (right) */}
              <div className="event-editor-hrow">
                <fieldset className="event-editor-fieldset event-editor-fieldset-half">
                  <legend>{t('eventDetail.options')}</legend>
                  <label className="event-editor-checkbox">
                    <input type="checkbox" checked={page.walkAnime} onChange={(e) => updatePage(activePage, { walkAnime: e.target.checked })} />
                    {t('eventDetail.walkingAnimation')}
                  </label>
                  <label className="event-editor-checkbox">
                    <input type="checkbox" checked={page.stepAnime} onChange={(e) => updatePage(activePage, { stepAnime: e.target.checked })} />
                    {t('eventDetail.steppingAnimation')}
                  </label>
                  <label className="event-editor-checkbox">
                    <input type="checkbox" checked={page.directionFix} onChange={(e) => updatePage(activePage, { directionFix: e.target.checked })} />
                    {t('eventDetail.directionFix')}
                  </label>
                  <label className="event-editor-checkbox">
                    <input type="checkbox" checked={page.through} onChange={(e) => updatePage(activePage, { through: e.target.checked })} />
                    {t('eventDetail.through')}
                  </label>
                </fieldset>
                <fieldset className="event-editor-fieldset event-editor-fieldset-half">
                  <legend>{t('eventDetail.priority', '우선권')}</legend>
                  <select value={page.priorityType} onChange={(e) => updatePage(activePage, { priorityType: Number(e.target.value) })} className="event-editor-select" style={{ width: '100%' }}>
                    {PRIORITY_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </fieldset>
              </div>

              {/* Row 4: Trigger (full width) */}
              <fieldset className="event-editor-fieldset">
                <legend>{t('eventDetail.trigger', '발동')}</legend>
                <select value={page.trigger} onChange={(e) => updatePage(activePage, { trigger: Number(e.target.value) })} className="event-editor-select" style={{ width: '100%' }}>
                  {TRIGGER_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                </select>
              </fieldset>
            </div>

            {/* Right panel - Event commands */}
            <div className="event-editor-right">
              <div className="event-editor-right-header">{t('eventCommands.title', '실행 내용')}</div>
              <EventCommandEditor
                commands={page.list || []}
                onChange={(newList) => updatePage(activePage, { list: newList })}
                context={{ mapId: currentMapId || undefined, eventId, pageIndex: activePage }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="event-editor-footer">
          <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="db-btn" onClick={handleApply}>{t('common.apply', '적용')}</button>
        </div>
      </div>
    </div>
  );
}
