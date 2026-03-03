/*:
 * @plugindesc 상점 재고 관리 - 상품별 재고, 동적 증감, 상품 추가/제거 지원
 * @author gosuni2025
 *
 * @param soldOutText
 * @text 품절 표시 텍스트
 * @desc 구매 목록 및 수량창에서 재고 0인 아이템에 표시할 텍스트
 * @type string
 * @default 품절
 *
 * @param soldOutStatusText
 * @text 상태창 품절 메시지
 * @desc 아이템 선택 시 오른쪽 상태창에 표시할 품절 메시지
 * @type string
 * @default 품절입니다.
 *
 * @param soldOutColor
 * @text 품절 텍스트 색상
 * @type color
 * @default #e04040
 *
 * @param stockPrefix
 * @text 재고 표시 접두어
 * @desc 재고 수 앞에 붙는 텍스트
 * @type string
 * @default 재고:
 *
 * @param lowStockColor
 * @text 재고 부족 경고 색상
 * @desc 재고가 3 이하일 때 표시 색상
 * @type color
 * @default #ffaa00
 *
 * @param noFundsText
 * @text 돈 부족 메시지
 * @desc 상태창에서 골드가 부족할 때 표시할 텍스트
 * @type string
 * @default 돈이 부족합니다.
 *
 * @param noFundsColor
 * @text 돈 부족 텍스트 색상
 * @type color
 * @default #ffcc00
 *
 * @command addStock
 * @text 재고 증감
 * @desc 상점 아이템의 재고를 증가하거나 감소합니다. 무제한(-1) 아이템은 변경되지 않습니다.
 *
 * @arg eventId
 * @text 이벤트 ID
 * @type number
 * @default 1
 *
 * @arg cmdIdx
 * @text 커맨드 인덱스
 * @desc 이벤트 리스트에서 상점의 처리(302) 커맨드가 위치한 인덱스
 * @type number
 * @default 0
 *
 * @arg itemIdx
 * @text 아이템 인덱스
 * @desc 상점 내 아이템 순서 (0부터 시작)
 * @type number
 * @default 0
 *
 * @arg amount
 * @text 수량
 * @desc 증가할 수량. 음수를 입력하면 감소합니다.
 * @type number
 * @default 1
 *
 * @command setStock
 * @text 재고 설정
 * @desc 상점 아이템의 재고를 지정한 값으로 설정합니다. -1을 입력하면 무제한이 됩니다.
 *
 * @arg eventId
 * @text 이벤트 ID
 * @type number
 * @default 1
 *
 * @arg cmdIdx
 * @text 커맨드 인덱스
 * @type number
 * @default 0
 *
 * @arg itemIdx
 * @text 아이템 인덱스
 * @type number
 * @default 0
 *
 * @arg amount
 * @text 재고 수량 (-1=무제한)
 * @type number
 * @default 10
 *
 * @command addItem
 * @text 상품 추가
 * @desc 상점에 새 상품을 동적으로 추가합니다. 상점을 한 번 열어야 효과가 적용됩니다.
 *
 * @arg eventId
 * @text 이벤트 ID
 * @type number
 * @default 1
 *
 * @arg cmdIdx
 * @text 커맨드 인덱스
 * @type number
 * @default 0
 *
 * @arg type
 * @text 종류
 * @type select
 * @option 아이템
 * @value 0
 * @option 무기
 * @value 1
 * @option 방어구
 * @value 2
 * @default 0
 *
 * @arg itemId
 * @text 아이템 ID
 * @type number
 * @default 1
 *
 * @arg priceType
 * @text 가격 타입
 * @type select
 * @option 표준 가격
 * @value 0
 * @option 지정 가격
 * @value 1
 * @default 0
 *
 * @arg price
 * @text 지정 가격
 * @desc 가격 타입이 "지정 가격"일 때만 사용됩니다.
 * @type number
 * @default 0
 *
 * @arg stock
 * @text 재고 (-1=무제한)
 * @type number
 * @default -1
 *
 * @command removeItem
 * @text 상품 제거
 * @desc 상점에서 특정 상품을 제거합니다. 상점을 한 번 열어야 효과가 적용됩니다.
 *
 * @arg eventId
 * @text 이벤트 ID
 * @type number
 * @default 1
 *
 * @arg cmdIdx
 * @text 커맨드 인덱스
 * @type number
 * @default 0
 *
 * @arg itemIdx
 * @text 아이템 인덱스
 * @desc 제거할 아이템의 순서 (0부터 시작)
 * @type number
 * @default 0
 *
 * @help
 * ───────────────────────────────────────────────────────────────────
 * 재고 파라미터 (이벤트 에디터 상점의 처리에서 설정)
 *   302 첫 번째 상품: params[5] = 재고 수량 (-1 = 무제한)
 *   605 추가 상품:    params[4] = 재고 수량 (-1 = 무제한)
 *
 * 재고/상품 목록은 $gameSystem에 저장 → 세이브/로드 자동 유지
 * 첫 방문 시 이벤트 파라미터로 초기화, 이후엔 저장된 상태 유지
 *
 * ───────────────────────────────────────────────────────────────────
 * 플러그인 커맨드 (현재 맵 기준, eventId/cmdIdx로 상점 식별)
 *
 * 재고 조작:
 *   ShopStock addStock  <eventId> <cmdIdx> <itemIdx> <amount>
 *   ShopStock setStock  <eventId> <cmdIdx> <itemIdx> <amount>
 *
 * 상품 추가:
 *   ShopStock addItem <eventId> <cmdIdx> <type> <itemId> <priceType> <price> <stock>
 *     type: 0=아이템 1=무기 2=방어구  priceType: 0=표준 1=지정  stock: -1=무제한
 *
 * 상품 제거:
 *   ShopStock removeItem <eventId> <cmdIdx> <itemIdx>
 *
 * ───────────────────────────────────────────────────────────────────
 * 스크립트 API
 *   ShopStockManager.addStock("1_5_3", 0, 10);
 *   ShopStockManager.setStock("1_5_3", 0, 5);
 *   ShopStockManager.addItem("1_5_3", 0, 1, 0, 0, 3);
 *   ShopStockManager.removeItem("1_5_3", 2);
 * ───────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  var _params           = PluginManager.parameters('ShopStock');
  var SOLD_OUT_TEXT        = String(_params['soldOutText']       || '품절');
  var SOLD_OUT_STATUS_TEXT = String(_params['soldOutStatusText'] || '품절입니다.');
  var SOLD_OUT_COLOR       = String(_params['soldOutColor']      || '#e04040');
  var STOCK_PREFIX         = String(_params['stockPrefix']       || '재고:');
  var LOW_STOCK_COLOR      = String(_params['lowStockColor']     || '#ffaa00');
  var NO_FUNDS_TEXT        = String(_params['noFundsText']       || '돈이 부족합니다.');
  var NO_FUNDS_COLOR       = String(_params['noFundsColor']      || '#ffcc00');

