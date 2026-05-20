
export type PhysicalNature = 'PHYSICAL_STATIC' | 'PHYSICAL_NOISY' | 'PHYSICAL_DYNAMIC';
export type SemanticNature = 'SEMANTIC_STILL' | 'ACTIVE_VIDEO';

export type CNGFinalNature = 
  | 'STATIC_PURE' 
  | 'STATIC_WITH_NOISE' 
  | 'LOW_MOTION_REAL' 
  | 'REAL_DYNAMIC' 
  | 'SIMULATED_MOTION';

export type CNGContentType = 
  | 'VIDEO_PERFORMANCE'
  | 'GENERIC_STILL'
  | 'INFORMATIONAL_POSTER'
  | 'UI_SCREENSHOT';

export type CNGEvaluationMode = 
  | 'FULL_DYNAMIC'
  | 'ARC_BLIND'
  | 'INFORMATIONAL_STATIC';

export type CNGRegime = 'ARC_BLIND' | 'FULL'; // Legacy, kept for backwards compat

export interface CNGResult {
  physicalNature: PhysicalNature;
  semanticNature: SemanticNature;
  contentType: CNGContentType;
  finalNature: CNGFinalNature;
  evaluationMode: CNGEvaluationMode;
  regime: CNGRegime;
  capScore: number | null;
  edgeCaseFlag: boolean;
  shortReason: string;
  confidence: number;
}

export interface CNGThresholdConfig {
  NOISE_FLOOR: number;       // e.g. 0.05
  SPATIAL_DISPARITY: number; // e.g. 0.20
}
