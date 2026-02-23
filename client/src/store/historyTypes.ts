import type { EditorLights, MapObject, RPGEvent, CameraZone } from '../types/rpgMakerMV';

export interface TileChange {
  x: number;
  y: number;
  z: number;
  oldTileId: number;
  newTileId: number;
}

export interface TileHistoryEntry {
  mapId: number;
  type?: 'tile';
  changes: TileChange[];
}

export interface ResizeHistoryEntry {
  mapId: number;
  type: 'resize';
  oldWidth: number;
  oldHeight: number;
  oldData: number[];
  oldEvents: (RPGEvent | null)[];
  oldEditorLights?: EditorLights;
  oldObjects?: MapObject[];
  oldCameraZones?: CameraZone[];
  oldStartX?: number;
  oldStartY?: number;
  newWidth: number;
  newHeight: number;
  newData: number[];
  newEvents: (RPGEvent | null)[];
  newEditorLights?: EditorLights;
  newObjects?: MapObject[];
  newCameraZones?: CameraZone[];
  newStartX?: number;
  newStartY?: number;
}

export interface ObjectHistoryEntry {
  mapId: number;
  type: 'object';
  oldObjects: MapObject[];
  newObjects: MapObject[];
  oldSelectedObjectId: number | null;
  oldSelectedObjectIds: number[];
}

export interface LightHistoryEntry {
  mapId: number;
  type: 'light';
  oldLights: EditorLights;
  newLights: EditorLights;
  oldSelectedLightId: number | null;
  oldSelectedLightIds: number[];
}

export interface CameraZoneHistoryEntry {
  mapId: number;
  type: 'cameraZone';
  oldZones: CameraZone[];
  newZones: CameraZone[];
  oldSelectedCameraZoneId: number | null;
  oldSelectedCameraZoneIds: number[];
}

export interface EventHistoryEntry {
  mapId: number;
  type: 'event';
  oldEvents: (RPGEvent | null)[];
  newEvents: (RPGEvent | null)[];
  oldSelectedEventId: number | null;
  oldSelectedEventIds: number[];
}

export interface PlayerStartHistoryEntry {
  mapId: number;
  type: 'playerStart';
  oldMapId: number;
  oldX: number;
  oldY: number;
  newMapId: number;
  newX: number;
  newY: number;
}

export interface PassageChange {
  x: number;
  y: number;
  oldValue: number;
  newValue: number;
}

export interface PassageHistoryEntry {
  mapId: number;
  type: 'passage';
  changes: PassageChange[];
}

export interface MapDeleteHistoryEntry {
  mapId: number;
  type: 'mapDelete';
  mapInfo: any;
  mapData: any;
  extData: any;
}

export interface MapRenameHistoryEntry {
  mapId: number;
  type: 'mapRename';
  oldName: string;
  newName: string;
}

export type HistoryEntry =
  | TileHistoryEntry
  | ResizeHistoryEntry
  | ObjectHistoryEntry
  | LightHistoryEntry
  | CameraZoneHistoryEntry
  | EventHistoryEntry
  | PlayerStartHistoryEntry
  | PassageHistoryEntry
  | MapDeleteHistoryEntry
  | MapRenameHistoryEntry;
