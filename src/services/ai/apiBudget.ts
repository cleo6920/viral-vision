import { logger } from '../../utils/logger';

export interface ApiBudgetSnapshot {
  runLabel: string;
  geminiCallCount: number;
  groqCallCount: number;
  youtubeFetchCount: number;
  geminiVisionCallCount: number;
  geminiTextFallbackCallCount: number;
  groqAudioCallCount: number;
  groqTextCallCount: number;
  groqSceneDnaCallCount: number;
  groqPromptStrategyCallCount: number;
  groqPromptGenerationCallCount: number;
  groqPromptJudgeCallCount: number;
  groqPromptRegenerationCallCount: number;
  groqCoverCallCount: number;
  groqPublishingKitCallCount: number;
  groqCreativeStudioTotalCallCount: number;
  defaultKeyUsageCount: number;
  defaultGeminiKeyUsageCount: number;
  defaultGeminiKeyTextTaskUsageCount: number;
  defaultGeminiKeyVisionUsageCount: number;
  stableKeyEmergencyUsageCount: number;
  normalGeminiKeyUsageCount: number;
  normalGeminiKeyVisionUsageCount: number;
  normalGeminiKeyTextFallbackUsageCount: number;
  heavyMultimodalCallCount: number;
  textOnlyCallCount: number;
  startedAt: number;
}

const createBudget = (runLabel = 'UNSCOPED_RUN'): ApiBudgetSnapshot => ({
  runLabel,
  geminiCallCount: 0,
  groqCallCount: 0,
  youtubeFetchCount: 0,
  geminiVisionCallCount: 0,
  geminiTextFallbackCallCount: 0,
  groqAudioCallCount: 0,
  groqTextCallCount: 0,
  groqSceneDnaCallCount: 0,
  groqPromptStrategyCallCount: 0,
  groqPromptGenerationCallCount: 0,
  groqPromptJudgeCallCount: 0,
  groqPromptRegenerationCallCount: 0,
  groqCoverCallCount: 0,
  groqPublishingKitCallCount: 0,
  groqCreativeStudioTotalCallCount: 0,
  defaultKeyUsageCount: 0,
  defaultGeminiKeyUsageCount: 0,
  defaultGeminiKeyTextTaskUsageCount: 0,
  defaultGeminiKeyVisionUsageCount: 0,
  stableKeyEmergencyUsageCount: 0,
  normalGeminiKeyUsageCount: 0,
  normalGeminiKeyVisionUsageCount: 0,
  normalGeminiKeyTextFallbackUsageCount: 0,
  heavyMultimodalCallCount: 0,
  textOnlyCallCount: 0,
  startedAt: Date.now(),
});

let currentBudget: ApiBudgetSnapshot = createBudget();

export function resetApiBudget(runLabel = 'UNSCOPED_RUN') {
  currentBudget = createBudget(runLabel);
  return currentBudget;
}

export function incrementApiBudget(patch: Partial<Omit<ApiBudgetSnapshot, 'runLabel' | 'startedAt'>>) {
  currentBudget = {
    ...currentBudget,
    geminiCallCount: currentBudget.geminiCallCount + (patch.geminiCallCount || 0),
    groqCallCount: currentBudget.groqCallCount + (patch.groqCallCount || 0),
    youtubeFetchCount: currentBudget.youtubeFetchCount + (patch.youtubeFetchCount || 0),
    geminiVisionCallCount: currentBudget.geminiVisionCallCount + (patch.geminiVisionCallCount || 0),
    geminiTextFallbackCallCount: currentBudget.geminiTextFallbackCallCount + (patch.geminiTextFallbackCallCount || 0),
    groqAudioCallCount: currentBudget.groqAudioCallCount + (patch.groqAudioCallCount || 0),
    groqTextCallCount: currentBudget.groqTextCallCount + (patch.groqTextCallCount || 0),
    groqSceneDnaCallCount: currentBudget.groqSceneDnaCallCount + (patch.groqSceneDnaCallCount || 0),
    groqPromptStrategyCallCount: currentBudget.groqPromptStrategyCallCount + (patch.groqPromptStrategyCallCount || 0),
    groqPromptGenerationCallCount: currentBudget.groqPromptGenerationCallCount + (patch.groqPromptGenerationCallCount || 0),
    groqPromptJudgeCallCount: currentBudget.groqPromptJudgeCallCount + (patch.groqPromptJudgeCallCount || 0),
    groqPromptRegenerationCallCount: currentBudget.groqPromptRegenerationCallCount + (patch.groqPromptRegenerationCallCount || 0),
    groqCoverCallCount: currentBudget.groqCoverCallCount + (patch.groqCoverCallCount || 0),
    groqPublishingKitCallCount: currentBudget.groqPublishingKitCallCount + (patch.groqPublishingKitCallCount || 0),
    groqCreativeStudioTotalCallCount: currentBudget.groqCreativeStudioTotalCallCount + (patch.groqCreativeStudioTotalCallCount || 0),
    defaultKeyUsageCount: currentBudget.defaultKeyUsageCount + (patch.defaultKeyUsageCount || 0),
    defaultGeminiKeyUsageCount: currentBudget.defaultGeminiKeyUsageCount + (patch.defaultGeminiKeyUsageCount || 0),
    defaultGeminiKeyTextTaskUsageCount: currentBudget.defaultGeminiKeyTextTaskUsageCount + (patch.defaultGeminiKeyTextTaskUsageCount || 0),
    defaultGeminiKeyVisionUsageCount: currentBudget.defaultGeminiKeyVisionUsageCount + (patch.defaultGeminiKeyVisionUsageCount || 0),
    stableKeyEmergencyUsageCount: currentBudget.stableKeyEmergencyUsageCount + (patch.stableKeyEmergencyUsageCount || 0),
    normalGeminiKeyUsageCount: currentBudget.normalGeminiKeyUsageCount + (patch.normalGeminiKeyUsageCount || 0),
    normalGeminiKeyVisionUsageCount: currentBudget.normalGeminiKeyVisionUsageCount + (patch.normalGeminiKeyVisionUsageCount || 0),
    normalGeminiKeyTextFallbackUsageCount: currentBudget.normalGeminiKeyTextFallbackUsageCount + (patch.normalGeminiKeyTextFallbackUsageCount || 0),
    heavyMultimodalCallCount: currentBudget.heavyMultimodalCallCount + (patch.heavyMultimodalCallCount || 0),
    textOnlyCallCount: currentBudget.textOnlyCallCount + (patch.textOnlyCallCount || 0),
  };
}

export function getApiBudgetSnapshot(): ApiBudgetSnapshot {
  return { ...currentBudget };
}

export function logApiBudgetReport(context = currentBudget.runLabel) {
  const snapshot = getApiBudgetSnapshot();
  logger.info(
    `[API_BUDGET_REPORT] context=${context} geminiCallCount=${snapshot.geminiCallCount} groqCallCount=${snapshot.groqCallCount} youtubeFetchCount=${snapshot.youtubeFetchCount} geminiVisionCallCount=${snapshot.geminiVisionCallCount} geminiTextFallbackCallCount=${snapshot.geminiTextFallbackCallCount} groqAudioCallCount=${snapshot.groqAudioCallCount} groqTextCallCount=${snapshot.groqTextCallCount} groqSceneDnaCallCount=${snapshot.groqSceneDnaCallCount} groqPromptStrategyCallCount=${snapshot.groqPromptStrategyCallCount} groqPromptGenerationCallCount=${snapshot.groqPromptGenerationCallCount} groqPromptJudgeCallCount=${snapshot.groqPromptJudgeCallCount} groqPromptRegenerationCallCount=${snapshot.groqPromptRegenerationCallCount} groqCoverCallCount=${snapshot.groqCoverCallCount} groqPublishingKitCallCount=${snapshot.groqPublishingKitCallCount} groqCreativeStudioTotalCallCount=${snapshot.groqCreativeStudioTotalCallCount} defaultKeyUsageCount=${snapshot.defaultKeyUsageCount} defaultGeminiKeyUsageCount=${snapshot.defaultGeminiKeyUsageCount} defaultGeminiKeyTextTaskUsageCount=${snapshot.defaultGeminiKeyTextTaskUsageCount} defaultGeminiKeyVisionUsageCount=${snapshot.defaultGeminiKeyVisionUsageCount} stableKeyEmergencyUsageCount=${snapshot.stableKeyEmergencyUsageCount} normalGeminiKeyUsageCount=${snapshot.normalGeminiKeyUsageCount} normalGeminiKeyVisionUsageCount=${snapshot.normalGeminiKeyVisionUsageCount} normalGeminiKeyTextFallbackUsageCount=${snapshot.normalGeminiKeyTextFallbackUsageCount} heavyMultimodalCallCount=${snapshot.heavyMultimodalCallCount} textOnlyCallCount=${snapshot.textOnlyCallCount} startedAt=${snapshot.startedAt}`
  );
  return snapshot;
}
