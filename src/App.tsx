import React, { useState, useCallback, useEffect, ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, FileText, Download, X, AlertCircle, Loader2, ShieldCheck, Terminal, History, Info, RefreshCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { decryptPDF } from './lib/qpdf';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'decrypting' | 'success' | 'error' | 'needs_password';
  error?: string;
  decryptedBlob?: Blob;
  timestamp: string;
}

interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  time: string;
}

export default function App() {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [
      {
        id: Math.random().toString(36).substring(7),
        message,
        type,
        time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      },
      ...prev
    ].slice(0, 8)); // Keep last 8 logs
  }, []);

  useEffect(() => {
    addLog('Researcher Suite Online // Secure Mode Active', 'info');
  }, [addLog]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      size: file.size,
      status: 'pending' as const,
      timestamp: new Date().toISOString()
    }));
    setFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 1) {
       addLog(`Ingested ${acceptedFiles.length} research units.`, 'success');
    } else if (newFiles.length === 1) {
       setSelectedFileId(newFiles[0].id);
       addLog(`Ingested unit: ${newFiles[0].name}`, 'success');
    }
  }, [addLog]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  } as any);

  const removeFile = (id: string) => {
    const file = files.find(f => f.id === id);
    setFiles(prev => prev.filter(f => f.id !== id));
    if (selectedFileId === id) setSelectedFileId(null);
    if (file) addLog(`Purged unit: ${file.name}`, 'info');
  };

  const processDecryption = async (id: string, customPassword?: string) => {
    const fileObj = files.find(f => f.id === id);
    if (!fileObj) return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'decrypting', error: undefined } : f));
    addLog(`Decrypting ${fileObj.name}...`, 'info');
    
    try {
      const arrayBuffer = await fileObj.file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const decryptedData = await decryptPDF(uint8Array, customPassword || password);
      
      const blob = new Blob([decryptedData], { type: 'application/pdf' });
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'success', 
        decryptedBlob: blob,
        error: undefined 
      } : f));
      addLog(`System Bypass Success: ${fileObj.name}`, 'success');
    } catch (err: any) {
      const errorMsg = err?.message || 'Decryption failed';
      
      if (errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('authorized')) {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'needs_password' } : f));
        addLog(`Vault Restricted: ${fileObj.name}`, 'warning');
      } else {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: errorMsg } : f));
        addLog(`Failure: ${errorMsg.slice(0, 50)}...`, 'error');
      }
    }
  };

  const handleBulkApplyPassword = () => {
    const targets = files.filter(f => f.status === 'needs_password' || f.status === 'pending');
    targets.forEach(f => processDecryption(f.id));
    if (targets.length > 0) {
      addLog(`Batch syncing credentials for ${targets.length} units.`, 'info');
    }
  };

  const downloadFile = (file: PDFFile) => {
    if (!file.decryptedBlob) return;
    const url = URL.createObjectURL(file.decryptedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unlocked_${file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog(`Exported result segment: ${file.name}`, 'success');
  };

  const selectedFile = files.find(f => f.id === selectedFileId);

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-8 overflow-x-hidden selection:bg-indigo-600 selection:text-white bg-slate-50">
      {/* Header */}
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-200">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">CipherPDF</h1>
              <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">v1.2.0</span>
            </div>
            <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1">Professional Researcher Suite</p>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Protocol Status</span>
            <span className={cn(
              "text-sm font-bold flex items-center gap-2",
              window.crossOriginIsolated ? "text-emerald-500" : "text-amber-500"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                window.crossOriginIsolated ? "bg-emerald-500" : "bg-amber-500"
              )} />
              {window.crossOriginIsolated ? "Secure & Isolated" : "Standard Mode"}
            </span>
            {!window.crossOriginIsolated && (
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noreferrer"
                className="text-[9px] text-amber-600 underline font-bold mt-1"
              >
                Unlock Isolation (Open in New Tab)
              </a>
            )}
          </div>

          <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
          </div>
        </div>
      </header>

      {/* Bento Grid Container */}
      <div className="grid grid-cols-12 gap-6 flex-1">
        
        {/* Main Upload / File Queue Area */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <div 
            {...getRootProps()}
            className={cn(
              "bento-card border-none flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden group cursor-pointer",
              isDragActive ? "bg-indigo-50 border-2 border-dashed border-indigo-600" : "bg-white"
            )}
          >
            <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center mb-8 transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
              {isDragActive ? (
                <Unlock className="w-12 h-12 text-indigo-600 animate-bounce" />
              ) : (
                <Lock className="w-12 h-12 text-indigo-600" />
              )}
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 mb-3 tracking-tight text-center">
              {isDragActive ? "Inbound Data Streams" : "Drop Encrypted Research"}
            </h2>
            <p className="text-slate-500 text-center max-w-sm mb-10 text-sm leading-relaxed">
              Drag your password-protected research papers here to begin the 
              <span className="text-indigo-600 font-bold"> local decryption process</span>.
            </p>
            <button className="px-10 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
              Initialize Local Source
            </button>
            <input {...getInputProps()} />

            <div className="mt-12 flex flex-wrap justify-center gap-3">
              {['Max 250MB', 'AES-256 System', 'Local-Only', 'Batch Sync'].map(tag => (
                <span key={tag} className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Files List / Queue */}
          <div className="bento-card flex flex-col p-6 min-h-[300px] bg-white">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Active Queue</h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">DOCUMENT INVENTORY // {files.length} UNITS</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setFiles([])}
                  disabled={files.length === 0}
                  className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors disabled:opacity-20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 custom-scrollbar overflow-y-auto max-h-[400px] pr-2">
              <AnimatePresence mode="popLayout">
                {files.map((file) => (
                  <motion.div 
                    layout
                    key={file.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setSelectedFileId(file.id)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group/item",
                      selectedFileId === file.id ? "bg-indigo-50 border-indigo-200 shadow-sm" : "bg-white border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1 overflow-hidden">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                        file.status === 'success' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400 group-hover/item:bg-indigo-100 group-hover/item:text-indigo-600"
                      )}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-slate-800 text-sm truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{(file.size / 1024).toFixed(2)} KB // PDF DATA</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {file.status === 'pending' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); processDecryption(file.id); }}
                          className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
                        >
                          Unlock
                        </button>
                      )}
                      {file.status === 'decrypting' && (
                        <div className="flex items-center gap-2 overflow-hidden px-4">
                           <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                           <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">Processing</span>
                        </div>
                      )}
                      {file.status === 'success' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                          className="bg-emerald-500 text-white p-2 rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {file.status === 'needs_password' && (
                        <div className="px-4 py-2 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl text-[10px] font-bold uppercase tracking-tight">
                          Locked
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {files.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center opacity-20">
                  <FileText className="w-12 h-12 mb-4" strokeWidth={1} />
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-loose text-center">Queue Vacuum Active<br/>Awaiting Ingestion...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          
          {/* Security Config */}
          <div className="dark-card p-10 flex flex-col bg-slate-900 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-10 z-10 relative">
              <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.2em]">Credential Control</span>
              <ShieldCheck className="w-6 h-6 text-slate-500" />
            </div>
            
            <label className="text-[11px] text-slate-400 font-bold uppercase mb-4 ml-1 tracking-[0.1em] z-10 relative">Access Token / Master Key</label>
            <div className="relative group mb-8 z-10">
              <input 
                type="password" 
                placeholder="••••••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border-none rounded-2xl p-5 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-600 transition-all outline-none"
              />
              <Lock className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-600 transition-colors" />
            </div>

            <button 
              onClick={handleBulkApplyPassword}
              disabled={files.length === 0}
              className="w-full py-5 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-slate-950/20 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-3 text-sm tracking-widest z-10"
            >
              <Terminal className="w-5 h-5" />
              Sync Local Vault
            </button>
            
            <div className="mt-10 pt-10 border-t border-slate-800/50 z-10 relative">
              <p className="text-[11px] text-indigo-300 font-medium leading-relaxed bg-indigo-500/5 p-5 rounded-2xl border border-indigo-500/10">
                System detection: <span className="text-white font-mono">Acrobat X+ Standard Encrypted</span>
                <br/>
                <span className="mt-3 block opacity-60 italic text-[10px]">Note: Handshakes occur strictly on local memory layers.</span>
              </p>
            </div>

            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-[100px] rounded-full -mr-16 -mt-16" />
          </div>

          {/* Active File Metadata */}
          <div className="bento-card p-8 flex flex-col min-h-[260px] bg-white group/focus">
             <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-8 group-hover/focus:text-indigo-600 transition-colors">In-Focus Document</span>
             {selectedFile ? (
               <div className="space-y-8">
                 <div className="flex items-center gap-5">
                   <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shadow-sm border border-rose-100 flex-shrink-0 group-hover/focus:scale-105 transition-transform duration-500">
                     <FileText className="w-9 h-9" strokeWidth={1.5} />
                   </div>
                   <div className="overflow-hidden">
                     <p className="font-bold text-slate-900 truncate pr-4 text-lg tracking-tight leading-tight">{selectedFile.name}</p>
                     <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • PDF STREAM</p>
                   </div>
                 </div>

                 <div className="space-y-5">
                   <div className="flex justify-between items-center text-xs">
                     <span className="text-slate-500 font-bold tracking-tight uppercase flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        Vault Status
                     </span>
                     <span className={cn(
                       "font-black uppercase tracking-[0.1em] text-sm",
                       selectedFile.status === 'success' ? "text-emerald-500" : "text-rose-500"
                     )}>
                       {selectedFile.status === 'success' ? "Unlocked" : "Locked"}
                     </span>
                   </div>
                   <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-1 shadow-inner">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: selectedFile.status === 'success' ? '100%' : '10%' }}
                       className={cn(
                        "h-full rounded-full shadow-[0_0_15px_rgba(79,70,229,0.3)]",
                        selectedFile.status === 'success' ? "bg-emerald-500" : "bg-indigo-600"
                       )}
                     />
                   </div>
                   <p className="text-[10px] text-slate-400 font-bold italic opacity-60 text-center tracking-widest uppercase">Analysis: Metadata scrub complete</p>
                 </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                 <Info className="w-12 h-12 mb-4" />
                 <p className="text-[10px] font-bold uppercase tracking-[0.2em]">No Focus Unit</p>
               </div>
             )}
          </div>

          {/* Diagnostics Log Bento */}
          <div className="bento-card p-10 flex flex-col justify-between bg-indigo-50 border-indigo-100">
            <span className="text-indigo-900 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Diagnostics Engine</span>
            <div className="grid grid-cols-2 gap-5 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm text-center transform hover:scale-105 transition-all">
                <p className="text-2xl font-black text-slate-900 leading-none">100%</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-3 tracking-tighter">Privacy</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm text-center transform hover:scale-105 transition-all">
                <p className="text-2xl font-black text-slate-900 leading-none">~0.4s</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-3 tracking-tighter">Speed</p>
              </div>
            </div>
            
            {/* Real-time Logs */}
            <div className="pt-8 border-t border-indigo-200">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Real-time Log</span>
              </div>
              <div className="h-32 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {logs.map(log => (
                  <div key={log.id} className="text-[10px] font-mono leading-tight flex gap-3 p-2 bg-white/50 rounded-lg">
                    <span className="text-slate-400 font-medium">[{log.time}]</span>
                    <span className={cn(
                      "font-bold uppercase tracking-tight",
                      log.type === 'success' ? "text-emerald-600" :
                      log.type === 'error' ? "text-rose-600" :
                      log.type === 'warning' ? "text-amber-600" : "text-slate-600"
                    )}>
                      {log.message}
                    </span>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-[10px] font-mono opacity-20 italic uppercase tracking-[0.2em] text-center py-4">Awaiting system events...</p>}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Bar */}
      <footer className="mt-16 flex flex-col md:flex-row justify-between items-center gap-10 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] py-10 border-t border-slate-200">
        <div className="flex gap-10">
          <span className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Local processing Layer
          </span>
          <span className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shadow-sm" />
            GDPR COMPLIANT SUBSTRATE
          </span>
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-2 rounded-full border border-slate-200 shadow-sm">
          SYSTEM V1.2.0-STABLE
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        </div>
      </footer>
    </div>
  );
}
