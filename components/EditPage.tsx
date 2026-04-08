

import React, { useState } from 'react';
import { GenerationResult, QAReport, ExportReport, ExportDetails, REFERENCE_USE_OPTIONS, REFERENCE_USE_LABELS } from '../types';
import { editLifestyleImage } from '../services/geminiService';
import { Button } from './common/Button';
import { Card } from './common/Card';

interface EditPageProps {
  result: GenerationResult;
  onComplete: (newResult: GenerationResult) => void;
  onCancel: () => void;
  onApiKeyError?: () => void;
}

const EditPage: React.FC<EditPageProps> = ({ result, onComplete, onCancel, onApiKeyError }) => {
  const [editPrompt, setEditPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extraRefFile, setExtraRefFile] = useState<File | null>(null);
  const [extraRefChips, setExtraRefChips] = useState<string[]>([]);


  const mainPhotos = result.allPhotos.filter(p => p.role === 'Main');
  
  const lastImageIndex = result.imageBlobs.length - 1;
  if (lastImageIndex < 0) {
    console.error("EditPage: No images in result to edit.");
    onCancel();
    return null;
  }
  const sourceImageBlob = result.imageBlobs[lastImageIndex];
  const sourceImageUrl = result.imageUrls[lastImageIndex];

  const handleRefChipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setExtraRefChips(prev => 
      checked ? [...prev, value] : prev.filter(chip => chip !== value)
    );
  };

  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setExtraRefFile(file || null);
  };

  const handleGenerateEdit = async () => {
    if (!editPrompt.trim()) {
      setError("Por favor, introduce una instrucción de edición.");
      return;
    }
    if (mainPhotos.length === 0 || !sourceImageBlob) {
      setError("Faltan datos de la imagen de origen, no se puede realizar la edición.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const mainPhotoFiles = mainPhotos.map(p => p.file);
      const extraRefPayload = extraRefFile && extraRefChips.length > 0
        ? { file: extraRefFile, chips: extraRefChips }
        : undefined;

      const { editedImageBlob, width, height, wasCapped } = await editLifestyleImage(
        mainPhotoFiles,
        sourceImageBlob,
        editPrompt,
        extraRefPayload
      );

      const firstQaReport = result.qaReports[0];

      const newQaReport: QAReport = {
        ...firstQaReport,
        seed: Math.floor(Math.random() * 1000000),
        prompt_final: `EDIT: ${editPrompt} | Original prompt: ${firstQaReport.prompt_final}`,
        model_id: 'gemini-2.5-flash-image (edit)',
        decision: 'accepted',
        failed_metrics: [],
        rejection_reason: undefined,
      };
      
      const newFileName = `SKU123_master_S${width}_seed${firstQaReport.seed}_edit_${newQaReport.seed % 100}.jpg`;
      const newMasterExport: ExportDetails = {
        ...result.exportReports[0].master,
        filename_out: newFileName,
        peso_kb: (editedImageBlob.size / 1024),
        width_px: width,
        height_px: height,
        long_edge_px: Math.max(width, height),
      };

      const newExportReport: ExportReport = {
        master: newMasterExport,
      };
      
      const newResult: GenerationResult = {
        ...result,
        imageUrls: [URL.createObjectURL(editedImageBlob)],
        imageBlobs: [editedImageBlob],
        masterWidths: [width],
        masterHeights: [height],
        qaReports: [newQaReport],
        exportReports: [newExportReport],
        wasCappedArray: [wasCapped],
        wasCroppedArray: [result.wasCroppedArray[0]]
      };

      onComplete(newResult);

    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || JSON.stringify(err);
      if (onApiKeyError && (errMsg.includes('403') || errMsg.includes('permission') || errMsg.includes('PERMISSION_DENIED'))) {
          onApiKeyError();
          return;
      }
      setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido durante la edición.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100">Editar tu Imagen</h2>
      <p className="mt-2 text-center text-slate-600 dark:text-slate-400">Describe los cambios que te gustaría hacer a la última imagen generada.</p>
      
      <div className="mt-8 grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">Imagen a Editar</h3>
          <img src={sourceImageUrl} alt="Currently generated" className="rounded-lg shadow-lg w-full" />
        </div>
        
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Referencia: Producto(s) Principal(es)</h3>
                <div className="grid grid-cols-2 gap-2">
                    {mainPhotos.map(p => (
                        <img key={p.id} src={p.previewUrl} alt="Main product reference" className="rounded-lg shadow-md w-full" />
                    ))}
                </div>
            </div>
             <div>
                <label htmlFor="editPrompt" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Instrucciones de Edición (Requerido)</label>
                <textarea 
                  id="editPrompt"
                  name="editPrompt"
                  rows={4} 
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="ej., haz la iluminación más cálida, añade una planta en el fondo, cambia la superficie a madera oscura"
                />
            </div>

            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <h4 className="text-sm font-semibold mb-2">Referencia Adicional (Opcional)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Sube una imagen para guiar el estilo. No se hará in-painting; se regenerará la imagen desde cero con la nueva inspiración.</p>
                <div>
                  <label className="block text-xs font-medium">Imagen de Referencia</label>
                  <input type="file" onChange={handleRefFileChange} accept="image/*" className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/50 dark:file:text-blue-200 dark:hover:file:bg-blue-900"/>
                  {extraRefFile && <span className="text-xs text-slate-500 mt-1 block">Seleccionado: {extraRefFile.name}</span>}
                </div>
                {extraRefFile && (
                    <div className="mt-3">
                        <label className="block text-xs font-medium">Usar referencia para:</label>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                            {REFERENCE_USE_OPTIONS.map(opt => (
                                <label key={opt} className="flex items-center text-sm">
                                    <input type="checkbox" value={opt} checked={extraRefChips.includes(opt)} onChange={handleRefChipChange} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-light" />
                                    <span className="ml-2 text-xs">{REFERENCE_USE_LABELS[opt]}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
        </div>
      </div>
      
      <div className="mt-10 flex justify-center gap-4">
        <Button onClick={handleGenerateEdit} isLoading={isLoading} className="px-10 py-3 text-lg">
          Aplicar Edición
        </Button>
        <Button onClick={onCancel} variant="secondary" className="px-10 py-3 text-lg" disabled={isLoading}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
};

export default EditPage;