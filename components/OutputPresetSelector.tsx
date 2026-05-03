import React from 'react';
import { OutputPresetId, PRESET_OPTIONS } from '../types';

interface OutputPresetSelectorProps {
  selectedPreset: OutputPresetId;
  onPresetChange: (presetId: OutputPresetId) => void;
}

export const OutputPresetSelector: React.FC<OutputPresetSelectorProps> = ({ selectedPreset, onPresetChange }) => {
  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">
            2. Uso Final (Formato)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRESET_OPTIONS.map((opt) => {
                const isSelected = selectedPreset === opt.id;
                return (
                    <button
                        key={opt.id}
                        onClick={() => onPresetChange(opt.id)}
                        className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all ${
                            isSelected 
                            ? 'border-brand-primary bg-brand-primary/10 ring-4 ring-brand-primary/20 shadow-lg' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                    >
                        <span className={`text-base font-bold mb-2 ${isSelected ? 'text-brand-primary dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                            {opt.label}
                        </span>
                        <span className={`text-sm flex-grow ${isSelected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                            {opt.description}
                        </span>
                    </button>
                );
            })}
        </div>
    </div>
  );
};
