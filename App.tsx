
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, ProductImage, PreflightData, SimpleGenerationResult } from './types';
import UploadPage from './components/UploadPage';
import PreflightPage from './components/PreflightPage';
import GeneratingPage from './components/GeneratingPage';
import ResultsPage from './components/ResultsPage';
import { Header } from './components/common/Header';
import { analyzeProductImage, generateLifestyleImageSimple, editLifestyleImageSimple } from './services/geminiService';
import { SafeBoundary } from './components/SafeBoundary';

const App: React.FC = () => {
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  
  // Data State
  const [images, setImages] = useState<ProductImage[]>([]);
  const [scenePrompt, setScenePrompt] = useState('');
  
  // Multi-Master Analysis State
  const [preflightProducts, setPreflightProducts] = useState<PreflightData[]>([]);
  const [isPreflightDirty, setIsPreflightDirty] = useState(false);

  const [result, setResult] = useState<SimpleGenerationResult | null>(null);
  
  // UI State
  const [statusMessage, setStatusMessage] = useState('');
  const lastActionRef = React.useRef<() => Promise<void>>(null);

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
              
              // Map analyses to PreflightData structures with linked ID (if needed, though we use index)
              const products: PreflightData[] = analyses.map((a, idx) => ({
                  id: masters[idx].id,
                  object_name_es: a.object_name_es,
                  material_finish_es: a.material_finish_es,
                  alto_cm: a.alto_cm,
                  ancho_cm: a.ancho_cm,
                  profundidad_cm: a.profundidad_cm
              }));

              setPreflightProducts(products);
              setIsPreflightDirty(false);
              setAppState(AppState.PREFLIGHT);

          } catch (e: any) {
              console.error(e);
              const msg = e.message || String(e);
              const isNotFound = msg.includes('Requested entity was not found');
              if (msg.includes('403') || msg.includes('permission') || msg.includes('API_KEY') || isNotFound) {
                  handleApiKeyError(isNotFound);
              }
              setStatusMessage(`Error: ${msg}`);
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
              // Pass the array of product data
              const genResult = await generateLifestyleImageSimple(masterFiles, extras, preflightProducts, promptToUse);
              
              setResult({
                  imageUrl: URL.createObjectURL(genResult.imageBlob),
                  imageBlob: genResult.imageBlob,
                  width: genResult.width,
                  height: genResult.height,
                  promptUsed: genResult.promptUsed
              });
              setAppState(AppState.RESULTS);
          } catch (e: any) {
              console.error(e);
              const msg = e.message || String(e);
              const isNotFound = msg.includes('Requested entity was not found');
              if (msg.includes('403') || msg.includes('permission') || msg.includes('API_KEY') || isNotFound) {
                  handleApiKeyError(isNotFound);
              }
              setStatusMessage(`Error: ${msg}`);
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
              const masterFiles = masters.map(m => m.file);
              const editResult = await editLifestyleImageSimple(
                  masterFiles,
                  result.imageBlob,
                  preflightProducts,
                  changes,
                  result.promptUsed
              );

              setResult({
                  imageUrl: URL.createObjectURL(editResult.imageBlob),
                  imageBlob: editResult.imageBlob,
                  width: editResult.width,
                  height: editResult.height,
                  promptUsed: editResult.promptUsed
              });
              setAppState(AppState.RESULTS);

          } catch (e: any) {
              console.error(e);
               const msg = e.message || String(e);
              const isNotFound = msg.includes('Requested entity was not found');
              if (msg.includes('403') || isNotFound) handleApiKeyError(isNotFound);
              setStatusMessage(`Error edición: ${msg}`);
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
          case AppState.RESULTS:
              if (!result) return null;
              return (
                  <ResultsPage 
                    result={result} 
                    onEdit={handleEdit} 
                    isEditing={false} 
                    onRestart={handleStartOver}
                    onGenerateNew={handleGenerateNewPrompt}
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
      else if (appState === AppState.PREFLIGHT) handleGenerate();
  };

  const handleBackClick = () => {
      if (appState === AppState.PREFLIGHT) setAppState(AppState.UPLOAD);
      if (appState === AppState.RESULTS) handleStartOver();
  };
  
  const getNextLabel = () => {
      if (appState === AppState.PREFLIGHT && isPreflightDirty) return 'Actualizar y generar';
      return undefined; // default behavior
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
        />
        
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
