import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';
import { ADDON_COMMANDS } from './addonCommands';
import AddonCommandEditor, { parseAddonProps } from './AddonCommandEditor';
import './PluginCommandDialog.css';

interface PluginArgMeta {
  name: string;
  text: string;
  type: string;
  default: string;
  options: { label: string; value: string }[];
  min?: string;
  max?: string;
  desc?: string;
}

interface DbEntry {
  id: number;
  name: string;
}

const DB_TYPE_ENDPOINT: Record<string, string> = {
  item: 'items', weapon: 'weapons', armor: 'armors', enemy: 'enemies',
};
const PICKER_TYPES = new Set(Object.keys(DB_TYPE_ENDPOINT));

interface PluginCommandMeta {
  name: string;
  text: string;
  desc: string;
  args: PluginArgMeta[];
}

interface PluginMetadata {
  pluginname: string;
  plugindesc: string;
  commands?: PluginCommandMeta[];
  /** @plugincommand 태그 — 파일명과 다른 실제 커맨드 prefix */
  plugincommand?: string;
}

interface PluginEntry {
  name: string;
  status: boolean;
  description: string;
}

interface GroupItem {
  key: string;
  label: string;
  sublabel: string;
  /** addonCommandData의 pluginCommand와 매핑될 때 설정 */
  addonKey?: string;
  /** JSDoc 기반 커맨드 prefix */
  cmdPrefix?: string;
  hasCommands: boolean;
}

interface PluginCommandDialogProps {
  existingText?: string;
  onOk: (params: unknown[]) => void;
  onCancel: () => void;
}

export default function PluginCommandDialog({ existingText, onOk, onCancel }: PluginCommandDialogProps) {
  const { t } = useTranslation();

  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [metadata, setMetadata] = useState<Record<string, PluginMetadata>>({});
  const [coreMetadata, setCoreMetadata] = useState<Record<string, PluginMetadata>>({});
  const [loading, setLoading] = useState(true);

  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedCmd, setSelectedCmd] = useState<PluginCommandMeta | null>(null);
  const [directText, setDirectText] = useState(existingText || '');
  const [argValues, setArgValues] = useState<string[]>([]);

  const [dbCache, setDbCache] = useState<Record<string, DbEntry[]>>({});
  const [picker, setPicker] = useState<{ argIndex: number; type: string } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // addonCommandData에 있는 pluginCommand 집합
  const addonKeySet = new Set(ADDON_COMMANDS.map(d => d.pluginCommand));

  useEffect(() => {
    Promise.all([
      apiClient.get<{ list: PluginEntry[] }>('/plugins'),
      apiClient.get<Record<string, PluginMetadata>>('/plugins/metadata?locale=ko'),
      apiClient.get<Record<string, PluginMetadata>>('/plugins/core-metadata'),
    ]).then(([pluginRes, metaRes, coreRes]) => {
      const enabled = (pluginRes.list || []).filter((p: PluginEntry) => p.status);
      setPlugins(enabled);
      setMetadata(metaRes || {});
      setCoreMetadata(coreRes || {});

      // 초기 선택: 기존 텍스트에서 추론
      if (existingText) {
        const addonProps = parseAddonProps(existingText);
        if (addonProps) {
          setSelectedGroup('__addon__' + addonProps.def.pluginCommand);
        } else {
          const words = existingText.trim().split(/\s+/);
          const firstWord = words[0] || '';

          // core 파일에서 커맨드 prefix 매칭
          const coreMatch = Object.entries(coreRes || {}).find(([, m]) =>
            (m.plugincommand || '') === firstWord
          );
          if (coreMatch) {
            const [fileName] = coreMatch;
            const addonKey = coreMatch[1].plugincommand || fileName;
            if (addonKeySet.has(addonKey)) {
              setSelectedGroup('__addon__' + addonKey);
            } else {
              setSelectedGroup('__core__' + fileName);
              const meta = coreMatch[1];
              const cmdName = words[1] || '';
              const cmd = meta.commands?.find((c: PluginCommandMeta) => c.name === cmdName);
              if (cmd) {
                setSelectedCmd(cmd);
                setArgValues(cmd.args.map((a: PluginArgMeta, i: number) => words[i + 2] ?? a.default));
              }
            }
          } else {
            // 활성화된 플러그인 매칭
            const matchedPlugin = enabled.find((p: PluginEntry) => p.name === firstWord);
            if (matchedPlugin) {
              const meta = (metaRes || {} as Record<string, PluginMetadata>)[firstWord];
              const cmdName = words[1] || '';
              const cmd = meta?.commands?.find((c: PluginCommandMeta) => c.name === cmdName);
              if (cmd) {
                setSelectedGroup('__plugin__' + firstWord);
                setSelectedCmd(cmd);
                setArgValues(cmd.args.map((a: PluginArgMeta, i: number) => words[i + 2] ?? a.default));
              } else {
                setSelectedGroup('__plugin__' + firstWord);
              }
            } else {
              setSelectedGroup('__direct__');
            }
          }
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleGroupSelect = useCallback((groupKey: string) => {
    setSelectedGroup(groupKey);
    setSelectedCmd(null);
    setArgValues([]);
  }, []);

  const handleCmdSelect = useCallback((cmd: PluginCommandMeta) => {
    setSelectedCmd(cmd);
    setArgValues(cmd.args.map(a => a.default));
  }, []);

  const loadDbData = useCallback(async (type: string) => {
    if (dbCache[type] !== undefined) return;
    const endpoint = DB_TYPE_ENDPOINT[type];
    if (!endpoint) return;
    try {
      const raw = await apiClient.get<(DbEntry | null)[]>(`/database/${endpoint}`);
      const list = (raw || []).filter((e): e is DbEntry => !!e && !!e.name);
      setDbCache(prev => ({ ...prev, [type]: list }));
    } catch {
      setDbCache(prev => ({ ...prev, [type]: [] }));
    }
  }, [dbCache]);

  const buildCmdText = useCallback((prefix: string, cmd: PluginCommandMeta, values: string[]) => {
    const parts = [prefix, cmd.name, ...values.filter(v => v !== '')];
    return parts.join(' ');
  }, []);

  const handleCmdOk = useCallback((prefix: string) => {
    if (!selectedCmd) return;
    onOk([buildCmdText(prefix, selectedCmd, argValues)]);
  }, [selectedCmd, argValues, buildCmdText, onOk]);

  const handleDirectOk = useCallback(() => {
    onOk([directText]);
  }, [directText, onOk]);

  // core 파일 그룹 목록 생성
  // addonCommandData에 매핑되는 것은 제외 (에디터 기능 섹션과 중복)
  const buildCoreGroups = (): GroupItem[] => {
    return Object.entries(coreMetadata)
      .filter(([, meta]) => {
        const prefix = meta.plugincommand || '';
        // addonCommandData에 이미 있는 것은 에디터 기능 섹션에서 처리
        return !addonKeySet.has(prefix);
      })
      .map(([fileName, meta]) => ({
        key: '__core__' + fileName,
        label: meta.plugindesc || fileName,
        sublabel: meta.plugincommand || fileName,
        cmdPrefix: meta.plugincommand || fileName,
        hasCommands: (meta.commands?.length ?? 0) > 0,
      }));
  };

  const renderGroupList = () => {
    const addonGroups: GroupItem[] = ADDON_COMMANDS.map(def => ({
      key: '__addon__' + def.pluginCommand,
      label: t(def.label),
      sublabel: def.pluginCommand,
      addonKey: def.pluginCommand,
      hasCommands: true,
    }));

    const coreGroups = buildCoreGroups();

    const pluginGroups: GroupItem[] = plugins
      .filter(p => (metadata[p.name]?.commands?.length ?? 0) > 0)
      .map(p => ({
        key: '__plugin__' + p.name,
        label: metadata[p.name]?.pluginname || p.name,
        sublabel: p.name,
        cmdPrefix: p.name,
        hasCommands: true,
      }));

    const pluginNoCmdGroups: GroupItem[] = plugins
      .filter(p => {
        const meta = metadata[p.name];
        return !meta || !meta.commands || meta.commands.length === 0;
      })
      .map(p => ({
        key: '__plugin_nocmd__' + p.name,
        label: metadata[p.name]?.pluginname || p.name,
        sublabel: p.name,
        hasCommands: false,
      }));

    const renderItem = (g: GroupItem) => (
      <div
        key={g.key}
        className={`pcmd-group-item${selectedGroup === g.key ? ' selected' : ''}${!g.hasCommands ? ' pcmd-group-item-nocmd' : ''}`}
        onClick={() => handleGroupSelect(g.key)}
        title={g.sublabel}
      >
        <span className="pcmd-group-name">{g.label}</span>
        <span className="pcmd-group-sub">{g.sublabel}</span>
      </div>
    );

    return (
      <div className="pcmd-group-list">
        {(addonGroups.length > 0 || coreGroups.length > 0) && (
          <>
            <div className="pcmd-group-section">{t('pluginCommand.editorFeatures') || '에디터 기능'}</div>
            {addonGroups.map(renderItem)}
            {coreGroups.map(renderItem)}
          </>
        )}
        {(pluginGroups.length > 0 || pluginNoCmdGroups.length > 0) && (
          <>
            <div className="pcmd-group-section">{t('pluginCommand.installedPlugins') || '설치된 플러그인'}</div>
            {pluginGroups.map(renderItem)}
            {pluginNoCmdGroups.map(renderItem)}
          </>
        )}
        <div className="pcmd-group-section">{t('pluginCommand.manual') || '직접 입력'}</div>
        <div
          className={`pcmd-group-item${selectedGroup === '__direct__' ? ' selected' : ''}`}
          onClick={() => handleGroupSelect('__direct__')}
        >
          <span className="pcmd-group-name">{t('pluginCommand.manualInput') || '직접 입력'}</span>
        </div>
      </div>
    );
  };

  const renderJsDocPanel = (meta: PluginMetadata, cmdPrefix: string) => {
    const commands = meta.commands || [];
    return (
      <div className="pcmd-jsdoc">
        <div className="pcmd-cmd-list-label">{t('pluginCommand.commands') || '커맨드'}</div>
        <div className="pcmd-cmd-list">
          {commands.map(cmd => (
            <div
              key={cmd.name}
              className={`pcmd-cmd-item${selectedCmd?.name === cmd.name ? ' selected' : ''}`}
              onClick={() => handleCmdSelect(cmd)}
            >
              <span className="pcmd-cmd-name">{cmd.text || cmd.name}</span>
              <span className="pcmd-cmd-sub">{cmdPrefix} {cmd.name}</span>
              {cmd.desc && <span className="pcmd-cmd-desc">{cmd.desc}</span>}
            </div>
          ))}
        </div>

        {selectedCmd && (
          <div className="pcmd-jsdoc-args">
            {selectedCmd.args.map((arg, i) => (
              <div key={arg.name} className="pcmd-arg-row">
                <label className="pcmd-label">{arg.text || arg.name}</label>
                {renderArgInput(arg, i)}
              </div>
            ))}

            <div className="pcmd-preview">
              <label className="pcmd-label">{t('addonCommands.preview') || '미리보기'}</label>
              <code className="pcmd-preview-text">
                {buildCmdText(cmdPrefix, selectedCmd, argValues)}
              </code>
            </div>

            <div className="pcmd-footer">
              <button className="db-btn" onClick={() => handleCmdOk(cmdPrefix)}>{t('common.ok')}</button>
              <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
          </div>
        )}

        {!selectedCmd && commands.length > 0 && (
          <div className="pcmd-right-empty" style={{ marginTop: 12 }}>
            {t('pluginCommand.selectCommand') || '커맨드를 선택하세요'}
          </div>
        )}
      </div>
    );
  };

  const renderRightPanel = () => {
    if (!selectedGroup) {
      return (
        <div className="pcmd-right-empty">
          {t('pluginCommand.selectPlugin') || '왼쪽에서 플러그인을 선택하세요'}
        </div>
      );
    }

    // 에디터 기능 (addonCommandData → AddonCommandEditor)
    if (selectedGroup.startsWith('__addon__')) {
      const pluginCommand = selectedGroup.replace('__addon__', '');
      const def = ADDON_COMMANDS.find(d => d.pluginCommand === pluginCommand);
      if (!def) return null;
      const addonProps = existingText ? parseAddonProps(existingText) : null;
      const isMatch = addonProps?.def.pluginCommand === pluginCommand;
      return (
        <AddonCommandEditor
          def={def}
          initialSubCmd={isMatch ? addonProps!.initialSubCmd : undefined}
          initialParamValues={isMatch ? addonProps!.initialParamValues : undefined}
          initialDuration={isMatch ? addonProps!.initialDuration : undefined}
          onOk={onOk}
          onCancel={onCancel}
        />
      );
    }

    // 코어 파일 (JSDoc 기반 UI)
    if (selectedGroup.startsWith('__core__')) {
      const fileName = selectedGroup.replace('__core__', '');
      const meta = coreMetadata[fileName];
      if (!meta) return null;
      const cmdPrefix = meta.plugincommand || fileName;
      return renderJsDocPanel(meta, cmdPrefix);
    }

    // 직접 입력
    if (selectedGroup === '__direct__') {
      return (
        <div className="pcmd-direct">
          <label className="pcmd-label">{t('pluginCommand.commandText') || '커맨드 텍스트'}</label>
          <input
            className="pcmd-text-input"
            type="text"
            value={directText}
            onChange={e => setDirectText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDirectOk()}
            placeholder="PluginName subCommand arg1 arg2..."
            autoFocus
          />
          <div className="pcmd-footer">
            <button className="db-btn" onClick={handleDirectOk}>{t('common.ok')}</button>
            <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
          </div>
        </div>
      );
    }

    // @command 없는 플러그인
    if (selectedGroup.startsWith('__plugin_nocmd__')) {
      const pluginName = selectedGroup.replace('__plugin_nocmd__', '');
      return (
        <div className="pcmd-direct">
          <div className="pcmd-nocmd-hint">
            <span className="pcmd-nocmd-name">{pluginName}</span>
            <span className="pcmd-nocmd-text">
              {t('pluginCommand.noCommandsDefined') || '이 플러그인에 정의된 커맨드가 없습니다.'}
            </span>
            <span className="pcmd-nocmd-text" style={{ color: '#aaa', fontSize: 11 }}>
              {t('pluginCommand.useManualInput') || '직접 입력으로 커맨드 텍스트를 작성하세요.'}
            </span>
          </div>
          <label className="pcmd-label">{t('pluginCommand.commandText') || '커맨드 텍스트'}</label>
          <input
            className="pcmd-text-input"
            type="text"
            value={directText || pluginName + ' '}
            onChange={e => setDirectText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDirectOk()}
            placeholder={`${pluginName} subCommand arg1...`}
          />
          <div className="pcmd-footer">
            <button className="db-btn" onClick={handleDirectOk}>{t('common.ok')}</button>
            <button className="db-btn" onClick={onCancel}>{t('common.cancel')}</button>
          </div>
        </div>
      );
    }

    // JSDoc @command 있는 플러그인
    if (selectedGroup.startsWith('__plugin__')) {
      const pluginName = selectedGroup.replace('__plugin__', '');
      const meta = metadata[pluginName];
      if (!meta) return null;
      const cmdPrefix = meta.plugincommand || pluginName;
      return renderJsDocPanel(meta, cmdPrefix);
    }

    return null;
  };

  const renderArgInput = (arg: PluginArgMeta, i: number) => {
    const value = argValues[i] ?? arg.default;
    const update = (v: string) => {
      const next = [...argValues];
      next[i] = v;
      setArgValues(next);
    };

    if (PICKER_TYPES.has(arg.type)) {
      const id = parseInt(value) || 0;
      const list = dbCache[arg.type];
      const entry = list?.find(e => e.id === id);
      const label = id > 0 ? `#${String(id).padStart(3, '0')}  ${entry?.name ?? '...'}` : '선택...';
      return (
        <button
          className="pcmd-picker-btn"
          onClick={() => {
            loadDbData(arg.type);
            setPicker({ argIndex: i, type: arg.type });
            setPickerSearch('');
          }}
        >
          {label}
        </button>
      );
    }

    if (arg.type === 'boolean') {
      return (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <label style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" checked={value === 'true' || value === '1'} onChange={() => update('true')} />
            ON
          </label>
          <label style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" checked={value === 'false' || value === '0'} onChange={() => update('false')} />
            OFF
          </label>
        </span>
      );
    }

    if (arg.type === 'select' && arg.options.length > 0) {
      return (
        <select
          className="addon-cmd-select"
          value={value}
          onChange={e => update(e.target.value)}
        >
          {arg.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    if (arg.type === 'number') {
      return (
        <input
          type="number"
          className="addon-cmd-input"
          value={value}
          min={arg.min}
          max={arg.max}
          step={1}
          onChange={e => update(e.target.value)}
        />
      );
    }

    return (
      <input
        type="text"
        className="addon-cmd-input"
        value={value}
        onChange={e => update(e.target.value)}
        style={{ width: 180 }}
      />
    );
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="pcmd-dialog">
          <div className="pcmd-header">Plugin Command</div>
          <div className="pcmd-body">
            <div className="pcmd-left">
              {loading
                ? <div className="pcmd-right-empty">로딩 중...</div>
                : renderGroupList()
              }
            </div>
            <div className="pcmd-right">
              {renderRightPanel()}
            </div>
          </div>
        </div>
      </div>

      {picker && (
        <div className="modal-overlay" style={{ zIndex: 2100 }} onClick={() => setPicker(null)}>
          <div className="pcmd-picker" onClick={e => e.stopPropagation()}>
            <div className="pcmd-picker-header">
              <input
                autoFocus
                className="pcmd-picker-search"
                placeholder="이름 또는 번호 검색..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
              />
              <button className="pcmd-picker-close" onClick={() => setPicker(null)}>✕</button>
            </div>
            <div className="pcmd-picker-list">
              {!dbCache[picker.type] && (
                <div className="pcmd-picker-empty">로딩 중...</div>
              )}
              {dbCache[picker.type]?.length === 0 && (
                <div className="pcmd-picker-empty">데이터가 없습니다</div>
              )}
              {dbCache[picker.type]
                ?.filter(e => {
                  if (!pickerSearch) return true;
                  const s = pickerSearch.toLowerCase();
                  return e.name.toLowerCase().includes(s) || String(e.id).includes(s);
                })
                .map(e => (
                  <div
                    key={e.id}
                    className="pcmd-picker-item"
                    onClick={() => {
                      const next = [...argValues];
                      next[picker.argIndex] = String(e.id);
                      setArgValues(next);
                      setPicker(null);
                    }}
                  >
                    <span className="pcmd-picker-num">#{String(e.id).padStart(3, '0')}</span>
                    <span className="pcmd-picker-name">{e.name}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
}
