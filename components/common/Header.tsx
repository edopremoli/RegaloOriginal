
import React from 'react';
import { AppState } from '../../types';
import { Button } from './Button';
import { HomeIcon, UploadIcon, SearchIcon, SparklesIcon } from '../icons';

interface HeaderProps {
  appState: AppState;
  onHome: () => void;
  onNext: () => void;
  onBack: () => void;
  isNextDisabled: boolean;
  nextLabel?: string;
  onShowUsage?: () => void;
}

const STEPS = [
    { id: 'upload',   label: 'Subir + Prompt',     icon: <UploadIcon />, state: AppState.UPLOAD },
    { id: 'preflight',  label: 'Preflight',  icon: <SearchIcon />, state: AppState.PREFLIGHT },
    { id: 'config',  label: 'Ajustes',  icon: <SparklesIcon />, state: AppState.CONFIG },
    { id: 'results', label: 'Resultado',   icon: <SparklesIcon />, state: AppState.RESULTS },
];

export const Header: React.FC<HeaderProps> = ({ appState, onHome, onNext, onBack, isNextDisabled, nextLabel, onShowUsage }) => {
  
  const showNavButtons = [AppState.UPLOAD, AppState.PREFLIGHT, AppState.CONFIG].includes(appState);
  const showBack = [AppState.PREFLIGHT, AppState.CONFIG].includes(appState);
  
  const getStepStatus = (stepState: AppState) => {
      if (appState === stepState) return 'current';
      if (appState === AppState.RESULTS) return 'completed';
      if (appState === AppState.GENERATING || appState === AppState.ANALYZING) {
           if (stepState === AppState.UPLOAD) return 'completed';
           if (stepState === AppState.PREFLIGHT) return 'completed';
           if (stepState === AppState.CONFIG && appState === AppState.GENERATING) return 'completed';
      }
      if (appState === AppState.PREFLIGHT && stepState === AppState.UPLOAD) return 'completed';
      if (appState === AppState.CONFIG && [AppState.UPLOAD, AppState.PREFLIGHT].includes(stepState)) return 'completed';
      return 'pending';
  };

  const getDefaultLabel = () => {
    if (nextLabel) return nextLabel;
    return appState === AppState.UPLOAD ? 'Analizar' : 'Generar';
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <button onClick={onHome} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" aria-label="Inicio">
                <HomeIcon className="w-6 h-6 text-slate-700 dark:text-slate-200" />
            </button>
            
            <nav className="flex items-center gap-1 md:gap-4">
                {STEPS.map((step, index) => {
                    const status = getStepStatus(step.state);
                    const isCurrent = status === 'current';
                    const isCompleted = status === 'completed';
                    
                    return (
                        <div key={step.id} className="flex items-center">
                             {index > 0 && <div className="w-4 h-0.5 bg-slate-200 dark:bg-slate-700 mx-2 hidden md:block" />}
                             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 ${
                                 isCurrent ? 'bg-brand-primary text-white shadow-md' : 
                                 isCompleted ? 'text-brand-primary bg-blue-50 dark:bg-blue-900/20' : 
                                 'text-slate-400'
                             }`}>
                                 {React.cloneElement(step.icon as any, { className: "w-4 h-4" })}
                                 <span className="text-sm font-medium hidden md:inline">{step.label}</span>
                             </div>
                        </div>
                    );
                })}
            </nav>
            
            {onShowUsage ? (
                <button 
                  onClick={onShowUsage}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors hidden sm:block"
                >
                  Gasto
                </button>
            ) : (
                <div className="w-10"></div>
            )}
        </div>
      </header>
      
      {/* Persistent Bottom Bar (Footer + Actions) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 transition-all duration-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="container mx-auto px-4 py-3">
           
           {/* Action Buttons Row (Conditional) */}
           {showNavButtons && (
               <div className="flex justify-between items-center max-w-lg mx-auto mb-3">
                {showBack ? (
                  <Button onClick={onBack} variant="secondary" className="w-32 shadow-sm border border-slate-200 dark:border-slate-700">Atrás</Button>
                ) : (
                  <div className="w-32" /> 
                )}
                <Button onClick={onNext} disabled={isNextDisabled} className="w-40 shadow-md shadow-brand-primary/20">
                    {getDefaultLabel()}
                </Button>
              </div>
           )}

           {/* Footer Copyright Row (Always Visible) */}
           <div className="text-center border-t border-slate-100 dark:border-slate-800 pt-2">
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                  © {new Date().getFullYear()}{" "}
                  <a href="https://www.regalooriginal.com" target="_blank" rel="noreferrer"
                     className="hover:text-brand-primary hover:underline decoration-dotted transition-colors">
                    Regalo Original
                  </a>
                  {" · "}
                  <span className="whitespace-nowrap">Made with 💚 by{" "}
                    <a href="https://edopremoli.com" target="_blank" rel="noreferrer"
                       className="hover:text-brand-primary hover:underline decoration-dotted transition-colors">
                      Edo Premoli
                    </a>
                  </span>
                </p>
           </div>

        </div>
      </div>
    </>
  );
};
