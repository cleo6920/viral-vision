import React, { useCallback, useState } from 'react';
import { UploadCloud, FileVideo, X } from 'lucide-react';

interface VideoUploaderProps {
  onVideoSelect: (file: File) => void;
  isLoading: boolean;
}

export function VideoUploader({ onVideoSelect, isLoading }: VideoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/')) {
          setSelectedFile(file);
          onVideoSelect(file);
        } else {
          console.warn("Invalid file type dropped:", file.type);
        }
      }
  }, [onVideoSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        onVideoSelect(file);
      }
    }
  }, [onVideoSelect]);

  const clearSelection = () => {
    if (!isLoading) {
      setSelectedFile(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {!selectedFile ? (
        <div
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300 hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="video/*"
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isLoading}
          />
          <UploadCloud className={`w-12 h-12 mb-4 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="text-lg font-medium text-gray-700">
            Drag & drop your video here
          </p>
          <p className="text-sm text-gray-500 mt-2">
            or click to browse files
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 border rounded-xl bg-white shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <FileVideo className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium text-gray-900 truncate max-w-[200px] sm:max-w-xs">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
          {!isLoading && (
            <button
              onClick={clearSelection}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Remove video"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
