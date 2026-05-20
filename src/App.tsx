import React, { useState, useRef, useEffect, useMemo } from 'react';
// TEST
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    __SIMULATED_CAST_PIPELINE_TEST__?: boolean;
  }
}
import { Upload, FileVideo, X, Sparkles, Loader2, Play, AlignLeft, Copy, Check, Shield, ShieldCheck, BrainCircuit, Brain, Target, MessageSquare, RefreshCcw, Trash2, Download, Eye, Scissors, Film, Activity, Undo, Redo, Wand2, Rocket, Image, Lightbulb, TrendingUp, Zap, ZapOff, ShieldAlert, Search, Mic, Ear, Headphones, Laugh, Trophy, Heart, Palette, Box, User, AlertTriangle, Music, Settings2, Gauge, ChevronDown, Unlock, Lock, AlertCircle, Clock, XCircle, CheckCircle2, FlaskConical, Beaker, Share2, Send, MessageCircle, Users, ArrowRight, ArrowRightCircle } from 'lucide-react';
import { DecisionEngineShell } from '@/src/components/DecisionEngineShell';
import { getFramesToExtract } from './constants';
import { getAI, uploadToGemini, waitForFileActive, generateVideoPrompt, rewriteDangerousPrompt, generateCover, refinePromptWithGoal, refineCoverPromptWithGoal, optimizeForSora2, findDangerousWords, detectDangerousWordsWithAI, getTrendingTopics, generateVoiceover, compareHooks, generateBulkHooks, analyzePsychologicalTriggers, generateGuidedShort, getBypassedWord, sanitizePrompt, purifyPromptAntiEmoji, forceTextInPrompt, extractVideoSummary, resetQuotaStatus, checkContentNatureSemantics, runAudioAnchorSmokeTest, runGeminiUploadSmokeTest, runGroqHybridPipeline } from './services/gemini';
import { runSimulatedCastPipelineTest } from './services/gemini/groqHybrid';
import { anchorVideoAudio, AudioAnchorResult } from './services/gemini/audioAnchor';
import { reconcileCNG } from './services/cngService';
import { CNGResult } from './types/cng';
import { getExternalMarketSignals } from './services/youtubeService';
import { logger } from './utils/logger';
import { logApiBudgetReport, resetApiBudget } from './services/ai/apiBudget';
import { ResultData, ViralShortsState, Pomelli, PublishingKitData, ExternalMarketData, PipelineStep, PipelineStepStatus, AnalysisPipelineMode, RuntimeTruthStatus, ModelUsageTrace } from './types';
import { saveVideo, getVideo, clearVideo } from './utils/storage';
import { safeParseJSON } from './utils/json';
import { normalizeFinalResultContract } from './utils/finalResultContract';
import { VideoTrimmer } from './components/VideoTrimmer';
import { trimVideo, resetFFmpeg, setSkipFFmpeg } from './services/ffmpeg';
import { HighlightedTextarea } from './components/HighlightedTextarea';
import { useUndoRedo } from './hooks/useUndoRedo';
import Markdown from 'react-markdown';
import { ChatAssistant } from './components/ChatAssistant';
import { ProductionFlow } from './components/ProductionFlow';
import { CopyButton } from './components/CopyButton';
import { CopyableField } from './components/CopyableField';
import { ConfirmModal } from './components/ConfirmModal';
import { AudioPlayer } from './components/AudioPlayer';
import { YoutubeMetadataExtractor } from './components/YoutubeMetadataExtractor';
import { LockValidationTests } from './components/LockValidationTests';
import { TechnicalVideoConscience } from './components/conscience/TechnicalVideoConscience';
import { TechnicalAudioConscience } from './components/conscience/TechnicalAudioConscience';
import { ComposerConscience } from './components/conscience/ComposerConscience';

const PromptRefiner = ({ 
  prompt, 
  onRefined,
  context = "",
  colorClass = "emerald"
}: { 
  prompt: string, 
  onRefined: (newPrompt: string) => void,
  context?: string,
  colorClass?: "emerald" | "orange" | "red"
}) => {
  const [goal, setGoal] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefine = async () => {
    if (!goal.trim() || !prompt.trim()) return;
    setIsRefining(true);
    setError(null);
    try {
      const { apiKey } = getAI();
      const refined = await refinePromptWithGoal(prompt, goal, context, apiKey || '');
      onRefined(refined);
      setGoal('');
    } catch (err) {
      console.error(err);
      setError('Errore durante la rielaborazione del prompt.');
    } finally {
      setIsRefining(false);
    }
  };

  const colorStyles = {
    emerald: "focus:ring-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
    orange: "focus:ring-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20",
    red: "focus:ring-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20"
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      {error && (
        <div className="text-red-400 text-xs px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Goal: es. Fallo piÃ¹ divertente, cambia l'attore..."
          className={`w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-3 pr-8 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 ${colorStyles[colorClass].split(' ')[0]}`}
          onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
        />
        {goal && (
          <button
            onClick={() => setGoal('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <button
        onClick={handleRefine}
        disabled={isRefining || !goal.trim()}
        className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${colorStyles[colorClass].split(' ').slice(1).join(' ')}`}
      >
        {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Rielabora
      </button>
      </div>
    </div>
  );
};

const getInitialState = () => {
  const saved = localStorage.getItem('viralShortsState');
  if (saved) {
    try {
      return safeParseJSON(saved);
    } catch (e) {
      console.error('Failed to parse saved state', e);
    }
  }
  return null;
};

const coerceDisplayText = (value: any): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => coerceDisplayText(item))
      .filter(Boolean)
      .join('\n');
  }
  if (value && typeof value === 'object') {
    for (const key of ['text', 'message', 'reason', 'verdict', 'content', 'value']) {
      const candidate = coerceDisplayText(value[key]);
      if (candidate) return candidate;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
};

const hasMeaningfulText = (value: any): boolean => {
  return coerceDisplayText(value).trim().length > 0;
};

const truncateUiText = (value: any, maxLength: number): string => {
  const text = coerceDisplayText(value).trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
};

const sanitizeDirtyUiValue = (value: any): string => {
  const raw = coerceDisplayText(value).trim();
  if (!raw) return 'unknown';
  const looksDirty = new RegExp('unk[^a-z]*|character descriptors portion|provided observation sequence|json structure looks complete|[\\u4E00-\\u9FFF]', 'i').test(raw);
  if (looksDirty) {
    logger.info('[SANITIZED_DIRTY_UI_VALUE]', { from: raw, to: 'unknown' });
    return 'unknown';
  }
  return raw;
};

function sanitizeDirtySpeakerLabel(value: unknown): string {
  if (typeof value !== 'string') {
    logger.info('[SANITIZED_DIRTY_UI_VALUE]', { from: String(value), to: 'unknown' });
    return 'unknown';
  }
  const raw = value.trim();
  if (!raw) return 'unknown';
  const looksDirty =
    raw.length > 120 ||
    raw === '[object Object]' ||
    new RegExp('unk[^a-z]*|character descriptors|provided observation sequence|json structure looks complete|[\\u4E00-\\u9FFF]', 'i').test(raw);
  if (looksDirty) {
    logger.info('[SANITIZED_DIRTY_UI_VALUE]', { from: raw, to: 'unknown' });
    return 'unknown';
  }
  return raw.toLowerCase();
}

const limitUiArray = <T,>(value: T[], maxItems: number): T[] => {
  return Array.isArray(value) ? value.slice(0, maxItems) : [];
};

const approximateObjectSize = (value: any): number => {
  try {
    return JSON.stringify(value).length;
  } catch {
    return -1;
  }
};

const translateConfidenceForUi = (value: string): string => {
  const v = String(value || '').toUpperCase();
  if (v === 'HIGH') return 'alta';
  if (v === 'MEDIUM') return 'media';
  if (v === 'LOW') return 'bassa';
  if (v.includes('MEDIUM_LOW')) return 'medio-bassa';
  if (v === 'NONE') return 'nessuna';
  return v.toLowerCase();
};

const humanizeVisionText = (value: any, mode: 'ui' | 'raw' = 'ui'): string => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (mode === 'raw') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }
    const parts: string[] = [];
    const role = value.roleLabel || value.visualIdentity || value.id || '';
    const pos = value.position || '';
    const action = value.action || '';
    const clothing = value.clothing || value.descriptorSummary || '';
    if (role) parts.push(humanizeVisionText(role, 'ui'));
    if (pos) parts.push(humanizeVisionText(pos, 'ui'));
    if (action) parts.push(humanizeVisionText(action, 'ui'));
    if (clothing && clothing !== action) parts.push(humanizeVisionText(clothing, 'ui'));
    if (parts.length > 0) {
      const res = parts.join(', ');
      return res.charAt(0).toUpperCase() + res.slice(1);
    }
    if (mode === 'ui') {
      return "soggetto non descritto";
    }
  }

  let text = coerceDisplayText(value).trim();
  if (mode === 'ui' && text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      return humanizeVisionText(parsed, 'ui');
    } catch {
      // ignore
    }
  }

  if (!text) return '';

  const mapping: Record<string, string> = {
    'person_1': 'soggetto 1',
    'person_2': 'soggetto 2',
    'person_3': 'soggetto 3',
    'person_4': 'soggetto 4',
    'person_5': 'soggetto 5',
    'person_6': 'soggetto 6',
    'person in uniform': 'persona in uniforme',
    'customer at cafeteria counter': 'cliente al bancone',
    'cafeteria counter': 'bancone/bar/sportello',
    'paper or menu': 'foglio/menu',
    'uniform': 'uniforme',
    'staff member or security': 'membro dello staff o sicurezza',
    'person seated in waiting area': 'persona seduta in sala d’attesa',
    'person standing in waiting area': 'persona in piedi in sala d’attesa',
    'person walking towards waiting area': 'persona che cammina verso la sala d’attesa',
    'man seated in indoor setting': 'uomo seduto in ambiente interno',
    'casual clothing': 'abiti casual',
    'Natural visual descriptor preserved from OpenRouter vision output.': 'descrizione ricavata direttamente dal modulo visione',
    'Multiple subjects visible; no definitive speaker attribution.': 'più soggetti visibili: non posso attribuire con certezza chi parla',
    'nearest real frame contains multiple visible subjects.': 'il fotogramma più vicino contiene più soggetti visibili',
    'woman': 'donna',
    'a woman with hair tied back': 'donna con capelli raccolti',
    'a woman wearing glasses': 'donna con occhiali',
    'a woman resembling the one from frame 0': 'donna simile a quella del fotogramma 0',
    'multiple individuals, including two men in coats': 'più persone visibili, compresi due uomini con cappotto',
    'the same group as frame 2': 'stesso gruppo del fotogramma 2',
    'the group again, with individuals turning their heads': 'stesso gruppo, alcune persone girano la testa',
    'two men in conversation': 'due uomini che parlano',
    'man looking into a mirror': 'uomo che guarda in uno specchio',
    'a man looking into a mirror': 'uomo che guarda in uno specchio',
    'man in uniform': 'uomo in uniforme',
    'uniformed man': 'uomo in uniforme',
    'man wearing a dark uniform and hat': 'uomo con uniforme scura e cappello',
    'a group of individuals in coats, standing in a formal setting': 'gruppo di persone con cappotto in ambiente formale',
    'participants in a discussion or ceremony': 'partecipanti a una discussione o cerimonia',
    'formal attire': 'abiti formali',
    'dark top': 'abito scuro',
    'hair tied back': 'capelli raccolti',
    'wearing glasses': 'con occhiali',
    'mirror': 'specchio',
    'group': 'gruppo',
    'people': 'persone',
    'individuals': 'persone',
    'men': 'uomini',
    'man': 'uomo',
    'frame': 'fotogramma',
    'customer': 'cliente',
    'staff member': 'cameriere / addetto al banco',
    'customers at tables': 'clienti seduti ai tavoli',
    'customer with jacket': 'cliente con giacca',
    'person standing near vending machine': 'persona vicino al distributore/macchina',
    'customers gathering': 'gruppo di clienti',
    'individuals conversing': 'persone che parlano',
    'group of customers': 'gruppo di clienti',
    'individual in a jacket': 'uomo/persona con giacca',
    'same individual in a jacket as frame 7': 'stessa persona con giacca già vista prima',
    'man in light brown jacket standing, head down': 'uomo con giacca marrone chiara, testa abbassata',
    'person crouching low, wearing brown jacket, white shirt, jeans, and a hat': 'persona accovacciata con giacca marrone e cappello',
    'woman behind the counter, wearing a sweater and glasses': 'donna dietro il banco con occhiali',
    'man near the counter wearing a white and blue apron': 'uomo vicino al banco con grembiule bianco e blu',
    'person wearing a patterned shirt at the counter': 'persona con camicia fantasia al bancone',
    'person wearing a jacket with \'jup\' on it': 'persona con giacca con scritta "JUP"',
    'same two people as frame 0': 'stesse due persone viste nel fotogramma 0',
    'person in a dark jacket and white shirt': 'persona con giacca scura e camicia bianca',
    'child beside them': 'bambino accanto a loro',
    'man in a light jacket': 'uomo con giacca chiara',
    'man in a dark jacket': 'uomo con giacca scura',
    'multiple people standing and interacting': 'più persone in piedi che interagiscono',
    'man in a dark jacket over a yellow shirt': 'uomo con giacca scura sopra maglia gialla',
    'same man in a dark jacket over a yellow shirt': 'stesso uomo con giacca scura sopra maglia gialla',
    'person wearing a patterned shirt sitting at a cafe counter': 'persona con camicia fantasia seduta al bancone del bar',
    'person wearing a jacket with \'jup\' text standing in a cafe': 'persona con giacca "JUP" in piedi nel bar',
    'customer in diner': 'cliente nel locale',
    'customer eating at table': 'cliente seduto al tavolo',
    'person behind counter': 'persona dietro al bancone',
    'server': 'cameriere / addetto al banco',
    'man with cane': 'uomo con bastone / stampella',
    'man in hallway': 'uomo nel corridoio',
    'group of people': 'gruppo di persone',
    'people walking': 'persone che camminano',
    'man in a room': 'uomo nella stanza',
    'a person in a yellow shirt': 'persona con maglia gialla',
    'a person in a dark jacket': 'persona con giacca scura',
    'a person in a white shirt': 'persona con camicia bianca',
    'a person holding a red plate and wearing a yellow shirt': 'persona con piatto rosso e maglia gialla',
    'a person in a dark jacket interacting with others': 'persona con giacca scura che interagisce con gli altri',
    'a person in a white shirt near a coca-cola machine': 'persona con camicia bianca vicino alla macchina Coca-Cola',
    'man walking in a hallway': 'uomo che cammina nel corridoio',
    'man with cane wearing beige jacket': 'uomo con bastone e giacca beige',
    'bud spencer': 'Bud Spencer — uomo grande/corpulento',
    'terence hill': 'Terence Hill — uomo biondo/chiaro',
    'male subject pushing another individual': 'uomo che spinge un altro individuo',
    'male subject wearing a red shirt being pushed': 'uomo con maglia rossa che viene spinto',
    'subject wearing an obscuring costume': 'soggetto con costume coprente',
    'subject reacting comically or in distress to interaction with a costumed individual': 'soggetto che reagisce comicamente o con disagio all\'interazione con un individuo in costume',
    'a person wearing an orange shirt and jeans': 'persona con maglia arancione e jeans',
    'a person wearing a blue shirt': 'persona con maglia blu',
    'person on the left': 'persona a sinistra',
    'person on the right': 'persona a destra',
    'on the left': 'a sinistra',
    'on the right': 'a destra',
    'at the center': 'al centro',
    'in the background': 'sullo sfondo',
    'pushing': 'spinge',
    'wearing': 'indossa / con',
    'reacting': 'reagisce',
    'being': 'viene',
    'being pushed': 'viene spinto',
    'pushing another person': 'spinge un’altra persona',
    'obscuring costume': 'costume che copre il volto',
    'reacting comically': 'reagisce in modo comico',
    'in distress': 'in difficoltà / spaventato'
  };

  const lowerText = text.toLowerCase();
  
  if (mapping[lowerText]) {
    return mapping[lowerText];
  }

  // Se è [object Object], ritorna vuoto per non mostrare "object Object"
  if (lowerText.includes('[object object]')) {
    return '';
  }

  const sortedKeys = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    text = text.replace(regex, mapping[key]);
  }

  // Final specific replace for OpenRouter exact sentences not caught if case issue
  text = text.replace(/Natural visual descriptor preserved from OpenRouter vision output./gi, 'descrizione ricavata direttamente dal modulo visione');
  text = text.replace(/Multiple subjects visible; no definitive speaker attribution./gi, 'più soggetti visibili: non posso attribuire con certezza chi parla');
  text = text.replace(/Nearest real frame contains multiple visible subjects./gi, 'il fotogramma più vicino contiene più soggetti visibili');

  // Fallback estremo solo se alla fine non ha niente di sensato
  if (!text || text === 'unknown' || text === 'n/a' || text === 'null' || text === 'undefined' || text.includes('[object Object]') || text.includes('{"')) {
    return 'descrizione non disponibile';
  }

  return text;
};

const safeCompactResultForUI = (input: any) => {
  if (!input || typeof input !== 'object') return null;
  const source = input?.result && typeof input.result === 'object' ? { ...input, ...input.result } : input;
  const promptDecisionTrace = source?.promptDecisionTrace || {};
  const dialogueSyncAudit = source?.dialogueSyncAudit || promptDecisionTrace?.dialogueSyncAudit || {};
  const castGroundingAudit = source?.castGroundingAudit || promptDecisionTrace?.castGroundingAudit || {};
  const faithfulCastAudit = castGroundingAudit?.faithfulCastAudit || {};
  const frameCoverage = {
    frameTimestampsCount: typeof castGroundingAudit?.frameTimestampsCount === 'number' ? castGroundingAudit.frameTimestampsCount : 0,
    frameObservationsCount: typeof castGroundingAudit?.frameObservationsCount === 'number' ? castGroundingAudit.frameObservationsCount : 0,
    missingObservationFrames: typeof castGroundingAudit?.missingObservationFrames === 'number' ? castGroundingAudit.missingObservationFrames : 0,
    missingIndices: Array.isArray(dialogueSyncAudit?.mergedFrameTimeline) 
        ? dialogueSyncAudit.mergedFrameTimeline.filter((f: any) => !f.observed).map((f: any) => ({ index: f.frameIndex, ts: f.timestampReal || f.timestamp }))
        : []
  };
  const frameTimeline = limitUiArray(Array.isArray(dialogueSyncAudit?.mergedFrameTimeline) ? dialogueSyncAudit.mergedFrameTimeline : [], 10).map((frame: any) => ({
    frameIndex: frame?.frameIndex ?? null,
    timestamp: truncateUiText(frame?.timestampReal || frame?.timestamp || '', 40),
    observed: frame?.observed === true,
    subjects: limitUiArray((Array.isArray(frame?.visibleSubjects) ? frame.visibleSubjects : []).map((item: any) => humanizeVisionText(sanitizeDirtyUiValue(item))), 5),
    action: humanizeVisionText(truncateUiText(frame?.visibleAction || '', 200)),
    reasonIfMissing: frame?.observed ? '' : (frame?.warning || 'Nessuna risposta dal provider vision')
  }));
  const speakerAssignments = limitUiArray(Array.isArray(dialogueSyncAudit?.possibleSpeakerAssignments) ? dialogueSyncAudit.possibleSpeakerAssignments : Array.isArray(dialogueSyncAudit?.dialogueFrameAlignment) ? dialogueSyncAudit.dialogueFrameAlignment : [], 10).map((entry: any) => ({
    startTime: entry?.startTime ?? null,
    endTime: entry?.endTime ?? null,
    line: truncateUiText(entry?.line || '', 300),
    probableSpeakerLabel: humanizeVisionText(sanitizeDirtyUiValue(entry?.probableSpeakerLabel || entry?.possibleSpeakerFromFrame || entry?.possibleSpeaker || 'unknown')),
    assignmentConfidence: translateConfidenceForUi(truncateUiText(entry?.assignmentConfidence || entry?.speakerInferenceConfidence || 'LOW', 30)),
    warning: humanizeVisionText(entry?.warning || '')
  }));

  return {
    status: source?.status || '',
    hasNestedResult: !!input?.result,
    audioVoiceUserSummary: source?.audioVoiceUserSummary || null,
    femaleReferenceAudit: {
      femaleReferenceFromTranscript: castGroundingAudit?.femaleReferenceFromTranscript === true,
      visualFemaleConfirmed: castGroundingAudit?.visualFemaleConfirmed === true,
      femaleReferenceWarning: truncateUiText(castGroundingAudit?.femaleReferenceWarning || '', 300)
    },
    frameCoverage,
    faithfulCastAudit: {
      rawVisualPersonsCount: faithfulCastAudit?.rawVisualPersonsCount ?? castGroundingAudit?.visualCastDetectedCount ?? 0,
      realDisplayCastCount: faithfulCastAudit?.realDisplayCastCount ?? castGroundingAudit?.realDisplayCastCount ?? faithfulCastAudit?.finalFaithfulCastCount ?? castGroundingAudit?.visualCastDetectedCount ?? 0,
      genericVisualSubjectsCount: faithfulCastAudit?.genericVisualSubjectsCount ?? castGroundingAudit?.genericVisualSubjectsCount ?? 0,
      genericSubjectWarning: truncateUiText(faithfulCastAudit?.genericSubjectWarning || castGroundingAudit?.genericSubjectWarning || '', 300),
      canonicalRoleGroupsCount: faithfulCastAudit?.canonicalRoleGroupsCount ?? 0,
      finalFaithfulCastCount: faithfulCastAudit?.finalFaithfulCastCount ?? castGroundingAudit?.visualCastDetectedCount ?? 0,
      lostIndividualityWarning: truncateUiText(faithfulCastAudit?.lostIndividualityWarning || '', 300),
      individualCharacters: limitUiArray(Array.isArray(faithfulCastAudit?.individualCharacters) ? faithfulCastAudit.individualCharacters : [], 6).map((item: any) => ({
        id: truncateUiText(item?.id || '', 40),
        label: humanizeVisionText(truncateUiText(sanitizeDirtyUiValue(item?.roleLabel || item?.recognizedVisualIdentity || item?.genericFallbackLabel || 'unknown'), 120)),
        timestamps: limitUiArray(Array.isArray(item?.timestamps) ? item.timestamps : [], 5).map((ts: any) => truncateUiText(ts, 24))
      })),
      groupedByRole: limitUiArray(Array.isArray(faithfulCastAudit?.groupedByRole) ? faithfulCastAudit.groupedByRole : [], 6).map((item: any) => ({
        count: item?.count ?? 0,
        roleLabel: humanizeVisionText(truncateUiText(sanitizeDirtyUiValue(item?.roleLabel || 'unknown'), 120))
      }))
    },
    promptDecisionTrace: {
      heard: promptDecisionTrace?.heard ? {
        transcriptAvailable: promptDecisionTrace.heard?.transcriptAvailable === true,
        audioSource: truncateUiText(promptDecisionTrace.heard?.audioSource || '', 60)
      } : null,
      seen: promptDecisionTrace?.seen ? {
        usedFramesReal: promptDecisionTrace.seen?.usedFramesReal ?? null,
        visionProviderReal: truncateUiText(promptDecisionTrace.seen?.visionProviderReal || '', 60)
      } : null,
      decision: promptDecisionTrace?.decision ? {
        selectedBeat: truncateUiText(promptDecisionTrace.decision?.selectedBeat || '', 120),
        selectedCharacter: truncateUiText(sanitizeDirtyUiValue(promptDecisionTrace.decision?.selectedCharacter || ''), 120),
        selectedLine: truncateUiText(promptDecisionTrace.decision?.selectedLine || '', 300)
      } : null,
      risk: promptDecisionTrace?.risk ? {
        riskLevel: truncateUiText(promptDecisionTrace.risk?.riskLevel || '', 20),
        possibleError: truncateUiText(promptDecisionTrace.risk?.possibleError || '', 300)
      } : null
    },
    dialogueSyncAudit: {
      dialogueTurnsCount: dialogueSyncAudit?.dialogueTurnsCount ?? (Array.isArray(dialogueSyncAudit?.dialogueTurns) ? dialogueSyncAudit.dialogueTurns.length : 0),
      probableAssignmentsCount: dialogueSyncAudit?.probableAssignmentsCount ?? 0,
      unknownAssignmentsCount: Array.isArray(dialogueSyncAudit?.dialogueFrameAlignment)
        ? dialogueSyncAudit.dialogueFrameAlignment.filter((entry: any) => {
            const speaker = sanitizeDirtyUiValue(entry?.possibleSpeakerFromFrame || entry?.probableSpeakerLabel || 'unknown').toLowerCase();
            return speaker === 'unknown' || speaker === 'ambiguous';
          }).length
        : 0,
      speakerAssignmentMode: truncateUiText(dialogueSyncAudit?.speakerAssignmentMode || '', 60),
      possibleSpeakerAssignments: speakerAssignments,
      mergedFrameTimeline: frameTimeline
    },
    mainPrompts: {
      aiPrompts: truncateUiText(source?.aiPrompts || '', 300),
      soraPrompt12s: truncateUiText(source?.soraPrompt12s || '', 300),
      klingPrompt: truncateUiText(source?.klingPrompt || '', 300),
      veoPrompt: truncateUiText(source?.veoPrompt || '', 300)
    }
  };
};

class ResultRenderBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    logger.error('[RESULT_UI_RENDER_ERROR]', {
      errorName: error?.name || 'Error',
      errorMessage: error?.message || String(error),
      componentStack: errorInfo?.componentStack || ''
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100">
          <p className="font-bold uppercase tracking-wider text-red-300 mb-2">Errore visualizzazione risultati</p>
          <p>dati analisi salvati nel JSON/log</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const ensurePublishingKitCompleteness = (result: any, parsedKit: any) => {
  const scoreText = String(result?.viralScore || "").trim();
  const numericScore = parseFloat(scoreText);
  const hasUsefulScore = Number.isFinite(numericScore) && numericScore > 0;
  const hasScript = hasMeaningfulText(result?.script);
  const hasPrompt = hasMeaningfulText(result?.aiPrompts) || hasMeaningfulText(result?.soraPrompt12s) || hasMeaningfulText(result?.klingPrompt) || hasMeaningfulText(result?.veoPrompt);

  if (!parsedKit.operationalDecision) {
    parsedKit.operationalDecision = hasScript || hasPrompt ? "GENERA" : "";
  }

  if (!parsedKit.finalPromptVerdict) {
    parsedKit.finalPromptVerdict = hasScript || hasPrompt
      ? "Output generato con fallback prudente."
      : "";
  }

  if (!parsedKit.humanVerdict) {
    parsedKit.humanVerdict = hasScript
      ? "Analisi disponibile ma pacchetto editoriale ricostruito con fallback."
      : "";
  }

  if (!parsedKit.titleIt && hasScript) parsedKit.titleIt = "";
  if (!parsedKit.titleEn && parsedKit.titleIt) parsedKit.titleEn = "";
  if (!parsedKit.videoHookIt && hasScript) parsedKit.videoHookIt = "";
  if (!parsedKit.videoHookEn && parsedKit.videoHookIt) parsedKit.videoHookEn = "";
  if (!parsedKit.descriptionIt && hasScript) parsedKit.descriptionIt = "";
  if (!parsedKit.descriptionEn && parsedKit.descriptionIt) parsedKit.descriptionEn = "";
  if (!parsedKit.hashtagsIt && hasScript) parsedKit.hashtagsIt = "";
  if (!parsedKit.hashtagsEn && parsedKit.hashtagsIt) parsedKit.hashtagsEn = "";
  if (!parsedKit.tagsIt && hasScript) parsedKit.tagsIt = "";
  if (!parsedKit.tagsEn && parsedKit.tagsIt) parsedKit.tagsEn = "";
  if (!parsedKit.pinnedCommentIt && hasScript) parsedKit.pinnedCommentIt = "";
  if (!parsedKit.pinnedCommentEn && parsedKit.pinnedCommentIt) parsedKit.pinnedCommentEn = "";
  if (!parsedKit.fileName && hasScript) parsedKit.fileName = "";
  if (!parsedKit.recommendedTime && hasUsefulScore) parsedKit.recommendedTime = "21:00";

  if ((!parsedKit.spreadabilityScore || parsedKit.spreadabilityScore === "0") && hasUsefulScore) {
    parsedKit.spreadabilityScore = Math.max(0, Math.min(10, numericScore - 0.2)).toFixed(1);
  }

  if ((!parsedKit.neuroScore || parsedKit.neuroScore.score === "0") && hasUsefulScore) {
    parsedKit.neuroScore = {
      score: scoreText,
      hookRate: "UNVERIFIED",
      retention: "UNVERIFIED",
      viralPotential: "UNVERIFIED"
    };
  }

  return parsedKit;
};

const GuidedShortWizard = ({ onComplete, isLoading }: { onComplete: (answers: any) => void, isLoading: boolean }) => {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({
    genre: '',
    baseIdea: '',
    cast: '',
    promise: '',
    referenceVideo: ''
  });

  const genres = [
    "Comedy", "Sport Chaos & Gaffes", "ASMR", "Musicale", "Sportivo", 
    "Drammatico", "Cartoni Animati", "Tech", "Lifestyle", "Food", "Travel", "Altro"
  ];

  const handleNext = () => {
    if (isLoading) return;
    if (step === 1 && !answers.genre) return;
    if (step === 5 && !answers.promise) return;
    
    if (step < 5) {
      setStep(step + 1);
    } else {
      onComplete(answers);
    }
  };

  const handleBack = () => {
    if (isLoading) return;
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-red-500" />
          AIUTAMI A TROVARE LA SHORT
        </h3>
        <span className="text-xs font-bold text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full uppercase tracking-widest">
          Step {step} di 5
        </span>
      </div>

      <div className="min-h-[200px] flex flex-col justify-center">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <label className="text-lg font-medium text-zinc-100 block">1. Che genere preferisci?</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setAnswers({ ...answers, genre: g })}
                  className={`p-3 rounded-xl text-sm font-medium transition-all border ${
                    answers.genre === g 
                      ? 'bg-red-500/20 border-red-500 text-white shadow-lg shadow-red-500/10' 
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <label className="text-lg font-medium text-zinc-100 block">2. Hai una idea di base? (Facoltativo)</label>
            <textarea
              value={answers.baseIdea}
              onChange={(e) => setAnswers({ ...answers, baseIdea: e.target.value })}
              placeholder="Es: Un gatto che impara a suonare il piano..."
              className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-white"
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <label className="text-lg font-medium text-zinc-100 block">3. Hai dei personaggi o un cast? (Facoltativo)</label>
            <input
              type="text"
              value={answers.cast}
              onChange={(e) => setAnswers({ ...answers, cast: e.target.value })}
          placeholder="Es: Main character, a robot, an alien..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-white"
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <label className="text-lg font-medium text-zinc-100 block">4. Hai un video di riferimento? (Facoltativo)</label>
            <input
              type="text"
              value={answers.referenceVideo}
              onChange={(e) => setAnswers({ ...answers, referenceVideo: e.target.value })}
              placeholder="Incolla qui un link o descrivi un video che ti piace..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-white"
            />
            <p className="text-xs text-zinc-500 italic">L'IA userÃ  questo video come ispirazione per lo stile o l'idea.</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <label className="text-lg font-medium text-zinc-100 block">5. Cosa vuoi ottenere come PROMESSA? (Obbligatorio)</label>
            <input
              type="text"
              value={answers.promise}
              onChange={(e) => setAnswers({ ...answers, promise: e.target.value })}
              placeholder="Es: Una bella risata, una canzone epica, un segreto tech..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-white"
            />
            <p className="text-xs text-zinc-500 italic">L'IA si impegnerÃ  a mantenere questa promessa in ogni shot.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
        <button
          onClick={handleBack}
          disabled={step === 1 || isLoading}
          className="px-6 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white disabled:opacity-0 transition-all"
        >
          Indietro
        </button>
        <button
          onClick={handleNext}
          disabled={(step === 1 && !answers.genre) || (step === 5 && !answers.promise) || isLoading}
          className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generazione...
            </>
          ) : (
            <>
              {step === 5 ? 'Genera Short' : 'Continua'}
              <Zap className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const PENSACI_TU_GENRES = [
  { id: 'Auto-Detect', label: 'âœ¨ Rilevamento Automatico AI', sub: 'Consigliato', icon: Sparkles },
  { id: 'ASMR', label: 'ASMR', sub: 'Oddly Satisfying, Texture, Suoni', icon: Ear },
  { id: 'Sport Chaos & Gaffes', label: 'Sport Chaos & Gaffes', sub: 'Fails, Cringe, Tifosi', icon: AlertTriangle },
  { id: 'Comico', label: 'Comico', sub: 'Stand-up, Sketch, Gag', icon: Laugh },
  { id: 'Musicale', label: 'Musicale', sub: 'Performance, Talent, Videoclip', icon: Music },
  { id: 'Sportivo', label: 'Sportivo', sub: 'Azione, Highlights, Motori', icon: Trophy },
  { id: 'Drammatico', label: 'Drammatico', sub: 'Storytelling, Emozioni, IntensitÃ ', icon: Heart },
  { id: 'Cartoni Animati', label: 'Cartoni Animati', sub: '2D/3D, Animation', icon: Palette },
  { id: 'Generico', label: 'Generico / Altro', sub: 'Varie ed eventuali', icon: Box },
  { id: 'Adrenalina Motorsport', label: 'Adrenalina Motorsport', sub: 'F1, Rally, Supercar', icon: Zap },
];

const SystemGuard = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSecure, setIsSecure] = useState(typeof window !== 'undefined' ? window.isSecureContext : true);
  const [isIsolated, setIsIsolated] = useState(typeof window !== 'undefined' ? !!window.crossOriginIsolated : false);
  const [hasSAB, setHasSAB] = useState(typeof SharedArrayBuffer !== 'undefined');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none items-center">
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="flex items-center gap-3 px-4 py-2 bg-red-600 text-white rounded-full shadow-2xl border border-red-500/50 font-bold text-xs uppercase tracking-wider pointer-events-auto"
          >
            <ShieldAlert className="w-4 h-4 animate-pulse" />
            Connessione Assente
          </motion.div>
        )}
        {!isSecure && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="flex items-center gap-3 px-4 py-2 bg-orange-600 text-white rounded-full shadow-2xl border border-orange-500/50 font-bold text-xs uppercase tracking-wider pointer-events-auto"
          >
            <Lock className="w-4 h-4" />
            Ambiente Non Sicuro (HTTP)
          </motion.div>
        )}
        {(!isIsolated && hasSAB) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="flex items-center gap-3 px-4 py-2 bg-blue-600 text-white rounded-full shadow-2xl border border-blue-500/50 font-bold text-xs uppercase tracking-wider pointer-events-auto"
          >
            <ZapOff className="w-4 h-4" />
            Performance Video Limitate (No Isolation)
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import { ModelExecutionStatus } from './components/ModelExecutionStatus';

// At the beginning of App component (hydration)
import { setSystemKeys } from './services/gemini/core';

const AnalysisProgress = ({ steps }: { steps: PipelineStep[] }) => {
  const getStatusIcon = (status: PipelineStepStatus) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'skipped': return <ArrowRightCircle className="w-4 h-4 text-zinc-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-zinc-800" />;
    }
  };

  const getStatusColor = (status: PipelineStepStatus) => {
    switch (status) {
      case 'success': return 'text-emerald-400';
      case 'running': return 'text-blue-400';
      case 'skipped': return 'text-zinc-500';
      case 'warning': return 'text-orange-400';
      case 'error': return 'text-red-400';
      default: return 'text-zinc-600';
    }
  };

  return (
    <div className="mt-8 w-full max-w-md bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-3 h-3 text-blue-500" />
          Pipeline Execution Logs
        </h4>
        <div className="flex items-center gap-2">
          {localStorage.getItem('low_memory_mode') === 'true' && (
            <div className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-[8px] font-black text-amber-500 animate-pulse uppercase tracking-tighter">
              LOW_MEMORY_SAFE
            </div>
          )}
          <div className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-mono text-zinc-500">
            STRICT_DECISION_ENGINE_V3
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.id} className={`flex items-start gap-3 transition-opacity duration-300 ${step.status === 'pending' ? 'opacity-30' : 'opacity-100'}`}>
            <div className="mt-1">
              {getStatusIcon(step.status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-bold truncate ${getStatusColor(step.status)}`}>
                  {step.label}
                </span>
                {step.status === 'skipped' && (
                  <span className="text-[9px] font-black bg-zinc-900 border border-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">SKIPPED</span>
                )}
                {step.status === 'running' && (
                  <span className="flex gap-1">
                    <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                    <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-75" />
                    <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-150" />
                  </span>
                )}
              </div>
              {step.message && (
                <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-medium">
                  {step.message}
                </p>
              )}
              {step.details && (
                <p className="text-[9px] text-zinc-500 italic truncate mt-0.5 font-mono">
                  {step.details}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalysisTechnicalSummary = ({ result, isCompact = false }: { result: ResultData, isCompact?: boolean }) => {
  if (!result) return null;

  const runtimeMode = result.runtimeTruthStatus?.mode || 'UNKNOWN';
  const runtimeColor = 
    runtimeMode === 'FULL_MODE' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
    runtimeMode === 'DEGRADED_MODE' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
    'text-red-400 border-red-500/30 bg-red-500/10';

  const runtimeIcon = 
    runtimeMode === 'FULL_MODE' ? <ShieldCheck className="w-4 h-4" /> :
    runtimeMode === 'DEGRADED_MODE' ? <AlertTriangle className="w-4 h-4" /> :
    <XCircle className="w-4 h-4" />;

  const runtimeMessage = 
    runtimeMode === 'FULL_MODE' ? 'Analisi completata correttamente' :
    runtimeMode === 'DEGRADED_MODE' ? 'Analisi completata con alcune funzioni opzionali non disponibili' :
    runtimeMode === 'BLOCKED_MODE' ? 'Analisi non completata: manca un output critico' :
    'Stato runtime sconosciuto';

  if (isCompact) {
    return (
      <div className="mt-4 grid grid-cols-2 gap-2 w-full max-w-md">
        {[
          { label: 'Routing', value: result.analysisRoutingMode },
          { label: 'Audio', value: result.audioVerified ? 'VERIFIED' : 'NOT_VERIFIED' },
          { label: 'Audio Provider', value: result.audioProvider },
          { label: 'Safety', value: result.promptSafetyMode },
          { label: 'Runtime', value: runtimeMode }
        ].map((item, i) => (
          item.value && (
            <div key={i} className="px-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg flex items-center justify-between">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter">{item.label}</span>
              <span className="text-[9px] font-mono text-zinc-400 uppercase">{item.value}</span>
            </div>
          )
        ))}
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-4">
      {/* Runtime Status */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${runtimeColor} shadow-lg backdrop-blur-md`}>
        {runtimeIcon}
        <div className="flex-1">
          <div className="text-xs font-black uppercase tracking-wider">{runtimeMode}</div>
          <div className="text-sm font-medium">{runtimeMessage}</div>
        </div>
      </div>

      {/* Technical Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {[
          { label: 'Routing Mode', value: result.analysisRoutingMode },
          { label: 'Audio Verified', value: result.audioVerified !== undefined ? String(result.audioVerified) : undefined },
          { label: 'Audio Source', value: result.audioSource },
          { label: 'Audio Provider', value: result.audioProvider },
          { label: 'Audio Model', value: result.audioModelUsed },
          { label: 'Audio Key', value: result.audioKeySource },
          { label: 'Transcript Status', value: result.transcriptStatus },
          { label: 'Safety Mode', value: result.promptSafetyMode },
          { label: 'Script Mode', value: result.scriptSourceMode },
          { label: 'Truth Status', value: result.runtimeTruthStatus?.mode }
        ].map((item, i) => (
          item.value && (
            <div key={i} className="p-2 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
              <div className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter mb-0.5">{item.label}</div>
              <div className="text-[10px] font-mono text-zinc-300 truncate lowercase">{item.value === 'true' ? 'Ã¢Å“â€¦ yes' : (item.value === 'false' ? 'Ã¢ÂÅ’ no' : item.value)}</div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

import { ApiHealthCheckPanel } from './components/ApiHealthCheckPanel';

function SafeListRenderer({ items, renderItem, emptyMessage }: { items: any[], renderItem: (item: any, index: number) => React.ReactNode, emptyMessage?: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 10;

  useEffect(() => {
    if (items && items.length > limit) {
      console.log("[LONG_VIDEO_SAFE_RENDER_ENABLED]");
      console.log("[UI_RENDER_LIMIT_APPLIED]");
    }
  }, [items]);

  if (!items || items.length === 0) return emptyMessage ? <>{emptyMessage}</> : null;
  const showAll = items.length <= limit || expanded;
  const shownItems = showAll ? items : items.slice(0, limit);

  return (
    <div className="space-y-3">
      {shownItems.map(renderItem)}
      {!showAll && (
        <div className="pt-2">
          <p className="text-zinc-500 text-xs italic mb-2">Mostrati {limit} di {items.length} elementi. Il resto Ã¨ disponibile nel JSON completo.</p>
          <button onClick={() => setExpanded(true)} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs text-white transition-colors">Mostra tutto</button>
        </div>
      )}
      {showAll && items.length > limit && (
        <div className="pt-2">
          <button onClick={() => setExpanded(false)} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs text-white transition-colors">Riduci</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    logger.info("[GLOBAL_BUILD_DEBUG_BANNER_MOUNTED]");
  }, []);
  
  useEffect(() => {
    // Hydrate system keys from server
    const hydrateKeys = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          const keys = Array.isArray(config.keyChain) && config.keyChain.length > 0
            ? config.keyChain
            : [config.geminiKey].filter(Boolean);
          if (keys.length > 0) {
            setSystemKeys(keys);
          }
        }
      } catch (e) {
        console.warn('[App] Failed to hydrate system keys from server', e);
      }
    };
    hydrateKeys();
  }, []);
  const [globalModelTrace, setGlobalModelTrace] = useState<ModelUsageTrace>({ entries: [], fidelity: 'FULL' });
  const initialState = getInitialState();
  
  const [analysisMode, setAnalysisMode] = useState<'generate' | 'estimate' | 'anti-ai-slop' | 'trend-hunter' | 'hook-test' | 'viral-hook-bulk' | 'production-flow' | 'guided-short' | 'pensaci-tu'>('production-flow');
  const [trendNiche, setTrendNiche] = useState('Sport');
  const [pensaciTuGenre, setPensaciTuGenre] = useState('Auto-Detect');
  const [pensaciTuGoal, setPensaciTuGoal] = useState('');
  const [hookA, setHookA] = useState('');
  const [hookB, setHookB] = useState('');
  const [wizardAnswers, setWizardAnswers] = useState({
    genre: '',
    baseIdea: '',
    cast: '',
    promise: '',
    referenceVideo: ''
  });
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
  const [voiceoverAudio, setVoiceoverAudio] = useState<{ data: string, mimeType: string, script: string } | null>(null);
  const [voiceoverError, setVoiceoverError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [modelTier, setModelTier] = useState<'pro' | 'flash' | 'test' | 'smart' | 'groq' | 'hugging'>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;
    return (saved as any) || 'smart';
  });

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('analysis_model_tier', modelTier);
    }
  }, [modelTier]);
  const [estimateInputType, setEstimateInputType] = useState<'video' | 'prompt'>('video');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [savedVideoData, setSavedVideoData] = useState<{base64: string, mimeType: string, fileName: string} | null>(null);
  const [description, setDescription] = useState(initialState?.description || '');
  const [useExternalMarketData, setUseExternalMarketData] = useState(initialState?.useExternalMarketData ?? true);
  const [hasPaidKey, setHasPaidKey] = useState(false);
  const [huggingFaceApiKey, setHuggingFaceApiKey] = useState(() => localStorage.getItem('huggingface_api_key') || (import.meta as any).env?.VITE_HUGGINGFACE_API_KEY || '');

  // Add an effect to save the hf api key whenever it changes
  useEffect(() => {
    localStorage.setItem('huggingface_api_key', huggingFaceApiKey);
  }, [huggingFaceApiKey]);

  const [youtubeApiKey, setYoutubeApiKey] = useState(() => localStorage.getItem('youtube_api_key') || (import.meta as any).env?.VITE_YOUTUBE_API_KEY || '');

  // Add an effect to save the youtube api key whenever it changes
  useEffect(() => {
    localStorage.setItem('youtube_api_key', youtubeApiKey);
  }, [youtubeApiKey]);

  const [hfVisionModel, setHfVisionModel] = useState(() => {
    const stored = localStorage.getItem('hf_vision_model');
    if (stored && (stored.includes('blip') || stored.includes('GLM-4.5V') === false)) {
       // If it's blip or not GLM, and it was the old default, reset it
       if (stored === 'Salesforce/blip-image-captioning-large') return 'zai-org/GLM-4.5V';
    }
    return stored || 'zai-org/GLM-4.5V';
  });
  const [hfAudioModel, setHfAudioModel] = useState(() => localStorage.getItem('hf_audio_model') || 'openai/whisper-large-v3-turbo');
  const [hfTextModel, setHfTextModel] = useState(() => {
    const stored = localStorage.getItem('hf_text_model');
    if (stored && (stored.includes('mistralai/Mistral-7B-Instruct-v0.2') || stored === 'mistralai/Mistral-7B-Instruct-v3')) {
       return 'zai-org/GLM-4.5V';
    }
    return stored || 'zai-org/GLM-4.5V';
  });
  const [groqAudioModel, setGroqAudioModel] = useState(() => localStorage.getItem('groq_audio_model') || 'whisper-large-v3-turbo');
  const [groqFullPhase, setGroqFullPhase] = useState<'core' | 'prompt'>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('groq_full_phase') : null;
    return (saved as any) || 'core';
  });

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('groq_full_phase', groqFullPhase);
    }
  }, [groqFullPhase]);

  useEffect(() => {
    localStorage.setItem('hf_vision_model', hfVisionModel);
    localStorage.setItem('hf_audio_model', hfAudioModel);
    localStorage.setItem('hf_text_model', hfTextModel);
    localStorage.setItem('groq_audio_model', groqAudioModel);
  }, [hfVisionModel, hfAudioModel, hfTextModel, groqAudioModel]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPaidKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success and update state (or it will update on next check)
      setHasPaidKey(true);
    }
  };
  const [isLoading, setIsLoading] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [partialProtocol, setPartialProtocol] = useState<Partial<ResultData>>({});
  
  const updatePipelineStep = (id: string, status: PipelineStepStatus, message?: string, details?: string) => {
    setPipelineSteps(prev => prev.map(step => 
      step.id === id ? { ...step, status, message: message || step.message, details: details || step.details } : step
    ));
  };
  const [loadingStep, setLoadingStep] = useState<number | null>(null);
  const [recentLogs, setRecentLogs] = useState<string[]>([]);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [isLowMemoryMode, setIsLowMemoryMode] = useState(() => localStorage.getItem('low_memory_mode') === 'true');
  const [analysisRunId, setAnalysisRunId] = useState(() => Math.random().toString(36).substring(7));
  const activeRunIdRef = useRef(analysisRunId);
  
  useEffect(() => {
    activeRunIdRef.current = analysisRunId;
  }, [analysisRunId]);
  
  useEffect(() => {
    localStorage.setItem('low_memory_mode', String(isLowMemoryMode));
  }, [isLowMemoryMode]);

  const [audioSmokeResult, setAudioSmokeResult] = useState<any>(null);
  const [geminiUploadSmokeResult, setGeminiUploadSmokeResult] = useState<any>(null);
  const [isGeminiUploadSmokeTesting, setIsGeminiUploadSmokeTesting] = useState(false);
  const [geminiUploadSmokeProgress, setGeminiUploadSmokeProgress] = useState("");
  const [isAudioSmokeTesting, setIsAudioSmokeTesting] = useState(false);
  const [audioSmokeProgress, setAudioSmokeProgress] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRunIdRef = useRef<string | null>(null);
  const [lastProgressUpdate, setLastProgressUpdate] = useState(0);
  const [result, setResult] = useState<ResultData | null>(initialState?.result || null);
  const [previousRunSummary, setPreviousRunSummary] = useState<any>(null);
  const summarizeResultForUiComparison = (value: any) => {
    if (!value) return null;
    const cast = Array.isArray(value?.canonicalCastList) ? value.canonicalCastList.map((item: any) => String(item || "").trim()).filter(Boolean) : [];
    const castAudit = value?.castGroundingAudit || {};
    return {
      castCount: cast.length,
      castLabels: cast,
      castConfidence: String(value?.castConfidence || castAudit?.castConfidence || "N/A"),
      visualCastCount: Number(castAudit?.visualCastCount ?? value?.visualCastCount ?? 0),
      promptUsabilityPercent: typeof value?.promptDecisionTrace?.promptUsabilityPercent === "number" ? value.promptDecisionTrace.promptUsabilityPercent : null,
      publishReadiness: String(value?.promptDecisionTrace?.publishReadiness || ""),
      operationalDecision: String(value?.operationalDecision || "")
    };
  };
  const commitNormalizedResult = (nextResult: Partial<ResultData> | null | undefined, requestId?: string) => {
    logger.info("[COMMIT_NORMALIZED_RESULT_START_AUDIT]", { frameObservations: (nextResult as any)?.frameObservations?.length, cast: (nextResult as any)?.canonicalCastList?.length });
    if (requestId && requestId !== activeRunIdRef.current) {
      logger.warn("[STALE_ANALYSIS_RESULT_IGNORED_AFTER_RESET]", { runId: requestId, activeId: activeRunIdRef.current });
      return null;
    }
    if (!nextResult) {
      setResult(null);
      return null;
    }
    const timedOutRun = !!requestId && timeoutRunIdRef.current === requestId;
    if (timedOutRun) {
      const hasRecoverableAudit = Boolean(
        (nextResult as any)?.promptDecisionTrace
        || (nextResult as any)?.dialogueSyncAudit
        || (
          Array.isArray((nextResult as any)?.audioSegments)
          && Array.isArray((nextResult as any)?.frameObservations)
          && Array.isArray((nextResult as any)?.frameTimestamps)
        )
      );
      logger.warn("[LATE_PIPELINE_RESULT_DETECTED]", {
        runId: requestId,
        hasPromptDecisionTrace: Boolean((nextResult as any)?.promptDecisionTrace),
        hasDialogueSyncAudit: Boolean((nextResult as any)?.dialogueSyncAudit),
        hasRecoverableAudit
      });
      if (!hasRecoverableAudit) {
        logger.warn("[LATE_PIPELINE_RESULT_IGNORED]", {
          runId: requestId,
          reason: "timeout_without_recoverable_audit"
        });
        return null;
      }
      logger.info("[LATE_PIPELINE_RESULT_RECOVERED_WITH_AUDIT]", {
        runId: requestId,
        reason: "timeout_but_audit_payload_available"
      });
    }
    const normalized = normalizeFinalResultContract(nextResult, { genre, platform, analysisMode, useBypass, forceTextHook, forceSubtitles });
    logger.info("[POST_FINAL_CONTRACT_AUDIT]", { frameObs: (normalized as any)?.frameObservations?.length, cast: (normalized as any)?.canonicalCastList?.length, locked: (normalized as any)?.lockedPromptTabs?.locked });
    if (timedOutRun) {
      (normalized as any).lateResultRecovered = true;
    }
    if (result) {
      setPreviousRunSummary(summarizeResultForUiComparison(result));
    }
    logger.info("[COMMIT_NORMALIZED_RESULT_BEFORE_SET_STATE_AUDIT]", { hasNormalizedResult: !!normalized });
    setResult(normalized);
    return normalized;
  };
  const [editableScript, setEditableScript] = useState(initialState?.editableScript || initialState?.result?.script || '');
  const [editablePrompts, setEditablePrompts, undoPrompts, redoPrompts, canUndoPrompts, canRedoPrompts, resetPrompts, pastPrompts, futurePrompts] = useUndoRedo<string>(initialState?.editablePrompts ?? initialState?.result?.aiPrompts ?? '', initialState?.pastPrompts, initialState?.futurePrompts);
  const [editableSceneMaster, setEditableSceneMaster, undoSceneMaster, redoSceneMaster, canUndoSceneMaster, canRedoSceneMaster, resetSceneMaster, pastSceneMaster, futureSceneMaster] = useUndoRedo<string>(initialState?.editableSceneMaster ?? initialState?.result?.sceneMasterPrompt ?? '', initialState?.pastSceneMaster, initialState?.futureSceneMaster);
  const [editableSora12s, setEditableSora12s, undoSora12s, redoSora12s, canUndoSora12s, canRedoSora12s, resetSora12s, pastSora12s, futureSora12s] = useUndoRedo<string>(initialState?.editableSora12s ?? initialState?.result?.lockedPromptTabs?.optimized?.prompt ?? initialState?.result?.promptSora12s ?? initialState?.result?.soraPrompt12s ?? '', initialState?.pastSora12s, initialState?.futureSora12s);
  const [editableKling10s, setEditableKling10s, undoKling10s, redoKling10s, canUndoKling10s, canRedoKling10s, resetKling10s, pastKling10s, futureKling10s] = useUndoRedo<string>(initialState?.editableKling10s ?? initialState?.result?.lockedPromptTabs?.kling?.prompt ?? initialState?.result?.klingPrompt10s ?? '', initialState?.pastKling10s, initialState?.futureKling10s);
  const [editableKling15s, setEditableKling15s, undoKling15s, redoKling15s, canUndoKling15s, canRedoKling15s, resetKling15s, pastKling15s, futureKling15s] = useUndoRedo<string>(initialState?.editableKling15s ?? initialState?.result?.lockedPromptTabs?.kling?.prompt ?? initialState?.result?.klingPrompt15s ?? initialState?.result?.klingPrompt ?? '', initialState?.pastKling15s, initialState?.futureKling15s);
  const [editableSeedance15s, setEditableSeedance15s, undoSeedance15s, redoSeedance15s, canUndoSeedance15s, canRedoSeedance15s, resetSeedance15s, pastSeedance15s, futureSeedance15s] = useUndoRedo<string>(initialState?.editableSeedance15s ?? initialState?.result?.lockedPromptTabs?.seedance?.prompt ?? initialState?.result?.seedancePrompt15s ?? initialState?.result?.sendancePrompt15s ?? '', initialState?.pastSeedance15s, initialState?.futureSeedance15s);
  const [editableVeo3Prompt8s, setEditableVeo3Prompt8s, undoVeo3Prompt8s, redoVeo3Prompt8s, canUndoVeo3Prompt8s, canRedoVeo3Prompt8s, resetVeo3Prompt8s, pastVeo3Prompt8s, futureVeo3Prompt8s] = useUndoRedo<string>(initialState?.editableVeo3Prompt8s ?? initialState?.result?.lockedPromptTabs?.veo3?.prompt ?? initialState?.result?.veo3Prompt8s ?? initialState?.result?.veoPrompt ?? '', initialState?.pastVeo3Prompt8s, initialState?.futureVeo3Prompt8s);
  const [editableVeo3ExtensionPart1, setEditableVeo3ExtensionPart1, undoVeo3ExtensionPart1, redoVeo3ExtensionPart1, canUndoVeo3ExtensionPart1, canRedoVeo3ExtensionPart1, resetVeo3ExtensionPart1, pastVeo3ExtensionPart1, futureVeo3ExtensionPart1] = useUndoRedo<string>(initialState?.editableVeo3ExtensionPart1 ?? initialState?.result?.veo3ExtensionPart1Prompt8s ?? initialState?.result?.lockedPromptTabs?.veo3Extension?.prompt ?? '', initialState?.pastVeo3ExtensionPart1, initialState?.futureVeo3ExtensionPart1);
  const [editableVeo3ExtensionPart2, setEditableVeo3ExtensionPart2, undoVeo3ExtensionPart2, redoVeo3ExtensionPart2, canUndoVeo3ExtensionPart2, canRedoVeo3ExtensionPart2, resetVeo3ExtensionPart2, pastVeo3ExtensionPart2, futureVeo3ExtensionPart2] = useUndoRedo<string>(initialState?.editableVeo3ExtensionPart2 ?? initialState?.result?.veo3ExtensionPart2Prompt8s ?? '', initialState?.pastVeo3ExtensionPart2, initialState?.futureVeo3ExtensionPart2);
  const [editableKling, setEditableKling, undoKling, redoKling, canUndoKling, canRedoKling, resetKling, pastKling, futureKling] = useUndoRedo<string>(initialState?.editableKling ?? initialState?.result?.klingPrompt ?? '', initialState?.pastKling, initialState?.futureKling);
  const [editableVeo, setEditableVeo, undoVeo, redoVeo, canUndoVeo, canRedoVeo, resetVeo, pastVeo, futureVeo] = useUndoRedo<string>(initialState?.editableVeo ?? initialState?.result?.veoPrompt ?? '', initialState?.pastVeo, initialState?.futureVeo);
  
  const [editablePrompts1, setEditablePrompts1, undoPrompts1, redoPrompts1, canUndoPrompts1, canRedoPrompts1, resetPrompts1, pastPrompts1, futurePrompts1] = useUndoRedo<string>(initialState?.editablePrompts1 ?? '', initialState?.pastPrompts1, initialState?.futurePrompts1);
  const [editableSora12s1, setEditableSora12s1, undoSora12s1, redoSora12s1, canUndoSora12s1, canRedoSora12s1, resetSora12s1, pastSora12s1, futureSora12s1] = useUndoRedo<string>(initialState?.editableSora12s1 ?? '', initialState?.pastSora12s1, initialState?.futureSora12s1);
  const [editableKling1, setEditableKling1, undoKling1, redoKling1, canUndoKling1, canRedoKling1, resetKling1, pastKling1, futureKling1] = useUndoRedo<string>(initialState?.editableKling1 ?? initialState?.result?.klingPrompt1 ?? '', initialState?.pastKling1, initialState?.futureKling1);
  const [editableVeo1, setEditableVeo1, undoVeo1, redoVeo1, canUndoVeo1, canRedoVeo1, resetVeo1, pastVeo1, futureVeo1] = useUndoRedo<string>(initialState?.editableVeo1 ?? initialState?.result?.veoPrompt1 ?? '', initialState?.pastVeo1, initialState?.futureVeo1);
  
  const [editablePrompts2, setEditablePrompts2, undoPrompts2, redoPrompts2, canUndoPrompts2, canRedoPrompts2, resetPrompts2, pastPrompts2, futurePrompts2] = useUndoRedo<string>(initialState?.editablePrompts2 ?? '', initialState?.pastPrompts2, initialState?.futurePrompts2);
  const [editableSora12s2, setEditableSora12s2, undoSora12s2, redoSora12s2, canUndoSora12s2, canRedoSora12s2, resetSora12s2, pastSora12s2, futureSora12s2] = useUndoRedo<string>(initialState?.editableSora12s2 ?? '', initialState?.pastSora12s2, initialState?.futureSora12s2);
  const [editableKling2, setEditableKling2, undoKling2, redoKling2, canUndoKling2, canRedoKling2, resetKling2, pastKling2, futureKling2] = useUndoRedo<string>(initialState?.editableKling2 ?? initialState?.result?.klingPrompt2 ?? '', initialState?.pastKling2, initialState?.futureKling2);
  const [editableVeo2, setEditableVeo2, undoVeo2, redoVeo2, canUndoVeo2, canRedoVeo2, resetVeo2, pastVeo2, futureVeo2] = useUndoRedo<string>(initialState?.editableVeo2 ?? initialState?.result?.veoPrompt2 ?? '', initialState?.pastVeo2, initialState?.futureVeo2);
  const [dangerousWords, setDangerousWords] = useState<string[]>(initialState?.dangerousWords || []);
  const [error, setError] = useState<string | null>(null);
  const [isCopiedScript, setIsCopiedScript] = useState(false);
  const [isCopiedPrompts, setIsCopiedPrompts] = useState(false);
  const [isCopiedPrompts1, setIsCopiedPrompts1] = useState(false);
  const [isCopiedPrompts2, setIsCopiedPrompts2] = useState(false);
  const [isCopiedLuma, setIsCopiedLuma] = useState(false);
  const [isCopiedKit, setIsCopiedKit] = useState(false);
  const [isPromptQualityExpanded, setIsPromptQualityExpanded] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isCacheModalOpen, setIsCacheModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isAnalyzingRef = useRef(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loadingText, setLoadingText] = useState("[1/6] Inizializzazione analisi...");

  const bindPromptTabsFromPhase2Result = (normalizedResult: any) => {
    logger.info("[PROMPT_TABS_BIND_INPUT_AUDIT]", { aiPromptsLen: normalizedResult?.aiPrompts?.length, bestLen: normalizedResult?.bestOptimizedPrompt?.prompt?.length });
    logger.info("[PROMPT_TABS_BOUND_FROM_PHASE2_RESULT]", {
      hasBest: !!normalizedResult?.bestOptimizedPrompt?.prompt,
      hasSora: !!(normalizedResult?.soraPrompt15s || normalizedResult?.promptSora15s),
      hasSceneMaster: !!normalizedResult?.sceneMasterPrompt
    });

    const bestPromptVal = normalizedResult?.bestOptimizedPrompt?.prompt || normalizedResult?.optimizedPrompt15s || normalizedResult?.optimizedPrompt12s || normalizedResult?.promptOptimized15s || normalizedResult?.promptOptimized12s || normalizedResult?.aiPrompts || "";
    resetPrompts(bestPromptVal);

    const sceneMasterVal = normalizedResult?.sceneMasterPrompt || "";
    resetSceneMaster(sceneMasterVal);

    const soraPromptVal = normalizedResult?.soraPrompt15s || normalizedResult?.promptSora15s || normalizedResult?.soraPrompt12s || normalizedResult?.promptSora12s || '';
    resetSora12s(soraPromptVal);
    resetKling10s(normalizedResult?.lockedPromptTabs?.kling?.prompt || normalizedResult?.klingPrompt10s || normalizedResult?.klingPrompt || '');
    resetKling15s(normalizedResult?.lockedPromptTabs?.kling?.prompt || normalizedResult?.klingPrompt15s || normalizedResult?.klingPrompt || '');
    resetSeedance15s(normalizedResult?.lockedPromptTabs?.seedance?.prompt || normalizedResult?.seedancePrompt15s || normalizedResult?.sendancePrompt15s || '');
    resetKling(normalizedResult?.klingPrompt || '');
    resetVeo3Prompt8s(normalizedResult?.lockedPromptTabs?.veo3?.prompt || normalizedResult?.veo3Prompt8s || normalizedResult?.veoPrompt || '');
    resetVeo3ExtensionPart1(normalizedResult?.veo3ExtensionPart1Prompt8s || normalizedResult?.lockedPromptTabs?.veo3Extension?.prompt || '');
    resetVeo3ExtensionPart2(normalizedResult?.veo3ExtensionPart2Prompt8s || '');
    resetVeo(normalizedResult?.veoPrompt || '');
  };

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason);
      if (msg.includes('WebSocket') || msg.includes('vite') || msg.includes('HMR')) {
        // Silently ignore WebSocket/Vite HMR errors which are common in iframe/dev environments
        return;
      }
      console.error("Unhandled Rejection:", event.reason, event.promise);
      
      // If we are currently analyzing, unlock the UI
      if (isAnalyzingRef.current) {
        setError(`Errore asincrono: ${msg}. Il processo Ã¨ stato sbloccato.`);
        stopLoading();
        isAnalyzingRef.current = false;
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);

    const handleUploadProgress = (event: any) => {
      const progress = event.detail.progress;
      setUploadProgress(progress);
      const log = `Caricamento video su Google: ${progress}%`;
      setLoadingText(log);
      setRecentLogs(prev => [log, ...prev].slice(0, 3));
    };
    window.addEventListener('gemini-upload-progress', handleUploadProgress);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('gemini-upload-progress', handleUploadProgress);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    
    let loadingTexts = [
      "Analisi dell'algoritmo di ritenzione...",
      "Creazione hook e loop invisibile...",
      "Ottimizzazione per il feed di TikTok...",
      "Simulazione del comportamento dell'utente...",
      "Generazione script virale...",
      "Applicazione protocollo anti-ai slop...",
      "Calcolo del Viral Score...",
      "Quasi pronto, sto rifinendo i dettagli..."
    ];

    if (analysisMode === 'guided-short') {
      loadingTexts = [
        "Analisi della nicchia strategica...",
        "Ottimizzazione della promessa richiesta...",
        "Sincronizzazione della fisica per Sora...",
        "Mappatura dei trigger psicologici...",
        "Generazione dell'architettura di viralitÃ ...",
        "Verifica coerenza narrativa...",
        "Finalizzazione del prompt guidato...",
        "Quasi pronto, sto blindando la promessa..."
      ];
    }
    
    const isApiProgress = loadingText.includes('Chiamata') || 
                         loadingText.includes('Segmento') || 
                         loadingText.includes('Analisi frame') ||
                         loadingText.includes('Limite') ||
                         loadingText.includes('Google') ||
                         loadingText.includes('File pronto') ||
                         loadingText.includes('Sincronizzazione') ||
                         loadingText.includes('Re-upload') ||
                         loadingText.includes('Connessione') ||
                         loadingText.includes('Elaborazione') ||
                         loadingText.includes('Estrazione') ||
                         loadingText.includes('Generazione') ||
                         loadingText.includes('Sanitizzazione') ||
                         loadingText.includes('Controllo') ||
                         loadingText.includes('Locale');
    
    if (loadingText === "" || !isApiProgress) {
      setLoadingText(loadingTexts[0]);
    }
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      // Use functional update to get the latest loadingText
      setLoadingText(current => {
        if (typeof current !== 'string') return loadingTexts[0] || '';
        const isApiProgress = current.includes('Chiamata') || 
                             current.includes('Segmento') || 
                             current.includes('Analisi frame') ||
                             current.includes('Limite') ||
                             current.includes('Google') ||
                             current.includes('File pronto') ||
                             current.includes('Sincronizzazione') ||
                             current.includes('Re-upload') ||
                             current.includes('Connessione') ||
                             current.includes('Elaborazione') ||
                             current.includes('Estrazione');
        
        // Only cycle if no progress update in the last 30 seconds
        // AND the current text doesn't look like a specific API call progress
        if (Date.now() - lastProgressUpdate > 30000 && !isApiProgress) {
          currentIndex = (currentIndex + 1) % loadingTexts.length;
          return loadingTexts[currentIndex];
        }
        return current;
      });
    }, 6000);
    
    return () => clearInterval(interval);
  }, [isLoading, analysisMode, lastProgressUpdate]);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverAspectRatio, setCoverAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [coverReferenceImage, setCoverReferenceImage] = useState<string | null>(null);
  const [coverHookText, setCoverHookText] = useState<string>("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [isRewriting1, setIsRewriting1] = useState(false);
  const [isRewriting2, setIsRewriting2] = useState(false);
  const [isPurifyingAntiEmoji, setIsPurifyingAntiEmoji] = useState(false);
  const [isPurifyingAntiEmoji1, setIsPurifyingAntiEmoji1] = useState(false);
  const [isPurifyingAntiEmoji2, setIsPurifyingAntiEmoji2] = useState(false);
  const [isForcingText, setIsForcingText] = useState(false);
  const [isForcingText1, setIsForcingText1] = useState(false);
  const [isForcingText2, setIsForcingText2] = useState(false);
  const [isOptimizingSora2, setIsOptimizingSora2] = useState(false);
  const [isOptimizingSora2_1, setIsOptimizingSora2_1] = useState(false);
  const [isOptimizingSora2_2, setIsOptimizingSora2_2] = useState(false);
  const [isDetectingDangerousWords, setIsDetectingDangerousWords] = useState(false);
  const [isDetectingDangerousWords_1, setIsDetectingDangerousWords_1] = useState(false);
  const [isDetectingDangerousWords_2, setIsDetectingDangerousWords_2] = useState(false);
  const [bypassingWord, setBypassingWord] = useState<{ word: string, target: 'prompts' | 'prompts1' | 'prompts2' } | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [sessionUploadedFileUri, setSessionUploadedFileUri] = useState<string | undefined>(undefined);
  const [isVirtualTrimmed, setIsVirtualTrimmed] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [rewriteLevel, setRewriteLevel] = useState(1);
  const [rewriteLevel1, setRewriteLevel1] = useState(1);
  const [rewriteLevel2, setRewriteLevel2] = useState(1);
  const [activePromptTab, setActivePromptTab] = useState<'sora' | 'kling' | 'veo'>(initialState?.activePromptTab || 'sora');
  const [soraDuration, setSoraDuration] = useState<'15s' | '12s'>(initialState?.soraDuration || '15s');
  const [activePromptFamily, setActivePromptFamily] = useState<'sora2' | 'sora' | 'sceneMaster' | 'kling' | 'seedance' | 'veo3' | 'veo3Extension'>(initialState?.activePromptFamily || 'sora2');
  const [activePromptVariant, setActivePromptVariant] = useState<'default' | '12s' | '10s' | '15s' | '8s' | 'part1' | 'part2'>(initialState?.activePromptVariant || '12s');

  useEffect(() => {
    if (activePromptFamily !== 'veo3Extension') return;
    const hasVeoExt1 = editableVeo3ExtensionPart1.trim().length > 0;
    const hasVeoExt2 = editableVeo3ExtensionPart2.trim().length > 0;
    const activePromptLength = (activePromptVariant === 'part2' ? editableVeo3ExtensionPart2 : editableVeo3ExtensionPart1).trim().length;
    console.info('[UI_PROMPT_SELECTION_AUDIT]', {
      activePromptFamily,
      activePromptVariant,
      hasVeoExt1,
      hasVeoExt2,
      activePromptLength,
    });
    if (activePromptVariant === 'part1' && !hasVeoExt1 && hasVeoExt2) {
      setActivePromptVariant('part2');
    }
  }, [activePromptFamily, activePromptVariant, editableVeo3ExtensionPart1, editableVeo3ExtensionPart2]);

  // Keep-alive ping to prevent session timeout during long analyses
  useEffect(() => {
    if (!isLoading && !isAnalyzingRef.current && !isGeneratingVoiceover && !isRewriting && !isRewriting1 && !isRewriting2 && !isOptimizingSora2 && !isOptimizingSora2_1 && !isOptimizingSora2_2) return;
    
    const pingInterval = setInterval(() => {
      // Subtle keep-alive activity
      try {
        window.dispatchEvent(new CustomEvent('aistudio-keepalive'));
      } catch (e) {}
    }, 25000);
    
    return () => clearInterval(pingInterval);
  }, [isLoading, isGeneratingVoiceover, isRewriting, isRewriting1, isRewriting2, isOptimizingSora2, isOptimizingSora2_1, isOptimizingSora2_2]);
  const [activePromptTab1, setActivePromptTab1] = useState<'sora' | 'kling' | 'veo'>(initialState?.activePromptTab1 || 'sora');
  const [soraDuration1, setSoraDuration1] = useState<'15s' | '12s'>(initialState?.soraDuration1 || '15s');
  const [activePromptTab2, setActivePromptTab2] = useState<'sora' | 'kling' | 'veo'>(initialState?.activePromptTab2 || 'sora');
  const [soraDuration2, setSoraDuration2] = useState<'15s' | '12s'>(initialState?.soraDuration2 || '15s');
  const [showValidator, setShowValidator] = useState(false);
  const [externalDataInfluence, setExternalDataInfluence] = useState<'OFF' | 'AUTO' | 'HARD'>('AUTO');
  const [flashPrompt, setFlashPrompt] = useState(false);
  const [flashPrompt1, setFlashPrompt1] = useState(false);
  const [flashPrompt2, setFlashPrompt2] = useState(false);

  const [promptAnalysis, setPromptAnalysis] = useState<{ type: 'estimate' | 'anti-ai-slop', result: string } | null>(null);
  const [isAnalyzingPrompt, setIsAnalyzingPrompt] = useState(false);
  const [prompt1Analysis, setPrompt1Analysis] = useState<{ type: 'estimate' | 'anti-ai-slop', result: string } | null>(null);
  const [isAnalyzingPrompt1, setIsAnalyzingPrompt1] = useState(false);
  const [prompt2Analysis, setPrompt2Analysis] = useState<{ type: 'estimate' | 'anti-ai-slop', result: string } | null>(null);
  const [isAnalyzingPrompt2, setIsAnalyzingPrompt2] = useState(false);

  const triggerFlash = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  const [kitLanguage, setKitLanguage] = useState<'it' | 'en'>('it');
  const [pipelineMode, setPipelineMode] = useState<AnalysisPipelineMode>(initialState?.pipelineMode || 'STANDARD');
  const [useBypass, setUseBypass] = useState(initialState?.useBypass || false);
  const [forceTextHook, setForceTextHook] = useState(initialState?.forceTextHook || false);
  const [forceSubtitles, setForceSubtitles] = useState(initialState?.forceSubtitles || false);
  const [algoCuriosity, setAlgoCuriosity] = useState(initialState?.algoCuriosity || false);
  const [isDeepAnalysis, setIsDeepAnalysis] = useState(initialState?.isDeepAnalysis || false);
  const [isEscalation, setIsEscalation] = useState(initialState?.isEscalation || false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [spinOffMode, setSpinOffMode] = useState(initialState?.spinOffMode || false);
  const [viralBoost50k, setViralBoost50k] = useState(initialState?.viralBoost50k || false);
  const [niche, setNiche] = useState(initialState?.niche || '');
  const [genre, setGenre] = useState(initialState?.genre || 'Auto-Detect');
  const [musicalType, setMusicalType] = useState<'canzone' | 'talent_show'>(initialState?.musicalType || 'canzone');
  const [preferredSinger, setPreferredSinger] = useState(initialState?.preferredSinger || '');
  const [platform, setPlatform] = useState(initialState?.platform || 'TikTok');
  const [feedback, setFeedback] = useState('');
  const [feedbackHistory, setFeedbackHistory] = useState<string[]>(initialState?.feedbackHistory || []);
  const [videoRange, setVideoRange] = useState<{start: number, end: number} | null>(initialState?.videoRange || null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const hasDangerousWords = (text: string, words: string[]) => {
    if (!words || words.length === 0 || !text) return false;
    const escapedWords = words
      .map(w => w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(w => w.length > 1);
    if (escapedWords.length === 0) return false;
    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');
    return regex.test(text);
  };

  const getDangerousWordsInText = (text: string, words: string[]) => {
    if (!words || words.length === 0 || !text) return [];
    return words.filter(w => {
      const escaped = w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (escaped.length <= 1) return false;
      const regex = new RegExp(`(${escaped})`, 'gi');
      return regex.test(text);
    });
  };

  const lastFileRef = useRef<File | null>(null);

  // Memoize video source to prevent re-renders from breaking playback
  useEffect(() => {
    if (file) {
      // Only create a new URL if the file object has actually changed
      if (file !== lastFileRef.current) {
        setVideoSrc(prev => {
          if (prev && prev.startsWith('blob:')) {
            // Increased delay to 3s to ensure the video element has switched to the new URL
            const oldUrl = prev;
            setTimeout(() => URL.revokeObjectURL(oldUrl), 3000);
          }
          return URL.createObjectURL(file);
        });
        lastFileRef.current = file;
      }
    } else if (savedVideoData) {
      // Convert base64 back to Blob/File to use Object URL (much faster than Data URL for videos)
      if (!lastFileRef.current) {
        const loadSavedVideo = async () => {
          try {
            const response = await fetch(`data:${savedVideoData.mimeType};base64,${savedVideoData.base64}`);
            const blob = await response.blob();
            
            setVideoSrc(prev => {
              if (prev && prev.startsWith('blob:')) {
                const oldUrl = prev;
                setTimeout(() => URL.revokeObjectURL(oldUrl), 3000);
              }
              return URL.createObjectURL(blob);
            });
          } catch (e) {
            console.error("Error decoding saved video:", e);
          }
        };
        loadSavedVideo();
      }
    } else {
      setVideoSrc(prev => {
        if (prev && prev.startsWith('blob:')) {
          const oldUrl = prev;
          setTimeout(() => URL.revokeObjectURL(oldUrl), 3000);
        }
        return '';
      });
      lastFileRef.current = null;
    }
  }, [file, savedVideoData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setVideoSrc(prev => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return '';
      });
    };
  }, []);

  // Load saved video on mount
  useEffect(() => {
    getVideo().then(vid => {
      if (vid) {
        setSavedVideoData(vid);
      }
    }).catch(err => console.error('Failed to load video from DB', err));
  }, []);

  // Save state on change
  useEffect(() => {
    const stateToSave = {
      description,
      niche,
      genre,
      musicalType,
      preferredSinger,
      platform,
      useBypass,
      forceTextHook,
      forceSubtitles,
      algoCuriosity,
      isDeepAnalysis,
      pipelineMode,
      isEscalation,
      spinOffMode,
      viralBoost50k,
      result,
      editableScript,
      editablePrompts,
      pastPrompts,
      futurePrompts,
      editableKling10s,
      pastKling10s,
      futureKling10s,
      editableKling15s,
      pastKling15s,
      futureKling15s,
      editableSeedance15s,
      pastSeedance15s,
      futureSeedance15s,
      editableVeo3Prompt8s,
      pastVeo3Prompt8s,
      futureVeo3Prompt8s,
      editableVeo3ExtensionPart1,
      pastVeo3ExtensionPart1,
      futureVeo3ExtensionPart1,
      editableVeo3ExtensionPart2,
      pastVeo3ExtensionPart2,
      futureVeo3ExtensionPart2,
      editableKling,
      pastKling,
      futureKling,
      editableVeo,
      pastVeo,
      futureVeo,
      editablePrompts1,
      pastPrompts1,
      futurePrompts1,
      editableKling1,
      pastKling1,
      futureKling1,
      editableVeo1,
      pastVeo1,
      futureVeo1,
      editablePrompts2,
      pastPrompts2,
      futurePrompts2,
      editableKling2,
      pastKling2,
      futureKling2,
      editableVeo2,
      pastVeo2,
      futureVeo2,
      activePromptTab,
      activePromptFamily,
      activePromptVariant,
      activePromptTab1,
      activePromptTab2,
      editableSora12s,
      pastSora12s,
      futureSora12s,
      editableSora12s1,
      pastSora12s1,
      futureSora12s1,
      editableSora12s2,
      pastSora12s2,
      futureSora12s2,
      soraDuration,
      soraDuration1,
      soraDuration2,
      useExternalMarketData,
      dangerousWords,
      feedbackHistory: feedbackHistory.slice(-10),
      videoRange
    };
    const timer = setTimeout(() => {
      try {
        const serialized = JSON.stringify(stateToSave);
        if (serialized.length < 3500000) { // ~3.5MB threshold
          localStorage.setItem('viralShortsState', serialized);
        } else {
          // If too large, clear history/results to save essential state
          localStorage.setItem('viralShortsState', JSON.stringify({ ...stateToSave, result: null, feedbackHistory: [] }));
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'QuotaExceededError') {
          console.warn('LocalStorage is full, clearing results...');
          try {
            localStorage.setItem('viralShortsState', JSON.stringify({ ...stateToSave, result: null, feedbackHistory: [] }));
          } catch (innerE) {
            console.error('Failed to save even minimal state', innerE);
          }
        }
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    description, niche, genre, musicalType, preferredSinger, platform, useBypass, forceTextHook, forceSubtitles, algoCuriosity, isDeepAnalysis, isEscalation, spinOffMode, viralBoost50k, result, 
    editableScript, 
    editablePrompts, pastPrompts, futurePrompts,
    editableKling10s, pastKling10s, futureKling10s,
    editableKling15s, pastKling15s, futureKling15s,
    editableSeedance15s, pastSeedance15s, futureSeedance15s,
    editableVeo3Prompt8s, pastVeo3Prompt8s, futureVeo3Prompt8s,
    editableVeo3ExtensionPart1, pastVeo3ExtensionPart1, futureVeo3ExtensionPart1,
    editableVeo3ExtensionPart2, pastVeo3ExtensionPart2, futureVeo3ExtensionPart2,
    editableKling, pastKling, futureKling,
    editableVeo, pastVeo, futureVeo,
    editablePrompts1, pastPrompts1, futurePrompts1,
    editableKling1, pastKling1, futureKling1,
    editableVeo1, pastVeo1, futureVeo1,
    editablePrompts2, pastPrompts2, futurePrompts2,
    editableKling2, pastKling2, futureKling2,
    editableVeo2, pastVeo2, futureVeo2,
    activePromptTab, activePromptFamily, activePromptVariant, activePromptTab1, activePromptTab2,
    editableSora12s, pastSora12s, futureSora12s,
    editableSora12s1, pastSora12s1, futureSora12s1,
    editableSora12s2, pastSora12s2, futureSora12s2,
    soraDuration, soraDuration1, soraDuration2,
    dangerousWords, feedbackHistory, videoRange, isLoading
  ]);

  const handleGeminiUploadSmokeTest = async () => {
    if (!file && !savedVideoData) return;
    setIsGeminiUploadSmokeTesting(true);
    setGeminiUploadSmokeResult(null);
    setGeminiUploadSmokeProgress("Inizializzazione smoke test upload...");

    try {
      let videoToTest = file;
      if (!videoToTest && savedVideoData) {
        const response = await fetch(`data:${savedVideoData.mimeType};base64,${savedVideoData.base64}`);
        const blob = await response.blob();
        videoToTest = new File([blob], savedVideoData.fileName, { type: savedVideoData.mimeType });
      }

      if (!videoToTest) throw new Error("Nessun video disponibile per il test");

      const { apiKey } = getAI();
      const res = await runGeminiUploadSmokeTest(apiKey || '', videoToTest, (msg) => setGeminiUploadSmokeProgress(msg));
      setGeminiUploadSmokeResult(res);
      if (res.success && res.variant) {
        (window as any).__WINNING_GEMINI_UPLOAD_VARIANT = res.variant;
        if (res.uri) {
          setSessionUploadedFileUri(res.uri);
        }
        try {
          sessionStorage.setItem('geminiUploadSmokePassed', 'true');
          sessionStorage.setItem('geminiUploadWinningVariant', res.variant);
          sessionStorage.setItem('geminiUploadFileUri', res.uri || '');
          sessionStorage.setItem('geminiUploadFileState', res.state || 'unknown');
          sessionStorage.setItem('geminiUploadFileName', videoToTest.name);
          sessionStorage.setItem('geminiUploadFileSize', videoToTest.size.toString());
          if (res.geminiFileName) {
            sessionStorage.setItem('geminiUploadGeminiFileName', res.geminiFileName);
          }
          
          logger.info(`[GEMINI_UPLOAD_SMOKE_STATE_SAVED] smokeTestPassed: true, winningVariant: ${res.variant}, uriPresent: ${!!res.uri}, sessionUploadedFileUriPresent: ${!!res.uri}, fileState: ${res.state}, globalWinningVariantPresent: true, fileName: ${videoToTest.name}, fileSize: ${videoToTest.size}`);
        } catch(e) {}
      }
    } catch (e: any) {
      setGeminiUploadSmokeResult({
        success: false,
        variant: "none",
        error: e.message || String(e),
        logLines: ["Test fallito con errore o eccezione."]
      });
    } finally {
      setIsGeminiUploadSmokeTesting(false);
    }
  };

  const handleAudioSmokeTest = async () => {
    if (!file && !savedVideoData) return;
    setIsAudioSmokeTesting(true);
    setAudioSmokeResult(null);
    setAudioSmokeProgress("Inizializzazione smoke test...");

    try {
      let videoToTest = file;
      if (!videoToTest && savedVideoData) {
        const response = await fetch(`data:${savedVideoData.mimeType};base64,${savedVideoData.base64}`);
        const blob = await response.blob();
        videoToTest = new File([blob], savedVideoData.fileName, { type: savedVideoData.mimeType });
      }

      if (!videoToTest) throw new Error("Nessun video disponibile per il test");

      const { apiKey } = getAI();
      const res = await runAudioAnchorSmokeTest(apiKey || '', videoToTest, (msg) => setAudioSmokeProgress(msg));
      setAudioSmokeResult(res);
    } catch (e: any) {
      setAudioSmokeResult({
        audioDetected: false,
        transcriptPreview: "",
        spokenLanguage: "N/A",
        confidence: 0,
        errorReason: e.message || String(e),
        metadata: { fileName: file?.name || 'N/A', fileSizeMB: '0', mimeType: 'N/A', inlineEligible: false }
      });
    } finally {
      setIsAudioSmokeTesting(false);
    }
  };

  const handleClearCache = async () => {
    setIsCacheModalOpen(true);
  };

  const confirmClearCache = async () => {
    setIsCacheModalOpen(false);
    console.log("Cache clearing started...");
    setIsClearingCache(true);
    try {
      localStorage.removeItem('viralShortsState');
      await clearVideo();
      // Slightly longer delay to let the user see the "spinning" state clearly
      await new Promise(resolve => setTimeout(resolve, 1200));
      console.log("Cache cleared, reloading...");
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear cache', err);
      setIsClearingCache(false);
    }
  };

  const [pomelli, setPomelli] = useState<Pomelli>({
    creativity: 50,
    viralIntensity: 70,
    visualDetail: 60,
    narrativeChaos: 40,
    coverRealism: 80
  });
  const [showPomelli, setShowPomelli] = useState(false);

  const handleReset = async () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = async () => {
    logger.info("[APP_HARD_RESET_START]");
    
    // Invalidate current run ID to ignore any pending async results
    const previousId = activeRunIdRef.current;
    const newId = Math.random().toString(36).substring(7);
    activeRunIdRef.current = newId; // IMMUTABLE ROTATION
    setAnalysisRunId(newId);
    logger.info("[APP_HARD_RESET_RUN_ID_ROTATED]", { previousId, newId, refUpdatedImmediately: true });

    // 1. Reset Basic UI State
    setFile(null);
    setSavedVideoData(null);
    setDescription('');
    setNiche('');
    setGenre('Auto-Detect');
    setPlatform('TikTok');
    setPensaciTuGoal('');
    setUseBypass(false);
    setAlgoCuriosity(false);
    setIsDeepAnalysis(false);
    setIsEscalation(false);
    setSpinOffMode(false);
    
    // 2. Reset Analysis Results
    setResult(null);
    setPartialProtocol({});
    setUploadProgress(null);
    setPipelineSteps([]);
    setError(null);
    logger.info("[APP_HARD_RESET_RESULTS_CLEARED]");

    // 3. Reset Script and Prompts (Undo/Redo States)
    setEditableScript('');
    resetPrompts('');
    resetSceneMaster('');
    resetSora12s('');
    resetKling10s('');
    resetKling15s('');
    resetSeedance15s('');
    resetVeo3Prompt8s('');
    resetVeo3ExtensionPart1('');
    resetVeo3ExtensionPart2('');
    resetKling('');
    resetVeo('');
    
    resetPrompts1('');
    resetSora12s1('');
    resetKling1('');
    resetVeo1('');
    
    resetPrompts2('');
    resetSora12s2('');
    resetKling2('');
    resetVeo2('');
    logger.info("[APP_HARD_RESET_PROMPTS_CLEARED]");

    // 4. Reset Secondary Derived Data
    setDangerousWords([]);
    setVoiceoverAudio(null);
    setAudioSmokeResult(null);
    setCoverImage(null);
    setCoverReferenceImage(null);
    setCoverHookText("");
    setLoadingText("");
    logger.info("[APP_HARD_RESET_STATE_CLEARED]");

    // 5. Storage Clearing (Analysis only)
    try {
      localStorage.removeItem('viralShortsState');
      // session storage clearing for analysis keys if any (standardizing on localStorage though)
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('analysis') || key.includes('viral') || key.includes('prompt')) {
          sessionStorage.removeItem(key);
        }
      });
      
      await clearVideo(); // IndexedDB cleanup
      logger.info("[APP_HARD_RESET_STORAGE_CLEARED]");
    } catch (err) {
      console.error("[App] Reset storage failed:", err);
    }

    logger.info("[APP_HARD_RESET_COMPLETE]");
    setIsResetModalOpen(false);

    // Initial positioning for new work
    setSoraDuration('15s');
    setActivePromptFamily('sora2');
    setActivePromptVariant('12s');
    setSoraDuration1('15s');
    setSoraDuration2('15s');
    setActivePromptTab('sora');
    setActivePromptTab1('sora');
    setActivePromptTab2('sora');
    setFeedbackHistory([]);
    setFeedback('');
    setRewriteLevel(1);
    setRewriteLevel1(1);
    setRewriteLevel2(1);
    setVideoRange(null);
    setCoverError(null);
    setWizardAnswers({
      genre: '',
      baseIdea: '',
      cast: '',
      promise: '',
      referenceVideo: ''
    });
    setIsResetModalOpen(false);
  };

  const [isCopiedExport, setIsCopiedExport] = useState(false);

  // Utility robusta per copiare negli appunti (funziona anche negli iframe)
  const copyToClipboard = async (text: string) => {
    const fallbackCopy = () => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        textArea.remove();
        return successful;
      } catch (err) {
        console.error('Fallback copy failed', err);
        textArea.remove();
        return false;
      }
    };

    try {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (clipboardError) {
          console.warn('Clipboard API failed, trying fallback...', clipboardError);
          return fallbackCopy();
        }
      } else {
        return fallbackCopy();
      }
    } catch (err) {
      console.error('Copy failed', err);
      return false;
    }
  };

  const handleExportData = async () => {
    const exportData = {
      description,
      niche,
      genre,
      platform,
      useBypass,
      forceTextHook,
      forceSubtitles,
      algoCuriosity,
      feedbackHistory,
      result: result ? normalizeFinalResultContract(result, { genre, platform, analysisMode, useBypass, forceTextHook, forceSubtitles }) : result
    };
    const success = await copyToClipboard(JSON.stringify(exportData, null, 2));
    if (success) {
      setIsCopiedExport(true);
      setTimeout(() => setIsCopiedExport(false), 2000);
    } else {
      setError("Impossibile copiare i dati. Riprova o apri l'app in una nuova scheda.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleGenerateVoiceover = async (text: string) => {
    if (isAnalyzingRef.current) {
      logger.info("[App] Voiceover generation already in progress (ref), skipping handleGenerateVoiceover");
      return;
    }
    isAnalyzingRef.current = true;
    resetApiBudget(`App.handleGenerateVoiceover`);

    if (!text.trim()) {
      setVoiceoverError("Lo script Ã¨ vuoto. Genera prima un prompt o scrivi qualcosa.");
      isAnalyzingRef.current = false;
      return;
    }
    setIsGeneratingVoiceover(true);
    setVoiceoverAudio(null);
    setVoiceoverError(null);

    // Safety Timeout: force unlock after 300s
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        logger.error("[App] Safety timeout reached in handleGenerateVoiceover, forcing unlock.");
        isAnalyzingRef.current = false;
        setIsGeneratingVoiceover(false);
        resetQuotaStatus();
        setVoiceoverError("La generazione del voiceover ha impiegato troppo tempo ed Ã¨ stata interrotta.");
      }
    }, 600000);

    try {
      const { apiKey } = getAI();
      const audioData = await generateVoiceover(text, selectedVoice, apiKey || '');
      if (!audioData) {
        throw new Error('L\'IA non ha prodotto dati audio. Prova a cambiare voce o a ridurre la lunghezza del testo.');
      }
      setVoiceoverAudio({
        data: audioData,
        mimeType: 'audio/wav',
        script: text
      });
    } catch (e: any) {
      clearTimeout(safetyTimeout);
      console.error('Failed to generate voiceover', e);
      const errorMsg = e.message || 'Errore sconosciuto durante la generazione audio';
      if (errorMsg.includes("WebSocket") || errorMsg.includes("closed")) {
        setVoiceoverError("Connessione interrotta durante la generazione del voiceover. Riprova.");
      } else {
        setVoiceoverError(`Errore voiceover: ${errorMsg}`);
      }
    } finally {
      clearTimeout(safetyTimeout);
      isAnalyzingRef.current = false;
      setIsGeneratingVoiceover(false);
    }
  };

  const handleCopyScript = async () => {
    if (editableScript) {
      const success = await copyToClipboard(editableScript);
      if (success) {
        setIsCopiedScript(true);
        setTimeout(() => setIsCopiedScript(false), 2000);
      }
    }
  };

  const handleCopyPrompts = async () => {
    const activeText = getActivePromptText();
    if (activeText) {
      console.log(`[PROMPT_COPY_USED_FINAL_DISPLAY_PROMPT] tab=${getPromptTabKey(activePromptFamily, activePromptVariant)}`);
      const success = await copyToClipboard(activeText);
      if (success) {
        setIsCopiedPrompts(true);
        setTimeout(() => setIsCopiedPrompts(false), 2000);
      }
    }
  };

  const handleCopyPrompts1 = async (text?: string) => {
    const activeText = text || (activePromptTab1 === 'sora' ? editablePrompts1 : activePromptTab1 === 'kling' ? editableKling1 : editableVeo1);
    const success = await copyToClipboard(activeText);
    if (success) {
      setIsCopiedPrompts1(true);
      setTimeout(() => setIsCopiedPrompts1(false), 2000);
    }
  };

  const handleCopyPrompts2 = async (text?: string) => {
    const activeText = text || (activePromptTab2 === 'sora' ? editablePrompts2 : activePromptTab2 === 'kling' ? editableKling2 : editableVeo2);
    const success = await copyToClipboard(activeText);
    if (success) {
      setIsCopiedPrompts2(true);
      setTimeout(() => setIsCopiedPrompts2(false), 2000);
    }
  };

  const handleCopyField = async (field: string, value?: string) => {
    if (value) {
      const success = await copyToClipboard(value);
      if (success) {
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      }
    }
  };

  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverGoal, setCoverGoal] = useState<string>("");
  const [isRefiningCover, setIsRefiningCover] = useState<boolean>(false);

  const handleRefineCover = async () => {
    if (!result?.parsedKit?.coverPrompt || !coverGoal.trim()) return;
    
    const currentRunId = activeRunIdRef.current;
    setIsRefiningCover(true);
    setCoverError(null);
    const currentTrace: ModelUsageTrace = { entries: [], fidelity: 'FULL' };
    setGlobalModelTrace(currentTrace);

    // Safety Timeout: force unlock after 120s
    const safetyTimeout = setTimeout(() => {
      if (isRefiningCover) {
        logger.error("[App] Safety timeout reached in handleRefineCover, forcing unlock.");
        setIsRefiningCover(false);
        setIsGeneratingCover(false);
        setCoverError("La modifica della copertina ha superato i 600 secondi. Riprova.");
      }
    }, 600000);

    try {
      const { apiKey } = getAI();
      const newPrompt = await refineCoverPromptWithGoal(result.parsedKit.coverPrompt, coverGoal, apiKey || '', modelTier, currentTrace);
      
      const updatedResult = {
        ...result,
        parsedKit: (typeof result.parsedKit === "object" && result.parsedKit !== null) ? {
          ...result.parsedKit,
          coverPrompt: newPrompt
        } : result.parsedKit
      };
      commitNormalizedResult(updatedResult, currentRunId);
      
      setIsGeneratingCover(true);
      const img = await generateCover(newPrompt, coverAspectRatio, coverReferenceImage || undefined, coverHookText || undefined, pomelli, apiKey, modelTier, currentTrace);
      setCoverImage(img);
      setCoverGoal("");
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error('Error refining cover:', err);
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setCoverError("Connessione interrotta durante la modifica della copertina. Riprova.");
      } else if (err.message === 'QUOTA_EXCEEDED' || err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        setCoverError("Hai esaurito i token gratuiti per la generazione immagini. Riprova piÃ¹ tardi.");
      } else if (err.message === 'API_KEY_INVALID' || err.message?.includes('403') || err.message?.includes('PERMISSION_DENIED')) {
        setCoverError("La tua chiave API non ha i permessi necessari per la generazione immagini o non Ã¨ valida. Controlla la tua chiave API o usa quella gratuita.");
      } else if (err.message?.includes('sicurezza') || err.message?.includes('blocked')) {
        setCoverError(`Errore di Sicurezza: L'intelligenza artificiale si rifiuta di generare immagini con nomi di persone reali o celebritÃ . Modifica il prompt della copertina per rimuovere i nomi reali e riprova.`);
      } else {
        setCoverError(`Errore durante la modifica della copertina: ${err.message || String(err)}`);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsRefiningCover(false);
      setIsGeneratingCover(false);
    }
  };

  const handleGenerateCover = async () => {
    if (!result?.parsedKit?.coverPrompt) return;
    
    setIsGeneratingCover(true);
    setCoverError(null);
    const currentTrace: ModelUsageTrace = { entries: [], fidelity: 'FULL' };
    setGlobalModelTrace(currentTrace);

    // Safety Timeout: force unlock after 300s
    const safetyTimeout = setTimeout(() => {
      if (isGeneratingCover) {
        logger.error("[App] Safety timeout reached in handleGenerateCover, forcing unlock.");
        setIsGeneratingCover(false);
        setCoverError("La generazione della copertina ha superato i 600 secondi. Riprova.");
      }
    }, 600000);

    try {
      const { apiKey } = getAI();
      const img = await generateCover(result.parsedKit.coverPrompt, coverAspectRatio, coverReferenceImage || undefined, coverHookText || undefined, pomelli, apiKey || '', modelTier, currentTrace);
      setCoverImage(img);
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error('Error generating cover:', err);
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setCoverError("Connessione interrotta durante la generazione della copertina. Riprova.");
      } else if (err.message === 'QUOTA_EXCEEDED' || err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        setCoverError("Hai esaurito i token gratuiti per la generazione immagini. Riprova piÃ¹ tardi.");
      } else if (err.message === 'API_KEY_INVALID' || err.message?.includes('403') || err.message?.includes('PERMISSION_DENIED')) {
        setCoverError("La tua chiave API non ha i permessi necessari per la generazione immagini o non Ã¨ valida. Controlla la tua chiave API o usa quella gratuita.");
      } else if (err.message?.includes('sicurezza') || err.message?.includes('blocked')) {
        setCoverError(`Security Error: The AI refuses to generate images with names of real people or celebrities. Please remove any real names from the cover prompt and try again.`);
      } else if (err.message?.includes("La generazione cover non ha restituito un'immagine")) {
        setCoverError("La generazione cover non ha restituito un'immagine. Possibile causa: modello immagine non disponibile, quota/permessi mancanti o prompt rifiutato.");
      } else {
        setCoverError(`Errore durante la generazione della copertina: ${err.message || String(err)}`);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsGeneratingCover(false);
    }
  };

  const handleForceText = async (
    text: string,
    setter: (val: string) => void,
    setLoading: (val: boolean) => void,
    flashSetter?: (val: boolean) => void
  ) => {
    if (isAnalyzingRef.current) {
      logger.info("[App] Force Text already in progress (ref), skipping handleForceText");
      return;
    }
    isAnalyzingRef.current = true;
    const currentTrace: ModelUsageTrace = { entries: [], fidelity: 'FULL' };
    setGlobalModelTrace(currentTrace);

    const { apiKey } = getAI();
    if (!apiKey) {
      isAnalyzingRef.current = false;
      setError('Chiave API mancante.');
      return;
    }
    
    setLoading(true);

    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        logger.error("[App] Safety timeout reached in handleForceText, forcing unlock.");
        isAnalyzingRef.current = false;
        setLoading(false);
        resetQuotaStatus();
        setError("L'operazione ha impiegato troppo tempo (10 minuti) ed Ã¨ stata interrotta.");
      }
    }, 600000);

    try {
      const newPrompt = await forceTextInPrompt(text, apiKey, modelTier, currentTrace);
      setter(newPrompt);
      
      if (flashSetter) {
        triggerFlash(flashSetter);
      } else {
        if (setter === setEditablePrompts) triggerFlash(setFlashPrompt);
        else if (setter === setEditablePrompts1) triggerFlash(setFlashPrompt1);
        else if (setter === setEditablePrompts2) triggerFlash(setFlashPrompt2);
      }
    } catch (err: any) {
      logger.error("[App] Error in handleForceText:", err);
      const errorMessage = err.message || String(err);
      if (errorMessage === 'QUOTA_EXCEEDED' || errorMessage?.includes('429') || errorMessage?.includes('quota') || errorMessage?.includes('RESOURCE_EXHAUSTED') || errorMessage?.includes('QUOTA_EXHAUSTED')) {
        setError("Hai esaurito i token gratuiti o raggiunto il limite di richieste. Attendi qualche minuto e riprova, oppure inserisci una chiave API a pagamento nelle impostazioni.");
      } else {
        setError(`Errore durante l'operazione: ${errorMessage}`);
      }
    } finally {
      clearTimeout(safetyTimeout);
      isAnalyzingRef.current = false;
      setLoading(false);
    }
  };

  const handleToggleForceTextHook = async (
    text: string,
    setter: (val: string) => void,
    setLoading: (val: boolean) => void,
    flashSetter?: (val: boolean) => void
  ) => {
    if (forceTextHook) {
      setForceTextHook(false);
      return;
    }
    setForceTextHook(true);
  };

  useEffect(() => {
    if (!result) return;
    const normalized = normalizeFinalResultContract(result, { genre, platform, analysisMode, useBypass, forceTextHook, forceSubtitles });
    setResult(normalized);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceTextHook, forceSubtitles]);

  const handleAntiEmojiPurify = async (
    text: string,
    setter: (val: string) => void,
    setLoading: (val: boolean) => void,
    flashSetter?: (val: boolean) => void
  ) => {
    if (isAnalyzingRef.current) {
      logger.info("[App] Purify already in progress (ref), skipping handleAntiEmojiPurify");
      return;
    }
    isAnalyzingRef.current = true;
    const currentTrace: ModelUsageTrace = { entries: [], fidelity: 'FULL' };
    setGlobalModelTrace(currentTrace);

    const { apiKey } = getAI();
    if (!apiKey) {
      isAnalyzingRef.current = false;
      setError('Chiave API mancante.');
      return;
    }
    
    setLoading(true);

    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        logger.error("[App] Safety timeout reached in handleAntiEmojiPurify, forcing unlock.");
        isAnalyzingRef.current = false;
        setLoading(false);
        resetQuotaStatus();
        setError("La purificazione del prompt ha impiegato troppo tempo (10 minuti) ed Ã¨ stata interrotta.");
      }
    }, 600000);

    try {
      const purifiedPrompt = await purifyPromptAntiEmoji(text, apiKey, result?.modelUsed === 'pro' ? 'pro' : 'flash');
      setter(purifiedPrompt);
      
      if (flashSetter) {
        triggerFlash(flashSetter);
      } else {
        if (setter === setEditablePrompts) triggerFlash(setFlashPrompt);
        else if (setter === setEditablePrompts1) triggerFlash(setFlashPrompt1);
        else if (setter === setEditablePrompts2) triggerFlash(setFlashPrompt2);
      }
    } catch (err: any) {
      logger.error("[App] Error in handleAntiEmojiPurify:", err);
      setError(`Errore durante la purificazione: ${err.message || String(err)}`);
    } finally {
      clearTimeout(safetyTimeout);
      isAnalyzingRef.current = false;
      setLoading(false);
    }
  };

  const handleRewritePrompt = async (
    text: string,
    setter: (val: string) => void,
    setLoading: (val: boolean) => void,
    level: number,
    setLevel: (val: number) => void,
    flashSetter?: (val: boolean) => void
  ) => {
    if (isAnalyzingRef.current) {
      logger.info("[App] Rewrite already in progress (ref), skipping handleRewritePrompt");
      return;
    }
    isAnalyzingRef.current = true;

    const { apiKey } = getAI();
    if (!apiKey) {
      isAnalyzingRef.current = false;
      setError('Chiave API mancante.');
      return;
    }
    
    setLoading(true);
    const currentTrace: ModelUsageTrace = { entries: [], fidelity: 'FULL' };
    setGlobalModelTrace(currentTrace);

    // Safety Timeout: force unlock after 300s
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        logger.error("[App] Safety timeout reached in handleRewritePrompt, forcing unlock.");
        isAnalyzingRef.current = false;
        setLoading(false);
        resetQuotaStatus();
        setError("La riscrittura del prompt ha impiegato troppo tempo (10 minuti) ed Ã¨ stata interrotta.");
      }
    }, 600000);

    try {
      const rewrittenPrompt = await rewriteDangerousPrompt(text, apiKey, currentTrace);
      setter(rewrittenPrompt);
      
      const remainingDangerousWords = findDangerousWords(rewrittenPrompt);
      
      if (flashSetter) {
        triggerFlash(flashSetter);
      } else {
        if (setter === setEditablePrompts) triggerFlash(setFlashPrompt);
        else if (setter === setEditablePrompts1) triggerFlash(setFlashPrompt1);
        else if (setter === setEditablePrompts2) triggerFlash(setFlashPrompt2);
      }
      
      // Merge new dangerous words with existing ones so we don't lose highlights in other textareas
      if (remainingDangerousWords.length > 0) {
        setDangerousWords(prev => {
          const combined = [...prev, ...remainingDangerousWords];
          return Array.from(new Set(combined));
        });
      }
      
      setLevel(level + 1); // Increment level for next click
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error('Error rewriting prompt:', err);
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setError("Connessione interrotta durante la riscrittura del prompt. Riprova.");
      } else if (err.message === 'QUOTA_EXCEEDED' || err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        setError("Hai esaurito i token gratuiti o raggiunto il limite di richieste. Attendi qualche minuto e riprova, oppure inserisci una chiave API a pagamento nelle impostazioni.");
      } else {
        setError('Errore durante la riscrittura del prompt con la bacchetta magica.');
      }
    } finally {
      clearTimeout(safetyTimeout);
      isAnalyzingRef.current = false;
      setLoading(false);
    }
  };


  const handleOptimizeSora2 = async (
    text: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (isAnalyzingRef.current) {
      logger.info("[App] Sora 2 optimization already in progress (ref), skipping handleOptimizeSora2");
      return;
    }
    isAnalyzingRef.current = true;

    setLoading(true);
    const currentTrace: ModelUsageTrace = { entries: [], fidelity: 'FULL' };
    setGlobalModelTrace(currentTrace);

    // Safety Timeout: force unlock after 300s
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        logger.error("[App] Safety timeout reached in handleOptimizeSora2, forcing unlock.");
        isAnalyzingRef.current = false;
        setLoading(false);
        resetQuotaStatus();
        setError("L'ottimizzazione Sora 2 ha impiegato troppo tempo (10 minuti) ed Ã¨ stata interrotta.");
      }
    }, 600000);

    try {
      const context = result?.analysis || result?.script || '';
      const { apiKey } = getAI();
      const optimizedPrompt = await optimizeForSora2(text, context, apiKey || '', modelTier, currentTrace);
      if (!optimizedPrompt?.trim()) {
        console.log("[PROMPT_OPTIMIZER_SKIPPED_EMPTY_PROMPT]");
        return;
      }
      setter(optimizedPrompt);
      console.log("[PROMPT_OPTIMIZER_APPLIED]");
      console.log(`[PROMPT_OVERLAY_OPTIMIZER_APPLIED] tab=${getPromptTabKey(activePromptFamily, activePromptVariant)}`);
      
      if (setter === setEditablePrompts) triggerFlash(setFlashPrompt);
      else if (setter === setEditablePrompts1) triggerFlash(setFlashPrompt1);
      else if (setter === setEditablePrompts2) triggerFlash(setFlashPrompt2);
      
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error('Error optimizing for Sora 2:', err);
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setError("Connessione interrotta durante l'ottimizzazione Sora 2. Riprova.");
      } else if (err.message === 'QUOTA_EXCEEDED' || err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        setError("Hai esaurito i token gratuiti o raggiunto il limite di richieste. Attendi qualche minuto e riprova, oppure inserisci una chiave API a pagamento nelle impostazioni.");
      } else {
        setError("Errore durante l'ottimizzazione per Sora 2.");
      }
    } finally {
      clearTimeout(safetyTimeout);
      isAnalyzingRef.current = false;
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        if (droppedFile.size > 100 * 1024 * 1024) {
          setError("Il file Ã¨ troppo grande. Massimo 100MB per l'analisi video diretta.");
          return;
        }
        logger.info("[REFERENCE_FILE_SELECTED]", {
          filePresent: true,
          fileName: droppedFile.name,
          fileType: droppedFile.type,
          fileSizeMB: (droppedFile.size / (1024 * 1024)).toFixed(2),
          fileConstructor: droppedFile.constructor?.name,
          sourceComponent: "App_Drop"
        });
        setFile(droppedFile);
        setVideoRange(null);
        setResult(null);
        setError(null);
      } else {
        setError("Per favore, carica un file video valido.");
      }
    }
  };

  const handleTrim = async () => {
    if (!file && !savedVideoData) return;
    if (!videoRange) return;
    
    setIsTrimming(true);
    setTrimProgress(0);
    setError(null);
    setIsVirtualTrimmed(false);
    
    // Safety Timeout: force unlock after 900s (15m)
    const safetyTimeout = setTimeout(() => {
      if (isTrimming) {
        console.warn("[App] Safety timeout reached in handleTrim, forcing unlock.");
        setIsTrimming(false);
        setError("Il taglio del video ha superato i 15 minuti. Riprova o usa un video piÃ¹ corto.");
      }
    }, 900000);
    
    try {
      let videoToTrim: File;
      if (file) {
        videoToTrim = file;
      } else {
        // Convert saved base64 back to File
        const response = await fetch(`data:${savedVideoData!.mimeType};base64,${savedVideoData!.base64}`);
        const blob = await response.blob();
        videoToTrim = new File([blob], savedVideoData!.fileName, { type: savedVideoData!.mimeType });
      }

      try {
        const trimmedFile = await trimVideo(
          videoToTrim, 
          videoRange.start, 
          videoRange.end,
          (p) => setTrimProgress(Math.round(p * 100))
        );
        setFile(trimmedFile);
        setVideoRange(null); // Reset range after trimming
        setIsVirtualTrimmed(false);
        
        // Save to IndexedDB
        const base64 = await fileToBase64(trimmedFile);
        await saveVideo(base64, trimmedFile.type, trimmedFile.name);
        setSavedVideoData({ base64, mimeType: trimmedFile.type, fileName: trimmedFile.name });
      } catch (trimErr: any) {
        console.warn("[App] FFmpeg trim failed, using Virtual Trim fallback:", trimErr);
        setIsVirtualTrimmed(true);
        setError(null); // Clear the error since we have a fallback
        // We keep videoRange set so that handleGenerate knows to use it.
      }
      
      clearTimeout(safetyTimeout);
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error("Trimming error:", err);
      setError("Errore durante il taglio del video: " + (err.message || String(err)));
    } finally {
      setIsTrimming(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError("Il file Ã¨ troppo grande. Massimo 100MB per l'analisi video diretta.");
        return;
      }
      logger.info("[REFERENCE_FILE_SELECTED]", {
        filePresent: true,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSizeMB: (selectedFile.size / (1024 * 1024)).toFixed(2),
        fileConstructor: selectedFile.constructor?.name,
        sourceComponent: "App_Input"
      });
      setFile(selectedFile);
      setVideoRange(null);
      setResult(null);
      setError(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Failed to convert file'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleAnalyzePrompt = async (promptText: string, type: 'estimate' | 'anti-ai-slop', target: 'prompt' | 'prompt1' | 'prompt2') => {
    if (!promptText) return;
    
    // Debounce/Lock
    if (isAnalyzingRef.current) {
      logger.info("[App] Analysis already in progress (ref), skipping handleAnalyzePrompt");
      return;
    }
    const currentRunId = activeRunIdRef.current;
    isAnalyzingRef.current = true;
    logger.info("[App] handleAnalyzePrompt called", { type, target, promptLength: promptText.length, runId: currentRunId });

    const { apiKey } = getAI();
    const youtubeApiKey = localStorage.getItem('youtube_api_key') || (import.meta as any).env?.VITE_YOUTUBE_API_KEY || undefined;

    if (!apiKey) {
      logger.error("[App] Missing API Key in handleAnalyzePrompt");
      setError("Chiave API mancante. Vai nelle impostazioni e seleziona una chiave Gemini.");
      isAnalyzingRef.current = false;
      return;
    }

    let externalMarketData: ExternalMarketData | undefined;
    const currentTrace: ModelUsageTrace = { entries: [], fidelity: 'FULL' };
    setGlobalModelTrace(currentTrace);

    if (externalDataInfluence !== 'OFF') {
      try {
        const researchContext = `
          NICHE: ${niche}
          GENRE: ${genre}
          PROMPT: ${promptText}
        `.trim();
        
        externalMarketData = await getExternalMarketSignals(researchContext, apiKey, youtubeApiKey, modelTier, (text) => {
          // We don't have a specific loading text for prompt analysis UI yet, 
          // but we can log it or potentially use setLoadingText if appropriate.
          logger.info(`[PromptAnalysis] ${text}`);
        }, currentTrace);
        logger.info("[App] External market data fetched for prompt analysis:", externalMarketData.status);
      } catch (e) {
        logger.warn("[App] Failed to fetch external market data for prompt analysis", e);
      }
    } else {
      logger.info("[App] Skipping external market data for prompt analysis: OFF mode.");
    }

    // Safety Timeout: force unlock after 300s (5m)
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        console.warn("[App] Safety timeout reached in handleAnalyzePrompt, forcing unlock.");
        isAnalyzingRef.current = false;
        if (target === 'prompt') setIsAnalyzingPrompt(false);
        else if (target === 'prompt1') setIsAnalyzingPrompt1(false);
        else if (target === 'prompt2') setIsAnalyzingPrompt2(false);
        resetQuotaStatus();
        setError("L'analisi del prompt ha impiegato troppo tempo (10 minuti) ed Ã¨ stata interrotta.");
      }
    }, 600000);
    
    if (target === 'prompt') setIsAnalyzingPrompt(true);
    else if (target === 'prompt1') setIsAnalyzingPrompt1(true);
    else if (target === 'prompt2') setIsAnalyzingPrompt2(true);
    
    try {
      const res = await generateVideoPrompt(
        undefined,
        undefined,
        promptText,
        useBypass,
        niche,
        genre,
        platform,
        [],
        algoCuriosity,
        null,
        isDeepAnalysis,
        false,
        spinOffMode,
        viralBoost50k,
        type,
        modelTier,
        false,
        apiKey,
        musicalType,
        preferredSinger,
        pomelli,
        pensaciTuGoal,
        undefined,
        undefined,
        externalMarketData,
        undefined,
        externalDataInfluence,
        null,
        currentTrace
      );
      
      if (!res || !res.text) {
        throw new Error("Risposta vuota o non valida dal servizio Gemini");
      }

      let analysisText = '';
      let scriptText = '';
      let soraPrompt = '';
      let klingPrompt = '';
      let veoPrompt = '';

      try {
        const rawParsed = safeParseJSON(res.text);
        const p = Array.isArray(rawParsed) ? (rawParsed[0] || {}) : rawParsed;
        const targetResult = p.result || (p.analysis || p.script || p.viralScore ? p : null);

        if (targetResult) {
          analysisText = targetResult.analysis || '';
          // If script is a stringified JSON, parse it
          if (typeof targetResult.script === 'string' && targetResult.script.trim().startsWith('[')) {
            try {
              const script = safeParseJSON(targetResult.script);
              // Format script to be readable
              scriptText = JSON.stringify(script, null, 2);
              analysisText += `\n\n**SCRIPT:**\n${scriptText}`;
            } catch (e) {
              scriptText = targetResult.script;
              analysisText += `\n\n**SCRIPT:**\n${scriptText}`;
            }
          } else if (targetResult.script) {
             scriptText = typeof targetResult.script === 'string' ? targetResult.script : JSON.stringify(targetResult.script, null, 2);
             analysisText += `\n\n**SCRIPT:**\n${scriptText}`;
          }
        } else {
          analysisText = typeof res.text === 'string' ? res.text : JSON.stringify(res.text);
        }
      } catch (e) {
        // Fallback to regex
        analysisText = typeof res.text === 'string' ? res.text : JSON.stringify(res.text);
      }

      // Keep regex matching for markers
      const textToMatch = typeof res.text === 'string' ? res.text : String(res.text || '');
      
      const extractTag = (text: string, tag: string) => {
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
      };

      let viralScoreMatchStr = extractTag(textToMatch, 'viral_score');
      if (!viralScoreMatchStr) {
        const m = textToMatch?.match(/(?:===|\*\*===)\s*VIRAL SCORE\s*(?:===|\*\*===|\*\*|===)?(.*?)(?=\n\s*(?:===|\*\*===|<[a-z_]+>)|$)/is);
        if (m) viralScoreMatchStr = m[1].trim();
      }

      let analysisMatchStr = extractTag(textToMatch, 'analysis');
      if (!analysisMatchStr) {
        const m = textToMatch?.match(/(?:===|\*\*===)\s*ANALYSIS\s*(?:===|\*\*===|\*\*|===)?(.*?)(?=\n\s*(?:===|\*\*===|<[a-z_]+>)|$)/is);
        if (m) analysisMatchStr = m[1].trim();
      }
      
      let soraPrompt15sMatchStr = extractTag(textToMatch, 'prompt_sora_15s');
      if (!soraPrompt15sMatchStr) {
        const m = textToMatch?.match(/(?:===|\*\*===)\s*PROMPT SORA 2 \(15s\)\s*(?:===|\*\*===|\*\*|===|===\*\*)?(.*?)(?=\n\s*(?:===|\*\*===|<[a-z_]+>)|$)/is);
        if (m) soraPrompt15sMatchStr = m[1].trim();
      }

      let soraPrompt12sMatchStr = extractTag(textToMatch, 'prompt_sora_12s');
      if (!soraPrompt12sMatchStr) {
        const m = textToMatch?.match(/(?:===|\*\*===)\s*PROMPT SORA 2 \(12s\)\s*(?:===|\*\*===|\*\*|===|===\*\*)?(.*?)(?=\n\s*(?:===|\*\*===|<[a-z_]+>)|$)/is);
        if (m) soraPrompt12sMatchStr = m[1].trim();
      }

      let klingPromptMatchStr = extractTag(textToMatch, 'prompt_kling');
      if (!klingPromptMatchStr) {
        const m = textToMatch?.match(/(?:===|\*\*===)\s*PROMPT KLING(?:[^\n]*?)(?:===|\*\*===|\*\*|===|===\*\*)?(.*?)(?=\n\s*(?:===|\*\*===|<[a-z_]+>)|$)/is);
        if (m) klingPromptMatchStr = m[1].trim();
      }

      let veoPromptMatchStr = extractTag(textToMatch, 'prompt_veo');
      if (!veoPromptMatchStr) {
        const m = textToMatch?.match(/(?:===|\*\*===)\s*PROMPT VEO(?:[^\n]*?)(?:===|\*\*===|\*\*|===|===\*\*)?(.*?)(?=\n\s*(?:===|\*\*===|<[a-z_]+>)|$)/is);
        if (m) veoPromptMatchStr = m[1].trim();
      }

      // NEW: Extract from JSON if regex failed
      try {
        const rawParsed = safeParseJSON(res.text);
        const p = Array.isArray(rawParsed) ? (rawParsed[0] || {}) : rawParsed;
        const r = p.result || (p.analysis || p.script || p.viralScore ? p : null);
        
        if (r) {
          if (!viralScoreMatchStr && r.viralScore) viralScoreMatchStr = String(r.viralScore);
          if (!analysisMatchStr && r.analysis) analysisMatchStr = r.analysis;
          if (!soraPrompt15sMatchStr) soraPrompt15sMatchStr = r.soraPrompt15s || r.promptSora15s || '';
          if (!soraPrompt12sMatchStr) soraPrompt12sMatchStr = r.soraPrompt12s || r.promptSora12s || '';
          if (!klingPromptMatchStr) klingPromptMatchStr = r.klingPrompt || r.promptKling || r.klingPrompt15s || '';
          if (!veoPromptMatchStr) veoPromptMatchStr = r.veoPrompt || r.promptVeo || r.veo3Prompt8s || '';
        }
      } catch (e) {
        console.warn("JSON extraction failed in App.tsx", e);
      }

      const veoExtensionMatch = textToMatch?.match(/(?:===|\*\*===)\s*PROMPT VEO 3 EXTENSION \(16s TOTAL\)\s*(?:===|\*\*===|\*\*|===|===\*\*)?(.*?)(?=\n\s*(?:===|\*\*===|<[a-z_]+>)|$)/is);

      if (viralScoreMatchStr) {
        analysisText += `**VIRAL SCORE:**\n${viralScoreMatchStr}\n\n`;
      }
      if (analysisMatchStr) {
        analysisText += analysisMatchStr;
      }
      if (!analysisText) {
        analysisText = res.text;
      }

      if (currentRunId !== activeRunIdRef.current) {
        logger.warn("[STALE_ANALYSIS_RESULT_IGNORED_AFTER_RESET]", { runId: currentRunId, activeId: activeRunIdRef.current, provider: 'prompt-analysis' });
        return;
      }
      
      const soraPrompt15sMatch = soraPrompt15sMatchStr ? [null, soraPrompt15sMatchStr] : null;
      const soraPrompt12sMatch = soraPrompt12sMatchStr ? [null, soraPrompt12sMatchStr] : null;
      const klingPromptMatch = klingPromptMatchStr ? [null, klingPromptMatchStr] : null;
      const veoPromptMatch = veoPromptMatchStr ? [null, veoPromptMatchStr] : null;
      
      let finalVeoPrompt = veoPromptMatch ? veoPromptMatch[1].trim() : '';
      if (veoExtensionMatch) {
        finalVeoPrompt += (finalVeoPrompt ? '\n\n' : '') + `=== VEO 3 EXTENSION (16s TOTAL) ===\n${veoExtensionMatch[1].trim()}`;
      }
      
      const analysisData = { type, result: analysisText };
      
      if (target === 'prompt') {
        setPromptAnalysis(analysisData);
        if (soraPrompt15sMatch) resetPrompts(soraPrompt15sMatch[1].trim());
        if (soraPrompt12sMatch) resetSora12s(soraPrompt12sMatch[1].trim());
        resetKling10s('');
        resetKling15s(klingPromptMatch ? klingPromptMatch[1].trim() : '');
        resetSeedance15s('');
        if (klingPromptMatch) resetKling(klingPromptMatch[1].trim());
        resetVeo3Prompt8s(finalVeoPrompt || '');
        resetVeo3ExtensionPart1('');
        resetVeo3ExtensionPart2('');
        if (finalVeoPrompt) resetVeo(finalVeoPrompt);

        const preferredPromptSelection = soraPrompt12sMatch
          ? { family: 'sora2' as const, variant: '12s' as const }
          : klingPromptMatch
            ? { family: 'kling' as const, variant: '15s' as const }
            : finalVeoPrompt
              ? { family: 'veo3' as const, variant: '8s' as const }
              : { family: 'sora2' as const, variant: '12s' as const };
        setActivePromptFamily(preferredPromptSelection.family);
        setActivePromptVariant(preferredPromptSelection.variant);
      } else if (target === 'prompt1') {
        setPrompt1Analysis(analysisData);
        if (soraPrompt15sMatch) resetPrompts1(soraPrompt15sMatch[1].trim());
        if (soraPrompt12sMatch) resetSora12s1(soraPrompt12sMatch[1].trim());
        if (klingPromptMatch) resetKling1(klingPromptMatch[1].trim());
        if (finalVeoPrompt) resetVeo1(finalVeoPrompt);
        
        if (soraPrompt12sMatch && !soraPrompt15sMatch) setSoraDuration1('12s');
        if (!soraPrompt15sMatch && !soraPrompt12sMatch) {
          if (klingPromptMatch) setActivePromptTab1('kling');
          else if (finalVeoPrompt) setActivePromptTab1('veo');
        }
      } else if (target === 'prompt2') {
        setPrompt2Analysis(analysisData);
        if (soraPrompt15sMatch) resetPrompts2(soraPrompt15sMatch[1].trim());
        if (soraPrompt12sMatch) resetSora12s2(soraPrompt12sMatch[1].trim());
        if (klingPromptMatch) resetKling2(klingPromptMatch[1].trim());
        if (finalVeoPrompt) resetVeo2(finalVeoPrompt);
        
        if (soraPrompt12sMatch && !soraPrompt15sMatch) setSoraDuration2('12s');
        if (!soraPrompt15sMatch && !soraPrompt12sMatch) {
          if (klingPromptMatch) setActivePromptTab2('kling');
          else if (finalVeoPrompt) setActivePromptTab2('veo');
        }
      }
      
    } catch (err) {
      console.error("Error analyzing prompt:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setError("Connessione WebSocket interrotta. Il server Gemini ha chiuso la sessione inaspettatamente. Riprova tra un istante.");
      } else {
        setError(`Errore durante l'analisi del prompt: ${errorMessage}`);
      }
    } finally {
      clearTimeout(safetyTimeout);
      isAnalyzingRef.current = false;
      if (target === 'prompt') setIsAnalyzingPrompt(false);
      else if (target === 'prompt1') setIsAnalyzingPrompt1(false);
      else if (target === 'prompt2') setIsAnalyzingPrompt2(false);
    }
  };

  const stopLoading = () => {
    logger.info("[App] stopLoading called");
    setIsLoading(false);
    setLoadingStep(null);
    setIsTakingLong(false);
    setElapsedSeconds(0);
    isAnalyzingRef.current = false;
    if (timerRef.current) {
      logger.info("[App] Clearing timerRef from stopLoading");
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStop = () => {
    logger.info("[App] handleStop called by user. Starting HARD RESET...");
    console.log("[App] handleStop - setting __VIRAL_RUN_TERMINATED=true");
    
    // Stop the main loading loop completely
    stopLoading();
    setError(null);
    setIsTrimming(false);
    
    // FORCE all states related to processing off
    isAnalyzingRef.current = false;
    setIsLoading(false);
    setLoadingText("");
    setPartialProtocol({});
    
    // Force pipeline steps to error/aborted if they were running
    setPipelineSteps(prev => prev.map(step => 
       step.status === 'running' || step.status === 'pending' 
         ? { ...step, status: 'error', detail: 'Interrotto dall\'utente' } 
         : step
    ));
    
    // Unlock Groq lock if stuck
    import('./services/gemini/groqHybrid').then(m => m.forceUnlockGroqPipeline());
    
    // Set terminal flag to stop polling loops
    (window as any).__VIRAL_RUN_TERMINATED = true;
    logger.info("[App] [POLLING_STOPPED_TERMINAL_STATE] Flag set in handleStop.");
  };

  const handleGenerate = async (
    isFeedback = false,
    overrideDescription?: string,
    overrideGenre?: string,
    overrideAnalysisMode?: any,
    overrideWizardAnswers?: any,
    overrideGroqFullPhase?: 'core' | 'prompt'
  ) => {
    // [ANALYZE_BUTTON_PRESSED_RAW] LOGGING
    logger.info("[ANALYZE_BUTTON_PRESSED_RAW]", {
      mode: modelTier,
      protocol: overrideAnalysisMode || analysisMode,
      isAnalyzing: isAnalyzingRef.current,
      isProcessing: isLoading,
      hasVideo: !!file,
      hasSavedVideo: !!savedVideoData
    });

    let externalPhase = "precheck";
    // [ANALYSIS_ENTRYPOINT_RECEIVED] LOGGING
    logger.info("[ANALYSIS_ENTRYPOINT_RECEIVED]", {
      entrypointName: "handleGenerate",
      calledFrom: isFeedback ? "feedback_loop" : "initial_click",
      filePresent: !!file,
      hasSavedVideo: !!savedVideoData,
      fileName: file?.name || savedVideoData?.fileName || null,
      fileType: file?.type || savedVideoData?.mimeType || null,
      fileSizeMB: file ? (file.size / (1024 * 1024)).toFixed(2) : (savedVideoData ? "N/A (DB)" : null),
      hasVideoMime: (!!file && file.type?.startsWith('video/')) || (!!savedVideoData),
      mode: modelTier,
      forcePro: modelTier === 'pro'
    });

    console.log("[App] handleGenerate - resetting __VIRAL_RUN_TERMINATED=false");

    // Debounce/Lock
    if (isAnalyzingRef.current) {
      logger.warn("[ANALYZE_BLOCKED_BEFORE_PIPELINE]", { reason: "Generation already in progress (ref)" });
      logger.info("[App] Generation already in progress (ref), skipping handleGenerate");
      return;
    }
    logger.info("[ANALYZE_GUARD_CHECK]", { guardName: "isAnalyzingRef", blocked: false });
    
    // Reset terminal flag so polling can occur
    (window as any).__VIRAL_RUN_TERMINATED = false;
    
    isAnalyzingRef.current = true;
    const currentRunId = analysisRunId;
    logger.info("[ANALYZE_ENTRY_CONFIRMED]", { mode: modelTier, protocol: overrideAnalysisMode || analysisMode, runId: currentRunId });

    resetApiBudget(`App.handleGenerate:${overrideAnalysisMode !== undefined ? overrideAnalysisMode : analysisMode}`);
    setIsLoading(true);
    setPartialProtocol({});
    
    // START TIMER IMMEDIATELY WITH TIMEOUT SAFETY
    setElapsedSeconds(0);
    timeoutRunIdRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    const effectiveGroqFullPhase = overrideGroqFullPhase || groqFullPhase;
    const hasVideoInput = !!file || !!savedVideoData;
    const timeoutSeconds =
      hasVideoInput && modelTier === 'groq' && effectiveGroqFullPhase === 'prompt'
        ? 600
        : 300;
    logger.info("[VIDEO_PIPELINE_TIMEOUT_POLICY]", {
      sourceType: hasVideoInput ? 'video' : 'text',
      engineMode: modelTier,
      groqFullPhase: effectiveGroqFullPhase,
      timeoutMs: timeoutSeconds * 1000,
      reason: hasVideoInput && modelTier === 'groq' && effectiveGroqFullPhase === 'prompt'
        ? 'video_groq_prompt_phase_with_vision_fallback'
        : 'default_timeout_policy'
    });
    logger.info(`[App] Starting timerRef interval early with ${timeoutSeconds}s safety timeout`);
    
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;
        if (next >= timeoutSeconds && isAnalyzingRef.current && (window as any).__VIRAL_RUN_TERMINATED === false) {
          logger.error(`[App] Pipeline bloccata oltre ${timeoutSeconds} secondi. Esecuzione interrotta forzatamente.`);
          clearInterval(timerRef.current!);
          isAnalyzingRef.current = false;
          setIsLoading(false);
          setLoadingText("");
          timeoutRunIdRef.current = currentRunId;
          (window as any).__VIRAL_RUN_TERMINATED = true;
          setError("Pipeline bloccata prima dell'avvio reale o durante l'analisi. Esegui reset e riprova.");
          setPipelineSteps(steps => steps.map(s => 
             s.status === 'running' || s.status === 'pending' ? { ...s, status: 'error', detail: `Timeout di sicurezza superato (${timeoutSeconds}s)` } : s
          ));
        }
        return next;
      });
    }, 1000);

    // Inizializzazione step della pipeline
    const initialSteps: PipelineStep[] = [
      { id: 'video-selected', label: 'Video selezionato', status: 'pending' },
      { id: 'video-prepared', label: 'Video caricato/preparato', status: 'pending' },
      { id: 'pipeline-mode', label: 'ModalitÃ  pipeline', status: 'pending' },
      { id: 'audio-anchor', label: 'Audio Anchor', status: 'pending' },
      { id: 'frame-analysis', label: 'Frame Analysis & CNG', status: 'pending' },
      { id: 'market-data', label: 'Market Data / YouTube', status: 'pending' },
      { id: 'generation', label: 'Generazione risultato', status: 'pending' },
      { id: 'runtime-status', label: 'Runtime Status', status: 'pending' },
    ];
    setPipelineSteps(initialSteps);

    // Update Step 1: Video selected
    if (file || savedVideoData) {
      const fileName = file?.name || savedVideoData?.fileName || 'N/A';
      const fileSize = file ? (file.size / (1024 * 1024)).toFixed(2) : (savedVideoData ? 'N/A' : '0');
      updatePipelineStep('video-selected', 'success', 'Video selezionato', `${fileName} (${fileSize} MB)`);
    } else {
      updatePipelineStep('video-selected', 'skipped', 'Nessun video fornito', 'Analisi basata su descrizione');
    }

    if (pipelineMode === 'STANDARD') {
      updatePipelineStep('pipeline-mode', 'success', 'ModalitÃ  STANDARD attiva', 'Audio Anchor non eseguito per scelta della modalitÃ ');
      updatePipelineStep('audio-anchor', 'skipped', 'Audio Anchor saltato in STANDARD', 'Analisi visuale frame-only attiva');
      setPartialProtocol(prev => ({ ...prev, analysisRoutingMode: 'FRAME_ONLY', audioVerified: false, promptSafetyMode: 'VISUAL_SAFE' }));
    } else {
      const modeLabel = pipelineMode === 'DEEP' ? 'DEEP' : 'AUDIO ENHANCED';
      updatePipelineStep('pipeline-mode', 'success', `ModalitÃ  ${modeLabel} attiva`);
      updatePipelineStep('audio-anchor', 'running', 'Audio Anchor in corso');
      setPartialProtocol(prev => ({ ...prev, analysisRoutingMode: 'DEEP_HYBRID', transcriptStatus: 'PENDING' }));
    }

    setLoadingText("[1/6] Inizializzazione protocollo di analisi...");
    
    // [HUGGING_ROUTING_INTERCEPT]
    if (modelTier === 'hugging') {
      try {
        const resolvedProtocol = (overrideAnalysisMode || pipelineMode || 'STANDARD').toLowerCase().replace(' ', '_');
        logger.info("[HUGGING_PROTOCOL_UI_SELECTED]", { uiProtocol: pipelineMode });
        logger.info("[HUGGING_PROTOCOL_RESOLVED]", { 
          resolvedProtocol, 
          source: overrideAnalysisMode ? 'override' : 'ui_pipeline_mode' 
        });
        logger.info("[ENGINE_MODE_SELECTED]", { mode: 'hugging', protocol: resolvedProtocol });
        
        const res = await import('./services/gemini/huggingFull').then(m => m.runHuggingFullPipeline({
          video: file || savedVideoData,
          hfVisionModel,
          hfAudioModel,
          hfTextModel,
          updatePipelineStep,
          setLoadingText,
          setPartialProtocol,
          overrideAnalysisMode: resolvedProtocol
        }));

        if (currentRunId !== analysisRunId) {
          logger.warn("[STALE_ANALYSIS_RESULT_IGNORED_AFTER_RESET]", { runId: currentRunId, activeId: analysisRunId, provider: 'hugging' });
          return;
        }

        if ((res as any).error || (res as any).status === 'error') {
          // EXCEPTION: If it is a Phase 2 Credits Depleted result, we accept it as a valid (though failed) result
          const r = res as any;
          if (r.groqFullPhase === 'prompt' && (r.bestOptimizedPrompt?.reason === "GROQ_FULL_PHASE_2_HF_CREDITS_DEPLETED" || r.bestOptimizedPrompt?.prompt === "NON_GENERATO_PROMPT_HF_CREDITS_DEPLETED")) {
            logger.info("[APP_PROVIDER_UNAVAILABLE_RESULT_PRESERVED]", { phase: 'prompt', reason: r.bestOptimizedPrompt.reason, route: 'hugging' });
            commitNormalizedResult(r, currentRunId);
          } else {
            setError(r.error || "Errore pipeline HUGGING");
          }
        } else {
          logger.info("[UI_COMMIT_INPUT_AUDIT]", { route: "groq" });
          const normalizedResult = commitNormalizedResult(res as any, currentRunId);
          if ((normalizedResult as any)?.promptQualityReport?.finalPass === true && (normalizedResult as any)?.lockedPromptTabs?.locked === true) {
            logger.info("[APP_RECEIVED_PHASE2_SUCCESS_RESULT]", {
              finalPass: normalizedResult?.promptQualityReport?.finalPass,
              locked: normalizedResult?.lockedPromptTabs?.locked,
              operationalDecision: (normalizedResult as any)?.operationalDecision,
              hasAiPrompts: Boolean((normalizedResult as any)?.aiPrompts),
              hasSceneMaster: Boolean((normalizedResult as any)?.sceneMasterPrompt),
              hasSora: Boolean((normalizedResult as any)?.soraPrompt15s || (normalizedResult as any)?.promptSora15s),
              hasKling: Boolean((normalizedResult as any)?.klingPrompt15s || (normalizedResult as any)?.klingPrompt),
              hasVeo: Boolean((normalizedResult as any)?.veo3Prompt8s || (normalizedResult as any)?.veoPrompt),
              hasSeedance: Boolean((normalizedResult as any)?.seedancePrompt15s || (normalizedResult as any)?.sendancePrompt15s)
            });
            bindPromptTabsFromPhase2Result(normalizedResult);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || String(err));
      } finally {
        isAnalyzingRef.current = false;
        setIsLoading(false);
        (window as any).__VIRAL_RUN_TERMINATED = true;
        if (timerRef.current) clearInterval(timerRef.current);
      }
      return;
    }

    // [GROQ_ROUTING_INTERCEPT]
    if (modelTier === 'groq') {
      try {
        const resolvedProtocol = (overrideAnalysisMode || pipelineMode || 'STANDARD').toLowerCase().replace(' ', '_');
        logger.info("[GROQ_PROTOCOL_UI_SELECTED]", { uiProtocol: pipelineMode });
        logger.info("[GROQ_PROTOCOL_RESOLVED]", { 
          resolvedProtocol, 
          source: overrideAnalysisMode ? 'override' : 'ui_pipeline_mode' 
        });
        logger.info("[ENGINE_MODE_SELECTED]", { mode: 'groq', protocol: resolvedProtocol });
        logger.info("[GROQ_ROUTING_INTERCEPTED_BEFORE_GEMINI]", { reason: 'engineMode_groq' });
        logger.info("[GROQ_FULL_PHASE_PARAM_FROM_UI]", { groqFullPhase: effectiveGroqFullPhase });
        logger.info("[GROQ_MODE_RUNTIME_AUDIT]", {
          selectedMode: modelTier,
          requestedPhase: effectiveGroqFullPhase,
          actualBranch: resolvedProtocol === 'deep' ? (effectiveGroqFullPhase === 'prompt' ? 'GROQ_FULL_PHASE2' : 'GROQ_FULL_PHASE1') : 'GROQ_LITE',
          willProducePromptDecisionTrace: resolvedProtocol === 'deep' && effectiveGroqFullPhase === 'prompt'
        });
         
        const resolvedGeminiApiKey = (typeof process !== 'undefined' ? process.env?.GEMINI_EYE_EAR_API_KEY : "") ||
                                    (import.meta as any).env?.VITE_GEMINI_EYE_EAR_API_KEY ||
                                    getAI(undefined, false, 'BANAL', 'EYE_EAR_MULTIMODAL').apiKey || 
                                    (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : "") ||
                                    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
                                    "";

        const resolvedEyeEarModel = (typeof process !== 'undefined' ? process.env?.GEMINI_EYE_EAR_MODEL : "") ||
                                    (import.meta as any).env?.VITE_GEMINI_EYE_EAR_MODEL ||
                                    "gemini-2.0-flash";

        const res = await runGroqHybridPipeline({
          isFeedback,
          overrideDescription,
          overrideGenre,
          overrideAnalysisMode: resolvedProtocol,
          overrideWizardAnswers,
          groqFullPhase: effectiveGroqFullPhase,
          // Passing current App state 
          uploadedFileUri: sessionUploadedFileUri,
          geminiApiKey: resolvedGeminiApiKey,
          modelTier,
          eyeEarModel: resolvedEyeEarModel,
          video: file || savedVideoData,
          groqAudioModel,
          hfVisionModel,
          hfTextModel,
          // For UI updates
          updatePipelineStep,
          setLoadingText,
          setPartialProtocol
        });

        if (currentRunId !== analysisRunId) {
          logger.warn("[STALE_ANALYSIS_RESULT_IGNORED_AFTER_RESET]", { runId: currentRunId, activeId: analysisRunId, provider: 'groq' });
          return;
        }

        if ((res as any).error || (res as any).status === 'error') {
          // EXCEPTION: If it is a Phase 2 Credits Depleted result, we accept it as a valid (though failed) result
          const r = res as any;
          if (r.groqFullPhase === 'prompt' && (r.bestOptimizedPrompt?.reason === "GROQ_FULL_PHASE_2_HF_CREDITS_DEPLETED" || r.bestOptimizedPrompt?.prompt === "NON_GENERATO_PROMPT_HF_CREDITS_DEPLETED")) {
            logger.info("[APP_PROVIDER_UNAVAILABLE_RESULT_PRESERVED]", { phase: 'prompt', reason: r.bestOptimizedPrompt.reason, route: 'groq' });
            commitNormalizedResult(r, currentRunId);
          } else {
            setError(r.error || "Errore pipeline GROQ");
          }
        } else {
          const normalizedResult = commitNormalizedResult(res as any, currentRunId);
          if ((normalizedResult as any)?.promptQualityReport?.finalPass === true && (normalizedResult as any)?.lockedPromptTabs?.locked === true) {
            logger.info("[APP_RECEIVED_PHASE2_SUCCESS_RESULT]", {
              finalPass: normalizedResult?.promptQualityReport?.finalPass,
              locked: normalizedResult?.lockedPromptTabs?.locked,
              operationalDecision: (normalizedResult as any)?.operationalDecision,
              hasAiPrompts: Boolean((normalizedResult as any)?.aiPrompts),
              hasSceneMaster: Boolean((normalizedResult as any)?.sceneMasterPrompt),
              hasSora: Boolean((normalizedResult as any)?.soraPrompt15s || (normalizedResult as any)?.promptSora15s),
              hasKling: Boolean((normalizedResult as any)?.klingPrompt15s || (normalizedResult as any)?.klingPrompt),
              hasVeo: Boolean((normalizedResult as any)?.veo3Prompt8s || (normalizedResult as any)?.veoPrompt),
              hasSeedance: Boolean((normalizedResult as any)?.seedancePrompt15s || (normalizedResult as any)?.sendancePrompt15s)
            });
            bindPromptTabsFromPhase2Result(normalizedResult);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || String(err));
      } finally {
        isAnalyzingRef.current = false;
        setIsLoading(false);
        (window as any).__VIRAL_RUN_TERMINATED = true;
        if (timerRef.current) clearInterval(timerRef.current);
      }
      return;
    }
    logger.info("[App] handleGenerate called", { isFeedback, hasFile: !!file, hasSavedVideo: !!savedVideoData });

    const currentAnalysisMode = overrideAnalysisMode !== undefined ? overrideAnalysisMode : analysisMode;
    const currentDescription = overrideDescription !== undefined ? overrideDescription : description;
    const currentGenre = currentAnalysisMode === 'pensaci-tu' ? pensaciTuGenre : (overrideGenre !== undefined ? overrideGenre : genre);
    const currentWizardAnswers = overrideWizardAnswers !== undefined ? overrideWizardAnswers : wizardAnswers;
    
    let sensorCategory: string | null = null;
    let visualOverride: string | null = null;
    let cngResult: CNGResult | null = null;
    
    const { apiKey } = getAI();
    resetQuotaStatus();
    const youtubeApiKey = localStorage.getItem('youtube_api_key') || (import.meta as any).env?.VITE_YOUTUBE_API_KEY || undefined;
    const currentTrace: ModelUsageTrace = { entries: [], fidelity: 'FULL' };
    setGlobalModelTrace(currentTrace);

    if (currentAnalysisMode === 'guided-short' && !currentWizardAnswers.promise) {
      logger.warn("[App] handleGenerate early return: missing promise for guided-short");
      setError("La promessa Ã¨ obbligatoria per la modalitÃ  guidata.");
      isAnalyzingRef.current = false;
      stopLoading();
      return;
    }

    if (currentAnalysisMode === 'trend-hunter' && !trendNiche.trim()) {
      logger.warn("[App] handleGenerate early return: missing niche for trend-hunter");
      setError("Inserisci una nicchia per cercare i trend.");
      isAnalyzingRef.current = false;
      stopLoading();
      return;
    }

    if (currentAnalysisMode === 'hook-test' && (!hookA.trim() || !hookB.trim())) {
      logger.warn("[App] handleGenerate early return: missing hooks for hook-test");
      setError("Inserisci entrambi i ganci (Hook A e Hook B) per confrontarli.");
      isAnalyzingRef.current = false;
      stopLoading();
      return;
    }

    if (currentAnalysisMode === 'estimate' || currentAnalysisMode === 'anti-ai-slop') {
      if (estimateInputType === 'video' && !file && !savedVideoData && !currentDescription.trim()) {
        logger.warn("[App] handleGenerate early return: missing input for estimate/anti-ai-slop (video)");
        setError(`Per la ${currentAnalysisMode === 'estimate' ? 'stima delle visualizzazioni' : 'cura anti-ai slop'} Ã¨ necessario caricare un video o descrivere l'idea.`);
        isAnalyzingRef.current = false;
        stopLoading();
        return;
      }
      if (estimateInputType === 'prompt' && !originalPrompt.trim() && !currentDescription.trim()) {
        logger.warn("[App] handleGenerate early return: missing input for estimate/anti-ai-slop (prompt)");
        setError(`Per la ${currentAnalysisMode === 'estimate' ? 'stima delle visualizzazioni' : 'cura anti-ai slop'} Ã¨ necessario incollare il prompt originale o descrivere l'idea.`);
        isAnalyzingRef.current = false;
        stopLoading();
        return;
      }
    }

    if (currentAnalysisMode === 'generate' && !file && !savedVideoData && !currentDescription.trim()) {
      logger.warn("[App] handleGenerate early return: missing input for generate");
      setError("Fornisci un video o una descrizione per iniziare.");
      isAnalyzingRef.current = false;
      stopLoading();
      return;
    }

    let videoToProcess: File | null = file || null;
    if (!videoToProcess && savedVideoData) {
      logger.info(`[App] [Diag] Reconstructing videoToProcess from savedVideoData. Name: ${savedVideoData.fileName}, Type: ${savedVideoData.mimeType}`);
      const response = await fetch(`data:${savedVideoData.mimeType};base64,${savedVideoData.base64}`);
      const blob = await response.blob();
      videoToProcess = new File([blob], savedVideoData.fileName, { type: savedVideoData.mimeType });
    }

    if (videoToProcess) {
      updatePipelineStep('video-prepared', 'success', 'Video caricato correttamente');
    }

    // Audio Anchor (Only in Deep/Audio Enhanced mode)
    let audioAnchorResult: AudioAnchorResult | null = null;
    if (pipelineMode !== 'STANDARD' && videoToProcess && videoToProcess.type.startsWith('video/') && videoToProcess.size < 40 * 1024 * 1024) {
        logger.info("[App] [AUDIO_ENHANCED_START] Starting Audio Anchor race with adaptive fallback...");
        const anchorLabel = pipelineMode === 'DEEP' ? 'ModalitÃ  DEEP' : 'ModalitÃ  AUDIO ENHANCED';
        updatePipelineStep('audio-anchor', 'running', `Audio Anchor in corso (${anchorLabel})`);
        try {
            // Outer race stays slightly above the internal Audio Anchor timeout to avoid UI hangs.
            let timeoutId: any;
            const timeoutPromise = new Promise<AudioAnchorResult>((resolve) => 
               timeoutId = setTimeout(() => {
                 logger.warn("[AUDIO_ENHANCED_TIMEOUT] Audio Anchor race timed out after 220s. Resolving to Fallback.");
                 resolve({
                    audioVerified: false,
                    audioSource: "NONE",
                    scriptSourceMode: "FRAME_VISUAL_DESCRIPTION",
                    scriptConfidence: 0,
                    verifiedInlineVideoSummary: "",
                    literalTranscript: "",
                    hasLiteralTranscript: false,
                    dialogueLockStatus: "FRAME_ONLY",
                    dialogueSource: "VISUAL_INFERENCE",
                    forbiddenInventedDialogueDetected: false,
                    dialogueFaithfulnessScore: 0,
                    failureReason: "TIMEOUT"
                 });
               }, 220000)
            );

            let audioAnchorFinished = false;
            audioAnchorResult = await Promise.race([
               anchorVideoAudio(videoToProcess, apiKey || '', (prog) => {
                 if (!audioAnchorFinished) updatePipelineStep('audio-anchor', 'running', prog);
               }, isLowMemoryMode, modelTier),
               timeoutPromise
            ]) as AudioAnchorResult;
            
            audioAnchorFinished = true;
            clearTimeout(timeoutId);
            
            if (audioAnchorResult && audioAnchorResult.audioVerified && audioAnchorResult.scriptConfidence >= 55) {
              logger.info("[App] [AUDIO_ENHANCED_VERIFIED] Audio Anchor SUCCESS.");
              setLoadingText("[2/6] Audio Anchor VERIFICATO. Sincronizzazione script locale...");
              updatePipelineStep('pipeline-mode', 'success', 'ModalitÃ  DEEP attiva (Audio Verificato)');
              updatePipelineStep('audio-anchor', 'success', 'Audio verificato correttamente');
              setPartialProtocol(prev => ({ 
                ...prev, 
                analysisRoutingMode: 'FRAME_PLUS_AUDIO_ANCHOR',
                audioVerified: true, 
                audioSource: audioAnchorResult?.audioSource,
                audioProvider: audioAnchorResult?.audioProvider,
                audioModelUsed: audioAnchorResult?.audioModelUsed,
                audioKeySource: audioAnchorResult?.audioKeySource,
                transcriptStatus: 'VERIFIED_TRANSCRIPT',
                scriptSourceMode: audioAnchorResult?.scriptSourceMode || 'AUDIO_VIDEO_SUMMARY',
                promptSafetyMode: 'AUDIO_VERIFIED'
              }));
            } else {
              const reason = audioAnchorResult?.failureReason || 'LOW_CONFIDENCE';
              logger.warn("[App] [AUDIO_ENHANCED_FAILED] Audio Anchor not verified.", { reason });
              setLoadingText("[2/6] Audio Anchor NON VERIFICATO. Proseguo in FRAME_ONLY.");
              updatePipelineStep('audio-anchor', 'warning', `Audio non verificato: ${reason === 'TIMEOUT' ? 'Tempo scaduto' : 'QualitÃ  insufficiente'}`);
              setPartialProtocol(prev => ({ 
                ...prev, 
                audioVerified: false, 
                audioSource: audioAnchorResult?.audioSource || 'NONE',
                audioProvider: audioAnchorResult?.audioProvider,
                audioModelUsed: audioAnchorResult?.audioModelUsed,
                audioKeySource: audioAnchorResult?.audioKeySource,
                transcriptStatus: 'AUDIO_NOT_VERIFIED',
                scriptSourceMode: audioAnchorResult?.scriptSourceMode || 'FRAME_VISUAL_DESCRIPTION',
                promptSafetyMode: 'VISUAL_SAFE'
              }));
            }
        } catch(e) {
            logger.error("[AUDIO_ENHANCED_FAILED] Unexpected error in audio pipeline", {error: e});
            setLoadingText("[2/6] Audio Anchor ERRORE. Proseguo in FRAME_ONLY.");
            updatePipelineStep('audio-anchor', 'error', 'Errore tecnico Audio Anchor');
            audioAnchorResult = {
                audioVerified: false,
                audioSource: "NONE",
                scriptSourceMode: "FRAME_VISUAL_DESCRIPTION",
                scriptConfidence: 0,
                verifiedInlineVideoSummary: "",
                literalTranscript: "",
                hasLiteralTranscript: false,
                dialogueLockStatus: "FRAME_ONLY",
                dialogueSource: "VISUAL_INFERENCE",
                forbiddenInventedDialogueDetected: false,
                dialogueFaithfulnessScore: 0,
                failureReason: "ERROR"
            };
            setPartialProtocol(prev => ({ ...prev, audioVerified: false, audioSource: 'NONE', transcriptStatus: 'AUDIO_NOT_VERIFIED', promptSafetyMode: 'VISUAL_SAFE' }));
        }
    } else if (pipelineMode !== 'STANDARD' && videoToProcess) {
        // Mode is DEEP but file doesn't fit inline criteria
        logger.info("[App] [AUDIO_ENHANCED_SKIPPED] File ineligible for inline anchor");
        updatePipelineStep('audio-anchor', 'skipped', 'Audio Anchor saltato (File troppo grande o non video)', 'L\'ancoraggio inline ha un limite di 40MB');
        setPartialProtocol(prev => ({ ...prev, audioVerified: false, audioSource: 'NONE', transcriptStatus: 'AUDIO_NOT_VERIFIED', promptSafetyMode: 'VISUAL_SAFE' }));
    }

    // VIRTUAL TRIM LOGIC: We extract frames to avoid upload issues and timeouts.
    // The user wants to use frame sampling everywhere to ensure stability.
    let framesForAnalysis: string[] | undefined = undefined;
    
    if (videoToProcess) {
      try {
        setLoadingText("Estrazione fotogrammi per analisi stabile...");
        const { extractFrames, getVideoDuration } = await import('./utils/videoProcessor');
        const duration = await getVideoDuration(videoToProcess);
        const segmentDuration = (videoRange?.end || duration) - (videoRange?.start || 0);
        
        const frameCount = getFramesToExtract(modelTier, isDeepAnalysis);

        framesForAnalysis = await extractFrames(videoToProcess, frameCount, videoRange?.start || 0, videoRange?.end || 0, 768, (p) => {
          setLoadingText(`Estrazione fotogrammi: ${p}%`);
          setLastProgressUpdate(Date.now());
        }, isLowMemoryMode);

        if (framesForAnalysis.length === 0) {
          logger.error("[FRAME_EXTRACTION_EMPTY_ABORT_OPENROUTER]");
          updatePipelineStep('frame-analysis', 'warning', 'Estrazione frame fallita');
          setError("Visione video non completata: nessun frame estratto. Audio disponibile, ma analisi visiva non affidabile.");
        }
        
        logger.info("[App] Frame sampling successful", { 
          count: framesForAnalysis.length, 
          isDeep: isDeepAnalysis,
          duration: segmentDuration,
          fps: (framesForAnalysis.length / segmentDuration).toFixed(1)
        });
        updatePipelineStep('frame-analysis', 'success', 'Frame analizzati correttamente', `${framesForAnalysis.length} frame estratti`);
      } catch (err) {
        console.error("[App] Frame extraction failed:", err);
        updatePipelineStep('frame-analysis', 'error', 'Errore estrazione frame');
        // Fallback to normal analysis if frame extraction fails
      }
    } else {
      updatePipelineStep('frame-analysis', 'skipped', 'Nessun video da analizzare via frame');
    }
    
    if (!apiKey) {
      logger.error("[App] Missing API Key");
      setError("Chiave API mancante. Vai nelle impostazioni e seleziona una chiave Gemini.");
      isAnalyzingRef.current = false;
      stopLoading();
      return;
    }

    setLoadingStep(1);
    setRecentLogs(["Inizializzazione analisi..."]);
    setUploadProgress(null);
    logger.info("[App] Loading state initialized");
    setIsTakingLong(false);
    
    setError(null);
    setLastProgressUpdate(Date.now());
    
    // STATE RESET: Ensure no stale data is shown during the new analysis
    if (!isFeedback) {
      setResult(null);
    }
    
    logger.info(`[App] Starting analysis: ${currentAnalysisMode}`, { 
      mode: currentAnalysisMode, 
      genre: currentGenre, 
      isDeep: isDeepAnalysis 
    });
    
    let res: any;
    let cumulativeTimer: NodeJS.Timeout;
    let heartbeatInterval: NodeJS.Timeout;
    let takingLongTimeout: NodeJS.Timeout;
    let safetyTimeout: NodeJS.Timeout;
    
    try {
      takingLongTimeout = setTimeout(() => {
        if (currentRunId === activeRunIdRef.current) setIsTakingLong(true);
      }, 60000);

      cumulativeTimer = setInterval(() => {
        if (currentRunId !== activeRunIdRef.current) {
          clearInterval(cumulativeTimer);
          return;
        }
        logger.info(`[App] [handleGenerate_HEARTBEAT] Elapsed: ${elapsedSeconds}s, Step: ${loadingStep}, isAnalyzing: ${isAnalyzingRef.current}`);
      }, 15000);

      safetyTimeout = setTimeout(() => {
        if (isAnalyzingRef.current) {
          logger.error("[App] Safety timeout reached in handleGenerate, forcing unlock.");
          isAnalyzingRef.current = false;
          setError("L'operazione ha impiegato troppo tempo ed Ã¨ andata in timeout (30 min). Il video potrebbe essere troppo complesso o i server di Google sono lenti. Riprova con un video piÃ¹ breve.");
          stopLoading();
        }
      }, 1800000); // 30 minutes max (was 10, was 35)
      
      // Heartbeat to keep loading text updated and visible and simulate life
      let heartbeatCount = 0;
      heartbeatInterval = setInterval(() => {
        setLastProgressUpdate(Date.now());
        heartbeatCount++;
        
        // If we are waiting for Gemini (Step 2 or 3) and it's taking a while, show "virtual" activity
        if (heartbeatCount > 2) {
          setLoadingText(prev => {
            if (typeof prev !== 'string') return "Analisi in corso... attendere...";
            if (prev.includes("Inizializzazione Viral Engine")) return "Viral Engine: Calcolo probabilitÃ  di ritenzione (richiede tempo)...";
            if (prev.includes("Calcolo probabilitÃ ")) return "Viral Engine: Analisi picchi di dopamina... (attendere)";
            if (prev.includes("Analisi picchi")) return "Viral Engine: Estrazione trigger psicologici...";
            if (prev.includes("Estrazione trigger")) return "Viral Engine: Definizione struttura loop...";
            if (prev.includes("struttura loop")) return "L'elaborazione Ã¨ complessa e puÃ² richiedere tempo (fino a 10-15 minuti). Non chiudere la pagina...";
            if (prev.includes("10-15 minuti")) return "Inizializzazione Viral Engine (Analisi DNA)...";
            
            return "Analisi in corso... attendere...";
          });
        }
      }, 8000);

      const handleProgress = (text: string) => {
        console.log(`[App] Progress Update: ${text}`);
      
      const lower = text.toLowerCase();
      let step = 0;
      
      if (lower.includes('caricamento') || lower.includes('inizializzazione') || lower.includes('upload')) {
        step = 1;
        setLoadingText("[1/6] Inizializzazione protocollo di analisi...");
      } else if (lower.includes('estrazione') || lower.includes('ricerca') || lower.includes('youtube') || lower.includes('summary')) {
        step = 2;
        setLoadingText("[2/6] Ricerca segnali di mercato e trascrizione...");
      } else if (lower.includes('cng') || lower.includes('natura') || lower.includes('fisica') || lower.includes('semantica')) {
        step = 3;
        setLoadingText("[3/6] Analisi semantica e fisica del contenuto (CNG)...");
      } else if (lower.includes('brainstorming') || lower.includes('decision') || lower.includes('dominanza') || lower.includes('strategia')) {
        step = 4;
        setLoadingText("[4/6] Elaborazione della strategia di dominanza...");
      } else if (lower.includes('ritenzione') || lower.includes('tensione') || lower.includes('hook') || lower.includes('gancio')) {
        step = 5;
        setLoadingText("[5/6] Calcolo probabilitÃ  di ritenzione e ganci...");
      } else if (lower.includes('sanitizzazione') || lower.includes('pacchetto') || lower.includes('risultato') || lower.includes('finalizzazione')) {
        step = 6;
        setLoadingText("[6/6] Finalizzazione del pacchetto creativo...");
      }

      if (step > 0) setLoadingStep(step);
      
      // Update pipeline steps based on text
      if (lower.includes('fisica')) updatePipelineStep('frame-analysis', 'running', 'CNG: Analisi fisica del movimento...');
      if (lower.includes('semantica')) updatePipelineStep('frame-analysis', 'running', 'CNG: Analisi semantica vision-check...');
      if (lower.includes('brainstorming')) updatePipelineStep('generation', 'running', 'Brainstorming strategico in corso...');
      if (lower.includes('pacchetto') || lower.includes('risultato')) updatePipelineStep('generation', 'running', 'Generazione prompt e publishing kit...');
      
      const prefix = step > 0 ? `[${step}/6] ` : "";
      // Preveniamo duplicati se il testo ha giÃ  il prefisso (per chiamate dirette a setLoadingText)
      const finalText = text.startsWith('[') ? text : `${prefix}${text}`;
      
      setLoadingText(finalText);
      setRecentLogs(prev => [finalText, ...prev].slice(0, 3));
      setLastProgressUpdate(Date.now());
    };

    let currentFeedbackHistory = [...feedbackHistory];
    if (isFeedback && feedback.trim()) {
      currentFeedbackHistory.push(feedback.trim());
      setFeedbackHistory(currentFeedbackHistory);
      setFeedback('');
    } else if (!isFeedback) {
      // If it's a fresh generation, clear feedback history
      currentFeedbackHistory = [];
      setFeedbackHistory([]);
      setRewriteLevel(1);
      setRewriteLevel1(1);
      setRewriteLevel2(1);
    }

    
      if (currentAnalysisMode === 'trend-hunter') {
        const trends = await getTrendingTopics(trendNiche, apiKey!, modelTier);
        commitNormalizedResult({
          analysis: "Analisi Trend completata.",
          script: '',
          aiPrompts: '',
          analysisMode: 'trend-hunter',
          trends: trends.map(t => ({ type: 'trend', title: t, description: '' }))
        }, currentRunId);
        stopLoading();
        clearTimeout(takingLongTimeout);
        return;
      }

      let newResult: ResultData | null = null;
      let externalMarketData: ExternalMarketData | undefined;
      let uploadedFileUri: string | undefined;

      // --- Deterministic Pipeline Step 1: Media Reconstruction & Finalization ---
      // videoToProcess is already defined in outer scope

      let isTrimmedForAnalysis = false;
      let finalMimeType = videoToProcess?.type;

      if (videoToProcess) {
        // Step 1.1: Trimming (if requested)
        if (videoRange && videoToProcess.type.startsWith('video/')) {
          const skipThreshold = window.crossOriginIsolated ? 25 * 1024 * 1024 : 35 * 1024 * 1024;
          if (videoToProcess.size >= skipThreshold) {
            try {
              setLoadingText("Estrazione segmento (video grande)...");
              const trimmedFile = await trimVideo(
                videoToProcess,
                videoRange.start,
                videoRange.end,
                (p) => {
                  const progress = Math.round(p * 100);
                  setLoadingText(`Estrazione: ${progress}%`);
                  setLastProgressUpdate(Date.now());
                }
              );
              videoToProcess = trimmedFile;
              finalMimeType = trimmedFile.type;
              isTrimmedForAnalysis = true;
              logger.info("[App] Video trimmed successfully for deterministic pipeline");
            } catch (trimErr) {
              logger.warn("[App] FFmpeg trim failed, using Original File as fallback", trimErr);
            }
          }
        }

        // Step 1.2: Mandatory Upload (if large AND no frames extracted)
        // We skip upload if framesForAnalysis is present to satisfy user request for frame-based analysis stability
        const isVideoFile = videoToProcess.type.startsWith('video/');
        const shouldUpload = (isVideoFile || videoToProcess.size > 20 * 1024 * 1024) && (!framesForAnalysis || framesForAnalysis.length === 0);
        
        if (shouldUpload) {
          setLoadingText("[1/6] Caricamento media su Google Gemini...");
          uploadedFileUri = await uploadToGemini(videoToProcess, apiKey, (text, progress) => {
            setLoadingText(`[1/6] ${text}`);
            if (progress !== undefined) setUploadProgress(progress);
            setLastProgressUpdate(Date.now());
          });
          await waitForFileActive(uploadedFileUri, apiKey, (text) => {
            setLoadingText(`[1/6] Verifica file: ${text}`);
            setLastProgressUpdate(Date.now());
            // Reset upload progress once active (processing starts)
            setUploadProgress(null);
          });
          logger.info("[App] Deterministic upload SUCCESSFUL", { fileUri: uploadedFileUri });
          setSessionUploadedFileUri(uploadedFileUri);
        } else if (framesForAnalysis && framesForAnalysis.length > 0) {
          logger.info("[App] Skipping video upload, using sampled frames instead");
        }

        // Step 1.3: persistence
        if (file && !savedVideoData && file.size < 20 * 1024 * 1024) {
          try {
            const originalBase64 = await fileToBase64(file);
            await saveVideo(originalBase64, file.type, file.name);
            setSavedVideoData({ base64: originalBase64, mimeType: file.type, fileName: file.name });
          } catch (e) {
            console.error('Failed to save original video to DB', e);
          }
        }
      }

      // Fetch external market data only when it can influence generation.
      if (currentAnalysisMode !== 'trend-hunter' && currentAnalysisMode !== 'guided-short' && externalDataInfluence !== 'OFF') {
        try {
          logger.info("[App] [Diag] Precheck - Reading YouTube API key");
          const youtubeApiKey = localStorage.getItem('youtube_api_key') || (import.meta as any).env?.VITE_YOUTUBE_API_KEY || undefined;
          logger.info(`[App] [Diag] Precheck - YouTube Key present: ${!!youtubeApiKey}`);
          let researchContext = '';
          let summaryResult: any = null;
          
          let effectiveDescription = currentDescription;
          if (!effectiveDescription.trim() && (videoToProcess)) {
            externalPhase = "video_summary";
            setLoadingText("[2/6] Analisi preliminare video per ricerca di mercato...");
            
            let framesForSummary: string[] | undefined = framesForAnalysis;
            if (!framesForSummary || framesForSummary.length === 0) {
              const { extractFrames } = await import('./utils/videoProcessor');
              framesForSummary = await extractFrames(videoToProcess, 10, 0, undefined, 512);
            }

            // We pass uploadedFileUri if already uploaded, extractVideoSummary will use it.
            summaryResult = await extractVideoSummary(videoToProcess, apiKey, (text) => {
              setLoadingText(`[2/6] ${text}`);
              setLastProgressUpdate(Date.now());
            }, framesForSummary, modelTier, currentTrace, uploadedFileUri, audioAnchorResult);
            
            effectiveDescription = summaryResult.summary;
            const detectedGenre = summaryResult.detectedGenre;
            if (detectedGenre && genre === 'Auto-Detect') {
              setGenre(detectedGenre);
            }
            // Sync uri if not already set (for small files that weren't uploaded early)
            if (!uploadedFileUri) uploadedFileUri = summaryResult.fileUri;
            
            logger.info("[App] Extracted video summary for research:", { summary: effectiveDescription, hasFileUri: !!uploadedFileUri, detectedGenre });
          }

          if (currentAnalysisMode === 'viral-hook-bulk' || currentAnalysisMode === 'hook-test' || currentAnalysisMode === 'guided-short') {
            researchContext = `
              NICHE: ${trendNiche}
              DESCRIPTION: ${effectiveDescription}
            `.trim();
          } else {
            researchContext = `
              NICHE: ${niche}
              GENRE: ${genre === 'Auto-Detect' ? (summaryResult?.detectedGenre || 'Auto-Detect') : genre}
              DESCRIPTION: ${effectiveDescription}
              ${currentAnalysisMode === 'pensaci-tu' ? `GOAL: ${pensaciTuGoal}` : ''}
            `.trim();
          }
          
          externalPhase = "youtube_signals";
          if (researchContext.trim() && (effectiveDescription.trim() || niche.trim() || trendNiche.trim())) {
            if (useExternalMarketData) {
              setLoadingText("[2/6] Ricerca segnali di mercato su YouTube...");
              logger.info("[App] [Diag] youtube_signals - Before calling getExternalMarketSignals. Context:", researchContext);
              externalMarketData = await getExternalMarketSignals(
                researchContext, 
                apiKey, 
                youtubeApiKey, 
                modelTier, 
                (text) => {
                  setLoadingText(`[2/6] ${text}`);
                  setLastProgressUpdate(Date.now());
                }, 
                currentTrace
              );
              logger.info(`[App] [Diag] youtube_signals - After getExternalMarketSignals. Status: ${externalMarketData.status}`);
            } else {
              logger.info(`[YOUTUBE_MARKET_SKIPPED_REASON] reason=USER_DISABLED skipStage=before_call youtubeKeyStatus=${youtubeApiKey ? 'ok' : 'missing'} queryCount=0`);
              externalMarketData = {
                status: 'NO_DATA',
                marketSummary: "Ricerca di mercato disabilitata dall'utente. Nessun dato reale disponibile.",
                comparableVideos: [],
                skipReason: "USER_DISABLED",
                skipStage: "before_call"
              };
            }
          } else {
            logger.warn(`[YOUTUBE_MARKET_SKIPPED_REASON] reason=NO_CONTEXT skipStage=before_call youtubeKeyStatus=${youtubeApiKey ? 'ok' : 'missing'} queryCount=0`);
            externalMarketData = {
              status: 'NO_DATA',
              marketSummary: "Nessun dato di ricerca disponibile: descrizione e nicchia mancanti.",
              comparableVideos: [],
              skipReason: "NO_CONTEXT",
              skipStage: "before_call"
            };
          }
          externalPhase = "postprocess";
          logger.info("[App] External market data fetched early:", externalMarketData.status);
          
          if (externalMarketData) {
            if (externalMarketData.status === 'SUCCESS') {
              updatePipelineStep('market-data', 'success', 'Segnali di mercato recuperati');
            } else if (externalMarketData.status === 'NO_DATA') {
              updatePipelineStep('market-data', 'skipped', 'Market data opzionale non disponibile: analisi continuata');
            } else {
              updatePipelineStep('market-data', 'warning', 'Dati di mercato non disponibili: analisi continuata');
            }
          }
        } catch (e: any) {
          const errMsg = e?.message || String(e);
          updatePipelineStep('market-data', 'skipped', 'Market data opzionale non disponibile: analisi continuata');
          if (errMsg.includes("UPLOAD_FAILED") || errMsg.includes("404") || errMsg.includes("INVALID_ARGUMENT") || errMsg.includes("FILE_NOT_ACTIVE") || errMsg.includes("FILE_PROCESSING_FAILED")) {
             logger.error("[App] Critical pipeline error: Upload failed during initial video summary.", errMsg);
             throw e; // Blocca tutto il processo
          }
          logger.warn(`[App] [Diag] Failed to fetch external market data early at phase '${externalPhase}'`, { 
            error: errMsg, 
            stack: e?.stack 
          });
        }
      } else if (currentAnalysisMode !== 'trend-hunter') {
        logger.info("[App] Skipping external market data fetch:", {
          mode: currentAnalysisMode,
          externalDataInfluence
        });
      }

      let promptText = '';
      let modelUsed = '';
      let structuredResponse: any = null;

      if (currentAnalysisMode === 'viral-hook-bulk') {
        setLoadingText("Generazione 10 ganci virali in corso...");
        const hooks = await generateBulkHooks(trendNiche + (description ? ` - ${description}` : ''), 10, apiKey!, modelTier, externalMarketData, currentTrace);
        newResult = {
          analysis: "Analisi Ganci Virali completata.",
          script: '',
          aiPrompts: '',
          analysisMode: 'viral-hook-bulk',
          bulkHooks: hooks.map(h => ({ category: 'Hook', hook: h })),
          externalMarketData
        };
      } else if (currentAnalysisMode === 'hook-test') {
        setLoadingText("Confronto A/B degli hook in corso...");
        const compareResult = await compareHooks(hookA, hookB, trendNiche, apiKey!, modelTier, externalMarketData, currentTrace);
        newResult = {
          analysis: "Analisi Hook completata.",
          script: '',
          aiPrompts: '',
          analysisMode: 'hook-test',
          hookComparison: `${compareResult.reasoning}\n\nScalability: ${compareResult.scalabilityReason}\n\nKey Differentiator: ${compareResult.keyDifferentiator}`,
          refinedWinner: compareResult.winner === 'A' ? hookA : hookB,
          winner: compareResult.winner,
          scoreA: compareResult.winner === 'A' ? compareResult.winnerScore : compareResult.loserScore,
          scoreB: compareResult.winner === 'B' ? compareResult.winnerScore : compareResult.loserScore,
          externalMarketData
        };
      } else if (currentAnalysisMode === 'guided-short') {
        const guidedResult = await generateGuidedShort(
          currentWizardAnswers.genre,
          currentWizardAnswers.baseIdea,
          currentWizardAnswers.cast,
          currentWizardAnswers.promise,
          currentWizardAnswers.referenceVideo || '',
          getAI().apiKey || '',
          modelTier,
          false,
          currentTrace
        );
        promptText = guidedResult.text;
        modelUsed = guidedResult.modelUsed;
      }

      if (newResult && (currentAnalysisMode === 'viral-hook-bulk' || currentAnalysisMode === 'hook-test')) {
        // After generating hooks or comparison, analyze psychological triggers
        try {
          const textToAnalyze = currentAnalysisMode === 'viral-hook-bulk' 
            ? newResult.bulkHooks?.map(h => h.hook).join('\n') || ''
            : newResult.hookComparison || '';
          
          if (textToAnalyze) {
            setLoadingText("Analisi dei trigger psicologici in corso...");
            let psychAnalysis;
            try {
              psychAnalysis = await analyzePsychologicalTriggers(textToAnalyze, apiKey!, modelTier);
            } catch (err: any) {
              const errorMessage = err.message || String(err);
              const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
              if (isQuotaError && modelTier === 'pro') {
                logger.warn("[App] Quota exceeded for PRO model in psych analysis. Auto-switching to FLASH mode.");
                psychAnalysis = await analyzePsychologicalTriggers(textToAnalyze, apiKey!, 'flash');
              } else {
                throw err;
              }
            }
            newResult.psychologicalAnalysis = typeof psychAnalysis === 'string' 
              ? psychAnalysis 
              : JSON.stringify(psychAnalysis, null, 2);
          }
        } catch (e) {
          console.error("Failed to analyze psychological triggers", e);
        }
        
        commitNormalizedResult(newResult, currentRunId);
        stopLoading();
        clearTimeout(takingLongTimeout);
        return;
      }

      if (currentAnalysisMode !== 'guided-short') {
        let textInput = description;
        if ((currentAnalysisMode === 'estimate' || currentAnalysisMode === 'anti-ai-slop') && estimateInputType === 'prompt') {
          textInput = `PROMPT ORIGINALE DEL VIDEO DA ANALIZZARE:\n${originalPrompt}\n\nDESCRIZIONE AGGIUNTIVA:\n${description}`;
        }

        console.log("Inizio pipeline CNG (Content Nature Gatekeeper)...");
        
        if (videoToProcess && videoToProcess.type.startsWith('video/')) {
          setLoadingText("[3/6] CNG: Analisi fisica del movimento...");
          logger.info("[App] CNG: Starting physical nature analysis...");
          let physicalData: any = { physicalNature: 'TIMEOUT', variancePercent: null, disparity: null };
          try {
            const { calculatePhysicalNature } = await import('./utils/videoVarianceSensor');
            physicalData = await calculatePhysicalNature(videoToProcess);
            logger.info("[App] CNG: Physical nature analysis completed", physicalData);
          } catch (e: any) {
             if (e.message?.includes('CNG_PHYSICAL_TIMEOUT')) {
                 logger.warn("[App] CNG Physical timed out! Falling back to semantic-only approach.");
                 // Assicuriamo che physicalData abbia i campi a null
                 physicalData = { physicalNature: 'TIMEOUT', variancePercent: null, disparity: null };
             } else {
                 console.error("[App] CNG Physical failed:", e);
             }
          }
          
          try {
            setLoadingText("[3/6] CNG: Verifica semantica Vision...");
            logger.info("[App] CNG: Starting semantic vision check...");
            
            // To pass frames to checkContentNatureSemantics, we need them in a specific format
            // If they are already in framesForAnalysis (base64 strings from Virtual Trim), we use them
            // Otherwise we extract a small set specifically for CNG
            let cngFrames = [];
            if (framesForAnalysis && framesForAnalysis.length > 0) {
              // Sample 4 frames (start, 1/3, 2/3, end)
              const sampleCount = Math.min(framesForAnalysis.length, 4);
              const indices = Array.from({length: sampleCount}, (_, i) => Math.floor(i * (framesForAnalysis.length - 1) / (sampleCount - 1)));
              cngFrames = indices.map(idx => framesForAnalysis[idx]);
            } else {
              const { extractFrames } = await import('./utils/videoProcessor');
              cngFrames = await extractFrames(videoToProcess, 4);
            }

            // Convert base64 to parts for SDK
            const frameParts = cngFrames.map(f => ({
              inlineData: {
                data: f.split(',')[1],
                mimeType: "image/jpeg"
              }
            }));

            const semanticResult = await checkContentNatureSemantics(frameParts, apiKey, (text) => {
               setLoadingText(`[3/6] ${text}`);
               setLastProgressUpdate(Date.now());
            }, currentTrace);
            logger.info("[App] CNG: Semantic vision check completed", semanticResult);
            
            cngResult = reconcileCNG(
              physicalData.physicalNature, 
              semanticResult.nature, 
              semanticResult.contentType,
              physicalData.variancePercent, 
              physicalData.disparity
            );

            console.log("[App] CNG Final Decision:", cngResult);
            
            // Apply CNG overrides to system state
            if (cngResult.regime === 'ARC_BLIND') {
              sensorCategory = 'A'; // Maintain compatibility with existing ARC V2.1 logic
              const bypassMsg = `[CNG OVERRIDE] Nature: ${cngResult.finalNature}. Regime: ARC_BLIND. Cap: ${cngResult.capScore || 3.0}. Reason: ${cngResult.shortReason}`;
              visualOverride = bypassMsg;
              console.warn(bypassMsg);
            } else {
              sensorCategory = 'C'; // Standard video
            }

          } catch (e: any) {
            const errorMsg = e.message || String(e);
            if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED')) {
               throw e; // Bubble up fatal auth errors
            }
            console.error("[App] CNG calculation failed, falling back to standard:", e);
            sensorCategory = 'C';
          }
        }

        logger.info("[App] Calling generateVideoPrompt...", { 
          videoSize: videoToProcess?.size,
          mode: currentAnalysisMode,
          cngNature: cngResult?.finalNature
        });
        
        updatePipelineStep('generation', 'running', 'Generazione prompt e publishing kit in corso');
        
        // --- GUARDIA STRUTTURALE (CRITICA) ---
        // Allow proceeding without uploadedFileUri IF we have successfully sampled frames (Frame-Only Mode)
        if (videoToProcess && !uploadedFileUri && (!framesForAnalysis || framesForAnalysis.length === 0)) {
          logger.error("[App] Critical pipeline error: Video is present but uploadedFileUri is null/undefined and no frames extracted. Pipeline STOPPED.");
          throw new Error("UPLOAD_CRITICAL_FAILURE: L'upload del video a Google Gemini non Ã¨ andato a buon fine. Impossibile procedere senza fotogrammi.");
        }

        // res is now declared in outer scope
        try {
            // Priority: If we have frames extracted, we use them as the primary source to ensure stability as per user request.
            // We pass fileForGemini only if we don't have frames or if the file is extremely small.
            const videoSize = videoToProcess?.size || 0;
            const hasFrames = framesForAnalysis && framesForAnalysis.length > 0;
            
            // Per richiesta utente "basta caricamenti video", usiamo solo i frame se disponibili.
            const fileForGemini = hasFrames ? undefined : (videoSize > 45 * 1024 * 1024 ? undefined : videoToProcess);

            res = await generateVideoPrompt(
              fileForGemini, 
              finalMimeType, 
              textInput, 
              useBypass, 
              niche, 
              currentGenre, 
              platform,
              currentFeedbackHistory, 
              algoCuriosity, 
              videoRange, // We still pass it so the prompt knows it's a segment
              isDeepAnalysis,
              isEscalation,
              spinOffMode,
              viralBoost50k,
              currentAnalysisMode as 'generate' | 'estimate' | 'anti-ai-slop' | 'pensaci-tu',
              modelTier,
              isTrimmedForAnalysis,
              apiKey,
              musicalType,
              preferredSinger,
              pomelli,
              pensaciTuGoal,
                handleProgress,
              framesForAnalysis, // Pass extracted frames if Virtual Trim or High Density is active
              externalMarketData,
              uploadedFileUri,
              externalDataInfluence,
              visualOverride,
              currentTrace,
              audioAnchorResult
            );
        } catch (err: any) {
          const errorMessage = err.message || String(err);
          const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
          const is404Error = errorMessage.includes("FILE_NOT_FOUND_REUPLOAD_REQUIRED") || err.is404;
          const isUploadFailed = errorMessage.includes("UPLOAD_FAILED") || errorMessage.includes("UPLOAD_CRITICAL_FAILURE");
          const isTimeoutAbort = errorMessage === "TEMPORARY_TIMEOUT_ABORT";
          const isPermissionDenied = errorMessage.includes("PERMISSION_DENIED");
          
          if (isUploadFailed) {
            logger.error("[App] Upload failed permanently.");
            throw new Error("L'upload del file Ã¨ fallito dopo i tentativi. Il file potrebbe essere corrotto o troppo grande. Ricarica la pagina e riprova.");
          }

          if (isPermissionDenied) {
            logger.error("[App] Aborted operation due to missing API permissions.");
            throw new Error("Errore 403: La tua chiave API non ha i permessi necessari o Ã¨ stata bloccata da Google. Inserisci una nuova chiave valida nelle Impostazioni.");
          }

          if (isTimeoutAbort) {
             logger.error("[App] Aborted operation due to timeout.");
             throw new Error("Il sistema Ã¨ temporaneamente sovraccarico per troppe richieste o il video Ã¨ troppo pesante. Prova a ricaricare, usa la modalitÃ  'Flash', oppure carica un reel piÃ¹ breve.");
          }

          if (is404Error) {
            logger.warn("[App] 404 File Error detected. Re-uploading file and retrying analysis...");
            setLoadingText("File scaduto o non trovato. Re-invio in corso...");
            // Piccola attesa prima del re-invio
            await new Promise(r => setTimeout(r, 2000));
            
            const videoSize = videoToProcess?.size || 0;
            const fileForGemini = videoSize > 45 * 1024 * 1024 ? undefined : videoToProcess;
            
            res = await generateVideoPrompt(
              fileForGemini, 
              finalMimeType, 
              textInput, 
              useBypass, 
              niche, 
              currentGenre, 
              platform,
              currentFeedbackHistory, 
              algoCuriosity, 
              videoRange,
              isDeepAnalysis,
              isEscalation,
              spinOffMode,
              viralBoost50k,
              currentAnalysisMode as 'generate' | 'estimate' | 'anti-ai-slop' | 'pensaci-tu',
              modelTier,
              isTrimmedForAnalysis,
              apiKey,
              musicalType,
              preferredSinger,
              pomelli,
              pensaciTuGoal,
              handleProgress,
              framesForAnalysis,
              externalMarketData,
              uploadedFileUri,
              externalDataInfluence,
              visualOverride,
              currentTrace,
              audioAnchorResult
            );
          } else {
            // terminal error
            throw err;
          }
        }
        
        if (res.error) {
          throw new Error(res.error === "Generation failed" ? "Errore di connessione con l'AI. Riprova tra poco." : res.error);
        }
        
        logger.info("[App] generateVideoPrompt completed", { 
          modelUsed: res.modelUsed,
          responseTextLength: res.text?.length 
        });
        
        updatePipelineStep('generation', 'success', 'Risultato finale generato');
        updatePipelineStep('runtime-status', 'success', 'Pipeline conclusa');
        
        structuredResponse = res;
        promptText = typeof res.text === 'string' ? res.text : '';
        modelUsed = res.modelUsed;
      }
      
      let analysis = '';
      let script = promptText;
      let aiPrompts = '';
      let viralScore = '';
      let publishingKit = '';
      let runtimeTruthStatus: import('./types').RuntimeTruthStatus | undefined = undefined;
      // Attempt to use the structured service payload first.
      try {
        let parsed = structuredResponse;
        if (!parsed) {
          let jsonToParse = promptText.trim();
          if (jsonToParse.startsWith('```')) {
            jsonToParse = jsonToParse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          }

          parsed = safeParseJSON(jsonToParse);
        }

        if (!parsed) throw new Error("No parsed data");

        runtimeTruthStatus = parsed.runtimeTruthStatus;
        
        // Determine target parsing object (nested or flat)
        const p = parsed.result || (parsed.viralScore !== undefined || parsed.analysis || parsed.script || parsed.optimizedScript ? parsed : null);

        // --- STATIC CONTENT ENFORCEMENT (ARC V2.1 + CNG) ---
        if (cngResult?.evaluationMode === 'INFORMATIONAL_STATIC') {
          console.log(`[CTD] Informational Asset Detected. Escaping Video Logic.`);
          
          if (p && p.viralScore) p.viralScore = "N/A";
          if (p && p.hookRate) p.hookRate = "N/A";
          if (p && p.retention) p.retention = "N/A";
          
          if (p) {
            p.operationalDecision = "INFORMATIONAL";
            p.capScore = null;
            p.escalation = undefined;
            p.payoff = undefined;
            p.loop = undefined;

            // Assicurati che l'analisi non tenti di correggere il "video" ma consideri la natura Evento Locale
            if (p.analysis) {
               const currentAnalysisText = typeof p.analysis === 'string' ? p.analysis : JSON.stringify(p.analysis, null, 2);
               p.analysis = `**CTD (Content Type Detector) Override:** ModalitÃ  INFORMATIONAL_STATIC attivata.\nIl sistema ha rilevato un asset informativo statico (${cngResult.contentType}). La pipeline video convenzionale (Hook/Retention/Loop) Ã¨ stata disattivata, MA restano ATTIVE le regole Event Local e FOMO Engine (Access-Driven).\n\n` + currentAnalysisText;
            }
          }

        } else if (sensorCategory === 'A' || (cngResult && cngResult.regime === 'ARC_BLIND' && cngResult.evaluationMode === 'ARC_BLIND')) {
          if (p) {
            const isStrategicBypass = p.validationTrace?.strategicStrategy && p.validationTrace?.intentPreserved;
            
            const isPerformanceIntent = cngResult?.contentType === 'VIDEO_PERFORMANCE' || p.coreIntent === 'PERFORMANCE' || p.coreIntentClassification?.coreIntent === 'PERFORMANCE';
            const isViralStructurePass = p.viralStructure?.validationStatus === 'PASS';
            const hasPerformanceElements = p.viralStructure?.structuralTokens?.some((t: string) => /dialogo|lip-sync|interaction|performance/i.test(t)) || /dialogo|lip-sync|interaction|performance/i.test(p.script || "");

            if (isStrategicBypass || isPerformanceIntent || isViralStructurePass || hasPerformanceElements) {
              console.log(`[CNG ARC] Bypass Activated (Performance/ViralPass/Strategic). Preserving generated outputs.`);
            } else {
              const effectiveCap = cngResult?.capScore || 3.0;
              console.warn(`[CNG ARC] Content Blocked - Enforcing Precedence Logic. Nature: ${cngResult?.finalNature || 'A'}. Cap: ${effectiveCap}`);
              
              const staticDisclaimer = "No visual motion, no facial animation, no lip-sync, no performance inference.";
              
              // Se la matrice impone SCARTA, forzalo. Se c'Ã¨ spazio di salvataggio (es. SIMULATED_MOTION su foto eccellente), valuta se lasciarlo "MIGLIORA" a patto del cap.
              const currentOp: string = (p.operationalDecision || '').toUpperCase();
              if (cngResult?.finalNature === 'STATIC_PURE' || cngResult?.finalNature === 'STATIC_WITH_NOISE') {
                 p.operationalDecision = "SCARTA";
                 p.finalPromptVerdict = `Asset fallato. Nessun Prompt generabile.`;
              } else if (currentOp === 'GENERA') {
                 p.operationalDecision = "MIGLIORA";
              }
              const staticAnalysis = `[CONTENT ARC] ${staticDisclaimer} Contenuto classificato come ${cngResult?.finalNature || 'statico'}. Non ci sono prove di performance video reale. Limite strutturale alla viralitÃ  video e alla ritenzione dello spettatore. Decisione: SCARTA.`;
              
              const titleHint = p.pubTitleIt || p.pubTitle || "Subject";
              const staticPrompt = `Still archival portrait frame of ${titleHint}. Focus on lighting, texture, and composition. No motion, no facial animation, no lip-sync. A pure cinematic freeze-frame.`;
              
              // Force Decision Fields
              p.operationalDecision = "SCARTA";
              p.engineVerdict = "REPLACE";
              p.engineProductionWorthiness = "NO";
              
              p.viralScore = String(effectiveCap.toFixed(1));
              p.neuroScore = String(effectiveCap.toFixed(1));
              p.neuroHookRate = effectiveCap > 3 ? "3.0" : "2.0";
              p.neuroRetention = "limited by static format";
              p.neuroViralPotential = "capped by static format";
              
              // Overwrite semantic analysis
              p.analysis = staticAnalysis;
              p.neuroSpiegazioneIt = "Analisi limitata dal formato statico. Non Ã¨ possibile validare performance dinamica.";
              p.neuroSpiegazioneEn = "Analysis limited by static format. Dynamic performance cannot be validated.";
              
              // Sanitize Kit Hallucinations
              const cleanTitle = titleHint.replace(/singing|performing|playback|lip-sync|lipsync|moving|talking|parla|canta|muove/gi, "still");
              p.pubTitleIt = cleanTitle;
              p.pubTitleEn = cleanTitle;
              p.pubVideoHookIt = "RiconoscibilitÃ  iconica immediata, limite di formato: statico.";
              p.pubVideoHookEn = "Immediate iconic recognition, format limit: static.";
              p.pubDescriptionIt = "Asset statico ad uso editoriale/archivistico. Non Ã¨ un video di performance.";
              p.pubDescriptionEn = "Asset statico ad uso editoriale/archivistico. Not a performance video.";
              
              // Overwrite Prompts
              p.aiPrompts = staticPrompt;
              p.promptSora15s = staticPrompt;
              p.promptSora12s = staticPrompt;
              p.promptKling = staticPrompt;
              p.promptVeo = staticPrompt;
              p.promptCover = staticPrompt;
              p.coverPrompt = staticPrompt;
            }
          }
        }

        logger.info("[App] JSON analysis check", { 
          hasTarget: !!p,
          hasViralScore: !!p?.viralScore,
          hasOptimizedScript: !!p?.optimizedScript,
          hasScript: !!p?.script
        });
        
        // Handle the new structured FULL_VIDEO_ANALYSIS_SCHEMA
        if (p) {
          viralScore = String(p.viralScore || '0');
          
          // Fix [object Object] bug: if analysis is an object, stringify it
          if (p.analysis && typeof p.analysis === 'object') {
            analysis = JSON.stringify(p.analysis, null, 2);
          } else {
            analysis = p.analysis || p.viralScoreReason || '';
          }
          
          script = p.optimizedScript || p.script || '';
          const originalScript = p.originalScript || '';
          
          const soraPrompt15s = p.promptSora15s || p.soraPrompt15s || p.aiPrompts || '';
          const soraPrompt12s = p.promptSora12s || p.soraPrompt12s || '';
          const klingPrompt = p.promptKling || p.klingPrompt || '';
          const veoPrompt = p.promptVeo || p.veoPrompt || '';
          const coverPrompt = p.coverPrompt || p.promptCover || '';

          const parsedKit: PublishingKitData = {
            titleIt: p.pubTitleIt || p.pubTitle || p.pubTitoliHookIt?.[0] || '',
            titleEn: p.pubTitleEn || p.pubTitle || p.pubTitoliHookEn?.[0] || '',
            videoHookIt: p.pubVideoHookIt || '',
            videoHookEn: p.pubVideoHookEn || '',
            hooksIt: Array.isArray(p.pubTitoliHookIt) ? p.pubTitoliHookIt : [],
            hooksEn: Array.isArray(p.pubTitoliHookEn) ? p.pubTitoliHookEn : [],
            descriptionIt: p.pubDescriptionIt || '',
            descriptionEn: p.pubDescriptionEn || '',
            hashtagsIt: Array.isArray(p.pubHashtagsIt) ? p.pubHashtagsIt.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ') : (typeof p.pubHashtagsIt === 'string' ? p.pubHashtagsIt : ''),
            hashtagsEn: Array.isArray(p.pubHashtagsEn) ? p.pubHashtagsEn.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ') : (typeof p.pubHashtagsEn === 'string' ? p.pubHashtagsEn : ''),
            tagsIt: Array.isArray(p.pubTagsIt) ? p.pubTagsIt.join(', ') : (typeof p.pubTagsIt === 'string' ? p.pubTagsIt : ''),
            tagsEn: Array.isArray(p.pubTagsEn) ? p.pubTagsEn.join(', ') : (typeof p.pubTagsEn === 'string' ? p.pubTagsEn : ''),
            pinnedCommentIt: p.pubPinnedCommentIt || '',
            pinnedCommentEn: p.pubPinnedCommentEn || '',
            fileName: p.pubFileName || '',
            recommendedTime: p.pubRecommendedTime || '',
            musicalAnalysisIt: p.pubAudioStrategyIt || '',
            musicalAnalysisEn: p.pubAudioStrategyEn || '',
            audioMoodIt: p.pubAudioMoodIt || '',
            audioMoodEn: p.pubAudioMoodEn || '',
            coverPrompt: coverPrompt,
            validationQuestions: Array.isArray(p.validationQuestions) ? p.validationQuestions : [],
            spreadabilityScore: String(p.spreadabilityScore || '0'),
            spreadabilityReasoning: p.spreadabilityReasoning || '',
            shareTrigger: String(p.shareTrigger || '0'),
            commentPressure: String(p.commentPressure || '0'),
            relatability: String(p.relatability || '0'),
            patternBreak: String(p.patternBreak || '0'),
            neuroScore: {
              score: String(p.neuroScore || '0'),
              hookRate: String(p.neuroHookRate || '0'),
              retention: String(p.neuroRetention || '0'),
              viralPotential: String(p.neuroViralPotential || '0')
            },
            neuroExplanationIt: p.neuroSpiegazioneIt || '',
            neuroExplanationEn: p.neuroSpiegazioneEn || '',
            dopamineHits: Array.isArray(p.neuroDopamineHits) ? p.neuroDopamineHits.map((h: any) => ({
              time: h.time,
              descIt: h.descIt || h.desc || '',
              descEn: h.descEn || h.desc || ''
            })) : [],
            finalPromptVerdict: coerceDisplayText(p.finalPromptVerdict),
            altHook: p.altHook || '',
            altScene: p.altScene || '',
            altTwist: p.altTwist || '',
            humanVerdict: coerceDisplayText(p.humanVerdict),
            operationalDecision: p.operationalDecision || '',
            readyAlternative: Array.isArray(p.readyAlternative) ? p.readyAlternative : []
          };

          let publishingKitStr = `### Ã°Å¸Å¡â‚¬ PUBLISHING KIT\n\n**Titolo (IT):** ${parsedKit.titleIt}\n**Title (EN):** ${parsedKit.titleEn}\n\n**Hook (IT):** ${parsedKit.videoHookIt}\n**Hook (EN):** ${parsedKit.videoHookEn}\n\n**Descrizione (IT):** ${parsedKit.descriptionIt}\n**Description (EN):** ${parsedKit.descriptionEn}\n\n**Hashtags (IT):** ${parsedKit.hashtagsIt}\n**Hashtags (EN):** ${parsedKit.hashtagsEn}\n\n**Tags (IT):** ${parsedKit.tagsIt}\n**Tags (EN):** ${parsedKit.tagsEn}\n\n**File Name:** ${parsedKit.fileName}\n**Orario Consigliato:** ${parsedKit.recommendedTime}\n\n**Commento Fissato (IT):** ${parsedKit.pinnedCommentIt}\n**Pinned Comment (EN):** ${parsedKit.pinnedCommentEn}\n\n`;

          ensurePublishingKitCompleteness(p, parsedKit);
          const diagnosticTopLevelFields = {
            analysisRoutingMode: p.analysisRoutingMode,
            audioVerified: p.audioVerified,
            audioSource: p.audioSource,
            audioProvider: p.audioProvider,
            audioModelUsed: p.audioModelUsed,
            audioKeySource: p.audioKeySource,
            transcriptStatus: p.transcriptStatus,
            promptSafetyMode: p.promptSafetyMode,
            scriptSourceMode: p.scriptSourceMode,
            scriptConfidence: p.scriptConfidence,
            dialogueAnalysis: p.dialogueAnalysis,
            scriptFaithfulness: p.scriptFaithfulness,
            criticalExamReport: p.criticalExamReport,
            finalJudgeDecision: p.finalJudgeDecision,
            finalJudgeReasoning: p.finalJudgeReasoning,
            repairInstructions: p.repairInstructions,
            klingPrompt10s: p.klingPrompt10s,
            klingPrompt15s: p.klingPrompt15s,
            seedancePrompt15s: p.seedancePrompt15s,
            sendancePrompt15s: p.sendancePrompt15s,
            veo3Prompt8s: p.veo3Prompt8s,
            veo3ExtensionPart1Prompt8s: p.veo3ExtensionPart1Prompt8s,
            veo3ExtensionPart2Prompt8s: p.veo3ExtensionPart2Prompt8s,
            // Add Groq Creative Studio fields to diagnostic context
            sceneDNA: (structuredResponse as any)?.sceneDNA || p.sceneDNA,
            promptStrategy: (structuredResponse as any)?.promptStrategy || p.promptStrategy,
            promptQualityReport: (structuredResponse as any)?.promptQualityReport || p.promptQualityReport,
            publishingKitPro: (structuredResponse as any)?.publishingKitPro || p.publishingKitPro,
            coverAntiScrollPrompt: (structuredResponse as any)?.coverAntiScrollPrompt || p.coverAntiScrollPrompt,
            promptProReport: (structuredResponse as any)?.promptProReport || p.promptProReport,
          };

          newResult = {
            ...structuredResponse, // Inherit all fields from the original generation response (includes Groq outputs)
            analysis: `VIRAL SCORE\n${viralScore}\n\n${analysis}`,
            sourceType: p.sourceType || '',
            script,
            originalScript,
            visibleSurfaceElements: p.visibleSurfaceElements,
            semanticMentions: p.semanticMentions,
            physicsWhitelist: p.physicsWhitelist,
            promptInventory: p.promptInventory,
            viralAudit: p.viralAudit,
            validationTrace: p.validationTrace,
            sourceAnchor: p.sourceAnchor,
            eventQualitySelector: p.eventQualitySelector,
            aiPrompts: coerceDisplayText(p.aiPrompts) || soraPrompt15s || soraPrompt12s || klingPrompt || veoPrompt || '',
            soraPrompt12s: soraPrompt12s,
            klingPrompt10s: coerceDisplayText(p.klingPrompt10s) || coerceDisplayText(p['prompt_kling_10s']) || klingPrompt || '',
            klingPrompt: klingPrompt,
            veoPrompt: veoPrompt,
            optimizedPrompt: p.optimizedPrompt,
            publishingKit: publishingKitStr.trim(),
            parsedKit,
            modelUsed: modelUsed as 'pro' | 'flash',
            viralScore,
            analysisMode: analysisMode as any,
            searchAnalysis: p.searchAnalysis || '',
            promptNotes: p.promptNotes || '',
            validationQuestions: Array.isArray(p.validationQuestions) ? p.validationQuestions : [],
            externalMarketData: externalMarketData,
            coverPrompt: coverPrompt,
            spreadabilityScore: String(parsedKit.spreadabilityScore || p.spreadabilityScore || '0'),
            spreadabilityReasoning: p.spreadabilityReasoning || '',
            shareTrigger: String(p.shareTrigger || '0'),
            commentPressure: String(p.commentPressure || '0'),
            relatability: String(p.relatability || '0'),
            patternBreak: String(p.patternBreak || '0'),
            finalPromptVerdict: coerceDisplayText(parsedKit.finalPromptVerdict || p.finalPromptVerdict),
            altHook: p.altHook || '',
            altScene: p.altScene || '',
            altTwist: p.altTwist || '',
            humanVerdict: coerceDisplayText(parsedKit.humanVerdict || p.humanVerdict),
            operationalDecision: parsedKit.operationalDecision || p.operationalDecision || '',
            readyAlternative: Array.isArray(p.readyAlternative) ? p.readyAlternative : []
          } as ResultData & typeof diagnosticTopLevelFields;

          if (runtimeTruthStatus) {
            newResult.runtimeTruthStatus = runtimeTruthStatus;
          }

          const normalizedResult = commitNormalizedResult(newResult, currentRunId);
          if (!normalizedResult) return;
          
          // Populate editable states
          setEditableScript(script);
          resetPrompts(soraPrompt15s || '');
          resetSora12s(normalizedResult.lockedPromptTabs?.optimized?.prompt || soraPrompt12s || '');
          resetKling10s(normalizedResult.lockedPromptTabs?.kling?.prompt || normalizedResult.klingPrompt10s || '');
          resetKling15s(normalizedResult.lockedPromptTabs?.kling?.prompt || normalizedResult.klingPrompt15s || normalizedResult.klingPrompt || '');
          resetSeedance15s(normalizedResult.lockedPromptTabs?.seedance?.prompt || normalizedResult.seedancePrompt15s || normalizedResult.sendancePrompt15s || '');
          resetKling(normalizedResult.klingPrompt || klingPrompt || '');
          resetVeo3Prompt8s(normalizedResult.lockedPromptTabs?.veo3?.prompt || normalizedResult.veo3Prompt8s || normalizedResult.veoPrompt || '');
          resetVeo3ExtensionPart1(normalizedResult.veo3ExtensionPart1Prompt8s || '');
          resetVeo3ExtensionPart2(normalizedResult.veo3ExtensionPart2Prompt8s || '');
          resetVeo(normalizedResult.veoPrompt || veoPrompt || '');

          const preferredPromptSelection = getPreferredPromptSelection(newResult);
          setActivePromptFamily(preferredPromptSelection.family);
          setActivePromptVariant(preferredPromptSelection.variant);

          logger.info("[App] Structured JSON parsing successful and states updated");
          return;
        }

        // Handle old JSON format if any
        if (parsed.result) {
          if (parsed.result.analysis && typeof parsed.result.analysis === 'object') {
            analysis = JSON.stringify(parsed.result.analysis, null, 2);
          } else {
            analysis = parsed.result.analysis || '';
          }
          
          if (typeof parsed.result.script === 'string') {
            try {
              const parsedScript = safeParseJSON(parsed.result.script);
              script = JSON.stringify(parsedScript, null, 2);
            } catch (e) {
              script = parsed.result.script;
            }
          } else if (parsed.result.script) {
            script = JSON.stringify(parsed.result.script, null, 2);
          }
        }
      } catch (e) {
        logger.info("[App] JSON parsing failed or not applicable, falling back to regex", { error: e });
      }

      // Parsing logic for text format
      logger.info("[App] Starting parsing logic...", { responseLength: promptText.length });
      
      const extractTag = (text: string, tag: string) => {
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
      };

      logger.info("[App] Extracting XML tags...");
      let viralScoreMatchStr = extractTag(promptText, 'viral_score');
      let analysisMatchStr = extractTag(promptText, 'analysis');
      let dangerousWordsMatchStr = extractTag(promptText, 'dangerous_words');
      let originalScriptMatchStr = extractTag(promptText, 'original_script');
      let scriptMatchStr = extractTag(promptText, 'optimized_script') || extractTag(promptText, 'director_script');
      let soraPromptMatchStr = extractTag(promptText, 'prompt_sora_15s') || extractTag(promptText, 'sora_prompt_15s');
      let soraPrompt12sMatchStrRaw = extractTag(promptText, 'prompt_sora_12s') || extractTag(promptText, 'sora_prompt_12s');
      let klingPromptMatchStr = extractTag(promptText, 'prompt_kling') || extractTag(promptText, 'kling_prompt');
      let veoPromptMatchStr = extractTag(promptText, 'prompt_veo') || extractTag(promptText, 'veo_prompt');
      let publishingKitMatchStr = extractTag(promptText, 'publishing_kit');
      let coverGeneratorMatchStr = extractTag(promptText, 'cover_generator');
      let antiBoredomScoreMatchStr = extractTag(promptText, 'anti_boredom_score');
      let neuroScoreMatchStr = extractTag(promptText, 'neuro_score');
      let searchAnalysisMatchStr = extractTag(promptText, 'search_analysis');
      let referenceVideoAnalysisMatchStr = extractTag(promptText, 'reference_video_analysis');
      let conscienceExamMatchStr = extractTag(promptText, 'conscience_exam');
      let trendHunterReportMatchStr = extractTag(promptText, 'trend_hunter_report');
      let audioAnalysisMatchStr = extractTag(promptText, 'audio_analysis');
      let researchConsiderationsMatchStr = extractTag(promptText, 'research_considerations');
      let audioScriptMatchStr = extractTag(promptText, 'audio_script');
      let technicalVerificationMatchStr = extractTag(promptText, 'technical_verification');
      let promptNotesMatchStr = extractTag(promptText, 'prompt_notes');

      logger.info("[App] Starting fallback regex parsing...");
      // Fallback to old regexes if XML tags not found
      if (!viralScoreMatchStr) {
        logger.info("[App] Parsing viralScore fallback...");
        const m = promptText?.match(/(?:===|\*\*===|###|\*\*)\s*(?:VIRAL SCORE|PUNTEGGIO VIRALE)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) viralScoreMatchStr = m[1].trim();
      }
      if (!analysisMatchStr) {
        logger.info("[App] Parsing analysis fallback...");
        const m = promptText?.match(/(?:===|\*\*===|###|\*\*)\s*(?:ANALYSIS|ANALISI STRATEGICA)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) analysisMatchStr = m[1].trim();
      }
      if (!dangerousWordsMatchStr) {
        logger.info("[App] Parsing dangerousWords fallback...");
        const m = promptText?.match(/(?:===|\*\*===|###|\*\*)\s*(?:DANGEROUS WORDS|PAROLE PERICOLOSE)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) dangerousWordsMatchStr = m[1].trim();
      }
      if (!scriptMatchStr) {
        logger.info("[App] Parsing script fallback...");
        const m = promptText?.match(/(?:===|\*\*===|###|\*\*)\s*(?:DIRECTOR\s+)?SCRIPT(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) scriptMatchStr = m[1].trim();
      }
      if (!originalScriptMatchStr) {
        logger.info("[App] Parsing originalScript fallback...");
        const m = promptText?.match(/(?:===|\*\*===|###|\*\*)\s*(?:ORIGINAL\s+)?SCRIPT(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) originalScriptMatchStr = m[1].trim();
      }
      
      logger.info("[App] Parsing Sora 15s fallback...");
      let soraPrompt15sMatchStr = soraPromptMatchStr;
      if (!soraPrompt15sMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT SORA 2 \(15s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) soraPrompt15sMatchStr = m[1].trim();
      }
      soraPrompt15sMatchStr = sanitizePrompt(soraPrompt15sMatchStr || '');

      logger.info("[App] Parsing Sora 12s fallback...");
      let soraPrompt12sMatchStr = soraPrompt12sMatchStrRaw;
      if (!soraPrompt12sMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT SORA 2 \(12s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) soraPrompt12sMatchStr = m[1].trim();
      }
      soraPrompt12sMatchStr = sanitizePrompt(soraPrompt12sMatchStr || '');

      logger.info("[App] Parsing Kling fallback...");
      if (!klingPromptMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT KLING(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) klingPromptMatchStr = m[1].trim();
      }
      klingPromptMatchStr = sanitizePrompt(klingPromptMatchStr || '');

      logger.info("[App] Parsing Veo fallback...");
      if (!veoPromptMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT VEO(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) veoPromptMatchStr = m[1].trim();
      }
      veoPromptMatchStr = sanitizePrompt(veoPromptMatchStr || '');

      
      logger.info("[App] Parsing Publishing Kit fallback...");
      if (!publishingKitMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*(?:PUBLISHING KIT|KIT DI PUBBLICAZIONE|PACCHETTO DI PUBBLICAZIONE)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) publishingKitMatchStr = m[1].trim();
      }
      
      logger.info("[App] Parsing Cover Generator fallback...");
      if (!coverGeneratorMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*(?:COVER GENERATOR|GENERATORE COPERTINA|COVER PROMPT|COVER)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) coverGeneratorMatchStr = m[1].trim();
      }
      
      logger.info("[App] Parsing Anti-Boredom Score fallback...");
      if (!antiBoredomScoreMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*(?:ANTI-BOREDOM SCORE|PUNTEGGIO ANTI-NOIA)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) antiBoredomScoreMatchStr = m[1].trim();
      }
      
      logger.info("[App] Parsing Neuro Score fallback...");
      if (!neuroScoreMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*(?:NEURO SCORE|PUNTEGGIO NEURO)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) neuroScoreMatchStr = m[1].trim();
      }
      
      if (!analysis && analysisMatchStr) analysis = analysisMatchStr;
      if ((!script || script === promptText) && scriptMatchStr) script = scriptMatchStr;
      const originalScript = originalScriptMatchStr || '';
      
      const soraPromptMatch = (soraPrompt15sMatchStr || soraPrompt12sMatchStr) ? [null, soraPrompt15sMatchStr || soraPrompt12sMatchStr] : null;
      const klingPromptMatch = klingPromptMatchStr ? [null, klingPromptMatchStr] : null;
      const veoPromptMatch = veoPromptMatchStr ? [null, veoPromptMatchStr] : null;
      const veoExtensionMatch = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT VEO 3 EXTENSION \(16s TOTAL\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
      
      let soraPart1_15s = extractTag(promptText, 'prompt_sora_15s_1');
      if (!soraPart1_15s) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT SORA 2 PART 1 \(15s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) soraPart1_15s = m[1].trim();
      }
      const soraPart1Text = sanitizePrompt(soraPart1_15s || '');

      let soraPart1_12s = extractTag(promptText, 'prompt_sora_12s_1');
      if (!soraPart1_12s) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT SORA 2 PART 1 \(12s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) soraPart1_12s = m[1].trim();
      }
      const soraPart1Text12s = sanitizePrompt(soraPart1_12s || '');

      let soraPart2_15s = extractTag(promptText, 'prompt_sora_15s_2');
      if (!soraPart2_15s) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT SORA 2 PART 2 \(15s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) soraPart2_15s = m[1].trim();
      }
      const soraPart2Text = sanitizePrompt(soraPart2_15s || '');

      let soraPart2_12s = extractTag(promptText, 'prompt_sora_12s_2');
      if (!soraPart2_12s) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT SORA 2 PART 2 \(12s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) soraPart2_12s = m[1].trim();
      }
      const soraPart2Text12s = sanitizePrompt(soraPart2_12s || '');

      let klingPart1_tag = extractTag(promptText, 'prompt_kling_1');
      if (!klingPart1_tag) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT KLING 3\.0 PART 1 \(15s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) klingPart1_tag = m[1].trim();
      }
      const klingPart1Text = sanitizePrompt(klingPart1_tag || '');

      let klingPart2_tag = extractTag(promptText, 'prompt_kling_2');
      if (!klingPart2_tag) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT KLING 3\.0 PART 2 \(15s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) klingPart2_tag = m[1].trim();
      }
      const klingPart2Text = sanitizePrompt(klingPart2_tag || '');

      let veoPart1_tag = extractTag(promptText, 'prompt_veo_1');
      if (!veoPart1_tag) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT VEO 3 PART 1 \(8s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) veoPart1_tag = m[1].trim();
      }
      const veoPart1Text = sanitizePrompt(veoPart1_tag || '');

      let veoPart2_tag = extractTag(promptText, 'prompt_veo_2');
      if (!veoPart2_tag) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*PROMPT VEO 3 PART 2 \(8s\)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) veoPart2_tag = m[1].trim();
      }
      const veoPart2Text = sanitizePrompt(veoPart2_tag || '');
      
      conscienceExamMatchStr = extractTag(promptText, 'conscience_exam');
      trendHunterReportMatchStr = extractTag(promptText, 'trend_hunter_report');

      if (!conscienceExamMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*(?:ESAME DI COSCIENZA|CONSCIENCE EXAM)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) conscienceExamMatchStr = m[1].trim();
      }
      if (!trendHunterReportMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*(?:TREND HUNTER REPORT|REPORT TREND)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) trendHunterReportMatchStr = m[1].trim();
      }
      if (!promptNotesMatchStr) {
        const m = promptText.match(/(?:===|\*\*===|###|\*\*)\s*(?:PROMPT NOTES|NOTE PROMPT|SPIEGAZIONI)(?:[^\n]*?)(?:===|\*\*===|\*\*|===|#+)?(.*?)(?=\n\s*(?:===|\*\*===|###|\*\*|<[a-z_]+>)|$)/is);
        if (m) promptNotesMatchStr = m[1].trim();
      }
      
      // New sections
      const publishingKitMatch = publishingKitMatchStr ? [null, publishingKitMatchStr] : null;
      const coverGeneratorMatch = coverGeneratorMatchStr ? [null, coverGeneratorMatchStr] : null;
      const antiBoredomScoreMatch = antiBoredomScoreMatchStr ? [null, antiBoredomScoreMatchStr] : null;
      const neuroScoreMatch = neuroScoreMatchStr ? [null, neuroScoreMatchStr] : null;
      
      const parsedKit: PublishingKitData = {};
      if (publishingKitMatch) {
        // Strip out markdown bold/italic asterisks to make regex matching robust
        const content = publishingKitMatch[1].trim().replace(/\*\*/g, '');
        
        const extractField = (text: string, fieldNames: string[]) => {
          const namesPattern = fieldNames.join('|');
          // Try to find IT: or EN: markers within the field content first
          const itMatch = text.match(new RegExp(`(?:${namesPattern})\\s*:\\s*.*?IT\\s*:\\s*(.*?)(?:\n|EN\\s*:|$)`, 'is'));
          const enMatch = text.match(new RegExp(`(?:${namesPattern})\\s*:\\s*.*?EN\\s*:\\s*(.*?)(?:\n|IT\\s*:|$)`, 'is'));
          
          if (itMatch || enMatch) {
            return { it: itMatch?.[1]?.trim(), en: enMatch?.[1]?.trim() };
          }

          const regex = new RegExp(`(?:[-*]\\s*)?(?:${namesPattern})\\s*:\\s*(.*)`, 'i');
          const val = text.match(regex)?.[1]?.trim();
          return { it: val, en: val };
        };

        parsedKit.titleIt = content.match(/IT\s*:\s*(.*?)(?:\n|EN\s*:|$)/i)?.[1]?.trim();
        parsedKit.titleEn = content.match(/EN\s*:\s*(.*?)(?:\n|###|$)/i)?.[1]?.trim();
        
        // Extract from Publishing Kit structure
        const titlesMatch = content.match(/### (?:Titles|Titoli).*?\n(.*?)(?:\n###|$)/is);
        if (titlesMatch) {
          const tContent = titlesMatch[1];
          const extracted = extractField(tContent, ['IT', 'Titolo IT', 'Titolo', 'Title', 'Titles']);
          parsedKit.titleIt = extracted.it;
          parsedKit.titleEn = extracted.en;
          
          // Fallback if IT/EN markers are missing but there is text
          if (!parsedKit.titleIt && tContent.trim().length > 0 && !tContent.includes(':')) {
            parsedKit.titleIt = tContent.trim().split('\n')[0];
          }
        }

        const videoHookMatch = content.match(/### (?:Video Hook|Hook Video).*?\n(.*?)(?:\n###|$)/is);
        if (videoHookMatch) {
          const extracted = extractField(videoHookMatch[1], ['IT', 'Video Hook', 'Hook Video']);
          parsedKit.videoHookIt = extracted.it;
          parsedKit.videoHookEn = extracted.en;
        }

        const hooksMatch = content.match(/### (?:Hooks|Ganci).*?\n(.*?)(?:\n###|$)/is);
        if (hooksMatch) {
          const hContent = hooksMatch[1];
          const itPart = hContent.match(/IT\s*:\s*(.*?)(?:\nEN\s*:|$)/is)?.[1] || hContent;
          const enPart = hContent.match(/EN\s*:\s*(.*?)$/is)?.[1];
          
          const splitHooks = (text: string) => {
            return text
              .split(/\n|,\s*\d\.\s*|\d\.\s*|[-*Ã¢â‚¬Â¢]\s*/)
              .map(h => h.trim())
              .filter(h => h.length > 3 && !h.toLowerCase().startsWith('it:') && !h.toLowerCase().startsWith('en:'));
          };

          parsedKit.hooksIt = splitHooks(itPart);
          if (enPart) parsedKit.hooksEn = splitHooks(enPart);
        }

        const metaMatch = content.match(/### (?:Meta|Metadati|Metadata).*?\n(.*?)(?:\n###|$)/is);
        if (metaMatch) {
          const mContent = metaMatch[1];
          const desc = extractField(mContent, ['Descrizione IT', 'Descrizione', 'Description']);
          parsedKit.descriptionIt = desc.it;
          parsedKit.descriptionEn = desc.en;

          const hashtags = extractField(mContent, ['Hashtags IT', 'Hashtags']);
          parsedKit.hashtagsIt = hashtags.it;
          parsedKit.hashtagsEn = hashtags.en;

          const tags = extractField(mContent, ['Tags IT', 'Tags']);
          parsedKit.tagsIt = tags.it;
          parsedKit.tagsEn = tags.en;

          const pinned = extractField(mContent, ['Commento Pinnato IT', 'Commento Pinnato', 'Pinned Comment']);
          parsedKit.pinnedCommentIt = pinned.it;
          parsedKit.pinnedCommentEn = pinned.en;

          parsedKit.fileName = extractField(mContent, ['File Name', 'Nome File', 'Nome File \/ File Name']).it;
          parsedKit.recommendedTime = extractField(mContent, ['Recommended Time', 'Orario Consigliato', 'Orario Consigliato \/ Recommended Time']).it;
        }

        const audioMusicMatch = content.match(/### (?:Audio & Music|Audio & Musica|Audio Strategy|Strategia Audio).*?\n(.*?)(?:\n###|$)/is);
        if (audioMusicMatch) {
          const aContent = audioMusicMatch[1];
          const mood = extractField(aContent, ['Umore Audio IT', 'Umore Audio', 'Mood IT', 'Mood', 'Audio Mood']);
          parsedKit.audioMoodIt = mood.it;
          parsedKit.audioMoodEn = mood.en;
          
          const analysisItMatch = aContent.match(/[-*]\s*(?:Analisi Musicale IT|Analisi Musicale|Audio Strategy IT|Strategia Audio)\s*:\s*(.*?)(?:\n[-*]|EN\s*:|$)/is);
          const analysisEnMatch = aContent.match(/[-*]\s*(?:Musical Analysis EN|Musical Analysis|Audio Strategy EN)\s*:\s*(.*?)(?:\n[-*]|IT\s*:|$)/is);
          
          if (analysisItMatch) parsedKit.musicalAnalysisIt = analysisItMatch[1].trim();
          if (analysisEnMatch) parsedKit.musicalAnalysisEn = analysisEnMatch[1].trim();
          
          if (!parsedKit.musicalAnalysisEn && parsedKit.musicalAnalysisIt) {
             // Try to find EN: within the IT analysis if they are combined
             const innerEn = parsedKit.musicalAnalysisIt.match(/EN\s*:\s*(.*)/is);
             if (innerEn) {
               parsedKit.musicalAnalysisEn = innerEn[1].trim();
               parsedKit.musicalAnalysisIt = parsedKit.musicalAnalysisIt.split(/EN\s*:/i)[0].trim();
             }
          }
        }

        // Fallback for flat format (no ### sections)
        if (!titlesMatch && !metaMatch && !audioMusicMatch) {
          const flatExtract = (text: string, fieldNames: string[]) => {
            const namesPattern = fieldNames.join('|');
            const regex = new RegExp(`(?:^|\\n)(?:[-*]\\s*)?(?:${namesPattern})\\s*:\\s*(.*?)(?=\\n(?:[-*]\\s*)?(?:[A-Z][A-Z\\s]+):|$)`, 'is');
            return text.match(regex)?.[1]?.trim();
          };
          
          if (!parsedKit.titleIt) parsedKit.titleIt = flatExtract(content, ['TITOLO', 'Titolo', 'TITLE', 'Title']);
          if (!parsedKit.descriptionIt) parsedKit.descriptionIt = flatExtract(content, ['CAPTION', 'Caption', 'DESCRIZIONE', 'Descrizione']);
          if (!parsedKit.recommendedTime) parsedKit.recommendedTime = flatExtract(content, ['TIMING', 'Timing', 'ORARIO', 'Orario']);
          if (!parsedKit.musicalAnalysisIt) parsedKit.musicalAnalysisIt = flatExtract(content, ['SOUND DESIGN', 'Sound Design', 'MUSICA', 'Musica', 'AUDIO', 'Audio']);
          
          // Extract hashtags from caption if not explicitly provided
          if (!parsedKit.hashtagsIt && parsedKit.descriptionIt) {
            const hashtags = parsedKit.descriptionIt.match(/#[\w]+/g);
            if (hashtags) {
              parsedKit.hashtagsIt = hashtags.join(' ');
            }
          }
        }
      }

      if (coverGeneratorMatch) {
        console.log("COVER GENERATOR MATCH:", coverGeneratorMatch[1]);
        let prompt = coverGeneratorMatch[1].match(/(?:-\s*)?(?:Cover Prompt|Prompt Copertina):\s*(.*)/is)?.[1]?.trim();
        if (!prompt) {
          // Fallback: take everything after Aspect Ratio
          prompt = coverGeneratorMatch[1].replace(/(?:-\s*)?Aspect Ratio:\s*.*?\n/i, '').trim();
        }
        console.log("EXTRACTED COVER PROMPT:", prompt);
        parsedKit.coverPrompt = prompt;
      }

      if (antiBoredomScoreMatch) {
        parsedKit.antiBoredomScore = antiBoredomScoreMatch[1].match(/- Score:\s*(.*)/)?.[1]?.trim();
      }

      if (neuroScoreMatch) {
        const content = neuroScoreMatch[1].trim();
        parsedKit.neuroScore = content.match(/[-*]\s*(?:Score|Punteggio|Neuro Score)\s*:\s*(.*)/i)?.[1]?.trim();
        parsedKit.neuroExplanationIt = content.match(/[-*]\s*(?:Spiegazione IT|Spiegazione|Explanation IT)\s*:\s*(.*)/i)?.[1]?.trim();
        parsedKit.neuroExplanationEn = content.match(/[-*]\s*(?:Explanation EN|Explanation)\s*:\s*(.*)/i)?.[1]?.trim();
        
        // Extract specific metrics if present
        const hookRate = content.match(/[-*]\s*(?:Hook Rate|Tasso di Hook)\s*:\s*(.*)/i)?.[1]?.trim();
        const retention = content.match(/[-*]\s*(?:Retention|Ritenzione)\s*:\s*(.*)/i)?.[1]?.trim();
        if (hookRate || retention) {
          const metrics = [];
          if (hookRate) metrics.push(`Hook: ${hookRate}`);
          if (retention) metrics.push(`Ret: ${retention}`);
          parsedKit.neuroScore = coerceDisplayText(parsedKit.neuroScore);
          if (parsedKit.neuroScore) {
             if (!parsedKit.neuroScore.includes('Hook')) {
               parsedKit.neuroScore = `${parsedKit.neuroScore} (${metrics.join(' | ')})`;
             }
          } else {
            parsedKit.neuroScore = metrics.join(' | ');
          }
        }

        const dopamineHitsMatch = content.match(/(?:Dopamine Hits|Colpi di Dopamina):\n(.*?)(?:\n###|$)/is);
        if (dopamineHitsMatch) {
          parsedKit.dopamineHits = dopamineHitsMatch[1].split('\n')
            .map(line => {
              const m = line.match(/[-*]\s*\[(.*?)\]\s*(?:IT|ITA)?\s*:\s*(.*?)\s*\|\s*(?:EN|ENG)\s*:\s*(.*)/i);
              return m ? { time: m[1], descIt: m[2], descEn: m[3] } : null;
            })
            .filter((h): h is { time: string; descIt: string; descEn: string } => h !== null);
        }
      }

      if (viralScoreMatchStr) viralScore = viralScoreMatchStr.trim();
      
      const conscienceExam = conscienceExamMatchStr || '';
      const trendHunterReport = trendHunterReportMatchStr || '';
      const searchAnalysis = searchAnalysisMatchStr || '';
      const voiceoverScript = audioScriptMatchStr || '';
      const technicalVerification = technicalVerificationMatchStr || '';
      
      let referenceVideoAnalysis: any = null;
      if (referenceVideoAnalysisMatchStr) {
        const considerations = referenceVideoAnalysisMatchStr.split(/https?:\/\/[^\s]+/)[0].trim();
        const links = referenceVideoAnalysisMatchStr.match(/https?:\/\/[^\s]+/g) || [];
        referenceVideoAnalysis = { considerations, links };
      }
      
      console.log("EXTRACTED CONSCIENCE EXAM:", conscienceExam);
      console.log("EXTRACTED TREND HUNTER REPORT:", trendHunterReport);
      console.log("EXTRACTED SEARCH ANALYSIS:", searchAnalysis);
      console.log("EXTRACTED VOICEOVER SCRIPT:", voiceoverScript);
      
      if (publishingKitMatch) {
        publishingKit += `### Ã°Å¸Å¡â‚¬ PUBLISHING KIT\n${publishingKitMatch[1].trim()}\n\n`;
      }
      if (coverGeneratorMatch) {
        publishingKit += `### Ã°Å¸â€“Â¼Ã¯Â¸Â COVER GENERATOR\n${coverGeneratorMatch[1].trim()}\n\n`;
      }
      if (antiBoredomScoreMatch) {
        publishingKit += `### Ã°Å¸Â¥Â± ANTI-BOREDOM SCORE\n${antiBoredomScoreMatch[1].trim()}\n\n`;
      }
      if (neuroScoreMatch) {
        publishingKit += `### Ã°Å¸Â§Â  NEURO SCORE\n${neuroScoreMatch[1].trim()}\n\n`;
      }
      if (conscienceExam) {
        publishingKit += `### Ã°Å¸â€ºÂ¡Ã¯Â¸Â CONSCIENCE EXAM\n${conscienceExam}\n\n`;
      }
      if (trendHunterReport) {
        publishingKit += `### Ã°Å¸â€œË† TREND HUNTER REPORT\n${trendHunterReport}\n\n`;
      }
      publishingKit = publishingKit.trim();
      
      let extractedDangerousWords: string[] = [];
      if (dangerousWordsMatchStr) {
        const wordsStr = dangerousWordsMatchStr.trim();
        if (wordsStr.toLowerCase() !== 'nessuna' && wordsStr.toLowerCase() !== 'none') {
          // Handle both comma-separated and newline/bullet-point separated lists
          extractedDangerousWords = wordsStr
            .split(/,|\n/)
            .map(w => w.replace(/^[-*Ã¢â‚¬Â¢\s]+/, '').trim())
            .filter(w => w.length > 2 && w.toLowerCase() !== 'nessuna' && w.toLowerCase() !== 'none');
        }
      }
      
      let klingPrompt: string | undefined;
      let veoPrompt: string | undefined;
      let klingPrompt1: string | undefined;
      let klingPrompt2: string | undefined;
      let veoPrompt1: string | undefined;
      let veoPrompt2: string | undefined;
      
      if (soraPart1Text && soraPart2Text) {
        aiPrompts = `PART 1:\n${soraPart1Text}\n\nPART 2:\n${soraPart2Text}`;
        klingPrompt1 = klingPart1Text;
        klingPrompt2 = klingPart2Text;
        veoPrompt1 = veoPart1Text;
        veoPrompt2 = veoPart2Text;
      } else if (soraPart1Text) {
        aiPrompts = `PART 1:\n${soraPart1Text}`;
        klingPrompt1 = klingPart1Text;
        veoPrompt1 = veoPart1Text;
      } else if (soraPart2Text) {
        aiPrompts = `PART 2:\n${soraPart2Text}`;
        klingPrompt2 = klingPart2Text;
        veoPrompt2 = veoPart2Text;
      } else if (soraPromptMatch || klingPromptMatch || veoPromptMatch) {
        aiPrompts = soraPrompt15sMatchStr || soraPrompt12sMatchStr || klingPromptMatchStr || veoPromptMatchStr || '';
        klingPrompt = klingPromptMatchStr || '';
        veoPrompt = veoPromptMatchStr || '';
        if (veoExtensionMatch) {
          veoPrompt += `\n\n=== VEO 3 EXTENSION (16s TOTAL) ===\n${sanitizePrompt(veoExtensionMatch[1].trim())}`;
        }
      } else {
        // Fallback for older formats
        if (promptText.includes('===AI VIDEO PROMPT===')) {
          const parts = promptText.split('===AI VIDEO PROMPT===');
          aiPrompts = parts[1].split(/\n\s*(?:===|\*\*===)/)[0].trim();
        } else if (promptText.includes('===AI VIDEO PROMPTS===')) {
          const parts = promptText.split('===AI VIDEO PROMPTS===');
          aiPrompts = parts[1].split(/\n\s*(?:===|\*\*===)/)[0].trim();
        }
        // Clean up empty part markers if they were captured
        aiPrompts = aiPrompts.replace(/(?:===|\*\*===)\s*AI VIDEO PROMPT PART 1\s*(?:===|\*\*===|\*\*|===)?\s*/gi, '');
        aiPrompts = aiPrompts.replace(/(?:===|\*\*===)\s*AI VIDEO PROMPT PART 2\s*(?:===|\*\*===|\*\*|===)?\s*/gi, '');
        aiPrompts = aiPrompts.trim();
      }

      if (viralScore) {
        analysis = `VIRAL SCORE\n${viralScore}\n\n${analysis}`;
      }

      let optimizedPrompt: string | undefined;
      const optimizedMatch = promptText.match(/(?:===|\*\*===)\s*PROMPT OTTIMIZZATO\s*(?:\(MAX 2000 CARATTERI\)|\(SORA 2: 5000 CARATTERI\))?\s*(?:===|\*\*)?(.*?)(?=\n(?:===|\*\*===)|$)/is);
      if (optimizedMatch) {
        optimizedPrompt = sanitizePrompt(optimizedMatch[1].trim());
      }

      const lumaInstructions = isEscalation 
        ? "I prompt sono due. Controlla i prompt e se serve l'immagine di riferimento. Devi farmi i due video con il prompt ottimizzato universale e devi darmi il video finale di 24 secondi. I tempi algoritmici sono giÃ  stati ottimizzati nei prompt."
        : "Ho un prompt ottimizzato universale per fare un video di 15 secondi con audio sincronizzato. Mi serve solo il video, non fare immagini, fai il video in una unica soluzione. I tempi algoritmici sono giÃ  stati ottimizzati nel prompt.";

      const diagnosticTopLevelFields =
        structuredResponse && typeof structuredResponse === 'object'
          ? {
              analysisRoutingMode: structuredResponse.analysisRoutingMode,
              audioVerified: structuredResponse.audioVerified,
              audioSource: structuredResponse.audioSource,
              audioProvider: structuredResponse.audioProvider,
              audioModelUsed: structuredResponse.audioModelUsed,
              audioKeySource: structuredResponse.audioKeySource,
              scriptSourceMode: structuredResponse.scriptSourceMode,
              scriptConfidence: structuredResponse.scriptConfidence,
              dialogueAnalysis: structuredResponse.dialogueAnalysis,
              scriptFaithfulness: structuredResponse.scriptFaithfulness,
              criticalExamReport: structuredResponse.criticalExamReport,
              finalJudgeDecision: structuredResponse.finalJudgeDecision,
              finalJudgeReasoning: structuredResponse.finalJudgeReasoning,
              repairInstructions: structuredResponse.repairInstructions,
              klingPrompt10s: structuredResponse.klingPrompt10s,
              klingPrompt15s: structuredResponse.klingPrompt15s,
              seedancePrompt15s: structuredResponse.seedancePrompt15s,
              sendancePrompt15s: structuredResponse.sendancePrompt15s,
              veo3Prompt8s: structuredResponse.veo3Prompt8s,
              veo3ExtensionPart1Prompt8s: structuredResponse.veo3ExtensionPart1Prompt8s,
              veo3ExtensionPart2Prompt8s: structuredResponse.veo3ExtensionPart2Prompt8s,
            }
          : {};

      ensurePublishingKitCompleteness({
        viralScore,
        script,
        aiPrompts,
        soraPrompt12s: soraPrompt12sMatchStr,
        klingPrompt,
        veoPrompt,
      }, parsedKit);

      if (!publishingKit && parsedKit?.operationalDecision === 'GENERA') {
        publishingKit = `### Ã°Å¸Å¡â‚¬ PUBLISHING KIT\n\n**Titolo (IT):** ${parsedKit.titleIt || ''}\n**Title (EN):** ${parsedKit.titleEn || ''}\n\n**Hook (IT):** ${parsedKit.videoHookIt || ''}\n**Hook (EN):** ${parsedKit.videoHookEn || ''}\n\n**Descrizione (IT):** ${parsedKit.descriptionIt || ''}\n**Description (EN):** ${parsedKit.descriptionEn || ''}\n\n**Hashtags (IT):** ${parsedKit.hashtagsIt || ''}\n**Hashtags (EN):** ${parsedKit.hashtagsEn || ''}\n\n**Tags (IT):** ${parsedKit.tagsIt || ''}\n**Tags (EN):** ${parsedKit.tagsEn || ''}\n\n**File Name:** ${parsedKit.fileName || ''}\n**Orario Consigliato:** ${parsedKit.recommendedTime || ''}\n\n**Commento Fissato (IT):** ${parsedKit.pinnedCommentIt || ''}\n**Pinned Comment (EN):** ${parsedKit.pinnedCommentEn || ''}`.trim();
      }

      newResult = { 
        analysis, 
        script, 
        originalScript,
        aiPrompts, 
        soraPrompt12s: soraPrompt12sMatchStr,
        klingPrompt,
        veoPrompt,
        klingPrompt1,
        klingPrompt2,
        veoPrompt1,
        veoPrompt2,
        soraPrompt12s1: soraPart1Text12s,
        soraPrompt12s2: soraPart2Text12s,
        optimizedPrompt, 
        publishingKit: (parsedKit?.operationalDecision === 'GENERA' && !publishingKit) ? "Kit non generato correttamente." : publishingKit,
        parsedKit, 
        modelUsed: modelUsed as 'pro' | 'flash', 
        viralScore: (typeof viralScore === 'string' && viralScore !== "N/A" && viralScore !== "") ? viralScore : (result?.viralScore || "N/A"),
        analysisMode: analysisMode as any, 
        conscienceExamIt: conscienceExam,
        conscienceExamEn: '',
        audioAnalysisIt: '',
        audioAnalysisEn: '',
        researchConsiderationsIt: '',
        researchConsiderationsEn: '',
        trendHunterReport: trendHunterReport,
        searchAnalysis,
        referenceVideoAnalysis,
        voiceoverScript,
        technicalVerification,
        lumaInstructions,
        promptNotes: promptNotesMatchStr || undefined,
        externalMarketData,
        ...diagnosticTopLevelFields,
        ...audioAnchorResult
      } as ResultData & typeof diagnosticTopLevelFields & AudioAnchorResult;
      
      // After generating the main content, analyze psychological triggers if it's a generation mode
      if (['generate', 'estimate', 'anti-ai-slop', 'guided-short'].includes(analysisMode)) {
        try {
          updatePipelineStep('generation', 'running', 'Analisi dei trigger psicologici in corso...');
          console.log("Starting psychological analysis for script:", script.substring(0, 100) + "...");
          let psychAnalysis;
          try {
            psychAnalysis = await analyzePsychologicalTriggers(script, apiKey!, modelTier);
          } catch (err: any) {
            const errorMessage = err.message || String(err);
            const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
            if (isQuotaError && modelTier === 'pro') {
              logger.warn("[App] Quota exceeded for PRO model in psych analysis. Auto-switching to FLASH mode.");
              psychAnalysis = await analyzePsychologicalTriggers(script, apiKey!, 'flash');
            } else {
              throw err;
            }
          }
          console.log("Psychological analysis completed successfully.");
          newResult.psychologicalAnalysis = typeof psychAnalysis === 'string' 
            ? psychAnalysis 
            : JSON.stringify(psychAnalysis, null, 2);
          updatePipelineStep('generation', 'success', 'Analisi psicologica completata');
        } catch (e) {
          console.error("Failed to analyze psychological triggers:", e);
          newResult.psychologicalAnalysis = "Errore durante l'analisi psicologica. Riprova tra poco.";
          updatePipelineStep('generation', 'warning', 'Analisi psicologica saltata');
        }
      }

      // Final Runtime Status Check (Step 8)
      const finalMode = newResult.finalJudgeDecision === 'REJECT' || newResult.operationalDecision === 'SCARTA' ? 'BLOCKED_MODE' : 
                        (newResult.audioVerified === false ? 'DEGRADED_MODE' : 'FULL_MODE');
      
      const runtimeMsg = finalMode === 'FULL_MODE' ? 'Analisi completata correttamente' :
                         finalMode === 'DEGRADED_MODE' ? 'Analisi completata con alcune funzioni opzionali non disponibili' :
                         'Analisi non completata: manca un output critico';

      const finalTruthStatus: RuntimeTruthStatus = {
        mode: finalMode as "FULL_MODE" | "DEGRADED_MODE" | "BLOCKED_MODE",
        timestamp: new Date().toISOString(),
        details: runtimeMsg,
        severity: finalMode === 'FULL_MODE' ? 'NONE' : (finalMode === 'DEGRADED_MODE' ? 'LOW' : 'HIGH'),
        failedModules: newResult.audioVerified === false ? ['audio_anchor'] : [],
        fallbackActive: newResult.audioVerified === false,
        reliabilityImpact: newResult.audioVerified === false ? 'MEDIUM' : 'NONE',
        userMessage: runtimeMsg
      };
      
      newResult.runtimeTruthStatus = finalTruthStatus;
      const normalizedResult = normalizeFinalResultContract(newResult, { genre, platform, analysisMode, useBypass, forceTextHook, forceSubtitles });
      if (useBypass) {
        normalizedResult.promptNotes = [
          normalizedResult.promptNotes,
          "BYPASS: ATTIVO",
        ].filter(Boolean).join(" | ");
        if (typeof normalizedResult.analysis === 'string' && !normalizedResult.analysis.includes('[BYPASS: ATTIVO]')) {
          normalizedResult.analysis = `[BYPASS: ATTIVO]\n${normalizedResult.analysis}`;
        }
      }
      updatePipelineStep('runtime-status', 'success', normalizedResult.runtimeTruthStatus?.mode || finalMode, normalizedResult.runtimeTruthStatus?.userMessage || runtimeMsg);
      if (
        normalizedResult?.transcriptStatus === 'AUDIO_TRANSCRIBE_TIMEOUT' ||
        normalizedResult?.audioSource === 'GROQ_WHISPER_TIMEOUT' ||
        normalizedResult?.runtimeTruthStatus?.failedModules?.includes('GROQ_WHISPER_TRANSCRIPTION')
      ) {
        logger.warn('[AUDIO_ANCHOR_TIMEOUT_UI_RELEASED]', {
          transcriptStatus: normalizedResult?.transcriptStatus || '',
          audioSource: normalizedResult?.audioSource || '',
          userMessage: normalizedResult?.runtimeTruthStatus?.userMessage || ''
        });
      }
      setPartialProtocol(normalizedResult);

      logger.info("[UI_COMMIT_INPUT_AUDIT]", { route: "standard" });
      commitNormalizedResult(normalizedResult, currentRunId);
      setEditableScript(voiceoverScript || script);
      
      logger.info("[PROMPT_TABS_BOUND_FROM_PHASE2_RESULT]", {
          hasBest: !!normalizedResult.bestOptimizedPrompt?.prompt,
          hasSora: !!(normalizedResult.soraPrompt15s || normalizedResult.promptSora15s),
          hasSceneMaster: !!normalizedResult.sceneMasterPrompt
      });

      const bestPromptVal = normalizedResult.bestOptimizedPrompt?.prompt || normalizedResult.optimizedPrompt15s || normalizedResult.optimizedPrompt12s || normalizedResult.promptOptimized15s || normalizedResult.promptOptimized12s || normalizedResult.aiPrompts || "";
      resetPrompts(bestPromptVal);
      
      const sceneMasterVal = normalizedResult.sceneMasterPrompt || "";
      resetSceneMaster(sceneMasterVal);

      const soraPromptVal = normalizedResult.soraPrompt15s || normalizedResult.promptSora15s || normalizedResult.soraPrompt12s || normalizedResult.promptSora12s || '';
      resetSora12s(soraPromptVal);
      
      resetKling10s(normalizedResult.lockedPromptTabs?.kling?.prompt || normalizedResult.klingPrompt10s || normalizedResult.klingPrompt || '');
      resetKling15s(normalizedResult.lockedPromptTabs?.kling?.prompt || normalizedResult.klingPrompt15s || normalizedResult.klingPrompt || '');
      resetSeedance15s(normalizedResult.lockedPromptTabs?.seedance?.prompt || normalizedResult.seedancePrompt15s || normalizedResult.sendancePrompt15s || '');
      resetKling(normalizedResult.klingPrompt || klingPrompt || '');
      resetVeo3Prompt8s(normalizedResult.lockedPromptTabs?.veo3?.prompt || normalizedResult.veo3Prompt8s || normalizedResult.veoPrompt || '');
      resetVeo3Prompt8s(normalizedResult.lockedPromptTabs?.veo3?.prompt || normalizedResult.veo3Prompt8s || normalizedResult.veoPrompt || '');
      resetVeo3ExtensionPart1(normalizedResult.veo3ExtensionPart1Prompt8s || '');
      resetVeo3ExtensionPart2(normalizedResult.veo3ExtensionPart2Prompt8s || '');
      resetVeo(normalizedResult.veoPrompt || veoPrompt || '');
      resetPrompts1(soraPart1Text || '');
      resetSora12s1(soraPart1Text12s || '');
      resetKling1(klingPrompt1 || '');
      resetVeo1(veoPart1Text || '');
      resetPrompts2(soraPart2Text || '');
      resetSora12s2(soraPart2Text12s || '');
      resetKling2(klingPrompt2 || '');
      resetVeo2(veoPart2Text || '');


      // Set default tabs and durations based on what was found
      if (soraPart1Text12s && !soraPart1Text) setSoraDuration1('12s');
      else setSoraDuration1('15s');
      
      if (soraPart2Text12s && !soraPart2Text) setSoraDuration2('12s');
      else setSoraDuration2('15s');
      
      if (!soraPart1Text && !soraPart1Text12s) {
        if (klingPart1Text) setActivePromptTab1('kling');
        else if (veoPart1Text) setActivePromptTab1('veo');
        else setActivePromptTab1('sora');
      } else {
        setActivePromptTab1('sora');
      }

      if (!soraPart2Text && !soraPart2Text12s) {
        if (klingPart2Text) setActivePromptTab2('kling');
        else if (veoPart2Text) setActivePromptTab2('veo');
        else setActivePromptTab2('sora');
      } else {
        setActivePromptTab2('sora');
      }

      const preferredPromptSelection = getPreferredPromptSelection(newResult);
      setActivePromptFamily(preferredPromptSelection.family);
      setActivePromptVariant(preferredPromptSelection.variant);

      setDangerousWords(extractedDangerousWords);
      
      // Reset genre to Auto-Detect for the next analysis
      setGenre('Auto-Detect');
      
      logger.info("[App] Analysis process finished successfully");
    } catch (err: any) {
      if (externalPhase === "precheck" || externalPhase === "pre_analysis") {
         logger.info(`[YOUTUBE_MARKET_SKIPPED_REASON] reason=RUN_ABORTED_BEFORE_YOUTUBE skipStage=before_call youtubeKeyStatus=${youtubeApiKey ? 'ok' : 'missing'} queryCount=0`);
      }
      clearTimeout(takingLongTimeout);
      clearTimeout(safetyTimeout);
      const errorMessage = err.message || (err.error && err.error.message) || String(err);
      const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
      
      if (!isQuotaError) {
        console.error("[App] Generation error:", err);
      }
      
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setError("Ã¢Å¡Â Ã¯Â¸Â Connessione interrotta (WebSocket closed). Questo accade spesso se il server si riavvia o se la connessione Ã¨ instabile. Riprova tra pochi secondi, il sistema Ã¨ stato sbloccato.");
      } else if (errorMessage.startsWith("QUOTA_EXHAUSTED: ")) {
        setError(errorMessage.replace("QUOTA_EXHAUSTED: ", ""));
        setIsDeepAnalysis(false);
      } else if (errorMessage.startsWith("QUOTA_EXHAUSTED_ALL_KEYS:")) {
        setError("Analisi interrotta per esaurimento quote: tutte le chiavi API disponibili hanno finito le richieste o sono bloccate. Aggiungi una nuova chiave o attendi il reset delle quote.");
        setIsDeepAnalysis(false);
      } else if (errorMessage === "QUOTA_EXHAUSTED" || errorMessage?.includes('429') || errorMessage?.toLowerCase().includes('quota') || errorMessage?.includes('RESOURCE_EXHAUSTED')) {
        setError("LIMITE QUOTA RAGGIUNTO: Hai esaurito i token gratuiti o raggiunto il limite di richieste dell'API di Google Gemini. Attendi qualche minuto e riprova, oppure inserisci una chiave API a pagamento nelle impostazioni.");
        setIsDeepAnalysis(false); // Auto-disable to help the user
      } else if (errorMessage === "API_KEY_INVALID" || errorMessage?.includes('403') || errorMessage?.includes('PERMISSION_DENIED')) {
        setError("La tua chiave API non ha i permessi necessari o non Ã¨ valida. Controlla la tua chiave API.");
      } else if (errorMessage && (errorMessage.includes('400') || errorMessage.includes('Bad Request') || errorMessage.includes('too large'))) {
        setError("Il video o la richiesta sono troppo grandi per i server di Google. Prova a caricare un video piÃ¹ breve (sotto i 10-15 secondi) o con una risoluzione inferiore.");
      } else if (errorMessage && (errorMessage.includes('xhr error') || errorMessage.includes('out of memory') || errorMessage.includes('500') || errorMessage.includes('Internal Server Error'))) {
        setError("Il video Ã¨ troppo complesso o grande per essere elaborato dall'intelligenza artificiale. Prova a caricare un video piÃ¹ corto o con una risoluzione inferiore (massimo 20MB).");
      } else {
        setError(errorMessage || "Si Ã¨ verificato un errore durante la generazione.");
      }

      if (res) {
        commitNormalizedResult(res, currentRunId);
      } else {
        commitNormalizedResult({
          analysis: `ERRORE DI GENERAZIONE: ${errorMessage || "Si Ã¨ verificato un errore durante la generazione."}\n\nControlla il messaggio di errore in alto per dettagli. Se il problema persiste, riprova tra qualche istante o usa un video piÃ¹ breve.`,
          script: "",
          aiPrompts: "",
          analysisMode: analysisMode as any,
          viralScore: "N/A"
        }, currentRunId);
      }
    } finally {
      clearInterval(cumulativeTimer);
      clearInterval(heartbeatInterval);
      clearTimeout(safetyTimeout);
      logApiBudgetReport(`App.handleGenerate:${currentAnalysisMode}`);
      isAnalyzingRef.current = false;
      clearTimeout(takingLongTimeout);
      stopLoading();
      
      // Set terminal flag to stop polling loops
      (window as any).__VIRAL_RUN_TERMINATED = true;
      logger.info("[App] [POLLING_STOPPED_TERMINAL_STATE] Flag set in finally block.");
    }
  };

  const formatResult = (text: string) => {
    // Basic formatting to make SHOTs look nice
    const parts = text.split(/(SHOT \d+)/g);
    
    if (parts.length <= 1) return <div className="whitespace-pre-wrap text-zinc-300">{text}</div>;

    return (
      <div className="space-y-6">
        {parts.map((part, index) => {
          if (part.match(/SHOT \d+/)) {
            return (
              <h3 key={index} className="text-xl font-bold text-red-500 mt-8 mb-4 border-b border-red-500/20 pb-2 inline-block">
                {part}
              </h3>
            );
          }
          if (part.trim()) {
            // Highlight keywords
            const formattedPart = part
              .replace(/Visual:/g, '<strong class="text-zinc-100">Visual:</strong>')
              .replace(/Environment:/g, '<strong class="text-zinc-100">Environment:</strong>')
              .replace(/Camera:/g, '<strong class="text-zinc-100">Camera:</strong>')
              .replace(/Action:/g, '<strong class="text-zinc-100">Action:</strong>');
              
            return (
              <div 
                key={index} 
                className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 text-zinc-300 whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formattedPart }}
              />
            );
          }
          return null;
        })}
      </div>
    );
  };

  type PromptTabFamily = 'sora2' | 'sora' | 'sceneMaster' | 'kling' | 'seedance' | 'veo3' | 'veo3Extension';
  type PromptTabVariant = 'default' | '12s' | '10s' | '15s' | '8s' | 'part1' | 'part2';

  const getLockedPromptValue = (
    promptSource: Partial<ResultData> | null | undefined,
    family: PromptTabFamily,
    variant?: PromptTabVariant,
  ) => {
    const lockedTabs: any = promptSource?.lockedPromptTabs;
    if (!lockedTabs || lockedTabs.locked !== true) return "";
    switch (family) {
      case 'sora2':
        return typeof lockedTabs.optimized?.prompt === 'string' ? lockedTabs.optimized.prompt.trim() : "";
      case 'sora':
        if (typeof lockedTabs.sora?.prompt === 'string' && lockedTabs.sora.prompt.trim()) return lockedTabs.sora.prompt.trim();
        if (typeof promptSource?.soraPrompt15s === 'string' && promptSource.soraPrompt15s.trim()) return promptSource.soraPrompt15s.trim();
        if (typeof promptSource?.promptSora15s === 'string' && promptSource.promptSora15s.trim()) return promptSource.promptSora15s.trim();
        if (typeof promptSource?.soraPrompt12s === 'string' && promptSource.soraPrompt12s.trim()) return promptSource.soraPrompt12s.trim();
        if (typeof promptSource?.promptSora12s === 'string' && promptSource.promptSora12s.trim()) return promptSource.promptSora12s.trim();
        if (typeof promptSource?.soraPrompt === 'string' && promptSource.soraPrompt.trim()) return promptSource.soraPrompt.trim();
        return "";
      case 'sceneMaster':
        return typeof promptSource?.sceneMasterPrompt === 'string' ? promptSource.sceneMasterPrompt.trim() : "";
      case 'kling':
        return typeof lockedTabs.kling?.prompt === 'string' ? lockedTabs.kling.prompt.trim() : "";
      case 'seedance':
        return typeof lockedTabs.seedance?.prompt === 'string' ? lockedTabs.seedance.prompt.trim() : "";
      case 'veo3':
        return typeof lockedTabs.veo3?.prompt === 'string' ? lockedTabs.veo3.prompt.trim() : "";
      case 'veo3Extension':
        if (variant === 'part2' && typeof promptSource?.veo3ExtensionPart2Prompt8s === 'string' && promptSource.veo3ExtensionPart2Prompt8s.trim()) {
          return promptSource.veo3ExtensionPart2Prompt8s.trim();
        }
        if (variant === 'part1' && typeof promptSource?.veo3ExtensionPart1Prompt8s === 'string' && promptSource.veo3ExtensionPart1Prompt8s.trim()) {
          return promptSource.veo3ExtensionPart1Prompt8s.trim();
        }
        return typeof lockedTabs.veo3Extension?.prompt === 'string' ? lockedTabs.veo3Extension.prompt.trim() : "";
      default:
        return "";
    }
  };

  const stripPromptOverlayDirectives = (text: string) =>
    (text || '')
      .replace(/\s*Add a bold anti-scroll Italian hook text in the first 0\.8 seconds\.[\s\S]*?do not cover faces\.?/gi, '')
      .replace(/\s*Add a bold, readable Italian hook\/title text overlay during the first second only, designed to stop scrolling\.[\s\S]*?extra text later\.?/gi, '')
      .replace(/\s*If supported by the model, add a short Italian hook\/title text overlay during the first second only\.?/gi, '')
      .replace(/\s*Add clean, synchronized Italian subtitles only for the verified spoken lines\.[\s\S]*?invent words\.?/gi, '')
      .replace(/\s*If supported by the model, add clean Italian subtitles only for verified spoken lines\.[\s\S]*?invent words\.?/gi, '')
      .replace(/\s*Add clean burned-in Italian subtitles, synced to the spoken lines\.[\s\S]*?below the face area\.?/gi, '')
      .replace(/\s*If supported by the model, add clean burned-in Italian subtitles, synced to the spoken lines\.[\s\S]*?below the face area\.?/gi, '')
      .replace(/\s*Do not add spoken subtitles\.[\s\S]*?dialogue\.?/gi, '')
      .trim();

  const getPromptTabKey = (family: PromptTabFamily, variant?: PromptTabVariant) => {
    if (family === 'sora2') return 'optimized';
    if (family === 'veo3Extension') return variant === 'part2' ? 'veo3ExtensionPart2' : 'veo3ExtensionPart1';
    return family;
  };

  const applyPromptOverlaysForDisplay = (
    basePrompt: string,
    family: PromptTabFamily,
    variant?: PromptTabVariant,
  ) => {
    const tab = getPromptTabKey(family, variant);
    const cleanedBase = stripPromptOverlayDirectives(basePrompt);
    console.log(`[PROMPT_TAB_BASE_SELECTED] tab=${tab}`);
    let next = cleanedBase;

    if (forceTextHook) {
      const textDirective = family === 'veo3' || family === 'veo3Extension'
        ? 'Add a bold, readable Italian hook/title text overlay during the first second only, designed to stop scrolling. Keep it short, high contrast, and do not add extra text later.'
        : 'If supported by the model, add a short Italian hook/title text overlay during the first second only.';
      next = `${next} ${textDirective}`.trim();
      console.log(`[PROMPT_OVERLAY_FORCE_TEXT_APPLIED] tab=${tab}`);
    }

    if (forceSubtitles) {
      const subtitlesDirective = result?.audioVerified === true
        ? (family === 'veo3' || family === 'veo3Extension'
          ? 'Add clean, synchronized Italian subtitles only for the verified spoken lines. Keep subtitles short, readable, and timed to the speaker. Do not invent words.'
          : 'If supported by the model, add clean Italian subtitles only for verified spoken lines. Do not invent words.')
        : 'Do not add spoken subtitles. If text is needed, use only minimal visual-safe on-screen text, with no invented dialogue.';
      next = `${next} ${subtitlesDirective}`.trim();
      console.log(`[PROMPT_OVERLAY_FORCE_SUBTITLES_APPLIED] tab=${tab}`);
    }

    if (forceTextHook && forceSubtitles) {
      console.log(`[PROMPT_OVERLAY_FORCE_TEXT_AND_SUBTITLES_COMBINED] tab=${tab}`);
    }

    console.log(`[PROMPT_FINAL_DISPLAY_READY] tab=${tab} length=${next.length}`);
    return next;
  };

  const getPreferredPromptSelection = (promptSource?: Partial<ResultData> | null) => {
    if (getLockedPromptValue(promptSource, 'sora2')) return { family: 'sora2' as const, variant: '12s' as const };
    if (getLockedPromptValue(promptSource, 'kling')) return { family: 'kling' as const, variant: '15s' as const };
    if (getLockedPromptValue(promptSource, 'seedance')) return { family: 'seedance' as const, variant: '15s' as const };
    if (getLockedPromptValue(promptSource, 'veo3')) return { family: 'veo3' as const, variant: '8s' as const };
    if (getLockedPromptValue(promptSource, 'veo3Extension', 'part1') || getLockedPromptValue(promptSource, 'veo3Extension', 'part2')) {
      return { family: 'veo3Extension' as const, variant: getLockedPromptValue(promptSource, 'veo3Extension', 'part1') ? 'part1' as const : 'part2' as const };
    }
    if (promptSource?.soraPrompt12s) return { family: 'sora2' as const, variant: '12s' as const };
    if (promptSource?.klingPrompt10s) return { family: 'kling' as const, variant: '10s' as const };
    if (promptSource?.veo3Prompt8s || promptSource?.veoPrompt) return { family: 'veo3' as const, variant: '8s' as const };
    if (promptSource?.klingPrompt15s || promptSource?.klingPrompt) return { family: 'kling' as const, variant: '15s' as const };
    if (promptSource?.veo3ExtensionPart1Prompt8s || promptSource?.veo3ExtensionPart2Prompt8s) {
      return { family: 'veo3Extension' as const, variant: promptSource?.veo3ExtensionPart1Prompt8s ? 'part1' as const : 'part2' as const };
    }
    if (promptSource?.seedancePrompt15s || promptSource?.sendancePrompt15s) return { family: 'seedance' as const, variant: '15s' as const };
    return { family: 'sora2' as const, variant: '12s' as const };
  };

  const getActivePromptText = () => {
    const logLockedPromptUsage = (tab: string, usingLocked: boolean) => {
      console.log(usingLocked ? `[UI_LOCKED_PROMPT_TAB_USED] tab=${tab}` : `[UI_LOCKED_PROMPT_TAB_FALLBACK_USED] tab=${tab}`);
    };
    const reportActivePromptSelection = (tab: string, text: string, sourceKind: "locked" | "fallback") => {
      const castLabels = (Array.isArray(result?.canonicalCastList) ? result.canonicalCastList : [])
        .map((item: any) => String(item || "").trim())
        .filter(Boolean);
      const usedLabels = castLabels.filter((label: string) => String(text || "").includes(label));
      logger.info("[PROMPT_ACTIVE_FIELD_SELECTED]", {
        activePromptFamily,
        activePromptVariant,
        tab,
        sourceKind,
        length: String(text || "").length,
        lockedPromptTabsLocked: result?.lockedPromptTabs?.locked === true,
        bestOptimizedTargetField: result?.bestOptimizedPrompt?.targetField || "",
        bestOptimizedReason: result?.bestOptimizedPrompt?.reason || ""
      });
      if (usedLabels.length > 0) {
        logger.info("[PROMPT_ACTIVE_CAST_LABELS_DETECTED]", {
          tab,
          usedLabels,
          canonicalCastCount: castLabels.length
        });
      } else {
        logger.warn("[PROMPT_ACTIVE_CAST_LABELS_MISSING]", {
          tab,
          canonicalCastList: castLabels,
          promptPreview: String(text || "").slice(0, 180)
        });
      }
      if (/do not name characters/i.test(String(text || ""))) {
        logger.warn("[PROMPT_ACTIVE_OLD_NO_NAME_RULE_FOUND]", {
          tab,
          promptPreview: String(text || "").slice(0, 180)
        });
      }
    };
    switch (activePromptFamily) {
      case 'sora2': {
        const locked = getLockedPromptValue(result, 'sora2', '12s');
        const fallback = editablePrompts; // Use editablePrompts for "Best"
        logLockedPromptUsage('optimized', !!locked);
        const selected = applyPromptOverlaysForDisplay(locked || fallback, 'sora2', '12s');
        reportActivePromptSelection('optimized', selected, locked ? "locked" : "fallback");
        return selected;
      }
      case 'sora': {
        const locked = getLockedPromptValue(result, 'sora', '15s');
        logLockedPromptUsage('sora', !!locked);
        const selected = applyPromptOverlaysForDisplay(locked || editableSora12s, 'sora', '15s');
        reportActivePromptSelection('sora', selected, locked ? "locked" : "fallback");
        return selected;
      }
      case 'kling': {
        const locked = getLockedPromptValue(result, 'kling', activePromptVariant === '10s' ? '10s' : '15s');
        const fallback = activePromptVariant === '10s' ? editableKling10s : editableKling15s;
        logLockedPromptUsage('kling', !!locked);
        const selected = applyPromptOverlaysForDisplay(locked || fallback, 'kling', activePromptVariant === '10s' ? '10s' : '15s');
        reportActivePromptSelection('kling', selected, locked ? "locked" : "fallback");
        return selected;
      }
      case 'seedance': {
        const locked = getLockedPromptValue(result, 'seedance', '15s');
        logLockedPromptUsage('seedance', !!locked);
        const selected = applyPromptOverlaysForDisplay(locked || editableSeedance15s, 'seedance', '15s');
        reportActivePromptSelection('seedance', selected, locked ? "locked" : "fallback");
        return selected;
      }
      case 'veo3': {
        const locked = getLockedPromptValue(result, 'veo3', '8s');
        logLockedPromptUsage('veo3', !!locked);
        const selected = applyPromptOverlaysForDisplay(locked || editableVeo3Prompt8s, 'veo3', '8s');
        reportActivePromptSelection('veo3', selected, locked ? "locked" : "fallback");
        return selected;
      }
      case 'veo3Extension': {
        const locked = getLockedPromptValue(result, 'veo3Extension', activePromptVariant === 'part2' ? 'part2' : 'part1');
        const fallback = activePromptVariant === 'part2' ? editableVeo3ExtensionPart2 : editableVeo3ExtensionPart1;
        logLockedPromptUsage('veo3Extension', !!locked);
        const selected = applyPromptOverlaysForDisplay(locked || fallback, 'veo3Extension', activePromptVariant === 'part2' ? 'part2' : 'part1');
        reportActivePromptSelection('veo3Extension', selected, locked ? "locked" : "fallback");
        return selected;
      }
      case 'sceneMaster': {
        const locked = getLockedPromptValue(result, 'sceneMaster', 'default');
        logLockedPromptUsage('sceneMaster', !!locked);
        const selected = applyPromptOverlaysForDisplay(locked || editableSceneMaster, 'sceneMaster', 'default');
        reportActivePromptSelection('sceneMaster', selected, locked ? "locked" : "fallback");
        return selected;
      }
      default: {
        const locked = getLockedPromptValue(result, 'sora2', '12s');
        logLockedPromptUsage('optimized', !!locked);
        const selected = applyPromptOverlaysForDisplay(locked || editableSora12s, 'sora2', '12s');
        reportActivePromptSelection('optimized', selected, locked ? "locked" : "fallback");
        return selected;
      }
    }
  };

  const setActivePromptText = (value: string) => {
    const normalizedValue = stripPromptOverlayDirectives(value);
    switch (activePromptFamily) {
      case 'sora2':
        setEditablePrompts(normalizedValue);
        return;
      case 'sora':
        setEditableSora12s(normalizedValue);
        return;
      case 'kling':
        if (activePromptVariant === '10s') setEditableKling10s(normalizedValue);
        else setEditableKling15s(normalizedValue);
        return;
      case 'seedance':
        setEditableSeedance15s(normalizedValue);
        return;
      case 'veo3':
        setEditableVeo3Prompt8s(normalizedValue);
        return;
      case 'veo3Extension':
        if (activePromptVariant === 'part2') setEditableVeo3ExtensionPart2(normalizedValue);
        else setEditableVeo3ExtensionPart1(normalizedValue);
        return;
      case 'sceneMaster':
        setEditableSceneMaster(normalizedValue);
        return;
    }
  };

  const getActivePromptUndo = () => {
    switch (activePromptFamily) {
      case 'sora2':
        return undoSora12s;
      case 'kling':
        return activePromptVariant === '10s' ? undoKling10s : undoKling15s;
      case 'seedance':
        return undoSeedance15s;
      case 'veo3':
        return undoVeo3Prompt8s;
      case 'veo3Extension':
        return activePromptVariant === 'part2' ? undoVeo3ExtensionPart2 : undoVeo3ExtensionPart1;
      case 'sceneMaster':
        return undoSceneMaster;
      default:
        return undoSora12s;
    }
  };

  const getActivePromptRedo = () => {
    switch (activePromptFamily) {
      case 'sora2':
        return redoPrompts;
      case 'sora':
        return redoSora12s;
      case 'kling':
        return activePromptVariant === '10s' ? redoKling10s : redoKling15s;
      case 'seedance':
        return redoSeedance15s;
      case 'veo3':
        return redoVeo3Prompt8s;
      case 'veo3Extension':
        return activePromptVariant === 'part2' ? redoVeo3ExtensionPart2 : redoVeo3ExtensionPart1;
      case 'sceneMaster':
        return redoSceneMaster;
      default:
        return redoSora12s;
    }
  };

  const getCanUndoActivePrompt = () => {
    switch (activePromptFamily) {
      case 'sora2':
        return canUndoPrompts;
      case 'sora':
        return canUndoSora12s;
      case 'kling':
        return activePromptVariant === '10s' ? canUndoKling10s : canUndoKling15s;
      case 'seedance':
        return canUndoSeedance15s;
      case 'veo3':
        return canUndoVeo3Prompt8s;
      case 'veo3Extension':
        return activePromptVariant === 'part2' ? canUndoVeo3ExtensionPart2 : canUndoVeo3ExtensionPart1;
      case 'sceneMaster':
        return canUndoSceneMaster;
      default:
        return canUndoSora12s;
    }
  };

  const getCanRedoActivePrompt = () => {
    switch (activePromptFamily) {
      case 'sora2':
        return canRedoPrompts;
      case 'sora':
        return canRedoSora12s;
      case 'kling':
        return activePromptVariant === '10s' ? canRedoKling10s : canRedoKling15s;
      case 'seedance':
        return canRedoSeedance15s;
      case 'veo3':
        return canRedoVeo3Prompt8s;
      case 'veo3Extension':
        return activePromptVariant === 'part2' ? canRedoVeo3ExtensionPart2 : canRedoVeo3ExtensionPart1;
      case 'sceneMaster':
        return canRedoSceneMaster;
      default:
        return canRedoSora12s;
    }
  };

  const getActivePromptLabel = () => {
    switch (activePromptFamily) {
      case 'sora2':
        return '12 secondi';
      case 'kling':
        return activePromptVariant === '10s' ? '10 secondi' : '15 secondi';
      case 'seedance':
        return '15 secondi';
      case 'veo3':
        return '8 secondi';
      case 'veo3Extension':
        return activePromptVariant === 'part2' ? 'parte 2 da 8 secondi' : 'parte 1 da 8 secondi';
      default:
        return '12 secondi';
    }
  };

  const getActivePromptEngineLabel = () => {
    switch (activePromptFamily) {
      case 'sora2':
        return 'Prompt ottimizzato';
      case 'kling':
        return 'Kling';
      case 'seedance':
        return 'Seedance';
      case 'veo3':
        return 'Veo 3';
      case 'veo3Extension':
        return activePromptVariant === 'part2' ? 'Veo 3 Extension - Parte 2' : 'Veo 3 Extension - Parte 1';
      default:
        return 'Prompt ottimizzato';
    }
  };

  const recommendedPromptFamily = useMemo<'sora2' | 'kling' | 'seedance' | 'veo3' | 'veo3Extension' | null>(() => {
    const target = typeof result?.recommendedPromptTarget === 'string'
      ? result.recommendedPromptTarget.trim()
      : '';
    const bestField = typeof result?.bestOptimizedPrompt?.targetField === 'string'
      ? result.bestOptimizedPrompt.targetField.trim()
      : '';
    const source = target || bestField;
    if (!source) return null;
    if (source === 'optimized' || /promptSora|soraPrompt|aiPrompts|optimizedPrompt/i.test(source)) return 'sora2';
    if (/kling/i.test(source)) return 'kling';
    if (/seedance|sendance/i.test(source)) return 'seedance';
    if (/veo3Extension|Extension/i.test(source)) return 'veo3Extension';
    if (/veo3|promptVeo|veoPrompt/i.test(source)) return 'veo3';
    return null;
  }, [result?.recommendedPromptTarget, result?.bestOptimizedPrompt?.targetField]);

  const activePrompt = getActivePromptText();
  const setActivePrompt = setActivePromptText;
  const undoActivePrompt = getActivePromptUndo();
  const redoActivePrompt = getActivePromptRedo();
  const canUndoActivePrompt = getCanUndoActivePrompt();
  const canRedoActivePrompt = getCanRedoActivePrompt();
  const canonicalCastList = Array.isArray(result?.canonicalCastList) ? result.canonicalCastList : [];
  const castGroundingAuditForUi = (result?.castGroundingAudit || {}) as any;
  const frameTimestampsForUi = Array.isArray(result?.frameTimestamps) ? result.frameTimestamps : [];
  const audioSegmentsForUi = Array.isArray(result?.audioSegments) ? result.audioSegments : [];
  const castLabelsForUi = canonicalCastList.map((item) => String(item || "").trim()).filter(Boolean);
  const detectedCharactersForUi = Array.isArray(result?.detectedCharacters) ? result.detectedCharacters.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const frameVisibleSubjectsForUi = Array.isArray(result?.frameObservations)
    ? [...new Set(result.frameObservations.flatMap((obs: any) => Array.isArray(obs?.visibleSubjects) ? obs.visibleSubjects : []).map((item: any) => String(item || "").trim()).filter(Boolean))]
    : [];
  const resolvedVisualConfirmation = Math.max(
    typeof result?.visualCastCount === "number" ? result.visualCastCount : 0,
    typeof castGroundingAuditForUi?.visualCastCount === "number" ? castGroundingAuditForUi.visualCastCount : 0,
    detectedCharactersForUi.length,
    frameVisibleSubjectsForUi.length,
    castLabelsForUi.length
  );
  const visualConfirmationSourceField =
    (typeof result?.visualCastCount === "number" && result.visualCastCount > 0) ? "result.visualCastCount" :
    (typeof castGroundingAuditForUi?.visualCastCount === "number" && castGroundingAuditForUi.visualCastCount > 0) ? "castGroundingAudit.visualCastCount" :
    (detectedCharactersForUi.length > 0) ? "result.detectedCharacters" :
    (frameVisibleSubjectsForUi.length > 0) ? "result.frameObservations.visibleSubjects" :
    (castLabelsForUi.length > 0) ? "result.canonicalCastList" :
    "none";
  logger.info("[UI_VISUAL_CONFIRMATION_SOURCE_AUDIT]", {
    displayedVisualConfirmation: resolvedVisualConfirmation,
    sourceField: visualConfirmationSourceField,
    visualCastCount: result?.visualCastCount ?? 0,
    detectedCharactersCount: detectedCharactersForUi.length,
    frameObservationsCount: Array.isArray(result?.frameObservations) ? result.frameObservations.length : 0,
    castSource: castGroundingAuditForUi?.castSource || "N/A"
  });
  const castModeForUi = String(castGroundingAuditForUi?.castFallbackMode || "NONE");
  const castConfidenceLabelForUi = String(result?.castConfidence || castGroundingAuditForUi?.castConfidence || "N/A");
  const promptReviewStatusForUi = result?.operationalDecision === "GENERATED_REVIEW_REQUIRED" ? "DA REVISIONARE" : ((result?.promptQualityReport?.finalPass && result?.lockedPromptTabs?.locked) ? "FINALI" : "IN CORSO / TECNICI");
  const promptUsesCastLabelsForUi = castLabelsForUi.filter((label) => label.length > 0).some((label) => String(activePrompt || "").includes(label));
  const previousVsCurrentCastDelta = previousRunSummary
    ? castLabelsForUi.length - Number(previousRunSummary?.castCount || 0)
    : null;
  const previousVsCurrentPromptDelta = previousRunSummary
    && typeof previousRunSummary?.promptUsabilityPercent === "number"
    && typeof result?.promptDecisionTrace?.promptUsabilityPercent === "number"
      ? result.promptDecisionTrace.promptUsabilityPercent - previousRunSummary.promptUsabilityPercent
      : null;
  const isPromptBlockedForMissingGrounding =
    result?.groqFullPhase === 'prompt' &&
    (result?.promptQualityReport as any)?.finalPass === false &&
    result?.lockedPromptTabs?.locked === false &&
    (result?.operationalDecision === 'PROMPT_ENGINE_FAILED' ||
      result?.operationalDecision === 'PROMPT_BLOCKED_NO_VISUAL_FRAME_TIMELINE');
  const blockedPromptReason =
    result?.promptDecisionTrace?.decision?.reason ||
    result?.bestOptimizedPrompt?.reason ||
    result?.lockedPromptTabs?.reason ||
    'PROMPT_BLOCKED_NO_VISUAL_FRAME_TIMELINE';
  const blockedPromptMessage =
    "Prompt bloccati per mancanza di grounding visivo: audio e timeline sono disponibili, ma non ci sono osservazioni frame affidabili sufficienti per generare prompt finali.";
  const isBlockedPromptPlaceholder = (value: string) => {
    const normalized = String(value || "").trim();
    return (
      !normalized ||
      normalized === "NON_GENERATO_PROMPT_VALIDATION_FAILED" ||
      normalized === "NON_GENERATO_PHASE_2" ||
      normalized === "NON_GENERATO_PROMPT_HF_CREDITS_DEPLETED"
    );
  };

  const compactResultForUi = useMemo(() => safeCompactResultForUI(result), [result]);

  useEffect(() => {
    if (!result) return;
    logger.info('[RESULT_UI_COMPACT_RENDER_READY]', {
      hasResult: true,
      hasNestedResult: !!(result as any)?.result,
      approximateResultSize: approximateObjectSize(result),
      visibleUiSections: [
        'model-status',
        'technical-summary',
        'audio-summary',
        'cast-summary',
        'prompt-summary',
        'feedback'
      ],
      hiddenTechnicalSectionsCount: 6,
      renderProtectionEnabled: true
    });
  }, [result]);

  const activePrompt1 = activePromptTab1 === 'sora' 
    ? (soraDuration1 === '15s' ? editablePrompts1 : editableSora12s1) 
    : activePromptTab1 === 'kling' ? editableKling1 : editableVeo1;
  const setActivePrompt1 = activePromptTab1 === 'sora' 
    ? (soraDuration1 === '15s' ? setEditablePrompts1 : setEditableSora12s1) 
    : activePromptTab1 === 'kling' ? setEditableKling1 : setEditableVeo1;
  const undoActivePrompt1 = activePromptTab1 === 'sora' 
    ? (soraDuration1 === '15s' ? undoPrompts1 : undoSora12s1) 
    : activePromptTab1 === 'kling' ? undoKling1 : undoVeo1;
  const redoActivePrompt1 = activePromptTab1 === 'sora' 
    ? (soraDuration1 === '15s' ? redoPrompts1 : redoSora12s1) 
    : activePromptTab1 === 'kling' ? redoKling1 : redoVeo1;
  const canUndoActivePrompt1 = activePromptTab1 === 'sora' 
    ? (soraDuration1 === '15s' ? canUndoPrompts1 : canUndoSora12s1) 
    : activePromptTab1 === 'kling' ? canUndoKling1 : canUndoVeo1;
  const canRedoActivePrompt1 = activePromptTab1 === 'sora' 
    ? (soraDuration1 === '15s' ? canRedoPrompts1 : canRedoSora12s1) 
    : activePromptTab1 === 'kling' ? canRedoKling1 : canRedoVeo1;

  const activePrompt2 = activePromptTab2 === 'sora' 
    ? (soraDuration2 === '15s' ? editablePrompts2 : editableSora12s2) 
    : activePromptTab2 === 'kling' ? editableKling2 : editableVeo2;
  const setActivePrompt2 = activePromptTab2 === 'sora' 
    ? (soraDuration2 === '15s' ? setEditablePrompts2 : setEditableSora12s2) 
    : activePromptTab2 === 'kling' ? setEditableKling2 : setEditableVeo2;
  const undoActivePrompt2 = activePromptTab2 === 'sora' 
    ? (soraDuration2 === '15s' ? undoPrompts2 : undoSora12s2) 
    : activePromptTab2 === 'kling' ? undoKling2 : undoVeo2;
  const redoActivePrompt2 = activePromptTab2 === 'sora' 
    ? (soraDuration2 === '15s' ? redoPrompts2 : redoSora12s2) 
    : activePromptTab2 === 'kling' ? redoKling2 : redoVeo2;
  const canUndoActivePrompt2 = activePromptTab2 === 'sora' 
    ? (soraDuration2 === '15s' ? canUndoPrompts2 : canUndoSora12s2) 
    : activePromptTab2 === 'kling' ? canUndoKling2 : canUndoVeo2;
  const canRedoActivePrompt2 = activePromptTab2 === 'sora' 
    ? (soraDuration2 === '15s' ? canRedoPrompts2 : canRedoSora12s2) 
    : activePromptTab2 === 'kling' ? canRedoKling2 : canRedoVeo2;

  const handleDetectDangerousWords = async (
    text: string,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (isAnalyzingRef.current) {
      logger.info("[App] Dangerous words detection already in progress (ref), skipping handleDetectDangerousWords");
      return;
    }
    isAnalyzingRef.current = true;

    console.log('Detecting dangerous words in:', text);
    setLoading(true);

    // Safety Timeout: force unlock after 300s
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        logger.error("[App] Safety timeout reached in handleDetectDangerousWords, forcing unlock.");
        isAnalyzingRef.current = false;
        setLoading(false);
        resetQuotaStatus();
        setError("Il rilevamento delle parole a rischio ha impiegato troppo tempo (10 minuti) ed Ã¨ stata interrotta.");
      }
    }, 600000);

    try {
      // 1. Static detection (fast)
      const staticWords = findDangerousWords(text);
      console.log('Found static words:', staticWords);
      
      // 2. AI-powered detection (dynamic)
      const { apiKey } = getAI();
      let aiWords: string[] = [];
      
      if (apiKey) {
        try {
          aiWords = await detectDangerousWordsWithAI(text, apiKey, modelTier);
          console.log('Found AI words:', aiWords);
        } catch (err: any) {
          const errorMessage = err.message || String(err);
          const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
          if (isQuotaError && modelTier === 'pro') {
            logger.warn("[App] Quota exceeded for PRO model in dangerous words detection. Auto-switching to FLASH mode.");
            try {
              aiWords = await detectDangerousWordsWithAI(text, apiKey, 'flash');
              console.log('Found AI words (flash fallback):', aiWords);
            } catch (fallbackErr) {
              console.error('AI detection failed even with flash fallback:', fallbackErr);
            }
          } else {
            console.error('AI detection failed:', err);
          }
        }
      } else {
        console.warn('API Key missing for AI detection, using static list only');
      }

      const allWords = Array.from(new Set([...staticWords, ...aiWords]));
      
      if (allWords.length > 0) {
        setDangerousWords(prev => {
          const newWords = new Set([...prev, ...allWords]);
          return Array.from(newWords);
        });
      }
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error('Error detecting words:', err);
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setError("Connessione interrotta durante il rilevamento delle parole a rischio. Riprova.");
      } else {
        setError('Errore durante il rilevamento delle parole a rischio.');
      }
    } finally {
      clearTimeout(safetyTimeout);
      isAnalyzingRef.current = false;
      setLoading(false);
    }
  };

  const handleBypassWord = async (
    word: string,
    target: 'prompts' | 'prompts1' | 'prompts2'
  ) => {
    console.log('Bypassing word:', word, 'for target:', target);
    setBypassingWord({ word, target });
    try {
      let setter: React.Dispatch<React.SetStateAction<string>> | null = null;
      
      if (target === 'prompts') {
        setter = setActivePrompt;
      } else if (target === 'prompts1') {
        setter = setActivePrompt1;
      } else if (target === 'prompts2') {
        setter = setActivePrompt2;
      }
      
      if (!setter) {
        console.warn('No setter found for target:', target);
        return;
      }

      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const { apiKey } = getAI();
      const bypassed = await getBypassedWord(word, apiKey || '');
      console.log('Bypassed word:', bypassed);
      
      setter(prev => {
        const newText = prev.replace(new RegExp(escapedWord, 'gi'), bypassed);
        console.log('New text generated');
        return newText;
      });
      
      // Rimuovi la parola dalla lista delle parole pericolose
      setDangerousWords(prev => prev.filter(w => w.toLowerCase() !== word.toLowerCase()));
      
    } catch (err: any) {
      console.error('Error bypassing word:', err);
      setError(`Errore durante il bypass della parola "${word}".`);
    } finally {
      setBypassingWord(null);
    }
  };

  return (
    <DecisionEngineShell
      onReset={handleReset}
      onClearCache={handleClearCache}
      onExportData={handleExportData}
      isCopiedExport={isCopiedExport}
    >
      <div
        id="GLOBAL_BUILD_DEBUG_BADGE"
        style={{
          position: "fixed",
          bottom: 8,
          right: 8,
          zIndex: 999999,
          background: "rgba(220, 38, 38, 0.75)",
          color: "white",
          padding: "4px 8px",
          borderRadius: "8px",
          fontSize: "11px",
          fontWeight: 600,
          pointerEvents: "none",
          opacity: 0.75
        }}
      >
        BUILD DEBUG 17 MAGGIO
      </div>
      <div className="relative">
        {/* Header - Already in Shell, but keeping internal ones if needed or removing redundant */}
        <div className="max-w-7xl mx-auto px-6 py-12 pt-0">
          <div className="mb-16 text-center space-y-4">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-white/5 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 mb-4 glass-panel"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Viral Algorithm 2026 Edition
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl sm:text-8xl font-black tracking-tighter premium-gradient-text"
            >
              VIRAL<span className="text-emerald-500">WIZARD</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-zinc-400 max-w-2xl mx-auto font-medium"
            >
              L'intelligenza artificiale che domina l'algoritmo. Crea, analizza e ottimizza short-form video per la massima retention.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Input Section */}
          <div className={analysisMode === 'production-flow' ? "lg:col-span-12 space-y-8" : "lg:col-span-5 space-y-8"}>
            <div className="glass-panel p-8 rounded-3xl border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <h2 className="text-3xl font-black tracking-tight mb-3 premium-gradient-text">Ottimizza Prompt</h2>
                <p className="text-zinc-400 text-sm leading-relaxed font-medium">
                  Carica un video o descrivi un'idea. L'IA la perfezionerÃ  massimizzando la viralitÃ , l'hook e il loop invisibile.
                </p>
              </div>
            </div>

            {/* Genre Dropdown - Hidden in Pensaci Tu mode as it has its own selector */}
            {analysisMode !== 'pensaci-tu' && (
              <div className="space-y-3">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 px-2">
                  <Film className="w-4 h-4 text-emerald-500" />
                  Genere Video
                </label>
                <div className="relative group">
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className={`w-full bg-zinc-900/50 border rounded-2xl p-5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all text-zinc-300 appearance-none cursor-pointer glass-panel ${
                      genre === 'Auto-Detect' ? 'border-amber-500/30' : 'border-white/5'
                    }`}
                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2371717A%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem top 50%', backgroundSize: '0.65rem auto' }}
                  >
                    <option value="Auto-Detect" className="bg-zinc-950 text-amber-400 font-bold">Ã¢Å“Â¨ Rilevamento Automatico AI (Consigliato)</option>
                    <option value="ASMR" className="bg-zinc-950">ASMR (Oddly Satisfying, Texture, Suoni)</option>
                    <option value="Sport Chaos & Gaffes" className="bg-zinc-950">Sport Chaos & Gaffes (Fails, Cringe, Tifosi)</option>
                    <option value="Comico" className="bg-zinc-950">Comico (Stand-up, Sketch, Gag)</option>
                    <option value="Musicale" className="bg-zinc-950">Musicale (Performance, Talent, Videoclip)</option>
                    <option value="Sportivo" className="bg-zinc-950">Sportivo (Azione, Highlights, Motori)</option>
                    <option value="Drammatico" className="bg-zinc-950">Drammatico (Storytelling, Emozioni, IntensitÃ )</option>
                    <option value="Cartoni Animati" className="bg-zinc-950">Cartoni Animati (2D/3D, Animation)</option>
                    <option value="Generico" className="bg-zinc-950">Generico / Altro</option>
                  </select>
                </div>
                {genre === 'Auto-Detect' && (
                  <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider flex items-center gap-1 px-2">
                    <Sparkles className="w-3 h-3" /> L'IA analizzerÃ  il video per determinare il genere piÃ¹ adatto.
                  </p>
                )}

                {genre === 'Musicale' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 mt-3"
                  >
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMusicalType('canzone')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          musicalType === 'canzone'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                            : 'bg-zinc-900/50 text-zinc-400 border border-white/5 hover:bg-zinc-800'
                        }`}
                      >
                        Canzone
                      </button>
                      <button
                        onClick={() => setMusicalType('talent_show')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          musicalType === 'talent_show'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                            : 'bg-zinc-900/50 text-zinc-400 border border-white/5 hover:bg-zinc-800'
                        }`}
                      >
                        Talent Show
                      </button>
                    </div>

                    {musicalType === 'canzone' && (
                      <div className="relative">
                        <input
                          type="text"
                          value={preferredSinger}
                          onChange={(e) => setPreferredSinger(e.target.value)}
                          placeholder="Cantante preferito (Opzionale)..."
                          className="w-full bg-zinc-900/50 border border-white/5 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all text-zinc-300 placeholder:text-zinc-600"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1 px-1">
                          L'IA capirÃ  anche se scrivi il nome in modo errato (es. "gimni endrix").
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {/* Analysis Mode Selector */}
            <div className="space-y-3">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 px-2">
                <Target className="w-4 h-4 text-emerald-500" />
                ModalitÃ  Operativa - V2
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-zinc-900/30 p-2 rounded-3xl border border-white/5 glass-panel">
                {[
                  { id: 'production-flow', label: 'Production', icon: <Rocket className="w-4 h-4" />, color: 'emerald' },
                  { id: 'pensaci-tu', label: 'Pensaci Tu', icon: <Sparkles className="w-4 h-4" />, color: 'yellow' },
                  { id: 'guided-short', label: 'Wizard', icon: <BrainCircuit className="w-4 h-4" />, color: 'red' },
                  { id: 'generate', label: 'Script', icon: <Wand2 className="w-4 h-4" />, color: 'purple' },
                  { id: 'estimate', label: 'Viral Rank', icon: <TrendingUp className="w-4 h-4" />, color: 'blue' },
                  { id: 'trend-hunter', label: 'Trends', icon: <Search className="w-4 h-4" />, color: 'orange' },
                  { id: 'hook-test', label: 'A/B Test', icon: <Target className="w-4 h-4" />, color: 'purple' },
                  { id: 'viral-hook-bulk', label: 'Bulk Hooks', icon: <Zap className="w-4 h-4" />, color: 'red' },
                  { id: 'anti-ai-slop', label: 'Anti-Slop', icon: <ShieldAlert className="w-4 h-4" />, color: 'red' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setAnalysisMode(mode.id as any)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 border ${
                      analysisMode === mode.id
                        ? `bg-${mode.color}-500/20 border-${mode.color}-500/50 text-${mode.color}-400 shadow-lg scale-[1.02]`
                        : 'text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-white/5'
                    }`}
                  >
                    {mode.icon}
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Tier Selector */}
            <div className="flex flex-wrap md:flex-nowrap bg-zinc-900/30 rounded-2xl p-1 border border-white/5 glass-panel">
              <button
                onClick={() => setModelTier('flash')}
                className={`flex-1 py-3 px-2 md:px-4 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 ${
                  modelTier === 'flash'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Zap className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                Flash
              </button>
              <button
                onClick={() => setModelTier('pro')}
                className={`flex-1 py-3 px-2 md:px-4 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 ${
                  modelTier === 'pro'
                    ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <BrainCircuit className="w-3 h-3 md:w-4 md:h-4" />
                Pro
              </button>
              <button
                onClick={() => setModelTier('smart')}
                className={`flex-1 py-3 px-2 md:px-4 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 ${
                  modelTier === 'smart'
                    ? 'bg-orange-500/10 text-orange-400 shadow-sm border border-orange-500/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Hybrid AI: Generates with Flash, Validates with Pro"
              >
                Ã°Å¸â€Â¥ Smart
              </button>
              <button
                onClick={() => setModelTier('groq')}
                className={`flex-1 py-3 px-2 md:px-4 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 ${
                  modelTier === 'groq'
                    ? 'bg-fuchsia-500/10 text-fuchsia-400 shadow-sm border border-fuchsia-500/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Groq Hybrid: Audio su Groq, Vision e Final su Hugging Face"
              >
                Groq
              </button>
              <button
                onClick={() => setModelTier('hugging')}
                className={`flex-1 py-3 px-2 md:px-4 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 ${
                  modelTier === 'hugging'
                    ? 'bg-indigo-500/10 text-indigo-400 shadow-sm border border-indigo-500/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Hugging Face Full: Tutto su Hugging Face API"
              >
                Hugging
              </button>
              <button
                onClick={() => setModelTier('test')}
                className={`flex-1 py-3 px-2 md:px-4 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 ${
                  modelTier === 'test'
                    ? 'bg-blue-500/10 text-blue-400 shadow-sm border border-blue-500/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <FlaskConical className="w-3 h-3 md:w-4 md:h-4" />
                Test
              </button>
            </div>

            {modelTier === 'groq' && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-2xl p-4 mb-8 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-fuchsia-500/20 rounded-lg">
                    <Activity className="w-5 h-5 text-fuchsia-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-fuchsia-400 uppercase tracking-widest mb-1">MOTORE GROQ HYBRID ATTIVO</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Utilizza <strong>Groq Whisper</strong> per una trascrizione audio istantanea. L'analisi visiva dei frame e il ragionamento strategico finale sono delegati a <strong>Hugging Face Space Vision / Testuale</strong>. Zero dipendenze da Gemini.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Modello Groq Audio</label>
                    <input 
                      type="text" 
                      value={groqAudioModel}
                      onChange={(e) => setGroqAudioModel(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-fuchsia-400 focus:outline-none focus:border-fuchsia-500/50"
                      placeholder="whisper-large-v3-turbo"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Modello Hugging Vision</label>
                    <input 
                      type="text" 
                      value={hfVisionModel}
                      onChange={(e) => setHfVisionModel(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-fuchsia-400 focus:outline-none focus:border-fuchsia-500/50"
                      placeholder="Salesforce/blip-image-captioning-large"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Groq Phase Control</label>
                    <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-full">
                      <button
                        onClick={() => setGroqFullPhase('core')}
                        className={`flex-1 py-1 px-3 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                          groqFullPhase === 'core'
                            ? 'bg-zinc-800 text-white shadow-sm shadow-black/50 border border-white/5'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        title="Phase 1: Analisi Core (Script & Analisi)"
                      >
                        CORE
                      </button>
                      <button
                        onClick={() => setGroqFullPhase('prompt')}
                        className={`flex-1 py-1 px-3 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                          groqFullPhase === 'prompt'
                            ? 'bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-900/50 border border-fuchsia-500/50'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        title="Phase 2: Prompt Engine (Sora, Kling, Veo)"
                      >
                        PROMPT
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {modelTier === 'hugging' && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 mb-8 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Brain className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-1">MOTORE HUGGING FACE COMPLETO</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      ModalitÃ  100% <strong>Inference API</strong>. Audio, Vision e Reasoning vengono processati interamente tramite i cluster di Hugging Face. Massima indipendenza e performance bilanciate.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Hugging Audio</label>
                    <input 
                      type="text" 
                      value={hfAudioModel}
                      onChange={(e) => setHfAudioModel(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-indigo-400 focus:outline-none focus:border-indigo-500/50"
                      placeholder="openai/whisper-large-v3-turbo"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Hugging Vision</label>
                    <input 
                      type="text" 
                      value={hfVisionModel}
                      onChange={(e) => setHfVisionModel(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-indigo-400 focus:outline-none focus:border-indigo-500/50"
                      placeholder="Salesforce/blip-image-captioning-large"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Hugging Reasoner</label>
                    <input 
                      type="text" 
                      value={hfTextModel}
                      onChange={(e) => setHfTextModel(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-indigo-400 focus:outline-none focus:border-indigo-500/50"
                      placeholder="mistralai/Mistral-7B-Instruct-v0.2"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {modelTier === 'test' && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 mb-8"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <FlaskConical className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1">TEST MODE ATTIVO</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Questa modalitÃ  esegue un'analisi completa ma ultra-leggera: usa una <strong>campionatura minima di fotogrammi</strong> per preservare le quote e garantire stabilitÃ  senza caricamenti video pesanti. Ideale per test rapidi della struttura virale.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {analysisMode === 'production-flow' && (
              <div className="space-y-8">
                <YoutubeMetadataExtractor />
                <ProductionFlow 
                  apiKey={getAI().apiKey || ''}
                  genre={genre} 
                  modelTier={modelTier}
                  setModelTier={setModelTier}
                  isDeepAnalysis={isDeepAnalysis}
                />
              </div>
            )}

          {analysisMode !== 'production-flow' && (
            <div className="space-y-6">
              {/* Input Type Toggle for Estimate/Anti-AI Mode */}
            {(analysisMode === 'estimate' || analysisMode === 'anti-ai-slop') && (
              <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50 w-full mb-4">
                <button
                  onClick={() => setEstimateInputType('video')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    estimateInputType === 'video'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <FileVideo className="w-4 h-4" />
                  Analizza Video
                </button>
                <button
                  onClick={() => setEstimateInputType('prompt')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    estimateInputType === 'prompt'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <AlignLeft className="w-4 h-4" />
                  Analizza Prompt
                </button>
              </div>
            )}

            {/* Guided Short Wizard */}
            {analysisMode === 'guided-short' && !result && (
              <GuidedShortWizard 
                isLoading={isLoading}
                onComplete={(answers) => {
                  setWizardAnswers(answers);
                  handleGenerate(false, undefined, undefined, 'guided-short', answers);
                }} 
              />
            )}

            {/* Pensaci Tu Inputs */}
            {analysisMode === 'pensaci-tu' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    Scegli il Genere (L'IA deciderÃ  tutto il resto)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PENSACI_TU_GENRES.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setPensaciTuGenre(g.id)}
                        className={`group relative p-4 rounded-2xl text-left transition-all border ${
                          pensaciTuGenre === g.id 
                            ? 'bg-yellow-500/15 border-yellow-500/50 ring-1 ring-yellow-500/50' 
                            : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:bg-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-xl transition-colors ${
                            pensaciTuGenre === g.id ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                          }`}>
                            <g.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold truncate ${pensaciTuGenre === g.id ? 'text-yellow-400' : 'text-zinc-200'}`}>
                              {g.label}
                            </div>
                            {g.sub && (
                              <div className="text-[10px] text-zinc-500 leading-tight mt-0.5 line-clamp-1">
                                {g.sub}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {pensaciTuGenre === 'Musicale' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl"
                  >
                    <label className="text-[10px] font-black text-yellow-500/50 uppercase tracking-widest px-1">
                      Configurazione Musicale
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMusicalType('canzone')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          musicalType === 'canzone'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                            : 'bg-zinc-900/50 text-zinc-400 border border-white/5 hover:bg-zinc-800'
                        }`}
                      >
                        Canzone
                      </button>
                      <button
                        onClick={() => setMusicalType('talent_show')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          musicalType === 'talent_show'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                            : 'bg-zinc-900/50 text-zinc-400 border border-white/5 hover:bg-zinc-800'
                        }`}
                      >
                        Talent Show
                      </button>
                    </div>

                    {musicalType === 'canzone' && (
                      <div className="relative">
                        <input
                          type="text"
                          value={preferredSinger}
                          onChange={(e) => setPreferredSinger(e.target.value)}
                          placeholder="Cantante preferito (Opzionale)..."
                          className="w-full bg-zinc-900/50 border border-white/5 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500/30 transition-all text-zinc-300 placeholder:text-zinc-600"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1 px-1">
                          L'IA capirÃ  anche se scrivi il nome in modo errato (es. "gimni endrix").
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-yellow-400" />
                    Goal / Direzione (Opzionale)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pensaciTuGoal}
                      onChange={(e) => setPensaciTuGoal(e.target.value)}
                      placeholder="Es: Falla sul basket, piÃ¹ assurdo, usa un cane..."
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/30 transition-all text-zinc-100 placeholder:text-zinc-600"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1 px-1">
                      Usa questo campo per forzare un cambio di rotta se l'IA si ripete troppo. (Errori grammaticali ok!)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Trend Hunter Inputs */}
            {analysisMode === 'trend-hunter' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-400" />
                    Nicchia / Argomento da Ricercare
                  </label>
                  <input
                    type="text"
                    value={trendNiche}
                    onChange={(e) => setTrendNiche(e.target.value)}
                    placeholder="Es: Calcio, Cucina, Tech, Gen-Z..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-zinc-100"
                  />
                </div>
              </div>
            )}

            {/* Hook Test Inputs */}
            {analysisMode === 'hook-test' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-400" />
                    Hook A
                  </label>
                  <textarea
                    value={hookA}
                    onChange={(e) => setHookA(e.target.value)}
                    placeholder="Inserisci il primo hook..."
                    className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-400" />
                    Hook B
                  </label>
                  <textarea
                    value={hookB}
                    onChange={(e) => setHookB(e.target.value)}
                    placeholder="Inserisci il secondo hook..."
                    className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Film className="w-4 h-4" />
                    Nicchia di Riferimento
                  </label>
                  <input
                    type="text"
                    value={trendNiche}
                    onChange={(e) => setTrendNiche(e.target.value)}
                    placeholder="Es: Sport, Comedy..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-zinc-100"
                  />
                </div>
              </div>
            )}

            {/* Viral Hook Bulk Inputs */}
            {analysisMode === 'viral-hook-bulk' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Search className="w-4 h-4 text-red-400" />
                    Nicchia / Argomento
                  </label>
                  <input
                    type="text"
                    value={trendNiche}
                    onChange={(e) => setTrendNiche(e.target.value)}
                    placeholder="Es: Calcio, Cucina, Tech, Gen-Z..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-zinc-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <AlignLeft className="w-4 h-4 text-red-400" />
                    Descrizione del Video
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrivi brevemente di cosa parla il video per generare i ganci..."
                    className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-zinc-100"
                  />
                </div>
              </div>
            )}

            {(analysisMode === 'generate' || analysisMode === 'estimate' || analysisMode === 'anti-ai-slop') && (
              <>
                {/* ModalitÃ  Analisi Pipeline */}
                <div className="space-y-3 p-4 bg-red-900/50 border border-red-500/80 rounded-2xl mb-6 shadow-lg shadow-red-900/20">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <Activity className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-200 uppercase tracking-tighter">ModalitÃ  Protocollo Analisi</p>
                      <p className="text-[10px] text-red-400/80 uppercase">Configura la profonditÃ  desiderata</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'STANDARD', label: 'STANDARD', desc: 'Veloce, Frame-Only', icon: <Zap className="w-3 h-3" /> },
                      { id: 'AUDIO_ENHANCED', label: 'AUDIO ENHANCED', desc: 'Audio Anchor + Mix', icon: <Mic className="w-3 h-3" /> },
                      { id: 'DEEP', label: 'DEEP', desc: 'Completa + DNA', icon: <BrainCircuit className="w-3 h-3" /> }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setPipelineMode(m.id as AnalysisPipelineMode);
                          setIsDeepAnalysis(m.id !== 'STANDARD');
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1 ${
                          pipelineMode === m.id 
                            ? 'bg-red-600/20 border-red-500 text-red-200 shadow-lg shadow-red-900/20' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {m.icon}
                          <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                        </div>
                        <span className="text-[8px] opacity-70 font-medium">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Area */}
                {(analysisMode === 'estimate' || analysisMode === 'anti-ai-slop') && estimateInputType === 'prompt' && (
              <div className="space-y-2 mb-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <AlignLeft className="w-4 h-4" />
                    Prompt Originale da Analizzare (Obbligatorio)
                  </label>
                  {originalPrompt && (
                    <button
                      onClick={() => setOriginalPrompt('')}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Svuota
                    </button>
                  )}
                </div>
                <textarea
                  value={originalPrompt}
                  onChange={(e) => setOriginalPrompt(e.target.value)}
                  placeholder="Incolla qui il prompt video originale che vuoi far analizzare..."
                  className="w-full h-48 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 resize-none transition-all"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                 <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FileVideo className="w-4 h-4 text-red-500" />
                    Video Input & Protocollo
                 </label>
                 <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsLowMemoryMode(!isLowMemoryMode)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border shadow-lg ${
                        isLowMemoryMode 
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      <Activity className={`w-3 h-3 ${isLowMemoryMode ? 'animate-pulse' : ''}`} />
                      {isLowMemoryMode ? 'LOW MEMORY ATTIVA (OTTIMIZZATA)' : 'MEMORIA STANDARD'}
                    </button>
                    {isLowMemoryMode && (
                      <div className="group relative">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 cursor-help" />
                        <div className="absolute right-0 top-6 w-56 p-3 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl text-[9px] text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                          Consigliata per Tablet. Riduce il carico RAM durante l'analisi, mantenendo la trascrizione audio fondamentale.
                        </div>
                      </div>
                    )}
                 </div>
              </div>

              {/* Video Downloader Helper */}
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl mb-2">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Video Downloader Helper</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={downloadUrl}
                      onChange={(e) => setDownloadUrl(e.target.value)}
                      placeholder="Incolla link YouTube, TikTok, Instagram..."
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all h-12"
                    />
                    {downloadUrl && (
                      <button
                        onClick={() => {
                          copyToClipboard(downloadUrl);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-2.5 z-10"
                        title="Copia URL"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const baseUrl = 'https://app.ytdown.to/it19/';
                        const finalUrl = downloadUrl ? `${baseUrl}?url=${encodeURIComponent(downloadUrl)}` : baseUrl;
                        window.open(finalUrl, '_blank');
                      }}
                      className="flex-1 sm:flex-none px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 h-12"
                    >
                      <Eye className="w-4 h-4" />
                      Apri Downloader
                    </button>
                    {downloadUrl && (
                      <button
                        onClick={() => window.open(downloadUrl, '_blank')}
                        className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl border border-zinc-700 transition-all flex items-center justify-center h-12 w-12"
                        title="Apri link originale"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-indigo-400/80">
                  <a href="https://savetik.io/it" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300 underline">Scarica TikTok (SaveTik)</a>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 leading-tight">
                  Copia il link del video, incollalo su <strong>YTDown</strong> per scaricarlo, poi trascina il file scaricato qui sotto.
                </p>
              </div>
              
              {!file && !savedVideoData ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragging 
                      ? 'border-red-500 bg-red-500/5' 
                      : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'
                  }`}
                >
                  <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-zinc-300">Clicca o trascina un video</p>
                  <p className="text-xs text-zinc-500 mt-1">MP4, WebM (Max 20MB)</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/*"
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                        <FileVideo className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium truncate">{file ? file.name : savedVideoData?.fileName}</p>
                        <p className="text-xs text-emerald-500">Video caricato e pronto</p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          setFile(null);
                          setSavedVideoData(null);
                          setVideoRange(null);
                          setAudioSmokeResult(null);
                          await clearVideo();
                        } catch (err) {
                          console.error("Failed to clear video:", err);
                        }
                      }}
                      className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Test Audio Anchor Isolato (User Requested Prominent Button) */}
                  <div className="space-y-2">
                    <button
                      onClick={handleAudioSmokeTest}
                      disabled={isAudioSmokeTesting}
                      className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${
                        isAudioSmokeTesting 
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed' 
                          : 'bg-blue-600/10 border-blue-500/30 hover:bg-blue-600/20 text-blue-400 hover:border-blue-500'
                      }`}
                    >
                      {isAudioSmokeTesting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {audioSmokeProgress || "Testing..."}
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          Test Audio Anchor Isolato
                        </>
                      )}
                    </button>

                    {audioSmokeResult && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-3 bg-zinc-950 rounded-xl border border-blue-500/20 text-[10px] font-mono shadow-xl shadow-blue-900/10"
                      >
                        <div className="flex justify-between items-center pb-2 mb-2 border-b border-zinc-800/50">
                          <span className="text-zinc-500">DIAGNOSI AUDIO:</span>
                          <span className={audioSmokeResult.errorReason ? "text-red-400" : "text-emerald-400"}>
                            {audioSmokeResult.errorReason ? "FALLITO" : "VERIFICATO"}
                          </span>
                        </div>
                        
                        {!audioSmokeResult.errorReason ? (
                          <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                              <span className="text-zinc-500">Preview:</span>
                              <span className="text-blue-400">{audioSmokeResult.confidence}% CONF.</span>
                            </div>
                            <p className="text-zinc-200 italic p-2 bg-zinc-900 rounded border border-zinc-800">
                              "{audioSmokeResult.transcriptPreview}"
                            </p>
                            <p className="text-[9px] text-zinc-500">Lingua: <span className="text-zinc-300">{audioSmokeResult.spokenLanguage}</span></p>
                          </div>
                        ) : (
                          <p className="text-red-400 leading-tight">{audioSmokeResult.errorReason}</p>
                        )}
                        <button 
                          onClick={() => setAudioSmokeResult(null)}
                          className="mt-2 w-full py-1 text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-black"
                        >
                          Chiudi Risultato Test
                        </button>
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Gemini Upload Smoke Test */}
                  <div className="space-y-2 mb-4">
                    <button
                      onClick={handleGeminiUploadSmokeTest}
                      disabled={isGeminiUploadSmokeTesting}
                      className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${
                        isGeminiUploadSmokeTesting 
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed' 
                          : 'bg-emerald-600/10 border-emerald-500/30 hover:bg-emerald-600/20 text-emerald-400 hover:border-emerald-500'
                      }`}
                    >
                      {isGeminiUploadSmokeTesting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {geminiUploadSmokeProgress || "Testing..."}
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Gemini Upload Smoke Test
                        </>
                      )}
                    </button>

                    {geminiUploadSmokeResult && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-3 bg-zinc-950 rounded-xl border border-emerald-500/20 text-[10px] font-mono shadow-xl shadow-emerald-900/10"
                      >
                        <div className="flex justify-between items-center pb-2 mb-2 border-b border-zinc-800/50">
                          <span className="text-zinc-500">DIAGNOSI UPLOAD:</span>
                          <span className={geminiUploadSmokeResult.success ? "text-emerald-400" : "text-red-400"}>
                            {geminiUploadSmokeResult.success ? "SUPERATO" : "FALLITO"}
                          </span>
                        </div>
                        
                        {geminiUploadSmokeResult.success ? (
                          <div className="space-y-2 text-zinc-300">
                            <div>
                              <p className="text-emerald-400 font-bold">Variante Vincente: {geminiUploadSmokeResult.variant}</p>
                              <p className="text-zinc-400 truncate mt-1">URI: {geminiUploadSmokeResult.uri}</p>
                              <p className="text-[9px] text-zinc-500 mt-0.5">Mime: {geminiUploadSmokeResult.mimeType} | Stato: ACTIVE</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-red-400 leading-tight">{geminiUploadSmokeResult.error || "Tutte le varianti sono fallite."}</p>
                        )}
                        <button 
                          onClick={() => setGeminiUploadSmokeResult(null)}
                          className="mt-2 w-full py-1 text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-black"
                        >
                          Chiudi Risultato Test
                        </button>
                      </motion.div>
                    )}
                  </div>

                  {/* Video Trimmer */}
                  {videoSrc && (
                    <div className="space-y-4">
                      <VideoTrimmer 
                        key={videoSrc}
                        src={videoSrc}
                        initialRange={videoRange}
                        onRangeChange={(start, end) => setVideoRange({ start, end })}
                      />
                      
                      {videoRange && (
                        <div className="space-y-3">
                          {!isVirtualTrimmed && !isTrimming && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={handleTrim}
                                className="py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all border border-zinc-700 text-xs"
                              >
                                <Scissors className="w-3 h-3" />
                                Taglio Fisico
                              </button>
                              <button
                                onClick={() => setIsVirtualTrimmed(true)}
                                className="py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl font-medium flex items-center justify-center gap-2 transition-all border border-emerald-500/30 text-xs"
                              >
                                <Zap className="w-3 h-3" />
                                Taglio Virtuale
                              </button>
                            </div>
                          )}

                          {(isTrimming || isVirtualTrimmed) && (
                            <div
                              className={`w-full py-3 ${isTrimming ? 'bg-zinc-800/50' : 'bg-emerald-500/20 border-emerald-500/50'} text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all border ${isVirtualTrimmed ? 'border-emerald-500/50' : 'border-zinc-700'}`}
                            >
                              {isTrimming ? (
                                <div className="flex flex-col items-center gap-2 py-1">
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {trimProgress === 0 
                                      ? "Avvio motore video..." 
                                      : `Taglio in corso... ${trimProgress}%`}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(window.location.href, '_blank');
                                    }}
                                    className="mt-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-[10px] uppercase tracking-wider rounded-lg border border-white/10 transition-colors"
                                  >
                                    Blocca? Apri in nuova scheda
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-emerald-400">
                                  <CheckCircle2 className="w-5 h-5" />
                                  <span className="uppercase tracking-widest font-black">TAGLIO VIRTUALE PRONTO</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {isVirtualTrimmed && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center"
                            >
                              <p className="text-[11px] text-emerald-400/80 leading-tight">
                                <b>OK!</b> Il segmento Ã¨ stato bloccato virtualmente.<br/>
                                L'IA analizzerÃ  solo la parte scelta risparmiando token.
                              </p>
                              <button 
                                onClick={() => setIsVirtualTrimmed(false)}
                                className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                              >
                                Annulla e riprova
                              </button>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink-0 mx-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Oppure / E</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            {/* Text Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4" />
                  {(analysisMode === 'estimate' || analysisMode === 'anti-ai-slop') 
                    ? (file || savedVideoData || originalPrompt.trim() ? 'Contesto aggiuntivo (Opzionale)' : 'Descrizione dell\'idea o del prompt da curare') 
                    : "Descrizione dell'idea"}
                </label>
                {description && (
                  <button
                    onClick={() => setDescription('')}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Svuota
                  </button>
                )}
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={(analysisMode === 'estimate' || analysisMode === 'anti-ai-slop') ? "Es: Questo video parla di come preparare il caffÃ¨..." : "Es: Un video su come preparare un caffÃ¨ perfetto, ma con un colpo di scena finale..."}
                className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all placeholder:text-zinc-600"
              />
            </div>
          </>
        )}
        <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Piattaforma Target
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['TikTok', 'IG Reels', 'YT Shorts'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all border ${
                      platform === p 
                        ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Niche Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Nicchia di riferimento (Opzionale)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Es: Fitness, Finanza Personale, Cucina, Tech..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all placeholder:text-zinc-600"
                />
                {niche && (
                  <button
                    onClick={() => setNiche('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Bypass Toggle */}
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800/80 rounded-lg">
                  <Shield className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Bypass Nomi Famosi (Anti-Blocco)</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Usa solo il nome di battesimo per evitare censure AI (es. "Checco")</p>
                </div>
              </div>
              <button
                onClick={() => setUseBypass(!useBypass)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
                  useBypass ? 'bg-red-500' : 'bg-zinc-700'
                }`}
                role="switch"
                aria-checked={useBypass}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    useBypass ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Algo+CuriositÃ  Toggle */}
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800/80 rounded-lg">
                  <Eye className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Algo+CuriositÃ </p>
                  <p className="text-xs text-zinc-500 mt-0.5">Aggiunge uno spettatore reattivo nella scena per aumentare l'empatia</p>
                </div>
              </div>
              <button
                onClick={() => setAlgoCuriosity(!algoCuriosity)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
                  algoCuriosity ? 'bg-red-500' : 'bg-zinc-700'
                }`}
                role="switch"
                aria-checked={algoCuriosity}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    algoCuriosity ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Escalation Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl ring-1 ring-orange-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg relative">
                  <RefreshCcw className="w-4 h-4 text-orange-400" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-orange-100">ModalitÃ  Escalation (24s)</p>
                    <span className="px-1.5 py-0.5 rounded bg-orange-500 text-[10px] font-black text-zinc-950 uppercase tracking-tighter">New</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Struttura multi-prompt (2x 15s) con Sincronismo Vocale e Testi a Schermo (LEVEL 1, 2, BOSS)</p>
                </div>
              </div>
              <button
                onClick={() => setIsEscalation(!isEscalation)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
                  isEscalation ? 'bg-orange-500' : 'bg-zinc-700'
                }`}
                role="switch"
                aria-checked={isEscalation}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isEscalation ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Viral Engine Mode Toggle (OFF / AUTO / HARD) */}
            <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-2xl ring-1 ring-red-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg relative">
                  <Rocket className="w-4 h-4 text-red-400" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-red-100">ModalitÃ  Viral Engine</p>
                    <span className="px-1.5 py-0.5 rounded bg-red-500 text-[10px] font-black text-zinc-950 uppercase tracking-tighter">Final</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {externalDataInfluence === 'OFF' 
                      ? "OFF: Prompt grezzo, fedele all'originale (100% DNA)" 
                      : externalDataInfluence === 'HARD'
                        ? "HARD: Trasformazione virale aggressiva (Spinta massima)"
                        : "AUTO: Ottimizzazione bilanciata (70% DNA / 30% Trend)"}
                  </p>
                </div>
              </div>
              <div className="flex bg-zinc-800 p-1 rounded-lg border border-zinc-700">
                <button
                  onClick={() => setExternalDataInfluence('OFF')}
                  className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${
                    externalDataInfluence === 'OFF' 
                      ? "bg-zinc-700 text-white shadow-lg" 
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  OFF
                </button>
                <button
                  onClick={() => setExternalDataInfluence('AUTO')}
                  className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${
                    externalDataInfluence === 'AUTO' 
                      ? "bg-red-500 text-white shadow-lg" 
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  AUTO
                </button>
                <button
                  onClick={() => setExternalDataInfluence('HARD')}
                  className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${
                    externalDataInfluence === 'HARD' 
                      ? "bg-orange-600 text-white shadow-lg" 
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  HARD
                </button>
              </div>
            </div>

            {/* External Market Data Toggle & Key Source */}
            <div className="flex flex-col p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl ring-1 ring-blue-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 pr-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg relative shrink-0">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-blue-100">Validazione Mercato Esterno (YouTube)</p>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">Cerca video comparabili per validare il contesto di mercato. Se disattivata, usa la modalitÃ  NO_DATA.</p>
                  </div>
                </div>
                <button
                  onClick={() => setUseExternalMarketData(!useExternalMarketData)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
                    useExternalMarketData ? 'bg-blue-500' : 'bg-zinc-700'
                  }`}
                  role="switch"
                  aria-checked={useExternalMarketData}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      useExternalMarketData ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              
              {useExternalMarketData && (
                 <div className="mt-4 pt-4 border-t border-blue-500/10 flex flex-col gap-2 relative">
                    <input
                      type="password"
                      value={youtubeApiKey}
                      onChange={(e) => setYoutubeApiKey(e.target.value)}
                      placeholder="YouTube API Key (richiesta per il funzionamento)"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-2 pl-3 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-white placeholder:text-zinc-600"
                    />
                    <p className="text-[10px] text-zinc-500 italic">Senza una chiave YouTube valida, l'estrazione dati non produrrÃ  alcun risultato utile.</p>
                 </div>
              )}
            </div>

            <ApiHealthCheckPanel youtubeApiKey={youtubeApiKey} />

            {/* Spin-Off Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl ring-1 ring-indigo-500/10">
              <div className="flex items-center gap-3 pr-2">
                <div className="p-2 bg-indigo-500/20 rounded-lg relative shrink-0">
                  <Lightbulb className="w-4 h-4 text-indigo-400" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-indigo-100">Cambio Idea Obbligatorio</p>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500 text-[10px] font-black text-zinc-950 uppercase tracking-tighter shrink-0">New</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">L'IA inventerÃ  una variante originale (spin-off) mantenendo lo stesso spirito</p>
                </div>
              </div>
              <button
                onClick={() => setSpinOffMode(!spinOffMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
                  spinOffMode ? 'bg-indigo-500' : 'bg-zinc-700'
                }`}
                role="switch"
                aria-checked={spinOffMode}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    spinOffMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Viral Boost 50k+ Toggle */}
            <div className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl ring-1 ring-emerald-500/10">
              <div className="flex items-center gap-3 pr-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg relative shrink-0">
                  <Rocket className="w-4 h-4 text-emerald-400" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-emerald-100">Boost 50k+ Views</p>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-[10px] font-black text-zinc-950 uppercase tracking-tighter shrink-0">Pro</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Applica ritenzione estrema, easter egg visivi e loop ipnotico forzato</p>
                </div>
              </div>
              <button
                onClick={() => setViralBoost50k(!viralBoost50k)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
                  viralBoost50k ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
                role="switch"
                aria-checked={viralBoost50k}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    viralBoost50k ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Altre Diagnostiche se necessario */}
            <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800 rounded-lg">
                  <Activity className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300 uppercase tracking-tighter">Stato Motore</p>
                  <p className="text-[10px] text-zinc-500">Tutti i sistemi nominali</p>
                </div>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex flex-col gap-3"
              >
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-medium transition-colors border border-red-500/30"
                  >
                    Apri in nuova scheda
                  </button>
                  
                  {error.includes("FFmpeg") && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={async () => {
                          try {
                            setError("Resetting FFmpeg engine...");
                            await resetFFmpeg();
                            setError(null);
                          } catch (err) {
                            console.error("Failed to reset FFmpeg:", err);
                          }
                        }}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-medium transition-colors border border-red-500/30"
                      >
                        Reset Motore Video
                      </button>
                      <button
                        onClick={() => {
                          setSkipFFmpeg(true);
                          setVideoRange(null);
                          setError(null);
                          // This will disable FFmpeg for the rest of the session
                        }}
                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg text-xs font-medium transition-colors border border-amber-500/30"
                      >
                        Disattiva FFmpeg (Usa Virtual Trim)
                      </button>
                      <button
                        onClick={() => {
                          setVideoRange(null);
                          setError(null);
                        }}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 rounded-lg text-xs font-medium transition-colors border border-emerald-500/30"
                      >
                        Procedi senza tagliare
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleStop}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold uppercase tracking-tighter flex items-center gap-2 transition-all border border-zinc-700"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    Resetta Stato App
                  </button>
                </div>

                {(error.includes("Network") || error.includes("WebSocket") || error.includes("timeout") || error.includes("connessione")) && (
                  <button
                    onClick={() => handleGenerate(true)}
                    className="self-start px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-bold uppercase tracking-tighter flex items-center gap-2 transition-all"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    Riprova Analisi (Protocollo HTTP Fallback)
                  </button>
                )}
              </motion.div>
            )}

            {genre === 'Auto-Detect' && !isLoading && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-4 py-3 bg-amber-500/10 border border-amber-500/40 rounded-2xl shadow-[0_0_15px_rgba(245,158,11,0.1)]"
              >
                <p className="text-[11px] text-amber-400 leading-tight flex items-start gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
                  <span>
                    <span className="font-black uppercase tracking-tighter mr-1">Rilevamento Auto:</span>
                    Nessun genere selezionato. L'IA analizzerÃ  il video per identificare il genere corretto. **Il selettore tornerÃ  in questa modalitÃ  dopo ogni analisi.**
                  </span>
                </p>
              </motion.div>
            )}

            {/* Pannello Pomelli */}
            <div className="mb-6">
              <button
                onClick={() => setShowPomelli(!showPomelli)}
                className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  showPomelli 
                    ? 'bg-zinc-800/50 border-zinc-700 text-white' 
                    : 'bg-zinc-900/30 border-zinc-800/50 text-zinc-400 hover:bg-zinc-800/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${showPomelli ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold">Pannello Pomelli (Fine-Tuning)</div>
                    <div className="text-[10px] text-zinc-500">Regola creativitÃ , intensitÃ  e dettaglio</div>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${showPomelli ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showPomelli && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-5 bg-zinc-900/50 border-x border-b border-zinc-800 rounded-b-2xl space-y-6">
                      {/* Creativity */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                            <Brain className="w-4 h-4 text-purple-400" />
                            CreativitÃ 
                          </div>
                          <span className="text-xs font-mono text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">{pomelli.creativity}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={pomelli.creativity}
                          onChange={(e) => setPomelli({ ...pomelli, creativity: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-[9px] text-zinc-600 font-medium uppercase">
                          <span>Letterale</span>
                          <span>Fantasioso</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight italic">
                          Determina quanto l'IA puÃ² spaziare con l'immaginazione rispetto alla tua idea base.
                        </p>
                      </div>

                      {/* Viral Intensity */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                            <TrendingUp className="w-4 h-4 text-yellow-400" />
                            IntensitÃ  Virale
                          </div>
                          <span className="text-xs font-mono text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">{pomelli.viralIntensity}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={pomelli.viralIntensity}
                          onChange={(e) => setPomelli({ ...pomelli, viralIntensity: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                        <div className="flex justify-between text-[9px] text-zinc-600 font-medium uppercase">
                          <span>Naturale</span>
                          <span>Aggressivo</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight italic">
                          Regola la forza dei ganci (hook) e la densitÃ  di elementi cattura-attenzione.
                        </p>
                      </div>

                      {/* Visual Detail */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                            <Eye className="w-4 h-4 text-blue-400" />
                            Dettaglio Visivo
                          </div>
                          <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">{pomelli.visualDetail}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={pomelli.visualDetail}
                          onChange={(e) => setPomelli({ ...pomelli, visualDetail: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[9px] text-zinc-600 font-medium uppercase">
                          <span>Essenziale</span>
                          <span>Iper-Realista</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight italic">
                          Definisce la precisione tecnica di lenti, luci e texture nel prompt video.
                        </p>
                      </div>

                      {/* Narrative Chaos */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                            <Zap className="w-4 h-4 text-red-400" />
                            Caos Narrativo
                          </div>
                          <span className="text-xs font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">{pomelli.narrativeChaos}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={pomelli.narrativeChaos}
                          onChange={(e) => setPomelli({ ...pomelli, narrativeChaos: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                        <div className="flex justify-between text-[9px] text-zinc-600 font-medium uppercase">
                          <span>Lineare</span>
                          <span>Imprevedibile</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight italic">
                          Aggiunge elementi di disturbo, glitch o twist inaspettati alla narrazione.
                        </p>
                      </div>

                      {/* Realismo Copertina */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                            <Image className="w-4 h-4 text-emerald-400" />
                            Realismo Copertina (Anti-AI Slop)
                          </div>
                          <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{pomelli.coverRealism}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={pomelli.coverRealism}
                          onChange={(e) => setPomelli({ ...pomelli, coverRealism: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-[9px] text-zinc-600 font-medium uppercase">
                          <span>Stilizzata</span>
                          <span>Iper-Reale (UGC)</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight italic">
                          Elimina l'effetto "plastica" dell'IA per un look da smartphone reale (UGC).
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setAnalysisMode('production-flow')}
                className="w-full h-12 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
              >
                <Brain className="w-5 h-5" />
                Guida Intelligente
              </button>

              <div className="relative group">
                <button
                  onClick={() => {
                    const ctx = {
                      hasReferenceFile: !!file || !!savedVideoData,
                      hasVideoFile: (!!file && file.type?.startsWith('video/')) || (!!savedVideoData),
                      filePresent: !!file,
                      hasSavedVideo: !!savedVideoData,
                      fileName: file?.name || savedVideoData?.fileName || null,
                      fileType: file?.type || savedVideoData?.mimeType || null,
                      fileSizeMB: file ? (file.size / (1024 * 1024)).toFixed(2) : (savedVideoData ? "N/A (DB)" : null),
                      objectiveLength: description.length,
                      castLength: (wizardAnswers?.cast || "").length,
                      mode: modelTier,
                      selectedMode: analysisMode,
                      functionTarget: "handleGenerate"
                    };
                    logger.info("[ANALYSIS_BUTTON_CLICK_CONTEXT]", ctx);
                    
                    // [VIDEO_SOURCE_RESOLUTION] LOGIC
                    const hasFileObject = !!file && file.type?.startsWith('video/');
                    const hasSavedVideo = !!savedVideoData && (savedVideoData.mimeType?.startsWith('video/') || !!savedVideoData.base64);
                    const resolvedVideoAvailable = hasFileObject || hasSavedVideo;
                    
                    let resolvedVideoSource: "file_object" | "saved_video_data" | "none" = "none";
                    if (hasFileObject) resolvedVideoSource = "file_object";
                    else if (hasSavedVideo) resolvedVideoSource = "saved_video_data";

                    const routingTarget = (resolvedVideoAvailable || analysisMode === 'pensaci-tu') ? "VIDEO" : "TEXT_ONLY";

                    logger.info("[VIDEO_SOURCE_RESOLUTION]", {
                      fileObjectAvailable: !!file,
                      savedVideoAvailable: !!savedVideoData,
                      resolvedVideoAvailable,
                      resolvedVideoSource,
                      resolvedMimeType: file?.type || savedVideoData?.mimeType || null,
                      resolvedFileName: file?.name || savedVideoData?.fileName || null,
                      routingTarget
                    });

                    // MODIFICA RICHIESTA 2 - BLOCCO SE SAVED VIDEO ESISTE MA NON Ãˆ UTILIZZABILE
                    if (!!savedVideoData && !savedVideoData.base64 && !file) {
                       logger.error("[VIDEO_SOURCE_UNAVAILABLE]", {
                         reason: "savedVideoData metadata exists but binary/base64/blob is missing",
                         fileName: savedVideoData.fileName,
                         fileType: savedVideoData.mimeType
                       });
                       setError("Video rilevato nella sessione, ma i dati del file non sono piÃ¹ disponibili. Ricarica il video per evitare un'analisi TEXT ONLY errata.");
                       return;
                    }

                    if (routingTarget === "VIDEO") {
                      logger.info("[App] Routing force to VIDEO branch");
                    } else {
                      logger.info("[App] Routing to TEXT_ONLY branch");
                    }

                    const shouldForceScriptPromptPhase =
                      analysisMode !== 'pensaci-tu' &&
                      analysisMode !== 'estimate' &&
                      analysisMode !== 'anti-ai-slop' &&
                      analysisMode !== 'trend-hunter' &&
                      analysisMode !== 'hook-test' &&
                      analysisMode !== 'viral-hook-bulk';

                    if (shouldForceScriptPromptPhase && modelTier === 'groq') {
                      logger.info("[SCRIPT_PROMPT_PHASE_FORCED]", {
                        groqFullPhase: "prompt",
                        source: "script_perfeziona_prompt_button"
                      });
                    }

                    handleGenerate(
                      false,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      shouldForceScriptPromptPhase && modelTier === 'groq' ? 'prompt' : undefined
                    );
                  }}
                  disabled={isLoading || (
                    analysisMode === 'pensaci-tu' ? false :
                    analysisMode === 'trend-hunter' ? !trendNiche.trim() :
                    analysisMode === 'hook-test' ? (!hookA.trim() || !hookB.trim()) :
                    analysisMode === 'viral-hook-bulk' ? (!trendNiche.trim() || !description.trim()) :
                    (analysisMode === 'estimate' || analysisMode === 'anti-ai-slop') 
                      ? (estimateInputType === 'video' ? (!file && !savedVideoData && !description.trim()) : (!originalPrompt.trim() && !description.trim())) 
                      : (!file && !savedVideoData && !description.trim())
                  )}
                  className={`w-full h-12 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    analysisMode === 'pensaci-tu'
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-950'
                      : analysisMode === 'estimate' 
                      ? 'bg-amber-500 hover:bg-amber-400 text-amber-950' 
                      : analysisMode === 'anti-ai-slop'
                      ? 'bg-red-500 hover:bg-red-400 text-red-950'
                      : analysisMode === 'trend-hunter'
                      ? 'bg-blue-500 hover:bg-blue-400 text-blue-950'
                      : analysisMode === 'hook-test'
                      ? 'bg-purple-500 hover:bg-purple-400 text-purple-950'
                      : analysisMode === 'viral-hook-bulk'
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-zinc-100 hover:bg-white text-zinc-950'
                  }`}
                >
                  {isLoading && !feedback ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {analysisMode === 'viral-hook-bulk' ? 'Generazione...' : (analysisMode === 'estimate' || analysisMode === 'anti-ai-slop') ? 'Analisi...' : 'Generazione...'}
                    </>
                  ) : (
                    <>
                      {analysisMode === 'pensaci-tu' ? <Sparkles className="w-5 h-5" /> : analysisMode === 'estimate' ? <TrendingUp className="w-5 h-5" /> : analysisMode === 'anti-ai-slop' ? <ShieldAlert className="w-5 h-5" /> : analysisMode === 'trend-hunter' ? <Search className="w-5 h-5" /> : analysisMode === 'hook-test' ? <Target className="w-5 h-5" /> : analysisMode === 'viral-hook-bulk' ? <Zap className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                      {analysisMode === 'pensaci-tu' ? 'Genera Video Virale' : analysisMode === 'estimate' ? 'Stima Visualizzazioni' : analysisMode === 'anti-ai-slop' ? 'Cura Anti-AI Slop' : analysisMode === 'trend-hunter' ? 'Trend Hunter' : analysisMode === 'hook-test' ? 'Hook A/B Test' : analysisMode === 'viral-hook-bulk' ? 'Genera 10 Ganci' : 'Perfeziona Prompt'}
                    </>
                  )}
                </button>
                
                {/* Manual unlock button removed from here as it is now in the loading overlay */}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Output Section */}
        {analysisMode !== 'production-flow' && (
          <div className="lg:col-span-7">
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-6 lg:p-8 min-h-[600px] relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            
            <AnimatePresence mode="wait">
              {!result && !isLoading && !isTrimming && (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center text-zinc-500 min-h-[500px]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                    {error ? <ShieldAlert className="w-8 h-8 text-red-500" /> : <Sparkles className="w-8 h-8 text-zinc-700" />}
                  </div>
                  <p className="font-medium text-zinc-400">
                    {error ? "Errore nell'Analisi" : "Nessun prompt generato"}
                  </p>
                  <p className="text-sm mt-1 max-w-xs">
                    {error ? "Si Ã¨ verificato un problema tecnico. Controlla il messaggio sopra per i dettagli." : "Carica un video o scrivi un'idea per generare lo script perfetto."}
                  </p>
                </motion.div>
              )}

              {isTrimming && (
                <motion.div 
                  key="trimming"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center min-h-[500px]"
                >
                  <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-zinc-800 border-t-red-500 rounded-full animate-spin"></div>
                    <Scissors className="w-10 h-10 text-red-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  
                  <div className="flex flex-col items-center w-full max-w-md px-6">
                    <div className="w-full px-6 py-3 bg-red-500/20 border-2 border-red-500/50 rounded-2xl text-red-400 text-lg font-black tracking-widest animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)] mb-4">
                      {trimProgress === 0 ? "AVVIO MOTORE VIDEO..." : `TAGLIO IN CORSO: ${trimProgress}%`}
                    </div>
                    
                    <p className="text-zinc-400 mb-6">
                      {trimProgress === 0 
                        ? "Inizializzazione FFmpeg (potrebbe richiedere tempo nell'iframe)..." 
                        : "Elaborazione dei segmenti video per l'analisi forense."}
                    </p>

                    <button
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white text-sm font-bold uppercase tracking-widest rounded-xl border border-white/20 transition-all flex items-center gap-2 mb-4"
                    >
                      <Unlock className="w-4 h-4" />
                      Sblocca: Apri in nuova scheda
                    </button>

                    <button
                      onClick={() => {
                        setIsTrimming(false);
                        setError(null);
                      }}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-tighter rounded-xl border border-red-500/20 transition-all flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Interrompi Taglio
                    </button>
                    
                    <p className="text-[10px] text-zinc-500 max-w-xs">
                      Se l'avanzamento rimane a 0% per piÃ¹ di 30 secondi, l'ambiente iframe sta bloccando il motore. Clicca il pulsante sopra per continuare.
                    </p>
                  </div>
                </motion.div>
              )}

              {isLoading && (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center min-h-[500px]"
                >
                  <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-4" />
                  
                  {loadingText.includes('Chiamata') || 
                   loadingText.includes('Segmento') || 
                   loadingText.includes('Analisi') || 
                   loadingText.includes('Limite') ||
                   loadingText.includes('Google') ||
                   loadingText.includes('File pronto') ||
                   loadingText.includes('Sincronizzazione') ||
                   loadingText.includes('Re-upload') ||
                   loadingText.includes('Connessione') ||
                   loadingText.includes('Elaborazione') ||
                   loadingText.includes('Estrazione') ||
                   loadingText.includes('Generazione') ||
                   loadingText.includes('Sanitizzazione') ||
                   loadingText.includes('Controllo') ||
                   loadingText.includes('Locale') ||
                   loadingText.includes('Caricamento') ||
                   loadingText.includes('Upload') ||
                   loadingText.includes('Inizializzazione') ? (
                    <div className="flex flex-col items-center w-full max-w-md">
                      <div className="w-full px-6 py-2 mb-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                        <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">Protocollo</span>
                        <div className="flex items-center gap-2">
                          <Activity className="w-3 h-3 text-purple-400" />
                          <span className="text-xs font-black tracking-tighter text-purple-200">{pipelineMode.replace('_', ' ')}</span>
                        </div>
                      </div>

                      <div className="w-full px-6 py-3 bg-emerald-500/20 border-2 border-emerald-500/50 rounded-2xl text-emerald-400 text-lg font-black tracking-widest animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.2)] mb-4">
                        {loadingText.toUpperCase()}
                      </div>
                      
                      {uploadProgress !== null && (
                        <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden mb-4 border border-zinc-700">
                          <motion.div 
                            className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium text-zinc-300 animate-pulse">{loadingText}</p>
                  )}
                  
                  <p className="text-sm text-zinc-500 mt-2 text-center px-4">L'elaborazione delle analisi (algoritmo, hook, loop) puÃ² impiegare fino a 3-5 minuti, per favore resta su questa pagina.</p>
                  
                  <div className="mt-4 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800/50 border border-zinc-700 rounded-full text-[10px] font-mono text-zinc-400">
                        <Clock className="w-3 h-3" />
                        <span>Tempo trascorso: {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800/50 border border-zinc-700 rounded-full text-[10px] font-mono text-purple-400">
                        <Activity className="w-3 h-3" />
                        <span className="font-bold">Pipeline: {pipelineMode}</span>
                      </div>
                    </div>

                    {elapsedSeconds > 10 && (
                      <button
                        onClick={handleStop}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-tighter rounded-xl border border-red-500/20 transition-all flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Interrompi e Resetta
                      </button>
                    )}
                  </div>

                  <div className="mt-6 w-full max-w-xs space-y-1">
                    {recentLogs.map((log, i) => (
                      <div key={i} className={`text-[10px] font-mono truncate ${i === 0 ? 'text-emerald-400/80' : 'text-zinc-500/60'}`}>
                        {i === 0 ? '> ' : '  '}{log}
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl max-w-xs text-center">
                    <p className="text-[10px] text-red-400/70 font-bold uppercase tracking-tighter mb-2">Sblocco Emergenza (Solo se bloccato)</p>
                    <button
                      onClick={() => {
                        localStorage.clear();
                        window.location.reload();
                      }}
                      className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-[10px] font-black uppercase transition-all"
                    >
                      Reset Totale Sessione
                    </button>
                  </div>
                  
                  {/* Pipeline Steps Progress Checklist */}
                  <AnalysisProgress steps={pipelineSteps} />

                  {/* Partial Technical Info during loading */}
                  {Object.keys(partialProtocol).length > 0 && (
                    <AnalysisTechnicalSummary result={partialProtocol as ResultData} isCompact={true} />
                  )}
                  
                  {isTakingLong && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl max-w-sm"
                    >
                      <p className="text-sm text-orange-400 font-medium mb-1">L'analisi sta richiedendo piÃ¹ tempo del previsto.</p>
                      <p className="text-xs text-orange-500/80 mb-4">Il video potrebbe essere molto grande o i server sono sovraccarichi. Attendi, non chiudere la pagina.</p>
                      
                      <button
                        onClick={() => {
                          stopLoading();
                          setError("Analisi interrotta manualmente dall'utente.");
                          isAnalyzingRef.current = false;
                          resetQuotaStatus();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-orange-500/20"
                      >
                        <Unlock className="w-3 h-3" />
                        SBLOCCA ANALISI
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {result && !isLoading && (
                <ResultRenderBoundary>
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 space-y-8"
                  >
                  {/* Model usage summary for full visibility */}
                  <ModelExecutionStatus trace={globalModelTrace} />

                  {/* Technical Analysis Summary */}
                  <AnalysisTechnicalSummary result={(compactResultForUi || result) as ResultData} />

                  {/* Trend Hunter Result */}
                  {(analysisMode === 'trend-hunter' || analysisMode === 'hook-test') && result.trends && result.trends.length > 0 && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Search className="w-5 h-5 text-blue-400" />
                          </div>
                          <h3 className="text-xl font-bold text-blue-100">Trend Hunter: {trendNiche}</h3>
                        </div>
                        {analysisMode === 'trend-hunter' && (
                          <button 
                            onClick={() => setAnalysisMode('hook-test')}
                            className="text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-all flex items-center gap-2"
                          >
                            <Target className="w-3 h-3" />
                            Vai a Hook Test
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {result.trends.map((trend, index) => (
                          <div key={index} className="p-5 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-blue-500/30 transition-all group relative">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${
                                    trend.type === 'Hook' ? 'bg-red-500 text-white' : 
                                    trend.type === 'Audio' ? 'bg-purple-500 text-white' :
                                    trend.type === 'Argomento' ? 'bg-blue-500 text-white' :
                                    'bg-green-500 text-white'
                                  }`}>
                                    {trend.type}
                                  </span>
                                  <h4 className="text-sm font-bold text-zinc-100">{trend.title}</h4>
                                </div>
                                <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                                  {trend.description}
                                </p>
                                
                                {/* Selection Buttons for A/B Test */}
                                <div className="flex gap-2 mt-4">
                                  <button
                                    onClick={() => {
                                      setHookA(trend.description);
                                      if (analysisMode !== 'hook-test') setAnalysisMode('hook-test');
                                    }}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                                      hookA === trend.description 
                                        ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20' 
                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-red-500/50 hover:text-red-400'
                                    }`}
                                  >
                                    {hookA === trend.description ? <Check className="w-3 h-3" /> : <Target className="w-3 h-3" />}
                                    Usa come Hook A
                                  </button>
                                  <button
                                    onClick={() => {
                                      setHookB(trend.description);
                                      if (analysisMode !== 'hook-test') setAnalysisMode('hook-test');
                                    }}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                                      hookB === trend.description 
                                        ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/20' 
                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-purple-500/50 hover:text-purple-400'
                                    }`}
                                  >
                                    {hookB === trend.description ? <Check className="w-3 h-3" /> : <Target className="w-3 h-3" />}
                                    Usa come Hook B
                                  </button>
                                </div>

                                {trend.source && (
                                  <a 
                                    href={trend.source.startsWith('http') ? trend.source : `https://google.com/search?q=${encodeURIComponent(trend.source)}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 mt-3 inline-flex"
                                  >
                                    <Download className="w-3 h-3 rotate-[-90deg]" />
                                    Fonte: {(() => {
                                      try {
                                        return new URL(trend.source).hostname;
                                      } catch (e) {
                                        return trend.source;
                                      }
                                    })()}
                                  </a>
                                )}
                              </div>
                              <CopyButton 
                                text={`${trend.title}\n${trend.description}`} 
                                className="opacity-0 group-hover:opacity-100"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hook Test Result */}
                  {result.analysisMode === 'hook-test' && result.hookComparison && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                          <Target className="w-5 h-5 text-red-400" />
                        </div>
                        <h3 className="text-xl font-bold text-red-100">Confronto Ganci (Hook A/B)</h3>
                      </div>
                      
                      {/* Winner/Loser Display */}
                      <div className="grid grid-cols-1 gap-4">
                        {/* Winner */}
                        <div className="p-5 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-tighter">
                            Vincitore
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-black text-sm">
                                {result.winner}
                              </div>
                              <p className="text-xs font-bold text-emerald-500/70 uppercase tracking-widest">Hook {result.winner}</p>
                            </div>
                            <div className="text-2xl font-black text-emerald-400">
                              {result.winner === 'A' ? result.scoreA : result.scoreB}
                              <span className="text-xs ml-1 opacity-50">SCORE</span>
                            </div>
                          </div>
                          <p className="text-lg text-emerald-50 font-medium italic leading-relaxed">
                            "{result.winner === 'A' ? hookA : hookB}"
                          </p>
                        </div>

                        {/* Loser */}
                        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl opacity-60 hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 font-black text-sm">
                                {result.winner === 'A' ? 'B' : 'A'}
                              </div>
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Hook {result.winner === 'A' ? 'B' : 'A'}</p>
                            </div>
                            <div className="text-xl font-black text-zinc-500">
                              {result.winner === 'A' ? result.scoreB : result.scoreA}
                              <span className="text-xs ml-1 opacity-50">SCORE</span>
                            </div>
                          </div>
                          <p className="text-sm text-zinc-400 italic leading-relaxed">
                            "{result.winner === 'A' ? hookB : hookA}"
                          </p>
                        </div>
                      </div>

                      <div className="prose prose-invert max-w-none border-t border-red-500/10 pt-6">
                        <div className="text-red-200/90 leading-relaxed">
                          <Markdown>{String(result.hookComparison || '')}</Markdown>
                        </div>
                      </div>

                      {result.refinedWinner && (
                        <div className="mt-6 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-4 animate-in fade-in zoom-in duration-500">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                            <h4 className="text-lg font-bold text-emerald-100">Il Gancio Definitivo (Ottimizzato)</h4>
                          </div>
                          <div className="p-4 bg-zinc-900/80 rounded-lg border border-emerald-500/30 relative group">
                            <p className="text-emerald-50 font-medium leading-relaxed pr-12">
                              {result.refinedWinner}
                            </p>
                            <CopyButton 
                              text={result.refinedWinner} 
                              className="absolute right-2 top-2"
                            />
                          </div>
                          <p className="text-xs text-emerald-500/70 italic">
                            Questo gancio Ã¨ stato perfezionato unendo la leva psicologica vincente con la tua nicchia specifica ({trendNiche}).
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Viral Hook Bulk Result */}
                  {(analysisMode === 'viral-hook-bulk' || analysisMode === 'hook-test') && result.bulkHooks && result.bulkHooks.length > 0 && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/20 rounded-lg">
                            <Zap className="w-5 h-5 text-red-400" />
                          </div>
                          <h3 className="text-xl font-bold text-red-100">10 Ganci Virali Generati</h3>
                        </div>
                        {analysisMode === 'viral-hook-bulk' && (
                          <button 
                            onClick={() => setAnalysisMode('hook-test')}
                            className="text-xs font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-all flex items-center gap-2"
                          >
                            <Target className="w-3 h-3" />
                            Vai a Hook Test
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {result.bulkHooks.map((hook, index) => (
                          <div key={index} className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-red-500/30 transition-all group">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                    {hook.category}
                                  </span>
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                    Hook #{index + 1}
                                  </span>
                                </div>
                                <p className="text-sm text-zinc-200 font-medium leading-relaxed">
                                  {hook.hook}
                                </p>

                                {/* Selection Buttons for A/B Test */}
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => {
                                      setHookA(hook.hook);
                                      if (analysisMode !== 'hook-test') setAnalysisMode('hook-test');
                                    }}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                                      hookA === hook.hook 
                                        ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20' 
                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-red-500/50 hover:text-red-400'
                                    }`}
                                  >
                                    {hookA === hook.hook ? <Check className="w-3 h-3" /> : <Target className="w-3 h-3" />}
                                    Usa come Hook A
                                  </button>
                                  <button
                                    onClick={() => {
                                      setHookB(hook.hook);
                                      if (analysisMode !== 'hook-test') setAnalysisMode('hook-test');
                                    }}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                                      hookB === hook.hook 
                                        ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/20' 
                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-purple-500/50 hover:text-purple-400'
                                    }`}
                                  >
                                    {hookB === hook.hook ? <Check className="w-3 h-3" /> : <Target className="w-3 h-3" />}
                                    Usa come Hook B
                                  </button>
                                </div>
                              </div>
                              <CopyButton 
                                text={hook.hook} 
                                className="opacity-0 group-hover:opacity-100"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* External Market Data Section */}
                  {result.externalMarketData && result.externalMarketData.status !== 'ERROR' && (
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50 group-hover:bg-blue-500 transition-colors" />
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/20">
                            <Search className="w-5 h-5 text-blue-400" />
                          </div>
                          <h3 className="text-xl font-bold text-blue-100 uppercase tracking-tight">Segnali di Mercato YouTube</h3>
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                          result.externalMarketData.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {result.externalMarketData.status === 'SUCCESS' ? 'REAL DATA' : 'NO DATA MODE'}
                        </div>
                      </div>

                      {result.externalMarketData.status === 'SUCCESS' ? (
                        <div className="space-y-4">
                          <p className="text-sm text-zinc-400 leading-relaxed italic">
                            {result.externalMarketData.marketSummary}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {result.externalMarketData.comparableVideos.slice(0, 4).map((video, idx) => (
                              <a 
                                key={idx}
                                href={video.videoLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-xl hover:bg-zinc-800/50 transition-all group/item"
                              >
                                <div className="flex items-start gap-3">
                                  {video.thumbnail && (
                                    <img 
                                      src={video.thumbnail} 
                                      alt="" 
                                      className="w-16 h-10 object-cover rounded border border-zinc-700"
                                      referrerPolicy="no-referrer"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-zinc-200 truncate group-hover/item:text-blue-400 transition-colors">
                                      {video.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                                      <span className="flex items-center gap-1">
                                        <Eye className="w-3 h-3" />
                                        {typeof video.views === 'number' ? video.views.toLocaleString() : video.views}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Heart className="w-3 h-3" />
                                        {typeof video.likes === 'number' ? video.likes.toLocaleString() : video.likes}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-3">
                          <p className="text-xs text-amber-500/80 leading-relaxed italic">
                            <span className="font-bold uppercase mr-1">Attenzione:</span>
                            Nessun video comparabile trovato su YouTube per questa ricerca. L'analisi procederÃ  in modalitÃ  strutturale senza validazione di mercato esterna.
                          </p>
                          {result.externalMarketData.searchQueries && result.externalMarketData.searchQueries.length > 0 && (
                            <div className="pt-2 border-t border-amber-500/10">
                              <p className="text-[10px] text-zinc-500 uppercase font-black mb-2 tracking-widest">Query di ricerca utilizzate:</p>
                              <div className="flex flex-wrap gap-2">
                                {result.externalMarketData.searchQueries.map((q, i) => (
                                  <span key={i} className="px-2 py-1 bg-zinc-800 rounded text-[10px] text-zinc-400 border border-zinc-700">
                                    {q}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Psychological Analysis Section */}
                  {result.psychologicalAnalysis && (
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                          <Brain className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold text-purple-100">Analisi Psicologica della Ritenzione</h3>
                      </div>
                      <div className="prose prose-invert max-w-none">
                        <div className="text-purple-200/90 text-sm leading-relaxed bg-zinc-900/40 p-4 rounded-xl border border-purple-500/10">
                          <div className="markdown-body">
                            <Markdown components={{
                              a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-purple-400 underline hover:text-purple-300" />
                            }}>{String(result.psychologicalAnalysis || '')}</Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Conscience Exam Section */}
                  {result.conscienceExamIt && (
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50 group-hover:bg-red-500 transition-colors" />
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-red-500/20">
                          <ShieldAlert className="w-5 h-5 text-red-400" />
                        </div>
                        <h3 className="text-xl font-bold text-red-100 uppercase tracking-tight">Esame di Coscienza</h3>
                      </div>
                      <div className="prose prose-invert max-w-none">
                        <div className="text-zinc-300 text-sm leading-relaxed italic bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                          <div className="markdown-body">
                            <Markdown components={{
                              a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-red-400 underline hover:text-red-300" />
                            }}>{result.conscienceExamIt}</Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Trend Hunter Report Section */}
                  {result.trendHunterReport && (
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50 group-hover:bg-emerald-500 transition-colors" />
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-emerald-500/20">
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-emerald-100 uppercase tracking-tight">Trend Hunter Report (Metriche Reali)</h3>
                      </div>
                      <div className="prose prose-invert max-w-none">
                        <div className="text-emerald-50/90 text-sm leading-relaxed bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                          <div className="markdown-body">
                            <Markdown components={{
                              a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300 font-bold" />
                            }}>{result.trendHunterReport}</Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                    {/* Viral Engine Analysis Section */}
                    {result.ideaCore && (
                      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50 group-hover:bg-red-500 transition-colors" />
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/20">
                              <Rocket className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-red-100 uppercase tracking-tight">Viral Engine Analysis</h3>
                          </div>
                          {result.dnaStatus && (
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              result.dnaStatus === 'PRESERVED' 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}>
                              DNA: {result.dnaStatus}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Target className="w-3 h-3" /> Idea Core
                              </h4>
                              <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                                {result.ideaCore}
                              </p>
                            </div>
                            
                            {result.dnaReasoning && (
                              <div>
                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <ShieldCheck className="w-3 h-3" /> DNA Preservation Reasoning
                                </h4>
                                <p className="text-sm text-zinc-400 italic leading-relaxed bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                                  {result.dnaReasoning}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Activity className="w-3 h-3" /> Retention Drops
                              </h4>
                              <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                                {result.retentionDrops}
                              </p>
                            </div>

                            {result.dopamineValidation && (
                              <div>
                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Zap className="w-3 h-3" /> Dopamine Validation
                                </h4>
                                <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                                  {result.dopamineValidation}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4 border-t border-zinc-800/50">
                          {[
                            { label: 'Hook', value: result.analysisHook, icon: Zap },
                            { label: 'Retention', value: result.analysisRetention, icon: Eye },
                            { label: 'Escalation', value: result.analysisEscalation, icon: TrendingUp },
                            { label: 'Payoff', value: result.analysisPayoff, icon: Trophy },
                            { label: 'Loop', value: result.analysisLoop, icon: RefreshCcw }
                          ].map((item, idx) => (
                            <div key={idx} className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50 space-y-2">
                              <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                <item.icon className="w-3 h-3 text-red-500" />
                                {item.label}
                              </div>
                              <p className="text-xs text-zinc-300 leading-tight">
                                {item.value}
                              </p>
                            </div>
                          ))}
                        </div>

                        {result.dopamineHits && result.dopamineHits.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                              <Zap className="w-3 h-3 text-yellow-500" /> Dopamine Hits (Visual/Auditory Triggers)
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {result.dopamineHits.map((hit, idx) => (
                                <div key={idx} className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl flex items-start gap-3">
                                  <span className="text-[10px] font-black text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                    {hit.time}
                                  </span>
                                  <p className="text-xs text-zinc-300 leading-relaxed">
                                    {hit.description}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.dopamineMap && result.dopamineMap.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                              <Activity className="w-3 h-3 text-red-500" /> Dopamine Map (Strategic Flow)
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                              {result.dopamineMap.map((mapItem, idx) => (
                                <div key={idx} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-1 rounded uppercase tracking-tighter shrink-0">
                                      {mapItem.phase}
                                    </span>
                                    <p className="text-xs font-bold text-zinc-200">
                                      {mapItem.event}
                                    </p>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 italic text-right">
                                    {mapItem.reason}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.validationQuestions && result.validationQuestions.length > 0 && (
                          <div className="space-y-3 pt-4 border-t border-zinc-800/50">
                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                              <ShieldCheck className="w-3 h-3 text-emerald-500" /> Viral Validation Checklist
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {result.validationQuestions.map((q, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  <span className="text-xs text-zinc-300 leading-tight">{q}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Analysis Section */}
                    {result.analysis && result.analysisMode !== 'trend-hunter' && result.analysisMode !== 'hook-test' && (
                    <div className={`border rounded-2xl p-6 relative ${result.analysisMode === 'anti-ai-slop' ? 'bg-red-500/5 border-red-500/20' : result.analysisMode === 'pensaci-tu' ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                      {/* Execution Debug Block */}
                      {result.executionDebugBlock && (
                        <div className="mb-6 p-4 bg-zinc-900/80 border border-zinc-700 rounded-xl">
                          <h4 className="text-xs font-black text-zinc-400 mb-3 flex items-center gap-2 uppercase tracking-widest">
                            <ShieldCheck className="w-4 h-4" /> Execution Check (Debug)
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Language:</span>
                              <span className="text-zinc-300 font-bold">{result.executionDebugBlock.detectedLanguage}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Culture:</span>
                              <span className="text-zinc-300 font-bold">{result.executionDebugBlock.culturalContext}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Content Type:</span>
                              <span className="text-zinc-300 font-bold">{result.executionDebugBlock.contentType}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Dominant Entity:</span>
                              <span className="text-zinc-300 font-bold">{result.executionDebugBlock.dominantEntity}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Dialogue Map:</span>
                              <span className={`font-bold ${result.executionDebugBlock.dialogueMappingCheck === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {result.executionDebugBlock.dialogueMappingCheck}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Market Match:</span>
                              <span className={`font-bold ${result.executionDebugBlock.externalDataLanguageMatch === 'PASS' ? 'text-emerald-400' : result.executionDebugBlock.externalDataLanguageMatch === 'FAIL' ? 'text-red-400' : 'text-zinc-400'}`}>
                                {result.executionDebugBlock.externalDataLanguageMatch}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Culture Match:</span>
                              <span className={`font-bold ${result.executionDebugBlock.externalDataCultureMatch === 'PASS' ? 'text-emerald-400' : result.executionDebugBlock.externalDataCultureMatch === 'FAIL' ? 'text-red-400' : 'text-zinc-400'}`}>
                                {result.executionDebugBlock.externalDataCultureMatch}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Cover Prompt:</span>
                              <span className={`font-bold ${result.executionDebugBlock.coverPromptGenerated === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {result.executionDebugBlock.coverPromptGenerated}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Output Completeness:</span>
                              <span className={`font-bold ${result.executionDebugBlock.outputCompletenessCheck === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {result.executionDebugBlock.outputCompletenessCheck}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Score Consistency:</span>
                              <span className={`font-bold ${result.executionDebugBlock.scoreConsistencyCheck === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {result.executionDebugBlock.scoreConsistencyCheck}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Source Integrity:</span>
                              <span className={`font-bold ${result.executionDebugBlock.originalScriptRealityCheck === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {result.executionDebugBlock.originalScriptRealityCheck}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Source Reliability:</span>
                              <span className={`font-bold ${result.executionDebugBlock.sourceReliabilityLevel === 'HIGH' ? 'text-emerald-400' : result.executionDebugBlock.sourceReliabilityLevel === 'MEDIUM' ? 'text-amber-400' : 'text-red-400'}`}>
                                {result.executionDebugBlock.sourceReliabilityLevel}
                              </span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Context Depth:</span>
                              <span className="text-zinc-300 font-bold">{result.executionDebugBlock.sourceContextDepth}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Frame Quality:</span>
                              <span className="text-zinc-300 font-bold">{result.executionDebugBlock.frameCoverageQuality}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-zinc-800/50 rounded">
                              <span className="text-zinc-500">Transcript Conf.:</span>
                              <span className="text-zinc-300 font-bold">{result.executionDebugBlock.transcriptConfidence}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {result.technicalVerification && (
                        <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                          <h4 className="text-xs font-black text-emerald-400 mb-2 flex items-center gap-2 uppercase tracking-widest">
                            <ShieldCheck className="w-4 h-4" /> Technical Validation
                          </h4>
                          <p className="text-xs text-emerald-100/80 leading-relaxed italic">
                            {result.technicalVerification}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${result.analysisMode === 'anti-ai-slop' ? 'bg-red-500/20' : result.analysisMode === 'pensaci-tu' ? 'bg-yellow-500/20' : 'bg-indigo-500/20'}`}>
                            {result.analysisMode === 'anti-ai-slop' ? <ShieldAlert className="w-5 h-5 text-red-400" /> : result.analysisMode === 'pensaci-tu' ? <Sparkles className="w-5 h-5 text-yellow-400" /> : <Target className="w-5 h-5 text-indigo-400" />}
                          </div>
                          <h3 className={`text-xl font-bold ${result.analysisMode === 'anti-ai-slop' ? 'text-red-100' : result.analysisMode === 'pensaci-tu' ? 'text-yellow-100' : 'text-indigo-100'}`}>
                            {result.analysisMode === 'anti-ai-slop' ? 'Cura Anti-AI Slop' : result.analysisMode === 'pensaci-tu' ? 'Idea Virale Generata' : 'Analisi Strategica'}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.modelUsed && (
                            <div className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${
                              result.modelUsed === 'pro' 
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' 
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}>
                              {result.modelUsed === 'pro' ? 'Ã°Å¸Â§Â  Analisi Pro' : 'Ã¢Å¡Â¡ Analisi Flash'}
                            </div>
                          )}
                          <button
                            onClick={async () => {
                              resetQuotaStatus();
                              const btn = document.activeElement as HTMLButtonElement;
                              if (btn) {
                                const oldText = btn.innerText;
                                btn.innerText = "SINCERITÃ€ RIPRISTINATA!";
                                setTimeout(() => btn.innerText = oldText, 2000);
                              }
                            }}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[9px] font-black text-zinc-500 hover:text-red-500 uppercase tracking-widest rounded border border-white/5 transition-colors flex items-center gap-1.5"
                            title="Ripristina lo stato della quota se hai cambiato chiave o aspettato"
                          >
                            <RefreshCcw className="w-2.5 h-2.5" />
                            Reset Quota
                          </button>
                        </div>
                      </div>

                      {result.runtimeTruthStatus && (
                        <div className={`mb-6 p-4 rounded-xl border-2 shadow-lg transition-all animate-in slide-in-from-top-4 duration-500 overflow-hidden relative ${
                          result.runtimeTruthStatus.mode === 'FULL_MODE' 
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-emerald-500/10' 
                            : result.runtimeTruthStatus.severity === 'CRITICAL'
                              ? 'bg-red-500/10 border-red-500/50 text-red-500 shadow-red-500/10'
                              : 'bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-amber-500/10'
                        }`}>
                          <div className="absolute top-0 right-0 p-1 opacity-10">
                             {result.runtimeTruthStatus.mode === 'FULL_MODE' ? <ShieldCheck className="w-16 h-16" /> : result.runtimeTruthStatus.severity === 'CRITICAL' ? <ShieldAlert className="w-16 h-16" /> : <AlertTriangle className="w-16 h-16" />}
                          </div>
                          
                          <div className="flex items-center justify-between mb-2 relative z-10">
                             <div className="flex items-center gap-2">
                               {result.runtimeTruthStatus.mode === 'FULL_MODE' ? <ShieldCheck className="w-5 h-5" /> : result.runtimeTruthStatus.severity === 'CRITICAL' ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                               <span className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded bg-current/10 border border-current/20">
                                 {result.runtimeTruthStatus.mode}
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">
                                 SEVERITY: {result.runtimeTruthStatus.severity}
                               </span>
                               {result.runtimeTruthStatus.fallbackActive && (
                                 <span className="text-[9px] font-black bg-white/10 px-2 py-0.5 rounded text-white border border-white/20 uppercase tracking-widest">
                                   FALLBACK
                                 </span>
                               )}
                             </div>
                          </div>
                          
                          <p className="text-sm font-bold mb-3 relative z-10 leading-tight">
                            {result.runtimeTruthStatus.userMessage}
                          </p>
                          
                          {result.runtimeTruthStatus.failedModules && result.runtimeTruthStatus.failedModules.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-current/20 relative z-10">
                               {result.runtimeTruthStatus.failedModules.map((mod: string, i: number) => (
                                 <span key={i} className="text-[9px] font-black px-2 py-0.5 rounded bg-zinc-900/60 border border-current/30 uppercase tracking-tighter flex items-center gap-1">
                                   <XCircle className="w-2.5 h-2.5" /> {mod}
                                 </span>
                               ))}
                            </div>
                          )}
                          
                          {result.runtimeTruthStatus.reliabilityImpact && (
                            <div className="mt-3 text-[10px] font-medium opacity-80 leading-relaxed bg-black/20 p-2 rounded relative z-10 flex items-start gap-2">
                               <Activity className="w-3 h-3 mt-0.5 shrink-0" />
                               <span><strong>Impatto AffidabilitÃ :</strong> {result.runtimeTruthStatus.reliabilityImpact}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {(result.audioVerified === false ||
                        result.scriptConfidence === 0 ||
                        result.runtimeTruthStatus?.failedModules?.includes("AudioAnchor")) && (
                        <div className="mb-6 p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.12)]">
                          <h4 className="text-xs font-black text-amber-400 mb-2 flex items-center gap-2 uppercase tracking-widest">
                            <AlertTriangle className="w-4 h-4" /> Audio Anchor Warning
                          </h4>
                          <p className="text-sm text-amber-100/90 leading-relaxed font-semibold">
                            Audio non verificato: l&apos;analisi e basata sui frame video. Le battute e i dialoghi non sono affidabili come trascrizione.
                          </p>
                          {result.scriptSourceMode === 'FRAME_VISUAL_DESCRIPTION' && (
                            <p className="mt-2 text-xs text-amber-200/80 leading-relaxed">
                              Lo script originale mostrato e una descrizione visiva, non il parlato reale.
                            </p>
                          )}
                        </div>
                      )}

                      {result.technicalVerification && (
                        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                          <h4 className="text-xs font-black text-amber-500 mb-3 flex items-center gap-2 uppercase tracking-widest">
                            <ShieldCheck className="w-4 h-4" /> Verifica Tecnica di Ricezione (Milano)
                          </h4>
                          <div className="text-sm text-amber-200/90 font-medium leading-relaxed prose prose-invert prose-amber max-w-none">
                            <Markdown>{result.technicalVerification}</Markdown>
                          </div>
                        </div>
                      )}

                      {result.viralScore && (
                        <div className="mb-8 flex flex-col items-center gap-6">
                          <button
                            onClick={() => {
                              setFeedback("Aumentare il Viral Score a 99/100. Analizza spietatamente i punti deboli (ritmo, hook, payoff, loop) e applica le tecniche piÃ¹ estreme per giustificare un punteggio di 99 o 100.");
                              setTimeout(() => handleGenerate(true), 100);
                            }}
                            className={`group relative flex flex-col items-center justify-center p-6 w-full sm:w-auto sm:min-w-[200px] ${result.analysisMode === 'pensaci-tu' ? 'bg-yellow-900/30 hover:bg-yellow-600/40 border-yellow-500/50 hover:border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.2)] hover:shadow-[0_0_50px_rgba(234,179,8,0.4)]' : 'bg-indigo-900/30 hover:bg-indigo-600/40 border-indigo-500/50 hover:border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:shadow-[0_0_50px_rgba(99,102,241,0.4)]'} border-2 rounded-2xl transition-all duration-300 transform hover:scale-105`}
                            title="Clicca per forzare l'IA a riscrivere il prompt e massimizzare il punteggio!"
                          >
                            <div className={`absolute -top-3 ${result.analysisMode === 'pensaci-tu' ? 'bg-yellow-500 text-yellow-950' : 'bg-indigo-500 text-white'} text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg flex items-center gap-1`}>
                              <Rocket className="w-3 h-3" /> Clicca per Boost 99/100
                            </div>
                            <span className={`text-5xl font-black text-transparent bg-clip-text drop-shadow-lg ${result.analysisMode === 'pensaci-tu' ? 'bg-gradient-to-br from-yellow-300 to-amber-400' : 'bg-gradient-to-br from-indigo-300 to-purple-400'}`}>
                              {String(result.viralScore).includes('UNVERIFIED') ? (
                                <span className="text-3xl">UNVERIFIED</span>
                              ) : (
                                <>{String(result.viralScore).split('/')[0]}<span className={`text-3xl ${result.analysisMode === 'pensaci-tu' ? 'text-yellow-500/50' : 'text-indigo-500/50'}`}>/100</span></>
                              )}
                            </span>
                            <span className={`mt-2 text-sm font-bold uppercase tracking-widest transition-colors ${result.analysisMode === 'pensaci-tu' ? 'text-yellow-300/80 group-hover:text-yellow-200' : 'text-indigo-300/80 group-hover:text-indigo-200'}`}>
                              Viral Score
                            </span>
                          </button>

                          {result.spreadabilityScore && (
                            <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-5 duration-700">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className={`p-6 rounded-2xl border-2 transition-all duration-300 bg-emerald-900/30 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)] flex flex-col items-center justify-center relative overflow-hidden group`}>
                                   <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-40 transition-opacity">
                                      <Share2 className="w-12 h-12 text-emerald-500" />
                                   </div>
                                   <div className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500 text-white mb-3 flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                                     <FlaskConical className="w-3 h-3" /> Asse di Distribuzione
                                   </div>
                                   <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 to-teal-400 drop-shadow-lg">
                                     {result.spreadabilityScore}<span className="text-2xl text-emerald-500/50">/10</span>
                                   </div>
                                   <span className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-emerald-300/70">
                                     Spreadability Score
                                   </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                   {[
                                     { label: 'Share Trigger', value: result.shareTrigger, icon: Send },
                                     { label: 'Comment Pressure', value: result.commentPressure, icon: MessageCircle },
                                     { label: 'Relatability', value: result.relatability, icon: Users },
                                     { label: 'Pattern Break', value: result.patternBreak, icon: Zap }
                                   ].map((item, idx) => (
                                     <div key={idx} className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50 flex flex-col items-center justify-center gap-1.5 hover:border-emerald-500/30 transition-all hover:bg-zinc-900/80">
                                       <item.icon className={`w-4 h-4 ${Number(item.value) >= 8 ? 'text-emerald-400' : Number(item.value) >= 6 ? 'text-amber-400' : 'text-red-400'}`} />
                                       <div className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter text-center leading-none">
                                         {item.label}
                                       </div>
                                       <div className="text-xl font-black text-zinc-100 italic">
                                         {item.value}
                                       </div>
                                     </div>
                                   ))}
                                </div>
                              </div>
                              
                              {result.spreadabilityReasoning && (
                                <div className="p-5 bg-zinc-900/60 border border-emerald-500/10 rounded-2xl group hover:border-emerald-500/30 transition-all">
                                   <p className="text-sm text-zinc-300 leading-relaxed italic text-center">
                                     <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Verdict di Distribuzione Reale</span>
                                     "{result.spreadabilityReasoning}"
                                   </p>
                                </div>
                              )}

                              {coerceDisplayText(result.finalPromptVerdict) && (
                                <div className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 animate-in zoom-in-95 duration-500 ${
                                  coerceDisplayText(result.finalPromptVerdict).includes('virale per il tuo video') && !coerceDisplayText(result.finalPromptVerdict).includes('non') 
                                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.3)]' 
                                    : coerceDisplayText(result.finalPromptVerdict).includes('modificato') || coerceDisplayText(result.finalPromptVerdict).includes('buono visivamente')
                                    ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.2)]'
                                    : 'bg-red-500/10 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]'
                                }`}>
                                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg ${
                                    coerceDisplayText(result.finalPromptVerdict).includes('virale per il tuo video') && !coerceDisplayText(result.finalPromptVerdict).includes('non')
                                      ? 'bg-emerald-500 text-white'
                                      : coerceDisplayText(result.finalPromptVerdict).includes('modificato') || coerceDisplayText(result.finalPromptVerdict).includes('buono visivamente')
                                      ? 'bg-amber-500 text-amber-950'
                                      : 'bg-red-500 text-white'
                                  }`}>
                                    Verdetto Finale Operativo
                                  </div>
                                  <h3 className={`text-xl md:text-2xl font-black text-center tracking-tight leading-tight ${
                                    coerceDisplayText(result.finalPromptVerdict).includes('virale per il tuo video') && !coerceDisplayText(result.finalPromptVerdict).includes('non')
                                      ? 'text-emerald-300'
                                      : coerceDisplayText(result.finalPromptVerdict).includes('modificato') || coerceDisplayText(result.finalPromptVerdict).includes('buono visivamente')
                                      ? 'text-amber-300'
                                      : 'text-red-300'
                                  }`}>
                                    {coerceDisplayText(result.finalPromptVerdict)}
                                  </h3>
                                </div>
                              )}

                              {result.humanVerdict && (
                                <div className="p-8 bg-zinc-950/80 border border-zinc-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden backdrop-blur-xl">
                                  <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-100/5 blur-[100px] rounded-full -mr-32 -mt-32" />
                                  
                                  <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-8">
                                      <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-950 text-2xl animate-pulse">
                                        Ã°Å¸Â§Â 
                                      </div>
                                      <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">Algorithmic Conscience</h4>
                                        <div className="text-xl font-black text-zinc-100 uppercase tracking-tight">Human Verdict</div>
                                      </div>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                      {result.humanVerdict.split('\n').filter(line => line.trim()).map((line, idx) => (
                                        <div key={idx} className="p-4 bg-zinc-900/40 border border-white/5 rounded-2xl text-zinc-300 text-md font-medium leading-relaxed group hover:bg-zinc-900/60 transition-all">
                                          {line.trim()}
                                        </div>
                                      ))}
                                    </div>

                                    {result.operationalDecision && (
                                      <div className="p-6 bg-white/[0.03] border border-white/10 rounded-3xl mb-8 group hover:border-emerald-500/30 transition-all">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Decisione Operativa</div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-2xl">Ã°Å¸â€˜â€°</span>
                                          <span className="text-xl font-black text-white italic tracking-tight">{result.operationalDecision}</span>
                                        </div>
                                      </div>
                                    )}

                                    {result.readyAlternative && result.readyAlternative.length > 0 && (
                                      <div className="space-y-4">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
                                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                                          Alternativa Pronta
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                          {result.readyAlternative.map((alt, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl group hover:bg-emerald-500/10 transition-all">
                                              <span className="w-6 h-6 flex items-center justify-center bg-emerald-500 text-white rounded-lg text-xs font-black">{idx + 1}</span>
                                              <p className="text-zinc-300 text-sm font-semibold">{alt}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {(result.altHook || result.altScene || result.altTwist) && (
                                <div className="mt-4 p-6 bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl relative overflow-hidden group">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[60px] rounded-full -mr-16 -mt-16 transition-all group-hover:bg-emerald-500/10" />
                                  <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-6">
                                      <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                        <div className="w-5 h-5 text-emerald-500 flex items-center justify-center font-black">Ã°Å¸â€ºÂ Ã¯Â¸Â</div>
                                      </div>
                                      <h4 className="text-sm font-black uppercase tracking-[0.25em] text-zinc-100">Alternativa Operativa</h4>
                                    </div>
                                    
                                    <div className="space-y-6">
                                      {result.altHook && (
                                        <div className="relative pl-6 before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-emerald-500 before:rounded-full">
                                          <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-500/70 mb-1">Variante Hook</span>
                                          <p className="text-zinc-300 text-sm leading-relaxed font-medium">{result.altHook}</p>
                                        </div>
                                      )}
                                      
                                      {result.altScene && (
                                        <div className="relative pl-6 before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full">
                                          <span className="block text-[10px] font-black uppercase tracking-widest text-blue-500/70 mb-1">Variante Scena</span>
                                          <p className="text-zinc-300 text-sm leading-relaxed font-medium">{result.altScene}</p>
                                        </div>
                                      )}
                                      
                                      {result.altTwist && (
                                        <div className="relative pl-6 before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-amber-500 before:rounded-full">
                                          <span className="block text-[10px] font-black uppercase tracking-widest text-amber-500/70 mb-1">Variante Twist</span>
                                          <p className="text-zinc-300 text-sm leading-relaxed font-medium">{result.altTwist}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {result.alternativePrompt && (
                                <div className="mt-4 p-6 bg-red-950/20 border border-red-500/20 rounded-3xl shadow-2xl relative overflow-hidden group">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[60px] rounded-full -mr-16 -mt-16 transition-all group-hover:bg-red-500/20" />
                                  <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-500/20 rounded-xl border border-red-500/30">
                                          <div className="w-5 h-5 text-red-500 flex items-center justify-center font-black">Ã°Å¸â€Â¥</div>
                                        </div>
                                        <h4 className="text-sm font-black uppercase tracking-[0.25em] text-red-400">PROMPT ALTERNATIVO</h4>
                                      </div>
                                      <CopyButton text={result.alternativePrompt} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20" />
                                    </div>
                                    <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl text-red-200 text-sm leading-relaxed font-mono">
                                      {result.alternativePrompt}
                                    </div>
                                    <p className="mt-4 text-xs text-red-400/60 font-medium italic">Generato a causa del Low Format Fit. Strategia pivot progettata per alto rendimento nello short video.</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`prose prose-invert max-w-none ${result.analysisMode === 'anti-ai-slop' ? 'prose-red' : result.analysisMode === 'pensaci-tu' ? 'prose-yellow' : 'prose-indigo'}`}>
                        <Markdown>{result.analysis.replace(/^VIRAL SCORE\n.*?\n\n/m, '')}</Markdown>
                      </div>

                      {result.searchAnalysis && (
                        <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                          <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                            <Search className="w-4 h-4" /> Analisi di Ricerca
                          </h4>
                          <div className="text-sm text-zinc-300 prose prose-invert max-w-none">
                            <Markdown>{result.searchAnalysis}</Markdown>
                          </div>
                        </div>
                      )}

                      {result.referenceVideoAnalysis && (
                        <div className="mt-6 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                          <h4 className="text-sm font-bold text-purple-400 mb-2 flex items-center gap-2">
                            <Play className="w-4 h-4" /> Video di Riferimento & Ispirazione
                          </h4>
                          <div className="text-sm text-zinc-300 mb-3">
                            <Markdown>{result.referenceVideoAnalysis.considerations}</Markdown>
                          </div>
                          {result.referenceVideoAnalysis.links && result.referenceVideoAnalysis.links.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {result.referenceVideoAnalysis.links.map((link, idx) => (
                                <a
                                  key={idx}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                >
                                  <Eye className="w-3 h-3" /> Guarda Ispirazione {idx + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {result.conscienceExamIt && (
                        <div className="mt-6 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                          <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4" /> Esame di Coscienza (CriticitÃ )
                          </h4>
                          <div className="text-sm text-zinc-300 prose prose-invert max-w-none">
                            <Markdown>{result.conscienceExamIt}</Markdown>
                          </div>
                        </div>
                      )}

                      {result.trendHunterReport && (
                        <div className="mt-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                          <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Trend Hunter Report
                          </h4>
                          <div className="text-sm text-zinc-300 prose prose-invert max-w-none">
                            <Markdown>{result.trendHunterReport}</Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Scripts Section */}
                  <div className="space-y-8">
                    {result.originalScript && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-zinc-800 rounded-lg">
                              <Film className="w-5 h-5 text-zinc-400" />
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-zinc-100">{result.originalScriptLabel || 'Script Completo (Originale)'}</h2>
                              {result.transcriptStatus === 'AUDIO_NOT_VERIFIED' && (
                                <p className="text-xs text-amber-300/80 mt-1">
                                  {result.transcriptWarning || 'Audio non verificato: questo testo e una descrizione visiva, non una trascrizione reale.'}
                                </p>
                              )}
                            </div>
                          </div>
                          <CopyButton text={result.originalScript} />
                        </div>
                        <div className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-xl text-zinc-400 font-mono text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {result.originalScript}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/20 rounded-lg">
                            <Zap className="w-5 h-5 text-red-400" />
                          </div>
                          <h2 className="text-2xl font-bold">Script Generato (Ottimizzato)</h2>
                          <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold tracking-wide uppercase">
                            15 Secondi Ã¢â‚¬Â¢ Loop
                          </div>
                        </div>
                      <button
                        onClick={handleCopyScript}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors text-sm font-medium"
                      >
                        {isCopiedScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {isCopiedScript ? 'Copiato!' : 'Copia Script'}
                      </button>
                    </div>
                    
                    <div className="relative">
                      <textarea
                        value={editableScript}
                        onChange={(e) => setEditableScript(e.target.value)}
                        className="w-full h-96 bg-zinc-900/30 border border-zinc-800 rounded-xl p-6 text-zinc-300 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-red-500/30"
                      />
                      <button
                        onClick={handleCopyScript}
                        className="absolute top-3 right-3 p-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all backdrop-blur-sm border border-zinc-700/50 z-10"
                        title="Copia Script"
                      >
                        {isCopiedScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Voiceover Generator UI */}
                    <div className="mt-6 p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/20 rounded-lg">
                            <Mic className="w-5 h-5 text-red-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-zinc-100">Generatore Voiceover AI</h3>
                            <p className="text-xs text-zinc-500">Trasforma lo script in audio cinematico</p>
                          </div>
                        </div>
                        <select
                          value={selectedVoice}
                          onChange={(e) => setSelectedVoice(e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        >
                          <option value="Zephyr">Zephyr (Deep, Cinematic)</option>
                          <option value="Kore">Kore (Energetic, Fast)</option>
                          <option value="Fenrir">Fenrir (Authoritative)</option>
                          <option value="Charon">Charon (Mysterious)</option>
                          <option value="Puck">Puck (Playful, High-pitched)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-4">
                        {voiceoverError && (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                            {voiceoverError}
                          </div>
                        )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleGenerateVoiceover(editableScript)}
                              disabled={isGeneratingVoiceover || !editableScript.trim()}
                              className="flex-1 py-3 bg-red-500 hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                            >
                              {isGeneratingVoiceover ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Generazione...
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4" fill="currentColor" />
                                  Voiceover Script Ottimizzato
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleGenerateVoiceover(result?.originalScript || '')}
                              disabled={isGeneratingVoiceover || !result?.originalScript}
                              className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                              {isGeneratingVoiceover ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Generazione...
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4" fill="currentColor" />
                                  Voiceover Script Originale
                                </>
                              )}
                            </button>
                          </div>

                        {voiceoverAudio && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-3 pt-4 border-t border-zinc-800"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Anteprima Audio</span>
                              <a
                                href={`data:${voiceoverAudio.mimeType};base64,${voiceoverAudio.data}`}
                                download="voiceover.wav"
                                className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" /> Scarica Audio
                              </a>
                            </div>
                            <AudioPlayer base64Data={voiceoverAudio.data} />
                            
                            {voiceoverAudio.script && (
                              <div className="mt-4 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Script Generato</span>
                                <p className="text-sm text-zinc-300 italic leading-relaxed">"{voiceoverAudio.script}"</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Cover Prompt Section */}
                    {result.coverPrompt && (
                      <div className="mt-8 pt-8 border-t border-zinc-800/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                              <Image className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-bold text-emerald-100">Cover Prompt (Anti-Scroll)</h2>
                          </div>
                          <CopyButton text={result.coverPrompt} />
                        </div>
                        <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-emerald-100/80 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                          {result.coverPrompt}
                        </div>
                        <p className="mt-3 text-[10px] text-emerald-500/60 italic flex items-center gap-1.5">
                          <Zap className="w-3 h-3" /> Generato per massimizzare il CTR e fermare lo scrolling compulsivo.
                        </p>
                      </div>
                    )}

                    {/* Analisi di Coscienza AI */}
                    {(() => {
                      const trace = result?.promptDecisionTrace || (result as any)?.result?.promptDecisionTrace;
                      if (!trace) {
                        logger.info("[PROMPT_DECISION_TRACE_UI_NOT_RENDERED]", { reason: "promptDecisionTrace is null or undefined" });
                        if ((result as any)?.dialogueSyncAudit) {
                          return (
                            <div className="mt-8 pt-8 border-t border-zinc-800/50">
                              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                  <Search className="w-5 h-5 text-blue-400" />
                                  ESAME DI COSCIENZA - COME IL SISTEMA HA DECISO
                                </h3>
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                  Esame di Coscienza parziale: `promptDecisionTrace` assente nel risultato finale, ma audit dialoghi disponibile.
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="mt-8 pt-8 border-t border-zinc-800/50">
                            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
                              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Search className="w-5 h-5 text-blue-400" />
                                ESAME DI COSCIENZA - COME IL SISTEMA HA DECISO
                              </h3>
                              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                Esame di Coscienza non disponibile: `promptDecisionTrace` assente nel risultato finale.
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const dialogueSyncAudit = trace.dialogueSyncAudit || result?.dialogueSyncAudit || {};
                      const castGroundingAudit = trace.castGroundingAudit || result?.castGroundingAudit || {};
                      const castAndDialogueAudit = trace.castAndDialogueAudit || result?.castAndDialogueAudit || {};
                      const sceneMechanismAudit = trace.sceneMechanismAudit || result?.sceneMechanismAudit || {};
                      const simulatedCastTestEnabled = typeof window !== "undefined" && window.__SIMULATED_CAST_PIPELINE_TEST__ === true;
                      const simulatedCastTest = simulatedCastTestEnabled ? runSimulatedCastPipelineTest() : null;
                      const effectiveCastGroundingAudit = simulatedCastTest?.castGrounding?.castGroundingAudit || castGroundingAudit;
                      const effectiveResultDetectedCharacters = simulatedCastTest?.castGrounding?.castGroundingAudit?.detectedCharacterDescriptors?.map((descriptor: any) => String(descriptor?.id || "").trim()).filter(Boolean) || result?.detectedCharacters || [];
                      const effectiveFrameObservations = simulatedCastTest?.castGrounding?.castGroundingAudit?.visualTruthEntries?.length > 0
                        ? (simulatedCastTest?.castGrounding?.castGroundingAudit?.visualTruthEntries || []).map((entry: any, index: number) => ({
                            frameIndex: Array.isArray(entry?.frameIndexes) && entry.frameIndexes.length > 0 ? entry.frameIndexes[0] : index,
                            visibleSubjects: [entry?.rawVisualLabel || `person_${index + 1}`]
                          }))
                        : (result?.frameObservations || []);
                      const confidenceSummary = {
                        audio: typeof trace?.audioConfidencePercent === "number" ? trace.audioConfidencePercent : null,
                        vision: typeof trace?.visionConfidencePercent === "number" ? trace.visionConfidencePercent : null,
                        cast: typeof trace?.castConfidencePercent === "number" ? trace.castConfidencePercent : null,
                        sync: typeof trace?.dialogueSyncConfidencePercent === "number" ? trace.dialogueSyncConfidencePercent : null,
                        prompt: typeof trace?.promptUsabilityPercent === "number" ? trace.promptUsabilityPercent : null,
                        publishReadiness: typeof trace?.publishReadiness === "string" ? trace.publishReadiness : ""
                      };
                      const mergedFrameTimeline = Array.isArray(dialogueSyncAudit?.mergedFrameTimeline) ? dialogueSyncAudit.mergedFrameTimeline : [];
                      const dialogueFrameAlignment = Array.isArray(dialogueSyncAudit?.dialogueFrameAlignment) ? dialogueSyncAudit.dialogueFrameAlignment : [];
                      const dialogueTurns = Array.isArray(dialogueSyncAudit?.dialogueTurns) ? dialogueSyncAudit.dialogueTurns : [];
                      const audioSegments = Array.isArray(result?.audioSegments) ? result.audioSegments : [];
                      const timedScriptRows = dialogueTurns.length > 0
                        ? dialogueTurns
                        : audioSegments.map((segment: any, index: number) => ({
                            turnIndex: index,
                            line: segment?.text || "",
                            startTime: segment?.start,
                            endTime: segment?.end,
                            timingSource: "groq_whisper_segments_verbose_json",
                            confidence: "MEDIUM"
                          }));
                      const visualTruthEntries = Array.isArray(effectiveCastGroundingAudit?.visualTruthEntries) ? effectiveCastGroundingAudit.visualTruthEntries : [];
                      const detectedCharacterDescriptors = Array.isArray(effectiveCastGroundingAudit?.detectedCharacterDescriptors) ? effectiveCastGroundingAudit.detectedCharacterDescriptors : [];
                      const technicalIdsForUi = [...new Set(([] as any[])
                        .concat(effectiveResultDetectedCharacters || [])
                        .concat(Array.isArray(effectiveFrameObservations) ? effectiveFrameObservations.flatMap((frame: any) => Array.isArray(frame?.visibleSubjects) ? frame.visibleSubjects : []) : [])
                        .map((item: any) => String(item || "").trim())
                        .filter((value: string) => /^person_\d+$/i.test(value)))];
                      const rawCastDisplayEntries = visualTruthEntries.length > 0
                        ? visualTruthEntries.map((entry: any, idx: number) => ({
                            key: `visual-truth-cast-${idx}`,
                            title: `Person ${idx + 1}`,
                            label: humanizeVisionText(String(entry?.recognizedVisualIdentity || entry?.genericFallbackLabel || entry?.rawVisualLabel || "persona visibile").trim()),
                            detail: humanizeVisionText([entry?.descriptorClothing, entry?.descriptorRoleClue ? `ruolo possibile ${entry.descriptorRoleClue}` : "", Array.isArray(entry?.visualEvidence) ? entry.visualEvidence.slice(0, 2).join(", ") : ""].filter(Boolean).join(", ")),
                            technicalId: String(entry?.rawVisualLabel || "").trim()
                          }))
                        : detectedCharacterDescriptors.map((descriptor: any, idx: number) => ({
                            key: `descriptor-cast-${idx}`,
                            title: `Person ${idx + 1}`,
                            label: humanizeVisionText(String(descriptor?.visualIdentity || descriptor?.roleClue || descriptor?.genderPresentation || descriptor?.id || "persona visibile").trim()),
                            detail: humanizeVisionText([descriptor?.clothing, descriptor?.roleClue && descriptor?.roleClue !== "unknown" ? `ruolo possibile ${descriptor.roleClue}` : "", Array.isArray(descriptor?.distinctiveProps) ? descriptor.distinctiveProps.slice(0, 2).join(", ") : ""].filter(Boolean).join(", ")),
                            technicalId: String(descriptor?.id || "").trim()
                          }));
                      const castDisplayEntries = rawCastDisplayEntries.filter((entry: any, index: number, arr: any[]) => {
                        const normalizedLabel = String(entry?.label || "").trim().toLowerCase();
                        return normalizedLabel && arr.findIndex((candidate: any) => String(candidate?.label || "").trim().toLowerCase() === normalizedLabel) === index;
                      });
                      const visibleSubjects = castDisplayEntries.length > 0
                        ? castDisplayEntries.map((entry: any) => String(entry?.label || "").trim()).filter(Boolean)
                        : [...new Set(([]
                            .concat(trace?.seen?.aggregatedVisibleSubjects || [])
                            .concat(effectiveCastGroundingAudit?.canonicalCastList || [])
                            .concat(Array.isArray(effectiveFrameObservations) ? effectiveFrameObservations.flatMap((frame: any) => Array.isArray(frame?.visibleSubjects) ? frame.visibleSubjects : []) : [])
                          ).map((item: any) => humanizeVisionText(String(item || "").trim())).filter((value: string) => value && !/^person_\d+$/i.test(value)))];
                      logger.info("[CAST_DEDUP_APPLIED]", {
                        visualCastCountBefore: rawCastDisplayEntries.length + technicalIdsForUi.length,
                        visualCastCountAfter: castDisplayEntries.length,
                        technicalIdsHiddenFromUi: castDisplayEntries.length > 0 && technicalIdsForUi.length > 0
                      });
                      logger.info("[CAST_UI_RENDER_SOURCE]", {
                        source: castDisplayEntries.length > 0 ? "canonical_visual_descriptors" : "fallback_visible_subjects",
                        shownCount: castDisplayEntries.length > 0 ? castDisplayEntries.length : visibleSubjects.length,
                        hiddenTechnicalIds: technicalIdsForUi
                      });
                      const castAuditForCard = effectiveCastGroundingAudit || castGroundingAudit || {};
                      const visualCastDetectedCountForUi = Math.max(
                        typeof castAuditForCard?.visualCastDetectedCount === "number" ? castAuditForCard.visualCastDetectedCount : 0,
                        typeof castAuditForCard?.detectedCharactersCount === "number" ? castAuditForCard.detectedCharactersCount : 0,
                        typeof castAuditForCard?.frameObservationSubjectsCount === "number" ? castAuditForCard.frameObservationSubjectsCount : 0,
                        typeof castAuditForCard?.visualCastCount === "number" ? castAuditForCard.visualCastCount : 0
                      );
                      const audioSpeakerCountForUi = typeof castAuditForCard?.audioSpeakerCount === "number"
                        ? castAuditForCard.audioSpeakerCount
                        : (typeof castAuditForCard?.estimatedSpeakerCount === "number" ? castAuditForCard.estimatedSpeakerCount : 0);
                      const totalDetectionSignalsForUi = typeof castAuditForCard?.totalDetectionSignals === "number"
                        ? castAuditForCard.totalDetectionSignals
                        : (visualCastDetectedCountForUi + audioSpeakerCountForUi);
                      const audioOnlyCharacterCountForUi = typeof castAuditForCard?.audioOnlyCharacterCount === "number"
                        ? castAuditForCard.audioOnlyCharacterCount
                        : Math.max(0, audioSpeakerCountForUi - visualCastDetectedCountForUi);
                      const finalCastUsedCountForUi = typeof castAuditForCard?.finalCastUsedCount === "number"
                        ? castAuditForCard.finalCastUsedCount
                        : (typeof castAuditForCard?.canonicalCastCount === "number" ? castAuditForCard.canonicalCastCount : ((Array.isArray(castAuditForCard?.canonicalCastList) ? castAuditForCard.canonicalCastList.length : 0) || canonicalCastList.length));
                      const reconciliationModeForUi = String(castAuditForCard?.reconciliationMode || "VISUAL_ONLY");
                      const reconciliationWarningForUi = String(castAuditForCard?.reconciliationWarning || "").trim();
                      const audioSpeakerDiagnosticForUi = castAuditForCard?.audioSpeakerDiagnostic || {};
                      const faithfulCastAuditForUi = castAuditForCard?.faithfulCastAudit || {};
                      const faithfulRawVisualPersonsForUi = Array.isArray(faithfulCastAuditForUi?.rawVisualPersonsList) ? faithfulCastAuditForUi.rawVisualPersonsList : [];
                      const faithfulGroupedRolesForUi = Array.isArray(faithfulCastAuditForUi?.groupedByRole) ? faithfulCastAuditForUi.groupedByRole : [];
                      const faithfulCastCountForUi = typeof faithfulCastAuditForUi?.finalFaithfulCastCount === "number" ? faithfulCastAuditForUi.finalFaithfulCastCount : visualCastDetectedCountForUi;
                      const canonicalRoleGroupsCountForUi = typeof faithfulCastAuditForUi?.canonicalRoleGroupsCount === "number" ? faithfulCastAuditForUi.canonicalRoleGroupsCount : faithfulGroupedRolesForUi.length;
                      const lostIndividualityWarningForUi = String(faithfulCastAuditForUi?.lostIndividualityWarning || "").trim();
                      const realDisplayCastCountForUi = typeof faithfulCastAuditForUi?.realDisplayCastCount === "number" ? faithfulCastAuditForUi.realDisplayCastCount : visualCastDetectedCountForUi;
                      const genericVisualSubjectsCountForUi = typeof faithfulCastAuditForUi?.genericVisualSubjectsCount === "number" ? faithfulCastAuditForUi.genericVisualSubjectsCount : 0;
                      const frameTimestampsCountForUi = typeof castAuditForCard?.frameTimestampsCount === "number" ? castAuditForCard.frameTimestampsCount : 0;
                      const frameObservationsCountForUi = typeof castAuditForCard?.frameObservationsCount === "number" ? castAuditForCard.frameObservationsCount : 0;
                      const missingObservationFramesForUi = typeof castAuditForCard?.missingObservationFrames === "number" ? castAuditForCard.missingObservationFrames : 0;
                      const speakerAttributionForUi = String(castAuditForCard?.speakerAttributionConfidence || audioSpeakerDiagnosticForUi?.speakerAttributionConfidence || "CAUTIOUS_TRANSCRIPT_ONLY");
                      const promptSafeCastSourceForUi = rawCastDisplayEntries.length > 0
                        ? rawCastDisplayEntries.map((entry: any) => String(entry?.label || "").trim()).filter(Boolean)
                        : ((Array.isArray(castAuditForCard?.canonicalCastList) ? castAuditForCard.canonicalCastList : canonicalCastList) || []).map((value: any) => String(value || "").trim()).filter(Boolean);
                      const promptSafeCastTotalsForUi = new Map<string, number>();
                      promptSafeCastSourceForUi.forEach((label: string) => {
                        const key = label.toLowerCase();
                        promptSafeCastTotalsForUi.set(key, (promptSafeCastTotalsForUi.get(key) || 0) + 1);
                      });
                      const promptSafeCastCountsForUi = new Map<string, number>();
                      const promptSafeCastListForUi = promptSafeCastSourceForUi.map((label: string) => {
                        const key = label.toLowerCase();
                        const nextCount = (promptSafeCastCountsForUi.get(key) || 0) + 1;
                        promptSafeCastCountsForUi.set(key, nextCount);
                        return (promptSafeCastTotalsForUi.get(key) || 0) > 1 ? `${label} #${nextCount}` : label;
                      });
                      logger.info("[CAST_UI_AUDIO_VIDEO_CARD_RENDER]", {
                        visualCastDetectedCount: visualCastDetectedCountForUi,
                        audioSpeakerCount: audioSpeakerCountForUi,
                        totalDetectionSignals: totalDetectionSignalsForUi,
                        audioOnlyCharacterCount: audioOnlyCharacterCountForUi,
                        finalCastUsedCount: finalCastUsedCountForUi,
                        reconciliationMode: reconciliationModeForUi,
                        reconciliationWarning: reconciliationWarningForUi,
                        renderSource: rawCastDisplayEntries.length > 0 ? "raw_visual_entries_with_duplicate_numbering" : "canonical_cast_list"
                      });
                      logger.info("[AUDIO_SPEAKER_DIAGNOSTIC_UI_RENDER]", {
                        mode: String(audioSpeakerDiagnosticForUi?.audioSpeakerAnalysisMode || "UNAVAILABLE"),
                        realDiarizationAvailable: audioSpeakerDiagnosticForUi?.realDiarizationAvailable === true,
                        transcriptHasSpeakerLabels: audioSpeakerDiagnosticForUi?.transcriptHasSpeakerLabels === true,
                        estimatedSpeakerCount: typeof audioSpeakerDiagnosticForUi?.estimatedSpeakerCount === "number" ? audioSpeakerDiagnosticForUi.estimatedSpeakerCount : audioSpeakerCountForUi,
                        dialogueTurnsCount: typeof audioSpeakerDiagnosticForUi?.dialogueTurnsCount === "number" ? audioSpeakerDiagnosticForUi.dialogueTurnsCount : 0,
                        possibleUndercountComparedToVisual: audioSpeakerDiagnosticForUi?.possibleUndercountComparedToVisual === true
                      });
                      logger.info("[AUDIO_SPEAKER_METHOD_LIMITATION_UI_RENDER]", {
                        detectionMode: String(audioSpeakerDiagnosticForUi?.audioSpeakerDetectionMode || "HEURISTIC_TRANSCRIPT_ONLY"),
                        realVoiceDiarizationAvailable: audioSpeakerDiagnosticForUi?.realVoiceDiarizationAvailable === true,
                        voicePrintAnalysisAvailable: audioSpeakerDiagnosticForUi?.voicePrintAnalysisAvailable === true,
                        timbreAnalysisAvailable: audioSpeakerDiagnosticForUi?.timbreAnalysisAvailable === true,
                        genderVoiceDetectionAvailable: audioSpeakerDiagnosticForUi?.genderVoiceDetectionAvailable === true,
                        realAudioSpeakerCountAvailable: audioSpeakerDiagnosticForUi?.realAudioSpeakerCountAvailable === true,
                        heuristicAudioSpeakerCount: typeof audioSpeakerDiagnosticForUi?.heuristicAudioSpeakerCount === "number" ? audioSpeakerDiagnosticForUi.heuristicAudioSpeakerCount : audioSpeakerCountForUi,
                        diagnosticConclusion: String(audioSpeakerDiagnosticForUi?.diagnosticConclusion || ""),
                        recommendedNextStep: String(audioSpeakerDiagnosticForUi?.recommendedNextStep || "")
                      });
                      logger.info("[TRUE_CAST_UI_RENDER]", {
                        rawVisualPersonsCount: faithfulRawVisualPersonsForUi.length,
                        realDisplayCastCount: realDisplayCastCountForUi,
                        genericVisualSubjectsCount: genericVisualSubjectsCountForUi,
                        canonicalRoleGroupsCount: canonicalRoleGroupsCountForUi,
                        finalFaithfulCastCount: faithfulCastCountForUi,
                        lostIndividualityWarning: lostIndividualityWarningForUi
                      });
                      if (missingObservationFramesForUi > 0) {
                        logger.info("[FRAME_OBSERVATION_COVERAGE_WARNING]", {
                          frameTimestampsCount: frameTimestampsCountForUi,
                          frameObservationsCount: frameObservationsCountForUi,
                          missingObservationFrames: missingObservationFramesForUi
                        });
                      }
                      logger.info("[AUDIO_CLUSTER_NOT_SPEAKER_COUNT_UI_GUARD]", {
                        transcriptSpeakerEstimate: result?.audioVoiceUserSummary?.transcriptSpeakerEstimate ?? null,
                        experimentalAudioVoiceClusterCount: result?.audioVoiceUserSummary?.experimentalClusterCount ?? null,
                        certifiedSpeakerCount: result?.audioVoiceUserSummary?.certifiedSpeakerCount ?? null
                      });
                      const audioEvidenceHaystack = `${String(result?.verifiedTranscript || result?.script || "")} ${Array.isArray(audioSegments) ? audioSegments.map((segment: any) => String(segment?.text || "")).join(" ") : ""}`.toLowerCase();
                      const visualAudienceHaystack = `${Array.isArray(result?.frameObservations) ? result.frameObservations.flatMap((frame: any) => [...(Array.isArray(frame?.visibleObjects) ? frame.visibleObjects : []), ...(Array.isArray(frame?.visibleSubjects) ? frame.visibleSubjects : []), String(frame?.visibleAction || "")]).join(" ") : ""} ${visualTruthEntries.map((entry: any) => Array.isArray(entry?.visualEvidence) ? entry.visualEvidence.join(" ") : "").join(" ")}`.toLowerCase();
                      const audienceAudioConfirmed = /(applaus|pubblico|audience|risat)/i.test(audioEvidenceHaystack);
                      const audienceVisualConfirmed = /(pubblico|audience|crowd|sala piena|spettatori|platea)/i.test(visualAudienceHaystack);
                      logger.info("[AUDIENCE_SOURCE_SPLIT]", {
                        audienceAudioConfirmed,
                        audienceVisualConfirmed,
                        source: audienceAudioConfirmed && !audienceVisualConfirmed ? "audio_only" : (audienceAudioConfirmed && audienceVisualConfirmed ? "audio_and_visual" : (audienceVisualConfirmed ? "visual_only" : "none"))
                      });
                      const normalizeStrategicField = (value: any) => {
                        if (Array.isArray(value)) {
                          const cleaned = value.map((item) => String(item || "").trim()).filter(Boolean);
                          return cleaned.length > 0 ? cleaned : null;
                        }
                        if (typeof value === "string") {
                          const cleaned = value.trim();
                          return cleaned ? cleaned : null;
                        }
                        if (typeof value === "number" || typeof value === "boolean") {
                          return String(value);
                        }
                        return null;
                      };
                      const strategicUnavailableText = "Dato non disponibile";
                      const strategicDecision = trace?.decision || {};
                      const strategicRisk = trace?.risk || {};
                      const strategicFields = {
                        humanVerdict: normalizeStrategicField(result?.humanVerdict),
                        finalPromptVerdict: normalizeStrategicField(result?.finalPromptVerdict),
                        analysisHook: normalizeStrategicField(result?.analysisHook),
                        analysisRetention: normalizeStrategicField(result?.analysisRetention),
                        analysisEscalation: normalizeStrategicField(result?.analysisEscalation),
                        analysisPayoff: normalizeStrategicField(result?.analysisPayoff),
                        analysisLoop: normalizeStrategicField(result?.analysisLoop),
                        engineWhyThisWorks: normalizeStrategicField((result as any)?.engineWhyThisWorks),
                        engineWhyThisFails: normalizeStrategicField((result as any)?.engineWhyThisFails),
                        engineWhatToChange: normalizeStrategicField((result as any)?.engineWhatToChange),
                        engineImprovementDirection: normalizeStrategicField((result as any)?.engineImprovementDirection),
                        engineFailureCall: normalizeStrategicField((result as any)?.engineFailureCall),
                        engineHonestyStatement: normalizeStrategicField((result as any)?.engineHonestyStatement),
                        engineReasonForDominanceSelection: normalizeStrategicField((result as any)?.engineReasonForDominanceSelection),
                        whySelected: normalizeStrategicField(strategicDecision?.whySelected),
                        rejectedBeats: normalizeStrategicField(strategicDecision?.rejectedBeats),
                        possibleError: normalizeStrategicField(strategicRisk?.possibleError),
                        recommendation: normalizeStrategicField(strategicRisk?.recommendation),
                        missingLinks: normalizeStrategicField(sceneMechanismAudit?.missingLinks),
                        visualConsequenceConfirmed: normalizeStrategicField(sceneMechanismAudit?.visualConsequenceConfirmed),
                        payoffConfirmed: normalizeStrategicField(sceneMechanismAudit?.payoffConfirmed)
                      };
                      const fieldsDetected = Object.entries(strategicFields)
                        .filter(([, value]) => value !== null)
                        .map(([key]) => key);
                      const missingFields = Object.entries(strategicFields)
                        .filter(([, value]) => value === null)
                        .map(([key]) => key);
                      logger.info("[STRATEGIC_CONSCIENCE_DOSSIER_UI]", {
                        visible: true,
                        operationalAsAnalysis: true,
                        operationalForPromptGeneration: false,
                        fieldsDetected,
                        missingFields,
                        reason: "strategic_dossier_available_for_future_prompt_interventions"
                      });
                      const promptSources = [
                        { label: "Best", text: result?.bestOptimizedPrompt?.prompt || "" },
                        { label: "Scene Master", text: result?.sceneMasterPrompt || "" },
                        { label: "Sora", text: `${result?.promptSora12s || ""}\n${result?.promptSora15s || ""}\n${result?.soraPrompt12s || ""}\n${result?.soraPrompt15s || ""}` },
                        { label: "Kling", text: `${result?.klingPrompt10s || ""}\n${result?.klingPrompt15s || ""}\n${result?.klingPrompt || ""}` },
                        { label: "Veo", text: `${result?.veo3Prompt8s || ""}\n${result?.veoPrompt || ""}\n${result?.veo3ExtensionPart1Prompt8s || ""}\n${result?.veo3ExtensionPart2Prompt8s || ""}` },
                        { label: "Seedance", text: `${result?.seedancePrompt15s || ""}\n${result?.sendancePrompt15s || ""}` }
                      ];
                      const promptUsedLinesAudit = dialogueFrameAlignment.map((entry: any) => {
                        const line = String(entry?.line || "").trim();
                        const normalizedLine = line.toLowerCase();
                        const significantSnippet = normalizedLine.length > 48 ? normalizedLine.slice(0, 48) : normalizedLine;
                        const usedIn = promptSources
                          .filter((source) => {
                            const haystack = String(source.text || "").toLowerCase();
                            return normalizedLine.length > 0 && (haystack.includes(normalizedLine) || (significantSnippet.length >= 18 && haystack.includes(significantSnippet)));
                          })
                          .map((source) => source.label);
                        return {
                          turnIndex: entry?.turnIndex ?? null,
                          line,
                          startTime: entry?.startTime ?? null,
                          endTime: entry?.endTime ?? null,
                          usedIn,
                          possibleSpeakerFromFrame: sanitizeDirtySpeakerLabel(entry?.possibleSpeakerFromFrame || "unknown"),
                          assignmentConfidence: entry?.assignmentConfidence || "LOW",
                          warning: entry?.warning || ""
                        };
                      }).filter((entry: any) => entry.usedIn.length > 0);
                      const ambiguousRows = dialogueFrameAlignment.filter((entry: any) => sanitizeDirtySpeakerLabel(entry?.possibleSpeakerFromFrame || "unknown") === "ambiguous").length;
                      const strongCandidateRows = dialogueFrameAlignment.filter((entry: any) => {
                        const speaker = sanitizeDirtySpeakerLabel(entry?.possibleSpeakerFromFrame || "unknown");
                        return speaker !== "unknown" && speaker !== "ambiguous";
                      }).length;
                      let dirtySpeakerLabelsSanitizedCount = 0;
                      const sanitizeDirtySpeakerLabelLocal = (value: any) => {
                        const raw = String(value || 'unknown').trim();
                        const lower = raw.toLowerCase();
                        const looksDirty = new RegExp('unk[^a-z]*|character descriptors portion|provided observation sequence|json structure looks complete|[\\u4E00-\\u9FFF]', 'i').test(raw);
                        if (looksDirty) {
                          dirtySpeakerLabelsSanitizedCount += 1;
                          logger.info('[SANITIZED_DIRTY_SPEAKER_LABEL]', { from: raw, to: 'unknown' });
                          return 'unknown';
                        }
                        return lower || 'unknown';
                      };
                      const translateSpeakerLabel = (value: any, isAmbiguous: boolean = false) => {
                        const normalized = sanitizeDirtySpeakerLabel(value);
                        if (normalized === "ambiguous" || normalized === "unknown") return "personaggio non assegnabile";
                        
                        const mapping: Record<string, string> = {
                          "woman": "donna",
                          "female": "donna",
                          "lady": "donna",
                          "man": "uomo",
                          "male": "uomo",
                          "policeman": "poliziotto / carabiniere",
                          "uniformed_man": "uomo in uniforme",
                          "uniformed_official": "ufficiale in uniforme",
                          "young_man": "giovane uomo",
                          "young_woman": "giovane donna",
                          "elderly_man": "uomo anziano",
                          "elderly_woman": "donna anziana",
                          "leather_jacket_person": "persona con giacca di pelle",
                          "crossed_arms_person": "persona con braccia incrociate",
                          "pointed_hat_person": "persona con cappello appuntito",
                          "true woman": "donna",
                          "manned uniform": "uomo in uniforme"
                        };

                        let label = mapping[normalized] || normalized.replace(/_/g, " ").charAt(0).toUpperCase() + normalized.replace(/_/g, " ").slice(1);

                        // Handle partial matches for common roles
                        if (!mapping[normalized]) {
                          if (normalized.includes("uniform") && normalized.includes("man")) label = "uomo in uniforme";
                          else if (normalized.includes("woman") || normalized.includes("female")) label = "donna";
                        }

                        if (isAmbiguous && (label.toLowerCase() === "uomo" || label.toLowerCase() === "donna")) {
                           return `${label} non distinto`;
                        }

                        return label;
                      };
                      const translateConfidenceLabel = (value: any) => {
                        const normalized = String(value || "LOW").trim().toUpperCase();
                        if (normalized === "HIGH") return "alta";
                        if (normalized === "MEDIUM") return "media";
                        if (normalized === "MEDIUM_LOW") return "media-bassa";
                        if (normalized === "LOW") return "bassa";
                        return "bassa";
                      };
                      const formatSecondsLabel = (value: any) => {
                        const numeric = typeof value === "number" ? value : Number(value);
                        if (!Number.isFinite(numeric)) return "N/D";
                        const totalSeconds = Math.max(0, numeric);
                        const minutes = Math.floor(totalSeconds / 60);
                        const seconds = totalSeconds - minutes * 60;
                        return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(0).padStart(2, "0")}`;
                      };
                      const originalTimedScriptRows = timedScriptRows.map((turn: any, index: number) => ({
                        key: `original-row-${index}`,
                        startTime: turn?.startTime,
                        endTime: turn?.endTime,
                        line: String(turn?.line || "").trim()
                      })).filter((row) => row.line);
                      logger.info("[OPTIMIZED_ROWS_SOURCE_SELECTED]", {
                        usingPossibleSpeakerAssignments: Array.isArray(dialogueSyncAudit?.possibleSpeakerAssignments),
                        possibleSpeakerAssignmentsCount: dialogueSyncAudit?.possibleSpeakerAssignments?.length || 0,
                        dialogueFrameAlignmentCount: dialogueFrameAlignment?.length || 0,
                        dialogueTurnsCount: dialogueSyncAudit?.dialogueTurns?.length || result?.dialogueSyncAudit?.dialogueTurns?.length || 0,
                        audioSegmentsCount: result?.audioSegments?.length || 0
                      });

                      const optimizedRowsSource =
  Array.isArray(dialogueSyncAudit?.possibleSpeakerAssignments) && dialogueSyncAudit.possibleSpeakerAssignments.length > 0
    ? dialogueSyncAudit.possibleSpeakerAssignments
    : Array.isArray(dialogueFrameAlignment) && dialogueFrameAlignment.length > 0
      ? dialogueFrameAlignment
      : [];

const isFiniteTime = (value: any) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  Number.isFinite(Number(value));

const optimizedCharacterRows = optimizedRowsSource.map((entry: any, index: number) => {
  const sourceEntry = entry || {};
  let start = sourceEntry.startTime ?? sourceEntry.start;
  let end = sourceEntry.endTime ?? sourceEntry.end;
  let timingSource = "ENTRY";

  if (!isFiniteTime(start) || !isFiniteTime(end)) {
    const turnIndex = sourceEntry.turnIndex;
    const segmentIndex = sourceEntry.segmentIndex;

    const turn =
      (Number.isInteger(turnIndex) ? dialogueSyncAudit?.dialogueTurns?.[turnIndex] : undefined) ??
      (Number.isInteger(turnIndex) ? result?.dialogueSyncAudit?.dialogueTurns?.[turnIndex] : undefined) ??
      (Number.isInteger(turnIndex) ? result?.dialogueTurns?.[turnIndex] : undefined) ??
      (Number.isInteger(segmentIndex) ? result?.audioSegments?.[segmentIndex] : undefined) ??
      (Number.isInteger(turnIndex) ? result?.audioSegments?.[turnIndex] : undefined) ??
      result?.audioSegments?.[index];

    const resolvedStart = turn?.startTime ?? turn?.start;
    const resolvedEnd = turn?.endTime ?? turn?.end;

    if (isFiniteTime(resolvedStart) && isFiniteTime(resolvedEnd)) {
      start = resolvedStart;
      end = resolvedEnd;
      timingSource = turn?.startTime !== undefined ? "DIALOGUE_TURNS_LOOKUP" : "AUDIO_SEGMENTS_LOOKUP";
    } else {
      timingSource = "MISSING";
    }
  }

  logger.info(
    timingSource === "MISSING"
      ? "[OPTIMIZED_SCRIPT_TIMING_MISSING]"
      : "[OPTIMIZED_SCRIPT_TIMING_RENDERED]",
    {
      index,
      turnIndex: sourceEntry.turnIndex,
      segmentIndex: sourceEntry.segmentIndex,
      timingSource,
      startTime: start,
      endTime: end,
      hasTiming: isFiniteTime(start) && isFiniteTime(end)
    }
  );

  return {
    key: `optimized-row-${index}`,
    startTime: isFiniteTime(start) ? Number(start) : undefined,
    endTime: isFiniteTime(end) ? Number(end) : undefined,
    isTimingAvailable: isFiniteTime(start) && isFiniteTime(end),
    timingSource,
    line: String(sourceEntry.line || "").trim(),
    speakerLabel: translateSpeakerLabel(sourceEntry.probableSpeakerLabel || sourceEntry.possibleSpeaker || sourceEntry.speakerLabel || "Soggetto non confermato"),
    weakAssignment: sourceEntry.weakAssignment || false,
    confidenceLabel: sourceEntry.confidenceLabel || "LOW"
  };
}).filter((row: any) => row.line);

                      const characterStatusSimple = !dialogueSyncAudit?.canAssignSpeakers
                        ? "INCERTI"
                        : (String(castAndDialogueAudit?.speakerAttributionConfidence || dialogueSyncAudit?.confidence || "LOW").toUpperCase() === "HIGH"
                            ? "AFFIDABILI"
                            : "PARZIALI");
                      const speakerAttributionUiStatus = dialogueSyncAudit?.confidence === "MEDIUM" && castAndDialogueAudit?.speakerAttributionConfidence === "LOW"
                        ? "ATTENZIONE: la sincronizzazione temporale Ã¨ media, ma lâ€™attribuzione speaker Ã¨ bassa."
                        : (dialogueSyncAudit?.canAssignSpeakers
                            ? "Tecnicamente possibile, ma da usare con cautela."
                            : "Non affidabile per assegnazione speaker.");
                      const summaryPromptRisk = result?.qualityGates?.dialogueSyncLowConfidence
                        ? "HIGH"
                        : (trace?.risk?.riskLevel || "N/A");
                      const unknownDialogueAssignmentsCount = dialogueFrameAlignment.filter((entry: any) => {
                        const raw = sanitizeDirtySpeakerLabel(entry?.possibleSpeakerFromFrame || 'unknown');
                        return raw === 'unknown' || raw === 'ambiguous';
                      }).length;
                      logger.info('[USER_AUDIO_CAST_SUMMARY_UI]', {
                        transcriptAvailable: result?.audioVoiceUserSummary?.transcriptAvailable === true,
                        timedSegmentsAvailable: result?.audioVoiceUserSummary?.timedSegmentsAvailable === true,
                        experimentalClusterCount: result?.audioVoiceUserSummary?.experimentalClusterCount ?? null,
                        transcriptSpeakerEstimate: result?.audioVoiceUserSummary?.transcriptSpeakerEstimate ?? null,
                        certifiedSpeakerCount: result?.audioVoiceUserSummary?.certifiedSpeakerCount ?? null,
                        visualFaithfulCastCount: faithfulCastCountForUi,
                        unknownDialogueAssignmentsCount,
                        dirtySpeakerLabelsSanitizedCount
                      });
                      const castDetails = visibleSubjects.map((subject: string) => {
                        const sanitizedSubject = sanitizeDirtySpeakerLabel(subject);
                        const relatedFrames = mergedFrameTimeline
                          .filter((frame: any) => Array.isArray(frame?.visibleSubjects) && frame.visibleSubjects.some((value: any) => sanitizeDirtySpeakerLabel(value) === sanitizedSubject))
                          .map((frame: any) => Number(frame.frameIndex) + 1);
                        const actions = [...new Set(mergedFrameTimeline
                          .filter((frame: any) => Array.isArray(frame?.visibleSubjects) && frame.visibleSubjects.some((value: any) => sanitizeDirtySpeakerLabel(value) === sanitizedSubject))
                          .map((frame: any) => String(frame?.visibleAction || "").trim())
                          .filter(Boolean))];
                        const assignedTurns = dialogueFrameAlignment
                          .filter((entry: any) => sanitizeDirtySpeakerLabel(entry?.possibleSpeakerFromFrame || "unknown") === sanitizedSubject)
                          .map((entry: any) => `${entry?.startTime ?? "N/A"}s`);
                        const possibleRole = mergedFrameTimeline.find((frame: any) =>
                          Array.isArray(frame?.visibleSubjects) && frame.visibleSubjects.some((value: any) => sanitizeDirtySpeakerLabel(value) === sanitizedSubject)
                        )?.possibleRole || "";
                        return {
                          subject,
                          possibleRole,
                          relatedFrames,
                          actions,
                          assignedTurns
                        };
                      });
                      const renderedBlocks = [
                        "Ho sentito",
                        "Ho visto",
                        "Ho dedotto",
                        "Non ho confermato",
                        "Cast e dialoghi",
                        "Timeline frame reali",
                        "Sincronizzazione battute-frame",
                        "Rischio qualitÃ  prompt"
                      ];

                      logger.info("[CAST_DIAGNOSTIC_UI_RENDERED]", {
                        canonicalCastCount: canonicalCastList.length,
                        castConfidence: result?.castConfidence || "N/A",
                        visualCastCount: castGroundingAudit?.visualCastCount ?? result?.visualCastCount ?? 0,
                        castSource: castGroundingAudit?.castSource || "N/A"
                      });
                      logger.info("[UI_CAST_AUDIO_ESTIMATE_RENDERED]", {
                        castVisualConfirmed: castGroundingAudit?.castVisualConfirmed ?? false,
                        estimatedSpeakerCount: castGroundingAudit?.estimatedSpeakerCount ?? null,
                        estimatedSpeakers: castGroundingAudit?.estimatedSpeakers || [],
                        castSource: castGroundingAudit?.castSource || "N/A"
                      });
                      logger.info("[TIMELINE_DIAGNOSTIC_UI_RENDERED]", {
                        audioSegmentsCount: audioSegments.length,
                        frameTimestampsCount: frameTimestampsForUi.length,
                        mergedFrameTimelineCount: mergedFrameTimeline.length,
                        dialogueFrameAlignmentCount: dialogueFrameAlignment.length
                      });
                      logger.info("[PROMPT_DECISION_TRACE_UI_RENDER_CHECK]", {
                        hasResult: !!result,
                        hasResultResult: !!(result as any)?.result,
                        hasTraceDirect: !!result?.promptDecisionTrace,
                        hasTraceNested: !!(result as any)?.result?.promptDecisionTrace,
                        traceKeys: Object.keys(trace),
                        componentName: "App.tsx (Main Output View)"
                      });
                      logger.info("[PROMPT_DECISION_TRACE_UI_RENDERED]", {
                        hasPromptDecisionTrace: true,
                        promptQualityFinalPass: result?.promptQualityReport?.finalPass,
                        lockedPromptTabsLocked: result?.lockedPromptTabs?.locked,
                        reason: "Rendered independently of prompt final pass in main view"
                      });
                      logger.info("[CONSCIENCE_UI_RENDER_CHECK]", {
                        componentName: "App.tsx Main Output View",
                        hasPromptDecisionTrace: true,
                        hasDialogueSyncAudit: !!dialogueSyncAudit && Object.keys(dialogueSyncAudit).length > 0,
                        hasMergedFrameTimeline: mergedFrameTimeline.length > 0,
                        hasDialogueFrameAlignment: dialogueFrameAlignment.length > 0,
                        renderedBlocks,
                        hasScriptFrameSpeakerTimeline: dialogueFrameAlignment.length > 0,
                        hasPromptUsedLinesAudit: promptUsedLinesAudit.length > 0,
                        hasCastDetailsExpanded: castDetails.length > 0,
                        scriptFrameSpeakerRowsCount: dialogueFrameAlignment.length,
                        promptUsedLinesCount: promptUsedLinesAudit.length,
                        speakerAttributionUiStatus
                      });
                      logger.info("[CONSCIENCE_SCRIPT_TIMELINE_RENDERED]", {
                        rowsCount: dialogueFrameAlignment.length,
                        ambiguousRows,
                        strongCandidateRows,
                        hasPromptUsageAudit: promptUsedLinesAudit.length > 0
                      });
                      logger.info("[UI_AUDIO_CONSCIENCE_RENDERED]", { audioSegmentsCount: audioSegmentsForUi.length, hasTimedScript: originalTimedScriptRows.length > 0, originalRowsCount: originalTimedScriptRows.length, estimatedSpeakerCount: castAuditForCard?.estimatedSpeakerCount });
                      logger.info("[SIMPLE_CONSCIENCE_UI_RENDERED]", {
                        hasOriginalTimedScript: originalTimedScriptRows.length > 0,
                        originalRowsCount: originalTimedScriptRows.length,
                        hasOptimizedTimedScript: optimizedCharacterRows.length > 0,
                        optimizedRowsCount: optimizedCharacterRows.length,
                        technicalPanelsHidden: true
                      });

                      return (
                        <div className="mt-8 pt-8 border-t border-zinc-800/50">
                          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                              <Search className="w-5 h-5 text-blue-400" />
                              ESAME DI COSCIENZA - COME IL SISTEMA HA DECISO
                            </h3>
                             {/* GEMINI EYE/EAR MULTIMODAL DIAGNOSTICS CARD (Priority 3) */}
                             {(() => {
                               const finalDiag = trace?.eyeEarDiagnostics || result?.promptDecisionTrace?.eyeEarDiagnostics || (result as any)?.result?.promptDecisionTrace?.eyeEarDiagnostics;
                               const isAttempted = finalDiag?.eyeEarAttempted ?? trace?.eyeEarAttempted;
                               const isKeyAvailable = finalDiag?.eyeEarKeyAvailable ?? trace?.eyeEarKeyAvailable;
                               const isFileUriAvailable = finalDiag?.eyeEarFileUriAvailable ?? trace?.eyeEarFileUriAvailable;
                               const modelSelected = finalDiag?.eyeEarModelSelected ?? trace?.eyeEarModelSelected;
                               const failedReason = finalDiag?.eyeEarFailedReason ?? trace?.eyeEarFailedReason;
                               const notAttemptedReason = finalDiag?.eyeEarNotAttemptedReason ?? trace?.eyeEarNotAttemptedReason;
                               const httpStatus = finalDiag?.eyeEarHttpStatus ?? trace?.eyeEarHttpStatus;
                               const qualityGateStatus = finalDiag?.eyeEarQualityGateStatus ?? trace?.eyeEarQualityGateStatus;
                               const finalProvider = finalDiag?.provider ?? trace?.provider;
                               
                               const fileState = finalDiag?.eyeEarFileState || "sconosciuto";
                               const errorCode = finalDiag?.eyeEarErrorCode;
                               const errorMessage = finalDiag?.eyeEarErrorMessage;
                               const classifiedReason = finalDiag?.eyeEarClassifiedReason || "UNKNOWN";
                               
                               const fileSelected = finalDiag?.fileSelected || (trace as any)?.fileSelected || "no";
                               const uploadAttempted = finalDiag?.uploadAttempted || (trace as any)?.uploadAttempted || "no";

                               const isOk = finalDiag?.success !== false && qualityGateStatus === "PASS" && finalProvider === "gemini";
                               const isDegraded = qualityGateStatus === "DEGRADED" || (finalDiag?.success !== false && finalProvider === "openrouter_fallback");
                               const isRed = !isOk && !isDegraded;

                               let cardBg = "bg-emerald-950/20 border-emerald-500/30 text-emerald-200";
                               let cardHeaderColor = "text-emerald-400";
                               let badgeColor = "bg-emerald-950/60 text-emerald-400 border-emerald-900";
                               let titleText = "ANALISI GEMINI EYE/EAR COMPLETATA CON SUCCESSO";

                               if (isRed) {
                                 cardBg = "bg-red-950/30 border-red-500/30 text-red-200";
                                 cardHeaderColor = "text-red-400 font-bold";
                                 badgeColor = "bg-red-950/60 text-red-400 border-red-900";
                                 titleText = "ANALISI INTERROTTA — GEMINI EYE/EAR NON DISPONIBILE";
                               } else if (isDegraded) {
                                 cardBg = "bg-amber-950/30 border-amber-500/30 text-amber-200";
                                 cardHeaderColor = "text-amber-400 font-bold";
                                 badgeColor = "bg-amber-950/60 text-amber-400 border-amber-900";
                                 titleText = "ANALISI PARZIALE / DEGRADATA";
                               }

                               return (
                                 <div className={`border rounded-xl p-5 mb-6 ${cardBg}`}>
                                   <h4 className={`font-mono text-xs px-2 py-1.5 mb-4 border-b border-zinc-900 flex justify-between items-center bg-black/30 rounded ${cardHeaderColor}`}>
                                     <span>{titleText}</span>
                                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded leading-none border ${badgeColor}`}>
                                       {isOk ? "VERDE" : isRed ? "ROSSO" : "ARANCIONE"}
                                     </span>
                                   </h4>
                                   
                                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono px-2">
                                     <div>
                                       <span className="text-zinc-500 block">file selezionato:</span>
                                       <span className={fileSelected === "yes" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                         {fileSelected === "yes" ? "sì" : "no"}
                                       </span>
                                     </div>
                                     <div>
                                       <span className="text-zinc-500 block">upload Gemini tentato:</span>
                                       <span className={uploadAttempted === "yes" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                         {uploadAttempted === "yes" ? "sì" : "no"}
                                       </span>
                                     </div>
                                     <div>
                                       <span className="text-zinc-500 block">uploadedFileUri disponibile:</span>
                                       <span className={isFileUriAvailable ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                         {isFileUriAvailable ? "sì" : "no"}
                                       </span>
                                     </div>
                                     <div>
                                       <span className="text-zinc-500 block">stato file Gemini:</span>
                                       <span className={fileState === "ACTIVE" ? "text-emerald-400 font-bold" : (fileState === "sconosciuto" ? "text-zinc-400 font-bold" : "text-red-400 font-bold")}>
                                         {fileState === "ACTIVE" ? "ACTIVE" : (fileState === "sconosciuto" || !fileState ? "sconosciuto" : `non ACTIVE (${fileState})`)}
                                       </span>
                                     </div>
                                     <div>
                                       <span className="text-zinc-500 block">Gemini Eye/Ear tentato:</span>
                                       <span className={isAttempted ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                         {isAttempted ? "sì" : "no"}
                                       </span>
                                     </div>
                                     <div>
                                       <span className="text-zinc-500 block">chiave Gemini disponibile:</span>
                                       <span className={isKeyAvailable ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                                         {isKeyAvailable ? "sì" : "no"}
                                       </span>
                                     </div>
                                     <div>
                                       <span className="text-zinc-500 block">modello Gemini usato:</span>
                                       <span className="text-zinc-300 font-bold">{modelSelected || "gemini-2.0-flash"}</span>
                                     </div>
                                     <div>
                                       <span className="text-zinc-500 block">motivo classificato:</span>
                                       <span className="text-zinc-300 font-bold underline decoration-zinc-700">{classifiedReason}</span>
                                     </div>
                                   </div>

                                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono px-2 mt-4 pt-4 border-t border-zinc-900">
                                     <div>
                                       <span className="text-zinc-500 block">errore HTTP:</span>
                                       <span className={httpStatus === 200 ? "text-emerald-400 font-bold" : (httpStatus ? "text-red-400 font-bold" : "text-zinc-500")}>
                                         {httpStatus || "N/A"}
                                       </span>
                                     </div>
                                     <div>
                                       <span className="text-zinc-500 block">codice errore:</span>
                                       <span className="text-zinc-300 font-bold">{errorCode || "N/A"}</span>
                                     </div>
                                     <div>
                                       <span className="text-zinc-500 block">messaggio errore breve:</span>
                                       <span className="text-zinc-300 font-bold truncate block max-w-xs">{errorMessage || "N/A"}</span>
                                     </div>
                                   </div>

                                   {isRed && (
                                     <div className="mt-5 p-4 bg-red-950/50 border border-red-500/20 rounded-lg text-xs leading-relaxed text-red-200">
                                       <p className="font-bold mb-2 text-red-400 uppercase tracking-widest text-[10px]">Messaggio Diagnostica:</p>
                                       <p className="mb-1 font-semibold text-white">Analisi Occhio/Orecchio interrotta.</p>
                                       <p className="mb-1">Google Gemini Eye/Ear non è stato completato.</p>
                                       <p className="mb-1">Motivo: <span className="font-bold px-1.5 py-0.5 rounded bg-red-900/40 text-white text-[11px] font-mono">{classifiedReason}</span></p>
                                       {errorMessage && (
                                         <p className="mt-2 text-zinc-300 bg-black/45 p-2.5 rounded font-mono text-[11px] max-h-32 overflow-y-auto whitespace-pre-wrap border border-white/5">
                                           {errorMessage}
                                         </p>
                                       )}
                                       <p className="mt-2 text-zinc-400 italic">OpenRouter fallback disattivato per diagnosi.</p>
                                       <p className="text-zinc-400 italic font-medium text-amber-500">Nessun dato fittizio o parziale è stato usato per riempire le coscienze.</p>
                                       
                                       {result?.videoSummary && (
                                         <div className="mt-4 pt-3 border-t border-red-500/20 flex flex-col sm:flex-row gap-3 justify-between items-center bg-black/20 p-3 rounded-lg border border-red-900/30">
                                           <div className="text-[11px] text-zinc-300 font-medium">
                                             Generato il report diagnostico completo con tutti i problemi e relativi dettagli.
                                           </div>
                                           <button
                                             type="button"
                                             onClick={() => {
                                               copyToClipboard(result.videoSummary);
                                               alert("Report diagnostico completo copiato negli appunti con successo! Ora puoi incollarlo in chat.");
                                             }}
                                             className="w-full sm:w-auto shrink-0 px-4 py-2 bg-red-650 hover:bg-red-600 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs text-center border border-red-500"
                                           >
                                             📋 COPIA REPORT DIAGNOSTICA
                                           </button>
                                         </div>
                                       )}
                                     </div>
                                   )}
                                 </div>
                               );
                             })()}

                            {isPromptBlockedForMissingGrounding && (
                              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                <p className="font-bold uppercase tracking-wider text-amber-300 mb-1">ModalitÃ  Provvisoria</p>
                                <p>audio e timeline disponibili, visione non confermata. I prompt non sono approvati come finali.</p>
                              </div>
                            )}

                            {/* 
                              FREEZE CHECKPOINT — COSCIENZE UI
                              Sezione stabile: Header → Video → Audio → Composer.
                              Non modificare questa area durante lavori su H3, prompt engine o pipeline,
                              salvo richiesta esplicita.
                              I componenti devono restare solo UI/lettura difensiva da result.
                              JSON/export deve restare completo.
                            */}
                            {/* ANALISI DI COSCIENZA */}
                            <div className="mb-4 mt-8">
                              <h3 className="text-lg font-bold text-white mb-1 uppercase tracking-tight">Esame di Coscienza Tecnico</h3>
                              <p className="text-xs text-zinc-400">Riepilogo sintetico di ciò che il sistema ha visto, ascoltato e composto. I dati completi restano disponibili nel JSON/export.</p>
                            </div>
                            <TechnicalVideoConscience result={result} />
                            <TechnicalAudioConscience result={result} />
                            <ComposerConscience result={result} />
                            <div className="bg-zinc-800/50 p-5 border border-zinc-700/50 rounded-2xl shadow-xl mb-6 text-sm text-zinc-200 relative overflow-hidden group">
                               <details className="bg-zinc-900/60 border border-zinc-700/40 rounded-xl p-4 text-xs text-zinc-300">
                                 <summary className="cursor-pointer font-bold text-zinc-400 uppercase tracking-wider hover:text-white transition-colors flex items-center gap-2">
                                   Dettagli tecnici avanzati
                                 </summary>
                                 <div className="mt-6 opacity-70 hover:opacity-100 transition-opacity">
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     {/* CAST INFO */}
                                     <div className="space-y-4">
                                   <div className="bg-black/30 p-4 rounded-xl border border-zinc-700/30">
                                     <p className="text-zinc-400 text-xs font-bold uppercase mb-2">Cast Rilevato</p>
                                      <div className="flex items-center gap-3">
                                        <span className="text-3xl font-bold text-white">{finalCastUsedCountForUi}</span>
                                        <span className="text-zinc-500 text-xs leading-tight">Soggetti nel<br/>testo finale</span>
                                      </div>
                                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                        <p className="text-zinc-400">Persone viste nei fotogrammi: <span className="text-white font-semibold">{visualCastDetectedCountForUi}</span></p>
                                        {result?.audioVoiceUserSummary?.realDiarizationAvailable === true || result?.realAudioVoiceClusterAvailable === true ? (
                                          <p className="text-zinc-400">Voci/timbri reali dall'audio: <span className="text-white font-semibold">{audioSpeakerCountForUi > 0 ? audioSpeakerCountForUi : "non confermate"}</span></p>
                                        ) : (
                                          <p className="text-zinc-400">Voci/timbri dall'audio: <span className="text-amber-500 font-semibold italic">Stima euristica da trascrizione</span></p>
                                        )}
                                        <p className="text-zinc-400">Segnali totali rilevati: <span className="text-white font-semibold">{totalDetectionSignalsForUi}</span></p>
                                        <p className="text-zinc-400">Personaggi solo audio/fuori campo: <span className="text-white font-semibold">{audioOnlyCharacterCountForUi > 0 ? audioOnlyCharacterCountForUi : "0 / non confermati"}</span></p>
                                        <p className="text-zinc-400">Soggetti nel testo finale: <span className="text-white font-semibold">{finalCastUsedCountForUi}</span></p>
                                        <p className="text-zinc-400">Confidenza stima da script: <span className="text-white font-semibold">{castAuditForCard?.speakerEstimateConfidence || "BASSA/MEDIA"}</span></p>
                                      </div>
                                      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px]">
                                        <p className="text-zinc-400">Origine del dato:</p>
                                        <p className="text-white font-semibold">{reconciliationModeForUi}</p>
                                      </div>
                                      {reconciliationWarningForUi ? (
                                        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                                          Avviso: {reconciliationWarningForUi}
                                        </div>
                                      ) : null}
                                      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] space-y-2">
                                        <p className="text-zinc-400 uppercase tracking-wider mb-1">Cast fedele</p>
                                        <p className="text-zinc-400">Persone visive rilevate nei fotogrammi: <span className="text-white font-semibold">{realDisplayCastCountForUi}</span></p>
                                        <p className="text-zinc-400">Ruoli/categorie rilevate: <span className="text-white font-semibold">{canonicalRoleGroupsCountForUi}</span></p>
                                        <p className="text-zinc-400">Cast fedele stimato: <span className="text-white font-semibold">{realDisplayCastCountForUi} persone visive distinte</span></p>
                                        <p className="text-zinc-400">Cast narrativo raggruppato: <span className="text-white font-semibold">{canonicalRoleGroupsCountForUi} gruppi</span></p>
                                        <p className="text-zinc-400">Speaker audio reali: <span className="text-amber-500 font-semibold italic">non disponibili</span></p>
                                        <p className="text-zinc-400">Attribuzione battute: <span className="text-white font-semibold">{speakerAttributionForUi}</span></p>
                                        <p className="text-zinc-400">Battute audio: <span className="text-white font-semibold">{dialogueFrameAlignment.length}</span></p>
                                        <p className="text-zinc-400">Battute con speaker certo: <span className="text-white font-semibold">0</span></p>
                                        <p className="text-zinc-400">Battute attribuite in modo probabile: <span className="text-white font-semibold">{strongCandidateRows}</span></p>
                                        <p className="text-zinc-400">Battute sconosciute: <span className="text-white font-semibold">{unknownDialogueAssignmentsCount}</span></p>
                                        <p className="text-zinc-500">Nota: attribuzione basata su tempo audio + fotogramma vicino, non su analisi labiale.</p>
                                        {lostIndividualityWarningForUi ? (
                                          <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200">Rischio compressione cast: {lostIndividualityWarningForUi}</div>
                                        ) : null}
                                      </div>
                                      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px]">
                                        <p className="text-zinc-400 uppercase tracking-wider mb-2">Cast visivo individuale</p>
                                        <SafeListRenderer
                                          items={faithfulRawVisualPersonsForUi}
                                          emptyMessage={<span className="text-zinc-500 italic">Nessun soggetto visivo individuale confermato</span>}
                                          renderItem={(person: any, idx: number) => (
                                            <div key={`faithful-cast-person-${idx}`} className="text-zinc-200">- {humanizeVisionText(String(person?.id || `person_${idx + 1}`))} — {humanizeVisionText(translateSpeakerLabel(String(person?.roleLabel || "Soggetto visivo")))} — {Array.isArray(person?.timestamps) && person.timestamps.length > 0 ? person.timestamps.join(", ") : "secondi non disponibili"}</div>
                                          )}
                                        />
                                      </div>
                                      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px]">
                                        <p className="text-zinc-400 uppercase tracking-wider mb-2">Cast raggruppato per ruolo</p>
                                        <SafeListRenderer
                                          items={faithfulGroupedRolesForUi}
                                          emptyMessage={<span className="text-zinc-500 italic">Nessun gruppo di ruolo confermato</span>}
                                          renderItem={(group: any, idx: number) => (
                                            <div key={`faithful-role-group-${idx}`} className="text-zinc-200">- {group?.count || 0} soggetti: {humanizeVisionText(translateSpeakerLabel(String(group?.roleLabel || "ruolo non classificato")))}</div>
                                          )}
                                        />
                                      </div>
                                      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px]">
                                        <p className="text-zinc-400 uppercase tracking-wider mb-2">Elenco cast usato</p>
                                        <SafeListRenderer
                                          items={promptSafeCastListForUi}
                                          emptyMessage={<span className="text-zinc-500 italic">Cast non confermato / informazioni insufficienti</span>}
                                          renderItem={(label: string, idx: number) => (
                                            <div key={`cast-card-used-${idx}`} className="text-zinc-200">- {translateSpeakerLabel(label)}</div>
                                          )}
                                        />
                                      </div>
                                      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px]">
                                        <p className="text-zinc-400 uppercase tracking-wider mb-2">Audio - verifica voci</p>
                                        <div className="space-y-1 text-zinc-300">
                                          <p>Transcript Groq: <span className="text-white font-semibold">{result?.audioVoiceUserSummary?.transcriptAvailable ? "disponibile" : "non disponibile"}</span></p>
                                          <p>Diarizzazione reale audio: <span className="text-amber-400 font-semibold">NON DISPONIBILE</span></p>
                                          <p>Voci reali da audio: <span className="text-amber-400 font-semibold">NON DETERMINABILI</span></p>
                                          <p>Motivo: <span className="text-zinc-400">Manca diarizzazione reale / voice embedding.</span></p>
                                          <p>Segmenti Whisper: <span className="text-white font-semibold">{audioSegmentsForUi.length}</span></p>
                                          <p className="text-zinc-500 italic">Nota: I segmenti Whisper NON equivalgono a speaker diversi.</p>
                                          <div className="mt-2 pt-2 border-t border-zinc-800/60">
                                            <p>Stima da script: <span className="text-white font-semibold">{typeof result?.audioVoiceUserSummary?.transcriptSpeakerEstimate === "number" ? result.audioVoiceUserSummary.transcriptSpeakerEstimate : (typeof castAuditForCard?.estimatedSpeakerCount === "number" ? castAuditForCard.estimatedSpeakerCount : "Non disponibile")}</span></p>
                                            <p>Confidenza stima da script: <span className="text-white font-semibold">{castAuditForCard?.speakerEstimateConfidence || "BASSA/MEDIA"}</span></p>
                                            <p>Motivo stima: <span className="text-zinc-400">{castAuditForCard?.speakerEstimateReason || "Stima basata solo sulla struttura del testo, non su timbro audio reale."}</span></p>
                                          </div>
                                        </div>
                                        {audioSpeakerDiagnosticForUi?.possibleUndercountComparedToVisual ? (
                                          <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200">
                                            Possibile sottostima audio rispetto al cast visivo.
                                          </div>
                                        ) : null}
                                        {mergedFrameTimeline.some((frame: any) => frame?.observed === false) ? (
                                          <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200">
                                            Attenzione: gli ultimi frame non hanno osservazione visiva; le battute finali restano unknown.
                                          </div>
                                        ) : null}
                                      </div>
                                     <div className="mt-4 space-y-2">
                                       {visibleSubjects.length > 0 ? visibleSubjects.map((subject: string, idx: number) => {
                                         const label = translateSpeakerLabel(subject);
                                         const isDuplicate = visibleSubjects.filter(s => translateSpeakerLabel(s) === label).length > 1;
                                         return (
                                           <div key={idx} className="flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full bg-blue-500/40"></span>
                                              <span className="text-zinc-200 font-medium">{label}{isDuplicate ? ` (soggetto distinto ${idx + 1})` : ""}</span>
                                           </div>
                                         );
                                       }) : <span className="text-zinc-500 italic">Nessun personaggio normalizzato</span>}
                                       {Array.isArray(canonicalCastList) && canonicalCastList.length > 0 && (
                                         <div className="pt-2 mt-2 border-t border-zinc-800/70">
                                           <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Cast leggibile usato nei prompt</p>
                                           <p className="text-zinc-200">{canonicalCastList.map(p => humanizeVisionText(p)).join(", ")}</p>
                                         </div>
                                       )}
                                       {visibleSubjects.length > 1 && visibleSubjects.some(s => s.toLowerCase() === 'man' || s.toLowerCase() === 'woman') && (
                                         <p className="mt-2 text-[10px] text-zinc-500 italic">Nota: alcuni soggetti potrebbero essere non distinguibili con certezza assoluta.</p>
                                       )}
                                   </div>
                                 </div>
                                   <div className="bg-black/30 p-4 rounded-xl border border-zinc-700/30">
                                     <p className="text-zinc-400 text-xs font-bold uppercase mb-2">Analisi di Coscienza Strategica</p>
                                     <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-[11px] space-y-4">
                                       <div className="flex items-start justify-between gap-3">
                                         <div>
                                           <p className="text-emerald-300 font-semibold">Dossier attivo - non ancora collegato ai prompt</p>
                                           <p className="text-zinc-300 leading-relaxed mt-1">
                                             Questa sezione raccoglie valutazioni strategiche reali su hook, loop, payoff, punti deboli, rischi e direzione di miglioramento. In questa fase viene usata come dossier consultabile; non modifica ancora automaticamente i prompt.
                                           </p>
                                         </div>
                                       </div>

                                       <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3 space-y-2">
                                         <p className="text-zinc-500 font-bold uppercase">1. Verdetto strategico</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Human Verdict:</span> {strategicFields.humanVerdict || strategicUnavailableText}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Final Prompt Verdict:</span> {strategicFields.finalPromptVerdict || strategicUnavailableText}</p>
                                       </div>

                                       <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3 space-y-2">
                                         <p className="text-zinc-500 font-bold uppercase">2. Cosa funziona</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Engine Why This Works:</span> {Array.isArray(strategicFields.engineWhyThisWorks) ? strategicFields.engineWhyThisWorks.join(", ") : (strategicFields.engineWhyThisWorks || strategicUnavailableText)}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Analysis Hook:</span> {strategicFields.analysisHook || strategicUnavailableText}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Analysis Retention:</span> {strategicFields.analysisRetention || strategicUnavailableText}</p>
                                       </div>

                                       <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3 space-y-2">
                                         <p className="text-zinc-500 font-bold uppercase">3. Cosa non funziona / cosa e debole</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Engine Why This Fails:</span> {Array.isArray(strategicFields.engineWhyThisFails) ? strategicFields.engineWhyThisFails.join(", ") : (strategicFields.engineWhyThisFails || strategicUnavailableText)}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Analysis Loop:</span> {strategicFields.analysisLoop || strategicUnavailableText}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Analysis Payoff:</span> {strategicFields.analysisPayoff || strategicUnavailableText}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Missing Links:</span> {Array.isArray(strategicFields.missingLinks) ? strategicFields.missingLinks.join(", ") : (strategicFields.missingLinks || strategicUnavailableText)}</p>
                                       </div>

                                       <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3 space-y-2">
                                         <p className="text-zinc-500 font-bold uppercase">4. Direzione di miglioramento</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Engine What To Change:</span> {Array.isArray(strategicFields.engineWhatToChange) ? strategicFields.engineWhatToChange.join(", ") : (strategicFields.engineWhatToChange || strategicUnavailableText)}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Improvement Direction:</span> {strategicFields.engineImprovementDirection || strategicUnavailableText}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Recommendation:</span> {strategicFields.recommendation || strategicUnavailableText}</p>
                                       </div>

                                       <div className="rounded-lg border border-zinc-800/80 bg-black/20 p-3 space-y-2">
                                         <p className="text-zinc-500 font-bold uppercase">5. Rischi per i prompt</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Possible Error:</span> {strategicFields.possibleError || strategicUnavailableText}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Rejected Beats:</span> {Array.isArray(strategicFields.rejectedBeats) ? strategicFields.rejectedBeats.join(", ") : (strategicFields.rejectedBeats || strategicUnavailableText)}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Visual Consequence Confirmed:</span> {strategicFields.visualConsequenceConfirmed || strategicUnavailableText}</p>
                                         <p className="text-zinc-300"><span className="font-bold text-zinc-500">Payoff Confirmed:</span> {strategicFields.payoffConfirmed || strategicUnavailableText}</p>
                                       </div>

                                       <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                                         <p className="text-zinc-500 font-bold uppercase">6. Nota operativa</p>
                                         <p className="text-zinc-300 leading-relaxed">
                                           Questa analisi Ã¨ giÃ  utilizzabile come dossier decisionale, ma non interviene ancora automaticamente nella generazione dei prompt. Le eventuali correzioni ai prompt saranno applicate solo in una fase successiva e in modo controllato.
                                         </p>
                                       </div>
                                     </div>
                                   </div>
                                   {visualTruthEntries.length > 0 && (
                                     <div className="bg-black/30 p-4 rounded-xl border border-zinc-700/30">
                                       <p className="text-zinc-400 text-xs font-bold uppercase mb-2">Analisi di Coscienza - Verita Visiva/Audio</p>
                                       <div className="space-y-3">
                                         {(() => {
                                           const identitiesShownInConscience = visualTruthEntries
                                             .map((entry: any) => String(entry?.recognizedVisualIdentity || entry?.genericFallbackLabel || entry?.rawVisualLabel || "").trim())
                                             .filter(Boolean);
                                           const identitiesLower = identitiesShownInConscience.map((value: string) => value.toLowerCase());
                                           const genericOnlyLabels = identitiesShownInConscience.filter((value: string) => /^(man|woman|young_man|uniformed_man|person_1|person_2|uomo|donna|uomo in uniforme)$/i.test(value));
                                           const hasWoman = identitiesLower.some((value: string) => /woman|donna|female|lady/.test(value));
                                           const hasPriestOrReligiousFigure = identitiesLower.some((value: string) => /prete|sacerdote|religiosa|cardinal|priest|clergyman|religious figure/.test(value));
                                           const hasCarabiniereOrOfficer = identitiesLower.some((value: string) => /carabiniere|police officer|uniformed officer|officer|forza dell'ordine/.test(value));
                                           const diagnosticVerdict =
                                             hasWoman && hasPriestOrReligiousFigure && hasCarabiniereOrOfficer
                                               ? "SPECIFIC_IDENTITIES_VISIBLE_IN_CONSCIENCE"
                                               : (genericOnlyLabels.length === identitiesShownInConscience.length
                                                   ? "GENERIC_ONLY_LABELS_STILL_DOMINANT"
                                                   : "PARTIAL_SPECIFIC_IDENTITIES");
                                           logger.info("[TECHNICAL_CONSCIENCE_CAST_AUDIT]", {
                                             entriesCount: visualTruthEntries.length,
                                             identitiesShownInConscience,
                                             hasWoman,
                                             hasPriestOrReligiousFigure,
                                             hasCarabiniereOrOfficer,
                                             genericOnlyLabels,
                                             diagnosticVerdict
                                           });
                                           return null;
                                         })()}
                                         {visualTruthEntries.map((entry: any, idx: number) => {
                                           const labelUsedInConscience = humanizeVisionText(entry?.recognizedVisualIdentity || entry?.genericFallbackLabel || entry?.rawVisualLabel || "N/A");
                                           const labelUsedInPrompt = humanizeVisionText(entry?.genericFallbackLabel || entry?.recognizedVisualIdentity || entry?.rawVisualLabel || "N/A");
                                           const wasLabelSanitizedForPrompt = labelUsedInConscience !== labelUsedInPrompt;
                                           const frameIndexes = Array.isArray(entry?.frameIndexes) ? entry.frameIndexes : [];
                                           const timestamps = Array.isArray(entry?.timestamps) ? entry.timestamps : [];
                                           const visualEvidence = Array.isArray(entry?.visualEvidence) ? entry.visualEvidence : [];
                                           const audioEvidence = Array.isArray(result?.audioSegments)
                                             ? result.audioSegments.map((segment: any) => String(segment?.text || "").trim()).filter(Boolean).slice(0, 2)
                                             : [];
                                           logger.info("[CONSCIENCE_ANALYSIS_TRUTH_AUDIT]", {
                                             rawVisualLabel: entry?.rawVisualLabel || "",
                                             recognizedVisualIdentity: entry?.recognizedVisualIdentity || "",
                                             genericFallbackLabel: entry?.genericFallbackLabel || "",
                                             labelUsedInConscience,
                                             labelUsedInPrompt,
                                             wasSanitizedForPrompt: wasLabelSanitizedForPrompt,
                                             confidence: entry?.confidence || "UNKNOWN",
                                             visualEvidence,
                                             audioEvidence,
                                             frameIndexes,
                                             timestamps,
                                             reason: entry?.reason || "",
                                             uncertaintyWarning: entry?.uncertaintyWarning || ""
                                           });
                                           return (
                                             <div key={`visual-truth-${idx}`} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-[11px]">
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Cosa ho visto:</span> {humanizeVisionText(entry?.rawVisualLabel || "N/A")}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Cosa ho riconosciuto:</span> {labelUsedInConscience}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Differenza tra label vista e prompt:</span> {labelUsedInPrompt}{wasLabelSanitizedForPrompt ? " (adattata per prompt)" : " (coincide con la verita visiva)"}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Fonte della descrizione:</span> {humanizeVisionText(entry?.reason || "N/A")}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Cosa NON ho confermato:</span> {humanizeVisionText(entry?.uncertaintyWarning || "Nessuna incertezza rilevante")}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Confidenza:</span> {entry?.confidence || "UNKNOWN"}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Prove dai fotogrammi:</span></p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Prove dall'audio:</span> {audioEvidence.length > 0 ? audioEvidence.join(" | ") : "N/A"}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Pubblico / applausi sentiti:</span> {audienceAudioConfirmed ? "si, confermati dall'audio" : "non confermati dall'audio"}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Pubblico visibile nei frame:</span> {audienceVisualConfirmed ? "si, confermato visivamente" : "no, non confermato visivamente"}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Fotogrammi:</span> {frameIndexes.length > 0 ? frameIndexes.join(", ") : "N/A"}</p>
                                               <p className="text-zinc-300"><span className="font-bold text-zinc-500">Secondi del video:</span> {timestamps.length > 0 ? timestamps.join(", ") : "N/A"}</p>
                                             </div>
                                           );
                                         })}
                                       </div>
                                     </div>
                                   )}
                                 </div>

                                 {/* ATTRIBUTION INFO */}
                                 <div className="space-y-4">
                                   <div className="bg-black/30 p-4 rounded-xl border border-zinc-700/30">
                                     <p className="text-zinc-400 text-xs font-bold uppercase mb-2">Pianificazione Attribuzione</p>
                                     <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="text-zinc-400">ModalitÃ :</span>
                                          <span className={`font-mono px-2 py-0.5 rounded text-[10px] ${dialogueSyncAudit?.speakerAssignmentMode === "CAUTIOUS_PROBABLE_SPEAKER_ASSIGNMENT" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                                            {dialogueSyncAudit?.speakerAssignmentMode === "CAUTIOUS_PROBABLE_SPEAKER_ASSIGNMENT" ? "CAUTA / PROBABILE" : "CERTIFICATA"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="text-zinc-400">Turni associati:</span>
                                          <span className="font-bold text-white">{dialogueSyncAudit?.probableAssignmentsCount || 0} / {dialogueSyncAudit?.dialogueTurnsCount || 0}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-zinc-800">
                                          <div className="text-center">
                                            <div className="text-[10px] text-zinc-500 uppercase">Alta</div>
                                            <div className="font-bold text-emerald-400">{dialogueSyncAudit?.highConfidenceAssignmentsCount || 0}</div>
                                          </div>
                                          <div className="text-center">
                                            <div className="text-[10px] text-zinc-500 uppercase">Media</div>
                                            <div className="font-bold text-amber-400">{(dialogueSyncAudit?.mediumConfidenceAssignmentsCount || 0) + (dialogueSyncAudit?.mediumLowConfidenceAssignmentsCount || 0)}</div>
                                          </div>
                                          <div className="text-center">
                                            <div className="text-[10px] text-zinc-500 uppercase">Bassa</div>
                                            <div className="font-bold text-orange-400">{dialogueSyncAudit?.lowConfidenceAssignmentsCount || 0}</div>
                                          </div>
                                        </div>
                                     </div>
                                   </div>
                                 </div>
                               </div>

                               {/* MAPPA CRONOLOGICA DEGLI INTERVENTI */}
                               <div className="mt-6">
                                 <p className="text-zinc-400 text-xs font-bold uppercase mb-3 flex items-center gap-2">
                                   <Clock className="w-3 h-3" /> Esempi di mapping cronologico
                                 </p>
                                 <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                                   {(() => {
                                      const assignments = dialogueSyncAudit?.possibleSpeakerAssignments || dialogueFrameAlignment || [];
                                      const rendered = assignments.slice(0, 15).map((entry: any, index: number) => {
                                        const speakerFromEntry = sanitizeDirtySpeakerLabel(entry?.probableSpeakerLabel || entry?.possibleSpeakerFromFrame || "unknown");
                                        const isUnassigned = speakerFromEntry === "unknown" || speakerFromEntry === "ambiguous";
                                        const confidence = entry?.speakerInferenceConfidence || entry?.assignmentConfidence || "LOW";
                                        
                                        return (
                                          <div key={index} className={`bg-zinc-900/40 border p-2 rounded-lg flex items-start gap-3 ${isUnassigned ? "border-zinc-800/50" : "border-blue-500/20"}`}>
                                            <div className="font-mono text-[10px] text-zinc-500 w-14 pt-0.5 shrink-0">
                                              {entry?.startTime ? `${entry.startTime}s` : "??s"}
                                            </div>
                                            <div className="flex-1">
                                              <p className="text-zinc-100 text-xs italic line-clamp-1">"{entry?.line}"</p>
                                              {!isUnassigned ? (
                                                <div className="flex items-center justify-between mt-1">
                                                  <p className="text-[10px] text-blue-400 flex items-center gap-1 font-medium">
                                                    <ArrowRight className="w-2 h-2" /> {translateSpeakerLabel(speakerFromEntry, speakerFromEntry === "ambiguous")}
                                                  </p>
                                                  <span className="text-[9px] text-zinc-500 bg-zinc-800/50 px-1.5 rounded uppercase">
                                                    confidenza {translateConfidenceLabel(confidence)}
                                                  </span>
                                                </div>
                                              ) : (
                                                <p className="text-[10px] mt-1 text-zinc-500 italic flex items-center gap-1">
                                                  <AlertCircle className="w-2 h-2 opacity-50" /> personaggio non assegnabile
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      });

                                      if (assignments.length === 0) return <p className="text-zinc-500 italic text-center py-4">Nessun mapping disponibile</p>;

                                      logger.info("[UI_DIALOGUE_ASSIGNMENTS_RENDERED]", {
                                        visualCastCount: visibleSubjects.length,
                                        displayCastList: visibleSubjects.map((s: any) => translateSpeakerLabel(s)),
                                        renderedAssignmentsCount: assignments.length,
                                        mode: dialogueSyncAudit?.speakerAssignmentMode
                                      });

                                      return (
                                        <>
                                          {rendered}
                                          {assignments.length > 15 && (
                                            <div className="text-center py-1">
                                              <span className="text-[10px] text-zinc-600">...altri {assignments.length - 15} interventi analizzati</span>
                                            </div>
                                          )}
                                        </>
                                      );
                                   })()}
                                 </div>
                               </div>
                            </div>

                            <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm mb-4 text-sm text-zinc-200">
                              <h4 className="font-bold text-white mb-3 border-b border-zinc-700 pb-1 uppercase tracking-wider">Controllo Analisi</h4>
                              <div className="space-y-2">
                                <p><span className="font-bold text-zinc-400">Audio:</span> {trace.heard?.transcriptAvailable ? "OK - trascrizione rilevata" : "non disponibile"}</p>
                                <p><span className="font-bold text-zinc-400">Video:</span> OK - {trace.seen?.usedFramesReal ?? mergedFrameTimeline.length ?? 0} frame analizzati</p>
                                <p><span className="font-bold text-zinc-400">Tempi battute:</span> {originalTimedScriptRows.length > 0 ? "OK - battute collegate ai secondi" : "non disponibili"}</p>
                                <p><span className="font-bold text-zinc-400">Personaggi:</span> {characterStatusSimple} - il sistema prova ad associarli, ma non ÃƒÂ¨ una certezza</p>
                                {confidenceSummary.audio !== null && (
                                  <p><span className="font-bold text-zinc-400">Confidenza audio:</span> {confidenceSummary.audio}%</p>
                                )}
                                {confidenceSummary.vision !== null && (
                                  <p><span className="font-bold text-zinc-400">Confidenza visione:</span> {confidenceSummary.vision}%</p>
                                )}
                                {confidenceSummary.cast !== null && (
                                  <p><span className="font-bold text-zinc-400">Confidenza cast:</span> {confidenceSummary.cast}%</p>
                                )}
                                {confidenceSummary.sync !== null && (
                                  <p><span className="font-bold text-zinc-400">Confidenza sincronizzazione dialoghi:</span> {confidenceSummary.sync}%</p>
                                )}
                                {confidenceSummary.prompt !== null && (
                                  <p><span className="font-bold text-zinc-400">UsabilitÃƒÂ  prompt:</span> {confidenceSummary.prompt}%</p>
                                )}
                                {confidenceSummary.publishReadiness && (
                                  <p><span className="font-bold text-zinc-400">Prontezza pubblicazione:</span> {confidenceSummary.publishReadiness}</p>
                                )}
                                {result?.operationalDecision === "GENERATED_REVIEW_REQUIRED" && (
                                  <p><span className="font-bold text-zinc-400">Stato finale:</span> prompt generati da revisionare, non ancora approvati come finali.</p>
                                )}
                                {previousRunSummary && (
                                  <p><span className="font-bold text-zinc-400">Confronto col run precedente:</span> {previousVsCurrentCastDelta === 0 ? "cast stabile" : `cast ${previousVsCurrentCastDelta > 0 ? "migliorato" : "ridotto"} di ${Math.abs(previousVsCurrentCastDelta || 0)} soggetti`}{previousVsCurrentPromptDelta !== null ? `, usabilita prompt ${previousVsCurrentPromptDelta >= 0 ? "migliorata" : "peggiorata"} di ${Math.abs(previousVsCurrentPromptDelta)} punti` : ""}.</p>
                                )}
                              </div>
                            </div>

                            <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm mb-4 text-sm text-zinc-200">
                              <h4 className="font-bold text-white mb-3 border-b border-zinc-700 pb-1 uppercase tracking-wider">Script Originale Temporizzato</h4>
                              <div className="space-y-3 max-h-72 overflow-y-auto">
                                <SafeListRenderer
                                  items={originalTimedScriptRows}
                                  emptyMessage={<p className="text-zinc-500">Nessuna battuta temporizzata disponibile.</p>}
                                  renderItem={(row: any) => (
                                    <div key={row.key} className="rounded border border-zinc-700/50 bg-zinc-900/40 p-3">
                                      <p className="font-mono text-xs text-zinc-400">[{formatSecondsLabel(row.startTime)} - {formatSecondsLabel(row.endTime)}]</p>
                                      <p className="mt-1 leading-relaxed text-zinc-100">{row.line}</p>
                                    </div>
                                  )}
                                />
                              </div>
                            </div>

                            <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm mb-4 text-sm text-zinc-200">
                              <h4 className="font-bold text-white mb-3 border-b border-zinc-700 pb-1 uppercase tracking-wider">Script Ottimizzato con Personaggi</h4>
                              <div className="space-y-3 max-h-80 overflow-y-auto">
                                <SafeListRenderer
                                  items={optimizedCharacterRows}
                                  emptyMessage={<p className="text-zinc-500">Script ottimizzato non disponibile: uso le battute temporizzate quando possibile.</p>}
                                  renderItem={(row: any) => (
                                    <div key={row.key} className="rounded border border-zinc-700/50 bg-zinc-900/40 p-3">
                                      <p className="font-mono text-xs text-zinc-400">
                                        {row.isTimingAvailable
                                          ? `[${formatSecondsLabel(row.startTime)} - ${formatSecondsLabel(row.endTime)}]`
                                          : "[tempo non disponibile]"}
                                      </p>
                                      <p className="mt-1"><span className="font-bold text-zinc-400">Personaggio stimato:</span> {row.speakerLabel} {row.weakAssignment ? "â€” associazione debole" : `â€” affidabilitÃƒÂ  ${row.confidenceLabel.toLowerCase()}`}</p>
                                      <p className="mt-1 leading-relaxed text-zinc-100"><span className="font-bold text-zinc-400">Battuta:</span> {row.line}</p>
                                    </div>
                                  )}
                                />
                              </div>
                            </div>

                            <div className="mt-8 border-t border-zinc-800/50 pt-8">
                              <h4 className="font-bold text-zinc-400 uppercase tracking-wider mb-4">Ulteriori metriche</h4>
                              <div className="space-y-4">

                            <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm mb-4 text-xs text-zinc-300">
                              <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Riepilogo AffidabilitÃ </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                <p><span className="font-bold text-zinc-400">Audio:</span> {trace.heard?.transcriptAvailable ? "verificato" : "non verificato"}</p>
                                <p><span className="font-bold text-zinc-400">Frame:</span> {trace.seen?.usedFramesReal ?? mergedFrameTimeline.length ?? "N/A"}</p>
                                <p><span className="font-bold text-zinc-400">Timeline:</span> {dialogueSyncAudit?.frameTimelineSource || "reale"}</p>
                                <p><span className="font-bold text-zinc-400">Speaker labels:</span> {dialogueSyncAudit?.transcriptHasSpeakerLabels ? "SÃŒ" : "NO"}</p>
                                <p><span className="font-bold text-zinc-400">Speaker attribution:</span> {castAndDialogueAudit?.speakerAttributionConfidence || "LOW"}</p>
                                <p><span className="font-bold text-zinc-400">Prompt risk:</span> {summaryPromptRisk}</p>
                              </div>
                              <p className="mt-3 text-amber-300 italic">{speakerAttributionUiStatus}</p>
                            </div>

                            <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm mb-4 text-xs text-zinc-300">
                              <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Timeline Script + Frame + Speaker</h4>
                              <div className="space-y-3 max-h-80 overflow-y-auto">
                                {dialogueFrameAlignment.length > 0 ? dialogueFrameAlignment.map((entry: any, index: number) => (
                                  <div key={`timeline-speaker-row-${index}`} className="rounded border border-zinc-700/50 bg-zinc-900/40 p-3">
                                    <p><span className="font-bold text-zinc-400">Tempo audio:</span> [{entry?.startTime ?? "N/A"}s - {entry?.endTime ?? "N/A"}s]</p>
                                    <p><span className="font-bold text-zinc-400">Battuta:</span> {entry?.line || ""}</p>
                                    <p><span className="font-bold text-zinc-400">Frame:</span> {entry?.selectedFrameIndex !== null && entry?.selectedFrameIndex !== undefined ? `Frame ${Number(entry.selectedFrameIndex) + 1}` : "N/A"} - {entry?.selectedFrameTimestamp || "N/A"}</p>
                                    <p><span className="font-bold text-zinc-400">Visto:</span> {Array.isArray(entry?.visibleSubjectsInSelectedFrame) && entry.visibleSubjectsInSelectedFrame.length > 0 ? entry.visibleSubjectsInSelectedFrame.join(", ") : "N/A"}</p>
                                    <p><span className="font-bold text-zinc-400">Azione:</span> {Array.isArray(entry?.visibleActionsInSelectedFrame) && entry.visibleActionsInSelectedFrame.length > 0 ? entry.visibleActionsInSelectedFrame.join(", ") : "N/A"}</p>
                                    <p><span className="font-bold text-zinc-400">Speaker stimato:</span> {translateSpeakerLabel(entry?.possibleSpeakerFromFrame || "unknown", sanitizeDirtySpeakerLabel(entry?.possibleSpeakerFromFrame || "unknown") === "ambiguous")}</p>
                                    <p><span className="font-bold text-zinc-400">Confidenza:</span> {entry?.assignmentConfidence || "LOW"}</p>
                                    <p><span className="font-bold text-zinc-400">Motivo:</span> {entry?.assignmentReason || "N/A"}</p>
                                    {entry?.warning && <p className="text-amber-300 italic"><span className="font-bold">Warning:</span> {entry.warning}</p>}
                                  </div>
                                )) : <p className="text-zinc-500">Timeline centrale non disponibile.</p>}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-300">
                              {/* HO SENTITO */}
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">1. Ho Sentito (Heard)</h4>
                                <ul className="space-y-1">
                                  <li><span className="font-bold text-zinc-400">Transcript:</span> {trace.heard?.transcriptAvailable ? "Disponibile" : "Non disponibile"}</li>
                                  <li><span className="font-bold text-zinc-400">Audio Source:</span> {trace.heard?.audioSource || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Rule Line:</span> {trace.heard?.ruleLineHeard || "Unknown"}</li>
                                  <li><span className="font-bold text-zinc-400">Final Line:</span> {trace.heard?.finalLineHeard ? "SÃ¬" : "No"}</li>
                                  <li><span className="font-bold text-zinc-400">Evidence Strength:</span> {trace.heard?.transcriptEvidenceStrength || "N/A"}</li>
                                </ul>
                              </div>

                              {/* HO VISTO */}
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">2. Ho Visto (Seen)</h4>
                                <ul className="space-y-1">
                                  <li><span className="font-bold text-zinc-400">Vision Provider:</span> {trace.seen?.visionProviderReal || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Used Frames:</span> {trace.seen?.usedFramesReal ?? "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Timestamps:</span> {trace.seen?.frameTimestampsReal || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Frame Observations:</span> {typeof trace.seen?.frameObservations === 'string' ? trace.seen.frameObservations : "Disponibili per frame"}</li>
                                  <li><span className="font-bold text-zinc-400">Payoff Confirmed:</span> {trace.seen?.visualPayoffConfirmed ? "SÃ¬" : "No"}</li>
                                  <li><span className="font-bold text-zinc-400">Evidence Strength:</span> <span className={trace.seen?.visionEvidenceStrength === 'STRONG' ? 'text-emerald-400' : 'text-red-400'}>{trace.seen?.visionEvidenceStrength || "N/A"}</span></li>
                                </ul>
                              </div>

                              {/* HO DEDOTTO */}
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">3. Ho Dedotto (Inferred)</h4>
                                <ul className="space-y-1">
                                  <li><span className="font-bold text-zinc-400">A/V Relation:</span> {trace.inferred?.audioVideoRelation || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Strongest Beat:</span> {trace.inferred?.inferredStrongestBeat || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Confidence:</span> <span className={trace.inferred?.inferenceConfidence === 'HIGH' ? 'text-emerald-400' : 'text-amber-400'}>{trace.inferred?.inferenceConfidence || "N/A"}</span></li>
                                </ul>
                              </div>

                              {/* NON HO VISTO O CONFERMATO */}
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">4. Incertezze</h4>
                                <ul className="space-y-1">
                                  <li><span className="font-bold text-zinc-400">Missing Subject:</span> {String(trace.notSeenOrNotConfirmed?.missingFinalSubject ?? "False")}</li>
                                  <li><span className="font-bold text-zinc-400">Missing Payoff:</span> {String(trace.notSeenOrNotConfirmed?.missingStateChange ?? "False")}</li>
                                  <li><span className="font-bold text-zinc-400">Missing Consequence:</span> {String(trace.notSeenOrNotConfirmed?.missingVisualConsequence ?? "False")}</li>
                                  <li className="italic text-zinc-500 mt-1">{trace.notSeenOrNotConfirmed?.missingReason || ""}</li>
                                </ul>
                              </div>

                              {/* SCELTA */}
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">5. Decisione</h4>
                                <ul className="space-y-1">
                                  <li><span className="font-bold text-zinc-400">Selected Beat:</span> {trace.decision?.selectedBeat || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Selected Character:</span> {trace.decision?.selectedCharacter || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Selected Line:</span> {trace.decision?.selectedLine || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Why Payoff Not Selected:</span> {trace.decision?.whyFinalPayoffNotSelected || "N/A"}</li>
                                </ul>
                              </div>

                              {/* RISCHIO */}
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">6. Rischio & Cobertura</h4>
                                <div className={`p-2 rounded mt-1 border ${trace.risk?.riskLevel === 'LOW' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                                  <span className="font-bold block mb-1 uppercase tracking-wider text-[10px]">Livello: {trace.risk?.riskLevel || "UNKNOWN"}</span>
                                  {trace.risk?.possibleError || "Nessuno"}
                                  <p className="mt-1 text-[10px] opacity-70 italic">Rec: {trace.risk?.recommendation || "N/A"}</p>
                                </div>
                                <div className="mt-2 text-zinc-500 italic">
                                  Frames {'>'} 46s: {trace.finalFramesCoverage?.framesAfter46s} | {trace.finalFramesCoverage?.finalSubjectVisible}
                                </div>
                                {trace.finalFramesCoverage?.reasonIfFinalSubjectNotSelected && <div className="mt-1 text-zinc-500 italic">Info: {trace.finalFramesCoverage.reasonIfFinalSubjectNotSelected}</div>}
                              </div>

                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-xs text-zinc-300 mt-4">
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Script Originale Temporizzato</h4>
                                <div className="space-y-2 max-h-56 overflow-y-auto">
                                  <SafeListRenderer
                                    items={timedScriptRows}
                                    emptyMessage={<p className="text-zinc-500">Nessun segmento audio disponibile.</p>}
                                    renderItem={(turn: any, index: number) => (
                                      <div key={`app-trace-script-${index}`} className="rounded border border-zinc-700/50 bg-zinc-900/40 p-2">
                                        <p><span className="font-bold text-zinc-400">Tempo:</span> [{turn?.startTime ?? "N/A"} - {turn?.endTime ?? "N/A"}]</p>
                                        <p><span className="font-bold text-zinc-400">Battuta:</span> {turn?.line || ""}</p>
                                        <p><span className="font-bold text-zinc-400">Timing:</span> {turn?.timingSource || "N/A"} / {turn?.confidence || "LOW"}</p>
                                      </div>
                                    )}
                                  />
                                </div>
                              </div>

                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Cast e Dialoghi</h4>
                                <ul className="space-y-1">
                                  <li><span className="font-bold text-zinc-400">Cast rilevato:</span> {castDisplayEntries.length > 0 ? castDisplayEntries.map((entry: any) => `${entry.title} - ${entry.label}${entry.detail ? `, ${entry.detail}` : ""}`).join(" | ") : (visibleSubjects.length > 0 ? visibleSubjects.join(", ") : "Cast non confermato / informazioni insufficienti")}</li>
                                  <li><span className="font-bold text-zinc-400">Visual Cast Count:</span> {effectiveCastGroundingAudit?.visualCastCount ?? result?.visualCastCount ?? 0}</li>
                                  <li><span className="font-bold text-zinc-400">TranscriptHasSpeakerLabels:</span> {dialogueSyncAudit?.transcriptHasSpeakerLabels ? "SÃ¬" : "No"}</li>
                                  <li><span className="font-bold text-zinc-400">CanAssignSpeakers:</span> {dialogueSyncAudit?.canAssignSpeakers ? "SÃ¬" : "No"}</li>
                                  <li><span className="font-bold text-zinc-400">Confidence:</span> {dialogueSyncAudit?.confidence || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Speaker Attribution Confidence:</span> {castAndDialogueAudit?.speakerAttributionConfidence || "LOW"}</li>
                                </ul>
                              </div>

                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Script / Battute Usate Nei Prompt</h4>
                                <div className="space-y-2 max-h-56 overflow-y-auto">
                                  <SafeListRenderer
                                    items={promptUsedLinesAudit}
                                    emptyMessage={<p className="text-zinc-500">Nessuna battuta del transcript ÃƒÂ¨ stata collegata con sicurezza ai prompt finali.</p>}
                                    renderItem={(entry: any, index: number) => (
                                      <div key={`prompt-used-line-${index}`} className="rounded border border-zinc-700/50 bg-zinc-900/40 p-2">
                                        <p><span className="font-bold text-zinc-400">Tempo audio:</span> [{entry?.startTime ?? "N/A"}s - {entry?.endTime ?? "N/A"}s]</p>
                                        <p><span className="font-bold text-zinc-400">Battuta usata:</span> {entry?.line || ""}</p>
                                        <p><span className="font-bold text-zinc-400">Usata in:</span> {entry?.usedIn?.join(", ") || "N/A"}</p>
                                        <p><span className="font-bold text-zinc-400">Speaker stimato:</span> {translateSpeakerLabel(entry?.possibleSpeakerFromFrame || "unknown", sanitizeDirtySpeakerLabel(entry?.possibleSpeakerFromFrame || "unknown") === "ambiguous")}</p>
                                         <p><span className="font-bold text-zinc-400">Confidenza:</span> {entry?.assignmentConfidence || "LOW"}</p>
                                         {entry?.warning && <p className="text-amber-300 italic">Nota: {entry.warning}</p>}
                                       </div>
                                     )}
                                   />
                                 </div>
                               </div>

                               <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Verità Fotogramma per Fotogramma (Visione)</h4>
                                <div className="text-[11px] text-zinc-400 mb-3 font-mono inline-flex items-center gap-1.5 bg-black/30 px-2 py-1.5 rounded border border-zinc-800">
                                  <span>METODO PIPELINE:</span>
                                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                                    frameObservationsCountForUi === 1 
                                      ? "text-amber-400 bg-amber-950/40 border border-amber-900" 
                                      : "text-blue-400 bg-blue-950/40 border border-blue-900"
                                  }`}>
                                    {frameObservationsCountForUi === 1 
                                      ? "Struttura Aggregata Fallback (frameObservationsCount: 1)" 
                                      : `NEW VISOR 80/80 BATCH PROCESS (${frameObservationsCountForUi}/${frameTimestampsCountForUi} frames)`}
                                  </span>
                                </div>
                                {missingObservationFramesForUi > 0 && (
                                  <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                                     <p className="font-bold mb-1">Rapporto copertura visione:</p>
                                     <p>Ho estratto {frameTimestampsCountForUi} fotogrammi. Ho ricevuto risposta vision per {frameObservationsCountForUi} fotogrammi.</p>
                                     {castAuditForCard?.recoveryAttempted && (
                                       <p className={`mt-1 font-bold ${castAuditForCard?.recoverySuccessful ? 'text-emerald-400' : 'text-amber-400'}`}>
                                         {castAuditForCard?.recoverySuccessful 
                                           ? "✓ Recupero fotogrammi mancanti riuscito (chiave secondaria utilizzata)." 
                                           : "⚠ Tentativo di recupero fotogrammi fallito (chiave secondaria)."}
                                       </p>
                                     )}
                                     {missingObservationFramesForUi > 0 && (
                                       <>
                                         <p className="mt-1">Non ho ricevuto risposta vision per {missingObservationFramesForUi} fotogrammi: {mergedFrameTimeline.filter((f: any) => !f.observed).map((f: any) => `${f.timestampReal || f.timestamp}`).join(", ")}.</p>
                                         <p className="mt-1 italic">La parte finale del video non è confermata visivamente.</p>
                                       </>
                                     )}
                                  </div>
                                )}
                                <div className="space-y-2 max-h-72 overflow-y-auto w-full">
                                  {(() => {
                                    // Use trace.seen?.visionProviderReal or fallback
                                    const resolvedTimelineForUi = mergedFrameTimeline.length > 0
                                      ? mergedFrameTimeline
                                      : (frameTimestampsForUi || []).slice(0, 10).map((ts, idx) => {
                                          const obs = effectiveFrameObservations.find((o: any) => Number(o.frameIndex) === idx);
                                          const isActuallyObserved = !!obs?.visibleAction || (Array.isArray(obs?.visibleSubjects) && obs.visibleSubjects.length > 0);
                                          return {
                                            frameIndex: idx,
                                            timestamp: String(ts),
                                            observed: isActuallyObserved,
                                            visibleSubjects: obs?.visibleSubjects || [],
                                            visibleObjects: obs?.visibleObjects || [],
                                            visibleAction: obs?.visibleAction || "",
                                            confidence: obs?.confidence || obs?.visualConfidence || "N/A",
                                            source: trace.seen?.visionProviderReal || "N/A"
                                          };
                                        });

                                    return resolvedTimelineForUi.length > 0 ? (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs text-zinc-300 border-collapse">
                                          <thead>
                                            <tr className="border-b border-zinc-700">
                                              <th className="p-2 font-bold text-zinc-400">Fotogramma</th>
                                              <th className="p-2 font-bold text-zinc-400 min-w-[50px]">Secondo</th>
                                              <th className="p-2 font-bold text-zinc-400">Stato</th>
                                              <th className="p-2 font-bold text-zinc-400 min-w-[200px]">Cosa ho visto</th>
                                              <th className="p-2 font-bold text-zinc-400">Soggetti</th>
                                              <th className="p-2 font-bold text-zinc-400">Oggetti</th>
                                              <th className="p-2 font-bold text-zinc-400">Conf.</th>
                                              <th className="p-2 font-bold text-zinc-400">Fonte</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {resolvedTimelineForUi.map((frame: any) => {
                                              const isRecovered = frame.sourceKeySlot === 1;
                                              const observedLabel = frame.observed ? (isRecovered ? "Sì (Recupero)" : "Sì") : "NON VISTO";
                                              const actionText = frame.visibleAction?.trim() ? humanizeVisionText(frame.visibleAction, 'raw') : (frame.observed ? "solo dati entità" : "nessuna risposta vision");
                                              const subjects = (Array.isArray(frame.visibleSubjects) && frame.visibleSubjects.length > 0) ? frame.visibleSubjects.map((s: any) => humanizeVisionText(s, 'raw')).join(", ") : "non disp.";
                                              const objects = (Array.isArray(frame.visibleObjects) && frame.visibleObjects.length > 0) ? frame.visibleObjects.map((o: any) => humanizeVisionText(o, 'raw')).join(", ") : "non disp.";
                                              return (
                                                <tr key={`app-trace-frame-tbl-${frame.frameIndex}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                  <td className="p-2 font-mono text-zinc-400">{Number(frame.frameIndex) + 1}</td>
                                                  <td className="p-2 text-zinc-400">{frame.timestampReal || frame.timestamp || "N/A"}</td>
                                                  <td className={`p-2 font-bold ${frame.observed ? (isRecovered ? 'text-cyan-400' : 'text-emerald-400') : 'text-amber-400'} whitespace-nowrap`}>{observedLabel}</td>
                                                  <td className="p-2 text-zinc-200">{actionText}{!frame.observed && frame.warning ? ` — ${humanizeVisionText(frame.warning)}` : ""}</td>
                                                  <td className="p-2 text-cyan-400/80">{subjects}</td>
                                                  <td className="p-2 text-amber-500/80">{objects}</td>
                                                  <td className="p-2 text-zinc-500">{translateConfidenceLabel(frame.confidence) || "N/A"}</td>
                                                  <td className="p-2 text-zinc-500">{isRecovered ? "Secondaria (Slot 1)" : (frame.sourceKeySlot === 0 ? "Primaria (Slot 0)" : (frame.source || "N/A"))}</td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                       <div className="space-y-1">
                                         {Array.isArray(dialogueSyncAudit?.realFrameTimestamps) && dialogueSyncAudit.realFrameTimestamps.length > 0 ? dialogueSyncAudit.realFrameTimestamps.map((ts: any, idx: number) => (
                                           <p key={`frame-ts-${idx}`}>Fotogramma {idx + 1} - {String(ts)}</p>
                                         )) : <p className="text-zinc-500">Timeline fotogrammi non disponibile.</p>}
                                       </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              
                                                            <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Sincronizzazione Battute-Frame</h4>
                                <div className="space-y-2 max-h-56 overflow-y-auto">
                                  <SafeListRenderer
                                    items={dialogueFrameAlignment}
                                    emptyMessage={<p className="text-zinc-500">Sincronizzazione battute-frame non disponibile.</p>}
                                    renderItem={(entry: any, index: number) => (
                                      <div key={`app-trace-align-${index}`} className="rounded border border-zinc-700/50 bg-zinc-900/40 p-2">
                                        <p><span className="font-bold text-zinc-400">Battuta:</span> {entry?.line || ""}</p>
                                        <p><span className="font-bold text-zinc-400">Start/End/Mid:</span> {entry?.startTime ?? "N/A"} / {entry?.endTime ?? "N/A"} / {entry?.midTime ?? "N/A"}</p>
                                        <p><span className="font-bold text-zinc-400">Nearest Frame:</span> {entry?.selectedFrameIndex ?? "N/A"} - {entry?.selectedFrameTimestamp || "N/A"}</p>
                                        <p><span className="font-bold text-zinc-400">Delta:</span> {entry?.timeDeltaSeconds ?? "N/A"}s</p>
                                      </div>
                                    )}
                                  />
                                </div>
                              </div>

                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Meccanismo Scena</h4>
                                <ul className="space-y-1">
                                  <li><span className="font-bold text-zinc-400">Rule Detected:</span> {sceneMechanismAudit?.ruleDetectedFromTranscript ? "SÃ¬" : "No"}</li>
                                  <li><span className="font-bold text-zinc-400">Rule Line:</span> {sceneMechanismAudit?.ruleLine || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Trigger:</span> {sceneMechanismAudit?.triggerCondition || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Expected Consequence:</span> {sceneMechanismAudit?.expectedConsequence || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">OperationalDecision:</span> {result?.operationalDecision || "N/A"}</li>
                                  <li><span className="font-bold text-zinc-400">Perché:</span> {trace.risk?.possibleError || "Nessuno"}</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                    </details>
                      </div>
                  </div>
                </div>


            );
          })()}


                    {/* Prompts Fase 2 Falliti (mostra anche se prompts non validi) */}
                    {(!result?.promptQualityReport?.finalPass && result?.operationalDecision === "PROMPT_ENGINE_FAILED") && (
                      <div className="mt-8 pt-8 border-t border-zinc-800/50">
                        <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6">
                          <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Validazione Prompt Fallita
                          </h3>
                          <p className="text-sm text-red-200 mb-2">I prompt non hanno superato i controlli di qualitÃ  tecnici e non sono stati generati.</p>
                          <div className="bg-red-950/50 p-4 rounded text-xs text-red-300 font-mono border border-red-900/50">
                            Log di validazione: {typeof result?.promptQualityReport?.report === 'object' ? JSON.stringify(result.promptQualityReport.report, null, 2) : (result?.promptQualityReport?.report || "Generic template found")}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* AI Prompts Section */}
                  {(result.aiPrompts || result.soraPrompt12s || result.klingPrompt || result.veoPrompt || result.klingPrompt1 || result.veoPrompt1) && (
                    <div className="mt-8 pt-8 border-t border-zinc-800/50">
                      {coerceDisplayText(result.aiPrompts).includes('PART 1:') && coerceDisplayText(result.aiPrompts).includes('PART 2:') ? (
                        <div className="space-y-8">
                          {/* Istruzioni Luma AI Multi-Part */}
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                            <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                              <BrainCircuit className="w-4 h-4" /> Istruzioni per Luma AI
                            </h3>
                            <p className="text-sm text-blue-100/80">
                              Copia e incolla questo messaggio nella chat di Luma AI prima di inserire i prompt:
                            </p>
                            <div className="mt-2 p-3 bg-black/30 rounded-lg text-sm text-zinc-300 font-mono relative group flex items-start justify-between gap-4">
                              <p className="flex-1">
                                Ho due prompt per fare un video. Controlla i prompt se serve l'immagine di riferimento e mi devi fare i due video con {activePromptTab1 === 'sora' ? 'Prompt ottimizzato universale' : activePromptTab1 === 'kling' ? 'Kling 3.0' : 'Veo 3'} e devi darmi il video finale di {activePromptTab1 === 'sora' ? (parseInt(soraDuration1) + parseInt(soraDuration2)) : activePromptTab1 === 'kling' ? '30' : '16'} secondi. I tempi algoritmici sono giÃ  stati ottimizzati nei prompt.
                              </p>
                              <CopyButton 
                                text={`Ho due prompt per fare un video. Controlla i prompt se serve l'immagine di riferimento e mi devi fare i due video con ${activePromptTab1 === 'sora' ? 'Prompt ottimizzato universale' : activePromptTab1 === 'kling' ? 'Kling 3.0' : 'Veo 3'} e devi darmi il video finale di ${activePromptTab1 === 'sora' ? (parseInt(soraDuration1) + parseInt(soraDuration2)) : activePromptTab1 === 'kling' ? '30' : '16'} secondi. I tempi algoritmici sono giÃ  stati ottimizzati nei prompt.`}
                                className="shrink-0"
                              />
                            </div>
                          </div>

                          {/* Part 1 */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-500/20 rounded-lg">
                                  <BrainCircuit className="w-5 h-5 text-orange-400" />
                                </div>
                                <h2 className="text-xl font-bold text-orange-100">AI Prompt - PARTE 1</h2>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                  <button
                                    onClick={() => setActivePromptTab1('sora')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptTab1 === 'sora' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Prompt ottimizzato
                                  </button>
                                  <button
                                    onClick={() => setActivePromptTab1('kling')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptTab1 === 'kling' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Kling 3.0
                                  </button>
                                  <button
                                    onClick={() => setActivePromptTab1('veo')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptTab1 === 'veo' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Veo 3
                                  </button>
                                </div>

                                {activePromptTab1 === 'sora' && (
                                  <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                    <button
                                      onClick={() => setSoraDuration1('15s')}
                                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${soraDuration1 === '15s' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                      15s
                                    </button>
                                    <button
                                      onClick={() => setSoraDuration1('12s')}
                                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${soraDuration1 === '12s' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                      12s
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 mb-4">
                                <button
                                  onClick={undoActivePrompt1}
                                  disabled={!canUndoActivePrompt1}
                                  className="p-2 text-zinc-400 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
                                  title="Annulla"
                                >
                                  <Undo className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={redoActivePrompt1}
                                  disabled={!canRedoActivePrompt1}
                                  className="p-2 text-zinc-400 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
                                  title="Ripeti"
                                >
                                  <Redo className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRewritePrompt(activePrompt1, setActivePrompt1, setIsRewriting1, rewriteLevel1, setRewriteLevel1, setFlashPrompt1)}
                                  disabled={isRewriting1}
                                  className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                  title={`Correggi parole a rischio con l'IA (Livello ${rewriteLevel1})`}
                                >
                                  {isRewriting1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                  <span className="hidden sm:inline">Bypass L{rewriteLevel1}</span>
                                </button>
                                <button
                                  onClick={() => handleAntiEmojiPurify(activePrompt1, setActivePrompt1, setIsPurifyingAntiEmoji1, setFlashPrompt1)}
                                  disabled={isPurifyingAntiEmoji1}
                                  className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                  title="Purifica 35mm (Rimuovi Emoji e aggiungi stile Cinematico)"
                                >
                                  {isPurifyingAntiEmoji1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                                  <span className="hidden sm:inline">Anti-Emoji</span>
                                </button>
                                <button
                                  onClick={() => handleToggleForceTextHook(activePrompt1, setActivePrompt1, setIsForcingText1, setFlashPrompt1)}
                                  disabled={isForcingText1}
                                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-medium disabled:opacity-50 ${forceTextHook ? 'bg-blue-500/20 text-blue-300 border-blue-400/40' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20'}`}
                                  title="Forza Testo (Aggiunge istruzioni per forzare il rendering del testo)"
                                >
                                  {isForcingText1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlignLeft className="w-4 h-4" />}
                                  <span className="hidden sm:inline">[T+] Force Text</span>
                                </button>
                                <button
                                  onClick={() => setForceSubtitles(!forceSubtitles)}
                                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-medium ${forceSubtitles ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/20'}`}
                                  title="Forza sottotitoli sincronizzati da dialoghi verificati"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  <span className="hidden sm:inline">[CC] Sottotitoli</span>
                                </button>
                                {activePromptTab1 === 'sora' && (
                                  <button
                                    onClick={() => handleOptimizeSora2(activePrompt1, setActivePrompt1, setIsOptimizingSora2_1)}
                                    disabled={isOptimizingSora2_1}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                    title="Ottimizza prompt video universale (massima resa in 15s)"
                                  >
                                    {isOptimizingSora2_1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Prompt ottimizzato</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDetectDangerousWords(activePrompt1, setIsDetectingDangerousWords_1)}
                                  disabled={isDetectingDangerousWords_1}
                                  className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                  title="Rileva parole a rischio"
                                >
                                  {isDetectingDangerousWords_1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                  <span className="hidden sm:inline">Rileva</span>
                                </button>
                                <button
                                  onClick={() => handleCopyPrompts1()}
                                  className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg transition-colors text-sm font-medium"
                                >
                                  {isCopiedPrompts1 ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                  {isCopiedPrompts1 ? 'Copiato!' : 'Copia Parte 1'}
                                </button>
                            </div>
                            
                            {getDangerousWordsInText(activePrompt1, dangerousWords).length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2 items-center">
                                <span className="text-xs text-yellow-500/80 font-medium flex items-center gap-1">
                                  <Shield className="w-3 h-3" /> Parole a rischio evidenziate:
                                </span>
                                {getDangerousWordsInText(activePrompt1, dangerousWords).map((word, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleBypassWord(word, 'prompts1')}
                                    disabled={bypassingWord?.word === word && bypassingWord?.target === 'prompts1'}
                                    className="text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                                    title="Clicca per aggirare questa parola nel prompt"
                                  >
                                    {bypassingWord?.word === word && bypassingWord?.target === 'prompts1' ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Wand2 className="w-3 h-3" />
                                    )}
                                    {word}
                                  </button>
                                ))}
                              </div>
                            )}

                            <HighlightedTextarea
                              value={activePrompt1}
                              onChange={(e) => setActivePrompt1(e.target.value)}
                              dangerousWords={dangerousWords}
                              onCopy={handleCopyPrompts1}
                              isCopied={isCopiedPrompts1}
                              className="h-64"
                              ringColor="focus:ring-orange-500/30"
                              textColor={flashPrompt1 ? 'text-emerald-400' : 'text-zinc-300'}
                            />
                            <PromptRefiner 
                              prompt={activePrompt1} 
                              onRefined={(newPrompt) => {
                                setActivePrompt1(newPrompt);
                                triggerFlash(setFlashPrompt1);
                              }} 
                              context={result?.analysis || result?.script || ''}
                              colorClass="orange" 
                            />
                            
                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={() => handleAnalyzePrompt(activePrompt1, 'estimate', 'prompt1')}
                                disabled={isAnalyzingPrompt1}
                                className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                              >
                                {isAnalyzingPrompt1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                                Analisi Virale
                              </button>
                              <button
                                onClick={() => handleAnalyzePrompt(activePrompt1, 'anti-ai-slop', 'prompt1')}
                                disabled={isAnalyzingPrompt1}
                                className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                              >
                                {isAnalyzingPrompt1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                                Cura Anti-AI Slop
                              </button>
                            </div>
                            
                            {prompt1Analysis && (
                              <div className={`mt-4 p-4 rounded-xl border ${prompt1Analysis.type === 'anti-ai-slop' ? 'bg-red-500/5 border-red-500/20' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    {prompt1Analysis.type === 'anti-ai-slop' ? <ShieldAlert className="w-5 h-5 text-red-400" /> : <TrendingUp className="w-5 h-5 text-indigo-400" />}
                                    <h3 className={`font-bold ${prompt1Analysis.type === 'anti-ai-slop' ? 'text-red-100' : 'text-indigo-100'}`}>
                                      {prompt1Analysis.type === 'anti-ai-slop' ? 'Cura Anti-AI Slop' : 'Analisi Virale'}
                                    </h3>
                                  </div>
                                  <button onClick={() => setPrompt1Analysis(null)} className="text-zinc-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className={`prose prose-invert max-w-none text-sm ${prompt1Analysis.type === 'anti-ai-slop' ? 'prose-red' : 'prose-indigo'}`}>
                                  <div className="markdown-body">
                                    <Markdown>{prompt1Analysis.result}</Markdown>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Part 2 */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500/20 rounded-lg">
                                  <BrainCircuit className="w-5 h-5 text-red-400" />
                                </div>
                                <h2 className="text-xl font-bold text-red-100">AI Prompt - PARTE 2</h2>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                  <button
                                    onClick={() => setActivePromptTab2('sora')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptTab2 === 'sora' ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Prompt ottimizzato
                                  </button>
                                  <button
                                    onClick={() => setActivePromptTab2('kling')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptTab2 === 'kling' ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Kling 3.0
                                  </button>
                                  <button
                                    onClick={() => setActivePromptTab2('veo')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptTab2 === 'veo' ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Veo 3
                                  </button>
                                </div>

                                {activePromptTab2 === 'sora' && (
                                  <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                    <button
                                      onClick={() => setSoraDuration2('15s')}
                                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${soraDuration2 === '15s' ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                      15s
                                    </button>
                                    <button
                                      onClick={() => setSoraDuration2('12s')}
                                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${soraDuration2 === '12s' ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                      12s
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 mb-4">
                                <button
                                  onClick={undoActivePrompt2}
                                  disabled={!canUndoActivePrompt2}
                                  className="p-2 text-zinc-400 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
                                  title="Annulla"
                                >
                                  <Undo className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={redoActivePrompt2}
                                  disabled={!canRedoActivePrompt2}
                                  className="p-2 text-zinc-400 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
                                  title="Ripeti"
                                >
                                  <Redo className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRewritePrompt(activePrompt2, setActivePrompt2, setIsRewriting2, rewriteLevel2, setRewriteLevel2, setFlashPrompt2)}
                                  disabled={isRewriting2}
                                  className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                  title={`Correggi parole a rischio con l'IA (Livello ${rewriteLevel2})`}
                                >
                                  {isRewriting2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                  <span className="hidden sm:inline">Bypass L{rewriteLevel2}</span>
                                </button>
                                <button
                                  onClick={() => handleAntiEmojiPurify(activePrompt2, setActivePrompt2, setIsPurifyingAntiEmoji2, setFlashPrompt2)}
                                  disabled={isPurifyingAntiEmoji2}
                                  className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                  title="Purifica 35mm (Rimuovi Emoji e aggiungi stile Cinematico)"
                                >
                                  {isPurifyingAntiEmoji2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                                  <span className="hidden sm:inline">Anti-Emoji</span>
                                </button>
                                <button
                                  onClick={() => handleToggleForceTextHook(activePrompt2, setActivePrompt2, setIsForcingText2, setFlashPrompt2)}
                                  disabled={isForcingText2}
                                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-medium disabled:opacity-50 ${forceTextHook ? 'bg-blue-500/20 text-blue-300 border-blue-400/40' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20'}`}
                                  title="Forza Testo (Aggiunge istruzioni per forzare il rendering del testo)"
                                >
                                  {isForcingText2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlignLeft className="w-4 h-4" />}
                                  <span className="hidden sm:inline">[T+] Force Text</span>
                                </button>
                                <button
                                  onClick={() => setForceSubtitles(!forceSubtitles)}
                                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-medium ${forceSubtitles ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/20'}`}
                                  title="Forza sottotitoli sincronizzati da dialoghi verificati"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  <span className="hidden sm:inline">[CC] Sottotitoli</span>
                                </button>
                                {activePromptTab2 === 'sora' && (
                                  <button
                                    onClick={() => handleOptimizeSora2(activePrompt2, setActivePrompt2, setIsOptimizingSora2_2)}
                                    disabled={isOptimizingSora2_2}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                    title="Ottimizza prompt video universale (massima resa in 15s)"
                                  >
                                    {isOptimizingSora2_2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Prompt ottimizzato</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDetectDangerousWords(activePrompt2, setIsDetectingDangerousWords_2)}
                                  disabled={isDetectingDangerousWords_2}
                                  className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                  title="Rileva parole a rischio"
                                >
                                  {isDetectingDangerousWords_2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                  <span className="hidden sm:inline">Rileva</span>
                                </button>
                                <button
                                  onClick={() => handleCopyPrompts2()}
                                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium"
                                >
                                  {isCopiedPrompts2 ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                  {isCopiedPrompts2 ? 'Copiato!' : 'Copia Parte 2'}
                                </button>
                            </div>
                            
                            {getDangerousWordsInText(activePrompt2, dangerousWords).length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2 items-center">
                                <span className="text-xs text-yellow-500/80 font-medium flex items-center gap-1">
                                  <Shield className="w-3 h-3" /> Parole a rischio evidenziate:
                                </span>
                                {getDangerousWordsInText(activePrompt2, dangerousWords).map((word, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleBypassWord(word, 'prompts2')}
                                    disabled={bypassingWord?.word === word && bypassingWord?.target === 'prompts2'}
                                    className="text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                                    title="Clicca per aggirare questa parola nel prompt"
                                  >
                                    {bypassingWord?.word === word && bypassingWord?.target === 'prompts2' ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Wand2 className="w-3 h-3" />
                                    )}
                                    {word}
                                  </button>
                                ))}
                              </div>
                            )}

                            <HighlightedTextarea
                              value={activePrompt2}
                              onChange={(e) => setActivePrompt2(e.target.value)}
                              dangerousWords={dangerousWords}
                              onCopy={handleCopyPrompts2}
                              isCopied={isCopiedPrompts2}
                              className="h-64"
                              ringColor="focus:ring-red-500/30"
                              textColor={flashPrompt2 ? 'text-emerald-400' : 'text-zinc-300'}
                            />
                            <PromptRefiner 
                              prompt={activePrompt2} 
                              onRefined={(newPrompt) => {
                                setActivePrompt2(newPrompt);
                                triggerFlash(setFlashPrompt2);
                              }} 
                              context={result?.analysis || result?.script || ''}
                              colorClass="red" 
                            />
                            
                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={() => handleAnalyzePrompt(activePrompt2, 'estimate', 'prompt2')}
                                disabled={isAnalyzingPrompt2}
                                className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                              >
                                {isAnalyzingPrompt2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                                Analisi Virale
                              </button>
                              <button
                                onClick={() => handleAnalyzePrompt(activePrompt2, 'anti-ai-slop', 'prompt2')}
                                disabled={isAnalyzingPrompt2}
                                className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                              >
                                {isAnalyzingPrompt2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                                Cura Anti-AI Slop
                              </button>
                            </div>
                            
                            {prompt2Analysis && (
                              <div className={`mt-4 p-4 rounded-xl border ${prompt2Analysis.type === 'anti-ai-slop' ? 'bg-red-500/5 border-red-500/20' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    {prompt2Analysis.type === 'anti-ai-slop' ? <ShieldAlert className="w-5 h-5 text-red-400" /> : <TrendingUp className="w-5 h-5 text-indigo-400" />}
                                    <h3 className={`font-bold ${prompt2Analysis.type === 'anti-ai-slop' ? 'text-red-100' : 'text-indigo-100'}`}>
                                      {prompt2Analysis.type === 'anti-ai-slop' ? 'Cura Anti-AI Slop' : 'Analisi Virale'}
                                    </h3>
                                  </div>
                                  <button onClick={() => setPrompt2Analysis(null)} className="text-zinc-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className={`prose prose-invert max-w-none text-sm ${prompt2Analysis.type === 'anti-ai-slop' ? 'prose-red' : 'prose-indigo'}`}>
                                  <div className="markdown-body">
                                    <Markdown>{prompt2Analysis.result}</Markdown>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Istruzioni Luma AI Single Part */}
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                            <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                              <BrainCircuit className="w-4 h-4" /> Istruzioni per Luma AI
                            </h3>
                            <p className="text-sm text-blue-100/80">
                              Copia e incolla questo messaggio nella chat di Luma AI prima di inserire il prompt:
                            </p>
                            <div className="mt-2 p-3 bg-black/30 rounded-lg text-sm text-zinc-300 font-mono relative group flex items-start justify-between gap-4">
                              <p className="flex-1">
                                Ho un prompt per fare un video di {getActivePromptLabel()} con {getActivePromptEngineLabel()} con audio sincronizzato, mi serve solo il video non fare immagini fai il video in una unica soluzione. I tempi algoritmici sono giÃ  stati ottimizzati nel prompt.
                              </p>
                              <CopyButton 
                                text={`Ho un prompt per fare un video di ${getActivePromptLabel()} con ${getActivePromptEngineLabel()} con audio sincronizzato, mi serve solo il video non fare immagini fai il video in una unica soluzione. I tempi algoritmici sono giÃ  stati ottimizzati nel prompt.`}
                                className="shrink-0"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-500/20 rounded-lg">
                                <BrainCircuit className="w-5 h-5 text-emerald-400" />
                              </div>
                              <div>
                                <h2 className="text-2xl font-bold">Prompt per AI Video</h2>
                                {!!result && (
                                  <p className="text-xs text-zinc-400 mt-1">
                                    Stato: <span className={promptReviewStatusForUi === "DA REVISIONARE" ? "text-amber-300 font-semibold" : "text-emerald-300 font-semibold"}>{promptReviewStatusForUi}</span>
                                    {" â€¢ "}
                                    Cast nel prompt: <span className={promptUsesCastLabelsForUi ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"}>{promptUsesCastLabelsForUi ? "visibile" : "non evidente"}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                  <button
                                    onClick={() => {
                                      setActivePromptFamily('sora2');
                                      setActivePromptVariant('12s');
                                    }}
                                    className={`px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptFamily === 'sora2' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <span>AI Remix</span>
                                      {recommendedPromptFamily === 'sora2' && <span className="px-2 py-0.5 bg-emerald-500 text-[9px] font-black text-white rounded-full uppercase tracking-widest">Best</span>}
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActivePromptFamily('sora');
                                      setActivePromptVariant('15s');
                                    }}
                                    className={`px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptFamily === 'sora' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Sora
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActivePromptFamily('sceneMaster');
                                      setActivePromptVariant('default');
                                    }}
                                    className={`px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptFamily === 'sceneMaster' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Scene Master
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActivePromptFamily('kling');
                                      setActivePromptVariant(activePromptVariant === '10s' ? '10s' : '15s');
                                    }}
                                    className={`px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptFamily === 'kling' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Kling
                                  </button>
                                <button
                                  onClick={() => {
                                    setActivePromptFamily('seedance');
                                    setActivePromptVariant('15s');
                                  }}
                                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptFamily === 'seedance' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span>Seedance</span>
                                    {recommendedPromptFamily === 'seedance' && <span className="px-2 py-0.5 bg-emerald-500 text-[9px] font-black text-white rounded-full uppercase tracking-widest">Consigliato</span>}
                                  </span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActivePromptFamily('veo3');
                                    setActivePromptVariant('8s');
                                  }}
                                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptFamily === 'veo3' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span>Veo 3</span>
                                    {recommendedPromptFamily === 'veo3' && <span className="px-2 py-0.5 bg-emerald-500 text-[9px] font-black text-white rounded-full uppercase tracking-widest">Consigliato</span>}
                                  </span>
                                </button>
                                <button
                                  onClick={() => {
                                    setActivePromptFamily('veo3Extension');
                                    if (activePromptFamily === 'veo3Extension' && activePromptVariant === 'part2') {
                                      setActivePromptVariant('part2');
                                    } else if (!editableVeo3ExtensionPart1 && editableVeo3ExtensionPart2) {
                                      setActivePromptVariant('part2');
                                    } else {
                                      setActivePromptVariant('part1');
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activePromptFamily === 'veo3Extension' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span>Veo 3 Extension</span>
                                    {recommendedPromptFamily === 'veo3Extension' && <span className="px-2 py-0.5 bg-emerald-500 text-[9px] font-black text-white rounded-full uppercase tracking-widest">Consigliato</span>}
                                  </span>
                                </button>
                              </div>

                              {activePromptFamily === 'sora2' && (
                                <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                  <button
                                    onClick={() => setActivePromptVariant('12s')}
                                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${activePromptVariant === '12s' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    12s
                                  </button>
                                </div>
                              )}
                              {activePromptFamily === 'kling' && (
                                <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                  <button
                                    onClick={() => setActivePromptVariant('10s')}
                                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${activePromptVariant === '10s' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    10s
                                  </button>
                                  <button
                                    onClick={() => setActivePromptVariant('15s')}
                                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${activePromptVariant === '15s' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    15s
                                  </button>
                                </div>
                              )}
                              {activePromptFamily === 'seedance' && (
                                <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                  <button
                                    onClick={() => setActivePromptVariant('15s')}
                                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${activePromptVariant === '15s' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    15s
                                  </button>
                                </div>
                              )}
                              {activePromptFamily === 'veo3' && (
                                <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                  <button
                                    onClick={() => setActivePromptVariant('8s')}
                                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${activePromptVariant === '8s' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    8s
                                  </button>
                                </div>
                              )}
                              {activePromptFamily === 'veo3Extension' && (
                                <div className="flex items-center gap-1 flex-wrap bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
                                  <button
                                    onClick={() => {
                                      setActivePromptFamily('veo3Extension');
                                      setActivePromptVariant('part1');
                                    }}
                                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${activePromptVariant === 'part1' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Parte 1
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActivePromptFamily('veo3Extension');
                                      setActivePromptVariant('part2');
                                    }}
                                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${activePromptVariant === 'part2' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                  >
                                    Parte 2
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        {/* VALIDAZIONE PROMPT Section */}
                        {result?.promptValidationReport && (
                          <div className="mb-6 p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl">
                            <div className="flex items-center gap-2 mb-3">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              <h3 className="text-xs font-black text-zinc-100 uppercase tracking-widest">VALIDAZIONE PROMPT</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                              <div>
                                <p className="text-zinc-500 uppercase font-bold mb-1">Stato</p>
                                <p className={`font-black ${
                                  result.promptValidationReport.status === 'PASSED' ? 'text-emerald-400' :
                                  result.promptValidationReport.status === 'RECOVERED' ? 'text-blue-400' :
                                  'text-amber-400'
                                }`}>{result.promptValidationReport.status}</p>
                              </div>
                              <div>
                                <p className="text-zinc-500 uppercase font-bold mb-1">Promosso / Recovery</p>
                                <p className="text-zinc-100">
                                  Promosso: <span className="font-bold">{result.promptValidationReport.promoted ? 'sì' : 'no'}</span>
                                  {" • "}
                                  Recovery: <span className="font-bold">{result.promptValidationReport.recoveryTriggered ? 'sì' : 'no'}</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-zinc-500 uppercase font-bold mb-1">Motivo Recovery</p>
                                <p className="text-zinc-100">{result.promptValidationReport.recoveryReason || 'Nessuno'}</p>
                              </div>
                              <div>
                                <p className="text-zinc-500 uppercase font-bold mb-1">Campi Bocciati</p>
                                <p className="text-zinc-100 font-bold">{result.promptValidationReport.failedFields?.length || 0}</p>
                              </div>
                            </div>

                            {result.promptValidationReport.failedFields?.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {result.promptValidationReport.failedFields.slice(0, 3).map((ff: any, idx: number) => (
                                  <div key={idx} className="p-2 bg-red-500/5 border border-red-500/10 rounded-lg text-[10px] leading-tight">
                                    <span className="text-red-400 font-bold">Campo:</span> {ff.field} | 
                                    <span className="text-red-400 font-bold ml-1"> Motivo:</span> {ff.reason}
                                    {ff.matchedTerm && <> | <span className="text-red-400 font-bold ml-1"> Termine:</span> {ff.matchedTerm}</>}
                                    {ff.preview && <div className="mt-1 text-zinc-500 italic truncate">Preview: {ff.preview}</div>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-3 text-[10px] text-zinc-500">Nessun campo bocciato</p>
                            )}
                            
                            <div className="mt-3 pt-3 border-t border-zinc-800/50 flex flex-wrap gap-x-6 gap-y-2 text-[10px]">
                              <p className="text-zinc-500">Campi controllati: <span className="text-zinc-300 font-bold">{result.promptValidationReport.checkedFields?.length || 0}</span></p>
                              <p className="text-zinc-500">Campi tecnici esclusi: <span className="text-zinc-300 font-bold">{result.promptValidationReport.excludedFields?.length || 0}</span></p>
                            </div>

                            <p className="mt-2 text-[10px] text-zinc-500 italic">
                              “Questa sezione mostra solo la validazione tecnica. La qualità narrativa del prompt viene valutata separatamente.”
                            </p>
                          </div>
                        )}

                        {/* INFILTRATOR BADGE Section - REAL CONTROLLER MISSION */}
                        {(() => {
                           const hasInfiltrator = !!result?.promptProcessInfiltrator;
                           const vReport = result?.promptValidationReport;
                           const qReport = result?.promptQualityReport;
                           const lockedTabs = result?.lockedPromptTabs;
                           const activePromptText = result?.bestOptimizedPrompt?.prompt || result?.aiPrompts || '';
                           const finalPass = (qReport as any)?.finalPass === true;
                           const locked = lockedTabs?.locked === true;
                           const isWeakVisual = String(result?.bestOptimizedPrompt?.reason || '').includes('WEAK_VISUAL');
                           const isReviewRequired = String(lockedTabs?.reason || '').includes('REVIEW_REQUIRED');
                           const frameObservationsCount = result?.vdbMetadata?.totalItems || 0;
                           const missingObservationFrames = result?.castGroundingAudit?.missingObservationFrames || 0;
                           const dataStatus = (result as any)?.dataStatus || 'NO_DATA';
                           
                           const isFallbackOrInvalid = !finalPass || !locked || activePromptText.trim().length === 0 || isWeakVisual || isReviewRequired || vReport?.status === 'RECOVERED' || frameObservationsCount === 0 || missingObservationFrames > 0;

                           if (hasInfiltrator || isFallbackOrInvalid) {
                             const v = result.promptProcessInfiltrator?.finalInfiltratorVerdict;
                             const trace = result.promptProcessInfiltrator?.promptLineageDeepTrace;
                             const diagnosis = result.promptProcessInfiltrator?.infiltratorDiagnosis || "";
                             
                             let vText = "INFILTRATO ATTIVATO — CONTROLLORE REALE";
                             let vColor = "text-emerald-400";
                             let vBg = "bg-emerald-500/10 border-emerald-500/20";
                             let missionStatus = "OK";
                             
                             const hasHighMismatch = trace?.mismatches?.some((m: any) => m.severity === 'HIGH');
                             const conclusion = trace?.finalInvestigationConclusion || "";
                           
                             if (isFallbackOrInvalid || v === "CHAIN_NOT_RELIABLE" || v === "VISIBLE_FALLBACK" || v === "AUDIO_ONLY" || v === "VISION_ONLY" || conclusion.includes("CATENA PROMPT NON AFFIDABILE") || hasHighMismatch) {
                               vText = "INFILTRATO ATTIVATO — CATENA PROMPT NON AFFIDABILE";
                               vColor = "text-red-500";
                               vBg = "bg-red-500/10 border-red-500/30";
                               missionStatus = "CRITICAL";
                             } else if (v === "PROMOTION_SUSPICIOUS" || v === "SUSPICIOUS" || v === "DATA_MISMATCH" || conclusion.includes("CONCLUSIONI SOSPETTE")) {
                               vText = "INFILTRATO ATTIVATO — CONCLUSIONI SOSPETTE";
                               vColor = "text-orange-400";
                               vBg = "bg-orange-500/10 border-orange-500/20";
                               missionStatus = "SUSPICIOUS";
                             }
                             
                             // Mission Details based on findings
                             let whatHappened = diagnosis || "Analisi della catena completata.";
                             let whyItHappened = "Dati di grounding verificati correttamente.";
                             let whatToDoNow = "Procedi con l'export del prompt o la produzione.";

                             if (isFallbackOrInvalid) {
                                whatHappened = "RECOVERY ATTIVATO / PROMPT NON VALIDATO";
                                const reasons = [];
                                if (!finalPass) reasons.push("finalPass false");
                                if (!locked) reasons.push("locked false");
                                if (activePromptText.trim().length === 0) reasons.push("prompt vuoto");
                                if (isWeakVisual) reasons.push("visione debole (WEAK_VISUAL)");
                                if (isReviewRequired) reasons.push("revisione richiesta (REVIEW_REQUIRED)");
                                if (frameObservationsCount === 0) reasons.push("nessun fotogramma analizzato");
                                if (missingObservationFrames > 0) reasons.push(`${missingObservationFrames} fotogrammi mancanti`);
                                
                                whyItHappened = reasons.join(", ") || "Dati reali insufficienti.";
                                whatToDoNow = "Controllare failedFields, esportare JSON, verificare provider vision o ripetere con visione più forte.";
                             } else if (missionStatus === "SUSPICIOUS" || missionStatus === "CRITICAL") {
                                whyItHappened = conclusion || diagnosis || "Mismatch tra prompt promosso e prompt realmente mostrato in UI.";
                                whatToDoNow = "Verificare la coerenza audio-video e consultare il lineage trace nel JSON.";
                             }

                             return (
                               <div className="mb-6 space-y-3">
                                 <div className={`px-4 py-3 rounded-2xl border shadow-xl ${vBg}`}>
                                   <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
                                      <Shield className={`w-5 h-5 ${vColor} animate-pulse`} />
                                      <div className="flex flex-col">
                                        <span className={`text-xs font-black uppercase tracking-widest ${vColor}`}>{vText}</span>
                                        <span className={`text-[9px] uppercase opacity-60 ${vColor}`}>Missione: Diagnosi Operativa & Controllo Catena</span>
                                      </div>
                                      <div className={`ml-auto px-2 py-0.5 rounded text-[8px] font-black uppercase ${vColor} border border-current opacity-50`}>
                                        {missionStatus}
                                      </div>
                                   </div>

                                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">1. Cosa è successo</span>
                                        <p className="text-[10px] text-zinc-300 font-medium leading-normal">{whatHappened}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">2. Perché è successo</span>
                                        <p className="text-[10px] text-zinc-300 font-medium leading-normal italic">{whyItHappened}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">3. Cosa fare ora</span>
                                        <p className={`text-[10px] font-bold leading-normal ${vColor}`}>{whatToDoNow}</p>
                                      </div>
                                   </div>
                                 </div>
                               </div>
                             );
                           }
                           return null;
                        })()}

                        {/* CONTROLLO QUALITÀ PROMPT Section */}
                        {result && (
                          <div className="mb-6 p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl">
                            {(() => {
const vReport = result.promptValidationReport;
const lockedTabs = result.lockedPromptTabs;
const activePromptText = result.bestOptimizedPrompt?.prompt || result.aiPrompts || '';
const dataStatus = (result as any)?.dataStatus || 'NO_DATA';
const isRecovered = vReport?.status === 'RECOVERED' || vReport?.recoveryTriggered || vReport?.recoveryReason === 'VALIDATOR_FAILED' || vReport?.failedFields?.length > 0;
const frameObservationsCount = (result as any).frameObservationsCount || result.vdbMetadata?.totalItems || (result as any).openRouterVisionMinimalAudit?.actualFrameCountSent || result.promptProcessInfiltrator?.truthSourceLedger?.visualFramesCount || (result as any).mergedFrameTimelineCount || result.castGroundingAudit?.frameObservationsCount || 0;
const missingObservationFrames = result.castGroundingAudit?.missingObservationFrames || 0;
const prompt = result.bestOptimizedPrompt?.prompt || '';
const transcript = result.verifiedTranscript || '';
const hasGraveDirtyLabels = ['person_', 'unknown', '[object object]', 'undefined'].some(t => prompt.toLowerCase().includes(t));
const hasTechTerms = ['glasses', 'man', 'woman'].some(t => prompt.toLowerCase().includes(t));
const hasTemplate = ['Apertura su', 'Sora 12s', 'Kling 15s', 'Seedance 15s'].some(t => prompt.includes(t));
const usesAudio = transcript && prompt.length > 20 && prompt.toLowerCase().includes(transcript.substring(0, 10).toLowerCase());
const subjects = [
{ name: 'Lingua', score: hasTechTerms ? 4 : 10, reason: hasTechTerms ? 'Contiene termini inglesi sporchi' : 'Linguaggio coerente' },
{ name: 'Coerenza scena', score: prompt.length > 150 ? 10 : (prompt.length > 100 ? 7 : 4), reason: prompt.length > 150 ? 'Descrizione visiva ricca' : 'Descrizione superficiale' },
{ name: 'Audio/Dialoghi', score: usesAudio ? 10 : (transcript ? 6 : 0), reason: usesAudio ? 'Dialoghi integrati correttamente' : (transcript ? 'Dialoghi rilevati ma non usati' : 'Nessun audio rilevato') },
{ name: 'Personaggi', score: hasGraveDirtyLabels ? 2 : 10, reason: hasGraveDirtyLabels ? 'Presenza di label tipo person_X o unknown' : 'Personaggi ben identificati' },
{ name: 'Nucleo video', score: prompt.length > 120 ? 9 : 5, reason: prompt.length > 120 ? 'Cattura essenza della scena' : 'Analisi del nucleo limitata' },
{ name: 'Pulizia tecnica', score: (hasGraveDirtyLabels || hasTemplate) ? 4 : 10, reason: (hasGraveDirtyLabels || hasTemplate) ? 'Presenza di residui tecnici o template' : 'Prompt pulito da boilerplate' },
{ name: 'Struttura Short', score: prompt.length > 180 ? 10 : 6, reason: prompt.length > 180 ? 'Ritmo e struttura ottimizzati' : 'Struttura narrativa lineare' },
{ name: 'Potenziale Viralità', score: (prompt.length > 150 && !hasTemplate) ? 9 : 5, reason: (prompt.length > 150 && !hasTemplate) ? 'Alto engagement potenziale' : 'Potenziale di viralità moderato' },
{ name: 'Originalità', score: (!hasTemplate && prompt.length > 160) ? 10 : 6, reason: (!hasTemplate && prompt.length > 160) ? 'Approccio creativo unico' : 'Seguendo schemi standard' }
];
const avgScore = subjects.reduce((acc, s) => acc + s.score, 0) / subjects.length;
let level = 'BOCCIATO';
let levelColor = 'text-red-400';
let bgLevel = 'bg-red-500/10 border-red-500/20';
const isPromoted = vReport?.promoted === true || (vReport?.status === 'PASSED' && !isRecovered);
if (isPromoted) {
  level = 'PROMOSSO';
  levelColor = 'text-emerald-400';
  bgLevel = 'bg-emerald-500/10 border-emerald-500/20';
} else if ((vReport?.status as any) === 'PARTIAL' || isRecovered) {
  level = 'PARZIALE';
  levelColor = 'text-yellow-400';
  bgLevel = 'bg-yellow-500/10 border-yellow-500/20';
}
const infiltrator = result.promptProcessInfiltrator;
return ( <>
<div className="flex flex-wrap items-center justify-between gap-4 mb-4">
<div className="flex items-center gap-2">
<Sparkles className="w-4 h-4 text-purple-400" />
<h3 className="text-xs font-black text-zinc-100 uppercase tracking-widest">PAGELLA CREATIVA</h3>
</div>
<div className="flex items-center flex-wrap gap-3">
<div className="flex items-baseline gap-1.5 px-3 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
<span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">PUNTEGGIO:</span>
<span className={"text-xs font-black " + (avgScore >= 8 ? "text-emerald-400" : avgScore >= 6 ? "text-yellow-400" : "text-red-400")}>
{avgScore.toFixed(1)} / 10
</span>
</div>
<div className={"px-3 py-1.5 rounded-full border flex items-center gap-2 " + bgLevel}>
<span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">STATO FINALE:</span>
<span className={"text-[10px] font-black uppercase tracking-widest " + levelColor}>{level}</span>
</div>
<button onClick={() => setIsPromptQualityExpanded(!isPromptQualityExpanded)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-[10px] font-bold uppercase transition-colors">
{isPromptQualityExpanded ? "Nascondi dettagli" : "Dettagli"}
</button>
</div>
</div>
<div className="mb-6 space-y-2 p-3 bg-zinc-800/20 border border-zinc-800 rounded-xl">
<p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Motivo Principale:</span> {vReport?.recoveryReason || infiltrator?.whatHappened || (isPromoted ? "Superato validatore e controlli qualità." : "Problemi rilevati durante verifica.")}</p>
<p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Audio Usato:</span> {usesAudio ? "Sì" : "No"}</p>
<p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Frame Usati:</span> {frameObservationsCount > 0 ? "Sì (" + frameObservationsCount + ")" : "No"} {missingObservationFrames > 0 && "(mancanti: " + missingObservationFrames + ")"}</p>
<p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Provider Vision:</span> {result.vdbMetadata?.provider || infiltrator?.truthSourceLedger?.visionProvider || "Unknown"}</p>
<p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Rischio Infiltrato:</span> <span className={infiltrator?.isAnomaly ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{infiltrator?.finalInfiltratorVerdict || "NON ESEGUITO"}</span></p>
</div>
{isPromptQualityExpanded && (
<div className="space-y-4 mb-6">
<p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">DETTAGLI PAGELLE</p>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
{subjects.map((s, idx) => (
<div key={idx} className="p-3 bg-zinc-800/30 border border-zinc-800/50 rounded-xl flex flex-col gap-1">
<div className="flex justify-between items-center">
<span className="text-[10px] font-bold text-zinc-400 uppercase">{s.name}</span>
<span className={"text-xs font-black " + (s.score >= 9 ? "text-emerald-400" : s.score >= 7 ? "text-orange-400" : s.score >= 6 ? "text-yellow-400" : "text-red-400")}>{s.score}/10</span>
</div>
<p className="text-[10px] text-zinc-200 leading-tight">{s.reason}</p>
<div className="w-full h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
<div className={"h-full rounded-full " + (s.score >= 9 ? "bg-emerald-500" : s.score >= 7 ? "bg-orange-500" : s.score >= 6 ? "bg-yellow-500" : "bg-red-500")} style={{ width: s.score * 10 + "%" }} />
</div>
</div>
))}</div></div>
)}
</>
);
})()}

                            <p className="mt-3 text-[10px] text-zinc-500 italic border-t border-zinc-800/30 pt-2">
                              “Questa sezione valuta la qualità leggibile del prompt. Non sostituisce il JSON tecnico, che resta completo nell’export.”
                            </p>
                          </div>
                        )}
                          <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
                              <button
                                onClick={undoActivePrompt}
                                disabled={!canUndoActivePrompt}
                                className="p-2 text-zinc-400 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
                                title="Annulla"
                              >
                                <Undo className="w-4 h-4" />
                              </button>
                              <button
                                onClick={redoActivePrompt}
                                disabled={!canRedoActivePrompt}
                                className="p-2 text-zinc-400 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
                                title="Ripeti"
                              >
                                <Redo className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRewritePrompt(activePrompt, setActivePrompt, setIsRewriting, rewriteLevel, setRewriteLevel, setFlashPrompt)}
                                disabled={isRewriting}
                                className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                title={`Correggi parole a rischio con l'IA (Livello ${rewriteLevel})`}
                              >
                                {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                <span className="hidden sm:inline">Bypass L{rewriteLevel}</span>
                              </button>
                              <button
                                onClick={() => handleAntiEmojiPurify(activePrompt, setActivePrompt, setIsPurifyingAntiEmoji, setFlashPrompt)}
                                disabled={isPurifyingAntiEmoji}
                                className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                title="Purifica 35mm (Rimuovi Emoji e aggiungi stile Cinematico)"
                              >
                                {isPurifyingAntiEmoji ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                                <span className="hidden sm:inline">Anti-Emoji</span>
                              </button>
                              <button
                                onClick={() => handleToggleForceTextHook(activePrompt, setActivePrompt, setIsForcingText, setFlashPrompt)}
                                disabled={isForcingText}
                                className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-medium disabled:opacity-50 ${forceTextHook ? 'bg-blue-500/20 text-blue-300 border-blue-400/40' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20'}`}
                                title="Forza Testo (Aggiunge istruzioni per forzare il rendering del testo)"
                              >
                                {isForcingText ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlignLeft className="w-4 h-4" />}
                                <span className="hidden sm:inline">[T+] Force Text</span>
                              </button>
                              <button
                                onClick={() => setForceSubtitles(!forceSubtitles)}
                                className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-medium ${forceSubtitles ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/20'}`}
                                title="Forza sottotitoli sincronizzati da dialoghi verificati"
                              >
                                <MessageSquare className="w-4 h-4" />
                                <span className="hidden sm:inline">[CC] Sottotitoli</span>
                              </button>
                              <button
                                onClick={() => handleOptimizeSora2(activePrompt, setActivePrompt, setIsOptimizingSora2)}
                                disabled={isOptimizingSora2}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                title={`Ottimizza il prompt selezionato per ${getActivePromptEngineLabel()}`}
                              >
                                {isOptimizingSora2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                <span className="hidden sm:inline">{getActivePromptEngineLabel()}</span>
                              </button>
                              <button
                                onClick={() => handleDetectDangerousWords(activePrompt, setIsDetectingDangerousWords)}
                                disabled={isDetectingDangerousWords}
                                className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                title="Rileva parole a rischio"
                              >
                                {isDetectingDangerousWords ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                <span className="hidden sm:inline">Rileva</span>
                              </button>
                              <button
                                onClick={handleCopyPrompts}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition-colors text-sm font-medium"
                              >
                                {isCopiedPrompts ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {isCopiedPrompts ? 'Copiati!' : 'Copia Prompt'}
                              </button>
                          </div>
                          
                          {getDangerousWordsInText(activePrompt, dangerousWords).length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2 items-center">
                              <span className="text-xs text-yellow-500/80 font-medium flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Parole a rischio evidenziate:
                              </span>
                              {getDangerousWordsInText(activePrompt, dangerousWords).map((word, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleBypassWord(word, 'prompts')}
                                  disabled={bypassingWord?.word === word && bypassingWord?.target === 'prompts'}
                                  className="text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                                  title="Clicca per aggirare questa parola nel prompt"
                                >
                                  {bypassingWord?.word === word && bypassingWord?.target === 'prompts' ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Wand2 className="w-3 h-3" />
                                  )}
                                  {word}
                                </button>
                              ))}
                            </div>
                          )}

                          {!!result && (
                            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                              <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                                <p className="font-bold text-zinc-400 uppercase tracking-wider mb-1">Cast e confidenza</p>
                                <p className="text-zinc-100">{castLabelsForUi.length > 0 ? castLabelsForUi.join(", ") : "Nessun soggetto leggibile"}</p>
                                <p className="mt-1 text-zinc-400">Soggetti: <span className="text-white font-semibold">{castLabelsForUi.length || castGroundingAuditForUi?.visualCastCount || 0}</span></p>
                                <p className="text-zinc-400">Confidenza: <span className="text-white font-semibold">{castConfidenceLabelForUi}</span></p>
                              </div>
                              <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                                <p className="font-bold text-zinc-400 uppercase tracking-wider mb-1">Stato prompt</p>
                                <p className={`${promptReviewStatusForUi === "DA REVISIONARE" ? "text-amber-300" : "text-emerald-300"} font-semibold`}>{promptReviewStatusForUi}</p>
                                <p className="mt-1 text-zinc-400">Uso cast nel prompt: <span className={`font-semibold ${promptUsesCastLabelsForUi ? "text-emerald-300" : "text-amber-300"}`}>{promptUsesCastLabelsForUi ? "si, labels presenti" : "non ancora visibile"}</span></p>
                                <p className="text-zinc-400">Modalita cast: <span className="text-white font-semibold">{castModeForUi}</span></p>
                              </div>
                              <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                                <p className="font-bold text-zinc-400 uppercase tracking-wider mb-1">Timeline e dialoghi</p>
                                <p className="text-zinc-400">Segmenti audio: <span className="text-white font-semibold">{audioSegmentsForUi.length}</span></p>
                                <p className="text-zinc-400">Frame reali: <span className="text-white font-semibold">{frameTimestampsForUi.length}</span></p>
                                <p className="text-zinc-400">Cast visivo stimato: <span className="text-white font-semibold">{castGroundingAuditForUi?.visualCastCount ?? result?.visualCastCount ?? 0}</span></p>
                              </div>
                              <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                                <p className="font-bold text-zinc-400 uppercase tracking-wider mb-1">Confronto col run prima</p>
                                {previousRunSummary ? (
                                  <>
                                    <p className="text-zinc-400">Cast: <span className={`${(previousVsCurrentCastDelta || 0) >= 0 ? "text-emerald-300" : "text-red-300"} font-semibold`}>{previousVsCurrentCastDelta === 0 ? "stabile" : `${previousVsCurrentCastDelta > 0 ? "+" : ""}${previousVsCurrentCastDelta} soggetti`}</span></p>
                                    <p className="text-zinc-400">Usabilita prompt: <span className={`${(previousVsCurrentPromptDelta || 0) >= 0 ? "text-emerald-300" : "text-red-300"} font-semibold`}>{previousVsCurrentPromptDelta === null ? "N/D" : `${previousVsCurrentPromptDelta > 0 ? "+" : ""}${previousVsCurrentPromptDelta}%`}</span></p>
                                    <p className="text-zinc-400">Prima: <span className="text-white font-semibold">{previousRunSummary.castLabels?.join(", ") || "N/D"}</span></p>
                                  </>
                                ) : (
                                  <p className="text-zinc-500">Disponibile dal secondo run della sessione.</p>
                                )}
                              </div>
                            </div>
                          )}

                          {isPromptBlockedForMissingGrounding && isBlockedPromptPlaceholder(activePrompt) && (
                            <div className="mb-4 p-5 bg-zinc-900/60 border border-amber-500/30 rounded-2xl">
                              <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                <h3 className="text-sm font-black text-amber-300 uppercase tracking-widest">Prompt bloccati</h3>
                              </div>
                              {(() => {
                                logger.info("[BLOCKED_PROMPT_UI_MESSAGE_RENDERED]", {
                                  activePromptFamily,
                                  activePromptVariant,
                                  operationalDecision: result?.operationalDecision || "N/A",
                                  blockedPromptReason
                                });
                                return null;
                              })()}
                              <p className="text-sm text-zinc-200 leading-relaxed">{blockedPromptMessage}</p>
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-300">
                                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                                  <p><span className="font-bold text-zinc-400">Motivo:</span> {blockedPromptReason}</p>
                                  <p><span className="font-bold text-zinc-400">Frame reali:</span> {frameTimestampsForUi.length}</p>
                                  <p><span className="font-bold text-zinc-400">Osservazioni frame:</span> {Array.isArray(result?.frameObservations) ? result.frameObservations.length : 0}</p>
                                </div>
                                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                                  <p><span className="font-bold text-zinc-400">Cast tecnico:</span> {canonicalCastList.length > 0 ? canonicalCastList.map(p => humanizeVisionText(p)).join(", ") : "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Audio segmenti:</span> {audioSegmentsForUi.length}</p>
                                  <p><span className="font-bold text-zinc-400">Esame di Coscienza:</span> disponibile sotto</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {(() => {
                            logger.info("[PROMPT_ACTIVE_UI_RENDERED]", {
                              activePromptFamily,
                              activePromptVariant,
                              promptReviewStatusForUi,
                              promptUsesCastLabelsForUi,
                              activePromptLength: String(activePrompt || "").length,
                              canonicalCastList: castLabelsForUi
                            });
                            return null;
                          })()}

                          <HighlightedTextarea
                            value={isBlockedPromptPlaceholder(activePrompt) ? "" : activePrompt}
                            onChange={(e) => setActivePrompt(e.target.value)}
                            dangerousWords={dangerousWords}
                            onCopy={handleCopyPrompts}
                            isCopied={isCopiedPrompts}
                            className="h-96"
                            ringColor="focus:ring-emerald-500/30"
                            textColor={flashPrompt ? 'text-emerald-400' : 'text-zinc-300'}
                            placeholder={isPromptBlockedForMissingGrounding ? blockedPromptMessage : "Nessun prompt generato"}
                          />
                          <PromptRefiner 
                            prompt={activePrompt} 
                            onRefined={(newPrompt) => {
                              setActivePrompt(newPrompt);
                              triggerFlash(setFlashPrompt);
                            }} 
                            context={result?.analysis || result?.script || ''}
                            colorClass="emerald" 
                          />
                          
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleAnalyzePrompt(activePrompt, 'estimate', 'prompt')}
                              disabled={isAnalyzingPrompt}
                              className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                            >
                              {isAnalyzingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                              Analisi Virale
                            </button>
                            <button
                              onClick={() => handleAnalyzePrompt(activePrompt, 'anti-ai-slop', 'prompt')}
                              disabled={isAnalyzingPrompt}
                              className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                            >
                              {isAnalyzingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                              Cura Anti-AI Slop
                            </button>
                          </div>
                          
                          {promptAnalysis && (
                            <div className={`mt-4 p-4 rounded-xl border ${promptAnalysis.type === 'anti-ai-slop' ? 'bg-red-500/5 border-red-500/20' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  {promptAnalysis.type === 'anti-ai-slop' ? <ShieldAlert className="w-5 h-5 text-red-400" /> : <TrendingUp className="w-5 h-5 text-indigo-400" />}
                                  <h3 className={`font-bold ${promptAnalysis.type === 'anti-ai-slop' ? 'text-red-100' : 'text-indigo-100'}`}>
                                    {promptAnalysis.type === 'anti-ai-slop' ? 'Cura Anti-AI Slop' : 'Analisi Virale'}
                                  </h3>
                                </div>
                                <button onClick={() => setPromptAnalysis(null)} className="text-zinc-500 hover:text-white">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className={`prose prose-invert max-w-none text-sm ${promptAnalysis.type === 'anti-ai-slop' ? 'prose-red' : 'prose-indigo'}`}>
                                <div className="markdown-body">
                                  <Markdown components={{
                                    a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline hover:text-indigo-300" />
                                  }}>{promptAnalysis.result}</Markdown>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <p className="text-xs text-zinc-500 mt-3">
                        Copia questi prompt e incollali direttamente in generatori come Runway Gen-3, Luma o Sora.
                      </p>
                    </div>
                  )}

                  {/* Prompt Notes Section */}
                  {result.promptNotes && (
                    <div className="mt-8 pt-8 border-t border-zinc-800/50">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                          <Lightbulb className="w-5 h-5 text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-amber-100">Note Tecniche e Spiegazioni</h2>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 relative group">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton text={result.promptNotes} />
                        </div>
                        <div className="prose prose-invert max-w-none prose-amber">
                          <div className="markdown-body">
                            <Markdown>{result.promptNotes}</Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Publishing Kit Section */}

                  {result?.publishingKit && (
                    <div className="mt-8 pt-8 border-t border-zinc-800/50">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-pink-500/20 rounded-lg">
                            <Rocket className="w-5 h-5 text-pink-400" />
                          </div>
                          <h2 className="text-2xl font-bold">Pacchetto di Pubblicazione</h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex bg-zinc-800 p-1 rounded-lg border border-zinc-700">
                            <button
                              onClick={() => setKitLanguage('it')}
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                kitLanguage === 'it' 
                                  ? "bg-pink-500 text-white shadow-lg" 
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              IT
                            </button>
                            <button
                              onClick={() => setKitLanguage('en')}
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                kitLanguage === 'en' 
                                  ? "bg-pink-500 text-white shadow-lg" 
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              EN
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              copyToClipboard(result.publishingKit || '');
                              setIsCopiedKit(true);
                              setTimeout(() => setIsCopiedKit(false), 2000);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors text-sm font-medium"
                          >
                            {isCopiedKit ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            {isCopiedKit ? 'Copiato!' : 'Copia Tutto'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column: Titles & Hooks */}
                        <div className="space-y-6">
                          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                              <Target className="w-4 h-4 text-pink-400" /> Titoli & Hooks
                            </h3>
                            <CopyableField 
                              label={kitLanguage === 'it' ? "Titolo" : "Title"} 
                              value={kitLanguage === 'it' ? result.parsedKit?.titleIt : result.parsedKit?.titleEn} 
                              onCopy={() => handleCopyField('title', kitLanguage === 'it' ? result.parsedKit?.titleIt : result.parsedKit?.titleEn)}
                              isCopied={copiedField === 'title'}
                            />
                            <CopyableField 
                              label={kitLanguage === 'it' ? "Video Hook (Overlay)" : "Video Hook (Overlay)"} 
                              value={kitLanguage === 'it' ? result.parsedKit?.videoHookIt : result.parsedKit?.videoHookEn} 
                              onCopy={() => handleCopyField('videoHook', kitLanguage === 'it' ? result.parsedKit?.videoHookIt : result.parsedKit?.videoHookEn)}
                              isCopied={copiedField === 'videoHook'}
                            />
                            <div className="mb-4">
                              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">{kitLanguage === 'it' ? "Ganci (Hooks)" : "Hooks"}</span>
                              <div className="space-y-2">
                                {(kitLanguage === 'it' ? result.parsedKit?.hooksIt : result.parsedKit?.hooksEn)?.map((hook, i) => (
                                  <div key={i} className="group relative p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300">
                                    {hook}
                                    <button
                                      onClick={() => handleCopyField(`hook-${i}`, hook)}
                                      className="absolute top-2 right-2 p-1 text-zinc-500 opacity-0 group-hover:opacity-100 transition-all hover:text-white"
                                    >
                                      {copiedField === `hook-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                              <AlignLeft className="w-4 h-4 text-emerald-400" /> {kitLanguage === 'it' ? "Meta Dati" : "Metadata"}
                            </h3>
                            <CopyableField 
                              label={kitLanguage === 'it' ? "Descrizione" : "Description"} 
                              value={kitLanguage === 'it' ? result.parsedKit?.descriptionIt : result.parsedKit?.descriptionEn} 
                              onCopy={() => handleCopyField('description', kitLanguage === 'it' ? result.parsedKit?.descriptionIt : result.parsedKit?.descriptionEn)}
                              isCopied={copiedField === 'description'}
                            />
                            <CopyableField 
                              label="Hashtag" 
                              value={kitLanguage === 'it' ? result.parsedKit?.hashtagsIt : result.parsedKit?.hashtagsEn} 
                              onCopy={() => handleCopyField('hashtags', kitLanguage === 'it' ? result.parsedKit?.hashtagsIt : result.parsedKit?.hashtagsEn)}
                              isCopied={copiedField === 'hashtags'}
                            />
                            <CopyableField 
                              label="Tag" 
                              value={kitLanguage === 'it' ? result.parsedKit?.tagsIt : result.parsedKit?.tagsEn} 
                              onCopy={() => handleCopyField('tags', kitLanguage === 'it' ? result.parsedKit?.tagsIt : result.parsedKit?.tagsEn)}
                              isCopied={copiedField === 'tags'}
                            />
                            <CopyableField 
                              label="Commento Pinnato" 
                              value={kitLanguage === 'it' ? result.parsedKit?.pinnedCommentIt : result.parsedKit?.pinnedCommentEn} 
                              onCopy={() => handleCopyField('pinnedComment', kitLanguage === 'it' ? result.parsedKit?.pinnedCommentIt : result.parsedKit?.pinnedCommentEn)}
                              isCopied={copiedField === 'pinnedComment'}
                            />
                            <div className="grid grid-cols-2 gap-4">
                              <CopyableField 
                                label={kitLanguage === 'it' ? "Nome File" : "File Name"} 
                                value={result.parsedKit?.fileName} 
                                onCopy={() => handleCopyField('fileName', result.parsedKit?.fileName)}
                                isCopied={copiedField === 'fileName'}
                              />
                              <CopyableField 
                                label={kitLanguage === 'it' ? "Orario Consigliato" : "Recommended Time"} 
                                value={result.parsedKit?.recommendedTime} 
                                onCopy={() => handleCopyField('recommendedTime', result.parsedKit?.recommendedTime)}
                                isCopied={copiedField === 'recommendedTime'}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Audio & Cover */}
                        <div className="space-y-6">
                          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                              <Activity className="w-4 h-4 text-blue-400" /> {kitLanguage === 'it' ? "Audio & Musica" : "Audio & Music"}
                            </h3>
                            <CopyableField 
                              label={kitLanguage === 'it' ? "Umore Audio" : "Audio Mood"} 
                              value={kitLanguage === 'it' ? result.parsedKit?.audioMoodIt : result.parsedKit?.audioMoodEn} 
                              onCopy={() => handleCopyField('audioMood', kitLanguage === 'it' ? result.parsedKit?.audioMoodIt : result.parsedKit?.audioMoodEn)}
                              isCopied={copiedField === 'audioMood'}
                            />
                            <div className="mb-4">
                              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">{kitLanguage === 'it' ? "Analisi Musicale" : "Musical Analysis"}</span>
                              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 whitespace-pre-wrap">
                                {kitLanguage === 'it' ? result.parsedKit?.musicalAnalysisIt : result.parsedKit?.musicalAnalysisEn}
                              </div>
                            </div>
                          </div>

                          {/* Cover Generator */}
                          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                              <Image className="w-4 h-4 text-purple-400" /> Generatore Copertina
                            </h3>

                            <div className="mb-4">
                              <CopyableField 
                                label="Prompt Copertina (AI)" 
                                value={result.parsedKit?.coverPrompt} 
                                onCopy={() => handleCopyField('coverPrompt', result.parsedKit?.coverPrompt)}
                                isCopied={copiedField === 'coverPrompt'}
                              />
                            </div>
                            
                            <div className="flex gap-2 mb-4">
                              <button
                                onClick={() => setCoverAspectRatio("9:16")}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                                  coverAspectRatio === "9:16" 
                                    ? "bg-purple-500/20 border-purple-500 text-purple-300" 
                                    : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                                }`}
                              >
                                9:16
                              </button>
                              <button
                                onClick={() => setCoverAspectRatio("16:9")}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                                  coverAspectRatio === "16:9" 
                                    ? "bg-purple-500/20 border-purple-500 text-purple-300" 
                                    : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                                }`}
                              >
                                16:9
                              </button>
                            </div>

                            <div className="mb-4">
                              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Testo Hook (Opzionale)</span>
                              <input
                                type="text"
                                value={coverHookText}
                                onChange={(e) => setCoverHookText(e.target.value)}
                                placeholder="Es. LA VERITÃ€ NASCOSTA..."
                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                              />
                            </div>

                            <div className="mb-4">
                              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Foto Campione (Opzionale)</span>
                              <input
                                type="file"
                                accept="image/*"
                                ref={coverFileInputRef}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setCoverReferenceImage(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              {coverReferenceImage ? (
                                <div className="relative rounded-lg overflow-hidden border border-zinc-800 group">
                                  <img src={coverReferenceImage} alt="Reference" className="w-full h-32 object-cover" />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                      onClick={() => {
                                        setCoverReferenceImage(null);
                                        if (coverFileInputRef.current) coverFileInputRef.current.value = '';
                                      }}
                                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/40 transition-colors"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => coverFileInputRef.current?.click()}
                                  className="w-full p-4 border-2 border-dashed border-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors flex flex-col items-center justify-center gap-2"
                                >
                                  <Image className="w-6 h-6" />
                                  <span className="text-sm">Allega foto di riferimento</span>
                                </button>
                              )}
                            </div>

                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Prompt Copertina (Modificabile)</span>
                                <button
                                  onClick={() => handleCopyField('coverPrompt', result.parsedKit?.coverPrompt)}
                                  className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                                  title="Copia Prompt Copertina"
                                >
                                  {copiedField === 'coverPrompt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <textarea
                                value={result.parsedKit?.coverPrompt || ""}
                                onChange={(e) => {
                                  commitNormalizedResult({
                                    ...result,
                                    parsedKit: {
                                      ...(result.parsedKit || {}),
                                      coverPrompt: e.target.value
                                    }
                                  });
                                }}
                                className="w-full p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 italic mb-4 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                placeholder="Nessun prompt generato"
                              />
                              
                              {coverError && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex flex-col gap-3">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{coverError}</span>
                                  </div>
                                  {(coverError.includes('403') || coverError.includes('permessi') || coverError.includes('chiave API')) && (
                                    <button
                                      onClick={handleOpenKeyDialog}
                                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all text-xs font-bold uppercase tracking-wider"
                                    >
                                      <Settings2 className="w-3.5 h-3.5" />
                                      Seleziona Chiave API (Pagamento)
                                    </button>
                                  )}
                                </div>
                              )}

                              <button
                                onClick={handleGenerateCover}
                                disabled={isGeneratingCover || !result.parsedKit?.coverPrompt}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                              >
                                {isGeneratingCover ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generazione...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4" />
                                    {hasPaidKey ? "Genera Copertina Pro" : "Genera Copertina Free"}
                                  </>
                                )}
                              </button>
                            </div>

                            {coverImage && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mt-4 relative"
                              >
                                <div className="relative group">
                                  <img 
                                    src={coverImage} 
                                    alt="Generated Cover" 
                                    className={`w-full rounded-xl border border-zinc-700 shadow-2xl ${coverAspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-[16/9]'} object-cover`}
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 rounded-xl">
                                    <button
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = coverImage;
                                        link.download = `cover-${coverAspectRatio.replace(':', '-')}.png`;
                                        link.click();
                                      }}
                                      className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                                      title="Scarica"
                                    >
                                      <Download className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                                
                                <div className="mt-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                    <Wand2 className="w-3 h-3" /> Correttore Copertina (Goal)
                                  </span>
                                  <textarea
                                    value={coverGoal}
                                    onChange={(e) => setCoverGoal(e.target.value)}
                                    placeholder="Es: Voglio che Kimi stappi una bottiglia di champagne sul podio..."
                                    className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-300 mb-3 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                  />
                                  <button
                                    onClick={handleRefineCover}
                                    disabled={isRefiningCover || !coverGoal.trim()}
                                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                  >
                                    {isRefiningCover ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Modifica in corso...
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCcw className="w-4 h-4" />
                                        Modifica e Rigenera
                                      </>
                                    )}
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </div>

                          {/* Neuro Analysis */}
                          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                              <BrainCircuit className="w-4 h-4 text-amber-400" /> {kitLanguage === 'it' ? "Neuro Analisi" : "Neuro Analysis"}
                            </h3>
                            <div className="flex items-center justify-between mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <span className="text-sm font-bold text-amber-200 uppercase tracking-wider">Neuro Score</span>
                              <span className="text-xl font-black text-amber-400">
                                {typeof result.parsedKit?.neuroScore === 'object' 
                                  ? result.parsedKit.neuroScore.score 
                                  : (result.parsedKit?.neuroScore || 'N/A')}
                              </span>
                            </div>

                            {typeof result.parsedKit?.neuroScore === 'object' && (
                              <div className="grid grid-cols-3 gap-2 mb-6">
                                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-center">
                                  <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Hook Rate</div>
                                  <div className="text-sm font-black text-pink-400">{String(result.parsedKit.neuroScore.hookRate).includes('UNVERIFIED') ? 'UNVERIFIED' : `${result.parsedKit.neuroScore.hookRate}%`}</div>
                                </div>
                                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-center">
                                  <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Retention</div>
                                  <div className="text-sm font-black text-blue-400">{String(result.parsedKit.neuroScore.retention).includes('UNVERIFIED') ? 'UNVERIFIED' : `${result.parsedKit.neuroScore.retention}%`}</div>
                                </div>
                                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-center">
                                  <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Viral Pot.</div>
                                  <div className="text-sm font-black text-amber-400">{String(result.parsedKit.neuroScore.viralPotential).includes('UNVERIFIED') ? 'UNVERIFIED' : `${result.parsedKit.neuroScore.viralPotential}%`}</div>
                                </div>
                              </div>
                            )}
                            
                            <div className="mb-4">
                              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">{kitLanguage === 'it' ? "Spiegazione Psicologica" : "Psychological Explanation"}</span>
                              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 italic">
                                {result.psychologicalAnalysis || (kitLanguage === 'it' ? result.parsedKit?.neuroExplanationIt : result.parsedKit?.neuroExplanationEn)}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Dopamine Hits</span>
                              {result.parsedKit?.dopamineHits?.map((hit, i) => (
                                <div key={i} className="flex gap-3 text-sm">
                                  <span className="text-amber-400 font-mono font-bold shrink-0">[{hit.time}]</span>
                                  <span className="text-zinc-300">{kitLanguage === 'it' ? hit.descIt : hit.descEn}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Conscience Exam */}
                          {(result.conscienceExamIt || result.conscienceExamEn) && (
                            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" /> {kitLanguage === 'it' ? "Esame di Coscienza" : "Conscience Exam"}
                              </h3>
                              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 italic">
                                {kitLanguage === 'it' ? result.conscienceExamIt : result.conscienceExamEn}
                              </div>
                            </div>
                          )}

                          {/* Audio Analysis */}
                          {(result.audioAnalysisIt || result.audioAnalysisEn) && (
                            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Mic className="w-4 h-4 text-blue-400" /> {kitLanguage === 'it' ? "Analisi Audio" : "Audio Analysis"}
                              </h3>
                              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 italic">
                                {kitLanguage === 'it' ? result.audioAnalysisIt : result.audioAnalysisEn}
                              </div>
                            </div>
                          )}

                          {/* Research Considerations */}
                          {(result.researchConsiderationsIt || result.researchConsiderationsEn) && (
                            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Search className="w-4 h-4 text-purple-400" /> {kitLanguage === 'it' ? "Considerazioni di Ricerca" : "Research Considerations"}
                              </h3>
                              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 italic">
                                {kitLanguage === 'it' ? result.researchConsiderationsIt : result.researchConsiderationsEn}
                              </div>
                            </div>
                          )}

                          {/* Trend Hunter Report */}
                          {result.trendHunterReport && (
                            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-pink-400" /> {kitLanguage === 'it' ? "Report Trend Hunter" : "Trend Hunter Report"}
                              </h3>
                              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 italic">
                                {result.trendHunterReport}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Raw View Toggle */}
                      <div className="mt-8">
                        <button
                          onClick={() => {
                            const el = document.getElementById('raw-kit');
                            if (el) el.classList.toggle('hidden');
                          }}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> Visualizza pacchetto completo (Markdown)
                        </button>
                        <div id="raw-kit" className="hidden mt-4 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl">
                          <div className="prose prose-invert max-w-none text-zinc-300 text-sm">
                            <Markdown
                              components={{
                                p: ({ children }) => <div className="mb-4 last:mb-0">{children}</div>
                              }}
                            >
                              {result.publishingKit}
                            </Markdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feedback Section */}
                  {result && (
                    <div className="mt-8 pt-8 border-t border-zinc-800/50">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <MessageSquare className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold">Iterazione e Feedback</h2>
                      </div>
                      
                      {feedbackHistory.length > 0 && (
                        <div className="mb-6 space-y-3">
                          {feedbackHistory.map((fb, i) => (
                            <div key={i} className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm text-zinc-300">
                              <span className="font-bold text-blue-400 mr-2">Feedback {i + 1}:</span> {fb}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        <div className="relative">
                          <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Es: Rendi l'hook piÃ¹ misterioso, la musica Ã¨ piatta, aggiungi un colpo di scena diverso..."
                            className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl p-4 pr-10 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-600"
                          />
                          {feedback && (
                            <button
                              onClick={() => setFeedback('')}
                              className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => handleGenerate(true)}
                          disabled={isLoading || !feedback.trim()}
                          className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading && feedback ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                          Rigenera con Feedback
                        </button>
                      </div>
                    </div>
                  )}
                  </motion.div>
                </ResultRenderBoundary>
              )}
            </AnimatePresence>
          </div>
        </div>
        )}
        </div>
      </div>
      <ChatAssistant />

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowValidator(!showValidator)}
        className="fixed bottom-6 left-6 z-[100] p-4 bg-purple-600/20 hover:bg-purple-600/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl transition-all group"
        title="Validazione Layer di Protezione"
      >
        <Beaker className={`w-6 h-6 ${showValidator ? 'text-purple-300' : 'text-purple-400 group-hover:animate-bounce'}`} />
      </motion.button>

      <AnimatePresence>
        {showValidator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 100 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm overflow-y-auto"
          >
            <div className="min-h-screen py-20 px-6">
              <button 
                onClick={() => setShowValidator(false)}
                className="fixed top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all z-[120]"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              <LockValidationTests />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Reset Flusso"
        message="Sei sicuro di voler cancellare tutto e ricominciare? Questa azione non puÃ² essere annullata."
        onConfirm={confirmReset}
        onCancel={() => setIsResetModalOpen(false)}
      />
      <ConfirmModal
        isOpen={isCacheModalOpen}
        title="Svuota Cache"
        message="Sei sicuro di voler svuotare la cache? Questo cancellerÃ  tutti i risultati e i video salvati. L'app verrÃ  ricaricata."
        onConfirm={confirmClearCache}
        onCancel={() => setIsCacheModalOpen(false)}
      />
      </div>
    </DecisionEngineShell>
  );
}

