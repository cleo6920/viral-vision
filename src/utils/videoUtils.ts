/**
 * Extracts frames from a video file at specified intervals.
 */
export async function extractFrames(
  videoFile: File,
  numFrames: number = 8
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const frames: string[] = [];

    video.src = URL.createObjectURL(videoFile);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const interval = duration / (numFrames + 1);

      for (let i = 1; i <= numFrames; i++) {
        const time = i * interval;
        await seekTo(video, time);
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64, removing the prefix
        const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
        frames.push(base64);
      }

      URL.revokeObjectURL(video.src);
      resolve(frames);
    };

    video.onerror = (e) => reject(e);
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    video.currentTime = time;
    video.onseeked = () => resolve();
  });
}
