import { useState, useEffect, useCallback, useRef } from 'react';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import {
  loadGradients,
  getGradientSwatches,
  compositeFaceCharacter,
  compositeTVSVCharacter,
} from '../../utils/generatorRenderer';
import type {
  Gender, OutputType, FacePartManifest, TVSVPartManifest,
  VariationIcon, GradientSwatch, PartSelection, GeneratorStatus,
  FacePattern, TVSVPattern,
} from './types';
import { getRenderOrder, buildColorGroupMap, TVSV_PART_DEFAULT_GRADIENT, OUTPUT_SIZES } from './types';

export function useCharacterGenerator() {
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
          // null defaultGradientRow = 고정색 레이어(_m 없음), 랜덤 적용 안 함
          if (cl.defaultGradientRow == null) continue;
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

  return {
    // state
    gender, setGender,
    outputType, setOutputType,
    activePart, setActivePart,
    activeColorLayerIdx, setActiveColorLayerIdx,
    faceManifest, tvsvManifest,
    selections, swatches,
    genStatus, copying, statusMsg,
    customPath, setCustomPath, pathError,
    exportModal, setExportModal, exportName, setExportName,
    canvasRef, exportInputRef,
    // computed
    currentPartPatterns, currentSelection, currentVariations,
    colorLayerIndices, previewSize, scale, availableParts,
    // handlers
    handleSelectPattern, handleSelectColor, handleRandomize,
    openExportModal, doExport, handleCopyToProject,
    handleClose, handleSetCustomPath,
  };
}
