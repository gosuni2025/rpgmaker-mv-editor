import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fuzzyMatch } from '../../utils/fuzzySearch';
import useEscClose from '../../hooks/useEscClose';
import { ADDON_COMMANDS } from './addonCommands';
import ExtBadge from '../common/ExtBadge';
import '../MapEditor/MapCanvas.css';

// EXT 뱃지를 표시할 커맨드 코드 목록
const EXT_COMMANDS = new Set([231]);

interface CommandInsertDialogProps {
  onSelect: (code: number, initialParam?: string) => void;
  onCancel: () => void;
}

let lastActiveTab = 1;

export default function CommandInsertDialog({ onSelect, onCancel }: CommandInsertDialogProps) {
  const { t } = useTranslation();
  useEscClose(onCancel);
  const [activeTab, setActiveTab] = useState(lastActiveTab);
  const [commandFilter, setCommandFilter] = useState('');
  const commandFilterRef = useRef<HTMLInputElement>(null);

  // 탭별 좌/우 카테고리 구성 (원본 RPG Maker MV와 동일 + Tab4 애드온)
  const TABS = useMemo(() => ({
    1: {
      left: [
        {
          label: t('eventCommands.categories.tab1Messages'),
          commands: [101, 102, 103, 104, 105],
        },
        {
          label: t('eventCommands.categories.tab1GameProgression'),
          commands: [121, 122, 123, 124],
        },
        {
          label: t('eventCommands.categories.tab1FlowControl'),
          commands: [111, 112, 113, 115, 117, 118, 119, 108],
        },
      ],
      right: [
        {
          label: t('eventCommands.categories.tab1Party'),
          commands: [125, 126, 127, 128, 129],
        },
        {
          label: t('eventCommands.categories.tab1Actor'),
          commands: [311, 312, 326, 313, 314, 315, 316, 317, 318, 319, 320, 321, 324, 325],
        },
      ],
    },
    2: {
      left: [
        {
          label: t('eventCommands.categories.tab2Movement'),
          commands: [201, 202, 203, 204, 205, 206],
        },
        {
          label: t('eventCommands.categories.tab2Character'),
          commands: [211, 216, 217, 212, 213, 214],
        },
        {
          label: t('eventCommands.categories.tab2Picture'),
          commands: [231, 232, 233, 234, 235],
        },
      ],
      right: [
        {
          label: t('eventCommands.categories.tab2Timing'),
          commands: [230],
        },
        {
          label: t('eventCommands.categories.tab2Screen'),
          commands: [221, 222, 223, 224, 225, 236],
        },
        {
          label: t('eventCommands.categories.tab2AudioVideo'),
          commands: [241, 242, 243, 244, 245, 246, 249, 250, 251, 261],
        },
      ],
    },
    3: {
      left: [
        {
          label: t('eventCommands.categories.tab3SceneControl'),
          commands: [301, 302, 303, 351, 352, 353, 354],
        },
        {
          label: t('eventCommands.categories.tab3SystemSettings'),
          commands: [132, 133, 139, 140, 134, 135, 136, 137, 138, 322, 323],
        },
      ],
      right: [
        {
          label: t('eventCommands.categories.tab3Map'),
          commands: [281, 282, 283, 284, 285],
        },
        {
          label: t('eventCommands.categories.tab3Battle'),
          commands: [331, 332, 342, 333, 334, 335, 336, 337, 339, 340],
        },
        {
          label: t('eventCommands.categories.tab3Advanced'),
          commands: [355, 356],
        },
      ],
    },
  }), [t]);

  // 애드온 커맨드를 카테고리별로 분류
  const addonCategories = useMemo(() => {
    const cats: { label: string; addons: typeof ADDON_COMMANDS }[] = [];
    // 맵/렌더링 관련
    const mapAddons = ADDON_COMMANDS.filter(a => ['FogOfWar', 'ShadowLight', 'Mode3D'].includes(a.pluginCommand));
    const ppAddons = ADDON_COMMANDS.filter(a => a.pluginCommand === 'PostProcess');
    const ppEffectAddons = ADDON_COMMANDS.filter(a => a.pluginCommand === 'PPEffect');
    const objectAddons = ADDON_COMMANDS.filter(a => a.pluginCommand === 'MapObject');
    if (objectAddons.length > 0) cats.push({ label: t('eventCommands.categories.tab4Objects'), addons: objectAddons });
    if (mapAddons.length > 0) cats.push({ label: t('eventCommands.categories.tab4MapRendering'), addons: mapAddons });
    if (ppAddons.length > 0) cats.push({ label: t('eventCommands.categories.tab4PostProcess'), addons: ppAddons });
    if (ppEffectAddons.length > 0) cats.push({ label: t('eventCommands.categories.tab4PPEffect'), addons: ppEffectAddons });
    return cats;
  }, [t]);

  // 검색 모드: 필터가 있으면 모든 탭에서 검색
  const isFiltering = commandFilter.length > 0;

  const allCommands = useMemo(() => {
    const result: { code: number; name: string; category: string; addonPlugin?: string }[] = [];
    for (const tab of Object.values(TABS)) {
      for (const col of [tab.left, tab.right]) {
        for (const cat of col) {
          for (const code of cat.commands) {
            const name = t(`eventCommands.commands.${code}`);
            result.push({ code, name, category: cat.label });
          }
        }
      }
    }
    for (const addon of ADDON_COMMANDS) {
      const catLabel = addonCategories.find(c => c.addons.includes(addon))?.label || t('eventCommands.categories.tab4Addon');
      result.push({ code: 356, name: t(addon.label), category: catLabel, addonPlugin: addon.pluginCommand });
    }
    return result;
  }, [TABS, t, addonCategories]);

  const filteredCommands = useMemo(() => {
    if (!isFiltering) return [];
    return allCommands.filter(c =>
      fuzzyMatch(c.name, commandFilter) || fuzzyMatch(c.category, commandFilter)
    );
  }, [allCommands, commandFilter, isFiltering]);

  const renderCategory = (label: string, codes: number[]) => (
    <div key={label} className="cmd-insert-category">
      <div className="cmd-insert-category-header">{label}</div>
      <div className="cmd-insert-category-body">
        {codes.map(code => (
          <div
            key={code}
            className="insert-command-item"
            onClick={() => onSelect(code)}
          >
            {t(`eventCommands.commands.${code}`)}
            {EXT_COMMANDS.has(code) && <ExtBadge inline />}
          </div>
        ))}
      </div>
    </div>
  );

  const renderAddonCategory = (label: string, addons: typeof ADDON_COMMANDS) => (
    <div key={label} className="cmd-insert-category">
      <div className="cmd-insert-category-header">{label}</div>
      <div className="cmd-insert-category-body">
        {addons.map(addon => (
          <div
            key={addon.pluginCommand}
            className="insert-command-item"
            onClick={() => onSelect(356, addon.pluginCommand)}
          >
            {t(addon.label)}
          </div>
        ))}
      </div>
    </div>
  );

  const renderTab = (tabNum: number) => {
    if (tabNum === 4) {
      // 애드온 탭: 카테고리별 분류
      return (
        <div className="cmd-insert-columns">
          <div className="cmd-insert-column">
            {addonCategories.slice(0, Math.ceil(addonCategories.length / 2)).map(cat =>
              renderAddonCategory(cat.label, cat.addons)
            )}
          </div>
          <div className="cmd-insert-column">
            {addonCategories.slice(Math.ceil(addonCategories.length / 2)).map(cat =>
              renderAddonCategory(cat.label, cat.addons)
            )}
          </div>
        </div>
      );
    }
    const tab = TABS[tabNum as keyof typeof TABS];
    return (
      <div className="cmd-insert-columns">
        <div className="cmd-insert-column">
          {tab.left.map(cat => renderCategory(cat.label, cat.commands))}
        </div>
        <div className="cmd-insert-column">
          {tab.right.map(cat => renderCategory(cat.label, cat.commands))}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="cmd-insert-dialog">
        <div className="cmd-insert-title">{t('eventCommands.insertCommand')}</div>
        <div className="cmd-insert-toolbar">
          <div className="cmd-insert-tabs">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                className={`cmd-insert-tab${activeTab === n ? ' active' : ''}`}
                onClick={() => { setActiveTab(n); lastActiveTab = n; }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="command-filter-box" style={{ flex: 1 }}>
            <input
              ref={commandFilterRef}
              type="text"
              className="command-filter-input"
              placeholder={t('eventCommands.filterPlaceholder')}
              value={commandFilter}
              onChange={e => setCommandFilter(e.target.value)}
              autoFocus
            />
            {commandFilter && (
              <button className="command-filter-clear" onClick={() => { setCommandFilter(''); commandFilterRef.current?.focus(); }}>×</button>
            )}
          </div>
        </div>
        <div className="cmd-insert-content">
          {isFiltering ? (
            filteredCommands.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>{t('eventCommands.noResults')}</div>
            ) : (
              <div>
                {filteredCommands.map((c, i) => (
                  <div
                    key={`${c.code}-${c.addonPlugin || i}`}
                    className="insert-command-item"
                    onClick={() => onSelect(c.code, c.addonPlugin)}
                  >
                    {c.name}
                    {EXT_COMMANDS.has(c.code) && !c.addonPlugin && <ExtBadge inline />}
                  </div>
                ))}
              </div>
            )
          ) : (
            renderTab(activeTab)
          )}
        </div>
        <div className="cmd-insert-footer">
          <button className="db-btn" onClick={() => onCancel()}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
