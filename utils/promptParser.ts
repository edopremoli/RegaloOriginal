export const parsePromptBlocks = (rawPrompt: string) => {
    if (!rawPrompt.trim()) {
        return {
            scenePrompt: '',
            criticalDetail: '',
            negativePrompt: ''
        };
    }

    const sceneRegex = /(?:ESCENA|SCENE|CONTEXTO):\s*([\s\S]*?)(?=(?:DETALLE CR[ÍI]TICO|CRITICAL DETAIL|NEGATIVE|NEGATIVO|PROMPT NEGATIVO):|$)/i;
    const detailRegex = /(?:DETALLE CR[ÍI]TICO|CRITICAL DETAIL):\s*([\s\S]*?)(?=(?:ESCENA|SCENE|CONTEXTO|NEGATIVE|NEGATIVO|PROMPT NEGATIVO):|$)/i;
    const negativeRegex = /(?:NEGATIVE|NEGATIVO|PROMPT NEGATIVO):\s*([\s\S]*?)(?=(?:ESCENA|SCENE|CONTEXTO|DETALLE CR[ÍI]TICO|CRITICAL DETAIL):|$)/i;

    const sceneMatch = rawPrompt.match(sceneRegex);
    const detailMatch = rawPrompt.match(detailRegex);
    const negativeMatch = rawPrompt.match(negativeRegex);

    if (sceneMatch || detailMatch || negativeMatch) {
        return {
            scenePrompt: (sceneMatch ? sceneMatch[1] : '').trim(),
            criticalDetail: (detailMatch ? detailMatch[1] : '').trim(),
            negativePrompt: (negativeMatch ? negativeMatch[1] : '').trim()
        };
    } else {
        return {
            scenePrompt: rawPrompt.trim(),
            criticalDetail: '',
            negativePrompt: ''
        };
    }
};
