import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AddonCommandDef, AddonSubCommand } from './addonCommands';
import { buildAddonCommandText, matchAddonCommand } from './addonCommands';
import './AddonCommandEditor.css';

interface AddonCommandEditorProps {
  def: AddonCommandDef;
  initialSubCmd?: AddonSubCommand;
  initialParamValues?: string[];
  onOk: (params: unknown[]) => void;
  onCancel: () => void;
}

export default function AddonCommandEditor({ def, initialSubCmd, initialParamValues, onOk, onCancel }: AddonCommandEditorProps) {
  const { t } = useTranslation();

  const [selectedSubIdx, setSelectedSubIdx] = useState(() => {
    if (initialSubCmd) {
      const idx = def.subCommands.indexOf(initialSubCmd);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  const subCmd = def.subCommands[selectedSubIdx];

  const getParamDefault = (p: typeof subCmd.params[0]) =>
    p.type === 'color' ? (p.defaultColor ?? '#000000') : String(p.default ?? '');

  const [paramValues, setParamValues] = useState<string[]>(() => {
    if (initialParamValues && initialParamValues.length > 0) {
      return subCmd.params.map((p, i) =>
        initialParamValues[i] !== undefined ? initialParamValues[i] : getParamDefault(p)
      );
    }
    return subCmd.params.map(getParamDefault);
  });

  const handleSubCmdChange = (idx: number) => {
    setSelectedSubIdx(idx);
    const newSub = def.subCommands[idx];
    setParamValues(newSub.params.map(p => p.type === 'color' ? (p.defaultColor ?? '#000000') : String(p.default ?? '')));
  };

  const handleParamChange = (idx: number, value: string) => {
    const next = [...paramValues];
    next[idx] = value;
    setParamValues(next);
  };

  const handleOk = () => {
    const text = buildAddonCommandText(def.pluginCommand, subCmd.id, paramValues);
    onOk([text]);
  };

  return (
    <>
      <div className="addon-cmd-row">
        <label className="addon-cmd-label">{t('addonCommands.subCommand')}</label>
        <select
          className="addon-cmd-select"
          value={selectedSubIdx}
          onChange={e => handleSubCmdChange(Number(e.target.value))}
        >
          {def.subCommands.map((sc, i) => (
            <option key={sc.id} value={i}>{t(sc.label)}</option>
          ))}
        </select>
      </div>

      {subCmd.params.length > 0 && (
        <div className="addon-cmd-params">
          {subCmd.params.map((param, i) => (
            <div key={param.name} className="addon-cmd-row">
              <label className="addon-cmd-label">{t(param.label)}</label>
              {param.type === 'color' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="color"
                    value={paramValues[i] ?? '#000000'}
                    onChange={e => handleParamChange(i, e.target.value)}
                    style={{ width: 36, height: 28, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    className="addon-cmd-input"
                    value={paramValues[i] ?? ''}
                    onChange={e => handleParamChange(i, e.target.value)}
                    style={{ width: 90 }}
                    placeholder="#RRGGBB"
                  />
                </div>
              ) : (
                <input
                  type="number"
                  className="addon-cmd-input"
                  value={paramValues[i] ?? ''}
                  min={param.min}
                  max={param.max}
                  step={param.step ?? (param.type === 'float' ? 0.1 : 1)}
                  onChange={e => handleParamChange(i, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="addon-cmd-preview">
        <label className="addon-cmd-label">{t('addonCommands.preview')}</label>
        <code className="addon-cmd-preview-text">
          {buildAddonCommandText(def.pluginCommand, subCmd.id, paramValues)}
        </code>
      </div>

      <div className="addon-cmd-footer">
        <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
        <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </>
  );
}

/** 기존 356 텍스트를 파싱하여 AddonCommandEditor용 props를 생성 */
export function parseAddonProps(text: string): {
  def: AddonCommandDef;
  initialSubCmd: AddonSubCommand;
  initialParamValues: string[];
} | null {
  const match = matchAddonCommand(text);
  if (!match) return null;
  return {
    def: match.def,
    initialSubCmd: match.subCmd,
    initialParamValues: match.paramValues,
  };
}
