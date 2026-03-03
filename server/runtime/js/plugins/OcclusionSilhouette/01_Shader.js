    //=========================================================================
    // 실루엣 합성 셰이더
    //=========================================================================
    var SilhouetteShader = {
        uniforms: {
            tColor:         { value: null },                          // 원본 렌더 결과
            tCharMask:      { value: null },                          // 캐릭터 마스크
            tObjMask:       { value: null },                          // 오브젝트 마스크
            tCharDepth:     { value: null },                          // 캐릭터 depth texture
            tObjDepth:      { value: null },                          // 오브젝트 depth texture
            uUseDepthTest:  { value: 0 },                             // 1=depth 비교 활성화 (3D)
            uFillColor:     { value: new THREE.Vector3(0.2, 0.4, 1.0) },
            uFillOpacity:   { value: 0.35 },
            uOutlineColor:  { value: new THREE.Vector3(1.0, 1.0, 1.0) },
            uOutlineOpacity:{ value: 0.8 },
            uOutlineWidth:  { value: 2.0 },
            uPattern:       { value: 0 },                             // 패턴 타입 (int)
            uPatternScale:  { value: 8.0 },
            uResolution:    { value: new THREE.Vector2(1, 1) }
        },
        vertexShader: [
            'varying vec2 vUv;',
            'void main() {',
            '    vUv = uv;',
            '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform sampler2D tColor;',
            'uniform sampler2D tCharMask;',
            'uniform sampler2D tObjMask;',
            'uniform sampler2D tCharDepth;',
            'uniform sampler2D tObjDepth;',
            'uniform int uUseDepthTest;',
            'uniform vec3 uFillColor;',
            'uniform float uFillOpacity;',
            'uniform vec3 uOutlineColor;',
            'uniform float uOutlineOpacity;',
            'uniform float uOutlineWidth;',
            'uniform int uPattern;',
            'uniform float uPatternScale;',
            'uniform vec2 uResolution;',
            'varying vec2 vUv;',
            '',
            '// 가려진 영역 판정: 픽셀 겹침 + (3D 모드) 오브젝트가 캐릭터보다 앞에 있는지 depth 비교',
            'float getOccluded(vec2 uv) {',
            '    float charA = texture2D(tCharMask, uv).a;',
            '    float objA = texture2D(tObjMask, uv).a;',
            '    if (charA < 0.01 || objA < 0.01) return 0.0;',
            '    if (uUseDepthTest == 1) {',
            '        // NDC depth: 값이 작을수록 카메라에 가까움',
            '        // 오브젝트 depth <= 캐릭터 depth → 오브젝트가 앞에 있음 → 실루엣',
            '        float charZ = texture2D(tCharDepth, uv).r;',
            '        float objZ  = texture2D(tObjDepth,  uv).r;',
            '        return step(objZ, charZ);',
            '    }',
            '    return 1.0;',
            '}',
            '',
            '// 채움 패턴 함수',
            'float getPattern(vec2 screenPos) {',
            '    float scale = uPatternScale;',
            '    if (uPattern == 0) return 1.0;',           // solid
            '    if (uPattern == 1) return 0.0;',           // empty
            '    if (uPattern == 2) {',                     // dot
            '        vec2 cell = mod(screenPos, vec2(scale));',
            '        float d = length(cell - vec2(scale * 0.5));',
            '        return smoothstep(scale * 0.3, scale * 0.25, d);',
            '    }',
            '    if (uPattern == 3) {',                     // diagonal
            '        float d = mod(screenPos.x + screenPos.y, scale);',
            '        return smoothstep(scale * 0.4, scale * 0.35, d);',
            '    }',
            '    if (uPattern == 4) {',                     // cross
            '        float d1 = mod(screenPos.x + screenPos.y, scale);',
            '        float d2 = mod(screenPos.x - screenPos.y, scale);',
            '        float p1 = smoothstep(scale * 0.4, scale * 0.35, d1);',
            '        float p2 = smoothstep(scale * 0.4, scale * 0.35, d2);',
            '        return max(p1, p2);',
            '    }',
            '    if (uPattern == 5) {',                     // hatch
            '        float dx = mod(screenPos.x, scale);',
            '        float dy = mod(screenPos.y, scale);',
            '        float p1 = smoothstep(scale * 0.4, scale * 0.35, dx);',
            '        float p2 = smoothstep(scale * 0.4, scale * 0.35, dy);',
            '        return max(p1, p2);',
            '    }',
            '    return 1.0;',
            '}',
            '',
            '// 외곽선 검출: 주변 8방향 샘플링',
            'float edgeDetect(vec2 uv) {',
            '    vec2 texelSize = 1.0 / uResolution;',
            '    float width = uOutlineWidth;',
            '    float center = getOccluded(uv);',
            '    float maxN = 0.0;',
            '    for (int dx = -1; dx <= 1; dx++) {',
            '        for (int dy = -1; dy <= 1; dy++) {',
            '            if (dx == 0 && dy == 0) continue;',
            '            vec2 offset = vec2(float(dx), float(dy)) * texelSize * width;',
            '            maxN = max(maxN, getOccluded(uv + offset));',
            '        }',
            '    }',
            '    // 주변에 가려진 영역이 있지만 현재 픽셀은 아닌 경우 = 외곽선',
            '    return maxN * (1.0 - center);',
            '}',
            '',
            'void main() {',
            '    vec4 original = texture2D(tColor, vUv);',
            '    float occluded = getOccluded(vUv);',
            '    float edge = edgeDetect(vUv);',
            '',
            '    // 채움 효과',
            '    vec2 screenPos = vUv * uResolution;',
            '    float pat = getPattern(screenPos);',
            '    float fillMask = occluded * pat * uFillOpacity;',
            '    vec3 col = mix(original.rgb, uFillColor, fillMask);',
            '',
            '    // 외곽선 효과',
            '    col = mix(col, uOutlineColor, edge * uOutlineOpacity);',
            '',
            '    gl_FragColor = vec4(col, original.a);',
            '}'
        ].join('\n')
    };

