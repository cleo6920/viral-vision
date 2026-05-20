import { useState, useEffect } from 'react';
import { Platform } from '../types';

interface SettingsState {
  activePromptTab: 'sora' | 'kling' | 'veo';
  soraDuration: '15s' | '12s';
  activePromptTab1: 'sora' | 'kling' | 'veo';
  soraDuration1: '15s' | '12s';
  activePromptTab2: 'sora' | 'kling' | 'veo';
  soraDuration2: '15s' | '12s';
  useBypass: boolean;
  algoCuriosity: boolean;
  isDeepAnalysis: boolean;
  isEscalation: boolean;
  spinOffMode: boolean;
  viralBoost50k: boolean;
  niche: string;
  genre: string;
  musicalType: 'canzone' | 'talent_show';
  preferredSinger: string;
  platform: string;
  feedbackHistory: string[];
  videoRange: {start: number, end: number} | null;
  rewriteLevel: number;
  rewriteLevel1: number;
  rewriteLevel2: number;
  coverAspectRatio: "9:16" | "16:9";
  coverHookText: string;
}

export function useSettings(initialState: Partial<SettingsState> | null) {
  const [activePromptTab, setActivePromptTab] = useState<'sora' | 'kling' | 'veo'>(initialState?.activePromptTab || 'sora');
  const [soraDuration, setSoraDuration] = useState<'15s' | '12s'>(initialState?.soraDuration || '15s');
  const [activePromptTab1, setActivePromptTab1] = useState<'sora' | 'kling' | 'veo'>(initialState?.activePromptTab1 || 'sora');
  const [soraDuration1, setSoraDuration1] = useState<'15s' | '12s'>(initialState?.soraDuration1 || '15s');
  const [activePromptTab2, setActivePromptTab2] = useState<'sora' | 'kling' | 'veo'>(initialState?.activePromptTab2 || 'sora');
  const [soraDuration2, setSoraDuration2] = useState<'15s' | '12s'>(initialState?.soraDuration2 || '15s');
  
  const [useBypass, setUseBypass] = useState(initialState?.useBypass || false);
  const [algoCuriosity, setAlgoCuriosity] = useState(initialState?.algoCuriosity || false);
  const [isDeepAnalysis, setIsDeepAnalysis] = useState(initialState?.isDeepAnalysis || false);
  const [isEscalation, setIsEscalation] = useState(initialState?.isEscalation || false);
  const [spinOffMode, setSpinOffMode] = useState(initialState?.spinOffMode || false);
  const [viralBoost50k, setViralBoost50k] = useState(initialState?.viralBoost50k || false);
  
  const [niche, setNiche] = useState(initialState?.niche || '');
  const [genre, setGenre] = useState(initialState?.genre || 'Auto-Detect');
  const [musicalType, setMusicalType] = useState<'canzone' | 'talent_show'>(initialState?.musicalType || 'canzone');
  const [preferredSinger, setPreferredSinger] = useState(initialState?.preferredSinger || '');
  const [platform, setPlatform] = useState(initialState?.platform || 'TikTok');
  
  const [feedbackHistory, setFeedbackHistory] = useState<string[]>(initialState?.feedbackHistory || []);
  const [videoRange, setVideoRange] = useState<{start: number, end: number} | null>(initialState?.videoRange || null);
  
  const [rewriteLevel, setRewriteLevel] = useState(initialState?.rewriteLevel || 1);
  const [rewriteLevel1, setRewriteLevel1] = useState(initialState?.rewriteLevel1 || 1);
  const [rewriteLevel2, setRewriteLevel2] = useState(initialState?.rewriteLevel2 || 1);
  
  const [coverAspectRatio, setCoverAspectRatio] = useState<"9:16" | "16:9">(initialState?.coverAspectRatio || "9:16");
  const [coverHookText, setCoverHookText] = useState<string>(initialState?.coverHookText || "");

  return {
    activePromptTab, setActivePromptTab,
    soraDuration, setSoraDuration,
    activePromptTab1, setActivePromptTab1,
    soraDuration1, setSoraDuration1,
    activePromptTab2, setActivePromptTab2,
    soraDuration2, setSoraDuration2,
    useBypass, setUseBypass,
    algoCuriosity, setAlgoCuriosity,
    isDeepAnalysis, setIsDeepAnalysis,
    isEscalation, setIsEscalation,
    spinOffMode, setSpinOffMode,
    viralBoost50k, setViralBoost50k,
    niche, setNiche,
    genre, setGenre,
    musicalType, setMusicalType,
    preferredSinger, setPreferredSinger,
    platform, setPlatform,
    feedbackHistory, setFeedbackHistory,
    videoRange, setVideoRange,
    rewriteLevel, setRewriteLevel,
    rewriteLevel1, setRewriteLevel1,
    rewriteLevel2, setRewriteLevel2,
    coverAspectRatio, setCoverAspectRatio,
    coverHookText, setCoverHookText
  };
}
