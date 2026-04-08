import React from 'react';

export type Prod = {
  id: string; name: string; thumb?: string;
  dimensions_mm?: {w:number;h:number;d:number};
  rigidity?: string; transparency?: "opaque"|"translucid"|"transparent";
  include: boolean; hero: boolean;
};

export function MultiProductPanel({
  items, onChange
}:{
  items: Prod[];
  onChange: (next: Prod[])=>void;
}) {
  const setInclude = (id: string, v: boolean) => {
    const next = items.map(p => {
        if (p.id === id) {
            const newP = { ...p, include: v };
            if (!v) {
                newP.hero = false; // Can't be hero if not included
            }
            return newP;
        }
        return p;
    });
    onChange(next);
  };
  
  const setHero = (id: string) => {
    // setting a hero should also include it.
    const next = items.map(p => ({ ...p, hero: p.id === id, include: p.include || p.id === id }));
    onChange(next);
  };
  
  const someIncluded = items.some(p=>p.include);
  const heroOk = !!items.find(p=>p.hero);
  
  return (
    <div className="space-y-3">
      {items.map(p=>(
        <div key={p.id} className="flex items-center gap-3 rounded-xl border dark:border-slate-700 p-3">
          {p.thumb && <img src={p.thumb} className="h-12 w-12 rounded object-cover" alt={p.name} />}
          <div className="min-w-0 grow">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs opacity-70">
              {p.dimensions_mm ? `${p.dimensions_mm.w}×${p.dimensions_mm.h}×${p.dimensions_mm.d} mm · ` : ""}
              {p.rigidity ?? "rigidity?"} · {p.transparency ?? "transparency?"}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={p.include} onChange={e=>setInclude(p.id,e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-light" />
            <span>Incluir</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="hero" checked={p.hero} onChange={()=>setHero(p.id)} disabled={!p.include} className="h-4 w-4 border-gray-300 text-brand-primary focus:ring-brand-light disabled:opacity-50" />
            <span>Héroe</span>
          </label>
        </div>
      ))}
      <div className="flex items-center justify-end">
        <div className="text-sm">
          {!someIncluded && <span className="text-amber-500">Selecciona al menos un producto.</span>}
          {someIncluded && !heroOk && <span className="text-amber-500">Elige un héroe.</span>}
        </div>
      </div>
    </div>
  );
}