import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { RPGClass } from '../../types/rpgMakerMV';
import TraitsEditor from '../common/TraitsEditor';
import apiClient from '../../api/client';
import TranslateButton from '../common/TranslateButton';

// RPG Maker MV EXP formula: rpg_objects.js line 3524
function expForLevel(level: number, expParams: number[]): number {
  const basis = expParams[0] || 30;
  const extra = expParams[1] || 20;
  const acc_a = expParams[2] || 30;
  const acc_b = expParams[3] || 30;
  return Math.round(
    basis * (Math.pow(level - 1, 0.9 + acc_a / 250)) * level *
    (level + 1) / (6 + Math.pow(level, 2) / 50 / acc_b) + (level - 1) * extra
  );
}

function ExpCurveGraph({ expParams }: { expParams: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    // Compute EXP values for levels 1-99
    const values: number[] = [];
    let maxVal = 0;
    for (let lv = 1; lv <= 99; lv++) {
      const v = expForLevel(lv, expParams);
      values.push(v);
      if (v > maxVal) maxVal = v;
    }
    if (maxVal === 0) maxVal = 1;

    // Draw axes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 5);
    ctx.lineTo(30, H - 20);
    ctx.lineTo(W - 5, H - 20);
    ctx.stroke();

    // Draw curve
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 98; i++) {
      const x = 30 + (i / 97) * (W - 40);
      const y = (H - 25) - (values[i] / maxVal) * (H - 35);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#999';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Lv1', 30, H - 8);
    ctx.fillText('Lv99', W - 10, H - 8);
    ctx.textAlign = 'right';
    ctx.fillText(String(maxVal), 28, 14);
    ctx.fillText('0', 28, H - 22);
  }, [expParams]);

  return <canvas ref={canvasRef} width={280} height={120} style={{ border: '1px solid #444', borderRadius: 3, marginBottom: 8 }} />;
}

function ParamCurveGraph({ params, paramNames }: { params: number[][]; paramNames: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4dd0e1', '#fff176', '#a1887f'];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    if (!params || params.length === 0) return;

    // Find global max across all param arrays
    let maxVal = 0;
    for (const arr of params) {
      if (!arr) continue;
      for (const v of arr) {
        if (v > maxVal) maxVal = v;
      }
    }
    if (maxVal === 0) maxVal = 1;

    // Draw axes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, 5);
    ctx.lineTo(35, H - 30);
    ctx.lineTo(W - 5, H - 30);
    ctx.stroke();

    // Draw each parameter curve
    for (let p = 0; p < Math.min(params.length, 8); p++) {
      const arr = params[p];
      if (!arr || arr.length === 0) continue;
      ctx.strokeStyle = COLORS[p];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const len = arr.length;
      for (let i = 0; i < len; i++) {
        const x = 35 + (i / (len - 1)) * (W - 45);
        const y = (H - 35) - (arr[i] / maxVal) * (H - 45);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Legend
    ctx.font = '8px sans-serif';
    for (let p = 0; p < Math.min(params.length, 8); p++) {
      ctx.fillStyle = COLORS[p];
      const lx = 40 + (p % 4) * 65;
      const ly = H - 18 + Math.floor(p / 4) * 10;
      ctx.fillRect(lx, ly - 5, 6, 6);
      ctx.fillStyle = '#ccc';
      ctx.textAlign = 'left';
      ctx.fillText(paramNames[p] || `P${p}`, lx + 8, ly);
    }

    // Axis labels
    ctx.fillStyle = '#999';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Lv1', 35, H - 20);
    ctx.fillText('Lv99', W - 10, H - 20);
    ctx.textAlign = 'right';
    ctx.fillText(String(maxVal), 33, 14);
  }, [params, paramNames]);

  return <canvas ref={canvasRef} width={280} height={160} style={{ border: '1px solid #444', borderRadius: 3, marginBottom: 8 }} />;
}

interface ClassesTabProps {
  data: (RPGClass | null)[] | undefined;
  onChange: (data: (RPGClass | null)[]) => void;
}

const selectStyle: React.CSSProperties = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, flex: 1 };

export default function ClassesTab({ data, onChange }: ClassesTabProps) {
  const { t } = useTranslation();
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

  const EXP_PARAM_LABELS = [t('expParams.baseValue'), t('expParams.extraValue'), t('expParams.accelerationA'), t('expParams.accelerationB')];
  const PARAM_NAMES = [t('params.maxHP'), t('params.maxMP'), t('params.attack'), t('params.defense'), t('params.mAttack'), t('params.mDefense'), t('params.agility'), t('params.luck')];

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
              {t('common.name')}
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input
                  type="text"
                  value={selectedItem.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  style={{flex:1}}
                />
                <TranslateButton csvPath="database/classes.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
              </div>
            </label>

            <div className="db-form-section">{t('fields.expCurve')}</div>
            <ExpCurveGraph expParams={selectedItem.expParams || [30, 20, 30, 30]} />
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

            <div className="db-form-section">{t('fields.paramCurves')}</div>
            {selectedItem.params && selectedItem.params.length > 0 && (
              <ParamCurveGraph params={selectedItem.params} paramNames={PARAM_NAMES} />
            )}
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
              {t('fields.learnings')}
              <button className="db-btn-small" onClick={addLearning}>+</button>
            </div>
            {(selectedItem.learnings || []).map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ flex: 1 }}>
                  {t('fields.level')}
                  <input
                    type="number"
                    value={l.level}
                    onChange={(e) => handleLearningChange(i, 'level', Number(e.target.value))}
                  />
                </label>
                <label style={{ flex: 2 }}>
                  {t('fields.skill')}
                  <select
                    value={l.skillId}
                    onChange={(e) => handleLearningChange(i, 'skillId', Number(e.target.value))}
                    style={selectStyle}
                  >
                    <option value={0}>{t('common.none')}</option>
                    {skills.map(s => <option key={s.id} value={s.id}>{String(s.id).padStart(4, '0')}: {s.name}</option>)}
                  </select>
                </label>
                <button className="db-btn-small" onClick={() => removeLearning(i)}>-</button>
              </div>
            ))}

            <div className="db-form-section">{t('fields.traits')}</div>
            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits) => handleFieldChange('traits', traits)}
            />

            <label>
              {t('common.note')}
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
