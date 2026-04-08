
// This file contains mock logic for running all Quality Assurance checks.
import { QAReport } from '../../types';
import { companionPresentCheck } from './companion';

interface QAHints {
    requireCompanions: number;
    wearablesOnModel: boolean;
    [key: string]: any;
}

/**
 * Runs a series of QA checks on a generated image.
 * This is a mock implementation.
 * @param imgBuf The image data buffer.
 * @param hints Hints generated during the prompt building phase.
 * @returns A promise that resolves to a partial QA report.
 */
// Fix: Replaced Buffer with Blob for browser compatibility.
export async function runQAChecks(imgBuf: Blob, hints: QAHints): Promise<Omit<QAReport, 'seed' | 'prompt_final' | 'model_id' | 'model_version'>> {
    const failed_metrics: string[] = [];
    const notes: string[] = [];
    
    const markWarning = (metric: string) => {
        if (!failed_metrics.includes(metric)) {
            failed_metrics.push(metric);
        }
    };

    // --- Start of user-provided logic ---
    // Check for companion products, but skip if the model is wearing the products.
    if (hints && hints.requireCompanions > 0) {
      if (!hints.wearablesOnModel) {
        const ok = await companionPresentCheck(imgBuf, hints.requireCompanions);
        if (!ok) {
            markWarning('companion_missing');
            notes.push('One or more secondary products might be missing from the scene.');
        }
      }
    }
    // --- End of user-provided logic ---
    
    // ... other QA checks would go here in a real implementation ...

    const decision = failed_metrics.length > 0 ? 'warning' : 'accepted';
    
    // Return a partial report with dummy values for other required fields.
    return {
        decision,
        failed_metrics,
        notes,
        deltaE_mean: 1.0,
        deltaE_max: 3.0,
        ssim_silhouette: 0.98,
        ocr_ok: true,
        halos_px: 0,
        wb_delta_uv: 0.001,
        ruido_sigma_pct: 0.1,
        prop_ocultacion_pct: 0,
        props_count: 3,
        props_budget: 5,
        pipeline_stage: 'qa_simulated',
        retries_A: 0,
        retries_B: 0,
        nonSquare: false,
        masterSizeRequested: 1024,
        masterSizeUsed: 1024,
        bbox_pct: 80,
        contactShadows_status: 'soft',
        humans_count: hints && hints.wearablesOnModel ? 1 : 0,
    };
}
