import React from 'react';
import { useTranslation } from 'react-i18next';
import { makeParamNames } from './dbConstants';

interface DbParamsGridProps {
  params: number[];
  onChange: (index: number, value: number) => void;
}

export default function DbParamsGrid({ params, onChange }: DbParamsGridProps) {
  const { t } = useTranslation();
  const PARAM_NAMES = makeParamNames(t);

  return (
    <>
      <div className="db-form-row">
        {[0, 2, 4, 6].map((i) => (
          <label key={i}>
            {PARAM_NAMES[i]}
            <input type="number" value={params[i] ?? 0} onChange={(e) => onChange(i, Number(e.target.value))} />
          </label>
        ))}
      </div>
      <div className="db-form-row">
        {[1, 3, 5, 7].map((i) => (
          <label key={i}>
            {PARAM_NAMES[i]}
            <input type="number" value={params[i] ?? 0} onChange={(e) => onChange(i, Number(e.target.value))} />
          </label>
        ))}
      </div>
    </>
  );
}
