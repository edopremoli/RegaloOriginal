
import React, { useCallback } from 'react';
import { ProductImage, ReferenceType } from '../types';
import { Card } from './common/Card';
import { UploadIcon, TrashIcon, StarIcon } from './icons';

interface UploadPageProps {
  images: ProductImage[];
  setImages: (images: ProductImage[]) => void;
  scenePrompt: string;
  setScenePrompt: (prompt: string) => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ images, setImages, scenePrompt, setScenePrompt }) => {
  const MAX_IMAGES = 7; // Total images limit

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    if (images.length + files.length > MAX_IMAGES) {
      alert(`Máximo ${MAX_IMAGES} imágenes en total.`);
      return;
    }

    const newImages: ProductImage[] = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) continue;

        const url = URL.createObjectURL(file);
        // First image uploaded becomes Master if no images exist
        const isMaster = images.length === 0 && i === 0;

        newImages.push({
            id: `${Date.now()}-${Math.random()}`,
            file,
            previewUrl: url,
            thumbnailUrl: url,
            isMaster,
            comment: ''
        });
    }
    
    setImages([...images, ...newImages]);
    if (event.target) event.target.value = '';
  }, [images, setImages]);

  const removeImage = (id: string) => {
    const remaining = images.filter(i => i.id !== id);
    // If we removed a master and no masters remain, promote the first available if exists
    if (images.find(i => i.id === id)?.isMaster && !remaining.some(i => i.isMaster) && remaining.length > 0) {
        remaining[0].isMaster = true;
    }
    setImages(remaining);
  };

  const toggleMaster = (id: string) => {
      setImages(images.map(img => ({
          ...img,
          isMaster: img.id === id ? !img.isMaster : img.isMaster
      })));
  };

  const updateComment = (id: string, text: string) => {
      setImages(images.map(img => ({
          ...img,
          comment: img.id === id ? text : img.comment
      })));
  };

  const updateReferenceType = (id: string, type: ReferenceType) => {
      setImages(images.map(img => ({
          ...img,
          referenceType: img.id === id ? type : img.referenceType
      })));
  };

  const updateAppliesTo = (id: string, masterId: string | "all") => {
      setImages(images.map(img => ({
          ...img,
          appliesToProductCardId: img.id === id ? masterId : img.appliesToProductCardId
      })));
  };

  const updateIdentityRelation = (id: string, relation: "same_product" | "additional_product" | "inspiration") => {
      setImages(images.map(img => ({
          ...img,
          identityRelation: img.id === id ? relation : img.identityRelation
      })));
  };

  const masters = images.filter(i => i.isMaster);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
      
          {/* 1. UPLOAD SECTION */}
          <Card className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">1. Imágenes del Producto</h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                    {images.length}/{MAX_IMAGES}
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Upload Button */}
                  {images.length < MAX_IMAGES && (
                    <label className="cursor-pointer border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center aspect-square hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-brand-primary/50 transition-all group">
                        <UploadIcon className="w-8 h-8 text-slate-300 group-hover:text-brand-primary mb-2 transition-colors" />
                        <span className="text-xs font-medium text-slate-500 group-hover:text-brand-primary text-center px-1">
                            Subir fotos
                        </span>
                        <input type="file" className="hidden" multiple accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} />
                    </label>
                  )}

                  {/* Image Cards */}
                  {images.map(img => (
                      <div key={img.id} className={`relative group rounded-xl overflow-hidden border transition-all ${img.isMaster ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-slate-200 dark:border-slate-700'}`}>
                          <img src={img.previewUrl} alt="preview" className="w-full h-full aspect-square object-cover" />
                          
                          {/* Controls Overlay */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => removeImage(img.id)} className="bg-red-500/90 text-white p-1.5 rounded-full shadow-sm hover:bg-red-600 backdrop-blur-sm" title="Eliminar">
                                  <TrashIcon className="w-3 h-3" />
                              </button>
                          </div>
                          
                          {/* Bottom Gradient for text readability */}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                             <div className="flex justify-between items-end">
                                <button 
                                    onClick={() => toggleMaster(img.id)}
                                    className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${img.isMaster ? 'text-white' : 'text-slate-200 hover:text-white'}`}
                                >
                                    <StarIcon className={`w-3 h-3 ${img.isMaster ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} /> 
                                    {img.isMaster ? 'Master' : 'Set Master'}
                                </button>
                             </div>
                          </div>
                      </div>
                  ))}
              </div>
              
              <div className="mt-4 space-y-3">
                 {images.map(img => !img.isMaster && (
                     <div key={img.id} className="flex flex-col gap-1.5 p-2 bg-slate-50/50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <img src={img.previewUrl} className="w-10 h-10 rounded object-cover border border-slate-200" alt="mini" />
                             <div className="flex-1 flex flex-col gap-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                    <select 
                                        value={img.referenceType || 'other'}
                                        onChange={(e) => updateReferenceType(img.id, e.target.value as ReferenceType)}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-slate-600 dark:text-slate-400 outline-none focus:ring-1 focus:ring-brand-primary"
                                    >
                                        <option value="detail">Detalle</option>
                                        <option value="color">Otro color</option>
                                        <option value="angle">Otra vista</option>
                                        <option value="style">Inspiración</option>
                                        <option value="extra_product">Producto adicional</option>
                                        <option value="other">Otro</option>
                                    </select>

                                    <select 
                                        value={img.identityRelation || 'same_product'}
                                        onChange={(e) => updateIdentityRelation(img.id, e.target.value as any)}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-slate-600 dark:text-slate-400 outline-none focus:ring-1 focus:ring-brand-primary"
                                    >
                                        <option value="same_product">Mismo producto</option>
                                        <option value="additional_product">Producto adicional</option>
                                        <option value="inspiration">Inspiración</option>
                                    </select>

                                    {img.identityRelation === 'same_product' && masters.length > 1 && (
                                        <select 
                                            value={img.appliesToProductCardId || 'all'}
                                            onChange={(e) => updateAppliesTo(img.id, e.target.value)}
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-slate-600 dark:text-slate-400 outline-none focus:ring-1 focus:ring-brand-primary"
                                        >
                                            <option value="all">Aplica a todos</option>
                                            {masters.map((m, idx) => (
                                                <option key={m.id} value={m.id}>Aplica a Master {idx + 1}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Comentario libre..." 
                                    value={img.comment || ''}
                                    onChange={(e) => updateComment(img.id, e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-brand-primary outline-none transition-colors"
                                />
                            </div>
                        </div>
                     </div>
                 ))}
              </div>
          </Card>

          {/* 2. PROMPT SECTION */}
          <Card className="flex flex-col h-full">
            <div className="mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">2. Descripción de Escena</h2>
            </div>
            
            <div className="flex-grow flex flex-col">
                <p className="text-sm text-slate-500 mb-3 leading-relaxed">
                    Describe dónde quieres ver tu producto. Sé creativo. 
                    <br/><span className="text-xs opacity-70">El sistema respetará la identidad visual del objeto Master (P0).</span>
                </p>
                <textarea 
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    className="w-full flex-grow min-h-[160px] p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none text-base text-slate-700 dark:text-slate-200 placeholder:text-slate-400 leading-relaxed resize-none transition-all"
                    placeholder="Ej: El producto está situado sobre una mesa de madera rústica en una terraza soleada. Hay sombras de hojas de árboles proyectadas suavemente..."
                />
            </div>
          </Card>

      </div>
    </div>
  );
};

export default UploadPage;
