import { PhysicalNature, CNGThresholdConfig } from '../types/cng';

export const CNG_THRESHOLD_SETTING: CNGThresholdConfig = {
  NOISE_FLOOR: 0.05,       // 5% variance threshold
  SPATIAL_DISPARITY: 0.20  // 20% difference between macro-regions
};

export const ADVANCED_PHYSICAL_SETTINGS = {
  GRID_COLS: 6,
  GRID_ROWS: 6,
  MIN_CONTIGUOUS_CELLS: 3,
  PIXEL_DIFF_THRESHOLD: 24,
  LUMA_DRIFT_THRESHOLD: 8,       // Minimum chroma drift to ignore pure exposure flashes
  CELL_ACTIVATION_THRESHOLD: 0.10 // 10% of a cell must change to be considered "active"
};

function calculateMaxCluster(grid: boolean[], cols: number, rows: number): number {
  const visited = new Array(cols * rows).fill(false);
  let maxCluster = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      if (grid[idx] && !visited[idx]) {
        let size = 0;
        const stack = [[x, y]];
        visited[idx] = true;
        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          size++;
          const neighbors = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
              const nIdx = ny * cols + nx;
              if (grid[nIdx] && !visited[nIdx]) {
                visited[nIdx] = true;
                stack.push([nx, ny]);
              }
            }
          }
        }
        if (size > maxCluster) maxCluster = size;
      }
    }
  }
  return maxCluster;
}

export interface VarianceResult {
  variancePercent: number;
  physicalNature: PhysicalNature;
  gridVariances: number[];
  disparity: number;
}

export async function calculatePhysicalNature(file: File): Promise<VarianceResult> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.crossOrigin = 'anonymous';
    video.muted = true;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!duration || duration < 1) {
        URL.revokeObjectURL(video.src);
        return resolve({
          variancePercent: 0,
          physicalNature: 'PHYSICAL_STATIC',
          gridVariances: [],
          disparity: 0
        });
      }

      const times = [
        duration * 0.10,
        duration * 0.40,
        duration * 0.70,
        duration * 0.90
      ];

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        URL.revokeObjectURL(video.src);
        return resolve({ variancePercent: 0, physicalNature: 'PHYSICAL_STATIC', gridVariances: [], disparity: 0 });
      }

      // 64x64 is enough to see shapes but small enough to be fast
      const dw = 64;
      const dh = 64;
      canvas.width = dw;
      canvas.height = dh;

      const framesData: Uint8ClampedArray[] = [];
      let timeIndex = 0;

      const captureFrame = () => {
        if (timeIndex >= times.length) {
          URL.revokeObjectURL(video.src);
          return finishAnalysis();
        }
        video.currentTime = times[timeIndex];
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, dw, dh);
        // Exclude bottom 20% instead of 30% to catch more movement
        const safeHeight = Math.floor(dh * 0.8);
        const imageData = ctx.getImageData(0, 0, dw, safeHeight);
        framesData.push(new Uint8ClampedArray(imageData.data));
        timeIndex++;
        captureFrame();
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve({ variancePercent: 0, physicalNature: 'PHYSICAL_STATIC', gridVariances: [], disparity: 0 });
      };

      captureFrame();

      function finishAnalysis() {
        if (framesData.length < 2) {
          return resolve({ variancePercent: 0, physicalNature: 'PHYSICAL_STATIC', gridVariances: [], disparity: 0 });
        }

        const gridRows = ADVANCED_PHYSICAL_SETTINGS.GRID_ROWS;
        const gridCols = ADVANCED_PHYSICAL_SETTINGS.GRID_COLS;
        const regionWidth = Math.floor(dw / gridCols);
        const regionHeight = Math.floor((dh * 0.8) / gridRows);
        
        let maxGlobalVariance = 0;
        let finalGridVariances: number[] = new Array(gridRows * gridCols).fill(0);
        let absoluteMaxCluster = 0;
        let prevActiveGrid: boolean[] | null = null;
        
        // V2: Sequential comparison (F1 vs F0, F2 vs F1, etc.)
        for (let f = 1; f < framesData.length; f++) {
          const currentFrame = framesData[f];
          const prevFrame = framesData[f - 1]; // Compare to previous, not base frame
          
          const frameGridVariances = new Array(gridRows * gridCols).fill(0);
          const activeGrid = new Array(gridRows * gridCols).fill(false);
          let frameChangedPixels = 0;

          let corePixels = 0;
          let perimeterPixels = 0;

          for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
              let regionChangedPixels = 0;
              const startX = col * regionWidth;
              const startY = row * regionHeight;
              
              for (let y = startY; y < startY + regionHeight; y++) {
                for (let x = startX; x < startX + regionWidth; x++) {
                  const p = (y * dw + x) * 4;
                  const rDiff = Math.abs(prevFrame[p] - currentFrame[p]);
                  const gDiff = Math.abs(prevFrame[p+1] - currentFrame[p+1]);
                  const bDiff = Math.abs(prevFrame[p+2] - currentFrame[p+2]);
                  
                  const maxDiff = Math.max(rDiff, gDiff, bDiff);
                  const minDiff = Math.min(rDiff, gDiff, bDiff);
                  const chromaDrift = maxDiff - minDiff;
                  
                  // V2 Luma/Chroma check: Require color shift to discard white flashes
                  if (maxDiff > ADVANCED_PHYSICAL_SETTINGS.PIXEL_DIFF_THRESHOLD && chromaDrift > ADVANCED_PHYSICAL_SETTINGS.LUMA_DRIFT_THRESHOLD) {
                    regionChangedPixels++;
                    frameChangedPixels++;
                  }
                }
              }
              const regionTotal = regionWidth * regionHeight;
              const cellVariance = regionChangedPixels / regionTotal;
              frameGridVariances[row * gridCols + col] = cellVariance;

              if (row > 0 && row < gridRows - 1 && col > 0 && col < gridCols - 1) {
                corePixels += regionChangedPixels;
              } else {
                perimeterPixels += regionChangedPixels;
              }
              
              // Mark cell as "active" if it exceeds local activation threshold
              if (cellVariance > ADVANCED_PHYSICAL_SETTINGS.CELL_ACTIVATION_THRESHOLD) {
                activeGrid[row * gridCols + col] = true;
              }
            }
          }

          // Evaluate Core-to-Edge Ratio
          const coreArea = 16 * regionWidth * regionHeight;
          const perimeterArea = 20 * regionWidth * regionHeight;
          const coreNormalized = corePixels / coreArea;
          const perimeterNormalized = perimeterPixels / perimeterArea;

          // Evaluate cluster logic with Temporal Persistence
          let currentMaxCluster = 0;
          if (prevActiveGrid) {
            const persistentGrid = new Array(gridRows * gridCols).fill(false);
            for (let i = 0; i < persistentGrid.length; i++) {
              persistentGrid[i] = prevActiveGrid[i] && activeGrid[i];
            }
            currentMaxCluster = calculateMaxCluster(persistentGrid, gridCols, gridRows);
          } else if (framesData.length === 2) {
            // Fallback for single transition videos
            currentMaxCluster = calculateMaxCluster(activeGrid, gridCols, gridRows);
          }
          prevActiveGrid = activeGrid;

          // Prudent invalidation: If the cluster is large but the variance ratio is flat or perimeter-dominated
          if (currentMaxCluster >= ADVANCED_PHYSICAL_SETTINGS.MIN_CONTIGUOUS_CELLS) {
            // Check if global noise is dominating (ratio <= 1.2 implies flat or perimeter-heavy)
            // also ensure there's enough minimum variance to not divide by zero
            if (perimeterNormalized > 0 && coreNormalized <= perimeterNormalized * 1.2) {
              currentMaxCluster = 0; // Filter applied: Invalidate the cluster 
            }
          }

          if (currentMaxCluster > absoluteMaxCluster) {
            absoluteMaxCluster = currentMaxCluster;
          }

          const globalVar = frameChangedPixels / (dw * (dh * 0.8));
          if (globalVar > maxGlobalVariance) {
            maxGlobalVariance = globalVar;
            finalGridVariances = [...frameGridVariances];
          }
        }

        const maxVar = Math.max(...finalGridVariances);
        const minVar = Math.min(...finalGridVariances);
        const disparity = maxVar - minVar; // Retained for backwards compat payload structure

        let physicalNature: PhysicalNature = 'PHYSICAL_DYNAMIC';

        if (maxGlobalVariance < CNG_THRESHOLD_SETTING.NOISE_FLOOR) {
          physicalNature = 'PHYSICAL_STATIC';
        } else if (absoluteMaxCluster < ADVANCED_PHYSICAL_SETTINGS.MIN_CONTIGUOUS_CELLS) {
          physicalNature = 'PHYSICAL_NOISY'; // Overrides raw variance: lacks continuous physical mass
        }

        console.log(`[CNG-Physical] Variance: ${(maxGlobalVariance*100).toFixed(2)}%, MaxCluster: ${absoluteMaxCluster}, Choice: ${physicalNature}`);

        resolve({
          variancePercent: maxGlobalVariance,
          physicalNature,
          gridVariances: finalGridVariances,
          disparity
        });
      }
    };
  });
}

/**
 * Backward compatibility alias for legacy code
 */
export const calculateVideoVariance = async (file: File) => {
  const res = await calculatePhysicalNature(file);
  return {
    ...res,
    category: res.physicalNature === 'PHYSICAL_DYNAMIC' ? 'C' : 'A',
    overrideString: `[Legacy Sensor] Variance: ${(res.variancePercent * 100).toFixed(2)}%`
  };
};
