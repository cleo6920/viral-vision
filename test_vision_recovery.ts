import { openRouterVisionAnalysis } from './src/services/ai/openRouterVisionClient';
import { logger } from './src/utils/logger';

// Override logger to show logs clearly
logger.info = console.log;
logger.error = console.error;
logger.warn = console.warn;

const originalFetch = globalThis.fetch;
let callCount = 0;

globalThis.fetch = async (url: any, options: any) => {
  if (url === '/api/debug/keys') {
    return {
      ok: true,
      json: async () => ({ openRouterKey2: true })
    } as any;
  }
  
  if (url === '/api/openrouter/chat') {
    callCount++;
    const body = JSON.parse(options.body);
    
    console.log(`[TEST_MOCK_FETCH] Intercepted call ${callCount}. keySlot=${body.keySlot}, requested frames=${body.frameCount}`);
    
    if (callCount === 1) {
      // Simulate partial response: frames 0 to 7
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                frameAnalysis: "Partial analysis",
                frameObservations: Array.from({length: 8}, (_, i) => ({
                  frameIndex: i,
                  timestamp: `${i}s`,
                  confidence: "HIGH"
                }))
              })
            }
          }]
        })
      } as any;
    } else if (callCount === 2) {
      // Secondary request for missing frames
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                frameAnalysis: "Recovery analysis",
                frameObservations: Array.from({length: body.frameCount}, (_, i) => ({
                  frameIndex: i, // it's 0 and 1 since it requests 2 frames
                  timestamp: `rec_${i}s`,
                  confidence: "HIGH"
                }))
              })
            }
          }]
        })
      } as any;
    }
  }
  return originalFetch(url, options);
};

async function run() {
  const frames = Array.from({length: 10}, (_, i) => `base64_frame_${i}`);
  const timeline = Array.from({length: 10}, (_, i) => `${i}s`);
  
  console.log("Starting vision analysis test with 10 frames...");
  const result = await openRouterVisionAnalysis(frames, "mock-key", "nvidia/nemotron-nano-12b", undefined, timeline);
  
  console.log("\n--- FINAL RESULT ---");
  console.log("- missingFrameIndexesAfterRecovery:", result.missingFrameIndexesAfterRecovery);
  console.log("- recoveryAttempted:", result.recoveryAttempted);
  console.log("- recoverySuccessful:", result.recoverySuccessful);
  console.log("- frameObservations count:", result.frameObservations?.length);
  
  result.frameObservations?.forEach(o => {
    console.log(`  Frame ${o.frameIndex}: sourceKeySlot = ${o.sourceKeySlot}`);
  });
}

run().catch(console.error);
