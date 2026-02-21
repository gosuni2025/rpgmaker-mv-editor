import { useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent, EventPage, EventConditions, EventImage, MapData, NpcDisplayData } from '../../types/rpgMakerMV';

function getDefaultPage(): EventPage {
  return {
    conditions: {
      actorId: 1, actorValid: false, itemId: 1, itemValid: false,
      selfSwitchCh: 'A', selfSwitchValid: false,
      switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
      variableId: 1, variableValid: false, variableValue: 0,
    },
    directionFix: false,
    billboard: true,
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

export { getDefaultPage };

export function useEventEditor(
  initialEvent: RPGEvent,
  isNew: boolean,
  resolvedEventId: number,
  npcName: string,
  showNpcName: boolean,
  onClose: () => void,
) {
  const currentMap = useEditorStore(s => s.currentMap);
  const currentMapId = useEditorStore(s => s.currentMapId);
  const setSelectedEventId = useEditorStore(s => s.setSelectedEventId);

  const [editEvent, setEditEvent] = useState<RPGEvent>(() => JSON.parse(JSON.stringify(initialEvent)));
  const [activePage, setActivePage] = useState(0);

  const page = editEvent.pages?.[activePage];

  const updateEvent = useCallback((partial: Partial<RPGEvent>) => {
    setEditEvent(prev => ({ ...prev, ...partial }));
  }, []);

  const updatePage = useCallback((pageIndex: number, partial: Partial<EventPage>) => {
    setEditEvent(prev => {
      const pages = [...prev.pages];
      pages[pageIndex] = { ...pages[pageIndex], ...partial };
      return { ...prev, pages };
    });
  }, []);

  const updateConditions = useCallback((partial: Partial<EventConditions>) => {
    setEditEvent(prev => {
      const pg = prev.pages?.[activePage];
      if (!pg) return prev;
      const pages = [...prev.pages];
      pages[activePage] = { ...pg, conditions: { ...pg.conditions, ...partial } };
      return { ...prev, pages };
    });
  }, [activePage]);

  const updateImage = useCallback((partial: Partial<EventImage>) => {
    setEditEvent(prev => {
      const pg = prev.pages?.[activePage];
      if (!pg) return prev;
      const pages = [...prev.pages];
      pages[activePage] = { ...pg, image: { ...pg.image, ...partial } };
      return { ...prev, pages };
    });
  }, [activePage]);

  const addPage = useCallback(() => {
    const pages = [...editEvent.pages, getDefaultPage()];
    updateEvent({ pages });
    setActivePage(pages.length - 1);
  }, [editEvent.pages, updateEvent]);

  const copyPage = useCallback(() => {
    if (!page) return;
    const pages = [...editEvent.pages, JSON.parse(JSON.stringify(page))];
    updateEvent({ pages });
    setActivePage(pages.length - 1);
  }, [editEvent.pages, page, updateEvent]);

  const deletePage = useCallback(() => {
    if (editEvent.pages.length <= 1) return;
    const pages = editEvent.pages.filter((_: EventPage, i: number) => i !== activePage);
    updateEvent({ pages });
    setActivePage(Math.min(activePage, pages.length - 1));
  }, [editEvent.pages, activePage, updateEvent]);

  const clearPage = useCallback(() => {
    const pages = editEvent.pages.map((p: EventPage, i: number) => i === activePage ? getDefaultPage() : p);
    updateEvent({ pages });
  }, [editEvent.pages, activePage, updateEvent]);

  const buildNpcData = (map: MapData): Record<number, NpcDisplayData> | undefined => {
    const updated = { ...(map.npcData || {}) };
    if (npcName.trim() || showNpcName) {
      updated[resolvedEventId] = { name: npcName, showName: showNpcName };
    } else {
      delete updated[resolvedEventId];
    }
    return Object.keys(updated).length > 0 ? updated : undefined;
  };

  const handleOk = useCallback(() => {
    if (!currentMap || !currentMapId) return;
    const events = [...(currentMap.events || [])];
    if (isNew) {
      const oldEvents = [...events];
      while (events.length <= editEvent.id) events.push(null);
      events[editEvent.id] = editEvent;
      const state = useEditorStore.getState();
      const undoStack = [...state.undoStack, {
        mapId: currentMapId, type: 'event' as const,
        oldEvents, newEvents: events,
        oldSelectedEventId: state.selectedEventId,
        oldSelectedEventIds: state.selectedEventIds,
      }];
      if (undoStack.length > state.maxUndo) undoStack.shift();
      useEditorStore.setState({
        currentMap: { ...currentMap, events, npcData: buildNpcData(currentMap) } as MapData & { tilesetNames?: string[] },
        undoStack, redoStack: [],
      });
      setSelectedEventId(editEvent.id);
    } else {
      const idx = events.findIndex(e => e && e.id === resolvedEventId);
      if (idx >= 0) events[idx] = editEvent;
      useEditorStore.setState({ currentMap: { ...currentMap, events, npcData: buildNpcData(currentMap) } as MapData & { tilesetNames?: string[] } });
    }
    onClose();
  }, [currentMap, currentMapId, isNew, editEvent, resolvedEventId, npcName, showNpcName, onClose, setSelectedEventId]);

  const handleApply = useCallback(() => {
    if (!currentMap || isNew) return;
    const events = [...(currentMap.events || [])];
    const idx = events.findIndex(e => e && e.id === resolvedEventId);
    if (idx >= 0) events[idx] = JSON.parse(JSON.stringify(editEvent));
    useEditorStore.setState({ currentMap: { ...currentMap, events, npcData: buildNpcData(currentMap) } as MapData & { tilesetNames?: string[] } });
  }, [currentMap, isNew, editEvent, resolvedEventId, npcName, showNpcName]);

  return {
    editEvent, page, activePage, setActivePage,
    updateEvent, updatePage, updateConditions, updateImage,
    addPage, copyPage, deletePage, clearPage,
    handleOk, handleApply,
  };
}
