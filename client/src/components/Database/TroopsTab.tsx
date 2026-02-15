import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Troop, TroopMember, TroopPage, EventCommand } from '../../types/rpgMakerMV';
import EventCommandEditor from '../EventEditor/EventCommandEditor';
import DatabaseList from './DatabaseList';
import apiClient from '../../api/client';

interface TroopsTabProps {
  data: (Troop | null)[] | undefined;
  onChange: (data: (Troop | null)[]) => void;
}

interface RefItem { id: number; name: string }

const selectStyle: React.CSSProperties = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, width: '100%' };

export default function TroopsTab({ data, onChange }: TroopsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const [activePage, setActivePage] = useState(0);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [enemies, setEnemies] = useState<RefItem[]>([]);
  const [actors, setActors] = useState<RefItem[]>([]);

  const SPAN_OPTIONS = [t('spanOptions.battle'), t('spanOptions.turn'), t('spanOptions.moment')];

  useEffect(() => {
    apiClient.get<(RefItem | null)[]>('/database/enemies').then(d => setEnemies(d.filter(Boolean) as RefItem[])).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/actors').then(d => setActors(d.filter(Boolean) as RefItem[])).catch(() => {});
  }, []);

  const handleFieldChange = (field: keyof Troop, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleMemberChange = (index: number, field: keyof TroopMember, value: number | boolean) => {
    const members = [...(selectedItem?.members || [])];
    members[index] = { ...members[index], [field]: value };
    handleFieldChange('members', members);
  };

  const addMember = () => {
    handleFieldChange('members', [...(selectedItem?.members || []), { enemyId: 1, x: 200, y: 200, hidden: false }]);
  };

  const removeMember = (index: number) => {
    handleFieldChange('members', (selectedItem?.members || []).filter((_: unknown, i: number) => i !== index));
  };

  const handlePageChange = (pageIdx: number, field: keyof TroopPage, value: unknown) => {
    const pages = [...(selectedItem?.pages || [])];
    pages[pageIdx] = { ...pages[pageIdx], [field]: value };
    handleFieldChange('pages', pages);
  };

  const addPage = () => {
    const newPage: TroopPage = {
      conditions: {
        actorHp: 0, actorId: 1, actorValid: false,
        enemyHp: 0, enemyIndex: 0, enemyValid: false,
        switchId: 1, switchValid: false,
        turnA: 0, turnB: 0, turnEnding: false, turnValid: false,
      },
      span: 0,
      list: [{ code: 0, indent: 0, parameters: [] }],
    };
    handleFieldChange('pages', [...(selectedItem?.pages || []), newPage]);
    setActivePage((selectedItem?.pages || []).length);
  };

  const deletePage = () => {
    const pages = selectedItem?.pages || [];
    if (pages.length <= 1) return;
    handleFieldChange('pages', pages.filter((_: unknown, i: number) => i !== activePage));
    setActivePage(Math.min(activePage, pages.length - 2));
  };

  const handleAddNew = useCallback(() => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newTroop: Troop = {
      id: maxId + 1, name: '', members: [],
      pages: [{ conditions: { actorHp: 0, actorId: 1, actorValid: false, enemyHp: 0, enemyIndex: 0, enemyValid: false, switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false }, span: 0, list: [{ code: 0, indent: 0, parameters: [] }] }],
    };
    const newData = [...data];
    while (newData.length <= maxId + 1) newData.push(null);
    newData[maxId + 1] = newTroop;
    onChange(newData);
    setSelectedId(maxId + 1);
  }, [data, onChange]);

  const handleDelete = useCallback((id: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Troop[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== id);
    onChange(newData);
    if (id === selectedId) {
      const remaining = newData.filter(Boolean) as Troop[];
      if (remaining.length > 0) setSelectedId(remaining[0].id);
    }
  }, [data, onChange, selectedId]);

  const handleDuplicate = useCallback((id: number) => {
    if (!data) return;
    const source = data.find((item) => item && item.id === id);
    if (!source) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newId = maxId + 1;
    const newData = [...data];
    while (newData.length <= newId) newData.push(null);
    newData[newId] = {
      ...source, id: newId,
      members: source.members.map(m => ({ ...m })),
      pages: source.pages.map(p => ({ ...p, conditions: { ...p.conditions }, list: p.list.map(c => ({ ...c, parameters: [...c.parameters] })) })),
    };
    onChange(newData);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleReorder = useCallback((fromId: number, toId: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Troop[];
    const fromIdx = items.findIndex(item => item.id === fromId);
    if (fromIdx < 0) return;
    const [moved] = items.splice(fromIdx, 1);
    if (toId === -1) {
      items.push(moved);
    } else {
      const toIdx = items.findIndex(item => item.id === toId);
      if (toIdx < 0) items.push(moved);
      else items.splice(toIdx, 0, moved);
    }
    onChange([null, ...items]);
  }, [data, onChange]);

  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
    setActivePage(0);
  }, []);

  const page = selectedItem?.pages?.[activePage];

  return (
    <div className="db-tab-layout">
      <DatabaseList
        items={data}
        selectedId={selectedId}
        onSelect={handleSelect}
        onAdd={handleAddNew}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
      />
      <div className="db-form">
        {selectedItem && (
          <>
            <label>
              {t('common.name')}
              <input type="text" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
            </label>

            <div className="db-form-section">
              {t('fields.members')}
              <button className="db-btn-small" onClick={addMember}>+</button>
            </div>
            {(selectedItem.members || []).map((member: TroopMember, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                <label style={{ flex: 2 }}>{t('fields.enemy')} <select value={member.enemyId} onChange={(e) => handleMemberChange(i, 'enemyId', Number(e.target.value))} style={selectStyle}>
                  <option value={0}>{t('common.none')}</option>
                  {enemies.map(en => <option key={en.id} value={en.id}>{String(en.id).padStart(4, '0')}: {en.name}</option>)}
                </select></label>
                <label>X <input type="number" value={member.x} onChange={(e) => handleMemberChange(i, 'x', Number(e.target.value))} style={{ width: 50 }} /></label>
                <label>Y <input type="number" value={member.y} onChange={(e) => handleMemberChange(i, 'y', Number(e.target.value))} style={{ width: 50 }} /></label>
                <label className="db-checkbox-label"><input type="checkbox" checked={member.hidden} onChange={(e) => handleMemberChange(i, 'hidden', e.target.checked)} /> {t('fields.hidden')}</label>
                <button className="db-btn-small" onClick={() => removeMember(i)}>-</button>
              </div>
            ))}

            <div className="db-form-section">{t('fields.battleEvents')}</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
              {(selectedItem.pages || []).map((_: TroopPage, i: number) => (
                <button key={i} className="db-btn-small" style={i === activePage ? { background: '#2675bf', borderColor: '#2675bf', color: '#fff' } : {}} onClick={() => setActivePage(i)}>
                  {i + 1}
                </button>
              ))}
              <button className="db-btn-small" onClick={addPage}>{t('common.new')}</button>
              <button className="db-btn-small" onClick={deletePage} disabled={(selectedItem.pages || []).length <= 1}>{t('common.del')}</button>
            </div>

            {page && (
              <>
                <div className="db-form-section">{t('fields.conditions')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                  <label className="db-checkbox-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={page.conditions?.turnValid ?? false}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, turnValid: e.target.checked })} />
                    {t('fields.turn')}
                    <input type="number" value={page.conditions?.turnA ?? 0} style={{ width: 40 }} disabled={!page.conditions?.turnValid}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, turnA: Number(e.target.value) })} />
                    +
                    <input type="number" value={page.conditions?.turnB ?? 0} style={{ width: 40 }} disabled={!page.conditions?.turnValid}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, turnB: Number(e.target.value) })} />
                    x
                  </label>
                  <label className="db-checkbox-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={page.conditions?.enemyValid ?? false}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, enemyValid: e.target.checked })} />
                    {t('fields.enemyNum')}{' '}
                    <input type="number" value={page.conditions?.enemyIndex ?? 0} style={{ width: 40 }} disabled={!page.conditions?.enemyValid}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, enemyIndex: Number(e.target.value) })} />
                    HP &le;
                    <input type="number" value={page.conditions?.enemyHp ?? 0} style={{ width: 40 }} disabled={!page.conditions?.enemyValid}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, enemyHp: Number(e.target.value) })} />
                    %
                  </label>
                  <label className="db-checkbox-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={page.conditions?.actorValid ?? false}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, actorValid: e.target.checked })} />
                    {t('fields.actor')}
                    <select value={page.conditions?.actorId ?? 1} style={{ ...selectStyle, width: 120 }} disabled={!page.conditions?.actorValid}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, actorId: Number(e.target.value) })}>
                      {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    HP &le;
                    <input type="number" value={page.conditions?.actorHp ?? 0} style={{ width: 40 }} disabled={!page.conditions?.actorValid}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, actorHp: Number(e.target.value) })} />
                    %
                  </label>
                  <label className="db-checkbox-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={page.conditions?.switchValid ?? false}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, switchValid: e.target.checked })} />
                    {t('fields.switch')}
                    <input type="number" value={page.conditions?.switchId ?? 1} style={{ width: 60 }} disabled={!page.conditions?.switchValid}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, switchId: Number(e.target.value) })} />
                  </label>
                  <label className="db-checkbox-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={page.conditions?.turnEnding ?? false}
                      onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, turnEnding: e.target.checked })} />
                    {t('fields.turnEnd')}
                  </label>
                </div>

                <label>
                  {t('fields.span')}
                  <select value={page.span || 0} onChange={(e) => handlePageChange(activePage, 'span', Number(e.target.value))}>
                    {SPAN_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
                  </select>
                </label>
                <EventCommandEditor
                  commands={page.list || []}
                  onChange={(cmds) => handlePageChange(activePage, 'list', cmds)}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
