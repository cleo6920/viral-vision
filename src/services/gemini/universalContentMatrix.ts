
export type ContentNature = 
  | 'STATIC_ASSET'
  | 'REAL_VIDEO'
  | 'ANIMATED_VIDEO'
  | 'MOVIE_CLIP'
  | 'TV_CLIP'
  | 'MUSIC_PERFORMANCE'
  | 'SPORTS_ACTION'
  | 'TALK_DIALOGUE'
  | 'COMEDY_SKETCH'
  | 'VLOG_INTERVIEW'
  | 'REAL_EVENT'
  | 'PRODUCT_DEMO'
  | 'INFORMATIONAL'
  | 'UNKNOWN';

export type PrimaryEngine = 
  | 'ACTION_DRIVEN'
  | 'VERBAL_DRIVEN'
  | 'MUSIC_RHYTHM_DRIVEN'
  | 'REACTION_DRIVEN'
  | 'DATA_DRIVEN'
  | 'PRODUCT_DRIVEN'
  | 'EVENT_PARTICIPATION_DRIVEN'
  | 'ATMOSPHERE_DRIVEN'
  | 'NARRATIVE_DRIVEN'
  | 'UNKNOWN';

export interface ContentMatrixResult {
  contentNature: ContentNature;
  primaryEngine: PrimaryEngine;
  secondaryEngine: PrimaryEngine;
}

export function resolveUniversalContentMatrix(result: any): ContentMatrixResult {
  // Se l'LLM ha già prodotto questi campi, li usiamo, altrimenti facciamo inferenza euristica
  if (result.contentNature && result.primaryEngine) {
    return {
      contentNature: result.contentNature as ContentNature,
      primaryEngine: result.primaryEngine as PrimaryEngine,
      secondaryEngine: (result.secondaryEngine as PrimaryEngine) || 'UNKNOWN'
    };
  }

  const script = String(result.script || "").toLowerCase();
  const prompt = String(result.aiPrompts || "").toLowerCase();
  const visible = (result.visibleSurfaceElements || []).join(" ").toLowerCase();
  const sourceType = (result.sourceType || "").toUpperCase();

  let nature: ContentNature = 'REAL_VIDEO';
  let engine: PrimaryEngine = 'ACTION_DRIVEN';
  let secondary: PrimaryEngine = 'UNKNOWN';

  // 1. Infiere ContentNature
  if (sourceType === 'STATIC_IMAGE' || sourceType === 'POSTER' || sourceType === 'FLYER') {
    nature = 'STATIC_ASSET';
  } else if (/\b(intervista|vlog|chiacchierata|parlando|talk|conversazione)\b/.test(script + visible)) {
    nature = 'VLOG_INTERVIEW';
  } else if (/\b(dialogo|battuta|sketch|comedy|commedia|talk_dialogue)\b/.test(script + visible)) {
    nature = 'TALK_DIALOGUE';
  } else if (/\b(gag|comic|divertente|risata)\b/.test(script + visible)) {
    nature = 'COMEDY_SKETCH';
  } else if (/\b(evento|festa|inaugurazione|celebrazione|raduno|visita)\b/.test(script + visible)) {
    nature = 'REAL_EVENT';
  } else if (/\b(canzone|musica|concerto|strumento|canta|singer|performance musicale)\b/.test(script + visible)) {
    nature = 'MUSIC_PERFORMANCE';
  } else if (/\b(tutorial|prodotto|demo|unboxing|recensione)\b/.test(script + visible)) {
    nature = 'PRODUCT_DEMO';
  } else if (/\b(dati|grafico|informazioni|infografica|spiegazione)\b/.test(script + visible)) {
    nature = 'INFORMATIONAL';
  }

  // 2. Infiere Engines
  if (nature === 'INFORMATIONAL') {
    engine = 'DATA_DRIVEN';
    secondary = 'NARRATIVE_DRIVEN';
  } else if (nature === 'PRODUCT_DEMO') {
    engine = 'PRODUCT_DRIVEN';
    secondary = 'ATMOSPHERE_DRIVEN';
  } else if (nature === 'MUSIC_PERFORMANCE') {
    engine = 'MUSIC_RHYTHM_DRIVEN';
    secondary = 'ATMOSPHERE_DRIVEN';
  } else if (nature === 'REAL_EVENT') {
    engine = 'EVENT_PARTICIPATION_DRIVEN';
    secondary = 'ACTION_DRIVEN';
  } else if ((nature as ContentNature) === 'VLOG_INTERVIEW' || (nature as ContentNature) === 'TALK_DIALOGUE') {
    engine = 'VERBAL_DRIVEN';
    secondary = 'REACTION_DRIVEN';
  } else if ((nature as ContentNature) === 'COMEDY_SKETCH') {
    engine = 'VERBAL_DRIVEN';
    secondary = 'REACTION_DRIVEN';
  } else if (nature === 'STATIC_ASSET') {
    engine = 'ATMOSPHERE_DRIVEN';
    secondary = 'DATA_DRIVEN';
  }

  return { contentNature: nature, primaryEngine: engine, secondaryEngine: secondary };
}

export function isValidatorCompatible(validatorName: string, nature: ContentNature, engine?: PrimaryEngine): boolean {
  const alwaysActive = [
    'dnaValidator'
  ];
  
  if (alwaysActive.includes(validatorName)) return true;

  switch (validatorName) {
    case 'scoreFormat':
      return nature !== 'MUSIC_PERFORMANCE';

    case 'noPlaceholder':
      return !['SPORTS_ACTION', 'REAL_EVENT', 'REAL_VIDEO', 'MOVIE_CLIP'].includes(nature);

    case 'sourceReality':
      return !['MOVIE_CLIP', 'TV_CLIP', 'COMEDY_SKETCH', 'MUSIC_PERFORMANCE', 'ANIMATED_VIDEO', 'STATIC_ASSET'].includes(nature);

    case 'dopamineEngine':
      return !['STATIC_ASSET', 'INFORMATIONAL'].includes(nature);

    case 'languageLock':
      return !['MUSIC_PERFORMANCE', 'SPORTS_ACTION'].includes(nature);

    case 'staticAsset':
      return nature === 'STATIC_ASSET';
    
    case 'actionHierarchy':
      return ['REAL_VIDEO', 'SPORTS_ACTION', 'MOVIE_CLIP', 'ANIMATED_VIDEO'].includes(nature);

    case 'eventMaterialization':
    case 'eventCore':
      return nature === 'REAL_EVENT' || nature === 'REAL_VIDEO';

    case 'dialogueIntent':
      return ['TALK_DIALOGUE', 'TV_CLIP', 'VLOG_INTERVIEW', 'MOVIE_CLIP', 'COMEDY_SKETCH'].includes(nature);

    case 'musicRhythm':
      return nature === 'MUSIC_PERFORMANCE';

    case 'productDemo':
      return nature === 'PRODUCT_DEMO';

    case 'informational':
      return nature === 'INFORMATIONAL';

    case 'fidelityGate':
    case 'integrityCheck':
      return nature !== 'INFORMATIONAL';

    case 'reactionAnalysis':
    case 'emotionalArc':
    case 'reactionHook':
      return ['COMEDY_SKETCH', 'TALK_DIALOGUE', 'SPORTS_ACTION', 'MOVIE_CLIP', 'VLOG_INTERVIEW'].includes(nature);

    case 'atmosphereVibe':
      return ['MUSIC_PERFORMANCE', 'REAL_EVENT', 'SPORTS_ACTION', 'MOVIE_CLIP', 'STATIC_ASSET'].includes(nature);

    case 'ambientAudio':
      return ['MUSIC_PERFORMANCE', 'REAL_EVENT', 'SPORTS_ACTION', 'MOVIE_CLIP'].includes(nature);

    case 'crowdReaction':
      return ['MUSIC_PERFORMANCE', 'REAL_EVENT', 'SPORTS_ACTION'].includes(nature);

    case 'informationDensity':
    case 'clarity':
      return ['INFORMATIONAL', 'STATIC_ASSET', 'PRODUCT_DEMO', 'TALK_DIALOGUE', 'VLOG_INTERVIEW'].includes(nature);

    case 'narrativeFlow':
      return ['INFORMATIONAL', 'PRODUCT_DEMO', 'TALK_DIALOGUE', 'VLOG_INTERVIEW'].includes(nature);

    case 'characterInteraction':
    case 'cinematography':
    case 'pacing':
      return ['MOVIE_CLIP', 'TV_CLIP', 'ANIMATED_VIDEO', 'COMEDY_SKETCH', 'TALK_DIALOGUE'].includes(nature);

    case 'comedicTiming':
    case 'punchlineStructure':
      return ['COMEDY_SKETCH'].includes(nature);

    case 'kineticFlow':
      return engine === 'ACTION_DRIVEN' || ['SPORTS_ACTION', 'REAL_EVENT', 'MOVIE_CLIP'].includes(nature);

    default:
      return true; // Per prudenza, se non mappato, lo lasciamo passare
  }
}
