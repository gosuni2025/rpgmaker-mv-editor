import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent } from '../../types/rpgMakerMV';
import FuzzySearchInput from '../common/FuzzySearchInput';
import { fuzzyMatch, fuzzyScore } from '../../utils/fuzzySearch';
import './EventEditor.css';

function scrollToEvent(x: number, y: number) {
  window.dispatchEvent(new CustomEvent('scroll-to-tile', { detail: { x, y } }));
}

interface ContextMenu {
  x: number;
  y: number;
  eventId: number | null;
}

export default function EventList() {
  const { t } = useTranslation();
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedEventId = useEditorStore((s) => s.selectedEventId);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);
  const setSelectedEventIds = useEditorStore((s) => s.setSelectedEventIds);
  const addEvent = useEditorStore((s) => s.addEvent);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const cutEvent = useEditorStore((s) => s.cutEvent);
  const pasteEvent = useEditorStore((s) => s.pasteEvent);
  const clipboard = useEditorStore((s) => s.clipboard);

  const [showDetail, setShowDetail] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const allEvents: RPGEvent[] = (currentMap?.events || []).filter(Boolean) as RPGEvent[];

  const events = useMemo(() => {
    if (!filterQuery) return allEvents;
    const q = filterQuery;
    return allEvents
      .filter((ev) => fuzzyMatch(`${String(ev.id).padStart(3, '0')} ${ev.name}`, q))
      .sort((a, b) => fuzzyScore(b.name, q) - fuzzyScore(a.name, q));
  }, [allEvents, filterQuery]);

  // 맵에서 이벤트 선택 시 목록에서 해당 항목으로 자동 스크롤
  useEffect(() => {
    if (selectedEventId == null || !listRef.current) return;
    const item = listRef.current.querySelector(`[data-event-id="${selectedEventId}"]`);
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedEventId]);

  const handleDoubleClick = (eventId: number) => {
    setSelectedEventId(eventId);
    setShowDetail(true);
  };

  const handleContextMenu = (e: React.MouseEvent, eventId: number | null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, eventId });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleNewEvent = useCallback(() => {
    addEvent(0, 0);
    closeContextMenu();
  }, [addEvent]);

  const handleDeleteEvent = () => {
    if (contextMenu?.eventId != null) {
      deleteEvent(contextMenu.eventId);
    }
    closeContextMenu();
  };

  const handleCopyEvent = () => {
    if (contextMenu?.eventId != null) {
      copyEvent(contextMenu.eventId);
    }
    closeContextMenu();
  };

  const handleCutEvent = () => {
    if (contextMenu?.eventId != null) {
      cutEvent(contextMenu.eventId);
    }
    closeContextMenu();
  };

  const handlePasteEvent = () => {
    pasteEvent(0, 0);
    closeContextMenu();
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} onClick={closeContextMenu}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #555', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 'bold', fontSize: 12, color: '#bbb' }}>{t('eventList.title')}</span>
        <button className="db-btn-small" onClick={handleNewEvent}>{t('eventList.newEvent')}</button>
      </div>
      <FuzzySearchInput value={filterQuery} onChange={setFilterQuery} placeholder="이벤트 검색..." />

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }} onContextMenu={(e) => handleContextMenu(e, null)}>
        {events.length === 0 && (
          <div style={{ padding: 16, color: '#666', fontSize: 12, textAlign: 'center' }}>
            {t('eventList.noEvents')}
          </div>
        )}
        {events.map((ev) => (
          <div
            key={ev.id}
            data-event-id={ev.id}
            className={`db-list-item${ev.id === selectedEventId ? ' selected' : ''}`}
            onClick={() => { setSelectedEventId(ev.id); setSelectedEventIds([ev.id]); scrollToEvent(ev.x, ev.y); }}
            onDoubleClick={() => handleDoubleClick(ev.id)}
            onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, ev.id); }}
            style={{ padding: '4px 8px', display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <span style={{ color: '#888', fontSize: 11, minWidth: 36 }}>#{String(ev.id).padStart(3, '0')}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</span>
            <span style={{ color: '#666', fontSize: 11 }}>({ev.x}, {ev.y})</span>
          </div>
        ))}
      </div>

      {/* Event preview */}
      {selectedEvent && (
        <div style={{ borderTop: '1px solid #555', padding: 8, fontSize: 12, color: '#aaa', background: '#333' }}>
          <div><strong>{selectedEvent.name}</strong> (ID: {selectedEvent.id})</div>
          <div>{t('eventList.position')}: ({selectedEvent.x}, {selectedEvent.y})</div>
          <div>{t('eventList.pages')}: {selectedEvent.pages?.length || 0}</div>
          {selectedEvent.note && <div style={{ color: '#888', marginTop: 4 }}>{t('common.note')}: {selectedEvent.note.substring(0, 50)}</div>}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#3c3f41',
            border: '1px solid #555',
            borderRadius: 3,
            minWidth: 140,
            zIndex: 3000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="menubar-dropdown-item" onClick={handleNewEvent}>{t('eventList.contextNew')}</div>
          {contextMenu.eventId != null && (
            <>
              <div className="menubar-dropdown-item" onClick={() => { setSelectedEventId(contextMenu.eventId!); setShowDetail(true); closeContextMenu(); }}>{t('eventList.contextEdit')}</div>
              <div className="menubar-dropdown-item" onClick={handleCopyEvent}>{t('eventList.contextCopy')}</div>
              <div className="menubar-dropdown-item" onClick={handleCutEvent}>{t('eventList.contextCut')}</div>
              <div className="menubar-separator" />
              <div className="menubar-dropdown-item" onClick={handleDeleteEvent}>{t('eventList.contextDelete')}</div>
            </>
          )}
          {clipboard?.type === 'event' && (
            <>
              <div className="menubar-separator" />
              <div className="menubar-dropdown-item" onClick={handlePasteEvent}>{t('eventList.contextPaste')}</div>
            </>
          )}
        </div>
      )}

      {/* EventDetail dialog - lazy import */}
      {showDetail && selectedEventId != null && (
        <EventDetailWrapper eventId={selectedEventId} onClose={() => setShowDetail(false)} />
      )}
    </div>
  );
}

function EventDetailWrapper({ eventId, onClose }: { eventId: number; onClose: () => void }) {
  const [EventDetail, setEventDetail] = useState<React.ComponentType<{ eventId: number; onClose: () => void }> | null>(null);

  React.useEffect(() => {
    import('./EventDetail').then((mod) => setEventDetail(() => mod.default));
  }, []);

  if (!EventDetail) return null;
  return <EventDetail eventId={eventId} onClose={onClose} />;
}
