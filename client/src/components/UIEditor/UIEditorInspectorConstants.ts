import type { EntranceEffectType, EntranceEasing, AnimPivotAnchor, UIWindowEntranceEffect } from '../../store/types';

export const EFFECT_LABELS: Record<EntranceEffectType, string> = {
  fadeIn:      '페이드 인',
  fadeOut:     '페이드 아웃',
  slideLeft:   '왼쪽에서 슬라이드',
  slideRight:  '오른쪽에서 슬라이드',
  slideTop:    '위에서 슬라이드',
  slideBottom: '아래에서 슬라이드',
  zoom:        '확대 등장',
  bounce:      '바운스 등장',
  rotate:      '회전 (Z축)',
  rotateX:     '회전 (X축 — 상하)',
  rotateY:     '회전 (Y축 — 좌우)',
};

export const EXIT_EFFECT_LABELS: Record<EntranceEffectType, string> = {
  fadeIn:      '페이드 인',
  fadeOut:     '페이드 아웃',
  slideLeft:   '왼쪽으로 퇴장',
  slideRight:  '오른쪽으로 퇴장',
  slideTop:    '위로 퇴장',
  slideBottom: '아래로 퇴장',
  zoom:        '축소 퇴장',
  bounce:      '바운스 퇴장',
  rotate:      '회전 퇴장 (Z축)',
  rotateX:     '회전 퇴장 (X축)',
  rotateY:     '회전 퇴장 (Y축)',
};

export const EASING_LABELS: Record<EntranceEasing, string> = {
  easeOut:   'EaseOut (감속)',
  easeIn:    'EaseIn (가속)',
  easeInOut: 'EaseInOut',
  linear:    '선형',
  bounce:    '바운스',
};

export const EFFECT_TYPES = Object.keys(EFFECT_LABELS) as EntranceEffectType[];
export const EASING_TYPES = Object.keys(EASING_LABELS) as EntranceEasing[];

export function makeDefaultEffect(type: EntranceEffectType): UIWindowEntranceEffect {
  return { type, duration: 300, easing: 'easeOut', delay: 0 };
}

export const PIVOT_GRID: AnimPivotAnchor[][] = [
  ['top-left', 'top', 'top-right'],
  ['left',     'center', 'right'],
  ['bottom-left', 'bottom', 'bottom-right'],
];

export const PIVOT_DOTS: Record<AnimPivotAnchor, string> = {
  'top-left': '↖', 'top': '↑', 'top-right': '↗',
  'left': '←',    'center': '✦', 'right': '→',
  'bottom-left': '↙', 'bottom': '↓', 'bottom-right': '↘',
};
