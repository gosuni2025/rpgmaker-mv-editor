import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
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

interface Tab {
  key: string;
  label: string;
}

const TABS: Tab[] = [
  { key: 'actors', label: 'Actors' },
  { key: 'classes', label: 'Classes' },
  { key: 'skills', label: 'Skills' },
  { key: 'items', label: 'Items' },
  { key: 'weapons', label: 'Weapons' },
  { key: 'armors', label: 'Armors' },
  { key: 'enemies', label: 'Enemies' },
  { key: 'troops', label: 'Troops' },
  { key: 'states', label: 'States' },
  { key: 'animations', label: 'Animations' },
  { key: 'tilesets', label: 'Tilesets' },
  { key: 'commonEvents', label: 'Common Events' },
  { key: 'system', label: 'System' },
  { key: 'types', label: 'Types' },
  { key: 'terms', label: 'Terms' },
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

export default function DatabaseDialog() {
  const setShowDatabaseDialog = useEditorStore((s) => s.setShowDatabaseDialog);
  const [activeTab, setActiveTab] = useState('actors');
  const [tabData, setTabData] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const loadTabData = useCallback(async (tabKey: string) => {
    // Types and Terms tabs use system data
    const apiKey = (tabKey === 'types' || tabKey === 'terms') ? 'system' : tabKey;
    const dataKey = (tabKey === 'types' || tabKey === 'terms') ? 'system' : tabKey;
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
    const dataKey = (tabKey === 'types' || tabKey === 'terms') ? 'system' : tabKey;
    setTabData((prev) => ({ ...prev, [dataKey]: newData }));
    setDirty((prev) => ({ ...prev, [dataKey]: true }));
  }, []);

  const saveAll = useCallback(async () => {
    const dirtyKeys = Object.keys(dirty).filter((k) => dirty[k]);
    for (const key of dirtyKeys) {
      try {
        await apiClient.put(`/database/${key}`, tabData[key]);
      } catch (e) {
        console.error(`Failed to save ${key}:`, e);
        return false;
      }
    }
    setDirty({});
    return true;
  }, [dirty, tabData]);

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
  const activeDataKey = (activeTab === 'types' || activeTab === 'terms') ? 'system' : activeTab;

  return (
    <div className="db-dialog-overlay" onClick={handleCancel}>
      <div className="db-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="db-dialog-header">Database</div>
        <div className="db-dialog-body">
          <div className="db-tab-bar">
            {TABS.map((tab) => (
              <div
                key={tab.key}
                className={`db-tab-item${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </div>
            ))}
          </div>
          <div className="db-tab-content">
            {loading && <div className="db-loading">Loading...</div>}
            {!loading && TabComponent && (
              <TabComponent
                data={tabData[activeDataKey]}
                onChange={(newData: unknown) => handleDataChange(activeTab, newData)}
              />
            )}
            {!loading && !TabComponent && (
              <div className="db-placeholder">
                {TABS.find((t) => t.key === activeTab)?.label} - 준비 중
              </div>
            )}
          </div>
        </div>
        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={handleCancel}>Cancel</button>
          <button className="db-btn" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
}
