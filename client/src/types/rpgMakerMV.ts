// RPG Maker MV 데이터 타입 정의

export interface MapInfo {
  id: number;
  name: string;
  parentId: number;
  order: number;
  expanded?: boolean;
  scrollX?: number;
  scrollY?: number;
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
  editorLights?: EditorLights;
  objects?: MapObject[];
  cameraZones?: CameraZone[];
  skyBackground?: SkyBackground;
}

export interface SkyBackground {
  type: 'parallax' | 'skysphere';
  skyImage?: string;
  rotationSpeed?: number;
}

export interface RPGEvent {
  id: number;
  name: string;
  x: number;
  y: number;
  note: string;
  pages: EventPage[];
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
  testBattlers: unknown[];
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
  tileIds: number[][];  // [row][col] 타일 ID (row 0 = 상단)
  width: number;        // 타일 열 수
  height: number;       // 타일 행 수
  zHeight: number;      // Z 높이 오프셋 (3D 빌보드용)
  passability: boolean[][]; // [row][col] true=통행가능, false=불가
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
  color: string;
  intensity: number;
}

export interface EditorDirectionalLight {
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
  opacity: number;
  color: string;
  offsetScale: number;
}

export interface EditorLights {
  ambient: EditorAmbientLight;
  directional: EditorDirectionalLight;
  points: EditorPointLight[];
  playerLight?: EditorPlayerLight;
  spotLight?: EditorSpotLight;
  shadow?: EditorShadowSettings;
}

export const DEFAULT_EDITOR_LIGHTS: EditorLights = {
  ambient: { color: '#667788', intensity: 0.4 },
  directional: { color: '#fff8ee', intensity: 0.1, direction: [-1, -1, -2], castShadow: true, shadowMapSize: 2048, shadowBias: -0.001, shadowNear: 1, shadowFar: 5000 },
  points: [],
  playerLight: { color: '#a25f06', intensity: 0.8, distance: 200, z: 40 },
  spotLight: { enabled: true, color: '#ffeedd', intensity: 0.8, distance: 250, angle: 0.60, penumbra: 0.9, z: 120, shadowMapSize: 2048, targetDistance: 70 },
  shadow: { opacity: 0.4, color: '#000000', offsetScale: 0.6 },
};
