import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { useTranslation } from 'react-i18next';
import './InspectorPanel.css';

export default function PassageInspector() {
  const { t } = useTranslation();
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedTile = useEditorStore((s) => s.selectedPassageTile);
  const passageSelectionStart = useEditorStore((s) => s.passageSelectionStart);
  const passageSelectionEnd = useEditorStore((s) => s.passageSelectionEnd);
  const updateCustomPassage = useEditorStore((s) => s.updateCustomPassage);
  const updateCustomUpperLayer = useEditorStore((s) => s.updateCustomUpperLayer);

  const hasSelection = !!(passageSelectionStart && passageSelectionEnd);

  // 선택 타일의 customUpperLayer 값 (단일 타일 기준)
  const ulValue = selectedTile && currentMap
    ? (currentMap.customUpperLayer?.[selectedTile.y * currentMap.width + selectedTile.x] ?? 0)
    : 0;

  const setLayerMode = useCallback((mode: number) => {
    if (!currentMap) return;
    const tiles: { x: number; y: number }[] = [];
    if (hasSelection && passageSelectionStart && passageSelectionEnd) {
      const minX = Math.min(passageSelectionStart.x, passageSelectionEnd.x);
      const maxX = Math.max(passageSelectionStart.x, passageSelectionEnd.x);
      const minY = Math.min(passageSelectionStart.y, passageSelectionEnd.y);
      const maxY = Math.max(passageSelectionStart.y, passageSelectionEnd.y);
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++)
          tiles.push({ x, y });
    } else if (selectedTile) {
      tiles.push(selectedTile);
    }
    const changes = tiles.map((t) => ({
      x: t.x, y: t.y,
      oldValue: currentMap.customUpperLayer?.[t.y * currentMap.width + t.x] ?? 0,
      newValue: mode,
    })).filter((c) => c.oldValue !== c.newValue);
    if (changes.length > 0) updateCustomUpperLayer(changes);
  }, [currentMap, selectedTile, hasSelection, passageSelectionStart, passageSelectionEnd, updateCustomUpperLayer]);

  // 단일 타일 값
  const singleValue = selectedTile && currentMap
    ? (currentMap.customPassage?.[selectedTile.y * currentMap.width + selectedTile.x] ?? 0)
    : 0;

  // 선택 영역의 대표 값: 모든 타일에 공통으로 켜진 비트만 AND, 하나라도 켜진 비트는 OR
  const { commonBits, passageValue } = React.useMemo(() => {
    if (!hasSelection || !currentMap) return { commonBits: singleValue, passageValue: singleValue };
    const minX = Math.min(passageSelectionStart!.x, passageSelectionEnd!.x);
    const maxX = Math.max(passageSelectionStart!.x, passageSelectionEnd!.x);
    const minY = Math.min(passageSelectionStart!.y, passageSelectionEnd!.y);
    const maxY = Math.max(passageSelectionStart!.y, passageSelectionEnd!.y);
    let andBits = 0x0F; // 모든 타일에 공통
    let orBits = 0;     // 하나라도 있는 비트
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const val = currentMap.customPassage?.[y * currentMap.width + x] ?? 0;
        andBits &= val;
        orBits |= val;
      }
    }
    return { commonBits: andBits, passageValue: orBits };
  }, [hasSelection, currentMap, passageSelectionStart, passageSelectionEnd, singleValue]);

  // 선택 영역 내 모든 타일에 대해 변경 생성
  const getSelectionChanges = useCallback((changeFn: (oldValue: number) => number) => {
    if (!currentMap || !passageSelectionStart || !passageSelectionEnd) return [];
    const minX = Math.min(passageSelectionStart.x, passageSelectionEnd.x);
    const maxX = Math.max(passageSelectionStart.x, passageSelectionEnd.x);
    const minY = Math.min(passageSelectionStart.y, passageSelectionEnd.y);
    const maxY = Math.max(passageSelectionStart.y, passageSelectionEnd.y);
    const changes: { x: number; y: number; oldValue: number; newValue: number }[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const oldValue = currentMap.customPassage?.[y * currentMap.width + x] ?? 0;
        const newValue = changeFn(oldValue);
        if (oldValue !== newValue) {
          changes.push({ x, y, oldValue, newValue });
        }
      }
    }
    return changes;
  }, [currentMap, passageSelectionStart, passageSelectionEnd]);

  const toggleDirection = useCallback((bit: number) => {
    if (!currentMap) return;
    if (hasSelection) {
      // 모든 타일에 해당 비트가 켜져 있으면 → 끄기, 아니면 → 켜기
      const allHaveBit = (commonBits & bit) !== 0;
      const changes = getSelectionChanges((oldValue) =>
        allHaveBit ? (oldValue & ~bit) : (oldValue | bit)
      );
      if (changes.length > 0) updateCustomPassage(changes);
    } else if (selectedTile) {
      const oldValue = currentMap.customPassage?.[selectedTile.y * currentMap.width + selectedTile.x] ?? 0;
      const newValue = oldValue ^ bit;
      updateCustomPassage([{ x: selectedTile.x, y: selectedTile.y, oldValue, newValue }]);
    }
  }, [selectedTile, currentMap, updateCustomPassage, hasSelection, commonBits, getSelectionChanges]);

  const setAll = useCallback((value: number) => {
    if (!currentMap) return;
    if (hasSelection) {
      const changes = getSelectionChanges(() => value);
      if (changes.length > 0) updateCustomPassage(changes);
    } else if (selectedTile) {
      const oldValue = currentMap.customPassage?.[selectedTile.y * currentMap.width + selectedTile.x] ?? 0;
      if (oldValue === value) return;
      updateCustomPassage([{ x: selectedTile.x, y: selectedTile.y, oldValue, newValue: value }]);
    }
  }, [selectedTile, currentMap, updateCustomPassage, hasSelection, getSelectionChanges]);

  return (
    <div className="light-inspector">
      <div className="light-inspector-title">{t('passage.title')}</div>

      {!selectedTile && !hasSelection ? (
        <div style={{ color: '#888', fontSize: 12, padding: '8px 0' }}>
          {t('passage.selectTile')}
        </div>
      ) : (
        <>
          <div className="light-inspector-row" style={{ marginBottom: 10 }}>
            <span className="light-inspector-label">{t('passage.tileCoord')}</span>
            <span style={{ color: '#ddd', fontSize: 12 }}>
              {hasSelection
                ? `(${Math.min(passageSelectionStart!.x, passageSelectionEnd!.x)},${Math.min(passageSelectionStart!.y, passageSelectionEnd!.y)})~(${Math.max(passageSelectionStart!.x, passageSelectionEnd!.x)},${Math.max(passageSelectionStart!.y, passageSelectionEnd!.y)})`
                : `(${selectedTile!.x}, ${selectedTile!.y})`}
            </span>
          </div>

          <div className="light-inspector-section">
            <div className="light-inspector-title" style={{ fontSize: 11 }}>{t('passage.directions')}</div>

            {/* 방향 그리드: 3x3, 중앙은 상태 표시 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, width: 'fit-content', margin: '8px auto' }}>
              <div />
              <DirectionBtn
                label={t('passage.up')}
                active={!!(commonBits & 0x08)}
                partial={!!(passageValue & 0x08) && !(commonBits & 0x08)}
                onClick={() => toggleDirection(0x08)}
              />
              <div />
              <DirectionBtn
                label={t('passage.left')}
                active={!!(commonBits & 0x02)}
                partial={!!(passageValue & 0x02) && !(commonBits & 0x02)}
                onClick={() => toggleDirection(0x02)}
              />
              <div style={{
                width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: commonBits === 0x0F ? 'rgba(200,50,50,0.3)' : passageValue > 0 ? 'rgba(200,150,50,0.2)' : 'rgba(80,80,80,0.2)',
                borderRadius: 4, fontSize: 20, color: commonBits === 0x0F ? '#f66' : passageValue > 0 ? '#fa4' : '#666',
              }}>
                {commonBits === 0x0F ? '✕' : passageValue > 0 ? '△' : '○'}
              </div>
              <DirectionBtn
                label={t('passage.right')}
                active={!!(commonBits & 0x04)}
                partial={!!(passageValue & 0x04) && !(commonBits & 0x04)}
                onClick={() => toggleDirection(0x04)}
              />
              <div />
              <DirectionBtn
                label={t('passage.down')}
                active={!!(commonBits & 0x01)}
                partial={!!(passageValue & 0x01) && !(commonBits & 0x01)}
                onClick={() => toggleDirection(0x01)}
              />
              <div />
            </div>

            {/* 전방향/해제 버튼 */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                className="camera-zone-action-btn"
                style={{ background: commonBits === 0x0F ? '#c44' : undefined }}
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

          {/* 레이어 렌더링 설정 */}
          <div className="light-inspector-section" style={{ marginTop: 10 }}>
            <div className="light-inspector-title" style={{ fontSize: 11 }}>
              {t('passage.layerMode', '레이어 렌더링')}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {[
                { value: 0, label: t('passage.layerDefault', '기본'), title: '타일셋 설정 따름' },
                { value: 1, label: t('passage.layerUpper', '상단 ▲'), title: '캐릭터 위에 그림' },
                { value: 2, label: t('passage.layerLower', '하단 ▽'), title: '캐릭터 아래에 그림' },
              ].map(({ value, label, title }) => (
                <button
                  key={value}
                  title={title}
                  className="camera-zone-action-btn"
                  onClick={() => setLayerMode(value)}
                  style={{
                    flex: 1,
                    background: ulValue === value
                      ? value === 1 ? 'rgba(30,100,220,0.5)'
                        : value === 2 ? 'rgba(200,120,20,0.5)'
                        : 'rgba(80,80,80,0.5)'
                      : undefined,
                    borderColor: ulValue === value
                      ? value === 1 ? '#48f'
                        : value === 2 ? '#fa6'
                        : '#888'
                      : undefined,
                    color: ulValue === value ? '#fff' : undefined,
                    fontSize: 11,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DirectionBtn({ label, active, partial, onClick }: { label: string; active: boolean; partial?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 48, height: 48, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
        background: active ? 'rgba(200,50,50,0.5)' : partial ? 'rgba(200,150,50,0.35)' : 'rgba(80,80,80,0.3)',
        border: `1px solid ${active ? '#c66' : partial ? '#a86' : '#555'}`,
        borderRadius: 4, cursor: 'pointer', color: active ? '#faa' : partial ? '#da8' : '#888',
        fontSize: 11, fontWeight: active || partial ? 'bold' : 'normal',
      }}
    >
      <span style={{ fontSize: 14 }}>{active ? '✕' : partial ? '△' : '○'}</span>
      <span style={{ fontSize: 9 }}>{label.replace(/[←→↑↓]\s*/, '')}</span>
    </button>
  );
}
