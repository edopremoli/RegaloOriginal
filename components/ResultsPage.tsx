
import React, { useState } from 'react';
import { SimpleGenerationResult, ImageGenerationModel, OutputPresetId } from '../types';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { SparklesIcon } from './icons';
import { ModelSelector } from './ModelSelector';
import { OutputPresetSelector } from './OutputPresetSelector';

interface ResultsPageProps {
  result: SimpleGenerationResult;
  onEdit: (changes: string) => void;
  isEditing: boolean;
  onRestart: () => void;
  onGenerateNew: (newPrompt: string) => void;
  selectedModel: ImageGenerationModel;
  onModelChange: (model: ImageGenerationModel) => void;
  selectedPreset: OutputPresetId;
  onPresetChange: (presetId: OutputPresetId) => void;
}

const ResultsPage: React.FC<ResultsPageProps> = ({ 
  result, 
  onEdit, 
  isEditing, 
  onRestart, 
  onGenerateNew, 
  selectedModel, 
  onModelChange,
  selectedPreset,
  onPresetChange
}) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNewPrompt, setShowNewPrompt] = useState(false);
  
  const [changesText, setChangesText] = useState('');
  const [newPromptText, setNewPromptText] = useState('');

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = result.imageUrl;
    a.download = `generated_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleEditSubmit = () => {
      if (!changesText.trim()) return;
      onEdit(changesText);
  };

  const handleNewPromptSubmit = () => {
      if (!newPromptText.trim()) return;
      onGenerateNew(newPromptText);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Main Result */}
        <Card className="overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Resultado Generado</h2>
                <div className="flex gap-2">
                    <Button onClick={onRestart} variant="secondary">Nuevo</Button>
                    <Button onClick={handleDownload}>Descargar</Button>
                </div>
            </div>

            <div className="flex justify-center bg-slate-100 dark:bg-slate-900 rounded-lg p-2">
                <img src={result.imageUrl} alt="Result" className="max-h-[70vh] w-auto shadow-lg rounded" />
            </div>

            <div className="mt-4 flex gap-4">
                <button 
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="text-sm text-brand-primary hover:underline"
                >
                    {showPrompt ? 'Ocultar Debug' : 'Ver Debug Info'}
                </button>
            </div>

            {showPrompt && (
                <div className="mt-2 space-y-4">
                    {result.debugInfo && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                             {Object.entries(result.debugInfo).map(([k, v]) => (
                                 <div key={k} className="p-2 bg-brand-primary/5 rounded border border-brand-primary/10">
                                     <div className="text-[10px] uppercase font-bold text-slate-500">{k}</div>
                                     <div className="text-xs font-mono text-brand-primary truncate" title={String(v)}>
                                         {Array.isArray(v) ? v.join(', ') || 'none' : String(v)}
                                     </div>
                                 </div>
                             ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        {result.lastEditChanges && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                                <span className="font-bold uppercase tracking-tighter mr-2">[EDIT REQUEST]:</span> {result.lastEditChanges}
                            </div>
                        )}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded text-xs font-mono whitespace-pre-wrap border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 max-h-60 overflow-y-auto">
                            <span className="font-bold text-brand-primary mb-1 block uppercase tracking-tighter">[FINAL PROMPT SENT TO MODEL]:</span>
                            {result.promptUsed}
                        </div>
                    </div>
                </div>
            )}
        </Card>

        {/* Edit Section */}
        <div className="space-y-6">
            <ModelSelector selectedModel={selectedModel} onModelChange={onModelChange} />
            <div className="grid grid-cols-1 gap-6">
                <OutputPresetSelector 
                    selectedPreset={selectedPreset}
                    onPresetChange={onPresetChange}
                />
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowEdit(!showEdit)}>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-brand-primary" /> Editar Imagen Actual
                        </h3>
                        <span className="text-sm text-slate-500">{showEdit ? '▼' : '▶'}</span>
                    </div>
                    
                    {showEdit && (
                        <div className="mt-4 animate-fadeIn">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                Describe cambios manteniendo la composición actual.
                            </p>
                            <textarea 
                                value={changesText}
                                onChange={(e) => setChangesText(e.target.value)}
                                className="w-full h-24 p-3 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary outline-none text-sm mb-3"
                                placeholder="Ej: Haz la luz más cálida, añade vapor a la taza..."
                            />
                            <div className="flex justify-end">
                                <Button onClick={handleEditSubmit} isLoading={isEditing} disabled={!changesText.trim()}>
                                    Editar
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                <Card>
                     <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowNewPrompt(!showNewPrompt)}>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="text-brand-primary text-xl">↻</span> Generar Nuevo Prompt
                        </h3>
                        <span className="text-sm text-slate-500">{showNewPrompt ? '▼' : '▶'}</span>
                    </div>
                     
                     {showNewPrompt && (
                         <div className="mt-4 animate-fadeIn">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                Genera una imagen totalmente nueva con estos productos.
                            </p>
                            <textarea 
                                value={newPromptText}
                                onChange={(e) => setNewPromptText(e.target.value)}
                                className="w-full h-24 p-3 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary outline-none text-sm mb-3"
                                placeholder="Ej: El producto está en una playa al atardecer..."
                            />
                            <div className="flex justify-end">
                                <Button onClick={handleNewPromptSubmit} isLoading={isEditing} disabled={!newPromptText.trim()}>
                                    Generar Nuevo
                                </Button>
                            </div>
                         </div>
                     )}
                </Card>
            </div>
        </div>
    </div>
  );
};

export default ResultsPage;
