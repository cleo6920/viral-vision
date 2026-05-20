
import { CNGResult, PhysicalNature, SemanticNature, CNGFinalNature, CNGRegime, CNGContentType, CNGEvaluationMode } from '../types/cng';

const PROVISIONAL_TEST_CAP = 4.0;

export function reconcileCNG(
  physicalNature: PhysicalNature, 
  semanticNature: SemanticNature,
  contentType: CNGContentType,
  variancePercent: number,
  disparity: number
): CNGResult {
  let finalNature: CNGFinalNature;
  let regime: CNGRegime = 'FULL';
  let evaluationMode: CNGEvaluationMode = 'FULL_DYNAMIC';
  let capScore: number | null = null;
  let edgeCaseFlag = false;
  let shortReason = "";
  let confidence = 0.9;

  // Mapping Table Implementation
  if (physicalNature === 'PHYSICAL_STATIC' && semanticNature === 'SEMANTIC_STILL') {
    finalNature = 'STATIC_PURE';
    regime = 'ARC_BLIND';
    capScore = 3.0;
    shortReason = "Confirmed static content without noise.";
  } else if (physicalNature === 'PHYSICAL_NOISY' && semanticNature === 'SEMANTIC_STILL') {
    finalNature = 'STATIC_WITH_NOISE';
    regime = 'ARC_BLIND';
    capScore = 3.0;
    shortReason = "Static content with high visual noise (e.g. film grain).";
  } else if (physicalNature === 'PHYSICAL_STATIC' && semanticNature === 'ACTIVE_VIDEO') {
    finalNature = 'LOW_MOTION_REAL';
    regime = 'FULL'; // Protection against false rejects: enter full analysis
    capScore = null;
    shortReason = "Low physical motion but semantically active (e.g. intense talking head).";
  } else if (physicalNature === 'PHYSICAL_DYNAMIC' && semanticNature === 'ACTIVE_VIDEO') {
    finalNature = 'REAL_DYNAMIC';
    regime = 'FULL';
    capScore = null;
    shortReason = "Confirmed dynamic real video.";
  } else if (physicalNature === 'PHYSICAL_DYNAMIC' && semanticNature === 'SEMANTIC_STILL') {
    finalNature = 'SIMULATED_MOTION';
    regime = 'ARC_BLIND';
    capScore = PROVISIONAL_TEST_CAP; 
    edgeCaseFlag = true;
    shortReason = "Physical motion detected on semantic still (e.g. digital zoom or slideshow).";
  } else {
    // Fallback for safety
    finalNature = physicalNature === 'PHYSICAL_DYNAMIC' ? 'REAL_DYNAMIC' : 'STATIC_PURE';
    regime = finalNature === 'REAL_DYNAMIC' ? 'FULL' : 'ARC_BLIND';
    capScore = regime === 'ARC_BLIND' ? 3.0 : null;
    shortReason = "Fallback reconciliation applied.";
    confidence = 0.5;
  }

  // CTD Overlay (Content Type Detector)
  if (finalNature === 'STATIC_PURE' || finalNature === 'STATIC_WITH_NOISE') {
    if (contentType === 'INFORMATIONAL_POSTER' || contentType === 'UI_SCREENSHOT') {
      evaluationMode = 'INFORMATIONAL_STATIC';
      capScore = null; // Remove the standard video penalty
      shortReason = `Informational static asset detected (${contentType}). Escaping video logic.`;
    } else {
      evaluationMode = 'ARC_BLIND';
    }
  } else if (finalNature === 'LOW_MOTION_REAL' || finalNature === 'REAL_DYNAMIC') {
      evaluationMode = 'FULL_DYNAMIC';
  } else if (finalNature === 'SIMULATED_MOTION') {
       evaluationMode = 'ARC_BLIND';
  }

  return {
    physicalNature,
    semanticNature,
    contentType,
    finalNature,
    evaluationMode,
    regime,
    capScore,
    edgeCaseFlag,
    shortReason,
    confidence
  };
}
