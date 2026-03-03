import type { MapInfo } from '../../types/rpgMakerMV';
import { fuzzyMatch } from '../../utils/fuzzySearch';

export interface TreeNodeData extends MapInfo {
  children: TreeNodeData[];
}

export function buildTree(maps: (MapInfo | null)[]): TreeNodeData[] {
  if (!maps || maps.length === 0) return [];

  const byId: Record<number, TreeNodeData> = {};
  const roots: TreeNodeData[] = [];

  maps.forEach((m) => {
    if (!m) return;
    byId[m.id] = { ...m, children: [] };
  });

  maps.forEach((m) => {
    if (!m) return;
    const node = byId[m.id];
    if (m.parentId && byId[m.parentId]) {
      byId[m.parentId].children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortByOrder = (nodes: TreeNodeData[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach(n => sortByOrder(n.children));
  };
  sortByOrder(roots);

  return roots;
}

export function filterTree(nodes: TreeNodeData[], query: string): TreeNodeData[] {
  if (!query) return nodes;
  const result: TreeNodeData[] = [];
  for (const node of nodes) {
    const filteredChildren = filterTree(node.children, query);
    const idStr = String(node.id).padStart(3, '0');
    const selfMatch = (node.isFolder
      ? fuzzyMatch(node.name, query)
      : (fuzzyMatch(node.name || `Map ${node.id}`, query)
        || fuzzyMatch(idStr, query)
        || (!!node.displayName && fuzzyMatch(node.displayName, query))));
    if (selfMatch || filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren });
    }
  }
  return result;
}

export function flattenTree(nodes: TreeNodeData[], collapsed: Record<number, boolean>): number[] {
  const result: number[] = [];
  const visit = (node: TreeNodeData) => {
    result.push(node.id);
    if (!collapsed[node.id] && node.children.length > 0) {
      node.children.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return result;
}
