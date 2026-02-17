// 한글 초성 추출 및 fuzzy 매칭
const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHOSUNG_BASE = 0xAC00;
const CHOSUNG_PERIOD = 588; // 21 * 28

function getChosung(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= CHOSUNG_BASE && code <= 0xD7A3) {
    return CHOSUNG[Math.floor((code - CHOSUNG_BASE) / CHOSUNG_PERIOD)];
  }
  return ch;
}

function isChosung(ch: string): boolean {
  return CHOSUNG.includes(ch);
}

/** 초성 검색 포함 fuzzy 매칭. query의 각 문자가 target에 순서대로 나타나면 매칭 */
export function fuzzyMatch(target: string, query: string): boolean {
  if (!query) return true;
  const tLower = target.toLowerCase();
  const qLower = query.toLowerCase();
  let ti = 0;
  for (let qi = 0; qi < qLower.length; qi++) {
    const qch = qLower[qi];
    let found = false;
    while (ti < tLower.length) {
      const tch = tLower[ti];
      ti++;
      if (isChosung(qch)) {
        if (getChosung(tch) === qch) { found = true; break; }
      } else {
        if (tch === qch) { found = true; break; }
      }
    }
    if (!found) return false;
  }
  return true;
}
