import React from 'react';
import { SoraPromptResult } from '../types';

interface SoraPromptViewProps {
  result: SoraPromptResult;
  onOptimize?: () => void;
}

export const SoraPromptView: React.FC<SoraPromptViewProps> = ({ result, onOptimize }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-xl font-bold mb-4">Prompt ottimizzato</h3>
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <p className="text-gray-800 font-mono text-sm whitespace-pre-wrap">{result.prompt}</p>
      </div>
      {result.visualStructure && (
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Visual Structure</h4>
          <p className="text-gray-600 text-sm">{result.visualStructure}</p>
        </div>
      )}
      {onOptimize && (
        <button
          onClick={onOptimize}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Optimize universal video prompt
        </button>
      )}
    </div>
  );
};
