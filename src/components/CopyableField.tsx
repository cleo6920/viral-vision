import React from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyableFieldProps {
  label: string;
  value?: string;
  onCopy: () => void;
  isCopied: boolean;
}

export const CopyableField = ({ label, value, onCopy, isCopied }: CopyableFieldProps) => {
  if (!value) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
        <button
          onClick={onCopy}
          className="p-1.5 text-zinc-500 hover:text-white transition-colors"
          title="Copia"
        >
          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 break-words">
        {value}
      </div>
    </div>
  );
};
