export interface UIElementInfo {
  type: string;       // 'actorName' | 'actorClass' | 'actorFace' | 'actorLevel' | ...
  label: string;      // 표시 이름 (한국어)
  x: number;
  y: number;
  width: number;
  height: number;
  isPerActor?: boolean; // perActor 레이아웃 (BattleStatus, MenuStatus 등)
  /** false면 위치/크기 편집 불가 (폰트만 설정 가능한 제네릭 요소) */
  supportsPosition?: boolean;
}

export interface UIElementOverride {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontFace?: string;
  visible?: boolean;
}

export interface UIWindowInfo {
  id: string;
  className: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  backOpacity: number;
  padding: number;
  fontSize: number;
  fontFace: string;
  windowskinName: string;
  colorTone: [number, number, number];
  visible: boolean;
  elements?: UIElementInfo[];
  originalX?: number;
  originalY?: number;
  originalWidth?: number;
  originalHeight?: number;
}

export type ImageRenderMode = 'center' | 'stretch' | 'tile' | 'fit' | 'cover';

export type EntranceEffectType =
  | 'fadeIn'
  | 'fadeOut'
  | 'slideLeft'
  | 'slideRight'
  | 'slideTop'
  | 'slideBottom'
  | 'zoom'
  | 'bounce'
  | 'rotate'
  | 'rotateX'
  | 'rotateY';

export type EntranceEasing = 'easeOut' | 'easeIn' | 'easeInOut' | 'linear' | 'bounce';

export interface UIWindowEntranceEffect {
  type: EntranceEffectType;
  duration: number;    // ms (기본: 300)
  easing: EntranceEasing;
  delay?: number;      // ms (기본: 0)
  // zoom 전용
  fromScale?: number;  // 시작 스케일 0~1 (기본: 0)
  // rotate 전용
  fromAngle?: number;  // 시작 각도 도 (기본: 180)
}

// 애니메이션 회전/줌 효과의 기준점 (3×3 앵커)
export type AnimPivotAnchor =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'center' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right';

export interface UIWindowOverride {
  className: string;
  windowStyle?: 'default' | 'frame' | 'image';
  renderCamera?: 'orthographic' | 'perspective';
  skinId?: string;           // frame 모드 전용 — UIEditorSkins.json의 스킨 ID
  imageFile?: string;        // image 모드 전용 — img/system/ 파일명 (확장자 제외)
  imageRenderMode?: ImageRenderMode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // 정적 회전 (항상 적용, 도 단위)
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  opacity?: number;
  backOpacity?: number;
  padding?: number;
  fontSize?: number;
  fontFace?: string;
  windowskinName?: string;
  colorTone?: [number, number, number];
  elements?: Record<string, UIElementOverride>;
  entrances?: UIWindowEntranceEffect[];
  exits?: UIWindowEntranceEffect[];
  // 등장/퇴장 애니메이션의 회전·줌 기준점
  animPivot?: AnimPivotAnchor;
}

// ── 커스텀 씬 타입 ──────────────────────────────────────
export type CommandActionType = 'gotoScene' | 'popScene' | 'callCommonEvent' | 'customScene' | 'activateWindow' | 'script' | 'focusWidget' | 'refreshWidgets' | 'selectActor' | 'formation' | 'toggleConfig' | 'incrementConfig' | 'decrementConfig' | 'saveConfig';

export interface CustomCommandDef {
  name: string;
  symbol: string;
  enabled?: boolean;
  enabledCondition?: string; // JS 표현식 (동적 활성 여부)
}

export interface CustomCommandHandler {
  action: CommandActionType;
  target?: string;
  eventId?: number;
  code?: string; // script 액션용 JS 코드
  widget?: string; // selectActor/formation 액션용 위젯 ID
  thenAction?: CustomCommandHandler; // selectActor 액터 선택 후 실행할 액션
  configKey?: string; // toggleConfig/incrementConfig/decrementConfig 액션용
  step?: number; // incrementConfig/decrementConfig 증감 단위 (기본 20)
}

export interface CustomElementDef {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;   // text/label용
  file?: string;      // image용
  varId?: number;     // variable 요소용
  configKey?: string; // configValue 요소용
  suffix?: string;    // variable/configValue 뒤에 붙는 단위 (예: "%")
  align?: string;     // 텍스트 정렬 ('left'|'center'|'right')
}

export interface CustomWindowDef {
  id: string;
  displayName: string;
  windowType: 'command' | 'display';
  x: number;
  y: number;
  width: number;
  height: number | null;
  maxCols?: number;
  commands?: CustomCommandDef[];
  handlers?: Record<string, CustomCommandHandler>;
  elements?: CustomElementDef[];
}

export interface PrepareArgDef {
  name: string;
  type: 'number' | 'string';
  default: any;
}

export interface CustomSceneDef {
  id: string;
  displayName: string;
  /** 씬 분류: 없으면 커스텀 복제, 'sub'=서브씬(행 렌더링용), 'plugin'=플러그인 씬 */
  category?: 'sub' | 'plugin';
  prepareArgs: PrepareArgDef[];
  windows: CustomWindowDef[];
  windowLinks: Record<string, { activateDefault?: boolean }>;
}

export interface CustomScenesData {
  scenes: Record<string, CustomSceneDef>;
}

export type UiSkinUndoEntry = {
  frameX: number; frameY: number; frameW: number; frameH: number;
  fillX: number; fillY: number; fillW: number; fillH: number;
  cornerSize: number;
  cursorX: number; cursorY: number; cursorW: number; cursorH: number;
  cursorCornerSize: number;
  cursorRenderMode: 'nineSlice' | 'stretch' | 'tile';
  cursorBlendMode: 'normal' | 'add' | 'multiply' | 'screen';
  cursorOpacity: number;
  cursorBlink: boolean;
  cursorPadding: number;
  cursorToneR: number; cursorToneG: number; cursorToneB: number;
  gaugeFile?: string;
  gaugeBgX: number; gaugeBgY: number; gaugeBgW: number; gaugeBgH: number;
  gaugeFillX: number; gaugeFillY: number; gaugeFillW: number; gaugeFillH: number;
  gaugeFillDir: 'horizontal' | 'vertical';
};

// ── 위젯 애니메이션 타입 ──────────────────────────────────────

/** 커스텀 씬 위젯의 등장/퇴장 애니메이션 타입 */
export type WidgetAnimType =
  | 'none'
  | 'fade'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'openness'
  | 'zoom';

export interface WidgetAnimDef {
  type: WidgetAnimType;
  /** 애니메이션 지속 프레임 수 (기본: 15) */
  duration?: number;
  /** 시작 딜레이 프레임 수 (기본: 0) */
  delay?: number;
  /** slide 이동 거리 px — 미설정 시 위젯 크기에 맞춰 자동 계산 */
  offset?: number;
}

// ── 위젯 트리 타입 (formatVersion 2) ─────────────────────────

export type WidgetType = 'background' | 'panel' | 'label' | 'textArea' | 'image' | 'gauge' | 'separator' | 'button' | 'list' | 'textList' | 'rowSelector' | 'options' | 'minimap' | 'scene';

export interface WidgetDefBase {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height?: number;
  visible?: boolean;
  /** false로 설정하면 preview에서 클릭 선택 불가 (로직 위젯 등) */
  previewSelectable?: boolean;
  children?: WidgetDef[];
  /** 배경 색상 (hex, e.g. '#000000'). Image 위젯은 이미지 없을 때 이 색상으로 채움 (기본 '#ffffff') */
  bgColor?: string;
  /** 위젯 전체 불투명도 0~1 (default 1) */
  bgAlpha?: number;
  /** 테두리 두께 (px, 0 = 없음) */
  borderWidth?: number;
  /** 테두리 색상 (hex, default '#ffffff') */
  borderColor?: string;
  /** 테두리 모서리 곡률 (px, default 0 = 직각) */
  borderRadius?: number;
  /** 창 배경 표시 여부. panel/button/list/rowSelector/options 모두 기본 true (프레임 표시). false로 설정 시 투명 */
  windowed?: boolean;
  /** 창 스타일 (default: 기본 윈도우스킨, frame: 커스텀 프레임, image: 이미지) */
  windowStyle?: 'default' | 'frame' | 'image';
  windowskinName?: string;
  skinId?: string;
  /** windowStyle='image' 전용 — img/system/ 파일명 */
  imageFile?: string;
  imageRenderMode?: ImageRenderMode;
  colorTone?: [number, number, number];
  /** Window 내부 패딩 (px). RowSelector transparent 모드에서는 커서 정렬에 영향 */
  padding?: number;
  /** 창 배경 불투명도 0~255 */
  backOpacity?: number;
  /** 등장 애니메이션 (씬 start 시 자동 실행) */
  enterAnimation?: WidgetAnimDef;
  /** 퇴장 애니메이션 (씬 popScene 시 자동 실행) */
  exitAnimation?: WidgetAnimDef;
}

export interface WidgetDef_Panel extends WidgetDefBase {
  type: 'panel';
}

export interface WidgetDef_Label extends WidgetDefBase {
  type: 'label';
  text: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fontSize?: number;
  /** true: \c[N] 등 확장 텍스트 코드 지원 */
  useTextEx?: boolean;
  /** 텍스트 색상 (hex). 없으면 기본 WindowSkin 색상 */
  color?: string;
}

export interface WidgetDef_TextArea extends WidgetDefBase {
  type: 'textArea';
  text: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fontSize?: number;
  /** 줄 간격 (px, 기본: lineHeight()) */
  lineHeight?: number;
}

export type ImageSource = 'file' | 'actorFace' | 'actorCharacter';

export interface WidgetDef_Image extends WidgetDefBase {
  type: 'image';
  /** 이미지 소스 타입 (기본: 'file') */
  imageSource?: ImageSource;
  // file 소스
  imageName?: string;
  imageFolder?: string;
  // actorFace / actorCharacter 소스
  actorIndex?: number;
  /** JS 표현식 — Bitmap 객체를 반환. 이 필드가 있으면 imageSource 무시 */
  bitmapExpr?: string;
  /** JS 표현식 — {x,y,w,h} 객체를 반환 (소스 rect 잘라내기). bitmapExpr와 함께 사용 */
  srcRectExpr?: string;
  /** 이미지 피팅 모드 (기본 'stretch') */
  fitMode?: 'stretch' | 'contain' | 'none';
}

export interface WidgetDef_Gauge extends WidgetDefBase {
  type: 'gauge';
  // expr 방식 (우선): JS 표현식으로 값을 동적으로 평가
  valueExpr?: string;   // e.g. "$gameParty.members()[0].hp"
  maxExpr?: string;     // e.g. "$gameParty.members()[0].mhp"
  labelExpr?: string;   // e.g. "'HP'"
  // 레거시 방식 (하위 호환): hp/mp/tp + actorIndex
  gaugeType?: 'hp' | 'mp' | 'tp';
  actorIndex?: number;
  /** JS 표현식 — 액터 인덱스를 동적으로 평가 (예: "$ctx.actorIndex") */
  actorIndexExpr?: string;
  gaugeRenderMode?: 'palette' | 'image';
  gaugeSkinId?: string;
  showLabel?: boolean;
  showValue?: boolean;
}

export interface WidgetDef_Background extends WidgetDefBase {
  type: 'background';
}

export interface WidgetDef_Separator extends WidgetDefBase {
  type: 'separator';
}

export interface WidgetDef_Button extends WidgetDefBase {
  type: 'button';
  label: string;
  action: CustomCommandHandler;
  leftAction?: CustomCommandHandler;
  rightAction?: CustomCommandHandler;
}

export interface WidgetDef_List extends WidgetDefBase {
  type: 'list';
  maxCols?: number;
  items: CustomCommandDef[];
  handlers: Record<string, CustomCommandHandler>;
  /** 행 배열을 반환하는 JS 식 (dataScript 모드). 예: $gameParty.items().map(i=>({name:i.name,...})) */
  dataScript?: string;
  /** 커서 이동 시 실행할 코드 */
  onCursor?: { code: string };
  /** 각 행을 렌더링할 UIScene ID (itemScene 모드) */
  itemScene?: string;
  /** false로 설정하면 6프레임 자동 rebuild 비활성화 (기본 true) */
  autoRefresh?: boolean;
  /** false로 설정하면 NavigationManager 포커스에서 제외 (기본 true) */
  focusable?: boolean;
}

export interface WidgetDef_TextList extends WidgetDefBase {
  type: 'textList';
  maxCols?: number;
  items: CustomCommandDef[];
  handlers: Record<string, CustomCommandHandler>;
  /** 행 배열을 반환하는 JS 식 (dataScript 모드). 예: $gameParty.items().map(i=>({name:i.name,...})) */
  dataScript?: string;
  /** 커서 이동 시 실행할 코드 */
  onCursor?: { code: string };
  /** 각 행을 렌더링할 UIScene ID (itemScene 모드) */
  itemScene?: string;
  /** false로 설정하면 6프레임 자동 rebuild 비활성화 (기본 true) */
  autoRefresh?: boolean;
  /** false로 설정하면 NavigationManager 포커스에서 제외 (기본 true) */
  focusable?: boolean;
}

export interface WidgetDef_RowSelector extends WidgetDefBase {
  type: 'rowSelector';
  /** 행 수. 'party'면 $gameParty.size() 동적 */
  numRows?: number | 'party';
  /** true: 프레임/배경 없는 투명 선택 커서만 표시 (display는 개별 위젯으로 구성) */
  transparent?: boolean;
  /** ok/cancel 핸들러 직접 정의. 미정의 시 selectActor/기본 네비게이션 동작 */
  handlers?: Record<string, CustomCommandHandler>;
}

export interface OptionItemDef {
  name: string;
  symbol: string;
}

export interface WidgetDef_Options extends WidgetDefBase {
  type: 'options';
  options: OptionItemDef[];
}

export interface WidgetDef_Minimap extends WidgetDefBase {
  type: 'minimap';
}

export interface WidgetDef_Scene extends WidgetDefBase {
  type: 'scene';
  /** UIScenes에 등록된 씬 ID */
  sceneId?: string;
  /** 씬 _ctx에 임시 주입할 키-값 오브젝트 */
  instanceCtx?: Record<string, unknown>;
}

export type WidgetDef =
  | WidgetDef_Background
  | WidgetDef_Panel
  | WidgetDef_Label
  | WidgetDef_TextArea
  | WidgetDef_Image
  | WidgetDef_Gauge
  | WidgetDef_Separator
  | WidgetDef_Button
  | WidgetDef_List
  | WidgetDef_TextList
  | WidgetDef_RowSelector
  | WidgetDef_Options
  | WidgetDef_Minimap
  | WidgetDef_Scene;

export interface NavigationConfig {
  defaultFocus?: string;
  cancelWidget?: string;
  focusOrder?: string[];
}

export interface CustomSceneDefV2 extends Omit<CustomSceneDef, 'windows'> {
  formatVersion?: number;
  root?: WidgetDef;
  navigation?: NavigationConfig;
  windows?: CustomWindowDef[];
  /** true: 씬 전환 없이 인게임 위에 그리는 오버레이 모드 */
  overlay?: boolean;
  /** 씬 등장 시 기본 애니메이션 (위젯 개별 설정 없을 때 fallback) */
  enterAnimation?: WidgetAnimDef;
  /** 씬 퇴장 시 기본 애니메이션 (위젯 개별 설정 없을 때 fallback, popScene 완료 조건에 포함) */
  exitAnimation?: WidgetAnimDef;
}
