import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;
  const env = process.env as Record<string, string | undefined>;

  // Body parser for JSON with large limit for base64 frames
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  const firstEnvValue = (...names: string[]) => {
    for (const name of names) {
      const value = env[name] || (env as any)[name.toLowerCase()];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  const resolveGeminiEnvKey = () =>
    firstEnvValue("VITE_GEMINI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "API_KEY");

  const resolveYoutubeEnvKey = () =>
    firstEnvValue("VITE_YOUTUBE_API_KEY", "YOUTUBE_API_KEY", "VITE_GOOGLE_YOUTUBE_API_KEY", "GOOGLE_YOUTUBE_API_KEY", "YOUTUBE_KEY", "YOUTUBE_API", "YT_API_KEY");

  const resolveGroqEnvKeys = () => {
    const keyCandidates = [
      "VITE_GROQ_API_KEY", "GROQ_API_KEY",
      "VITE_GROQ_API_KEY_1", "GROQ_API_KEY_1",
      "VITE_GROQ_API_KEY_2", "GROQ_API_KEY_2",
      "VITE_GROQ_API_KEY_3", "GROQ_API_KEY_3",
      "VITE_GROQ_API_KEY_4", "GROQ_API_KEY_4"
    ];
    const foundKeys = new Set<string>();
    for (const cand of keyCandidates) {
      const val = env[cand] || (env as any)[cand.toLowerCase()];
      if (typeof val === "string" && val.trim()) {
        foundKeys.add(val.trim());
      }
    }
    console.log(`[GROQ_BACKEND_KEYS_DETECTED] count=${foundKeys.size}`);
    return Array.from(foundKeys);
  };

  const resolveGroqEnvKey = (): string | null => {
    console.log("[GROQ_LEGACY_SINGLE_KEY_WRAPPER_USED]");
    return resolveGroqEnvKeys()[0] || null;
  };

  // Cross-Origin Isolation headers for FFmpeg (SharedArrayBuffer)
  app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    // Ensure Monaco Workers (blob://, data://, or inline eval) do not violate CSP
    res.setHeader(
        "Content-Security-Policy",
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
    );
    next();
  });

  // CRITICAL: Service Worker must be served first and without redirects
  app.get("/coi-serviceworker.js", (req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.sendFile(path.join(process.cwd(), "public", "coi-serviceworker.js"));
  });

  app.get("/aistudio-iframe.js", (req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Content-Type", "application/javascript");
    res.sendFile(path.join(process.cwd(), "public", "aistudio-iframe.js"));
  });

  // Explicitly serve FFmpeg core files with correct headers
  app.get("/ffmpeg-core.js", (req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(path.join(process.cwd(), "public", "ffmpeg-core.js"));
  });

  app.get("/ffmpeg-core.wasm", (req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(path.join(process.cwd(), "public", "ffmpeg-core.wasm"));
  });

  app.get("/ffmpeg-core-mt.js", (req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(path.join(process.cwd(), "public", "ffmpeg-core-mt.js"));
  });

  app.get("/ffmpeg-core-mt.wasm", (req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(path.join(process.cwd(), "public", "ffmpeg-core-mt.wasm"));
  });

  app.get("/ffmpeg-core.worker.js", (req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(path.join(process.cwd(), "public", "ffmpeg-core.worker.js"));
  });

  app.get("/ffmpeg-core-st.js", (req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(path.join(process.cwd(), "public", "ffmpeg-core-st.js"));
  });

  app.get("/ffmpeg-core-st.wasm", (req, res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.sendFile(path.join(process.cwd(), "public", "ffmpeg-core-st.wasm"));
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/gemini/upload/health", (req, res) => {
    const hasGeminiKey = !!resolveGeminiEnvKey();
    console.log(`[UPLOAD_PROXY_HEALTH_REQUEST]\npath=/api/gemini/upload/health\nhasGeminiKey=${hasGeminiKey}`);
    res.json({
      ok: true,
      service: "gemini-upload-proxy",
      endpoint: "/api/gemini/upload",
      method: "POST",
      timestamp: new Date().toISOString(),
      hasGeminiKey
    });
  });

  // Helper to resolve Gemini API key with logging
  function resolveGeminiKey(req: any) {
    const fromRequest = req.body.apiKey || req.query.apiKey;
    const fromEnv = {
      VITE_GEMINI_API_KEY: firstEnvValue("VITE_GEMINI_API_KEY"),
      GEMINI_API_KEY: firstEnvValue("GEMINI_API_KEY"),
      GOOGLE_API_KEY: firstEnvValue("GOOGLE_API_KEY"),
      API_KEY: firstEnvValue("API_KEY")
    };

    let selectedKeySource = "missing";
    let geminiKey = "";

    if (fromRequest) {
      geminiKey = fromRequest;
      selectedKeySource = "req_param";
    } else if (fromEnv.VITE_GEMINI_API_KEY) {
      geminiKey = fromEnv.VITE_GEMINI_API_KEY;
      selectedKeySource = "VITE_GEMINI_API_KEY";
    } else if (fromEnv.GEMINI_API_KEY) {
      geminiKey = fromEnv.GEMINI_API_KEY;
      selectedKeySource = "GEMINI_API_KEY";
    } else if (fromEnv.GOOGLE_API_KEY) {
      geminiKey = fromEnv.GOOGLE_API_KEY;
      selectedKeySource = "GOOGLE_API_KEY";
    } else if (fromEnv.API_KEY) {
      geminiKey = fromEnv.API_KEY;
      selectedKeySource = "API_KEY";
    }

    console.log(`[SERVER_KEY_CHECK]
hasGeminiApiKey=${!!(fromEnv.VITE_GEMINI_API_KEY || fromEnv.GEMINI_API_KEY || fromEnv.GOOGLE_API_KEY || fromEnv.API_KEY)}
selectedKeySource="${selectedKeySource}"`);

    return geminiKey;
  }

  app.post("/api/gemini/upload-smoke", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nessun file caricato" });
      }

      const rawKey = resolveGeminiKey(req);
      const apiKey = rawKey.trim().replace(/^['"]|['"]$/g, "");
      if (!apiKey) {
        return res.status(400).json({ error: "Chiave API mancante nel server" });
      }

      const fileBuffer = req.file.buffer;
      const fileSize = req.file.size;
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;

      console.log(`[SERVER_UPLOAD_SMOKE] Inizio caricamento per ${fileName} (${fileSize} bytes)`);

      const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
      const initResponse = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file: {
            display_name: fileName.substring(0, 30).replace(/[^a-zA-Z0-9.-]/g, '_')
          }
        })
      });

      if (!initResponse.ok) {
        const errText = await initResponse.text();
        console.error(`[SERVER_UPLOAD_SMOKE] Init failed: ${initResponse.status}`, errText);
        return res.status(initResponse.status).json({ error: `Init Google failed: ${errText}` });
      }

      const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
      if (!uploadUrl) {
        return res.status(500).json({ error: "Google non ha restituito X-Goog-Upload-URL" });
      }

      const finalResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize'
        },
        body: fileBuffer
      });

      if (!finalResponse.ok) {
        const errText = await finalResponse.text();
        console.error(`[SERVER_UPLOAD_SMOKE] Final upload failed: ${finalResponse.status}`, errText);
        return res.status(finalResponse.status).json({ error: `Upload Google failed: ${errText}` });
      }

      const responseData: any = await finalResponse.json();
      if (!responseData.file || !responseData.file.uri) {
        console.error(`[SERVER_UPLOAD_SMOKE] Invalid response structure:`, responseData);
        return res.status(500).json({ error: "Struttura risposta Google non valida" });
      }

      console.log(`[SERVER_UPLOAD_SMOKE] Success: ${responseData.file.uri}`);
      res.json({ 
        ok: true,
        fileUri: responseData.file.uri,
        fileName: responseData.file.name,
        mimeType: responseData.file.mimeType || mimeType,
        state: responseData.file.state,
        winningVariant: "SERVER_UPLOAD"
      });

    } catch (error: any) {
      console.error(`[SERVER_UPLOAD_SMOKE] Errore critico:`, error);
      res.status(500).json({ error: "Errore interno durante il caricamento", details: error.message });
    }
  });

  app.post("/api/gemini/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nessun file caricato" });
      }

      // API Key resolution logic
      const rawKey = resolveGeminiKey(req);

      const apiKey = rawKey.trim().replace(/^['"]|['"]$/g, "");
      if (!apiKey) {
        return res.status(400).json({ error: "Chiave API mancante nel server" });
      }

      const fileBuffer = req.file.buffer;
      const fileSize = req.file.size;
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;

      console.log(`[Server Upload] Inizio caricamento per ${fileName} (${fileSize} bytes)`);

      // 1. Initialize resumable upload
      const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
      const initResponse = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file: {
            display_name: fileName.substring(0, 30).replace(/[^a-zA-Z0-9.-]/g, '_')
          }
        })
      });

      if (!initResponse.ok) {
        const errText = await initResponse.text();
        console.error(`[Server Upload] Init failed: ${initResponse.status}`, errText);
        return res.status(initResponse.status).json({ error: `Init Google failed: ${errText}` });
      }

      const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
      if (!uploadUrl) {
        return res.status(500).json({ error: "Google non ha restituito X-Goog-Upload-URL" });
      }

      console.log(`[Server Upload] Session URL: ${uploadUrl.substring(0, 100)}...`);

      // 2. Upload the actual binary data
      const finalResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize'
        },
        body: fileBuffer
      });

      if (!finalResponse.ok) {
        const errText = await finalResponse.text();
        console.error(`[Server Upload] Final upload failed: ${finalResponse.status}`, errText);
        return res.status(finalResponse.status).json({ error: `Upload Google failed: ${errText}` });
      }

      const responseData: any = await finalResponse.json();
      if (!responseData.file || !responseData.file.uri) {
        console.error(`[Server Upload] Invalid response structure:`, responseData);
        return res.status(500).json({ error: "Struttura risposta Google non valida" });
      }

      console.log(`[Server Upload] Success: ${responseData.file.uri}`);
      res.json({ fileUri: responseData.file.uri });

    } catch (error: any) {
      console.error(`[Server Upload] Errore critico:`, error);
      res.status(500).json({ error: "Errore interno durante il caricamento", details: error.message });
    }
  });

  app.get("/api/config-check", (req, res) => {
    const geminiKey = resolveGeminiEnvKey();
    const youtubeKey = resolveYoutubeEnvKey();
    const groqKey = resolveGroqEnvKey();
    const orKey1 = process.env.OPENROUTER_API_KEY || (env as any).VITE_OPENROUTER_API_KEY;
    const orKey2 = process.env.OPENROUTER_API_KEY_2;
    
    res.json({
      geminiKey: !!geminiKey,
      youtubeKey: !!youtubeKey,
      groqKey: resolveGroqEnvKeys().length > 0,
      openRouterKey1: !!orKey1,
      openRouterKey2: !!orKey2
    });
  });

  app.post("/api/groq/chat", async (req, res) => {
    const groqKeys = resolveGroqEnvKeys();
    if (groqKeys.length === 0) {
      return res.status(400).json({ error: "Chiavi Groq mancanti nel server" });
    }

    const { model, messages, temperature, response_format } = req.body;
    let lastError: any = null;

    for (let i = 0; i < groqKeys.length; i++) {
        const groqKey = groqKeys[i];
        console.log(`[GROQ_KEY_SLOT_USED] step=chat slot=${i + 1}`);
        
        try {
            const endpoint = "https://api.groq.com/openai/v1/chat/completions";
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${groqKey}`
                },
                body: JSON.stringify({
                    model: model || "llama-3.3-70b-versatile",
                    messages,
                    temperature: temperature ?? 0.2,
                    response_format
                })
            });

            if (response.ok) {
                console.log(`[GROQ_KEY_ROTATION_SUCCESS] step=chat slot=${i + 1}`);
                return res.json(await response.json());
            }

            const errorText = await response.text().catch(() => "");
            lastError = { status: response.status, errorText };
            console.log(`[GROQ_KEY_SLOT_FAILED] step=chat slot=${i + 1} status=${response.status}`);

            // Determine if we should rotate
            if ([429, 402, 503, 504].includes(response.status) || errorText.toLowerCase().includes("quota") || errorText.toLowerCase().includes("rate limit")) {
                console.log(`[GROQ_KEY_ROTATION_ATTEMPT] step=chat rotating from slot=${i + 1}`);
                continue;
            }
            // Non-recoverable error
            break;
        } catch (error: any) {
             console.error("[GROQ_CHAT_PROXY_ERROR_SLOT]", { slot: i+1, error: error.message });
             lastError = { message: error.message };
             continue; // try next
        }
    }
    
    console.error("[GROQ_ALL_KEYS_FAILED] step=chat");
    return res.status(500).json({
      error: "GROQ_CHAT_PROXY_ERROR",
      details: lastError
    });
  });

  app.post("/api/groq/transcribe", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nessun file audio caricato" });
      }

      const groqKeys = resolveGroqEnvKeys();
      if (groqKeys.length === 0) {
        return res.status(400).json({ error: "Chiavi Groq mancanti nel server" });
      }
      
      let lastError: any = null;
      for (let i = 0; i < groqKeys.length; i++) {
        const groqKey = groqKeys[i];
        console.log(`[GROQ_KEY_SLOT_USED] step=transcribe slot=${i + 1}`);

        const endpoint = "https://api.groq.com/openai/v1/audio/transcriptions";
        const language = typeof req.body?.language === "string" ? req.body.language : "";
        const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
        const model = typeof req.body?.model === "string" && req.body.model.trim()
          ? req.body.model.trim()
          : "whisper-large-v3-turbo";
        const timeoutMs = 60000;
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(new Error("GROQ_TRANSCRIBE_TIMEOUT")), timeoutMs);
        
        const formData = new FormData();
        formData.append("file", new Blob([req.file.buffer], { type: req.file.mimetype || "audio/wav" }), req.file.originalname || "audio-input.wav");
        formData.append("model", model);
        formData.append("response_format", "verbose_json");
        if (language) formData.append("language", language);
        if (prompt) formData.append("prompt", prompt);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${groqKey}`
                },
                body: formData,
                signal: controller.signal
            });

            if (response.ok) {
                console.log(`[GROQ_KEY_ROTATION_SUCCESS] step=transcribe slot=${i + 1}`);
                clearTimeout(timeoutHandle);
                return res.json(await response.json());
            }

            const errorText = await response.text().catch(() => "");
            lastError = { status: response.status, errorText };
            console.log(`[GROQ_KEY_SLOT_FAILED] step=transcribe slot=${i + 1} status=${response.status}`);
            
            clearTimeout(timeoutHandle);

            if ([429, 402, 503, 504].includes(response.status) || errorText.toLowerCase().includes("quota") || errorText.toLowerCase().includes("rate limit")) {
                console.log(`[GROQ_KEY_ROTATION_ATTEMPT] step=transcribe rotating from slot=${i + 1}`);
                continue;
            }
            break;
        } catch (error: any) {
             clearTimeout(timeoutHandle);
             console.error("[GROQ_TRANSCRIBE_PROXY_ERROR_SLOT]", { slot: i+1, error: error.message });
             lastError = { message: error.message };
             continue; // try next
        }
      }

      console.error("[GROQ_ALL_KEYS_FAILED] step=transcribe");
      return res.status(500).json({
        error: "GROQ_ALL_KEYS_FAILED",
        details: lastError
      });
    } catch (error: any) {
      const endpoint = "https://api.groq.com/openai/v1/audio/transcriptions";
      const model = typeof req.body?.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : "whisper-large-v3-turbo";
      const fileName = req.file?.originalname || "audio-input.wav";
      const mimeType = req.file?.mimetype || "audio/wav";
      const sizeBytes = req.file?.size || 0;
      const timeoutMs = 60000;
      const isAbort = error?.name === "AbortError" || String(error?.message || "").includes("GROQ_TRANSCRIBE_TIMEOUT_" + timeoutMs);

      if (isAbort) {
        console.error("[GROQ_TRANSCRIBE_TIMEOUT]", {
          endpoint,
          model,
          sizeBytes,
          mimeType,
          fileName,
          timeoutMs
        });
      }

      console.error("[GROQ_TRANSCRIBE_PROXY_ERROR]", {
        endpoint,
        model,
        hasGroqKey: resolveGroqEnvKeys().length > 0,
        errorName: error?.name || null,
        errorMessage: error?.message || String(error),
        errorCause: error?.cause || null,
        errorStack: error?.stack || null,
        fileName,
        mimeType,
        sizeBytes,
        isTimeout: isAbort
      });
      return res.status(500).json({
        error: "GROQ_TRANSCRIBE_PROXY_ERROR",
        details: error?.message || String(error)
      });
    }
  });

  app.get("/api/file-status", async (req, res) => {
    try {
      const fileUri = req.query.fileUri as string;
      if (!fileUri) return res.status(400).json({ error: "Missing fileUri" });

      let name = fileUri;
      if (fileUri.startsWith('http')) {
        const match = fileUri.match(/files\/[a-zA-Z0-9_-]+/);
        if (match) {
          name = match[0];
        } else {
          name = fileUri.split('/').slice(-2).join('/');
        }
      }
      
      if (!name.startsWith('files/')) {
        name = `files/${name.split('/').pop()}`;
      }

      // API Key resolution (prioritize query param from client)
      const rawKey = resolveGeminiKey(req);

      const activeKey = rawKey.trim().replace(/^['"]|['"]$/g, "");
      const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/${name}?key=${activeKey}`;

      const response = await fetch(fetchUrl);
      
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return res.status(response.status).json({ error: "Failed to fetch status", details: errText });
      }

      const data = await response.json();
      res.json(data);

    } catch (error: any) {
      res.status(500).json({ error: "Errore imprevisto durante il controllo stato", details: error.message });
    }
  });

  // REMOVED: app.post("/api/upload"...) handled directly by client browser to bypass proxy limits

  app.get("/api/config", (req, res) => {
    const geminiKey = resolveGeminiEnvKey();
    const youtubeKey = resolveYoutubeEnvKey();
    const groqKey = resolveGroqEnvKeys()[0];
    const orKey1 = process.env.OPENROUTER_API_KEY || (env as any).VITE_OPENROUTER_API_KEY;
    const orKey2 = process.env.OPENROUTER_API_KEY_2;
    const keyChain = [geminiKey].filter(Boolean);

    res.json({ 
      geminiKey,
      youtubeKey,
      groqKey: !!groqKey,
      keyChain,
      openRouterKey1: !!orKey1,
      openRouterKey2: !!orKey2
    });
  });

  app.get("/api/youtube-metadata", async (req, res) => {
    const url = req.query.url as string;
    const clientApiKey = req.query.key as string;
    if (!url) return res.status(400).json({ error: "Missing URL" });

    // Extract video ID
    const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([^?&]+)/);
    if (!videoIdMatch) return res.status(400).json({ error: "Invalid YouTube URL" });
    const videoId = videoIdMatch[1];

    const apiKey = clientApiKey || resolveYoutubeEnvKey();
    if (!apiKey) return res.status(500).json({ error: "YouTube API Key not configured" });

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`);
      const data = await response.json();
      
      if (data.error) {
        return res.status(500).json({ error: data.error.message || "YouTube API Error" });
      }
      
      if (!data.items || data.items.length === 0) return res.status(404).json({ error: "Video not found" });
      
      const item = data.items[0];
      // Map thumbnails to proxy if needed
      if (item.snippet?.thumbnails?.default?.url) {
        item.snippet.thumbnails.default.url = `/api/proxy-image?url=${encodeURIComponent(item.snippet.thumbnails.default.url)}`;
      }
      
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch metadata" });
    }
  });

  app.get("/api/youtube-search", async (req, res) => {
    const query = req.query.q as string;
    const clientApiKey = req.query.key as string;
    if (!query) return res.status(400).json({ error: "Missing query" });

    const apiKey = clientApiKey || resolveYoutubeEnvKey();
    if (!apiKey) return res.status(500).json({ error: "YouTube API Key not configured" });

    try {
      // 1. Search for videos
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${apiKey}`;
      const searchController = new AbortController();
      const searchTimeout = setTimeout(() => searchController.abort(), 30000);
      const searchResponse = await fetch(searchUrl, { signal: searchController.signal as any });
      const searchData = await searchResponse.json();
      clearTimeout(searchTimeout);

      if (searchData.error) {
        const errorMsg = searchData.error.message || "YouTube Search API Error";
        const isBlocked = errorMsg.toLowerCase().includes('blocked') || errorMsg.toLowerCase().includes('key') || errorMsg.toLowerCase().includes('403');
        
        if (isBlocked) {
          console.warn(`[YouTube Search API Warning] API is blocked: ${errorMsg}`);
        } else {
          console.error(`[YouTube Search API Error] ${errorMsg}`);
        }
        
        return res.status(500).json({ 
          error: errorMsg,
          details: searchData.error,
          isBlocked
        });
      }

      if (!searchData.items || searchData.items.length === 0) {
        return res.json({ items: [] });
      }

      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

      // 2. Get detailed statistics for these videos
      const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
      const statsController = new AbortController();
      const statsTimeout = setTimeout(() => statsController.abort(), 30000);
      const statsResponse = await fetch(statsUrl, { signal: statsController.signal as any });
      const statsData = await statsResponse.json();
      clearTimeout(statsTimeout);

      if (statsData.error) {
        return res.status(500).json({ error: statsData.error.message || "YouTube Stats API Error" });
      }

      const results = statsData.items.map((item: any) => ({
        title: item.snippet.title,
        publishDate: item.snippet.publishedAt,
        views: item.statistics.viewCount,
        likes: item.statistics.likeCount,
        commentCount: item.statistics.commentCount,
        channelName: item.snippet.channelTitle,
        videoLink: `https://www.youtube.com/watch?v=${item.id}`,
        thumbnail: `/api/proxy-image?url=${encodeURIComponent(item.snippet.thumbnails.default.url)}`
      }));

      res.json({ items: results });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return res.status(504).json({ error: "Upstream API timed out" });
      }
      res.status(500).json({ error: error.message || "Failed to perform YouTube search" });
    }
  });

  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("Missing URL");

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Failed to fetch image");

      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);

      // Force COEP-friendly headers
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=86400");

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      res.status(500).send("Error proxying image");
    }
  });

  app.get("/api/diag/groq", async (req, res) => {
      if (resolveGroqEnvKeys().length === 0) {
        return res.json({ provider: 'Groq', status: 'MISSING_KEY', message: 'No key in server environment' });
      }
      const groqKey = resolveGroqEnvKeys()[0];
    const start = Date.now();
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: "health check" }],
          max_tokens: 5
        })
      });
      if (response.ok) {
        return res.json({ provider: 'Groq', status: 'OK', latencyMs: Date.now() - start });
      }
      const err = await response.text();
      return res.json({ provider: 'Groq', status: 'INVALID_KEY', message: err });
    } catch (e: any) {
      return res.json({ provider: 'Groq', status: 'NETWORK_ERROR', message: e.message });
    }
  });

  app.get("/api/diag/huggingface", async (req, res) => {
    const hfApiKey = process.env.HUGGINGFACE_API_KEY || (env as any).VITE_HUGGINGFACE_API_KEY;
    const model = process.env.HF_VISION_MODEL || (env as any).VITE_HF_VISION_MODEL || 'zai-org/GLM-4.5V';
    
    console.log(`[HF_KEY_TEST_START] model=${model}`);
    
    if (!hfApiKey) {
      console.log(`[HF_KEY_TEST_RESULT] status=MISSING_KEY`);
      return res.json({ status: 'MISSING_KEY', model });
    }

    try {
      const startTime = Date.now();
      const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "health check" }],
          max_tokens: 1
        })
      });

      let status = 'OK';
      let message = 'Attiva';

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 401 || response.status === 403) status = 'UNAUTHORIZED';
        else if (errText.includes("credits") || errText.includes("depleted") || response.status === 429 || response.status === 402) status = 'QUOTA_DEPLETED';
        else if (response.status === 404) status = 'MODEL_NOT_FOUND';
        else status = 'ROUTER_ERROR';
        message = errText.substring(0, 100);
      }

      console.log(`[HF_KEY_TEST_RESULT] status=${status} model=${model} latency=${Date.now() - startTime}ms`);
      return res.json({ 
        status, 
        model, 
        message, 
        latencyMs: Date.now() - startTime,
        maskedKey: typeof hfApiKey === 'string' ? `${hfApiKey.substring(0, 3)}...${hfApiKey.substring(hfApiKey.length - 3)}` : 'INVALID'
      });
    } catch (error: any) {
      console.log(`[HF_KEY_TEST_RESULT] status=NETWORK_ERROR error=${error.message}`);
      return res.json({ status: 'NETWORK_ERROR', message: error.message, model });
    }
  });

  app.get("/api/diag/openrouter", async (req, res) => {
    const orApiKey = process.env.OPENROUTER_API_KEY || (env as any).VITE_OPENROUTER_API_KEY;
    
    // Prioritize query param from client, then env, then vite env
    const clientModel = req.query.model as string;
    const rawEnvModel = process.env.OPENROUTER_VISION_MODEL;
    const rawViteEnvModel = (env as any).VITE_OPENROUTER_VISION_MODEL;
    
    let model = clientModel || rawEnvModel || rawViteEnvModel;

    const primaryModel = 'qwen/qwen-2-vl-72b-instruct:free';
    const fallbackModels = [
      'google/learnlm-1.5-pro-experimental:free',
      'meta-llama/llama-3.2-11b-vision-instruct:free',
      'meta-llama/llama-3.2-90b-vision-instruct:free',
      'nvidia/nemotron-nano-12b-v2-vl:free'
    ];

    // If "backend-resolve" or empty, use the internally managed primary model
    if (!model || model === 'nvidia/nemotron-nano-12b-v2-vl:free' || model === 'backend-resolve') {
       model = primaryModel;
    }

    // Force override old/deprecated or problematic models
    if (model === 'qwen/qwen-2-vl-7b-instruct:free' || 
        model === 'wen/qwen-2-vl-7b-instruct:free' || 
        model === 'meta-llama/llama-3.2-11b-vision-instruct:free' || 
        model === 'meta-llama/llama-3.2-11b-vision-instruct' ||
        model === 'qwen/qwen-2-vl-72b-instruct:free' || 
        model === 'qwen/qwen-2.5-vl-7b-instruct:free' ||
        model === 'google/gemini-2.0-flash-exp:free') {
       model = primaryModel;
    }

    const modelsToTry = [model];
    if (model === primaryModel) {
      fallbackModels.forEach(m => {
        if (!modelsToTry.includes(m)) modelsToTry.push(m);
      });
    }

    console.log(`[OPENROUTER_HEALTH_MODEL_RESOLUTION_AUDIT]`, JSON.stringify({
      requestedModelFromHealth: clientModel || 'none',
      envModel: rawEnvModel || null,
      resolvedModel: model,
      modelsToTry,
      source: clientModel ? 'query' : (rawEnvModel ? 'env' : (rawViteEnvModel ? 'vite' : 'default'))
    }));

    console.log(`[OPENROUTER_KEY_TEST_START] model=${model}`);

    if (!orApiKey) {
      console.log(`[OPENROUTER_KEY_TEST_RESULT] status=MISSING_KEY`);
      return res.json({ status: 'MISSING_KEY', model });
    }

    try {
      const startTime = Date.now();
      let status = 'UNKNOWN';
      let message = '';
      let latencyMs = 0;
      let finalUsedModel = '';

      // We try the models in the fallback chain until one works or we exhaust them
      for (const currentModel of modelsToTry) {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${orApiKey}`,
            "Content-Type": "application/json",
            "X-Title": "Viral Video Engine Diag"
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [{ role: "user", content: "health check" }],
            max_tokens: 1
          })
        });

        finalUsedModel = currentModel;
        latencyMs = Date.now() - startTime;

        if (response.ok) {
          status = 'OK';
          message = 'Attiva';
          break; // Success!
        } else {
          const errText = await response.text();
          if (response.status === 401 || response.status === 403) {
            status = 'UNAUTHORIZED';
            message = 'API_KEY_INVALID';
            break; // No point in trying other models
          } else if (response.status === 429) {
            status = 'RATE_LIMIT';
            message = 'RATE_LIMIT_429';
            // Could try next model if it's a per-model limit, but usually it's per-key
          } else if (response.status === 404 || errText.includes("not found") || errText.includes("not a valid model ID")) {
            status = 'MODEL_NOT_FOUND';
            message = `MODEL_NOT_FOUND: ${currentModel}`;
            continue; // Try next one
          } else if (response.status === 413) {
            status = 'PAYLOAD_TOO_LARGE';
            message = 'PAYLOAD_TOO_LARGE';
            break;
          } else {
            status = 'ERROR';
            message = `Status ${response.status}: ${errText.substring(0, 50)}`;
          }
        }
      }

      console.log(`[OPENROUTER_KEY_TEST_RESULT] status=${status} model=${finalUsedModel} latency=${latencyMs}ms`);
      return res.json({ 
        status, 
        model: finalUsedModel, 
        message, 
        latencyMs,
        maskedKey: typeof orApiKey === 'string' ? `sk-or-...${orApiKey.substring(orApiKey.length - 4)}` : 'INVALID'
      });
    } catch (error: any) {
      console.log(`[OPENROUTER_KEY_TEST_RESULT] status=NETWORK_ERROR error=${error.message}`);
      return res.json({ status: 'NETWORK_ERROR', message: error.message, model });
    }
  });

  app.post("/api/huggingface/chat", async (req, res) => {
    console.log(`[HF_PROXY_INBOUND] path=/api/huggingface/chat method=POST`);
    const { model, messages, max_tokens, apiKey: clientApiKey } = req.body;
    
    const hfApiKey = clientApiKey || process.env.HUGGINGFACE_API_KEY || (env as any).VITE_HUGGINGFACE_API_KEY;
    
    if (!hfApiKey) {
      return res.status(400).json({ error: "Hugging Face API Key missing in backend" });
    }

    const msgString = JSON.stringify(messages);
    const hasImages = msgString.includes('image_url');
    const frameCount = (msgString.match(/image_url/g) || []).length;
    const payloadSizeKB = Math.round(Buffer.byteLength(msgString) / 1024);

    const keySource = clientApiKey ? 'externalApiKey' : (process.env.HUGGINGFACE_API_KEY ? 'HUGGINGFACE_API_KEY' : ((env as any).VITE_HUGGINGFACE_API_KEY ? 'VITE_HUGGINGFACE_API_KEY' : 'missing'));
    const keyMask = typeof hfApiKey === 'string' ? `${hfApiKey.substring(0, 3)}...${hfApiKey.substring(hfApiKey.length - 3)}` : 'none';
    console.log(`[HF_KEY_SOURCE_AUDIT] caller=backend_proxy keySource=${keySource} keyMask=${keyMask}`);
    console.log(`[HF_ACCOUNT_ROUTE_AUDIT] endpoint=/api/huggingface/chat router=https://router.huggingface.co/v1/chat/completions task=${hasImages ? 'vision' : 'text'} model=${model} keySource=${keySource} keyMask=${keyMask}`);

    console.log(`[HF_ROUTER_REQUEST_START] endpoint=https://router.huggingface.co/v1/chat/completions model=${model} hasImages=${hasImages} frameCount=${frameCount} payloadSizeKB=${payloadSizeKB}`);
    console.log(`[HF_ROUTER_AUTH_CHECK] hasKey=${!!hfApiKey} keyHint=${(typeof hfApiKey === 'string' && hfApiKey.length > 8) ? (hfApiKey.substring(0, 4) + '...' + hfApiKey.substring(hfApiKey.length - 4)) : 'SHORT_OR_EMPTY'}`);

    try {
      const startTime = Date.now();
      const hfResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: max_tokens || 1500
        })
      });

      const durationMs = Date.now() - startTime;
      const contentType = hfResponse.headers.get("content-type") || "";
      const xUnits = hfResponse.headers.get("x-inference-units-remaining") || hfResponse.headers.get("x-inference-remaining") || "UNKNOWN";

      console.log(`[HF_ROUTER_RESPONSE_STATUS] status=${hfResponse.status} contentType=${contentType} durationMs=${durationMs} unitsRemaining=${xUnits}`);

      if (!hfResponse.ok) {
        const errText = await hfResponse.text();
        
        let isDepleted = errText.includes("credits") || errText.includes("depleted") || hfResponse.status === 429 || hfResponse.status === 402;
        
        if (isDepleted) {
          console.log(`[HF_VISION_CREDITS_DEPLETED_EXPECTED_FALLBACK] status=${hfResponse.status}`);
        } else {
          console.log(`[HF_ROUTER_EXPECTED_BEHAVIOR] status=${hfResponse.status}`);
        }
        
        let errorMsg = "Hugging Face Router error";
        if (isDepleted) {
          errorMsg = "Hugging Face Credits Depleted (402)";
        }

        return res.status(hfResponse.status).json({ 
          error: errorMsg, 
          details: errText.substring(0, 500) 
        });
      }

      const data = await hfResponse.json();
      res.json(data);
    } catch (error: any) {
      console.error(`[HF_ROUTER_EXCEPTION]`, error);
      res.status(500).json({ error: "Internal Server Error during HF proxy", details: error.message });
    }
  });

  app.post("/api/huggingface/audio", async (req, res) => {
    const { model, inputs, apiKey: clientApiKey } = req.body;
    const hfApiKey = clientApiKey || process.env.HUGGINGFACE_API_KEY || (env as any).VITE_HUGGINGFACE_API_KEY;
    
    if (!hfApiKey) {
      return res.status(400).json({ error: "Hugging Face API Key missing in backend" });
    }

    const audioModel = model || "openai/whisper-large-v3-turbo";
    const endpoint = `https://router.huggingface.co/hf-inference/models/${audioModel}`;

    const keySource = clientApiKey ? 'externalApiKey' : (process.env.HUGGINGFACE_API_KEY ? 'HUGGINGFACE_API_KEY' : ((env as any).VITE_HUGGINGFACE_API_KEY ? 'VITE_HUGGINGFACE_API_KEY' : 'missing'));
    const keyMask = typeof hfApiKey === 'string' ? `${hfApiKey.substring(0, 3)}...${hfApiKey.substring(hfApiKey.length - 3)}` : 'none';
    console.log(`[HF_KEY_SOURCE_AUDIT] caller=backend_proxy keySource=${keySource} keyMask=${keyMask}`);
    console.log(`[HF_ACCOUNT_ROUTE_AUDIT] endpoint=/api/huggingface/audio router=${endpoint} task=audio model=${audioModel} keySource=${keySource} keyMask=${keyMask}`);

    console.log(`[HF_AUDIO_ROUTER_REQUEST_START] endpoint=${endpoint} contentType=application/json payloadType=json_base64_clean`);
    console.log(`[HF_AUDIO_AUTH_CHECK] hasKey=${!!hfApiKey} keyHint=${(typeof hfApiKey === 'string' && hfApiKey.length > 8) ? (hfApiKey.substring(0, 4) + '...' + hfApiKey.substring(hfApiKey.length - 4)) : 'SHORT_OR_EMPTY'}`);

    try {
      const startTime = Date.now();
      const hfResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs,
          parameters: { return_timestamps: false }
        })
      });

      const durationMs = Date.now() - startTime;
      const xUnits = hfResponse.headers.get("x-inference-units-remaining") || hfResponse.headers.get("x-inference-remaining") || "UNKNOWN";
      console.log(`[HF_AUDIO_RESPONSE_STATUS] status=${hfResponse.status} durationMs=${durationMs} unitsRemaining=${xUnits}`);

      if (!hfResponse.ok) {
        const errText = await hfResponse.text();
        
        let isDepleted = errText.includes("credits") || errText.includes("depleted") || hfResponse.status === 429 || hfResponse.status === 402;
        
        if (isDepleted) {
          console.log(`[HF_AUDIO_CREDITS_DEPLETED] status=${hfResponse.status} details=${errText.substring(0, 200)}`);
        } else {
          console.error(`[HF_AUDIO_ROUTER_ERROR] status=${hfResponse.status} details=${errText.substring(0, 500)}`);
        }
        
        let errorMsg = "HF Audio Error";
        if (isDepleted) {
          errorMsg = "Hugging Face Credits Depleted (402/Audio)";
        }

        return res.status(hfResponse.status).json({ error: errorMsg, details: errText });
      }

      const data = await hfResponse.json();
      res.json(data);
    } catch (error: any) {
      console.error(`[HF_AUDIO_ROUTER_EXCEPTION]`, error);
      res.status(500).json({ error: "Internal Server Error during HF audio proxy", details: error.message });
    }
  });

  app.get("/api/debug/keys", (req, res) => {
    const orKey1 = process.env.OPENROUTER_API_KEY || (env as any).VITE_OPENROUTER_API_KEY;
    const orKey2 = process.env.OPENROUTER_API_KEY_2;
    res.json({
      openRouterKey1: !!orKey1,
      openRouterKey2: !!orKey2
    });
  });

  app.post("/api/openrouter/chat", async (req, res) => {
    let { model: clientModel, messages, frameCount, newVisorMode, disableVisionFallbackChain, forceModel } = req.body;
    const safeMessages = Array.isArray(messages) ? messages : [];
    const msgString = JSON.stringify(safeMessages || []);
    const messageImageCount = (msgString.match(/image_url|data:image\//g) || []).length;
    const contentItems = safeMessages.flatMap((message: any) => Array.isArray(message?.content) ? message.content : []);
    const imageItems = contentItems.filter((item: any) => item?.type === 'image_url');
    const firstImageUrl = String(imageItems[0]?.image_url?.url || "");
    const messagesContentShape = safeMessages.map((message: any, index: number) => ({
      index,
      role: String(message?.role || ""),
      contentType: Array.isArray(message?.content) ? "array" : typeof message?.content,
      contentItemTypes: Array.isArray(message?.content)
        ? message.content.map((item: any) => String(item?.type || typeof item))
        : []
    }));
    const imagePayloadLengths = imageItems.map((item: any) => String(item?.image_url?.url || "").length).filter((len: number) => Number.isFinite(len) && len > 0);
    const averageImagePayloadApproxKb = imagePayloadLengths.length > 0
      ? Math.round((imagePayloadLengths.reduce((sum: number, len: number) => sum + len, 0) / imagePayloadLengths.length) / 1024)
      : 0;
    const inferredInputMode = imageItems.length > 0 ? "frames_only" : (msgString.includes("video_url") || msgString.includes("video/mp4") ? "video_url" : "unknown");
    console.log("[OPENROUTER_SERVER_RECEIVED_FRAME_COUNT]", {
      frameCount,
      messageImageCount,
      runtimePatchId: "FORCE_10_FRAMES_2026_05_13"
    });
    console.log("[OPENROUTER_BACKEND_PAYLOAD_SHAPE_AUDIT]", JSON.stringify({
      messagesCount: safeMessages.length,
      frameCountFromBody: frameCount ?? null,
      imageUrlCount: imageItems.length,
      firstImagePrefix: firstImageUrl.slice(0, 32),
      firstImageLength: firstImageUrl.length,
      messagesContentShape,
      averageImagePayloadApproxKb
    }));
    console.log("[OPENROUTER_BACKEND_IMAGE_CONTENT_AUDIT]", JSON.stringify({
      imageUrlCount: imageItems.length,
      hasDataImageJpeg: firstImageUrl.startsWith("data:image/jpeg;base64,"),
      firstImageLooksValid: firstImageUrl.startsWith("data:image/") && firstImageUrl.includes(";base64,"),
      firstImagePrefix: firstImageUrl.slice(0, 32)
    }));

    if (!Array.isArray(messages) || messages.length === 0 || imageItems.length === 0) {
      console.log("[OPENROUTER_BACKEND_BAD_REQUEST_NO_IMAGES]", JSON.stringify({
        hasMessagesArray: Array.isArray(messages),
        messagesCount: Array.isArray(messages) ? messages.length : 0,
        imageUrlCount: imageItems.length,
        reason: "MISSING_MESSAGES_OR_IMAGE_URLS"
      }));
      return res.status(200).json({
        ok: false,
        visionStatus: "OPENROUTER_BAD_REQUEST_NO_IMAGES",
        reason: "MISSING_MESSAGES_OR_IMAGE_URLS",
        frameObservations: [],
        detectedCharacters: [],
        visualCastCount: 0
      });
    }
    
    let finalModel = clientModel;
    let source = 'client';
    
    // Treat undefined, empty string, 'backend-resolve', or the old hardcoded nvidia model as needing full backend resolution
    let isBackendResolve = !clientModel || clientModel === 'backend-resolve' || clientModel === 'nvidia/nemotron-nano-12b-v2-vl:free';

    const rawEnvModel = process.env.OPENROUTER_VISION_MODEL;
    const rawViteEnvModel = (env as any).VITE_OPENROUTER_VISION_MODEL;

    const oldPrimaryModelFrames = 'qwen/qwen-2-vl-72b-instruct:free';
    const primaryModelFrames = 'qwen/qwen2.5-vl-72b-instruct';
    const fallbackModelFrames = 'nvidia/nemotron-nano-12b-v2-vl:free';
    const primaryModelVideo = 'nvidia/nemotron-nano-12b-v2-vl:free';
    const removedFrameModels = [
      'qwen/qwen-2-vl-72b-instruct:free',
      'meta-llama/llama-3.2-11b-vision-instruct:free',
      'meta-llama/llama-3.2-90b-vision-instruct:free'
    ];
    const fullCandidateChain = inferredInputMode === "frames_only"
      ? [
          primaryModelFrames,
          fallbackModelFrames
        ]
      : [
          primaryModelVideo,
          'qwen/qwen-2-vl-72b-instruct:free',
          'meta-llama/llama-3.2-11b-vision-instruct:free',
          'meta-llama/llama-3.2-90b-vision-instruct:free'
        ];
    const maxVisionModelAttempts = Math.max(1, Number(process.env.OPENROUTER_MAX_VISION_MODEL_ATTEMPTS || 2));

    // 1. Resolve model from backend if frontend sends 'backend-resolve' or undefined or old legacy
    if (isBackendResolve) {
      const envPref = rawEnvModel || rawViteEnvModel;
      if (envPref && envPref !== 'backend-resolve' && !(inferredInputMode === "frames_only" && envPref.startsWith('nvidia/'))) {
          finalModel = envPref;
          source = rawEnvModel ? 'OPENROUTER_VISION_MODEL' : 'VITE_OPENROUTER_VISION_MODEL';
      } else {
          finalModel = inferredInputMode === "frames_only" ? primaryModelFrames : primaryModelVideo;
          source = 'backend-input-mode-policy';
      }
    }

    // Normalize model name for common typos or legacy IDs
    if (finalModel && typeof finalModel === 'string') {
      finalModel = finalModel.trim();
      if (finalModel.startsWith('wen/')) {
        const old = finalModel;
        finalModel = finalModel.replace('wen/', 'qwen/');
        console.log(`[MODEL_TYPO_FIXED] ${old} -> ${finalModel}`);
      }
      // Explicitly block the invalid model mentioned in the audit
      if (finalModel.includes('qwen-2-vl-7b-instruct:free')) {
        console.log(`[INVALID_FALLBACK_REMOVED] ${finalModel} -> ${primaryModelFrames}`);
        finalModel = primaryModelFrames;
      }
      // Normalize Qwen 2.5 dash
      if (finalModel === 'qwen/qwen-2.5-vl-72b-instruct' || finalModel === 'qwen/qwen2.5-vl-72b-instruct') {
         // Standardize to the most reliable one (usually qwen/qwen2.5-vl-72b-instruct or qwen/qwen-2.5-vl-72b-instruct)
         // Based on previous logs, the qwen2.5 (no dash in 2.5) reached OpenRouter but hit token limits.
         finalModel = 'qwen/qwen2.5-vl-72b-instruct'; 
      }
    }
    
    // Update body for downstream JSON usage
    const requestModel = finalModel;

    const keySlot = typeof req.body.keySlot === 'number' ? req.body.keySlot : 0;
    const orKey1 = (process.env.OPENROUTER_API_KEY || (env as any).VITE_OPENROUTER_API_KEY || "").trim();
    let orKey2Raw = (process.env.OPENROUTER_API_KEY_2 || "").trim();
    if (orKey2Raw === "undefined" || orKey2Raw === "null") orKey2Raw = "";
    const orKey2 = orKey2Raw;

    // Determine which key to use based on keySlot, but allow client-provided key as override
    let openRouterApiKey = typeof req.body.openRouterApiKey === 'string' ? req.body.openRouterApiKey.trim() : "";
    if (openRouterApiKey === "undefined" || openRouterApiKey === "null") openRouterApiKey = "";
    let effectiveKeySlot = 0;

    if (!openRouterApiKey) {
      if (keySlot === 1 && orKey2) {
        openRouterApiKey = orKey2;
        effectiveKeySlot = 1;
      } else {
        openRouterApiKey = orKey1;
        effectiveKeySlot = 0;
      }
    } else {
      // If client provided a key, we treat it as an external slot
      effectiveKeySlot = -1;
    }
      
    const keySource = req.body.openRouterApiKey ? 'openRouterApiKey_client' 
      : (effectiveKeySlot === 1 ? 'OPENROUTER_API_KEY_2' 
      : (process.env.OPENROUTER_API_KEY ? 'OPENROUTER_API_KEY' 
      : ((env as any).VITE_OPENROUTER_API_KEY ? 'VITE_OPENROUTER_API_KEY' : 'missing')));
      
    const safeKey = typeof openRouterApiKey === 'string' ? openRouterApiKey : '';
    const keyMask = safeKey ? `sk-or-...${safeKey.substring(safeKey.length - 4)}` : 'none';
    
    console.log(`[OPENROUTER_KEY_SOURCE_AUDIT] keySource=${keySource} keyMask=${keyMask} requestedSlot=${keySlot} effectiveSlot=${effectiveKeySlot}`);

    const slots = [orKey1, orKey2].filter(Boolean).length;

    console.log(`[OPENROUTER_VISION_KEYS_AVAILABLE_AUDIT]
primaryKeyAvailable: ${!!orKey1}
secondaryKeyAvailable: ${!!orKey2}
keySlotsAvailable: ${slots}
keySlotUsed: ${effectiveKeySlot}`);

    if (!openRouterApiKey) {
      return res.status(401).json({ error: "OPENROUTER_UNAUTHORIZED" });
    }

    if (!requestModel || requestModel === 'none') {
      console.log(`[OPENROUTER_VISION_MODEL_AUDIT] model=missing configured=false`);
      return res.status(400).json({ error: "OPENROUTER_VISION_MODEL_UNAVAILABLE" });
    }
    
    console.log(`[OPENROUTER_VISION_MODEL_AUDIT] finalModel=${requestModel} configured=true`);

    const preferredPrimary = inferredInputMode === "frames_only" ? primaryModelFrames : primaryModelVideo;
    const nvidiaAllowedInThisMode = inferredInputMode !== "frames_only";
    
    let modelsToTry: string[] = [];
    let skippedModels: string[] = [];
    let orderedCandidateChain: string[] = [];

    if (newVisorMode === true || disableVisionFallbackChain === true || forceModel === true) {
      modelsToTry = [clientModel || requestModel];
      
      console.log("[NEW_VISOR_FORCE_MODEL_ENABLED]", { model: modelsToTry[0] });
      console.log("[NEW_VISOR_BACKEND_DIRECT_MODEL]", { requestModel: modelsToTry[0] });
      console.log("[NEW_VISOR_FALLBACK_CHAIN_DISABLED]");
      console.log("[NEW_VISOR_QWEN_BYPASS_CONFIRMED]");
    } else {
      orderedCandidateChain = [
        requestModel,
        preferredPrimary,
        ...fullCandidateChain
      ].filter((modelId: string, index: number, arr: string[]) => {
        const normalized = String(modelId || "").trim();
        return normalized && arr.findIndex((entry) => String(entry || "").trim() === normalized) === index;
      }).sort((left: string, right: string) => {
        if (inferredInputMode !== "frames_only") return 0;
        const rank = (modelId: string) => {
          if (modelId === primaryModelFrames) return 0;
          if (modelId === 'meta-llama/llama-3.2-11b-vision-instruct:free') return 1;
          if (modelId === 'meta-llama/llama-3.2-90b-vision-instruct:free') return 2;
          if (modelId.startsWith('nvidia/')) return 99;
          return 10;
        };
        return rank(left) - rank(right);
      });
      modelsToTry = orderedCandidateChain.slice(0, maxVisionModelAttempts);
      skippedModels = orderedCandidateChain.slice(modelsToTry.length);

      console.log("[OPENROUTER_BACKEND_INPUT_MODE_MODEL_POLICY]", JSON.stringify({
        inputMode: inferredInputMode,
        selectedPrimaryModel: modelsToTry[0] || null,
        reason: inferredInputMode === "frames_only" ? "frame_only_prefers_image_vision_model" : "video_mode_allows_nvidia",
        nvidiaAllowedInThisMode,
        quotaProtectionEnabled: true
      }));
      console.log("[OPENROUTER_BACKEND_MODEL_CHAIN_BUILT]", JSON.stringify({
        fullCandidateChain: orderedCandidateChain,
        selectedChainForThisRun: modelsToTry,
        skippedDueToQuotaProtection: skippedModels,
        inputMode: inferredInputMode
      }));
      console.log("[OPENROUTER_BACKEND_QUOTA_PROTECTION_APPLIED]", JSON.stringify({
        maxAttempts: maxVisionModelAttempts,
        modelsSelectedForThisRun: modelsToTry,
        skippedModels,
        reason: "free_quota_protection"
      }));
    }

    let defaultVisionMaxTokens = 6000;
    if (newVisorMode === true) {
      defaultVisionMaxTokens = 4000;
      console.log(`[NEW_VISOR_MAX_TOKENS_CLAMP_APPLIED] Clamped default max_tokens to ${defaultVisionMaxTokens} to prevent OpenRouter 402 errors`);
    }

    const clampMin = 1000;
    const clampMax = 8192;
    const rawVisionMaxTokensEnv = process.env.OPENROUTER_VISION_MAX_TOKENS || (env as any).OPENROUTER_VISION_MAX_TOKENS;
    const parsedVisionMaxTokensEnv = Number(rawVisionMaxTokensEnv);
    const resolvedVisionMaxTokens = Number.isFinite(parsedVisionMaxTokensEnv) && parsedVisionMaxTokensEnv > 0
      ? parsedVisionMaxTokensEnv
      : defaultVisionMaxTokens;
    const appliedVisionMaxTokens = Math.min(clampMax, Math.max(clampMin, resolvedVisionMaxTokens));
    const appliedMaxTokens = inferredInputMode === "frames_only" ? appliedVisionMaxTokens : 65536;
    console.log("[OPENROUTER_BACKEND_MAX_TOKENS_POLICY]", JSON.stringify({
      inputMode: inferredInputMode,
      model: modelsToTry[0] || requestModel || null,
      envValue: rawVisionMaxTokensEnv || null,
      defaultValue: defaultVisionMaxTokens,
      appliedMaxTokens,
      clampMin,
      clampMax,
      frameCount: frameCount ?? imageItems.length,
      reason: inferredInputMode === "frames_only"
        ? "stable_final_budget_for_future_growth_without_overshooting_openrouter_affordability"
        : "default_policy"
    }));

    console.log(`[OPENROUTER_VISION_MODEL_RESOLUTION_AUDIT]`, JSON.stringify({
      clientModelOriginal: clientModel || null,
      envModelOriginal: rawEnvModel || rawViteEnvModel || null,
      configuredModel: requestModel || null,
      selectedModel: modelsToTry[0] || null,
      selectedPrimaryModel: inferredInputMode === "frames_only" ? primaryModelFrames : (modelsToTry[0] || null),
      selectedFallbackModel: inferredInputMode === "frames_only" ? fallbackModelFrames : null,
      removedModels: inferredInputMode === "frames_only" ? removedFrameModels : [],
      costProtection: inferredInputMode === "frames_only" ? "max_10_frames_max_1_call_max_2_attempts" : null,
      oldPrimaryModel: inferredInputMode === "frames_only" ? oldPrimaryModelFrames : null,
      resolvedModel: finalModel,
      modelsToTry,
      source: inferredInputMode === "frames_only" && source === 'backend-input-mode-policy'
        ? "mini_app_verified_model"
        : "default_model_chain",
      reason: inferredInputMode === "frames_only" && source === 'backend-input-mode-policy'
        ? "previous_models_returned_404_and_account_activity_confirms_qwen25vl_and_nemotron_free_work"
        : "Standard resolution path"
    }));

    console.log(`[OPENROUTER_VISION_FALLBACK_START] model="${modelsToTry[0]}" frameCount=${frameCount} maxCallsPerVideo=1`);

    let lastErrorStatus = 500;
    let lastErrorText = "Unknown error";
    let lastErrorMsg = "OpenRouter Error";
    const modelsTried: string[] = [];

    for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        modelsTried.push(currentModel);
        
        if (i > 0) {
            console.log(`[OPENROUTER_VISION_FALLBACK_SWITCH]`, JSON.stringify({
                fromModel: modelsToTry[i-1],
                toModel: currentModel,
                reason: "MODEL_UNAVAILABLE_OR_ERROR"
            }));
        }

        try {
            console.log("[OPENROUTER_BACKEND_FALLBACK_MODEL_ATTEMPT]", JSON.stringify({
                index: i + 1,
                totalSelectedAttempts: modelsToTry.length,
                model: currentModel,
                timeoutMs: 25000,
                inputMode: inferredInputMode
            }));
            const startTime = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log(`[OPENROUTER_BACKEND_MODEL_TIMEOUT] model=${currentModel}`);
                controller.abort();
            }, 25000);

            let orResponse: any;
            try {
              orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                  "Authorization": `Bearer ${openRouterApiKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": env.APP_URL || process.env.APP_URL || "https://ais-dev-x.run.app",
                  "X-Title": "Viral Video Engine"
                  },
                  body: JSON.stringify({
                  model: currentModel,
                  messages,
                  max_tokens: appliedMaxTokens,
                  response_format: { type: "json_object" }
                  }),
                  signal: controller.signal
              });
            } catch (err: any) {
              if (err.name === 'AbortError') {
                throw new Error("TIMEOUT");
              }
              throw err;
            } finally {
              clearTimeout(timeoutId);
            }

            const durationMs = Date.now() - startTime;
            console.log(`[OPENROUTER_RESPONSE_STATUS] model=${currentModel} status=${orResponse.status} durationMs=${durationMs}`);
            console.log("[OPENROUTER_BACKEND_HTTP_STATUS]", JSON.stringify({
                model: currentModel,
                status: orResponse.status,
                ok: orResponse.ok,
                durationMs
            }));

            if (!orResponse.ok) {
                let errText = await orResponse.text();
                console.log(`[OPENROUTER_ERROR_EXPECTED] model=${currentModel} err=${errText}`);
                
                // If it is a 402 token limit/credit limit error where they can afford fewer tokens, perform dynamic retry!
                if (orResponse.status === 402 || errText.includes("fewer max_tokens") || errText.includes("credit") || errText.includes("afford")) {
                  console.log(`[OPENROUTER_402_INTERCEPT] Intercepted 402 error: ${errText}`);
                  let lastAttemptTokens = appliedMaxTokens;
                  
                  // We can do up to 2 retries with progressively lower max_tokens
                  for (let retryAttempt = 1; retryAttempt <= 2; retryAttempt++) {
                    let retryMaxTokens = 3500; // safe default fallback
                    try {
                      const parsedErr = JSON.parse(errText);
                      const errMsg = parsedErr?.error?.message || "";
                      const affordMatch = errMsg.match(/can only afford\s+(\d+)/i);
                      if (affordMatch && affordMatch[1]) {
                        const affordTokens = parseInt(affordMatch[1], 10);
                        // Be conservative: subtract 400 or take 85% of it, whichever is lower to prevent hitting close boundary
                        const safeAfford = Math.floor(affordTokens * 0.85);
                        retryMaxTokens = Math.max(clampMin, Math.min(affordTokens - 400, safeAfford));
                        // If it is the second retry attempt, go even lower to ensure it fits
                        if (retryAttempt === 2) {
                          retryMaxTokens = Math.max(clampMin, Math.floor(retryMaxTokens * 0.7));
                        }
                        console.log(`[OPENROUTER_402_AFFORD] Attempt ${retryAttempt}: Parsed afford ${affordTokens}. Setting retry max_tokens to ${retryMaxTokens}`);
                      } else {
                        retryMaxTokens = Math.max(clampMin, Math.min(3000, Math.floor(lastAttemptTokens / 2)));
                        if (retryAttempt === 2) {
                          retryMaxTokens = clampMin;
                        }
                        console.log(`[OPENROUTER_402_AFFORD_NO_MATCH] Attempt ${retryAttempt}: Using generic retry max_tokens: ${retryMaxTokens}`);
                      }
                    } catch (e) {
                      retryMaxTokens = Math.max(clampMin, Math.min(3000, Math.floor(lastAttemptTokens / 2)));
                      if (retryAttempt === 2) {
                        retryMaxTokens = clampMin;
                      }
                      console.log(`[OPENROUTER_402_AFFORD_PARSE_ERROR] Attempt ${retryAttempt}: Setting fallback retry max_tokens: ${retryMaxTokens}`);
                    }

                    if (retryMaxTokens >= lastAttemptTokens) {
                      // If we are not actually reducing tokens, force decrease it to be safe
                      retryMaxTokens = Math.max(clampMin, Math.floor(lastAttemptTokens * 0.7));
                    }

                    console.log(`[OPENROUTER_402_RETRY_SUBMIT] Attempt ${retryAttempt}: Retrying now with max_tokens=${retryMaxTokens}...`);
                    const retryController = new AbortController();
                    const retryTimeoutId = setTimeout(() => {
                        retryController.abort();
                    }, 25000);
                    
                    try {
                      const retryResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                          "Authorization": `Bearer ${openRouterApiKey}`,
                          "Content-Type": "application/json",
                          "HTTP-Referer": env.APP_URL || process.env.APP_URL || "https://ais-dev-x.run.app",
                          "X-Title": "Viral Video Engine"
                        },
                        body: JSON.stringify({
                          model: currentModel,
                          messages,
                          max_tokens: retryMaxTokens,
                          response_format: { type: "json_object" }
                        }),
                        signal: retryController.signal
                      });
                      
                      if (retryResponse.ok) {
                        console.log(`[OPENROUTER_402_RETRY_SUCCESS] Attempt ${retryAttempt}: Dynamically adjusted max_tokens retry succeeded!`);
                        orResponse = retryResponse;
                        errText = "";
                        break; // Succeeded! Break the retry loop.
                      } else {
                        errText = await retryResponse.text();
                        console.log(`[OPENROUTER_402_RETRY_FAILED] Attempt ${retryAttempt}: Retry response was not-ok (${retryResponse.status}): ${errText}`);
                        orResponse = retryResponse;
                        lastAttemptTokens = retryMaxTokens;
                        
                        // If it's not a 402, don't bother retrying again
                        const isStill402 = retryResponse.status === 402 || errText.includes("fewer max_tokens") || errText.includes("credit") || errText.includes("afford");
                        if (!isStill402) {
                          break;
                        }
                      }
                    } catch (retryFetchErr: any) {
                      console.error(`[OPENROUTER_402_RETRY_FETCH_CRASH] Attempt ${retryAttempt}:`, retryFetchErr);
                      break;
                    } finally {
                      clearTimeout(retryTimeoutId);
                    }
                  }
                }

                if (!orResponse.ok) {
                    lastErrorStatus = orResponse.status;
                    lastErrorText = errText;
                    
                    let errorMsg = "OpenRouter Error";
                    if (orResponse.status === 401 || orResponse.status === 403) {
                      errorMsg = "API_KEY_INVALID";
                    }
                    else if (orResponse.status === 429) {
                        if (errText.includes("limit") || errText.includes("quota") || errText.includes("depleted")) {
                        errorMsg = "OPENROUTER_CREDITS_DEPLETED";
                        } else {
                        errorMsg = "RATE_LIMIT_429";
                        }
                    }
                    else if (orResponse.status === 413) {
                      errorMsg = "OPENROUTER_PAYLOAD_TOO_LARGE";
                    }
                    else if (orResponse.status === 404 || (orResponse.status === 400 && (errText.includes("not found") || errText.includes("not a valid model ID")))) {
                      errorMsg = "MODEL_NOT_FOUND";
                    }

                    lastErrorMsg = errorMsg;

                    if (newVisorMode === true || disableVisionFallbackChain === true) {
                        console.log(`[NEW_VISOR_GEMINI_FLASH_ERROR]`, JSON.stringify({
                            model: currentModel,
                            errorStatus: orResponse.status,
                            errorMessage: errorMsg,
                            fullError: errText,
                            action: "fail_immediately"
                        }));
                    } else {
                        console.log(`[OPENROUTER_VISION_MODEL_AVAILABILITY_AUDIT]`, JSON.stringify({
                            model: currentModel,
                            available: false,
                            errorStatus: orResponse.status,
                            errorMessage: errorMsg,
                            fullError: errText,
                            action: "retry_next"
                        }));
                    }
                    
                    if (errorMsg === "API_KEY_INVALID") {
                        break;
                    }
                    if (i < modelsToTry.length - 1) {
                        console.log("[OPENROUTER_BACKEND_FALLBACK_NEXT_MODEL]", JSON.stringify({
                            failedModel: currentModel,
                            nextModel: modelsToTry[i + 1],
                            reason: errorMsg,
                            remainingAttempts: modelsToTry.length - (i + 1)
                        }));
                    }
                    continue; // Try next model
                }
            }

            // Success
            const data = await orResponse.json();
            
            // Re-inject the model that succeeded so the client knows
            if (data) data.resolved_model = currentModel;

            const rawContent = data?.choices?.[0]?.message?.content;
            const contentType = Array.isArray(rawContent) ? "array" : typeof rawContent;
            const contentString = Array.isArray(rawContent)
              ? rawContent.map((item: any) => typeof item?.text === "string" ? item.text : "").join("\n").trim()
              : String(rawContent || "");
            const contentPreview = contentString.slice(0, 1200);
            const hasChoices = Array.isArray(data?.choices);
            const choicesLength = hasChoices ? data.choices.length : 0;
            const rawResponseKeys = data && typeof data === "object" ? Object.keys(data) : [];
            const firstChoiceMessageContentLength = Array.isArray(rawContent)
              ? JSON.stringify(rawContent).length
              : String(rawContent || "").length;
            console.log("[OPENROUTER_BACKEND_DIAGNOSTIC_AUDIT]", JSON.stringify({
                selectedModel: currentModel,
                imageUrlCount: imageItems.length,
                firstImagePrefix: firstImageUrl.slice(0, 32),
                firstImageLength: firstImageUrl.length,
                messagesContentShape,
                openRouterHttpStatus: orResponse.status,
                rawResponseKeys,
                choicesLength,
                firstChoiceMessageContentType: contentType,
                firstChoiceMessageContentLength
            }));
            console.log("[OPENROUTER_BACKEND_RAW_RESPONSE_AUDIT]", JSON.stringify({
                model: currentModel,
                hasChoices,
                choicesLength,
                contentType,
                contentLength: contentString.length,
                finishReason: data?.choices?.[0]?.finish_reason || data?.finish_reason || null
            }));
            if (!hasChoices || choicesLength === 0 || !contentString.trim()) {
                console.log("[OPENROUTER_BACKEND_EMPTY_RESPONSE_CAUSE]", JSON.stringify({
                    model: currentModel,
                    status: orResponse.status,
                    hasChoices,
                    choicesLength,
                    contentType,
                    contentLength: contentString.length,
                    reason: "EMPTY_CHOICES_OR_CONTENT"
                }));
                lastErrorStatus = 200;
                lastErrorText = "EMPTY_CHOICES_OR_CONTENT";
                lastErrorMsg = "EMPTY_CHOICES_OR_CONTENT";
                if (i < modelsToTry.length - 1) {
                    console.log("[OPENROUTER_BACKEND_FALLBACK_NEXT_MODEL]", JSON.stringify({
                        failedModel: currentModel,
                        nextModel: modelsToTry[i + 1],
                        reason: "EMPTY_CHOICES_OR_CONTENT",
                        remainingAttempts: modelsToTry.length - (i + 1)
                    }));
                }
                continue;
            }

            // Attempt to parse JSON to evaluate vision output quality
            let isWeakOutput = false;
            let qualityMetrics = null;
            try {
                let jsonStr = contentString.replace(/```json/g, "").replace(/```/g, "").trim();
                const parsedContent = JSON.parse(jsonStr);
                
                const frameObservationsCount = Array.isArray(parsedContent.frameObservations) ? parsedContent.frameObservations.length : 0;
                let visibleSubjectsTotal = 0;
                if (Array.isArray(parsedContent.frameObservations)) {
                    visibleSubjectsTotal = parsedContent.frameObservations.reduce((acc: number, obs: any) => acc + (Array.isArray(obs.visibleSubjects) ? obs.visibleSubjects.length : 0), 0);
                }

                const detectedCharactersCount = Array.isArray(parsedContent.detectedCharacters) ? parsedContent.detectedCharacters.length : 0;
                const visualCastCount = typeof parsedContent.visualCastCount === 'number' ? parsedContent.visualCastCount : 0;
                
                const analysisLower = (parsedContent.frameAnalysis || "").toLowerCase();
                const hasGlobalPeopleDescription = analysisLower.includes("man") || analysisLower.includes("woman") || analysisLower.includes("person") || analysisLower.includes("people") || analysisLower.includes("men") || analysisLower.includes("women") || analysisLower.includes("individual");

                // Identical weak evaluation as client layer
                isWeakOutput = hasGlobalPeopleDescription && visibleSubjectsTotal === 0 && detectedCharactersCount === 0 && visualCastCount === 0;
                qualityMetrics = {
                    frameAnalysisLength: analysisLower.length,
                    frameObservationsCount,
                    visibleSubjectsTotal,
                    detectedCharactersCount,
                    visualCastCount,
                    hasGlobalPeopleDescription,
                    isWeakOutput
                };
            } catch (e) {
                // If it fails to parse, we can't reliably judge if it's weak
            }

            console.log(`[OPENROUTER_VISION_OUTPUT_QUALITY_AUDIT]`, JSON.stringify({
                modelUsed: currentModel,
                visionStatus: isWeakOutput ? "WEAK" : "OK",
                shouldTreatAsWeakVisionOutput: isWeakOutput,
                ...qualityMetrics
            }));

            // If it's weak and we have more models to try, we continue
            if (isWeakOutput && i < modelsToTry.length - 1) {
                console.log(`[OPENROUTER_VISION_FALLBACK_SWITCH]`, JSON.stringify({
                    fromModel: currentModel,
                    toModel: modelsToTry[i+1],
                    reason: "WEAK_VISION_OUTPUT"
                }));
                // We pretend it was an error for the fallback loop to continue
                lastErrorStatus = 200; // but it was successful, just weak
                lastErrorText = "Weak Vision Output";
                lastErrorMsg = "WEAK_VISION_OUTPUT";
                
                // Store this data in case it's the last iteration
                (req as any).lastWeakData = data;
                console.log("[OPENROUTER_BACKEND_FALLBACK_NEXT_MODEL]", JSON.stringify({
                    failedModel: currentModel,
                    nextModel: modelsToTry[i + 1],
                    reason: "WEAK_VISION_OUTPUT",
                    remainingAttempts: modelsToTry.length - (i + 1)
                }));
                continue;
            }

            console.log(`[OPENROUTER_VISION_SUCCESS_AUDIT]`, JSON.stringify({
                model: currentModel,
                available: true,
                statusMsg: isWeakOutput ? "WEAK_VISION_OUTPUT" : "OK",
                action: isWeakOutput ? "final_weak_fallback_used" : "proceed"
            }));

            if (isWeakOutput && i === modelsToTry.length - 1) {
                console.log(`[OPENROUTER_VISION_WEAK_FINAL] All models exhausted, final model was weak. model=${currentModel}`);
            }

            console.log("[OPENROUTER_RESPONSE_CONTENT_AUDIT]", {
                modelUsed: currentModel,
                hasChoices: Array.isArray(data?.choices),
                choiceCount: Array.isArray(data?.choices) ? data.choices.length : 0,
                hasMessageContent: Boolean(data?.choices?.[0]?.message?.content),
                contentLength: contentString.length,
                contentPreview
            });
            return res.json(data);
        } catch (error: any) {
            console.error(`[OPENROUTER_EXCEPTION] model=${currentModel}`, error);
            console.log(`[OPENROUTER_VISION_MODEL_AVAILABILITY_AUDIT]`, JSON.stringify({
                model: currentModel,
                available: false,
                errorStatus: 500,
                errorMessage: error.message,
                action: "retry_next"
            }));
            lastErrorStatus = 500;
            lastErrorText = error.message;
            lastErrorMsg = "Internal Server Error";
            if (i < modelsToTry.length - 1) {
                console.log("[OPENROUTER_BACKEND_FALLBACK_NEXT_MODEL]", JSON.stringify({
                    failedModel: currentModel,
                    nextModel: modelsToTry[i + 1],
                    reason: error.message,
                    remainingAttempts: modelsToTry.length - (i + 1)
                }));
            }
        }
    }

    // If we exhausted all fallbacks
    if (lastErrorMsg === "API_KEY_INVALID") {
        return res.status(401).json({ error: "OPENROUTER_API_KEY_INVALID" });
    }

    if ((req as any).lastWeakData) {
        console.log(`[OPENROUTER_VISION_WEAK_FINAL_RECOVERY] Returning previously captured weak output because final fallback failed.`);
        return res.json((req as any).lastWeakData);
    }

    if (newVisorMode === true || disableVisionFallbackChain === true) {
        console.log("[NEW_VISOR_GEMINI_FLASH_ERROR]", JSON.stringify({
            modelsTried,
            reason: "new_visor_mode_no_fallback"
        }));
        return res.status(200).json({ 
            ok: false,
            visionStatus: "NEW_VISOR_FAILED",
            frameTimelineAvailable: false,
            frameObservations: [],
            detectedCharacters: [],
            visualCastCount: 0,
            frameTimestamps: [],
            reason: lastErrorText || "NEW_VISOR_ERROR",
            modelsTried,
            skippedModels
        });
    }

    console.log("[OPENROUTER_BACKEND_ATTEMPTS_EXHAUSTED]", JSON.stringify({
        modelsTried,
        skippedModels,
        reason: "quota_protected_attempts_exhausted"
    }));
    console.log(`[OPENROUTER_BACKEND_TOTAL_TIMEOUT_GUARD] Sending controlled timeout response`);
    console.log(`[OPENROUTER_BACKEND_CONTROLLED_TIMEOUT_RESPONSE]`);
    return res.status(200).json({ 
        ok: false,
        visionStatus: "OPENROUTER_ATTEMPTS_EXHAUSTED_EMPTY_OR_TIMEOUT",
        frameTimelineAvailable: false,
        frameObservations: [],
        detectedCharacters: [],
        visualCastCount: 0,
        frameTimestamps: [],
        reason: "QUOTA_PROTECTED_ATTEMPTS_EXHAUSTED",
        modelsTried,
        skippedModels
    });
  });

  // Catch-all API 404 handler
  app.use("/api", (req, res) => {
    res.status(404).json({
      ok: false,
      errorCode: "API_ROUTE_NOT_FOUND",
      path: req.originalUrl
    });
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const projectRoot = process.cwd();
    console.log("[VITE_PROJECT_ROOT_AUDIT]", {
      cwd: process.cwd(),
      projectRoot,
      configFile: path.resolve(projectRoot, "vite.config.ts"),
      configFileDisabled: true,
      inlineConfig: true
    });
    const vite = await createViteServer({
      root: projectRoot,
      configFile: false,
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          "@": projectRoot,
        },
      },
      server: {
        middlewareMode: true,
      },
      appType: "custom",
    });
    app.use(vite.middlewares);
    console.log("[VITE_UI_MIDDLEWARE_MOUNTED]");
    console.log("[VITE_INDEX_HTML_FALLBACK_READY]");
    app.use(async (req, res, next) => {
      try {
        const url = req.originalUrl;
        if (url.startsWith("/api/")) {
          return next();
        }

        const indexPath = path.resolve(projectRoot, "index.html");
        let template = await fs.promises.readFile(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);

        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static("dist"));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER_BOOT]
mode=${process.env.NODE_ENV || 'development'}
port=${PORT}
apiRoutesRegistered=[
  "GET /api/health",
  "GET /api/gemini/upload/health",
  "POST /api/gemini/upload"
]`);
    
    // Diagnostic log requested by user
    const geminiKey = resolveGeminiEnvKey();
    const hasKey = !!geminiKey;
    console.log(`[Env Check] GEMINI_API_KEY PRESENT: ${hasKey}`);
    
    if (hasKey && typeof geminiKey === 'string') {
      const key = geminiKey;
      console.log(`[Env Check] Key Hint: ${key.substring(0, 4)}...${key.substring(key.length - 4)} (Length: ${key.length})`);
      if (key.toLowerCase().startsWith('gsk_')) {
        console.warn(`[Env Check] CRITICAL WARNING: YOUR GEMINI_API_KEY STARTS WITH 'gsk_'. THIS IS A GROQ KEY, NOT A GEMINI KEY. GEMINI WILL NOT WORK.`);
      }
    }

    const orKey1 = process.env.OPENROUTER_API_KEY || (env as any).VITE_OPENROUTER_API_KEY;
    const orKey2 = process.env.OPENROUTER_API_KEY_2;
    const slots = [orKey1, orKey2].filter(Boolean).length;

    console.log(`[SERVER_BOOT_OPENROUTER_KEY_AUDIT]
primaryKeyDefined: ${!!orKey1}
secondaryKeyDefined: ${!!orKey2}
keySlotsAvailable: ${slots}`);

    console.log(`[Env Check] YOUTUBE_API_KEY: ${resolveYoutubeEnvKey() ? 'SET' : 'MISSING'}`);
  });
}

startServer();
