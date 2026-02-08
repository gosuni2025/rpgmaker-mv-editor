import React, { useState, useEffect } from 'react';
import type { RPGClass } from '../../types/rpgMakerMV';
import TraitsEditor from '../common/TraitsEditor';
import apiClient from '../../api/client';

interface ClassesTabProps {
  data: (RPGClass | null)[] | undefined;
  onChange: (data: (RPGClass | null)[]) => void;
}

const selectStyle: React.CSSProperties = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, flex: 1 };

const EXP_PARAM_LABELS = ['Base Value', 'Extra Value', 'Acceleration A', 'Acceleration B'];

export default function ClassesTab({ data, onChange }: ClassesTabProps) {
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [skills, setSkills] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    apiClient.get<({ id: number; name: string } | null)[]>('/database/skills').then(d => {
      setSkills((d.filter(Boolean) as { id: number; name: string }[]));
    }).catch(() => {});
  }, []);

  const handleFieldChange = (field: keyof RPGClass, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleLearningChange = (index: number, field: string, value: number | string) => {
    if (!selectedItem) return;
    const learnings = [...(selectedItem.learnings || [])];
    learnings[index] = { ...learnings[index], [field]: value };
    handleFieldChange('learnings', learnings);
  };

  const addLearning = () => {
    const learnings = [...(selectedItem?.learnings || []), { level: 1, skillId: 1, note: '' }];
    handleFieldChange('learnings', learnings);
  };

  const removeLearning = (index: number) => {
    const learnings = (selectedItem?.learnings || []).filter((_: unknown, i: number) => i !== index);
    handleFieldChange('learnings', learnings);
  };

  const addNewClass = () => {
    if (!data) return;
    const existing = data.filter(Boolean) as RPGClass[];
    const maxId = existing.length > 0 ? Math.max(...existing.map(c => c.id)) : 0;
    const defaultParams = Array.from({ length: 8 }, () => {
      const arr = new Array(99).fill(0);
      arr[0] = 1;
      return arr;
    });
    const newClass: RPGClass = {
      id: maxId + 1,
      name: '',
      expParams: [30, 20, 30, 30],
      params: defaultParams,
      learnings: [],
      traits: [],
      note: '',
    };
    const newData = [...data, newClass];
    onChange(newData);
    setSelectedId(newClass.id);
  };

  const PARAM_NAMES = ['Max HP', 'Max MP', 'Attack', 'Defense', 'M.Attack', 'M.Defense', 'Agility', 'Luck'];

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <button className="db-btn-small" onClick={addNewClass}>+</button>
        </div>
        {data?.filter(Boolean).map((item) => (
          <div
            key={item!.id}
            className={`db-list-item${item!.id === selectedId ? ' selected' : ''}`}
            onClick={() => setSelectedId(item!.id)}
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
              <input
                type="text"
                value={selectedItem.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
              />
            </label>

            <div className="db-form-section">EXP Curve</div>
            {(selectedItem.expParams || []).map((val: number, i: number) => (
              <label key={i}>
                {EXP_PARAM_LABELS[i] || `Param ${i + 1}`}
                <input
                  type="number"
                  value={val}
                  onChange={(e) => {
                    const expParams = [...(selectedItem.expParams || [])];
                    expParams[i] = Number(e.target.value);
                    handleFieldChange('expParams', expParams);
                  }}
                />
              </label>
            ))}

            <div className="db-form-section">Parameter Curves (Level 1 / Level 99)</div>
            {selectedItem.params && selectedItem.params.length > 0 && PARAM_NAMES.map((name, i) => (
              <label key={i}>
                {name}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    value={selectedItem.params[i]?.[0] ?? 0}
                    onChange={(e) => {
                      const params = selectedItem.params.map((p: number[]) => [...p]);
                      if (!params[i]) params[i] = [0, 0];
                      params[i][0] = Number(e.target.value);
                      handleFieldChange('params', params);
                    }}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    value={selectedItem.params[i]?.[selectedItem.params[i].length - 1] ?? 0}
                    onChange={(e) => {
                      const params = selectedItem.params.map((p: number[]) => [...p]);
                      if (!params[i]) params[i] = [0, 0];
                      params[i][params[i].length - 1] = Number(e.target.value);
                      handleFieldChange('params', params);
                    }}
                    style={{ flex: 1 }}
                  />
                </div>
              </label>
            ))}

            <div className="db-form-section">
              Learnings
              <button className="db-btn-small" onClick={addLearning}>+</button>
            </div>
            {(selectedItem.learnings || []).map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ flex: 1 }}>
                  Level
                  <input
                    type="number"
                    value={l.level}
                    onChange={(e) => handleLearningChange(i, 'level', Number(e.target.value))}
                  />
                </label>
                <label style={{ flex: 2 }}>
                  Skill
                  <select
                    value={l.skillId}
                    onChange={(e) => handleLearningChange(i, 'skillId', Number(e.target.value))}
                    style={selectStyle}
                  >
                    <option value={0}>(None)</option>
                    {skills.map(s => <option key={s.id} value={s.id}>{String(s.id).padStart(4, '0')}: {s.name}</option>)}
                  </select>
                </label>
                <button className="db-btn-small" onClick={() => removeLearning(i)}>-</button>
              </div>
            ))}

            <div className="db-form-section">Traits</div>
            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits) => handleFieldChange('traits', traits)}
            />

            <label>
              Note
              <textarea
                value={selectedItem.note || ''}
                onChange={(e) => handleFieldChange('note', e.target.value)}
                rows={3}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
