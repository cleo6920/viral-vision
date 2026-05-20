# Architettura Viral Shorts Prompt Architect

Questa mappa descrive l'organizzazione del codice per facilitare la manutenzione e lo sviluppo incrementale.

## 📂 Struttura Cartelle

- `src/services/`: **Logica Pura**. Solo funzioni asincrone che interagiscono con Gemini o FFmpeg. Nessuno stato React qui.
  - `gemini-api.ts`: Analisi virale, generazione cover, chat.
  - `gemini-prompts.ts`: Ottimizzazione prompt Sora 2.0.
  - `gemini-marketing.ts`: Nicchie, hook, trend.
  - `gemini-filters.ts`: Sicurezza e bypass filtri.
  - `gemini-utils.ts`: Utility comuni (retry, sanitize, model selection).
  - `ffmpeg.ts`: Elaborazione video (trimming).
- `src/hooks/`: **State & Logic**. Gestione dello stato complesso e side-effects.
  - `useUndoRedo.ts`: Gestione cronologia prompt.
- `src/components/`: **Visualizzazione**. Componenti UI atomici e molecolari.
  - `ProductionFlow.tsx`: Orchestratore del flusso di lavoro.
  - `SoraPromptView.tsx`: Visualizzazione risultati Sora.
  - `ChatAssistant.tsx`: Interfaccia chat.
- `src/App.tsx`: **Entry Point**. Coordina i componenti principali e i provider.

## 🔄 Flusso Dati

1. **Input**: L'utente carica un video o inserisce un'idea in `App.tsx`.
2. **Elaborazione**: `ProductionFlow.tsx` chiama i servizi in `src/services/`.
3. **Stato**: I risultati vengono salvati nello stato di `App.tsx` (o nei futuri hooks).
4. **Output**: La UI reagisce ai cambiamenti di stato visualizzando prompt e analisi.

## 🛠 Prossimi Passaggi Refactoring

1. **[IN CORSO]** Estrazione logica da `App.tsx` in Custom Hooks.
2. Scomposizione di `ProductionFlow.tsx` in sub-componenti per ogni step (`StepAnalysis`, `StepNiches`, etc.).
3. Unificazione dei modelli di dati (Types) per evitare conversioni ridondanti.
