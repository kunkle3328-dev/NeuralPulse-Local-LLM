
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatSession, Message, LocalModel, 
  AppConfig, DeviceStats, ReasoningStep, PerformanceMode 
} from './types';
import { AVAILABLE_MODELS, DEFAULT_CONFIG } from './constants';
import { storageService } from './services/storageService';
import { localInference } from './services/localInference';
import { 
  SendIcon, MenuIcon, PlusIcon, SettingsIcon, 
  TrashIcon, BotIcon 
} from './components/Icons';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [deviceStats, setDeviceStats] = useState<DeviceStats>({ 
    ramUsage: 1.2, totalRam: 12, temp: 34, npuLoad: 4, batteryLevel: 98 
  });
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeSteps, setActiveSteps] = useState<ReasoningStep[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTps, setCurrentTps] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentSession = sessions.find(s => s.id === currentSessionId);

  useEffect(() => {
    const loaded = storageService.loadSessions();
    if (loaded.length > 0) {
      setSessions(loaded);
      setCurrentSessionId(loaded[0].id);
    } else createNewSession();
    
    const loadedConfig = storageService.loadConfig();
    if (loadedConfig) setConfig(loadedConfig);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDeviceStats(prev => ({
        ...prev,
        ramUsage: +(prev.ramUsage + (isStreaming ? 0.6 : -0.1)).toFixed(2),
        temp: isStreaming ? Math.min(prev.temp + 1.5, 54) : Math.max(prev.temp - 0.4, 30),
        npuLoad: isStreaming ? 92 : 3,
        batteryLevel: Math.max(0, prev.batteryLevel - (isStreaming ? 0.08 : 0.005))
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  useEffect(() => { storageService.saveSessions(sessions); }, [sessions]);
  useEffect(() => { storageService.saveConfig(config); }, [config]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentSession?.messages, isStreaming, activeSteps]);

  const createNewSession = () => {
    const s: ChatSession = {
      id: Date.now().toString(),
      title: 'Neural Core Alpha',
      messages: [],
      createdAt: Date.now(),
      lastModified: Date.now(),
      modelId: config.activeModelId
    };
    setSessions(prev => [s, ...prev]);
    setCurrentSessionId(s.id);
    setShowSidebar(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now() };
    setSessions(prev => prev.map(s => s.id === currentSessionId ? {
      ...s, messages: [...s.messages, userMsg],
      title: s.messages.length === 0 ? input.slice(0, 24) : s.title
    } : s));

    setInput('');
    setIsStreaming(true);
    setActiveSteps([]);

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), reasoningSteps: [] };
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s));

    await localInference.streamResponse(
      config,
      [...(currentSession?.messages || []), userMsg],
      (steps) => setActiveSteps(steps),
      (token, tps) => {
        setCurrentTps(tps);
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const msgs = [...s.messages];
            const idx = msgs.findIndex(m => m.id === assistantId);
            if (idx !== -1) msgs[idx] = { ...msgs[idx], content: msgs[idx].content + token, tokensPerSec: tps, reasoningSteps: activeSteps };
            return { ...s, messages: msgs };
          }
          return s;
        }));
      },
      (full, sources) => {
        setIsStreaming(false);
        setSessions(prev => prev.map(s => s.id === currentSessionId ? {
          ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, sources, reasoningSteps: [], isPersonalized: sources.length > 0 } : m)
        } : s));
      },
      (err) => { setIsStreaming(false); console.error(err); }
    );
  };

  const renderContent = (content: string) => {
    const blocks = content.split(/(\n\n|```[\s\S]*?```)/g);
    
    return blocks.map((block, i) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('```')) {
        const lines = trimmed.split('\n');
        const lang = lines[0].replace('```', '').trim() || 'code';
        const code = lines.slice(1, -1).join('\n');
        return (
          <div key={i} className="my-4 rounded-lg overflow-hidden border border-white/10 shadow-lg bg-[#0a0a0f] font-mono animate-in fade-in duration-300">
             <div className="bg-[#1a1a24] px-3 py-1.5 flex items-center justify-between border-b border-white/5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{lang}</span>
                <button 
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="text-[9px] text-indigo-400 font-bold hover:text-indigo-300 transition-colors uppercase"
                >
                  Copy
                </button>
             </div>
             <div className="p-3 overflow-x-auto no-scrollbar scroll-smooth">
                <pre className="text-[12px] leading-relaxed text-indigo-300/90 whitespace-pre">
                   {code}
                </pre>
             </div>
          </div>
        );
      }

      if (trimmed.startsWith('- ') || trimmed.match(/^\d+\. /)) {
        const items = trimmed.split('\n');
        return (
          <ul key={i} className="space-y-2 my-3 pl-5 list-disc marker:text-indigo-500">
            {items.map((item, idx) => (
              <li key={idx} className="text-[13px] font-medium leading-relaxed text-slate-200">
                {item.replace(/^(- |\d+\. )/, '')}
              </li>
            ))}
          </ul>
        );
      }

      if (trimmed.startsWith('#')) {
        const level = trimmed.match(/^#+/)?.[0].length || 1;
        const text = trimmed.replace(/^#+\s*/, '');
        const size = level === 1 ? 'text-lg' : level === 2 ? 'text-md' : 'text-sm';
        return <h4 key={i} className={`${size} font-black tracking-tight text-white mt-4 mb-2 uppercase tracking-tighter`}>{text}</h4>;
      }

      return (
        <p key={i} className="mb-3 last:mb-0 leading-[1.6] font-medium text-[13px] text-slate-200 whitespace-pre-wrap">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="flex h-full w-full max-w-lg mx-auto bg-[#07070a] text-slate-100 overflow-hidden relative font-sans">
      
      {showSidebar && <div className="fixed inset-0 bg-black/95 z-40 backdrop-blur-md transition-opacity" onClick={() => setShowSidebar(false)} />}
      <aside className={`fixed left-0 top-0 h-full w-72 bg-[#0d0d14] z-50 transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${showSidebar ? 'translate-x-0' : '-translate-x-full'} border-r border-white/5`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-900 flex items-center justify-center shadow-xl shadow-indigo-600/20">
              <BotIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
               <h2 className="text-lg font-black tracking-tighter italic text-white leading-none">NEURAL PULSE</h2>
               <span className="text-[8px] font-black text-slate-500 tracking-[0.1em] mt-0.5">IDENTITY AI</span>
            </div>
          </div>
          
          <button onClick={createNewSession} className="flex items-center justify-center gap-2 w-full p-3.5 mb-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all text-sm">
            <PlusIcon className="w-4 h-4" /> New Session
          </button>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 mb-1">Pulse Vault</h3>
            {sessions.map(s => (
              <div key={s.id} onClick={() => { setCurrentSessionId(s.id); setShowSidebar(false); }} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${currentSessionId === s.id ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' : 'hover:bg-white/5 border-transparent'}`}>
                <span className="truncate flex-1 text-xs font-bold tracking-tight">{s.title || 'Untitled'}</span>
                <TrashIcon className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.filter(x => x.id !== s.id)); }} />
              </div>
            ))}
          </div>

          <div className="mt-auto pt-6 border-t border-white/5">
            <button onClick={() => { setShowSettings(true); setShowSidebar(false); }} className="flex items-center gap-3.5 p-3 w-full rounded-xl hover:bg-white/5 transition-colors">
              <SettingsIcon className="w-4.5 h-4.5 text-slate-500" /> <span className="text-xs font-black uppercase tracking-tight text-slate-400">Settings</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex flex-col flex-1 h-full w-full relative">
        <header className="px-5 py-4 border-b border-white/5 bg-[#07070a]/90 backdrop-blur-3xl sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(true)} className="p-1.5 -ml-1 hover:bg-white/5 rounded-xl"><MenuIcon className="w-5 h-5 text-slate-400" /></button>
            <div className="flex flex-col">
              <h1 className="text-xs font-black tracking-tight text-white uppercase truncate max-w-[120px]">{currentSession?.title || 'Neural Core'}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                 <span className={`w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_5px_rgba(79,70,229,0.5)]`} />
                 <span className="text-[8px] font-black text-slate-500 tracking-tighter uppercase">{config.profile}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <div className="text-right flex flex-col items-end">
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">NPU</span>
                <span className="text-[9px] font-black text-indigo-400 tabular-nums">{isStreaming ? currentTps : '0.0'}</span>
             </div>
             <div className="w-px h-6 bg-white/10 mx-1" />
             <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-white/5 rounded-xl"><SettingsIcon className="w-4.5 h-4.5 text-slate-500" /></button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar pb-40 scroll-smooth">
          {currentSession?.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-8 py-10 animate-in fade-in zoom-in-95 duration-700">
              <div className="relative group">
                <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 via-indigo-700 to-indigo-950 rounded-[1.75rem] flex items-center justify-center shadow-xl shadow-indigo-600/20">
                  <BotIcon className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 bg-indigo-600 border border-white/20 rounded-lg px-2 py-0.5 text-[8px] font-black text-white uppercase tracking-widest">V3</div>
              </div>
              <div className="space-y-2 max-w-[240px] mx-auto">
                <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Neural Core</h2>
                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                  Private on-device intelligence. All data stays local.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[240px]">
                {['Refactor code', 'Personal plan', 'Explain RAG'].map(h => (
                  <button key={h} onClick={() => setInput(h)} className="p-3.5 bg-[#101017] border border-white/5 rounded-2xl text-[10px] font-black text-slate-500 hover:border-indigo-600 hover:text-indigo-400 transition-all text-left flex items-center justify-between">
                    {h}
                    <PlusIcon className="w-3.5 h-3.5 text-indigo-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentSession?.messages.map(m => (
            <div key={m.id} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-400`}>
              <div className={`flex flex-col gap-2 max-w-[92%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {m.role === 'assistant' && m.reasoningSteps && m.reasoningSteps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1 px-1">
                    {m.reasoningSteps.map((s, idx) => (
                      <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                        s.status === 'active' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 
                        s.status === 'complete' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                        'bg-white/5 text-slate-500 border-transparent opacity-40'
                      }`}>
                        {s.label}
                      </div>
                    ))}
                  </div>
                )}

                <div className={`p-4 rounded-2xl text-[13px] leading-relaxed shadow-lg w-full ${
                  m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none font-bold' : 'bg-[#12121c] text-slate-200 rounded-tl-none border border-white/5'
                }`}>
                  {renderContent(m.content || '')}
                </div>

                <div className="flex items-center gap-3 mt-1 px-2">
                  {m.sources && m.sources.map((s, i) => (
                    <span key={i} className="text-[8px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/10 tracking-widest">{s}</span>
                  ))}
                  {m.tokensPerSec && m.tokensPerSec > 0 && <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">{Math.round(m.tokensPerSec)} T/S</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#07070a] via-[#07070a]/98 to-transparent z-40">
          <div className="bg-[#14141f] p-3 rounded-2xl border border-white/10 shadow-2xl flex items-end gap-2 focus-within:ring-2 ring-indigo-600/30 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? "Wait..." : "Command..."}
              disabled={isStreaming}
              className="flex-1 bg-transparent border-none focus:ring-0 text-xs p-1.5 no-scrollbar resize-none max-h-32 min-h-[36px] placeholder:text-slate-700 font-bold text-white"
              rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className={`p-3 rounded-xl transition-all shadow-lg active:scale-90 flex items-center justify-center ${!input.trim() || isStreaming ? 'bg-white/5 text-slate-700' : 'bg-indigo-600 text-white shadow-indigo-600/20'}`}
            >
              <SendIcon className="w-4.5 h-4.5" />
            </button>
          </div>
          <div className="flex justify-between items-center px-4 mt-2.5">
             <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-indigo-500 animate-pulse' : 'bg-white/10'}`} />
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider">{isStreaming ? 'STREAMING' : 'READY'}</span>
             </div>
             {isStreaming && <span className="text-[9px] font-black text-indigo-500 animate-pulse uppercase">TOKENS++</span>}
          </div>
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setShowSettings(false)} />
          <div className="relative bg-[#0d0d14] w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl border-t border-white/5 space-y-8 animate-in slide-in-from-bottom-32 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tighter text-white uppercase italic">Config</h2>
              <button onClick={() => setShowSettings(false)} className="w-9 h-9 flex items-center justify-center bg-white/5 rounded-full text-slate-500 font-black">×</button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-0.5">Model Stack</label>
                <div className="space-y-2">
                  {AVAILABLE_MODELS.map(m => (
                    <div 
                      key={m.id}
                      onClick={() => setConfig({ ...config, activeModelId: m.id })}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${config.activeModelId === m.id ? 'border-indigo-600 bg-indigo-600/10' : 'border-white/5 bg-white/[0.02]'}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[13px] font-black text-white">{m.name}</span>
                        <span className="text-[8px] font-black bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-lg uppercase border border-indigo-500/20">{m.version}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Governor</label>
                   <div className="grid grid-cols-3 bg-white/5 p-1 rounded-xl border border-white/5">
                     {(['Eco', 'Balanced', 'Performance'] as PerformanceMode[]).map(p => (
                       <button key={p} onClick={() => setConfig({...config, profile: p})} className={`py-2 text-[8px] font-black rounded-lg transition-all ${config.profile === p ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>{p[0]}</button>
                     ))}
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Memory</label>
                   <div 
                     onClick={() => setConfig({ ...config, useCognitiveMemory: !config.useCognitiveMemory })}
                     className={`w-full py-2.5 rounded-xl text-[9px] font-black text-center cursor-pointer transition-all border-2 flex items-center justify-center gap-2 ${config.useCognitiveMemory ? 'border-indigo-600 bg-indigo-600/10 text-indigo-400' : 'border-white/5 text-slate-500'}`}
                   >
                     {config.useCognitiveMemory ? 'ON' : 'OFF'}
                   </div>
                 </div>
              </div>
            </div>

            <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-white text-black rounded-2xl font-black text-sm transition-transform active:scale-95 uppercase tracking-tighter">
              Save Matrix
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
