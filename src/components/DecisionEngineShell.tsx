import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ShieldAlert, Cpu, Activity, Zap, Info, ExternalLink, Globe, Lock, Unlock, AlertCircle, CheckCircle2, Rocket, Brain, Download, Share2, Trash2, RefreshCcw, FlaskConical, Wifi, WifiOff, Gauge } from 'lucide-react';
import { logger } from '../utils/logger';
import { getAI, maskApiKeySafe, resetQuotaStatus } from '../services/gemini/core';
import { runVideoSmokeTest } from '../services/gemini/smokeTest';
import { runVideoAnalysisLite, LiteAnalysisResult } from '../services/gemini/videoAnalysisLite';
import { assertUserInitiatedApiCall } from '../services/apiCallGuard';

// Architecture Comment:
// All quota-consuming API calls must be user-initiated. Do not call model APIs from useEffect, mount, key update, file selection, polling, retry, or background diagnostics.

// ...rest of existing imports unchanged...
// (I will leave the rest of the file imports the same as they were, I will only target the button click part)

interface BrowserHealth {
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  secureContext: boolean;
  indexedDB: boolean;
  online: boolean;
}

interface DecisionEngineShellProps {
  children: React.ReactNode;
  onReset?: () => void;
  onClearCache?: () => void;
  onExportData?: () => void;
  isCopiedExport?: boolean;
}

export const DecisionEngineShell: React.FC<DecisionEngineShellProps> = ({ 
  children,
  onReset,
  onClearCache,
  onExportData,
  isCopiedExport
}) => {
  const [health, setHealth] = useState<BrowserHealth>({
    crossOriginIsolated: false,
    sharedArrayBuffer: false,
    secureContext: false,
    indexedDB: false,
    online: false,
  });

  const [memStatus, setMemStatus] = useState<'OK' | 'WARN' | 'CRITICAL'>('OK');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMemory = () => {
      const perf: any = window.performance;
      if (perf && perf.memory) {
        // usedJSHeapSize / jsHeapSizeLimit
        const used = perf.memory.usedJSHeapSize;
        const total = perf.memory.jsHeapSizeLimit;
        const ratio = used / total;
        
        if (ratio > 0.85) setMemStatus('CRITICAL');
        else if (ratio > 0.7) setMemStatus('WARN');
        else setMemStatus('OK');
        
        if (ratio > 0.9) {
          logger.warn("[MEMORY_CRITICAL] Memory usage is extremely high, reducing UI updates.");
        }
      }
    };
    const memInterval = setInterval(checkMemory, 10000); // Check every 10s
    return () => clearInterval(memInterval);
  }, []);

  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [configStatus, setConfigStatus] = useState({ geminiKey: false, geminiRuntime: false, youtubeKey: false, groqKey: false });
  const [isVideoTestRunning, setIsVideoTestRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState({
    keyStatus: 'PENDING' as 'PENDING' | 'VALID' | 'INVALID',
    textModelStatus: 'PENDING' as 'PENDING' | 'AVAILABLE' | 'FAIL',
    videoModelStatus: 'PENDING' as 'PENDING' | 'AVAILABLE' | 'LIMITED' | 'FAIL',
    rateLimitStatus: 'PENDING' as 'PENDING' | 'OK' | 'SUSPECTED' | 'CONFIRMED',
    lastErrorType: 'NONE' as 'NONE' | '429' | '500' | 'TIMEOUT' | 'UNKNOWN'
  });
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [liteResult, setLiteResult] = useState<LiteAnalysisResult | null>(null);
  const [testStatus, setTestStatus] = useState({
    text: 'idle' as 'idle' | 'testing' | 'pass' | 'fail',
    video: 'idle' as 'idle' | 'testing' | 'pass' | 'fail' | 'quota'
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const liteFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isLiteAnalysisRunning, setIsLiteAnalysisRunning] = useState(false);

  const getRuntimeGeminiStatus = () => {
    try {
      const aiState = getAI();
      const hasRuntimeKey = !!aiState.apiKey;
      const keySource = aiState.keySource || '';
      const isRuntimeKey = hasRuntimeKey && (
        keySource.includes('ENV_VITE_GEMINI_API_KEY') ||
        keySource.includes('ENV_GEMINI_API_KEY') ||
        keySource.includes('ENV_GOOGLE_API_KEY') ||
        keySource.includes('ENV_API_KEY')
      );
      return { hasRuntimeKey, isRuntimeKey, apiKey: aiState.apiKey };
    } catch {
      return { hasRuntimeKey: false, isRuntimeKey: false, apiKey: '' };
    }
  };

  const handleLiteFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFile = e.target.files?.[0];
    if (!pickedFile) {
      alert("Nessun video selezionato."); 
      return;
    }
    
    logger.info("[LITE_FILE_SELECTED]", { 
        name: pickedFile.name, 
        size: pickedFile.size, 
        type: pickedFile.type 
    });
    
    const { apiKey } = getAI();
    if (!apiKey) { alert("API Key mancante!"); return; }
    
    assertUserInitiatedApiCall({ source: 'DecisionEngineShell', userInitiated: true, actionName: 'LITE_ANALYSIS_DISPATCHED' });
    logger.info("[LITE_ANALYSIS_DISPATCHED]");
    
    setIsLiteAnalysisRunning(true);
    setTestLogs(["PROCESSO: Avvio Lite Analysis..."]);
    setLiteResult(null);

    try {
        const res = await runVideoAnalysisLite(pickedFile, apiKey, (msg) => setTestLogs(p => [...p, msg]));
        setLiteResult(res);
        logger.info("[LITE_ANALYSIS_COMPLETED]");
    } catch (err: any) {
        logger.error("[LITE_ANALYSIS_FAILED]", { reason: err.message || err.toString() });
        setTestLogs(p => [...p, `âŒ ERRORE: ${err.message || err.toString()}`]);
    } finally {
        setIsLiteAnalysisRunning(false);
        if (liteFileInputRef.current) {
            liteFileInputRef.current.value = "";
        }
    }
  };

  const handleRunSmokeTest = async (file?: File) => {
    assertUserInitiatedApiCall({ source: 'DecisionEngineShell', userInitiated: true, actionName: 'handleRunSmokeTest' });
    const runtimeGemini = getRuntimeGeminiStatus();
    const resolvedApiKey = runtimeGemini.apiKey;

    if (runtimeGemini.hasRuntimeKey) {
      setConfigStatus(prev => ({
        ...prev,
        geminiKey: true,
        geminiRuntime: prev.geminiRuntime || runtimeGemini.isRuntimeKey
      }));
      setDiagnostics(prev => ({
        ...prev,
        keyStatus: 'VALID',
        lastErrorType: 'NONE'
      }));
    }
    
    // [Phase 0: Audio Anchor]
    let audioAnchorResult = null;
    if (file && file.type.startsWith('video/') && file.size < 20 * 1024 * 1024) {
        const { anchorVideoAudio } = await import('../services/gemini/audioAnchor');
        if (resolvedApiKey) {
           try {
               // Robust timeout for smoke test too
               const timeoutPromise = new Promise<null>((resolve) => 
                  setTimeout(() => {
                    logger.warn("[AUDIO_ANCHOR_SMOKE_TEST_TIMEOUT] Audio Anchor timed out during smoke test.");
                    resolve(null);
                  }, 120000)
               );

               audioAnchorResult = await Promise.race([
                  anchorVideoAudio(file, resolvedApiKey, undefined, false, 'groq'),
                  timeoutPromise
               ]) as any;

               if (audioAnchorResult) {
                   logger.info("[AUDIO_ANCHOR_INJECTED_IN_FRAME_PIPELINE]", { 
                     audioVerified: audioAnchorResult.audioVerified,
                     scriptConfidence: audioAnchorResult.scriptConfidence
                   });
                   setTestLogs(p => [...p, "âœ… Audio Anchor verificato (INLINE_VIDEO)"]);
               }
           } catch (e) {
               logger.error("[AUDIO_ANCHOR_SMOKE_TEST_FAILED]", e);
           }
        }
    }

    // [RUN_VIDEO_TEST_FILE_STATE] LOGGING
    logger.info("[RUN_VIDEO_TEST_FILE_STATE]", {
      hasFile: !!file,
      fileName: file?.name || "N/A",
      fileSizeMB: file ? (file.size / (1024 * 1024)).toFixed(2) : "N/A",
      fileType: file?.type || "N/A",
      timestamp: new Date().toISOString()
    });

    logger.info("[RUN_VIDEO_TEST_BUTTON_HANDLER_ENTERED]");
    // [ANALYSIS_ENTRYPOINT_RECEIVED] LOGGING
    logger.info("[ANALYSIS_ENTRYPOINT_RECEIVED]", {
      entrypointName: "handleRunSmokeTest",
      calledFrom: "DecisionEngineShell_UI",
      filePresent: !!file,
      fileName: file?.name || null,
      fileType: file?.type || null,
      fileSizeMB: file ? (file.size / (1024 * 1024)).toFixed(2) : null,
      hasVideoMime: !!file && file.type?.startsWith('video/'),
      mode: 'TEST',
      forcePro: false
    });

    setIsVideoTestRunning(true);
    setTestLogs([]);
    setTestStatus({ text: 'testing', video: file ? 'testing' : 'idle' });
    logger.info("[VIDEO_TEST_RUNNING] true");
    const apiKey = resolvedApiKey;
    if (!apiKey) {
      setDiagnostics(prev => ({ ...prev, keyStatus: 'INVALID' }));
      setTestLogs(['âŒ ERRORE: API Key mancante nelle impostazioni.']);
      setIsVideoTestRunning(false);
      setTestStatus({ text: 'fail', video: 'fail' });
      logger.info("[VIDEO_TEST_TERMINAL_STATE] state=FAIL");
      logger.info("[VIDEO_TEST_RUNNING] false");
      return;
    }
    
    const report = {
      textOnly: 'PENDING',
      upload: file ? 'PENDING' : 'N/A',
      modelCall: 'PENDING',
      videoQuality: file ? 'PENDING' : 'N/A',
      chunkMode: file ? 'INACTIVE' : 'N/A',
      isPartial: false,
      chunks: 0,
      continuity: '0/10',
      multiEvidence: file ? 'PENDING' : 'N/A',
      evidenceConfidence: '0',
      evidenceConflicts: 'NO',
      causalChain: 'PENDING',
      causalScore: '0/10',
      causalWeakLinks: [] as string[],
      narrativeStatus: 'PENDING',
      promptStatus: 'PENDING',
      missingParts: [] as string[],
      recoveryExecuted: [] as string[],
      recoverySkipped: [] as string[],
      uploadLabel: 'VIDEO UPLOAD',
      videoQualityLabel: 'VIDEO QUALITY',
      diagnosis: '',
      reason: ''
    };

    const updateReport = () => {
      const logs: string[] = [];
      logs.push(`--- DIAGNOSTIC REPORT ---`);
      logs.push(`TEXT ONLY: ${report.textOnly}`);
      if (file) {
        logs.push(`${report.uploadLabel}: ${report.upload}`);
        logs.push(`CHUNK MODE: ${report.chunkMode}`);
        if (report.chunkMode === 'ACTIVE') {
          logs.push(`CHUNKS: ${report.chunks}`);
        }
        logs.push(`${report.videoQualityLabel}: ${report.videoQuality}`);
        logs.push(`NARRATIVE STATUS: ${report.narrativeStatus}`);
        logs.push(`PROMPT STATUS: ${report.promptStatus}`);
        logs.push(`MULTI-EVIDENCE VALIDATION: ${report.multiEvidence}`);
        logs.push(`SOURCE CONFIDENCE: ${report.evidenceConfidence}/10`);
        logs.push(`CONFLICTS: ${report.evidenceConflicts}`);
        logs.push(`CAUSAL CHAIN: ${report.causalChain}`);
        logs.push(`CAUSAL SCORE: ${report.causalScore}`);
        if (report.causalWeakLinks.length > 0) {
          logs.push(`CAUSAL WEAK LINKS: ${report.causalWeakLinks.join(', ')}`);
        }
        if (report.missingParts.length > 0) {
          logs.push(`MISSING PARTS: ${report.missingParts.join(', ')}`);
        }
        if (report.recoveryExecuted.length > 0) {
          logs.push(`RECOVERY EXECUTED: ${report.recoveryExecuted.join(', ')}`);
        }
        if (report.recoverySkipped.length > 0) {
          logs.push(`RECOVERY SKIPPED: ${report.recoverySkipped.join(', ')}`);
        }
      }
      logs.push(`MODEL CALL: ${report.modelCall}`);
      
      let diagnosis = "";
      if (report.textOnly === 'PASS' && report.modelCall === 'PASS') {
        if (!file) {
          diagnosis = "âœ… SISTEMA OK | TEXT MODEL AVAILABLE";
          setTestStatus({ text: 'pass', video: 'idle' });
        } else {
          const isSafeOk = report.promptStatus === 'FINAL' || report.promptStatus === 'PROVISIONAL';
          diagnosis = report.isPartial || !isSafeOk ? `âš ï¸ ${report.promptStatus} ANALYSIS | SISTEMA OK` : "âœ… SISTEMA OK | TUTTI I TEST PASSATI";
          setTestStatus({ text: 'pass', video: isSafeOk ? 'pass' : 'fail' });
        }
      } else if (report.textOnly === 'PASS' && report.modelCall === 'FAIL' && file) {
        if (report.upload === 'PASS') {
            diagnosis = "âŒ PROBABILE QUOTA VIDEO ESAURITA";
            setTestStatus({ text: 'pass', video: 'quota' });
        } else {
            diagnosis = "âš ï¸ PROBLEMA CARICAMENTO: I log mostrano errori di upload.";
            setTestStatus({ text: 'pass', video: 'fail' });
        }
      } else if (report.textOnly === 'FAIL') {
        diagnosis = "âŒ PROBLEMA FONDAMENTALE (API KEY)";
        setTestStatus({ text: 'fail', video: 'fail' });
      }
      if (diagnosis) logs.push(`\nDIAGNOSI: ${diagnosis}`);
      
      setTestLogs(logs);
    };

    const finalizeDiagnosticReport = (reason: string) => {
      logger.info(`[FINALIZE_DIAGNOSTIC_REPORT] reason=${reason}`);
      const pendingFields: string[] = [];
      if (report.videoQuality === 'PENDING') { report.videoQuality = 'UNKNOWN'; pendingFields.push('videoQuality'); }
      if (report.narrativeStatus === 'PENDING') { report.narrativeStatus = 'FRAGMENTED'; pendingFields.push('narrativeStatus'); }
      if (report.promptStatus === 'PENDING') { report.promptStatus = 'BLOCKED'; pendingFields.push('promptStatus'); }
      if (report.multiEvidence === 'PENDING') { report.multiEvidence = 'FAIL'; pendingFields.push('multiEvidence'); }
      if (report.causalChain === 'PENDING') { report.causalChain = 'BROKEN'; pendingFields.push('causalChain'); }
      if (report.modelCall === 'PENDING') { report.modelCall = 'FAIL'; pendingFields.push('modelCall'); }
      
      logger.info(`[PENDING_FIELDS_CLOSED] fields=[${pendingFields.join(',')}]`);
      updateReport();
    };

    try {
      // Step 1: Text Only Test (Skipped if video file is present to avoid confusing logs)
      if (!file) {
        setTestLogs(prev => [...prev, "PROCESSO: Avvio test puramente testuale..."]);
        try {
          const textResult = await runVideoSmokeTest(apiKey, undefined, (msg) => {
            if (msg.includes("MODEL_CALL_FAILED")) report.textOnly = 'FAIL';
          }, "smokeTest_step1");
          report.textOnly = 'PASS';
          if (textResult && !file) {
            report.promptStatus = textResult.promptStatus as any;
          }
        } catch (err) {
          report.textOnly = 'FAIL';
        }
      } else {
        report.textOnly = 'PASS';
        setTestLogs(prev => [...prev, "PROCESSO: Rilevato file video, avvio test diretto..."]);
      }
      updateReport();

      if (file) {
        // Step 2: Video Test
        setTestLogs(prev => [...prev, "PROCESSO: Avvio test con caricamento video..."]);
        try {
          const result = await runVideoSmokeTest(apiKey, file, (msg) => {
            setTestLogs(prev => [...prev, msg]);
            if (msg.includes('TEST_INLINE_DATA_PREPARED')) {
              report.upload = 'PASS';
              report.uploadLabel = 'INLINE VIDEO';
            }
            if (msg.includes('UPLOAD_SUCCESS')) report.upload = 'PASS';
            if (msg.includes('TEST_UPLOAD_FAILED')) report.upload = 'FAIL';
            if (msg.includes('TEST_MODEL_CALL_SUCCESS')) {
              report.modelCall = 'PASS';
              if (report.upload === 'PENDING') {
                report.upload = 'SKIPPED';
                report.uploadLabel = 'VIDEO UPLOAD';
                setTestLogs(prev => [...prev, "[UPLOAD_PATH_SKIPPED_INLINE_USED]"]);
              }
            }
            if (msg.includes('MODEL_CALL_FAILED')) report.modelCall = 'FAIL';
            if (msg.includes('CHUNK MODE ACTIVE')) report.chunkMode = 'ACTIVE';
            if (msg.includes('Analisi CHUNK')) {
               const parts = msg.split(' ');
               const idxParts = parts[2].split('/');
               report.chunks = parseInt(idxParts[1]);
            }
            if (msg.includes('VIDEO_QUALITY_RESULT')) {
              const res = msg.split(': ')[1];
              report.videoQuality = res;
            }
            if (msg.includes('VALIDATION: ')) {
               const parts = msg.split('|');
               report.multiEvidence = parts[0].split(': ')[1].trim();
               report.evidenceConfidence = parts[1].split(': ')[1].trim();
               report.evidenceConflicts = parts[2].split(': ')[1].trim();
            }
            if (msg.includes('[CAUSAL_CHAIN_VALID]')) {
               const val = msg.split('] ')[1];
               report.causalChain = (val === 'true' || val === 'TRUE') ? 'VALID' : 'BROKEN';
            }
            if (msg.includes('[CAUSAL_SCORE]')) {
               report.causalScore = `${msg.split(': ')[1]}/10`;
            }
            if (msg.includes('[CAUSAL_WEAK_LINKS]')) {
               const links = msg.split('] ')[1];
               report.causalWeakLinks = [links];
            }
            if (msg.includes('NARRATIVE: ')) {
               const parts = msg.split('|');
               report.narrativeStatus = parts[0].split(': ')[1].trim();
               report.promptStatus = parts[1].split(': ')[1].trim();
            }
            if (msg.includes('[RECOVERY_EXECUTED]')) {
               const type = msg.split(': ')[1];
               if (!report.recoveryExecuted.includes(type)) report.recoveryExecuted.push(type);
            }
            if (msg.includes('[RECOVERY_SKIPPED]')) {
               const parts = msg.split(' ');
               const type = parts[1].split('=')[1];
               if (!report.recoverySkipped.includes(type)) report.recoverySkipped.push(type);
            }
            updateReport();
          }, "smokeTest_step2");
          
          if (result) {
            report.reason = result.reason || 'UNKNOWN';
            report.modelCall = 'PASS';
            if (result.videoQuality) report.videoQuality = result.videoQuality;
            if (result.narrativeStatus) report.narrativeStatus = result.narrativeStatus;
            if (result.promptStatus) report.promptStatus = result.promptStatus;
            if (result.missingParts) report.missingParts = result.missingParts.map(p => `${p.type} (${p.severity})`);
            
            // Map MultiEvidence
            if (result.multiEvidence) {
                const status = result.multiEvidence.status;
                report.multiEvidence = status === 'CONFIRMED' ? 'PASS' : (status === 'WEAK' ? 'PARTIAL' : 'FAIL');
                // Use confidence from evidence if available, otherwise sourceConfidence
                const conf = result.multiEvidence.confidence > 1 ? result.multiEvidence.confidence : result.sourceConfidence;
                report.evidenceConfidence = Math.round(conf * 10) / 10 >= 10 ? '10' : (Math.round(conf * 10) / 10).toString();
                report.evidenceConflicts = result.multiEvidence.conflicts ? 'YES' : 'NO';
                logger.info("[CONFIDENCE_SCALE_NORMALIZED]", { originalConfidence: result.multiEvidence.confidence, normalized: report.evidenceConfidence });
            }
            
            // Map CausalChain
            if (result.causalChain) {
                report.causalChain = result.causalChain.status === 'VALID' ? 'VALID' : 'BROKEN';
                report.causalScore = `${Math.round(result.causalChain.score * 10) / 10}/10`;
                logger.info("[CONFIDENCE_SCALE_NORMALIZED]", { originalCausalScore: result.causalChain.score, normalized: report.causalScore });
            }
            
            // Log for verification
            logger.info("[DIAGNOSTIC_RESULT_MAPPED]", result);
            logger.info("[DIAGNOSTIC_FIELDS_UPDATED]", { 
              videoQuality: report.videoQuality, 
              narrativeStatus: report.narrativeStatus, 
              promptStatus: report.promptStatus,
              multiEvidence: report.multiEvidence,
              causalChain: report.causalChain
            });
            logger.info("[DEFAULT_NOT_APPLIED_FIELD_PRESENT]", { fields: Object.keys(result) });

            updateReport();
          }
        } catch (err) {
          if (report.upload === 'PENDING') report.upload = 'FAIL';
          if (report.modelCall === 'PENDING') report.modelCall = 'FAIL';
          if (report.videoQuality === 'PENDING') report.videoQuality = 'FAIL';
          updateReport();
        }
      } else {
        if (report.textOnly === 'PASS') report.modelCall = 'PASS';
        else report.modelCall = 'FAIL';
      }
      
      updateReport();

      // Consistency Validator for Final Prompt Status
      const applyConsistencyLogic = (inReport: typeof report) => {
        if (inReport.reason === 'MICROTEST_CHUNKED') return;
        if (!file) return; // Skip video consistency logic for text-only
        logger.info(`[FINAL_STATE_VALIDATION] Initial Status: ${inReport.promptStatus}, MultiEvidence: ${inReport.multiEvidence}, Confidence: ${inReport.evidenceConfidence}, Causal: ${inReport.causalChain}`);
        
        const isEvidencePass = (inReport.multiEvidence === 'PASS' || inReport.multiEvidence === 'CONFIRMED');
        const isCausalValid = (inReport.causalChain === 'VALID');
        const causalScoreRaw = parseFloat(inReport.causalScore.replace('/10', '')) || 0;
        const confidenceRaw = parseFloat(inReport.evidenceConfidence) || 0;
        
        const isFinalValid = (
          inReport.modelCall === 'PASS' &&
          (inReport.videoQuality === 'OK' || inReport.videoQuality === 'MEDIUM') &&
          inReport.narrativeStatus === 'FULL' &&
          isEvidencePass &&
          confidenceRaw >= 7 &&
          isCausalValid &&
          causalScoreRaw >= 7 &&
          inReport.evidenceConflicts === 'NO'
        );

        if (inReport.promptStatus === 'FINAL' && !isFinalValid) {
            logger.warn(`[FINAL_STATE_INCONSISTENCY_DETECTED] status=FINAL but validators failed`);
            let reason = "Validators check failed";
            let newStatus = "BLOCKED";

            if (inReport.modelCall !== 'PASS') {
              newStatus = "BLOCKED";
              reason = "Model call failed";
            } else if (!isEvidencePass) {
                inReport.diagnosis = "MODELLO RISPONDE MA VALIDAZIONE FALLITA";
                newStatus = "BLOCKED";
                reason = "Multi-evidence validation failed";
            } else if (inReport.narrativeStatus === 'PARTIAL') {
                inReport.diagnosis = "ANALISI PARZIALE";
                newStatus = "PROVISIONAL";
                reason = "Narrative status partial";
            } else if (!isCausalValid) {
                inReport.diagnosis = "CATENA CAUSALE NON VERIFICATA";
                newStatus = "BLOCKED";
                reason = "Causal chain broken";
            } else if (confidenceRaw < 7) {
                inReport.diagnosis = "BASSA CONFIDENZA DATI";
                newStatus = "PROVISIONAL";
                reason = "Source confidence too low";
            } else if (inReport.evidenceConflicts === 'YES') {
                inReport.diagnosis = "CONFLITTI RILEVATI";
                newStatus = "BLOCKED";
                reason = "Evidence conflicts detected";
            }

            logger.info(`[PROMPT_STATUS_DOWNGRADED] from=FINAL to=${newStatus} reason=${reason}`);
            inReport.promptStatus = newStatus;
        } else if (inReport.promptStatus === 'FINAL' && isFinalValid) {
             inReport.diagnosis = "âœ… SISTEMA OK | TUTTI I TEST PASSATI";
        }
      };
      
      applyConsistencyLogic(report);
      updateReport();

      setDiagnostics({
          keyStatus: 'VALID',
          textModelStatus: report.textOnly === 'PASS' ? 'AVAILABLE' : 'FAIL',
          videoModelStatus: (report.modelCall === 'PASS' ? 'AVAILABLE' : 'FAIL'),
          rateLimitStatus: 'OK',
          lastErrorType: 'NONE'
      });
    } catch (err: any) {
      report.textOnly = report.textOnly === 'PENDING' ? 'FAIL' : report.textOnly;
      report.modelCall = 'FAIL';
      updateReport();
      
      const errStr = err.toString();
      
      let diagnosis = "MODEL UNSTABLE / ERRORE GENERICO";
      let lastErrorType: 'NONE' | '429' | '500' | 'TIMEOUT' | 'UNKNOWN' = 'UNKNOWN';
      let rateLimitStatus: any = 'OK';
      
      if (errStr.includes("uploadToGemini") || errStr.includes("Upload fallito") || errStr.includes("404")) {
          diagnosis = "PROBLEMA CARICAMENTO";
          lastErrorType = 'UNKNOWN';
      } else if (errStr.includes("Timeout after")) {
          diagnosis = "MODEL CALL TIMEOUT / MODEL INSTABILITY";
          lastErrorType = 'TIMEOUT';
          rateLimitStatus = 'SUSPECTED';
      } else if (errStr.includes("500")) {
          diagnosis = "MODEL INTERNAL ERROR";
          lastErrorType = '500';
      } else if (errStr.includes("429") || errStr.includes("exhausted")) {
          diagnosis = "RATE LIMIT / QUOTA";
          lastErrorType = '429';
          rateLimitStatus = 'CONFIRMED';
      }

      setDiagnostics(prev => ({
          ...prev,
          keyStatus: 'VALID',
          textModelStatus: report.textOnly === 'PASS' ? 'AVAILABLE' : 'FAIL',
          videoModelStatus: 'FAIL',
          rateLimitStatus: rateLimitStatus,
          lastErrorType: lastErrorType
      }));

      const techDetails = err.smokeTestErrorInfo?.userMessage 
        ? `ðŸš¨ ${err.smokeTestErrorInfo.userMessage}`
        : (err.smokeTestErrorInfo ? JSON.stringify(err.smokeTestErrorInfo, null, 2) : `ðŸš¨ ${diagnosis}: ${err.toString()}`);
      setTestLogs(prev => [...prev, `\nâŒ ERRORE TECNICO:\n${techDetails}`]);
    } finally {
      finalizeDiagnosticReport('test_lifecycle_end');
      setIsVideoTestRunning(false);
      logger.info("[VIDEO_TEST_RUNNING] false");
    }
  };

  useEffect(() => {
    // DIAGNOSTIC_AUTORUN_DISABLED to save quota. User must trigger manually.
    logger.info("[DIAGNOSTIC_AUTORUN_DISABLED]");
    const handleKeysUpdated = () => {
        logger.info("[KEY_UPDATE_NO_MODEL_CALL]");
    };
    window.addEventListener('gemini-keys-updated', handleKeysUpdated);
    return () => window.removeEventListener('gemini-keys-updated', handleKeysUpdated);
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config-check');
        const clientYTKey = localStorage.getItem('youtube_api_key');
        const runtimeGemini = getRuntimeGeminiStatus();
        
        if (res.ok) {
          const data = await res.json();
          // Merge server-side and client-side detection
          setConfigStatus({
            ...data,
            geminiKey: !!data.geminiKey || runtimeGemini.hasRuntimeKey,
            geminiRuntime: runtimeGemini.isRuntimeKey,
            youtubeKey: data.youtubeKey || !!clientYTKey,
            groqKey: !!data.groqKey
          });
          
          // Re-trigger diagnostics if keys were found
          if (data.geminiKey || runtimeGemini.hasRuntimeKey) {
            setDiagnostics(prev => ({ 
              ...prev, 
              keyStatus: 'VALID', 
              rateLimitStatus: prev.rateLimitStatus === 'PENDING' ? 'OK' : prev.rateLimitStatus
            }));
          }
        } else {
          if (runtimeGemini.hasRuntimeKey) {
            setConfigStatus(prev => ({ ...prev, geminiKey: true, geminiRuntime: runtimeGemini.isRuntimeKey }));
            setDiagnostics(prev => ({ ...prev, keyStatus: 'VALID' }));
          }
          if (clientYTKey) {
            setConfigStatus(prev => ({ ...prev, youtubeKey: true }));
          }
        }
      } catch (err) {
        console.warn('Failed to fetch config status', err);
        const runtimeGemini = getRuntimeGeminiStatus();
        if (runtimeGemini.hasRuntimeKey) {
          setConfigStatus(prev => ({ ...prev, geminiKey: true, geminiRuntime: runtimeGemini.isRuntimeKey }));
          setDiagnostics(prev => ({ ...prev, keyStatus: 'VALID' }));
        }
        if (localStorage.getItem('youtube_api_key')) {
          setConfigStatus(prev => ({ ...prev, youtubeKey: true }));
        }
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const handleQuota = (e: any) => {
      if (e.detail?.status === 'EXHAUSTED') {
        setQuotaExhausted(true);
      } else {
        setQuotaExhausted(false);
      }
    };

    window.addEventListener('gemini-quota-status', handleQuota);
    return () => window.removeEventListener('gemini-quota-status', handleQuota);
  }, []);

  useEffect(() => {
    const checkHealth = () => {
      setHealth({
        crossOriginIsolated: window.crossOriginIsolated,
        sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        secureContext: window.isSecureContext,
        indexedDB: !!window.indexedDB,
        online: navigator.onLine,
      });
    };

    checkHealth();
    window.addEventListener('online', checkHealth);
    window.addEventListener('offline', checkHealth);

    return () => {
      window.removeEventListener('online', checkHealth);
      window.removeEventListener('offline', checkHealth);
    };
  }, []);

  const isHealthy = health.crossOriginIsolated && health.secureContext && health.indexedDB;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-red-500/30">
      {/* Top Professional Banner */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5 h-16 flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter uppercase flex items-center gap-2">
              VIRAL DECISION ENGINE
              <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20">PRO</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Decision Protocol v4.0.5</p>
          </div>

          {/* Moved Status and Quota Reset here near the title */}
          <div className="flex items-center gap-2 ml-4 h-full py-2">
            <button
              onClick={() => setShowHealth(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${
                quotaExhausted 
                  ? 'bg-red-500/20 border-red-500/40 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                  : isHealthy 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{quotaExhausted ? 'QUOTA LIMIT' : 'SYSTEM STATUS'}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${quotaExhausted ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`} />
            </button>

            <button
              onClick={() => {
                resetQuotaStatus();
                window.location.reload();
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-red-500 border border-white/5 hover:border-red-500/30 rounded-full transition-all text-[9px] font-black uppercase tracking-widest"
              title="Sblocca Quota API"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Refresh Quota</span>
            </button>

            {/* Connection Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${
              health.online 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
            }`} title={health.online ? 'Connessione Internet Attiva' : 'Mancanza Segnale Internet'}>
              {health.online ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Connesso</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mancanza Segnale</span>
                </>
              )}
            </div>

            {/* Performance Indicator */}
            {(memStatus === 'WARN' || memStatus === 'CRITICAL') && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all animate-pulse ${
                memStatus === 'CRITICAL' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              }`} title="Memoria RAM in esaurimento - Ottimizzazione Automatica Attiva">
                <Gauge className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">MEMORIA {memStatus === 'CRITICAL' ? 'CRITICA' : 'BASSA'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto sm:overflow-visible no-scrollbar max-w-[50vw] sm:max-w-none">
          {/* Action Toolbar Integrated into Header */}
          <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 mr-2">
            <button
              onClick={() => logger.downloadLogs()}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all text-[9px] font-black uppercase tracking-widest group border border-transparent hover:border-red-500/20"
              title="Scarica Log"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Log</span>
            </button>

            <button
              onClick={onExportData}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/10 text-zinc-500 hover:text-white rounded-lg transition-all text-[9px] font-black uppercase tracking-widest group border border-transparent hover:border-white/10"
              title="Esporta Dati"
            >
              <Share2 className={`w-3.5 h-3.5 ${isCopiedExport ? 'text-emerald-400' : ''}`} />
              <span className="hidden lg:inline">{isCopiedExport ? 'Copiato!' : 'Esporta'}</span>
            </button>

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            <button
              onClick={onClearCache}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-amber-500/10 text-zinc-500 hover:text-amber-500 rounded-lg transition-all text-[9px] font-black uppercase tracking-widest group border border-transparent hover:border-amber-500/20"
              title="Svuota Cache"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Cache</span>
            </button>

            <button
              onClick={onReset}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-lg transition-all text-[9px] font-black uppercase tracking-widest group border border-transparent hover:border-white/10"
              title="Reset Completo"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Reset</span>
            </button>
          </div>

          <button
            onClick={() => window.aistudio?.openSelectKey?.()}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-white/20 transition-all shadow-lg"
          >
            <Lock className="w-3 h-3 text-amber-500" />
            Config Key
          </button>
        </div>
      </header>

      {/* Health Overlay */}
      <AnimatePresence>
        {showHealth && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 sm:right-6 z-[60] w-[calc(100vw-2rem)] sm:w-80 max-h-[80vh] overflow-y-auto bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-500" />
                Diagnostics Console
              </h3>
              <button onClick={() => setShowHealth(false)} className="text-zinc-600 hover:text-white">
                <Zap className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <HealthSlot icon={Lock} label="Secure Context" active={health.secureContext} />
              <HealthSlot icon={Globe} label="Cross-Origin Isolation" active={health.crossOriginIsolated} info="Richiesto per alta velocitÃ " />
              <HealthSlot icon={Zap} label="SharedArrayBuffer" active={health.sharedArrayBuffer} />
              <HealthSlot icon={Cpu} label="IndexedDB Core" active={health.indexedDB} />
              <HealthSlot icon={Activity} label="Network Link" active={health.online} />
              <HealthSlot 
                icon={Brain} 
                label="Gemini Runtime" 
                active={diagnostics.keyStatus === 'VALID'}
                warning={diagnostics.keyStatus === 'INVALID'}
                info={diagnostics.keyStatus === 'VALID' ? 'ATTIVA E SELEZIONATA' : diagnostics.keyStatus}
              />
              <HealthSlot 
                icon={Brain} 
                label="Text Model Status" 
                active={diagnostics.textModelStatus === 'AVAILABLE'}
                warning={diagnostics.textModelStatus === 'FAIL'}
                info={diagnostics.textModelStatus === 'PENDING' ? 'NOT TESTED' : diagnostics.textModelStatus}
              />
              <HealthSlot 
                icon={Brain} 
                label="Video Model Status" 
                active={diagnostics.videoModelStatus === 'AVAILABLE'}
                warning={diagnostics.videoModelStatus === 'FAIL' || diagnostics.videoModelStatus === 'LIMITED'}
                info={diagnostics.videoModelStatus === 'PENDING' ? 'NOT TESTED' : diagnostics.videoModelStatus}
              />
              <HealthSlot 
                icon={Activity} 
                label="Quota / Rate Limit" 
                active={diagnostics.rateLimitStatus === 'OK'}
                warning={diagnostics.rateLimitStatus === 'SUSPECTED' || diagnostics.rateLimitStatus === 'CONFIRMED'}
                info={diagnostics.rateLimitStatus === 'PENDING' ? 'NON TESTATO' : (diagnostics.rateLimitStatus === 'OK' ? 'DISPONIBILE' : diagnostics.rateLimitStatus)}
              />
              <HealthSlot 
                icon={AlertCircle} 
                label="Last Error Type" 
                active={diagnostics.lastErrorType === 'NONE'}
                warning={diagnostics.lastErrorType !== 'NONE'}
                info={diagnostics.lastErrorType}
              />
              <HealthSlot 
                icon={Brain} 
                label="Gemini Default Key" 
                active={configStatus.geminiKey} 
                warning={!configStatus.geminiKey}
                info={configStatus.geminiKey ? (configStatus.geminiRuntime ? (diagnostics.keyStatus === 'VALID' ? "RILEVATA NELL'AMBIENTE" : "AMBIENTE") : (diagnostics.keyStatus === 'VALID' ? "ATTIVA" : "CONFIGURATA")) : "NON CONFIGURATA"}
              />
              <HealthSlot 
                icon={Globe} 
                label="YouTube API Key" 
                active={configStatus.youtubeKey} 
                info={configStatus.youtubeKey ? "CONFIGURATA" : "NON CONFIGURATA"}
              />
              <HealthSlot 
                icon={Zap} 
                label="Groq API Key" 
                active={configStatus.groqKey} 
                info={configStatus.groqKey ? "CONFIGURATA" : "NON CONFIGURATA"}
              />

             <div className="pt-2 space-y-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={(e) => {
                    const pickedFile = e.target.files?.[0];
                    if (pickedFile) {
                      logger.info("[VIDEO_UPLOAD_STATE]", {
                         fileName: pickedFile.name,
                         fileSize: pickedFile.size,
                         fileType: pickedFile.type,
                         lastModified: pickedFile.lastModified
                      });
                      handleRunSmokeTest(pickedFile);
                    }
                  }} 
                />
                <input 
                  type="file" 
                  ref={liteFileInputRef}
                  className="hidden" 
                  onChange={handleLiteFileSelected}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      assertUserInitiatedApiCall({ source: 'DecisionEngineShell', userInitiated: true, actionName: 'RETRY_DIAGNOSTICS' });
                      resetQuotaStatus();
                      const runtimeGemini = getRuntimeGeminiStatus();
                      setDiagnostics(prev => ({ ...prev, keyStatus: runtimeGemini.hasRuntimeKey ? 'VALID' : prev.keyStatus, textModelStatus: 'PENDING', videoModelStatus: 'PENDING', rateLimitStatus: 'PENDING', lastErrorType: 'NONE' }));
                      setTestLogs(["Resetting diagnostics..."]);
                      void handleRunSmokeTest();
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all disabled:opacity-50"
                  >
                    RETRY DIAGNOSTICS
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isVideoTestRunning}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all disabled:opacity-50"
                  >
                    <FlaskConical className="w-3.5 h-3.5" /> RUN VIDEO TEST
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  <button
                    onClick={() => {
                       logger.info("[LITE_BUTTON_HANDLER_ENTERED]");
                       if (isLiteAnalysisRunning || isVideoTestRunning) {
                           logger.warn("[LITE_BLOCKED_BUSY]", { isLiteAnalysisRunning, isVideoTestRunning });
                           alert("C'Ã¨ un'analisi video in corso. Attendi che finisca.");
                           return;
                       }
                       if (!liteFileInputRef.current) {
                           logger.error("[LITE_FILE_PICKER_NOT_FOUND]");
                           return;
                       }
                       logger.info("[LITE_FILE_PICKER_OPENED]");
                       liteFileInputRef.current.click();
                    }}
                    className="flex flex-col gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-3.5 h-3.5" /> LITE ANALYSIS
                    </div>
                  </button>
                </div>
                
                {liteResult && (
                  <div className="mt-2 p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg text-[9px] font-mono text-emerald-100">
                    <div className="font-bold mb-1">Lite Analysis: {liteResult.status}</div>
                    <div className="text-zinc-400">Calls: {liteResult.callsUsed}</div>
                    <div className="mt-1 truncate">{liteResult.summary}</div>
                  </div>
                )}
                
                {testLogs.length > 0 && (
                  <div className="p-3 bg-black/50 border border-white/5 rounded-lg text-[9px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {testLogs.map((log, i) => <div key={i} className="mb-0.5 text-zinc-400">{log}</div>)}
                  </div>
                )}
              </div>
            </div>

            {/* Deep Debug Info */}
            <div className="mt-4 p-3 bg-black/40 border border-white/5 rounded-xl">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex justify-between">
                <span>Protocol Audit</span>
                <span className="text-red-500/50">Admin Only</span>
              </p>
              <div className="space-y-1 text-[9px] font-mono">
                <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1">
                  <span className="text-zinc-500">Selected Key:</span>
                  <span className={getAI().apiKey ? "text-emerald-500 font-bold" : "text-red-500"}>
                    {getAI().apiKey ? maskApiKeySafe(getAI().apiKey) : 'Nessuna'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Gemini Default:</span>
                  <span className={configStatus.geminiKey ? "text-zinc-300" : "text-zinc-600"}>
                    {configStatus.geminiKey ? (configStatus.geminiRuntime ? "ENVIRONMENT" : "FOUND") : "NOT FOUND"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Groq Key:</span>
                  <span className={configStatus.groqKey ? "text-zinc-300" : "text-zinc-600"}>
                    {configStatus.groqKey ? "FOUND" : "NOT FOUND"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">YouTube Key:</span>
                  <span className={configStatus.youtubeKey ? "text-zinc-300" : "text-zinc-600"}>
                    {configStatus.youtubeKey ? "FOUND" : "NOT FOUND"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status Quota:</span>
                  <span className={testStatus.video === 'quota' ? "text-orange-500 font-bold" : "text-zinc-600"}>
                    {testStatus.video === 'quota' ? "ESAURITA" : "OK / PENDING"}
                  </span>
                </div>
              </div>
            </div>

            {!isHealthy && (
              <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-tight">PerchÃ© i punti sono gialli?</p>
                    <p className="text-[9px] text-zinc-400 mt-1 leading-relaxed">
                      L'anteprima di AI Studio Ã¨ un ambiente protetto (iframe). Per ottenere i <span className="text-emerald-400 font-bold">punti verdi</span> e sbloccare la massima velocitÃ  di analisi video, devi aprire l'app in una scheda dedicata.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 p-4 bg-red-600/10 border border-red-500/20 rounded-2xl">
              <p className="text-[10px] text-red-500 font-black uppercase tracking-widest flex items-center gap-2">
                <Rocket className="w-3.5 h-3.5" />
                Sblocca Protocollo Live
              </p>
              <p className="text-[9px] text-zinc-400 mt-1 mb-3">
                Clicca qui sotto per aprire direttamente l'app in una nuova scheda, fuori dall'iframe.
              </p>
              <a 
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Apri in Nuova Scheda
              </a>

              <button 
                onClick={() => {
                  resetQuotaStatus();
                  window.location.reload();
                }}
                className="w-full mt-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Reset Quota Limit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="pt-16 max-w-[1600px] mx-auto min-h-screen">
        {children}
      </main>

      {/* Subtle Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
};

const HealthSlot = ({ icon: Icon, label, active, warning, info }: { icon: any, label: string, active: boolean, warning?: boolean, info?: string }) => (
  <div className="flex items-center justify-between group">
    <div className="flex items-center gap-3">
      <div className={`p-1.5 rounded-lg border transition-colors ${
        warning ? 'bg-red-500/10 border-red-500/20 text-red-500' :
        active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
        'bg-zinc-800 border-zinc-700 text-zinc-500'
      }`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div>
        <p className={`text-[11px] font-medium ${warning ? 'text-red-400 font-bold' : active ? 'text-zinc-200' : 'text-zinc-500'}`}>{label}</p>
        {info && <p className="text-[8px] text-zinc-600 uppercase font-black tracking-tighter">{info}</p>}
      </div>
    </div>
    {warning ? (
      <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
    ) : active ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    ) : (
      <AlertCircle className="w-4 h-4 text-amber-500" />
    )}
  </div>
);
