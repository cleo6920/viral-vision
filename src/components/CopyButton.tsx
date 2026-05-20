import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyToClipboard } from '../services/gemini/core';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export const CopyButton = ({ text, className = "" }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-3 sm:p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl sm:rounded-lg transition-all border border-zinc-700 flex items-center justify-center gap-2 text-sm sm:text-xs font-bold active:scale-95 ${className}`}
      title="Copia negli appunti"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copiato!</span>
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span>Copia</span>
        </>
      )}
    </button>
  );
};
