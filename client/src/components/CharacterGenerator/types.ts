import {
  FACE_RENDER_ORDER,
  TV_RENDER_ORDER,
  SV_RENDER_ORDER,
} from '../../utils/generatorRenderer';

export type Gender = 'Male' | 'Female' | 'Kid';
export type OutputType = 'Face' | 'TV' | 'SV';

export interface FaceColorLayer {
  index: number;
  defaultGradientRow: number;
  file: string;
}

export interface FacePattern {
  id: string;
  colorLayers: FaceColorLayer[];
}

export interface TVSVPattern {
  id: string;
  baseFile: string;
  colorMapFile: string | null;
}

export interface FacePartManifest {
  [partName: string]: { patterns: FacePattern[] };
}

export interface TVSVPartManifest {
  [partName: string]: { patterns: TVSVPattern[] };
}

export interface VariationIcon {
  pattern: string;
  file: string;
}

export interface GradientSwatch {
  row: number;
  color: string;
}

export interface PartSelection {
  patternId: string | null;
  colorRows: Record<number, number>;
}

export interface GeneratorStatus {
  available: boolean;
  inProject: boolean;
  steamAvailable: boolean;
  customPath: string | null;
}

export function getRenderOrder(type: OutputType): string[] {
  if (type === 'TV') return TV_RENDER_ORDER;
  if (type === 'SV') return SV_RENDER_ORDER;
  return FACE_RENDER_ORDER;
}

export const GENDER_LABELS: Record<Gender, string> = { Male: '남성', Female: '여성', Kid: '아이' };
export const OUTPUT_LABELS: Record<OutputType, string> = { Face: '얼굴', TV: '걷기', SV: '전투' };
export const OUTPUT_SIZES: Record<OutputType, { w: number; h: number }> = {
  Face: { w: 144, h: 144 },
  TV: { w: 144, h: 192 },
  SV: { w: 576, h: 384 },
};
export const EXPORT_TYPE_LABELS: Record<string, string> = {
  faces: '얼굴 (img/faces)',
  characters: '걷기 캐릭터 (img/characters)',
  sv_actors: '전투 캐릭터 (img/sv_actors)',
};

// 같은 _m 값(defaultGradientRow)을 공유하는 파트들은 같은 색상 그룹
// defaultGradientRow를 키로 사용하여 모든 파트의 해당 color layer를 동기화
export function buildColorGroupMap(manifest: FacePartManifest, selections: Record<string, PartSelection>): Map<number, Array<{ part: string; layerIdx: number }>> {
  const groups = new Map<number, Array<{ part: string; layerIdx: number }>>();
  for (const [partName, partData] of Object.entries(manifest)) {
    const sel = selections[partName];
    if (!sel?.patternId) continue;
    const pattern = partData.patterns.find((p) => p.id === sel.patternId) as FacePattern | undefined;
    if (!pattern) continue;
    for (const cl of pattern.colorLayers) {
      if (!groups.has(cl.defaultGradientRow)) {
        groups.set(cl.defaultGradientRow, []);
      }
      groups.get(cl.defaultGradientRow)!.push({ part: partName, layerIdx: cl.index });
    }
  }
  return groups;
}

// TV/SV 파트 이름 → Face에서 사용하는 _m 값 (기본 gradient row) 매핑
// Face 파트의 _m 값 기반: _m001=피부, _m002=눈, _m003=머리, _m005=문신, _m006=수인귀
export const TVSV_PART_DEFAULT_GRADIENT: Record<string, number> = {
  Body: 1, Ears: 1,                                    // 피부 (_m001)
  FacialMark: 5,                                        // 문신 (_m005)
  BeastEars: 6,                                         // 수인귀 (_m006)
  FrontHair: 3, FrontHair1: 3, FrontHair2: 3,          // 머리 (_m003)
  RearHair1: 3, RearHair2: 3,                           // 머리 (_m003)
  Beard: 3, Beard1: 3, Beard2: 3,                       // 수염/머리 (_m003)
  Clothing1: 7, Clothing2: 7,                            // 의복 (_m007)
  Cloak1: 11, Cloak2: 11,                               // 망토 (_m011)
  AccA: 13, AccB: 16,                                   // 악세사리
  Glasses: 20,                                           // 안경
  Wing: 7, Wing1: 7, Wing2: 7,                          // 날개
  Tail: 3, Tail1: 3, Tail2: 3,                          // 꼬리
};
