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
}

interface PluginEntry {
  name: string;
  status: boolean;
  description: string;
}

// 선택 아이템 종류
type SelectionKind =
  | { type: 'addon'; pluginCommand: string }
  | { type: 'plugin'; pluginName: string; command: PluginCommandMeta }
  | { type: 'plugin-nocmd'; pluginName: string }
  | { type: 'direct' };

interface PluginCommandDialogProps {
  existingText?: string;
  onOk: (params: unknown[]) => void;
  onCancel: () => void;
}

export default function PluginCommandDialog({ existingText, onOk, onCancel }: PluginCommandDialogProps) {
  const { t } = useTranslation();

  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [metadata, setMetadata] = useState<Record<string, PluginMetadata>>({});
  const [loading, setLoading] = useState(true);

  // 좌측 패널: 선택된 "그룹" (플러그인 커맨드 prefix 또는 플러그인 이름)
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  // 우측 패널: 선택된 커맨드 (JSDoc 기반 플러그인일 때)
  const [selectedCmd, setSelectedCmd] = useState<PluginCommandMeta | null>(null);
  // 직접 입력 텍스트
  const [directText, setDirectText] = useState(existingText || '');

  // 인자 값들 (JSDoc 기반)
  const [argValues, setArgValues] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      apiClient.get<{ list: PluginEntry[] }>('/plugins'),
      apiClient.get<Record<string, PluginMetadata>>('/plugins/metadata?locale=ko'),
    ]).then(([pluginRes, metaRes]) => {
      const enabled = (pluginRes.list || []).filter((p: PluginEntry) => p.status);
      setPlugins(enabled);
      setMetadata(metaRes || {});

      // 초기 선택: 기존 텍스트에서 추론
      if (existingText) {
        const addonProps = parseAddonProps(existingText);
        if (addonProps) {
          setSelectedGroup('__addon__' + addonProps.def.pluginCommand);
        } else {
          const firstWord = existingText.trim().split(/\s+/)[0] || '';
          // 활성화된 플러그인 중 매칭 찾기
          const matchedPlugin = enabled.find((p: PluginEntry) => p.name === firstWord);
          if (matchedPlugin) {
            const meta = (metaRes || {} as Record<string, PluginMetadata>)[firstWord];
            const restWords = existingText.trim().split(/\s+/).slice(1);
            const cmdName = restWords[0] || '';
            const matchedCmd = meta?.commands?.find((c: PluginCommandMeta) => c.name === cmdName);
            if (matchedCmd) {
              setSelectedGroup('__plugin__' + firstWord);
              setSelectedCmd(matchedCmd);
              setArgValues(matchedCmd.args.map((a: PluginArgMeta, i: number) => restWords[i + 1] ?? a.default));
            } else {
              setSelectedGroup('__plugin__' + firstWord);
            }
          } else {
            setSelectedGroup('__direct__');
          }
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 그룹 선택 핸들러
  const handleGroupSelect = useCallback((groupKey: string) => {
    setSelectedGroup(groupKey);
    setSelectedCmd(null);
    setArgValues([]);
  }, []);

  // JSDoc 커맨드 선택
  const handleCmdSelect = useCallback((cmd: PluginCommandMeta) => {
    setSelectedCmd(cmd);
    setArgValues(cmd.args.map(a => a.default));
  }, []);

  // JSDoc 기반 커맨드 텍스트 생성
  const buildJsDocText = useCallback((pluginName: string, cmd: PluginCommandMeta, values: string[]) => {
    const parts = [pluginName, cmd.name, ...values.filter(v => v !== '')];
    return parts.join(' ');
  }, []);

  // JSDoc 기반 OK 핸들러
  const handleJsDocOk = useCallback(() => {
    if (!selectedCmd) return;
    const pluginName = selectedGroup.replace('__plugin__', '');
    const text = buildJsDocText(pluginName, selectedCmd, argValues);
    onOk([text]);
  }, [selectedGroup, selectedCmd, argValues, buildJsDocText, onOk]);

  // 직접 입력 OK
  const handleDirectOk = useCallback(() => {
    onOk([directText]);
  }, [directText, onOk]);

  // 좌측 목록 렌더
  const renderGroupList = () => {
    // 에디터 기능 그룹들 (addonCommandData)
    const addonGroups = ADDON_COMMANDS.map(def => ({
      key: '__addon__' + def.pluginCommand,
      label: t(def.label),
      sublabel: def.pluginCommand,
    }));

    // 활성화된 플러그인 중 @command가 있는 것들
    const pluginGroups = plugins
      .filter(p => {
        const meta = metadata[p.name];
        return meta && (meta.commands?.length ?? 0) > 0;
      })
      .map(p => ({
        key: '__plugin__' + p.name,
        label: metadata[p.name]?.pluginname || p.name,
        sublabel: p.name,
      }));

    // @command 없는 활성화 플러그인
    const pluginNoCmdGroups = plugins
      .filter(p => {
        const meta = metadata[p.name];
        return !meta || !meta.commands || meta.commands.length === 0;
      })
      .map(p => ({
        key: '__plugin_nocmd__' + p.name,
        label: metadata[p.name]?.pluginname || p.name,
        sublabel: p.name,
      }));

    return (
      <div className="pcmd-group-list">
        {addonGroups.length > 0 && (
          <>
            <div className="pcmd-group-section">{t('pluginCommand.editorFeatures') || '에디터 기능'}</div>
            {addonGroups.map(g => (
              <div
                key={g.key}
                className={`pcmd-group-item${selectedGroup === g.key ? ' selected' : ''}`}
                onClick={() => handleGroupSelect(g.key)}
                title={g.sublabel}
              >
                <span className="pcmd-group-name">{g.label}</span>
                <span className="pcmd-group-sub">{g.sublabel}</span>
              </div>
            ))}
          </>
        )}
        {(pluginGroups.length > 0 || pluginNoCmdGroups.length > 0) && (
          <>
            <div className="pcmd-group-section">{t('pluginCommand.installedPlugins') || '설치된 플러그인'}</div>
            {pluginGroups.map(g => (
              <div
                key={g.key}
                className={`pcmd-group-item${selectedGroup === g.key ? ' selected' : ''}`}
                onClick={() => handleGroupSelect(g.key)}
                title={g.sublabel}
              >
                <span className="pcmd-group-name">{g.label}</span>
                <span className="pcmd-group-sub">{g.sublabel}</span>
              </div>
            ))}
            {pluginNoCmdGroups.map(g => (
              <div
                key={g.key}
                className={`pcmd-group-item pcmd-group-item-nocmd${selectedGroup === g.key ? ' selected' : ''}`}
                onClick={() => handleGroupSelect(g.key)}
                title={g.sublabel}
              >
                <span className="pcmd-group-name">{g.label}</span>
                <span className="pcmd-group-sub">{g.sublabel}</span>
              </div>
            ))}
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

  // 우측 패널 렌더
  const renderRightPanel = () => {
    if (!selectedGroup) {
      return (
        <div className="pcmd-right-empty">
          {t('pluginCommand.selectPlugin') || '왼쪽에서 플러그인을 선택하세요'}
        </div>
      );
    }

    // 에디터 기능 (AddonCommandEditor)
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

    // @command 없는 플러그인 (직접 입력으로 안내)
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
      const commands = meta?.commands || [];

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
                <span className="pcmd-cmd-sub">{cmd.name}</span>
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
                  {buildJsDocText(pluginName, selectedCmd, argValues)}
                </code>
              </div>

              <div className="pcmd-footer">
                <button className="db-btn" onClick={handleJsDocOk}>{t('common.ok')}</button>
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

    // string, 기타
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
    <div className="modal-overlay">
      <div className="pcmd-dialog">
        <div className="pcmd-header">
          Plugin Command
        </div>
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
  );
}
