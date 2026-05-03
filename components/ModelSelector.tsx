
import React from 'react';
import { ImageGenerationModel, MODEL_OPTIONS } from '../types';

interface ModelSelectorProps {
  selectedModel: ImageGenerationModel;
  onModelChange: (model: ImageGenerationModel) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange }) => {
  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">
            1. Selección de Modelo
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODEL_OPTIONS.map((opt) => {
                return (
                    <button
                        key={opt.id}
                        onClick={() => onModelChange(opt.id)}
                        className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all ${
                            selectedModel === opt.id 
                            ? 'border-brand-primary bg-brand-primary/10 ring-4 ring-brand-primary/20 shadow-lg' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className={`font-bold text-base leading-tight ${selectedModel === opt.id ? 'text-brand-primary dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                {opt.label}
                            </span>
                            {opt.isPro && (
                                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-amber-200 dark:border-amber-800 shrink-0">Pro</span>
                            )}
                        </div>
                        <span className={`text-sm mb-3 flex-grow ${selectedModel === opt.id ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                            {opt.description}
                        </span>
                        <div className={`text-[10px] font-mono font-bold px-2 py-1 rounded w-fit ${selectedModel === opt.id ? 'bg-brand-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                            Aprox. ${opt.basePrice}
                        </div>
                    </button>
                );
            })}
        </div>
    </div>
  );
};
