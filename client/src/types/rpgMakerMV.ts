// RPG Maker MV 데이터 타입 정의

export interface MapInfo {
  id: number;
  name: string;
  parentId: number;
  order: number;
  expanded?: boolean;
  scrollX?: number;
  scrollY?: number;
  displayName?: string;
}

export interface NpcDisplayData {
  name: string;       // 게임 내 표시할 NPC 이름
  showName: boolean;  // 이름 표시 여부
}

export type MinimapMarkerShape = 'circle' | 'square' | 'diamond' | 'star' | 'triangle' | 'cross' | 'heart';

export interface MinimapMarkerData {
  enabled: boolean;
  color: string;           // CSS 색상값 (#rrggbb)
  shape: MinimapMarkerShape;
  iconIndex?: number;      // 설정되면 IconSet 아이콘으로 표시 (shape 무시)
}

export interface MapData {
  displayName: string;
  name?: string;
  width: number;
  height: number;
  data: number[];
  events: (RPGEvent | null)[];
  tilesetId: number;
  tilesetNames?: string[];
  autoplayBgm: boolean;
  autoplayBgs: boolean;
  bgm?: AudioFile;
  bgs?: AudioFile;
  encounterList: unknown[];
  encounterStep: number;
  note: string;
  parallaxLoopX: boolean;
  parallaxLoopY: boolean;
  parallaxName: string;
  parallaxShow: boolean;
  parallaxSx: number;
  parallaxSy: number;
  scrollType: number;
  disableDashing: boolean;
  specifyBattleback: boolean;
  battleback1Name: string;
  battleback2Name: string;
  tileLayerElevation?: boolean;
  editorLights?: EditorLights;
  objects?: MapObject[];
  cameraZones?: CameraZone[];
  skyBackground?: SkyBackground;
  animTileSettings?: Record<number, AnimTileShaderSettings>; // key = kind (0~15)
  bloomConfig?: BloomConfig;
  dofConfig?: DofConfig;
  postProcessConfig?: PostProcessConfig;
  weatherType?: number;   // 0=없음, 1=비, 2=폭풍, 3=눈
  weatherPower?: number;  // 1~9
  testStartPosition?: { x: number; y: number };  // EXT: 현재 맵 테스트용 임시 시작 위치
  customPassage?: number[];  // EXT: 맵 단위 커스텀 통행불가 (y * width + x, 비트: 0x01=DOWN, 0x02=LEFT, 0x04=RIGHT, 0x08=UP)
  customUpperLayer?: number[]; // EXT: 맵 단위 타일 상단 레이어 강제 (y * width + x, 1=캐릭터 위 렌더링)
  npcData?: Record<number, NpcDisplayData>;       // EXT: 이벤트별 NPC 표시 이름 (key = eventId)
  minimapData?: Record<number, MinimapMarkerData>; // EXT: 이벤트별 미니맵 마커 (key = eventId)
}

export interface BloomConfig {
  enabled: boolean;
  threshold: number;    // 밝기 추출 임계값 (0~1)
  strength: number;     // bloom 합성 강도 (0~2)
  radius: number;       // 블러 반경 배율 (0~3)
  downscale: number;    // 블러 텍스처 축소 비율 (1~8)
}

export const DEFAULT_BLOOM_CONFIG: BloomConfig = {
  enabled: true,
  threshold: 0.5,
  strength: 0.8,
  radius: 1.0,
  downscale: 4,
};

export interface DofConfig {
  enabled: boolean;
  focusY: number;      // 포커스 중심 Y (0~1, 기본 0.55)
  focusRange: number;  // 선명 영역 반폭 (0~0.5, 기본 0.1)
  maxBlur: number;     // 최대 블러 (0~0.2, 기본 0.05)
  blurPower: number;   // 블러 강도 곡선 (0.5~5, 기본 1.5)
}

export const DEFAULT_DOF_CONFIG: DofConfig = {
  enabled: false,
  focusY: 0.14,
  focusRange: 0,
  maxBlur: 0.13,
  blurPower: 2.4,
};

export interface AnimTileShaderSettings {
  enabled: boolean;
  waveAmplitude: number;      // 물결 진폭 (0~0.05)
  waveFrequency: number;      // 물결 주파수 (0~20)
  waveSpeed: number;          // 물결 속도 (0~10)
  waterAlpha: number;         // 투명도 (0~1)
  specularStrength: number;   // 반사 강도 (0~3)
  emissive: number;           // 자체 발광 강도 (0~2)
  emissiveColor: string;      // 발광 색상 (#hex)
}

export const DEFAULT_WATER_SETTINGS: AnimTileShaderSettings = {
  enabled: true,
  waveAmplitude: 0.006,
  waveFrequency: 4,
  waveSpeed: 2,
  waterAlpha: 0.85,
  specularStrength: 0.8,
  emissive: 0,
  emissiveColor: '#ffffff',
};

export const DEFAULT_LAVA_SETTINGS: AnimTileShaderSettings = {
  enabled: true,
  waveAmplitude: 0.003,
  waveFrequency: 2,
  waveSpeed: 0.8,
  waterAlpha: 1.0,
  specularStrength: 0.3,
  emissive: 0.5,
  emissiveColor: '#ff4400',
};

export const DEFAULT_WATERFALL_SETTINGS: AnimTileShaderSettings = {
  enabled: true,
  waveAmplitude: 0.004,
  waveFrequency: 6,
  waveSpeed: 3,
  waterAlpha: 0.95,
  specularStrength: 0.4,
  emissive: 0,
  emissiveColor: '#ffffff',
};

export interface SkySunLight {
  position: [number, number];       // [u, v] (0~1) - equirectangular 이미지에서의 위치
  color: string;                    // 색상 (#hex)
  intensity: number;                // 강도 (0~3)
  castShadow?: boolean;             // 그림자 (기본 true)
  shadowMapSize?: number;           // 그림자맵 해상도 (기본 2048)
  shadowBias?: number;              // 그림자 바이어스 (기본 -0.001)
}

export const DEFAULT_SKY_SUN_LIGHT: SkySunLight = {
  position: [0.25, 0.35],
  color: '#fff8ee',
  intensity: 0.8,
  castShadow: true,
  shadowMapSize: 2048,
  shadowBias: -0.001,
};

export interface SkyBackground {
  type: 'parallax' | 'skysphere';
  skyImage?: string;
  rotationSpeed?: number;
  sunPosition?: [number, number];   // deprecated: sunLights로 대체
  sunLights?: SkySunLight[];        // 태양 조명 배열
}

/** equirectangular UV 좌표를 방향 조명 벡터로 변환
 *  SkyBox.js: SphereGeometry + DoubleSide + flipY=false + rotation.x=PI/2 기준
 *  반환값: 태양이 있는 방향 (단위 벡터) */
export function sunUVToDirection(u: number, v: number): [number, number, number] {
  const phi = u * 2 * Math.PI;
  const theta = v * Math.PI;
  // SphereGeometry 로컬 좌표 (DoubleSide 내부 좌우반전 보상: -cos → +cos)
  const lx =  Math.cos(phi) * Math.sin(theta);
  const ly =  Math.cos(theta);
  const lz =  Math.sin(phi) * Math.sin(theta);
  // SkyBox.js rotation.x = PI/2 적용: (lx, ly, lz) → (lx, -lz, ly)
  return [lx, -lz, ly];
}

export interface RPGEvent {
  id: number;
  name: string;
  x: number;
  y: number;
  note: string;
  pages: EventPage[];
  __ref?: string;  // 외부 파일 참조 마커 (에디터 전용, truthy이면 외부 파일로 저장)
}

export interface EventPage {
  conditions: EventConditions;
  directionFix: boolean;
  image: EventImage;
  list: EventCommand[];
  moveFrequency: number;
  moveRoute: MoveRoute;
  moveSpeed: number;
  moveType: number;
  priorityType: number;
  stepAnime: boolean;
  through: boolean;
  trigger: number;
  walkAnime: boolean;
  /** 3D 모드에서 빌보드(입체 표시) 적용 여부. undefined/true이면 빌보드 활성 (기본값: true) */
  billboard?: boolean;
  /** 3D 모드 빌보드 Z 높이 오프셋 (타일 단위). 양수=위로 올라감. 기본값: 0 */
  billboardZ?: number;
}

export interface EventConditions {
  actorId: number;
  actorValid: boolean;
  itemId: number;
  itemValid: boolean;
  selfSwitchCh: string;
  selfSwitchValid: boolean;
  switch1Id: number;
  switch1Valid: boolean;
  switch2Id: number;
  switch2Valid: boolean;
  variableId: number;
  variableValid: boolean;
  variableValue: number;
}

export interface EventImage {
  characterIndex: number;
  characterName: string;
  direction: number;
  pattern: number;
  tileId: number;
}

export interface EventCommand {
  code: number;
  indent: number;
  parameters: unknown[];
}

export interface MoveRoute {
  list: MoveCommand[];
  repeat: boolean;
  skippable: boolean;
  wait: boolean;
}

export interface MoveCommand {
  code: number;
  parameters?: unknown[];
}

export interface AudioFile {
  name: string;
  pan: number;
  pitch: number;
  volume: number;
}

export interface Actor {
  id: number;
  name: string;
  nickname: string;
  classId: number;
  initialLevel: number;
  maxLevel: number;
  profile: string;
  characterName: string;
  characterIndex: number;
  faceName: string;
  faceIndex: number;
  battlerName: string;
  equips: number[];
  traits: Trait[];
  note: string;
}

export interface Trait {
  code: number;
  dataId: number;
  value: number;
}

export interface Skill {
  id: number;
  name: string;
  iconIndex: number;
  description: string;
  stypeId: number;
  scope: number;
  occasion: number;
  mpCost: number;
  tpCost: number;
  speed: number;
  successRate: number;
  repeats: number;
  tpGain: number;
  hitType: number;
  animationId: number;
  damage: Damage;
  effects: Effect[];
  message1: string;
  message2: string;
  note: string;
  requiredWtypeId1: number;
  requiredWtypeId2: number;
}

export interface Damage {
  critical: boolean;
  elementId: number;
  formula: string;
  type: number;
  variance: number;
}

export interface Effect {
  code: number;
  dataId: number;
  value1: number;
  value2: number;
}

export interface Item {
  id: number;
  name: string;
  iconIndex: number;
  description: string;
  itypeId: number;
  price: number;
  consumable: boolean;
  scope: number;
  occasion: number;
  speed: number;
  successRate: number;
  repeats: number;
  tpGain: number;
  hitType: number;
  animationId: number;
  damage: Damage;
  effects: Effect[];
  note: string;
}

export interface AttackMotion {
  type: number;
  weaponImageId: number;
}

export interface TestBattler {
  actorId: number;
  level: number;
  equips: number[];  // [무기ID, 방패ID, 머리ID, 몸ID, 액세서리ID]
}

export interface SystemData {
  gameTitle: string;
  currencyUnit: string;
  locale: string;
  startMapId: number;
  startX: number;
  startY: number;
  windowTone: [number, number, number, number];
  partyMembers: number[];
  elements: string[];
  equipTypes: string[];
  skillTypes: string[];
  weaponTypes: string[];
  armorTypes: string[];
  switches: string[];
  variables: string[];
  attackMotions: AttackMotion[];
  battleBgm: AudioFile;
  defeatMe: AudioFile;
  gameoverMe: AudioFile;
  titleBgm: AudioFile;
  victoryMe: AudioFile;
  title1Name: string;
  title2Name: string;
  battlerName: string;
  boat: Vehicle;
  ship: Vehicle;
  airship: Vehicle;
  editMapId: number;
  magicSkills: number[];
  menuCommands: boolean[];
  optDisplayTp: boolean;
  optDrawTitle: boolean;
  optExtraExp: boolean;
  optFloorDeath: boolean;
  optFollowers: boolean;
  optSideView: boolean;
  optSlipDeath: boolean;
  optTransparent: boolean;
  sounds: AudioFile[];
  terms: unknown;
  testBattlers: TestBattler[];
  testTroopId: number;
  versionId: number;
  battleback1Name: string;
  battleback2Name: string;
}

export interface Vehicle {
  bgm: AudioFile;
  characterIndex: number;
  characterName: string;
  startMapId: number;
  startX: number;
  startY: number;
}

export interface TilesetData {
  id: number;
  name: string;
  mode: number;
  tilesetNames: string[];
  flags: number[];
  note: string;
}

export interface Learning {
  level: number;
  skillId: number;
  note: string;
}

export interface RPGClass {
  id: number;
  name: string;
  expParams: number[];
  params: number[][];
  learnings: Learning[];
  traits: Trait[];
  note: string;
}

export interface Weapon {
  id: number;
  name: string;
  iconIndex: number;
  description: string;
  wtypeId: number;
  etypeId: number;
  params: number[];
  price: number;
  animationId: number;
  traits: Trait[];
  note: string;
}

export interface Armor {
  id: number;
  name: string;
  iconIndex: number;
  description: string;
  atypeId: number;
  etypeId: number;
  params: number[];
  price: number;
  traits: Trait[];
  note: string;
}

export interface DropItem {
  kind: number;
  dataId: number;
  denominator: number;
}

export interface EnemyAction {
  conditionParam1: number;
  conditionParam2: number;
  conditionType: number;
  rating: number;
  skillId: number;
}

export interface Enemy {
  id: number;
  name: string;
  battlerName: string;
  battlerHue: number;
  params: number[];
  exp: number;
  gold: number;
  dropItems: DropItem[];
  actions: EnemyAction[];
  traits: Trait[];
  note: string;
}

export interface TroopMember {
  enemyId: number;
  x: number;
  y: number;
  hidden: boolean;
}

export interface TroopPage {
  conditions: TroopConditions;
  span: number;
  list: EventCommand[];
}

export interface TroopConditions {
  actorHp: number;
  actorId: number;
  actorValid: boolean;
  enemyHp: number;
  enemyIndex: number;
  enemyValid: boolean;
  switchId: number;
  switchValid: boolean;
  turnA: number;
  turnB: number;
  turnEnding: boolean;
  turnValid: boolean;
}

export interface Troop {
  id: number;
  name: string;
  members: TroopMember[];
  pages: TroopPage[];
}

export interface State {
  id: number;
  name: string;
  iconIndex: number;
  restriction: number;
  priority: number;
  removeAtBattleEnd: boolean;
  removeByRestriction: boolean;
  autoRemovalTiming: number;
  minTurns: number;
  maxTurns: number;
  removeByDamage: boolean;
  chanceByDamage: number;
  removeByWalking: boolean;
  stepsToRemove: number;
  message1: string;
  message2: string;
  message3: string;
  message4: string;
  motion: number;
  overlay: number;
  traits: Trait[];
  note: string;
}

export interface AnimationTiming {
  flashColor: number[];
  flashDuration: number;
  flashScope: number;
  frame: number;
  se: AudioFile;
}

export interface Animation {
  id: number;
  name: string;
  animation1Name: string;
  animation1Hue: number;
  animation2Name: string;
  animation2Hue: number;
  position: number;
  frames: number[][][];
  timings: AnimationTiming[];
}

/** 포스트 프로세싱 이펙트 설정 (키는 이펙트명, 값은 이펙트별 파라미터) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PostProcessEffectParams = { enabled: boolean; [key: string]: any };
export type PostProcessConfig = Record<string, PostProcessEffectParams>;

export interface CommonEvent {
  id: number;
  name: string;
  trigger: number;
  switchId: number;
  list: EventCommand[];
}

// Camera zone data (stored as custom field in map JSON, ignored by RPG Maker MV)
export interface CameraZone {
  id: number;
  name: string;
  x: number;       // 좌상단 타일 X
  y: number;       // 좌상단 타일 Y
  width: number;   // 타일 단위 폭
  height: number;  // 타일 단위 높이
  zoom: number;    // 카메라 줌 (0.5~3.0, 기본 1.0)
  tilt: number;    // 3D 틸트 각도 (20~85, 기본 60)
  yaw: number;     // 3D yaw 각도 (기본 0)
  fov: number;     // 카메라 시야각 (30~120, 기본 60)
  transitionSpeed: number; // 전환 속도 (0.1~5.0, 기본 1.0)
  priority: number;  // 우선순위 (겹칠 때, 기본 0)
  enabled: boolean;
  ambientIntensity?: number;  // 환경광 강도 (0~3, 기본: 글로벌 값 사용)
  ambientColor?: string;      // 환경광 색상 (#hex, 기본: 글로벌 값 사용)
  dofEnabled?: boolean;     // 이 존에서 DoF 활성화 여부 (undefined=글로벌 따름)
  dofFocusY?: number;       // 0~1 (기본 0.55)
  dofFocusRange?: number;   // 0~0.5 (기본 0.1)
  dofMaxBlur?: number;      // 0~0.2 (기본 0.05)
  dofBlurPower?: number;    // 0.5~5 (기본 1.5)
}

// Editor-only object data (stored as custom field in map JSON, ignored by RPG Maker MV)
export interface MapObject {
  id: number;
  name: string;
  x: number;            // 기준점 타일 X (하단 좌측)
  y: number;            // 기준점 타일 Y (하단 행)
  tileIds: number[][][];  // [row][col][layer] 타일 ID (row 0 = 상단, layer 0~3)
  width: number;        // 타일 열 수
  height: number;       // 타일 행 수
  zHeight: number;      // Z 높이 오프셋 (3D 빌보드용)
  passability: boolean[][]; // [row][col] true=통행가능, false=불가
  visible?: boolean;    // 화면 표시 여부 (기본 true, false 시 렌더링 및 충돌 모두 비활성)
  // 이미지 기반 오브젝트 (선택적)
  imageName?: string;   // 이미지 파일명 (확장자 제외, img/pictures/ 내)
  anchorY?: number;     // 3D 빌보드 세로 앵커 (0=상단, 0.5=중앙, 1=하단, 기본 1.0)
  imageScale?: number;  // 이미지 스케일 (기본 1.0)
  shaderData?: { type: string; enabled: boolean; params: Record<string, number> }[];
  // 애니메이션 기반 오브젝트 (선택적)
  animationId?: number;                           // 재생할 애니메이션 ID
  animationLoop?: 'forward' | 'pingpong' | 'once'; // 재생 모드 (기본: 'forward')
  animationSe?: boolean;                          // SE 재생 여부 (기본: false)
  animationPlayInEditor?: boolean;                 // 에디터에서 재생 여부 (기본: true)
  animationPauseOnMessage?: boolean;               // 이벤트 메시지 표시 중 일시정지 (기본: true)
}

// Editor-only lighting data (stored as custom field in map JSON, ignored by RPG Maker MV)
export interface EditorPointLight {
  id: number;
  x: number;
  y: number;
  z: number;
  color: string;
  intensity: number;
  distance: number;
  decay: number;
}

export interface EditorAmbientLight {
  enabled?: boolean;
  color: string;
  intensity: number;
}

export interface EditorDirectionalLight {
  enabled?: boolean;
  color: string;
  intensity: number;
  direction: [number, number, number];
  castShadow?: boolean;
  shadowMapSize?: number;
  shadowBias?: number;
  shadowNear?: number;
  shadowFar?: number;
}

export interface EditorPlayerLight {
  enabled?: boolean;
  color: string;
  intensity: number;
  distance: number;
  z: number;
}

export interface EditorSpotLight {
  enabled: boolean;
  color: string;
  intensity: number;
  distance: number;
  angle: number;
  penumbra: number;
  z: number;
  shadowMapSize: number;
  targetDistance: number;
}

export interface EditorShadowSettings {
  enabled?: boolean;
  opacity: number;
  color: string;
  offsetScale: number;
}

export interface EditorLights {
  enabled?: boolean;
  ambient: EditorAmbientLight;
  directional: EditorDirectionalLight;
  points: EditorPointLight[];
  playerLight?: EditorPlayerLight;
  spotLight?: EditorSpotLight;
  shadow?: EditorShadowSettings;
}

export const DEFAULT_EDITOR_LIGHTS: EditorLights = {
  enabled: true,
  ambient: { enabled: true, color: '#667788', intensity: 0.4 },
  directional: { enabled: false, color: '#fff8ee', intensity: 0.1, direction: [-1, -1, -2], castShadow: true, shadowMapSize: 2048, shadowBias: -0.001, shadowNear: 1, shadowFar: 5000 },
  points: [],
  playerLight: { enabled: true, color: '#a25f06', intensity: 0.8, distance: 200, z: 40 },
  spotLight: { enabled: true, color: '#ffeedd', intensity: 0.8, distance: 250, angle: 0.60, penumbra: 0.9, z: 120, shadowMapSize: 2048, targetDistance: 70 },
  shadow: { enabled: false, opacity: 0.4, color: '#000000', offsetScale: 0.6 },
};

// ============================================================
// Quest System
// ============================================================

export type QuestObjectiveType =
  | 'kill'      // 적 N마리 처치
  | 'collect'   // 아이템 N개 보유
  | 'gold'      // 골드 N 이상 보유
  | 'variable'  // 변수 X가 조건 충족
  | 'switch'    // 스위치 X가 ON/OFF
  | 'reach'     // 맵 X의 위치에 도달
  | 'talk'      // 맵 X의 이벤트와 대화
  | 'manual';   // 플러그인 커맨드로 수동 완료

export type QuestVariableOperator = '>=' | '==' | '<=' | '>' | '<' | '!=';

export interface QuestObjectiveConfig {
  // kill
  enemyId?: number;
  // collect
  itemType?: 'item' | 'weapon' | 'armor';
  itemId?: number;
  // kill | collect
  count?: number;
  // gold
  amount?: number;
  // variable
  variableId?: number;
  value?: number;
  operator?: QuestVariableOperator;
  // switch
  switchId?: number;
  switchValue?: boolean;
  // reach | talk
  mapId?: number;
  // reach
  x?: number;
  y?: number;
  radius?: number;
  // talk
  eventId?: number;
}

export interface QuestObjective {
  id: number;
  text: string;
  type: QuestObjectiveType;
  config: QuestObjectiveConfig;
  optional?: boolean;
  hidden?: boolean;
}

export type QuestRewardType = 'gold' | 'exp' | 'item' | 'weapon' | 'armor';

export interface QuestReward {
  type: QuestRewardType;
  amount?: number;
  itemId?: number;
  count?: number;
}

export interface QuestCategory {
  id: string;
  name: string;
  icon?: number;
}

export interface Quest {
  id: string;
  title: string;
  category: string;
  icon?: number;
  description: string;
  difficulty?: string;
  requester?: string;
  location?: string;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  note?: string;
}

export interface QuestDatabase {
  categories: QuestCategory[];
  quests: Quest[];
}
