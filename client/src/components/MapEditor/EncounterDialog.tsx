import React, { useState } from 'react';
import { DataListPicker } from '../EventEditor/dataListPicker';
import { getLabel } from '../EventEditor/actionEditorUtils';

interface EncounterEntry {
  troopId: number;
  weight: number;
  regionSet: number[];
}

interface EncounterDialogProps {
  initial?: Partial<EncounterEntry>;
  troopNames: string[];
  onOk: (entry: EncounterEntry) => void;
  onCancel: () => void;
}

export default function EncounterDialog({ initial, troopNames, onOk, onCancel }: EncounterDialogProps) {
  // 유효한 첫 번째 군단 ID 찾기
  const firstValidId = troopNames.findIndex((n, i) => i > 0 && !!n);
  const defaultTroopId = initial?.troopId ?? (firstValidId > 0 ? firstValidId : 1);

  const [troopId, setTroopId] = useState<number>(defaultTroopId);
  const [showTroopPicker, setShowTroopPicker] = useState(false);
  const [weight, setWeight] = useState<number>(initial?.weight ?? 5);
  const [scope, setScope] = useState<'all' | 'region'>(
    initial?.regionSet && initial.regionSet.length > 0 ? 'region' : 'all'
  );
  // 지역 ID로 지정: 최대 3개 슬롯
  const initRegions = initial?.regionSet ?? [];
  const [regions, setRegions] = useState<[number, number, number]>([
    initRegions[0] ?? 0,
    initRegions[1] ?? 0,
    initRegions[2] ?? 0,
  ]);

  const handleOk = () => {
    const regionSet = scope === 'region'
      ? regions.filter(r => r > 0)
      : [];
    onOk({ troopId, weight, regionSet });
  };

  const handleRegionChange = (slot: 0 | 1 | 2, val: number) => {
    setRegions(prev => {
      const next = [...prev] as [number, number, number];
      next[slot] = Math.max(0, Math.min(255, val));
      return next;
    });
  };

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
                {getLabel(troopId, troopNames)}
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
            <input
              type="radio"
              name="enc-scope"
              checked={scope === 'all'}
              onChange={() => setScope('all')}
            />
            <span>지도 전체</span>
          </label>
          <label className="enc-dialog-radio-row">
            <input
              type="radio"
              name="enc-scope"
              checked={scope === 'region'}
              onChange={() => setScope('region')}
            />
            <span>지역 ID로 지정</span>
          </label>
          <div className="enc-dialog-regions">
            {([0, 1, 2] as const).map((slot) => (
              <div key={slot} className="enc-dialog-region-slot">
                <input
                  type="number"
                  className="enc-dialog-input-num"
                  min={0} max={255}
                  value={regions[slot] || ''}
                  disabled={scope === 'all'}
                  placeholder="0"
                  onChange={(e) => handleRegionChange(slot, Number(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="enc-dialog-footer">
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>

      {showTroopPicker && (
        <DataListPicker
          title="적 군단 선택"
          items={troopNames}
          value={troopId}
          onChange={(id) => { setTroopId(id); setShowTroopPicker(false); }}
          onClose={() => setShowTroopPicker(false)}
        />
      )}
    </div>
  );
}
