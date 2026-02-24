import type { EventCommand, MoveRoute } from '../../types/rpgMakerMV';
import type { CommandDisplayContext } from './commandDisplayText';
import { matchAddonCommand } from './addonCommands';

type Formatter = (cmd: EventCommand, text: string, ctx: CommandDisplayContext) => string;

function fmtId(id: number, pad = 4) {
  return String(id).padStart(pad, '0');
}

function formatSwitchId(id: number) {
  return `#${fmtId(id)}`;
}

function resolveCharName(charId: number, ctx: CommandDisplayContext): string {
  if (charId === -1) return '플레이어';
  if (charId === 0) return '해당 이벤트';
  const ev = ctx.currentMap?.events?.find((e: any) => e && e.id === charId);
  return ev ? `${fmtId(charId, 3)}:${(ev as any).name || ''}` : `이벤트 ${charId}`;
}

function resolveCharNameShort(charId: number, ctx: CommandDisplayContext): string {
  if (charId === -1) return '플레이어';
  if (charId === 0) return '해당 이벤트';
  return `EV${fmtId(charId, 3)}`;
}

const DIR_LABELS: Record<number, string> = { 0: '유지', 2: '아래', 4: '왼쪽', 6: '오른쪽', 8: '위' };
const BLEND_LABELS: Record<number, string> = { 0: '일반', 1: '추가 합성', 2: '곱하기', 3: '스크린' };
const ORIGIN_LABELS: Record<number, string> = { 0: '왼쪽 위', 1: '중앙' };
const VEHICLE_NAMES = ['보트', '선박', '비행선'];

const SHADER_LABELS: Record<string, string> = {
  wave: '물결', glitch: '글리치', dissolve: '디졸브', glow: '발광',
  chromatic: '색수차', pixelate: '픽셀화', shake: '흔들림', blur: '흐림',
  rainbow: '무지개', hologram: '홀로그램', outline: '외곽선', fireAura: '불꽃 오라',
  fade: '페이드', wipe: '와이프', circleWipe: '원형 와이프', blinds: '블라인드', pixelDissolve: '픽셀 디졸브',
};

function formatTransition(raw: any): string {
  if (!raw?.shaderList?.length) return '';
  const tNames = raw.shaderList.map((s: any) => SHADER_LABELS[s.type] || s.type);
  const durStr = raw.applyMode === 'interpolate' && raw.duration > 0 ? ` ${raw.duration}초` : '';
  return `, 트랜지션:[${tNames.join('+')}${durStr}]`;
}

function formatPresetPos(preset: any): string {
  if (!preset) return '(50%, 50%)';
  const oxStr = preset.offsetX ? (preset.offsetX > 0 ? `+${preset.offsetX}` : `${preset.offsetX}`) : '';
  const oyStr = preset.offsetY ? (preset.offsetY > 0 ? `+${preset.offsetY}` : `${preset.offsetY}`) : '';
  const pctX = (preset.presetX - 1) * 25;
  const pctY = (preset.presetY - 1) * 25;
  return `(${pctX}%${oxStr}, ${pctY}%${oyStr})`;
}

// ─── 조건 분기 ───
function formatConditionalBranch(params: unknown[], ctx: CommandDisplayContext): string {
  const condType = params[0] as number;
  const compOps = ['=', '\u2265', '\u2264', '>', '<', '\u2260'];
  switch (condType) {
    case 0: {
      const id = params[1] as number;
      const name = ctx.systemData?.switches?.[id];
      return `스위치 ${fmtId(id)}${name ? ' ' + name : ''} == ${(params[2] as number) === 0 ? 'ON' : 'OFF'}`;
    }
    case 1: {
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
    case 2: return `셀프 스위치 ${params[1]} == ${(params[2] as number) === 0 ? 'ON' : 'OFF'}`;
    case 3: {
      const sec = params[1] as number;
      return `타이머 ${(params[2] as number) === 0 ? '\u2265' : '\u2264'} ${Math.floor(sec / 60)}분 ${sec % 60}초`;
    }
    case 4: {
      const subLabels = ['파티에 있다', '이름이', '직업이', '스킬을', '무기를', '방어구를', '스테이트가'];
      const subType = params[2] as number;
      return `액터 ${fmtId(params[1] as number)} ${subLabels[subType] || ''}${subType === 0 ? '' : ` ${params[3]}`}`;
    }
    case 5: {
      const sub = params[2] as number;
      return sub === 0
        ? `적 #${(params[1] as number) + 1} 나타남`
        : `적 #${(params[1] as number) + 1} 스탯 ${fmtId(params[3] as number)}`;
    }
    case 6: {
      const dirs: Record<number, string> = { 2: '아래', 4: '왼쪽', 6: '오른쪽', 8: '위' };
      const charLabel = (params[1] as number) === -1 ? '플레이어' : (params[1] as number) === 0 ? '이 이벤트' : `이벤트 ${params[1]}`;
      return `${charLabel} 마주하고 있음 ${dirs[params[2] as number] || params[2]}`;
    }
    case 7: {
      const goldOps = ['\u2265', '\u2264', '<'];
      return `소지금 ${goldOps[params[2] as number] || '\u2265'} ${params[1]}`;
    }
    case 8: return `아이템 ${fmtId(params[1] as number)} 소지`;
    case 9: return `무기 ${fmtId(params[1] as number)} 소지${params[2] ? ' (장비 포함)' : ''}`;
    case 10: return `방어구 ${fmtId(params[1] as number)} 소지${params[2] ? ' (장비 포함)' : ''}`;
    case 11: return `버튼 [${params[1]}] 눌려있다`;
    case 12: {
      const comment = params[2] as string | undefined;
      const script = params[1] as string;
      return comment ? `스크립트: ${script}  ← ${comment}` : `스크립트: ${script}`;
    }
    case 13: return `${VEHICLE_NAMES[params[1] as number] || '차량'} 운행되었습니다`;
    default: return JSON.stringify(params);
  }
}

// ─── 개별 커맨드 포매터 ───

const fmt111: Formatter = (cmd, text, ctx) => {
  if (cmd.parameters && cmd.parameters.length >= 2) {
    return text + ': ' + formatConditionalBranch(cmd.parameters, ctx);
  }
  return text;
};

const fmt121: Formatter = (cmd, text, ctx) => {
  const p = cmd.parameters!;
  const startId = p[0] as number, endId = p[1] as number;
  const op = p[2] as number === 0 ? 'ON' : 'OFF';
  if (startId === endId) {
    const name = ctx.systemData?.switches?.[startId];
    return text + `: ${formatSwitchId(startId)}${name ? ' ' + name : ''} = ${op}`;
  }
  return text + `: ${formatSwitchId(startId)}..${formatSwitchId(endId)} = ${op}`;
};

const fmtOnOff = (onLabel: string, offLabel: string): Formatter => (cmd, text) => {
  return text + `: ${cmd.parameters![0] === 0 ? onLabel : offLabel}`;
};

const fmtDisableEnable: Formatter = (cmd, text) => text + `: ${cmd.parameters![0] === 0 ? '불가' : '가능'}`;

const fmt201: Formatter = (cmd, text, ctx) => {
  const p = cmd.parameters!;
  const dir = DIR_LABELS[p[4] as number] || '유지';
  const fade = ({ 0: '검게', 1: '희게', 2: '없음' } as Record<number, string>)[p[5] as number] || '검게';
  if ((p[0] as number) === 0) {
    const mapName = ctx.maps?.[p[1] as number]?.name || '';
    return text + `: ${mapName}(${p[1]},[${p[2]},${p[3]}]), 방향:${dir}, 페이드:${fade}`;
  }
  return text + `: {맵:V[${p[1]}],X:V[${p[2]}],Y:V[${p[3]}]}, 방향:${dir}, 페이드:${fade}`;
};

const fmt202: Formatter = (cmd, text, ctx) => {
  const p = cmd.parameters!;
  const vehicle = VEHICLE_NAMES[p[0] as number] || '보트';
  if ((p[1] as number) === 0) {
    const mapName = ctx.maps?.[p[2] as number]?.name || '';
    return text + `: ${vehicle}, ${mapName}(${p[2]},[${p[3]},${p[4]}])`;
  }
  return text + `: ${vehicle}, {맵:V[${p[2]}],X:V[${p[3]}],Y:V[${p[4]}]}`;
};

const fmt203: Formatter = (cmd, text, ctx) => {
  const p = cmd.parameters!;
  const eventName = resolveCharName(p[0] as number, ctx);
  const dir = DIR_LABELS[p[4] as number] || '유지';
  const dt = p[1] as number;
  if (dt === 0) return text + `: ${eventName}, (${p[2]},${p[3]}), 방향:${dir}`;
  if (dt === 1) return text + `: ${eventName}, {X:V[${p[2]}],Y:V[${p[3]}]}, 방향:${dir}`;
  const exchName = resolveCharName(p[2] as number, ctx);
  return text + `: ${eventName}, 교환:${exchName}, 방향:${dir}`;
};

const fmt205: Formatter = (cmd, text, ctx) => {
  const p = cmd.parameters!;
  const charId = p[0] as number;
  const route = p[1] as MoveRoute;
  let charName = ctx.t('moveRoute.thisEvent');
  if (charId === -1) charName = ctx.t('moveRoute.player');
  else if (charId > 0) charName = resolveCharName(charId, ctx);
  let r = text + `: ${charName}`;
  if (route?.repeat) r += ` [${ctx.t('moveRoute.repeat')}]`;
  if (route?.skippable) r += ` [${ctx.t('moveRoute.skippable')}]`;
  if (route?.wait) r += ` [${ctx.t('moveRoute.wait')}]`;
  return r;
};

const fmt212: Formatter = (cmd, text, ctx) => {
  const p = cmd.parameters!;
  const charName = resolveCharNameShort(p[0] as number, ctx);
  let r = text + `: ${charName}, ${fmtId(p[1] as number)}`;
  if (p[2]) r += ' (대기)';
  return r;
};

const fmt213: Formatter = (cmd, text, ctx) => {
  const p = cmd.parameters!;
  const balloonNames: Record<number, string> = {
    1: '느낌표', 2: '물음표', 3: '음표', 4: '하트', 5: '분노',
    6: '땀', 7: '뒤죽박죽', 8: '침묵', 9: '전구', 10: 'Zzz',
    11: '사용자 정의 1', 12: '사용자 정의 2', 13: '사용자 정의 3', 14: '사용자 정의 4', 15: '사용자 정의 5',
  };
  const charName = resolveCharNameShort(p[0] as number, ctx);
  let r = text + `: ${charName}, ${balloonNames[p[1] as number] || `말풍선 ${p[1]}`}`;
  if (p[2]) r += ' (대기)';
  return r;
};

const fmt223: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  const tone = p[0] as number[];
  let r = text + `: (${tone[0]},${tone[1]},${tone[2]},${tone[3]}), ${p[1]}프레임`;
  if (p[2]) r += `, 완료까지 대기`;
  return r;
};

const fmt225: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  let r = text + `: 강도 ${p[0]}, 속도 ${p[1]}, ${p[2]}프레임`;
  if (p[3]) r += `, 완료까지 대기`;
  return r;
};

const fmt231: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  const num = p[0] as number;
  const img = p[1] as string;
  const posType = p[3] as number;
  let posStr: string;
  if (posType === 2) {
    posStr = formatPresetPos(p[11]);
  } else {
    posStr = posType === 0 ? `(${p[4]},${p[5]})` : `(V[${p[4]}],V[${p[5]}])`;
  }
  let r = text + `: #${num}, ${img || '(없음)'}, ${ORIGIN_LABELS[p[2] as number] || ''}, ${posStr}`;
  const sw = p[6] as number, sh = p[7] as number;
  if (sw !== 100 || sh !== 100) r += `, ${sw}%x${sh}%`;
  if ((p[8] as number) !== 255) r += `, 불투명도:${p[8]}`;
  if ((p[9] as number) !== 0) r += `, ${BLEND_LABELS[p[9] as number] || ''}`;
  // 셰이더 이펙트
  const shaderRaw = p[10];
  if (shaderRaw) {
    if (Array.isArray(shaderRaw)) {
      const names = (shaderRaw as { type: string; enabled: boolean }[]).filter(s => s.enabled).map(s => SHADER_LABELS[s.type] || s.type);
      if (names.length > 0) r += `, [${names.join('+')}]`;
    } else {
      const single = shaderRaw as { type: string; enabled: boolean };
      if (single.enabled) r += `, [${SHADER_LABELS[single.type] || single.type}]`;
    }
  }
  // 셰이더로 나타나기
  const transRaw = p[12] as any;
  if (transRaw?.shaderList?.length > 0) {
    const tNames = transRaw.shaderList.map((s: any) => SHADER_LABELS[s.type] || s.type);
    const durStr = transRaw.applyMode === 'interpolate' && transRaw.duration > 0 ? ` ${transRaw.duration}초` : '';
    r += `, 나타나기:[${tNames.join('+')}${durStr}]`;
  }
  return r;
};

const fmt232: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  const num = p[0] as number;
  const posType = p[3] as number;
  let posStr: string;
  if (posType === 2) {
    const presetLabels: Record<number, string> = { 1: '0%', 2: '25%', 3: '50%', 4: '75%', 5: '100%' };
    const preset = p[12] as any;
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
    posStr = posType === 0 ? `(${p[4]},${p[5]})` : `(V[${p[4]}],V[${p[5]}])`;
  }
  let r = text + `: #${num}, ${ORIGIN_LABELS[p[2] as number] || ''}, ${posStr}`;
  const sw = p[6] as number, sh = p[7] as number;
  if (sw !== 100 || sh !== 100) r += `, ${sw}%x${sh}%`;
  if ((p[8] as number) !== 255) r += `, 불투명도:${p[8]}`;
  if ((p[9] as number) !== 0) r += `, ${BLEND_LABELS[p[9] as number] || ''}`;
  const moveMode = p[13] as string | undefined;
  if (moveMode === 'instant') {
    r += `, 즉시`;
  } else {
    r += `, ${p[10]}프레임`;
    if (p[11]) r += `, 완료까지 대기`;
  }
  r += formatTransition(p[14]);
  return r;
};

const fmt234: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  const tone = p[1] as number[];
  let r = text + `: #${p[0]}, (${tone[0]},${tone[1]},${tone[2]},${tone[3]}), ${p[2]}프레임`;
  if (p[3]) r += `, 완료까지 대기`;
  return r;
};

const fmt235: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  let r = text + `: #${p[0]}`;
  if ((p[1] as string) === 'instant') r += `, 즉시`;
  r += formatTransition(p[2]);
  return r;
};

const fmt236: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  const weatherMap: Record<string, string> = { none: '없음', rain: '비', storm: '폭풍', snow: '눈' };
  let r = text + `: ${weatherMap[p[0] as string] || p[0]}, 강도 ${p[1]}, ${p[2]}프레임`;
  if (p[3]) r += `, 완료까지 대기`;
  return r;
};

const fmt285: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  const infoNames = ['지형 태그', '이벤트 ID', '타일 ID(레이어1)', '타일 ID(레이어2)', '타일 ID(레이어3)', '타일 ID(레이어4)', '지역 ID'];
  const dt = p[2] as number;
  const locLabel = dt === 0 ? `(${p[3]},${p[4]})` : `(#${fmtId(p[3] as number)}, #${fmtId(p[4] as number)})`;
  return text + `: #${fmtId(p[0] as number)}, ${infoNames[p[1] as number] || '?'}, ${locLabel}`;
};

const fmt301: Formatter = (cmd, text, ctx) => {
  const p = cmd.parameters!;
  const dt = p[0] as number;
  if (dt === 0) {
    text += `: ${fmtId(p[1] as number)}`;
  } else if (dt === 1) {
    const varName = ctx.systemData?.variables?.[p[1] as number];
    text += `: #${fmtId(p[1] as number)}${varName ? ' ' + varName : ''}`;
  } else {
    text += `: 랜덤 대결과 동일`;
  }
  if (p[2]) text += `, 도망 가능`;
  if (p[3]) text += `, 패배 가능`;
  return text;
};

const fmtShopItem: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  const typeLabels = ['아이템', '무기', '방어구'];
  let r = text + `: [${typeLabels[p[0] as number] || '?'}] ${fmtId(p[1] as number)}`;
  if ((p[2] as number) === 1) r += ` (${p[3]}G)`;
  if (p[4]) r += ` [구매 한정]`;
  return r;
};

const fmt605: Formatter = (cmd) => {
  const p = cmd.parameters!;
  const typeLabels = ['아이템', '무기', '방어구'];
  let r = `       : [${typeLabels[p[0] as number] || '?'}] ${fmtId(p[1] as number)}`;
  if ((p[2] as number) === 1) r += ` (${p[3]}G)`;
  return r;
};

const fmtAudio: Formatter = (cmd, text) => {
  const audio = cmd.parameters![0] as { name: string; volume: number; pitch: number; pan: number } | null;
  if (audio?.name) return text + `: ${audio.name} (${audio.volume}, ${audio.pitch}, ${audio.pan})`;
  return text + `: (없음)`;
};

const fmt140: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  const vehicle = VEHICLE_NAMES[p[0] as number] || '?';
  const audio = p[1] as { name: string; volume: number; pitch: number; pan: number } | null;
  if (audio?.name) return text + `: ${vehicle}, ${audio.name} (${audio.volume}, ${audio.pitch}, ${audio.pan})`;
  return text + `: ${vehicle}, (없음)`;
};

const fmt322: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  let r = text + `: ${fmtId(p[0] as number)}`;
  const imgs: string[] = [];
  if (p[3]) imgs.push(`얼굴:${p[3]}`);
  if (p[1]) imgs.push(`캐릭터:${p[1]}`);
  if (p[5]) imgs.push(`SV:${p[5]}`);
  if (imgs.length > 0) r += `, ${imgs.join(', ')}`;
  return r;
};

const fmt323: Formatter = (cmd, text) => {
  const p = cmd.parameters!;
  let r = text + `: ${VEHICLE_NAMES[p[0] as number] || '?'}`;
  r += p[1] ? `, ${p[1]}[${p[2]}]` : `, (없음)`;
  return r;
};

const fmt356: Formatter = (cmd, text, ctx) => {
  const cmdText = cmd.parameters![0] as string;
  const match = matchAddonCommand(cmdText);
  if (match) {
    const label = ctx.t(match.subCmd.label);
    const durStr = match.duration && parseFloat(match.duration) > 0 ? ` [${match.duration}${ctx.t('addonCommands.seconds_short')}]` : '';
    if (match.def.pluginCommand === 'MapObject' && match.paramValues.length > 0) {
      const objId = parseInt(match.paramValues[0]);
      const objects = ctx.currentMap?.objects;
      const obj = objects && Array.isArray(objects) ? objects.find((o: any) => o && o.id === objId) : null;
      const objName = obj ? (obj.name || obj.imageName || `#${objId}`) : `#${objId}`;
      const restParams = match.paramValues.slice(1);
      const paramStr = restParams.length > 0 ? ` (${restParams.join(', ')})` : '';
      return `${ctx.t(match.def.label)}: ${label} #${objId} ${objName}${paramStr}${durStr}`;
    }
    const paramStr = match.paramValues.length > 0 ? ` (${match.paramValues.join(', ')})` : '';
    return `${ctx.t(match.def.label)}: ${label}${paramStr}${durStr}`;
  }
  return text + `: ${cmdText}`;
};

// ─── 포매터 레지스트리 ───
// 각 코드에 필요한 최소 파라미터 수와 포매터 함수 매핑
const FORMATTERS: Map<number, { minParams: number; fn: Formatter }> = new Map([
  [111, { minParams: 2, fn: fmt111 }],
  [121, { minParams: 3, fn: fmt121 }],
  [134, { minParams: 1, fn: fmtDisableEnable }],
  [135, { minParams: 1, fn: fmtDisableEnable }],
  [136, { minParams: 1, fn: fmtDisableEnable }],
  [137, { minParams: 1, fn: fmtDisableEnable }],
  [138, { minParams: 1, fn: (cmd, text) => {
    const tone = cmd.parameters![0] as number[];
    return tone ? text + `: (${tone[0]}, ${tone[1]}, ${tone[2]})` : text;
  }}],
  [140, { minParams: 2, fn: fmt140 }],
  [201, { minParams: 4, fn: fmt201 }],
  [202, { minParams: 5, fn: fmt202 }],
  [203, { minParams: 5, fn: fmt203 }],
  [205, { minParams: 2, fn: fmt205 }],
  [211, { minParams: 1, fn: fmtOnOff('ON', 'OFF') }],
  [212, { minParams: 2, fn: fmt212 }],
  [213, { minParams: 2, fn: fmt213 }],
  [216, { minParams: 1, fn: fmtOnOff('ON', 'OFF') }],
  [223, { minParams: 3, fn: fmt223 }],
  [225, { minParams: 4, fn: fmt225 }],
  [230, { minParams: 1, fn: (cmd, text) => {
    const frames = cmd.parameters![0] as number;
    const sec = parseFloat((frames / 60).toFixed(2));
    return text + `: ${frames} (${sec}초)`;
  }}],
  [231, { minParams: 10, fn: fmt231 }],
  [232, { minParams: 12, fn: fmt232 }],
  [233, { minParams: 2, fn: (cmd, text) => text + `: #${cmd.parameters![0]}, 속도 ${cmd.parameters![1]}` }],
  [234, { minParams: 4, fn: fmt234 }],
  [235, { minParams: 1, fn: fmt235 }],
  [236, { minParams: 4, fn: fmt236 }],
  [281, { minParams: 1, fn: fmtOnOff('ON', 'OFF') }],
  [282, { minParams: 1, fn: (cmd, text) => text + `: ${fmtId(cmd.parameters![0] as number)}` }],
  [283, { minParams: 2, fn: (cmd, text) => {
    const bb1 = cmd.parameters![0] as string, bb2 = cmd.parameters![1] as string;
    return (bb1 || bb2) ? text + `: ${bb1 || '(없음)'} & ${bb2 || '(없음)'}` : text;
  }}],
  [284, { minParams: 1, fn: (cmd, text) => {
    const name = cmd.parameters![0] as string;
    return name ? text + `: ${name}` : text;
  }}],
  [285, { minParams: 5, fn: fmt285 }],
  [301, { minParams: 2, fn: fmt301 }],
  [302, { minParams: 2, fn: fmtShopItem }],
  [322, { minParams: 6, fn: fmt322 }],
  [323, { minParams: 3, fn: fmt323 }],
  [356, { minParams: 1, fn: fmt356 }],
  [605, { minParams: 2, fn: fmt605 }],
]);

// 오디오 관련 커맨드 일괄 등록
for (const code of [132, 133, 139, 241, 245, 249, 250]) {
  FORMATTERS.set(code, { minParams: 1, fn: fmtAudio });
}

export { FORMATTERS };
