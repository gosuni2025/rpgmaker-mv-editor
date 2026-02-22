/**
 * MCP write 작업 통합 테스트
 * create_event, update_event, update_database_entry 검증
 * 실행 전: npm run dev (에디터 + MCP 서버 기동 상태)
 */

const MCP_PORT = parseInt(process.env.MCP_PORT || '3002');
const MCP_URL = `http://localhost:${MCP_PORT}`;
const TEST_MAP_ID = 1;

let postUrl = null;
let msgId = 1;
const pending = new Map();

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    pending.set(id, { resolve, reject });
    fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    }).catch(reject);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout: ${method}`));
      }
    }, 10000);
  });
}

/** Node.js fetch stream으로 SSE 연결 */
async function connect() {
  const res = await fetch(`${MCP_URL}/sse`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`SSE ${res.status}`);

  const decoder = new TextDecoder();
  let eventName = '';
  let buf = '';

  const reader = res.body.getReader();

  function pump() {
    reader.read().then(({ done, value }) => {
      if (done) return;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop(); // 미완성 줄 보존

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (eventName === 'endpoint') {
            postUrl = `${MCP_URL}${data}`;
          } else if (eventName === 'message') {
            try {
              const msg = JSON.parse(data);
              const h = pending.get(msg.id);
              if (h) {
                pending.delete(msg.id);
                if (msg.error) h.reject(new Error(msg.error.message));
                else h.resolve(msg.result);
              }
            } catch {}
          }
          eventName = '';
        }
      }
      pump();
    }).catch(() => {});
  }
  pump();

  // endpoint 이벤트가 올 때까지 대기
  await new Promise((resolve, reject) => {
    const check = setInterval(() => {
      if (postUrl) { clearInterval(check); resolve(); }
    }, 50);
    setTimeout(() => { clearInterval(check); reject(new Error('endpoint 수신 타임아웃')); }, 5000);
  });
}

// ── 테스트 ─────────────────────────────────────────────────────────────────

async function testCreateEvent() {
  console.log('\n[create_event]');
  const result = await call('tools/call', {
    name: 'create_event',
    arguments: {
      mapId: TEST_MAP_ID,
      x: 99, y: 99,
      name: '__test_event__',
      note: 'MCP write test',
      pages: [{
        conditions: { actorId:1,actorValid:false,itemId:1,itemValid:false,selfSwitchCh:'A',selfSwitchValid:false,switch1Id:1,switch1Valid:false,switch2Id:1,switch2Valid:false,variableId:1,variableValid:false,variableValue:0 },
        directionFix: false,
        image: { characterIndex:0, characterName:'', direction:2, pattern:1, tileId:0 },
        list: [
          { code: 101, indent: 0, parameters: ['', 0, 0, 2] },
          { code: 401, indent: 0, parameters: ['MCP 테스트 메시지'] },
          { code: 0, indent: 0, parameters: [] },
        ],
        moveFrequency:3, moveRoute:{ list:[{code:0,parameters:[]}], repeat:true, skippable:false, wait:false },
        moveSpeed:3, moveType:0, priorityType:1, stepAnime:false, through:false, trigger:0, walkAnime:true,
      }],
    },
  });
  const data = JSON.parse(result?.content?.[0]?.text);
  assert('success=true', data.success === true, JSON.stringify(data));
  assert('eventId 반환됨', typeof data.eventId === 'number');
  assert('event.name 일치', data.event?.name === '__test_event__');
  assert('event.x=99', data.event?.x === 99);
  assert('event.y=99', data.event?.y === 99);
  assert('커맨드 3개', data.event?.pages?.[0]?.list?.length === 3);
  return data.eventId;
}

async function testUpdateEvent(eventId) {
  console.log('\n[update_event - 위치/이름/노트]');
  const result = await call('tools/call', {
    name: 'update_event',
    arguments: {
      mapId: TEST_MAP_ID,
      eventId,
      name: '__test_event_updated__',
      note: 'updated',
      x: 98, y: 98,
    },
  });
  const data = JSON.parse(result?.content?.[0]?.text);
  assert('success=true', data.success === true);
  assert('이름 수정됨', data.event?.name === '__test_event_updated__');
  assert('x=98', data.event?.x === 98);
  assert('y=98', data.event?.y === 98);
  assert('note 수정됨', data.event?.note === 'updated');
}

async function testUpdateEventPages(eventId) {
  console.log('\n[update_event - pages 교체]');
  const result = await call('tools/call', {
    name: 'update_event',
    arguments: {
      mapId: TEST_MAP_ID,
      eventId,
      pages: [{
        conditions: { actorId:1,actorValid:false,itemId:1,itemValid:false,selfSwitchCh:'A',selfSwitchValid:false,switch1Id:1,switch1Valid:false,switch2Id:1,switch2Valid:false,variableId:1,variableValid:false,variableValue:0 },
        directionFix: false,
        image: { characterIndex:0, characterName:'', direction:2, pattern:1, tileId:0 },
        list: [
          { code: 101, indent: 0, parameters: ['', 0, 0, 2] },
          { code: 401, indent: 0, parameters: ['업데이트된 메시지'] },
          { code: 401, indent: 0, parameters: ['두 번째 줄'] },
          { code: 0, indent: 0, parameters: [] },
        ],
        moveFrequency:3, moveRoute:{ list:[{code:0,parameters:[]}], repeat:true, skippable:false, wait:false },
        moveSpeed:3, moveType:0, priorityType:1, stepAnime:false, through:false, trigger:0, walkAnime:true,
      }],
    },
  });
  const data = JSON.parse(result?.content?.[0]?.text);
  assert('커맨드 4개', data.event?.pages?.[0]?.list?.length === 4);
  assert('커맨드 텍스트 확인', data.event?.pages?.[0]?.list?.[1]?.parameters?.[0] === '업데이트된 메시지');
}

async function testGetUpdatedEvent(eventId) {
  console.log('\n[get_event - 저장 확인]');
  const result = await call('tools/call', {
    name: 'get_event',
    arguments: { mapId: TEST_MAP_ID, eventId },
  });
  const data = JSON.parse(result?.content?.[0]?.text);
  assert('저장된 이름 확인', data?.name === '__test_event_updated__');
  assert('저장된 커맨드 수 확인', data?.pages?.[0]?.list?.length === 4);
  console.log(`  → 테스트 이벤트 ID ${eventId} 맵${TEST_MAP_ID}에 남아있음 (수동 삭제 필요)`);
}

async function testUpdateDatabaseActor() {
  console.log('\n[update_database_entry - actors[1]]');
  const before = await call('tools/call', {
    name: 'get_database_entry',
    arguments: { type: 'actors', id: 1 },
  });
  const orig = JSON.parse(before?.content?.[0]?.text);
  assert('actors[1] 읽기', typeof orig?.name === 'string');
  const origName = orig.name;

  const updated = await call('tools/call', {
    name: 'update_database_entry',
    arguments: { type: 'actors', id: 1, fields: { name: '__mcp_test__' } },
  });
  const upd = JSON.parse(updated?.content?.[0]?.text);
  assert('이름 수정됨', upd?.name === '__mcp_test__');

  // 복원
  const restored = await call('tools/call', {
    name: 'update_database_entry',
    arguments: { type: 'actors', id: 1, fields: { name: origName } },
  });
  const res = JSON.parse(restored?.content?.[0]?.text);
  assert(`이름 복원됨 ("${origName}")`, res?.name === origName);
}

async function testUpdateDatabaseMultipleFields() {
  console.log('\n[update_database_entry - 여러 필드 동시 수정]');
  const before = await call('tools/call', {
    name: 'get_database_entry',
    arguments: { type: 'actors', id: 1 },
  });
  const orig = JSON.parse(before?.content?.[0]?.text);

  const result = await call('tools/call', {
    name: 'update_database_entry',
    arguments: {
      type: 'actors', id: 1,
      fields: { name: '__multi__', initialLevel: 5, maxLevel: 99 },
    },
  });
  const data = JSON.parse(result?.content?.[0]?.text);
  assert('name 수정', data?.name === '__multi__');
  assert('initialLevel=5', data?.initialLevel === 5);
  assert('maxLevel=99', data?.maxLevel === 99);

  // 복원
  await call('tools/call', {
    name: 'update_database_entry',
    arguments: {
      type: 'actors', id: 1,
      fields: { name: orig.name, initialLevel: orig.initialLevel, maxLevel: orig.maxLevel },
    },
  });
  assert('복원 호출 성공', true);
}

// ── 실행 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`MCP write 테스트 (${MCP_URL})`);

  try {
    await connect();
    console.log('✓ SSE 연결됨, postUrl:', postUrl);
    await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'write-test', version: '1' } });
    await call('notifications/initialized');
    console.log('✓ MCP 초기화 완료');
  } catch (err) {
    console.error('연결 실패:', err.message);
    process.exit(1);
  }

  let createdId = null;
  try { createdId = await testCreateEvent(); } catch (e) { console.error('  ✗', e.message); failed++; }

  if (createdId != null) {
    try { await testUpdateEvent(createdId); } catch (e) { console.error('  ✗', e.message); failed++; }
    try { await testUpdateEventPages(createdId); } catch (e) { console.error('  ✗', e.message); failed++; }
    try { await testGetUpdatedEvent(createdId); } catch (e) { console.error('  ✗', e.message); failed++; }
  }

  try { await testUpdateDatabaseActor(); } catch (e) { console.error('  ✗', e.message); failed++; }
  try { await testUpdateDatabaseMultipleFields(); } catch (e) { console.error('  ✗', e.message); failed++; }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`결과: ${passed} passed / ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
