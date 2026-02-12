import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fuzzyMatch } from '../../utils/fuzzySearch';
import '../MapEditor/MapCanvas.css';

interface CommandInsertDialogProps {
  onSelect: (code: number) => void;
  onCancel: () => void;
}

export default function CommandInsertDialog({ onSelect, onCancel }: CommandInsertDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(1);
  const [commandFilter, setCommandFilter] = useState('');
  const commandFilterRef = useRef<HTMLInputElement>(null);

  // 탭별 좌/우 카테고리 구성 (원본 RPG Maker MV와 동일)
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
          commands: [331, 332, 333, 334, 335, 336, 337, 338, 339, 340],
        },
        {
          label: t('eventCommands.categories.tab3Advanced'),
          commands: [355, 356],
        },
      ],
    },
  }), [t]);

  // 검색 모드: 필터가 있으면 모든 탭에서 검색
  const isFiltering = commandFilter.length > 0;

  const allCommands = useMemo(() => {
    const result: { code: number; name: string; category: string }[] = [];
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
    return result;
  }, [TABS, t]);

  const filteredCommands = useMemo(() => {
    if (!isFiltering) return [];
    return allCommands.filter(c =>
      fuzzyMatch(c.name, commandFilter) || fuzzyMatch(c.category, commandFilter)
    );
  }, [allCommands, commandFilter, isFiltering]);

  const renderCategory = (label: string, codes: number[]) => (
    <div key={label} style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 'bold', fontSize: 12, color: '#aaa', padding: '4px 0 2px', marginBottom: 2 }}>{label}</div>
      {codes.map(code => (
        <div
          key={code}
          className="insert-command-item"
          onClick={() => onSelect(code)}
        >
          {t(`eventCommands.commands.${code}`)}
        </div>
      ))}
    </div>
  );

  const renderTab = (tabNum: number) => {
    const tab = TABS[tabNum as keyof typeof TABS];
    return (
      <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab.left.map(cat => renderCategory(cat.label, cat.commands))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab.right.map(cat => renderCategory(cat.label, cat.commands))}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={() => onCancel()}>
      <div className="image-picker-dialog" onClick={e => e.stopPropagation()} style={{ width: 520, height: 'calc(100vh - 80px)', maxHeight: 700 }}>
        <div className="image-picker-header">{t('eventCommands.insertCommand')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                className={`db-btn${activeTab === n ? ' active' : ''}`}
                style={{ minWidth: 32, padding: '2px 8px', fontSize: 13 }}
                onClick={() => setActiveTab(n)}
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', display: 'flex', flexDirection: 'column' }}>
          {isFiltering ? (
            filteredCommands.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>{t('eventCommands.noResults')}</div>
            ) : (
              <div>
                {filteredCommands.map(c => (
                  <div
                    key={c.code}
                    className="insert-command-item"
                    onClick={() => onSelect(c.code)}
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            )
          ) : (
            renderTab(activeTab)
          )}
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => onCancel()}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
