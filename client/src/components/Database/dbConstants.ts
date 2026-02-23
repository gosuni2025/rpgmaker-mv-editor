import type { TFunction } from 'i18next';

export interface RefItem {
  id: number;
  name: string;
}

export const makeScopeOptions = (t: TFunction) => [
  { value: 0, label: t('scope.none') },
  { value: 1, label: t('scope.oneEnemy') },
  { value: 2, label: t('scope.allEnemies') },
  { value: 3, label: t('scope.randomEnemy1') },
  { value: 4, label: t('scope.randomEnemy2') },
  { value: 5, label: t('scope.randomEnemy3') },
  { value: 6, label: t('scope.randomEnemy4') },
  { value: 7, label: t('scope.oneAlly') },
  { value: 8, label: t('scope.allAllies') },
  { value: 9, label: t('scope.oneAllyDead') },
  { value: 10, label: t('scope.allAlliesDead') },
  { value: 11, label: t('scope.theUser') },
];

export const makeOccasionOptions = (t: TFunction) => [
  { value: 0, label: t('occasion.always') },
  { value: 1, label: t('occasion.onlyInBattle') },
  { value: 2, label: t('occasion.onlyFromMenu') },
  { value: 3, label: t('occasion.never') },
];

export const makeHitTypeOptions = (t: TFunction) => [
  { value: 0, label: t('hitType.certainHit') },
  { value: 1, label: t('hitType.physicalAttack') },
  { value: 2, label: t('hitType.magicalAttack') },
];

export const makeParamNames = (t: TFunction) => [
  t('params.maxHP'), t('params.maxMP'), t('params.attack'), t('params.defense'),
  t('params.mAttack'), t('params.mDefense'), t('params.agility'), t('params.luck'),
];
