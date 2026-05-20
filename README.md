# Viral Strategy Engine Pro

Project export pulito per upload e re-import su Google / ambiente locale.

## Contenuto

La cartella include:

- `src/` completo
- `server.ts`
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `.env.example`
- file statici e configurazioni necessarie

La cartella non include:

- `node_modules`
- cache
- build output
- log vecchi
- chiavi API reali

## Variabili ambiente

Copia `.env.example` in `.env.local` oppure `.env` e compila le chiavi necessarie.

Variabili supportate:

- `VITE_GEMINI_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`
- `API_KEY`
- `VITE_YOUTUBE_API_KEY`
- `YOUTUBE_API_KEY`
- `VITE_GOOGLE_YOUTUBE_API_KEY`
- `GOOGLE_YOUTUBE_API_KEY`
- `VITE_GROQ_API_KEY`
- `GROQ_API_KEY`
- `VITE_GROQ_API_KEY_1`
- `GROQ_API_KEY_1`
- `VITE_GROQ_API_KEY_2`
- `GROQ_API_KEY_2`
- `VITE_GROQ_API_KEY_3`
- `GROQ_API_KEY_3`
- `GROQ_API_KEYS`
- `VITE_GROQ_API_KEYS`
- `VITE_VIRAL_DECISION`
- `APP_URL`

Note pratiche:

- In ambienti Vite / Google AI Studio e' consigliato usare le variabili `VITE_*`.
- Il progetto supporta anche gli alias senza prefisso per backend e server.
- Gemini serve per analisi/generazione testuale di supporto e per la cover image su richiesta utente.
- Groq viene usato per Whisper/audio e per i layer creativi testuali quando disponibile.
- YouTube API serve per `externalMarketData` e comparables.

## Avvio

Se vuoi installare da zero:

```bash
npm install
```

Se il lockfile e' presente e vuoi un'installazione piu' rigorosa:

```bash
npm ci
```

Avvio sviluppo:

```bash
npm run dev
```

Build produzione:

```bash
npm run build
```

Preview build:

```bash
npm run preview
```

## Verifica Post-Import

Test consigliato:

1. Usa lo stesso video comedy gia' testato.
2. Verifica che audio/transcript/YouTube tornino corretti:
   - `audioVerified = true`
   - `audioSource = GROQ_WHISPER`
   - `transcriptStatus = VERIFIED_TRANSCRIPT`
   - `externalMarketData.status = SUCCESS`
3. Controlla nei risultati e nei log:
   - `lockedPromptTabs.locked = true`
   - `recommendedPromptTarget`
   - `bestOptimizedPrompt`
   - `LOCKED_PROMPT_TABS_EXTERNAL_PRESERVED` se i prompt Groq locked passano
   - `ANTI_SCROLL_PUBLISHING_GROQ_PRESERVED`
   - `PUBLISHING_TOP_LEVEL_REBUILT_FROM_PRO` oppure `PUBLISHING_TOP_LEVEL_REBUILT_FROM_PARSED`
   - `ANTI_SCROLL_COVER_GROQ_PRESERVED`
   - `COVER_PROMPT_LOCKED_FROM_ANTI_SCROLL`
4. Nella sezione `Prompt per AI Video`, verifica il badge `Consigliato` sul tab corretto.

## Sicurezza

- Nessuna chiave reale deve essere committata o caricata dentro questa cartella.
- Le chiavi vanno inserite solo tramite `.env.local`, `.env` o segreti runtime.

## Export Corretto Per Google

Per esportare correttamente:

- comprimi il contenuto di questa cartella root
- oppure assicurati che Google usi questa cartella come root progetto

La root corretta deve contenere direttamente:

- `/src/main.tsx`
- `/src/App.tsx`
- `/public/csp-fix.js`
- `/public/coi-serviceworker.js`
- `/components/ui/button.tsx`
- `/lib/utils.ts`

Non deve esistere una seconda cartella annidata con un altro progetto completo dentro.

## Checklist Root Dopo Import

Dopo import su Google, verifica che esistano in root:

- `/src/main.tsx`
- `/src/App.tsx`
- `/public/csp-fix.js`
- `/public/coi-serviceworker.js`
- `/components/ui/button.tsx`
- `/lib/utils.ts`
