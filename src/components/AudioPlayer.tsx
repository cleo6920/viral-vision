import React, { useState, useRef } from 'react';
import { Play, Square } from 'lucide-react';

interface AudioPlayerProps {
  base64Data: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ base64Data }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const playAudio = async () => {
    if (isPlaying) {
      stopAudio();
      return;
    }

    setError(null);
    try {
      // Clean the base64 string just in case it has whitespace or is a Data URL
      const cleanBase64 = base64Data.includes('base64,') 
        ? base64Data.split('base64,')[1] 
        : base64Data.trim();

      const binary = atob(cleanBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Use decodeAudioData which handles WAV, MP3, and raw PCM (if supported)
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        setIsPlaying(false);
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };
      source.start();
      sourceRef.current = source;
      setIsPlaying(true);
    } catch (err) {
      console.error("Playback failed:", err);
      setError("Errore di riproduzione. Il formato audio potrebbe non essere supportato.");
      setIsPlaying(false);
    }
  };

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {}
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={playAudio}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors w-fit"
      >
        {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        {isPlaying ? "Ferma" : "Riproduci Audio"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};
