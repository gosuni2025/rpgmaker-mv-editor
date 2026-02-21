<<<<<<< HEAD
import type { EventCommand, MoveRoute } from '../../types/rpgMakerMV';
import { matchAddonCommand } from './addonCommands';
=======
import type { EventCommand } from '../../types/rpgMakerMV';
import { FORMATTERS } from './commandFormatters';
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

export interface CommandDisplayContext {
  t: (key: string) => string;
  systemData: any;
  maps: any;
  currentMap: any;
}

<<<<<<< HEAD
function formatSwitchId(id: number) {
  return `#${String(id).padStart(4, '0')}`;
}

function formatConditionalBranch(params: unknown[], ctx: CommandDisplayContext): string {
  const condType = params[0] as number;
  const fmtId = (id: number) => String(id).padStart(4, '0');
  const compOps = ['=', '\u2265', '\u2264', '>', '<', '\u2260'];
  switch (condType) {
    case 0: { // 스위치
      const id = params[1] as number;
      const name = ctx.systemData?.switches?.[id];
      return `스위치 ${fmtId(id)}${name ? ' ' + name : ''} == ${(params[2] as number) === 0 ? 'ON' : 'OFF'}`;
    }
    case 1: { // 변수
      const id = params[1] as number;
      const name = ctx.systemData?.variables?.[id];
      const op = compOps[params[4] as number] || '=';
      const operandType = params[2] as number;
      let operand: string;
      if (operandType === 0) {
        operand = String(params[3] as number);
      } else {
        const vid = params[3] as number;
        const vname = ctx.systemData?.variables?.[vid];
        operand = `변수 ${fmtId(vid)}${vname ? ' ' + vname : ''}`;
      }
      return `변수 ${fmtId(id)}${name ? ' ' + name : ''} ${op} ${operand}`;
    }
    case 2: // 셀프 스위치
      return `셀프 스위치 ${params[1]} == ${(params[2] as number) === 0 ? 'ON' : 'OFF'}`;
    case 3: { // 타이머
      const sec = params[1] as number;
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      return `타이머 ${(params[2] as number) === 0 ? '\u2265' : '\u2264'} ${min}분 ${s}초`;
    }
    case 4: { // 액터
      const subType = params[2] as number;
      const subLabels = ['파티에 있다', '이름이', '직업이', '스킬을', '무기를', '방어구를', '스테이트가'];
      const label = subLabels[subType] || '';
      const param = subType === 0 ? '' : ` ${params[3]}`;
      return `액터 ${fmtId(params[1] as number)} ${label}${param}`;
    }
    case 5: { // 적
      const sub = params[2] as number;
      return sub === 0
        ? `적 #${(params[1] as number) + 1} 나타남`
        : `적 #${(params[1] as number) + 1} 스탯 ${fmtId(params[3] as number)}`;
    }
    case 6: { // 캐릭터
      const dirs: Record<number, string> = { 2: '아래', 4: '왼쪽', 6: '오른쪽', 8: '위' };
      const charLabel = (params[1] as number) === -1 ? '플레이어' : (params[1] as number) === 0 ? '이 이벤트' : `이벤트 ${params[1]}`;
      return `${charLabel} 마주하고 있음 ${dirs[params[2] as number] || params[2]}`;
    }
    case 7: { // 소지금
      const goldOps = ['\u2265', '\u2264', '<'];
      return `소지금 ${goldOps[params[2] as number] || '\u2265'} ${params[1]}`;
    }
    case 8: return `아이템 ${fmtId(params[1] as number)} 소지`;
    case 9: return `무기 ${fmtId(params[1] as number)} 소지${params[2] ? ' (장비 포함)' : ''}`;
    case 10: return `방어구 ${fmtId(params[1] as number)} 소지${params[2] ? ' (장비 포함)' : ''}`;
    case 11: return `버튼 [${params[1]}] 눌려있다`;
    case 12: return `스크립트: ${params[1]}`;
    case 13: {
      const vehicles = ['보트', '선박', '비행선'];
      return `${vehicles[params[1] as number] || '차량'} 운행되었습니다`;
    }
    default: return JSON.stringify(params);
  }
}

export function getCommandDisplay(cmd: EventCommand, ctx: CommandDisplayContext): string {
  const code = cmd.code;
  if (code === 0) return '';
=======
export function getCommandDisplay(cmd: EventCommand, ctx: CommandDisplayContext): string {
  const code = cmd.code;
  if (code === 0) return '';

>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  const displayKey = `eventCommands.display.${code}`;
  const desc = ctx.t(displayKey);
  let text = desc !== displayKey ? desc : `@${code}`;

<<<<<<< HEAD
  // 조건 분기 전용 포맷
  if (code === 111 && cmd.parameters && cmd.parameters.length >= 2) {
    return text + ': ' + formatConditionalBranch(cmd.parameters, ctx);
  }
  if (code === 411) return ctx.t('eventCommands.display.411');
  if (code === 412) return ctx.t('eventCommands.display.412');

  // 장소 이동 전용 포맷
  if (code === 201 && cmd.parameters && cmd.parameters.length >= 4) {
    const designationType = cmd.parameters[0] as number;
    const dirLabels: Record<number, string> = { 0: '유지', 2: '아래', 4: '왼쪽', 6: '오른쪽', 8: '위' };
    const fadeLabels: Record<number, string> = { 0: '검게', 1: '희게', 2: '없음' };
    const dir = dirLabels[cmd.parameters[4] as number] || '유지';
    const fade = fadeLabels[cmd.parameters[5] as number] || '검게';
    if (designationType === 0) {
      const mId = cmd.parameters[1] as number;
      const mx = cmd.parameters[2] as number;
      const my = cmd.parameters[3] as number;
      const mapName = ctx.maps?.[mId]?.name || '';
      text += `: ${mapName}(${mId},[${mx},${my}]), 방향:${dir}, 페이드:${fade}`;
    } else {
      const mVar = cmd.parameters[1] as number;
      const xVar = cmd.parameters[2] as number;
      const yVar = cmd.parameters[3] as number;
      text += `: {맵:V[${mVar}],X:V[${xVar}],Y:V[${yVar}]}, 방향:${dir}, 페이드:${fade}`;
    }
    return text;
  }

  // 탈 것 위치 설정 전용 포맷
  if (code === 202 && cmd.parameters && cmd.parameters.length >= 5) {
    const vehicleNames = ['보트', '선박', '비행선'];
    const vehicle = vehicleNames[cmd.parameters[0] as number] || '보트';
    const designationType = cmd.parameters[1] as number;
    if (designationType === 0) {
      const mId = cmd.parameters[2] as number;
      const mx = cmd.parameters[3] as number;
      const my = cmd.parameters[4] as number;
      const mapName = ctx.maps?.[mId]?.name || '';
      text += `: ${vehicle}, ${mapName}(${mId},[${mx},${my}])`;
    } else {
      const mVar = cmd.parameters[2] as number;
      const xVar = cmd.parameters[3] as number;
      const yVar = cmd.parameters[4] as number;
      text += `: ${vehicle}, {맵:V[${mVar}],X:V[${xVar}],Y:V[${yVar}]}`;
    }
    return text;
  }

  // 이벤트 위치 설정 전용 포맷
  if (code === 203 && cmd.parameters && cmd.parameters.length >= 5) {
    const eventIdParam = cmd.parameters[0] as number;
    const designationType = cmd.parameters[1] as number;
    const dirLabels: Record<number, string> = { 0: '유지', 2: '아래', 4: '왼쪽', 6: '오른쪽', 8: '위' };
    const dir = dirLabels[cmd.parameters[4] as number] || '유지';
    let eventName = '해당 이벤트';
    if (eventIdParam === -1) eventName = '플레이어';
    else if (eventIdParam > 0) {
      const ev = ctx.currentMap?.events?.find((e: any) => e && e.id === eventIdParam);
      eventName = ev ? `${String(eventIdParam).padStart(3, '0')}:${(ev as any).name || ''}` : `이벤트 ${eventIdParam}`;
    }
    if (designationType === 0) {
      const px = cmd.parameters[2] as number;
      const py = cmd.parameters[3] as number;
      text += `: ${eventName}, (${px},${py}), 방향:${dir}`;
    } else if (designationType === 1) {
      const xVar = cmd.parameters[2] as number;
      const yVar = cmd.parameters[3] as number;
      text += `: ${eventName}, {X:V[${xVar}],Y:V[${yVar}]}, 방향:${dir}`;
    } else {
      const exchId = cmd.parameters[2] as number;
      let exchName = '해당 이벤트';
      if (exchId === -1) exchName = '플레이어';
      else if (exchId > 0) {
        const ev = ctx.currentMap?.events?.find((e: any) => e && e.id === exchId);
        exchName = ev ? `${String(exchId).padStart(3, '0')}:${(ev as any).name || ''}` : `이벤트 ${exchId}`;
      }
      text += `: ${eventName}, 교환:${exchName}, 방향:${dir}`;
    }
    return text;
  }

  // 이동 루트 설정 전용 포맷
  if (code === 205 && cmd.parameters && cmd.parameters.length >= 2) {
    const charIdParam = cmd.parameters[0] as number;
    const route = cmd.parameters[1] as MoveRoute;
    let charName = ctx.t('moveRoute.thisEvent');
    if (charIdParam === -1) charName = ctx.t('moveRoute.player');
    else if (charIdParam > 0) {
      const ev = ctx.currentMap?.events?.find((e: any) => e && e.id === charIdParam);
      charName = ev ? `${String(charIdParam).padStart(3, '0')}:${(ev as any).name || ''}` : `이벤트 ${charIdParam}`;
    }
    text += `: ${charName}`;
    if (route?.repeat) text += ` [${ctx.t('moveRoute.repeat')}]`;
    if (route?.skippable) text += ` [${ctx.t('moveRoute.skippable')}]`;
    if (route?.wait) text += ` [${ctx.t('moveRoute.wait')}]`;
    return text;
  }

  // 애니메이션 표시 전용 포맷
  if (code === 212 && cmd.parameters && cmd.parameters.length >= 2) {
    const charIdParam = cmd.parameters[0] as number;
    const animId = cmd.parameters[1] as number;
    const wait = cmd.parameters[2] as boolean;
    let charName = '해당 이벤트';
    if (charIdParam === -1) charName = '플레이어';
    else if (charIdParam > 0) {
      const ev = ctx.currentMap?.events?.find((e: any) => e && e.id === charIdParam);
      charName = ev ? `EV${String(charIdParam).padStart(3, '0')}` : `EV${String(charIdParam).padStart(3, '0')}`;
    }
    text += `: ${charName}, ${String(animId).padStart(4, '0')}`;
    if (wait) text += ' (대기)';
    return text;
  }

  // 말풍선 아이콘 표시 전용 포맷
  if (code === 213 && cmd.parameters && cmd.parameters.length >= 2) {
    const charIdParam = cmd.parameters[0] as number;
    const balloonId = cmd.parameters[1] as number;
    const wait = cmd.parameters[2] as boolean;
    const balloonNames: Record<number, string> = {
      1: '느낌표', 2: '물음표', 3: '음표', 4: '하트', 5: '분노',
      6: '땀', 7: '뒤죽박죽', 8: '침묵', 9: '전구', 10: 'Zzz',
      11: '사용자 정의 1', 12: '사용자 정의 2', 13: '사용자 정의 3', 14: '사용자 정의 4', 15: '사용자 정의 5',
    };
    let charName = '해당 이벤트';
    if (charIdParam === -1) charName = '플레이어';
    else if (charIdParam > 0) {
      const ev = ctx.currentMap?.events?.find((e: any) => e && e.id === charIdParam);
      charName = ev ? `EV${String(charIdParam).padStart(3, '0')}` : `EV${String(charIdParam).padStart(3, '0')}`;
    }
    text += `: ${charName}, ${balloonNames[balloonId] || `말풍선 ${balloonId}`}`;
    if (wait) text += ' (대기)';
    return text;
  }

  // 스위치 조작 전용 포맷
  if (code === 121 && cmd.parameters && cmd.parameters.length >= 3) {
    const startId = cmd.parameters[0] as number;
    const endId = cmd.parameters[1] as number;
    const op = cmd.parameters[2] as number === 0 ? 'ON' : 'OFF';
    if (startId === endId) {
      const name = ctx.systemData?.switches?.[startId];
      text += `: ${formatSwitchId(startId)}${name ? ' ' + name : ''} = ${op}`;
    } else {
      text += `: ${formatSwitchId(startId)}..${formatSwitchId(endId)} = ${op}`;
    }
    return text;
  }

  // 투명 상태 변경 전용 포맷
  if (code === 211 && cmd.parameters && cmd.parameters.length >= 1) {
    text += `: ${cmd.parameters[0] === 0 ? 'ON' : 'OFF'}`;
    return text;
  }

  // 저장/메뉴/조우/진형 금지 변경 포맷
  if ((code >= 134 && code <= 137) && cmd.parameters && cmd.parameters.length >= 1) {
    text += `: ${cmd.parameters[0] === 0 ? '불가' : '가능'}`;
    return text;
  }

  // 대열 보행 변경 포맷
  if (code === 216 && cmd.parameters && cmd.parameters.length >= 1) {
    text += `: ${cmd.parameters[0] === 0 ? 'ON' : 'OFF'}`;
    return text;
  }

  // 지도명 표시 변경 포맷
  if (code === 281 && cmd.parameters && cmd.parameters.length >= 1) {
    text += `: ${cmd.parameters[0] === 0 ? 'ON' : 'OFF'}`;
    return text;
  }

  // 전투 배경 변경 포맷
  if (code === 283 && cmd.parameters && cmd.parameters.length >= 2) {
    const bb1 = cmd.parameters[0] as string;
    const bb2 = cmd.parameters[1] as string;
    if (bb1 || bb2) {
      text += `: ${bb1 || '(없음)'} & ${bb2 || '(없음)'}`;
    }
    return text;
  }

  // 지정 위치의 정보 획득 포맷 (code 285)
  // params: [variableId, infoType, designationType, x, y]
  if (code === 285 && cmd.parameters && cmd.parameters.length >= 5) {
    const variableId = cmd.parameters[0] as number;
    const infoType = cmd.parameters[1] as number;
    const designationType = cmd.parameters[2] as number;
    const px = cmd.parameters[3] as number;
    const py = cmd.parameters[4] as number;
    const infoNames = ['지형 태그', '이벤트 ID', '타일 ID(레이어1)', '타일 ID(레이어2)', '타일 ID(레이어3)', '타일 ID(레이어4)', '지역 ID'];
    const varLabel = `#${String(variableId).padStart(4, '0')}`;
    const infoLabel = infoNames[infoType] || '?';
    let locLabel: string;
    if (designationType === 0) {
      locLabel = `(${px},${py})`;
    } else {
      locLabel = `(#${String(px).padStart(4, '0')}, #${String(py).padStart(4, '0')})`;
    }
    text += `: ${varLabel}, ${infoLabel}, ${locLabel}`;
    return text;
  }

  // 먼 배경 변경 포맷
  if (code === 284 && cmd.parameters && cmd.parameters.length >= 1) {
    const parallaxName = cmd.parameters[0] as string;
    if (parallaxName) {
      text += `: ${parallaxName}`;
    }
    return text;
  }

  // 그림 표시 전용 포맷
  if (code === 231 && cmd.parameters && cmd.parameters.length >= 10) {
    const num = cmd.parameters[0] as number;
    const img = cmd.parameters[1] as string;
    const originLabels: Record<number, string> = { 0: '왼쪽 위', 1: '중앙' };
    const blendLabels: Record<number, string> = { 0: '일반', 1: '추가 합성', 2: '곱하기', 3: '스크린' };
    const posType = cmd.parameters[3] as number;
    const px = cmd.parameters[4] as number;
    const py = cmd.parameters[5] as number;
    let posStr: string;
    if (posType === 2) {
      const preset = cmd.parameters[11] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
      if (preset) {
        const oxStr = preset.offsetX ? (preset.offsetX > 0 ? `+${preset.offsetX}` : `${preset.offsetX}`) : '';
        const oyStr = preset.offsetY ? (preset.offsetY > 0 ? `+${preset.offsetY}` : `${preset.offsetY}`) : '';
        const pctX = (preset.presetX - 1) * 25;
        const pctY = (preset.presetY - 1) * 25;
        posStr = `(${pctX}%${oxStr}, ${pctY}%${oyStr})`;
      } else {
        posStr = '(50%, 50%)';
      }
    } else {
      posStr = posType === 0 ? `(${px},${py})` : `(V[${px}],V[${py}])`;
    }
    text += `: #${num}, ${img || '(없음)'}, ${originLabels[cmd.parameters[2] as number] || ''}, ${posStr}`;
    const sw = cmd.parameters[6] as number;
    const sh = cmd.parameters[7] as number;
    if (sw !== 100 || sh !== 100) text += `, ${sw}%x${sh}%`;
    const op = cmd.parameters[8] as number;
    if (op !== 255) text += `, 불투명도:${op}`;
    const bm = cmd.parameters[9] as number;
    if (bm !== 0) text += `, ${blendLabels[bm] || ''}`;
    // 셰이더 이펙트 표시
    const shaderLabels: Record<string, string> = {
      wave: '물결', glitch: '글리치', dissolve: '디졸브', glow: '발광',
      chromatic: '색수차', pixelate: '픽셀화', shake: '흔들림', blur: '흐림',
      rainbow: '무지개', hologram: '홀로그램', outline: '외곽선', fireAura: '불꽃 오라',
      fade: '페이드', wipe: '와이프', circleWipe: '원형 와이프', blinds: '블라인드', pixelDissolve: '픽셀 디졸브',
    };
    const shaderRaw = cmd.parameters[10];
    if (shaderRaw) {
      if (Array.isArray(shaderRaw)) {
        const names = (shaderRaw as { type: string; enabled: boolean }[])
          .filter(s => s.enabled)
          .map(s => shaderLabels[s.type] || s.type);
        if (names.length > 0) text += `, [${names.join('+')}]`;
      } else {
        const single = shaderRaw as { type: string; enabled: boolean };
        if (single.enabled) text += `, [${shaderLabels[single.type] || single.type}]`;
      }
    }
    // 셰이더로 나타나기 표시
    const transitionRaw = cmd.parameters[12] as { shaderList: { type: string }[]; applyMode: string; duration: number } | null;
    if (transitionRaw && transitionRaw.shaderList?.length > 0) {
      const tNames = transitionRaw.shaderList.map(s => shaderLabels[s.type] || s.type);
      const durStr = transitionRaw.applyMode === 'interpolate' && transitionRaw.duration > 0
        ? ` ${transitionRaw.duration}초` : '';
      text += `, 나타나기:[${tNames.join('+')}${durStr}]`;
    }
    return text;
  }

  // 그림 이동 전용 포맷
  if (code === 232 && cmd.parameters && cmd.parameters.length >= 12) {
    const num = cmd.parameters[0] as number;
    const originLabels: Record<number, string> = { 0: '왼쪽 위', 1: '중앙' };
    const blendLabels: Record<number, string> = { 0: '일반', 1: '추가 합성', 2: '곱하기', 3: '스크린' };
    const posType = cmd.parameters[3] as number;
    const px = cmd.parameters[4] as number;
    const py = cmd.parameters[5] as number;
    let posStr: string;
    if (posType === 2) {
      const presetLabels: Record<number, string> = { 1: '0%', 2: '25%', 3: '50%', 4: '75%', 5: '100%' };
      const preset = cmd.parameters[12] as { presetX: number; presetY: number; offsetX: number; offsetY: number } | null;
      if (preset) {
        const pxl = presetLabels[preset.presetX] ?? '?';
        const pyl = presetLabels[preset.presetY] ?? '?';
        const ox = preset.offsetX !== 0 ? `${preset.offsetX > 0 ? '+' : ''}${preset.offsetX}` : '';
        const oy = preset.offsetY !== 0 ? `${preset.offsetY > 0 ? '+' : ''}${preset.offsetY}` : '';
        posStr = `(${pxl}${ox}, ${pyl}${oy})`;
      } else {
        posStr = '(프리셋)';
      }
    } else {
      posStr = posType === 0 ? `(${px},${py})` : `(V[${px}],V[${py}])`;
    }
    text += `: #${num}, ${originLabels[cmd.parameters[2] as number] || ''}, ${posStr}`;
    const sw = cmd.parameters[6] as number;
    const sh = cmd.parameters[7] as number;
    if (sw !== 100 || sh !== 100) text += `, ${sw}%x${sh}%`;
    const op = cmd.parameters[8] as number;
    if (op !== 255) text += `, 불투명도:${op}`;
    const bm = cmd.parameters[9] as number;
    if (bm !== 0) text += `, ${blendLabels[bm] || ''}`;
    const moveMode = cmd.parameters[13] as string | undefined;
    if (moveMode === 'instant') {
      text += `, 즉시`;
    } else {
      const dur = cmd.parameters[10] as number;
      text += `, ${dur}프레임`;
      if (cmd.parameters[11]) text += `, 완료까지 대기`;
    }
    // 셰이더 트랜지션 표시
    const shaderLabelsMap: Record<string, string> = {
      dissolve: '디졸브', fade: '페이드', wipe: '와이프', circleWipe: '원형 와이프',
      blinds: '블라인드', pixelDissolve: '픽셀 디졸브',
    };
    const transitionRaw = cmd.parameters[14] as { shaderList: { type: string }[]; applyMode: string; duration: number } | null;
    if (transitionRaw && transitionRaw.shaderList?.length > 0) {
      const tNames = transitionRaw.shaderList.map(s => shaderLabelsMap[s.type] || s.type);
      const durStr = transitionRaw.applyMode === 'interpolate' && transitionRaw.duration > 0
        ? ` ${transitionRaw.duration}초` : '';
      text += `, 트랜지션:[${tNames.join('+')}${durStr}]`;
    }
    return text;
  }

  // 그림 회전 전용 포맷
  if (code === 233 && cmd.parameters && cmd.parameters.length >= 2) {
    const num = cmd.parameters[0] as number;
    const speed = cmd.parameters[1] as number;
    text += `: #${num}, 속도 ${speed}`;
    return text;
  }

  // 화면 흔들리기
  if (code === 225 && cmd.parameters && cmd.parameters.length >= 4) {
    const power = cmd.parameters[0] as number;
    const speed = cmd.parameters[1] as number;
    const dur = cmd.parameters[2] as number;
    text += `: 강도 ${power}, 속도 ${speed}, ${dur}프레임`;
    if (cmd.parameters[3]) text += `, 완료까지 대기`;
    return text;
  }

  // 화면의 색조 변경
  if (code === 223 && cmd.parameters && cmd.parameters.length >= 3) {
    const tone = cmd.parameters[0] as number[];
    const dur = cmd.parameters[1] as number;
    text += `: (${tone[0]},${tone[1]},${tone[2]},${tone[3]}), ${dur}프레임`;
    if (cmd.parameters[2]) text += `, 완료까지 대기`;
    return text;
  }

  // 그림의 색조 변경
  if (code === 234 && cmd.parameters && cmd.parameters.length >= 4) {
    const num = cmd.parameters[0] as number;
    const tone = cmd.parameters[1] as number[];
    const dur = cmd.parameters[2] as number;
    text += `: #${num}, (${tone[0]},${tone[1]},${tone[2]},${tone[3]}), ${dur}프레임`;
    if (cmd.parameters[3]) text += `, 완료까지 대기`;
    return text;
  }

  // 날씨 효과 설정
  if (code === 236 && cmd.parameters && cmd.parameters.length >= 4) {
    const weatherNameMap: Record<string, string> = { none: '없음', rain: '비', storm: '폭풍', snow: '눈' };
    const type = cmd.parameters[0] as string;
    const power = cmd.parameters[1] as number;
    const dur = cmd.parameters[2] as number;
    text += `: ${weatherNameMap[type] || type}, 강도 ${power}, ${dur}프레임`;
    if (cmd.parameters[3]) text += `, 완료까지 대기`;
    return text;
  }

  // 전투 처리 전용 포맷
  if (code === 301 && cmd.parameters && cmd.parameters.length >= 2) {
    const designationType = cmd.parameters[0] as number;
    if (designationType === 0) {
      const troopId = cmd.parameters[1] as number;
      text += `: ${String(troopId).padStart(4, '0')}`;
    } else if (designationType === 1) {
      const varId = cmd.parameters[1] as number;
      const varName = ctx.systemData?.variables?.[varId];
      text += `: #${String(varId).padStart(4, '0')}${varName ? ' ' + varName : ''}`;
    } else {
      text += `: 랜덤 대결과 동일`;
    }
    if (cmd.parameters[2]) text += `, 도망 가능`;
    if (cmd.parameters[3]) text += `, 패배 가능`;
    return text;
  }

  // 상점의 처리 전용 포맷
  if (code === 302 && cmd.parameters && cmd.parameters.length >= 2) {
    const typeLabels = ['아이템', '무기', '방어구'];
    const itemType = cmd.parameters[0] as number;
    const itemId = cmd.parameters[1] as number;
    const priceType = cmd.parameters[2] as number;
    const price = cmd.parameters[3] as number;
    text += `: [${typeLabels[itemType] || '?'}] ${String(itemId).padStart(4, '0')}`;
    if (priceType === 1) text += ` (${price}G)`;
    if (cmd.parameters[4]) text += ` [구매 한정]`;
    return text;
  }

  // 상점 상품 행 (code 605)
  if (code === 605 && cmd.parameters && cmd.parameters.length >= 2) {
    const typeLabels = ['아이템', '무기', '방어구'];
    const itemType = cmd.parameters[0] as number;
    const itemId = cmd.parameters[1] as number;
    const priceType = cmd.parameters[2] as number;
    const price = cmd.parameters[3] as number;
    text = `       : [${typeLabels[itemType] || '?'}] ${String(itemId).padStart(4, '0')}`;
    if (priceType === 1) text += ` (${price}G)`;
    return text;
  }

  // 그림 제거
  if (code === 235 && cmd.parameters && cmd.parameters.length >= 1) {
    text += `: #${cmd.parameters[0]}`;
    const eraseMode = cmd.parameters[1] as string | undefined;
    if (eraseMode === 'instant') {
      text += `, 즉시`;
    }
    // 셰이더 트랜지션 표시
    const shaderLabelsMap: Record<string, string> = {
      dissolve: '디졸브', fade: '페이드', wipe: '와이프', circleWipe: '원형 와이프',
      blinds: '블라인드', pixelDissolve: '픽셀 디졸브',
    };
    const transitionRaw = cmd.parameters[2] as { shaderList: { type: string }[]; applyMode: string; duration: number } | null;
    if (transitionRaw && transitionRaw.shaderList?.length > 0) {
      const tNames = transitionRaw.shaderList.map(s => shaderLabelsMap[s.type] || s.type);
      const durStr = transitionRaw.applyMode === 'interpolate' && transitionRaw.duration > 0
        ? ` ${transitionRaw.duration}초` : '';
      text += `, 트랜지션:[${tNames.join('+')}${durStr}]`;
    }
    return text;
  }

  // 탈 것 BGM 변경 (code 140): params[0]=vehicle, params[1]=audio
  if (code === 140 && cmd.parameters && cmd.parameters.length >= 2) {
    const vehicleNames = ['보트', '선박', '비행선'];
    const vehicle = cmd.parameters[0] as number;
    const audio = cmd.parameters[1] as { name: string; volume: number; pitch: number; pan: number } | null;
    text += `: ${vehicleNames[vehicle] || '?'}`;
    if (audio && audio.name) {
      text += `, ${audio.name} (${audio.volume}, ${audio.pitch}, ${audio.pan})`;
    } else {
      text += `, (없음)`;
    }
    return text;
  }

  // 액터 이미지 변경 (code 322): params=[actorId, charName, charIdx, faceName, faceIdx, battlerName]
  if (code === 322 && cmd.parameters && cmd.parameters.length >= 6) {
    const actorId = cmd.parameters[0] as number;
    const charName = cmd.parameters[1] as string;
    const faceName = cmd.parameters[3] as string;
    const battlerName = cmd.parameters[5] as string;
    text += `: ${String(actorId).padStart(4, '0')}`;
    const imgs: string[] = [];
    if (faceName) imgs.push(`얼굴:${faceName}`);
    if (charName) imgs.push(`캐릭터:${charName}`);
    if (battlerName) imgs.push(`SV:${battlerName}`);
    if (imgs.length > 0) text += `, ${imgs.join(', ')}`;
    return text;
  }

  // 탈 것 이미지 변경 (code 323): params=[vehicleType, imageName, imageIndex]
  if (code === 323 && cmd.parameters && cmd.parameters.length >= 3) {
    const vehicleNames = ['보트', '선박', '비행선'];
    const vehicle = cmd.parameters[0] as number;
    const imgName = cmd.parameters[1] as string;
    text += `: ${vehicleNames[vehicle] || '?'}`;
    if (imgName) {
      text += `, ${imgName}[${cmd.parameters[2]}]`;
    } else {
      text += `, (없음)`;
    }
    return text;
  }

  // 창 색깔 변경 (code 138): params=[[R,G,B]]
  if (code === 138 && cmd.parameters && cmd.parameters.length >= 1) {
    const tone = cmd.parameters[0] as number[];
    if (tone) {
      text += `: (${tone[0]}, ${tone[1]}, ${tone[2]})`;
    }
    return text;
  }

  // 타일셋 변경 (code 282): params=[tilesetId]
  if (code === 282 && cmd.parameters && cmd.parameters.length >= 1) {
    const tilesetId = cmd.parameters[0] as number;
    text += `: ${String(tilesetId).padStart(4, '0')}`;
    return text;
  }

  // 오디오 관련 커맨드 (BGM/BGS/ME/SE 재생, 전투BGM/승리ME/패배ME 변경)
  if ([132, 133, 139, 241, 245, 249, 250].includes(code) && cmd.parameters && cmd.parameters.length >= 1) {
    const audio = cmd.parameters[0] as { name: string; volume: number; pitch: number; pan: number } | null;
    if (audio && audio.name) {
      text += `: ${audio.name} (${audio.volume}, ${audio.pitch}, ${audio.pan})`;
    } else {
      text += `: (없음)`;
    }
    return text;
  }

  // 플러그인 커맨드 - 애드온 매칭 시 보기 좋은 포맷
  if (code === 356 && cmd.parameters && cmd.parameters.length >= 1) {
    const cmdText = cmd.parameters[0] as string;
    const match = matchAddonCommand(cmdText);
    if (match) {
      const label = ctx.t(match.subCmd.label);
      const durStr = match.duration && parseFloat(match.duration) > 0 ? ` [${match.duration}${ctx.t('addonCommands.seconds_short')}]` : '';

      // MapObject 커맨드: 오브젝트 이름 해석
      if (match.def.pluginCommand === 'MapObject' && match.paramValues.length > 0) {
        const objId = parseInt(match.paramValues[0]);
        const objects = ctx.currentMap?.objects;
        const obj = objects && Array.isArray(objects) ? objects.find((o: any) => o && o.id === objId) : null;
        const objName = obj ? (obj.name || obj.imageName || `#${objId}`) : `#${objId}`;
        const displayName = `#${objId} ${objName}`;
        const restParams = match.paramValues.slice(1);
        const paramStr = restParams.length > 0 ? ` (${restParams.join(', ')})` : '';
        return `${ctx.t(match.def.label)}: ${label} ${displayName}${paramStr}${durStr}`;
      }

      const paramStr = match.paramValues.length > 0 ? ` (${match.paramValues.join(', ')})` : '';
      return `${ctx.t(match.def.label)}: ${label}${paramStr}${durStr}`;
    }
    return text + `: ${cmdText}`;
  }

  if (cmd.parameters && cmd.parameters.length > 0) {
    const params = cmd.parameters.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(', ');
    if (params.length > 60) {
      text += `: ${params.substring(0, 60)}...`;
    } else {
      text += `: ${params}`;
    }
=======
  if (code === 411) return ctx.t('eventCommands.display.411');
  if (code === 412) return ctx.t('eventCommands.display.412');

  // 등록된 포매터 사용
  const entry = FORMATTERS.get(code);
  if (entry && cmd.parameters && cmd.parameters.length >= entry.minParams) {
    return entry.fn(cmd, text, ctx);
  }

  // 기본 포맷: 파라미터 표시
  if (cmd.parameters && cmd.parameters.length > 0) {
    const params = cmd.parameters.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(', ');
    text += params.length > 60 ? `: ${params.substring(0, 60)}...` : `: ${params}`;
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  }
  return text;
}
