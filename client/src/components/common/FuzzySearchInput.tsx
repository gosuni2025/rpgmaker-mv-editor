import React, { useRef } from 'react';
import './FuzzySearchInput.css';

interface FuzzySearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function FuzzySearchInput({ value, onChange, placeholder = '검색...' }: FuzzySearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fuzzy-search">
      <input
        ref={inputRef}
        type="text"
        className="fuzzy-search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('');
            inputRef.current?.blur();
          }
          e.stopPropagation();
        }}
      />
      {value && (
        <span
          className="fuzzy-search-clear"
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
        >
          ×
        </span>
      )}
    </div>
  );
}
