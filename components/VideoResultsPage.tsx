import React from 'react';
import { VideoResult } from '../types';
import { Card } from './common/Card';
import { Button } from './common/Button';

interface VideoResultsPageProps {
  result: VideoResult;
  onNewVideo: () => void;
  onStartOver: () => void;
}

const VideoResultsPage: React.FC<VideoResultsPageProps> = ({ result, onNewVideo, onStartOver }) => {
    
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = result.videoUrl;
    a.download = `SKU123_1x1_5s_v1.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
    
  return (
    <Card className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Vídeo Generado</h2>
        <div className="mt-6 aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg shadow-inner overflow-hidden">
            <video 
                src={result.videoUrl}
                poster={result.posterUrl}
                controls 
                autoPlay 
                loop 
                playsInline
                className="w-full h-full object-contain"
            />
        </div>

        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-md text-left text-xs text-slate-600 dark:text-slate-400">
            <h4 className="font-semibold text-sm mb-2">Detalles de Generación</h4>
            <p><strong>Plantilla:</strong> {result.config.template}</p>
            <p><strong>Intensidad:</strong> {result.config.intensity === 'low' ? 'Baja' : 'Media'}</p>
            <p><strong>QA (simulado):</strong> OK (Contour Drift: {result.qaReport.contour_drift_px.toFixed(2)}px)</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Button onClick={handleDownload}>Descargar MP4</Button>
            <Button onClick={onNewVideo} variant="secondary">Probar otra animación</Button>
            <Button onClick={onStartOver} variant="secondary">Empezar de nuevo</Button>
        </div>
    </Card>
  );
};

export default VideoResultsPage;
