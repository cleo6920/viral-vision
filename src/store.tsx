import React, { createContext, useContext, useEffect, useReducer, type ReactNode, type Dispatch } from 'react';
import { AppState, LogEvent, Preset, AnalysisVariant, DualAnalysisResult } from './types';

type Action =
  | { type: 'SET_LANGUAGE'; payload: 'EN' | 'IT' }
  | { type: 'SET_TAB'; payload: 'INPUT' | 'RESULTS' | 'ASSISTANT' | 'SCROLL_STOP' }
  | { type: 'SET_VIDEO'; payload: { file: File; url: string } }
  | { type: 'CLEAR_VIDEO' }
  | { type: 'SET_METADATA'; payload: { name: string; size: number; duration: number } }
  | { type: 'SET_RANGE'; payload: { start: number; end: number } }
  | { type: 'SET_MODE'; payload: 'PRO' | 'FLASH' }
  | { type: 'SET_TOGGLE'; payload: { category: keyof AppState['toggles']; value: any } }
  | { type: 'SET_GOAL_RAW'; payload: string }
  | { type: 'SET_GOAL_REFINED'; payload: { refined: string; corrections: string[] } }
  | { type: 'ADD_LOG'; payload: Omit<LogEvent, 'id' | 'timestamp'> }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SET_SLOTS'; payload: Partial<AppState['slots']> }
  | { type: 'SET_DUAL_SLOTS'; payload: { faithful: AnalysisVariant; enhanced: AnalysisVariant } }
  | { type: 'SWITCH_VARIANT'; payload: 'faithful' | 'enhanced' }
  | { type: 'UPDATE_SLOT'; payload: { category: keyof AppState['slots']; data: any } }
  | { type: 'UPDATE_CHARACTER'; payload: { id: string; data: any } }
  | { type: 'ADD_TIMELINE_SLOT'; payload: { index: number; slot: any } }
  | { type: 'UPDATE_TIMELINE_SLOT'; payload: { id: string; data: any } }
  | { type: 'REMOVE_TIMELINE_SLOT'; payload: string }
  | { type: 'MOVE_TIMELINE_SLOT'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'SET_GENERATING_PROMPT'; payload: boolean }
  | { type: 'SET_REFINING_GOAL'; payload: boolean }
  | { type: 'SET_SAFETY_BYPASS'; payload: string }
  | { type: 'SET_MIXER'; payload: { category: keyof AppState['mixers']; value: number } }
  | { type: 'SET_FUSION_MIXER'; payload: { category: keyof AppState['fusionMixer']; value: number } }
  | { type: 'SET_DECODING'; payload: { isDecoding: boolean; progress: number } }
  | { type: 'TOGGLE_PROMPT_COLOR' }
  | { type: 'CLEAR_SLOTS' }
  | { type: 'CLEAR_GOAL' }
  | { type: 'CLEAR_ANALYSIS' }
  | { type: 'ADD_CHAT_MESSAGE'; payload: { role: 'user' | 'model'; text: string; files?: { name: string; mimeType: string; data: string }[] } }
  | { type: 'CLEAR_CHAT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SAVE_HISTORY' }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'APPLY_RECOMMENDED_SETTINGS'; payload: { toggles?: Partial<AppState['toggles']>; mixers?: Partial<AppState['mixers']>; fusionMixer?: Partial<AppState['fusionMixer']> } }
  | { type: 'SAVE_PRESET'; payload: { name: string } }
  | { type: 'LOAD_PRESET'; payload: { id: string } }
  | { type: 'DELETE_PRESET'; payload: { id: string } }
  | { type: 'TOGGLE_CHECKLIST'; payload: boolean }
  | { type: 'CONFIRM_TOGGLE'; payload: string }
  | { type: 'AUTO_FIX_BOREDOM' };

const loadPresets = (): Preset[] => {
  try {
    const saved = localStorage.getItem('segment_architect_presets');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const initialState: AppState = {
  language: 'EN',
  activeTab: 'INPUT',
  videoFile: null,
  videoUrl: null,
  videoMetadata: null,
  range: { start: 0, end: 0 },
  mode: 'PRO',
  presets: loadPresets(),
  activeVariant: 'faithful',
  variants: null,
  toggles: {
    visual: 'Cinema Realism',
    audio: 'Atmos',
    overlay: 'None',
    content: 'Dialogue',
    characterIdentity: 'Faithful',
    sceneIP: 'Faithful',
    musicIP: 'Faithful',
    dialogueLang: 'Original',
    genre: 'Standard',
    viralOptimization: 'Off',
    captureLogos: 'Off',
    implementLogos: 'Off',
    godMode: 'Off',
  },
  goal: {
    raw: '',
    refined: '',
    corrections: [],
  },
  mixers: {
    creative: 20,
    camera: 65,
    audio: 65,
    dialogue: 65,
    viral: 50,
  },
  fusionMixer: {
    dc: 2,
    em: 2,
    rl: 2,
    es: 2,
  },
  safetyBypass: '',
  logs: [],
  slots: {
    characters: [],
    timeline: [],
    titles: null,
    hooks: null,
    videoHook: null,
    meta: null,
    audioMood: null,
    musicalAnalysis: null,
    masterPrompt: null,
    viralCutPrompt: null,
    scrollStopCoverPrompt: null,
    grokCutPrompts: null,
    coverPrompt: null,
    neuroScore: null,
    deepDecode: undefined,
    summary: undefined,
    genre: undefined,
    mood: undefined,
    antiBoredomScore: undefined,
    fusionMixEngine: null,
  },
  isDecoding: false,
  isGeneratingPrompt: false,
  isRefiningGoal: false,
  decodeProgress: 0,
  promptColorToggle: false,
  chatHistory: [],
  past: [],
  future: [],
  isChecklistActive: false,
  confirmedToggles: [],
};

const SAVED_STATE_KEY = 'segment_architect_state';

function init(initialState: AppState): AppState {
  try {
    const saved = localStorage.getItem(SAVED_STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      
      // Migrate old intensityLevel to mixers if needed
      if (parsed.intensityLevel !== undefined && !parsed.mixers) {
        parsed.mixers = {
          creative: parsed.intensityLevel,
          camera: 50,
          audio: 50,
          dialogue: 50,
          viral: 50,
        };
        delete parsed.intensityLevel;
      }

      // Ensure all mixer properties exist (migration for existing users)
      if (parsed.mixers && parsed.mixers.viral === undefined) {
        parsed.mixers.viral = 50;
      }

      // Deep merge slots to ensure new fields (like coverPrompt, neuroScore) are initialized
      // even if they are missing in the saved state (migration)
      const mergedSlots = {
        ...initialState.slots,
        ...(parsed.slots || {})
      };

      return {
        ...initialState,
        ...parsed,
        slots: mergedSlots,
        videoFile: null,
        videoUrl: null,
        isDecoding: false,
        decodeProgress: 0,
        isGeneratingPrompt: false,
        isRefiningGoal: false,
        promptColorToggle: parsed.promptColorToggle || false,
        past: parsed.past || [],
        future: parsed.future || [],
      };
    }
  } catch (e) {
    console.error('Failed to load state, clearing storage', e);
    localStorage.removeItem(SAVED_STATE_KEY);
  }
  return initialState;
}

function reducer(state: AppState, action: Action): AppState {
  console.log('Reducer Action:', action.type, action);
  switch (action.type) {
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_VIDEO':
      return { ...state, videoFile: action.payload.file, videoUrl: action.payload.url };
    case 'CLEAR_VIDEO':
      return {
        ...state,
        videoFile: null,
        videoUrl: null,
        videoMetadata: null,
        range: { start: 0, end: 0 },
        slots: initialState.slots,
        toggles: initialState.toggles,
        mixers: initialState.mixers,
        fusionMixer: initialState.fusionMixer,
        goal: initialState.goal,
        safetyBypass: initialState.safetyBypass,
        isChecklistActive: initialState.isChecklistActive,
        confirmedToggles: initialState.confirmedToggles,
        logs: [],
        isDecoding: false,
        decodeProgress: 0,
      };
    case 'SET_METADATA':
      return { ...state, videoMetadata: action.payload };
    case 'SET_RANGE':
      return { ...state, range: action.payload };
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_TOGGLE': {
      const newState = { ...state, toggles: { ...state.toggles, [action.payload.category]: action.payload.value } };
      if (state.isChecklistActive && !state.confirmedToggles.includes(action.payload.category)) {
        newState.confirmedToggles = [...state.confirmedToggles, action.payload.category];
      }
      return newState;
    }
    case 'SET_GOAL_RAW':
      return { ...state, goal: { ...state.goal, raw: action.payload } };
    case 'SET_GOAL_REFINED':
      return { ...state, goal: { ...state.goal, refined: action.payload.refined, corrections: action.payload.corrections } };
    case 'CLEAR_GOAL':
      return { ...state, goal: { raw: '', refined: '', corrections: [] } };
    case 'CLEAR_ANALYSIS':
      return {
        ...state,
        slots: initialState.slots,
        chatHistory: [],
        goal: { raw: '', refined: '', corrections: [] },
        past: [],
        future: [],
        logs: [...state.logs, { id: Math.random().toString(36).substring(2, 9), timestamp: Date.now(), type: 'info', message: 'Analysis data and history cleared.' }]
      };
    case 'ADD_LOG':
      return {
        ...state,
        logs: [
          ...state.logs,
          {
            ...action.payload,
            id: Math.random().toString(36).substring(2, 9),
            timestamp: Date.now(),
          },
        ],
      };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'SET_SLOTS':
      return { ...state, slots: { ...state.slots, ...action.payload } };
    case 'SET_DUAL_SLOTS':
      return { 
        ...state, 
        variants: action.payload,
        activeVariant: 'enhanced',
        slots: action.payload.enhanced 
      };
    case 'SWITCH_VARIANT':
      if (!state.variants) return state;
      // Save current slots to the active variant before switching
      const updatedVariants = {
        ...state.variants,
        [state.activeVariant]: { ...state.slots }
      };
      return {
        ...state,
        variants: updatedVariants,
        activeVariant: action.payload,
        slots: updatedVariants[action.payload]
      };
    case 'UPDATE_SLOT':
      return {
        ...state,
        slots: {
          ...state.slots,
          [action.payload.category]: {
            ...(state.slots[action.payload.category] as any),
            ...action.payload.data,
          },
        },
      };
    case 'UPDATE_CHARACTER':
      return {
        ...state,
        slots: {
          ...state.slots,
          characters: state.slots.characters.map((c) =>
            c.id === action.payload.id ? { ...c, ...action.payload.data } : c
          ),
        },
      };
    case 'ADD_TIMELINE_SLOT':
      const newTimeline = [...state.slots.timeline];
      newTimeline.splice(action.payload.index + 1, 0, action.payload.slot);
      return {
        ...state,
        slots: {
          ...state.slots,
          timeline: newTimeline,
        },
      };
    case 'UPDATE_TIMELINE_SLOT':
      return {
        ...state,
        slots: {
          ...state.slots,
          timeline: state.slots.timeline.map((s) =>
            s.id === action.payload.id ? { ...s, ...action.payload.data } : s
          ),
        },
      };
    case 'REMOVE_TIMELINE_SLOT':
      return {
        ...state,
        slots: {
          ...state.slots,
          timeline: state.slots.timeline.filter((s) => s.id !== action.payload),
        },
      };
    case 'MOVE_TIMELINE_SLOT': {
      const index = state.slots.timeline.findIndex((s) => s.id === action.payload.id);
      if (index === -1) return state;
      const newTimeline = [...state.slots.timeline];
      if (action.payload.direction === 'up' && index > 0) {
        [newTimeline[index], newTimeline[index - 1]] = [newTimeline[index - 1], newTimeline[index]];
      } else if (action.payload.direction === 'down' && index < newTimeline.length - 1) {
        [newTimeline[index], newTimeline[index + 1]] = [newTimeline[index + 1], newTimeline[index]];
      }
      return {
        ...state,
        slots: {
          ...state.slots,
          timeline: newTimeline,
        },
      };
    }
    case 'SET_GENERATING_PROMPT':
      return { ...state, isGeneratingPrompt: action.payload };
    case 'SET_REFINING_GOAL':
      return { ...state, isRefiningGoal: action.payload };
    case 'SET_SAFETY_BYPASS':
      return { ...state, safetyBypass: action.payload };
    case 'SET_MIXER':
      return {
        ...state,
        mixers: {
          ...state.mixers,
          [action.payload.category]: action.payload.value,
        },
      };
    case 'SET_FUSION_MIXER':
      return {
        ...state,
        fusionMixer: {
          ...state.fusionMixer,
          [action.payload.category]: action.payload.value,
        },
      };
    case 'SET_DECODING':
      return { ...state, isDecoding: action.payload.isDecoding, decodeProgress: action.payload.progress };
    case 'TOGGLE_PROMPT_COLOR':
      return { ...state, promptColorToggle: !state.promptColorToggle };
    case 'CLEAR_SLOTS':
      return {
        ...state,
        slots: initialState.slots,
        goal: initialState.goal,
        toggles: initialState.toggles,
        mixers: initialState.mixers,
        fusionMixer: initialState.fusionMixer,
        safetyBypass: initialState.safetyBypass,
        isChecklistActive: initialState.isChecklistActive,
        confirmedToggles: initialState.confirmedToggles,
        chatHistory: [],
        logs: [],
        past: [],
        future: [],
        promptColorToggle: false,
        activeTab: 'INPUT'
      };
    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatHistory: [
          ...state.chatHistory,
          {
            id: Math.random().toString(36).substring(2, 9),
            ...action.payload,
          },
        ],
      };
    case 'CLEAR_CHAT':
      return { ...state, chatHistory: [] };
    case 'SAVE_PRESET': {
      const newPreset: Preset = {
        id: Math.random().toString(36).substring(2, 9),
        name: action.payload.name,
        toggles: { ...state.toggles },
        mixers: { ...state.mixers },
        fusionMixer: { ...state.fusionMixer },
      };
      const newPresets = [...state.presets, newPreset];
      localStorage.setItem('segment_architect_presets', JSON.stringify(newPresets));
      return { ...state, presets: newPresets };
    }
    case 'LOAD_PRESET': {
      const preset = state.presets.find(p => p.id === action.payload.id);
      if (!preset) return state;
      return {
        ...state,
        toggles: { ...preset.toggles },
        mixers: { ...preset.mixers },
        fusionMixer: { ...(preset.fusionMixer || state.fusionMixer) },
      };
    }
    case 'DELETE_PRESET': {
      const newPresets = state.presets.filter(p => p.id !== action.payload.id);
      localStorage.setItem('segment_architect_presets', JSON.stringify(newPresets));
      return { ...state, presets: newPresets };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      const currentState = {
        toggles: state.toggles,
        mixers: state.mixers,
        fusionMixer: state.fusionMixer,
        goal: state.goal,
        slots: state.slots,
      };
      return {
        ...state,
        ...previous,
        past: newPast,
        future: [currentState, ...state.future],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const currentState = {
        toggles: state.toggles,
        mixers: state.mixers,
        fusionMixer: state.fusionMixer,
        goal: state.goal,
        slots: state.slots,
      };
      return {
        ...state,
        ...next,
        past: [...state.past, currentState],
        future: newFuture,
      };
    }
    case 'SAVE_HISTORY': {
      const currentState = {
        toggles: state.toggles,
        mixers: state.mixers,
        fusionMixer: state.fusionMixer,
        goal: state.goal,
        slots: state.slots,
      };
      const newPast = [...state.past, currentState].slice(-50);
      return { ...state, past: newPast, future: [], lastHistorySave: Date.now() };
    }
    case 'CLEAR_HISTORY':
      return { ...state, past: [], future: [] };
    case 'APPLY_RECOMMENDED_SETTINGS':
      return {
        ...state,
        toggles: { ...state.toggles, ...(action.payload.toggles || {}) },
        mixers: { ...state.mixers, ...(action.payload.mixers || {}) },
        fusionMixer: { ...state.fusionMixer, ...(action.payload.fusionMixer || {}) },
      };
    case 'TOGGLE_CHECKLIST':
      return { ...state, isChecklistActive: action.payload, confirmedToggles: action.payload ? [] : state.confirmedToggles };
    case 'CONFIRM_TOGGLE':
      if (!state.confirmedToggles.includes(action.payload)) {
        return { ...state, confirmedToggles: [...state.confirmedToggles, action.payload] };
      }
      return state;
    case 'AUTO_FIX_BOREDOM':
      return {
        ...state,
        toggles: {
          ...state.toggles,
          visual: 'Experimental Realism',
          viralOptimization: 'Algo + Curiosity Character',
        },
        mixers: {
          ...state.mixers,
          creative: 80,
          camera: 90,
          audio: 85,
          dialogue: 75,
        }
      };
    default:
      return state;
  }
}

function rootReducer(state: AppState, action: Action): AppState {
  const autoHistoryActions = [
    'SET_TOGGLE', 'SET_GOAL_REFINED', 
    'ADD_TIMELINE_SLOT', 'REMOVE_TIMELINE_SLOT', 'MOVE_TIMELINE_SLOT', 'CLEAR_SLOTS',
    'APPLY_RECOMMENDED_SETTINGS', 'SET_FUSION_MIXER', 'AUTO_FIX_BOREDOM'
  ];
  
  const typingActions = [
    'SET_SLOTS', 'UPDATE_SLOT', 'UPDATE_CHARACTER', 'UPDATE_TIMELINE_SLOT', 
    'SET_GOAL_RAW', 'SET_SAFETY_BYPASS'
  ];
  
  let prevState = state;
  const now = Date.now();
  
  if (autoHistoryActions.includes(action.type) || 
     (typingActions.includes(action.type) && (!state.lastHistorySave || now - state.lastHistorySave > 2000))) {
    const currentState = {
      toggles: state.toggles,
      mixers: state.mixers,
      fusionMixer: state.fusionMixer,
      goal: state.goal,
      slots: state.slots,
    };
    const newPast = [...state.past, currentState].slice(-50);
    prevState = { ...state, past: newPast, future: [], lastHistorySave: now };
  }
  
  return reducer(prevState, action);
}

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(rootReducer, initialState, init);

  useEffect(() => {
    const stateToSave = {
      ...state,
      videoFile: null,
      videoUrl: null,
      isDecoding: false,
      isGeneratingPrompt: false,
      isRefiningGoal: false,
      chatHistory: state.chatHistory.map(msg => ({
        ...msg,
        files: msg.files?.map(f => ({ ...f, data: '' })) // Strip base64 data to save space
      }))
    };
    
    try {
      localStorage.setItem(SAVED_STATE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('LocalStorage quota exceeded, attempting to save a lighter version...', error);
      try {
        // If it fails, try saving without chat history, logs, and undo/redo states
        const lighterState = {
          ...stateToSave,
          chatHistory: [],
          past: [],
          future: [],
          logs: []
        };
        localStorage.setItem(SAVED_STATE_KEY, JSON.stringify(lighterState));
        console.log('Successfully saved lighter state.');
      } catch (e) {
        console.error('Failed to save even the lighter state to localStorage:', e);
      }
    }
  }, [state]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
