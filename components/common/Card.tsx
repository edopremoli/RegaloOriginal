
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`bg-white dark:bg-slate-800/90 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-700/60 p-6 md:p-8 ${className}`}>
      {children}
    </div>
  );
};
