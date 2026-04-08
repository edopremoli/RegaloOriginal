import React, { useState, useEffect } from 'react';
import { VideoTemplate, VideoIntensity, VideoConfig } from '../types';
import { Card } from './common/Card';
import { Button } from './common/Button';

interface VideoConfigPageProps {
  sourceImage: {
    blob: Blob;
    url: string;
    width: number;
    height: number;
  };
  onGenerate: (config: VideoConfig) => void;
  onCancel: () => void;
}

const VideoConfigPage: React.FC<VideoConfigPageProps> = ({ sourceImage, onGenerate, onCancel }) => {
  const [template, setTemplate] = useState<VideoTemplate>('push_in');
  const [intensity, setIntensity] = useState<VideoIntensity>('low');
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);
  const [previewStyle, setPreviewStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const intensityValue = intensity === 'low' ? '2%' : '3%';
    let animationName = '';
    switch(template) {
        case 'push_in': 
            animationName = 'preview_push_in';
            break;
        case 'pan':
            animationName = 'preview_pan';
            break;
        case 'parallax':
            animationName = 'preview_parallax';
            break;
    }

    setPreviewStyle({
      '--intensity-transform': `scale(1.0${intensity === 'low' ? 2 : 3})`,
      '--intensity-pan': intensityValue,
      animation: `${animationName} 5s ease-in-out infinite`,
    } as React.CSSProperties);
  }, [template, intensity]);

  const handleSubmit = () => {
    const config: VideoConfig = {
      template,
      intensity,
      sourceImage
    };
    onGenerate(config);
  };

  const isResMismatch = sourceImage.width !== sourceImage.height;

  return (
    <>
      <style>{`
        @keyframes preview_push_in {
            0%, 100% { transform: scale(1); }
            50% { transform: var(--intensity-transform); }
        }
        @keyframes preview_pan {
            0%, 100% { transform: translateX(calc(-1 * var(--intensity-pan))); }
            50% { transform: translateX(var(--intensity-pan)); }
        }
        @keyframes preview_parallax {
            0%, 100% { transform: translate(calc(-0.7 * var(--intensity-pan)), calc(-0.7 * var(--intensity-pan))); }
            50% { transform: translate(calc(0.7 * var(--intensity-pan)), calc(0.7 * var(--intensity-pan))); }
        }
      `}</style>
      <Card className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center">Crear Vídeo de Producto (2.5D)</h2>
        <div className="mt-8 grid md:grid-cols-2 gap-8 items-start">
            <div>
                <h3 className="text-xl font-semibold mb-4">Imagen Fuente</h3>
                <div className="overflow-hidden rounded-lg shadow-lg aspect-square">
                    <img src={sourceImage.url} alt="Source for video" className="w-full h-full object-cover" style={previewStyle} />
                </div>
                <p className="text-xs text-center mt-2 text-slate-500">Previsualización de animación</p>
            </div>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">Plantilla de Movimiento</label>
                    <div className="mt-2 space-y-2">
                        {(['push_in', 'pan', 'parallax'] as VideoTemplate[]).map(t => (
                            <label key={t} className="flex items-center gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-700 has-[:checked]:bg-brand-subtle has-[:checked]:border-brand-primary dark:has-[:checked]:bg-blue-900/20 cursor-pointer">
                                <input type="radio" name="template" value={t} checked={template === t} onChange={() => setTemplate(t)} className="h-4 w-4 border-gray-300 text-brand-primary focus:ring-brand-light"/>
                                <span className="font-medium capitalize text-slate-800 dark:text-slate-200">{t.replace('_', ' ')}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">Intensidad</label>
                    <div className="mt-2 flex gap-2">
                        {(['low', 'med'] as VideoIntensity[]).map(i => (
                            <label key={i} className="flex-1 text-center cursor-pointer p-3 rounded-lg border border-slate-300 dark:border-slate-700 has-[:checked]:bg-brand-subtle has-[:checked]:border-brand-primary dark:has-[:checked]:bg-blue-900/20">
                                <input type="radio" name="intensity" value={i} checked={intensity === i} onChange={() => setIntensity(i)} className="sr-only"/>
                                <span className="font-medium capitalize text-slate-800 dark:text-slate-200">{i === 'low' ? 'Baja' : 'Media'}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {isResMismatch && <p className="text-sm p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md"><strong>Error RES_MISMATCH:</strong> La imagen fuente debe ser cuadrada (1:1). Esta es de {sourceImage.width}x{sourceImage.height}px.</p>}
                {error && <p className="text-sm p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md">{error}</p>}
                
                <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button onClick={onCancel} variant="secondary" disabled={isLoading} className="w-full">Cancelar</Button>
                    <Button onClick={handleSubmit} isLoading={isLoading} disabled={isResMismatch} className="w-full">Crear Vídeo</Button>
                </div>
            </div>
        </div>
      </Card>
    </>
  );
};

export default VideoConfigPage;
