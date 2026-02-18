import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import TroopPickerDialog from '../common/TroopPickerDialog';

interface EncounterEntry {
  troopId: number;
  weight: number;
  regionSet: number[];
}

interface EncounterDialogProps {
  initial?: Partial<EncounterEntry>;
  onOk: (entry: EncounterEntry) => void;
  onCancel: () => void;
}

export default function EncounterDialog({ initial, onOk, onCancel }: EncounterDialogProps) {
  const defaultTroopId = initial?.troopId ?? 1;

  const [troopId, setTroopId] = useState<number>(defaultTroopId);
  const [troopNames, setTroopNames] = useState<string[]>([]);
  const [showTroopPicker, setShowTroopPicker] = useState(false);

  useEffect(() => {
    apiClient.get<(null | { id: number; name: string })[]>('/database/troops')
      .then(res => {
        const names: string[] = [];
        res.forEach(t => { if (t) names[t.id] = t.name || ''; });
        setTroopNames(names);
      })
      .catch(() => {});
  }, []);
  const [weight, setWeight] = useState<number>(initial?.weight ?? 5);
  const [scope, setScope] = useState<'all' | 'region'>(
    initial?.regionSet && initial.regionSet.length > 0 ? 'region' : 'all'
  );
  const initRegions = initial?.regionSet ?? [];
  const [regions, setRegions] = useState<number[]>(
    initRegions.length > 0 ? initRegions : [0]
  );

  const handleOk = () => {
    const regionSet = scope === 'region' ? regions.filter(r => r > 0) : [];
    onOk({ troopId, weight, regionSet });
  };

  const handleRegionChange = (idx: number, val: number) => {
    setRegions(prev => {
      const next = [...prev];
      next[idx] = Math.max(0, Math.min(255, val));
      return next;
    });
  };

  const handleAddRegion = () => {
    setRegions(prev => [...prev, 0]);
  };

  const handleRemoveRegion = (idx: number) => {
    setRegions(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  const troopName = troopNames[troopId] || '';
  const buttonLabel = troopName
    ? `${String(troopId).padStart(4, '0')} ${troopName}`
    : `${String(troopId).padStart(4, '0')}`;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="enc-dialog">
        <div className="enc-dialog-title">대결</div>

        {/* 적 군단과 영향력 */}
        <div className="enc-dialog-section">
          <div className="enc-dialog-section-title">적 군단과 영향력</div>
          <div className="enc-dialog-row">
            <div className="enc-dialog-field" style={{ flex: 1 }}>
              <label className="enc-dialog-label">적 군단:</label>
              <button
                className="db-btn"
                style={{ textAlign: 'left', padding: '3px 8px', fontSize: 12, width: '100%' }}
                onClick={() => setShowTroopPicker(true)}
              >
                {buttonLabel}
              </button>
            </div>
            <div className="enc-dialog-field enc-dialog-field-weight">
              <label className="enc-dialog-label">영향력:</label>
              <input
                type="number"
                className="enc-dialog-input-num"
                min={1} max={100}
                value={weight}
                onChange={(e) => setWeight(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              />
            </div>
          </div>
        </div>

        {/* 범위 */}
        <div className="enc-dialog-section">
          <div className="enc-dialog-section-title">범위</div>
          <label className="enc-dialog-radio-row">
            <input type="radio" name="enc-scope" checked={scope === 'all'} onChange={() => setScope('all')} />
            <span>지도 전체</span>
          </label>
          <label className="enc-dialog-radio-row">
            <input type="radio" name="enc-scope" checked={scope === 'region'} onChange={() => setScope('region')} />
            <span>지역 ID로 지정</span>
          </label>
          <div className="enc-dialog-regions">
            {regions.map((val, idx) => (
              <div key={idx} className="enc-dialog-region-slot">
                <input
                  type="number"
                  className="enc-dialog-input-num"
                  min={0} max={255}
                  value={val || ''}
                  disabled={scope === 'all'}
                  placeholder="0"
                  onChange={(e) => handleRegionChange(idx, Number(e.target.value) || 0)}
                />
                {regions.length > 1 && (
                  <button
                    className="enc-dialog-region-remove"
                    disabled={scope === 'all'}
                    onClick={() => handleRemoveRegion(idx)}
                    title="제거"
                  >×</button>
                )}
              </div>
            ))}
            <button
              className="enc-dialog-region-add"
              disabled={scope === 'all'}
              onClick={handleAddRegion}
              title="지역 ID 추가"
            >+</button>
          </div>
        </div>

        {/* 버튼 */}
        <div className="enc-dialog-footer">
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>

      {showTroopPicker && (
        <TroopPickerDialog
          value={troopId}
          onChange={(id) => {
            setTroopId(id);
          }}
          onClose={() => setShowTroopPicker(false)}
        />
      )}
    </div>
  );
}
