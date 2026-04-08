
export interface ProductRules {
  positives: string[];
  negatives: string[];
  params: Record<string, any>;
  qaChecks?: {
    geometry_drift?: boolean;
    text_mismatch?: boolean;
    material_swap?: boolean;
  }
}

const PRODUCT_CLASS_MAP: Record<string, string[]> = {
  'cup': ['cup', 'mug', 'glass', 'taza', 'vaso'],
  'bottle': ['bottle', 'thermos', 'canteen', 'flask', 'botella'],
  'cap': ['cap', 'hat', 'gorra', 'gorro', 'beanie'],
  'clothing': ['t-shirt', 'shirt', 'sweatshirt', 'hoodie', 'garment', 'clothing', 'ropa', 'prenda', 'camiseta'],
  'cushion': ['cushion', 'pillow', 'blanket', 'textile', 'cojín', 'manta'],
  'doormat': ['doormat', 'rug', 'mat', 'alfombra'],
  'wood': ['wood', 'engraved', 'keyring', 'jewelry', 'madera', 'grabado', 'llavero', 'joya'],
  'canvas': ['canvas', 'poster', 'print', 'lienzo', 'impresión'],
  'frame': ['photo frame', 'frame', 'marco de foto'],
  'puzzle': ['puzzle', 'box', 'game', 'juego'],
  'phone_case': ['phone case', 'funda de móvil', 'carcasa'],
  'lamp': ['lamp', 'light', 'lámpara', 'luz'],
};

export function classifyProduct(description: string): string {
  if (!description) return 'generic';
  const lowerDesc = description.toLowerCase();
  for (const className in PRODUCT_CLASS_MAP) {
    if (PRODUCT_CLASS_MAP[className].some(keyword => lowerDesc.includes(keyword))) {
      return className;
    }
  }
  return 'generic';
}

const RULES: Record<string, ProductRules> = {
  'cup': {
    positives: ['preserve exact cylinder geometry and proportions', 'same rim and base', 'exact printed text'],
    negatives: ['no handle if absent from reference', 'no loop', 'no straw', 'no text change or distortion', 'no extra patterns'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { geometry_drift: true, text_mismatch: true }
  },
  'bottle': {
    positives: ['same neck/cap shape', 'same material finish (matte/glossy)'],
    negatives: ['no handles', 'no straw', 'no new logos', 'no extra attachments'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { geometry_drift: true }
  },
  'cap': {
    positives: ['preserve visor shape and seams', 'match fabric texture'],
    negatives: ['no extra patches or logos', 'no visor deformation', 'no shape change'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { geometry_drift: true, text_mismatch: true }
  },
  'clothing': {
    positives: ['same garment shape and cut', 'same print position and scale'],
    negatives: ['no new patterns', 'no wrong text', 'no wrinkles obscuring the print', 'no material change'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { geometry_drift: true, text_mismatch: true, material_swap: true }
  },
  'cushion': {
    positives: ['soft realistic fabric texture', 'same print and colors'],
    negatives: ['no glossy or plastic look', 'no distortion of the print', 'no hard edges'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { material_swap: true, text_mismatch: true }
  },
  'doormat': {
    positives: ['flat top-down perspective', 'printed design perfectly visible and flat'],
    negatives: ['no 3D extruded text', 'no curling edges', 'no perspective distortion'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { geometry_drift: true, text_mismatch: true }
  },
  'wood': {
    positives: ['preserve wood grain direction and color', 'preserve engravings with sharp detail'],
    negatives: ['no new ornaments or attachments', 'no material swap to plastic or metal'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { material_swap: true, text_mismatch: true }
  },
  'canvas': {
    positives: ['perfectly flat surface', 'no frame unless specified'],
    negatives: ['no bevel', 'no stylization', 'no glossy reflections', 'no frame'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { geometry_drift: true }
  },
  'frame': {
    positives: ['same transparency and reflection properties', 'preserve frame material'],
    negatives: ['no color tint on glass', 'no fake glow or light beams from the frame'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { material_swap: true }
  },
  'puzzle': {
    positives: ['keep piece layout and proportions', 'maintain all colors from the reference'],
    negatives: ['no pattern change or swapped colors', 'no missing pieces'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { text_mismatch: true }
  },
  'phone_case': {
    positives: ['same camera cutouts, button positions, and edge shape', 'same material (e.g., matte silicone, hard plastic)'],
    negatives: ['no extra holes or bumps', 'no change in material finish'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { geometry_drift: true, material_swap: true }
  },
  'lamp': {
    positives: ['preserve exact shape of the lamp', 'preserve light color (warm/cool)'],
    negatives: ['no unreal glow, lens flare, or light beams'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: { geometry_drift: true }
  },
  'generic': {
    positives: ['preserve exact product geometry and print from the reference image'],
    negatives: ['no hallucinated props attached to the product', 'do not change the product'],
    params: { }, // Deprecated: reference_lock, img2img_denoise
    qaChecks: {}
  }
};

export function getProductRules(productClass: string): ProductRules {
  return RULES[productClass] || RULES['generic'];
}