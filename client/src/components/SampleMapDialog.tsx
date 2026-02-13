import React, { useState, useEffect, useRef } from 'react';
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

interface SampleMapStatus {
  available: boolean;
  count: number;
  detectedBinaryPath: string | null;
}

interface Props {
  parentId?: number;
  onClose: () => void;
}

export default function SampleMapDialog({ parentId = 0, onClose }: Props) {
  const { t } = useTranslation();
  const createMap = useEditorStore((s) => s.createMap);
  const selectMap = useEditorStore((s) => s.selectMap);
  const showToast = useEditorStore((s) => s.showToast);
  const [maps, setMaps] = useState<SampleMapInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [category, setCategory] = useState<string>('all');

  // 바이너리 경로 설정 상태
  const [needsSetup, setNeedsSetup] = useState(false);
  const [binaryPath, setBinaryPath] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const pathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const status = await apiClient.get<SampleMapStatus>('/maps/sample-maps/status');
        if (cancelled) return;

        if (!status.available) {
          setNeedsSetup(true);
          if (status.detectedBinaryPath) {
            setBinaryPath(status.detectedBinaryPath);
          }
          setLoading(false);
          return;
        }

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
    if (!selectedId || !selectedMap) return;
    setApplying(true);
    try {
      // 1. 새 맵 생성
      const newMapId = await createMap({
        name: selectedMap.name,
        width: selectedMap.width,
        height: selectedMap.height,
        tilesetId: selectedMap.tilesetId,
        parentId,
      });
      if (!newMapId) throw new Error('Failed to create map');

      // 2. 샘플 데이터로 덮어쓰기
      const sampleData = await apiClient.get<Record<string, unknown>>(`/maps/sample-maps/${selectedId}`);
      await apiClient.put(`/maps/${newMapId}`, sampleData);

      // 3. 새 맵으로 이동
      await selectMap(newMapId);
      showToast(t('sampleMap.applied', { name: selectedMap.name }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const handleExtract = async () => {
    if (!binaryPath.trim()) return;
    setExtracting(true);
    setExtractError('');
    try {
      await apiClient.post('/maps/sample-maps/set-binary-path', { binaryPath: binaryPath.trim() });
      setNeedsSetup(false);
      setLoading(true);
      const list = await apiClient.get<SampleMapInfo[]>('/maps/sample-maps');
      setMaps(list);
      if (list.length > 0) setSelectedId(list[0].id);
      setLoading(false);
      showToast(t('sampleMap.extractSuccess'));
    } catch (e) {
      setExtractError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const categories = [
    { key: 'all', label: t('sampleMap.all') },
    { key: 'Fantasy', label: 'Fantasy' },
    { key: 'Cyberpunk', label: 'Cyberpunk' },
  ];

  // 바이너리 경로 설정 UI
  if (needsSetup && !loading) {
    return (
      <div className="db-dialog-overlay">
        <div className="db-dialog" style={{ width: 550, height: 'auto' }}>
          <div className="db-dialog-header">{t('sampleMap.title')}</div>
          <div className="db-dialog-body" style={{ flexDirection: 'column', padding: 20, gap: 12 }}>
            <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6 }}>
              {t('sampleMap.setupDesc')}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              {t('sampleMap.setupHint')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                ref={pathInputRef}
                type="text"
                value={binaryPath}
                onChange={(e) => setBinaryPath(e.target.value)}
                placeholder={t('sampleMap.pathPlaceholder')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  background: '#1e1e1e',
                  border: '1px solid #555',
                  borderRadius: 3,
                  color: '#ddd',
                  fontSize: 12,
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleExtract(); }}
              />
            </div>
            {extractError && (
              <div style={{ padding: 8, background: '#2a2020', borderRadius: 4, fontSize: 12, color: '#e55' }}>
                {extractError}
              </div>
            )}
          </div>
          <div className="db-dialog-footer">
            <button className="db-btn" onClick={handleExtract} disabled={!binaryPath.trim() || extracting}>
              {extracting ? t('sampleMap.extracting') : t('sampleMap.extract')}
            </button>
            <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </div>
      </div>
    );
  }

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

            {/* 맵 정보 + 프리뷰 */}
            <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedMap && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#ddd' }}>{selectedMap.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{selectedMap.category}</div>
                  {/* 프리뷰 이미지 */}
                  <div style={{
                    flex: 1,
                    marginTop: 8,
                    background: '#1a1a1a',
                    borderRadius: 4,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <img
                      src={`/api/maps/sample-maps/${selectedMap.id}/preview`}
                      alt={selectedMap.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        imageRendering: 'pixelated',
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>
                    <span>{t('sampleMap.size')}: {selectedMap.width} x {selectedMap.height}</span>
                    <span style={{ marginLeft: 12 }}>{t('sampleMap.tilesetId')}: {selectedMap.tilesetId}</span>
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
