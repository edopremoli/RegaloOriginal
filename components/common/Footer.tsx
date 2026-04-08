
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-10 border-t border-slate-200 dark:border-slate-800 py-6 text-center">
      <div className="container mx-auto px-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()}{" "}
          <a href="https://www.regalooriginal.com" target="_blank" rel="noreferrer"
             className="underline decoration-dotted hover:text-slate-800 dark:hover:text-slate-200">
            Regalo Original
          </a>
          {" · "}
          <span className="whitespace-nowrap">Made with 💚 by{" "}
            <a href="https://edopremoli.com" target="_blank" rel="noreferrer"
               className="underline decoration-dotted hover:text-slate-800 dark:hover:text-slate-200">
              Edo Premoli
            </a>
          </span>
        </p>
      </div>
    </footer>
  );
};
