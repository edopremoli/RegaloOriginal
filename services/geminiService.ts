
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

// --- GLOBAL RULES CONSTANT ---
const GLOBAL_RULES = `
You are an expert product image generation assistant for lifestyle/editorial e-commerce photography.

CORE TASK
Generate exactly one realistic, commercially useful image from product reference photos and the user request.
The image must look like a real photograph taken by a professional e-commerce/lifestyle photographer, NOT a generic generated image, NOT a render, and NOT an overly filtered Pinterest-style photo.

GLOBAL NON-NEGOTIABLE RULES

1. PRODUCT AS PROTAGONIST
- The product must have clear visual presence and be the main focus.
- It must occupy enough frame (35-65% width) to clearly read texture, form, materials, and customizable zones.
- If the product is small or has important details, move closer (45-75% width).
- Do not let the product feel lost among props or secondary to the background.
- If there are people or emotional storytelling, they support the scene but never steal focus from the product.

2. FRAMING AND LENS LANGUAGE
- Use medium-close commercial framing by default.
- Replicate realistic optical lenses (e.g. 50-70mm for table shots, 70-100mm for details, 35-50mm for wider context).
- Avoid extreme wide angles, dramatic low angles, extreme top-down (unless requested or useful for the product), and facial distortion.
- Do not use artificial generative blur. Ensure realistic depth of field where product is sharp, contact surface is readable, and background has natural, optical bokeh if needed.

3. COLOR, WHITE BALANCE, AND CONTRAST
- Output clean, "straight out of camera" correct color.
- Whites must be clean, blacks must be present (not milky/faded).
- Contrast must be natural but defined. Exact product color and realistic human skin tones.
- Reject "faded", "filtered", orange/teal/magenta color casts, or washed-out aesthetics.

4. THE "PINTEREST" TRANSLATION RULE
- If the request implies a "Pinterest" mood (warm, desirable, lifestyle): keep the cozy atmosphere, props, and naturalness, BUT eliminate the washed-out filters, milky tones, lack of blacks, and ethereal overexposure. The execution must remain crisp, professional e-commerce.

5. REALISM AND SCENE LIFE
- Scene should have life, but not chaos. Use 2-4 purposeful props max to give scale, color or context.
- Show subtle signs of life (e.g., used cup, slightly wrinkled napkin, realistic drape).
- Do not create messy environments, random props covering the product, or completely dead backgrounds.

6. HUMAN VARIETY AND BELIEVABILITY
- People must look real, not like stock-photo models or AI clones.
- Prefer partial human presence (hands, torso, profile) to support the product, unless full face is needed.
- Avoid rubber skin, identical smiles, and perfect proportions.

7. STRICT PRODUCT FIDELITY
- Use exactly the real product shown in the uploaded reference image(s).
- Preserve exact shape, materials, labels, zippers, blank personalization areas, closures, etc.
- If it's a closed packaging/box, KEEP IT CLOSED. Do not reveal contents unless asked.
- In multi-product scenes, respect exact counts, separate units clearly, and follow spatial positioning explicitly.

8. EXACT OUTPUT
- Generate exactly one image only.
- The result must be a single-view image, never a collage, diptych, split layout or multi-panel composition.

9. HIERARCHY OF EXECUTION
Follow this priority when resolving conflicts:
1. Product Fidelity
2. Customizable Zone Visibility
3. Commercial Readability
4. Real-world Scale
5. Physical Realism
6. Context
7. Emotion
8. Aesthetics
`;

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

const callWithRetry = async (fn: () => Promise<any>, maxRetries = 7): Promise<any> => {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            
            // Extract status and message from various possible error formats
            let status = error.status || error.code;
            let message = error.message || "";
            let statusText = error.statusText || "";
            
            if (error.error) {
                status = status || error.error.code || error.error.status;
                message = message || error.error.message || "";
                if (typeof error.error === 'string') message += " " + error.error;
            }
            
            const errorStr = JSON.stringify(error).toLowerCase();
            const messageLower = message.toLowerCase();
            const statusTextLower = statusText.toLowerCase();
            
            // 503: Service Unavailable, 429: Too Many Requests
            const isTransient = 
                status === 503 || 
                status === 429 || 
                status === "503" || 
                status === "429" ||
                status === "UNAVAILABLE" ||
                status === "RESOURCE_EXHAUSTED" ||
                messageLower.includes("503") || 
                messageLower.includes("429") || 
                messageLower.includes("high demand") ||
                messageLower.includes("unavailable") ||
                messageLower.includes("busy") ||
                messageLower.includes("limit reached") ||
                statusTextLower.includes("unavailable") ||
                errorStr.includes("503") ||
                errorStr.includes("429") ||
                errorStr.includes("unavailable") ||
                errorStr.includes("demand");

            if (isTransient) {
                // Exponential backoff with jitter: 2s, 4s, 8s, 16s, 32s, 64s, 128s...
                const baseDelay = Math.pow(2, i + 1) * 1000;
                const jitter = Math.random() * 2000;
                const delay = baseDelay + jitter;
                
                console.warn(`API busy or unavailable (status ${status}). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
                await sleep(delay);
                continue;
            }
            
            // 403: Permission Denied
            const isPermission = 
                status === 403 || 
                status === "403" || 
                messageLower.includes("403") || 
                messageLower.includes("permission") ||
                messageLower.includes("unauthorized") ||
                errorStr.includes("403") ||
                errorStr.includes("permission");

            if (isPermission) {
                throw new Error("PERMISSION_DENIED: Your API key does not have permission to access this model or service. Please check your API key in Settings or select a different one.");
            }

            throw error;
        }
    }
    throw lastError;
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
    
    const response = await callWithRetry(() => ai.models.generateContent({
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
    }));

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
            block += `  DIMENSIONAL CONSTRAINTS:
- These dimensions were verified or explicitly set by the user.
- Respect them as real-world scale guidance.
- Preserve realistic proportions and relative scale in the final scene.
- If the product interacts with hands, body, furniture or other products, ensure size consistency with these dimensions.\n`;
        }
    });

    if (products.length > 1 && products.some(p => p.alto_cm || p.ancho_cm || p.profundidad_cm)) {
        block += `- Maintain correct relative scale across all products according to the provided dimensions.\n`;
    }

    return block;
};

const getHumanRealismRules = (prompt: string, isStrongRegeneration: boolean = false): string => {
    const keywords = [
        'persona', 'modelo', 'mano', 'llevando', 'puesto', 'usando', 'sosteniendo',
        'wearable', 'gorra', 'gafas', 'ropa', 'camiseta', 'vestido', 'calzado',
        'person', 'model', 'hand', 'wearing', 'using', 'holding', 'maniquí'
    ];
    const lowerPrompt = prompt.toLowerCase();
    const hasHuman = keywords.some(k => lowerPrompt.includes(k));

    if (!hasHuman) return "";

    let rules = `
HUMAN / MODEL REALISM:
- real human skin texture
- natural body posture
- believable hand anatomy
- no mannequin / no rubber skin / no fake smile / no doll face
- natural integration between product and body
- if holding the product, fingers must wrap and compress naturally
- if wearing the product, fit, folds and contact must look real
`;

    if (isStrongRegeneration) {
        rules += `
HUMAN REALISM PRIORITY (AUTHENTIC LOOK):
- natural asymmetry
- skin texture with pores and tonal variation
- avoid beauty retouch
- avoid mannequin / rubber / porcelain look
- casual, everyday facial expression
- believable clothing wrinkles and natural posture
`;
    }

    return rules;
};

const getHandInteractionRules = (prompt: string): string => {
    const handActions = [
        'sacar', 'meter', 'sujetar', 'coger', 'abrir', 'cerrar', 'sostener', 'manipular',
        'take out', 'put in', 'hold', 'grip', 'open', 'close', 'manipulate', 'grab'
    ];
    const lowerPrompt = prompt.toLowerCase();
    const needsHandRules = handActions.some(k => lowerPrompt.includes(k)) || lowerPrompt.includes('mano') || lowerPrompt.includes('hand');

    if (!needsHandRules) return "";

    return `
HAND INTERACTION RULES:
- Define a clear role for each visible hand.
- Only the necessary number of hands should appear.
- No extra hands, no duplicate hands, no impossible grips.
- One hand may manipulate the object, the other may only stabilize if needed.
- Do not let hands block the product area that must remain visible.
`;
};

const getFunctionalDetailRules = (prompt: string): string => {
    const functionalParts = [
        'zipper', 'pull', 'cord', 'strap', 'handle', 'snap', 'closure', 'label', 'thermal',
        'cremallera', 'tirador', 'cuerda', 'asa', 'correa', 'cierre', 'corchete', 'etiqueta', 'interior térmico'
    ];
    const lowerPrompt = prompt.toLowerCase();
    const needsFunctionalRules = functionalParts.some(k => lowerPrompt.includes(k));

    if (!needsFunctionalRules) return "";

    return `
FUNCTIONAL DETAIL RULE:
- Small functional parts must be physically connected and believable.
- Do not invent loose straps, detached pulls or incorrect attachment points.
- Preserve how the closure / pull / cord / handle actually works.
`;
};

const getCleanLightRules = (prompt: string): string => {
    const lightKeywords = [
        'fresco', 'crispy', 'neutro', 'limpio', 'sin amarillos', 'sin magenta', 'fresh', 'neutral', 'clean', 'no yellow', 'no magenta'
    ];
    const lowerPrompt = prompt.toLowerCase();
    const needsLightRules = lightKeywords.some(k => lowerPrompt.includes(k));

    if (!needsLightRules) return "";

    return `
CLEAN LIGHT RULE:
- Clean whites, neutral to slightly cool light, natural contrast.
- No yellow cast, no magenta cast, no warm sunset look.
- Keep the scene bright and fresh without washing out the product.
`;
};

const getMultiplicityRules = (prompt: string): string => {
    const multiplicityKeywords = [
        'cinco', 'cuatro', 'tres', 'dos', 'varios', 'varias', 'grupo', 'exactamente', 'unidades',
        'five', 'four', 'three', 'two', 'several', 'group', 'exactly', 'units', 'distribution', 'distribución'
    ];
    const lowerPrompt = prompt.toLowerCase();
    const needsMultiplicity = multiplicityKeywords.some(k => lowerPrompt.includes(k));

    if (!needsMultiplicity) return "";

    return `
EXACT COUNT & DISTRIBUTION RULE:
- Preserve the exact number of visible product units requested.
- Do not add extra units beyond the specified count.
- Do not merge two units into a single hand, arm or body part.
- If specific colors are mentioned for specific counts, maintain that color distribution exactly.
- Each unit must remain visually distinct and separately identifiable.
`;
};

const getPersonalizationZoneRules = (prompt: string): string => {
    const customizableKeywords = [
        'zona liso', 'frontal', 'rectangular', 'banda', 'flat band', 'personalizable', 'personalización',
        'customizable', 'personalization', 'custom area', 'main surface', 'pulsera', 'wristband'
    ];
    const lowerPrompt = prompt.toLowerCase();
    const needsZoneRules = customizableKeywords.some(k => lowerPrompt.includes(k));

    if (!needsZoneRules) return "";

    return `
PERSONALIZATION ZONE RULE:
- The customizable area (flat band, frontal area, or literal personalization zone) must be the primary visible surface.
- Keep this area clean, visible, unobstructed and perfectly readable.
- Secondary decorative parts (beads, hanging tails, charms) must not dominate or block the main area.
- Ensure the product's function is clear from the visibility of this zone.
`;
};

const getGroupSimplificationRules = (prompt: string): string => {
    const groupKeywords = [
        'grupo', 'celebración', 'despedida', 'brindis', 'bar', 'terraza', 'fiesta', 'evento',
        'group', 'celebration', 'party', 'brindis', 'event', 'social', 'cluttered', 'crowded'
    ];
    const lowerPrompt = prompt.toLowerCase();
    const needsSimpRules = groupKeywords.some(k => lowerPrompt.includes(k));

    if (!needsSimpRules) return "";

    return `
GROUP SIMPLIFICATION RULE:
- Keep the social context believable but visually secondary.
- Avoid clutter in the center of the frame where the products are.
- Avoid overlapping limbs, stacked fists, or excessive props that make counting the product units difficult.
- Each product unit must stay visually distinct even in a crowded scene.
`;
};

const getVisualPositioningRules = (prompt: string): string => {
    let rules = "";
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('centro') || lowerPrompt.includes('center')) {
        rules += "- The specific unit mentioned for the center must occupy the central foreground position.\n";
    }
    if (lowerPrompt.includes('izquierda') || lowerPrompt.includes('left')) {
        rules += "- Units described for the left must be clearly positioned on the left side of the frame.\n";
    }
    if (lowerPrompt.includes('derecha') || lowerPrompt.includes('right')) {
        rules += "- Units described for the right must be clearly positioned on the right side of the frame.\n";
    }

    if (!rules) return "";
    
    return `\nVISUAL POSITIONING CONSTRAINTS:\n${rules}`;
};

const getPriorityEnforcementRules = (prompt: string): string => {
    const lowerPrompt = prompt.toLowerCase();
    let rules = "";

    // 1. EMOTIONAL / FAMILY SCENES
    const emotionalKeywords = [
        'madre', 'hija', 'abuela', 'niño', 'regalo', 'sorpresa', 'detrás de la espalda', 'salón', 'hogar', 'té', 
        'family', 'emotional', 'celebration', 'mother', 'daughter', 'grandmother', 'child', 'gift', 'surprise', 
        'behind the back', 'living room', 'home', 'tea'
    ];
    if (emotionalKeywords.some(k => lowerPrompt.includes(k))) {
        rules += `
EMOTIONAL SCENE RULE:
- Build the image around the product, not around the emotion.
- Keep the product large, legible and commercially useful.
- Keep the personalization area clean and visible.
- Human emotion should support the scene, not dominate it.
- If needed, keep people partial or secondary instead of fully portrait-like.
`;
    }

    // 2. SMALL PRODUCTS
    const smallKeywords = [
        'gift', 'behind the back', 'hand-held object', 'jewelry', 'bracelet', 'bouquet', 'rose', 'box', 'small gift',
        'regalo', 'detrás de la espalda', 'objeto de mano', 'joya', 'pulsera', 'ramo', 'rosa', 'caja'
    ];
    if (smallKeywords.some(k => lowerPrompt.includes(k))) {
        rules += `
SMALL PRODUCT PRIORITY:
- The product must remain visually important in the frame.
- Do not let it shrink into a secondary prop.
- Keep it oriented toward camera when visibility matters.
- Use a framing close enough to preserve detail, texture and personalization area.
`;
    }

    // 3. CLOSED PACKAGING
    const packagingKeywords = [
        'caja cerrada', 'box closed', 'closed pack', 'closed packaging', 'no abrir', 'do not open'
    ];
    if (packagingKeywords.some(k => lowerPrompt.includes(k))) {
        rules += `
CLOSED PACKAGING RULE:
- Keep the product fully closed.
- Do not reveal the inner contents.
- Do not partially open or reinterpret the package.
- Preserve the external personalized surface as the key visible area.
`;
    }

    // 4. PERSONALIZATION AREA WITH PEOPLE
    const personalizationKeywords = [
        'zona liso', 'frontal', 'rectangular', 'banda', 'flat band', 'personalizable', 'personalización',
        'customizable', 'personalization', 'custom area', 'main surface', 'pulsera', 'wristband'
    ];
    const humanKeywords = [
        'persona', 'modelo', 'mano', 'llevando', 'puesto', 'usando', 'sosteniendo',
        'wearable', 'gorra', 'gafas', 'ropa', 'camiseta', 'vestido', 'calzado',
        'person', 'model', 'hand', 'wearing', 'using', 'holding', 'maniquí'
    ];
    
    const hasPersonalization = personalizationKeywords.some(k => lowerPrompt.includes(k));
    const hasHumans = humanKeywords.some(k => lowerPrompt.includes(k));
    
    if (hasPersonalization && hasHumans) {
        rules += `
PERSONALIZATION PRIORITY:
- The customizable surface must remain clean, visible and readable.
- Hands, props, ribbons, flowers, wrapping or body position must not block it.
- If necessary, simplify the human action to preserve product legibility.
`;
    }

    return rules ? `\nPRIORITY ENFORCEMENT RULES:${rules}` : "";
};

const getReferenceTypeInstructions = (extra: ProductImage, masters: ProductImage[]): string => {
    const { referenceType: type, appliesToProductCardId: masterId, identityRelation: relation } = extra;
    
    let instructions = "";
    
    // Identity Relation logic
    if (relation === "same_product") {
        const targetMasterIdx = masters.findIndex(m => m.id === masterId);
        const masterRef = targetMasterIdx !== -1 ? `MASTER ${targetMasterIdx + 1}` : "the master reference";
        instructions += `This image belongs to the SAME product identity as ${masterRef}. Use it jointly with the master to reconstruct missing visible information (front/back/interior/exterior/details). Do not treat it as a separate object. `;
    } else if (relation === "additional_product") {
        instructions += "This image is a separate real product that must also appear in the final scene as an independent object. Keep it as an independent product identity. ";
    } else if (relation === "inspiration") {
        instructions += "Use this image ONLY for mood/atmosphere/context. DO NOT copy product identity, shapes or logos from it. ";
    }

    // Specific Type logic
    switch (type) {
        case 'detail': 
            instructions += "Focus on preserving fine details, textures, engraving, stitching or print. ";
            break;
        case 'color': 
            instructions += "Use for color/finish reference ONLY. Preserve shapes from the target MASTER. ";
            break;
        case 'angle': 
            instructions += "Another view of the same product. Merge geometry and details with the MASTER. ";
            break;
        case 'style': 
            instructions += "Use for lighting or atmosphere only. ";
            break;
        case 'extra_product': 
            instructions += "Separate real product identity to be included naturally in the scene. ";
            break;
    }
    
    return instructions.trim();
};

const buildExtrasBlock = (extras: ProductImage[], masters: ProductImage[]): string => {
    if (extras.length === 0) return "";
    
    let block = "\nADDITIONAL REFERENCES:\n";
    
    const hasExtraProducts = extras.some(e => e.referenceType === 'extra_product' || e.identityRelation === 'additional_product');
    if (hasExtraProducts) {
        block += `
MULTI-PRODUCT SCENE RULE:
- Include all intended products naturally in the final composition.
- Preserve each product as a separate real object.
`;
    }

    if (extras.some(e => e.identityRelation === 'same_product')) {
        block += `
MULTI-VIEW PRODUCT RULE:
- If multiple references describe different sides/interior/exterior of the same product, merge all visible information into one coherent product identity.
- Do not ignore relevant views if the scene requires them.
`;
    }

    extras.forEach((extra, idx) => {
        const typeLabel = getReferenceTypeLabel(extra.referenceType);
        const instructions = getReferenceTypeInstructions(extra, masters);
        if (extra.comment) {
            block += `${typeLabel} REFERENCE ${idx + 1}: ${extra.comment}. ${instructions}\n`;
        } else {
            block += `${typeLabel} REFERENCE ${idx + 1}. ${instructions}\n`;
        }
    });

    return block;
};

const buildFinalPrompt = (
    products: PreflightData[], 
    userPrompt: string, 
    extras: ProductImage[],
    masters: ProductImage[]
): string => {
    let finalPrompt = "";

    // A) Identity Block (Multi-product)
    finalPrompt += buildIdentityBlock(products);

    // B) Global Rules
    finalPrompt += GLOBAL_RULES;

    // C) Human Realism & Specialized Rules (Conditional)
    finalPrompt += getHumanRealismRules(userPrompt);
    finalPrompt += getHandInteractionRules(userPrompt);
    finalPrompt += getFunctionalDetailRules(userPrompt);
    finalPrompt += getCleanLightRules(userPrompt);
    finalPrompt += getMultiplicityRules(userPrompt);
    finalPrompt += getPersonalizationZoneRules(userPrompt);
    finalPrompt += getGroupSimplificationRules(userPrompt);
    finalPrompt += getVisualPositioningRules(userPrompt);
    finalPrompt += getPriorityEnforcementRules(userPrompt);

    // D) Scene Instructions
    const cleanUserPrompt = userPrompt.trim();
    finalPrompt += `\nSCENE INSTRUCTIONS:\n${cleanUserPrompt}\n`;

    // E) Extra References Block
    finalPrompt += buildExtrasBlock(extras, masters);

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

    const response = await callWithRetry(() => ai.models.generateContent({
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
                7. Wrong scale: product size is inconsistent with dimensions or surroundings.
                
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
    }));

    try {
        const text = response.text?.trim() || '{"pass": true, "issues": []}';
        return JSON.parse(text);
    } catch (e) {
        console.error("QA Parse Error", e);
        return { pass: true, issues: [] }; // Fallback to pass if QA fails to parse
    }
};

const buildCorrectivePrompt = (issues: string[]): string => {
    let corrective = "\n\nCorrective instructions (FIX THESE SPECIFIC ISSUES):";
    let added = false;

    if (issues.includes("human realism")) {
        corrective += "\n- ISSUE: Human Realism. FIX: Natural skin texture, believable fingers and anatomy, real facial proportions. Remove mannequin or rubber look.";
        added = true;
    }
    if (issues.includes("pasted look")) {
        corrective += "\n- ISSUE: Pasted look. FIX: The product must feel embedded in the scene with stronger spatial interaction and believable grounding.";
        added = true;
    }
    if (issues.includes("depth/integration")) {
        corrective += "\n- ISSUE: Depth/Integration. FIX: Increase realistic depth, ensure perspective consistency and environmental interaction.";
        added = true;
    }
    if (issues.includes("shadows/contact")) {
        corrective += "\n- ISSUE: Shadows/Contact. FIX: Strengthen contact shadows and physical grounding where the product touches surfaces or is held.";
        added = true;
    }
    if (issues.includes("invented text")) {
        corrective += "\n- ISSUE: Invented Text. FIX: Do not invent text, labels or branding. Preserve ONLY what is visible in master references.";
        added = true;
    }
    if (issues.includes("unwanted duplicates")) {
        corrective += "\n- ISSUE: Duplicates. FIX: Do not duplicate any product unless explicitly requested.";
        added = true;
    }
    if (issues.includes("wrong scale")) {
        corrective += "\n- ISSUE: Wrong Scale. FIX: Strictly respect the provided product dimensions and maintain believable real-world scale.";
        added = true;
    }

    return added ? corrective : "";
};

// 2. GENERATE SIMPLE
export const generateLifestyleImageSimple = async (
    masterFiles: File[], 
    extraFiles: ProductImage[], 
    productsData: PreflightData[], 
    userScenePrompt: string,
    masters: ProductImage[],
    modelId: ImageGenerationModel = 'gemini-3.1-flash-image-preview',
    aspectRatio: string = '1:1',
    presetId?: string,
    sizeInternal?: string
): Promise<{ imageBlob: Blob, width: number, height: number, promptUsed: string, baseScenePrompt?: string, debugInfo?: any }> => {
    
    const ai = getAIClient();
    const prompt = buildFinalPrompt(productsData, userScenePrompt, extraFiles, masters);
    
    let retryCount = 0;
    let lastBlob: Blob | null = null;
    let lastPrompt = prompt;
    let isSimplified = false;

    while (retryCount <= 2) {
        const parts: any[] = [];

        // Progressive simplification for IMAGE_OTHER
        const isImageOtherRetry = isSimplified;
        
        // 1. All images first
        const maxMasters = isImageOtherRetry ? 1 : masterFiles.length;
        for (let i = 0; i < Math.min(masterFiles.length, maxMasters); i++) {
            const file = masterFiles[i];
            const masterB64 = await fileToBase64(file);
            parts.push({ inlineData: { mimeType: file.type || 'image/jpeg', data: masterB64 } });
        }

        if (extraFiles.length > 0 && !isImageOtherRetry) {
            for (const extra of extraFiles) {
                const extraB64 = await fileToBase64(extra.file);
                parts.push({ inlineData: { mimeType: extra.file.type || 'image/jpeg', data: extraB64 } });
            }
        }

        // 2. Single text instruction at the end
        const instructionPrefix = (retryCount === 2 && lastPrompt === userScenePrompt) ? "" : "Instruction: Generate a photorealistic lifestyle image featuring the product(s) shown in the images. ";
        parts.push({ text: `${instructionPrefix}${lastPrompt}` });

        console.log(`Generating (Attempt ${retryCount + 1}) with model:`, modelId);

        try {
            const response = await callWithRetry(() => ai.models.generateContent({
                model: modelId,
                contents: { parts },
                config: { 
                    imageConfig: {
                        aspectRatio: aspectRatio as any,
                        imageSize: (sizeInternal || (modelId === 'gemini-3-pro-image-preview' ? '2K' : '1K')) as any
                    },
                    safetySettings: SAFETY_SETTINGS
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

                // Progressive simplification for ANY failure to generate image data
                if (retryCount < 2) {
                    console.warn(`${finishReason || 'UNKNOWN'} detected (Attempt ${retryCount + 1}). Simplifying prompt for retry...`);
                    isSimplified = true;
                    if (retryCount === 0) {
                        // First retry: Remove complex rules, keep core scene and products
                        lastPrompt = `Photorealistic lifestyle photo: ${userScenePrompt}. Featured products: ${productsData.map(p => p.object_name_es).join(', ')}.`;
                    } else {
                        // Second retry: Absolute minimum prompt, no extra instructions
                        lastPrompt = userScenePrompt;
                    }
                }

                throw new Error(`Failed to generate image data (Finish Reason: ${finishReason})${refusalReason}`);
            }

            const base64 = imagePart.inlineData.data;
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
            lastBlob = imageBlob;
            generatedImageAttempts++;

            // QA Check
            const qa = await qaCheckGeneratedImage(imageBlob, lastPrompt, productsData);
            if (qa.pass || retryCount === 2) {
                const dims = await getImageDimensions(imageBlob);
                return {
                    imageBlob,
                    width: dims.width,
                    height: dims.height,
                    promptUsed: lastPrompt,
                    baseScenePrompt: userScenePrompt,
                    debugInfo: {
                        retries: retryCount,
                        qaIssues: qa.issues,
                        numMasters: masterFiles.length,
                        numExtras: extraFiles.length,
                        isSimplified,
                        primaryProduct: productsData[0]?.object_name_es,
                        modelUsed: modelId,
                        presetUsed: presetId,
                        aspectRatioRequested: aspectRatio,
                        sizeInternalRequested: sizeInternal,
                        actualWidth: dims.width,
                        actualHeight: dims.height,
                        generatedImageAttempts
                    }
                };
            }

            // Retry logic
            retryCount++;
            console.log(`QA Failed (Attempt ${retryCount}):`, qa.issues);
            const corrective = buildCorrectivePrompt(qa.issues);
            const baseForCorrective = isSimplified ? lastPrompt : prompt;
            lastPrompt = `${baseForCorrective}${corrective}\n\nDetected issues to fix: ${qa.issues.join(', ')}.`;

        } catch (apiError: any) {
            console.error(`Attempt ${retryCount + 1} failed:`, apiError);
            if (retryCount === 2) throw apiError;
            retryCount++;
            await sleep(1000); // Small delay before retry
        }
    }

    throw new Error("Failed to generate a high-quality image after retries.");
};

const classifyEditRequest = (changesText: string): "soft_edit" | "strong_regeneration" => {
    const strongKeywords = [
        'más real', 'menos ia', 'menos perfecto', 'más natural', 'menos stock', 'menos beauty', 'menos modelo', 'más cotidiano', 'menos maniquí',
        'cambiar ropa', 'otra ropa', 'vestuario', 'ropa diferente',
        'mirar a cámara', 'mirando a cámara', 'contacto visual', 'mira a cámara',
        'más alegre', 'sonrisa', 'otra expresión', 'gesto', 'cara', 'rostro',
        'mejor luz', 'iluminación', 'luz solar', 'luz de estudio', 'cambiar luz', 'iluminar mejor',
        'cambiar fondo', 'otro fondo', 'escenario diferente', 'cambiar mood', 'ambiente', 'entorno',
        'mejor encuadre', 'más abierto', 'más cerrado', 'más alto', 'más aire', 'zoom', 'plano', 'composición', 'encuadrar',
        // New Structural/Hand/Functional keywords
        'mano', 'dedo', 'agarre', 'sacar', 'meter', 'sujetar', 'coger', 'tirador', 'cuerda', 'asa', 'cierre', 'cremallera', 'corchete', 'etiqueta',
        'grip', 'finger', 'hand', 'take out', 'put in', 'hold', 'grab', 'handle', 'cord', 'zipper', 'snap', 'closure', 'label',
        // New Lighting/Color Cast keywords
        'amarillo', 'magenta', 'cálido', 'fresco', 'neutro', 'crispy', 'limpio', 'frio',
        'yellow', 'warm', 'fresh', 'neutral', 'clean', 'cool',
        // New Interaction/Spatial keywords
        'pegada', 'pegado', 'separar', 'distribución', 'silla', 'mesa', 'asiento', 'espacio',
        'stuck', 'separate', 'chair', 'table', 'seat', 'space',
        // New Multiplicity/Count keywords
        'número', 'unidades', 'cantidad', 'solo una', 'una sola', 'sobran', 'faltan', 'exactamente', 'en el mismo brazo', 'en la misma mano',
        'number', 'count', 'units', 'amount', 'only one', 'single', 'extra units', 'missing units', 'exactly', 'on the same arm'
    ];

    const lowerText = changesText.toLowerCase();
    const isStrong = strongKeywords.some(k => lowerText.includes(k));

    return isStrong ? "strong_regeneration" : "soft_edit";
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
    modelId: ImageGenerationModel = 'gemini-3.1-flash-image-preview',
    aspectRatio: string = '1:1',
    presetId?: string,
    sizeInternal?: string
): Promise<{ imageBlob: Blob, width: number, height: number, promptUsed: string, baseScenePrompt?: string, lastEditChanges?: string, debugInfo?: any }> => {
    const ai = getAIClient();
    const sourceB64 = await fileToBase64(sourceImageBlob);
    
    const editType = classifyEditRequest(changes);
    const isStrong = editType === "strong_regeneration";
    
    const identity = buildIdentityBlock(productsData);
    const combinedPrompt = changes + " " + baseScenePrompt;
    const humanRealism = getHumanRealismRules(combinedPrompt, isStrong);
    const handRules = getHandInteractionRules(combinedPrompt);
    const functionalRules = getFunctionalDetailRules(combinedPrompt);
    const lightRules = getCleanLightRules(combinedPrompt);
    const multiplicityRules = getMultiplicityRules(combinedPrompt);
    const personalizationRules = getPersonalizationZoneRules(combinedPrompt);
    const groupRules = getGroupSimplificationRules(combinedPrompt);
    const positionRules = getVisualPositioningRules(combinedPrompt);
    const priorityRules = getPriorityEnforcementRules(combinedPrompt);
    const extrasBlock = buildExtrasBlock(extraFiles, masters);
    
    const baseEditPrompt = `
${GLOBAL_EDIT_RULES}

ADDITIONAL CONTEXT & IDENTITY:
${identity}
${extrasBlock}
${baseScenePrompt ? `BASE SCENE PROMPT: ${baseScenePrompt}` : ''}

${humanRealism || handRules || functionalRules || lightRules || multiplicityRules || personalizationRules || groupRules || positionRules || priorityRules ? `SPECIALIZED RULES:\n${humanRealism}\n${handRules}\n${functionalRules}\n${lightRules}\n${multiplicityRules}\n${personalizationRules}\n${groupRules}\n${positionRules}\n${priorityRules}\n` : ''}

${isStrong ? `STRONG EDIT MODE:
The previous generated image is only a loose reference. Feel free to strongly regenerate person, clothing, lighting, mood, expression, framing and background to fulfill the requested changes.` : `DELTA EDIT MODE:
Keep general composition, mood and visual continuity from the previous generated image unless the requested changes imply otherwise.`}

USER EDIT REQUEST
${changes}
`;

    let retryCount = 0;
    let lastPrompt = baseEditPrompt;
    let isSimplified = false;
    let generatedImageAttempts = 0;

    while (retryCount <= 2) {
        const parts: any[] = [];

        // Progressive simplification for IMAGE_OTHER
        const isImageOtherRetry = isSimplified;

        // 1. Context: Previous Image
        parts.push({ inlineData: { data: sourceB64, mimeType: 'image/png' } });

        // 2. Master references
        const maxMasters = isImageOtherRetry ? 1 : masterFiles.length;
        for (let i = 0; i < Math.min(masterFiles.length, maxMasters); i++) {
            const masterB64 = await fileToBase64(masterFiles[i]);
            parts.push({ inlineData: { data: masterB64, mimeType: masterFiles[i].type || 'image/jpeg' } });
        }

        // 3. Extra references (if any)
        if (extraFiles.length > 0 && !isImageOtherRetry) {
            for (const extra of extraFiles) {
                const extraB64 = await fileToBase64(extra.file);
                parts.push({ inlineData: { mimeType: extra.file.type || 'image/jpeg', data: extraB64 } });
            }
        }

        // 4. Single text instruction at the end
        const instructionPrefix = (retryCount === 2 && lastPrompt === changes) ? "" : "Instruction: Modify the provided image according to these changes: ";
        parts.push({ text: `${instructionPrefix}${lastPrompt}` });

        try {
            const response = await callWithRetry(() => ai.models.generateContent({
                model: modelId,
                contents: { parts },
                config: {
                    imageConfig: {
                        aspectRatio: aspectRatio as any,
                        imageSize: (sizeInternal || (modelId === 'gemini-3-pro-image-preview' ? '2K' : '1K')) as any
                    },
                    safetySettings: SAFETY_SETTINGS
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
                
                // Progressive simplification for ANY failure to generate image data
                if (retryCount < 2) {
                    console.warn(`Edit ${finishReason || 'UNKNOWN'} detected (Attempt ${retryCount + 1}). Simplifying prompt for retry...`);
                    isSimplified = true;
                    if (retryCount === 0) {
                        // First retry: Simplified edit instructions
                        lastPrompt = `Modify the image: ${changes}. Ensure products match: ${productsData.map(p => p.object_name_es).join(', ')}.`;
                    } else {
                        // Second retry: Bare minimum
                        lastPrompt = changes;
                    }
                }
                
                throw new Error(`Edit failed to generate image data (Finish Reason: ${finishReason})${refusalReason}`);
            }

            const base64 = imagePart.inlineData.data;
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const imageBlob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
            generatedImageAttempts++;

            // QA Check
            const qa = await qaCheckGeneratedImage(imageBlob, lastPrompt, productsData);
            if (qa.pass || retryCount === 2) {
                const dims = await getImageDimensions(imageBlob);
                return {
                    imageBlob,
                    width: dims.width,
                    height: dims.height,
                    promptUsed: lastPrompt,
                    baseScenePrompt: baseScenePrompt,
                    lastEditChanges: changes,
                    debugInfo: {
                        retryCount,
                        isSimplified,
                        editType,
                        numMasters: masterFiles.length,
                        numExtras: extraFiles.length,
                        qaIssues: qa.issues,
                        modelUsed: modelId,
                        presetUsed: presetId,
                        aspectRatioRequested: aspectRatio,
                        sizeInternalRequested: sizeInternal,
                        actualWidth: dims.width,
                        actualHeight: dims.height,
                        generatedImageAttempts
                    }
                };
            }

            // Retry logic
            retryCount++;
            console.log(`Edit QA Failed (Attempt ${retryCount}):`, qa.issues);
            const corrective = buildCorrectivePrompt(qa.issues);
            const baseForCorrective = isSimplified ? lastPrompt : baseEditPrompt;
            lastPrompt = `${baseForCorrective}${corrective}\n\nDetected issues to fix: ${qa.issues.join(', ')}.`;

        } catch (apiError: any) {
            console.error(`Edit Attempt ${retryCount + 1} failed:`, apiError);
            if (retryCount === 2) throw apiError;
            retryCount++;
            await sleep(1000); // Small delay before retry
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

        const response = await callWithRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                imageConfig: {
                    aspectRatio: config.aspectRatio === 'Custom' ? '1:1' : config.aspectRatio as any
                },
                safetySettings: SAFETY_SETTINGS
            }
        }));

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

    const response = await callWithRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: "1:1"
            },
            safetySettings: SAFETY_SETTINGS
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
