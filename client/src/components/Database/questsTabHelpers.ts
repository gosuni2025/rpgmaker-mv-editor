import type { Quest, QuestDatabase, QuestObjective, QuestReward } from '../../types/rpgMakerMV';

export function emptyDb(): QuestDatabase {
  return {
    categories: [
      { id: 'main', name: '메인 퀘스트', icon: 79 },
      { id: 'side', name: '사이드 퀘스트', icon: 80 },
    ],
    quests: [],
  };
}

export function newQuest(id: string, categoryId: string): Quest {
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

export function newObjective(id: number): QuestObjective {
  return { id, text: '새 목표', type: 'manual', config: {}, optional: false, hidden: false };
}

export function newReward(): QuestReward {
  return { type: 'gold', amount: 500 };
}

export function generateQuestId(quests: Quest[]): string {
  const nums = quests
    .map((q) => parseInt(q.id.replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `q${String(max + 1).padStart(3, '0')}`;
}
