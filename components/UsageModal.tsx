import React, { useState, useEffect } from 'react';
import { getUsageSummary, clearUsage, UsageSummary } from '../utils/usageTracker';
import { Button } from './common/Button';

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsageModal: React.FC<UsageModalProps> = ({ isOpen, onClose }) => {
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSummary(getUsageSummary());
    }
  }, [isOpen]);

  if (!isOpen || !summary) return null;

  const handleClear = () => {
    if (window.confirm("¿Seguro que quieres borrar el historial local estimado de gastos?")) {
      clearUsage();
      setSummary(getUsageSummary());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold dark:text-white uppercase tracking-tight">Gasto Estimado Local</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            Estimación local basada en generaciones realizadas desde esta app. El gasto real debe comprobarse de manera oficial en AI Studio / Google Cloud Billing.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Hoy</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">${summary.todayCost.toFixed(3)}</div>
                <div className="text-xs text-slate-400 mt-1">{summary.todayGenerations} generaciones</div>
            </div>
            
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Mes Actual</div>
                <div className="text-2xl font-bold text-brand-primary">${summary.monthCost.toFixed(3)}</div>
                <div className="text-xs text-slate-400 mt-1">{summary.monthGenerations} generaciones</div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Desglose (Mes)</h3>
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/50">
                <span className="text-sm text-slate-600 dark:text-slate-400">Standard</span>
                <span className="text-sm font-medium dark:text-white">
                  {summary.standardCount} imgs / ${summary.standardCost.toFixed(3)}
                </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/50">
                <span className="text-sm text-slate-600 dark:text-slate-400">Pro</span>
                <span className="text-sm font-medium dark:text-white">
                  {summary.proCount} imgs / ${summary.proCost.toFixed(3)}
                </span>
            </div>
          </div>

          {summary.history.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Últimas (Max 10)</h3>
              <div className="space-y-2">
                {summary.history.map(entry => (
                  <div key={entry.id} className="text-xs flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/30">
                    <div className="flex-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 mr-2">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="uppercase text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 mr-2">
                        {entry.operation}
                      </span>
                      <span className="text-slate-500">{entry.modelLabel}</span>
                    </div>
                    <div className="text-right font-medium dark:text-white">${entry.estimatedCostUsd.toFixed(3)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
            <button 
                onClick={handleClear}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-2 transition-colors border border-transparent rounded hover:bg-red-50 dark:hover:bg-red-900/20"
            >
                Resetear contador local
            </button>
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>

      </div>
    </div>
  );
};
