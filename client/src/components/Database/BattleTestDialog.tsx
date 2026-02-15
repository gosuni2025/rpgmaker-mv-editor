import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TestBattler, Actor, RPGClass, Weapon, Armor, SystemData } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
import './BattleTestDialog.css';

interface BattleTestDialogProps {
  troopId: number;
  onClose: () => void;
}

const PARAM_NAMES = ['maxHP', 'maxMP', 'attack', 'defense', 'mAttack', 'mDefense', 'agility', 'luck'] as const;
// RPG Maker MV 장비 슬롯: 0=무기, 1=방패, 2=머리, 3=몸, 4=액세서리
const EQUIP_SLOT_COUNT = 5;

export default function BattleTestDialog({ troopId, onClose }: BattleTestDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [battlers, setBattlers] = useState<TestBattler[]>([]);
  const [actors, setActors] = useState<(Actor | null)[]>([]);
  const [classes, setClasses] = useState<(RPGClass | null)[]>([]);
  const [weapons, setWeapons] = useState<(Weapon | null)[]>([]);
  const [armors, setArmors] = useState<(Armor | null)[]>([]);
  const [system, setSystem] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    Promise.all([
      apiClient.get<SystemData>('/database/system'),
      apiClient.get<(Actor | null)[]>('/database/actors'),
      apiClient.get<(RPGClass | null)[]>('/database/classes'),
      apiClient.get<(Weapon | null)[]>('/database/weapons'),
      apiClient.get<(Armor | null)[]>('/database/armors'),
    ]).then(([sys, act, cls, wpn, arm]) => {
      setSystem(sys);
      setActors(act);
      setClasses(cls);
      setWeapons(wpn);
      setArmors(arm);

      // testBattlers 로드, 없으면 기본 4명 생성
      const validActors = act.filter(Boolean) as Actor[];
      let tb = sys.testBattlers || [];
      if (tb.length === 0 && validActors.length > 0) {
        tb = Array.from({ length: Math.min(4, validActors.length) }, (_, i) => {
          const actor = validActors[i];
          return {
            actorId: actor.id,
            level: actor.initialLevel,
            equips: [...actor.equips],
          };
        });
      }
      // 항상 4명분 확보
      while (tb.length < 4) {
        const actor = validActors[0];
        if (actor) {
          tb.push({ actorId: actor.id, level: actor.initialLevel, equips: [...actor.equips] });
        } else {
          tb.push({ actorId: 1, level: 1, equips: [0, 0, 0, 0, 0] });
        }
      }
      setBattlers(tb.slice(0, 4).map(b => ({
        ...b,
        equips: b.equips.length >= EQUIP_SLOT_COUNT
          ? b.equips.slice(0, EQUIP_SLOT_COUNT)
          : [...b.equips, ...Array(EQUIP_SLOT_COUNT - b.equips.length).fill(0)],
      })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const validActors = useMemo(() => actors.filter(Boolean) as Actor[], [actors]);

  const currentBattler = battlers[activeTab];
  const currentActor = useMemo(
    () => currentBattler ? validActors.find(a => a.id === currentBattler.actorId) : undefined,
    [currentBattler, validActors]
  );
  const currentClass = useMemo(
    () => currentActor ? (classes.find(c => c && c.id === currentActor.classId) ?? null) : null,
    [currentActor, classes]
  );

  // 장비 유형 이름
  const equipTypeNames = useMemo(() => system?.equipTypes || [], [system]);

  // 장착 가능한 장비 목록 계산
  const getEquippableItems = useCallback((slotIndex: number) => {
    if (!currentActor || !currentClass) return [];
    // slotIndex 0 = 무기 (etypeId=1), 나머지 = 방어구
    const etypeId = slotIndex + 1; // RPG Maker MV: equipTypes[1]=무기, [2]=방패, [3]=머리, [4]=몸, [5]=액세서리

    if (slotIndex === 0) {
      // 무기 슬롯
      return (weapons.filter(Boolean) as Weapon[]).filter(w => w.etypeId === etypeId);
    } else {
      // 방어구 슬롯
      return (armors.filter(Boolean) as Armor[]).filter(a => a.etypeId === etypeId);
    }
  }, [currentActor, currentClass, weapons, armors]);

  // 파라미터 계산 (기본 스탯 + 장비 보정)
  const calcParams = useMemo(() => {
    if (!currentBattler || !currentClass) return Array(8).fill(0);
    const level = currentBattler.level;
    return Array.from({ length: 8 }, (_, paramId) => {
      // 기본 스탯: class.params[paramId][level]
      const base = currentClass.params[paramId]?.[level] ?? 0;
      // 장비 보정
      let equipBonus = 0;
      for (let i = 0; i < EQUIP_SLOT_COUNT; i++) {
        const itemId = currentBattler.equips[i];
        if (itemId > 0) {
          if (i === 0) {
            const w = weapons.find(w => w && w.id === itemId);
            if (w) equipBonus += w.params[paramId] || 0;
          } else {
            const a = armors.find(a => a && a.id === itemId);
            if (a) equipBonus += a.params[paramId] || 0;
          }
        }
      }
      return base + equipBonus;
    });
  }, [currentBattler, currentClass, weapons, armors]);

  const updateBattler = (index: number, patch: Partial<TestBattler>) => {
    setBattlers(prev => prev.map((b, i) => i === index ? { ...b, ...patch } : b));
  };

  const handleActorChange = (actorId: number) => {
    const actor = validActors.find(a => a.id === actorId);
    if (actor) {
      updateBattler(activeTab, {
        actorId,
        level: actor.initialLevel,
        equips: actor.equips.length >= EQUIP_SLOT_COUNT
          ? actor.equips.slice(0, EQUIP_SLOT_COUNT)
          : [...actor.equips, ...Array(EQUIP_SLOT_COUNT - actor.equips.length).fill(0)],
      });
    }
  };

  const handleInitialize = () => {
    if (currentActor) {
      updateBattler(activeTab, {
        level: currentActor.initialLevel,
        equips: currentActor.equips.length >= EQUIP_SLOT_COUNT
          ? currentActor.equips.slice(0, EQUIP_SLOT_COUNT)
          : [...currentActor.equips, ...Array(EQUIP_SLOT_COUNT - currentActor.equips.length).fill(0)],
      });
    }
  };

  const handleEquipChange = (slotIndex: number, itemId: number) => {
    const equips = [...currentBattler.equips];
    equips[slotIndex] = itemId;
    updateBattler(activeTab, { equips });
  };

  const handleOk = async () => {
    if (!system) return;
    // testBattlers + testTroopId 저장
    const updatedSystem = {
      ...system,
      testBattlers: battlers,
      testTroopId: troopId,
    };
    try {
      await apiClient.put('/database/system', updatedSystem);
      // 전투 테스트 시작
      window.open(`/game/index.html?btest`, '_blank');
      onClose();
    } catch (err) {
      console.error('Failed to save battle test settings:', err);
    }
  };

  if (loading) return null;

  return (
    <div className="db-dialog-overlay" onClick={onClose}>
      <div className="battle-test-dialog" onClick={e => e.stopPropagation()}>
        <div className="battle-test-dialog-title">{t('battleTest.title')}</div>

        {/* 탭 1~4 */}
        <div className="battle-test-tabs">
          {[0, 1, 2, 3].map(i => (
            <button
              key={i}
              className={`battle-test-tab${i === activeTab ? ' active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentBattler && (
          <div className="battle-test-body">
            {/* 좌측: 액터/레벨/장비 */}
            <div className="battle-test-left">
              {/* 액터 선택 */}
              <div className="battle-test-row">
                <label>{t('battleTest.actor')}:</label>
                <select
                  value={currentBattler.actorId}
                  onChange={e => handleActorChange(Number(e.target.value))}
                >
                  {validActors.map(a => (
                    <option key={a.id} value={a.id}>
                      {String(a.id).padStart(4, '0')} {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 레벨 */}
              <div className="battle-test-row">
                <label>{t('battleTest.level')}:</label>
                <input
                  type="number"
                  min={1}
                  max={currentActor?.maxLevel || 99}
                  value={currentBattler.level}
                  onChange={e => updateBattler(activeTab, { level: Math.max(1, Math.min(currentActor?.maxLevel || 99, Number(e.target.value))) })}
                />
                <button className="db-btn-small" onClick={handleInitialize}>
                  {t('battleTest.initialize')}
                </button>
              </div>

              {/* 장비 테이블 */}
              <table className="battle-test-equip-table">
                <thead>
                  <tr>
                    <th>{t('battleTest.equipType')}</th>
                    <th>{t('battleTest.equipItem')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: EQUIP_SLOT_COUNT }, (_, slotIdx) => {
                    const items = getEquippableItems(slotIdx);
                    const typeName = equipTypeNames[slotIdx + 1] || `Slot ${slotIdx + 1}`;
                    return (
                      <tr key={slotIdx}>
                        <td className="battle-test-equip-type">{typeName}</td>
                        <td>
                          <select
                            value={currentBattler.equips[slotIdx] || 0}
                            onChange={e => handleEquipChange(slotIdx, Number(e.target.value))}
                          >
                            <option value={0}>{t('battleTest.none')}</option>
                            {items.map((item: Weapon | Armor) => (
                              <option key={item.id} value={item.id}>
                                {String(item.id).padStart(4, '0')} {item.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 우측: 스테이터스 */}
            <div className="battle-test-right">
              <div className="battle-test-status-title">{t('battleTest.status')}</div>
              <div className="battle-test-status-list">
                {PARAM_NAMES.map((name, i) => (
                  <div key={name} className="battle-test-status-row">
                    <span className="battle-test-status-label">{t(`battleTest.${name}`)}</span>
                    <span className="battle-test-status-value">{calcParams[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* OK / 취소 */}
        <div className="battle-test-dialog-footer">
          <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
          <button className="db-btn" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
