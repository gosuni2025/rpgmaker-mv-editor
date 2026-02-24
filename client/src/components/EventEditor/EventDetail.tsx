import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import useEscClose from '../../hooks/useEscClose';
import type { RPGEvent, EventPage } from '../../types/rpgMakerMV';
import EventCommandEditor from './EventCommandEditor';
import ImagePicker from '../common/ImagePicker';
import MoveRouteDialog from './MoveRouteDialog';
import type { WaypointSession, WaypointPos } from '../../utils/astar';
import { findNearestReachableTile } from '../../utils/astar';
import { emitWaypointSessionChange, pushWaypointHistory } from '../MapEditor/useWaypointMode';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import ExtBadge from '../common/ExtBadge';
import HelpButton from '../common/HelpButton';
import { useEventEditor } from './useEventEditor';
import './EventEditor.css';

interface EventDetailProps {
  eventId?: number;
  pendingEvent?: RPGEvent;
  onClose: () => void;
}

export default function EventDetail({ eventId, pendingEvent, onClose }: EventDetailProps) {
  const { t } = useTranslation();
  useEscClose(onClose);
  const currentMap = useEditorStore(s => s.currentMap);
  const currentMapId = useEditorStore(s => s.currentMapId);
  const isNew = pendingEvent != null;
  const event = isNew
    ? pendingEvent
    : (currentMap?.events?.find(e => e && e.id === eventId) as RPGEvent | undefined);

  const resolvedEventId = event?.id ?? eventId ?? 0;
  const initNpcId = isNew ? 0 : (eventId ?? 0);
  const [npcName, setNpcName] = useState<string>(() => currentMap?.npcData?.[initNpcId]?.name ?? '');
  const [showNpcName, setShowNpcName] = useState<boolean>(() => currentMap?.npcData?.[initNpcId]?.showName ?? false);
  const [showMoveRoute, setShowMoveRoute] = useState(false);

  const {
    editEvent, page, activePage, setActivePage,
    updateEvent, updatePage, updateConditions, updateImage,
    addPage, copyPage, deletePage, clearPage,
    handleOk, handleApply,
  } = useEventEditor(event!, isNew, resolvedEventId, npcName, showNpcName, onClose);

  const MOVE_TYPES = useMemo(() => [0, 1, 2, 3].map(i => t(`eventDetail.moveTypes.${i}`)), [t]);
  const MOVE_SPEEDS = useMemo(() => [0, 1, 2, 3, 4, 5].map(i => t(`eventDetail.moveSpeeds.${i}`)), [t]);
  const MOVE_FREQS = useMemo(() => [0, 1, 2, 3, 4].map(i => t(`eventDetail.moveFreqs.${i}`)), [t]);
  const PRIORITY_TYPES = useMemo(() => [0, 1, 2].map(i => t(`eventDetail.priorityTypes.${i}`)), [t]);
  const TRIGGER_TYPES = useMemo(() => [0, 1, 2, 3, 4].map(i => t(`eventDetail.triggerTypes.${i}`)), [t]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogPos, setDialogPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = dialogRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setDialogPos({ x: dragRef.current.origX + ev.clientX - dragRef.current.startX, y: dragRef.current.origY + ev.clientY - dragRef.current.startY });
    };
    const handleMouseUp = () => { dragRef.current = null; document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (!editEvent) {
    return (
      <div className="db-dialog-overlay">
        <div className="db-dialog" style={{ width: '70vw', height: '75vh' }}>
          <div className="db-dialog-header">Event #{eventId}</div>
          <div className="db-dialog-body"><div className="db-placeholder">{t('eventDetail.eventNotFound')}</div></div>
          <div className="db-dialog-footer"><button className="db-btn" onClick={onClose}>{t('common.close')}</button></div>
        </div>
      </div>
    );
  }

  const dialogStyle: React.CSSProperties = dialogPos ? { position: 'fixed', left: dialogPos.x, top: dialogPos.y, margin: 0 } : {};

  return (
    <div className="db-dialog-overlay" style={dialogPos ? { alignItems: 'flex-start', justifyContent: 'flex-start' } : undefined}>
      <div className="event-editor-dialog" ref={dialogRef} style={dialogStyle}>
        <div className="event-editor-titlebar" onMouseDown={handleTitleMouseDown} style={{ cursor: 'move' }}>
          ID:{String(editEvent.id).padStart(3, '0')} - {t('eventDetail.title', '이벤트 에디터')}
        </div>

        <div className="event-editor-namebar">
          <label className="event-editor-name-label">
            {t('common.name')}:
            <input type="text" value={editEvent.name || ''} onChange={e => updateEvent({ name: e.target.value })} className="event-editor-input" style={{ width: 140 }} />
          </label>
          <label className="event-editor-name-label">
            {t('common.note')}:
            <input type="text" value={editEvent.note || ''} onChange={e => updateEvent({ note: e.target.value })} className="event-editor-input" style={{ flex: 1, minWidth: 120 }} />
          </label>
          <label className="event-editor-name-label event-editor-npc-name-label">
            {t('eventDetail.npcName')}:
            <input type="text" value={npcName} onChange={e => setNpcName(e.target.value)} className="event-editor-input" style={{ width: 120 }} placeholder={t('eventDetail.npcNamePlaceholder')} />
            <label className="event-editor-npc-show-check">
              <input type="checkbox" checked={showNpcName} onChange={e => {
                setShowNpcName(e.target.checked);
                if (e.target.checked && !npcName.trim()) {
                  setNpcName(editEvent.name || '');
                }
              }} />
              {t('eventDetail.showNpcName')}
              <ExtBadge inline />
            </label>
          </label>
        </div>

        <div className="event-editor-pagebar">
          <div className="event-editor-pagetabs">
            {editEvent.pages.map((_: EventPage, i: number) => (
              <button key={i} className={`event-page-tab${i === activePage ? ' active' : ''}`} onClick={() => setActivePage(i)}>
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

        {page && (
          <div className="event-editor-body">
            <div className="event-editor-left">
              <fieldset className="event-editor-fieldset">
                <legend>{t('fields.conditions')}</legend>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label"><input type="checkbox" checked={page.conditions.switch1Valid} onChange={e => updateConditions({ switch1Valid: e.target.checked })} />{t('eventDetail.conditionSwitch1')}</label>
                  <VariableSwitchPicker type="switch" value={page.conditions.switch1Id} onChange={id => updateConditions({ switch1Id: id })} disabled={!page.conditions.switch1Valid} style={{ flex: 1 }} />
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label"><input type="checkbox" checked={page.conditions.switch2Valid} onChange={e => updateConditions({ switch2Valid: e.target.checked })} />{t('eventDetail.conditionSwitch2')}</label>
                  <VariableSwitchPicker type="switch" value={page.conditions.switch2Id} onChange={id => updateConditions({ switch2Id: id })} disabled={!page.conditions.switch2Valid} style={{ flex: 1 }} />
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label"><input type="checkbox" checked={page.conditions.variableValid} onChange={e => updateConditions({ variableValid: e.target.checked })} />{t('eventDetail.conditionVariable')}</label>
                  <VariableSwitchPicker type="variable" value={page.conditions.variableId} onChange={id => updateConditions({ variableId: id })} disabled={!page.conditions.variableValid} style={{ flex: 1 }} />
                  <span className="event-editor-cond-op">&ge;</span>
                  <input type="number" value={page.conditions.variableValue} onChange={e => updateConditions({ variableValue: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!page.conditions.variableValid} />
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label"><input type="checkbox" checked={page.conditions.selfSwitchValid} onChange={e => updateConditions({ selfSwitchValid: e.target.checked })} />{t('eventDetail.conditionSelfSwitch')}</label>
                  <select value={page.conditions.selfSwitchCh} onChange={e => updateConditions({ selfSwitchCh: e.target.value })} className="event-editor-select" disabled={!page.conditions.selfSwitchValid}>
                    {['A', 'B', 'C', 'D'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label"><input type="checkbox" checked={page.conditions.itemValid} onChange={e => updateConditions({ itemValid: e.target.checked })} />{t('eventDetail.conditionItem')}</label>
                  <input type="number" value={page.conditions.itemId} onChange={e => updateConditions({ itemId: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!page.conditions.itemValid} />
                </div>
                <div className="event-editor-condition-row">
                  <label className="event-editor-cond-label"><input type="checkbox" checked={page.conditions.actorValid} onChange={e => updateConditions({ actorValid: e.target.checked })} />{t('eventDetail.conditionActor')}</label>
                  <input type="number" value={page.conditions.actorId} onChange={e => updateConditions({ actorId: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!page.conditions.actorValid} />
                </div>
              </fieldset>

              <div className="event-editor-hrow">
                <fieldset className="event-editor-fieldset event-editor-fieldset-half">
                  <legend>{t('eventDetail.image')}</legend>
                  <ImagePicker type="characters" value={page.image.characterName || ''} onChange={name => updateImage({ characterName: name })}
                    index={page.image.characterIndex} onIndexChange={idx => updateImage({ characterIndex: idx })}
                    direction={page.image.direction} onDirectionChange={dir => updateImage({ direction: dir })}
                    pattern={page.image.pattern} onPatternChange={pat => updateImage({ pattern: pat })} />
                  <label className="event-editor-checkbox event-editor-billboard-row">
                    <input type="checkbox" checked={page.billboard !== false} onChange={e => updatePage(activePage, { billboard: e.target.checked })} />
                    {t('eventDetail.billboard3d')}
                    <HelpButton text={t('eventDetail.billboard3dTooltip')} />
                  </label>
                  {page.billboard !== false && (
                    <div className="event-editor-billboard-z-row">
                      <span className="event-editor-form-label">{t('eventDetail.billboardZ')}</span>
                      <input type="number" value={page.billboardZ ?? 0} step={0.1} onChange={e => updatePage(activePage, { billboardZ: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" style={{ width: 60 }} />
                      <span className="event-editor-billboard-z-unit">{t('eventDetail.billboardZUnit')}</span>
                      <HelpButton text={t('eventDetail.billboardZTooltip')} />
                    </div>
                  )}
                </fieldset>
                <fieldset className="event-editor-fieldset event-editor-fieldset-half">
                  <legend>{t('eventDetail.autonomousMovement')}</legend>
                  <div className="event-editor-form-row">
                    <span className="event-editor-form-label">{t('eventDetail.type')}:</span>
                    <select value={page.moveType} onChange={e => updatePage(activePage, { moveType: Number(e.target.value) })} className="event-editor-select">
                      {MOVE_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                    </select>
                  </div>
                  {page.moveType === 3 && (
                    <div className="event-editor-form-row">
                      <span className="event-editor-form-label"></span>
                      <button className="db-btn" onClick={() => setShowMoveRoute(true)}>{t('eventDetail.route')}</button>
                    </div>
                  )}
                  <div className="event-editor-form-row">
                    <span className="event-editor-form-label">{t('fields.speed')}:</span>
                    <select value={page.moveSpeed - 1} onChange={e => updatePage(activePage, { moveSpeed: Number(e.target.value) + 1 })} className="event-editor-select">
                      {MOVE_SPEEDS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                    </select>
                  </div>
                  <div className="event-editor-form-row">
                    <span className="event-editor-form-label">{t('eventDetail.frequency')}:</span>
                    <select value={page.moveFrequency - 1} onChange={e => updatePage(activePage, { moveFrequency: Number(e.target.value) + 1 })} className="event-editor-select">
                      {MOVE_FREQS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                    </select>
                  </div>
                </fieldset>
              </div>

              <div className="event-editor-hrow">
                <fieldset className="event-editor-fieldset event-editor-fieldset-half">
                  <legend>{t('eventDetail.options')}</legend>
                  <label className="event-editor-checkbox"><input type="checkbox" checked={page.walkAnime} onChange={e => updatePage(activePage, { walkAnime: e.target.checked })} />{t('eventDetail.walkingAnimation')}</label>
                  <label className="event-editor-checkbox"><input type="checkbox" checked={page.stepAnime} onChange={e => updatePage(activePage, { stepAnime: e.target.checked })} />{t('eventDetail.steppingAnimation')}</label>
                  <label className="event-editor-checkbox"><input type="checkbox" checked={page.directionFix} onChange={e => updatePage(activePage, { directionFix: e.target.checked })} />{t('eventDetail.directionFix')}</label>
                  <label className="event-editor-checkbox"><input type="checkbox" checked={page.through} onChange={e => updatePage(activePage, { through: e.target.checked })} />{t('eventDetail.through')}</label>
                </fieldset>
                <fieldset className="event-editor-fieldset event-editor-fieldset-half">
                  <legend>{t('eventDetail.priority', '우선권')}</legend>
                  <select value={page.priorityType} onChange={e => updatePage(activePage, { priorityType: Number(e.target.value) })} className="event-editor-select" style={{ width: '100%' }}>
                    {PRIORITY_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                  </select>
                </fieldset>
              </div>

              <fieldset className="event-editor-fieldset">
                <legend>{t('eventDetail.trigger', '발동')}</legend>
                <select value={page.trigger} onChange={e => updatePage(activePage, { trigger: Number(e.target.value) })} className="event-editor-select" style={{ width: '100%' }}>
                  {TRIGGER_TYPES.map((label, i) => <option key={i} value={i}>{label}</option>)}
                </select>
              </fieldset>
            </div>

            <div className="event-editor-right">
              <div className="event-editor-right-header">{t('eventCommands.title', '실행 내용')}</div>
              <EventCommandEditor commands={page.list || []} onChange={newList => updatePage(activePage, { list: newList })}
                context={{ mapId: currentMapId || undefined, eventId: resolvedEventId, pageIndex: activePage }} />
            </div>
          </div>
        )}

        <div className="event-editor-footer">
          <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="db-btn" onClick={handleApply} disabled={isNew}>{t('common.apply', '적용')}</button>
        </div>

        {showMoveRoute && page && event && (
          <MoveRouteDialog moveRoute={page.moveRoute}
            onOk={route => { updatePage(activePage, { moveRoute: route }); setShowMoveRoute(false); }}
            onCancel={() => setShowMoveRoute(false)}
            onWaypointMode={(charId) => {
              // 이벤트 주변 가장 가까운 빈 공간을 초기 목적지로 자동 설정
              const mapState = useEditorStore.getState();
              const mapData = mapState.currentMap;
              const tf = mapState.tilesetInfo;
              const initialWaypoints: WaypointPos[] = [];
              if (mapData && tf) {
                const nearby = findNearestReachableTile(
                  event.x, event.y,
                  mapData.data, mapData.width, mapData.height, tf.flags,
                );
                if (nearby) {
                  initialWaypoints.push({ id: crypto.randomUUID(), x: nearby.x, y: nearby.y });
                }
              }
              const session: WaypointSession = {
                eventId: event.id,
                routeKey: `auto_p${activePage}`,
                type: 'autonomous',
                pageIndex: activePage,
                characterId: charId,
                startX: event.x,
                startY: event.y,
                waypoints: initialWaypoints,
                allowDiagonal: false,
                avoidEvents: false,
                ignorePassability: false,
                onConfirm: (commands) => {
                  const route = {
                    list: [...commands, { code: 0 }],
                    repeat: page.moveRoute?.repeat ?? false,
                    skippable: page.moveRoute?.skippable ?? false,
                    wait: page.moveRoute?.wait ?? true,
                  };
                  updatePage(activePage, { moveRoute: route });
                },
              };
              (window as any)._editorWaypointSession = session;
              pushWaypointHistory(session); // 초기 상태 스냅샷 (undo로 빈 상태로 복원 가능)
              emitWaypointSessionChange();
              setShowMoveRoute(false);
              // 이벤트 에디터 저장 후 닫기
              handleOk();
            }}
          />
        )}
      </div>
    </div>
  );
}
