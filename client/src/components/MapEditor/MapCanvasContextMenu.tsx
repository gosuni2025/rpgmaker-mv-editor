import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import QuickEventDialog from './QuickEventDialog';

interface MapCanvasContextMenuProps {
  eventCtxMenu: { x: number; y: number; tileX: number; tileY: number; eventId: number | null };
  closeEventCtxMenu: () => void;
  setEditingEventId: (id: number | null) => void;
  createNewEvent: (tileX: number, tileY: number) => void;
}

/** 컨텍스트 메뉴가 화면 밖으로 벗어나지 않도록 위치를 보정하는 ref callback */
function clampMenuRef(el: HTMLDivElement | null) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (rect.bottom > vh) {
    el.style.top = `${Math.max(0, vh - rect.height - 4)}px`;
  }
  if (rect.right > vw) {
    el.style.left = `${Math.max(0, vw - rect.width - 4)}px`;
  }
}

export default function MapCanvasContextMenu({
  eventCtxMenu,
  closeEventCtxMenu,
  setEditingEventId,
  createNewEvent,
}: MapCanvasContextMenuProps) {
  const { t } = useTranslation();

  const [quickEventType, setQuickEventType] = useState<'transfer' | 'door' | 'treasure' | 'inn' | null>(null);
  const [quickEventPos, setQuickEventPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const clipboard = useEditorStore((s) => s.clipboard);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const cutEvent = useEditorStore((s) => s.cutEvent);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const copyEvents = useEditorStore((s) => s.copyEvents);
  const deleteEvents = useEditorStore((s) => s.deleteEvents);
  const pasteEvents = useEditorStore((s) => s.pasteEvents);
  const setShowFindDialog = useEditorStore((s) => s.setShowFindDialog);
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);
  const setVehicleStartPosition = useEditorStore((s) => s.setVehicleStartPosition);
  const setTestStartPosition = useEditorStore((s) => s.setTestStartPosition);
  const clearTestStartPosition = useEditorStore((s) => s.clearTestStartPosition);
  const clearVehicleStartPosition = useEditorStore((s) => s.clearVehicleStartPosition);
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const currentMap = useEditorStore((s) => s.currentMap);

  const hasEvent = eventCtxMenu.eventId != null;
  const isMulti = hasEvent && selectedEventIds.length > 1 && selectedEventIds.includes(eventCtxMenu.eventId as number);
  const hasPaste = clipboard?.type === 'event' || clipboard?.type === 'events';

  return (
    <>
      <div ref={clampMenuRef} className="context-menu" style={{ left: eventCtxMenu.x, top: eventCtxMenu.y }} onClick={e => e.stopPropagation()}>
        {hasEvent ? (
          <div className="context-menu-item" onClick={() => { setEditingEventId(eventCtxMenu.eventId as number); closeEventCtxMenu(); }}>
            {t('eventCtx.edit')}
            <span className="context-menu-shortcut">Enter</span>
          </div>
        ) : (
          <div className="context-menu-item" onClick={() => { createNewEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
            {t('eventCtx.new')}
            <span className="context-menu-shortcut">Enter</span>
          </div>
        )}
        <div className="context-menu-separator" />

        {isMulti ? (
          <>
            <div className="context-menu-item" onClick={() => { for (const id of selectedEventIds) cutEvent(id); closeEventCtxMenu(); }}>
              {t('eventCtx.cut')} ({t('eventCtx.items', { count: selectedEventIds.length })})
              <span className="context-menu-shortcut">⌘X</span>
            </div>
            <div className="context-menu-item" onClick={() => { copyEvents(selectedEventIds); closeEventCtxMenu(); }}>
              {t('eventCtx.copy')} ({t('eventCtx.items', { count: selectedEventIds.length })})
              <span className="context-menu-shortcut">⌘C</span>
            </div>
          </>
        ) : (
          <>
            <div className={`context-menu-item${hasEvent ? '' : ' disabled'}`} onClick={() => { if (hasEvent) { cutEvent(eventCtxMenu.eventId as number); closeEventCtxMenu(); } }}>
              {t('eventCtx.cut')}
              <span className="context-menu-shortcut">⌘X</span>
            </div>
            <div className={`context-menu-item${hasEvent ? '' : ' disabled'}`} onClick={() => { if (hasEvent) { copyEvent(eventCtxMenu.eventId as number); closeEventCtxMenu(); } }}>
              {t('eventCtx.copy')}
              <span className="context-menu-shortcut">⌘C</span>
            </div>
          </>
        )}
        <div className={`context-menu-item${hasPaste ? '' : ' disabled'}`} onClick={() => { if (hasPaste) { pasteEvents(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); } }}>
          {t('eventCtx.paste')}
          <span className="context-menu-shortcut">⌘V</span>
        </div>
        {isMulti ? (
          <div className="context-menu-item" onClick={() => { deleteEvents(selectedEventIds); closeEventCtxMenu(); }}>
            {t('eventCtx.delete')} ({t('eventCtx.items', { count: selectedEventIds.length })})
            <span className="context-menu-shortcut">⌫</span>
          </div>
        ) : (
          <div className={`context-menu-item${hasEvent ? '' : ' disabled'}`} onClick={() => { if (hasEvent) { deleteEvent(eventCtxMenu.eventId as number); closeEventCtxMenu(); } }}>
            {t('eventCtx.delete')}
            <span className="context-menu-shortcut">⌫</span>
          </div>
        )}
        <div className="context-menu-separator" />

        <div className="context-menu-item" onClick={() => { closeEventCtxMenu(); setShowFindDialog(true); }}>
          {t('eventCtx.find')}
          <span className="context-menu-shortcut">⌘F</span>
        </div>
        <div className="context-menu-item" onClick={() => { closeEventCtxMenu(); setShowFindDialog(true); }}>
          {t('eventCtx.findNext')}
          <span className="context-menu-shortcut">⌘G</span>
        </div>
        <div className="context-menu-item" onClick={() => { closeEventCtxMenu(); setShowFindDialog(true); }}>
          {t('eventCtx.findPrev')}
          <span className="context-menu-shortcut">⌥⌘G</span>
        </div>
        <div className="context-menu-separator" />

        <div className="context-menu-item has-submenu">
          {t('eventCtx.quickEvent')}
          <div className="context-submenu">
            <div className="context-menu-item" onClick={() => { setQuickEventPos({ x: eventCtxMenu.tileX, y: eventCtxMenu.tileY }); setQuickEventType('transfer'); closeEventCtxMenu(); }}>
              {t('eventCtx.quickTransfer')}
              <span className="context-menu-shortcut">⌘1</span>
            </div>
            <div className="context-menu-item" onClick={() => { setQuickEventPos({ x: eventCtxMenu.tileX, y: eventCtxMenu.tileY }); setQuickEventType('door'); closeEventCtxMenu(); }}>
              {t('eventCtx.quickDoor')}
              <span className="context-menu-shortcut">⌘2</span>
            </div>
            <div className="context-menu-item" onClick={() => { setQuickEventPos({ x: eventCtxMenu.tileX, y: eventCtxMenu.tileY }); setQuickEventType('treasure'); closeEventCtxMenu(); }}>
              {t('eventCtx.quickTreasure')}
              <span className="context-menu-shortcut">⌘3</span>
            </div>
            <div className="context-menu-item" onClick={() => { setQuickEventPos({ x: eventCtxMenu.tileX, y: eventCtxMenu.tileY }); setQuickEventType('inn'); closeEventCtxMenu(); }}>
              {t('eventCtx.quickInn')}
              <span className="context-menu-shortcut">⌘4</span>
            </div>
          </div>
        </div>

        <div className="context-menu-item has-submenu">
          {t('eventCtx.startPosition')}
          <div className="context-submenu">
            <div className="context-menu-item" onClick={() => { if (currentMapId) setPlayerStartPosition(currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
              {t('eventCtx.player')}
            </div>
            <div className="context-menu-item" onClick={() => { if (currentMapId) setVehicleStartPosition('boat', currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
              {t('eventCtx.boat')}
            </div>
            <div className="context-menu-item" onClick={() => { if (currentMapId) setVehicleStartPosition('ship', currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
              {t('eventCtx.ship')}
            </div>
            <div className="context-menu-item" onClick={() => { if (currentMapId) setVehicleStartPosition('airship', currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
              {t('eventCtx.airship')}
            </div>
          </div>
        </div>

        <div className="context-menu-item" onClick={() => { setTestStartPosition(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
          {t('eventCtx.testStartPosition')}
          <span className="context-menu-ext-badge">EXT</span>
        </div>
        {currentMap?.testStartPosition && (
          <div className="context-menu-item" onClick={() => { clearTestStartPosition(); closeEventCtxMenu(); }}>
            {t('eventCtx.clearTestStartPosition')}
            <span className="context-menu-ext-badge">EXT</span>
          </div>
        )}

        {systemData && (systemData.boat?.startMapId === currentMapId || systemData.ship?.startMapId === currentMapId || systemData.airship?.startMapId === currentMapId) && (
          <div className="context-menu-item has-submenu">
            {t('eventCtx.clearStartPosition')}
            <div className="context-submenu">
              {systemData.boat?.startMapId === currentMapId && (
                <div className="context-menu-item" onClick={() => { clearVehicleStartPosition('boat'); closeEventCtxMenu(); }}>
                  {t('eventCtx.boat')}
                </div>
              )}
              {systemData.ship?.startMapId === currentMapId && (
                <div className="context-menu-item" onClick={() => { clearVehicleStartPosition('ship'); closeEventCtxMenu(); }}>
                  {t('eventCtx.ship')}
                </div>
              )}
              {systemData.airship?.startMapId === currentMapId && (
                <div className="context-menu-item" onClick={() => { clearVehicleStartPosition('airship'); closeEventCtxMenu(); }}>
                  {t('eventCtx.airship')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {quickEventType && (
        <QuickEventDialog
          type={quickEventType}
          tileX={quickEventPos.x}
          tileY={quickEventPos.y}
          onClose={() => setQuickEventType(null)}
        />
      )}
    </>
  );
}
