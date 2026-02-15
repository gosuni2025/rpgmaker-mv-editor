import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import useEscClose from '../../hooks/useEscClose';
import apiClient from '../../api/client';
import ActorsTab from './ActorsTab';
import ClassesTab from './ClassesTab';
import SkillsTab from './SkillsTab';
import ItemsTab from './ItemsTab';
import WeaponsTab from './WeaponsTab';
import ArmorsTab from './ArmorsTab';
import EnemiesTab from './EnemiesTab';
import TroopsTab from './TroopsTab';
import StatesTab from './StatesTab';
import AnimationsTab from './AnimationsTab';
import TilesetsTab from './TilesetsTab';
import CommonEventsTab from './CommonEventsTab';
import SystemTab from './SystemTab';
import TypesTab from './TypesTab';
import TermsTab from './TermsTab';
import './DatabaseDialog.css';

interface Tab {
  key: string;
  labelKey: string;
}

const TABS: Tab[] = [
  { key: 'actors', labelKey: 'database.tabs.actors' },
  { key: 'classes', labelKey: 'database.tabs.classes' },
  { key: 'skills', labelKey: 'database.tabs.skills' },
  { key: 'items', labelKey: 'database.tabs.items' },
  { key: 'weapons', labelKey: 'database.tabs.weapons' },
  { key: 'armors', labelKey: 'database.tabs.armors' },
  { key: 'enemies', labelKey: 'database.tabs.enemies' },
  { key: 'troops', labelKey: 'database.tabs.troops' },
  { key: 'states', labelKey: 'database.tabs.states' },
  { key: 'animations', labelKey: 'database.tabs.animations' },
  { key: 'tilesets', labelKey: 'database.tabs.tilesets' },
  { key: 'commonEvents', labelKey: 'database.tabs.commonEvents' },
  { key: 'system', labelKey: 'database.tabs.system' },
  { key: 'types', labelKey: 'database.tabs.types' },
  { key: 'terms', labelKey: 'database.tabs.terms' },
];

type TabComponentType = React.ComponentType<{ data: unknown; onChange: (data: unknown) => void }>;

const TAB_COMPONENTS: Record<string, TabComponentType> = {
  actors: ActorsTab as TabComponentType,
  classes: ClassesTab as TabComponentType,
  skills: SkillsTab as TabComponentType,
  items: ItemsTab as TabComponentType,
  weapons: WeaponsTab as TabComponentType,
  armors: ArmorsTab as TabComponentType,
  enemies: EnemiesTab as TabComponentType,
  troops: TroopsTab as TabComponentType,
  states: StatesTab as TabComponentType,
  animations: AnimationsTab as TabComponentType,
  tilesets: TilesetsTab as TabComponentType,
  commonEvents: CommonEventsTab as TabComponentType,
  system: SystemTab as TabComponentType,
  types: TypesTab as TabComponentType,
  terms: TermsTab as TabComponentType,
};

const MAX_HISTORY = 50;

function getDataKey(tabKey: string) {
  return (tabKey === 'types' || tabKey === 'terms') ? 'system' : tabKey;
}

export default function DatabaseDialog() {
  const { t } = useTranslation();
  const setShowDatabaseDialog = useEditorStore((s) => s.setShowDatabaseDialog);
  const showToast = useEditorStore((s) => s.showToast);
  useEscClose(useCallback(() => setShowDatabaseDialog(false), [setShowDatabaseDialog]));
  const [activeTab, setActiveTab] = useState('actors');
  const [tabData, setTabData] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Undo/Redo history per dataKey
  const undoStacks = useRef<Record<string, unknown[]>>({});
  const redoStacks = useRef<Record<string, unknown[]>>({});

  const loadTabData = useCallback(async (tabKey: string) => {
    const apiKey = getDataKey(tabKey);
    const dataKey = getDataKey(tabKey);
    if (tabData[dataKey] !== undefined) return;
    setLoading(true);
    try {
      const data = await apiClient.get(`/database/${apiKey}`);
      setTabData((prev) => ({ ...prev, [dataKey]: data }));
    } catch (e) {
      console.error(`Failed to load ${tabKey}:`, e);
    } finally {
      setLoading(false);
    }
  }, [tabData]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const handleDataChange = useCallback((tabKey: string, newData: unknown) => {
    const dataKey = getDataKey(tabKey);
    setTabData((prev) => {
      const oldData = prev[dataKey];
      if (oldData !== undefined) {
        const stack = undoStacks.current[dataKey] || [];
        stack.push(oldData);
        if (stack.length > MAX_HISTORY) stack.shift();
        undoStacks.current[dataKey] = stack;
      }
      // Clear redo on new change
      redoStacks.current[dataKey] = [];
      return { ...prev, [dataKey]: newData };
    });
    setDirty((prev) => ({ ...prev, [dataKey]: true }));
  }, []);

  const undo = useCallback(() => {
    const dataKey = getDataKey(activeTab);
    const stack = undoStacks.current[dataKey];
    if (!stack || stack.length === 0) return;
    const prev = stack.pop()!;
    setTabData((current) => {
      const currentData = current[dataKey];
      if (currentData !== undefined) {
        const rStack = redoStacks.current[dataKey] || [];
        rStack.push(currentData);
        redoStacks.current[dataKey] = rStack;
      }
      return { ...current, [dataKey]: prev };
    });
    setDirty((prev) => ({ ...prev, [dataKey]: true }));
  }, [activeTab]);

  const redo = useCallback(() => {
    const dataKey = getDataKey(activeTab);
    const rStack = redoStacks.current[dataKey];
    if (!rStack || rStack.length === 0) return;
    const next = rStack.pop()!;
    setTabData((current) => {
      const currentData = current[dataKey];
      if (currentData !== undefined) {
        const uStack = undoStacks.current[dataKey] || [];
        uStack.push(currentData);
        undoStacks.current[dataKey] = uStack;
      }
      return { ...current, [dataKey]: next };
    });
    setDirty((prev) => ({ ...prev, [dataKey]: true }));
  }, [activeTab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        e.stopPropagation();
        redo();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [undo, redo]);

  const saveAll = useCallback(async () => {
    const dirtyKeys = Object.keys(dirty).filter((k) => dirty[k]);
    const allDiffs: { added: string[]; modified: string[]; deleted: string[] } = { added: [], modified: [], deleted: [] };
    for (const key of dirtyKeys) {
      try {
        const res = await apiClient.put<{ success: boolean; l10nDiff?: { added: string[]; modified: string[]; deleted: string[] } }>(`/database/${key}`, tabData[key]);
        if (res.l10nDiff) {
          allDiffs.added.push(...res.l10nDiff.added);
          allDiffs.modified.push(...res.l10nDiff.modified);
          allDiffs.deleted.push(...res.l10nDiff.deleted);
        }
      } catch (e) {
        console.error(`Failed to save ${key}:`, e);
        return false;
      }
    }
    setDirty({});
    if (allDiffs.added.length || allDiffs.modified.length || allDiffs.deleted.length) {
      const parts: string[] = [];
      if (allDiffs.added.length) parts.push(`추가 ${allDiffs.added.length}`);
      if (allDiffs.modified.length) parts.push(`변경 ${allDiffs.modified.length}`);
      if (allDiffs.deleted.length) parts.push(`삭제 ${allDiffs.deleted.length}`);
      showToast(`DB 저장 완료 (L10n: ${parts.join(', ')})`);
    }
    return true;
  }, [dirty, tabData, showToast]);

  const handleOk = async () => {
    const ok = await saveAll();
    if (ok) setShowDatabaseDialog(false);
  };

  const handleCancel = () => {
    setShowDatabaseDialog(false);
  };

  const handleApply = () => {
    saveAll();
  };

  const TabComponent = TAB_COMPONENTS[activeTab];
  const activeDataKey = getDataKey(activeTab);

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog">
        <div className="db-dialog-header">{t('database.title')}</div>
        <div className="db-dialog-body">
          <div className="db-tab-bar">
            {TABS.map((tab) => (
              <div
                key={tab.key}
                className={`db-tab-item${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {t(tab.labelKey)}
              </div>
            ))}
          </div>
          <div className="db-tab-content">
            {loading && <div className="db-loading">{t('common.loading')}</div>}
            {!loading && TabComponent && (
              <TabComponent
                data={tabData[activeDataKey]}
                onChange={(newData: unknown) => handleDataChange(activeTab, newData)}
              />
            )}
            {!loading && !TabComponent && (
              <div className="db-placeholder">
                {t(TABS.find((tb) => tb.key === activeTab)?.labelKey || '')} - {t('common.preparing')}
              </div>
            )}
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
          <button className="db-btn" onClick={handleCancel}>{t('common.cancel')}</button>
          <button className="db-btn" onClick={handleApply}>{t('common.apply')}</button>
        </div>
      </div>
    </div>
  );
}
