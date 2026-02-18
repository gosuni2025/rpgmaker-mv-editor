/**
 * TroopPickerDialog
 * 적 군단 선택 공용 다이얼로그.
 * 좌측: 군단 목록, 우측: 선택된 군단의 배치 미리보기
 */
import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import TroopPreview from './TroopPreview';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import type { Troop } from '../../types/rpgMakerMV';
import './TroopPickerDialog.css';

interface EnemyRef {
  id: number;
  name: string;
  battlerName?: string;
}

interface TroopPickerDialogProps {
  value: number;
  onChange: (troopId: number) => void;
  onClose: () => void;
  title?: string;
}

export default function TroopPickerDialog({ value, onChange, onClose, title = '적 군단 선택' }: TroopPickerDialogProps) {
  const [troops, setTroops] = useState<(Troop | null)[]>([]);
  const [enemies, setEnemies] = useState<EnemyRef[]>([]);
  const [battleback1, setBattleback1] = useState('');
  const [battleback2, setBattleback2] = useState('');
  const [selected, setSelected] = useState(value);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Promise.all([
      apiClient.get<(Troop | null)[]>('/database/troops'),
      apiClient.get<(EnemyRef | null)[]>('/database/enemies'),
      apiClient.get<{ battleback1Name?: string; battleback2Name?: string }>('/database/system'),
    ]).then(([troopData, enemyData, sys]) => {
      setTroops(troopData);
      setEnemies(enemyData.filter(Boolean) as EnemyRef[]);
      setBattleback1(sys.battleback1Name || '');
      setBattleback2(sys.battleback2Name || '');
    }).catch(() => {});
  }, []);

  const validTroops = useMemo(() => {
    const list = troops.filter(Boolean) as Troop[];
    if (!searchQuery) return list;
    return list.filter(t =>
      fuzzyMatch(t.name, searchQuery) ||
      fuzzyMatch(String(t.id).padStart(4, '0'), searchQuery)
    );
  }, [troops, searchQuery]);

  const selectedTroop = useMemo(
    () => troops.find(t => t && t.id === selected) as Troop | undefined,
    [troops, selected]
  );

  const handleSelect = (id: number) => setSelected(id);

  const handleOk = () => {
    onChange(selected);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="troop-picker-dialog">
        <div className="audio-picker-header">{title}</div>

        <div className="troop-picker-body">
          {/* 좌측: 검색 + 목록 */}
          <div className="troop-picker-list-col">
            <div className="audio-picker-search-bar" style={{ padding: '6px 8px' }}>
              <input
                type="text"
                className="picker-search-input"
                placeholder="검색 (초성 지원: ㄱㄴㄷ)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="audio-picker-list troop-picker-list">
              {validTroops.map(troop => (
                <div
                  key={troop.id}
                  className={`audio-picker-item${selected === troop.id ? ' selected' : ''}`}
                  onClick={() => handleSelect(troop.id)}
                  onDoubleClick={() => { handleSelect(troop.id); onChange(troop.id); onClose(); }}
                >
                  {String(troop.id).padStart(4, '0')} {troop.name}
                </div>
              ))}
            </div>
          </div>

          {/* 우측: 미리보기 */}
          <div className="troop-picker-preview-col">
            <div className="troop-picker-preview-label">미리보기</div>
            <TroopPreview
              troop={selectedTroop}
              enemies={enemies}
              battleback1={battleback1}
              battleback2={battleback2}
              className="troop-picker-preview"
            />
            <div className="troop-picker-preview-name">
              {selectedTroop
                ? `${String(selectedTroop.id).padStart(4, '0')} ${selectedTroop.name}`
                : '(없음)'}
            </div>
          </div>
        </div>

        <div className="audio-picker-footer">
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
