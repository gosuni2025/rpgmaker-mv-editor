import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Troop, TroopMember, TroopPage } from '../../types/rpgMakerMV';
import EventCommandEditor from '../EventEditor/EventCommandEditor';
import DatabaseList from './DatabaseList';
import apiClient from '../../api/client';
import './TroopsTab.css';

interface TroopsTabProps {
  data: (Troop | null)[] | undefined;
  onChange: (data: (Troop | null)[]) => void;
}

interface EnemyRef { id: number; name: string; battlerName?: string }

const PREVIEW_W = 544;
const PREVIEW_H = 416;

export default function TroopsTab({ data, onChange }: TroopsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const [activePage, setActivePage] = useState(0);
  const [selectedMemberIdx, setSelectedMemberIdx] = useState(-1);
  const [addEnemyId, setAddEnemyId] = useState(1);
  const [enemies, setEnemies] = useState<EnemyRef[]>([]);
  const [actors, setActors] = useState<{ id: number; name: string }[]>([]);
  const [enemyImages, setEnemyImages] = useState<Record<string, HTMLImageElement>>({});
  const [battleback1, setBattleback1] = useState('');
  const [battleback2, setBattleback2] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ memberIdx: number; offsetX: number; offsetY: number } | null>(null);

  const selectedItem = data?.find((item) => item && item.id === selectedId);

  const SPAN_OPTIONS = [t('spanOptions.battle'), t('spanOptions.turn'), t('spanOptions.moment')];

  // 적 데이터 + 액터 데이터 + 시스템 배틀백 로드
  useEffect(() => {
    apiClient.get<(EnemyRef | null)[]>('/database/enemies').then(d => {
      const list = d.filter(Boolean) as EnemyRef[];
      setEnemies(list);
      if (list.length > 0) setAddEnemyId(list[0].id);
    }).catch(() => {});
    apiClient.get<({ id: number; name: string } | null)[]>('/database/actors').then(d => {
      setActors(d.filter(Boolean) as { id: number; name: string }[]);
    }).catch(() => {});
    apiClient.get<{ battleback1Name?: string; battleback2Name?: string }>('/database/system').then(sys => {
      setBattleback1(sys.battleback1Name || '');
      setBattleback2(sys.battleback2Name || '');
    }).catch(() => {});
  }, []);

  // 적 battler 이미지 로드
  const battlerNamesNeeded = useMemo(() => {
    if (!selectedItem) return [];
    const names = new Set<string>();
    for (const m of selectedItem.members || []) {
      const en = enemies.find(e => e.id === m.enemyId);
      if (en?.battlerName) names.add(en.battlerName);
    }
    return Array.from(names);
  }, [selectedItem, enemies]);

  useEffect(() => {
    for (const name of battlerNamesNeeded) {
      if (enemyImages[name]) continue;
      const img = new Image();
      img.src = `/img/enemies/${name}.png`;
      img.onload = () => setEnemyImages(prev => ({ ...prev, [name]: img }));
    }
  }, [battlerNamesNeeded]);

  const enemyNameMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const e of enemies) m[e.id] = e.name;
    return m;
  }, [enemies]);

  const enemyBattlerMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const e of enemies) if (e.battlerName) m[e.id] = e.battlerName;
    return m;
  }, [enemies]);

  const handleFieldChange = (field: keyof Troop, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) return { ...item, [field]: value };
      return item;
    });
    onChange(newData);
  };

  // 이름 자동 작성
  const autoName = () => {
    if (!selectedItem) return;
    const members = selectedItem.members || [];
    const counts: Record<number, number> = {};
    for (const m of members) counts[m.enemyId] = (counts[m.enemyId] || 0) + 1;
    const parts: string[] = [];
    const seen = new Set<number>();
    for (const m of members) {
      if (seen.has(m.enemyId)) continue;
      seen.add(m.enemyId);
      const name = enemyNameMap[m.enemyId] || `Enemy${m.enemyId}`;
      parts.push(counts[m.enemyId] > 1 ? `${name}*${counts[m.enemyId]}` : name);
    }
    handleFieldChange('name', parts.join(', '));
  };

  // 멤버 추가
  const addMember = () => {
    if ((selectedItem?.members || []).length >= 8) return;
    const members = [...(selectedItem?.members || [])];
    const x = 200 + members.length * 60;
    members.push({ enemyId: addEnemyId, x: Math.min(x, PREVIEW_W - 50), y: Math.round(PREVIEW_H * 0.75), hidden: false });
    handleFieldChange('members', members);
    setSelectedMemberIdx(members.length - 1);
  };

  // 멤버 제거
  const removeMember = () => {
    if (selectedMemberIdx < 0) return;
    const members = (selectedItem?.members || []).filter((_: unknown, i: number) => i !== selectedMemberIdx);
    handleFieldChange('members', members);
    setSelectedMemberIdx(Math.min(selectedMemberIdx, members.length - 1));
  };

  // 전부 삭제
  const clearMembers = () => {
    handleFieldChange('members', []);
    setSelectedMemberIdx(-1);
  };

  // 정렬 (좌→우 균등 배치)
  const alignMembers = () => {
    const members = [...(selectedItem?.members || [])];
    if (members.length === 0) return;
    const spacing = PREVIEW_W / (members.length + 1);
    const y = Math.round(PREVIEW_H * 0.75);
    for (let i = 0; i < members.length; i++) {
      members[i] = { ...members[i], x: Math.round(spacing * (i + 1)), y };
    }
    handleFieldChange('members', members);
  };

  // 미리보기 드래그
  const handlePreviewMouseDown = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedMemberIdx(idx);
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const member = selectedItem?.members?.[idx];
    if (!member) return;
    const scaleX = rect.width / PREVIEW_W;
    const scaleY = rect.height / PREVIEW_H;
    const offsetX = e.clientX - rect.left - member.x * scaleX;
    const offsetY = e.clientY - rect.top - member.y * scaleY;
    setDragging({ memberIdx: idx, offsetX, offsetY });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = previewRef.current?.getBoundingClientRect();
      if (!rect || !selectedItem) return;
      const scaleX = rect.width / PREVIEW_W;
      const scaleY = rect.height / PREVIEW_H;
      let x = Math.round((e.clientX - rect.left - dragging.offsetX) / scaleX);
      let y = Math.round((e.clientY - rect.top - dragging.offsetY) / scaleY);
      x = Math.max(0, Math.min(PREVIEW_W, x));
      y = Math.max(0, Math.min(PREVIEW_H, y));
      const members = [...(selectedItem.members || [])];
      members[dragging.memberIdx] = { ...members[dragging.memberIdx], x, y };
      handleFieldChange('members', members);
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, selectedItem, selectedId, data]);

  // 전투 이벤트 페이지
  const handlePageChange = (pageIdx: number, field: keyof TroopPage, value: unknown) => {
    const pages = [...(selectedItem?.pages || [])];
    pages[pageIdx] = { ...pages[pageIdx], [field]: value };
    handleFieldChange('pages', pages);
  };

  const addPage = () => {
    const newPage: TroopPage = {
      conditions: {
        actorHp: 0, actorId: 1, actorValid: false,
        enemyHp: 0, enemyIndex: 0, enemyValid: false,
        switchId: 1, switchValid: false,
        turnA: 0, turnB: 0, turnEnding: false, turnValid: false,
      },
      span: 0,
      list: [{ code: 0, indent: 0, parameters: [] }],
    };
    handleFieldChange('pages', [...(selectedItem?.pages || []), newPage]);
    setActivePage((selectedItem?.pages || []).length);
  };

  const deletePage = () => {
    const pages = selectedItem?.pages || [];
    if (pages.length <= 1) return;
    handleFieldChange('pages', pages.filter((_: unknown, i: number) => i !== activePage));
    setActivePage(Math.min(activePage, pages.length - 2));
  };

  const copyPage = () => {
    const page = selectedItem?.pages?.[activePage];
    if (!page) return;
    const copied: TroopPage = {
      conditions: { ...page.conditions },
      span: page.span,
      list: page.list.map(c => ({ ...c, parameters: [...c.parameters] })),
    };
    const pages = [...(selectedItem?.pages || [])];
    pages.splice(activePage + 1, 0, copied);
    handleFieldChange('pages', pages);
    setActivePage(activePage + 1);
  };

  const clearPage = () => {
    handlePageChange(activePage, 'list', [{ code: 0, indent: 0, parameters: [] }]);
    handlePageChange(activePage, 'conditions', {
      actorHp: 0, actorId: 1, actorValid: false,
      enemyHp: 0, enemyIndex: 0, enemyValid: false,
      switchId: 1, switchValid: false,
      turnA: 0, turnB: 0, turnEnding: false, turnValid: false,
    });
    handlePageChange(activePage, 'span', 0);
  };

  // DatabaseList 핸들러
  const handleAddNew = useCallback(() => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newTroop: Troop = {
      id: maxId + 1, name: '', members: [],
      pages: [{ conditions: { actorHp: 0, actorId: 1, actorValid: false, enemyHp: 0, enemyIndex: 0, enemyValid: false, switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false }, span: 0, list: [{ code: 0, indent: 0, parameters: [] }] }],
    };
    const newData = [...data];
    while (newData.length <= maxId + 1) newData.push(null);
    newData[maxId + 1] = newTroop;
    onChange(newData);
    setSelectedId(maxId + 1);
  }, [data, onChange]);

  const handleDelete = useCallback((id: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Troop[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== id);
    onChange(newData);
    if (id === selectedId) {
      const remaining = newData.filter(Boolean) as Troop[];
      if (remaining.length > 0) setSelectedId(remaining[0].id);
    }
  }, [data, onChange, selectedId]);

  const handleDuplicate = useCallback((id: number) => {
    if (!data) return;
    const source = data.find((item) => item && item.id === id);
    if (!source) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newId = maxId + 1;
    const newData = [...data];
    while (newData.length <= newId) newData.push(null);
    newData[newId] = {
      ...source, id: newId,
      members: source.members.map(m => ({ ...m })),
      pages: source.pages.map(p => ({ ...p, conditions: { ...p.conditions }, list: p.list.map(c => ({ ...c, parameters: [...c.parameters] })) })),
    };
    onChange(newData);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleReorder = useCallback((fromId: number, toId: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Troop[];
    const fromIdx = items.findIndex(item => item.id === fromId);
    if (fromIdx < 0) return;
    const [moved] = items.splice(fromIdx, 1);
    if (toId === -1) {
      items.push(moved);
    } else {
      const toIdx = items.findIndex(item => item.id === toId);
      if (toIdx < 0) items.push(moved);
      else items.splice(toIdx, 0, moved);
    }
    onChange([null, ...items]);
  }, [data, onChange]);

  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
    setActivePage(0);
    setSelectedMemberIdx(-1);
  }, []);

  const page = selectedItem?.pages?.[activePage];

  return (
    <div className="db-tab-layout">
      <DatabaseList
        items={data}
        selectedId={selectedId}
        onSelect={handleSelect}
        onAdd={handleAddNew}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
      />

      {selectedItem && (
        <div className="troops-main">
          {/* 일반 설정 */}
          <div className="troops-section-title">{t('troops.generalSettings')}</div>
          <div className="troops-general-header">
            <label>
              {t('common.name')}:
              <input
                type="text"
                value={selectedItem.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="troops-input"
              />
            </label>
            <button className="db-btn-small" onClick={autoName}>{t('troops.autoName')}</button>
            <button className="db-btn-small" onClick={() => {}}>{t('troops.battleTest')}</button>
          </div>

          {/* 배치 뷰: 미리보기 + 멤버 목록 */}
          <div className="troops-placement-row">
            {/* 전투 미리보기 */}
            <div className="troops-preview-area" ref={previewRef} onClick={() => setSelectedMemberIdx(-1)}>
              {battleback1 && (
                <img className="troops-preview-bg" src={`/img/battlebacks1/${battleback1}.png`} alt="" />
              )}
              {battleback2 && (
                <img className="troops-preview-bg" src={`/img/battlebacks2/${battleback2}.png`} alt="" style={{ zIndex: 1 }} />
              )}
              {(selectedItem.members || []).map((member: TroopMember, i: number) => {
                const battlerName = enemyBattlerMap[member.enemyId];
                const img = battlerName ? enemyImages[battlerName] : null;
                if (!img) return null;
                const rect = previewRef.current?.getBoundingClientRect();
                const scaleX = rect ? rect.width / PREVIEW_W : 1;
                const scaleY = rect ? rect.height / PREVIEW_H : 1;
                return (
                  <img
                    key={i}
                    className={`troops-preview-enemy${i === selectedMemberIdx ? ' selected' : ''}${member.hidden ? ' hidden-enemy' : ''}`}
                    src={img.src}
                    style={{
                      left: member.x * scaleX,
                      top: member.y * scaleY,
                      zIndex: 2 + i,
                    }}
                    onMouseDown={(e) => handlePreviewMouseDown(e, i)}
                    draggable={false}
                  />
                );
              })}
            </div>

            {/* 멤버 패널 */}
            <div className="troops-member-panel">
              <div className="troops-member-list">
                {(selectedItem.members || []).map((member: TroopMember, i: number) => (
                  <div
                    key={i}
                    className={`troops-member-item${i === selectedMemberIdx ? ' selected' : ''}`}
                    onClick={() => setSelectedMemberIdx(i)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedMemberIdx(i);
                    }}
                  >
                    {String(member.enemyId).padStart(4, '0')} {enemyNameMap[member.enemyId] || ''}
                  </div>
                ))}
              </div>
              <div className="troops-enemy-add-row">
                <select value={addEnemyId} onChange={(e) => setAddEnemyId(Number(e.target.value))}>
                  {enemies.map(en => (
                    <option key={en.id} value={en.id}>{String(en.id).padStart(4, '0')}: {en.name}</option>
                  ))}
                </select>
              </div>
              <div className="troops-member-buttons">
                <button className="db-btn-small" onClick={addMember} disabled={(selectedItem.members || []).length >= 8}>
                  {t('troops.addMember')}
                </button>
                <button className="db-btn-small" onClick={removeMember} disabled={selectedMemberIdx < 0}>
                  {t('troops.removeMember')}
                </button>
                <button className="db-btn-small" onClick={clearMembers} disabled={(selectedItem.members || []).length === 0}>
                  {t('troops.clearAll')}
                </button>
                <button className="db-btn-small" onClick={alignMembers} disabled={(selectedItem.members || []).length === 0}>
                  {t('troops.align')}
                </button>
              </div>
              {selectedMemberIdx >= 0 && selectedItem.members?.[selectedMemberIdx] && (
                <label style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={selectedItem.members[selectedMemberIdx].hidden}
                    onChange={(e) => {
                      const members = [...(selectedItem.members || [])];
                      members[selectedMemberIdx] = { ...members[selectedMemberIdx], hidden: e.target.checked };
                      handleFieldChange('members', members);
                    }}
                  />
                  {t('troops.appearHalfway')}
                </label>
              )}
            </div>
          </div>

          {/* 전투 이벤트 */}
          <div className="troops-battle-events">
            <div className="troops-section-title">{t('fields.battleEvents')}</div>

            {/* 페이지 탭 + 버튼 */}
            <div className="troops-page-tabs">
              {(selectedItem.pages || []).map((_: TroopPage, i: number) => (
                <button
                  key={i}
                  className={`troops-page-tab${i === activePage ? ' active' : ''}`}
                  onClick={() => setActivePage(i)}
                >
                  {i + 1}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button className="db-btn-small" onClick={addPage}>{t('troops.newPage')}</button>
                <button className="db-btn-small" onClick={copyPage}>{t('troops.copyPage')}</button>
                <button className="db-btn-small" onClick={clearPage}>{t('troops.clearPage')}</button>
                <button className="db-btn-small" onClick={deletePage} disabled={(selectedItem.pages || []).length <= 1}>
                  {t('troops.deletePage')}
                </button>
              </div>
            </div>

            {page && (
              <div className="troops-page-content">
                {/* 조건 + 범위 */}
                <div className="troops-conditions-span-row">
                  <div className="troops-conditions-box">
                    <div className="troops-section-title">{t('fields.conditions')}</div>
                    <div className="troops-condition-row">
                      <input type="checkbox" checked={page.conditions?.turnValid ?? false}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, turnValid: e.target.checked })} />
                      <span>{t('fields.turn')}</span>
                      <input type="number" value={page.conditions?.turnA ?? 0} disabled={!page.conditions?.turnValid}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, turnA: Number(e.target.value) })} />
                      <span>+</span>
                      <input type="number" value={page.conditions?.turnB ?? 0} disabled={!page.conditions?.turnValid}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, turnB: Number(e.target.value) })} />
                      <span>x</span>
                    </div>
                    <div className="troops-condition-row">
                      <input type="checkbox" checked={page.conditions?.enemyValid ?? false}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, enemyValid: e.target.checked })} />
                      <span>{t('fields.enemyNum')}</span>
                      <input type="number" value={page.conditions?.enemyIndex ?? 0} disabled={!page.conditions?.enemyValid}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, enemyIndex: Number(e.target.value) })} />
                      <span>HP &le;</span>
                      <input type="number" value={page.conditions?.enemyHp ?? 0} disabled={!page.conditions?.enemyValid}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, enemyHp: Number(e.target.value) })} />
                      <span>%</span>
                    </div>
                    <div className="troops-condition-row">
                      <input type="checkbox" checked={page.conditions?.actorValid ?? false}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, actorValid: e.target.checked })} />
                      <span>{t('fields.actor')}</span>
                      <select value={page.conditions?.actorId ?? 1} disabled={!page.conditions?.actorValid}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, actorId: Number(e.target.value) })}>
                        {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <span>HP &le;</span>
                      <input type="number" value={page.conditions?.actorHp ?? 0} disabled={!page.conditions?.actorValid}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, actorHp: Number(e.target.value) })} />
                      <span>%</span>
                    </div>
                    <div className="troops-condition-row">
                      <input type="checkbox" checked={page.conditions?.switchValid ?? false}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, switchValid: e.target.checked })} />
                      <span>{t('fields.switch')}</span>
                      <input type="number" value={page.conditions?.switchId ?? 1} style={{ width: 60 }} disabled={!page.conditions?.switchValid}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, switchId: Number(e.target.value) })} />
                    </div>
                    <div className="troops-condition-row">
                      <input type="checkbox" checked={page.conditions?.turnEnding ?? false}
                        onChange={(e) => handlePageChange(activePage, 'conditions', { ...page.conditions, turnEnding: e.target.checked })} />
                      <span>{t('fields.turnEnd')}</span>
                    </div>
                  </div>

                  <div className="troops-span-box">
                    <div className="troops-section-title">{t('fields.span')}</div>
                    <select
                      className="troops-span-select"
                      value={page.span || 0}
                      onChange={(e) => handlePageChange(activePage, 'span', Number(e.target.value))}
                    >
                      {SPAN_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
                    </select>
                  </div>
                </div>

                {/* 이벤트 커맨드 */}
                <div className="troops-event-editor">
                  <EventCommandEditor
                    commands={page.list || []}
                    onChange={(cmds) => handlePageChange(activePage, 'list', cmds)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
