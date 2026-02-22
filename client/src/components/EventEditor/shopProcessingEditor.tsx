import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import { DataListPicker } from './dataListPicker';
import { useDbNamesWithIcons, getLabel } from './actionEditorUtils';
import type { EventCommand } from '../../types/rpgMakerMV';

/**
 * 상점의 처리 (Shop Processing) 에디터 - code 302
 *
 * 첫 번째 상품은 code 302의 parameters에, 추가 상품은 code 605 continuation으로 저장됨.
 *
 * parameters 구조:
 *   [0]: 상품 종류 (0=아이템, 1=무기, 2=방어구)
 *   [1]: 아이템 ID
 *   [2]: 가격 타입 (0=표준, 1=지정)
 *   [3]: 지정 가격 (가격 타입=1일 때만 사용)
 *   302의 [4]: 구매 한정 (boolean) - 첫 번째 상품에만
 *   302의 [5]: 재고 수량 (-1 = 무제한)
 *   605의 [4]: 재고 수량 (-1 = 무제한)
 */

interface GoodsItem {
  itemType: number;   // 0=아이템, 1=무기, 2=방어구
  itemId: number;
  priceType: number;  // 0=표준, 1=지정
  price: number;
  stock: number;      // -1 = 무제한, 0 이상 = 재고 수량
}

const ITEM_TYPE_LABELS = ['아이템', '무기', '방어구'];
const ITEM_TYPE_ENDPOINTS = ['items', 'weapons', 'armors'];

export function ShopProcessingEditor({ p, followCommands, onOk, onCancel }: {
  p: unknown[];
  followCommands: EventCommand[];
  onOk: (params: unknown[], extraCommands?: EventCommand[]) => void;
  onCancel: () => void;
}) {
  // 기존 상품 목록 파싱
  const initialGoods: GoodsItem[] = [];
  if (p.length > 0) {
    const stockVal = p[5] as number;
    initialGoods.push({
      itemType: (p[0] as number) || 0,
      itemId: (p[1] as number) || 1,
      priceType: (p[2] as number) || 0,
      price: (p[3] as number) || 0,
      stock: (typeof stockVal === 'number' && stockVal >= 0) ? stockVal : -1,
    });
    for (const fc of followCommands.filter(c => c.code === 605)) {
      const fp = fc.parameters;
      const fstockVal = fp[4] as number;
      initialGoods.push({
        itemType: (fp[0] as number) || 0,
        itemId: (fp[1] as number) || 1,
        priceType: (fp[2] as number) || 0,
        price: (fp[3] as number) || 0,
        stock: (typeof fstockVal === 'number' && fstockVal >= 0) ? fstockVal : -1,
      });
    }
  }

  const [goods, setGoods] = useState<GoodsItem[]>(initialGoods);
  const [purchaseOnly, setPurchaseOnly] = useState<boolean>((p[4] as boolean) ?? false);
  const [selectedIndex, setSelectedIndex] = useState<number>(goods.length > 0 ? 0 : -1);
  const [editingItem, setEditingItem] = useState<GoodsItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1); // -1 = 신규 추가

  const itemNames = useDbNamesWithIcons(ITEM_TYPE_ENDPOINTS[0]);
  const weaponNames = useDbNamesWithIcons(ITEM_TYPE_ENDPOINTS[1]);
  const armorNames = useDbNamesWithIcons(ITEM_TYPE_ENDPOINTS[2]);

  const dbByType = [itemNames, weaponNames, armorNames];

  const getItemLabel = (item: GoodsItem) => {
    const db = dbByType[item.itemType];
    const name = db?.names[item.itemId] || '';
    return `${ITEM_TYPE_LABELS[item.itemType]}: ${String(item.itemId).padStart(4, '0')} ${name}`;
  };

  const getPriceLabel = (item: GoodsItem) => {
    return item.priceType === 0 ? '표준' : String(item.price);
  };

  const getStockLabel = (item: GoodsItem) => {
    return item.stock === -1 ? '∞' : String(item.stock);
  };

  const handleDoubleClick = (index: number) => {
    setEditingItem({ ...goods[index] });
    setEditingIndex(index);
  };

  const handleRowDoubleClickEmpty = () => {
    setEditingItem({ itemType: 0, itemId: 1, priceType: 0, price: 0, stock: -1 });
    setEditingIndex(-1);
  };

  const handleEditOk = (item: GoodsItem) => {
    if (editingIndex === -1) {
      const newGoods = [...goods, item];
      setGoods(newGoods);
      setSelectedIndex(newGoods.length - 1);
    } else {
      const newGoods = [...goods];
      newGoods[editingIndex] = item;
      setGoods(newGoods);
    }
    setEditingItem(null);
    setEditingIndex(-1);
  };

  const handleDelete = () => {
    if (selectedIndex < 0 || selectedIndex >= goods.length) return;
    const newGoods = goods.filter((_, i) => i !== selectedIndex);
    setGoods(newGoods);
    setSelectedIndex(Math.min(selectedIndex, newGoods.length - 1));
  };

  const handleOk = () => {
    if (goods.length === 0) {
      onOk([0, 1, 0, 0, purchaseOnly, -1]);
      return;
    }
    const first = goods[0];
    const params = [first.itemType, first.itemId, first.priceType, first.price, purchaseOnly, first.stock];

    // 추가 상품은 code 605 continuation
    const extra: EventCommand[] = goods.slice(1).map(g => ({
      code: 605,
      indent: 0,
      parameters: [g.itemType, g.itemId, g.priceType, g.price, g.stock],
    }));

    onOk(params, extra);
  };

  return (
    <>
      {/* 상품 목록 테이블 */}
      <div style={{ border: '1px solid #555', borderRadius: 4, overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', background: '#383838', borderBottom: '1px solid #555' }}>
          <div style={{ flex: 1, padding: '4px 8px', fontSize: 12, color: '#aaa', borderRight: '1px solid #555' }}>상품</div>
          <div style={{ width: 80, padding: '4px 8px', fontSize: 12, color: '#aaa', borderRight: '1px solid #555', textAlign: 'right' }}>가격</div>
          <div style={{ width: 60, padding: '4px 8px', fontSize: 12, color: '#aaa', textAlign: 'right' }}>재고</div>
        </div>
        {/* 상품 행들 */}
        <div style={{ minHeight: 200, maxHeight: 300, overflowY: 'auto', background: '#2b2b2b' }}>
          {goods.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex', cursor: 'pointer',
                background: i === selectedIndex ? '#2675bf' : 'transparent',
                borderBottom: '1px solid #333',
              }}
              onClick={() => setSelectedIndex(i)}
              onDoubleClick={() => handleDoubleClick(i)}
            >
              <div style={{ flex: 1, padding: '3px 8px', fontSize: 13, color: '#ddd', borderRight: '1px solid #333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getItemLabel(item)}
              </div>
              <div style={{ width: 80, padding: '3px 8px', fontSize: 13, color: '#ddd', borderRight: '1px solid #333', textAlign: 'right' }}>
                {getPriceLabel(item)}
              </div>
              <div style={{ width: 60, padding: '3px 8px', fontSize: 13, textAlign: 'right', color: item.stock === 0 ? '#ff6666' : item.stock !== -1 && item.stock <= 3 ? '#ffaa00' : '#ddd' }}>
                {getStockLabel(item)}
              </div>
            </div>
          ))}
          {/* 빈 행 (더블클릭으로 추가) */}
          {Array.from({ length: Math.max(1, 8 - goods.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                display: 'flex', cursor: 'pointer',
                borderBottom: '1px solid #333',
                background: goods.length + i === selectedIndex ? '#2675bf' : 'transparent',
              }}
              onDoubleClick={handleRowDoubleClickEmpty}
            >
              <div style={{ flex: 1, padding: '3px 8px', fontSize: 13, color: '#666', borderRight: '1px solid #333' }}>&nbsp;</div>
              <div style={{ width: 80, padding: '3px 8px', fontSize: 13, color: '#666', borderRight: '1px solid #333' }}>&nbsp;</div>
              <div style={{ width: 60, padding: '3px 8px', fontSize: 13, color: '#666' }}>&nbsp;</div>
            </div>
          ))}
        </div>
      </div>

      {/* 옵션 */}
      <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={purchaseOnly} onChange={e => setPurchaseOnly(e.target.checked)} />
        구매 한정
      </label>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="db-btn"
          onClick={handleDelete}
          disabled={selectedIndex < 0 || selectedIndex >= goods.length}
          style={{ opacity: selectedIndex >= 0 && selectedIndex < goods.length ? 1 : 0.4 }}
        >
          삭제
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>

      {/* 상품 편집 다이얼로그 */}
      {editingItem && (
        <GoodsEditDialog
          item={editingItem}
          dbByType={dbByType}
          onOk={handleEditOk}
          onCancel={() => { setEditingItem(null); setEditingIndex(-1); }}
        />
      )}
    </>
  );
}

/** 개별 상품 편집 다이얼로그 */
function GoodsEditDialog({ item, dbByType, onOk, onCancel }: {
  item: GoodsItem;
  dbByType: { names: string[]; iconIndices: (number | undefined)[] }[];
  onOk: (item: GoodsItem) => void;
  onCancel: () => void;
}) {
  const [itemType, setItemType] = useState(item.itemType);
  const [itemId, setItemId] = useState(item.itemId);
  const [priceType, setPriceType] = useState(item.priceType);
  const [price, setPrice] = useState(item.price);
  const [stockType, setStockType] = useState<'unlimited' | 'limited'>(item.stock === -1 ? 'unlimited' : 'limited');
  const [stock, setStock] = useState(item.stock === -1 ? 1 : item.stock);
  const [showPicker, setShowPicker] = useState(false);

  const db = dbByType[itemType];
  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  const handleOk = () => {
    onOk({ itemType, itemId, priceType, price, stock: stockType === 'unlimited' ? -1 : stock });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: 400, maxHeight: '80vh' }}>
        <div className="image-picker-header">상품</div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 상품 종류 */}
          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>상품</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ITEM_TYPE_LABELS.map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={radioStyle}>
                    <input type="radio" name="goods-type" checked={itemType === i} onChange={() => { setItemType(i); setItemId(1); }} />
                    {label}
                  </label>
                  {itemType === i && (
                    <button className="db-btn" onClick={() => setShowPicker(true)}
                      style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13, flex: 1 }}>
                      {getLabel(itemId, db.names)}
                    </button>
                  )}
                  {itemType === i && (
                    <button className="db-btn" onClick={() => setShowPicker(true)} style={{ padding: '4px 6px', fontSize: 11 }}>...</button>
                  )}
                </div>
              ))}
            </div>
          </fieldset>

          {/* 가격 */}
          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>가격</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={radioStyle}>
                <input type="radio" name="goods-price" checked={priceType === 0} onChange={() => setPriceType(0)} />
                표준
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={radioStyle}>
                  <input type="radio" name="goods-price" checked={priceType === 1} onChange={() => setPriceType(1)} />
                  지정
                </label>
                <input
                  type="number" value={priceType === 1 ? price : 0}
                  onChange={e => setPrice(Number(e.target.value))}
                  min={0} disabled={priceType !== 1}
                  style={{ ...selectStyle, width: 120, opacity: priceType === 1 ? 1 : 0.5 }}
                />
              </div>
            </div>
          </fieldset>

          {/* 재고 */}
          <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
            <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>재고</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={radioStyle}>
                <input type="radio" name="goods-stock" checked={stockType === 'unlimited'} onChange={() => setStockType('unlimited')} />
                무제한
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={radioStyle}>
                  <input type="radio" name="goods-stock" checked={stockType === 'limited'} onChange={() => setStockType('limited')} />
                  지정
                </label>
                <input
                  type="number" value={stockType === 'limited' ? stock : 1}
                  onChange={e => setStock(Math.max(0, Number(e.target.value)))}
                  min={0} disabled={stockType !== 'limited'}
                  style={{ ...selectStyle, width: 120, opacity: stockType === 'limited' ? 1 : 0.5 }}
                />
              </div>
            </div>
          </fieldset>
        </div>

        <div className="image-picker-footer">
          <button className="db-btn" onClick={handleOk}>OK</button>
          <button className="db-btn" onClick={onCancel}>취소</button>
        </div>
      </div>

      {showPicker && (
        <DataListPicker
          items={db.names}
          value={itemId}
          onChange={setItemId}
          onClose={() => setShowPicker(false)}
          title="대상 선택"
          iconIndices={db.iconIndices}
        />
      )}
    </div>
  );
}
