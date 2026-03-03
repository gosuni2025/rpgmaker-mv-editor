import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Quest, QuestDatabase, QuestCategory } from '../../types/rpgMakerMV';
import { emptyDb, newQuest, generateQuestId } from './questsTabHelpers';
import { QuestEditor } from './QuestEditor';
import { CategoryManager } from './QuestCategoryManager';
import './QuestsTab.css';

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

  // Cmd+C / Cmd+V 단축키
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      if (e.key === 'c') {
        if (!selectedQuest) return;
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(JSON.stringify(selectedQuest, null, 2));
        } catch { /* 무시 */ }
      } else if (e.key === 'v') {
        e.preventDefault();
        try {
          const text = await navigator.clipboard.readText();
          const parsed = JSON.parse(text) as Partial<Quest>;
          if (!parsed?.title) return;
          const catId = selectedCat === '__all__' ? (db.categories[0]?.id || 'main') : selectedCat;
          const id = generateQuestId(db.quests);
          const newQ: Quest = {
            id,
            title: parsed.title,
            category: catId,
            description: parsed.description || '',
            difficulty: parsed.difficulty || '',
            requester: parsed.requester || '',
            location: parsed.location || '',
            objectives: parsed.objectives || [],
            rewards: parsed.rewards || [],
            note: parsed.note || '',
          };
          setDb({ ...db, quests: [...db.quests, newQ] });
          setSelectedQuestId(id);
        } catch { /* 무시 */ }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedQuest, selectedCat, db, setDb]);

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
