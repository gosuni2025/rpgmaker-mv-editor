import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import useEscClose from '../../hooks/useEscClose';
import type { RPGEvent, EventPage, MinimapMarkerData } from '../../types/rpgMakerMV';
import EventCommandEditor from './EventCommandEditor';
import ImagePicker from '../common/ImagePicker';
import MoveRouteDialog from './MoveRouteDialog';
import ExtBadge from '../common/ExtBadge';
import HelpButton from '../common/HelpButton';
import { useEventEditor } from './useEventEditor';
import { useDialogDrag } from './useDialogDrag';
import EventMinimapMarkerPanel from './EventMinimapMarkerPanel';
import EventConditionsPanel from './EventConditionsPanel';
import { useWaypointSession } from './useWaypointSession';
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
  const projectPath = useEditorStore(s => s.projectPath);
  const isNew = pendingEvent != null;
  const event = isNew
    ? pendingEvent
    : (currentMap?.events?.find(e => e && e.id === eventId) as RPGEvent | undefined);

  const resolvedEventId = event?.id ?? eventId ?? 0;
  const initNpcId = isNew ? 0 : (eventId ?? 0);
  const [npcName, setNpcName] = useState<string>(() => currentMap?.npcData?.[initNpcId]?.name ?? '');
  const [showNpcName, setShowNpcName] = useState<boolean>(() => currentMap?.npcData?.[initNpcId]?.showName ?? false);
  const [minimapMarker, setMinimapMarker] = useState<MinimapMarkerData | null>(() => currentMap?.minimapData?.[initNpcId] ?? null);
  const [showMoveRoute, setShowMoveRoute] = useState(false);

  const {
    editEvent, page, activePage, setActivePage,
    updateEvent, updatePage, updateConditions, updateImage,
    addPage, copyPage, deletePage, clearPage,
    handleOk, handleApply,
    isExternal, setIsExternal,
  } = useEventEditor(event!, isNew, resolvedEventId, npcName, showNpcName, minimapMarker, onClose);

  const handleOpenInVSCode = useCallback(() => {
    if (!editEvent.__ref || !projectPath) return;
    const filePath = `${projectPath}/data/${editEvent.__ref}`;
    fetch('/api/project/open-vscode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
  }, [editEvent.__ref, projectPath]);

  const MOVE_TYPES = useMemo(() => [0, 1, 2, 3].map(i => t(`eventDetail.moveTypes.${i}`)), [t]);
  const MOVE_SPEEDS = useMemo(() => [0, 1, 2, 3, 4, 5].map(i => t(`eventDetail.moveSpeeds.${i}`)), [t]);
  const MOVE_FREQS = useMemo(() => [0, 1, 2, 3, 4].map(i => t(`eventDetail.moveFreqs.${i}`)), [t]);
  const PRIORITY_TYPES = useMemo(() => [0, 1, 2].map(i => t(`eventDetail.priorityTypes.${i}`)), [t]);
  const TRIGGER_TYPES = useMemo(() => [0, 1, 2, 3, 4].map(i => t(`eventDetail.triggerTypes.${i}`)), [t]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogPos, handleTitleMouseDown } = useDialogDrag(dialogRef);

  const { handleWaypointMode } = useWaypointSession({
    event: event!,
    activePage,
    resolvedEventId,
    page,
    updatePage,
    setShowMoveRoute,
    handleOk,
  });

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
          <EventMinimapMarkerPanel minimapMarker={minimapMarker} setMinimapMarker={setMinimapMarker} />
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
              <EventConditionsPanel conditions={page.conditions} updateConditions={updateConditions} />

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
                  <div className="event-editor-trigger-radios">
                    {PRIORITY_TYPES.map((label, i) => (
                      <label key={i} className="event-editor-radio-label">
                        <input
                          type="radio"
                          name={`priorityType-${activePage}`}
                          value={i}
                          checked={page.priorityType === i}
                          onChange={() => updatePage(activePage, { priorityType: i })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <fieldset className="event-editor-fieldset">
                <legend>{t('eventDetail.trigger', '발동')}</legend>
                <div className="event-editor-trigger-radios">
                  {TRIGGER_TYPES.map((label, i) => (
                    <label key={i} className="event-editor-radio-label">
                      <input
                        type="radio"
                        name={`trigger-${activePage}`}
                        value={i}
                        checked={page.trigger === i}
                        onChange={() => updatePage(activePage, { trigger: i })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="event-editor-right">
              <div className="event-editor-right-header">
                <span>{t('eventCommands.title', '실행 내용')}</span>
                <div className="event-editor-extfile-controls" onMouseDown={e => e.stopPropagation()}>
                  <label className="event-editor-external-check">
                    <input type="checkbox" checked={isExternal} onChange={e => setIsExternal(e.target.checked)} />
                    <span className={`event-editor-storage-badge ${isExternal ? 'external' : 'inline'}`}>
                      {isExternal ? '📄 외부 파일' : '📦 내장'}
                    </span>
                    <ExtBadge inline />
                  </label>
                  {isExternal && editEvent.__ref && (
                    <button className="event-editor-vscode-btn" onClick={handleOpenInVSCode} title={`VSCode로 열기: data/${editEvent.__ref}`}>
                      VSCode로 열기
                    </button>
                  )}
                  <HelpButton>
                    <strong>외부 파일 분리란?</strong><br /><br />
                    이벤트의 실행 내용(pages)을 맵 JSON 내부가 아닌 별도 파일로 저장하는 기능입니다.<br /><br />
                    <strong>저장 위치:</strong> <code>data/MapXXX/NNN-이름.json</code><br /><br />
                    <strong>MV 기본 에디터:</strong> 이벤트 위치/이름은 그대로 보이지만, 실행 내용은 비어 있습니다.<br /><br />
                    <strong>장점:</strong><br />
                    · Git으로 이벤트를 개별 파일 단위로 추적 가능<br />
                    · VSCode 등 외부 에디터에서 직접 편집 가능<br />
                    · 대규모 맵에서 이벤트 파일을 독립 관리 가능
                  </HelpButton>
                </div>
              </div>
              <EventCommandEditor commands={page.list || []} onChange={newList => updatePage(activePage, { list: newList })}
                context={{ mapId: currentMapId || undefined, eventId: resolvedEventId, pageIndex: activePage }}
                onWaypointModeStart={handleOk} />
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
            onWaypointMode={handleWaypointMode}
          />
        )}
      </div>
    </div>
  );
}
