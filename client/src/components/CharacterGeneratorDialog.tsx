import React, { useState, useEffect, useCallback, useRef } from 'react';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';
import {
  loadGradients,
  getGradientSwatches,
  compositeFaceCharacter,
  compositeTVSVCharacter,
  FACE_RENDER_ORDER,
  TV_RENDER_ORDER,
  SV_RENDER_ORDER,
} from '../utils/generatorRenderer';

type Gender = 'Male' | 'Female' | 'Kid';
type OutputType = 'Face' | 'TV' | 'SV';

interface FaceColorLayer {
  index: number;
  defaultGradientRow: number;
  file: string;
}

interface FacePattern {
  id: string;
  colorLayers: FaceColorLayer[];
}

interface TVSVPattern {
  id: string;
  baseFile: string;
  colorMapFile: string | null;
}

interface FacePartManifest {
  [partName: string]: { patterns: FacePattern[] };
}

interface TVSVPartManifest {
  [partName: string]: { patterns: TVSVPattern[] };
}

interface VariationIcon {
  pattern: string;
  file: string;
}

interface GradientSwatch {
  row: number;
  color: string;
}

interface PartSelection {
  patternId: string | null;
  colorRows: Record<number, number>;
}

interface GeneratorStatus {
  available: boolean;
  inProject: boolean;
  steamAvailable: boolean;
  customPath: string | null;
}

function getRenderOrder(type: OutputType): string[] {
  if (type === 'TV') return TV_RENDER_ORDER;
  if (type === 'SV') return SV_RENDER_ORDER;
  return FACE_RENDER_ORDER;
}

const GENDER_LABELS: Record<Gender, string> = { Male: '남성', Female: '여성', Kid: '아이' };
const OUTPUT_LABELS: Record<OutputType, string> = { Face: '얼굴', TV: '걷기', SV: '전투' };
const OUTPUT_SIZES: Record<OutputType, { w: number; h: number }> = {
  Face: { w: 144, h: 144 },
  TV: { w: 144, h: 192 },
  SV: { w: 576, h: 384 },
};
const EXPORT_TYPE_LABELS: Record<string, string> = {
  faces: '얼굴 (img/faces)',
  characters: '걷기 캐릭터 (img/characters)',
  sv_actors: '전투 캐릭터 (img/sv_actors)',
};

// 같은 _m 값(defaultGradientRow)을 공유하는 파트들은 같은 색상 그룹
// defaultGradientRow를 키로 사용하여 모든 파트의 해당 color layer를 동기화
function buildColorGroupMap(manifest: FacePartManifest, selections: Record<string, PartSelection>): Map<number, Array<{ part: string; layerIdx: number }>> {
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
const TVSV_PART_DEFAULT_GRADIENT: Record<string, number> = {
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

export default function CharacterGeneratorDialog() {
  const setShowCharacterGeneratorDialog = useEditorStore((s) => s.setShowCharacterGeneratorDialog);

  const [gender, setGender] = useState<Gender>('Male');
  const [outputType, setOutputType] = useState<OutputType>('Face');
  const [activePart, setActivePart] = useState('Body');
  const [activeColorLayerIdx, setActiveColorLayerIdx] = useState(1);

  const [faceManifest, setFaceManifest] = useState<FacePartManifest>({});
  const [tvsvManifest, setTvsvManifest] = useState<TVSVPartManifest>({});
  const [variations, setVariations] = useState<Record<string, VariationIcon[]>>({});
  const [selections, setSelections] = useState<Record<string, PartSelection>>({});

  const [gradients, setGradients] = useState<ImageData | null>(null);
  const [swatches, setSwatches] = useState<GradientSwatch[]>([]);

  // 글로벌 색상 맵: _m값(defaultGradientRow) → 사용자가 선택한 gradient row
  // Face/TV/SV 간 전환해도 유지되며, 같은 _m 값의 파트들은 동일한 색상을 공유
  const [colorMap, setColorMap] = useState<Record<number, number>>({});

  // 상태 / 리소스 복사
  const [genStatus, setGenStatus] = useState<GeneratorStatus | null>(null);
  const [copying, setCopying] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [pathError, setPathError] = useState('');

  // 내보내기 모달
  const [exportModal, setExportModal] = useState<{ type: string } | null>(null);
  const [exportName, setExportName] = useState('');
  const exportInputRef = useRef<HTMLInputElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewTimerRef = useRef<number>(0);

  // Generator 상태 확인
  useEffect(() => {
    apiClient.get<GeneratorStatus>('/generator/status')
      .then(setGenStatus)
      .catch(() => setGenStatus({ available: false, inProject: false, steamAvailable: false, customPath: null }));
  }, []);

  // gradients 로드
  useEffect(() => {
    if (!genStatus?.available) return;
    loadGradients('/api/generator/gradients').then((gd) => {
      setGradients(gd);
      setSwatches(getGradientSwatches(gd));
    }).catch(console.error);
  }, [genStatus?.available]);

  // 성별/출력타입 변경 시 매니페스트 로드
  useEffect(() => {
    if (!genStatus?.available) return;
    loadManifest();
  }, [gender, outputType, genStatus?.available]);

  const loadManifest = async () => {
    try {
      if (outputType === 'Face') {
        const manifest = await apiClient.get<FacePartManifest>(`/generator/parts/${gender}/Face`);
        setFaceManifest(manifest);
        initSelections(manifest, 'Face');
      } else {
        const manifest = await apiClient.get<TVSVPartManifest>(`/generator/parts/${gender}/${outputType}`);
        setTvsvManifest(manifest);
        // Face 매니페스트도 필요 (색상 그룹 참조용) — 없으면 로드
        if (Object.keys(faceManifest).length === 0) {
          apiClient.get<FacePartManifest>(`/generator/parts/${gender}/Face`)
            .then(setFaceManifest)
            .catch(() => {});
        }
        initSelections(manifest, outputType);
      }
    } catch (e) {
      console.error('Failed to load manifest:', e);
    }
  };

  const initSelections = (manifest: FacePartManifest | TVSVPartManifest, type: OutputType) => {
    const sel: Record<string, PartSelection> = {};
    for (const partName of getRenderOrder(type)) {
      const partData = manifest[partName];
      if (!partData || partData.patterns.length === 0) {
        sel[partName] = { patternId: null, colorRows: {} };
        continue;
      }
      const firstPattern = partData.patterns[0];
      const colorRows: Record<number, number> = {};
      if (type === 'Face') {
        const fp = firstPattern as FacePattern;
        for (const cl of fp.colorLayers) {
          // colorMap에 저장된 값이 있으면 그걸 사용, 없으면 기본값
          colorRows[cl.index] = colorMap[cl.defaultGradientRow] ?? cl.defaultGradientRow;
        }
      } else {
        // TV/SV: 파트 이름으로 매핑된 기본 gradient row를 키로 colorMap 참조
        const defaultRow = TVSV_PART_DEFAULT_GRADIENT[partName] ?? 1;
        colorRows[1] = colorMap[defaultRow] ?? defaultRow;
      }
      const shouldSelect = ['Body', 'Face', 'Eyes', 'Ears', 'Eyebrows', 'Nose', 'Mouth',
        'FrontHair', 'FrontHair1', 'RearHair1'].includes(partName);
      sel[partName] = {
        patternId: shouldSelect ? firstPattern.id : null,
        colorRows,
      };
    }
    setSelections(sel);
  };

  // 부품별 Variation 아이콘 로드
  useEffect(() => {
    if (!activePart || !genStatus?.available) return;
    const key = `${gender}/${activePart}`;
    if (variations[key]) return;
    apiClient.get<VariationIcon[]>(`/generator/variation/${gender}/${activePart}`)
      .then((icons) => setVariations((prev) => ({ ...prev, [key]: icons })))
      .catch(() => setVariations((prev) => ({ ...prev, [key]: [] })));
  }, [gender, activePart, genStatus?.available]);

  // 미리보기 렌더링
  useEffect(() => {
    if (!gradients) return;
    clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => renderPreview(), 100);
    return () => clearTimeout(previewTimerRef.current);
  }, [gradients, selections, outputType, gender]);

  const renderPreview = async () => {
    if (!gradients || !canvasRef.current) return;
    const size = OUTPUT_SIZES[outputType];
    try {
      let result: HTMLCanvasElement;
      const renderOrder = getRenderOrder(outputType);
      if (outputType === 'Face') {
        const parts = renderOrder
          .filter((pn) => selections[pn]?.patternId)
          .map((pn) => {
            const sel = selections[pn];
            const partData = faceManifest[pn];
            const pattern = partData?.patterns.find((p) => p.id === sel.patternId) as FacePattern | undefined;
            if (!pattern) return null;
            const layers = pattern.colorLayers.map((cl) => ({
              imageUrl: `/api/generator/image/Face/${gender}/${cl.file}`,
              gradientRow: cl.defaultGradientRow !== undefined
                ? (sel.colorRows[cl.index] ?? cl.defaultGradientRow)
                : null,
            }));
            return { partName: pn, layers };
          })
          .filter(Boolean) as any[];
        result = await compositeFaceCharacter(parts, gradients, size.w, size.h);
      } else {
        const parts = renderOrder
          .filter((pn) => selections[pn]?.patternId)
          .map((pn) => {
            const sel = selections[pn];
            const partData = tvsvManifest[pn];
            const pattern = partData?.patterns.find((p) => p.id === sel.patternId) as TVSVPattern | undefined;
            if (!pattern) return null;
            return {
              partName: pn,
              baseImageUrl: `/api/generator/image/${outputType}/${gender}/${pattern.baseFile}`,
              colorMapUrl: pattern.colorMapFile
                ? `/api/generator/image/${outputType}/${gender}/${pattern.colorMapFile}`
                : null,
              gradientRow: sel.colorRows[1] ?? 1,
            };
          })
          .filter(Boolean) as any[];
        result = await compositeTVSVCharacter(parts, gradients, size.w, size.h, outputType as 'TV' | 'SV');
      }
      const ctx = canvasRef.current.getContext('2d')!;
      canvasRef.current.width = size.w;
      canvasRef.current.height = size.h;
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.drawImage(result, 0, 0);
    } catch (e) {
      console.error('Preview render error:', e);
    }
  };

  const handleSelectPattern = (patternId: string | null) => {
    setSelections((prev) => {
      const current = prev[activePart] || { patternId: null, colorRows: {} };
      const colorRows = { ...current.colorRows };
      if (patternId && outputType === 'Face') {
        const partData = faceManifest[activePart];
        const pattern = partData?.patterns.find((p) => p.id === patternId);
        if (pattern) {
          // 같은 그룹의 다른 파트에서 이미 설정된 색상이 있으면 그걸 사용
          const groups = buildColorGroupMap(faceManifest, prev);
          for (const cl of pattern.colorLayers) {
            if (!(cl.index in colorRows)) {
              // 같은 defaultGradientRow 그룹에서 이미 설정된 색상 찾기
              const groupMembers = groups.get(cl.defaultGradientRow) || [];
              let existingRow: number | null = null;
              for (const member of groupMembers) {
                const memberSel = prev[member.part];
                if (memberSel?.colorRows[member.layerIdx] !== undefined) {
                  existingRow = memberSel.colorRows[member.layerIdx];
                  break;
                }
              }
              colorRows[cl.index] = existingRow ?? cl.defaultGradientRow;
            }
          }
        }
      }
      return { ...prev, [activePart]: { patternId, colorRows } };
    });
  };

  const handleSelectColor = (row: number) => {
    // 현재 파트의 _m값(defaultGradientRow) 결정
    let defaultRow: number | undefined;
    if (outputType === 'Face') {
      const currentSel = selections[activePart];
      const pattern = faceManifest[activePart]?.patterns.find(
        (p) => p.id === currentSel?.patternId
      ) as FacePattern | undefined;
      const currentLayer = pattern?.colorLayers.find((cl) => cl.index === activeColorLayerIdx);
      defaultRow = currentLayer?.defaultGradientRow;
    } else {
      defaultRow = TVSV_PART_DEFAULT_GRADIENT[activePart] ?? 1;
    }

    // 글로벌 colorMap 업데이트
    if (defaultRow !== undefined) {
      setColorMap((prev) => ({ ...prev, [defaultRow!]: row }));
    }

    setSelections((prev) => {
      const updated = { ...prev };

      if (outputType === 'Face' && defaultRow !== undefined) {
        // 같은 defaultGradientRow를 가진 모든 Face 파트의 해당 레이어를 동기화
        const groups = buildColorGroupMap(faceManifest, prev);
        const groupMembers = groups.get(defaultRow) || [];
        for (const member of groupMembers) {
          const memberSel = updated[member.part] || { patternId: null, colorRows: {} };
          updated[member.part] = {
            ...memberSel,
            colorRows: { ...memberSel.colorRows, [member.layerIdx]: row },
          };
        }
      } else if (outputType !== 'Face' && defaultRow !== undefined) {
        // TV/SV: 같은 defaultRow를 가진 모든 TV/SV 파트 동기화
        for (const [partName, partDefaultRow] of Object.entries(TVSV_PART_DEFAULT_GRADIENT)) {
          if (partDefaultRow === defaultRow && updated[partName]?.patternId) {
            updated[partName] = {
              ...updated[partName],
              colorRows: { ...updated[partName].colorRows, 1: row },
            };
          }
        }
        // 현재 파트도 반드시 업데이트
        const current = prev[activePart] || { patternId: null, colorRows: {} };
        updated[activePart] = {
          ...current,
          colorRows: { ...current.colorRows, [activeColorLayerIdx]: row },
        };
      } else {
        // 고정 색상 레이어이거나 그룹 없으면 현재 파트만 변경
        const current = prev[activePart] || { patternId: null, colorRows: {} };
        updated[activePart] = {
          ...current,
          colorRows: { ...current.colorRows, [activeColorLayerIdx]: row },
        };
      }

      return updated;
    });
  };

  const handleRandomize = useCallback(() => {
    const manifest = outputType === 'Face' ? faceManifest : tvsvManifest;
    const sel: Record<string, PartSelection> = {};
    // 같은 defaultGradientRow를 가진 레이어들이 동일한 색상을 쓰도록
    const groupColors = new Map<number, number>();

    for (const partName of getRenderOrder(outputType)) {
      const partData = manifest[partName];
      if (!partData || partData.patterns.length === 0) {
        sel[partName] = { patternId: null, colorRows: {} };
        continue;
      }
      const isMandatory = ['Body', 'Face', 'Eyes', 'Ears', 'Eyebrows', 'Nose', 'Mouth'].includes(partName);
      const shouldSelect = isMandatory || Math.random() > 0.5;
      if (!shouldSelect) {
        sel[partName] = { patternId: null, colorRows: {} };
        continue;
      }
      const randomPattern = partData.patterns[Math.floor(Math.random() * partData.patterns.length)];
      const colorRows: Record<number, number> = {};
      if (outputType === 'Face') {
        const fp = randomPattern as FacePattern;
        for (const cl of fp.colorLayers) {
          if (!groupColors.has(cl.defaultGradientRow)) {
            groupColors.set(cl.defaultGradientRow, Math.floor(Math.random() * 70));
          }
          colorRows[cl.index] = groupColors.get(cl.defaultGradientRow)!;
        }
      } else {
        const defaultRow = TVSV_PART_DEFAULT_GRADIENT[partName] ?? 1;
        if (!groupColors.has(defaultRow)) {
          groupColors.set(defaultRow, Math.floor(Math.random() * 70));
        }
        colorRows[1] = groupColors.get(defaultRow)!;
      }
      sel[partName] = { patternId: randomPattern.id, colorRows };
    }
    // 글로벌 colorMap도 업데이트
    const newColorMap: Record<number, number> = {};
    for (const [key, value] of groupColors) {
      newColorMap[key] = value;
    }
    setColorMap((prev) => ({ ...prev, ...newColorMap }));
    setSelections(sel);
  }, [outputType, faceManifest, tvsvManifest]);

  // 내보내기 모달 열기
  const openExportModal = (exportType: string) => {
    setExportName('');
    setExportModal({ type: exportType });
    setTimeout(() => exportInputRef.current?.focus(), 50);
  };

  // 실제 내보내기 실행
  const doExport = async () => {
    if (!canvasRef.current || !exportModal || !exportName.trim()) return;
    const canvas = canvasRef.current;
    const data = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    const filename = exportName.trim().endsWith('.png') ? exportName.trim() : exportName.trim() + '.png';
    try {
      await apiClient.post('/generator/export', {
        type: exportModal.type,
        name: filename,
        data,
      });
      setStatusMsg(`내보내기 완료: ${filename}`);
      setExportModal(null);
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (e) {
      setStatusMsg(`내보내기 실패: ${e}`);
      setTimeout(() => setStatusMsg(''), 5000);
    }
  };

  // Steam에서 프로젝트로 복사
  const handleCopyToProject = async () => {
    setCopying(true);
    setStatusMsg('Generator 리소스를 프로젝트로 복사 중...');
    try {
      await apiClient.post('/generator/copy-to-project', {});
      setStatusMsg('복사 완료! 리소스를 다시 불러옵니다...');
      const status = await apiClient.get<GeneratorStatus>('/generator/status');
      setGenStatus(status);
      setStatusMsg('Generator 리소스가 프로젝트에 복사되었습니다.');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (e) {
      setStatusMsg(`복사 실패: ${e}`);
    } finally {
      setCopying(false);
    }
  };

  const handleClose = () => setShowCharacterGeneratorDialog(false);

  // 현재 부품의 패턴 목록
  const manifest = outputType === 'Face' ? faceManifest : tvsvManifest;
  const currentPartPatterns = manifest[activePart]?.patterns ?? [];
  const currentSelection = selections[activePart] || { patternId: null, colorRows: {} };
  const variationKey = `${gender}/${activePart}`;
  const currentVariations = variations[variationKey] ?? [];

  const currentFacePattern = outputType === 'Face'
    ? (faceManifest[activePart]?.patterns.find((p) => p.id === currentSelection.patternId) as FacePattern | undefined)
    : undefined;
  const colorLayerIndices = currentFacePattern
    ? currentFacePattern.colorLayers.map((cl) => cl.index)
    : [];

  const previewSize = OUTPUT_SIZES[outputType];
  const scale = outputType === 'SV' ? 0.5 : 1.5;
  const availableParts = getRenderOrder(outputType).filter((pn) => manifest[pn]?.patterns?.length > 0);

  const handleSetCustomPath = async () => {
    if (!customPath.trim()) return;
    setPathError('');
    try {
      await apiClient.post('/generator/set-path', { path: customPath.trim() });
      const status = await apiClient.get<GeneratorStatus>('/generator/status');
      setGenStatus(status);
      if (!status.available) {
        setPathError('해당 경로에서 Generator 리소스를 찾을 수 없습니다 (gradients.png 필요)');
      }
    } catch (e: any) {
      setPathError(e?.message || '경로 설정 실패');
    }
  };

  // Generator 리소스 미사용 가능 상태
  if (genStatus && !genStatus.available) {
    return (
      <div className="db-dialog-overlay" onClick={handleClose}>
        <div className="db-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 560, height: 'auto' }}>
          <div className="db-dialog-header">캐릭터 생성기</div>
          <div style={{ padding: 20 }}>
            <p style={{ marginBottom: 16, color: '#ccc', textAlign: 'center' }}>
              Generator 리소스를 찾을 수 없습니다.
            </p>
            {genStatus.steamAvailable && (
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                  Steam에서 Generator 리소스를 감지했습니다.
                </p>
                <button className="db-btn" onClick={handleCopyToProject} disabled={copying}>
                  {copying ? '복사 중...' : '프로젝트에 복사'}
                </button>
              </div>
            )}
            <div style={{ borderTop: '1px solid #555', paddingTop: 16 }}>
              <p style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                Generator 폴더 경로를 직접 지정:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSetCustomPath(); }}
                  placeholder="/path/to/Generator"
                  style={{
                    flex: 1, background: '#2b2b2b', border: '1px solid #555', borderRadius: 3,
                    padding: '6px 10px', color: '#ddd', fontSize: 12, outline: 'none',
                  }}
                />
                <button className="db-btn" onClick={handleSetCustomPath}>설정</button>
              </div>
              {pathError && <p style={{ marginTop: 6, fontSize: 11, color: '#f77' }}>{pathError}</p>}
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#888', lineHeight: '24px' }}>기본 경로:</span>
                <button className="db-btn" style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setCustomPath('~/Library/Application Support/Steam/steamapps/common/RPG Maker MV/RPG Maker MV.app/Contents/MacOS/Generator')}>
                  macOS
                </button>
                <button className="db-btn" style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setCustomPath('C:\\Program Files (x86)\\Steam\\steamapps\\common\\RPG Maker MV\\Generator')}>
                  Windows
                </button>
                <button className="db-btn" style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => setCustomPath('~/.steam/steam/steamapps/common/RPG Maker MV/Generator')}>
                  Linux
                </button>
              </div>
            </div>
            {statusMsg && <p style={{ marginTop: 12, fontSize: 12, color: '#7af', textAlign: 'center' }}>{statusMsg}</p>}
          </div>
          <div className="db-dialog-footer">
            <button className="db-btn" onClick={handleClose}>닫기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="db-dialog-overlay" onClick={handleClose}>
      <div className="db-dialog cg-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="db-dialog-header" style={{ display: 'flex', alignItems: 'center' }}>
          <span>캐릭터 생성기</span>
          <div className="cg-gender-tabs">
            {(['Male', 'Female', 'Kid'] as Gender[]).map((g) => (
              <button
                key={g}
                className={`cg-gender-tab${gender === g ? ' active' : ''}`}
                onClick={() => setGender(g)}
              >
                {GENDER_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        <div className="cg-body">
          {/* 부품 목록 */}
          <div className="cg-parts-list">
            {availableParts.map((pn) => (
              <div
                key={pn}
                className={`cg-part-item${activePart === pn ? ' selected' : ''}`}
                onClick={() => { setActivePart(pn); setActiveColorLayerIdx(1); }}
              >
                <span>{pn}</span>
                {selections[pn]?.patternId && <span className="cg-part-active" />}
              </div>
            ))}
          </div>

          {/* 패턴 선택 + 색상 팔레트 */}
          <div className="cg-pattern-area">
            <div className="cg-pattern-grid">
              <div
                className={`cg-pattern-cell none-cell${currentSelection.patternId === null ? ' selected' : ''}`}
                onClick={() => handleSelectPattern(null)}
              >
                없음
              </div>
              {currentPartPatterns.map((pattern) => {
                const pId = pattern.id;
                const icon = currentVariations.find((v) => v.pattern === pId);
                return (
                  <div
                    key={pId}
                    className={`cg-pattern-cell${currentSelection.patternId === pId ? ' selected' : ''}`}
                    onClick={() => handleSelectPattern(pId)}
                  >
                    {icon ? (
                      <img
                        src={`/api/generator/image/Variation/${gender}/${icon.file}`}
                        alt={pId}
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: '#888' }}>{pId}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {currentSelection.patternId && (
              <div className="cg-color-area">
                <div className="cg-color-label">색상</div>
                {outputType === 'Face' && colorLayerIndices.length > 1 && (
                  <div className="cg-color-layer-tabs">
                    {colorLayerIndices.map((idx) => (
                      <button
                        key={idx}
                        className={`cg-color-layer-tab${activeColorLayerIdx === idx ? ' active' : ''}`}
                        onClick={() => setActiveColorLayerIdx(idx)}
                      >
                        c{idx}
                      </button>
                    ))}
                  </div>
                )}
                <div className="cg-color-swatches">
                  {swatches.map((sw) => (
                    <div
                      key={sw.row}
                      className={`cg-color-swatch${(currentSelection.colorRows[activeColorLayerIdx] ?? -1) === sw.row ? ' selected' : ''}`}
                      style={{ backgroundColor: sw.color }}
                      onClick={() => handleSelectColor(sw.row)}
                      title={`팔레트 ${sw.row}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 미리보기 */}
          <div className="cg-preview-area">
            <div className="cg-preview-tabs">
              {(['Face', 'TV', 'SV'] as OutputType[]).map((ot) => (
                <button
                  key={ot}
                  className={`cg-preview-tab${outputType === ot ? ' active' : ''}`}
                  onClick={() => setOutputType(ot)}
                >
                  {OUTPUT_LABELS[ot]}
                </button>
              ))}
            </div>
            <div className="cg-preview-canvas-wrap">
              <canvas
                ref={canvasRef}
                width={previewSize.w}
                height={previewSize.h}
                style={{
                  width: previewSize.w * scale,
                  height: previewSize.h * scale,
                }}
              />
            </div>
            {statusMsg && (
              <div style={{ fontSize: 11, color: '#7af', textAlign: 'center' }}>{statusMsg}</div>
            )}
          </div>
        </div>

        <div className="db-dialog-footer">
          {!genStatus?.inProject && genStatus?.steamAvailable && (
            <button className="db-btn" onClick={handleCopyToProject} disabled={copying} style={{ marginRight: 'auto' }}>
              {copying ? '복사 중...' : '리소스를 프로젝트에 복사'}
            </button>
          )}
          <button className="db-btn" onClick={handleRandomize}>랜덤</button>
          <button className="db-btn" onClick={() => openExportModal('faces')}>얼굴 내보내기</button>
          <button className="db-btn" onClick={() => openExportModal('characters')}>걷기 내보내기</button>
          <button className="db-btn" onClick={() => openExportModal('sv_actors')}>전투 내보내기</button>
          <button className="db-btn" onClick={handleClose}>닫기</button>
        </div>
      </div>

      {/* 내보내기 모달 */}
      {exportModal && (
        <div className="db-dialog-overlay" style={{ zIndex: 2100 }} onClick={() => setExportModal(null)}>
          <div className="cg-export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="db-dialog-header">내보내기 - {EXPORT_TYPE_LABELS[exportModal.type]}</div>
            <div style={{ padding: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#aaa' }}>
                파일 이름
                <input
                  ref={exportInputRef}
                  type="text"
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') doExport(); }}
                  placeholder="예: GeneratedFace"
                  style={{
                    background: '#2b2b2b', border: '1px solid #555', borderRadius: 3,
                    padding: '6px 10px', color: '#ddd', fontSize: 13, outline: 'none',
                  }}
                />
              </label>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                .png 확장자는 자동으로 추가됩니다
              </div>
            </div>
            <div className="db-dialog-footer">
              <button className="db-btn" onClick={doExport} disabled={!exportName.trim()}>저장</button>
              <button className="db-btn" onClick={() => setExportModal(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
