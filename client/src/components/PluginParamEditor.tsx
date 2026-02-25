import React from 'react';
import CreditTextEditor from './CreditTextEditor';
import {
  PluginEntry, PluginParamMeta, PluginMetadata,
} from './PluginManagerHelpers';

/** Parse a CSS color string to hex (#rrggbb) for <input type="color"> */
export function colorToHex(color: string): string {
  if (!color) return '#000000';
  const s = color.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3) return '#' + h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (h.length >= 6) return '#' + h.slice(0, 6);
    return s;
  }
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const r = Math.min(255, Number(m[1]));
    const g = Math.min(255, Number(m[2]));
    const b = Math.min(255, Number(m[3]));
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  }
  return '#000000';
}

/** Update hex portion of a color value, preserving rgba format if original was rgba */
export function updateColorHex(original: string, newHex: string): string {
  const r = parseInt(newHex.slice(1, 3), 16);
  const g = parseInt(newHex.slice(3, 5), 16);
  const b = parseInt(newHex.slice(5, 7), 16);
  const rgbaMatch = original.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  if (rgbaMatch) {
    return `rgba(${r}, ${g}, ${b}, ${rgbaMatch[1]})`;
  }
  if (/^rgb\(/.test(original.trim())) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return newHex;
}

/** Build ordered param list: metadata params first, then raw params */
export function getOrderedParams(plugin: PluginEntry, metadata: Record<string, PluginMetadata>) {
  const meta = metadata[plugin.name];
  const metaParams = meta?.params ?? [];
  const result: { paramIndex: number; meta?: PluginParamMeta }[] = [];

  for (const pm of metaParams) {
    const paramIndex = plugin.parameters.findIndex(p => p.name === pm.name);
    if (paramIndex >= 0) {
      result.push({ paramIndex, meta: pm });
    }
  }

  const metaNames = new Set(metaParams.map(pm => pm.name));
  plugin.parameters.forEach((p, i) => {
    if (!metaNames.has(p.name)) {
      result.push({ paramIndex: i });
    }
  });

  return result;
}

interface ParamInputProps {
  plugin: PluginEntry;
  pluginIndex: number;
  paramMeta: PluginParamMeta | undefined;
  paramIndex: number;
  updateParam: (pluginIndex: number, paramIndex: number, value: string) => void;
  setEditingParamIndex: (index: number) => void;
}

/** Renders the appropriate input control for a single plugin parameter */
export function PluginParamInput({
  plugin, pluginIndex, paramMeta, paramIndex, updateParam, setEditingParamIndex,
}: ParamInputProps) {
  const param = plugin.parameters[paramIndex];
  if (!param) return null;
  const value = param.value;

  if (paramMeta?.type === 'color') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="color"
          value={colorToHex(value)}
          onChange={(e) => updateParam(pluginIndex, paramIndex, updateColorHex(value, e.target.value))}
          style={{ width: 28, height: 22, padding: 0, border: '1px solid #555', cursor: 'pointer', flexShrink: 0 }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
          onBlur={() => setEditingParamIndex(-1)}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
    );
  }

  if (paramMeta?.type === 'boolean') {
    return (
      <select
        value={value === 'true' || value === 'ON' || value === 'on' ? 'true' : 'false'}
        onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (paramMeta && (paramMeta.type === 'select' || paramMeta.type === 'combo' || paramMeta.options.length > 0)) {
    const optionValues = paramMeta.options.map(o => o.value);
    return (
      <select
        value={value}
        onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
      >
        {paramMeta.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
        ))}
        {value && !optionValues.includes(value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    );
  }

  if (paramMeta?.type === 'number') {
    return (
      <input
        type="number"
        value={value}
        min={paramMeta.min}
        max={paramMeta.max}
        onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
        onBlur={() => setEditingParamIndex(-1)}
        autoFocus
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => updateParam(pluginIndex, paramIndex, e.target.value)}
      onBlur={() => setEditingParamIndex(-1)}
      autoFocus
    />
  );
}

interface ParamRowProps {
  plugin: PluginEntry;
  pluginIndex: number;
  paramIndex: number;
  paramMeta: PluginParamMeta | undefined;
  editingParamIndex: number;
  setEditingParamIndex: (index: number) => void;
  updateParam: (pluginIndex: number, paramIndex: number, value: string) => void;
  hasPickerButton: (paramMeta: PluginParamMeta | undefined) => boolean;
  openPicker: (paramMeta: PluginParamMeta, paramIndex: number) => void;
  openParamFolder?: (dir: string) => void;
}

/** Renders a single parameter row (tr) in the params table, including optional text file editor */
export function PluginParamRow({
  plugin, pluginIndex, paramIndex, paramMeta, editingParamIndex,
  setEditingParamIndex, updateParam, hasPickerButton, openPicker, openParamFolder,
}: ParamRowProps) {
  const param = plugin.parameters[paramIndex];
  if (!param) return null;

  const isEditing = editingParamIndex === paramIndex;
  const isBoolOrSelect = paramMeta && (
    paramMeta.type === 'boolean' ||
    paramMeta.type === 'select' ||
    paramMeta.type === 'combo' ||
    paramMeta.type === 'color' ||
    paramMeta.options.length > 0
  );
  const showPicker = hasPickerButton(paramMeta);
  const isTextFile = paramMeta?.type === 'textfile';

  return (
    <React.Fragment key={param.name}>
      <tr
        className={isEditing ? 'active' : ''}
        title={paramMeta?.desc || param.name}
      >
        <td className="pm-param-name" title={param.name}>{paramMeta?.text || param.name}</td>
        <td className="pm-param-value-cell">
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEditing || isBoolOrSelect ? (
                <PluginParamInput
                  plugin={plugin}
                  pluginIndex={pluginIndex}
                  paramMeta={paramMeta}
                  paramIndex={paramIndex}
                  updateParam={updateParam}
                  setEditingParamIndex={setEditingParamIndex}
                />
              ) : (
                <div
                  className="pm-param-value-display"
                  onClick={() => setEditingParamIndex(paramIndex)}
                >
                  {param.value || '\u00A0'}
                </div>
              )}
            </div>
            {showPicker && (
              <button
                className="db-btn-small"
                style={{ padding: '1px 4px', fontSize: 11, flexShrink: 0 }}
                onClick={() => openPicker(paramMeta!, paramIndex)}
                title={paramMeta?.type}
              >...</button>
            )}
            {paramMeta?.type === 'file' && paramMeta?.dir && openParamFolder && (
              <button
                className="db-btn-small"
                style={{ padding: '1px 4px', fontSize: 11, flexShrink: 0 }}
                onClick={() => openParamFolder(paramMeta!.dir)}
                title={`폴더 열기: ${paramMeta!.dir}`}
              >📂</button>
            )}
          </div>
        </td>
      </tr>
      {isTextFile && param.value && (
        <tr>
          <td colSpan={2} style={{ padding: '4px 8px 8px 8px' }}>
            <CreditTextEditor textFilePath={param.value} />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
