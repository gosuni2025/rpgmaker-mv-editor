import type { EventCommand } from '../../types/rpgMakerMV';

// Commands that have no parameters and can be inserted directly
export const NO_PARAM_CODES = new Set([112, 113, 115, 206, 221, 222, 243, 244, 251, 351, 352, 353, 354]);

// 단순 연속형: 주 명령어 뒤에 바로 따라오는 부속 코드
export const CONTINUATION_CODES: Record<number, number> = {
  101: 401,  // Show Text → 텍스트 줄
  105: 405,  // Show Scrolling Text → 텍스트 줄
  108: 408,  // Comment → 주석 줄
  355: 655,  // Script → 스크립트 줄
  302: 605,  // Shop Processing → 상점 아이템 줄
};

// 블록 구조형: 주 명령어 ~ 종료 마커까지 (같은 indent)
export const BLOCK_END_CODES: Record<number, number[]> = {
  111: [412],       // Conditional Branch → End (411 Else는 중간)
  112: [413],       // Loop → Repeat Above
  102: [404],       // Show Choices → End
  301: [604],       // Battle Processing → End (601 Win, 602 Escape, 603 Lose)
};

// 부속 코드 → 주 명령어 매핑 (부속 코드 클릭 시 그룹의 주 명령어를 찾기 위함)
export const CHILD_TO_PARENT: Record<number, number[]> = {
  401: [101], 405: [105], 408: [108], 655: [355], 605: [302],
  402: [102], 403: [102], 404: [102],
  411: [111], 412: [111],
  413: [112],
  601: [301], 602: [301], 603: [301], 604: [301],
};

// Commands that need a parameter editor
export const HAS_PARAM_EDITOR = new Set([
  101, 102, 103, 104, 105, 108, 111, 117, 118, 119, 121, 122, 123, 124, 125, 126, 127, 128, 129,
  132, 133, 134, 135, 136, 137, 138, 139, 140,
  201, 202, 203, 204, 211, 212, 213, 216, 223, 224, 225, 230, 231, 232, 233, 234, 235, 236, 241, 242, 245, 246, 249, 250, 261, 281, 282, 283, 284, 285, 301, 302, 303, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 355, 356,
]);

/**
 * 주어진 인덱스의 명령어가 속한 그룹의 시작~끝 범위를 반환.
 * [start, end] (inclusive)
 */
export function getCommandGroupRange(commands: EventCommand[], index: number): [number, number] {
  if (index < 0 || index >= commands.length) return [index, index];
  const cmd = commands[index];

  // 부속 코드를 선택한 경우: 부모(주 명령어)를 위쪽으로 찾아가서 그 그룹 전체를 반환
  if (CHILD_TO_PARENT[cmd.code]) {
    const parentCodes = CHILD_TO_PARENT[cmd.code];
    // 단순 연속형 부속 코드(401, 405, 408, 655, 605)는 해당 줄만 삭제
    const isContinuation = [401, 405, 408, 655, 605].includes(cmd.code);
    if (isContinuation) {
      return [index, index];
    }
    // 블록 구조형 부속 코드(402, 411, 412, 413 등)는 부모를 찾아 전체 블록 삭제
    for (let i = index - 1; i >= 0; i--) {
      if (parentCodes.includes(commands[i].code) && commands[i].indent === cmd.indent) {
        return getCommandGroupRange(commands, i);
      }
    }
    // 부모를 못 찾으면 해당 줄만
    return [index, index];
  }

  // 단순 연속형 주 명령어: 바로 뒤 부속 코드들까지 포함
  const contCode = CONTINUATION_CODES[cmd.code];
  if (contCode !== undefined) {
    let end = index;
    for (let i = index + 1; i < commands.length; i++) {
      if (commands[i].code === contCode) {
        end = i;
      } else {
        break;
      }
    }
    return [index, end];
  }

  // 블록 구조형 주 명령어: 같은 indent의 종료 마커까지
  const endCodes = BLOCK_END_CODES[cmd.code];
  if (endCodes) {
    const baseIndent = cmd.indent;
    let depth = 0;
    for (let i = index + 1; i < commands.length; i++) {
      const c = commands[i];
      // 같은 종류의 블록이 중첩될 수 있으므로 depth 추적
      if (c.code === cmd.code && c.indent === baseIndent) {
        depth++;
      }
      if (endCodes.includes(c.code) && c.indent === baseIndent) {
        if (depth === 0) {
          return [index, i];
        }
        depth--;
      }
    }
    // 종료 마커를 못 찾으면 주 명령어만
    return [index, index];
  }

  // 일반 명령어: 해당 줄만
  return [index, index];
}

/**
 * 선택된 인덱스들을 그룹 단위로 확장.
 * 각 선택된 인덱스의 그룹 범위를 구해서 연속 범위들의 배열로 반환.
 */
export function expandSelectionToGroups(commands: EventCommand[], indices: Set<number>): [number, number][] {
  if (indices.size === 0) return [];
  const expanded = new Set<number>();
  for (const idx of indices) {
    const [start, end] = getCommandGroupRange(commands, idx);
    for (let i = start; i <= end; i++) expanded.add(i);
  }
  // 연속 범위로 병합
  const sorted = [...expanded].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === rangeEnd + 1) {
      rangeEnd = sorted[i];
    } else {
      ranges.push([rangeStart, rangeEnd]);
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }
  ranges.push([rangeStart, rangeEnd]);
  return ranges;
}

// 드래그 중인 그룹이 이동할 수 없는 위치인지 판별 (블록 내부 부속 코드 사이로 끼어드는 것 방지)
export function isValidDropTarget(commands: EventCommand[], targetIndex: number, dragStart: number, dragEnd: number): boolean {
  // 마지막 빈 명령어(code 0) 뒤로는 이동 불가
  if (targetIndex >= commands.length) return false;
  // 자기 자신 범위 안으로 이동하는 건 무의미
  if (targetIndex >= dragStart && targetIndex <= dragEnd + 1) return true;
  return true;
}
