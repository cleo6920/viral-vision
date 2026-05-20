/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Play, Pause, RotateCcw, Maximize, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';

interface VideoPreviewProps {
  url: string;
}

export default function VideoPreview({ url }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgress = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
        Video Preview
      </div>
      
      <div className="relative group tech-border bg-black aspect-video overflow-hidden rounded overflow-hidden">
        <video 
          ref={videoRef}
          src={url} 
          className="w-full h-full object-contain"
          onTimeUpdate={handleProgress}
          onEnded={() => setIsPlaying(false)}
        />
        
        {/* Controls Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="h-1 bg-white/20 rounded-full w-full relative cursor-pointer group/bar">
              <div 
                className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-100" 
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity shadow-lg"></div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={togglePlay}
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-black hover:scale-110 transition-transform"
                >
                  {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                </button>
                <button className="text-white/70 hover:text-white transition-colors">
                  <RotateCcw size={18} />
                </button>
                <div className="flex items-center gap-2">
                  <Volume2 size={18} className="text-white/70" />
                  <div className="w-16 h-1 bg-white/20 rounded-full">
                    <div className="w-1/2 h-full bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
              
              <button className="text-white/70 hover:text-white transition-colors">
                <Maximize size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
         <button 
          onClick={togglePlay}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded text-sm font-bold tracking-widest uppercase transition-all ${
            isPlaying ? 'bg-neutral-800 text-neutral-400' : 'bg-accent text-brand hover:brightness-110'
          }`}
         >
           {isPlaying ? <><Pause size={16} /> Stop Playback</> : <><Play size={16} /> Start Playback</>}
         </button>
      </div>
    </div>
  );
}
