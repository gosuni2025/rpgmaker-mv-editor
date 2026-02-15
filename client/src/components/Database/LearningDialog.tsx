import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Learning } from '../../types/rpgMakerMV';
import useEscClose from '../../hooks/useEscClose';
import './LearningDialog.css';

interface LearningDialogProps {
  learning: Learning;
  skills: { id: number; name: string }[];
  onConfirm: (learning: Learning) => void;
  onCancel: () => void;
}

export default function LearningDialog({ learning: initial, skills, onConfirm, onCancel }: LearningDialogProps) {
  const { t } = useTranslation();
  useEscClose(onCancel);
  const [level, setLevel] = useState(initial.level);
  const [skillId, setSkillId] = useState(initial.skillId);
  const [note, setNote] = useState(initial.note || '');

  const handleConfirm = () => {
    onConfirm({ level, skillId, note });
  };

  return (
    <div className="learning-dialog-overlay">
      <div className="learning-dialog">
        <div className="learning-dialog-header">
          {t('fields.learnings')}
        </div>
        <div className="learning-dialog-body">
          <div className="learning-dialog-section">{t('fields.learnings')}</div>
          <div className="learning-dialog-row">
            <label className="learning-dialog-field">
              {t('fields.level')}:
              <input
                type="number"
                value={level}
                min={1}
                max={99}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="learning-dialog-input learning-dialog-level"
              />
            </label>
            <label className="learning-dialog-field" style={{ flex: 1 }}>
              {t('fields.skill')}:
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <select
                  value={skillId}
                  onChange={(e) => setSkillId(Number(e.target.value))}
                  className="learning-dialog-select"
                >
                  <option value={0}>{t('common.none')}</option>
                  {skills.map(s => (
                    <option key={s.id} value={s.id}>{String(s.id).padStart(4, '0')} {s.name}</option>
                  ))}
                </select>
              </div>
            </label>
          </div>
          <label className="learning-dialog-field">
            {t('common.note')}:
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="learning-dialog-textarea"
              rows={3}
            />
          </label>
        </div>
        <div className="learning-dialog-footer">
          <button className="db-btn" onClick={handleConfirm}>OK</button>
          <button className="db-btn" onClick={onCancel}>{t('common.cancel', '취소')}</button>
        </div>
      </div>
    </div>
  );
}
