import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileVideo } from 'lucide-react';

interface UploaderProps {
  onUpload: (file: File) => void;
}

export function Uploader({ onUpload }: UploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('video/')) {
      alert('Please upload a video file.');
      return;
    }
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {!file ? (
        <label
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`
            relative group cursor-pointer
            flex flex-col items-center justify-center
            p-12 border-2 border-dashed rounded-3xl
            transition-all duration-300
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-500/5 ring-4 ring-indigo-500/10' 
              : 'border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/4'}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={handleChange}
            className="hidden"
          />
          
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition-colors" />
          </div>
          
          <div className="space-y-2 text-center">
            <p className="text-lg font-semibold text-white">Drag and drop your video</p>
            <p className="text-sm text-slate-500">MP4, MOV or WebM (Max 50MB for optimal analysis)</p>
          </div>

          <div className="mt-8 px-6 py-2 bg-white/5 rounded-full text-xs font-mono uppercase tracking-wider text-slate-400 border border-white/5">
            Or click to browse files
          </div>
        </label>
      ) : (
        <div className="relative rounded-3xl overflow-hidden bg-white/5 border border-white/10">
          <video 
            src={preview!} 
            className="w-full aspect-video object-cover"
            controls
          />
          <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-black/40 backdrop-blur-xl border-t border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <FileVideo className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-white truncate max-w-[200px]">{file.name}</p>
                <p className="text-xs text-slate-500 font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB • READY</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={removeFile}
                className="flex-1 md:flex-none p-3 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6 mx-auto" />
              </button>
              <button
                onClick={() => onUpload(file)}
                className="flex-1 md:flex-none px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
              >
                Launch Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
