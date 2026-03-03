import type { MapInfo } from '../../types/rpgMakerMV';

export function isDescendant(maps: (MapInfo | null)[], nodeId: number, potentialAncestorId: number): boolean {
  let current = maps.find(m => m?.id === nodeId);
  while (current && current.parentId !== 0) {
    if (current.parentId === potentialAncestorId) return true;
    current = maps.find(m => m?.id === current!.parentId);
  }
  return false;
}

function recompactSiblings(maps: (MapInfo | null)[], parentId: number, excludeId: number) {
  const siblings = maps
    .filter(m => m && m.parentId === parentId && m.id !== excludeId)
    .sort((a, b) => a!.order - b!.order);
  siblings.forEach((m, idx) => { if (m) m.order = idx; });
}

export function applyDrop(
  maps: (MapInfo | null)[],
  draggingId: number,
  targetId: number,
  position: 'before' | 'after' | 'into'
): (MapInfo | null)[] {
  if (draggingId === targetId) return maps;

  const newMaps = maps.map(m => m ? { ...m } : null);
  const dragging = newMaps.find(m => m?.id === draggingId);
  const target = newMaps.find(m => m?.id === targetId);
  if (!dragging || !target) return maps;

  const newParentId = position === 'into' ? targetId : target.parentId;
  if (isDescendant(newMaps, newParentId, draggingId) || newParentId === draggingId) return maps;

  const oldParentId = dragging.parentId;

  if (position === 'into') {
    const existingChildren = newMaps.filter(m => m && m.parentId === targetId && m.id !== draggingId);
    const maxOrder = existingChildren.length > 0 ? Math.max(...existingChildren.map(m => m!.order)) : -1;
    dragging.parentId = targetId;
    dragging.order = maxOrder + 1;
    recompactSiblings(newMaps, oldParentId, draggingId);
  } else {
    const newSiblings = newMaps
      .filter(m => m && m.parentId === newParentId && m.id !== draggingId)
      .sort((a, b) => a!.order - b!.order);

    const targetIdx = newSiblings.findIndex(m => m!.id === targetId);
    if (targetIdx === -1) return maps;

    dragging.parentId = newParentId;
    newSiblings.splice(position === 'before' ? targetIdx : targetIdx + 1, 0, dragging);
    newSiblings.forEach((m, idx) => { if (m) m.order = idx; });

    if (oldParentId !== newParentId) {
      recompactSiblings(newMaps, oldParentId, draggingId);
    }
  }

  return newMaps;
}

export function applyMultiDrop(
  maps: (MapInfo | null)[],
  draggingIds: number[],
  targetId: number,
  position: 'before' | 'after' | 'into',
  flatOrder: number[]
): (MapInfo | null)[] {
  const validIds = draggingIds.filter(id => {
    if (id === targetId) return false;
    if (isDescendant(maps, targetId, id)) return false;
    return true;
  });
  if (validIds.length === 0) return maps;
  if (validIds.length === 1) return applyDrop(maps, validIds[0], targetId, position);

  const sorted = [...validIds].sort((a, b) => flatOrder.indexOf(a) - flatOrder.indexOf(b));

  let current = maps;
  if (position === 'before') {
    for (const id of sorted) current = applyDrop(current, id, targetId, 'before');
  } else if (position === 'after') {
    for (const id of [...sorted].reverse()) current = applyDrop(current, id, targetId, 'after');
  } else {
    for (const id of sorted) current = applyDrop(current, id, targetId, 'into');
  }

  return current;
}
