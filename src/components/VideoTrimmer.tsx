import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Scissors, SkipBack } from 'lucide-react';

interface VideoTrimmerProps {
  src: string;
  initialRange?: { start: number, end: number } | null;
  onRangeChange: (start: number, end: number) => void;
}

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({ src, initialRange, onRangeChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const [startTime, setStartTime] = useState(initialRange?.start || 0);
  const [endTime, setEndTime] = useState(initialRange?.end || 0);
  
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingRange, setIsDraggingRange] = useState(false);
  const wasPlayingBeforeDrag = useRef(false);
  const lastPointerX = useRef<number>(0);

  const formatTime = (timeInSeconds: number) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    const ms = Math.floor((timeInSeconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const [isBuffering, setIsBuffering] = useState(false);

  // Reset state when src changes
  useEffect(() => {
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(startTime);
    
    // If the video element is already loaded, sync currentTime
    if (videoRef.current && !isNaN(startTime)) {
      videoRef.current.currentTime = startTime;
    }
  }, [src]); // Removed startTime from dependencies to avoid resetting currentTime while dragging

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      console.log("[VideoTrimmer] Metadata loaded, duration:", dur);
      
      if (!isNaN(dur) && dur > 0 && dur !== Infinity) {
        setDuration(dur);
        
        if (initialRange && initialRange.end <= dur && initialRange.end > initialRange.start) {
          setStartTime(initialRange.start);
          setEndTime(initialRange.end);
          videoRef.current.currentTime = initialRange.start;
          onRangeChange(initialRange.start, initialRange.end);
        } else {
          setStartTime(0);
          setEndTime(dur);
          videoRef.current.currentTime = 0;
          onRangeChange(0, dur);
        }
      }
    }
  };

  useEffect(() => {
    // Sync state when initialRange changes (e.g. after trimming)
    if (initialRange) {
      setStartTime(initialRange.start);
      setEndTime(initialRange.end);
    } else if (duration > 0) {
      setStartTime(0);
      setEndTime(duration);
    }
  }, [initialRange, duration]);

  useEffect(() => {
    // Reset state when src changes
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    
    // Fallback if onLoadedMetadata doesn't fire immediately
    if (videoRef.current && videoRef.current.readyState >= 1) {
      handleLoadedMetadata();
    }

    const videoElement = videoRef.current;
    return () => {
      if (videoElement) {
        videoElement.pause();
      }
    };
  }, [src]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    
    // Loop within range - only if duration is valid and not Infinity
    if (duration > 0 && duration !== Infinity) {
      if (endTime > startTime && time >= endTime - 0.05) { 
        videoRef.current.currentTime = startTime;
      }
    }
  };

  const handleVideoError = (e: any) => {
    const video = videoRef.current;
    const error = video ? video.error : null;
    
    console.error("Video element error details:", {
      type: e?.type,
      code: error?.code,
      message: error?.message,
      src: src?.substring(0, 30) + "..."
    });

    // If it's a decoding error or network error, try to reload once
    if (error && (error.code === 3 || error.code === 4)) {
      console.log("[VideoTrimmer] Attempting to reload video due to error...");
      video?.load();
    }
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    
    // If duration is still 0/Infinity, try to get it again
    if (duration <= 0 || duration === Infinity) {
      const dur = videoRef.current.duration;
      if (!isNaN(dur) && dur > 0 && dur !== Infinity) {
        setDuration(dur);
        if (endTime <= 0) setEndTime(dur);
      }
    }

    // If video is not ready, try to load it
    if (videoRef.current.readyState === 0) {
      console.log("[VideoTrimmer] Video not ready, calling load()...");
      videoRef.current.load();
    }

    try {
      if (videoRef.current.paused) {
        // If we are at or past the end, jump back to start before playing
        if (endTime > 0 && videoRef.current.currentTime >= endTime - 0.1) {
          videoRef.current.currentTime = startTime;
        }
        
        // Use a local variable to avoid race conditions with the ref
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromiseRef.current = playPromise;
          await playPromise;
        }
      } else {
        // If a play is pending, we should still be able to pause
        videoRef.current.pause();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Playback failed:", err);
        // If it failed and we are stuck, try to reload
        if (videoRef.current.readyState < 2) {
          videoRef.current.load();
        }
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const rewindToStart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    
    if (newTime >= startTime && newTime <= endTime) {
      videoRef.current.currentTime = newTime;
    } else if (newTime < startTime) {
      videoRef.current.currentTime = startTime;
    } else {
      videoRef.current.currentTime = endTime;
    }
  };

  const handlePointerDownStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (videoRef.current && !videoRef.current.paused) {
      wasPlayingBeforeDrag.current = true;
      videoRef.current.pause();
    } else {
      wasPlayingBeforeDrag.current = false;
    }
    setIsDraggingStart(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerDownEnd = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (videoRef.current && !videoRef.current.paused) {
      wasPlayingBeforeDrag.current = true;
      videoRef.current.pause();
    } else {
      wasPlayingBeforeDrag.current = false;
    }
    setIsDraggingEnd(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerDownRange = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (videoRef.current && !videoRef.current.paused) {
      wasPlayingBeforeDrag.current = true;
      videoRef.current.pause();
    } else {
      wasPlayingBeforeDrag.current = false;
    }
    setIsDraggingRange(true);
    lastPointerX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!timelineRef.current || duration === 0) return;
    
    if (isDraggingStart || isDraggingEnd) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * duration;

      if (isDraggingStart) {
        const newStart = Math.min(newTime, endTime - 0.5); // At least 0.5s gap
        setStartTime(newStart);
        setCurrentTime(newStart);
        if (videoRef.current) videoRef.current.currentTime = newStart;
      } else if (isDraggingEnd) {
        const newEnd = Math.max(newTime, startTime + 0.5); // At least 0.5s gap
        setEndTime(newEnd);
        setCurrentTime(newEnd);
        if (videoRef.current) videoRef.current.currentTime = newEnd;
      }
    } else if (isDraggingRange) {
      const rect = timelineRef.current.getBoundingClientRect();
      const deltaX = e.clientX - lastPointerX.current;
      const deltaTime = (deltaX / rect.width) * duration;
      
      const currentRange = endTime - startTime;
      let newStart = startTime + deltaTime;
      let newEnd = endTime + deltaTime;

      if (newStart < 0) {
        newStart = 0;
        newEnd = currentRange;
      } else if (newEnd > duration) {
        newEnd = duration;
        newStart = duration - currentRange;
      }

      setStartTime(newStart);
      setEndTime(newEnd);
      lastPointerX.current = e.clientX;
      
      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingStart || isDraggingEnd || isDraggingRange) {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setIsDraggingRange(false);
      
      if (wasPlayingBeforeDrag.current && videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      
      try {
        if (e.target instanceof Element && e.target.hasPointerCapture(e.pointerId)) {
          e.target.releasePointerCapture(e.pointerId);
        }
      } catch (err) {
        console.error(err);
      }
      onRangeChange(startTime, endTime);
    }
  };

  const adjustStartTime = (amount: number) => {
    const newStart = Math.max(0, Math.min(startTime + amount, endTime - 0.5));
    setStartTime(newStart);
    if (videoRef.current) videoRef.current.currentTime = newStart;
    onRangeChange(newStart, endTime);
  };

  const adjustEndTime = (amount: number) => {
    const newEnd = Math.max(startTime + 0.5, Math.min(endTime + amount, duration));
    setEndTime(newEnd);
    if (videoRef.current) videoRef.current.currentTime = newEnd;
    onRangeChange(startTime, newEnd);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
      {/* Video Player */}
      <div className="relative bg-black flex items-center justify-center aspect-[9/16] max-h-[500px] mx-auto w-full">
        <video
          key={src}
          ref={videoRef}
          src={src}
          className="h-full w-auto max-w-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            if (endTime > startTime && videoRef.current) {
              videoRef.current.currentTime = startTime;
              videoRef.current.play().catch(() => {});
            } else {
              setIsPlaying(false);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onError={handleVideoError}
          playsInline
          crossOrigin="anonymous"
        />

        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
        
        {/* Play/Pause Overlay */}
        <button 
          onClick={togglePlay}
          className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
        >
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-lg transform hover:scale-105 transition-transform">
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </div>
        </button>
      </div>

      {/* Controls Section */}
      <div className="p-4 space-y-6">
        {/* Timeline */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.load();
                  setCurrentTime(startTime);
                }
              }}
              title="Reset Player"
              className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button 
              onClick={rewindToStart}
              title="Riavvolgi all'inizio del taglio"
              className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <Scissors className="w-5 h-5" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-emerald-500 transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
          </div>
          
          <div className="flex-grow flex flex-col gap-2">
            <div className="flex justify-between text-xs text-zinc-400 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{duration === Infinity ? 'LIVE/INF' : formatTime(duration)}</span>
            </div>
            
            <div 
              ref={timelineRef}
              className="relative h-10 bg-zinc-800 rounded-md cursor-pointer touch-none"
              onClick={handleTimelineClick}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {/* Progress Bar */}
              <div 
                className="absolute top-0 bottom-0 bg-zinc-700 rounded-md"
                style={{ width: `${(duration > 0 && duration !== Infinity) ? (currentTime / duration) * 100 : 0}%` }}
              />
              
              {/* Selected Range */}
              <div 
                className="absolute top-1 bottom-1 bg-emerald-500/20 border-y border-emerald-500/50 cursor-grab active:cursor-grabbing"
                style={{ 
                  left: `${(duration > 0 && duration !== Infinity) ? (startTime / duration) * 100 : 0}%`,
                  width: `${(duration > 0 && duration !== Infinity) ? ((endTime - startTime) / duration) * 100 : 0}%`
                }}
                onPointerDown={handlePointerDownRange}
              />
              
              {/* Start Handle (Larger touch target for mobile) */}
              <div 
                className="absolute top-0 bottom-0 w-6 flex items-center justify-center cursor-ew-resize z-10 group"
                style={{ 
                  left: `${(duration > 0 && duration !== Infinity) ? (startTime / duration) * 100 : 0}%`, 
                  transform: 'translateX(-50%)',
                  display: (duration > 0 && duration !== Infinity) ? 'flex' : 'none',
                  touchAction: 'none'
                }}
                onPointerDown={handlePointerDownStart}
              >
                <div className="w-2 h-full bg-emerald-500 rounded-l-md group-hover:bg-emerald-400 transition-colors shadow-md" />
              </div>
              
              {/* End Handle (Larger touch target for mobile) */}
              <div 
                className="absolute top-0 bottom-0 w-6 flex items-center justify-center cursor-ew-resize z-10 group"
                style={{ 
                  left: `${(duration > 0 && duration !== Infinity) ? (endTime / duration) * 100 : 0}%`, 
                  transform: 'translateX(-50%)',
                  display: (duration > 0 && duration !== Infinity) ? 'flex' : 'none',
                  touchAction: 'none'
                }}
                onPointerDown={handlePointerDownEnd}
              >
                <div className="w-2 h-full bg-emerald-500 rounded-r-md group-hover:bg-emerald-400 transition-colors shadow-md" />
              </div>
            </div>
          </div>
          
          <button 
            onClick={toggleMute}
            className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 transition-colors shrink-0"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Fine Tuning Controls */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
              <Scissors className="w-3 h-3" />
              Inizio Range
            </div>
            <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg p-1">
              <button onClick={() => adjustStartTime(-0.1)} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">-</button>
              <span className="font-mono text-sm text-emerald-400">{formatTime(startTime)}</span>
              <button onClick={() => adjustStartTime(0.1)} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">+</button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
              <Scissors className="w-3 h-3" />
              Fine Range
            </div>
            <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg p-1">
              <button onClick={() => adjustEndTime(-0.1)} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">-</button>
              <span className="font-mono text-sm text-emerald-400">{formatTime(endTime)}</span>
              <button onClick={() => adjustEndTime(0.1)} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
