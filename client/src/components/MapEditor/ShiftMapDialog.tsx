import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';

interface Props {
  onClose: () => void;
}

export default function ShiftMapDialog({ onClose }: Props) {
  const { t } = useTranslation();
  const shiftMap = useEditorStore((s) => s.shiftMap);
  const currentMap = useEditorStore((s) => s.currentMap);
  const [direction, setDirection] = useState<'up' | 'down' | 'left' | 'right'>('down');
  const [distance, setDistance] = useState(1);

  const handleOk = () => {
    let dx = 0, dy = 0;
    switch (direction) {
      case 'up': dy = -distance; break;
      case 'down': dy = distance; break;
      case 'left': dx = -distance; break;
      case 'right': dx = distance; break;
    }
    shiftMap(dx, dy);
    onClose();
  };

  if (!currentMap) return null;

  return (
    <div className="db-dialog-overlay">
      <div className="map-props-dialog" style={{ width: 320 }}>
        <div className="image-picker-header">{t('shiftMap.title')}</div>
        <div className="db-form" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#aaa' }}>{t('shiftMap.direction')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['up', 'down', 'left', 'right'] as const).map(dir => (
                <label key={dir} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <input type="radio" name="direction" checked={direction === dir} onChange={() => setDirection(dir)} />
                  {t(`shiftMap.${dir}`)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#aaa' }}>{t('shiftMap.distance')}</label>
            <input
              type="number"
              min={1}
              max={Math.max(currentMap.width, currentMap.height)}
              value={distance}
              onChange={e => setDistance(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 80 }}
            />
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
