
// --- SIMPLIFIED FLOW TYPES (ACTIVE) ---

export enum AppState {
  UPLOAD = 'upload',
  ANALYZING = 'analyzing',
  PREFLIGHT = 'preflight',
  GENERATING = 'generating',
  RESULTS = 'results',
}

export type ReferenceType = "detail" | "color" | "angle" | "style" | "extra_product" | "other";

export interface ProductImage {
  id: string;
  file: File;
  previewUrl: string;
  thumbnailUrl: string;
  isMaster: boolean;
  comment?: string;
  role?: 'Main' | 'Extra'; // kept for compatibility
  referenceType?: ReferenceType;
}

export interface PreflightData {
  id?: string; // Link to image id
  object_name_es: string;
  material_finish_es: string;
  alto_cm: number | null;
  ancho_cm: number | null;
  profundidad_cm: number | null;
  dimension_profile?: 'box' | 'cylinder' | 'sphere' | 'other';
}

export interface SimpleGenerationResult {
  imageUrl: string;
  imageBlob: Blob;
  width: number;
  height: number;
  promptUsed: string;
}

export interface AppError {
  message: string;
}

// --- LEGACY TYPES (KEPT FOR BUILD COMPATIBILITY WITH UNUSED FILES) ---

export type AspectRatioVal = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | 'Custom';
export type Orientation = 'horizontal' | 'vertical' | 'square';
export type Plane = 'close' | 'medium' | 'wide';
export type Angle = 'frontal' | '45°' | 'zenithal' | 'contrapicado';
export type Aesthetic = 'generic' | 'minimalist' | 'industrial' | 'nature' | 'luxury';
export type Season = 'No Preference' | 'Spring' | 'Summer' | 'Autumn' | 'Winter';
export type LocationCategory = 'Home' | 'Outdoors' | 'Public/Commercial';
export type SpecificLocation = string;
export type AgeGroup = 'Adult' | 'Child' | 'Senior' | 'Teen';
export type Gender = 'Unisex' | 'Male' | 'Female';
export type HumanType = 'hand' | 'full_body' | 'partial';
export type SkinDetail = 'Balanced' | 'Smooth' | 'Textured';
export type SpecialOccasion = 'Christmas' | "Valentine's Day" | 'Halloween' | 'Birthday' | 'Wedding';
export type Rigidity = 'Rigid' | 'Semi-rigid' | 'Malleable';
export type Transparency = 'No' | 'Yes';

export interface ProductAnalysis {
  imageId: string;
  object_name: string;
  material_finish: string;
  alto_cm: number;
  ancho_cm: number;
  largo_cm: number;
  espesor_cm?: number;
  circunferencia_cm?: number;
  scale_source: 'estimated' | 'user';
  palette?: string[];
  rigidez: Rigidity;
  transparencia: Transparency;
  descripcion_tecnica: string;
}

export interface HumanBlock {
    enabled: boolean;
    type: HumanType;
    count: number;
    skinDetail?: SkinDetail;
}

export interface SlotConfig {
    enabled: boolean;
    seedOffset: number;
    locationCategory?: LocationCategory;
    specificLocation?: SpecificLocation | null;
    aesthetic?: Aesthetic;
    season?: Season;
    human?: HumanBlock;
    audience?: { age: AgeGroup; gender: Gender };
    specialOccasions?: SpecialOccasion[];
    referenceImage?: File;
    referenceUse?: string[];
    referenceNote?: string;
    angle?: Angle;
    plane?: Plane;
}

export interface SceneConfig {
    locationCategory: LocationCategory;
    specificLocation: SpecificLocation | null;
    aesthetic: Aesthetic;
    season: Season;
    audience: { age: AgeGroup; gender: Gender };
    plane: Plane;
    angle: Angle;
    orientation: Orientation;
    aspectRatio: AspectRatioVal;
    customRatio: number;
    human: HumanBlock;
    specialOccasions: SpecialOccasion[];
    referenceImage: File | null;
    referenceUse: string[];
    referenceNote: string;
    slotConfigs: SlotConfig[];
    override: { enabled: boolean; referenceImage: File | null };
    customPrompt?: string;
}

export interface QAReport {
    seed: number;
    prompt_final: string;
    model_id: string;
    model_version?: string;
    decision: 'accepted' | 'rejected' | 'warning';
    failed_metrics: string[];
    notes?: string[];
    rejection_reason?: string;
    contour_drift_px?: number; 
    deltaE_mean?: number;
    deltaE_max?: number;
    ssim_silhouette?: number;
    ocr_ok?: boolean;
    halos_px?: number;
    wb_delta_uv?: number;
    ruido_sigma_pct?: number;
    prop_ocultacion_pct?: number;
    props_count?: number;
    props_budget?: number;
    pipeline_stage?: string;
    retries_A?: number;
    retries_B?: number;
    nonSquare?: boolean;
    masterSizeRequested?: number;
    masterSizeUsed?: number;
    bbox_pct?: number;
    contactShadows_status?: string;
    humans_count?: number;
}

export interface ExportDetails {
    filename_out: string;
    peso_kb: number;
    long_edge_px: number;
    width_px: number;
    height_px: number;
    format: string;
    quality: number;
    icc_incrustado: boolean;
}

export interface ExportReport {
    master: ExportDetails;
}

export interface GenerationSlot {
    slot: number;
    prompt_positive: string;
    prompt_negative: string;
    notes: string[];
}

export interface SafeArea {
    S: number;
    safeW: number;
    safeH: number;
    cx: number;
    cy: number;
    margin: number;
    normRect: { x: number; y: number; w: number; h: number };
}

export interface GenerationResult {
    imageUrls: string[];
    imageBlobs: Blob[];
    masterWidths: number[];
    masterHeights: number[];
    safeArea: SafeArea;
    productAnalyses: ProductAnalysis[];
    allPhotos: ProductImage[]; 
    sceneConfig: SceneConfig;
    sceneConfigsUsed: SceneConfig[];
    generationSlots: GenerationSlot[];
    qaReports: QAReport[];
    exportReports: ExportReport[];
    wasCappedArray: boolean[];
    wasCroppedArray: boolean[];
}

export type VideoTemplate = 'push_in' | 'pan' | 'parallax';
export type VideoIntensity = 'low' | 'med';

export interface VideoConfig {
    template: VideoTemplate;
    intensity: VideoIntensity;
    sourceImage: {
        blob: Blob;
        url: string;
        width: number;
        height: number;
    };
}

export interface VideoResult {
    videoUrl: string;
    posterUrl: string;
    config: VideoConfig;
    qaReport: QAReport;
}

export const HUMAN_TYPES = ['hand', 'full_body', 'partial'];
export const HUMAN_LABELS: Record<string, string> = { hand: 'Hand Only', full_body: 'Full Body', partial: 'Partial' };
export const AESTHETICS = [
    { value: 'generic', label: 'Generic', tooltip: '' },
    { value: 'minimalist', label: 'Minimalist', tooltip: '' },
    { value: 'luxury', label: 'Luxury', tooltip: '' },
    { value: 'industrial', label: 'Industrial', tooltip: '' },
    { value: 'nature', label: 'Nature', tooltip: '' },
];
export const SEASONS = [
    { value: 'No Preference', label: 'No Preference' },
    { value: 'Spring', label: 'Spring' },
    { value: 'Summer', label: 'Summer' },
    { value: 'Autumn', label: 'Autumn' },
    { value: 'Winter', label: 'Winter' },
];
export const AGE_GROUPS = ['Adult', 'Child', 'Senior', 'Teen'];
export const GENDERS = ['Unisex', 'Male', 'Female'];
export const ANGLES = ['frontal', '45°', 'zenithal', 'contrapicado'];
export const LOCATION_PRESETS = [
    { category: 'Home', specific: ['Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Home Office'] },
    { category: 'Outdoors', specific: ['Park', 'Street', 'Sports field'] },
    { category: 'Public/Commercial', specific: ['Restaurant/Café/Bar', 'Office', 'School (classroom)'] },
];
export const SPECIAL_OCCASIONS = ['Christmas', "Valentine's Day", 'Halloween', 'Birthday', 'Wedding'];
export const REFERENCE_USE_OPTIONS = ['palette', 'mood', 'composition'];
export const REFERENCE_USE_LABELS: Record<string, string> = { palette: 'Palette', mood: 'Mood', composition: 'Composition' };
