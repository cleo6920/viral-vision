export interface LogEvent {
  id: string;
  timestamp: number;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export interface Preset {
  id: string;
  name: string;
  toggles: any;
  mixers: any;
  fusionMixer: any;
}

export interface AnalysisVariant {
  characters: any[];
  timeline: any[];
  titles: any;
  hooks: any;
  videoHook: any;
  meta: any;
  audioMood: any;
  musicalAnalysis: any;
  masterPrompt: any;
  viralCutPrompt: any;
  scrollStopCoverPrompt: any;
  grokCutPrompts: any;
  coverPrompt: any;
  neuroScore: any;
  deepDecode: any;
  summary: any;
  genre: any;
  mood: any;
  antiBoredomScore: any;
  fusionMixEngine: any;
}

export interface DualAnalysisResult {
  faithful: AnalysisVariant;
  enhanced: AnalysisVariant;
}

export interface AppState {
  language: 'EN' | 'IT';
  activeTab: 'INPUT' | 'RESULTS' | 'ASSISTANT' | 'SCROLL_STOP';
  videoFile: File | null;
  videoUrl: string | null;
  videoMetadata: { name: string; size: number; duration: number } | null;
  range: { start: number; end: number };
  mode: 'PRO' | 'FLASH';
  presets: Preset[];
  activeVariant: 'faithful' | 'enhanced';
  variants: DualAnalysisResult | null;
  toggles: {
    visual: string;
    audio: string;
    overlay: string;
    content: string;
    characterIdentity: string;
    sceneIP: string;
    musicIP: string;
    dialogueLang: string;
    genre: string;
    viralOptimization: string;
    captureLogos: string;
    implementLogos: string;
    godMode: string;
  };
  goal: {
    raw: string;
    refined: string;
    corrections: string[];
  };
  mixers: {
    creative: number;
    camera: number;
    audio: number;
    dialogue: number;
    viral: number;
  };
  fusionMixer: {
    dc: number;
    em: number;
    rl: number;
    es: number;
  };
  safetyBypass: string;
  logs: LogEvent[];
  slots: AnalysisVariant;
  isDecoding: boolean;
  isGeneratingPrompt: boolean;
  isRefiningGoal: boolean;
  decodeProgress: number;
  promptColorToggle: boolean;
  chatHistory: any[];
  past: any[];
  future: any[];
  isChecklistActive: boolean;
  confirmedToggles: string[];
  lastHistorySave?: number;
}

export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';
export type Genre = string;
export type Platform = 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook' | 'X' | 'LinkedIn';
export type TargetLength = '15s' | '30s' | '60s';
export type AnalysisPipelineMode = 'STANDARD' | 'AUDIO_ENHANCED' | 'DEEP';

export type AnalysisMode = 'generate' | 'estimate' | 'anti-ai-slop' | 'trend-hunter' | 'hook-test' | 'viral-hook-bulk' | 'production-flow' | 'guided-short' | 'pensaci-tu';
export type AnalyticMode = 'FLASH' | 'PRO' | 'SMART' | 'TEST' | 'GROQ' | 'HUGGING';
export type ProductionStep = 'INPUT' | 'ANALYSIS' | 'IDEA_SELECTION' | 'PROMPT_GENERATION' | 'VIRAL_BOOST' | 'FINAL_ANALYSIS';

export type PipelineStepStatus = "pending" | "running" | "success" | "skipped" | "warning" | "error";

export interface PipelineStep {
  id: string;
  label: string;
  status: PipelineStepStatus;
  message?: string;
  details?: string;
}

export interface Pomelli {
  creativity: number;
  viralIntensity: number;
  visualDetail: number;
  narrativeChaos: number;
  coverRealism: number;
}

export interface IdeaScores {
  immediateClarity: number;
  scrollStopPower: number;
  escalationStrength: number;
  humanMoment: number;
  loopPotential: number;
  shockNovelty: number;
  finalScore: number;
}

export interface NicheIdea {
  id?: string;
  title: string;
  description: string;
  potential?: number;
  reason?: string;
  niche?: string;
  marketGap?: string;
  psychologicalTrigger?: string;
  risk?: string;
  isRecommended?: boolean;
  recommendedReason?: string;
  nicheViability?: 'ALIVE' | 'SATURATED' | 'WEAK' | 'DEAD';
  nicheViabilityReason?: string;
  isHighRiskHighReward?: boolean;
  scores?: IdeaScores;
}

export interface PrimaryPurposeLock {
  lockStatus: "PASS" | "FAIL";
  elementsClassification: {
    element: string;
    role: "CORE_DRIVER" | "SUPPORT" | "DECORATION";
    justification: string;
  }[];
  hookConstraint: {
    allowedElements: string[];
    forbiddenElements: string[];
    suggestedHookFocus: string;
  };
  openingConstraint: string;
  reason: string;
  scrappedElement?: string;
}

export interface FunctionalRoleLock {
  lockStatus: "PASS" | "FAIL";
  primaryEmotion: "curiosity" | "tension" | "experience" | "utility" | "other";
  implicitElement: string;
  emotionSourceRole: "CORE_DRIVER" | "SUPPORT" | "DECORATION";
  passReasoning: string;
  correctiveDirection?: string;
}

export interface ViralStructure {
  hook: string;
  build: string;
  payoff: string;
  loop: string;
  validationStatus: "PASS" | "FAIL";
  validationReason: string;
}

export interface ViralValidation {
  phasesAreDistinct: boolean;
  hasRealEvolution: boolean;
  payoffStrength: "WEAK" | "MEDIUM" | "STRONG" | "UNIDENTIFIED";
  loopQuality: "POOR" | "VALID" | "SEAMLESS";
  finalVerdict: "PASS" | "WEAK_PASS" | "FAIL";
  issues?: string[];
  creativeLevel?: "BASIC" | "INTERMEDIATE" | "ADVANCED" | "ELITE";
  retryInstructions?: {
    fix: string;
    avoid: string;
    target: string;
  };
}

export interface ViralBrain {
  stateChange: {
    detected: boolean;
    description: string;
  };
  payoff: {
    strength: 'WEAK' | 'MEDIUM' | 'STRONG';
    event: string;
  };
  loop: {
    isNatural: boolean;
    quality: 'POOR' | 'VALID' | 'SEAMLESS';
  };
  microActivation: {
    present: boolean;
    type: string;
  };
  hookSource: 'HUMAN' | 'ACTION' | 'SITUATION' | 'ENVIRONMENT';
  phaseCheck: {
    distinct: boolean;
    details: string;
  };
  creativeDepth: 'low' | 'medium' | 'high';
  finalVerdict: 'PASS' | 'WEAK_PASS' | 'FAIL';
  retryInstructions?: {
    fix: string;
    avoid: string;
    target: string;
  };
}

export interface StaticToVideoTranslation {
  subject: string;
  movableElements: string[];
  microScene: string;
  loopType: string;
  complexity: "low";
}

export interface MicroActivationStrategy {
  type: string;
  target: "primarySubject";
  loopable: boolean;
  intensity: "low";
}

export interface IdeaAnchorLock {
  lockStatus: "PASS" | "FAIL";
  centralIdea: string;
  anchorSource: string;
  anchorRole: "CORE_DRIVER" | "SUPPORT" | "DECORATION";
  dependencyTest: "PASS" | "FAIL";
  violationReason?: string;
  isIndependent: boolean;
}

export interface CoreIntentClassification {
  coreIntent: "PERSONA" | "PRODOTTO" | "EVENTO" | "AMBIENTE" | "INFORMATIVO" | "ALTRO";
  confidence: number;
  intentReasoning: string;
  intentPriorityApplied: boolean;
  rejectedIntentCandidates: {
    intent: string;
    reason: string;
  }[];
}

export type StrategicStrategy = 
  | "MICRO_HUMAN_ACTIVATION" 
  | "PRODUCT_REVEAL_PLAUSIBLE_USE" 
  | "PLAUSIBLE_PARTICIPATION_SCENE" 
  | "NATURAL_MINIMAL_ACTIVATION"
  | "EDITORIAL_REVEAL"
  | "REAL_HUMAN_EVENT_LOGIC" 
  | "DEMO_REVEAL_USE" 
  | "ESCALATION_ACTION_PAYOFF" 
  | "OBSERVED_NATURAL_DYNAMICS"
  | "REAL_HUMAN_BEHAVIOR_AND_PERFORMANCE"
  | "REAL_HUMAN_PRESENCE"
  | "LEGACY_DEFAULT";

export interface StrategicManifest {
  strategy: StrategicStrategy;
  sourceType: string;
  coreIntent: string;
  primaryActivation: string;
  forbiddenDynamics: string[];
  mandatoryElements: string[];
  intentDominance: string;
}

export interface FinalViralAnalysis {
  coreIntentClassification?: CoreIntentClassification;
  coreIntentDrift?: boolean;
  contentHierarchy?: ContentHierarchy;
  primaryPurposeLock?: PrimaryPurposeLock;
  functionalRoleLock?: FunctionalRoleLock;
  ideaAnchorLock?: IdeaAnchorLock;
  dominanceCheck?: {
    pass: boolean;
    reason: string;
    dominantElement: string;
    expectedPrimary: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    details?: string;
  };
  viralStructure?: ViralStructure;
  ideaCore?: string;
  retentionDrops?: string;
  analysisHook?: string;
  analysisRetention?: string;
  analysisEscalation?: string;
  analysisPayoff?: string;
  analysisLoop?: string;
  dnaStatus?: string;
  dnaReasoning?: string;
  dopamineMap?: { phase: string; event: string; reason: string }[];
  dopamineHits?: { time: string; description: string }[];
  dopamineValidation?: string;
  checkViral?: {
    hookUnder1_2s: boolean;
    clearProblem: boolean;
    understandableWithoutAudio: boolean;
    humanMoment: boolean;
    naturalLoop: boolean;
  };
  risks?: {
    aiFloatiness: 'LOW' | 'MEDIUM' | 'HIGH';
    uncannyFace: 'LOW' | 'MEDIUM' | 'HIGH';
    banality: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  ideaFinalForm?: {
    originalIdea: string;
    improvedIdea: string;
    finalViralVersion: string;
  };
  // Flattened publishingKit
  pubTitleIt?: string;
  pubTitleEn?: string;
  pubTitoliHookIt?: string[];
  pubTitoliHookEn?: string[];
  pubVideoHookIt?: string;
  pubVideoHookEn?: string;
  pubAudioStrategyIt?: string;
  pubAudioStrategyEn?: string;
  pubDescriptionIt?: string;
  pubDescriptionEn?: string;
  pubHashtagsIt?: string[];
  pubHashtagsEn?: string[];
  pubTagsIt?: string[];
  pubTagsEn?: string[];
  pubPinnedCommentIt?: string;
  pubPinnedCommentEn?: string;
  pubFileName?: string;
  pubRecommendedTime?: string;
  // Flattened musicalAnalysis
  musicMoodIt?: string;
  musicMoodEn?: string;
  musicAnalysisIt?: string;
  musicAnalysisEn?: string;
  // Flattened neuroAnalysis
  neuroScore?: string | number;
  neuroHookRate?: string | number;
  neuroRetention?: string | number;
  neuroViralPotential?: string | number;
  neuroSpiegazioneIt?: string;
  neuroSpiegazioneEn?: string;
  neuroDopamineHits?: { time: string; descIt: string; descEn: string }[];
  // Flattened spreadabilityAnalysis
  spreadabilityScore?: string | number;
  spreadabilityReasoning?: string;
  shareTrigger?: string | number;
  commentPressure?: string | number;
  relatability?: string | number;
  patternBreak?: string | number;
  // Flattened decisionEngine
  engineVerdict?: 'KEEP' | 'MODIFY' | 'REPLACE';
  engineConfidence?: number;
  engineProductionWorthiness?: 'YES' | 'NO' | 'CONDITIONAL';
  engineRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  engineDataStatus?: 'REAL' | 'INFERRED' | 'NO_DATA';
  engineContentType?: string;
  engineCharacterStatus?: 'STRONG' | 'MEDIUM' | 'WEAK';
  engineDominantElement?: 'ACTION' | 'EMOTION' | 'CAMERA' | 'AUDIO';
  engineSacrificedElements?: string[];
  engineEngagementLogic?: string;
  engineConsequence?: string;
  engineFailureCall?: string;
  engineWhatToChange?: string;
  engineHonestyStatement?: string;
  engineNicheClassification?: 'ALIVE' | 'SATURATED' | 'WEAK' | 'DEAD';
  engineNicheReasoning?: string;
  enginePivotSuggestion?: string;
  engineExecutionPlan?: string;
  engineWhyThisWorks?: string[];
  engineWhyThisFails?: string[];
  engineCriticalMoment?: string;
  engineStructuralProblem?: string;
  engineMarketContext?: string;
  engineFormatSaturation?: string;
  engineComparablePerformance?: string;
  engineAlternativeStrength?: string;
  engineExpectedBehavior?: string;
  engineFailureScenario?: string;
  engineImprovementDirection?: string;
  enginePrimaryFocus?: string;
  engineSecondaryFocus?: string;
  engineSuppressedFocus?: string;
  engineReasonForDominanceSelection?: string;
  engineNicheViability?: 'ALIVE' | 'SATURATED' | 'WEAK' | 'DEAD';
  engineNicheViabilityReasoning?: string;
  // Flattened futureValueComparison
  futureStrongerAlternative?: string;
  futureComparison?: string;
  futureHigherPotential?: string;
  futureWhy?: string;
  futureOutcomeChanger?: string;
  futureIntentLockStatus?: string;

  missingDataLog?: { field: string; reason: string }[];

  score?: string | number;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  viralScore?: string | number;
  viralScoreReason?: string;
  retentionProbability?: string;
  predictedViews?: string;
  finalVerdict?: string;
  finalPromptVerdict?: string;
  suggestedAudio?: string;
  technicalVerification?: string;
  refinedPrompt?: string;
  externalMarketAnalysis?: string;
  externalMarketData?: ExternalMarketData;
  altHook?: string;
  altScene?: string;
  altTwist?: string;
  humanVerdict?: string;
  operationalDecision?: string;
  readyAlternative?: string[];
}

export interface AnalysisInput {
  description: string;
  niche: string;
  genre: string;
  platform: string;
  useBypass: boolean;
  algoCuriosity: boolean;
  prompt?: string;
  mode?: string;
  promptB?: string;
  videoFile?: File | null;
  feedbackHistory?: string[];
}

export interface VerifiableIntelligence {
  observedFacts: string[];
  inferences: string[];
  uncertainties: string[];
  dataType: string;
  dataDisclaimer: string;
  queries: string[];
  sources: string[];
  references: {
    platform: 'TikTok' | 'YouTube' | 'Instagram' | 'Other';
    url: string;
    reason: string;
  }[];
  referenceDisclaimer: string;
  realityRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  realityRiskReasoning: string;
  humilityStatement: string;
  visualAnalysisScore: string | number;
  visualAnalysisReason: string;
  audioAnalysisScore: string | number;
  audioAnalysisReason: string;
  trendValidationScore: string | number;
  trendValidationReason: string;
  viralPredictionScore: string | number;
  viralPredictionReason: string;
}

export interface PromptPrioritization {
  isSaturated: boolean;
  originalityAssessment: string;
  standOutPotential: string;
  failureConditions: string;
  scrollTriggers: string;
  contradiction: string;
  viralBet: string;
  isStrongIdea: boolean;
  contentType: string;
  typeReasoning: string;
  signals: string[];
  selectedElement: string;
  selectionReasoning: string;
  rejectedElements: string[];
  rejectionReasoning: string;
  primary: string;
  secondary: string;
  tertiary: string;
  suppressed: string;
  whatIsSacrificed: string;
  whyReduced: string;
  qualityImprovement: string;
}

export interface DecisionEngine {
  dataStatus: 'REAL' | 'INFERRED' | 'NO_DATA';
  contentType: string;
  characterStatus: 'STRONG' | 'MEDIUM' | 'WEAK' | 'UNVERIFIED';
  decision: 'KEEP' | 'MODIFY' | 'REPLACE';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  dominantElement: 'ACTION' | 'EMOTION' | 'CAMERA' | 'AUDIO';
  sacrificedElements: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  viralScore?: string;
  retentionProbability?: string;
  predictedViews?: string;
  productionWorthiness: 'YES' | 'NO' | 'CONDITIONAL';
  finalVerdict?: 'KEEP' | 'MODIFY' | 'REPLACE';
  engagementLogic?: string;
  hookStrength?: string;
  emotionalTriggers?: string;
  originalityVsSaturation?: string;
  consequence?: string;
  failureCall?: string;
  whatToChange?: string;
  whatToRemove?: string;
  whatToAmplify?: string;
  honestyStatement?: string;
  nicheClassification?: 'ALIVE' | 'SATURATED' | 'WEAK' | 'DEAD';
  nicheReasoning?: string;
  pivotSuggestion?: string;
  strongerAlternative?: string;
  comparison?: string;
  higherPotential?: string;
  why?: string;
  outcomeChanger?: string;
  intentLockStatus?: string;
  whyThisWorks?: string[];
  whyThisFails?: string[];
  criticalMoment?: string;
  structuralProblem?: string;
  marketContext?: string;
  formatSaturation?: string;
  comparablePerformance?: string;
  alternativeStrength?: string;
  expectedBehavior?: string;
  failureScenario?: string;
  improvementDirection?: string;
  primaryFocus?: string;
  secondaryFocus?: string;
  suppressedFocus?: string;
  reasonForDominanceSelection?: string;
  nicheViability?: 'ALIVE' | 'SATURATED' | 'WEAK' | 'DEAD';
  nicheViabilityReasoning?: string;
}

export interface ComparablePattern {
  videoLink: string;
  views: number;
  likes: number;
  comments: number;
  engagementRatio: number;
  explanation: string;
  isFakeViral: boolean;
}

export interface RealityValidation {
  mode: 'REAL_DATA_MODE' | 'NO_DATA_MODE';
  noDataMessage?: string;
  comparablePatterns: ComparablePattern[];
  detection?: 'FAKE VIRAL' | 'REAL VIRAL' | 'SATURATED FORMAT';
  detectionReasoning?: string;
}

export interface AnalyzedComment {
  comment: string;
  valueCategory: 'LOW VALUE' | 'MEDIUM VALUE' | 'HIGH VALUE' | 'VERY HIGH VALUE';
  interpretation: string;
}

export interface CommentIntelligence {
  mode: 'REAL_DATA_MODE' | 'NO_DATA_MODE';
  noDataMessage?: string;
  overallQualityLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  explanation?: string;
  analyzedComments: AnalyzedComment[];
}

export interface ExternalSignalExtraction {
  characterArtist: string;
  theme: string;
  contentType: string;
  keywords: string[];
  formatCues: string[];
  searchQueries: string[];
}

export interface ComparableVideo {
  id?: string;
  title: string;
  publishDate: string;
  views: string | number;
  likes: string | number;
  commentCount: string | number;
  channelName: string;
  videoLink: string;
  thumbnail?: string;
}

export interface ExternalMarketData {
  status: 'SUCCESS' | 'REAL' | 'NO_DATA' | 'ERROR' | 'QUERY_FAILURE';
  dataStatus?: 'REAL' | 'INFERRED' | 'NO_DATA';
  comparableVideos: ComparableVideo[];
  marketSummary: string;
  searchQueries?: string[];
  queryCount?: number;
  warning?: string;
  isFallback?: boolean;
  isQuotaFallback?: boolean;
  skipReason?: string;
  skipStage?: string;
  rawResultsCount?: number;
  filteredResultsCount?: number;
}

export interface ModelRoutingStep {
  step: string;
  model: string;
  reason: string;
  status: "primary" | "fallback";
}

export interface ModelRouting {
  steps: ModelRoutingStep[];
  fallbackTriggered: boolean;
  proAvailable: boolean;
  confidence: "high" | "medium" | "low";
  generator?: string;
  validator?: string;
  attempts?: number;
  usedPro?: boolean;
}

export interface VideoAnalysisResult {
  viralScore: string | number;
  ideaCore?: string;
  retentionDrops?: string;
  analysisHook?: string;
  analysisRetention?: string;
  analysisEscalation?: string;
  analysisPayoff?: string;
  analysisLoop?: string;
  viralStructure?: ViralStructure;
  viralValidation?: ViralValidation;
  viralBrain?: ViralBrain;
  modelRouting?: ModelRouting;
  promptDecisionTrace?: any;
  dnaStatus?: string;
  dnaReasoning?: string;
  dopamineMap?: { phase: string; event: string; reason: string }[];
  dopamineHits?: { time: string; description: string }[];
  dopamineValidation?: string;
  // Flattened analysis
  analysisMeaning: string;
  analysisIntent: string;
  analysisStructure: string;
  analysisRhythm: string;
  analysisScenes: { timestamp: string; description: string; emotion: string }[];
  analysisViralTriggers: string[];
  
  optimizedScript: string;
  originalScript?: string;
  
  // Flattened prompts
  promptSora15s: string;
  promptSora12s?: string;
  promptKling: string;
  promptVeo: string;
  promptCover: string;
  
  // Flattened publishingKit
  pubTitleIt: string;
  pubTitleEn: string;
  pubTitoliHookIt: string[];
  pubTitoliHookEn: string[];
  pubVideoHookIt: string;
  pubVideoHookEn: string;
  pubAudioStrategyIt: string;
  pubAudioStrategyEn: string;
  pubDescriptionIt: string;
  pubDescriptionEn: string;
  pubHashtagsIt: string[];
  pubHashtagsEn: string[];
  pubTagsIt: string[];
  pubTagsEn: string[];
  pubPinnedCommentIt: string;
  pubPinnedCommentEn: string;
  pubFileName: string;
  pubRecommendedTime: string;

  // Translation Engine
  translation?: StaticToVideoTranslation;
  microActivationStrategy?: MicroActivationStrategy;

  // Flattened neuroAnalysis
  neuroScore: string | number;
  neuroHookRate: string | number;
  neuroRetention: string | number;
  neuroViralPotential: string | number;
  neuroSpiegazioneIt: string;
  neuroSpiegazioneEn: string;
  neuroDopamineHits: { time: string; descIt: string; descEn: string }[];

  // Flattened spreadabilityAnalysis
  spreadabilityScore: string | number;
  spreadabilityReasoning: string;
  shareTrigger: string | number;
  commentPressure: string | number;
  relatability: string | number;
  patternBreak: string | number;

  conscienceExamIt: string;
  audioAnalysisIt: string;
  researchConsiderationsIt: string;
  trendReport: string;

  // Flattened realityValidation
  realityMode: 'REAL_DATA_MODE' | 'NO_DATA_MODE';
  realityNoDataMessage?: string;
  realityComparablePatterns: ComparablePattern[];
  realityDetection?: 'FAKE VIRAL' | 'REAL VIRAL' | 'SATURATED FORMAT';
  realityDetectionReasoning?: string;

  // Flattened commentIntelligence
  commentMode: 'REAL_DATA_MODE' | 'NO_DATA_MODE';
  commentNoDataMessage?: string;
  commentOverallQualityLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  commentExplanation?: string;
  commentAnalyzedComments: AnalyzedComment[];

  // Flattened decisionEngine
  engineVerdict: 'KEEP' | 'MODIFY' | 'REPLACE';
  engineEngagementLogic: string;
  engineConsequence: string;
  engineFailureCall: string;
  engineWhatToChange: string;
  engineHonestyStatement: string;
  engineNicheClassification: 'ALIVE' | 'SATURATED' | 'WEAK' | 'DEAD';
  engineNicheReasoning: string;
  enginePivotSuggestion: string;
  engineExecutionPlan: string;
  engineWhyThisWorks?: string[];
  engineWhyThisFails?: string[];
  engineCriticalMoment?: string;
  engineStructuralProblem?: string;
  engineMarketContext?: string;
  engineFormatSaturation?: string;
  engineComparablePerformance?: string;
  engineAlternativeStrength?: string;
  engineExpectedBehavior?: string;
  engineFailureScenario?: string;
  engineImprovementDirection?: string;
  enginePrimaryFocus?: string;
  engineSecondaryFocus?: string;
  engineSuppressedFocus?: string;
  engineReasonForDominanceSelection?: string;
  engineNicheViability?: 'ALIVE' | 'SATURATED' | 'WEAK' | 'DEAD';
  engineNicheViabilityReasoning?: string;
  engineDataStatus?: 'REAL' | 'INFERRED' | 'NO_DATA';
  engineContentType?: string;
  engineCharacterStatus?: 'STRONG' | 'MEDIUM' | 'WEAK' | 'UNVERIFIED';
  engineConfidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  engineDominantElement?: 'ACTION' | 'EMOTION' | 'CAMERA' | 'AUDIO';
  engineSacrificedElements?: string[];
  engineRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  engineProductionWorthiness?: 'YES' | 'NO' | 'CONDITIONAL';

  // Flattened executionDebugBlock
  executionDebugBlock?: {
    detectedLanguage: string;
    culturalContext: string;
    contentType: string;
    dominantEntity: string;
    dialogueMappingCheck: 'PASS' | 'FAIL';
    externalDataLanguageMatch: 'PASS' | 'FAIL' | 'N/A';
    externalDataCultureMatch: 'PASS' | 'FAIL' | 'N/A';
    coverPromptGenerated: 'PASS' | 'FAIL';
    outputCompletenessCheck: 'PASS' | 'FAIL';
    scoreConsistencyCheck: 'PASS' | 'FAIL';
  };

  // Flattened futureValueComparison
  futureStrongerAlternative?: string;
  futureComparison?: string;
  futureHigherPotential?: string;
  futureWhy?: string;
  futureOutcomeChanger?: string;
  futureIntentLockStatus?: string;

  missingDataLog?: { field: string; reason: string }[];

  promptPrioritization: PromptPrioritization;
  verifiableIntelligence: VerifiableIntelligence;
  modelUsed?: string;
  promptProcessInfiltrator?: PromptProcessInfiltrator;
  externalMarketData?: ExternalMarketData;
}

export interface ComparisonResult {
  winner: 'A' | 'B';
  scoreA: string | number;
  scoreB: string | number;
  comparison: string;
  refinedWinner?: string;
}

export interface SoraPromptResult {
  prompt: string;
  analysis: any;
  viralStructure?: ViralStructure;
  viralValidation?: ViralValidation;
  visualStructure?: string;
}

export interface PublishingKitData {
  titleIt?: string;
  titleEn?: string;
  videoHookIt?: string;
  videoHookEn?: string;
  hooksIt?: string[];
  hooksEn?: string[];
  descriptionIt?: string;
  descriptionEn?: string;
  hashtagsIt?: string;
  hashtagsEn?: string;
  tagsIt?: string;
  tagsEn?: string;
  pinnedCommentIt?: string;
  pinnedCommentEn?: string;
  fileName?: string;
  recommendedTime?: string;
  audioMoodIt?: string;
  audioMoodEn?: string;
  coverPrompt?: string;
  validationQuestions?: string[];
  antiBoredomScore?: string;
  musicalAnalysisIt?: string;
  musicalAnalysisEn?: string;
  neuroScore?: string | {
    score: string | number;
    hookRate: string | number;
    retention: string | number;
    viralPotential: string | number;
  };
  neuroExplanationIt?: string;
  neuroExplanationEn?: string;
  dopamineHits?: { time: string; descIt: string; descEn: string }[];
  spreadabilityScore?: string | number;
  spreadabilityReasoning?: string;
  shareTrigger?: string | number;
  commentPressure?: string | number;
  relatability?: string | number;
  patternBreak?: string | number;
  finalPromptVerdict?: string;
  altHook?: string;
  altScene?: string;
  altTwist?: string;
  humanVerdict?: string;
  operationalDecision?: string;
  readyAlternative?: string[];
  alternativeTitlesIt?: string[];
  alternativeTitlesEn?: string[];
}

export interface LockedPromptTabEntry {
  prompt: string;
  model?: string;
  duration?: number | string;
}

export interface BestOptimizedPrompt {
  targetField: string;
  model?: string;
  duration?: number | string;
  prompt: string;
  reason?: string;
}

export interface LockedPromptTabs {
  locked: boolean;
  reason?: string;
  optimized: LockedPromptTabEntry;
  kling: LockedPromptTabEntry;
  seedance: LockedPromptTabEntry;
  veo3: LockedPromptTabEntry;
  veo3Extension: LockedPromptTabEntry;
}

export interface ContentHierarchy {
  contentType: string;
  primarySubject: string;
  secondarySubjects: string[];
  tertiaryElements: string[];
  hookCandidates: string[];
  dominantPurpose: string;
  requiredSceneDestination: string;
  forbiddenDominantElements: string[];
  optionalEnhancements: {
    coherentAudio: string;
    atmosphere: string;
    rhythm: string;
  };
}

export interface ModelUsageEntry {
  modelId: string;
  requestedModelId?: string;
  taskContext: string;
  provider?: 'GEMINI' | 'GROQ' | 'YOUTUBE' | 'LOCAL';
  providerTaskType?: string;
  tokensUsed?: number;
  cost?: number;
  actual?: string;
  planned?: string;
  fallback?: boolean;
  fallbackReason?: string;
  modelName?: string;
  keyLabel?: string;
  keySource?: string;
  duration?: number;
  layer?: string;
  attemptedModels?: string[];
  fallbackChain?: string[];
  fallbackDepth?: number;
  status?: string;
  timestamp?: number;
}

export interface ModelUsageTrace {
  entries: ModelUsageEntry[];
  fidelity: 'FULL' | 'DEGRADED';
}

export interface ModelExecutionSummary {
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  fidelity?: 'FULL' | 'PARTIAL' | 'LOW';
  executionMode?: "FLASH_ONLY" | "PRO_ONLY" | "MIXED";
}

export interface RuntimeTruthStatus {
  mode: "FULL_MODE" | "DEGRADED_MODE" | "BLOCKED_MODE" | "DEGRADED_TEXT_ONLY";
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  failedModules: string[];
  warnings?: string[];
  fallbackActive: boolean;
  reliabilityImpact: string;
  userMessage: string;
  timestamp: string;
  details?: string;
}

export interface SceneDNA {
  hookMoment?: string;
  hookVisual?: string;
  hookDialogue?: string;
  setupBeat?: string;
  escalationBeat?: string;
  payoffBeat?: string;
  reactionBeat?: string;
  loopPoint?: string;
  bestKeyLine?: string;
  safeKeyLines?: string[];
  linesToAvoid?: string[];
  visualAnchors?: string[];
  characterDynamics?: string;
  emotionalCurve?: string;
  audienceReaction?: string;
  comedyMechanism?: string;
  pacingMap?: string;
  modelRisks?: string[];
  clipDna?: any;
}

export interface PromptStrategy {
  bestAngle?: string;
  hookPlan?: string;
  payoffPlan?: string;
  dialoguePlan?: string;
  endingPlan?: string;
  lipSyncPlan?: string;
  replayPlan?: string;
  modelNotes?: Record<string, string>;
}

export interface PromptQualityCheck {
  specificityScore?: number;
  hookScore?: number;
  payoffScore?: number;
  modelFitScore?: number;
  lipSyncRisk?: string;
  genericRisk?: string;
  contaminationRisk?: string;
  dialogueRisk?: string;
  finalPass?: boolean;
}

export interface PromptQualityReport {
  [key: string]: PromptQualityCheck | undefined;
}

export interface PublishingKitPro {
  titlesIt?: string[];
  titlesEn?: string[];
  hooksIt?: string[];
  hooksEn?: string[];
  descriptionTikTokIt?: string;
  descriptionTikTokEn?: string;
  descriptionShortsIt?: string;
  descriptionShortsEn?: string;
  hashtagsIt?: string[];
  hashtagsEn?: string[];
  tagsSeoIt?: string[];
  tagsSeoEn?: string[];
  pinnedCommentIt?: string;
  pinnedCommentEn?: string;
  fileName?: string;
  bestPostingTime?: string;
  commentBait?: string;
  shareTrigger?: string;
  controversyLevel?: string;
  audienceTarget?: string;
}

export interface CoverAntiScrollPrompt {
  coverPrompt?: string;
  overlayTextIT?: string;
  overlayTextEN?: string;
  mainFace?: string;
  expression?: string;
  composition?: string;
  colorContrastSuggestion?: string;
  curiosityGap?: string;
  avoidList?: string[];
}

export interface PromptProReport {
  sceneDNAScore?: number;
  promptSpecificityScore?: number;
  modelFitSummary?: string;
  rejectedGenericPrompts?: string[];
  regeneratedPrompts?: string[];
  risks?: string[];
  finalVerdict?: string;
}

export interface GroqCreativeStudioInput {
  sourceKind: "VIDEO" | "IMAGE" | "POSTER" | "TEXT_IDEA" | "SCRIPT" | "LINK_CONTENT";
  platform?: string;
  genre?: string;
  sceneMasterPrompt?: string;
  verifiedTranscript?: string;
  originalScript?: string;
  optimizedScript?: string;
  visualSummary?: string;
  visibleSurfaceElements?: string[];
  semanticMentions?: string[];
  promptInventory?: string[];
  selectedEvent?: string;
  viralStructure?: any;
  externalMarketData?: any;
  userGoal?: string;
  targetModels?: string[];
  detectedSourceLanguage?: string;
}

export interface PromptValidationReport {
  status: 'PASSED' | 'FAILED' | 'RECOVERED' | 'SKIPPED';
  promoted: boolean;
  recoveryTriggered: boolean;
  recoveryReason: string | null;
  failedFields: {
    field: string;
    reason: string;
    matchedTerm?: string;
    preview?: string;
  }[];
  checkedFields: string[];
  excludedFields: string[];
}

export interface GradeSubjectTrace {
  subject: string;
  rawScore: number;
  finalScore: number;
  uiReason: string;
  dataUsed: string[];
}

export interface PromptProcessInfiltrator {
  truthSourceLedger: {
    audioAvailable: boolean;
    transcriptSource: 'GROQ_WHISPER' | 'HF_WHISPER' | 'FALLBACK_LLM' | 'NONE';
    visualFramesCount: number;
    visionProvider: string;
    synchronizedDialogue: boolean;
  };
  composerUsageTrace: {
    baseDossierUsed: boolean;
    audioContextIntegrated: boolean;
    videoContextIntegrated: boolean;
    alignmentConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  };
  promptLineageTrace: {
    field: string;
    origin: 'PHASE_2_LLM' | 'PHASE_1_DIRECT' | 'RECOVERY_FALLBACK';
    primaryDataSource: 'TRANSCRIPT' | 'VISION' | 'HYBRID' | 'INFERRED';
    wasScrubbed: boolean;
  }[];
  validatorInterrogationTrace: {
    checkName: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    technicalDetail: string;
  }[];
  gradeInterrogationTrace: GradeSubjectTrace[];
  promptLineageDeepTrace?: {
    rawLlmPromptFields: Record<string, any>;
    parsedPromptFields: Record<string, any>;
    validatedPromptFields: Record<string, any>;
    promotedPromptFields: Record<string, any>;
    postNormalizationPromptFields: Record<string, any>;
    uiBoundPromptFields: Record<string, any>;
    displayedActivePrompt: Record<string, any>;
    mismatches: {
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      evidence: string;
      suspectedCause: string;
    }[];
    finalInvestigationConclusion: string;
  };
  finalInfiltratorVerdict: 'OK' | 'SUSPICIOUS' | 'VISIBLE_FALLBACK' | 'AUDIO_ONLY' | 'VISION_ONLY' | 'DATA_MISMATCH' | 'CHAIN_NOT_RELIABLE' | 'PROMOTION_SUSPICIOUS';
  infiltratorDiagnosis: string;
  isAnomaly?: boolean;
  whatHappened?: string;
  whyItHappened?: string;
  whatToDoNow?: string[];
  howToPreventNextTime?: string[];
  improvementSuggestions?: string[];
  evidence?: {
    validationStatus: string;
    recoveryTriggered: boolean;
    failedFieldsCount: number;
    finalPass: boolean;
    locked: boolean;
    activePromptLength: number;
    sourceKind: string;
    frameObservationsCount: number;
    missingObservationFrames: number;
    bestOptimizedReason: string;
    lockedReason: string;
  };
  scenario?: 'RECOVERY_OR_REVIEW_REQUIRED' | 'PROMOTED_PROMPT' | 'UNKNOWN';
}

export interface ResultData {
  runtimeTruthStatus?: RuntimeTruthStatus;
  promptProcessInfiltrator?: PromptProcessInfiltrator;
  sceneDNA?: SceneDNA;
  promptStrategy?: PromptStrategy;
  promptQualityReport?: PromptQualityReport;
  promptDecisionTrace?: any;
  publishingKitPro?: PublishingKitPro;
  coverAntiScrollPrompt?: CoverAntiScrollPrompt;
  promptProReport?: PromptProReport;
  analysisRoutingMode?: string;
  visualVerification?: boolean;
  engineReliability?: string;
  detectedSourceLanguage?: string;
  dialogueLanguageLock?: string;
  audioVerified?: boolean;
  audioSource?: string;
  audioProvider?: string;
  audioModelUsed?: string;
  audioKeySource?: string;
  audioSegments?: any[];
  transcriptStatus?: string;
  verifiedTranscript?: string;
  canonicalCastList?: string[];
  castConfidence?: string;
  visualCastCount?: number;
  frameTimestamps?: string[];
  detectedCharacters?: string[];
  frameObservations?: any[];
  groqFullPhase?: string;
  realAudioVoiceClusterAvailable?: boolean;
  audioVoiceUserSummary?: {
    transcriptSpeakerEstimate: number | null;
    experimentalClusterCount: number | null;
    certifiedSpeakerCount: number | null;
    transcriptAvailable?: boolean | null;
    timedSegmentsAvailable?: boolean | null;
    experimentalAudioAnalysisAvailable?: boolean | null;
    realDiarizationAvailable?: boolean;
    reliability?: string | null;
    userConclusion?: string | null;
    userWarning?: string | null;
  };
  dialogueTurns?: any[];
  dialogueSyncAudit?: any;
  castGroundingAudit?: any;
  castAndDialogueAudit?: any;
  sceneMechanismAudit?: any;
  qualityGates?: any;
  optimizedLoopScript?: string;
  loopStrategy?: {
    enabled: boolean;
    movedLine: string;
    reason: string;
    warning?: string;
  };
  vdbMetadata?: any;
  dialogueAnalysis?: string;
  scriptFaithfulness?: number;
  scriptConfidence?: number;
  promptSafetyMode?: string;
  scriptSourceMode?: string;
  sceneMasterPrompt?: string;
  viralStructure?: ViralStructure;
  viralValidation?: ViralValidation;
  modelRouting?: ModelRouting;
  coreIntentClassification?: CoreIntentClassification;
  contentHierarchy?: ContentHierarchy;
  primaryPurposeLock?: PrimaryPurposeLock;
  functionalRoleLock?: FunctionalRoleLock;
  ideaAnchorLock?: IdeaAnchorLock;
  dominanceCheck?: {
    pass: boolean;
    reason: string;
    dominantElement: string;
    expectedPrimary: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    details?: string;
  };
  composerDossier?: any;
  promptValidationReport?: PromptValidationReport;
  promptOptimized15s?: string;
  promptOptimized12s?: string;
  soraPrompt?: string;
  analysis: string;
  sourceType?: string;
  script: string;
  originalScript?: string;
  visibleSurfaceElements?: string[];
  semanticMentions?: string[];
  promptInventory?: string[];
  physicsWhitelist?: string[];
  aiPrompts: string;
  optimizedPrompt12s?: string;
  optimizedPrompt15s?: string;
  soraPrompt12s?: string;
  soraPrompt15s?: string;
  klingPrompt?: string;
  veoPrompt?: string;
  klingPrompt1?: string;
  klingPrompt2?: string;
  klingPrompt10s?: string;
  klingPrompt15s?: string;
  seedancePrompt15s?: string;
  sendancePrompt15s?: string;
  veoPrompt1?: string;
  veoPrompt2?: string;
  veo3Prompt8s?: string;
  veo3ExtensionPart1Prompt8s?: string;
  veo3ExtensionPart2Prompt8s?: string;
  soraPrompt12s1?: string;
  soraPrompt12s2?: string;
  promptSora12s?: string;
  promptSora15s?: string;
  promptKling?: string;
  promptVeo?: string;
  genre?: string;
  finalScriptNormalized?: string;
  transcriptSource?: string;
  text?: string;
  scriptAnalyzer?: any;
  optimizedPrompt?: string;
  publishingKit?: string;
  videoSummary?: string;
  parsedKit?: PublishingKitData;
  lockedPromptTabs?: LockedPromptTabs;
  recommendedPromptTarget?: string;
  bestOptimizedPrompt?: BestOptimizedPrompt;
  modelUsed?: 'pro' | 'flash';
  viralScore?: string;
  finalJudgeDecision?: string;
  transcriptWarning?: string;
  originalScriptLabel?: string;
  viralAudit?: {
    signature: string;
    enforcementMarker: string;
    strategyReasoning: string;
    enforcementPass: boolean;
  };
  validationTrace?: {
    structuralFailTriggered: boolean;
    reason?: string;
    regenerationCount: number;
    finalPassSource: 'first_try' | 'regenerated_after_fail';
  };
  sourceAnchor?: {
    isAligned: boolean;
    reason: string;
    alternativeGenerated: boolean;
  };
  eventQualitySelector?: {
    candidate1: string;
    candidate2: string;
    candidate3: string;
    evaluation: string;
    selectedEvent: string;
  };
  // Legacy fields (deprecated)
  ideaCore?: string;
  retentionDrops?: string;
  analysisHook?: string;
  analysisRetention?: string;
  analysisEscalation?: string;
  analysisPayoff?: string;
  analysisLoop?: string;
  dnaStatus?: string;
  dnaReasoning?: string;
  dopamineMap?: { phase: string; event: string; reason: string }[];
  dopamineHits?: { time: string; description: string }[];
  dopamineValidation?: string;
  validationQuestions?: string[];
  analysisMode?: AnalysisMode;
  trendAnalysis?: string;
  conscienceExamIt?: string;
  conscienceExamEn?: string;
  audioAnalysisIt?: string;
  audioAnalysisEn?: string;
  researchConsiderationsIt?: string;
  researchConsiderationsEn?: string;
  trendHunterReport?: string;
  searchAnalysis?: string;
  referenceVideoAnalysis?: {
    considerations: string;
    links: string[];
  };
  voiceoverScript?: string;
  trends?: { type: string; title: string; description: string; source?: string }[];
  hookComparison?: string;
  refinedWinner?: string;
  winner?: 'A' | 'B';
  scoreA?: string | number;
  scoreB?: string | number;
  bulkHooks?: { category: string; hook: string }[];
  psychologicalAnalysis?: string;
  lumaInstructions?: string;
  promptNotes?: string;
  audioScript?: string;
  technicalVerification?: string;
  externalMarketData?: ExternalMarketData;
  coverPrompt?: string;
  spreadabilityScore?: string | number;
  spreadabilityReasoning?: string;
  shareTrigger?: string | number;
  commentPressure?: string | number;
  relatability?: string | number;
  patternBreak?: string | number;
  finalPromptVerdict?: string;
  altHook?: string;
  altScene?: string;
  altTwist?: string;
  humanVerdict?: string;
  operationalDecision?: string;
  readyAlternative?: string[];
  alternativePrompt?: string;
  executionDebugBlock?: {
    detectedLanguage: string;
    culturalContext: string;
    contentType: string;
    dominantEntity: string;
    dialogueMappingCheck: 'PASS' | 'FAIL';
    externalDataLanguageMatch: 'PASS' | 'FAIL' | 'N/A';
    externalDataCultureMatch: 'PASS' | 'FAIL' | 'N/A';
    coverPromptGenerated: 'PASS' | 'FAIL';
    outputCompletenessCheck: 'PASS' | 'FAIL';
    scoreConsistencyCheck: 'PASS' | 'FAIL';
    languageSeparationCheck: 'PASS' | 'FAIL';
    directivePriorityCheck: 'PASS' | 'FAIL' | 'N/A';
    originalScriptRealityCheck: 'PASS' | 'FAIL';
    sourceContextDepth: 'HIGH' | 'MEDIUM' | 'LOW';
    frameCoverageQuality: 'HIGH' | 'MEDIUM' | 'LOW';
    transcriptConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
    sourceReliabilityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export interface ViralShortsState {
  description: string;
  niche: string;
  genre: string;
  platform: string;
  useBypass: boolean;
  forceTextHook?: boolean;
  forceSubtitles?: boolean;
  algoCuriosity: boolean;
  feedbackHistory: string[];
  result: ResultData | null;
  videoFile?: File | null;
  videoData?: string | null;
  videoMimeType?: string | null;
  videoFileName?: string | null;
  videoDuration?: number;
  videoSize?: number;
  isDeepAnalysis?: boolean;
  isEscalation?: boolean;
  spinOffMode?: boolean;
  viralBoost50k?: boolean;
  musicalType?: string;
  preferredSinger?: string;
  pomelli?: Pomelli;
  pensaciTuGoal?: string;
  currentAnalysisMode?: string;
}
