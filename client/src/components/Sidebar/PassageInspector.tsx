import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { useTranslation } from 'react-i18next';
import './InspectorPanel.css';

export default function PassageInspector() {
  const { t } = useTranslation();
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedTile = useEditorStore((s) => s.selectedPassageTile);
  const updateCustomPassage = useEditorStore((s) => s.updateCustomPassage);

  const passageValue = selectedTile && currentMap
    ? (currentMap.customPassage?.[selectedTile.y * currentMap.width + selectedTile.x] ?? 0)
    : 0;

  const toggleDirection = useCallback((bit: number) => {
    if (!selectedTile || !currentMap) return;
    const oldValue = currentMap.customPassage?.[selectedTile.y * currentMap.width + selectedTile.x] ?? 0;
    const newValue = oldValue ^ bit;
    updateCustomPassage([{ x: selectedTile.x, y: selectedTile.y, oldValue, newValue }]);
  }, [selectedTile, currentMap, updateCustomPassage]);

  const setAll = useCallback((value: number) => {
    if (!selectedTile || !currentMap) return;
    const oldValue = currentMap.customPassage?.[selectedTile.y * currentMap.width + selectedTile.x] ?? 0;
    if (oldValue === value) return;
    updateCustomPassage([{ x: selectedTile.x, y: selectedTile.y, oldValue, newValue: value }]);
  }, [selectedTile, currentMap, updateCustomPassage]);

  return (
    <div className="light-inspector">
      <div className="light-inspector-title">{t('passage.title')}</div>

      {!selectedTile ? (
        <div style={{ color: '#888', fontSize: 12, padding: '8px 0' }}>
          {t('passage.selectTile')}
        </div>
      ) : (
        <>
          <div className="light-inspector-row" style={{ marginBottom: 10 }}>
            <span className="light-inspector-label">{t('passage.tileCoord')}</span>
            <span style={{ color: '#ddd', fontSize: 12 }}>({selectedTile.x}, {selectedTile.y})</span>
          </div>

          <div className="light-inspector-section">
            <div className="light-inspector-title" style={{ fontSize: 11 }}>{t('passage.directions')}</div>

            {/* 방향 그리드: 3x3, 중앙은 상태 표시 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, width: 'fit-content', margin: '8px auto' }}>
              <div />
              <DirectionBtn
                label={t('passage.up')}
                active={!!(passageValue & 0x08)}
                onClick={() => toggleDirection(0x08)}
              />
              <div />
              <DirectionBtn
                label={t('passage.left')}
                active={!!(passageValue & 0x02)}
                onClick={() => toggleDirection(0x02)}
              />
              <div style={{
                width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: passageValue === 0x0F ? 'rgba(200,50,50,0.3)' : passageValue > 0 ? 'rgba(200,150,50,0.2)' : 'rgba(80,80,80,0.2)',
                borderRadius: 4, fontSize: 20, color: passageValue === 0x0F ? '#f66' : passageValue > 0 ? '#fa4' : '#666',
              }}>
                {passageValue === 0x0F ? '✕' : passageValue > 0 ? '△' : '○'}
              </div>
              <DirectionBtn
                label={t('passage.right')}
                active={!!(passageValue & 0x04)}
                onClick={() => toggleDirection(0x04)}
              />
              <div />
              <DirectionBtn
                label={t('passage.down')}
                active={!!(passageValue & 0x01)}
                onClick={() => toggleDirection(0x01)}
              />
              <div />
            </div>

            {/* 전방향/해제 버튼 */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                className="camera-zone-action-btn"
                style={{ background: passageValue === 0x0F ? '#c44' : undefined }}
                onClick={() => setAll(0x0F)}
              >
                {t('passage.blockAll')}
              </button>
              <button
                className="camera-zone-action-btn"
                onClick={() => setAll(0)}
              >
                {t('passage.clearAll')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DirectionBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 48, height: 48, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
        background: active ? 'rgba(200,50,50,0.5)' : 'rgba(80,80,80,0.3)',
        border: `1px solid ${active ? '#c66' : '#555'}`,
        borderRadius: 4, cursor: 'pointer', color: active ? '#faa' : '#888',
        fontSize: 11, fontWeight: active ? 'bold' : 'normal',
      }}
    >
      <span style={{ fontSize: 14 }}>{active ? '✕' : '○'}</span>
      <span style={{ fontSize: 9 }}>{label.replace(/[←→↑↓]\s*/, '')}</span>
    </button>
  );
}
