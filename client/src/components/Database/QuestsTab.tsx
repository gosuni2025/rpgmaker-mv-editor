import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Quest, QuestDatabase, QuestCategory, QuestObjective, QuestObjectiveType,
  QuestObjectiveConfig, QuestReward, QuestRewardType, QuestVariableOperator,
} from '../../types/rpgMakerMV';
import { selectStyleFull, selectStyle } from '../../styles/editorStyles';
import './QuestsTab.css';

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

function emptyDb(): QuestDatabase {
  return {
    categories: [
      { id: 'main', name: '메인 퀘스트', icon: 79 },
      { id: 'side', name: '사이드 퀘스트', icon: 80 },
    ],
    quests: [],
  };
}

function newQuest(id: string, categoryId: string): Quest {
  return {
    id,
    title: '새 퀘스트',
    category: categoryId,
    description: '',
    difficulty: '',
    requester: '',
    location: '',
    objectives: [],
    rewards: [],
    note: '',
  };
}

function newObjective(id: number): QuestObjective {
  return { id, text: '새 목표', type: 'manual', config: {}, optional: false, hidden: false };
}

function newReward(): QuestReward {
  return { type: 'gold', amount: 500 };
}

function generateQuestId(quests: Quest[]): string {
  const nums = quests
    .map((q) => parseInt(q.id.replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `q${String(max + 1).padStart(3, '0')}`;
}

const OBJECTIVE_TYPE_LABELS: Record<QuestObjectiveType, string> = {
  kill:     '적 처치',
  collect:  '아이템 보유',
  gold:     '골드 보유',
  variable: '변수 조건',
  switch:   '스위치 조건',
  reach:    '위치 도달',
  talk:     'NPC 대화',
  manual:   '수동 완료',
};

const REWARD_TYPE_LABELS: Record<QuestRewardType, string> = {
  gold:   '골드',
  exp:    'EXP',
  item:   '아이템',
  weapon: '무기',
  armor:  '방어구',
};

// ─── 서브 컴포넌트: 목표 설정 필드 ──────────────────────────────────────────

interface ObjectiveConfigEditorProps {
  type: QuestObjectiveType;
  config: QuestObjectiveConfig;
  onChange: (config: QuestObjectiveConfig) => void;
}

function ObjectiveConfigEditor({ type, config, onChange }: ObjectiveConfigEditorProps) {
  const set = useCallback(<K extends keyof QuestObjectiveConfig>(key: K, val: QuestObjectiveConfig[K]) => {
    onChange({ ...config, [key]: val });
  }, [config, onChange]);

  const numInput = (label: string, key: keyof QuestObjectiveConfig, defaultVal = 0) => (
    <label className="qs-cfg-field">
      {label}
      <input
        type="number"
        value={(config[key] as number) ?? defaultVal}
        min={0}
        onChange={(e) => set(key, Number(e.target.value) as QuestObjectiveConfig[typeof key])}
      />
    </label>
  );

  if (type === 'kill') {
    return (
      <div className="qs-cfg-row">
        {numInput('적 ID', 'enemyId', 1)}
        {numInput('마리 수', 'count', 1)}
      </div>
    );
  }
  if (type === 'collect') {
    return (
      <div className="qs-cfg-row">
        <label className="qs-cfg-field">
          종류
          <select
            value={config.itemType || 'item'}
            onChange={(e) => set('itemType', e.target.value as 'item' | 'weapon' | 'armor')}
            style={selectStyle}
          >
            <option value="item">아이템</option>
            <option value="weapon">무기</option>
            <option value="armor">방어구</option>
          </select>
        </label>
        {numInput('아이템 ID', 'itemId', 1)}
        {numInput('개수', 'count', 1)}
      </div>
    );
  }
  if (type === 'gold') {
    return (
      <div className="qs-cfg-row">
        {numInput('최소 골드', 'amount', 100)}
      </div>
    );
  }
  if (type === 'variable') {
    return (
      <div className="qs-cfg-row">
        {numInput('변수 ID', 'variableId', 1)}
        <label className="qs-cfg-field">
          조건
          <select
            value={config.operator || '>='}
            onChange={(e) => set('operator', e.target.value as QuestVariableOperator)}
            style={selectStyle}
          >
            {(['>=', '==', '<=', '>', '<', '!='] as QuestVariableOperator[]).map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </label>
        {numInput('값', 'value', 1)}
      </div>
    );
  }
  if (type === 'switch') {
    return (
      <div className="qs-cfg-row">
        {numInput('스위치 ID', 'switchId', 1)}
        <label className="qs-cfg-field">
          조건
          <select
            value={config.switchValue === false ? 'false' : 'true'}
            onChange={(e) => set('switchValue', e.target.value === 'true')}
            style={selectStyle}
          >
            <option value="true">ON</option>
            <option value="false">OFF</option>
          </select>
        </label>
      </div>
    );
  }
  if (type === 'reach') {
    return (
      <div className="qs-cfg-row">
        {numInput('맵 ID', 'mapId', 1)}
        {numInput('X', 'x', 0)}
        {numInput('Y', 'y', 0)}
        {numInput('반경(타일)', 'radius', 2)}
      </div>
    );
  }
  if (type === 'talk') {
    return (
      <div className="qs-cfg-row">
        {numInput('맵 ID', 'mapId', 1)}
        {numInput('이벤트 ID', 'eventId', 1)}
      </div>
    );
  }
  return <div className="qs-cfg-row qs-cfg-manual">플러그인 커맨드 <code>QuestSystem completeObjective &lt;questId&gt; &lt;objId&gt;</code> 로 완료 처리</div>;
}

// ─── 서브 컴포넌트: 목표 행 ───────────────────────────────────────────────

interface ObjectiveRowProps {
  obj: QuestObjective;
  onChange: (obj: QuestObjective) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ObjectiveRow({ obj, onChange, onDelete, onMoveUp, onMoveDown }: ObjectiveRowProps) {
  const set = <K extends keyof QuestObjective>(k: K, v: QuestObjective[K]) =>
    onChange({ ...obj, [k]: v });

  return (
    <div className="qs-obj-row">
      <div className="qs-obj-header">
        <span className="qs-obj-id">#{obj.id}</span>
        <input
          className="qs-obj-text"
          type="text"
          value={obj.text}
          onChange={(e) => set('text', e.target.value)}
          placeholder="목표 텍스트"
        />
        <select
          value={obj.type}
          onChange={(e) => onChange({ ...obj, type: e.target.value as QuestObjectiveType, config: {} })}
          style={{ ...selectStyle, fontSize: 12 }}
        >
          {(Object.entries(OBJECTIVE_TYPE_LABELS) as [QuestObjectiveType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <label className="qs-obj-check">
          <input type="checkbox" checked={!!obj.optional} onChange={(e) => set('optional', e.target.checked)} />
          선택
        </label>
        <label className="qs-obj-check">
          <input type="checkbox" checked={!!obj.hidden} onChange={(e) => set('hidden', e.target.checked)} />
          숨김
        </label>
        <div className="qs-obj-btns">
          <button onClick={onMoveUp} title="위로">↑</button>
          <button onClick={onMoveDown} title="아래로">↓</button>
          <button onClick={onDelete} title="삭제" className="qs-btn-danger">×</button>
        </div>
      </div>
      {obj.type !== 'manual' && (
        <ObjectiveConfigEditor
          type={obj.type}
          config={obj.config}
          onChange={(cfg) => set('config', cfg)}
        />
      )}
    </div>
  );
}

// ─── 서브 컴포넌트: 보상 행 ───────────────────────────────────────────────

interface RewardRowProps {
  reward: QuestReward;
  onChange: (r: QuestReward) => void;
  onDelete: () => void;
}

function RewardRow({ reward, onChange, onDelete }: RewardRowProps) {
  const set = <K extends keyof QuestReward>(k: K, v: QuestReward[K]) =>
    onChange({ ...reward, [k]: v });

  const showAmount = reward.type === 'gold' || reward.type === 'exp';
  const showItem   = reward.type === 'item' || reward.type === 'weapon' || reward.type === 'armor';

  return (
    <div className="qs-reward-row">
      <select
        value={reward.type}
        onChange={(e) => onChange({ type: e.target.value as QuestRewardType })}
        style={{ ...selectStyle, fontSize: 12, width: 80 }}
      >
        {(Object.entries(REWARD_TYPE_LABELS) as [QuestRewardType, string][]).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      {showAmount && (
        <input
          type="number"
          value={reward.amount ?? 0}
          min={0}
          onChange={(e) => set('amount', Number(e.target.value))}
          placeholder="수량"
          style={{ width: 80 }}
        />
      )}
      {showItem && (
        <>
          <input
            type="number"
            value={reward.itemId ?? 1}
            min={1}
            onChange={(e) => set('itemId', Number(e.target.value))}
            placeholder="ID"
            style={{ width: 60 }}
          />
          <input
            type="number"
            value={reward.count ?? 1}
            min={1}
            onChange={(e) => set('count', Number(e.target.value))}
            placeholder="개수"
            style={{ width: 60 }}
          />
        </>
      )}
      <button onClick={onDelete} className="qs-btn-danger qs-reward-del" title="삭제">×</button>
    </div>
  );
}

// ─── 서브 컴포넌트: 퀘스트 편집 패널 ────────────────────────────────────────

interface QuestEditorProps {
  quest: Quest;
  categories: QuestCategory[];
  onChange: (q: Quest) => void;
}

function QuestEditor({ quest, categories, onChange }: QuestEditorProps) {
  const set = <K extends keyof Quest>(k: K, v: Quest[K]) =>
    onChange({ ...quest, [k]: v });

  const nextObjId = quest.objectives.length > 0
    ? Math.max(...quest.objectives.map((o) => o.id)) + 1
    : 1;

  const updateObj = (idx: number, obj: QuestObjective) => {
    const objs = [...quest.objectives];
    objs[idx] = obj;
    set('objectives', objs);
  };

  const deleteObj = (idx: number) => {
    set('objectives', quest.objectives.filter((_, i) => i !== idx));
  };

  const moveObj = (idx: number, dir: -1 | 1) => {
    const objs = [...quest.objectives];
    const target = idx + dir;
    if (target < 0 || target >= objs.length) return;
    [objs[idx], objs[target]] = [objs[target], objs[idx]];
    set('objectives', objs);
  };

  const addReward = () => set('rewards', [...quest.rewards, newReward()]);

  const updateReward = (idx: number, r: QuestReward) => {
    const rewards = [...quest.rewards];
    rewards[idx] = r;
    set('rewards', rewards);
  };

  const deleteReward = (idx: number) => {
    set('rewards', quest.rewards.filter((_, i) => i !== idx));
  };

  return (
    <div className="qs-editor">
      {/* 기본 정보 */}
      <div className="qs-section">
        <div className="qs-section-title">기본 정보</div>
        <div className="qs-form-row">
          <label className="qs-form-field" style={{ flex: 2 }}>
            <span>ID</span>
            <input
              type="text"
              value={quest.id}
              onChange={(e) => set('id', e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
          </label>
          <label className="qs-form-field" style={{ flex: 3 }}>
            <span>제목</span>
            <input type="text" value={quest.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className="qs-form-field" style={{ flex: 2 }}>
            <span>카테고리</span>
            <select value={quest.category} onChange={(e) => set('category', e.target.value)} style={selectStyleFull}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="qs-form-row">
          <label className="qs-form-field" style={{ flex: 1 }}>
            <span>난이도</span>
            <input type="text" value={quest.difficulty || ''} onChange={(e) => set('difficulty', e.target.value)} placeholder="E / D / C / B / A / S" />
          </label>
          <label className="qs-form-field" style={{ flex: 2 }}>
            <span>의뢰인</span>
            <input type="text" value={quest.requester || ''} onChange={(e) => set('requester', e.target.value)} />
          </label>
          <label className="qs-form-field" style={{ flex: 2 }}>
            <span>장소</span>
            <input type="text" value={quest.location || ''} onChange={(e) => set('location', e.target.value)} />
          </label>
        </div>
        <label className="qs-form-field">
          <span>설명</span>
          <textarea
            value={quest.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
          />
        </label>
        <label className="qs-form-field">
          <span>메모 (에디터 전용)</span>
          <textarea
            value={quest.note || ''}
            onChange={(e) => set('note', e.target.value)}
            rows={2}
          />
        </label>
      </div>

      {/* 목표 */}
      <div className="qs-section">
        <div className="qs-section-header">
          <div className="qs-section-title">목표 (Objectives)</div>
          <button
            className="qs-btn-add"
            onClick={() => set('objectives', [...quest.objectives, newObjective(nextObjId)])}
          >
            + 목표 추가
          </button>
        </div>
        {quest.objectives.length === 0 && (
          <div className="qs-empty">목표가 없습니다.</div>
        )}
        {quest.objectives.map((obj, idx) => (
          <ObjectiveRow
            key={obj.id}
            obj={obj}
            onChange={(o) => updateObj(idx, o)}
            onDelete={() => deleteObj(idx)}
            onMoveUp={() => moveObj(idx, -1)}
            onMoveDown={() => moveObj(idx, 1)}
          />
        ))}
      </div>

      {/* 보상 */}
      <div className="qs-section">
        <div className="qs-section-header">
          <div className="qs-section-title">보상 (Rewards)</div>
          <button className="qs-btn-add" onClick={addReward}>+ 보상 추가</button>
        </div>
        {quest.rewards.length === 0 && (
          <div className="qs-empty">보상이 없습니다.</div>
        )}
        {quest.rewards.map((r, idx) => (
          <RewardRow
            key={idx}
            reward={r}
            onChange={(nr) => updateReward(idx, nr)}
            onDelete={() => deleteReward(idx)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트: 카테고리 관리 ────────────────────────────────────────────

interface CategoryManagerProps {
  categories: QuestCategory[];
  onChange: (cats: QuestCategory[]) => void;
}

function CategoryManager({ categories, onChange }: CategoryManagerProps) {
  const [newCatId, setNewCatId] = useState('');
  const [newCatName, setNewCatName] = useState('');

  const addCategory = () => {
    if (!newCatId.trim() || !newCatName.trim()) return;
    onChange([...categories, { id: newCatId.trim(), name: newCatName.trim() }]);
    setNewCatId('');
    setNewCatName('');
  };

  const deleteCat = (id: string) => onChange(categories.filter((c) => c.id !== id));

  const updateName = (id: string, name: string) =>
    onChange(categories.map((c) => c.id === id ? { ...c, name } : c));

  return (
    <div className="qs-cat-manager">
      <div className="qs-cat-header">카테고리 관리</div>
      {categories.map((c) => (
        <div key={c.id} className="qs-cat-row">
          <code className="qs-cat-id">{c.id}</code>
          <input
            type="text"
            value={c.name}
            onChange={(e) => updateName(c.id, e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={() => deleteCat(c.id)} className="qs-btn-danger" title="삭제">×</button>
        </div>
      ))}
      <div className="qs-cat-add-row">
        <input
          type="text"
          value={newCatId}
          onChange={(e) => setNewCatId(e.target.value)}
          placeholder="ID (영문)"
          style={{ width: 80 }}
        />
        <input
          type="text"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="표시 이름"
          style={{ flex: 1 }}
        />
        <button onClick={addCategory} className="qs-btn-add">추가</button>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface QuestsTabProps {
  data: QuestDatabase | undefined;
  onChange: (data: QuestDatabase) => void;
}

export default function QuestsTab({ data, onChange }: QuestsTabProps) {
  const { t } = useTranslation();
  const db: QuestDatabase = data || emptyDb();

  const [selectedCat, setSelectedCat] = useState<string>('__all__');
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [showCatManager, setShowCatManager] = useState(false);

  const setDb = useCallback((newDb: QuestDatabase) => onChange(newDb), [onChange]);

  // 퀘스트 필터링
  const filteredQuests = selectedCat === '__all__'
    ? db.quests
    : db.quests.filter((q) => q.category === selectedCat);

  const selectedQuest = db.quests.find((q) => q.id === selectedQuestId) || null;

  const handleAddQuest = () => {
    const id = generateQuestId(db.quests);
    const catId = selectedCat === '__all__'
      ? (db.categories[0]?.id || 'main')
      : selectedCat;
    const q = newQuest(id, catId);
    setDb({ ...db, quests: [...db.quests, q] });
    setSelectedQuestId(id);
  };

  const handleDeleteQuest = () => {
    if (!selectedQuestId) return;
    const quests = db.quests.filter((q) => q.id !== selectedQuestId);
    setDb({ ...db, quests });
    setSelectedQuestId(quests.length > 0 ? quests[quests.length - 1].id : null);
  };

  const handleDuplicateQuest = () => {
    if (!selectedQuest) return;
    const id = generateQuestId(db.quests);
    const copy: Quest = { ...selectedQuest, id, title: `${selectedQuest.title} (복사)` };
    setDb({ ...db, quests: [...db.quests, copy] });
    setSelectedQuestId(id);
  };

  const handleQuestChange = (q: Quest) => {
    setDb({ ...db, quests: db.quests.map((old) => old.id === q.id ? q : old) });
    // ID가 바뀐 경우 선택 상태도 업데이트
    if (q.id !== selectedQuestId) setSelectedQuestId(q.id);
  };

  const handleCategoriesChange = (cats: QuestCategory[]) => {
    setDb({ ...db, categories: cats });
  };

  return (
    <div className="qs-layout">
      {/* 왼쪽: 카테고리 탭 + 퀘스트 목록 */}
      <div className="qs-left">
        {/* 카테고리 탭 */}
        <div className="qs-cat-tabs">
          <div
            className={`qs-cat-tab${selectedCat === '__all__' ? ' active' : ''}`}
            onClick={() => setSelectedCat('__all__')}
          >
            전체
          </div>
          {db.categories.map((c) => (
            <div
              key={c.id}
              className={`qs-cat-tab${selectedCat === c.id ? ' active' : ''}`}
              onClick={() => setSelectedCat(c.id)}
            >
              {c.name}
            </div>
          ))}
          <div
            className="qs-cat-tab qs-cat-tab-manage"
            onClick={() => setShowCatManager((v) => !v)}
            title="카테고리 관리"
          >
            ⚙
          </div>
        </div>

        {/* 카테고리 관리 패널 */}
        {showCatManager && (
          <CategoryManager
            categories={db.categories}
            onChange={handleCategoriesChange}
          />
        )}

        {/* 퀘스트 목록 헤더 */}
        <div className="qs-list-header">
          <button onClick={handleAddQuest} title={t('common.add')}>+</button>
          <button onClick={handleDuplicateQuest} title={t('common.duplicate')} disabled={!selectedQuestId}>⎘</button>
          <button onClick={handleDeleteQuest} title={t('common.delete')} disabled={!selectedQuestId} className="qs-btn-danger">−</button>
        </div>

        {/* 퀘스트 목록 */}
        <div className="qs-quest-list">
          {filteredQuests.length === 0 && (
            <div className="qs-empty qs-empty-list">퀘스트 없음</div>
          )}
          {filteredQuests.map((q) => (
            <div
              key={q.id}
              className={`qs-quest-item${q.id === selectedQuestId ? ' active' : ''}`}
              onClick={() => setSelectedQuestId(q.id)}
            >
              <code className="qs-quest-id">{q.id}</code>
              <span className="qs-quest-title">{q.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 오른쪽: 퀘스트 편집 */}
      <div className="qs-right">
        {selectedQuest ? (
          <QuestEditor
            quest={selectedQuest}
            categories={db.categories}
            onChange={handleQuestChange}
          />
        ) : (
          <div className="qs-empty qs-no-select">
            왼쪽에서 퀘스트를 선택하거나 + 버튼으로 추가하세요.
          </div>
        )}
      </div>
    </div>
  );
}
