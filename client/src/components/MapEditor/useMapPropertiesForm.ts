import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import type { AudioFile, MapData } from '../../types/rpgMakerMV';

export interface EncounterEntry {
  troopId: number;
  weight: number;
  regionSet: number[];
}

export interface TilesetEntry { id: number; name: string; }

export function useMapPropertiesForm(mapId: number | undefined, parentId: number | undefined, onClose: () => void) {
  const { t } = useTranslation();
  const maps = useEditorStore((s) => s.maps);
  const updateMapInfos = useEditorStore((s) => s.updateMapInfos);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const createMap = useEditorStore((s) => s.createMap);
  const selectMap = useEditorStore((s) => s.selectMap);
  const showToast = useEditorStore((s) => s.showToast);

  const isNew = mapId == null;

  const [loading, setLoading] = useState(!isNew);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tilesetId, setTilesetId] = useState(1);
  const [width, setWidth] = useState(17);
  const [height, setHeight] = useState(13);
  const [scrollType, setScrollType] = useState(0);
  const [encounterStep, setEncounterStep] = useState(30);
  const [autoplayBgm, setAutoplayBgm] = useState(false);
  const [bgm, setBgm] = useState<AudioFile>({ name: '', volume: 90, pitch: 100, pan: 0 });
  const [autoplayBgs, setAutoplayBgs] = useState(false);
  const [bgs, setBgs] = useState<AudioFile>({ name: '', volume: 90, pitch: 100, pan: 0 });
  const [specifyBattleback, setSpecifyBattleback] = useState(false);
  const [battleback1Name, setBattleback1Name] = useState('');
  const [battleback2Name, setBattleback2Name] = useState('');
  const [disableDashing, setDisableDashing] = useState(false);
  const [parallaxName, setParallaxName] = useState('');
  const [parallaxLoopX, setParallaxLoopX] = useState(false);
  const [parallaxLoopY, setParallaxLoopY] = useState(false);
  const [parallaxSx, setParallaxSx] = useState(0);
  const [parallaxSy, setParallaxSy] = useState(0);
  const [parallaxShow, setParallaxShow] = useState(true);
  const [note, setNote] = useState('');
  const [encounterList, setEncounterList] = useState<EncounterEntry[]>([]);
  const [selectedEncIdx, setSelectedEncIdx] = useState<number | null>(null);
  const [encDialogOpen, setEncDialogOpen] = useState(false);
  const [encDialogEditIdx, setEncDialogEditIdx] = useState<number | null>(null);
  const [tilesetNames, setTilesetNames] = useState<string[]>([]);
  const [troopNames, setTroopNames] = useState<string[]>([]);
  const [showTilesetPicker, setShowTilesetPicker] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [tsRes, troopRes] = await Promise.all([
          apiClient.get<(null | { id: number; name: string })[]>('/database/tilesets'),
          apiClient.get<(null | { id: number; name: string })[]>('/database/troops'),
        ]);

        const names: string[] = [];
        tsRes.forEach((ts, i) => { if (ts && ts.name) names[i] = ts.name; });
        setTilesetNames(names);

        const tNames: string[] = [];
        troopRes.forEach(tr => { if (tr) tNames[tr.id] = tr.name || ''; });
        setTroopNames(tNames);

        if (!isNew && mapId != null) {
          const mapRes = await apiClient.get<MapData>(`/maps/${mapId}`);
          setMapData(mapRes);
          setDisplayName(mapRes.displayName || '');
          setTilesetId(mapRes.tilesetId || 1);
          setWidth(mapRes.width);
          setHeight(mapRes.height);
          setScrollType(mapRes.scrollType ?? 0);
          setEncounterStep(mapRes.encounterStep ?? 30);
          setAutoplayBgm(!!mapRes.autoplayBgm);
          setBgm(mapRes.bgm || { name: '', volume: 90, pitch: 100, pan: 0 });
          setAutoplayBgs(!!mapRes.autoplayBgs);
          setBgs(mapRes.bgs || { name: '', volume: 90, pitch: 100, pan: 0 });
          setSpecifyBattleback(!!mapRes.specifyBattleback);
          setBattleback1Name(mapRes.battleback1Name || '');
          setBattleback2Name(mapRes.battleback2Name || '');
          setDisableDashing(!!mapRes.disableDashing);
          setParallaxName(mapRes.parallaxName || '');
          setParallaxLoopX(!!mapRes.parallaxLoopX);
          setParallaxLoopY(!!mapRes.parallaxLoopY);
          setParallaxSx(mapRes.parallaxSx || 0);
          setParallaxSy(mapRes.parallaxSy || 0);
          setParallaxShow(mapRes.parallaxShow ?? true);
          setNote(mapRes.note || '');
          setEncounterList((mapRes.encounterList as EncounterEntry[]) || []);
          const info = maps.find(m => m && m.id === mapId);
          setName(info?.name || '');
        }
      } catch (e) {
        console.error('Failed to load map properties', e);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, isNew]);

  const handleAddEncounter = useCallback(() => {
    setEncDialogEditIdx(null);
    setEncDialogOpen(true);
  }, []);

  const handleDeleteEncounter = useCallback(() => {
    if (selectedEncIdx === null || selectedEncIdx >= encounterList.length) return;
    setEncounterList(prev => prev.filter((_, i) => i !== selectedEncIdx));
    setSelectedEncIdx(null);
  }, [selectedEncIdx, encounterList.length]);

  const handleEncDialogOk = useCallback((entry: EncounterEntry) => {
    if (encDialogEditIdx !== null) {
      setEncounterList(prev => prev.map((e, i) => i === encDialogEditIdx ? entry : e));
      setSelectedEncIdx(encDialogEditIdx);
    } else {
      setEncounterList(prev => {
        setSelectedEncIdx(prev.length);
        return [...prev, entry];
      });
    }
    setEncDialogOpen(false);
    setEncDialogEditIdx(null);
  }, [encDialogEditIdx]);

  const buildMapFields = () => ({
    displayName, tilesetId, width, height, scrollType, encounterStep,
    autoplayBgm, bgm, autoplayBgs, bgs, specifyBattleback,
    battleback1Name, battleback2Name, disableDashing,
    parallaxName, parallaxLoopX, parallaxLoopY, parallaxSx, parallaxSy, parallaxShow,
    note, encounterList,
  });

  const handleOk = useCallback(async () => {
    try {
      if (isNew) {
        const newId = await createMap({
          name: name || t('mapProperties.newMapDefaultName', '신규 맵'),
          width, height, tilesetId, parentId: parentId ?? 0,
        });
        if (!newId) { showToast(t('mapProperties.saveFailed')); return; }

        const newMapData = await apiClient.get<MapData>(`/maps/${newId}`);
        await apiClient.put(`/maps/${newId}`, { ...newMapData, ...buildMapFields() });

        const updatedMaps = useEditorStore.getState().maps.map(m => {
          if (m && m.id === newId) return { ...m, name: name || t('mapProperties.newMapDefaultName', '신규 맵') };
          return m;
        });
        await updateMapInfos(updatedMaps);
        selectMap(newId);
      } else {
        if (!mapData) return;
        const newMaps = maps.map(m => {
          if (m && m.id === mapId) return { ...m, name };
          return m;
        });
        await updateMapInfos(newMaps);

        const updatedMap: MapData = { ...mapData, ...buildMapFields() };

        if (width !== mapData.width || height !== mapData.height) {
          const oldW = mapData.width;
          const oldH = mapData.height;
          const newData = new Array(width * height * 6).fill(0);
          for (let z = 0; z < 6; z++) {
            for (let y = 0; y < Math.min(oldH, height); y++) {
              for (let x = 0; x < Math.min(oldW, width); x++) {
                newData[(z * height + y) * width + x] = mapData.data[(z * oldH + y) * oldW + x] || 0;
              }
            }
          }
          updatedMap.data = newData;
          updatedMap.events = mapData.events.map(ev => {
            if (!ev) return null;
            if (ev.x >= width || ev.y >= height) return null;
            return ev;
          });
        }

        await apiClient.put(`/maps/${mapId}`, updatedMap);

        if (currentMapId === mapId) {
          const refreshed = await apiClient.get<MapData>(`/maps/${mapId}`);
          useEditorStore.setState({ currentMap: refreshed });
        }
      }
      showToast(t('mapProperties.saved'));
      onClose();
    } catch (e) {
      console.error('Failed to save map properties', e);
      showToast(t('mapProperties.saveFailed'));
    }
  }, [isNew, mapData, maps, mapId, parentId, name, displayName, tilesetId, width, height, scrollType, encounterStep,
    autoplayBgm, bgm, autoplayBgs, bgs, specifyBattleback, battleback1Name, battleback2Name,
    disableDashing, parallaxName, parallaxLoopX, parallaxLoopY, parallaxSx, parallaxSy, parallaxShow,
    note, encounterList, currentMapId, createMap, updateMapInfos, selectMap, showToast, onClose, t]);

  return {
    isNew, loading, name, setName, displayName, setDisplayName,
    tilesetId, setTilesetId, width, setWidth, height, setHeight,
    scrollType, setScrollType, encounterStep, setEncounterStep,
    autoplayBgm, setAutoplayBgm, bgm, setBgm,
    autoplayBgs, setAutoplayBgs, bgs, setBgs,
    specifyBattleback, setSpecifyBattleback, battleback1Name, setBattleback1Name, battleback2Name, setBattleback2Name,
    disableDashing, setDisableDashing,
    parallaxName, setParallaxName, parallaxLoopX, setParallaxLoopX, parallaxLoopY, setParallaxLoopY,
    parallaxSx, setParallaxSx, parallaxSy, setParallaxSy, parallaxShow, setParallaxShow,
    note, setNote,
    encounterList, selectedEncIdx, setSelectedEncIdx,
    encDialogOpen, setEncDialogOpen, encDialogEditIdx, setEncDialogEditIdx,
    tilesetNames, troopNames, showTilesetPicker, setShowTilesetPicker,
    handleAddEncounter, handleDeleteEncounter, handleEncDialogOk, handleOk,
  };
}
