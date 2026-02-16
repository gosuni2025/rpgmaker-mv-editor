// ─── 셰이더 정의 ───
export interface ShaderParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  type?: 'slider' | 'select';
  options?: { value: number; label: string }[];
}

export interface ShaderDef {
  type: string;
  label: string;
  params: ShaderParamDef[];
}

export const SHADER_DEFINITIONS: ShaderDef[] = [
  { type: 'wave', label: '물결', params: [
    { key: 'amplitude', label: '진폭', min: 0, max: 100, step: 1, defaultValue: 10 },
    { key: 'frequency', label: '빈도', min: 0.1, max: 50, step: 0.1, defaultValue: 5 },
    { key: 'speed', label: '속도', min: 0.1, max: 20, step: 0.1, defaultValue: 2 },
    { key: 'direction', label: '방향', min: 0, max: 2, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '수평' }, { value: 1, label: '수직' }, { value: 2, label: '양방향' }
    ]},
  ]},
  { type: 'glitch', label: '글리치', params: [
    { key: 'intensity', label: '강도', min: 0, max: 3, step: 0.01, defaultValue: 0.3 },
    { key: 'rgbShift', label: 'RGB 쉬프트', min: 0, max: 100, step: 1, defaultValue: 5 },
    { key: 'lineSpeed', label: '라인 속도', min: 0.1, max: 20, step: 0.1, defaultValue: 3 },
    { key: 'blockSize', label: '블록 크기', min: 1, max: 100, step: 1, defaultValue: 8 },
  ]},
  { type: 'fade', label: '페이드', params: [
    { key: 'threshold', label: '투명도', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'wipe', label: '와이프', params: [
    { key: 'threshold', label: '진행도', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'direction', label: '방향', min: 0, max: 3, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '좌→우' }, { value: 1, label: '우→좌' }, { value: 2, label: '상→하' }, { value: 3, label: '하→상' }
    ]},
    { key: 'softness', label: '부드러움', min: 0, max: 0.3, step: 0.01, defaultValue: 0.05 },
  ]},
  { type: 'circleWipe', label: '원형 와이프', params: [
    { key: 'threshold', label: '진행도', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'softness', label: '부드러움', min: 0, max: 0.3, step: 0.01, defaultValue: 0.05 },
    { key: 'centerX', label: '중심 X', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'centerY', label: '중심 Y', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
  ]},
  { type: 'blinds', label: '블라인드', params: [
    { key: 'threshold', label: '진행도', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'count', label: '줄 수', min: 2, max: 30, step: 1, defaultValue: 8 },
    { key: 'direction', label: '방향', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '수평' }, { value: 1, label: '수직' }
    ]},
  ]},
  { type: 'pixelDissolve', label: '픽셀 디졸브', params: [
    { key: 'threshold', label: '진행도', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'pixelSize', label: '픽셀 크기', min: 4, max: 128, step: 4, defaultValue: 32 },
  ]},
  { type: 'dissolve', label: '디졸브', params: [
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'animSpeed', label: '애니 속도', min: 0, max: 20, step: 0.1, defaultValue: 1 },
    { key: 'thresholdMin', label: '임계값 최소', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'thresholdMax', label: '임계값 최대', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'threshold', label: '임계값 (고정)', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'edgeWidth', label: '경계 넓이', min: 0, max: 0.5, step: 0.01, defaultValue: 0.05 },
    { key: 'edgeColorR', label: '경계색 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'edgeColorG', label: '경계색 G', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'edgeColorB', label: '경계색 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'noiseScale', label: '노이즈 크기', min: 1, max: 100, step: 1, defaultValue: 10 },
  ]},
  { type: 'glow', label: '발광', params: [
    { key: 'intensity', label: '강도', min: 0, max: 10, step: 0.1, defaultValue: 1 },
    { key: 'radius', label: '반경', min: 0, max: 50, step: 1, defaultValue: 4 },
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 20, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
  ]},
  { type: 'chromatic', label: '색수차', params: [
    { key: 'offset', label: '오프셋', min: 0, max: 50, step: 1, defaultValue: 3 },
    { key: 'angle', label: '각도', min: 0, max: 360, step: 1, defaultValue: 0 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
  ]},
  { type: 'pixelate', label: '픽셀화', params: [
    { key: 'size', label: '크기 (고정)', min: 1, max: 128, step: 1, defaultValue: 8 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 20, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'minSize', label: '최소 크기', min: 1, max: 128, step: 1, defaultValue: 2 },
    { key: 'maxSize', label: '최대 크기', min: 1, max: 128, step: 1, defaultValue: 16 },
  ]},
  { type: 'shake', label: '흔들림', params: [
    { key: 'power', label: '파워', min: 0, max: 100, step: 1, defaultValue: 5 },
    { key: 'speed', label: '속도', min: 0.1, max: 50, step: 0.1, defaultValue: 10 },
    { key: 'direction', label: '방향', min: 0, max: 2, step: 1, defaultValue: 2, type: 'select', options: [
      { value: 0, label: '수평' }, { value: 1, label: '수직' }, { value: 2, label: '양방향' }
    ]},
  ]},
  { type: 'blur', label: '흐림', params: [
    { key: 'strength', label: '강도 (고정)', min: 0, max: 50, step: 1, defaultValue: 4 },
    { key: 'pulseSpeed', label: '펄스 속도', min: 0, max: 20, step: 0.1, defaultValue: 2 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'minStrength', label: '최소 강도', min: 0, max: 50, step: 1, defaultValue: 0 },
    { key: 'maxStrength', label: '최대 강도', min: 0, max: 50, step: 1, defaultValue: 8 },
  ]},
  { type: 'rainbow', label: '무지개', params: [
    { key: 'speed', label: '속도', min: 0.1, max: 20, step: 0.1, defaultValue: 1 },
    { key: 'saturation', label: '채도', min: 0, max: 5, step: 0.01, defaultValue: 0.5 },
    { key: 'brightness', label: '밝기', min: 0, max: 5, step: 0.01, defaultValue: 0.1 },
  ]},
  { type: 'hologram', label: '홀로그램', params: [
    { key: 'scanlineSpacing', label: '스캔라인 간격', min: 1, max: 50, step: 1, defaultValue: 4 },
    { key: 'scanlineAlpha', label: '스캔라인 투명도', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'flickerSpeed', label: '깜빡임 속도', min: 0, max: 50, step: 1, defaultValue: 5 },
    { key: 'flickerIntensity', label: '깜빡임 강도', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { key: 'rgbShift', label: 'RGB 쉬프트', min: 0, max: 50, step: 1, defaultValue: 2 },
    { key: 'tintR', label: '틴트 R', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'tintG', label: '틴트 G', min: 0, max: 1, step: 0.01, defaultValue: 0.8 },
    { key: 'tintB', label: '틴트 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'outline', label: '외곽선', params: [
    { key: 'thickness', label: '두께', min: 1, max: 20, step: 1, defaultValue: 3 },
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { key: 'intensity', label: '강도', min: 0, max: 10, step: 0.1, defaultValue: 1.5 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'animSpeed', label: '애니 속도', min: 0, max: 20, step: 0.1, defaultValue: 2 },
    { key: 'animMin', label: '애니 최소', min: 0, max: 10, step: 0.1, defaultValue: 0.8 },
    { key: 'animMax', label: '애니 최대', min: 0, max: 10, step: 0.1, defaultValue: 2.0 },
  ]},
  { type: 'fireAura', label: '불꽃 오라', params: [
    { key: 'radius', label: '반경', min: 1, max: 50, step: 1, defaultValue: 12 },
    { key: 'intensity', label: '강도', min: 0, max: 10, step: 0.1, defaultValue: 1.2 },
    { key: 'speed', label: '불꽃 속도', min: 0.1, max: 10, step: 0.1, defaultValue: 1.5 },
    { key: 'noiseScale', label: '노이즈 크기', min: 1, max: 100, step: 1, defaultValue: 8 },
    { key: 'innerColorR', label: '안쪽 색 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'innerColorG', label: '안쪽 색 G', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
    { key: 'innerColorB', label: '안쪽 색 B', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'outerColorR', label: '바깥 색 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'outerColorG', label: '바깥 색 G', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'outerColorB', label: '바깥 색 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'turbulence', label: '난류', min: 0, max: 10, step: 0.1, defaultValue: 1.5 },
    { key: 'flameHeight', label: '불꽃 높이', min: 0, max: 10, step: 0.1, defaultValue: 1.0 },
    { key: 'animMode', label: '애니 모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '왕복' }, { value: 1, label: '원웨이' }, { value: 2, label: '애니없음' }
    ]},
    { key: 'animSpeed', label: '애니 속도', min: 0, max: 20, step: 0.1, defaultValue: 1 },
  ]},
  // ── 새 셰이더 (AllIn1SpriteShader 기반) ──
  { type: 'greyscale', label: '그레이스케일', params: [
    { key: 'luminosity', label: '밝기 보정', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'tintR', label: '틴트 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'tintG', label: '틴트 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'tintB', label: '틴트 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'negative', label: '네거티브', params: [
    { key: 'amount', label: '적용량', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'hitEffect', label: '히트 플래시', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'glow', label: '발광 강도', min: 1, max: 200, step: 1, defaultValue: 5 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'shine', label: '광택', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'location', label: '위치', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'rotate', label: '회전 (라디안)', min: 0, max: 6.28, step: 0.01, defaultValue: 0 },
    { key: 'width', label: '너비', min: 0.05, max: 1, step: 0.01, defaultValue: 0.1 },
    { key: 'glowAmount', label: '발광', min: 0, max: 200, step: 1, defaultValue: 1 },
    { key: 'speed', label: '애니 속도', min: 0, max: 20, step: 0.1, defaultValue: 1 },
  ]},
  { type: 'flicker', label: '깜빡임', params: [
    { key: 'percent', label: '깜빡임 비율', min: 0, max: 1, step: 0.01, defaultValue: 0.05 },
    { key: 'freq', label: '빈도', min: 0, max: 10, step: 0.01, defaultValue: 0.2 },
    { key: 'alpha', label: '최소 알파', min: 0, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'gradient', label: '그래디언트', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftR', label: '좌상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftG', label: '좌상 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftB', label: '좌상 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftA', label: '좌상 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topRightR', label: '우상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topRightG', label: '우상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topRightB', label: '우상 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topRightA', label: '우상 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftR', label: '좌하 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftG', label: '좌하 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftB', label: '좌하 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftA', label: '좌하 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botRightR', label: '우하 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botRightG', label: '우하 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botRightB', label: '우하 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botRightA', label: '우하 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'boostX', label: 'X축 부스트', min: 0.1, max: 10, step: 0.1, defaultValue: 1.2 },
    { key: 'boostY', label: 'Y축 부스트', min: 0.1, max: 10, step: 0.1, defaultValue: 1.2 },
    { key: 'radial', label: '방사형', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '선형' }, { value: 1, label: '방사형' }
    ]},
  ]},
  { type: 'gradient2col', label: '2색 그래디언트', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftR', label: '상단 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftG', label: '상단 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftB', label: '상단 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftA', label: '상단 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftR', label: '하단 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftG', label: '하단 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftB', label: '하단 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftA', label: '하단 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'boostY', label: 'Y축 부스트', min: 0.1, max: 10, step: 0.1, defaultValue: 1.2 },
  ]},
  { type: 'radialGradient', label: '방사형 그래디언트', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftR', label: '중심 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'topLeftG', label: '중심 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftB', label: '중심 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'topLeftA', label: '중심 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftR', label: '외곽 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftG', label: '외곽 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'botLeftB', label: '외곽 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'botLeftA', label: '외곽 A', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'boostX', label: '부스트', min: 0.1, max: 10, step: 0.1, defaultValue: 1.2 },
  ]},
  { type: 'colorSwap', label: '색상 스왑', params: [
    { key: 'redNewR', label: 'R→새R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'redNewG', label: 'R→새G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'redNewB', label: 'R→새B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'greenNewR', label: 'G→새R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'greenNewG', label: 'G→새G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'greenNewB', label: 'G→새B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueNewR', label: 'B→새R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueNewG', label: 'B→새G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueNewB', label: 'B→새B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'redLum', label: 'R 밝기', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'greenLum', label: 'G 밝기', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blueLum', label: 'B 밝기', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'hsv', label: 'HSV 시프트', params: [
    { key: 'hsvShift', label: '색조 시프트', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'hsvSaturation', label: '채도', min: -5, max: 5, step: 0.01, defaultValue: 0 },
    { key: 'hsvBright', label: '밝기', min: -5, max: 5, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'contrast', label: '명도/대비', params: [
    { key: 'contrast', label: '대비', min: 0, max: 10, step: 0.01, defaultValue: 1 },
    { key: 'brightness', label: '밝기', min: -3, max: 3, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'motionBlur', label: '모션 블러', params: [
    { key: 'angle', label: '각도', min: -3, max: 3, step: 0.01, defaultValue: 0.1 },
    { key: 'dist', label: '거리', min: -10, max: 10, step: 0.01, defaultValue: 1.25 },
  ]},
  { type: 'ghost', label: '고스트', params: [
    { key: 'colorBoost', label: '색상 부스트', min: 0, max: 10, step: 0.1, defaultValue: 1 },
    { key: 'transparency', label: '투명도', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'shadow', label: '드롭 섀도우', params: [
    { key: 'shadowX', label: 'X 오프셋', min: -0.5, max: 0.5, step: 0.01, defaultValue: 0.1 },
    { key: 'shadowY', label: 'Y 오프셋', min: -0.5, max: 0.5, step: 0.01, defaultValue: -0.05 },
    { key: 'shadowAlpha', label: '그림자 알파', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'shadowColorR', label: '그림자 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'shadowColorG', label: '그림자 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'shadowColorB', label: '그림자 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'doodle', label: '손그림', params: [
    { key: 'amount', label: '양', min: 0, max: 50, step: 1, defaultValue: 10 },
    { key: 'speed', label: '속도', min: 1, max: 30, step: 1, defaultValue: 5 },
  ]},
  { type: 'warp', label: '워프', params: [
    { key: 'strength', label: '강도', min: 0, max: 0.5, step: 0.001, defaultValue: 0.025 },
    { key: 'speed', label: '속도', min: 0, max: 50, step: 0.5, defaultValue: 8 },
    { key: 'scale', label: '스케일', min: 0.05, max: 10, step: 0.05, defaultValue: 0.5 },
  ]},
  { type: 'twist', label: '트위스트', params: [
    { key: 'amount', label: '회전량', min: 0, max: 10, step: 0.01, defaultValue: 1 },
    { key: 'posX', label: '중심 X', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'posY', label: '중심 Y', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'radius', label: '반경', min: 0, max: 5, step: 0.01, defaultValue: 0.75 },
    { key: 'speed', label: '애니 속도', min: 0, max: 20, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'roundWave', label: '원형 파동', params: [
    { key: 'strength', label: '강도', min: 0, max: 3, step: 0.01, defaultValue: 0.7 },
    { key: 'speed', label: '속도', min: 0, max: 10, step: 0.1, defaultValue: 2 },
  ]},
  { type: 'fisheye', label: '어안 렌즈', params: [
    { key: 'amount', label: '왜곡량', min: 0, max: 2, step: 0.01, defaultValue: 0.35 },
    { key: 'speed', label: '애니 속도', min: 0, max: 20, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'pinch', label: '핀치', params: [
    { key: 'amount', label: '왜곡량', min: 0, max: 2, step: 0.01, defaultValue: 0.35 },
    { key: 'speed', label: '애니 속도', min: 0, max: 20, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'overlay', label: '오버레이', params: [
    { key: 'overlayColorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'overlayColorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'overlayColorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'overlayGlow', label: '발광', min: 0, max: 50, step: 0.1, defaultValue: 1 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'multiply', label: '모드', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '가산' }, { value: 1, label: '곱하기' }
    ]},
  ]},
  { type: 'wind', label: '바람', params: [
    { key: 'speed', label: '속도', min: 0, max: 20, step: 0.1, defaultValue: 2 },
    { key: 'wind', label: '바람 세기', min: 0, max: 50, step: 0.5, defaultValue: 5 },
  ]},
  { type: 'textureScroll', label: '텍스처 스크롤', params: [
    { key: 'speedX', label: 'X 속도', min: -10, max: 10, step: 0.01, defaultValue: 0.25 },
    { key: 'speedY', label: 'Y 속도', min: -10, max: 10, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'zoomUV', label: 'UV 줌', params: [
    { key: 'zoom', label: '줌', min: 0.1, max: 10, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'rotateUV', label: 'UV 회전', params: [
    { key: 'angle', label: '각도 (라디안)', min: 0, max: 6.28, step: 0.01, defaultValue: 0 },
    { key: 'speed', label: '회전 속도', min: 0, max: 10, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'polarUV', label: '극좌표 변환', params: [
    { key: 'speed', label: '회전 속도', min: 0, max: 10, step: 0.1, defaultValue: 0 },
  ]},
  { type: 'offsetUV', label: 'UV 오프셋', params: [
    { key: 'offsetX', label: 'X 오프셋', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'offsetY', label: 'Y 오프셋', min: -1, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'clipping', label: '사각형 클리핑', params: [
    { key: 'left', label: '왼쪽', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'right', label: '오른쪽', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'up', label: '위', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'down', label: '아래', min: 0, max: 1, step: 0.01, defaultValue: 0 },
  ]},
  { type: 'radialClipping', label: '방사형 클리핑', params: [
    { key: 'startAngle', label: '시작 각도', min: 0, max: 360, step: 1, defaultValue: 0 },
    { key: 'clip', label: '클리핑', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'innerOutline', label: '내부 아웃라인', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'width', label: '두께', min: 1, max: 20, step: 1, defaultValue: 2 },
    { key: 'alpha', label: '알파', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'onlyOutline', label: '아웃라인만', min: 0, max: 1, step: 1, defaultValue: 0, type: 'select', options: [
      { value: 0, label: '아니오' }, { value: 1, label: '예' }
    ]},
  ]},
  { type: 'alphaOutline', label: '알파 아웃라인', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'glow', label: '발광', min: 0, max: 50, step: 0.1, defaultValue: 1 },
    { key: 'power', label: '파워', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'minAlpha', label: '최소 알파', min: 0, max: 1, step: 0.01, defaultValue: 0.1 },
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
  ]},
  { type: 'distort', label: '왜곡', params: [
    { key: 'amount', label: '왜곡량', min: 0, max: 10, step: 0.01, defaultValue: 0.5 },
    { key: 'speedX', label: 'X 속도', min: -10, max: 10, step: 0.1, defaultValue: 0.5 },
    { key: 'speedY', label: 'Y 속도', min: -10, max: 10, step: 0.1, defaultValue: 0.3 },
    { key: 'scale', label: '스케일', min: 1, max: 50, step: 1, defaultValue: 5 },
  ]},
  { type: 'colorRamp', label: '컬러 램프', params: [
    { key: 'blend', label: '블렌드', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'luminosity', label: '밝기 보정', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'colorDarkR', label: '어두운 R', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'colorDarkG', label: '어두운 G', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    { key: 'colorDarkB', label: '어두운 B', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    { key: 'colorMidR', label: '중간 R', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'colorMidG', label: '중간 G', min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
    { key: 'colorMidB', label: '중간 B', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
    { key: 'colorLightR', label: '밝은 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorLightG', label: '밝은 G', min: 0, max: 1, step: 0.01, defaultValue: 0.9 },
    { key: 'colorLightB', label: '밝은 B', min: 0, max: 1, step: 0.01, defaultValue: 0.7 },
  ]},
  { type: 'onlyOutline', label: '외곽선만', params: [
    { key: 'colorR', label: '색상 R', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorG', label: '색상 G', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'colorB', label: '색상 B', min: 0, max: 1, step: 0.01, defaultValue: 1 },
    { key: 'thickness', label: '두께', min: 1, max: 20, step: 1, defaultValue: 2 },
    { key: 'glow', label: '발광', min: 0, max: 10, step: 0.1, defaultValue: 1 },
  ]},
  { type: 'shakeUV', label: 'UV 떨림', params: [
    { key: 'speed', label: '속도', min: 0, max: 30, step: 0.5, defaultValue: 5 },
    { key: 'shakeX', label: 'X 떨림', min: 0, max: 50, step: 0.5, defaultValue: 5 },
    { key: 'shakeY', label: 'Y 떨림', min: 0, max: 50, step: 0.5, defaultValue: 5 },
  ]},
];
