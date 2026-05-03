
import React from 'react';
import { ImageGenerationModel, OutputPresetId } from '../types';
import { ModelSelector } from './ModelSelector';
import { OutputPresetSelector } from './OutputPresetSelector';
import { Button } from './common/Button';

interface ConfigPageProps {
  selectedModel: ImageGenerationModel;
  onModelChange: (model: ImageGenerationModel) => void;
  selectedPreset: OutputPresetId;
  onPresetChange: (presetId: OutputPresetId) => void;
  onGenerate: () => void;
  onBack: () => void;
}

const ConfigPage: React.FC<ConfigPageProps> = ({
  selectedModel,
  onModelChange,
  selectedPreset,
  onPresetChange,
  onGenerate,
  onBack
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
          Ajustes de Generación
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Personaliza la calidad y el formato de salida para el resultado final.
        </p>
      </div>

      <div className="space-y-6">
        <ModelSelector selectedModel={selectedModel} onModelChange={onModelChange} />
        
        <OutputPresetSelector 
          selectedPreset={selectedPreset}
          onPresetChange={onPresetChange}
        />
        
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center max-w-2xl mx-auto mt-4 leading-relaxed">
          La app solicita el formato directamente al modelo. El tamaño es un tier del modelo, no una resolución exacta garantizada. Recorte, upscale y export final se hacen después en Photoshop.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-200 dark:border-slate-800 gap-6">
        <button 
          onClick={onBack}
          className="text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium transition-colors p-2"
        >
          ← Volver al Preflight
        </button>
        
        <Button 
          onClick={onGenerate}
          size="lg"
          className="w-full md:w-auto px-16 py-4 text-xl shadow-2xl shadow-brand-primary/30"
        >
          Generar Fotografía
        </Button>
      </div>
    </div>
  );
};

export default ConfigPage;
