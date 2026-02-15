import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { RPGClass, Learning } from '../../types/rpgMakerMV';
import TraitsEditor from '../common/TraitsEditor';
import apiClient from '../../api/client';
import TranslateButton from '../common/TranslateButton';
import ParamCurveDialog from './ParamCurveDialog';
import ExpCurveDialog from './ExpCurveDialog';
import LearningDialog from './LearningDialog';

const PARAM_COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4dd0e1', '#fff176', '#a1887f'];

// Single param mini graph (one per parameter)
function SingleParamGraph({ values, color, label }: { values: number[]; color: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    if (!values || values.length === 0) return;

    let maxVal = 0;
    for (const v of values) {
      if (v > maxVal) maxVal = v;
    }
    if (maxVal === 0) maxVal = 1;

    const padL = 4, padR = 4, padT = 4, padB = 4;
    const gW = W - padL - padR;
    const gH = H - padT - padB;

    // Fill under curve
    ctx.fillStyle = color + '50';
    ctx.beginPath();
    ctx.moveTo(padL, padT + gH);
    for (let i = 0; i < values.length; i++) {
      const x = padL + (i / (values.length - 1)) * gW;
      const y = padT + gH - (values[i] / maxVal) * gH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padL + gW, padT + gH);
    ctx.closePath();
    ctx.fill();

    // Curve line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = padL + (i / (values.length - 1)) * gW;
      const y = padT + gH - (values[i] / maxVal) * gH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [values, color]);

  return (
    <div className="classes-param-mini">
      <div className="classes-param-mini-label" style={{ color }}>{label}</div>
      <canvas ref={canvasRef} width={140} height={60} className="classes-param-mini-canvas" />
    </div>
  );
}

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

// EXP mini graph for the main classes tab
function ExpMiniGraph({ expParams }: { expParams: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    const values: number[] = [];
    let maxVal = 0;
    for (let lv = 1; lv <= 99; lv++) {
      const v = expForLevel(lv, expParams);
      values.push(v);
      if (v > maxVal) maxVal = v;
    }
    if (maxVal === 0) maxVal = 1;

    const padL = 4, padR = 4, padT = 4, padB = 4;
    const gW = W - padL - padR;
    const gH = H - padT - padB;

    ctx.fillStyle = '#4fc3f750';
    ctx.beginPath();
    ctx.moveTo(padL, padT + gH);
    for (let i = 0; i < 98; i++) {
      const x = padL + (i / 97) * gW;
      const y = padT + gH - (values[i] / maxVal) * gH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padL + gW, padT + gH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 98; i++) {
      const x = padL + (i / 97) * gW;
      const y = padT + gH - (values[i] / maxVal) * gH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [expParams]);

  return <canvas ref={canvasRef} width={140} height={60} className="classes-param-mini-canvas" />;
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
  const [showParamCurve, setShowParamCurve] = useState<number | null>(null); // null=closed, number=initial tab index
  const [showExpCurve, setShowExpCurve] = useState(false);
  const [editingLearning, setEditingLearning] = useState<{ index: number; learning: Learning } | null>(null);
  const [selectedLearningIdx, setSelectedLearningIdx] = useState(-1);

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
            <div className="db-form-row">
              <label style={{ flex: 1 }}>
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
              <label>
                {t('fields.expCurve')}
                <div
                  className="classes-exp-mini-wrap"
                  onClick={() => setShowExpCurve(true)}
                  title={t('paramCurve.clickToEdit', '클릭하여 편집')}
                >
                  <span className="classes-exp-mini-values">[{(selectedItem.expParams || [30, 20, 30, 30]).join(', ')}]</span>
                </div>
              </label>
            </div>

            <div className="db-form-section">{t('fields.paramCurves')}</div>
            <div className="classes-param-grid">
              {selectedItem.params && PARAM_NAMES.map((name, i) => (
                <div
                  key={i}
                  className="classes-param-mini-wrap"
                  onClick={() => setShowParamCurve(i)}
                  title={t('paramCurve.clickToEdit', '클릭하여 편집')}
                >
                  <SingleParamGraph
                    values={selectedItem.params[i] || []}
                    color={PARAM_COLORS[i]}
                    label={name}
                  />
                </div>
              ))}
            </div>

            <div className="db-form-section">
              {t('fields.learnings')}
              <button className="db-btn-small" onClick={() => {
                addLearning();
                const newIdx = (selectedItem.learnings || []).length;
                setEditingLearning({ index: newIdx, learning: { level: 1, skillId: 1, note: '' } });
              }}>+</button>
              <button className="db-btn-small" onClick={() => {
                if (selectedLearningIdx >= 0) removeLearning(selectedLearningIdx);
                setSelectedLearningIdx(-1);
              }}>-</button>
            </div>
            <div className="classes-learnings-table">
              <div className="classes-learnings-header">
                <span className="classes-learnings-col-lv">{t('fields.level')}</span>
                <span className="classes-learnings-col-skill">{t('fields.skill')}</span>
                <span className="classes-learnings-col-note">{t('common.note')}</span>
              </div>
              <div className="classes-learnings-body">
                {(selectedItem.learnings || []).map((l, i) => {
                  const skillName = skills.find(s => s.id === l.skillId)?.name || '';
                  return (
                    <div
                      key={i}
                      className={`classes-learnings-row${i === selectedLearningIdx ? ' selected' : ''}`}
                      onClick={() => setSelectedLearningIdx(i)}
                      onDoubleClick={() => setEditingLearning({ index: i, learning: { ...l } })}
                    >
                      <span className="classes-learnings-col-lv">Lv {l.level}</span>
                      <span className="classes-learnings-col-skill">{String(l.skillId).padStart(4, '0')} {skillName}</span>
                      <span className="classes-learnings-col-note">{l.note || ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

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
      {showParamCurve !== null && selectedItem && (
        <ParamCurveDialog
          params={selectedItem.params || Array.from({ length: 8 }, () => new Array(99).fill(0))}
          initialTab={showParamCurve}
          onConfirm={(newParams) => {
            handleFieldChange('params', newParams);
            setShowParamCurve(null);
          }}
          onCancel={() => setShowParamCurve(null)}
        />
      )}
      {showExpCurve && selectedItem && (
        <ExpCurveDialog
          expParams={selectedItem.expParams || [30, 20, 30, 30]}
          onConfirm={(newExpParams) => {
            handleFieldChange('expParams', newExpParams);
            setShowExpCurve(false);
          }}
          onCancel={() => setShowExpCurve(false)}
        />
      )}
      {editingLearning !== null && (
        <LearningDialog
          learning={editingLearning.learning}
          skills={skills}
          onConfirm={(updated) => {
            const learnings = [...(selectedItem?.learnings || [])];
            learnings[editingLearning.index] = updated;
            handleFieldChange('learnings', learnings);
            setEditingLearning(null);
          }}
          onCancel={() => setEditingLearning(null)}
        />
      )}
    </div>
  );
}
