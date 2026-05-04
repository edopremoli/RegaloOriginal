
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { PreflightData, ProductImage, SceneConfig, ProductAnalysis, ImageGenerationModel } from '../types';
import { safeAreaForAspect } from "../utils/safeArea";

// Safe API Key retrieval
const getApiKey = () => {
  return process.env.API_KEY || process.env.GEMINI_API_KEY;
};

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

const ENABLE_AUTO_QA = false;
const IMAGE_GENERATION_TIMEOUT_MS = 120000;

// --- SIMPLIFIED PROMPT TEMPLATE ---
const buildSimplifiedTemplate = (
    products: PreflightData[], 
    userScenePrompt: string,
    criticalDetail: string = "",
    negativePrompt: string = ""
): string => {
    // 3. Mockup guardrail 
    const mockupTerms = [
        "frontal perfecto", "frontal completamente paralelo",
        "ocupa media imagen", "producto gigante", "centrado perfecto",
        "tipo catalogo", "fondo desenfocado"
    ];
    
    // Normalize string to check for diacritics
    const normalizedScene = userScenePrompt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    let processedScenePrompt = userScenePrompt;
    if (mockupTerms.some(term => normalizedScene.includes(term))) {
         processedScenePrompt += "\n\nComposition note: keep commercial legibility, but avoid mockup/billboard composition; the product must remain naturally integrated with realistic scale, contact, perspective and light.";
    }

    const productDesc = products.map(p => 
        `${p.object_name_es}${p.material_finish_es ? `. Material/Finish: ${p.material_finish_es}` : ''}.${p.alto_cm ? ` Dimensions: ${p.alto_cm}x${p.ancho_cm}cm.` : ''}`
    ).join('\n');

    return `
PRODUCT IDENTITY:
${productDesc}

SCENE:
${processedScenePrompt}

INTEGRATION:
Use the master product as identity reference, not as a pixel layer or cutout. Recreate the same product as a real object photographed inside the scene. Preserve recognizable shape, proportions, material, color, construction and key visible details, but adapt light direction, light softness, color temperature, scale, perspective, lens depth, shadows, reflections and contact to the environment. Ensure a credible contact shadow and subtle occlusion when touching hands/surfaces. Maintain coherent scale with nearby objects. The product must belong physically to the table, hand, body or surface around it. Avoid pasted-on object, mockup look, floating product, cutout edges, halo, mismatched lighting, impossible scale, billboard-like product and isolated studio-object look.

${criticalDetail ? `CRITICAL DETAIL:\n${criticalDetail}\n` : ''}
NEGATIVE:
${negativePrompt} pasted-on product, cutout edges, halo, floating object, mismatched lighting, impossible scale, mockup look, billboard product, distorted logo, inconsistent texture, isolated studio-object look.
`.trim();
};

const GLOBAL_EDIT_RULES = `
You are improving a previously generated lifestyle/editorial e-commerce image.

CORE EDITING TASK
Create one new improved image using:
1. the previously generated image as a visual reference,
2. the uploaded real product reference image(s) as the source of truth for product fidelity,
3. the user's new requested changes as strong instructions.

IMPORTANT EDITING PRINCIPLE
Treat editing as a guided regeneration. Preserve useful successful aspects of the previous image, but do not stay too close to it if the user is asking for meaningful changes.

NON-NEGOTIABLE RULES (BASED ON "EL FOTÓGRAFO" GUIDELINES)

1. PRODUCT AS PROTAGONIST & FIDELITY
- The product must remain highly visible, occupying enough frame to read easily (35-65%).
- Ensure exact fidelity to the real reference: materials, zippers, labels, customizable zones.
- If previous image failed realism or product scale, fix it now.
- Keep closed packaging closed.

2. AESTHETICS AND PHOTOGRAPHIC QUALITY
- Clean, correct color: true whites, solid blacks, natural contrast.
- NO faded, milky, or artificially filtered looks.
- Maintain realistic optical lens feel (no extreme wide angle distortion without reason).
- Do not use flat generative blur; use optical-style depth of field keeping product perfectly sharp.

3. HUMANS AND CONTEXT
- If changing humans: ensure natural skin, realistic poses, and believable non-stock expressions.
- Keep the number of props purposeful (2-4). Avoid clutter.
- The emotion or context must never overshadow the product's readability.

FINAL EDITING INSTRUCTION
Generate one new improved image. Use the previous image as a reference, not a rigid template. Apply changes strongly while fiercely protecting product fidelity, scale, and clean professional photographic quality.
`;

const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error("Failed to read file as string"));
      }
      resolve(reader.result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getAIClient = () => {
    const key = getApiKey();
    if (!key) throw new Error("API Key missing. Please select a key via the interface.");
    return new GoogleGenAI({ apiKey: key });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callImageGenerationWithRetry = async (fn: () => Promise<any>): Promise<any> => {
    let timer: any;
    try {
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error("Error: La generación ha tardado demasiado. Prueba de nuevo, usa Standard o simplifica el prompt."));
            }, IMAGE_GENERATION_TIMEOUT_MS);
        });
        
        const result = await Promise.race([fn(), timeoutPromise]);
        clearTimeout(timer);
        return result;
    } catch (error: any) {
        if (timer) clearTimeout(timer);
        throw error;
    }
};

/**
 * Automatically parses dimensions like "28 x 19 cm" or "diámetro 7 cm" from a prompt.
 */
export const parseDimensionsFromPrompt = (prompt: string): Partial<PreflightData> | null => {
    const lower = prompt.toLowerCase();
    
    // Pattern: 28 x 19 x 10 cm or 28x19cm
    const sizeMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)(?:\s*x\s*(\d+(?:[.,]\d+)?))?\s*(?:cm|cms|centímetros)/);
    if (sizeMatch) {
        return {
            ancho_cm: parseFloat(sizeMatch[1].replace(',', '.')),
            alto_cm: parseFloat(sizeMatch[2].replace(',', '.')),
            profundidad_cm: sizeMatch[3] ? parseFloat(sizeMatch[3].replace(',', '.')) : null
        };
    }

    // Pattern: alto 28 cm, ancho 19 cm
    let dims: Partial<PreflightData> = {};
    const altoMatch = lower.match(/(?:alto|height)\s*(\d+(?:[.,]\d+)?)\s*cm/);
    const anchoMatch = lower.match(/(?:ancho|width)\s*(\d+(?:[.,]\d+)?)\s*cm/);
    const profMatch = lower.match(/(?:profundidad|depth)\s*(\d+(?:[.,]\d+)?)\s*cm/);
    
    if (altoMatch) dims.alto_cm = parseFloat(altoMatch[1].replace(',', '.'));
    if (anchoMatch) dims.ancho_cm = parseFloat(anchoMatch[1].replace(',', '.'));
    if (profMatch) dims.profundidad_cm = parseFloat(profMatch[1].replace(',', '.'));

    // Special cases: diámetro / circunferencia
    const diaMatch = lower.match(/(?:diámetro|diameter)\s*(\d+(?:[.,]\d+)?)\s*cm/);
    if (diaMatch) {
        const val = parseFloat(diaMatch[1].replace(',', '.'));
        dims.ancho_cm = val;
        dims.alto_cm = val;
        dims.dimension_profile = 'cylinder';
    }

    return Object.keys(dims).length > 0 ? dims : null;
};

// 1. ANALYZE (PREFLIGHT)
export const analyzeProductImage = async (productImage: File): Promise<PreflightData> => {
    const ai = getAIClient();
    const base64Image = await fileToBase64(productImage);
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType: productImage.type || 'image/jpeg' }},
                { text: `
                Analiza esta imagen de producto para e-commerce.
                Responde SOLAMENTE en formato JSON con los siguientes campos en ESPAÑOL:
                
                - object_name_es: Descripción MUY ESPECÍFICA (8-16 palabras). Usa: [tipo de objeto] + [color] + [acabado] + [forma] + [rasgo visible clave] + [personalización visible si existe]. 
                  CRÍTICO: NO inventes marcas, NO inventes capacidades exactas (ej: "750ml"), NO inventes especificaciones técnicas no visibles. Si ves un nombre propio, descríbelo como "nombre personalizado".
                - material_finish_es: Descripción técnica de materiales y acabado basándote SOLO en lo que ves (ej: "cerámica blanca acabado brillo", "metal mate").
                - dimension_profile: Determina el perfil de forma: 'cylinder' (botellas, tazas, vasos cilíndricos), 'sphere' (pelotas, bolas), 'box' (cajas, libros, rectangulares), u 'other' (formas irregulares).
                - alto_cm, ancho_cm, profundidad_cm: Estimación NUMÉRICA en cm si el objeto es común (botella, taza, cojín, gorra). Si no puedes estimar con seguridad, devuelve null. NO uses strings, solo números o null.
                ` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    object_name_es: { type: Type.STRING },
                    material_finish_es: { type: Type.STRING },
                    dimension_profile: { type: Type.STRING, enum: ['box', 'cylinder', 'sphere', 'other'] },
                    alto_cm: { type: Type.NUMBER, nullable: true },
                    ancho_cm: { type: Type.NUMBER, nullable: true },
                    profundidad_cm: { type: Type.NUMBER, nullable: true },
                },
                required: ["object_name_es", "dimension_profile"]
            }
        }
    });

    const jsonText = response.text?.trim() || "{}";
    try {
        const parsed = JSON.parse(jsonText);
        return {
            object_name_es: parsed.object_name_es || "",
            material_finish_es: parsed.material_finish_es || "",
            dimension_profile: parsed.dimension_profile || "other",
            alto_cm: parsed.alto_cm ?? null,
            ancho_cm: parsed.ancho_cm ?? null,
            profundidad_cm: parsed.profundidad_cm ?? null
        };
    } catch (e) {
        console.error("Analysis parse error", e);
        throw new Error("Failed to analyze product. Please try again.");
    }
};

// 2. GENERATE SIMPLE
export const generateLifestyleImageSimple = async (
    masterFiles: File[], 
    extraFiles: ProductImage[], 
    productsData: PreflightData[], 
    userScenePrompt: string,
    masters: ProductImage[],
    modelId: ImageGenerationModel = 'gemini-2.5-flash-image',
    aspectRatio: string = '1:1',
    presetId?: string,
    sizeInternal?: string,
    criticalDetail: string = "",
    negativePrompt: string = ""
): Promise<{ imageBlob: Blob, width: number, height: number, promptUsed: string, baseScenePrompt?: string, debugInfo?: any }> => {
    
    const ai = getAIClient();
    const prompt = buildSimplifiedTemplate(productsData, userScenePrompt, criticalDetail, negativePrompt);
    
    let lastPrompt = prompt;
    lastPrompt += `\n\nREFERENCE IMAGE ROLES:
- Master images: identity reference only, not cutout layers.
- Same-product extras: construction/material/detail clarification only.
- Additional products: separate products only if requested by the scene.
- Inspiration images: excluded from final generation call.`;

    const parts: any[] = [];

    // 1. All images first (EXCLUDING inspiration)
    for (const file of masterFiles) {
        const masterB64 = await fileToBase64(file);
        parts.push({ inlineData: { mimeType: file.type || 'image/jpeg', data: masterB64 } });
    }

    const relevantExtras = extraFiles.filter(e => e.identityRelation !== 'inspiration');
    for (const extra of relevantExtras) {
        const extraB64 = await fileToBase64(extra.file);
        parts.push({ inlineData: { mimeType: extra.file.type || 'image/jpeg', data: extraB64 } });
    }

    // 2. Single text instruction at the end
    parts.push({ text: lastPrompt });

    console.log(`Generating with model:`, modelId);

    try {
        const response = await callImageGenerationWithRetry(() => ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config: { 
                responseModalities: ['IMAGE'],
                imageConfig: { 
                    aspectRatio: aspectRatio as any
                }
            }
        }));

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("The model refused to generate an image.");
        }

        const candidate = response.candidates[0];
        if (candidate.finishReason === 'SAFETY') {
            throw new Error("The image generation was blocked by safety filters.");
        }

        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (!imagePart?.inlineData?.data) {
            const textPart = candidate.content?.parts?.find(part => part.text);
            const refusalReason = textPart?.text ? `: ${textPart.text}` : "";
            const finishReason = candidate.finishReason;

            throw new Error(`Failed to generate image data (Finish Reason: ${finishReason})${refusalReason}`);
        }

        const base64 = imagePart.inlineData.data;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });

        const dims = await getImageDimensions(imageBlob);
        return {
            imageBlob,
            width: dims.width,
            height: dims.height,
            promptUsed: lastPrompt,
            baseScenePrompt: userScenePrompt,
            debugInfo: {
                retryCount: 0,
                qaSkipped: true,
                numMasters: masterFiles.length,
                numExtras: relevantExtras.length,
                primaryProduct: productsData[0]?.object_name_es,
                modelUsed: modelId,
                aspectRatioRequested: aspectRatio,
                actualWidth: dims.width,
                actualHeight: dims.height,
                generatedImageAttempts: 1,
                apiTimeoutMs: IMAGE_GENERATION_TIMEOUT_MS
            }
        };

    } catch (apiError: any) {
        console.error(`Generation failed:`, apiError);
        const msg = apiError.message?.toLowerCase() || '';
        if (msg.includes('unavailable') || msg.includes('high demand') || msg.includes('503')) {
            throw new Error(`Los servidores de Google tienen alta demanda en este momento (Error 503). Por favor, inténtalo de nuevo. Spikes in demand are usually temporary.`);
        }
        if (msg.includes('not found') || msg.includes('permission denied') || msg.includes('403') || msg.includes('404')) {
            throw new Error(`Este modelo no está disponible para esta API key o proyecto. Vuelve a Stable.`);
        }
        throw apiError;
    }
};

const getImageDimensions = (blob: Blob): Promise<{ width: number, height: number }> => {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const dims = { width: img.naturalWidth, height: img.naturalHeight };
            URL.revokeObjectURL(url);
            resolve(dims);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ width: 1024, height: 1024 }); // Fallback
        };
        img.src = url;
    });
};

// 3. EDIT SIMPLE
export const editLifestyleImageSimple = async (
    masterFiles: File[],
    sourceImageBlob: Blob,
    productsData: PreflightData[],
    changes: string,
    baseScenePrompt: string,
    extraFiles: ProductImage[] = [],
    masters: ProductImage[] = [],
    modelId: ImageGenerationModel = 'gemini-2.5-flash-image',
    aspectRatio: string = '1:1',
    presetId?: string,
    sizeInternal?: string,
    criticalDetail: string = "",
    negativePrompt: string = ""
): Promise<{ imageBlob: Blob, width: number, height: number, promptUsed: string, baseScenePrompt?: string, lastEditChanges?: string, debugInfo?: any }> => {
    const ai = getAIClient();
    const sourceB64 = await fileToBase64(sourceImageBlob);
    
    // Mockup guardrail 
    const mockupTerms = [
        "frontal perfecto", "frontal completamente paralelo",
        "ocupa media imagen", "producto gigante", "centrado perfecto",
        "tipo catalogo", "fondo desenfocado"
    ];
    
    // Normalize string to check for diacritics
    const normalizedScene = baseScenePrompt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    let processedScenePrompt = baseScenePrompt;
    if (mockupTerms.some(term => normalizedScene.includes(term))) {
         processedScenePrompt += "\n\nComposition note: keep commercial legibility, but avoid mockup/billboard composition; the product must remain naturally integrated with realistic scale, contact, perspective and light.";
    }

    const productDesc = productsData.map(p => 
        `${p.object_name_es}${p.material_finish_es ? `. Material/Finish: ${p.material_finish_es}` : ''}.${p.alto_cm ? ` Dimensions: ${p.alto_cm}x${p.ancho_cm}cm.` : ''}`
    ).join('\n');

    const prompt = `PREVIOUS IMAGE:
Use the previous generated image only as a loose composition reference.

USER CHANGES:
${changes}

ORIGINAL SCENE:
${processedScenePrompt}

PRODUCT IDENTITY:
${productDesc}

INTEGRATION:
Use the master product as identity reference, not as a pixel layer or cutout. Recreate the same product as a real object photographed inside the scene. Preserve recognizable shape, proportions, material, color, construction and key visible details, but adapt light direction, light softness, color temperature, scale, perspective, lens depth, shadows, reflections and contact to the environment. Ensure a credible contact shadow and subtle occlusion when touching hands/surfaces. Maintain coherent scale with nearby objects. The product must belong physically to the table, hand, body or surface around it. Avoid pasted-on object, mockup look, floating product, cutout edges, halo, mismatched lighting, impossible scale, billboard-like product and isolated studio-object look.

${criticalDetail ? `CRITICAL DETAIL:\n${criticalDetail}\n` : ''}
NEGATIVE:
${negativePrompt} pasted-on product, cutout edges, halo, floating object, mismatched lighting, impossible scale, mockup look, billboard product, distorted logo, inconsistent texture, isolated studio-object look.`.trim();
    let finalPrompt = prompt + `\n\nREFERENCE IMAGE ROLES:
- Master images: identity reference only, not cutout layers.
- Same-product extras: construction/material/detail clarification only.
- Additional products: separate products only if requested by the scene.
- Inspiration images: excluded from final generation call.`;
    
    const parts: any[] = [];
    // 1. Context: Previous Image
    parts.push({ inlineData: { data: sourceB64, mimeType: 'image/png' } });

    // 2. Master references
    for (const file of masterFiles) {
        const masterB64 = await fileToBase64(file);
        parts.push({ inlineData: { data: masterB64, mimeType: file.type || 'image/jpeg' } });
    }

    // 3. Extra references (EXCLUDING inspiration)
    const relevantExtras = extraFiles.filter(e => e.identityRelation !== 'inspiration');
    for (const extra of relevantExtras) {
        const extraB64 = await fileToBase64(extra.file);
        parts.push({ inlineData: { mimeType: extra.file.type || 'image/jpeg', data: extraB64 } });
    }

    // 4. Single text instruction at the end
    parts.push({ text: finalPrompt });

    try {
        const response = await callImageGenerationWithRetry(() => ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio: aspectRatio as any
                }
            }
        }));

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
            throw new Error("The edit was blocked by safety filters.");
        }

        const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
        if (!imagePart?.inlineData?.data) {
            const textPart = candidate?.content?.parts?.find(p => p.text);
            const refusalReason = textPart?.text ? `: ${textPart.text}` : "";
            const finishReason = candidate?.finishReason;
            
            throw new Error(`Edit failed to generate image data (Finish Reason: ${finishReason})${refusalReason}`);
        }

        const base64 = imagePart.inlineData.data;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });

        const dims = await getImageDimensions(imageBlob);
        return {
            imageBlob,
            width: dims.width,
            height: dims.height,
            promptUsed: prompt,
            baseScenePrompt: baseScenePrompt,
            lastEditChanges: changes,
            debugInfo: {
                retryCount: 0,
                isSimplified: false,
                numMasters: masterFiles.length,
                numExtras: relevantExtras.length,
                qaSkipped: true,
                modelUsed: modelId,
                aspectRatioRequested: aspectRatio,
                actualWidth: dims.width,
                actualHeight: dims.height,
                generatedImageAttempts: 1,
                apiTimeoutMs: IMAGE_GENERATION_TIMEOUT_MS
            }
        };

    } catch (apiError: any) {
        console.error(`Edit Generation failed:`, apiError);
        const msg = apiError.message?.toLowerCase() || '';
        if (msg.includes('unavailable') || msg.includes('high demand') || msg.includes('503')) {
            throw new Error(`Los servidores de Google tienen alta demanda en este momento (Error 503). Por favor, inténtalo de nuevo. Spikes in demand are usually temporary.`);
        }
        if (msg.includes('not found') || msg.includes('permission denied') || msg.includes('403') || msg.includes('404')) {
            throw new Error(`Este modelo no está disponible para esta API key o proyecto. Vuelve a Stable.`);
        }
        throw apiError;
    }
};

// 6. HELPER (Fix: Added missing export for SceneConfigPage.tsx)
export const normalizePromptShape = (p: any) => {
    if (!p) return { positive: '', negative: '' };
    if (typeof p === 'string') return { positive: p, negative: '' };
    return {
        positive: p.positive || p.prompt || '',
        negative: p.negative || ''
    };
};
