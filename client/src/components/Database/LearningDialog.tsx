import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Learning } from '../../types/rpgMakerMV';
import useEscClose from '../../hooks/useEscClose';
import { DataListPicker, IconSprite } from '../EventEditor/dataListPicker';
import './LearningDialog.css';

interface LearningDialogProps {
  learning: Learning;
  skills: { id: number; name: string; iconIndex?: number }[];
  onConfirm: (learning: Learning) => void;
  onCancel: () => void;
}

export default function LearningDialog({ learning: initial, skills, onConfirm, onCancel }: LearningDialogProps) {
  const { t } = useTranslation();
  useEscClose(onCancel);
  const [level, setLevel] = useState(initial.level);
  const [skillId, setSkillId] = useState(initial.skillId);
  const [note, setNote] = useState(initial.note || '');
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  const skillNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of skills) arr[s.id] = s.name;
    return arr;
  }, [skills]);

  const skillIcons = useMemo(() => {
    const arr: (number | undefined)[] = [];
    for (const s of skills) arr[s.id] = s.iconIndex;
    return arr;
  }, [skills]);

  const currentSkill = skills.find(s => s.id === skillId);
  const currentSkillLabel = currentSkill ? `${String(skillId).padStart(4, '0')}: ${currentSkill.name}` : t('common.none');

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
              <button className="db-picker-btn" onClick={() => setShowSkillPicker(true)}>
                {currentSkill?.iconIndex != null && currentSkill.iconIndex > 0 && <IconSprite iconIndex={currentSkill.iconIndex} />}
                <span>{currentSkillLabel}</span>
              </button>
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

      {showSkillPicker && (
        <DataListPicker
          items={skillNames}
          value={skillId}
          onChange={(id) => setSkillId(id)}
          onClose={() => setShowSkillPicker(false)}
          title={t('fields.skill') + ' 선택'}
          iconIndices={skillIcons}
        />
      )}
    </div>
  );
}
