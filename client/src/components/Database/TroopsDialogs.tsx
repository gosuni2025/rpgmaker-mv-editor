import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TroopConditions } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';

// ─── Condition Dialog ───
export function TroopCondDialog({ conditions, actors, onSave, onCancel }: {
  conditions: TroopConditions;
  actors: { id: number; name: string }[];
  onSave: (c: TroopConditions) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [c, setC] = useState<TroopConditions>({ ...conditions });
  const up = (partial: Partial<TroopConditions>) => setC(prev => ({ ...prev, ...partial }));

  return (
    <div className="db-dialog-overlay" onClick={onCancel}>
      <div className="troops-cond-dialog" onClick={e => e.stopPropagation()}>
        <div className="troops-cond-dialog-title">{t('fields.conditions')}</div>
        <div className="troops-cond-dialog-body">
          <div className="troops-cond-row">
            <input type="checkbox" checked={c.turnEnding} onChange={e => up({ turnEnding: e.target.checked })} />
            <span>{t('fields.turnEnd')}</span>
          </div>
          <div className="troops-cond-row">
            <input type="checkbox" checked={c.turnValid} onChange={e => up({ turnValid: e.target.checked })} />
            <span>{t('fields.turn')}</span>
            <input type="number" value={c.turnA} disabled={!c.turnValid} onChange={e => up({ turnA: Number(e.target.value) })} />
            <span>+</span>
            <input type="number" value={c.turnB} disabled={!c.turnValid} onChange={e => up({ turnB: Number(e.target.value) })} />
            <span>* X</span>
          </div>
          <div className="troops-cond-row">
            <input type="checkbox" checked={c.enemyValid} onChange={e => up({ enemyValid: e.target.checked })} />
            <span>{t('fields.enemyNum')}</span>
            <input type="number" value={c.enemyIndex} disabled={!c.enemyValid} onChange={e => up({ enemyIndex: Number(e.target.value) })} />
            <span>HP ≤</span>
            <input type="number" value={c.enemyHp} disabled={!c.enemyValid} onChange={e => up({ enemyHp: Number(e.target.value) })} />
            <span>%</span>
          </div>
          <div className="troops-cond-row">
            <input type="checkbox" checked={c.actorValid} onChange={e => up({ actorValid: e.target.checked })} />
            <span>{t('fields.actor')}</span>
            <select value={c.actorId} disabled={!c.actorValid} onChange={e => up({ actorId: Number(e.target.value) })}>
              {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span>HP ≤</span>
            <input type="number" value={c.actorHp} disabled={!c.actorValid} onChange={e => up({ actorHp: Number(e.target.value) })} />
            <span>%</span>
          </div>
          <div className="troops-cond-row">
            <input type="checkbox" checked={c.switchValid} onChange={e => up({ switchValid: e.target.checked })} />
            <span>{t('fields.switch')}</span>
            <input type="number" value={c.switchId} style={{ width: 60 }} disabled={!c.switchValid} onChange={e => up({ switchId: Number(e.target.value) })} />
          </div>
        </div>
        <div className="troops-cond-dialog-footer">
          <button className="db-btn" onClick={() => onSave(c)}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Background Dialog ───
export function TroopBgDialog({ bb1, bb2, onSave, onCancel }: {
  bb1: string; bb2: string;
  onSave: (bb1: string, bb2: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [editBb1, setEditBb1] = useState(bb1);
  const [editBb2, setEditBb2] = useState(bb2);
  const [bb1Files, setBb1Files] = useState<string[]>([]);
  const [bb2Files, setBb2Files] = useState<string[]>([]);

  useEffect(() => {
    apiClient.get<string[]>('/resources/battlebacks1').then(f => setBb1Files(f.map(n => n.replace(/\.png$/i, '')))).catch(() => {});
    apiClient.get<string[]>('/resources/battlebacks2').then(f => setBb2Files(f.map(n => n.replace(/\.png$/i, '')))).catch(() => {});
  }, []);

  return (
    <div className="db-dialog-overlay" onClick={onCancel}>
      <div className="troops-bg-dialog" onClick={e => e.stopPropagation()}>
        <div className="troops-cond-dialog-title">{t('troops.changeBG')}</div>
        <div className="troops-bg-dialog-body">
          <div className="troops-bg-list-col">
            <div className="troops-bg-list-header">battlebacks1</div>
            <div className="troops-bg-list">
              {bb1Files.map(name => (
                <div key={name} className={`troops-enemy-item${name === editBb1 ? ' selected' : ''}`} onClick={() => setEditBb1(name)}>{name}</div>
              ))}
            </div>
          </div>
          <div className="troops-bg-list-col">
            <div className="troops-bg-list-header">battlebacks2</div>
            <div className="troops-bg-list">
              {bb2Files.map(name => (
                <div key={name} className={`troops-enemy-item${name === editBb2 ? ' selected' : ''}`} onClick={() => setEditBb2(name)}>{name}</div>
              ))}
            </div>
          </div>
          <div className="troops-bg-preview">
            {editBb1 && <img src={`/img/battlebacks1/${editBb1}.png`} alt="" className="troops-bg-preview-img" />}
            {editBb2 && <img src={`/img/battlebacks2/${editBb2}.png`} alt="" className="troops-bg-preview-img" style={{ position: 'absolute', top: 0, left: 0 }} />}
          </div>
        </div>
        <div className="troops-cond-dialog-footer">
          <button className="db-btn" onClick={() => onSave(editBb1, editBb2)}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Condition Summary ───
export function conditionSummary(c: TroopConditions, t: (k: string) => string, actors: { id: number; name: string }[]): string {
  const parts: string[] = [];
  if (c.turnEnding) parts.push(t('fields.turnEnd'));
  if (c.turnValid) parts.push(`${t('fields.turn')} ${c.turnA}+${c.turnB}*X`);
  if (c.enemyValid) parts.push(`${t('fields.enemyNum')} #${c.enemyIndex} HP≤${c.enemyHp}%`);
  if (c.actorValid) {
    const a = actors.find(ac => ac.id === c.actorId);
    parts.push(`${a?.name || t('fields.actor')} HP≤${c.actorHp}%`);
  }
  if (c.switchValid) parts.push(`${t('fields.switch')} ${c.switchId}`);
  return parts.length > 0 ? parts.join(', ') : t('troops.noCondition');
}
