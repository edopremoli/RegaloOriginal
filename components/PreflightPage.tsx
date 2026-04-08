
import React from 'react';
import { PreflightData, ProductImage } from '../types';
import { Card } from './common/Card';
import { CheckCircleIcon } from './icons';

interface PreflightPageProps {
  masterImages: ProductImage[];
  preflightProducts: PreflightData[];
  onProductChange: (index: number, patch: Partial<PreflightData>) => void;
}

const PreflightPage: React.FC<PreflightPageProps> = ({ masterImages, preflightProducts, onProductChange }) => {
  
  const handleInputChange = (index: number, field: keyof PreflightData, value: string) => {
      const numValue = parseFloat(value);
      
      if (field === 'object_name_es' || field === 'material_finish_es') {
          onProductChange(index, { [field]: value });
      } else {
          // Dimensions
          onProductChange(index, { [field]: (isNaN(numValue) || value.trim() === '') ? null : numValue });
      }
  };

  const handleDimensionChange = (index: number, type: 'cylinder' | 'sphere' | 'box' | 'other', key: string, value: string) => {
       const numValue = (isNaN(parseFloat(value)) || value.trim() === '') ? null : parseFloat(value);
       
       if (type === 'cylinder') {
           if (key === 'diameter') {
               onProductChange(index, { ancho_cm: numValue, profundidad_cm: numValue });
           } else if (key === 'height') {
               onProductChange(index, { alto_cm: numValue });
           }
       } else if (type === 'sphere') {
           onProductChange(index, { alto_cm: numValue, ancho_cm: numValue, profundidad_cm: numValue });
       } else {
           // Box / Other
            if (key === 'height') onProductChange(index, { alto_cm: numValue });
            if (key === 'width') onProductChange(index, { ancho_cm: numValue });
            if (key === 'depth') onProductChange(index, { profundidad_cm: numValue });
       }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-4">
             <div className="bg-brand-primary/10 p-2 rounded-full text-brand-primary">
                <CheckCircleIcon className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Confirmación de Detalles</h2>
                <p className="text-sm text-slate-500">Revisa la información detectada para cada producto Master.</p>
             </div>
        </div>
        
        {masterImages.map((img, index) => {
            const data = preflightProducts[index];
            if (!data) return null; // Should match 1:1

            const profile = data.dimension_profile || 'other';

            return (
                <Card key={img.id} className="relative overflow-hidden">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Thumbnail */}
                        <div className="md:w-1/3 flex-shrink-0">
                             <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square shadow-sm">
                                <img src={img.previewUrl} alt={`Master ${index + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute top-2 left-2 bg-slate-900/70 text-white text-xs px-2 py-1 rounded font-bold">
                                    MASTER {index + 1}
                                </div>
                             </div>
                             <div className="mt-3">
                                 <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Perfil de forma</label>
                                 <div className="flex gap-1 mt-1">
                                     <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-[10px] font-bold uppercase">
                                         {profile === 'cylinder' ? 'Cilíndrico' : 
                                          profile === 'sphere' ? 'Esférico' : 
                                          profile === 'box' ? 'Rectangular' : 'Irregular'}
                                     </span>
                                 </div>
                             </div>
                        </div>

                        {/* Form */}
                        <div className="md:w-2/3 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Qué es el objeto (Identidad) <span className="text-red-500">*</span>
                                </label>
                                <textarea 
                                    rows={3}
                                    value={data.object_name_es}
                                    onChange={(e) => handleInputChange(index, 'object_name_es', e.target.value)}
                                    placeholder="Ej: Botella de agua negra mate con tapa de acero inoxidable"
                                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all resize-none leading-relaxed"
                                />
                                {!data.object_name_es.trim() && (
                                    <p className="text-xs text-red-500 mt-1">Este campo es obligatorio.</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Material / Acabado
                                </label>
                                <textarea 
                                    rows={2}
                                    value={data.material_finish_es}
                                    onChange={(e) => handleInputChange(index, 'material_finish_es', e.target.value)}
                                    placeholder="Ej: Acero inoxidable cepillado, acabado mate suave"
                                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all resize-none leading-relaxed"
                                />
                            </div>

                            <div className="pt-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Medidas (cm) <span className="font-normal text-slate-500 text-xs ml-1">(Opcionales)</span>
                                </label>
                                
                                {/* ADAPTIVE INPUTS BASED ON PROFILE */}
                                {profile === 'cylinder' && (
                                    <div className="grid grid-cols-2 gap-4">
                                         <div>
                                            <span className="text-xs text-slate-500 block mb-1 font-medium">Alto</span>
                                            <input 
                                                type="number" step="any" placeholder="ej. 24"
                                                value={data.alto_cm ?? ''}
                                                onChange={(e) => handleDimensionChange(index, 'cylinder', 'height', e.target.value)}
                                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary/50 outline-none text-center"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500 block mb-1 font-medium">Diámetro</span>
                                            <input 
                                                type="number" step="any" placeholder="ej. 7.5"
                                                value={data.ancho_cm ?? ''} // Assuming cylinder width = diameter
                                                onChange={(e) => handleDimensionChange(index, 'cylinder', 'diameter', e.target.value)}
                                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary/50 outline-none text-center"
                                            />
                                        </div>
                                    </div>
                                )}

                                {profile === 'sphere' && (
                                    <div className="grid grid-cols-1">
                                        <div>
                                            <span className="text-xs text-slate-500 block mb-1 font-medium">Diámetro</span>
                                            <input 
                                                type="number" step="any" placeholder="ej. 12"
                                                value={data.ancho_cm ?? ''} // Assuming sphere width = diameter
                                                onChange={(e) => handleDimensionChange(index, 'sphere', 'diameter', e.target.value)}
                                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary/50 outline-none text-center"
                                            />
                                        </div>
                                    </div>
                                )}

                                {(profile === 'box' || profile === 'other') && (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <span className="text-xs text-slate-500 block mb-1 font-medium">Alto</span>
                                            <input 
                                                type="number" step="any" placeholder="ej. 10"
                                                value={data.alto_cm ?? ''}
                                                onChange={(e) => handleDimensionChange(index, 'box', 'height', e.target.value)}
                                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary/50 outline-none text-center"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500 block mb-1 font-medium">Ancho</span>
                                            <input 
                                                type="number" step="any" placeholder="ej. 15"
                                                value={data.ancho_cm ?? ''}
                                                onChange={(e) => handleDimensionChange(index, 'box', 'width', e.target.value)}
                                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary/50 outline-none text-center"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500 block mb-1 font-medium">Prof.</span>
                                            <input 
                                                type="number" step="any" placeholder="ej. 5"
                                                value={data.profundidad_cm ?? ''}
                                                onChange={(e) => handleDimensionChange(index, 'box', 'depth', e.target.value)}
                                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-primary/50 outline-none text-center"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            );
        })}
    </div>
  );
};

export default PreflightPage;
