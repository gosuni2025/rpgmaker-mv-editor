import React, { useState, useRef } from 'react';
import TranslationPopup from './TranslationPopup';

interface TranslateButtonProps {
  csvPath: string;
  entryKey: string;
  sourceText: string;
}

export default function TranslateButton({ csvPath, entryKey, sourceText }: TranslateButtonProps) {
  const [showPopup, setShowPopup] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btnRef}
        className="l10n-translate-btn"
        title={entryKey}
        onClick={() => setShowPopup(true)}
      >
        🌐
      </button>
      {showPopup && (
        <TranslationPopup
          csvPath={csvPath}
          entryKey={entryKey}
          sourceText={sourceText}
          anchorRef={btnRef}
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  );
}
