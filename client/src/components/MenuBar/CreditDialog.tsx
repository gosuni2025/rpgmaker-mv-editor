import React from 'react';

export function CreditDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-content credit-dialog" onMouseDown={e => e.stopPropagation()}>
        <div className="credit-dialog-header">
          <span>크레딧</span>
          <button className="credit-dialog-close" onClick={onClose}>✕</button>
        </div>
        <div className="credit-dialog-body">
          <section>
            <h3>샘플 에셋</h3>
            <div className="credit-asset">
              <div className="credit-asset-name">UI Pack — Pixel Adventure</div>
              <div className="credit-asset-author">by Kenney (kenney.nl)</div>
              <div className="credit-asset-license">License: CC0 1.0 (Public Domain)</div>
              <a className="credit-asset-link" href="https://kenney.nl/assets/ui-pack-pixel-adventure" target="_blank" rel="noreferrer">
                kenney.nl/assets/ui-pack-pixel-adventure
              </a>
            </div>
          </section>
          <div className="credit-separator" />
          <section>
            <h3>Special Thanks</h3>
            <div className="credit-asset">
              <div className="credit-asset-name">RPG Maker MV</div>
              <div className="credit-asset-author">by Kadokawa Corporation / Degica</div>
              <a className="credit-asset-link" href="https://store.steampowered.com/app/363890/RPG_Maker_MV/" target="_blank" rel="noreferrer">
                store.steampowered.com — RPG Maker MV
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
