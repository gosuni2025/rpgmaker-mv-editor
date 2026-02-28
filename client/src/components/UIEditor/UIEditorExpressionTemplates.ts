/**
 * UI 에디터 표현식 템플릿 — 내장 정의 + 서버에서 로드한 플러그인 정의
 */

export type ExpressionMode = 'text' | 'bitmap' | 'srcRect' | 'js';

export interface ExpressionTemplate {
  label: string;
  code: string;
  desc?: string;
  modes: ExpressionMode[];
}

export interface ExpressionTemplateGroup {
  id?: string;
  group: string;         // 그룹 표시 이름 (서버 API와 동일한 필드명)
  pluginLabel?: string;  // 출처 플러그인 (동적 그룹)
  items: ExpressionTemplate[];
}

// ── 내장 템플릿 ──────────────────────────────────────────
export const BUILTIN_TEMPLATE_GROUPS: ExpressionTemplateGroup[] = [
  {
    id: 'basic',
    group: '기본 게임 변수',
    items: [
      { label: '골드', code: '{gold}', desc: '파티 보유 골드', modes: ['text'] },
      { label: '변수 #1', code: '{var:1}', desc: '게임 변수 #1 (번호 변경 가능)', modes: ['text'] },
      { label: '변수 #2', code: '{var:2}', desc: '게임 변수 #2', modes: ['text'] },
      { label: '파티원 수', code: '{$gameParty.size()}', desc: '현재 파티 인원 수', modes: ['text'] },
    ],
  },
  {
    id: 'actor-text',
    group: '액터 정보 (텍스트)',
    items: [
      { label: '이름 [0]',   code: '{actor[0].name}',  desc: '파티 0번 액터 이름',        modes: ['text'] },
      { label: '이름 [1]',   code: '{actor[1].name}',  desc: '파티 1번 액터 이름',        modes: ['text'] },
      { label: 'HP [0]',     code: '{actor[0].hp}',    desc: '파티 0번 액터 현재 HP',     modes: ['text'] },
      { label: '최대HP [0]', code: '{actor[0].mhp}',   desc: '파티 0번 액터 최대 HP',     modes: ['text'] },
      { label: 'MP [0]',     code: '{actor[0].mp}',    desc: '파티 0번 액터 현재 MP',     modes: ['text'] },
      { label: '최대MP [0]', code: '{actor[0].mmp}',   desc: '파티 0번 액터 최대 MP',     modes: ['text'] },
      { label: 'TP [0]',     code: '{actor[0].tp}',    desc: '파티 0번 액터 현재 TP',     modes: ['text'] },
      { label: '레벨 [0]',   code: '{actor[0].level}', desc: '파티 0번 액터 레벨',        modes: ['text'] },
      { label: '직업 [0]',   code: '{actor[0].currentClass().name}', desc: '파티 0번 액터 직업 이름', modes: ['text'] },
    ],
  },
  {
    id: 'actor-js',
    group: '액터 정보 (JS 식)',
    items: [
      { label: 'HP [0]',      code: '$gameParty.members()[0].hp',     desc: '파티 0번 액터 현재 HP', modes: ['js'] },
      { label: '최대HP [0]',  code: '$gameParty.members()[0].mhp',    desc: '파티 0번 액터 최대 HP', modes: ['js'] },
      { label: 'MP [0]',      code: '$gameParty.members()[0].mp',     desc: '파티 0번 액터 현재 MP', modes: ['js'] },
      { label: '최대MP [0]',  code: '$gameParty.members()[0].mmp',    desc: '파티 0번 액터 최대 MP', modes: ['js'] },
      { label: 'TP [0]',      code: '$gameParty.members()[0].tp',     desc: '파티 0번 액터 현재 TP', modes: ['js'] },
      { label: '최대TP [0]',  code: '$gameParty.members()[0].maxTp()', desc: '파티 0번 액터 최대 TP', modes: ['js'] },
      { label: "'HP'",         code: "'HP'",  desc: "문자열 'HP' — 게이지 레이블용", modes: ['js'] },
      { label: "'MP'",         code: "'MP'",  desc: "문자열 'MP' — 게이지 레이블용", modes: ['js'] },
      { label: "'TP'",         code: "'TP'",  desc: "문자열 'TP' — 게이지 레이블용", modes: ['js'] },
      { label: 'ATK [0]',     code: '$gameParty.members()[0].atk',    desc: '파티 0번 액터 공격력', modes: ['js'] },
      { label: 'DEF [0]',     code: '$gameParty.members()[0].def',    desc: '파티 0번 액터 방어력', modes: ['js'] },
    ],
  },
  {
    id: 'cshelper-bitmap',
    group: 'CSHelper — 비트맵',
    items: [
      { label: '액터 얼굴 [0]',      code: 'CSHelper.actorFace(0)',                          desc: '파티 0번 액터 얼굴 Bitmap',             modes: ['bitmap'] },
      { label: '액터 얼굴 [$ctx]',   code: 'CSHelper.actorFace($ctx.actorIndex||0)',          desc: '$ctx.actorIndex 번 액터 얼굴',           modes: ['bitmap'] },
      { label: '액터 캐릭터 [0]',    code: 'CSHelper.actorCharacter(0)',                      desc: '파티 0번 액터 캐릭터 스프라이트 Bitmap', modes: ['bitmap'] },
      { label: '적 배틀러 [$ctx]',   code: 'CSHelper.enemyBattler($ctx.enemy)',               desc: '$ctx.enemy 배틀러 이미지 (EnemyBook 씬)', modes: ['bitmap'] },
      { label: 'IconSet',            code: "ImageManager.loadSystem('IconSet')",               desc: '아이콘셋 Bitmap (srcRectExpr와 함께 사용)', modes: ['bitmap'] },
      { label: '커스텀 이미지',      code: "ImageManager.loadBitmap('img/pictures/','name')", desc: '임의 폴더·파일 지정', modes: ['bitmap'] },
    ],
  },
  {
    id: 'cshelper-srcrect',
    group: 'CSHelper — srcRect',
    items: [
      { label: '얼굴 rect [0]',        code: 'CSHelper.actorFaceSrcRect(0)',
        desc: '파티 0번 액터 얼굴 srcRect({x,y,w,h})', modes: ['srcRect'] },
      { label: '얼굴 rect [$ctx]',     code: 'CSHelper.actorFaceSrcRect($ctx.actorIndex||0)',
        desc: '$ctx.actorIndex 번 액터 얼굴 srcRect', modes: ['srcRect'] },
      { label: '캐릭터 rect [0]',      code: 'CSHelper.actorCharacterSrcRect(0)',
        desc: '파티 0번 액터 캐릭터 srcRect', modes: ['srcRect'] },
      { label: '아이콘 rect [$ctx]',
        code: '{x:($ctx.item&&$ctx.item.iconIndex%16||0)*32,y:($ctx.item&&Math.floor($ctx.item.iconIndex/16)||0)*32,w:32,h:32}',
        desc: '$ctx.item 아이콘 srcRect (아이템 도감, IconSet Bitmap과 함께 사용)', modes: ['srcRect'] },
      { label: '고정 아이콘 (0번)',     code: '{x:0,y:0,w:32,h:32}', desc: 'IconSet 0번 아이콘', modes: ['srcRect'] },
    ],
  },
];

// ── 서버에서 플러그인 템플릿 로드 ─────────────────────────
export async function fetchPluginTemplateGroups(): Promise<ExpressionTemplateGroup[]> {
  try {
    const res = await fetch('/api/ui-editor/expression-templates');
    if (!res.ok) return [];
    const data: { groups: ExpressionTemplateGroup[] } = await res.json();
    return data.groups || [];
  } catch {
    return [];
  }
}
