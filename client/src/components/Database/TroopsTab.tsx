import React, { useState } from 'react';
import type { Troop, TroopMember, TroopPage, EventCommand } from '../../types/rpgMakerMV';
import EventCommandEditor from '../EventEditor/EventCommandEditor';

interface TroopsTabProps {
  data: (Troop | null)[] | undefined;
  onChange: (data: (Troop | null)[]) => void;
}

const SPAN_OPTIONS = ['Battle', 'Turn', 'Moment'];

export default function TroopsTab({ data, onChange }: TroopsTabProps) {
  const [selectedId, setSelectedId] = useState(1);
  const [activePage, setActivePage] = useState(0);
  const selectedItem = data?.find((item) => item && item.id === selectedId);

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

  const handleAddNew = () => {
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
  };

  const page = selectedItem?.pages?.[activePage];

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <button className="db-btn-small" onClick={handleAddNew}>+</button>
        </div>
        {data?.filter(Boolean).map((item) => (
          <div
            key={item!.id}
            className={`db-list-item${item!.id === selectedId ? ' selected' : ''}`}
            onClick={() => { setSelectedId(item!.id); setActivePage(0); }}
          >
            {String(item!.id).padStart(4, '0')}: {item!.name}
          </div>
        ))}
      </div>
      <div className="db-form">
        {selectedItem && (
          <>
            <label>
              Name
              <input type="text" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
            </label>

            <div className="db-form-section">
              Members
              <button className="db-btn-small" onClick={addMember}>+</button>
            </div>
            {(selectedItem.members || []).map((member: TroopMember, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                <label style={{ flex: 1 }}>Enemy ID <input type="number" value={member.enemyId} onChange={(e) => handleMemberChange(i, 'enemyId', Number(e.target.value))} /></label>
                <label>X <input type="number" value={member.x} onChange={(e) => handleMemberChange(i, 'x', Number(e.target.value))} style={{ width: 50 }} /></label>
                <label>Y <input type="number" value={member.y} onChange={(e) => handleMemberChange(i, 'y', Number(e.target.value))} style={{ width: 50 }} /></label>
                <label className="db-checkbox-label"><input type="checkbox" checked={member.hidden} onChange={(e) => handleMemberChange(i, 'hidden', e.target.checked)} /> Hidden</label>
                <button className="db-btn-small" onClick={() => removeMember(i)}>-</button>
              </div>
            ))}

            <div className="db-form-section">Battle Events</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
              {(selectedItem.pages || []).map((_: TroopPage, i: number) => (
                <button key={i} className="db-btn-small" style={i === activePage ? { background: '#2675bf', borderColor: '#2675bf', color: '#fff' } : {}} onClick={() => setActivePage(i)}>
                  {i + 1}
                </button>
              ))}
              <button className="db-btn-small" onClick={addPage}>New</button>
              <button className="db-btn-small" onClick={deletePage} disabled={(selectedItem.pages || []).length <= 1}>Del</button>
            </div>

            {page && (
              <>
                <label>
                  Span
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
