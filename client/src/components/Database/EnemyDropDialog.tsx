import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DropItem } from '../../types/rpgMakerMV';
import { DataListPicker } from '../EventEditor/dataListPicker';

interface RefItem { id: number; name: string; iconIndex?: number }

interface EnemyDropDialogProps {
  drop: DropItem;
  items: RefItem[];
  weapons: RefItem[];
  armors: RefItem[];
  itemNames: string[];
  weaponNames: string[];
  armorNames: string[];
  onDropChange: (field: keyof DropItem, value: number) => void;
  onClose: () => void;
}

export default function EnemyDropDialog({
  drop, items, weapons, armors, itemNames, weaponNames, armorNames, onDropChange, onClose,
}: EnemyDropDialogProps) {
  const { t } = useTranslation();
  const [dataPickerKind, setDataPickerKind] = useState<number | null>(null);

  const kindOptions: { kind: number; label: string; list: RefItem[] }[] = [
    { kind: 0, label: t('dropKind.none'), list: [] },
    { kind: 1, label: t('dropKind.item'), list: items },
    { kind: 2, label: t('dropKind.weapon'), list: weapons },
    { kind: 3, label: t('dropKind.armor'), list: armors },
  ];

  return (
    <>
      <div className="db-dialog-overlay" onClick={onClose}>
        <div className="enemies-drop-dialog" onClick={e => e.stopPropagation()}>
          <div className="enemies-drop-dialog-title">{t('fields.dropItemDrop') || '아이템 드롭'}</div>
          <div className="enemies-drop-dialog-body">
            <div className="enemies-drop-dialog-section">{t('fields.dropItemDrop') || '아이템 드롭'}</div>
            {kindOptions.map(opt => {
              const isSelected = drop.kind === opt.kind;
              const selectedDataItem = isSelected ? opt.list.find(it => it.id === drop.dataId) : null;
              const displayName = selectedDataItem ? selectedDataItem.name : '';
              return (
                <div key={opt.kind} className="enemies-drop-radio-row">
                  <label className="enemies-drop-radio-label">
                    <input type="radio" name="dropKind" checked={isSelected}
                      onChange={() => onDropChange('kind', opt.kind)} />
                    <span>{opt.label}</span>
                  </label>
                  {opt.kind > 0 && (
                    <button className={`enemies-drop-item-btn${!isSelected ? ' disabled' : ''}`}
                      disabled={!isSelected}
                      onClick={() => setDataPickerKind(opt.kind)}>
                      {isSelected ? displayName : ''}
                    </button>
                  )}
                </div>
              );
            })}

            <div className="enemies-drop-dialog-section">{t('fields.dropRate') || '출현율'}</div>
            <div className="enemies-drop-rate-row">
              <span>1 /</span>
              <input type="number" value={drop.denominator} min={1} max={1000}
                onChange={(e) => onDropChange('denominator', Number(e.target.value))}
                className="enemies-input" style={{ width: 80 }} />
            </div>
          </div>
          <div className="enemies-drop-dialog-footer">
            <button className="db-btn" onClick={onClose}>OK</button>
            <button className="db-btn" onClick={onClose}>{t('common.cancel') || '취소'}</button>
          </div>
        </div>
      </div>

      {dataPickerKind !== null && (() => {
        const names = dataPickerKind === 1 ? itemNames : dataPickerKind === 2 ? weaponNames : armorNames;
        const title = dataPickerKind === 1 ? t('dropKind.item') : dataPickerKind === 2 ? t('dropKind.weapon') : t('dropKind.armor');
        return (
          <DataListPicker
            items={names}
            value={drop.kind === dataPickerKind ? drop.dataId : 0}
            onChange={(id) => onDropChange('dataId', id)}
            onClose={() => setDataPickerKind(null)}
            title={title + ' 선택'}
          />
        );
      })()}
    </>
  );
}
