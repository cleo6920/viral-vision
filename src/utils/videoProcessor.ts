import { getFFmpeg } from '../services/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { logger } from './logger';

/**
 * Gets the duration of a video file using the browser's Video element.
 */
export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(0);
    };
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Extracts the audio track from a video file as a small WAV blob.
 * Tiered strategy: MediaContext (fast) -> FFmpeg (robust) -> Error
 */
export async function extractAudioTrack(file: File): Promise<Blob> {
  logger.info("[AUDIO_EXTRACTION_START]", {
    fileName: file.name,
    fileSizeMB: (file.size / (1024 * 1024)).toFixed(2)
  });

  // 1. Try fast decodeAudioData first
  try {
    return await extractAudioWithMediaContext(file);
  } catch (err) {
    logger.warn("[AUDIO_EXTRACTION_FAST_FAIL_TRY_FFMPEG]", err);
  }

  // 2. Fallback to FFmpeg (Optional/Best Effort)
  try {
    logger.info("[FFMPEG_OPTIONAL_FALLBACK_START]");
    return await extractAudioWithFFmpeg(file);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Timeout")) {
      logger.warn("[FFMPEG_OPTIONAL_EXTRACTION_TIMEOUT_CONTINUE]");
    } else {
      logger.error("[FFMPEG_OPTIONAL_EXTRACTION_FAIL_CONTINUE]", err);
    }
    throw err;
  }
}

/**
 * Fast audio extraction using Web Audio API (OfflineAudioContext).
 */
async function extractAudioWithMediaContext(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const targetSampleRate = 16000;
        const offlineContext = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetSampleRate), targetSampleRate);
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();
        
        const renderedBuffer = await offlineContext.startRendering();
        const wavBlob = audioBufferToWav(renderedBuffer);
        
        logger.info("[AUDIO_EXTRACTION_FAST_SUCCESS]", {
           blobSizeKB: Math.round(wavBlob.size / 1024),
           durationSec: audioBuffer.duration.toFixed(2)
        });
        resolve(wavBlob);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Robust audio extraction using FFmpeg.
 */
async function extractAudioWithFFmpeg(file: File): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const inputName = 'input_video';
  const outputName = 'output_audio.wav';

  try {
    const fileData = await fetchFile(file);
    await ffmpeg.writeFile(inputName, fileData);

    // Filter: 16k mono wav
    const execPromise = ffmpeg.exec([
      '-i', inputName,
      '-vn',                      // No video
      '-acodec', 'pcm_s16le',     // PCM 16bit
      '-ar', '16000',             // 16kHz
      '-ac', '1',                 // Mono
      outputName
    ]);

    const execTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout FFmpeg ST (30s)")), 30000)
    );

    await Promise.race([execPromise, execTimeoutPromise]);

    const data = await ffmpeg.readFile(outputName);
    const audioBlob = new Blob([data], { type: 'audio/wav' });
    
    logger.info("[FFMPEG_AUDIO_EXTRACTION_SUCCESS]", {
      sizeKB: Math.round(audioBlob.size / 1024)
    });
    
    return audioBlob;
  } catch (err) {
    throw err;
  } finally {
    // Cleanup
    try {
      if (await fileExists(ffmpeg, inputName)) await ffmpeg.deleteFile(inputName);
      if (await fileExists(ffmpeg, outputName)) await ffmpeg.deleteFile(outputName);
    } catch (e) {}
  }
}

export async function chunkWavBlob(blob: Blob, chunkSizeSeconds: number): Promise<Blob[]> {
  const arrayBuffer = await blob.arrayBuffer();
  const dataView = new DataView(arrayBuffer);
  
  const sampleRate = 16000;
  const bytesPerSample = 2;
  const bytesPerSecond = sampleRate * bytesPerSample;
  const maxBytesPerChunk = chunkSizeSeconds * bytesPerSecond;
  
  let dataOffset = 44;
  
  const chunks: Blob[] = [];
  let currentOffset = dataOffset;
  
  while (currentOffset < arrayBuffer.byteLength) {
    const bytesRemaining = arrayBuffer.byteLength - currentOffset;
    const chunkDataSize = Math.min(bytesRemaining, maxBytesPerChunk);
    
    const chunkLength = chunkDataSize + 44;
    const headerBuffer = new ArrayBuffer(44);
    const headerView = new DataView(headerBuffer);
    
    for (let i = 0; i < 44; i++) {
      headerView.setUint8(i, dataView.getUint8(i));
    }
    headerView.setUint32(4, chunkLength - 8, true);
    headerView.setUint32(40, chunkDataSize, true);
    
    const chunkData = arrayBuffer.slice(currentOffset, currentOffset + chunkDataSize);
    
    chunks.push(new Blob([headerBuffer, chunkData], { type: 'audio/wav' }));
    currentOffset += chunkDataSize;
  }
  
  return chunks;
}

async function fileExists(ffmpeg: any, name: string): Promise<boolean> {
  try {
    await ffmpeg.readFile(name);
    return true;
  } catch {
    return false;
  }
}

// Helper to convert AudioBuffer to WAV
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2);                      // block align
  setUint16(16);                                 // bits per sample

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          // write 16-bit sample
      pos += 2;
    }
    offset++;                                     // next sample index
  }

  return new Blob([bufferArray], { type: "audio/wav" });
}

/**
 * Extracts a specific number of frames from a video file using native browser APIs (Video + Canvas).
 * This is much faster and more compatible than using FFmpeg in an iframe.
 */
export async function extractFrames(
  file: File, 
  numFrames: number, 
  startTime: number = 0, 
  endTime?: number,
  maxDim: number = 800, // Reduced from 1280 to save memory on mobile
  onProgress?: (progress: number) => void,
  isLowMemoryMode: boolean = false
): Promise<string[]> {
  const effectiveMaxDim = isLowMemoryMode ? 400 : maxDim;
  const effectiveQuality = isLowMemoryMode ? 0.5 : 0.7;
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', 'true'); // iOS compatibility
    video.crossOrigin = 'anonymous';
    
    let frames: string[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { 
      willReadFrequently: true,
      alpha: false // Faster rendering
    });
    
    // Choose format: webp is much smaller but jpeg is more compatible
    const mimeType = 'image/jpeg'; 
    const quality = effectiveQuality; 

    const loadTimeout = setTimeout(() => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Timeout caricamento video (60s)."));
    }, 60000);

    video.onloadeddata = async () => {
      clearTimeout(loadTimeout);
      try {
        const videoDuration = video.duration || 1;
        const actualEndTime = endTime || videoDuration;
        const actualStartTime = startTime;
        
        const duration = actualEndTime > actualStartTime ? actualEndTime - actualStartTime : 1;
        const interval = duration / (numFrames + 1);
        let currentFrame = 1;

        // Set canvas dimensions once
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // If video is too large, scale down for analysis
        if (canvas.width > effectiveMaxDim || canvas.height > effectiveMaxDim) {
          const scale = effectiveMaxDim / Math.max(canvas.width, canvas.height);
          canvas.width *= scale;
          canvas.height *= scale;
        }

        // [FRAME_EXTRACTION_START]
        logger.info(`[FRAME_EXTRACTION_START] numFrames=${numFrames}, startTime=${startTime}`);
        const captureNextFrame = async () => {
          if (currentFrame > numFrames) {
            URL.revokeObjectURL(video.src);
            // [FRAME_EXTRACTION_DONE]
            logger.info(`[FRAME_EXTRACTION_DONE] framesLength=${frames.length}`);
            resolve(frames);
            return;
          }

          if (onProgress) {
            onProgress(Math.round((currentFrame / numFrames) * 100));
          }

          let targetTime = startTime + (currentFrame * interval);
          const safeTimes = [0.5, 1.5, 3.0, 5.0, 7.0];
          if (currentFrame <= safeTimes.length + 1 && currentFrame <= numFrames) {
              targetTime = Math.min(safeTimes[currentFrame-1] || 0.5, endTime || videoDuration);
          }
          
          // [FRAME_EXTRACTION_SEEK_TIMEOUT]
          const seekTimeout = setTimeout(() => {
            logger.warn(`[FRAME_EXTRACTION_SEEK_TIMEOUT] Seek timeout at ${targetTime}s, skipping frame.`);
            currentFrame++;
            captureNextFrame();
          }, 5000);

          video.onseeked = () => {
            clearTimeout(seekTimeout);
            try {
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL(mimeType, quality);
                frames.push(dataUrl);
                
                logger.info(`[FRAME_DEBUG_PREVIEW]`, {
                  frameIndex: currentFrame - 1,
                  timeSec: targetTime.toFixed(2),
                  sizeKB: Math.round(dataUrl.length / 1024),
                  dim: `${canvas.width}x${canvas.height}`,
                  hint: dataUrl.substring(0, 50)
                });
              }
            } catch (drawErr) {
              logger.error("[VideoProcessor] Frame capture error:", drawErr);
            }
            currentFrame++;
            captureNextFrame();
          };

          video.currentTime = targetTime;
        };

        await captureNextFrame();
      } catch (err) {
        URL.revokeObjectURL(video.src);
        reject(err);
      }
    };

    video.onerror = (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Errore nel caricamento del video per l'estrazione dei fotogrammi."));
    };

    video.src = URL.createObjectURL(file);
  });
}
