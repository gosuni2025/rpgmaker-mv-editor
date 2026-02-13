import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import useEditorStore from '../store/useEditorStore';

interface SampleMapInfo {
  id: number;
  name: string;
  category: string;
  width?: number;
  height?: number;
  tilesetId?: number;
}

interface Props {
  mapId: number;
  onClose: () => void;
}

export default function SampleMapDialog({ mapId, onClose }: Props) {
  const { t } = useTranslation();
  const selectMap = useEditorStore((s) => s.selectMap);
  const showToast = useEditorStore((s) => s.showToast);
  const [maps, setMaps] = useState<SampleMapInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [category, setCategory] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const list = await apiClient.get<SampleMapInfo[]>('/maps/sample-maps');
        if (!cancelled) {
          setMaps(list);
          if (list.length > 0) setSelectedId(list[0].id);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredMaps = category === 'all'
    ? maps
    : maps.filter(m => m.category === category);

  const selectedMap = maps.find(m => m.id === selectedId);

  const handleApply = async () => {
    if (!selectedId) return;
    setApplying(true);
    try {
      const sampleData = await apiClient.get<Record<string, unknown>>(`/maps/sample-maps/${selectedId}`);
      // 샘플 맵 데이터를 현재 맵에 덮어쓰기
      await apiClient.put(`/maps/${mapId}`, sampleData);
      // 맵 다시 로드
      await selectMap(mapId);
      showToast(t('sampleMap.applied', { name: selectedMap?.name || '' }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const categories = [
    { key: 'all', label: t('sampleMap.all') },
    { key: 'Fantasy', label: 'Fantasy' },
    { key: 'Cyberpunk', label: 'Cyberpunk' },
  ];

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog" style={{ width: 600, height: 500 }}>
        <div className="db-dialog-header">{t('sampleMap.title')}</div>
        <div className="db-dialog-body" style={{ flexDirection: 'column' }}>
          {/* 카테고리 탭 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #555', background: '#333' }}>
            {categories.map(cat => (
              <button
                key={cat.key}
                className={`opd-tab${category === cat.key ? ' active' : ''}`}
                onClick={() => setCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* 맵 목록 */}
            <div style={{ width: 260, overflowY: 'auto', borderRight: '1px solid #555' }}>
              {loading && <div className="db-loading">{t('sampleMap.loading')}</div>}
              {error && <div style={{ padding: 8, color: '#e55', fontSize: 12 }}>{error}</div>}
              {!loading && filteredMaps.map((m, i) => (
                <div
                  key={m.id}
                  className={`db-list-item${m.id === selectedId ? ' selected' : ''}`}
                  onClick={() => setSelectedId(m.id)}
                  onDoubleClick={handleApply}
                >
                  <span style={{ color: '#888', fontSize: 11, marginRight: 6 }}>{String(i + 1).padStart(3, '0')}</span>
                  <span>{m.name}</span>
                </div>
              ))}
              {!loading && filteredMaps.length === 0 && !error && (
                <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 12 }}>
                  {t('sampleMap.noMaps')}
                </div>
              )}
            </div>

            {/* 맵 정보 */}
            <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedMap && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#ddd' }}>{selectedMap.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{selectedMap.category}</div>
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
                    <div>{t('sampleMap.size')}: {selectedMap.width} x {selectedMap.height}</div>
                    <div>{t('sampleMap.tilesetId')}: {selectedMap.tilesetId}</div>
                  </div>
                  <div style={{ marginTop: 16, padding: 8, background: '#2a2a2a', borderRadius: 4, fontSize: 11, color: '#c90' }}>
                    {t('sampleMap.warning', { id: mapId })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleApply} disabled={!selectedId || applying}>
            {applying ? t('sampleMap.applying') : t('common.ok')}
          </button>
          <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
