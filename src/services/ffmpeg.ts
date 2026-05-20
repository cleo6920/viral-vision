import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { logger } from '../utils/logger';

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let ffmpegFailed = false;
let skipFFmpeg = false;

export function isFFmpegSupported() {
  return !skipFFmpeg && (typeof SharedArrayBuffer !== 'undefined' || window.crossOriginIsolated);
}

export function setSkipFFmpeg(skip: boolean) {
  skipFFmpeg = skip;
  if (skip) {
    ffmpegFailed = true;
  }
}

export async function resetFFmpeg() {
  ffmpeg = null;
  loadPromise = null;
  ffmpegFailed = false;
  console.log("[FFmpeg] Stato resettato per un nuovo tentativo di caricamento.");
}

export async function getFFmpeg(onLoadProgress?: (p: number) => void) {
  if (ffmpeg) return ffmpeg;
  if (ffmpegFailed) throw new Error("FFmpeg non è disponibile su questo browser.");
  
  // If already loading, we can't easily attach a new progress listener to the existing promise
  // but we can return the promise.
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const instance = new FFmpeg();
      instance.on('log', ({ message }) => console.log('[FFmpeg Init Log]', message));
      
      // Check if we can use multithreading
      const isIsolated = window.crossOriginIsolated;
      console.log("[FFmpeg] Cross-Origin Isolated:", isIsolated);
      
      if (!isIsolated) {
        console.warn("[FFmpeg] Attenzione: L'ambiente non è 'cross-origin isolated'. Il multithreading (MT) non sarà disponibile. FFmpeg funzionerà in modalità Single-Thread (ST), che è più lenta e soggetta a timeout in alcuni browser.");
      }

      const tryLoad = async (baseURL: string, isST: boolean, useLocalNames: boolean = false) => {
        // In version 0.12.6, ST files are often named -st or just core.
        let coreName = 'ffmpeg-core.js';
        let wasmName = 'ffmpeg-core.wasm';
        
        if (useLocalNames) {
          if (isST) {
            coreName = 'ffmpeg-core-st.js';
            wasmName = 'ffmpeg-core-st.wasm';
          } else {
            coreName = 'ffmpeg-core-mt.js';
            wasmName = 'ffmpeg-core-mt.wasm';
          }
        }
        
        const workerName = 'ffmpeg-core.worker.js';
        const isLocal = baseURL === window.location.origin || baseURL === "";
        
        console.log(`[FFmpeg] Tentativo di caricamento (${isST ? 'ST' : 'MT'}) da: ${baseURL || 'Local'} (Core: ${coreName})`);
        
        const loadOperation = async () => {
          let coreURL: string;
          let wasmURL: string;
          let workerURL: string | undefined;

          try {
            if (isLocal) {
              // Use absolute paths for local files to be sure
              const fullCorePath = `${window.location.origin}/${coreName}`;
              const fullWasmPath = `${window.location.origin}/${wasmName}`;
              
              console.log(`[FFmpeg] Fetching local files: ${fullCorePath}`);
              coreURL = await toBlobURL(fullCorePath, 'text/javascript');
              wasmURL = await toBlobURL(fullWasmPath, 'application/wasm');
              if (!isST) workerURL = await toBlobURL(`${window.location.origin}/${workerName}`, 'text/javascript');
            } else {
              console.log(`[FFmpeg] Fetching from CDN: ${baseURL}/${coreName}...`);
              coreURL = await toBlobURL(`${baseURL}/${coreName}`, 'text/javascript');
              wasmURL = await toBlobURL(`${baseURL}/${wasmName}`, 'application/wasm');
              if (!isST) {
                workerURL = await toBlobURL(`${baseURL}/${workerName}`, 'text/javascript');
              }
            }
            
            console.log(`[FFmpeg] instance.load starting...`);

            await instance.load({
              coreURL,
              wasmURL,
              ...(workerURL ? { workerURL } : {})
            });
            
            console.log(`[FFmpeg] instance.load success!`);
            return true;
          } catch (err: any) {
            console.error(`[FFmpeg] Internal load error during ${coreName}:`, err.message || err);
            throw err;
          }
        };

        try {
          let timeoutId: any;
          // Local files should be fast if they work. However, in containerized dev environments like AI Studio,
          // serving the 30MB WASM core can sometimes exceed 60s. We increase to 120s.
          const timeoutMs = isLocal ? 120000 : 300000; 
          
          console.log(`[FFmpeg] Esecuzione loadOperation con timeout: ${timeoutMs}ms...`);
          if ('serviceWorker' in navigator) {
            const sw = await navigator.serviceWorker.getRegistration();
            console.log("[FFmpeg] Service Worker Status:", sw ? `Active (${sw.active?.state})` : "Not found (CRITICAL for MT)");
          }

          const timeoutPromise = new Promise<never>((_, reject) => 
            timeoutId = setTimeout(() => reject(new Error(`Timeout FFmpeg ${isST ? 'ST' : 'MT'} (${timeoutMs/1000}s)`)), timeoutMs)
          );
          
          await Promise.race([loadOperation(), timeoutPromise]);
          if (timeoutId) clearTimeout(timeoutId);
          
          return true;
        } catch (err: any) {
          console.error(`[FFmpeg] Fase fallita per ${baseURL || 'Local'}:`, err.message || err);
          return false;
        }
      };

      let loaded = false;

      // 1. Tenta Local ST (Nome standard)
      console.log("[FFmpeg] Fase 1: Tentativo Local ST (Standard)...");
      loaded = await tryLoad(window.location.origin, true, false);

      // 2. Tenta Local ST (Nome esplicito -st)
      if (!loaded) {
        console.log("[FFmpeg] Fase 2: Tentativo Local ST (Explicit -st)...");
        loaded = await tryLoad(window.location.origin, true, true);
      }

      // 3. Tenta CDN ST (jsdelivr) - Solitamente più veloce e affidabile
      if (!loaded) {
        console.log("[FFmpeg] Fase 3: Tentativo CDN ST (jsdelivr)...");
        loaded = await tryLoad('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd', true);
      }

      // 4. Tenta CDN ST (unpkg)
      if (!loaded) {
        console.log("[FFmpeg] Fase 4: Tentativo CDN ST (unpkg)...");
        loaded = await tryLoad('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd', true);
      }

      // Se siamo in un iframe e non siamo isolati, non ha senso provare MT o altri CDN lenti
      if (!loaded && !isIsolated) {
        console.warn("[FFmpeg] Ambiente non isolato e caricamento ST fallito. Interrompo i tentativi per evitare blocchi.");
      } else {
        // 5. Tenta Local MT (Se isolato)
        if (!loaded && isIsolated) {
          console.log("[FFmpeg] Fase 5: Tentativo Local MT...");
          loaded = await tryLoad(window.location.origin, false, true);
        }
      }

      if (!loaded) {
        ffmpegFailed = true;
        throw new Error(
          "BLOCCO SICUREZZA RILEVATO: Impossibile caricare il motore video (FFmpeg).\n\n" +
          "L'ambiente AI Studio (iframe) o la tua connessione stanno bloccando il caricamento dei componenti video.\n\n" +
          "SOLUZIONE 1: Clicca 'APRI IN NUOVA SCHEDA' per sbloccare tutte le funzioni.\n" +
          "SOLUZIONE 2: L'app userà il 'Virtual Trim' (estrazione frame dal file originale senza tagliarlo fisicamente)."
        );
      }
      
      console.log("FFmpeg loaded successfully");
      ffmpeg = instance;
      return instance;
    } catch (err) {
      console.error("Failed to load FFmpeg after all attempts:", err);
      ffmpegFailed = true;
      loadPromise = null;
      throw err;
    }
  })();

  return loadPromise;
}

export async function trimAudio(
  videoFile: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void
): Promise<File> {
  const ffmpegPromise = getFFmpeg();
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("Timeout caricamento motore audio (120s)")), 120000)
  );

  const ffmpeg = await Promise.race([ffmpegPromise, timeoutPromise]);
  const duration = endTime - startTime;
  
  const inputName = `in_audio_${Date.now()}.mp4`;
  const outputName = `out_audio_${Date.now()}.m4a`;

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(progress);
    });
  }

  try {
    logger.info(`[FFmpeg] Starting AUDIO extract: ${startTime}s to ${endTime}s`);
    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
    
    // -vn removes video, greatly speeding up extraction
    const args = [
      '-ss', startTime.toFixed(3),
      '-i', inputName,
      '-t', duration.toFixed(3),
      '-vn',
      '-c:a', 'aac',
      '-ar', '44100',
      '-b:a', '128k',
      outputName
    ];

    const execPromise = ffmpeg.exec(args);
    const execTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout esecuzione audio (120s)")), 120000)
    );
    
    await Promise.race([execPromise, execTimeoutPromise]);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data], { type: 'audio/mp4' });
    return new File([blob], `audio_slice_${Date.now()}.m4a`, { type: 'audio/mp4' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[FFmpeg] Audio Extraction execution error: ${errorMsg}`);
    throw new Error(`Errore durante l'estrazione audio: ${errorMsg}`);
  } finally {
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      // Remove progress listener
      ffmpeg.terminate(); // terminate to cleanup all listeners, or we need to remove the specific listener if possible
      // Actually ffmpeg.on seems to add generic listeners. Let's re-get ffmpeg for next time.
    } catch (e) {}
  }
}

export async function trimVideo(
  videoFile: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void
): Promise<File> {
  // Add a timeout to the FFmpeg acquisition to prevent infinite hanging
  const ffmpegPromise = getFFmpeg();
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("Il motore video non risponde (timeout 300s).")), 300000)
  );

  const ffmpeg = await Promise.race([ffmpegPromise, timeoutPromise]);
  
  if (onProgress) onProgress(0.01);

  const duration = endTime - startTime;

  const progressCallback = ({ progress, time }: { progress: number, time?: number }) => {
    const currentSecs = time !== undefined ? time / 1000000 : 0;
    logger.info(`[FFmpeg] Progress: ${(progress * 100).toFixed(1)}%, Time: ${currentSecs.toFixed(2)}s`);
    console.log("FFmpeg progress:", progress, "time:", time);
    if (onProgress) {
      let calculatedProgress = progress;
      
      if (time !== undefined) {
        // time is in microseconds in @ffmpeg/ffmpeg v0.12+
        const currentSecs = time / 1000000;
        if (currentSecs > 0 && duration > 0) {
          calculatedProgress = Math.min(1, currentSecs / duration);
        }
      } else if (typeof progress === 'number' && !isNaN(progress)) {
        calculatedProgress = Math.max(0, Math.min(1, progress));
      }
      
      onProgress(calculatedProgress);
    }
  };
  
  ffmpeg.on('progress', progressCallback);
  ffmpeg.on('log', ({ message }) => {
    console.log("FFmpeg log:", message);
  });

  const extension = videoFile.name.split('.').pop() || 'mp4';
  const inputName = `in_${Date.now()}.${extension}`;
  const outputName = `out_${Date.now()}.${extension}`;

  try {
    logger.info(`[FFmpeg] Starting video trim: ${startTime}s to ${endTime}s (duration: ${duration}s)`);
    console.log(`Starting video trim: ${startTime}s to ${endTime}s (duration: ${duration}s)`);
    
    logger.info("[FFmpeg] Writing input file to FFmpeg FS...");
    console.log("Writing input file to FFmpeg FS...");
    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
    logger.info("[FFmpeg] Input file written successfully");
    console.log("Input file written successfully");
    
    // Re-encode with very fast settings for frame-accurate cuts.
    const args = [
      '-ss', startTime.toFixed(3),
      '-i', inputName,
      '-t', duration.toFixed(3),
      '-vf', "scale='min(720,iw)':-2", 
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '32', 
      '-pix_fmt', 'yuv420p',
      '-avoid_negative_ts', 'make_zero',
      '-c:a', 'aac',
      '-ar', '44100',
      '-b:a', '96k'
    ];

    if (extension.toLowerCase() === 'mp4' || extension.toLowerCase() === 'mov') {
      args.push('-movflags', '+faststart');
    }

    args.push(outputName);

    logger.info(`[FFmpeg] Executing FFmpeg command: ${args.join(' ')}`);
    console.log("Executing FFmpeg command:", args.join(' '));
    
    // Add a 5-minute timeout for FFmpeg execution
    const execPromise = ffmpeg.exec(args);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout durante l'esecuzione di FFmpeg (300s)")), 300000)
    );
    
    await Promise.race([execPromise, timeoutPromise]);
    
    logger.info("[FFmpeg] FFmpeg execution finished");
    console.log("FFmpeg execution finished");

    const data = await ffmpeg.readFile(outputName);
    const mimeType = videoFile.type || `video/${extension}`;
    const blob = new Blob([data], { type: mimeType });
    
    if (onProgress) onProgress(1); 
    
    console.log("Trim completed successfully");
    return new File([blob], `trimmed_${Date.now()}.${extension}`, { type: mimeType });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[FFmpeg] Execution error: ${errorMsg}`, error);
    console.error("FFmpeg execution error:", error);
    throw new Error(`Errore durante l'elaborazione del video: ${errorMsg}`);
  } finally {
    ffmpeg.off('progress', progressCallback);
    // Clean up files immediately to save WASM memory
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (e) {}
  }
}
