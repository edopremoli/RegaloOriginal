
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
P0 — PRODUCT IDENTITY (NON NEGOTIABLE)
- The MASTER product images are the absolute truth.
- Preserve exact shape, proportions, volume, cuts, seams, parts, materials, textures, logos, printed text, engravings and visible details.
- Do not invent text, branding, labels, attachments or extra product parts.
- Do not duplicate products unless explicitly requested.

P0b — PHYSICAL REALISM
- No floating objects.
- Products must feel physically integrated in the scene.
- Believable support, gravity, contact points, occlusion and contact shadows.
- Correct perspective, scale and depth relative to the environment.
- The product must not look pasted on top of the background.

P1 — HUMAN REALISM
- If humans appear, they must look like real people photographed in a real scene.
- Avoid rubber/plastic skin, fake anatomy, strange fingers, stiff hands, mannequin faces, uncanny smiles or doll-like expressions.
- Hands must interact naturally with the product if holding or wearing it.
- If the product is wearable, it must sit naturally on the body with believable tension, folds and placement.

P1b — MATERIALS AND TEXTURES
- Materials must behave realistically: metal reflections, glass highlights, textile weave, fabric folds, wood grain, ceramic finish, etc.
- Preserve visible textures and surface detail.
- Avoid over-smoothing, fake plastic look or CGI rendering.

P2 — LOOK AND COMPOSITION
- Photorealistic editorial / lifestyle photography, like a real professional photographer shot.
- Neutral, fresh, natural look by default.
- Avoid strong orange/blue mood casts unless explicitly requested in the scene prompt.
- Product is the protagonist, but the context must feel present, believable and desirable.
- Context must support the product without distracting from it.
- Keep the full product visible inside the frame with comfortable margins.

P3 — OUTPUT RULES
- Do not request or apply upscaling.
- Do not crop important product parts.
- Use the model’s native aspect ratio / native composition unless explicitly constrained elsewhere.
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
    let block = "PRODUCT IDENTITY BLOCK:\n";
    products.forEach((p, idx) => {
        block += `- PRODUCT ${idx + 1}:\n`;
        block += `  OBJECT: ${p.object_name_es}\n`;
        if (p.material_finish_es) {
            block += `  MATERIAL / FINISH: ${p.material_finish_es}\n`;
        }
        const dims = [];
        if (p.alto_cm) dims.push(`alto=${p.alto_cm}cm`);
        if (p.ancho_cm) dims.push(`ancho=${p.ancho_cm}cm`);
        if (p.profundidad_cm) dims.push(`prof=${p.profundidad_cm}cm`);
        if (dims.length > 0) {
            block += `  DIMENSIONS (cm): ${dims.join(', ')}\n`;
        }
    });
    return block;
};

const getHumanRealismRules = (prompt: string): string => {
    const keywords = [
        'persona', 'modelo', 'mano', 'llevando', 'puesto', 'usando', 'sosteniendo',
        'wearable', 'gorra', 'gafas', 'ropa', 'camiseta', 'vestido', 'calzado',
        'person', 'model', 'hand', 'wearing', 'using', 'holding'
    ];
    const lowerPrompt = prompt.toLowerCase();
    const hasHuman = keywords.some(k => lowerPrompt.includes(k));

    if (!hasHuman) return "";

    return `
HUMAN / MODEL REALISM:
- real human skin texture
- natural body posture
- believable hand anatomy
- no mannequin / no rubber skin / no fake smile / no doll face
- natural integration between product and body
- if holding the product, fingers must wrap and compress naturally
- if wearing the product, fit, folds and contact must look real
`;
};

const getReferenceTypeInstructions = (type?: string): string => {
    switch (type) {
        case 'detail': 
            return "Use this image only to preserve small visible details, texture, engraving, stitching or graphic elements. Do not change the main product shape.";
        case 'color': 
            return "Use this image only as a color / finish reference. Preserve the shape and identity from the MASTER.";
        case 'angle': 
            return "Use this image only to understand secondary visible geometry or another angle of the same product.";
        case 'style': 
            return "Use this image only for mood, lighting or atmosphere. Do not copy objects, logos or composition literally.";
        case 'extra_product': 
            return "This image is an additional product that should also appear naturally in the final scene if the prompt implies multiple products.";
        default: 
            return "";
    }
};

const buildFinalPrompt = (
    products: PreflightData[], 
    userPrompt: string, 
    extras: ProductImage[]
): string => {
    let finalPrompt = "";

    // A) Bloque identidad (Multi-producto)
    finalPrompt += buildIdentityBlock(products);

    // B) Bloque reglas globales persistentes
    finalPrompt += GLOBAL_RULES;

    // C) Human Realism (Conditional)
    finalPrompt += getHumanRealismRules(userPrompt);

    // D) Prompt de Escena
    const cleanUserPrompt = userPrompt.trim();
    finalPrompt += `\nSCENE INSTRUCTIONS:\n${cleanUserPrompt}\n`;

    // E) Extra references
    extras.forEach((extra, idx) => {
        const typeLabel = getReferenceTypeLabel(extra.referenceType);
        const instructions = getReferenceTypeInstructions(extra.referenceType);
        if (extra.comment) {
            finalPrompt += `${typeLabel} REFERENCE ${idx + 1}: ${extra.comment}. ${instructions}\n`;
        } else {
            finalPrompt += `${typeLabel} REFERENCE ${idx + 1}. ${instructions}\n`;
        }
    });

    return finalPrompt;
};

const getReferenceTypeLabel = (type?: string): string => {
    switch (type) {
        case 'detail': return 'DETAIL';
        case 'color': return 'COLOR';
        case 'angle': return 'ANGLE';
        case 'style': return 'STYLE / MOOD';
        case 'extra_product': return 'ADDITIONAL PRODUCT';
        default: return 'EXTRA';
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

export const qaCheckGeneratedImage = async (
    imageBlob: Blob,
    promptUsed: string,
    productsData: PreflightData[]
): Promise<{ pass: boolean, issues: string[] }> => {
    const ai = getAIClient();
    const imageB64 = await fileToBase64(imageBlob);
    const identity = buildIdentityBlock(productsData);

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { data: imageB64, mimeType: 'image/png' } },
                { text: `
                Analyze the generated image against the intended prompt and product identity.
                
                INTENDED PRODUCT IDENTITY:
                ${identity}
                
                PROMPT USED:
                ${promptUsed}
                
                Check for these specific issues:
                1. Human realism: fake/rubber skin, mannequin look, uncanny hands/fingers, doll-like faces.
                2. Pasted look: product looks like it was cut and pasted on the background, lacks integration.
                3. Depth/Integration: poor perspective, lack of depth, or product doesn't feel part of the environment.
                4. Shadows/Contact: weak or missing contact shadows where the product touches surfaces.
                5. Invented text: unwanted text, labels, or branding that wasn't in the master images.
                6. Unwanted duplicates: more products than requested.
                
                Respond ONLY in JSON format:
                {
                  "pass": boolean,
                  "issues": string[] // list of detected issues from the categories above
                }
                ` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    pass: { type: Type.BOOLEAN },
                    issues: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["pass", "issues"]
            }
        }
    });

    try {
        const text = response.text?.trim() || '{"pass": true, "issues": []}';
        return JSON.parse(text);
    } catch (e) {
        console.error("QA Parse Error", e);
        return { pass: true, issues: [] }; // Fallback to pass if QA fails to parse
    }
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
    
    let retryCount = 0;
    let lastBlob: Blob | null = null;
    let lastPrompt = prompt;

    while (retryCount <= 2) {
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
                const typeLabel = getReferenceTypeLabel(extra.referenceType);
                const comment = extra.comment ? `: ${extra.comment}` : "";
                const instructions = getReferenceTypeInstructions(extra.referenceType);
                parts.push({ text: `${typeLabel} REFERENCE${comment}. ${instructions}` });
            }
        }

        // Prompt last as the final instruction
        parts.push({ text: `Instruction: Generate a photorealistic lifestyle image featuring the product(s) above. ${lastPrompt}` });

        console.log(`Generating (Attempt ${retryCount + 1}) with model:`, modelId);

        try {
            const response = await ai.models.generateContent({
                model: modelId,
                contents: { parts },
                config: { 
                    safetySettings: SAFETY_SETTINGS
                }
            });

            if (!response.candidates || response.candidates.length === 0) {
                throw new Error("The model refused to generate an image.");
            }

            const candidate = response.candidates[0];
            if (candidate.finishReason === 'SAFETY') {
                throw new Error("The image generation was blocked by safety filters.");
            }

            const imagePart = candidate.content?.parts?.find(part => part.inlineData);
            if (!imagePart?.inlineData?.data) {
                throw new Error("Failed to generate image data.");
            }

            const base64 = imagePart.inlineData.data;
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
            lastBlob = imageBlob;

            // QA Check
            const qa = await qaCheckGeneratedImage(imageBlob, lastPrompt, productsData);
            if (qa.pass || retryCount === 2) {
                const dims = await getImageDimensions(imageBlob);
                return {
                    imageBlob,
                    width: dims.width,
                    height: dims.height,
                    promptUsed: lastPrompt
                };
            }

            // Retry logic
            retryCount++;
            console.log(`QA Failed (Attempt ${retryCount}):`, qa.issues);
            lastPrompt = `${prompt}\n\nCorrective priorities: stronger physical integration, better contact shadows, more realistic humans, more depth, avoid pasted look. Detected issues: ${qa.issues.join(', ')}.`;

        } catch (apiError: any) {
            console.error(`Attempt ${retryCount + 1} failed:`, apiError);
            if (retryCount === 2) throw apiError;
            retryCount++;
        }
    }

    throw new Error("Failed to generate a high-quality image after retries.");
};

// 3. EDIT SIMPLE
export const editLifestyleImageSimple = async (
    masterFiles: File[],
    sourceImageBlob: Blob,
    productsData: PreflightData[],
    changes: string,
    originalPrompt: string,
    extraFiles: ProductImage[] = []
): Promise<{ imageBlob: Blob, width: number, height: number, promptUsed: string }> => {
    const ai = getAIClient();
    const sourceB64 = await fileToBase64(sourceImageBlob);
    
    const identity = buildIdentityBlock(productsData);
    const humanRealism = getHumanRealismRules(changes + " " + originalPrompt);
    
    const baseEditPrompt = `
You are regenerating the image from scratch.
${GLOBAL_RULES}
${identity}
${humanRealism}

CONTINUITY REFERENCE: keep general composition, mood and scene continuity from the previously generated image unless the requested changes imply otherwise.

ORIGINAL SCENE PROMPT: ${originalPrompt}

REQUESTED CHANGES: ${changes}

Only change what is explicitly requested. Preserve the product identity exactly.
`;

    let retryCount = 0;
    let lastPrompt = baseEditPrompt;

    while (retryCount <= 2) {
        const parts: any[] = [];

        // 1. Context: Previous Image
        parts.push({ inlineData: { data: sourceB64, mimeType: 'image/png' } });
        parts.push({ text: "CONTINUITY REFERENCE: keep general composition, mood and scene continuity from the previously generated image unless the requested changes imply otherwise." });

        // 2. Master references
        for (let i = 0; i < masterFiles.length; i++) {
            const masterB64 = await fileToBase64(masterFiles[i]);
            parts.push({ inlineData: { data: masterB64, mimeType: masterFiles[i].type || 'image/jpeg' } });
            parts.push({ text: `Product Reference ${i + 1}` });
        }

        // 3. Extra references (if any)
        if (extraFiles.length > 0) {
            for (const extra of extraFiles) {
                const extraB64 = await fileToBase64(extra.file);
                parts.push({ inlineData: { mimeType: extra.file.type || 'image/jpeg', data: extraB64 } });
                const typeLabel = getReferenceTypeLabel(extra.referenceType);
                const comment = extra.comment ? `: ${extra.comment}` : "";
                const instructions = getReferenceTypeInstructions(extra.referenceType);
                parts.push({ text: `${typeLabel} REFERENCE${comment}. ${instructions}` });
            }
        }

        // Edit instructions last
        parts.push({ text: `Instruction: ${lastPrompt}` });

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts },
                config: {
                    safetySettings: SAFETY_SETTINGS
                }
            });

            const candidate = response.candidates?.[0];
            if (candidate?.finishReason === 'SAFETY') {
                throw new Error("The edit was blocked by safety filters.");
            }

            const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
            if (!imagePart?.inlineData?.data) {
                throw new Error("Edit failed to generate image data.");
            }

            const base64 = imagePart.inlineData.data;
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });

            // QA Check
            const qa = await qaCheckGeneratedImage(imageBlob, lastPrompt, productsData);
            if (qa.pass || retryCount === 2) {
                const dims = await getImageDimensions(imageBlob);
                return {
                    imageBlob,
                    width: dims.width,
                    height: dims.height,
                    promptUsed: lastPrompt
                };
            }

            // Retry logic
            retryCount++;
            console.log(`Edit QA Failed (Attempt ${retryCount}):`, qa.issues);
            lastPrompt = `${baseEditPrompt}\n\nCorrective priorities: stronger physical integration, better contact shadows, more realistic humans, more depth, avoid pasted look. Detected issues: ${qa.issues.join(', ')}.`;

        } catch (apiError: any) {
            console.error(`Edit Attempt ${retryCount + 1} failed:`, apiError);
            if (retryCount === 2) throw apiError;
            retryCount++;
        }
    }

    throw new Error("Failed to edit image with high quality after retries.");
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
