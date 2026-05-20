export interface ResultData { [key: string]: any; }
export interface ViralShortsState { [key: string]: any; }
export interface Pomelli { [key: string]: any; }
export interface PublishingKitData { [key: string]: any; }
export interface ExternalMarketData { [key: string]: any; }
export interface PipelineStep { id: string; label: string; status: any; message?: string; details?: string; }
export type PipelineStepStatus = 'pending' | 'running' | 'success' | 'warning' | 'error' | 'skipped';
export interface AnalysisPipelineMode { [key: string]: any; }
export interface RuntimeTruthStatus { mode: string; }
export interface ModelUsageTrace { entries: any[]; fidelity: string; }
