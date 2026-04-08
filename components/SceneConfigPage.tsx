import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  ProductImage, SceneConfig, GenerationResult, QAReport, ProductAnalysis, 
  Orientation, Plane, Angle, Aesthetic, AspectRatioVal,
  HumanType, Season, LocationCategory, SpecificLocation, HUMAN_TYPES, HUMAN_LABELS, AESTHETICS, SEASONS, SkinDetail, ExportReport, ExportDetails, SlotConfig,
  AgeGroup, Gender, HumanBlock, AGE_GROUPS, GENDERS, ANGLES, LOCATION_PRESETS, SPECIAL_OCCASIONS, SpecialOccasion, GenerationSlot,
  REFERENCE_USE_OPTIONS, REFERENCE_USE_LABELS
} from '../types';
import { generateLifestyleImage, normalizePromptShape } from '../services/geminiService';
import { classifyProduct, getProductRules } from '../services/productRules';
import { Button } from './common/Button';
import { Card } from './common/Card';
import { ExclamationTriangleIcon } from './icons';
import { coverageInSafeArea } from '../utils/safeArea';
import { runQAChecks } from '../ai/qa';

// UI Constants
const PANEL_ACCENTS = {
  style:     { bg:'bg-blue-500/5',    ring:'ring-blue-300/40',    border:'border-blue-500/60' },
  technical: { bg:'bg-amber-500/5',   ring:'ring-amber-300/40',   border:'border-amber-500/60' },
  audience:  { bg:'bg-emerald-500/5', ring:'ring-emerald-300/40', border:'border-emerald-500/60' },
  human:     { bg:'bg-rose-500/5',    ring:'ring-rose-300/40',    border:'border-rose-500/60' },
};

const I18N = {
  sections: { style:'Estilo', technical:'Técnico', audience: 'Audiencia', human:'Presencia Humana' },
  categories: {
    Home:'Casa', Outdoors:'Exterior', 'Public/Commercial':'Público / Comercial'
  },
  specific: {
    'Living Room':'Salón','Kitchen':'Cocina','Bedroom':'Dormitorio','Bathroom':'Baño',
    'Home Office':'Despacho en casa','Park':'Parque','Sports field':'Campo deportivo',
    'Street':'Calle','Restaurant/Café/Bar':'Restaurante/Cafetería','Office':'Oficina',
    'School (classroom)':'Colegio / Aula'
  },
  angle: { frontal:'Frontal','45°':'45°', zenithal:'Zenital', contrapicado: 'Contrapicado' },
};

const OCCASIONS_CONFIG: Array<{id: SpecialOccasion, label: string, hint: string}> = [
  { id: 'Christmas',  label: 'Navidad',     hint: 'Decoración festiva, luces cálidas, pero manteniendo el producto como protagonista.' },
  { id: "Valentine's Day",  label: 'San Valentín', hint: 'Toques románticos sutiles, como rosas suaves, rojos o elementos florales de fondo.' },
  { id: 'Halloween',   label: 'Halloween',   hint: 'Espeluznante pero con estilo. Piensa en calabazas, colores otoñales, no en sangre.' },
  { id: 'Birthday',   label: 'Cumpleaños',  hint: 'Ambiente de celebración con toques de regalos, tarta o globos, dispuestos con buen gusto.' },
  { id: 'Wedding',    label: 'Boda',
    hint: "Toque nupcial sutil y elegante: paleta blancos/marfil con verde natural, textiles finos y vajilla discreta; pequeños guiños (ramo, lazo de seda, anillos desenfocados). Sin purpurina, confeti, rótulos ‘Mr & Mrs’ ni decoración recargada. Mantén look e-commerce limpio."
  },
];

const BLOCKING_FAILS = ['contact_shadows_missing', 'refraction_missing', 'hand_integration_fail', 'edge_halo', 'matte_contam'];
const ZENITHAL_BLOCKING_FAILS = ['vanishing_point', 'horizon_present', 'side_face_visible', 'plane_tilted', 'lateral_shadow'];


interface SceneConfigPageProps {
  productImages: ProductImage[];
  productAnalyses: ProductAnalysis[];
  onGenerateStart: (config: SceneConfig, status: string) => void;
  onSuccess: (result: GenerationResult) => void;
  onStatusUpdate: (status: string) => void;
  initialConfig: SceneConfig | null;
  isAnalysisDirty?: boolean;
  onApiKeyError?: () => void;
}

const DEFAULT_CONFIG: SceneConfig = {
  locationCategory: 'Home',
  specificLocation: 'Living Room',
  aesthetic: 'generic',
  season: 'No Preference',
  audience: { age: 'Adult', gender: 'Unisex' },
  
  plane: 'close',
  angle: 'frontal',
  orientation: 'horizontal',
  aspectRatio: '1:1',
  customRatio: 1,

  human: { enabled:false, type:'hand', count:1, skinDetail:'Balanced' },
  specialOccasions: [],
  
  referenceImage: null,
  referenceUse: ['palette', 'mood'],
  referenceNote: '',

  slotConfigs: [
    { enabled:true, seedOffset:0   }, // Image 1 (Main)
    { enabled:false, seedOffset:101 },// Image 2
    { enabled:false, seedOffset:202 },// Image 3
  ],
  
  override: { enabled: false, referenceImage: null },
};

interface SectionCardProps {
  kind: 'style' | 'technical' | 'human' | 'audience';
  title: string;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ kind, title, children }) => {
  const a = PANEL_ACCENTS[kind];
  return (
    <section className={`rounded-lg ${a.bg} ring-1 ${a.ring} border-l-4 ${a.border} shadow-sm`}>
      <h3 className="px-4 pt-3 text-sm font-semibold">{title}</h3>
      <div className="p-4">{children}</div>
    </section>
  );
}

const SlotOverridesForm: React.FC<{ 
  slot: SlotConfig, 
  onUpdate: (patch: Partial<SlotConfig>) => void, 
  mainConfig: SceneConfig, 
  index: number 
}> = ({ slot, onUpdate, mainConfig, index }) => {
  const effectiveCategory = slot.locationCategory || mainConfig.locationCategory;

  const selectedLocations = useMemo(() => {
    const preset = LOCATION_PRESETS.find(p => p.category === effectiveCategory);
    return preset ? preset.specific.map(s => ({ value: s, label: I18N.specific[s as keyof typeof I18N.specific] || s })) : [];
  }, [effectiveCategory]);

  const handleLocationCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value as LocationCategory;
    const preset = LOCATION_PRESETS.find(p => p.category === category);
    const firstSpecificLocation = preset ? preset.specific[0] as SpecificLocation : null;
    onUpdate({ locationCategory: category, specificLocation: firstSpecificLocation });
  };

  const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    onUpdate({ referenceImage: file || undefined });
  };

  const handleReferenceUseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    const key = value as typeof REFERENCE_USE_OPTIONS[number];
    const currentUse = slot.referenceUse ?? mainConfig.referenceUse ?? [];
    const newUse = checked ? [...currentUse, key] : currentUse.filter(k => k !== key);
    onUpdate({ referenceUse: newUse });
  };

  const currentHumanConfig = slot.human ?? mainConfig.human;
  const currentAudienceConfig = slot.audience ?? mainConfig.audience;
  const currentOccasions = slot.specialOccasions ?? mainConfig.specialOccasions ?? [];

  const handleOccasionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    const newOccasions = checked
      ? [...currentOccasions, value as SpecialOccasion]
      : currentOccasions.filter(o => o !== value);
    onUpdate({ specialOccasions: newOccasions });
  };

  return (
    <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg space-y-4">
      <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300">Sobrescribir Imagen {index}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Audience */}
        <div className="md:col-span-2">
            <label className="block text-sm font-medium">Audiencia</label>
            <div className="flex gap-2">
                <select value={currentAudienceConfig.age} onChange={e => onUpdate({ audience: { ...currentAudienceConfig, age: e.target.value as AgeGroup }})} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                    {AGE_GROUPS.map(o => <option key={o}>{o}</option>)}
                </select>
                <select value={currentAudienceConfig.gender} onChange={e => onUpdate({ audience: { ...currentAudienceConfig, gender: e.target.value as Gender }})} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                    {GENDERS.map(o => <option key={o}>{o}</option>)}
                </select>
            </div>
        </div>

        {/* Style */}
        <div>
            <label className="block text-sm font-medium">Categoría de Ubicación</label>
            <select value={effectiveCategory} onChange={handleLocationCategoryChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                {LOCATION_PRESETS.map(p => <option key={p.category} value={p.category}>{I18N.categories[p.category]}</option>)}
            </select>
        </div>
        <div>
            <label className="block text-sm font-medium">Ubicación Específica</label>
            <select value={slot.specificLocation || mainConfig.specificLocation || ''} onChange={e => onUpdate({ specificLocation: e.target.value ? e.target.value as SpecificLocation : null })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                {selectedLocations.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
        <div>
            <label className="block text-sm font-medium">Estética</label>
            <select value={slot.aesthetic || mainConfig.aesthetic} onChange={e => onUpdate({ aesthetic: e.target.value as Aesthetic })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                {AESTHETICS.map(o => <option key={o.value} value={o.value} title={o.tooltip}>{o.label}</option>)}
            </select>
        </div>
        <div>
            <label className="block text-sm font-medium">Estación</label>
            <select value={slot.season || mainConfig.season} onChange={e => onUpdate({ season: e.target.value as Season })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                {SEASONS.map(o => <option key={o.value} value={o.value} title={'tooltip' in o ? o.tooltip : undefined}>{o.label}</option>)}
            </select>
        </div>
        <div className="md:col-span-2">
            <label className="block text-sm font-medium">Ocasiones Especiales</label>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                {OCCASIONS_CONFIG.map(occ => (
                    <label key={occ.id} className="flex items-center text-sm" title={occ.hint}>
                        <input type="checkbox" value={occ.id} checked={currentOccasions.includes(occ.id)} onChange={handleOccasionsChange} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-light" />
                        <span className="ml-2">{occ.label}</span>
                    </label>
                ))}
            </div>
        </div>
        <div className="md:col-span-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium mb-2">Referencia de Estilo (Opcional)</h4>
            <div>
                <label className="block text-sm font-medium">Imagen de Referencia</label>
                <input type="file" onChange={handleReferenceImageChange} accept="image/*" className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/50 dark:file:text-blue-200 dark:hover:file:bg-blue-900"/>
                {(slot.referenceImage || mainConfig.referenceImage) && <span className="text-xs text-slate-500 mt-1 block">Seleccionado: {(slot.referenceImage || mainConfig.referenceImage)!.name}</span>}
            </div>
            {(slot.referenceImage || mainConfig.referenceImage) && (
                <div className="mt-4">
                    <label className="block text-sm font-medium">Usar referencia para:</label>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {REFERENCE_USE_OPTIONS.map(opt => (
                            <label key={opt} className="flex items-center text-sm">
                                <input type="checkbox" value={opt} checked={(slot.referenceUse ?? mainConfig.referenceUse ?? []).includes(opt)} onChange={handleReferenceUseChange} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-light" />
                                <span className="ml-2">{REFERENCE_USE_LABELS[opt]}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
            {(slot.referenceImage || mainConfig.referenceImage) && (
                <div className="mt-4">
                    <label className="block text-sm font-medium">Nota de estilo (opcional)</label>
                    <textarea 
                        rows={2} 
                        value={slot.referenceNote ?? mainConfig.referenceNote ?? ''} 
                        onChange={e => onUpdate({ referenceNote: e.target.value })}
                        maxLength={120} 
                        className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" 
                        placeholder="e.g., focus on the warm tones"
                    />
                </div>
            )}
        </div>

        {/* Technical */}
        <div>
          <label className="block text-sm font-medium">Ángulo</label>
          <select value={slot.angle || mainConfig.angle} onChange={e => onUpdate({ angle: e.target.value as Angle })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
              {ANGLES.map(o => <option key={o} value={o}>{I18N.angle[o]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Plano</label>
          <select value={slot.plane || mainConfig.plane} onChange={e => onUpdate({ plane: e.target.value as Plane })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
              {(['close', 'medium', 'wide'] as Plane[]).map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        </div>
        
        {/* Human */}
        <div className="md:col-span-2">
            <div className="pt-2">
              <label className="block text-sm font-medium">Elemento Humano</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="checkbox"
                  checked={currentHumanConfig.enabled}
                  onChange={e => onUpdate({ human: { ...currentHumanConfig, enabled: e.target.checked }})}
                  className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-light"
                />
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow transition-opacity ${currentHumanConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                   <select 
                      value={currentHumanConfig.type} 
                      onChange={e => onUpdate({ human: { ...currentHumanConfig, type: e.target.value as HumanType } })} 
                      disabled={!currentHumanConfig.enabled} 
                      className="block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm"
                   >
                        {HUMAN_TYPES.map(t => <option key={t} value={t}>{HUMAN_LABELS[t]}</option>)}
                    </select>
                    <input 
                      type="number" 
                      min="1" max="5" 
                      value={currentHumanConfig.count} 
                      onChange={e => onUpdate({ human: { ...currentHumanConfig, count: parseInt(e.target.value) || 1 } })} 
                      disabled={!currentHumanConfig.enabled} 
                      className="block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm"
                    />
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const SceneConfigPage: React.FC<SceneConfigPageProps> = ({ 
  productImages, 
  productAnalyses, 
  onGenerateStart, 
  onSuccess, 
  onStatusUpdate, 
  initialConfig,
  isAnalysisDirty,
  onApiKeyError 
}) => {
  const [config, setConfig] = useState<SceneConfig>(initialConfig || DEFAULT_CONFIG);
  const [imageCount, setImageCount] = useState<number>(1);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (initialConfig && initialConfig.slotConfigs) {
      const enabledCount = initialConfig.slotConfigs.filter(s => s.enabled).length;
      setImageCount(enabledCount > 0 ? enabledCount : 1);
    }
  }, [initialConfig]);

  // Sync slotConfigs with imageCount
  useEffect(() => {
    setConfig(prev => {
      const currentSlots = prev.slotConfigs || [];
      // Ensure we have enough slots in the array (up to 3)
      const filledSlots = [...currentSlots];
      while (filledSlots.length < 3) {
        filledSlots.push({ enabled: false, seedOffset: filledSlots.length * 100 });
      }
      
      const newSlots = filledSlots.map((slot, index) => ({
        ...slot,
        enabled: index < imageCount
      }));
      
      return { ...prev, slotConfigs: newSlots };
    });
  }, [imageCount]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const onUpdateConfig = (updates: Partial<SceneConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateSlot = (index: number) => (patch: Partial<SlotConfig>) => {
    setConfig(prev => {
      const slots = [...(prev.slotConfigs || [])];
      if (slots[index]) {
        slots[index] = { ...slots[index], ...patch };
      }
      return { ...prev, slotConfigs: slots };
    });
  };

  const isGenerateDisabled = isAnalysisDirty || (config.override?.enabled && !config.customPrompt);
  const enabledSlotCount = config.slotConfigs?.filter(s => s.enabled).length || 0;

  const handleGenerate = async () => {
    if (isGenerateDisabled) return;

    onGenerateStart(config, "Preparando generación...");

    try {
      const result = await generateLifestyleImage(productImages, config, productAnalyses);

      const qaReports = await Promise.all(result.outputs.map(async (output, i) => {
         const qa = await runQAChecks(output.masterBlob, result.qaHintsUsed[i]);
         return {
             seed: output.seed,
             prompt_final: result.prompts[i]?.positive || "",
             model_id: 'gemini-2.5-flash-image',
             model_version: 'v1',
             ...qa
         } as QAReport;
      }));

      const generationResult: GenerationResult = {
          imageUrls: result.outputs.map(o => URL.createObjectURL(o.masterBlob)),
          imageBlobs: result.outputs.map(o => o.masterBlob),
          masterWidths: result.outputs.map(o => o.masterWidth),
          masterHeights: result.outputs.map(o => o.masterHeight),
          safeArea: result.safeArea,
          productAnalyses: productAnalyses,
          allPhotos: productImages,
          sceneConfig: config,
          sceneConfigsUsed: result.sceneConfigsUsed,
          generationSlots: result.prompts.map((p, i) => {
              const normalized = normalizePromptShape(p);
              return {
                  slot: i + 1,
                  prompt_positive: normalized.positive?.trim() || "",
                  prompt_negative: normalized.negative?.trim() || "",
                  notes: []
              };
          }),
          qaReports: qaReports,
          exportReports: result.outputs.map(o => ({
              master: {
                  filename_out: o.filename,
                  peso_kb: o.masterBlob.size / 1024,
                  long_edge_px: Math.max(o.masterWidth, o.masterHeight),
                  width_px: o.masterWidth,
                  height_px: o.masterHeight,
                  format: 'JPG',
                  quality: 90,
                  icc_incrustado: true
              }
          })),
          wasCappedArray: result.outputs.map(o => o.wasCapped),
          wasCroppedArray: result.outputs.map(o => o.wasCropped),
      };

      onSuccess(generationResult);
    } catch (err: any) {
        console.error(err);
        
        let errorMessage = '';
        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'string') {
            errorMessage = err;
        } else if (typeof err === 'object' && err !== null) {
            errorMessage = (err as any).message || JSON.stringify(err);
            if (errorMessage === '{}' || errorMessage === '[object Object]') {
                 errorMessage = 'Unknown error occurred';
            }
        } else {
            errorMessage = String(err);
        }

        onStatusUpdate(`Error: ${errorMessage}`);
        
        if (onApiKeyError && (errorMessage.includes('403') || errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED'))) {
            onApiKeyError();
        }
    }
  };

  // Prepare options for dropdowns
  const selectedLocationPreset = LOCATION_PRESETS.find(p => p.category === config.locationCategory);
  const specificLocations = selectedLocationPreset ? selectedLocationPreset.specific.map(s => ({ value: s, label: I18N.specific[s as keyof typeof I18N.specific] || s })) : [];

  const humanConfig = config.human;

  return (
    <Card className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            
            {/* Override Switch */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Modo Prompt Libre</h3>
                    <p className="text-xs text-slate-500">Ignorar configuración y usar solo mi prompt</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={config.override?.enabled || false} onChange={e => onUpdateConfig({ override: { ...config.override, enabled: e.target.checked } })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
                </label>
            </div>

            <div className={`space-y-6 transition-opacity ${config.override?.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Audience */}
              <SectionCard kind="audience" title="Audiencia Objetivo">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Edad</label>
                        <select name="audience.age" value={config.audience.age} onChange={e => onUpdateConfig({ audience: { ...config.audience, age: e.target.value as AgeGroup } })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                            {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Género</label>
                        <select name="audience.gender" value={config.audience.gender} onChange={e => onUpdateConfig({ audience: { ...config.audience, gender: e.target.value as Gender } })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                 </div>
              </SectionCard>

              {/* Style & Environment */}
              <SectionCard kind="style" title="Estilo y Ambiente">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Entorno</label>
                        <select name="locationCategory" value={config.locationCategory} onChange={e => onUpdateConfig({ locationCategory: e.target.value as LocationCategory, specificLocation: null })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                            {LOCATION_PRESETS.map(p => <option key={p.category} value={p.category}>{I18N.categories[p.category]}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ubicación</label>
                        <select name="specificLocation" value={config.specificLocation || ''} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" disabled={!config.locationCategory}>
                            {!config.specificLocation && <option value="">Selecciona...</option>}
                            {specificLocations.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Estética</label>
                        <select name="aesthetic" value={config.aesthetic} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                            {AESTHETICS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Estación</label>
                        <select name="season" value={config.season} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                            {SEASONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                  </div>
              </SectionCard>

              {/* Technical */}
              <SectionCard kind="technical" title="Técnico">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ángulo</label>
                        <select name="angle" value={config.angle} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                            {ANGLES.map(a => <option key={a} value={a}>{I18N.angle[a]}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Plano</label>
                        <select name="plane" value={config.plane} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                            {(['close', 'medium', 'wide'] as Plane[]).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                        </select>
                    </div>
                 </div>
              </SectionCard>

               {/* Human */}
               <SectionCard kind="human" title="Presencia Humana">
                  <div className="flex items-center gap-3 mb-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={humanConfig.enabled} onChange={e => onUpdateConfig({ human: { ...humanConfig, enabled: e.target.checked } })} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
                      </label>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Incluir Modelo</span>
                  </div>
                  <div className={`grid grid-cols-2 gap-4 transition-opacity ${humanConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
                        <select value={humanConfig.type} onChange={e => onUpdateConfig({ human: { ...humanConfig, type: e.target.value as HumanType } })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                            {HUMAN_TYPES.map(t => <option key={t} value={t}>{HUMAN_LABELS[t]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad</label>
                        <input type="number" min={1} max={5} value={humanConfig.count} onChange={e => onUpdateConfig({ human: { ...humanConfig, count: parseInt(e.target.value) || 1 } })} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" />
                      </div>
                  </div>
               </SectionCard>
            </div>
            
             {/* Custom Prompt */}
            <div className="md:col-span-2">
                <label className="block text-sm font-medium">Prompt Personalizado</label>
                <textarea name="customPrompt" id="customPrompt" rows={2} value={config.customPrompt || ''} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm" placeholder="e.g., add a neutral color accent, specify surface material..."></textarea>
            </div>
        </div>
        
        <div className="lg:col-span-1">
            <div className="p-4 border border-slate-300 dark:border-slate-600 rounded-lg sticky top-24">
              <h3 className="text-lg font-semibold mb-2">Espacios de Imagen</h3>
              <div className="mt-2 flex items-center gap-3 mb-4">
                <label className="text-sm font-medium">Número de imágenes</label>
                <select value={imageCount} onChange={e => setImageCount(Number(e.target.value))} className="block rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm">
                    {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                {Array.from({length: imageCount}).map((_, index) => {
                  const imageNumber = index + 1;
                  const slot = config.slotConfigs?.[index];
                  if (!slot) return null;
                  
                  const isOverridden = !!overrides[imageNumber];
                  
                  return (
                    <div key={index} className="p-3 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-800 dark:text-slate-200">Imagen {imageNumber}</label>
                        <div className="flex items-center gap-2">
                            {!isOverridden && index > 0 && !config.override?.enabled && <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">Hereda</span>}
                            {index > 0 && (
                                <label className="text-sm flex items-center gap-1 cursor-pointer" title="Configurar independientemente">
                                    <input
                                        type="checkbox"
                                        checked={isOverridden}
                                        onChange={e => setOverrides(o => ({ ...o, [imageNumber]: e.target.checked }))}
                                        disabled={config.override?.enabled}
                                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-light disabled:opacity-50"
                                    />
                                </label>
                            )}
                        </div>
                      </div>
                      {(isOverridden || index === 0) && !config.override?.enabled && (
                          <SlotOverridesForm 
                            index={imageNumber}
                            slot={slot}
                            onUpdate={updateSlot(index)}
                            mainConfig={config}
                          />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
        </div>
      </div>
      
      {isAnalysisDirty && (
        <div className="mt-6 text-center p-4 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
            <p className="font-bold text-lg flex items-center justify-center gap-2"><ExclamationTriangleIcon className="w-6 h-6" /> Acción Requerida</p>
            <p className="mt-1">Has modificado los detalles del producto. Debes aplicar estos cambios para poder generar imágenes.</p>
            <p className="text-sm mt-1">Por favor, vuelve al paso 'Analizar' y pulsa "Actualizar y seguir".</p>
        </div>
      )}
      {isGenerateDisabled && config.override?.enabled && !config.customPrompt && (
        <div className="mt-6 text-center p-4 rounded-md bg-red-100 dark:red-900/30 text-red-800 dark:text-red-200">
            <p className="font-bold flex items-center justify-center gap-2"><ExclamationTriangleIcon className="w-5 h-5" /> Prompt Personalizado Requerido</p>
            <p className="mt-1 text-sm">Debes rellenar el campo "Prompt Personalizado" cuando el modo de prompt libre está activado.</p>
        </div>
      )}
      <div className="mt-10 text-center">
        <Button onClick={handleGenerate} disabled={isGenerateDisabled || (config.override?.enabled && !config.customPrompt)} className="px-12 py-4 text-xl font-bold">
          Generar {enabledSlotCount} Imagen{enabledSlotCount > 1 ? 'es' : ''}
        </Button>
      </div>
    </Card>
  );
};

export default SceneConfigPage;