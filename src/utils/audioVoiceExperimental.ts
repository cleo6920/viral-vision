export async function analyzeRealAudioVoiceClustersExperimental(params: {
  audioBlob?: Blob | null;
  audioSegments?: any[];
}) {
  const emptyAudit = {
    realAudioAnalyzed: false,
    audioBufferAvailable: false,
    segmentFeaturesAvailable: false,
    analyzedSegmentsCount: 0,
    segmentVoiceFeatures: [],
    experimentalVoiceClusterCount: null,
    experimentalVoiceClusters: [],
    clusterConfidence: "NOT_AVAILABLE",
    method: "EXPERIMENTAL_AUDIO_FEATURE_CLUSTERING",
    limitations: [
      "No speaker embeddings are available.",
      "No certified diarization model is available.",
      "Spectral centroid skipped to keep the analysis lightweight and local."
    ],
    conclusion: "Audio reale non ancora disponibile nella fase di clustering.",
    recommendedNextStep: "Propagare audioBuffer/PCM dalla fase di estrazione alla fase di audit."
  };

  const audioBlob = params.audioBlob instanceof Blob ? params.audioBlob : null;
  const audioSegments = Array.isArray(params.audioSegments)
    ? params.audioSegments.filter((segment: any) => Number.isFinite(Number(segment?.start)) && Number.isFinite(Number(segment?.end)) && Number(segment.end) > Number(segment.start))
    : [];

  if (!audioBlob) {
    return {
      ...emptyAudit,
      conclusion: "Audio reale non ancora propagato nella pipeline per feature clustering.",
      recommendedNextStep: "Propagare audioBlob o audioBuffer dalla fase di estrazione alla fase di audit."
    };
  }

  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return {
        ...emptyAudit,
        conclusion: "Web Audio API non disponibile in questo ambiente runtime.",
        recommendedNextStep: "Usare un ambiente browser con AudioContext per attivare il clustering sperimentale."
      };
    }

    const context = new AudioCtx();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const channelCount = Math.max(1, decoded.numberOfChannels);
    const mono = new Float32Array(decoded.length);

    for (let channel = 0; channel < channelCount; channel++) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < decoded.length; i++) {
        mono[i] += data[i] / channelCount;
      }
    }

    const sampleRate = decoded.sampleRate || 16000;
    const segmentVoiceFeatures = audioSegments
      .map((segment: any, index: number) => {
        const start = Math.max(0, Number(segment.start) || 0);
        const end = Math.max(start, Number(segment.end) || start);
        const startIndex = Math.max(0, Math.min(mono.length - 1, Math.floor(start * sampleRate)));
        const endIndex = Math.max(startIndex + 1, Math.min(mono.length, Math.ceil(end * sampleRate)));
        const slice = mono.subarray(startIndex, endIndex);
        let sumSquares = 0;
        let peak = 0;
        let zeroCrossings = 0;

        for (let i = 0; i < slice.length; i++) {
          const v = slice[i] || 0;
          sumSquares += v * v;
          peak = Math.max(peak, Math.abs(v));
          if (i > 0) {
            const prev = slice[i - 1] || 0;
            if ((prev >= 0 && v < 0) || (prev < 0 && v >= 0)) zeroCrossings++;
          }
        }

        const duration = Math.max(0, end - start);
        const rmsEnergy = slice.length > 0 ? Math.sqrt(sumSquares / slice.length) : 0;
        const zeroCrossingRate = slice.length > 1 ? zeroCrossings / slice.length : 0;
        const prevEnd = index > 0 ? Number(audioSegments[index - 1]?.end) : null;
        const nextStart = index < audioSegments.length - 1 ? Number(audioSegments[index + 1]?.start) : null;

        return {
          start,
          end,
          text: String(segment?.text || "").trim(),
          duration,
          rmsEnergy: Number(rmsEnergy.toFixed(6)),
          peakEnergy: Number(peak.toFixed(6)),
          zeroCrossingRate: Number(zeroCrossingRate.toFixed(6)),
          spectralCentroid: null,
          silenceBefore: prevEnd == null ? null : Number(Math.max(0, start - prevEnd).toFixed(3)),
          silenceAfter: nextStart == null ? null : Number(Math.max(0, nextStart - end).toFixed(3)),
          featureQuality: duration >= 0.35 ? "MEDIUM" : "LOW_SHORT_SEGMENT"
        };
      })
      .filter((item: any) => item.duration > 0.05);

    const clusters: any[] = [];
    segmentVoiceFeatures.forEach((feature: any, featureIndex: number) => {
      let assigned = false;
      for (const cluster of clusters) {
        const count = cluster.segmentCount || 1;
        const meanRms = cluster.sumRms / count;
        const meanZcr = cluster.sumZcr / count;
        const meanDuration = cluster.sumDuration / count;
        const distance = Math.abs(feature.rmsEnergy - meanRms) * 8
          + Math.abs(feature.zeroCrossingRate - meanZcr) * 12
          + Math.abs(feature.duration - meanDuration) * 0.4;
        if (distance <= 0.45) {
          cluster.segmentIndexes.push(featureIndex);
          cluster.segmentTexts.push(feature.text);
          cluster.segmentCount += 1;
          cluster.sumRms += feature.rmsEnergy;
          cluster.sumZcr += feature.zeroCrossingRate;
          cluster.sumDuration += feature.duration;
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        clusters.push({
          id: `cluster_${clusters.length + 1}`,
          segmentIndexes: [featureIndex],
          segmentTexts: [feature.text],
          segmentCount: 1,
          sumRms: feature.rmsEnergy,
          sumZcr: feature.zeroCrossingRate,
          sumDuration: feature.duration
        });
      }
    });

    const experimentalVoiceClusters = clusters.map((cluster: any) => ({
      id: cluster.id,
      segmentIndexes: cluster.segmentIndexes,
      segmentCount: cluster.segmentCount,
      sampleTexts: cluster.segmentTexts.filter(Boolean).slice(0, 3),
      meanRmsEnergy: Number((cluster.sumRms / cluster.segmentCount).toFixed(6)),
      meanZeroCrossingRate: Number((cluster.sumZcr / cluster.segmentCount).toFixed(6)),
      meanDuration: Number((cluster.sumDuration / cluster.segmentCount).toFixed(3))
    }));

    try { await context.close(); } catch {}

    return {
      realAudioAnalyzed: true,
      audioBufferAvailable: true,
      segmentFeaturesAvailable: segmentVoiceFeatures.length > 0,
      analyzedSegmentsCount: segmentVoiceFeatures.length,
      segmentVoiceFeatures,
      experimentalVoiceClusterCount: experimentalVoiceClusters.length || null,
      experimentalVoiceClusters,
      clusterConfidence: experimentalVoiceClusters.length >= 3 && segmentVoiceFeatures.length >= 4 ? "EXPERIMENTAL_MEDIUM" : "EXPERIMENTAL_LOW",
      method: "EXPERIMENTAL_AUDIO_FEATURE_CLUSTERING",
      limitations: [
        "No speaker embeddings are available.",
        "No certified diarization model is available.",
        "Spectral centroid skipped to keep the analysis lightweight and local.",
        "Clusters are based on simple energy and zero-crossing features, not identity-safe voice fingerprints."
      ],
      conclusion: experimentalVoiceClusters.length > 0
        ? "Ho una prima stima tecnica da segnale audio, ma non e ancora diarizzazione certificata."
        : "Feature audio disponibili ma clustering non sufficientemente stabile per stimare voci distinte.",
      recommendedNextStep: "Per un conteggio speaker affidabile serve un modulo di diarization o voice embedding dedicato."
    };
  } catch (error: any) {
    return {
      ...emptyAudit,
      conclusion: "Audio reale disponibile ma analisi feature non completata correttamente.",
      recommendedNextStep: String(error?.message || error || "Verificare decode AudioContext e propagazione PCM.")
    };
  }
}
