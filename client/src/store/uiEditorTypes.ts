export interface UIElementInfo {
  type: string;       // 'actorName' | 'actorClass' | 'actorFace' | 'actorLevel' | ...
  label: string;      // 표시 이름 (한국어)
  x: number;
  y: number;
  width: number;
  height: number;
  isPerActor?: boolean; // perActor 레이아웃 (BattleStatus, MenuStatus 등)
}

export interface UIElementOverride {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
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
  | 'rotate';

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

export interface UIWindowOverride {
  className: string;
  windowStyle?: 'default' | 'frame' | 'image';
  skinId?: string;           // frame 모드 전용 — UIEditorSkins.json의 스킨 ID
  imageFile?: string;        // image 모드 전용 — img/system/ 파일명 (확장자 제외)
  imageRenderMode?: ImageRenderMode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
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
};
