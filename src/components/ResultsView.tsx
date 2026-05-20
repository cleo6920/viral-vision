import { motion } from 'motion/react';
import { 
  Zap, 
  TrendingUp, 
  Activity, 
  MessageSquare, 
  Terminal, 
  Copy, 
  Check, 
  Star 
} from 'lucide-react';
import { useState } from 'react';
import Markdown from 'react-markdown';

interface ResultsViewProps {
  analysis: any;
}

export function ResultsView({ analysis }: ResultsViewProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT COLUMN: Main Stats & Hooks */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* Pacing Card */}
        <section className="p-8 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8">
            <Activity className="w-12 h-12 text-indigo-500/20 group-hover:text-indigo-500/40 transition-colors" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="flex flex-col items-center">
              <div className="text-5xl font-black text-indigo-400 font-mono">{analysis.pacingScore}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mt-1">Pacing Score</div>
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-bold text-white">Visual & Narrative Flow</h3>
              <div className="text-slate-400 leading-relaxed text-sm prose prose-invert max-w-none">
                <Markdown>{analysis.pacingFeedback}</Markdown>
              </div>
            </div>
          </div>
          
          <div className="mt-8 h-2 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${analysis.pacingScore}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
            />
          </div>
        </section>

        {/* Viral Hooks Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold text-white">Recommended Hooks</h2>
            <span className="text-[10px] font-mono text-slate-500 ml-auto uppercase tracking-widest">Optimized for Retention</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.hooks.map((hook, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#121214] border border-white/5 hover:border-indigo-500/30 transition-all group flex flex-col justify-between h-full">
                <div className="space-y-3">
                  <div className="text-xs font-mono text-indigo-400/70">HOOK #{i + 1}</div>
                  <p className="text-lg font-bold text-white italic">"{hook.text}"</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{hook.description}</p>
                </div>
                <button 
                  onClick={() => copyToClipboard(hook.text, i)}
                  className="mt-6 flex items-center gap-2 text-xs font-mono text-slate-500 hover:text-white transition-colors self-end"
                >
                  {copiedIndex === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedIndex === i ? 'COPIED' : 'COPY HOOK'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Suggested Captions */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Suggested Captions</h2>
          </div>
          <div className="space-y-3">
            {analysis.suggestedCaptions.map((caption, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/2 border border-white/5 flex items-start gap-4 group">
                <span className="text-xs font-mono text-slate-600 mt-1">0{i+1}</span>
                <p className="text-sm text-slate-400 flex-1">{caption}</p>
                <button 
                  onClick={() => copyToClipboard(caption, i + 10)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-600 hover:text-white"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: Trends & Prompts */}
      <div className="lg:col-span-4 space-y-8">
        
        {/* Trending Topics */}
        <section className="p-6 rounded-3xl bg-indigo-600/5 border border-indigo-500/20 space-y-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white uppercase tracking-wider text-xs font-mono">Trending Clusters</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.trendingTopics.map((topic, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
                #{topic}
              </span>
            ))}
          </div>
        </section>

        {/* Viral AI Prompts */}
        <section className="p-6 rounded-3xl bg-[#0F0F10] border border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-white uppercase tracking-wider text-xs font-mono">Advanced AI Prompts</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed italic">
            Use these prompts in Gemini or other AI tools to iterate on this specific content style.
          </p>
          <div className="space-y-4">
            {analysis.viralPrompts.map((prompt, i) => (
              <div key={i} className="p-4 rounded-xl bg-black border border-white/5 space-y-3 relative group">
                <div className="text-xs text-slate-400 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all prose prose-invert max-w-none prose-p:my-0">
                  <Markdown>{prompt}</Markdown>
                </div>
                <button 
                  onClick={() => copyToClipboard(prompt, i + 20)}
                  className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600/20 rounded-lg text-indigo-400 text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  {copiedIndex === i + 20 ? 'copied prompt' : 'copy prompt'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="p-6 rounded-3xl border border-dashed border-white/10 bg-white/2">
           <div className="flex items-center gap-2 mb-4">
             <Star className="w-5 h-5 text-yellow-500 fill-yellow-500/20" />
             <h3 className="font-bold text-white text-sm">Strategy Insight</h3>
           </div>
           <p className="text-xs text-slate-500 leading-relaxed">
             This video has high retention potential due to its visual clarity. To maximize reach, consider a "comment loop" in your caption asking users for their opinion on the trend mentioned above.
           </p>
        </section>
      </div>
    </div>
  );
}
