import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Troop, TroopMember, TroopPage, TroopConditions } from '../../types/rpgMakerMV';
import EventCommandEditor from '../EventEditor/EventCommandEditor';
import DatabaseList from './DatabaseList';
import apiClient from '../../api/client';
import './TroopsTab.css';

interface TroopsTabProps {
  data: (Troop | null)[] | undefined;
  onChange: (data: (Troop | null)[]) => void;
}

interface EnemyRef { id: number; name: string; battlerName?: string }

const PREVIEW_W = 816;
const PREVIEW_H = 624;

const emptyConditions: TroopConditions = {
  actorHp: 0, actorId: 1, actorValid: false,
  enemyHp: 0, enemyIndex: 0, enemyValid: false,
  switchId: 1, switchValid: false,
  turnA: 0, turnB: 0, turnEnding: false, turnValid: false,
};

function conditionSummary(c: TroopConditions, t: (k: string) => string, actors: { id: number; name: string }[]): string {
  const parts: string[] = [];
  if (c.turnEnding) parts.push(t('fields.turnEnd'));
  if (c.turnValid) parts.push(`${t('fields.turn')} ${c.turnA}+${c.turnB}*X`);
  if (c.enemyValid) parts.push(`${t('fields.enemyNum')} #${c.enemyIndex} HP≤${c.enemyHp}%`);
  if (c.actorValid) {
    const a = actors.find(ac => ac.id === c.actorId);
    parts.push(`${a?.name || t('fields.actor')} HP≤${c.actorHp}%`);
  }
  if (c.switchValid) parts.push(`${t('fields.switch')} ${c.switchId}`);
  return parts.length > 0 ? parts.join(', ') : t('troops.noCondition');
}

export default function TroopsTab({ data, onChange }: TroopsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const [activePage, setActivePage] = useState(0);
  const [selectedEnemyId, setSelectedEnemyId] = useState(1);
  const [selectedMemberIdx, setSelectedMemberIdx] = useState(-1);
  const [enemies, setEnemies] = useState<EnemyRef[]>([]);
  const [actors, setActors] = useState<{ id: number; name: string }[]>([]);
  const [enemyImages, setEnemyImages] = useState<Record<string, HTMLImageElement>>({});
  const [battleback1, setBattleback1] = useState('');
  const [battleback2, setBattleback2] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ memberIdx: number; offsetX: number; offsetY: number } | null>(null);
  const [condDialogOpen, setCondDialogOpen] = useState(false);
  const [editingCond, setEditingCond] = useState<TroopConditions>({ ...emptyConditions });
  const [bgDialogOpen, setBgDialogOpen] = useState(false);
  const [bb1Files, setBb1Files] = useState<string[]>([]);
  const [bb2Files, setBb2Files] = useState<string[]>([]);
  const [editBb1, setEditBb1] = useState('');
  const [editBb2, setEditBb2] = useState('');

  const selectedItem = data?.find((item) => item && item.id === selectedId);

  const SPAN_OPTIONS = [t('spanOptions.battle'), t('spanOptions.turn'), t('spanOptions.moment')];

  useEffect(() => {
    apiClient.get<(EnemyRef | null)[]>('/database/enemies').then(d => {
      const list = d.filter(Boolean) as EnemyRef[];
      setEnemies(list);
      if (list.length > 0) setSelectedEnemyId(list[0].id);
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

  // 멤버 자동 배치 - RPG Maker MV 원본처럼 전체 멤버 재배치
  // 원본 패턴: 오른쪽→왼쪽으로 삼각형 형태, y는 지그재그로 깊이감
  const repositionMembers = (members: TroopMember[]) => {
    const n = members.length;
    if (n === 0) return members;
    if (n === 1) {
      return [{ ...members[0], x: 220, y: 326 }];
    }
    // x: 오른쪽(~350)에서 왼쪽(~150)으로 분배
    const xRight = 350;
    const xLeft = 150;
    const xSpacing = (xRight - xLeft) / (n - 1);
    // y: 기준 ~340, 지그재그로 ±40 변동
    const baseY = 340;
    const ySwing = 40;
    return members.map((m, i) => ({
      ...m,
      x: Math.round(xRight - xSpacing * i),
      y: Math.round(baseY + (i % 2 === 0 ? -ySwing / 2 : ySwing / 2)),
    }));
  };

  // 멤버 추가 (선택된 적을 추가) - 추가 후 전체 재배치
  const addSelectedEnemy = () => {
    if (!selectedItem || (selectedItem.members || []).length >= 8) return;
    const members = [...(selectedItem.members || [])];
    members.push({ enemyId: selectedEnemyId, x: 0, y: 0, hidden: false });
    handleFieldChange('members', repositionMembers(members));
  };

  // 선택된 멤버 제거
  const removeMember = () => {
    if (!selectedItem || selectedMemberIdx < 0) return;
    const members = [...(selectedItem.members || [])];
    if (selectedMemberIdx >= members.length) return;
    members.splice(selectedMemberIdx, 1);
    handleFieldChange('members', members);
    setSelectedMemberIdx(-1);
  };

  // 전부 삭제
  const clearMembers = () => {
    handleFieldChange('members', []);
    setSelectedMemberIdx(-1);
  };

  // 정렬 - 전체 멤버 재배치
  const alignMembers = () => {
    const members = [...(selectedItem?.members || [])];
    if (members.length === 0) return;
    handleFieldChange('members', repositionMembers(members));
  };

  // 미리보기 드래그
  const handlePreviewMouseDown = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
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
      conditions: { ...emptyConditions },
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
    const pg = selectedItem?.pages?.[activePage];
    if (!pg) return;
    const copied: TroopPage = {
      conditions: { ...pg.conditions },
      span: pg.span,
      list: pg.list.map(c => ({ ...c, parameters: [...c.parameters] })),
    };
    const pages = [...(selectedItem?.pages || [])];
    pages.splice(activePage + 1, 0, copied);
    handleFieldChange('pages', pages);
    setActivePage(activePage + 1);
  };

  const clearPage = () => {
    handlePageChange(activePage, 'list', [{ code: 0, indent: 0, parameters: [] }]);
    handlePageChange(activePage, 'conditions', { ...emptyConditions });
    handlePageChange(activePage, 'span', 0);
  };

  // 조건 다이얼로그
  const openCondDialog = () => {
    const pg = selectedItem?.pages?.[activePage];
    if (!pg) return;
    setEditingCond({ ...pg.conditions });
    setCondDialogOpen(true);
  };

  const saveCondDialog = () => {
    handlePageChange(activePage, 'conditions', editingCond);
    setCondDialogOpen(false);
  };

  // 전투 배경 변경 다이얼로그
  const openBgDialog = () => {
    setEditBb1(battleback1);
    setEditBb2(battleback2);
    apiClient.get<string[]>('/resources/battlebacks1').then(f => setBb1Files(f.map(n => n.replace(/\.png$/i, '')))).catch(() => {});
    apiClient.get<string[]>('/resources/battlebacks2').then(f => setBb2Files(f.map(n => n.replace(/\.png$/i, '')))).catch(() => {});
    setBgDialogOpen(true);
  };

  const saveBgDialog = () => {
    setBattleback1(editBb1);
    setBattleback2(editBb2);
    setBgDialogOpen(false);
  };

  // DatabaseList 핸들러
  const handleAddNew = useCallback(() => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newTroop: Troop = {
      id: maxId + 1, name: '', members: [],
      pages: [{ conditions: { ...emptyConditions }, span: 0, list: [{ code: 0, indent: 0, parameters: [] }] }],
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
          {/* ===== 일반 설정 ===== */}
          <div className="troops-section-title">{t('troops.generalSettings')}</div>
          <div className="troops-general-header">
            <div className="troops-name-label">
              {t('common.name')}:
              <input
                type="text"
                value={selectedItem.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="troops-input"
              />
            </div>
            <button className="db-btn-small" onClick={autoName}>{t('troops.autoName')}</button>
            <button className="db-btn-small" onClick={openBgDialog}>{t('troops.changeBG')}</button>
            <button className="db-btn-small" onClick={() => {}}>{t('troops.battleTest')}</button>
          </div>

          {/* ===== 배치 뷰: 미리보기 | 버튼 | 적 목록 ===== */}
          <div className="troops-placement-row">
            {/* 좌측: 미리보기 */}
            <div className="troops-preview-area" ref={previewRef}>
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
                const scale = Math.min(scaleX, scaleY);
                // CSS transform: translate(-50%, -100%)로 anchor bottom-center 적용됨
                return (
                  <img
                    key={i}
                    className={`troops-preview-enemy${member.hidden ? ' hidden-enemy' : ''}${i === selectedMemberIdx ? ' selected' : ''}`}
                    src={img.src}
                    style={{
                      left: member.x * scaleX,
                      top: member.y * scaleY,
                      width: img.naturalWidth * scale,
                      height: img.naturalHeight * scale,
                      zIndex: 2 + i,
                    }}
                    onMouseDown={(e) => { setSelectedMemberIdx(i); handlePreviewMouseDown(e, i); }}
                    draggable={false}
                  />
                );
              })}
            </div>

            {/* 중앙: < 추가 / 해제 > + 모두 해제 + 정렬 */}
            <div className="troops-mid-buttons">
              <button className="db-btn-small" onClick={addSelectedEnemy} disabled={(selectedItem.members || []).length >= 8}>
                &lt; {t('troops.add')}
              </button>
              <button className="db-btn-small" onClick={removeMember} disabled={selectedMemberIdx < 0 || selectedMemberIdx >= (selectedItem.members || []).length}>
                {t('troops.remove')} &gt;
              </button>
              <button className="db-btn-small" onClick={clearMembers} disabled={(selectedItem.members || []).length === 0}>
                {t('troops.clearAll')}
              </button>
              <button className="db-btn-small" onClick={alignMembers} disabled={(selectedItem.members || []).length === 0}>
                {t('troops.align')}
              </button>
            </div>

            {/* 우측: 전체 적 목록 */}
            <div className="troops-enemy-panel">
              <div className="troops-enemy-list">
                {enemies.map(en => {
                  const isMember = (selectedItem.members || []).some((m: TroopMember) => m.enemyId === en.id);
                  return (
                  <div
                    key={en.id}
                    className={`troops-enemy-item${en.id === selectedEnemyId ? ' selected' : ''}${isMember ? ' member' : ''}`}
                    onClick={() => setSelectedEnemyId(en.id)}
                    onDoubleClick={() => {
                      setSelectedEnemyId(en.id);
                      if ((selectedItem.members || []).length < 8) {
                        const members = [...(selectedItem.members || [])];
                        members.push({ enemyId: en.id, x: 0, y: 0, hidden: false });
                        handleFieldChange('members', repositionMembers(members));
                      }
                    }}
                  >
                    {String(en.id).padStart(4, '0')} {en.name}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===== 전투 이벤트 ===== */}
          <div className="troops-battle-events">
            <div className="troops-section-title">{t('fields.battleEvents')}</div>

            <div className="troops-events-layout">
              {/* 좌측: 페이지 관리 버튼 세로 */}
              <div className="troops-page-actions">
                <button className="troops-page-action-btn" onClick={addPage}>
                  {t('troops.eventPageNew')}
                </button>
                <button className="troops-page-action-btn" onClick={copyPage}>
                  {t('troops.eventPageCopy')}
                </button>
                <button className="troops-page-action-btn" onClick={clearPage}>
                  {t('troops.eventPageClear')}
                </button>
                <button className="troops-page-action-btn" onClick={deletePage} disabled={(selectedItem.pages || []).length <= 1}>
                  {t('troops.eventPageDelete')}
                </button>
              </div>

              {/* 우측: 페이지 탭 + 조건/범위 + 이벤트 커맨드 */}
              <div className="troops-events-body">
                {/* 페이지 탭 */}
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
                </div>

                {page && (
                  <>
                    {/* 조건 + 범위 한 줄 */}
                    <div className="troops-condition-span-line">
                      <label>
                        {t('fields.conditions')}:
                        <button className="db-btn-small" onClick={openCondDialog} style={{ minWidth: 140, textAlign: 'left' }}>
                          {conditionSummary(page.conditions, t, actors)}
                        </button>
                      </label>
                      <label>
                        {t('fields.span')}:
                        <select
                          value={page.span || 0}
                          onChange={(e) => handlePageChange(activePage, 'span', Number(e.target.value))}
                        >
                          {SPAN_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
                        </select>
                      </label>
                    </div>

                    {/* 이벤트 커맨드 */}
                    <div className="troops-event-editor">
                      <EventCommandEditor
                        commands={page.list || []}
                        onChange={(cmds) => handlePageChange(activePage, 'list', cmds)}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 조건 편집 다이얼로그 */}
      {condDialogOpen && (
        <div className="db-dialog-overlay" onClick={() => setCondDialogOpen(false)}>
          <div className="troops-cond-dialog" onClick={e => e.stopPropagation()}>
            <div className="troops-cond-dialog-title">{t('fields.conditions')}</div>
            <div className="troops-cond-dialog-body">
              <div className="troops-cond-row">
                <input type="checkbox" checked={editingCond.turnEnding}
                  onChange={(e) => setEditingCond(c => ({ ...c, turnEnding: e.target.checked }))} />
                <span>{t('fields.turnEnd')}</span>
              </div>
              <div className="troops-cond-row">
                <input type="checkbox" checked={editingCond.turnValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, turnValid: e.target.checked }))} />
                <span>{t('fields.turn')}</span>
                <input type="number" value={editingCond.turnA} disabled={!editingCond.turnValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, turnA: Number(e.target.value) }))} />
                <span>+</span>
                <input type="number" value={editingCond.turnB} disabled={!editingCond.turnValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, turnB: Number(e.target.value) }))} />
                <span>* X</span>
              </div>
              <div className="troops-cond-row">
                <input type="checkbox" checked={editingCond.enemyValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, enemyValid: e.target.checked }))} />
                <span>{t('fields.enemyNum')}</span>
                <input type="number" value={editingCond.enemyIndex} disabled={!editingCond.enemyValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, enemyIndex: Number(e.target.value) }))} />
                <span>HP ≤</span>
                <input type="number" value={editingCond.enemyHp} disabled={!editingCond.enemyValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, enemyHp: Number(e.target.value) }))} />
                <span>%</span>
              </div>
              <div className="troops-cond-row">
                <input type="checkbox" checked={editingCond.actorValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, actorValid: e.target.checked }))} />
                <span>{t('fields.actor')}</span>
                <select value={editingCond.actorId} disabled={!editingCond.actorValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, actorId: Number(e.target.value) }))}>
                  {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <span>HP ≤</span>
                <input type="number" value={editingCond.actorHp} disabled={!editingCond.actorValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, actorHp: Number(e.target.value) }))} />
                <span>%</span>
              </div>
              <div className="troops-cond-row">
                <input type="checkbox" checked={editingCond.switchValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, switchValid: e.target.checked }))} />
                <span>{t('fields.switch')}</span>
                <input type="number" value={editingCond.switchId} style={{ width: 60 }} disabled={!editingCond.switchValid}
                  onChange={(e) => setEditingCond(c => ({ ...c, switchId: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="troops-cond-dialog-footer">
              <button className="db-btn" onClick={saveCondDialog}>{t('common.ok')}</button>
              <button className="db-btn" onClick={() => setCondDialogOpen(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
      {/* 전투 배경 변경 다이얼로그 */}
      {bgDialogOpen && (
        <div className="db-dialog-overlay" onClick={() => setBgDialogOpen(false)}>
          <div className="troops-bg-dialog" onClick={e => e.stopPropagation()}>
            <div className="troops-cond-dialog-title">{t('troops.changeBG')}</div>
            <div className="troops-bg-dialog-body">
              <div className="troops-bg-list-col">
                <div className="troops-bg-list-header">battlebacks1</div>
                <div className="troops-bg-list">
                  {bb1Files.map(name => (
                    <div
                      key={name}
                      className={`troops-enemy-item${name === editBb1 ? ' selected' : ''}`}
                      onClick={() => setEditBb1(name)}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
              <div className="troops-bg-list-col">
                <div className="troops-bg-list-header">battlebacks2</div>
                <div className="troops-bg-list">
                  {bb2Files.map(name => (
                    <div
                      key={name}
                      className={`troops-enemy-item${name === editBb2 ? ' selected' : ''}`}
                      onClick={() => setEditBb2(name)}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
              <div className="troops-bg-preview">
                {editBb1 && <img src={`/img/battlebacks1/${editBb1}.png`} alt="" className="troops-bg-preview-img" />}
                {editBb2 && <img src={`/img/battlebacks2/${editBb2}.png`} alt="" className="troops-bg-preview-img" style={{ position: 'absolute', top: 0, left: 0 }} />}
              </div>
            </div>
            <div className="troops-cond-dialog-footer">
              <button className="db-btn" onClick={saveBgDialog}>{t('common.ok')}</button>
              <button className="db-btn" onClick={() => setBgDialogOpen(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
