import React, { useRef, useState, useEffect } from 'react';
import { useImageStore } from '../../store/useImageStore';
import { UploadCloud, Image as ImageIcon, Clipboard, Plus, ShieldCheck } from 'lucide-react';

interface UploadBoxProps {
  onImagesReady?: () => void;
  compact?: boolean;
}

export const UploadBox: React.FC<UploadBoxProps> = ({ onImagesReady, compact = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addFiles, isPreparing, preparingProgress } = useImageStore();

  // Handle Clipboard Paste (Ctrl + V / Cmd + V) globally on page
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        processFiles(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processFiles = async (files: File[] | FileList) => {
    // If on tool upload page (compact is false), start fresh by replacing previous photos!
    // If inside editor (compact is true), append to the existing batch.
    const res = await addFiles(files, { replace: !compact });
    if (res.added > 0 && onImagesReady) {
      onImagesReady();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value so same files can be chosen again if needed
      e.target.value = '';
    }
  };

  if (compact) {
    return (
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-sm cursor-pointer"
          title="Add more photos"
        >
          <Plus className="w-4 h-4" />
          <span>Add Images</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group cursor-pointer w-full py-16 px-6 sm:px-12 rounded-3xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-center bg-white shadow-xl shadow-slate-100/70 ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/40 scale-[1.008]'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
        }`}
      >
        {/* Progress Overlay during image read */}
        {isPreparing && (
          <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 animate-pulse">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-1">Preparing your images...</h4>
            <p className="text-xs text-slate-500 mb-4">Reading metadata and generating fast local thumbnails</p>
            <div className="w-64 max-w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-200"
                style={{ width: `${preparingProgress}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-600 mt-2">{preparingProgress}%</span>
          </div>
        )}

        {/* Cloud Upload Icon */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200 mb-5">
          <UploadCloud className="w-10 h-10" />
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="mb-3 px-8 py-3.5 rounded-2xl font-bold text-base bg-blue-600 text-white shadow-md shadow-blue-600/20 group-hover:bg-blue-700 transition-colors pointer-events-none"
        >
          Select Images
        </button>

        <p className="text-sm font-medium text-slate-600 mb-2">
          or drag & drop your images here
        </p>

        {/* Keyboard shortcut and format badge */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-md text-slate-600 font-mono text-[11px]">
            <Clipboard className="w-3 h-3 text-slate-400" />
            Ctrl + V to paste
          </span>
          <span>•</span>
          <span>Supports JPG, PNG, WebP, GIF, SVG</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% Client-Side Privacy
          </span>
        </div>
      </div>
    </div>
  );
};
