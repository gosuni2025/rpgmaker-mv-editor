import React from 'react';

export function MovePictureHelpPopup({ pos, onClose }: { pos: { top: number; left: number }; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
      background: '#1a2535', border: '1px solid #4a7aaa', borderRadius: 8,
      padding: '12px 16px', fontSize: 12, color: '#ccc', lineHeight: 1.7,
      maxWidth: 320, boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontWeight: 'bold', color: '#9cf', marginBottom: 8, fontSize: 13 }}>이동 시작 위치란?</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <li>현재 이벤트에서 같은 그림 번호의 <b>[그림 표시]</b> / <b>[그림 이동]</b> 커맨드 목록입니다.</li>
        <li>위치·배율·투명도 값이 동일한 커맨드는 하나로 묶어 표시하며, 가장 최근 커맨드가 자동으로 선택됩니다.</li>
        <li>선택하면 해당 커맨드의 설정값이 시작 위치에 자동으로 입력됩니다.</li>
      </ul>
      <div style={{ marginTop: 10, padding: '8px 10px', background: '#2a1a1a', border: '1px solid #7a4a3a', borderRadius: 4, color: '#fa9', fontSize: 11, lineHeight: 1.6 }}>
        ⚠ 프리뷰의 반투명 이미지는 참고용 예시일 뿐입니다.<br />
        실제 게임에서 그림이 반드시 이 위치에서 시작하는 것은 아닙니다.
      </div>
      <div style={{ textAlign: 'right', marginTop: 10 }}>
        <button onClick={onClose}
          style={{ fontSize: 11, padding: '2px 14px', background: '#2a3a5a', border: '1px solid #4a6a9a', borderRadius: 3, color: '#9cf', cursor: 'pointer' }}>
          닫기
        </button>
      </div>
    </div>
  );
}
