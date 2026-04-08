

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProductImage, ProductAnalysis, Rigidity, Transparency } from '../types';
import { Card } from './common/Card';
import { Button } from './common/Button';

interface IntegratedAnalysisCardProps {
    image: ProductImage;
    analysis: ProductAnalysis;
    onAnalysisChange: (updatedAnalysis: ProductAnalysis) => void;
    onForceUpdate: (imageId: string) => Promise<void>;
}

const IntegratedAnalysisCard: React.FC<IntegratedAnalysisCardProps> = ({ image, analysis, onAnalysisChange, onForceUpdate }) => {
    const [details, setDetails] = useState<ProductAnalysis>(analysis);
    const [isUpdating, setIsUpdating] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        onAnalysisChange(details);
    }, [details, onAnalysisChange]);

    useEffect(() => {
        setDetails(analysis);
    }, [analysis]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [details.descripcion_tecnica]);
    
    const handleUpdateClick = async () => {
        setIsUpdating(true);
        await onForceUpdate(image.id);
        setIsUpdating(false);
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isMeasurement = ['alto_cm', 'ancho_cm', 'largo_cm', 'espesor_cm', 'circunferencia_cm'].includes(name);

        setDetails(prev => {
            const newValue = e.target.type === 'number' ? parseFloat(value) || 0 : value;
            const updatedDetails: ProductAnalysis = { ...prev, [name]: newValue };
            
            if (isMeasurement && prev.scale_source !== 'user') {
                updatedDetails.scale_source = 'user';
            }

            return updatedDetails;
        });
    };

    const handlePaletteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const paletteArray = value.split(',').map(s => s.trim()).filter(Boolean);
        setDetails(prev => ({ ...prev, palette: paletteArray }));
    };

    const isGlassMode = details.transparencia === 'Yes' && details.rigidez === 'Rigid';

    return (
        <Card>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-x-4 gap-y-2">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 truncate" title={image.file.name}>{image.file.name}</h3>
                <div className="flex items-center gap-4 flex-shrink-0">
                    {isGlassMode && (
                        <span className="text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 py-1 rounded-full">
                            Vidrio rígido con impresión
                        </span>
                    )}
                    <Button onClick={handleUpdateClick} isLoading={isUpdating} variant="secondary" className="!py-1 !px-2 text-sm">Actualizar</Button>
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <div>
                    <img src={image.previewUrl} alt="Main product" className="rounded-lg shadow-md w-full" />
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor={`descripcion_tecnica_${image.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción técnica</label>
                        <textarea ref={textareaRef} name="descripcion_tecnica" id={`descripcion_tecnica_${image.id}`} value={details.descripcion_tecnica} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm resize-none overflow-hidden" placeholder="ej. Taza de cerámica con acabado brillante"/>
                    </div>
                    <div>
                        <label htmlFor={`palette_${image.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">Paleta de colores</label>
                        <input type="text" name="palette" id={`palette_${image.id}`} value={details.palette?.join(', ') ?? ''} onChange={handlePaletteChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" placeholder="#FFFFFF, #000000, #FF0000"/>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">3 colores principales (hex, separados por coma).</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor={`rigidez_${image.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">Rigidez</label>
                            <select id={`rigidez_${image.id}`} name="rigidez" value={details.rigidez} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                                {(['Rigid', 'Semi-rigid', 'Malleable'] as Rigidity[]).map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor={`transparencia_${image.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">Transparencia</label>
                            <select id={`transparencia_${image.id}`} name="transparencia" value={details.transparencia} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                                {(['No', 'Yes'] as Transparency[]).map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Origen de la Escala: <span className="font-normal text-slate-500 dark:text-slate-400">{details.scale_source}</span></span>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Se actualiza a 'user' cuando introduces una dimensión.</p>
                    </div>
                    <hr className="border-slate-200 dark:border-slate-700"/>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Dimensiones</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label htmlFor={`alto_cm_${image.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">Alto (cm)</label>
                            <input type="number" name="alto_cm" id={`alto_cm_${image.id}`} value={details.alto_cm ?? ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" placeholder="ej. 10"/>
                        </div>
                        <div>
                            <label htmlFor={`ancho_cm_${image.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ancho (cm)</label>
                            <input type="number" name="ancho_cm" id={`ancho_cm_${image.id}`} value={details.ancho_cm ?? ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" placeholder="ej. 15"/>
                        </div>
                        <div>
                            <label htmlFor={`largo_cm_${image.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">Largo (cm)</label>
                            <input type="number" name="largo_cm" id={`largo_cm_${image.id}`} value={details.largo_cm ?? ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" placeholder="ej. 25.5"/>
                        </div>
                        <div>
                            <label htmlFor={`espesor_cm_${image.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">Grosor (cm)</label>
                            <input type="number" name="espesor_cm" id={`espesor_cm_${image.id}`} value={details.espesor_cm ?? ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" placeholder="ej. 0.5"/>
                        </div>
                        <div>
                            <label htmlFor={`circunferencia_cm_${image.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">Circunf. (cm)</label>
                            <input type="number" name="circunferencia_cm" id={`circunferencia_cm_${image.id}`} value={details.circunferencia_cm ?? ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" placeholder="ej. 30"/>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

interface MeasurementPageProps {
  imagesToReview: ProductImage[];
  analysisResults: ProductAnalysis[];
  onAnalysisChange: (updatedAnalysis: ProductAnalysis) => void;
  onForceUpdateAnalysis: (imageId: string) => Promise<void>;
}

const MeasurementPage: React.FC<MeasurementPageProps> = ({ imagesToReview, analysisResults, onAnalysisChange, onForceUpdateAnalysis }) => {
  
  const isNextDisabled = analysisResults.some(res => {
    const hasNoMeasurement = res.alto_cm <= 0 && res.ancho_cm <= 0 && res.largo_cm <= 0;
    return hasNoMeasurement && res.scale_source === 'estimated';
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <p className="text-center text-slate-600 dark:text-slate-400">
        Revisa los detalles detectados para los productos principales y secundarios.
      </p>

      {imagesToReview.map((image) => {
          const analysis = analysisResults.find(a => a.imageId === image.id);
          if (!analysis) {
              return <Card key={image.id}><p>Analizando {image.file.name}...</p></Card>;
          }
          return (
            <IntegratedAnalysisCard 
                key={image.id} 
                image={image} 
                analysis={analysis} 
                onAnalysisChange={onAnalysisChange}
                onForceUpdate={onForceUpdateAnalysis} 
            />
          );
      })}
      
      {isNextDisabled && (
        <p className="text-amber-600 dark:text-amber-400 mt-6 text-center font-semibold bg-amber-100 dark:bg-amber-900/30 p-3 rounded-md">
            A uno o más productos seleccionados les falta información de escala. Por favor, proporciona al menos una medida (Alto, Ancho o Largo) para cada uno para continuar.
        </p>
      )}
    </div>
  );
};

export default MeasurementPage;