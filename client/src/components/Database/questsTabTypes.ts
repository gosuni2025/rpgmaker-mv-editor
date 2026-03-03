import type {
  QuestObjectiveType,
  QuestRewardType,
} from '../../types/rpgMakerMV';

// ─── 참조 데이터 타입 ─────────────────────────────────────────────────────────

export interface RefData {
  enemyNames: string[];
  itemNames: string[];
  itemIcons: (number | undefined)[];
  weaponNames: string[];
  weaponIcons: (number | undefined)[];
  armorNames: string[];
  armorIcons: (number | undefined)[];
}

export const EMPTY_REF: RefData = {
  enemyNames: [], itemNames: [], itemIcons: [],
  weaponNames: [], weaponIcons: [], armorNames: [], armorIcons: [],
};

// ─── 상수 ─────────────────────────────────────────────────────────────────────

export const OBJECTIVE_TYPE_LABELS: Record<QuestObjectiveType, string> = {
  kill:     '적 처치',
  collect:  '아이템 보유',
  gold:     '골드 보유',
  variable: '변수 조건',
  switch:   '스위치 조건',
  reach:    '위치 도달',
  talk:     'NPC 대화',
  manual:   '수동 완료',
};

export const REWARD_TYPE_LABELS: Record<QuestRewardType, string> = {
  gold:   '골드',
  exp:    'EXP',
  item:   '아이템',
  weapon: '무기',
  armor:  '방어구',
};
