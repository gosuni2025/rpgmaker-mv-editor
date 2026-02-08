import React, { useState } from 'react';
import type { SystemData } from '../../types/rpgMakerMV';

interface TermsTabProps {
  data: SystemData | undefined;
  onChange: (data: SystemData) => void;
}

type TermSection = 'basic' | 'commands' | 'params' | 'messages';

const SECTIONS: { key: TermSection; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'commands', label: 'Commands' },
  { key: 'params', label: 'Params' },
  { key: 'messages', label: 'Messages' },
];

const BASIC_KEYS = [
  'level', 'levelA', 'hp', 'hpA', 'mp', 'mpA', 'tp', 'tpA', 'exp', 'expA',
];

const COMMAND_KEYS = [
  'fight', 'escape', 'attack', 'guard', 'item', 'skill',
  'equip', 'status', 'formation', 'save', 'gameEnd',
  'options', 'weapon', 'armor', 'keyItem', 'equip2',
  'optimize', 'clear', 'newGame', 'continue_', 'toTitle', 'cancel',
  'buy', 'sell',
];

const PARAM_KEYS = [
  'mhp', 'mmp', 'atk', 'def', 'mat', 'mdf', 'agi', 'luk',
  'hit', 'eva',
];

const MESSAGE_KEYS = [
  'alwaysDash', 'commandRemember', 'bgmVolume', 'bgsVolume',
  'meVolume', 'seVolume', 'possession', 'expTotal', 'expNext',
  'saveMessage', 'loadMessage', 'file', 'partyName',
  'emerge', 'preemptive', 'surprise', 'escapeStart', 'escapeFailure',
  'victory', 'defeat', 'obtainExp', 'obtainGold', 'obtainItem',
  'levelUp', 'obtainSkill', 'useItem',
  'criticalToEnemy', 'criticalToActor', 'actorDamage', 'actorRecovery',
  'actorGain', 'actorLoss', 'actorDrain', 'actorNoDamage', 'actorNoHit',
  'enemyDamage', 'enemyRecovery', 'enemyGain', 'enemyLoss',
  'enemyDrain', 'enemyNoDamage', 'enemyNoHit',
  'evasion', 'magicEvasion', 'magicReflection', 'counterAttack',
  'substitute', 'buffAdd', 'debuffAdd', 'buffRemove',
  'actionFailure',
];

export default function TermsTab({ data, onChange }: TermsTabProps) {
  const [activeSection, setActiveSection] = useState<TermSection>('basic');

  if (!data) return null;

  const terms = (data.terms || {}) as Record<string, unknown>;

  const getKeys = (): string[] => {
    switch (activeSection) {
      case 'basic': return BASIC_KEYS;
      case 'commands': return COMMAND_KEYS;
      case 'params': return PARAM_KEYS;
      case 'messages': return MESSAGE_KEYS;
      default: return [];
    }
  };

  const getSection = (): Record<string, string> => {
    if (activeSection === 'basic' || activeSection === 'commands' || activeSection === 'params') {
      return (terms[activeSection] || {}) as Record<string, string>;
    }
    return (terms.messages || {}) as Record<string, string>;
  };

  const handleTermChange = (key: string, value: string) => {
    const sectionKey = activeSection === 'messages' ? 'messages' : activeSection;
    const section = { ...getSection(), [key]: value };
    const newTerms = { ...terms, [sectionKey]: section };
    onChange({ ...data, terms: newTerms });
  };

  const keys = getKeys();
  const section = getSection();

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        {SECTIONS.map((s) => (
          <div
            key={s.key}
            className={`db-list-item${activeSection === s.key ? ' selected' : ''}`}
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
          </div>
        ))}
      </div>
      <div className="db-form">
        <div className="db-form-section">
          {SECTIONS.find((s) => s.key === activeSection)?.label}
        </div>
        {keys.map((key) => (
          <label key={key}>
            {key}
            <input
              type="text"
              value={(section[key] as string) || ''}
              onChange={(e) => handleTermChange(key, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
