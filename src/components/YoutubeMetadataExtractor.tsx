import React, { useState, useEffect } from 'react';
import { Loader2, Search, AlertCircle, CheckCircle, Key } from 'lucide-react';

export const YoutubeMetadataExtractor = () => {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('youtube_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleSaveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('youtube_api_key', key);
  };

  const handleFetch = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setMetadata(null);

    try {
      const response = await fetch(`/api/youtube-metadata?url=${encodeURIComponent(url)}&key=${encodeURIComponent(apiKey)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch metadata');
      setMetadata(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-bold text-white flex items-center gap-2">
        <Search className="w-6 h-6 text-red-500" />
        YouTube Metadata Extractor
      </h3>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleSaveKey(e.target.value)}
            placeholder="YouTube API Key (opzionale se configurata nel server)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 text-white"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Incolla il link YouTube..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 text-white"
        />
        <button
          onClick={handleFetch}
          disabled={loading || !url}
          className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Estrai'}
        </button>
      </div>
      {error && (
        <div className="text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}
      {metadata && (
        <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 text-zinc-300 text-sm space-y-2">
          <p><strong>Titolo:</strong> {metadata.snippet.title}</p>
          <p><strong>Canale:</strong> {metadata.snippet.channelTitle}</p>
          <p><strong>Visualizzazioni:</strong> {parseInt(metadata.statistics.viewCount).toLocaleString()}</p>
          <p><strong>Like:</strong> {parseInt(metadata.statistics.likeCount).toLocaleString()}</p>
          <p><strong>Commenti:</strong> {parseInt(metadata.statistics.commentCount).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
};
