/**
 * RPG Maker MV 이벤트 커맨드 스키마 레퍼런스.
 * MCP 도구가 이 데이터를 Claude에게 반환하면,
 * Claude가 소스코드를 직접 읽지 않고도 이벤트를 생성할 수 있습니다.
 *
 * 포맷: { code, indent, parameters: [...] }
 * 문자열 계속: code=401 (show text continuation)
 * 브랜치 끝:   code=0 (list terminator — 항상 마지막에 추가)
 */

export const EVENT_COMMAND_REFERENCE = {
  overview: `
RPG Maker MV 이벤트 커맨드는 { code: number, indent: number, parameters: any[] } 형태입니다.
- indent: 조건 분기 안쪽은 1씩 증가 (최상위는 0)
- 모든 list는 반드시 { code: 0, indent: 0, parameters: [] } 로 끝나야 합니다.
- 조건 분기의 else는 code 411, 브랜치 끝은 code 412 입니다.
`,

  commands: {

    // ── 메시지 ─────────────────────────────────────────────────
    showText: {
      code: 101,
      description: '대화 박스 표시. 반드시 401(텍스트 줄) 커맨드를 이어서 작성.',
      parameters: [
        'faceName: string  // 페이스 그래픽 파일명 (없으면 "")',
        'faceIndex: number // 페이스 인덱스 0~7 (없으면 0)',
        'background: number // 0=윈도우, 1=어두운 배경, 2=투명',
        'position: number  // 0=아래, 1=중간, 2=위',
      ],
      followedBy: {
        code: 401,
        description: '대화 텍스트 한 줄. 여러 줄이면 401을 반복.',
        parameters: ['text: string'],
      },
      example: [
        { code: 101, indent: 0, parameters: ['Actor2', 0, 0, 2] },
        { code: 401, indent: 0, parameters: ['안녕하세요!'] },
        { code: 401, indent: 0, parameters: ['잘 부탁드립니다.'] },
      ],
    },

    showChoices: {
      code: 102,
      description: '선택지 표시.',
      parameters: [
        'choices: string[]  // 선택지 텍스트 배열',
        'cancelBranch: number // -2=없음, -1=분기 없음, 0~n=선택지 인덱스',
        'defaultBranch: number // 기본 선택지 인덱스 (0~n)',
        'positionType: number // 0=왼쪽, 1=중간, 2=오른쪽',
        'background: number  // 0=윈도우, 1=어두운배경, 2=투명',
      ],
      followedBy: {
        code: 402,
        description: '각 선택지 분기. choice index 순서대로.',
        parameters: ['choiceIndex: number', 'choiceText: string'],
      },
      example: [
        { code: 102, indent: 0, parameters: [['예', '아니요'], 1, 0, 2, 0] },
        { code: 402, indent: 0, parameters: [0, '예'] },
        { code: 101, indent: 1, parameters: ['', 0, 0, 2] },
        { code: 401, indent: 1, parameters: ['선택하셨군요!'] },
        { code: 402, indent: 0, parameters: [1, '아니요'] },
        { code: 404, indent: 0, parameters: [] },
      ],
    },

    // ── 흐름 제어 ──────────────────────────────────────────────
    conditionalBranch: {
      code: 111,
      description: '조건 분기. else는 code 411, 브랜치 끝은 code 412.',
      parameters_by_type: {
        switch: ['0 (switch)', 'switchId: number', 'value: 0|1 (ON=0, OFF=1)'],
        variable_const: ['1 (variable vs const)', 'varId: number', 'operation: 0-5 (==,>=,<=,>,<,!=)', 'value: number'],
        variable_var: ['1 (variable vs variable)', 'varId: number', 'operation: 0-5', 'compareVarId: number', '1 (compare mode=variable)'],
        selfSwitch: ['2 (self switch)', 'key: "A"|"B"|"C"|"D"', 'value: 0|1'],
        timer: ['3 (timer)', 'seconds: number', 'type: 0=>=, 1=<='],
        actor_inParty: ['4 (actor)', 'actorId: number', '0 (in party)'],
        actor_name: ['4 (actor)', 'actorId: number', '1 (name)', 'name: string'],
        item: ['7 (item)', 'itemId: number'],
        gold: ['10 (gold)', 'amount: number', 'type: 0=>=, 1=<=, 2==='],
        script: ['12 (script)', 'script: string'],
      },
      example: [
        { code: 111, indent: 0, parameters: [0, 1, 0] },
        { code: 101, indent: 1, parameters: ['', 0, 0, 2] },
        { code: 401, indent: 1, parameters: ['스위치 1이 ON입니다.'] },
        { code: 412, indent: 0, parameters: [] },
      ],
    },

    loop: {
      code: 112,
      description: '반복. code 413 로 끝, code 113 (Break Loop) 으로 탈출.',
      example: [
        { code: 112, indent: 0, parameters: [] },
        { code: 230, indent: 1, parameters: [60] },
        { code: 113, indent: 1, parameters: [] },
        { code: 413, indent: 0, parameters: [] },
      ],
    },

    exitEvent: { code: 115, description: '이벤트 처리 종료.', parameters: [] },
    commonEvent: { code: 117, description: '커먼 이벤트 호출.', parameters: ['commonEventId: number'] },
    label: { code: 118, description: '라벨 정의.', parameters: ['labelName: string'] },
    jumpToLabel: { code: 119, description: '라벨로 이동.', parameters: ['labelName: string'] },

    // ── 스위치 / 변수 ──────────────────────────────────────────
    controlSwitches: {
      code: 121,
      description: '스위치 제어.',
      parameters: [
        'startId: number',
        'endId: number  // 단일이면 startId와 같게',
        'value: 0|1  // 0=ON, 1=OFF',
      ],
      example: { code: 121, indent: 0, parameters: [1, 1, 0] },
    },

    controlVariables: {
      code: 122,
      description: '변수 제어.',
      parameters: [
        'startId: number',
        'endId: number',
        'operation: 0=set,1=add,2=sub,3=mul,4=div,5=mod',
        'operandType: 0=constant,1=variable,2=random,3=gameData,4=script',
        'operandA: number  // 상수값, 변수ID, 랜덤min, 등',
        'operandB: number  // 랜덤max (operandType=2일때만)',
      ],
      example: { code: 122, indent: 0, parameters: [1, 1, 0, 0, 42, 0] },
    },

    controlSelfSwitch: {
      code: 123,
      description: '자기 스위치 제어.',
      parameters: ['key: "A"|"B"|"C"|"D"', 'value: 0|1'],
    },

    // ── 파티 ───────────────────────────────────────────────────
    changeGold: {
      code: 125,
      parameters: ['operation: 0=add,1=sub', 'operandType: 0=constant,1=variable', 'amount: number'],
    },
    changeItems: {
      code: 126,
      parameters: ['itemId: number', 'operation: 0=add,1=sub', 'operandType: 0=constant,1=variable', 'amount: number'],
    },
    changePartyMember: {
      code: 129,
      parameters: ['actorId: number', 'operation: 0=add,1=remove', 'initialize: 0|1'],
    },

    // ── 이동 ───────────────────────────────────────────────────
    transferPlayer: {
      code: 201,
      description: '장소 이동.',
      parameters: [
        'mode: 0=direct,1=variable',
        'mapId: number',
        'x: number',
        'y: number',
        'direction: 0=retain,2=down,4=left,6=right,8=up',
        'fadeType: 0=black,1=white,2=none',
      ],
      example: { code: 201, indent: 0, parameters: [0, 1, 5, 5, 0, 0] },
    },

    setEventLocation: {
      code: 203,
      parameters: [
        'characterId: number  // -1=플레이어, 0=this event',
        'mode: 0=direct,1=variable,2=exchange',
        'x: number',
        'y: number',
        'direction: 0=retain,2=down,4=left,6=right,8=up',
      ],
    },

    setMoveRoute: {
      code: 205,
      description: '이동 루트 설정. 205 다음에 code 505 (move command) 반복.',
      parameters: [
        'characterId: number  // -1=플레이어, 0=this',
        'route: { repeat:bool, skippable:bool, wait:bool, list: MoveCommand[] }',
      ],
    },

    // ── 화면 효과 ──────────────────────────────────────────────
    fadeoutScreen: { code: 221, parameters: [] },
    fadeinScreen:  { code: 222, parameters: [] },
    tintScreen:    { code: 223, parameters: ['tone: [r,g,b,gray](-255~255)', 'duration: number', 'wait: bool'] },
    flashScreen:   { code: 224, parameters: ['color: [r,g,b,a](0~255)', 'duration: number', 'wait: bool'] },
    shakeScreen:   { code: 225, parameters: ['power: 1-9', 'speed: 1-9', 'duration: number', 'wait: bool'] },

    // ── 타이밍 ─────────────────────────────────────────────────
    wait: { code: 230, description: '대기 (프레임 단위, 60fps).', parameters: ['frames: number'] },

    // ── 그림 ───────────────────────────────────────────────────
    showPicture: {
      code: 231,
      parameters: [
        'pictureId: number (1-100)',
        'pictureName: string',
        'origin: 0=lefttop,1=center',
        'positionType: 0=direct,1=variable',
        'x: number',
        'y: number',
        'scaleX: number (100=normal)',
        'scaleY: number',
        'opacity: number (0-255)',
        'blendMode: 0=normal,1=add,2=multiply,3=screen',
      ],
    },
    erasePicture: { code: 235, parameters: ['pictureId: number'] },

    // ── 오디오 ─────────────────────────────────────────────────
    playBGM: {
      code: 241,
      parameters: ['{ name: string, volume: number, pitch: number, pan: number }'],
      example: { code: 241, indent: 0, parameters: [{ name: 'Battle1', volume: 90, pitch: 100, pan: 0 }] },
    },
    fadeoutBGM: { code: 242, parameters: ['duration: number (seconds)'] },
    playBGS:    { code: 245, parameters: ['{ name, volume, pitch, pan }'] },
    playME:     { code: 247, parameters: ['{ name, volume, pitch, pan }'] },
    playSE:     { code: 250, parameters: ['{ name, volume, pitch, pan }'] },
    stopSE:     { code: 251, parameters: [] },

    // ── 시스템 ─────────────────────────────────────────────────
    changeMapNameDisplay: { code: 281, parameters: ['show: 0|1'] },
    changeVehicleBGM:     { code: 135, parameters: ['vehicle: 0=boat,1=ship,2=airship', '{ name,volume,pitch,pan }'] },

    // ── 배틀 ───────────────────────────────────────────────────
    battleProcessing: {
      code: 301,
      parameters: ['troopId: number (0=random)', 'canEscape: bool', 'canLose: bool'],
    },

    // ── 스크립트 / 플러그인 ────────────────────────────────────
    script: {
      code: 355,
      description: 'JavaScript 실행.',
      parameters: ['script: string'],
      continuationCode: 655,
    },
    pluginCommand: {
      code: 356,
      description: '플러그인 커맨드.',
      parameters: ['command: string  // 예: "ShowFog on"'],
    },
  },

  eventPageTemplate: {
    description: '이벤트 페이지 기본 템플릿',
    template: {
      conditions: { actorId: 1, actorValid: false, itemId: 1, itemValid: false, selfSwitchCh: 'A', selfSwitchValid: false, switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false, variableId: 1, variableValid: false, variableValue: 0 },
      directionFix: false,
      image: { characterIndex: 0, characterName: '', direction: 2, pattern: 1, tileId: 0 },
      list: [{ code: 0, indent: 0, parameters: [] }],
      moveFrequency: 3,
      moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
      moveSpeed: 3,
      moveType: 0,
      priorityType: 1,
      stepAnime: false,
      through: false,
      trigger: 0,
      walkAnime: true,
    },
    triggerValues: '0=action button, 1=player touch, 2=event touch, 3=autorun, 4=parallel',
    priorityTypes: '0=below player, 1=same as player, 2=above player',
    moveTypes: '0=fixed, 1=random, 2=approach, 3=custom route',
  },
};
