import React from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { SparklesIcon } from './icons';

interface HomePageProps {
  onStartImage: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onStartImage }) => {
  return (
    <Card className="max-w-2xl mx-auto text-center">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">Generador de Imágenes de E-commerce</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Crea fotos de lifestyle de alta calidad para tus productos en diferentes escenas y estilos con el poder de la IA.
      </p>
      <div className="mt-10">
        <Button onClick={onStartImage} className="px-8 py-4 text-xl font-bold">
            <SparklesIcon className="w-6 h-6 mr-2" />
            Comenzar a Crear Imágenes
        </Button>
      </div>
    </Card>
  );
};

export default HomePage;
