/** MCP 서버에서 사용하는 정적 상수 데이터 */

// ── 이벤트 커맨드 레퍼런스 ─────────────────────────────────────────────────────
export const EVENT_CMD_REF = {
  note: 'code, indent, parameters[] 형태. list는 반드시 {code:0,indent:0,parameters:[]}로 끝낼 것.',
  commands: {
    101: '텍스트 표시 시작. params=[faceName,faceIndex,background,position]. 반드시 401로 이어짐.',
    401: '텍스트 한 줄. params=[text]',
    102: '선택지. params=[choices[], cancelBranch, defaultBranch, positionType, background]',
    402: '선택지 분기. params=[index, text]', 404: '선택지 끝',
    111: '조건 분기. params=[type,...] type:0=switch,1=variable,2=selfSwitch,4=actor,7=item,10=gold,12=script',
    411: 'else', 412: '분기 끝',
    112: '반복', 113: '반복 탈출', 413: '반복 끝',
    115: '이벤트 종료', 117: '커먼 이벤트. params=[id]',
    118: '라벨. params=[name]', 119: '라벨 이동. params=[name]',
    121: '스위치 제어. params=[startId,endId,0=ON|1=OFF]',
    122: '변수 제어. params=[startId,endId,operation,operandType,valueA,valueB]',
    123: '자기 스위치. params=["A"|"B"|"C"|"D",0|1]',
    125: '골드. params=[0=add|1=sub, 0=const|1=var, amount]',
    126: '아이템. params=[itemId, 0=add|1=sub, 0=const|1=var, amount]',
    129: '파티. params=[actorId, 0=add|1=remove, 0|1]',
    201: '장소이동. params=[0=direct, mapId, x, y, dir, fadeType]',
    203: '이벤트 위치. params=[charId(-1=player,0=this), 0=direct, x, y, dir]',
    205: '이동 루트. params=[charId, {repeat,skippable,wait,list:[{code,parameters}]}]',
    221: '화면 페이드아웃', 222: '화면 페이드인',
    223: '화면 색조. params=[[r,g,b,gray], duration, wait]',
    225: '화면 진동. params=[power, speed, duration, wait]',
    230: '대기. params=[frames]',
    231: '그림 표시. params=[pictureId, name, origin, posType, x, y, scaleX, scaleY, opacity, blend]',
    235: '그림 소거. params=[pictureId]',
    241: 'BGM 재생. params=[{name,volume,pitch,pan}]',
    250: 'SE 재생. params=[{name,volume,pitch,pan}]',
    355: 'Script. params=[code]. 여러 줄은 655로 이어짐',
    356: '플러그인 커맨드. params=[command string]',
  },
  defaultPage: {
    conditions:{actorId:1,actorValid:false,itemId:1,itemValid:false,selfSwitchCh:'A',selfSwitchValid:false,switch1Id:1,switch1Valid:false,switch2Id:1,switch2Valid:false,variableId:1,variableValid:false,variableValue:0},
    directionFix:false,
    image:{characterIndex:0,characterName:'',direction:2,pattern:1,tileId:0},
    list:[{code:0,indent:0,parameters:[]}],
    moveFrequency:3,moveRoute:{list:[{code:0,parameters:[]}],repeat:true,skippable:false,wait:false},
    moveSpeed:3,moveType:0,priorityType:1,stepAnime:false,through:false,trigger:0,walkAnime:true,
  },
  triggerValues: '0=액션버튼, 1=플레이어접촉, 2=이벤트접촉, 3=자동실행, 4=병렬처리',
  priorityTypes: '0=캐릭터 아래, 1=캐릭터와 같음, 2=캐릭터 위',
};

export function defaultPage() { return JSON.parse(JSON.stringify(EVENT_CMD_REF.defaultPage)); }

// ── ExtendedText 커스텀 텍스트 태그 ────────────────────────────────────────────
export const TEXT_TAGS = {
  note: '메시지 텍스트(401 커맨드)에 사용하는 HTML-like 태그. 닫는 태그 필수(self-close 제외).',
  tags: [
    '<shake amplitude=3 speed=1>텍스트</shake>  — 흔들림 (amplitude: 진폭px, speed: 속도)',
    '<hologram>텍스트</hologram>  — 홀로그램 글리치 효과',
    '<gradient-wave>텍스트</gradient-wave>  — 무지개 그라디언트 물결',
    '<gradient from=#ff0000 to=#0000ff>텍스트</gradient>  — 2색 그라디언트',
    '<fade>텍스트</fade>  — 페이드인 효과',
    '<dissolve>텍스트</dissolve>  — 분해 효과',
    '<blur-fade>텍스트</blur-fade>  — 블러 페이드',
    '<color value=#ffe066>텍스트</color>  — 색상 지정 (hex)',
    '<icon index="117"/>  — 아이콘 표시 (self-close)',
    '<picture src="enemies/Actor1_3" imgtype="pictures"/>  — 인라인 이미지 (self-close)',
  ],
};

// ── MCP 도구 목록 ─────────────────────────────────────────────────────────────
type PropDef = { type: string; description?: string };
const obj = (props: Record<string, PropDef>, required: string[] = []) =>
  ({ type: 'object', properties: props, required });

export const MCP_TOOLS = [
  { name: 'get_project_info', description: '현재 열린 프로젝트 정보', inputSchema: obj({}) },
  { name: 'list_maps', description: '맵 목록', inputSchema: obj({}) },
  { name: 'get_map', description: '맵 데이터 (includeTiles=false로 타일 배열 제외)', inputSchema: obj({ mapId: { type: 'number' }, includeTiles: { type: 'boolean' } }, ['mapId']) },
  { name: 'create_map', description: '새 맵 생성', inputSchema: obj({ name: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' }, tilesetId: { type: 'number' }, parentId: { type: 'number' } }, ['name']) },
  { name: 'list_events', description: '맵 이벤트 목록 (간략)', inputSchema: obj({ mapId: { type: 'number' } }, ['mapId']) },
  { name: 'get_event', description: '이벤트 전체 데이터', inputSchema: obj({ mapId: { type: 'number' }, eventId: { type: 'number' } }, ['mapId', 'eventId']) },
  { name: 'create_event', description: '이벤트 생성. 커맨드 형식은 get_event_command_reference 참고', inputSchema: obj({ mapId: { type: 'number' }, x: { type: 'number' }, y: { type: 'number' }, name: { type: 'string' }, note: { type: 'string' }, pages: { type: 'array' } }, ['mapId', 'x', 'y']) },
  { name: 'update_event', description: '이벤트 수정 (부분 업데이트)', inputSchema: obj({ mapId: { type: 'number' }, eventId: { type: 'number' }, name: { type: 'string' }, note: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, pages: { type: 'array' } }, ['mapId', 'eventId']) },
  { name: 'search_events', description: '이벤트 검색 (name/switchId/variableId)', inputSchema: obj({ name: { type: 'string' }, switchId: { type: 'number' }, variableId: { type: 'number' } }) },
  { name: 'get_database', description: 'DB 조회. type: actors/classes/skills/items/weapons/armors/enemies/troops/states/tilesets/commonEvents/system', inputSchema: obj({ type: { type: 'string' } }, ['type']) },
  { name: 'get_database_entry', description: 'DB 단일 항목 조회', inputSchema: obj({ type: { type: 'string' }, id: { type: 'number' } }, ['type', 'id']) },
  { name: 'update_database_entry', description: 'DB 항목 부분 업데이트. fields에 변경할 필드만 전달', inputSchema: obj({ type: { type: 'string' }, id: { type: 'number' }, fields: { type: 'object' } }, ['type', 'id', 'fields']) },
  { name: 'get_event_command_reference', description: '★ 이벤트 커맨드 형식 레퍼런스. 이벤트 생성 전 먼저 호출하세요.', inputSchema: obj({}) },
  { name: 'list_plugin_commands', description: '활성 플러그인의 커맨드 요약 목록 + 커스텀 텍스트 태그. 토큰 절약을 위해 간략 버전만 반환. 상세 정보는 get_plugin_detail 사용.', inputSchema: obj({}) },
  { name: 'get_plugin_detail', description: '특정 플러그인의 상세 문서 (@help 전문 + 모든 @command/@arg). list_plugin_commands로 목록 확인 후 필요한 플러그인만 조회.', inputSchema: obj({ name: { type: 'string', description: '플러그인 파일명 (확장자 제외, 예: VisualNovelMode)' } }, ['name']) },
  { name: 'list_resources', description: '프로젝트 리소스 파일 목록. [이미지] characters(캐릭터), faces(얼굴), tilesets(타일셋), pictures(그림), sv_actors(사이드뷰 액터), titles1/titles2(타이틀), parallaxes(원경), battlebacks1/battlebacks2(전투배경), enemies(적 이미지), animations(애니메이션), system(시스템), sv_enemies(사이드뷰 적). [오디오] bgm(배경음악), bgs(배경환경음), me(음악이펙트), se(효과음). [영상] movies. 반환값 name이 이벤트 audio.name/image.characterName 등에 사용하는 값.', inputSchema: obj({ type: { type: 'string', description: 'characters/faces/tilesets/bgm/bgs/me/se/movies 등' } }, ['type']) },
];
