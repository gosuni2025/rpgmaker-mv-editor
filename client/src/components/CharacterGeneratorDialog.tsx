import React, { useState, useEffect, useCallback, useRef } from 'react';
import useEditorStore from '../store/useEditorStore';
import apiClient from '../api/client';
import {
  loadGradients,
  getGradientSwatches,
  compositeFaceCharacter,
  compositeTVSVCharacter,
  FACE_RENDER_ORDER,
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

// 부품별 선택 상태
interface PartSelection {
  patternId: string | null; // null = 없음
  colorRows: Record<number, number>; // colorLayerIndex -> gradientRow
}

const GENDER_LABELS: Record<Gender, string> = { Male: '남성', Female: '여성', Kid: '아이' };
const OUTPUT_LABELS: Record<OutputType, string> = { Face: '얼굴', TV: '걷기', SV: '전투' };
const OUTPUT_SIZES: Record<OutputType, { w: number; h: number }> = {
  Face: { w: 144, h: 144 },
  TV: { w: 144, h: 192 },
  SV: { w: 576, h: 384 },
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewTimerRef = useRef<number>(0);

  // gradients 로드 (한번만)
  useEffect(() => {
    loadGradients('/api/generator/gradients').then((gd) => {
      setGradients(gd);
      setSwatches(getGradientSwatches(gd));
    }).catch(console.error);
  }, []);

  // 성별/출력타입 변경 시 매니페스트 로드
  useEffect(() => {
    loadManifest();
  }, [gender, outputType]);

  const loadManifest = async () => {
    try {
      if (outputType === 'Face') {
        const manifest = await apiClient.get<FacePartManifest>(`/generator/parts/${gender}/Face`);
        setFaceManifest(manifest);
        setTvsvManifest({});
        initSelections(manifest, 'Face');
      } else {
        const manifest = await apiClient.get<TVSVPartManifest>(`/generator/parts/${gender}/${outputType}`);
        setTvsvManifest(manifest);
        setFaceManifest({});
        initSelections(manifest, outputType);
      }
    } catch (e) {
      console.error('Failed to load manifest:', e);
    }
  };

  const initSelections = (manifest: FacePartManifest | TVSVPartManifest, type: OutputType) => {
    const sel: Record<string, PartSelection> = {};
    for (const partName of FACE_RENDER_ORDER) {
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
          colorRows[cl.index] = cl.defaultGradientRow;
        }
      }
      // Body와 Face는 기본 선택
      const shouldSelect = partName === 'Body' || partName === 'Face' ||
                           partName === 'Eyes' || partName === 'Ears' ||
                           partName === 'Eyebrows' || partName === 'Nose' || partName === 'Mouth';
      sel[partName] = {
        patternId: shouldSelect ? firstPattern.id : null,
        colorRows,
      };
    }
    setSelections(sel);
  };

  // 부품별 Variation 아이콘 로드
  useEffect(() => {
    if (!activePart) return;
    const key = `${gender}/${activePart}`;
    if (variations[key]) return;
    apiClient.get<VariationIcon[]>(`/generator/variation/${gender}/${activePart}`)
      .then((icons) => {
        setVariations((prev) => ({ ...prev, [key]: icons }));
      })
      .catch(() => {
        setVariations((prev) => ({ ...prev, [key]: [] }));
      });
  }, [gender, activePart]);

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
      if (outputType === 'Face') {
        const parts = FACE_RENDER_ORDER
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
        const parts = FACE_RENDER_ORDER
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
        result = await compositeTVSVCharacter(parts, gradients, size.w, size.h);
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
      // Face 모드에서 패턴 변경 시 기본 color row 설정
      if (patternId && outputType === 'Face') {
        const partData = faceManifest[activePart];
        const pattern = partData?.patterns.find((p) => p.id === patternId);
        if (pattern) {
          for (const cl of pattern.colorLayers) {
            if (!(cl.index in colorRows)) {
              colorRows[cl.index] = cl.defaultGradientRow;
            }
          }
        }
      }
      return { ...prev, [activePart]: { patternId, colorRows } };
    });
  };

  const handleSelectColor = (row: number) => {
    setSelections((prev) => {
      const current = prev[activePart] || { patternId: null, colorRows: {} };
      return {
        ...prev,
        [activePart]: {
          ...current,
          colorRows: { ...current.colorRows, [activeColorLayerIdx]: row },
        },
      };
    });
  };

  const handleRandomize = useCallback(() => {
    const manifest = outputType === 'Face' ? faceManifest : tvsvManifest;
    const sel: Record<string, PartSelection> = {};
    for (const partName of FACE_RENDER_ORDER) {
      const partData = manifest[partName];
      if (!partData || partData.patterns.length === 0) {
        sel[partName] = { patternId: null, colorRows: {} };
        continue;
      }
      // 필수 부품은 항상 선택, 나머지는 50% 확률
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
          colorRows[cl.index] = Math.floor(Math.random() * 70) + 1;
        }
      } else {
        colorRows[1] = Math.floor(Math.random() * 70) + 1;
      }
      sel[partName] = { patternId: randomPattern.id, colorRows };
    }
    setSelections(sel);
  }, [outputType, faceManifest, tvsvManifest]);

  const handleExport = async (exportType: 'faces' | 'characters' | 'sv_actors') => {
    if (!canvasRef.current) return;
    // 해당 타입으로 렌더링
    let targetOutput: OutputType;
    let targetSize: { w: number; h: number };
    if (exportType === 'faces') {
      targetOutput = 'Face';
      targetSize = OUTPUT_SIZES.Face;
    } else if (exportType === 'characters') {
      targetOutput = 'TV';
      targetSize = OUTPUT_SIZES.TV;
    } else {
      targetOutput = 'SV';
      targetSize = OUTPUT_SIZES.SV;
    }

    const canvas = canvasRef.current;
    const data = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    const name = prompt('파일 이름을 입력하세요:');
    if (!name) return;
    try {
      await apiClient.post('/generator/export', {
        type: exportType,
        name: name.endsWith('.png') ? name : name + '.png',
        data,
      });
      alert('내보내기 완료!');
    } catch (e) {
      alert('내보내기 실패: ' + e);
    }
  };

  const handleClose = () => setShowCharacterGeneratorDialog(false);

  // 현재 부품의 패턴 목록
  const manifest = outputType === 'Face' ? faceManifest : tvsvManifest;
  const currentPartPatterns = manifest[activePart]?.patterns ?? [];
  const currentSelection = selections[activePart] || { patternId: null, colorRows: {} };
  const variationKey = `${gender}/${activePart}`;
  const currentVariations = variations[variationKey] ?? [];

  // Face 모드에서 현재 패턴의 색상 레이어 목록
  const currentFacePattern = outputType === 'Face'
    ? (faceManifest[activePart]?.patterns.find((p) => p.id === currentSelection.patternId) as FacePattern | undefined)
    : undefined;
  const colorLayerIndices = currentFacePattern
    ? currentFacePattern.colorLayers.map((cl) => cl.index)
    : [];

  // 프리뷰 캔버스 크기
  const previewSize = OUTPUT_SIZES[outputType];
  const scale = outputType === 'SV' ? 0.5 : 1.5;

  // 어떤 파트가 활성화되어 있는지 (선택된 패턴이 있는지)
  const availableParts = FACE_RENDER_ORDER.filter((pn) => manifest[pn]?.patterns?.length > 0);

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
              {/* 없음 옵션 */}
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

            {/* 색상 팔레트 */}
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
          </div>
        </div>

        <div className="db-dialog-footer">
          <button className="db-btn" onClick={handleRandomize}>랜덤</button>
          <button className="db-btn" onClick={() => handleExport('faces')}>얼굴 내보내기</button>
          <button className="db-btn" onClick={() => handleExport('characters')}>걷기 캐릭터 내보내기</button>
          <button className="db-btn" onClick={() => handleExport('sv_actors')}>전투 캐릭터 내보내기</button>
          <button className="db-btn" onClick={handleClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
