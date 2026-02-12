import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fuzzyMatch } from '../../utils/fuzzySearch';

interface CommandInsertDialogProps {
  onSelect: (code: number) => void;
  onCancel: () => void;
}

export default function CommandInsertDialog({ onSelect, onCancel }: CommandInsertDialogProps) {
  const { t } = useTranslation();
  const [commandFilter, setCommandFilter] = useState('');
  const commandFilterRef = useRef<HTMLInputElement>(null);

  const COMMAND_CATEGORIES = useMemo(() => ({
    [t('eventCommands.categories.tab1Messages')]: [
      { code: 101, name: t('eventCommands.commands.101') },
      { code: 102, name: t('eventCommands.commands.102') },
      { code: 103, name: t('eventCommands.commands.103') },
      { code: 104, name: t('eventCommands.commands.104') },
      { code: 105, name: t('eventCommands.commands.105') },
    ],
    [t('eventCommands.categories.tab1FlowControl')]: [
      { code: 111, name: t('eventCommands.commands.111') },
      { code: 112, name: t('eventCommands.commands.112') },
      { code: 113, name: t('eventCommands.commands.113') },
      { code: 115, name: t('eventCommands.commands.115') },
      { code: 117, name: t('eventCommands.commands.117') },
      { code: 118, name: t('eventCommands.commands.118') },
      { code: 119, name: t('eventCommands.commands.119') },
      { code: 108, name: t('eventCommands.commands.108') },
    ],
    [t('eventCommands.categories.tab1GameProgression')]: [
      { code: 121, name: t('eventCommands.commands.121') },
      { code: 122, name: t('eventCommands.commands.122') },
      { code: 123, name: t('eventCommands.commands.123') },
      { code: 124, name: t('eventCommands.commands.124') },
    ],
    [t('eventCommands.categories.tab2Party')]: [
      { code: 125, name: t('eventCommands.commands.125') },
      { code: 126, name: t('eventCommands.commands.126') },
      { code: 127, name: t('eventCommands.commands.127') },
      { code: 128, name: t('eventCommands.commands.128') },
      { code: 129, name: t('eventCommands.commands.129') },
    ],
    [t('eventCommands.categories.tab2Actor')]: [
      { code: 311, name: t('eventCommands.commands.311') },
      { code: 312, name: t('eventCommands.commands.312') },
      { code: 313, name: t('eventCommands.commands.313') },
      { code: 314, name: t('eventCommands.commands.314') },
      { code: 315, name: t('eventCommands.commands.315') },
      { code: 316, name: t('eventCommands.commands.316') },
      { code: 317, name: t('eventCommands.commands.317') },
      { code: 318, name: t('eventCommands.commands.318') },
      { code: 319, name: t('eventCommands.commands.319') },
      { code: 320, name: t('eventCommands.commands.320') },
      { code: 321, name: t('eventCommands.commands.321') },
      { code: 322, name: t('eventCommands.commands.322') },
    ],
    [t('eventCommands.categories.tab2Movement')]: [
      { code: 201, name: t('eventCommands.commands.201') },
      { code: 202, name: t('eventCommands.commands.202') },
      { code: 203, name: t('eventCommands.commands.203') },
      { code: 204, name: t('eventCommands.commands.204') },
      { code: 205, name: t('eventCommands.commands.205') },
      { code: 206, name: t('eventCommands.commands.206') },
    ],
    [t('eventCommands.categories.tab3Screen')]: [
      { code: 221, name: t('eventCommands.commands.221') },
      { code: 222, name: t('eventCommands.commands.222') },
      { code: 223, name: t('eventCommands.commands.223') },
      { code: 224, name: t('eventCommands.commands.224') },
      { code: 225, name: t('eventCommands.commands.225') },
      { code: 230, name: t('eventCommands.commands.230') },
    ],
    [t('eventCommands.categories.tab3PictureWeather')]: [
      { code: 231, name: t('eventCommands.commands.231') },
      { code: 232, name: t('eventCommands.commands.232') },
      { code: 233, name: t('eventCommands.commands.233') },
      { code: 234, name: t('eventCommands.commands.234') },
      { code: 235, name: t('eventCommands.commands.235') },
      { code: 236, name: t('eventCommands.commands.236') },
    ],
    [t('eventCommands.categories.tab3AudioVideo')]: [
      { code: 241, name: t('eventCommands.commands.241') },
      { code: 242, name: t('eventCommands.commands.242') },
      { code: 243, name: t('eventCommands.commands.243') },
      { code: 244, name: t('eventCommands.commands.244') },
      { code: 245, name: t('eventCommands.commands.245') },
      { code: 246, name: t('eventCommands.commands.246') },
      { code: 249, name: t('eventCommands.commands.249') },
      { code: 250, name: t('eventCommands.commands.250') },
      { code: 251, name: t('eventCommands.commands.251') },
      { code: 261, name: t('eventCommands.commands.261') },
    ],
    [t('eventCommands.categories.tab3SceneControl')]: [
      { code: 301, name: t('eventCommands.commands.301') },
      { code: 302, name: t('eventCommands.commands.302') },
      { code: 303, name: t('eventCommands.commands.303') },
      { code: 351, name: t('eventCommands.commands.351') },
      { code: 352, name: t('eventCommands.commands.352') },
      { code: 353, name: t('eventCommands.commands.353') },
      { code: 354, name: t('eventCommands.commands.354') },
    ],
    [t('eventCommands.categories.tab3Advanced')]: [
      { code: 355, name: t('eventCommands.commands.355') },
      { code: 356, name: t('eventCommands.commands.356') },
    ],
  }), [t]);

  const filtered = useMemo(() => {
    return Object.entries(COMMAND_CATEGORIES).map(([category, cmds]) => {
      const matched = cmds.filter(c => fuzzyMatch(c.name, commandFilter) || fuzzyMatch(category, commandFilter));
      return { category, matched };
    }).filter(g => g.matched.length > 0);
  }, [COMMAND_CATEGORIES, commandFilter]);

  return (
    <div className="modal-overlay" onClick={() => onCancel()}>
      <div className="image-picker-dialog" onClick={e => e.stopPropagation()} style={{ width: 'calc(100vw - 40px)', height: 'calc(100vh - 40px)' }}>
        <div className="image-picker-header">{t('eventCommands.insertCommand')}</div>
        <div className="command-filter-box">
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
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>{t('eventCommands.noResults')}</div>
          ) : (
            filtered.map(({ category, matched }) => (
              <div key={category}>
                <div style={{ fontWeight: 'bold', fontSize: 12, color: '#4ea6f5', padding: '8px 8px 4px', borderBottom: '1px solid #444', background: '#333' }}>{category}</div>
                <div className="insert-command-grid">
                  {matched.map(c => (
                    <div
                      key={c.code}
                      className="insert-command-item"
                      onClick={() => onSelect(c.code)}
                    >
                      {c.name}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => onCancel()}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
