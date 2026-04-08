
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { PreflightData, ProductImage, SceneConfig, ProductAnalysis } from '../types';
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

// --- GLOBAL RULES CONSTANT ---
const GLOBAL_RULES = `
    - PRODUCT IDENTITY: Preserve the product's appearance from the reference images.
    - PHYSICS: Ensure realistic contact shadows and perspective.
    - LOOK: Photorealistic lifestyle photography.
    - COMPOSITION: Center the product in the frame.
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
                
                - object_name_es: Descripción MUY ESPECÍFICA (8-16 palabras). Incluye: tipo de objeto, material visible, acabado (mate/brillo), color exacto, tipo de tapa/cierre, y si tiene personalización (logo/texto/foto) descríbela brevemente. NO inventes marcas.
                - material_finish_es: Descripción técnica de materiales y acabado (ej: "cerámica blanca acabado brillo", "acero inoxidable cepillado con grabado láser").
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

const buildIdentityBlock = (products: PreflightData[]): string => {
    let block = "PRODUCTOS (IDENTIDAD):\n";
    products.forEach((p, idx) => {
        block += `- PRODUCTO ${idx + 1}:\n`;
        block += `  OBJETO: ${p.object_name_es}\n`;
        if (p.material_finish_es) {
            block += `  MATERIAL/ACABADO: ${p.material_finish_es}\n`;
        }
        const dims = [];
        if (p.alto_cm) dims.push(`alto=${p.alto_cm}cm`);
        if (p.ancho_cm) dims.push(`ancho=${p.ancho_cm}cm`);
        if (p.profundidad_cm) dims.push(`prof=${p.profundidad_cm}cm`);
        if (dims.length > 0) {
            block += `  MEDIDAS ESTIMADAS: ${dims.join(', ')}\n`;
        }
    });
    return block;
};

const buildFinalPrompt = (
    products: PreflightData[], 
    userPrompt: string, 
    extras: { comment?: string }[]
): string => {
    let finalPrompt = "";

    // A) Bloque identidad (Multi-producto)
    finalPrompt += buildIdentityBlock(products);

    // B) Bloque reglas globales persistentes (P0/P1/P2)
    finalPrompt += GLOBAL_RULES;

    // C) Prompt de Escena
    const cleanUserPrompt = userPrompt.trim();
    finalPrompt += `\nSCENE INSTRUCTIONS:\n${cleanUserPrompt}\n`;

    // D) Extra references
    extras.forEach((extra, idx) => {
        if (extra.comment) {
            finalPrompt += `EXTRA_REFERENCE_${idx + 1}: ${extra.comment}\n`;
        }
    });

    return finalPrompt;
};

// 2. GENERATE SIMPLE
export const generateLifestyleImageSimple = async (
    masterFiles: File[], 
    extraFiles: ProductImage[], 
    productsData: PreflightData[], 
    userScenePrompt: string
): Promise<{ imageBlob: Blob, width: number, height: number, promptUsed: string }> => {
    
    const ai = getAIClient();
    const modelId = 'gemini-2.5-flash-image';
    const prompt = buildFinalPrompt(productsData, userScenePrompt, extraFiles);
    
    const parts: any[] = [];

    // Images first for context
    for (let i = 0; i < masterFiles.length; i++) {
        const file = masterFiles[i];
        const masterB64 = await fileToBase64(file);
        parts.push({ inlineData: { mimeType: file.type || 'image/jpeg', data: masterB64 } });
        parts.push({ text: `Product Reference ${i + 1}` });
    }

    if (extraFiles.length > 0) {
        for (const extra of extraFiles) {
            const extraB64 = await fileToBase64(extra.file);
            parts.push({ inlineData: { mimeType: extra.file.type || 'image/jpeg', data: extraB64 } });
            if (extra.comment) parts.push({ text: `Style Reference: ${extra.comment}` });
        }
    }

    // Prompt last as the final instruction
    parts.push({ text: `Instruction: Generate a photorealistic lifestyle image featuring the product(s) above. ${prompt}` });

    console.log("Generating with model:", modelId);
    console.log("Prompt length:", prompt.length);

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: { parts },
            config: { 
                imageConfig: {
                    aspectRatio: "1:1"
                },
                safetySettings: SAFETY_SETTINGS
            }
        });

        console.log("Response from Gemini:", JSON.stringify(response, null, 2));

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("The model refused to generate an image. This might be due to safety filters or an invalid prompt.");
        }

        const candidate = response.candidates[0];
        
        if (candidate.finishReason === 'SAFETY') {
            throw new Error("The image generation was blocked by safety filters. Please try a different prompt.");
        }

        const imagePart = candidate.content?.parts?.find(part => part.inlineData);

        if (!imagePart?.inlineData?.data) {
            const textPart = candidate.content?.parts?.find(part => part.text);
            let refusalReason = textPart?.text ? `: ${textPart.text}` : "";
            
            throw new Error(`Failed to generate image${refusalReason}. (Finish Reason: ${candidate.finishReason}). Please check your prompt and try again.`);
        }

        const base64 = imagePart.inlineData.data;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const imageBlob = new Blob([byteArray], { type: 'image/png' });

        return {
            imageBlob,
            width: 1024,
            height: 1024,
            promptUsed: prompt
        };
    } catch (apiError: any) {
        console.error("Gemini API Error:", apiError);
        const errorMsg = apiError.message || String(apiError);
        throw new Error(`Gemini API Error: ${errorMsg}`);
    }
};

// 3. EDIT SIMPLE
export const editLifestyleImageSimple = async (
    masterFiles: File[],
    sourceImageBlob: Blob,
    productsData: PreflightData[],
    changes: string,
    originalPrompt: string
): Promise<{ imageBlob: Blob, width: number, height: number, promptUsed: string }> => {
    const ai = getAIClient();
    const sourceB64 = await fileToBase64(sourceImageBlob);
    const parts: any[] = [];

    // Source image
    parts.push({ inlineData: { data: sourceB64, mimeType: 'image/png' } });
    parts.push({ text: "Original Image" });

    // Master references
    for (let i = 0; i < masterFiles.length; i++) {
        const masterB64 = await fileToBase64(masterFiles[i]);
        parts.push({ inlineData: { data: masterB64, mimeType: masterFiles[i].type || 'image/jpeg' } });
        parts.push({ text: `Product Reference ${i + 1}` });
    }

    // Edit instructions last
    parts.push({ text: `Instruction: Edit the original image to apply these changes: ${changes}. Ensure the product identity is maintained. Context: ${originalPrompt}` });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: "1:1"
            },
            safetySettings: SAFETY_SETTINGS
        }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
        throw new Error("The edit was blocked by safety filters. Please try a different request.");
    }

    const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
    if (!imagePart?.inlineData?.data) {
        const textPart = candidate?.content?.parts?.find(p => p.text);
        const refusalReason = textPart?.text ? `: ${textPart.text}` : "";
        throw new Error(`Edit failed${refusalReason}. (Finish Reason: ${candidate?.finishReason})`);
    }

    const base64 = imagePart.inlineData.data;
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });

    return { imageBlob, width: 1024, height: 1024, promptUsed: `EDIT: ${changes}` };
};

// 4. GENERATE FULL
export const generateLifestyleImage = async (
    productImages: ProductImage[],
    config: SceneConfig,
    productAnalyses: ProductAnalysis[]
) => {
    const ai = getAIClient();
    const enabledSlots = config.slotConfigs.filter(s => s.enabled);
    
    const outputs = await Promise.all(enabledSlots.map(async (slot, i) => {
        const prompt = `A lifestyle photo for e-commerce. Location: ${slot.specificLocation || config.specificLocation} (${slot.locationCategory || config.locationCategory}). Aesthetic: ${slot.aesthetic || config.aesthetic}. Season: ${slot.season || config.season}. Audience: ${slot.audience?.age || config.audience.age} ${slot.audience?.gender || config.audience.gender}. Angle: ${slot.angle || config.angle}. Plane: ${slot.plane || config.plane}. ${config.customPrompt || ''}`;
        
        const parts: any[] = [];
        for (const img of productImages.filter(p => p.isMaster)) {
            const b64 = await fileToBase64(img.file);
            parts.push({ inlineData: { data: b64, mimeType: img.file.type || 'image/jpeg' } });
            parts.push({ text: "Product Reference" });
        }
        parts.push({ text: `Instruction: Generate a photorealistic lifestyle image. ${prompt}` });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                imageConfig: {
                    aspectRatio: config.aspectRatio === 'Custom' ? '1:1' : config.aspectRatio as any
                },
                safetySettings: SAFETY_SETTINGS
            }
        });

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
            throw new Error(`Slot ${i + 1} was blocked by safety filters.`);
        }

        const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
        if (!imagePart?.inlineData?.data) {
            const textPart = candidate?.content?.parts?.find(p => p.text);
            const refusalReason = textPart?.text ? `: ${textPart.text}` : "";
            throw new Error(`Slot ${i + 1} failed${refusalReason}. (Finish Reason: ${candidate?.finishReason})`);
        }

        const byteCharacters = atob(imagePart.inlineData.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) byteNumbers[j] = byteCharacters.charCodeAt(j);
        
        return {
            masterBlob: new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' }),
            masterWidth: 1024,
            masterHeight: 1024,
            filename: `output_${i}.png`,
            wasCapped: false,
            wasCropped: false,
            seed: Math.floor(Math.random() * 100000)
        };
    }));

    return {
        outputs,
        qaHintsUsed: enabledSlots.map(() => ({ requireCompanions: 0, wearablesOnModel: config.human.enabled })),
        prompts: enabledSlots.map(() => ({ positive: config.customPrompt || 'Generated scene', negative: '' })),
        safeArea: safeAreaForAspect(config.aspectRatio, config.customRatio, 1024),
        sceneConfigsUsed: enabledSlots.map(() => config)
    };
};

// 5. EDIT FULL
export const editLifestyleImage = async (
    mainPhotoFiles: File[],
    sourceImageBlob: Blob,
    editPrompt: string,
    extraRef?: { file: File, chips: string[] }
) => {
    const ai = getAIClient();
    const sourceB64 = await fileToBase64(sourceImageBlob);
    const parts: any[] = [
        { inlineData: { data: sourceB64, mimeType: 'image/png' } },
        { text: editPrompt }
    ];

    for (const f of mainPhotoFiles) {
        const b64 = await fileToBase64(f);
        parts.push({ inlineData: { data: b64, mimeType: f.type || 'image/jpeg' } });
    }

    if (extraRef) {
        const b64 = await fileToBase64(extraRef.file);
        parts.push({ inlineData: { data: b64, mimeType: extraRef.file.type || 'image/jpeg' } });
        parts.push({ text: `Style reference: ${extraRef.chips.join(', ')}` });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: "1:1"
            },
            safetySettings: SAFETY_SETTINGS
        }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
        throw new Error("The edit was blocked by safety filters.");
    }

    const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
    if (!imagePart?.inlineData?.data) {
        const textPart = candidate?.content?.parts?.find(p => p.text);
        const refusalReason = textPart?.text ? `: ${textPart.text}` : "";
        throw new Error(`Edit failed${refusalReason}. (Finish Reason: ${candidate?.finishReason})`);
    }

    const byteCharacters = atob(imagePart.inlineData.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    
    return {
        editedImageBlob: new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' }),
        width: 1024,
        height: 1024,
        wasCapped: false
    };
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
