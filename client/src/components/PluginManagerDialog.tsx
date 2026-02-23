import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../store/useEditorStore';
import Dialog from './common/Dialog';
import AnimationPickerDialog from './EventEditor/AnimationPickerDialog';
import { DataListPicker } from './EventEditor/dataListPicker';
import './ProjectSettingsDialog.css';
import { FilePickerDialog, DirPickerDialog, TextFilePickerDialog } from './PluginManagerHelpers';
import { getOrderedParams, PluginParamRow } from './PluginParamEditor';
import { usePluginManager } from './usePluginManager';

export default function PluginManagerDialog() {
  const { t } = useTranslation();
  const setShow = useEditorStore((s) => s.setShowPluginManagerDialog);
  const handleClose = useCallback(() => setShow(false), [setShow]);

  const pm = usePluginManager();

  return (
    <>
      <Dialog
        title={t('pluginManager.title')}
        onClose={handleClose}
        width={1100}
        height={700}
        bodyStyle={{ padding: 0, overflow: 'hidden' }}
        footer={
          <>
            <div className="pm-footer-settings">
              <div className="pm-footer-settings-group">
                <span>{t('pluginManager.screen')}:</span>
                <input type="number" value={pm.settings.screenWidth} min={1} style={{ width: 55 }}
                  onChange={(e) => pm.updateSetting('screenWidth', Number(e.target.value) || 816)} />
                <span>x</span>
                <input type="number" value={pm.settings.screenHeight} min={1} style={{ width: 55 }}
                  onChange={(e) => pm.updateSetting('screenHeight', Number(e.target.value) || 624)} />
              </div>
              <div className="pm-footer-settings-group">
                <span>FPS:</span>
                <input type="number" value={pm.settings.fps} min={1} max={120} style={{ width: 45 }}
                  onChange={(e) => pm.updateSetting('fps', Math.max(1, Math.min(120, Number(e.target.value) || 60)))} />
              </div>
              <label>
                <input type="checkbox" checked={pm.settings.touchUI}
                  onChange={(e) => pm.updateSetting('touchUI', e.target.checked)} />
                TouchUI
              </label>
            </div>
            <button className="db-btn" onClick={pm.handleSave} disabled={pm.saving || !pm.dirty}
              style={pm.dirty ? { background: '#0078d4', borderColor: '#0078d4' } : {}}>
              {pm.saving ? t('pluginManager.saving') : t('common.save')}
            </button>
            <button className="db-btn" onClick={() => setShow(false)}>{t('common.close')}</button>
          </>
        }
      >
        {pm.loading ? (
          <div className="pm-placeholder">{t('pluginManager.loading')}</div>
        ) : (
          <div className="pm-layout">
            {/* Plugin list */}
            <div className="pm-plugin-list">
              <div className="pm-plugin-list-items">
                {pm.plugins.map((plugin, index) => (
                  <div key={index}
                    className={`pm-plugin-item${pm.selectedIndex === index ? ' active' : ''}`}
                    onClick={() => { pm.setSelectedIndex(index); pm.setEditingParamIndex(-1); }}>
                    <input type="checkbox" checked={plugin.status}
                      onClick={(e) => pm.toggleStatus(index, e)} onChange={() => {}} />
                    <span className="pm-plugin-item-name">
                      {pm.metadata[plugin.name]?.pluginname || plugin.name || t('pluginManager.noPlugins')}
                    </span>
                    {pm.editorPluginMap.has(plugin.name) && (
                      <span className={`pm-plugin-badge editor${pm.editorPluginMap.get(plugin.name)!.hasUpdate ? ' has-update' : ''}`}
                        title={pm.editorPluginMap.get(plugin.name)!.hasUpdate ? '업그레이드 가능' : '에디터 기본 제공'}>에디터</span>
                    )}
                    {pm.metadata[plugin.name]?.dependencies?.map(dep => (
                      <span key={dep} className="pm-plugin-badge" title={`${dep} 필요`}>{dep}</span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="pm-plugin-buttons">
                <button className="db-btn-small" onClick={() => pm.movePlugin(-1)} disabled={pm.selectedIndex <= 0} title={t('pluginManager.moveUp')}>↑</button>
                <button className="db-btn-small" onClick={() => pm.movePlugin(1)} disabled={pm.selectedIndex < 0 || pm.selectedIndex >= pm.plugins.length - 1} title={t('pluginManager.moveDown')}>↓</button>
                <button className="db-btn-small" onClick={pm.addPlugin} title={t('common.add')}>+</button>
                <button className="db-btn-small" onClick={pm.removePlugin} disabled={pm.selectedIndex < 0} title={t('common.delete')}>✕</button>
              </div>
              <div className="pm-open-folder-btn">
                <button className="db-btn-small" onClick={pm.handleOpenPluginFolder}>{t('pluginManager.openFolder')}</button>
                <button className="db-btn-small"
                  disabled={pm.selectedIndex < 0 || !pm.selectedPlugin?.name}
                  onClick={() => pm.selectedPlugin?.name && pm.handleOpenInVSCode(pm.selectedPlugin.name)}
                  title="선택한 플러그인 파일을 VSCode로 열기">
                  VSCode로 열기
                </button>
              </div>
            </div>

            {/* Basic settings */}
            <div className="pm-basic-settings">
              {pm.selectedPlugin ? (
                <>
                  <div className="pm-field-row">
                    <span className="pm-field-label">{t('pluginManager.name')}:</span>
                    <div className="pm-field-value">
                      <select value={pm.selectedPlugin.name}
                        onChange={(e) => pm.changePluginName(pm.selectedIndex, e.target.value)}>
                        <option value="">({t('pluginManager.selectPlugin')})</option>
                        {pm.availableFiles.map(f => (
                          <option key={f} value={f} disabled={f !== pm.selectedPlugin!.name && pm.usedPluginNames.has(f)}>
                            {pm.metadata[f]?.pluginname ? `${pm.metadata[f].pluginname} (${f})` : f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pm-field-row">
                    <span className="pm-field-label">{t('pluginManager.status')}:</span>
                    <div className="pm-field-value">
                      <select value={pm.selectedPlugin.status ? 'ON' : 'OFF'}
                        onChange={(e) => pm.setPluginStatus(pm.selectedIndex, e.target.value === 'ON')}>
                        <option value="ON">ON</option>
                        <option value="OFF">OFF</option>
                      </select>
                    </div>
                  </div>
                  {pm.selectedMeta?.plugindesc && (
                    <><div className="pm-section-label">{t('pluginManager.descriptionLabel')}:</div>
                    <div className="pm-description">{pm.selectedMeta.plugindesc}</div></>
                  )}
                  {pm.selectedMeta?.author && (
                    <><div className="pm-section-label">{t('pluginManager.author')}:</div>
                    <div className="pm-author">{pm.selectedMeta.author}</div></>
                  )}
                  {pm.editorPluginMap.has(pm.selectedPlugin.name) && (
                    <div className="pm-editor-plugin-info">
                      <div className="pm-editor-plugin-label">에디터 기본 제공 플러그인</div>
                      {pm.editorPluginMap.get(pm.selectedPlugin.name)!.hasUpdate && (
                        <button className="db-btn pm-upgrade-btn" onClick={() => pm.handleUpgradePlugin(pm.selectedPlugin!.name)}>업그레이드</button>
                      )}
                    </div>
                  )}
                  {pm.selectedMeta?.help && (
                    <><div className="pm-section-label">{t('pluginManager.help')}:</div>
                    <div className="pm-help-box">{pm.selectedMeta.help}</div></>
                  )}
                </>
              ) : (
                <div className="pm-placeholder">{t('pluginManager.selectPlugin')}</div>
              )}
            </div>

            {/* Parameters */}
            <div className="pm-params-panel">
              <div className="pm-params-header">{t('pluginManager.parameters')}</div>
              <div className="pm-params-body">
                {pm.selectedPlugin && pm.selectedPlugin.name ? (() => {
                  const orderedParams = getOrderedParams(pm.selectedPlugin, pm.metadata);
                  if (orderedParams.length === 0) return <div className="pm-no-params">{t('projectSettings.noParams')}</div>;
                  return (
                    <table className="pm-param-table">
                      <thead><tr><th>{t('pluginManager.paramName')}</th><th>{t('pluginManager.paramValue')}</th></tr></thead>
                      <tbody>
                        {orderedParams.map(({ paramIndex, meta: paramMeta }) => (
                          <PluginParamRow key={pm.selectedPlugin!.parameters[paramIndex]?.name ?? paramIndex}
                            plugin={pm.selectedPlugin!} pluginIndex={pm.selectedIndex}
                            paramIndex={paramIndex} paramMeta={paramMeta}
                            editingParamIndex={pm.editingParamIndex} setEditingParamIndex={pm.setEditingParamIndex}
                            updateParam={pm.updateParam} hasPickerButton={pm.hasPickerButton} openPicker={pm.openPicker}
                            openParamFolder={pm.openParamFolder} />
                        ))}
                      </tbody>
                    </table>
                  );
                })() : (
                  <div className="pm-no-params">{t('pluginManager.selectPlugin')}</div>
                )}
              </div>
            </div>
          </div>
        )}
        {pm.error && <div style={{ padding: '4px 16px', color: '#e55', fontSize: 12 }}>{pm.error}</div>}
      </Dialog>

      {/* Picker dialogs (sibling, not nested inside Dialog) */}
      {pm.pickerType === 'animation' && pm.selectedPlugin && pm.pickerParamIndex >= 0 && (
        <AnimationPickerDialog
          value={Number(pm.selectedPlugin.parameters[pm.pickerParamIndex]?.value) || 0}
          onChange={(id) => pm.updateParam(pm.selectedIndex, pm.pickerParamIndex, String(id))}
          onClose={() => pm.setPickerType(null)} />
      )}
      {pm.pickerType === 'datalist' && pm.selectedPlugin && pm.pickerParamIndex >= 0 && (
        <DataListPicker items={pm.dataListItems}
          value={Number(pm.selectedPlugin.parameters[pm.pickerParamIndex]?.value) || 0}
          onChange={(id) => pm.updateParam(pm.selectedIndex, pm.pickerParamIndex, String(id))}
          onClose={() => pm.setPickerType(null)} title={pm.dataListTitle} />
      )}
      {pm.pickerType === 'file' && pm.selectedPlugin && pm.pickerParamIndex >= 0 && (
        <FilePickerDialog dir={pm.browseDir} files={pm.browseFiles}
          value={pm.selectedPlugin.parameters[pm.pickerParamIndex]?.value || ''}
          onChange={(name) => { pm.updateParam(pm.selectedIndex, pm.pickerParamIndex, name); pm.setPickerType(null); }}
          onClose={() => pm.setPickerType(null)} />
      )}
      {pm.pickerType === 'dir' && pm.selectedPlugin && pm.pickerParamIndex >= 0 && (
        <DirPickerDialog parentDir={pm.browseDir} dirs={pm.browseDirs}
          value={pm.selectedPlugin.parameters[pm.pickerParamIndex]?.value || ''}
          onChange={(name) => { pm.updateParam(pm.selectedIndex, pm.pickerParamIndex, name); pm.setPickerType(null); }}
          onClose={() => pm.setPickerType(null)} />
      )}
      {pm.pickerType === 'textfile' && pm.selectedPlugin && pm.pickerParamIndex >= 0 && (
        <TextFilePickerDialog dir={pm.browseDir} files={pm.browseFiles}
          value={pm.selectedPlugin.parameters[pm.pickerParamIndex]?.value || ''}
          onChange={(fp) => { pm.updateParam(pm.selectedIndex, pm.pickerParamIndex, fp); pm.setPickerType(null); }}
          onClose={() => pm.setPickerType(null)} />
      )}
    </>
  );
}
