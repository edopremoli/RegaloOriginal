
import React from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';

interface GeneratingPageProps {
    statusMessage: string;
    onBack?: () => void;
    onRetry?: () => void;
}

const GeneratingPage: React.FC<GeneratingPageProps> = ({ statusMessage, onBack, onRetry }) => {
    const isError = statusMessage.toLowerCase().startsWith('error:');

    return (
        <Card className="max-w-md mx-auto text-center">
            {!isError ? (
                <>
                    <div className="flex items-center justify-center text-brand-primary font-semibold text-lg">
                        <svg className="animate-spin h-8 w-8 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-2xl ml-3 text-slate-800 dark:text-slate-200">Please Wait...</span>
                    </div>
                    <p className="mt-4 text-slate-600 dark:text-slate-400 min-h-[2em]">{statusMessage}</p>
                    <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                        <div className="bg-brand-light h-2.5 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                    </div>
                </>
            ) : (
                <div>
                    <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">An Error Occurred</h2>
                    <p className="mt-4 text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-md break-words font-mono text-sm">{statusMessage}</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                        {onRetry && (
                            <Button onClick={onRetry} variant="primary">
                                Retry Generation
                            </Button>
                        )}
                        {onBack && (
                            <Button onClick={onBack} variant="secondary">
                                Back to Configure
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
};


export default GeneratingPage;
