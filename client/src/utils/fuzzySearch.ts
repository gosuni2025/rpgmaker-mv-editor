/**
 * 퍼지 검색 유틸리티 (한글 초성 검색 지원)
 */

/**
 * 매칭 품질 점수 (높을수록 관련도 높음, 정렬에 사용)
 */
export function fuzzyScore(text: string, pattern: string): number {
  if (!pattern) return 0;
  const trimmed = pattern.trim();
  if (!trimmed) return 0;
  const lowerText = text.toLowerCase();
  const lowerPattern = trimmed.toLowerCase();
  if (lowerText === lowerPattern) return 5;
  if (lowerText.startsWith(lowerPattern)) return 4;
  if (lowerText.includes(lowerPattern)) return 3;
  // 초성 기준
  const textChosung = [...text].map(ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      return ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'][Math.floor((code - 0xAC00) / 588)];
    }
    return ch;
  }).join('');
  if (textChosung.startsWith(lowerPattern)) return 2;
  if (textChosung.includes(lowerPattern)) return 1;
  return 0;
}

// 한글 초성 배열 (가~힣 유니코드 블록)
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 한글 완성형 문자의 초성 추출
function getChosung(char: string): string | null {
  const code = char.charCodeAt(0);
  // 한글 완성형 범위: 0xAC00 ~ 0xD7A3
  if (code >= 0xAC00 && code <= 0xD7A3) {
    const index = Math.floor((code - 0xAC00) / 588);
    return CHOSUNG[index];
  }
  // 이미 초성 자모인 경우
  if (CHOSUNG.includes(char)) {
    return char;
  }
  return null;
}

// 문자가 한글 초성(자음만)인지 확인
function isChosung(char: string): boolean {
  return CHOSUNG.includes(char);
}

// 문자열에서 초성만 추출
function extractChosung(text: string): string {
  return [...text].map(ch => getChosung(ch) ?? ch).join('');
}

/**
 * 초성 패턴이 대상 텍스트에 매칭되는지 확인
 * "ㅁㅈ" → "문장 표시"의 "문장" 매칭
 */
function matchChosung(text: string, pattern: string): boolean {
  const textChosung = extractChosung(text);
  const patternLower = pattern.toLowerCase();

  // 패턴의 각 문자가 초성이면 초성끼리, 아니면 원문끼리 비교
  let ti = 0;
  let pi = 0;
  const textLower = text.toLowerCase();

  while (pi < patternLower.length && ti < text.length) {
    const pChar = patternLower[pi];

    if (isChosung(pChar)) {
      // 패턴이 초성이면 텍스트의 초성과 비교
      const tChosung = getChosung(textLower[ti]);
      if (tChosung === pChar) {
        pi++;
      }
    } else {
      // 일반 문자면 원문과 비교
      if (textLower[ti] === pChar) {
        pi++;
      }
    }
    ti++;
  }

  return pi >= patternLower.length;
}

/**
 * 퍼지 검색: 패턴의 각 문자가 순서대로 대상에 포함되는지 확인
 * 한글 초성도 지원
 */
export function fuzzyMatch(text: string, pattern: string): boolean {
  if (!pattern) return true;
  if (!text) return false;

  const trimmed = pattern.trim();
  if (!trimmed) return true;

  // 한글 초성이 포함된 경우 초성 매칭 시도
  const hasChosung = [...trimmed].some(isChosung);
  if (hasChosung) {
    return matchChosung(text, trimmed);
  }

  // 일반 퍼지 매칭: 패턴 문자가 순서대로 텍스트에 등장
  const textLower = text.toLowerCase();
  const patternLower = trimmed.toLowerCase();

  let ti = 0;
  for (let pi = 0; pi < patternLower.length; pi++) {
    const pChar = patternLower[pi];
    const found = textLower.indexOf(pChar, ti);
    if (found === -1) return false;
    ti = found + 1;
  }

  return true;
}
