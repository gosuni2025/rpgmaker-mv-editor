import React, { useState, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import ImagePicker from '../common/ImagePicker';

interface TilesetEntry {
  id: number;
  name: string;
}

interface MapProps {
  displayName: string;
  tilesetId: number;
  width: number;
  height: number;
  scrollType: number;
  encounterStep: number;
  autoplayBgm: boolean;
  autoplayBgs: boolean;
  bgm: { name: string; pan: number; pitch: number; volume: number };
  bgs: { name: string; pan: number; pitch: number; volume: number };
  parallaxName: string;
  parallaxLoopX: boolean;
  parallaxLoopY: boolean;
  parallaxSx: number;
  parallaxSy: number;
  parallaxShow: boolean;
  specifyBattleback: boolean;
  battleback1Name: string;
  battleback2Name: string;
  disableDashing: boolean;
  note: string;
}

interface Props {
  mapId: number;
  mapName: string;
  onClose: () => void;
}

export default function MapPropertiesDialog({ mapId, mapName, onClose }: Props) {
  const currentMap = useEditorStore((s) => s.currentMap);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const selectMap = useEditorStore((s) => s.selectMap);
  const maps = useEditorStore((s) => s.maps);
  const updateMapInfos = useEditorStore((s) => s.updateMapInfos);

  const [tilesets, setTilesets] = useState<TilesetEntry[]>([]);
  const [mapData, setMapData] = useState<MapProps | null>(null);
  const [name, setName] = useState(mapName);
  const [loading, setLoading] = useState(true);

  // Load tileset list and map data
  useEffect(() => {
    (async () => {
      try {
        const [tsData, mData] = await Promise.all([
          apiClient.get<(null | { id: number; name: string })[]>('/database/tilesets'),
          apiClient.get<MapProps>(`/maps/${mapId}`),
        ]);
        const entries: TilesetEntry[] = [];
        tsData.forEach((t, i) => {
          if (t && t.name) entries.push({ id: i, name: t.name });
        });
        setTilesets(entries);
        setMapData(mData);
      } catch (e) {
        console.error('Failed to load map properties:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [mapId]);

  const updateField = <K extends keyof MapProps>(key: K, value: MapProps[K]) => {
    if (!mapData) return;
    setMapData({ ...mapData, [key]: value });
  };

  const handleOK = async () => {
    if (!mapData) return;
    try {
      // Save map data (need to merge with full map data including tile data)
      const fullMap = await apiClient.get<Record<string, unknown>>(`/maps/${mapId}`);
      const merged = {
        ...fullMap,
        displayName: mapData.displayName,
        tilesetId: mapData.tilesetId,
        width: mapData.width,
        height: mapData.height,
        scrollType: mapData.scrollType,
        encounterStep: mapData.encounterStep,
        autoplayBgm: mapData.autoplayBgm,
        autoplayBgs: mapData.autoplayBgs,
        bgm: mapData.bgm,
        bgs: mapData.bgs,
        parallaxName: mapData.parallaxName,
        parallaxLoopX: mapData.parallaxLoopX,
        parallaxLoopY: mapData.parallaxLoopY,
        parallaxSx: mapData.parallaxSx,
        parallaxSy: mapData.parallaxSy,
        parallaxShow: mapData.parallaxShow,
        specifyBattleback: mapData.specifyBattleback,
        battleback1Name: mapData.battleback1Name,
        battleback2Name: mapData.battleback2Name,
        disableDashing: mapData.disableDashing,
        note: mapData.note,
      };
      await apiClient.put(`/maps/${mapId}`, merged);

      // Update map name in MapInfos
      if (name !== mapName) {
        const newMaps = maps.map(m => {
          if (m && m.id === mapId) return { ...m, name };
          return m;
        });
        await updateMapInfos(newMaps);
      }

      // Reload the map if it's currently selected
      if (currentMapId === mapId) {
        await selectMap(mapId);
      }
    } catch (e) {
      console.error('Failed to save map properties:', e);
    }
    onClose();
  };

  if (loading || !mapData) {
    return (
      <div className="db-dialog-overlay" onClick={onClose}>
        <div className="db-dialog" style={{ width: 550, height: 600 }} onClick={e => e.stopPropagation()}>
          <div className="db-dialog-header">Map Properties</div>
          <div className="db-dialog-body"><div className="db-loading">Loading...</div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="db-dialog-overlay" onClick={onClose}>
      <div className="db-dialog" style={{ width: 550, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="db-dialog-header">Map Properties - {name}</div>
        <div className="db-dialog-body" style={{ flexDirection: 'column', overflowY: 'auto', padding: 16, gap: 12 }}>
          {/* General Settings */}
          <div className="db-form-section">General Settings</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <label>
              <span>Name</span>
              <input type="text" value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label>
              <span>Display Name</span>
              <input type="text" value={mapData.displayName} onChange={e => updateField('displayName', e.target.value)} />
            </label>
            <label>
              <span>Tileset</span>
              <select value={mapData.tilesetId} onChange={e => updateField('tilesetId', Number(e.target.value))}>
                {tilesets.map(t => (
                  <option key={t.id} value={t.id}>{t.id}: {t.name}</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ flex: 1 }}>
                <span>Width</span>
                <input type="number" min={1} max={256} value={mapData.width}
                  onChange={e => updateField('width', Math.max(1, Math.min(256, Number(e.target.value))))} />
              </label>
              <label style={{ flex: 1 }}>
                <span>Height</span>
                <input type="number" min={1} max={256} value={mapData.height}
                  onChange={e => updateField('height', Math.max(1, Math.min(256, Number(e.target.value))))} />
              </label>
            </div>
            <label>
              <span>Scroll Type</span>
              <select value={mapData.scrollType} onChange={e => updateField('scrollType', Number(e.target.value))}>
                <option value={0}>No Loop</option>
                <option value={1}>Loop Vertically</option>
                <option value={2}>Loop Horizontally</option>
                <option value={3}>Loop Both</option>
              </select>
            </label>
            <label>
              <span>Enc. Steps</span>
              <input type="number" min={1} max={999} value={mapData.encounterStep}
                onChange={e => updateField('encounterStep', Number(e.target.value))} />
            </label>
          </div>

          {/* Autoplay */}
          <div className="db-form-section">Autoplay</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.autoplayBgm}
                onChange={e => updateField('autoplayBgm', e.target.checked)} />
              <span>Autoplay BGM</span>
            </label>
            {mapData.autoplayBgm && (
              <label>
                <span>BGM Name</span>
                <input type="text" value={mapData.bgm.name}
                  onChange={e => updateField('bgm', { ...mapData.bgm, name: e.target.value })} />
              </label>
            )}
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.autoplayBgs}
                onChange={e => updateField('autoplayBgs', e.target.checked)} />
              <span>Autoplay BGS</span>
            </label>
            {mapData.autoplayBgs && (
              <label>
                <span>BGS Name</span>
                <input type="text" value={mapData.bgs.name}
                  onChange={e => updateField('bgs', { ...mapData.bgs, name: e.target.value })} />
              </label>
            )}
          </div>

          {/* Options */}
          <div className="db-form-section">Options</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.specifyBattleback}
                onChange={e => updateField('specifyBattleback', e.target.checked)} />
              <span>Specify Battleback</span>
            </label>
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.disableDashing}
                onChange={e => updateField('disableDashing', e.target.checked)} />
              <span>Disable Dashing</span>
            </label>
          </div>

          {/* Parallax */}
          <div className="db-form-section">Parallax Background</div>
          <div className="db-form" style={{ gap: 8, flex: 'none' }}>
            <label>
              <span>Image</span>
              <ImagePicker
                type="parallaxes"
                value={mapData.parallaxName}
                onChange={name => updateField('parallaxName', name)}
              />
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label className="db-checkbox-row">
                <input type="checkbox" checked={mapData.parallaxLoopX}
                  onChange={e => updateField('parallaxLoopX', e.target.checked)} />
                <span>Loop X</span>
              </label>
              <label className="db-checkbox-row">
                <input type="checkbox" checked={mapData.parallaxLoopY}
                  onChange={e => updateField('parallaxLoopY', e.target.checked)} />
                <span>Loop Y</span>
              </label>
            </div>
            {mapData.parallaxLoopX && (
              <label>
                <span>Scroll X</span>
                <input type="number" min={-32} max={32} value={mapData.parallaxSx}
                  onChange={e => updateField('parallaxSx', Number(e.target.value))} />
              </label>
            )}
            {mapData.parallaxLoopY && (
              <label>
                <span>Scroll Y</span>
                <input type="number" min={-32} max={32} value={mapData.parallaxSy}
                  onChange={e => updateField('parallaxSy', Number(e.target.value))} />
              </label>
            )}
            <label className="db-checkbox-row">
              <input type="checkbox" checked={mapData.parallaxShow}
                onChange={e => updateField('parallaxShow', e.target.checked)} />
              <span>Show in Editor</span>
            </label>
          </div>

          {/* Note */}
          <div className="db-form-section">Note</div>
          <textarea value={mapData.note} onChange={e => updateField('note', e.target.value)}
            style={{ width: '100%', minHeight: 60, background: '#2a2a2a', color: '#ccc', border: '1px solid #555', padding: 8, resize: 'vertical' }} />
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleOK}>OK</button>
          <button className="db-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
