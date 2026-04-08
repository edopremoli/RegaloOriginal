import React from "react";
import { assetUrl } from '../../utils/assetUrl.ts';

export default function BrandMark({ mono=false, className="" }: {mono?: boolean; className?: string}) {
  const src = assetUrl(mono ? 'brand/ro-mark-mono.svg' : 'brand/ro-logo.svg');
  return <img src={src} alt="Regalo Original" className={`h-6 w-auto ${className}`} />;
}