import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AddonCommandDef, AddonSubCommand } from './addonCommands';
import { buildAddonCommandText, matchAddonCommand } from './addonCommands';
import { SHADER_DEFINITIONS } from './shaderDefinitions';
import { MapLocationPicker } from './MapLocationPicker';
import useEditorStore from '../../store/useEditorStore';
import './AddonCommandEditor.css';

interface AddonCommandEditorProps {
  def: AddonCommandDef;
  initialSubCmd?: AddonSubCommand;
  initialParamValues?: string[];
  initialDuration?: string;
  onOk: (params: unknown[]) => void;
  onCancel: () => void;
}

export default function AddonCommandEditor({ def, initialSubCmd, initialParamValues, initialDuration, onOk, onCancel }: AddonCommandEditorProps) {
  const { t } = useTranslation();
  const currentMapId = useEditorStore(s => s.currentMapId);
  const currentMap = useEditorStore(s => s.currentMap);

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

  const [applyMode, setApplyMode] = useState<'instant' | 'interpolate'>(() =>
    initialDuration && parseFloat(initialDuration) > 0 ? 'interpolate' : 'instant'
  );
  const [duration, setDuration] = useState(() =>
    initialDuration && parseFloat(initialDuration) > 0 ? initialDuration : '1'
  );
  const [showLightPicker, setShowLightPicker] = useState<number | null>(null); // param index

  // 맵 오브젝트 목록
  const mapObjects = useMemo(() => {
    const objs = currentMap?.objects;
    if (!objs || !Array.isArray(objs)) return [];
    return objs.filter((o: any) => o != null).map((o: any) => ({
      id: o.id as number,
      name: (o.name || '') as string,
      imageName: (o.imageName || '') as string,
    }));
  }, [currentMap]);

  const handleSubCmdChange = (idx: number) => {
    setSelectedSubIdx(idx);
    const newSub = def.subCommands[idx];
    setParamValues(newSub.params.map(p => p.type === 'color' ? (p.defaultColor ?? '#000000') : String(p.default ?? '')));
    if (!newSub.supportsDuration) setApplyMode('instant');
  };

  const handleParamChange = (idx: number, value: string) => {
    const next = [...paramValues];
    next[idx] = value;
    setParamValues(next);
  };

  const handleOk = () => {
    const dur = subCmd.supportsDuration
      ? (applyMode === 'interpolate' ? duration : '0')
      : undefined;
    const text = buildAddonCommandText(def.pluginCommand, subCmd.id, paramValues, dur);
    onOk([text]);
  };

  const showDuration = subCmd.supportsDuration;

  // 현재 선택된 shaderType 값 (shaderparam 렌더링용)
  const getShaderTypeValue = () => {
    const stIdx = subCmd.params.findIndex(p => p.type === 'shadertype');
    if (stIdx >= 0) return paramValues[stIdx] || '';
    return '';
  };

  // shaderparam 드롭다운 옵션
  const getShaderParams = (shaderType: string) => {
    const sd = SHADER_DEFINITIONS.find(d => d.type === shaderType);
    if (!sd) return [];
    return sd.params.map(p => ({ key: p.key, label: p.label }));
  };

  const renderParamInput = (param: typeof subCmd.params[0], i: number) => {
    if (param.type === 'color') {
      return (
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
      );
    }

    if (param.type === 'pointlight') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            className="addon-cmd-input"
            value={paramValues[i] ?? ''}
            min={0}
            step={1}
            onChange={e => handleParamChange(i, e.target.value)}
            style={{ width: 70 }}
          />
          <button
            className="db-btn"
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={() => setShowLightPicker(i)}
          >
            {t('addonCommands.selectPointLight')}
          </button>
        </div>
      );
    }

    if (param.type === 'mapobject') {
      return (
        <select
          className="addon-cmd-select"
          value={paramValues[i] ?? ''}
          onChange={e => handleParamChange(i, e.target.value)}
        >
          <option value="">--</option>
          {mapObjects.map(obj => (
            <option key={obj.id} value={String(obj.id)}>
              #{obj.id} - {obj.name || obj.imageName || `Object ${obj.id}`}
            </option>
          ))}
        </select>
      );
    }

    if (param.type === 'shadertype') {
      const shaderList = param.transitionOnly
        ? SHADER_DEFINITIONS.filter(sd => sd.params.some(p => p.key === 'threshold'))
        : SHADER_DEFINITIONS;
      return (
        <select
          className="addon-cmd-select"
          value={paramValues[i] ?? ''}
          onChange={e => handleParamChange(i, e.target.value)}
        >
          <option value="">--</option>
          {param.allowAll && <option value="all">{t('common.all') || '전체'}</option>}
          {shaderList.map(sd => (
            <option key={sd.type} value={sd.type}>{sd.label} ({sd.type})</option>
          ))}
        </select>
      );
    }

    if (param.type === 'shaderparam') {
      const shaderType = getShaderTypeValue();
      const shaderParams = getShaderParams(shaderType);
      return (
        <select
          className="addon-cmd-select"
          value={paramValues[i] ?? ''}
          onChange={e => handleParamChange(i, e.target.value)}
        >
          <option value="">--</option>
          {shaderParams.map(sp => (
            <option key={sp.key} value={sp.key}>{sp.label} ({sp.key})</option>
          ))}
        </select>
      );
    }

    if (param.type === 'boolean') {
      const boolVal = paramValues[i] ?? '1';
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" name={`addon-bool-${i}`} checked={boolVal === '1'} onChange={() => handleParamChange(i, '1')} />
            ON
          </label>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" name={`addon-bool-${i}`} checked={boolVal === '0'} onChange={() => handleParamChange(i, '0')} />
            OFF
          </label>
        </span>
      );
    }

    // number / float
    return (
      <input
        type="number"
        className="addon-cmd-input"
        value={paramValues[i] ?? ''}
        min={param.min}
        max={param.max}
        step={param.step ?? (param.type === 'float' ? 0.1 : 1)}
        onChange={e => handleParamChange(i, e.target.value)}
      />
    );
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
              {renderParamInput(param, i)}
            </div>
          ))}
        </div>
      )}

      {showDuration && (
        <div className="addon-cmd-duration">
          <div className="addon-cmd-row">
            <label className="addon-cmd-label">{t('addonCommands.applyMode')}</label>
            <select
              className="addon-cmd-select"
              value={applyMode}
              onChange={e => setApplyMode(e.target.value as 'instant' | 'interpolate')}
            >
              <option value="instant">{t('addonCommands.applyInstant')}</option>
              <option value="interpolate">{t('addonCommands.applyInterpolate')}</option>
            </select>
          </div>
          {applyMode === 'interpolate' && (
            <div className="addon-cmd-row">
              <label className="addon-cmd-label">{t('addonCommands.duration')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  className="addon-cmd-input"
                  value={duration}
                  min={0}
                  max={60}
                  step={0.1}
                  onChange={e => setDuration(e.target.value)}
                />
                <span style={{ color: '#999', fontSize: 12 }}>{t('addonCommands.seconds')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="addon-cmd-preview">
        <label className="addon-cmd-label">{t('addonCommands.preview')}</label>
        <code className="addon-cmd-preview-text">
          {buildAddonCommandText(def.pluginCommand, subCmd.id, paramValues, subCmd.supportsDuration ? (applyMode === 'interpolate' ? duration : '0') : undefined)}
        </code>
      </div>

      <div className="addon-cmd-footer">
        <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
        <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
      </div>

      {showLightPicker !== null && currentMapId && (
        <MapLocationPicker
          mode="pointlight"
          mapId={currentMapId}
          x={0} y={0}
          fixedMap
          selectedLightId={paramValues[showLightPicker] ? parseInt(paramValues[showLightPicker]) : undefined}
          onSelectLight={(lightId) => {
            handleParamChange(showLightPicker, String(lightId));
            setShowLightPicker(null);
          }}
          onCancel={() => setShowLightPicker(null)}
        />
      )}
    </>
  );
}

/** 기존 356 텍스트를 파싱하여 AddonCommandEditor용 props를 생성 */
export function parseAddonProps(text: string): {
  def: AddonCommandDef;
  initialSubCmd: AddonSubCommand;
  initialParamValues: string[];
  initialDuration?: string;
} | null {
  const match = matchAddonCommand(text);
  if (!match) return null;
  return {
    def: match.def,
    initialSubCmd: match.subCmd,
    initialParamValues: match.paramValues,
    initialDuration: match.duration,
  };
}
