import React, { useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../services/gemini/core';

interface HighlightedTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  dangerousWords: string[];
  onCopy?: () => void;
  isCopied?: boolean;
  className?: string;
  ringColor?: string;
  textColor?: string;
  placeholder?: string;
}

export const HighlightedTextarea: React.FC<HighlightedTextareaProps> = ({ 
  value, 
  onChange, 
  dangerousWords, 
  onCopy,
  isCopied,
  className = 'h-64', 
  ringColor = 'focus:ring-emerald-500/30',
  textColor = 'text-zinc-300',
  placeholder
}) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [internalIsCopied, setInternalIsCopied] = React.useState(false);

  const handleInternalCopy = async () => {
    if (onCopy) {
      onCopy();
      return;
    }
    
    // Fallback internal copy if onCopy is not provided
    try {
      await copyToClipboard(value);
      setInternalIsCopied(true);
      setTimeout(() => setInternalIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Sync scroll on value change in case it changes programmatically
  useEffect(() => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [value]);

  const renderHighlights = () => {
    if (!dangerousWords || dangerousWords.length === 0 || !value) return <span className={`${textColor} transition-colors duration-500`}>{value}</span>;
    
    const escapedWords = dangerousWords
      .map(w => w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(w => w.length > 1);
      
    if (escapedWords.length === 0) return <span className={`${textColor} transition-colors duration-500`}>{value}</span>;

    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');
    const parts = value.split(regex);

    return parts.map((part, i) => {
      const isMatch = escapedWords.some(w => {
        const unescaped = w.replace(/\\/g, '').toLowerCase();
        return part.toLowerCase() === unescaped;
      });
      if (isMatch) {
        return <span key={i} className="text-yellow-400 bg-yellow-400/10 rounded-sm">{part}</span>;
      }
      return <span key={i} className={`${textColor} transition-colors duration-500`}>{part}</span>;
    });
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div 
        ref={backdropRef}
        className="absolute inset-0 w-full h-full p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words overflow-auto pointer-events-none bg-zinc-950 border border-zinc-800 rounded-xl"
        aria-hidden="true"
      >
        {renderHighlights()}
        {/* Add a zero-width space or extra padding at the end to ensure scrolling matches exactly when typing newlines */}
        <br />
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        className={`absolute inset-0 w-full h-full p-6 font-mono text-sm leading-relaxed text-transparent caret-white bg-transparent resize-none focus:outline-none focus:ring-1 ${ringColor} rounded-xl border-transparent highlight-textarea-input`}
        spellCheck={false}
        placeholder={placeholder}
      />
      
      <button
        onClick={handleInternalCopy}
        className="absolute top-3 right-3 p-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all backdrop-blur-sm border border-zinc-700/50 z-10"
        title="Copia negli appunti"
      >
        {isCopied || internalIsCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
};
