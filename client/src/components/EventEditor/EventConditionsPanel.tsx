import React from 'react';
import { useTranslation } from 'react-i18next';
import type { EventConditions } from '../../types/rpgMakerMV';
import { VariableSwitchPicker } from './VariableSwitchSelector';

interface EventConditionsPanelProps {
  conditions: EventConditions;
  updateConditions: (changes: Partial<EventConditions>) => void;
}

export default function EventConditionsPanel({ conditions, updateConditions }: EventConditionsPanelProps) {
  const { t } = useTranslation();
  return (
    <fieldset className="event-editor-fieldset">
      <legend>{t('fields.conditions')}</legend>
      <div className="event-editor-condition-row">
        <label className="event-editor-cond-label"><input type="checkbox" checked={conditions.switch1Valid} onChange={e => updateConditions({ switch1Valid: e.target.checked })} />{t('eventDetail.conditionSwitch1')}</label>
        <VariableSwitchPicker type="switch" value={conditions.switch1Id} onChange={id => updateConditions({ switch1Id: id })} disabled={!conditions.switch1Valid} style={{ flex: 1 }} />
      </div>
      <div className="event-editor-condition-row">
        <label className="event-editor-cond-label"><input type="checkbox" checked={conditions.switch2Valid} onChange={e => updateConditions({ switch2Valid: e.target.checked })} />{t('eventDetail.conditionSwitch2')}</label>
        <VariableSwitchPicker type="switch" value={conditions.switch2Id} onChange={id => updateConditions({ switch2Id: id })} disabled={!conditions.switch2Valid} style={{ flex: 1 }} />
      </div>
      <div className="event-editor-condition-row">
        <label className="event-editor-cond-label"><input type="checkbox" checked={conditions.variableValid} onChange={e => updateConditions({ variableValid: e.target.checked })} />{t('eventDetail.conditionVariable')}</label>
        <VariableSwitchPicker type="variable" value={conditions.variableId} onChange={id => updateConditions({ variableId: id })} disabled={!conditions.variableValid} style={{ flex: 1 }} />
        <span className="event-editor-cond-op">&ge;</span>
        <input type="number" value={conditions.variableValue} onChange={e => updateConditions({ variableValue: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!conditions.variableValid} />
      </div>
      <div className="event-editor-condition-row">
        <label className="event-editor-cond-label"><input type="checkbox" checked={conditions.selfSwitchValid} onChange={e => updateConditions({ selfSwitchValid: e.target.checked })} />{t('eventDetail.conditionSelfSwitch')}</label>
        <select value={conditions.selfSwitchCh} onChange={e => updateConditions({ selfSwitchCh: e.target.value })} className="event-editor-select" disabled={!conditions.selfSwitchValid}>
          {['A', 'B', 'C', 'D'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
        </select>
      </div>
      <div className="event-editor-condition-row">
        <label className="event-editor-cond-label"><input type="checkbox" checked={conditions.itemValid} onChange={e => updateConditions({ itemValid: e.target.checked })} />{t('eventDetail.conditionItem')}</label>
        <input type="number" value={conditions.itemId} onChange={e => updateConditions({ itemId: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!conditions.itemValid} />
      </div>
      <div className="event-editor-condition-row">
        <label className="event-editor-cond-label"><input type="checkbox" checked={conditions.actorValid} onChange={e => updateConditions({ actorValid: e.target.checked })} />{t('eventDetail.conditionActor')}</label>
        <input type="number" value={conditions.actorId} onChange={e => updateConditions({ actorId: Number(e.target.value) })} className="event-editor-input event-editor-input-sm" disabled={!conditions.actorValid} />
      </div>
    </fieldset>
  );
}
