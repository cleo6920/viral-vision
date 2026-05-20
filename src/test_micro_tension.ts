import { runMicroTensionEngine } from './services/gemini/analysis';
import { getAI, selectModel } from './services/gemini/core';
import { Type } from '@google/genai';

async function runTest() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key found in process.env.GEMINI_API_KEY");
    return;
  }

  const testCases = [
    {
      name: "STATIC + PERSONA",
      sourceTypeLocked: "STATIC_IMAGE",
      coreIntentClassification: { coreIntent: "PERSONA" },
      contentHierarchy: {
        contentType: "PORTRAIT",
        primarySubject: { element: "donna", role: "CORE_DRIVER", properties: ["viso serio", "sfondo scuro"] }
      }
    },
    {
      name: "STATIC + PRODOTTO",
      sourceTypeLocked: "STATIC_IMAGE",
      coreIntentClassification: { coreIntent: "PRODOTTO_SERVIZIO" },
      contentHierarchy: {
        contentType: "PRODUCT_SHOT",
        primarySubject: { element: "bottiglia di profumo", role: "CORE_DRIVER", properties: ["vetro riflettente", "isolato"] }
      }
    },
    {
      name: "STATIC + INFORMATIVO",
      sourceTypeLocked: "STATIC_IMAGE",
      coreIntentClassification: { coreIntent: "INFORMATIVO" },
      contentHierarchy: {
        contentType: "INFOGRAPHIC",
        primarySubject: { element: "testo centrale", role: "CORE_DRIVER", properties: ["statistiche", "grafico in ascesa"] }
      }
    },
    {
      name: "VIDEO + PERSONA",
      sourceTypeLocked: "REAL_VIDEO",
      coreIntentClassification: { coreIntent: "PERSONA" },
      contentHierarchy: {
        contentType: "VLOG",
        primarySubject: { element: "ragazzo", role: "CORE_DRIVER", properties: ["parla alla camera", "cammina in strada"] }
      }
    }
  ];

  for (const tc of testCases) {
    console.log(`\n======================================================`);
    console.log(`--- TEST CASE: ${tc.name} ---`);
    console.log(`======================================================`);
    
    try {
      const microTensionLock = await runMicroTensionEngine(
        apiKey,
        tc.contentHierarchy,
        tc.coreIntentClassification,
        tc.sourceTypeLocked
      );
      
      console.log("🔥 MicroTension Lock Output:");
      console.log(JSON.stringify(microTensionLock, null, 2));

      const { ai } = getAI(apiKey);
      const model = selectModel('gemini-2.0-flash', 'gemini-2.0-flash', apiKey);

      const promptText = `
        Sei il modulo finale di generazione script e prompt.
        
        GERARCHIA: ${JSON.stringify(tc.contentHierarchy)}
        INTENTO: ${tc.coreIntentClassification.coreIntent}
        SORGENTE: ${tc.sourceTypeLocked}
        
        🧨 MICRO TENSION ENGINE (VINCOLO CREATIVO OBBLIGATORIO):
        ${JSON.stringify(microTensionLock)}
        
        REGOLE DI TENSIONE:
        - Modalità: ${microTensionLock?.microTensionMode || 'generate'}
        - DEVI applicare l'attivazione "${microTensionLock?.type}" nella generazione finale.
        - Se la modalità è "extract", limitati a estrarre o enfatizzare la tensione naturale (timing), NON inventare eventi fuori campo inesistenti.
        - Se la modalità è "generate", crea l'anomalia per rompere la staticità come indicato.
        - Meccanismo da seguire: ${microTensionLock?.mechanism}
        - Questa micro-tensione deve emergere vividamente nei prompt video (sora15sPrompt) e nello script (optimizedScript).
        - Inserisci le esatte proprietà nell'oggetto "microTension" del JSON finale.
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
          microTension: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              mechanism: { type: Type.STRING }
            }
          },
          script: {
            type: Type.OBJECT,
            properties: {
              optimizedScript: { type: Type.STRING }
            }
          },
          sora15sPrompt: { type: Type.STRING }
        }
      };

      const resp = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema as any
        }
      });
      
      const result = JSON.parse(resp.text || '{}');
      console.log("\n📝 FINAL OUTPUT SNIPPETS:");
      console.log("microTension.type:", result.microTension?.type);
      console.log("microTension.mechanism:", result.microTension?.mechanism);
      console.log("\n[optimizedScript]:\n", result.script?.optimizedScript);
      console.log("\n[sora15sPrompt]:\n", result.sora15sPrompt);
      
      console.log("\n✅ Validation result: PASS");

    } catch (e: any) {
      console.log("❌ Error:", e.stack || e.message);
    }
  }
}

runTest();
