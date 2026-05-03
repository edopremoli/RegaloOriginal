
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, ProductImage, PreflightData, SimpleGenerationResult, ImageGenerationModel, OutputPresetId, PRESET_OPTIONS, MODEL_OPTIONS } from './types';
import UploadPage from './components/UploadPage';
import PreflightPage from './components/PreflightPage';
import GeneratingPage from './components/GeneratingPage';
import ResultsPage from './components/ResultsPage';
import ConfigPage from './components/ConfigPage';
import { Header } from './components/common/Header';
import { analyzeProductImage, generateLifestyleImageSimple, editLifestyleImageSimple, parseDimensionsFromPrompt } from './services/geminiService';
import { SafeBoundary } from './components/SafeBoundary';
import { logGenerationUsage } from './utils/usageTracker';
import { UsageModal } from './components/UsageModal';

const App: React.FC = () => {
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  
  // Data State
  const [images, setImages] = useState<ProductImage[]>([]);
  const [scenePrompt, setScenePrompt] = useState('');
  
  // Multi-Master Analysis State
  const [preflightProducts, setPreflightProducts] = useState<PreflightData[]>([]);
  const [isPreflightDirty, setIsPreflightDirty] = useState(false);

  const [result, setResult] = useState<SimpleGenerationResult | null>(null);
  const [selectedModel, setSelectedModel] = useState<ImageGenerationModel>('gemini-3.1-flash-image-preview');
  const [selectedPreset, setSelectedPreset] = useState<OutputPresetId>('web_ro');
  
  // UI State
  const [statusMessage, setStatusMessage] = useState('');
  const lastActionRef = React.useRef<() => Promise<void>>(null);

  // Auto-parse dimensions from prompt
  useEffect(() => {
    if (appState === AppState.UPLOAD && getMasterImages().length === 1 && scenePrompt.length > 10) {
        // This is just to ensure it's reactive, but the real merge happens in handleAnalyze
    }
  }, [scenePrompt, appState, images]);

  // Priority 1: Fix Loading Bug
  useEffect(() => {
    setApiKeyReady(true);
  }, []);

  const handleApiKeyError = useCallback(async (isNotFound = false) => {
    try {
        // @ts-ignore
        if (window.aistudio && window.aistudio.openSelectKey) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
        } else {
            alert("API Key error. Please check your AI Studio configuration.");
        }
    } catch(e) {
        console.error("Failed to open key selector", e);
    }
  }, []);

  const handleRetry = async () => {
      if (lastActionRef.current) {
          await lastActionRef.current();
      }
  };

  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && window.aistudio.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }
    } catch (e) {
      console.error("Failed to open key selector", e);
    }
  };

  const getMasterImages = () => images.filter(i => i.isMaster);

  const handleUpdateProduct = (index: number, patch: Partial<PreflightData>) => {
      setIsPreflightDirty(true);
      setPreflightProducts(prev => {
          const next = [...prev];
          if (next[index]) {
              next[index] = { ...next[index], ...patch };
          }
          return next;
      });
  };

  // --- ACTIONS ---

  const handleAnalyze = async () => {
      const action = async () => {
          const masters = getMasterImages();
          if (masters.length === 0) {
              alert("Debes seleccionar al menos una imagen Master.");
              return;
          }

          setAppState(AppState.ANALYZING);
          setStatusMessage(masters.length > 1 
              ? `Analizando ${masters.length} imágenes Master...` 
              : "Analizando imagen Master... Por favor espera.");
          
          try {
              // Analyze ALL master images concurrently
              const analyses = await Promise.all(masters.map(m => analyzeProductImage(m.file)));
              
              // Map analyses to PreflightData structures
              const products: PreflightData[] = analyses.map((a, idx) => {
                  const baseData = {
                      id: masters[idx].id,
                      object_name_es: a.object_name_es,
                      material_finish_es: a.material_finish_es,
                      alto_cm: a.alto_cm,
                      ancho_cm: a.ancho_cm,
                      profundidad_cm: a.profundidad_cm,
                      dimension_profile: a.dimension_profile
                  };

                  // If it's a single product scenario, try to override with prompt dimensions
                  if (masters.length === 1) {
                      const promptDims = parseDimensionsFromPrompt(scenePrompt);
                      if (promptDims) {
                          return { ...baseData, ...promptDims };
                      }
                  }
                  return baseData;
              });

              setPreflightProducts(products);
              setIsPreflightDirty(false);
              setAppState(AppState.PREFLIGHT);

          } catch (e: any) {
              console.error(e);
              const msg = e.message || String(e);
              const isNotFound = msg.includes('Requested entity was not found') || msg.includes('not found');
              const isPermission = msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('permission') || msg.includes('API_KEY');
              const isUnavailable = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
              
              if (isPermission || isNotFound) {
                  handleApiKeyError(isNotFound);
              }
              
              if (isUnavailable) {
                  setStatusMessage("El servicio está experimentando una alta demanda. Por favor, espera un momento e inténtalo de nuevo.");
              } else {
                  setStatusMessage(`Error: ${msg}`);
              }
          }
      };
      // @ts-ignore
      lastActionRef.current = action;
      await action();
  };

  const handleGenerate = async (overridePrompt?: string) => {
      const action = async () => {
          const masters = getMasterImages();
          if (masters.length === 0 || preflightProducts.length === 0) return;

          setAppState(AppState.GENERATING);
          setIsPreflightDirty(false); // Reset dirty flag on generate
          setStatusMessage("Generando imagen de escena... Esto puede tardar unos segundos.");
          
          const promptToUse = overridePrompt || scenePrompt;

          try {
              const extras = images.filter(i => !i.isMaster);
              const masterFiles = masters.map(m => m.file);
              const preset = PRESET_OPTIONS.find(p => p.id === selectedPreset) || PRESET_OPTIONS[0];
              const currentModelOpts = MODEL_OPTIONS.find(m => m.id === selectedModel) || MODEL_OPTIONS[0];

              // Pass the array of product data
              const genResult = await generateLifestyleImageSimple(masterFiles, extras, preflightProducts, promptToUse, getMasterImages(), selectedModel, preset.aspectRatio, preset.id, currentModelOpts.sizeInternal);
              
              const attempts = genResult.debugInfo?.generatedImageAttempts || 1;
              logGenerationUsage({
                  operation: "generate",
                  modelId: selectedModel,
                  modelLabel: currentModelOpts.label,
                  presetId: selectedPreset,
                  aspectRatioRequested: preset.aspectRatio,
                  sizeInternalRequested: currentModelOpts.sizeInternal,
                  estimatedCostUsd: currentModelOpts.basePrice * attempts,
                  actualWidth: genResult.width,
                  actualHeight: genResult.height,
                  retryCount: genResult.debugInfo?.retries,
                  generatedImageAttempts: attempts
              });

              setResult({
                  imageUrl: URL.createObjectURL(genResult.imageBlob),
                  imageBlob: genResult.imageBlob,
                  width: genResult.width,
                  height: genResult.height,
                  promptUsed: genResult.promptUsed,
                  baseScenePrompt: genResult.baseScenePrompt,
                  debugInfo: genResult.debugInfo
              });
              setAppState(AppState.RESULTS);
          } catch (e: any) {
              console.error(e);
              const msg = e.message || String(e);
              const isNotFound = msg.includes('Requested entity was not found') || msg.includes('not found');
              const isPermission = msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('permission') || msg.includes('API_KEY');
              const isUnavailable = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
              
              if (isPermission || isNotFound) {
                  handleApiKeyError(isNotFound);
              }
              
              if (isUnavailable) {
                  setStatusMessage("El servicio está experimentando una alta demanda. Por favor, espera un momento e inténtalo de nuevo.");
              } else {
                  setStatusMessage(`Error: ${msg}`);
              }
          }
      };
      // @ts-ignore
      lastActionRef.current = action;
      await action();
  };

  const handleGenerateNewPrompt = (newPrompt: string) => {
      setScenePrompt(newPrompt);
      handleGenerate(newPrompt);
  };

  const handleEdit = async (changes: string) => {
      const action = async () => {
          const masters = getMasterImages();
          if (masters.length === 0 || preflightProducts.length === 0 || !result) return;
          
          setAppState(AppState.GENERATING);
          setStatusMessage("Regenerando edición completa...");

          try {
              const extras = images.filter(i => !i.isMaster);
              const masterFiles = masters.map(m => m.file);
              const preset = PRESET_OPTIONS.find(p => p.id === selectedPreset) || PRESET_OPTIONS[0];
              const currentModelOpts = MODEL_OPTIONS.find(m => m.id === selectedModel) || MODEL_OPTIONS[0];

              const editResult = await editLifestyleImageSimple(
                  masterFiles,
                  result.imageBlob,
                  preflightProducts,
                  changes,
                  result.baseScenePrompt || result.promptUsed,
                  extras,
                  masters,
                  selectedModel,
                  preset.aspectRatio,
                  preset.id,
                  currentModelOpts.sizeInternal
              );

              const attempts = editResult.debugInfo?.generatedImageAttempts || 1;
              logGenerationUsage({
                  operation: "edit",
                  modelId: selectedModel,
                  modelLabel: currentModelOpts.label,
                  presetId: selectedPreset,
                  aspectRatioRequested: preset.aspectRatio,
                  sizeInternalRequested: currentModelOpts.sizeInternal,
                  estimatedCostUsd: currentModelOpts.basePrice * attempts,
                  actualWidth: editResult.width,
                  actualHeight: editResult.height,
                  retryCount: editResult.debugInfo?.retryCount,
                  generatedImageAttempts: attempts
              });

              setResult({
                  imageUrl: URL.createObjectURL(editResult.imageBlob),
                  imageBlob: editResult.imageBlob,
                  width: editResult.width,
                  height: editResult.height,
                  promptUsed: editResult.promptUsed,
                  baseScenePrompt: editResult.baseScenePrompt,
                  lastEditChanges: editResult.lastEditChanges,
                  debugInfo: editResult.debugInfo
              });
              setAppState(AppState.RESULTS);

          } catch (e: any) {
              console.error(e);
              const msg = e.message || String(e);
              const isNotFound = msg.includes('Requested entity was not found') || msg.includes('not found');
              const isPermission = msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('permission') || msg.includes('API_KEY');
              const isUnavailable = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
              
              if (isPermission || isNotFound) {
                  handleApiKeyError(isNotFound);
              }
              
              if (isUnavailable) {
                  setStatusMessage("El servicio de edición está saturado. Por favor, reintenta en unos segundos.");
              } else {
                  setStatusMessage(`Error edición: ${msg}`);
              }
          }
      };
      // @ts-ignore
      lastActionRef.current = action;
      await action();
  };

  const handleStartOver = () => {
      setImages([]);
      setScenePrompt('');
      setPreflightProducts([]);
      setIsPreflightDirty(false);
      setResult(null);
      setAppState(AppState.UPLOAD);
  };

  // --- RENDER HELPERS ---

  const renderContent = () => {
      switch (appState) {
          case AppState.UPLOAD:
              return (
                  <UploadPage 
                    images={images} 
                    setImages={setImages} 
                    scenePrompt={scenePrompt} 
                    setScenePrompt={setScenePrompt} 
                  />
              );
          case AppState.ANALYZING:
          case AppState.GENERATING:
              return <GeneratingPage statusMessage={statusMessage} onRetry={handleRetry} onBack={() => {
                  if (result) setAppState(AppState.RESULTS);
                  else if (preflightProducts.length > 0) setAppState(AppState.PREFLIGHT);
                  else setAppState(AppState.UPLOAD);
              }} />;
          case AppState.PREFLIGHT:
              const masters = getMasterImages();
              if (masters.length === 0 || preflightProducts.length === 0) return null;
              return (
                  <PreflightPage 
                    masterImages={masters} 
                    preflightProducts={preflightProducts}
                    onProductChange={handleUpdateProduct} 
                  />
              );
          case AppState.CONFIG:
              return (
                  <ConfigPage 
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    selectedPreset={selectedPreset}
                    onPresetChange={setSelectedPreset}
                    onGenerate={() => handleGenerate()}
                    onBack={() => setAppState(AppState.PREFLIGHT)}
                  />
              );
          case AppState.RESULTS:
              if (!result) return null;
              return (
                  <ResultsPage 
                    result={result} 
                    onEdit={handleEdit} 
                    isEditing={false} 
                    onRestart={handleStartOver}
                    onGenerateNew={handleGenerateNewPrompt}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    selectedPreset={selectedPreset}
                    onPresetChange={setSelectedPreset}
                  />
              );
          default:
              return null;
      }
  };

  const isNextDisabled = () => {
      if (appState === AppState.UPLOAD) {
          return getMasterImages().length === 0;
      }
      if (appState === AppState.PREFLIGHT) {
          // Block generate if any required field is empty
          return preflightProducts.some(p => !p.object_name_es.trim());
      }
      return false; 
  };

  const handleNextClick = () => {
      if (appState === AppState.UPLOAD) handleAnalyze();
      else if (appState === AppState.PREFLIGHT) setAppState(AppState.CONFIG);
      else if (appState === AppState.CONFIG) handleGenerate();
  };

  const handleBackClick = () => {
      if (appState === AppState.PREFLIGHT) setAppState(AppState.UPLOAD);
      else if (appState === AppState.CONFIG) setAppState(AppState.PREFLIGHT);
      else if (appState === AppState.RESULTS) handleStartOver();
  };
  
  const getNextLabel = () => {
      if (appState === AppState.PREFLIGHT) return 'Continuar';
      if (appState === AppState.CONFIG) return 'Generar Imagen';
      return undefined; 
  };

  // --- MAIN RENDER ---

  if (!apiKeyReady) {
     return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading Application...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        <Header 
            appState={appState}
            onHome={handleStartOver}
            onNext={handleNextClick}
            onBack={handleBackClick}
            isNextDisabled={isNextDisabled()}
            nextLabel={getNextLabel()}
            onShowUsage={() => setIsUsageModalOpen(true)}
        />
        
        <UsageModal isOpen={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} />
        
        {/* Increased bottom padding to accommodate fixed footer */}
        <main className="flex-grow container mx-auto px-4 py-8 pb-32">
            <SafeBoundary>
                {renderContent()}
            </SafeBoundary>
        </main>
        
        {/* Footer removed, now integrated in Header/Persistent Bottom Bar */}
    </div>
  );
};

export default App;
