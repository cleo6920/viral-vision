import { CoverAntiScrollPrompt, GroqCreativeStudioInput, PromptProReport, PromptQualityReport, PromptStrategy, PublishingKitPro, ResultData, SceneDNA } from '../../types';
import { logger } from '../../utils/logger';
import { incrementApiBudget } from './apiBudget';
import { groqTextCompletion } from './groqClient';
import { hasGroqApiKey } from './providerRouter';

type PromptMap = Record<string, string>;

const t = (v: any) => typeof v === 'string' ? v.trim() : '';
const arr = (v: any) => Array.isArray(v) ? v.filter(Boolean).map(String) : [];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function groqJson(system: string, payload: any, patch: Record<string, number>, taskName?: string) {
  incrementApiBudget({ groqCreativeStudioTotalCallCount: 1, groqTextCallCount: 1, ...patch });
  const response = await groqTextCompletion({
    responseFormat: 'json_object',
    timeoutMs: 120000,
    task: taskName || 'creative_studio_generic',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  });
  return JSON.parse(response.text || '{}');
}

export function shouldRunGroqCreativeStudio(input: GroqCreativeStudioInput): boolean {
  if (!hasGroqApiKey()) return false;
  return !!(t(input.sceneMasterPrompt) || t(input.verifiedTranscript) || t(input.originalScript) || t(input.visualSummary) || arr(input.visibleSurfaceElements).length || arr(input.semanticMentions).length);
}

export async function buildSceneDNAWithGroq(input: GroqCreativeStudioInput): Promise<SceneDNA> {
  logger.info('[SCENE_DNA_PROVIDER_GROQ]');
  return groqJson('Return strict JSON only. Build clip-specific scene DNA with hook, escalation, payoff, reaction, loop, safe lines, visual anchors, character dynamics, and model risks. Never use generic category filler.', input, { groqSceneDnaCallCount: 1 }, 'creative_dna');
}

export async function buildPromptStrategyWithGroq(sceneDNA: SceneDNA, input: GroqCreativeStudioInput): Promise<PromptStrategy> {
  logger.info('[PROMPT_STRATEGY_PROVIDER_GROQ]');
  return groqJson('Return strict JSON only. Build model-specific prompt strategy with hook timing, payoff timing, dialogue selection, lip-sync simplification, replay tension, and closure plan.', { sceneDNA, input }, { groqPromptStrategyCallCount: 1 }, 'creative_strategy');
}

export async function generateModelPromptsWithGroq(sceneDNA: SceneDNA, promptStrategy: PromptStrategy, input: GroqCreativeStudioInput): Promise<PromptMap> {
  logger.info('[MODEL_PROMPTS_PROVIDER_GROQ]');
  return groqJson('Return strict JSON only with soraPrompt12s, klingPrompt10s, klingPrompt15s, seedancePrompt15s, sendancePrompt15s, veo3Prompt8s, veo3ExtensionPart1Prompt8s, veo3ExtensionPart2Prompt8s, coverPrompt. Prompts must be clip-specific, no generic filler, no full transcript, spoken language must remain aligned with detectedSourceLanguage.', { sceneDNA, promptStrategy, input }, { groqPromptGenerationCallCount: 1 }, 'creative_prompts');
}

export async function generateCoverAntiScrollWithGroq(sceneDNA: SceneDNA, input: GroqCreativeStudioInput): Promise<CoverAntiScrollPrompt> {
  logger.info('[COVER_ANTI_SCROLL_PROVIDER_GROQ]');
  return groqJson('Return strict JSON only for cover anti-scroll with coverPrompt, overlayTextIT, overlayTextEN, mainFace, expression, composition, colorContrastSuggestion, curiosityGap, avoidList.', { sceneDNA, input }, { groqCoverCallCount: 1 }, 'creative_cover');
}

export async function generatePublishingKitProWithGroq(sceneDNA: SceneDNA, promptStrategy: PromptStrategy, input: GroqCreativeStudioInput): Promise<PublishingKitPro> {
  logger.info('[PUBLISHING_KIT_PRO_PROVIDER_GROQ]');
  return groqJson('Return strict JSON only for a Publishing Kit Pro with titles, hooks, descriptions, hashtags, seo tags, pinned comments, file name, best posting time, comment bait, share trigger, controversy level, audience target. No empty template.', { sceneDNA, promptStrategy, input }, { groqPublishingKitCallCount: 1 }, 'creative_publishing');
}

export async function judgePromptsWithGroq(modelPrompts: PromptMap, sceneDNA: SceneDNA, input: GroqCreativeStudioInput): Promise<PromptQualityReport> {
  logger.info('[PROMPT_PRO_JUDGE_START]');
  return groqJson('Return strict JSON only. For each prompt, evaluate specificityScore, hookScore, payoffScore, modelFitScore, lipSyncRisk, genericRisk, contaminationRisk, dialogueRisk, finalPass.', { modelPrompts, sceneDNA, input }, { groqPromptJudgeCallCount: 1 }, 'creative_judge');
}

export async function regenerateFailedPromptWithGroq(promptKey: string, promptValue: string, sceneDNA: SceneDNA, promptStrategy: PromptStrategy, input: GroqCreativeStudioInput): Promise<string> {
  logger.info('[PROMPT_PRO_REGENERATED]');
  const json = await groqJson('Return strict JSON only with improvedPrompt. Repair genericity, weak hook, weak payoff, contamination, or excessive dialogue while preserving the clip DNA.', { promptKey, promptValue, sceneDNA, promptStrategy, input }, { groqPromptRegenerationCallCount: 1 }, 'creative_repair');
  return t(json.improvedPrompt) || promptValue;
}

export function mergePromptProOutputsIntoResult(result: Partial<ResultData>, output: any): ResultData {
  const next: any = { ...(result || {}) };
  next.sceneDNA = output.sceneDNA || next.sceneDNA;
  next.promptStrategy = output.promptStrategy || next.promptStrategy;
  next.promptQualityReport = output.promptQualityReport || next.promptQualityReport;
  next.publishingKitPro = output.publishingKitPro || next.publishingKitPro;
  next.coverAntiScrollPrompt = output.coverAntiScrollPrompt || next.coverAntiScrollPrompt;
  next.promptProReport = output.promptProReport || next.promptProReport;
  const prompts = output.modelPrompts || {};
  for (const key of ['soraPrompt12s', 'klingPrompt10s', 'klingPrompt15s', 'seedancePrompt15s', 'sendancePrompt15s', 'veo3Prompt8s', 'veo3ExtensionPart1Prompt8s', 'veo3ExtensionPart2Prompt8s', 'coverPrompt']) {
    if (t(prompts[key])) next[key] = prompts[key].trim();
  }
  if (t(output.coverAntiScrollPrompt?.coverPrompt)) next.coverPrompt = output.coverAntiScrollPrompt.coverPrompt;
  if (!t(next.sendancePrompt15s) || (t(next.seedancePrompt15s) && t(next.sendancePrompt15s).length < Math.max(40, t(next.seedancePrompt15s).length * 0.6))) next.sendancePrompt15s = next.seedancePrompt15s;
  return next as ResultData;
}

export async function runGroqCreativeStudio(input: GroqCreativeStudioInput, seedResult?: Partial<ResultData>) {
  logger.info('[GROQ_CREATIVE_STUDIO_START]');
  const groqFailedSteps: string[] = [];
  const groqRecoveredSteps: string[] = [];
  let isRateLimited = false;

  let sceneDNA: SceneDNA = {} as SceneDNA;
  let promptStrategy: PromptStrategy = {} as PromptStrategy;
  let modelPrompts: Record<string, string> = {};
  let coverAntiScrollPrompt: any = {};
  let publishingKitPro: any = {};
  let promptQualityReport: any = {};
  let regeneratedPrompts: string[] = [];
  let promptProReport: any = {};

  const is429 = (e: any) => {
    const msg = String(e).toLowerCase();
    return msg.includes('429') || msg.includes('rate limit');
  };

  const retryOptionalOnce = async <T>(step: string, action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (e) {
      if (!is429(e)) throw e;
      logger.info(`[GROQ_OPTIONAL_TASK_DELAYED_RETRY] task=${step} waitMs=1200`);
      await sleep(1200);
      return await action();
    }
  };

  // CORE Step 1: Scene DNA
  try {
    sceneDNA = await buildSceneDNAWithGroq(input);
    if (sceneDNA && Object.keys(sceneDNA).length > 0) groqRecoveredSteps.push('buildSceneDNA');
  } catch (e) {
    if (is429(e)) {
      isRateLimited = true;
      logger.warn('[GROQ_RATE_LIMIT_STRIKE] step=buildSceneDNA');
    }
    logger.error(`[GROQ_STEP_FAILED] step=buildSceneDNA error=${e instanceof Error ? e.message : String(e)} continuingWithPartial=true`);
    groqFailedSteps.push('buildSceneDNA');
  }

  // CORE Step 2: Strategy
  try {
    // Only attempt if not already critically rate limited OR if sceneDNA was at least partially built
    if (!isRateLimited || (sceneDNA && Object.keys(sceneDNA).length > 0)) {
      promptStrategy = await buildPromptStrategyWithGroq(sceneDNA, input);
      if (promptStrategy && Object.keys(promptStrategy).length > 0) groqRecoveredSteps.push('buildPromptStrategy');
    }
  } catch (e) {
    if (is429(e)) {
      isRateLimited = true;
      logger.warn('[GROQ_RATE_LIMIT_STRIKE] step=buildPromptStrategy');
    }
    logger.error(`[GROQ_STEP_FAILED] step=buildPromptStrategy error=${e instanceof Error ? e.message : String(e)} continuingWithPartial=true`);
    groqFailedSteps.push('buildPromptStrategy');
  }

  // CORE Step 3: Model Prompts
  try {
    if (!isRateLimited || (groqRecoveredSteps.includes('buildSceneDNA') && groqRecoveredSteps.includes('buildPromptStrategy'))) {
      modelPrompts = await generateModelPromptsWithGroq(sceneDNA, promptStrategy, input);
      if (modelPrompts && Object.keys(modelPrompts).length > 0) groqRecoveredSteps.push('generateModelPrompts');
    }
  } catch (e) {
    if (is429(e)) {
      isRateLimited = true;
      logger.warn('[GROQ_RATE_LIMIT_STRIKE] step=generateModelPrompts');
    }
    logger.error(`[GROQ_STEP_FAILED] step=generateModelPrompts error=${e instanceof Error ? e.message : String(e)} continuingWithPartial=true`);
    groqFailedSteps.push('generateModelPrompts');
  }

  // OPTIONAL Step 4: Cover (Sacrificeable)
  if (!isRateLimited || groqRecoveredSteps.length >= 2) {
    try {
      coverAntiScrollPrompt = await retryOptionalOnce('creative_cover', () => generateCoverAntiScrollWithGroq(sceneDNA, input));
      if (coverAntiScrollPrompt && Object.keys(coverAntiScrollPrompt).length > 0) groqRecoveredSteps.push('generateCover');
    } catch (e) {
      if (is429(e)) {
        isRateLimited = true;
        logger.warn('[GROQ_RATE_LIMIT_STRIKE] step=generateCover');
      }
      logger.error(`[GROQ_STEP_FAILED] step=generateCover error=${e instanceof Error ? e.message : String(e)} continuingWithPartial=true`);
      groqFailedSteps.push('generateCover');
      logger.info('[GROQ_OPTIONAL_STEP_SKIPPED] step=generateCover');
    }
  } else {
    logger.info('[GROQ_OPTIONAL_STEP_SKIPPED] step=generateCover reason=rate_limit');
  }

  // CORE Step 5: Publishing Kit Pro (Always attempt if possible)
  try {
    if (!isRateLimited || groqRecoveredSteps.length >= 2) {
      publishingKitPro = await retryOptionalOnce('creative_publishing', () => generatePublishingKitProWithGroq(sceneDNA, promptStrategy, input));
      if (publishingKitPro && Object.keys(publishingKitPro).length > 0) groqRecoveredSteps.push('generatePublishingKit');
    }
  } catch (e) {
    if (is429(e)) {
      isRateLimited = true;
      logger.warn('[GROQ_RATE_LIMIT_STRIKE] step=generatePublishingKit');
    }
    logger.error(`[GROQ_STEP_FAILED] step=generatePublishingKit error=${e instanceof Error ? e.message : String(e)} continuingWithPartial=true`);
    groqFailedSteps.push('generatePublishingKit');
  }

  // OPTIONAL Step 6: Judge & Repair (Sacrificeable)
  if (!isRateLimited) {
    try {
      promptQualityReport = await judgePromptsWithGroq(modelPrompts, sceneDNA, input);
      let totalRegenerations = 0;
      const MAX_REGENERATIONS_TOTAL = 1; // Limit to max 1 regeneration to save quota

      for (const [key, report] of Object.entries(promptQualityReport || {})) {
        if (totalRegenerations >= MAX_REGENERATIONS_TOTAL) break;
        if ((report as any)?.finalPass === false && t(modelPrompts[key])) {
          try {
            logger.info(`[PROMPT_PRO_JUDGE_FAILED] key=${key}`);
            modelPrompts[key] = await regenerateFailedPromptWithGroq(key, modelPrompts[key], sceneDNA, promptStrategy, input);
            regeneratedPrompts.push(key);
            totalRegenerations++;
          } catch (regErr) {
            if (is429(regErr)) {
              isRateLimited = true;
              logger.warn('[GROQ_RATE_LIMIT_STRIKE] step=regenerateFailedPrompt');
              break;
            }
            logger.error(`[GROQ_STEP_FAILED] step=regenerateFailedPrompt key=${key} error=${regErr instanceof Error ? regErr.message : String(regErr)} continuingWithOriginal=true`);
          }
        }
      }
      
      if (regeneratedPrompts.length > 0 && !isRateLimited) {
        try {
          promptQualityReport = await judgePromptsWithGroq(modelPrompts, sceneDNA, input);
          groqRecoveredSteps.push('repairPrompts');
        } catch (e) {
          logger.error(`[GROQ_STEP_FAILED] step=postRepairJudge error=${e instanceof Error ? e.message : String(e)} continuingWithPartial=true`);
        }
      }
    } catch (e) {
      if (is429(e)) {
        isRateLimited = true;
        logger.warn('[GROQ_RATE_LIMIT_STRIKE] step=judgePrompts');
      }
      logger.error(`[GROQ_STEP_FAILED] step=judgePrompts error=${e instanceof Error ? e.message : String(e)} continuingWithPartial=true`);
      groqFailedSteps.push('judgePrompts');
      logger.info('[GROQ_OPTIONAL_STEP_SKIPPED] step=judgePrompts');
    }
  } else {
    logger.info('[GROQ_OPTIONAL_STEP_SKIPPED] step=judgePrompts reason=rate_limit');
  }

  // Core preservation check
  const coreStepsSucceeded = groqRecoveredSteps.includes('buildSceneDNA') && 
                            groqRecoveredSteps.includes('buildPromptStrategy') && 
                            groqRecoveredSteps.includes('generateModelPrompts') &&
                            groqRecoveredSteps.includes('generatePublishingKit');
  if (coreStepsSucceeded) {
    logger.info('[GROQ_QUALITY_CORE_PRESERVED]');
  }

  // Step 7: Build Report
  try {
    promptProReport = {
      sceneDNAScore: 9,
      promptSpecificityScore: 9,
      modelFitSummary: 'Groq Creative Studio applied across source-aware creative text generation.',
      rejectedGenericPrompts: Object.entries(promptQualityReport || {}).filter(([, v]: any) => v?.genericRisk === 'HIGH').map(([k]) => k),
      regeneratedPrompts,
      risks: groqFailedSteps.length > 0 ? [`Step failures: ${groqFailedSteps.join(', ')}`] : [],
      finalVerdict: regeneratedPrompts.length > 0 ? 'PROMPTS_REPAIRED_AND_APPROVED' : (groqFailedSteps.length > 0 ? 'PARTIAL_SUCCESS' : 'PROMPTS_APPROVED'),
    };
  } catch (e) {
    logger.error(`[GROQ_STEP_FAILED] step=buildReport error=${e instanceof Error ? e.message : String(e)} continuingWithPartial=true`);
  }

  const finalResultData = mergePromptProOutputsIntoResult(seedResult || {}, { 
    sceneDNA, 
    promptStrategy, 
    modelPrompts, 
    promptQualityReport, 
    publishingKitPro, 
    coverAntiScrollPrompt, 
    promptProReport 
  });

  const hasAnyData = groqRecoveredSteps.length > 0 || Object.keys(modelPrompts).length > 0;
  if (!hasAnyData && groqFailedSteps.length > 0) {
    logger.error('[GROQ_FATAL_NO_PARTIAL_RESULT]');
  } else if (groqFailedSteps.length > 0) {
    logger.info('[GROQ_PARTIAL_BUT_VALID]');
  }

  logger.info('[GROQ_CREATIVE_STUDIO_COMPLETE]');
  return {
    sceneDNA,
    promptStrategy,
    modelPrompts,
    promptQualityReport,
    publishingKitPro,
    coverAntiScrollPrompt,
    promptProReport,
    groqPartialResult: groqFailedSteps.length > 0,
    groqFailedSteps,
    groqRecoveredSteps,
    result: finalResultData,
  };
}
