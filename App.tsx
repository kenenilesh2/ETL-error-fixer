
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Search, Loader2, Database, AlertCircle, ArrowLeft, LogOut, Shield, X, CheckCircle } from 'lucide-react';
import { analyzeLog } from './services/geminiService';
import { AnalysisResult, StoredError } from './types';
import { AnalysisCard } from './components/AnalysisCard';
import { HistorySidebar } from './components/HistorySidebar';
import { supabase } from './services/supabaseClient';
import { AuthPage } from './components/AuthPage';
import { AdminDashboard } from './components/AdminDashboard';
import { TOOLS } from './components/Icons';

// --- MAIN APP COMPONENT ---

function App() {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [dbFetchError, setDbFetchError] = useState<string | null>(null);

  // ETL App State
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'manual'>('upload');
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<StoredError[]>([]);
  const [isHistoricalMatch, setIsHistoricalMatch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initSession = async () => {
        // --- EMAIL VALIDATION CHECK ---
        const urlHash = window.location.hash;
        const urlSearch = window.location.search;

        const isEmailConfirmation = 
            (urlHash && (urlHash.includes('type=signup') || urlHash.includes('type=recovery') || urlHash.includes('access_token'))) ||
            (urlSearch && urlSearch.includes('code='));

        if (isEmailConfirmation) {
            console.log("Email verification detected.");
            setValidationSuccess(true);
            window.history.replaceState(null, '', window.location.pathname);
            setTimeout(() => setValidationSuccess(false), 8000);
        }

        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            
            if (data.session) {
                setSession(data.session);
                await syncUserProfile(data.session.user);
                await checkAdmin(data.session);
            }
            
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
                setSession(session);
                if (session) {
                    await syncUserProfile(session.user);
                    await checkAdmin(session);
                }
            });
            
            setLoadingSession(false);
            return () => subscription.unsubscribe();

        } catch (err) {
            console.error("Supabase connection error:", err);
            setLoadingSession(false);
        }
    };

    initSession();
  }, []);

  // --- HISTORY FETCHING SIDE EFFECT ---
  useEffect(() => {
      if (session?.user) {
          fetchHistory(session.user);
      }
  }, [session]); 

  // Sync profile logic to handle RLS safely after authentication
  const syncUserProfile = async (user: any) => {
      try {
          const { error } = await supabase.from('profiles').upsert({
                id: user.id,
                email: user.email,
                first_name: user.user_metadata?.first_name || user.email?.split('@')[0] || 'User',
                mobile: user.user_metadata?.mobile || '',
                role: 'user' // Default to user, admin status is manually promoted in DB
           }, { onConflict: 'id', ignoreDuplicates: true }); 

           if (error && error.code !== '23505') {
               console.error("Profile sync error:", error);
           }
      } catch (e) {
          console.error("Profile sync check failed:", e);
      }
  };

  const checkAdmin = async (session: any) => {
      if (!session) {
          setIsAdmin(false);
          return;
      }
      if (session.user.email === 'admin@admin.com') {
          setIsAdmin(true);
          return;
      }
      setIsAdmin(false);
  };

  const fetchHistory = async (user: any) => {
      if (!user) return;
      setDbFetchError(null);
      
      try {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(user.id)) return;

          const { data, error } = await supabase.from('error_history')
            .select('*')
            .eq('user_id', user.id) 
            .order('created_at', { ascending: false })
            .limit(100); 

          if (error) {
              if (error.code === '42P17') {
                  setDbFetchError("Database Policy Error: Infinite Recursion detected. Please update your Supabase RLS policies.");
              } else {
                  console.error("Error fetching history:", JSON.stringify(error, null, 2));
              }
              setHistory([]);
              return;
          }

          if (data) {
              const formatted: StoredError[] = data.map((d: any) => ({
                  id: d.id,
                  timestamp: new Date(d.created_at).getTime(),
                  fingerprint: d.full_result?.fingerprint || 'unknown',
                  result: d.full_result || {},
                  count: 1 
              }));
              setHistory(formatted);
          } else {
              setHistory([]);
          }
      } catch (err) {
          console.error("Unexpected error fetching history:", err);
          setHistory([]);
      }
  };

  const handleLogout = async () => {
    try {
        await supabase.auth.signOut();
    } catch (err) {
        console.error("Logout error:", err);
    } finally {
        setSession(null);
        setHistory([]);
        setSelectedTool(null);
        setIsAdmin(false);
        setCurrentResult(null);
        setMode('upload');
        setInputText('');
    }
  }

  // --- ETL Logic Handlers ---

  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
    setMode('upload');
    setInputText('');
    setCurrentResult(null);
    setIsHistoricalMatch(false);
    setErrorMsg(null);
  };

  const handleBackToHome = () => {
    setSelectedTool(null);
    setCurrentResult(null);
    setInputText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
      setMode('manual'); 
    };
    reader.readAsText(file);
  };

  const processAnalysis = async () => {
    if (!inputText.trim()) {
        setErrorMsg("Please provide a log or error message.");
        return;
    }
    
    setErrorMsg(null);
    setIsAnalyzing(true);
    setCurrentResult(null);
    setIsHistoricalMatch(false);

    try {
      const result = await analyzeLog(inputText, selectedTool || 'Talend');
      const existingError = history.find(h => h.fingerprint === result.fingerprint);
      
      if (existingError) {
        setIsHistoricalMatch(true);
        setCurrentResult(existingError.result);
      } else {
            const { error } = await supabase.from('error_history').insert({
                user_id: session.user.id,
                tool: selectedTool,
                error_type: result.errorType,
                component: result.component,
                full_result: result
            });

            if (error) {
                console.error("History insert error:", JSON.stringify(error, null, 2));
                setErrorMsg(`Error saved locally only (DB sync failed: ${error.message})`);
            }

            const newError: StoredError = {
                id: result.id,
                timestamp: Date.now(),
                fingerprint: result.fingerprint,
                result: result,
                count: 1
            };
            setHistory([newError, ...history]);
            setCurrentResult(result);
      }
    } catch (err) {
      setErrorMsg("Failed to analyze log. Please try again.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleHistorySelect = (item: StoredError) => {
    const itemTool = item.result.tool || 'Talend';
    setSelectedTool(itemTool);
    setCurrentResult(item.result);
    setIsHistoricalMatch(item.count > 1);
    setInputText("");
    setMode('manual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearHistory = async () => {
      if(confirm("Are you sure you want to clear your history? This cannot be undone.")) {
          const { error } = await supabase.from('error_history').delete().eq('user_id', session.user.id);
          if (!error) {
              setHistory([]);
              setCurrentResult(null);
          } else {
              alert("Failed to clear history from database.");
          }
      }
  }

  const ValidationPopup = ({ onClose }: { onClose: () => void }) => (
      <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-white border border-green-200 text-green-900 px-6 py-4 rounded-xl shadow-2xl z-[100] flex items-center gap-4 animate-bounce-in ring-4 ring-green-50/50">
          <div className="bg-green-100 p-2 rounded-full">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
              <h3 className="font-bold text-lg leading-tight">Success!</h3>
              <p className="text-sm text-green-800 font-medium">Email validation done successfully.</p>
          </div>
          <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
          </button>
      </div>
  );

  if (loadingSession) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
      );
  }

  if (!session) {
      return (
        <>
            {validationSuccess && <ValidationPopup onClose={() => setValidationSuccess(false)} />}
            <AuthPage 
                onLogin={(user) => { if (user) setSession({ user }); }} 
                demoMode={false} 
                initialMode={validationSuccess ? 'login' : 'login'} 
            />
        </>
      );
  }

  if (isAdmin) {
      return (
          <>
            {validationSuccess && <ValidationPopup onClose={() => setValidationSuccess(false)} />}
            <AdminDashboard onLogout={handleLogout} />
          </>
      );
  }

  // --- LANDING PAGE VIEW ---
  if (!selectedTool) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6 relative">
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
              <h1 className="text-xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                 <Shield className="w-6 h-6 text-indigo-600" /> ETL Fixer AI
              </h1>
              <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end mr-2">
                      <span className="text-sm font-semibold text-gray-700">{session.user.user_metadata?.first_name || 'Developer'}</span>
                      <span className="text-xs text-gray-400">{session.user.email}</span>
                  </div>
                  <button 
                    onClick={handleLogout} 
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all" 
                    title="Sign Out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
              </div>
          </div>

          <div className="max-w-5xl w-full z-10 mt-10">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
                Select your ETL Platform
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Our AI specializes in debugging logs from major enterprise integration tools. Choose your platform to start analyzing.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-xl border border-gray-200 hover:border-indigo-100 transition-all duration-300 flex flex-col items-center text-center transform hover:-translate-y-1"
                >
                  <div className="w-16 h-16 mb-4 flex items-center justify-center p-2 rounded-2xl bg-gray-50 group-hover:bg-white group-hover:scale-110 transition-transform duration-300">
                    <tool.icon className="w-full h-full" />
                  </div>
                  <h3 className={`font-bold text-lg mb-1 group-hover:text-indigo-600 transition-colors`}>
                    {tool.name}
                  </h3>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    {tool.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
  }

  // --- MAIN APP VIEW ---
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <HistorySidebar 
        history={history} 
        onSelect={handleHistorySelect} 
        onClear={clearHistory}
        selectedId={currentResult?.id}
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-4">
             <button onClick={handleBackToHome} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <ArrowLeft className="w-5 h-5" />
             </button>
             <div className="h-6 w-px bg-gray-300 mx-2"></div>
             <div className="flex items-center gap-2">
                 {(() => {
                     const ToolIcon = TOOLS.find(t => t.id === selectedTool)?.icon || Database;
                     return <ToolIcon className="w-6 h-6" />;
                 })()}
                 <h1 className="text-lg font-bold text-gray-800">
                    {TOOLS.find(t => t.id === selectedTool)?.name} <span className="text-gray-400 font-normal">Analyzer</span>
                 </h1>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden md:block">
                Logged in as <span className="font-semibold text-gray-700">{session.user.user_metadata?.first_name || session.user.email}</span>
            </span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-full">
                <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="max-w-4xl mx-auto space-y-8 pb-10">
            {dbFetchError && (
                 <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
                     <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                     <div>
                         <h4 className="font-bold text-red-800 text-sm">History Load Failed</h4>
                         <p className="text-sm text-red-700">{dbFetchError}</p>
                     </div>
                 </div>
            )}
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                <div className="flex border-b border-gray-100">
                    <button 
                        onClick={() => setMode('upload')}
                        className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === 'upload' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Upload className="w-4 h-4" /> Upload Log File
                    </button>
                    <button 
                        onClick={() => setMode('manual')}
                        className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === 'manual' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Search className="w-4 h-4" /> Paste Error / Console
                    </button>
                </div>

                <div className="p-6">
                    {mode === 'upload' ? (
                        <div 
                            className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input type="file" ref={fileInputRef} className="hidden" accept=".log,.txt" onChange={handleFileUpload} />
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6" />
                            </div>
                            <h3 className="text-gray-900 font-medium">Click to upload log file</h3>
                            <p className="text-gray-500 text-sm mt-1">Supports .txt and .log files</p>
                        </div>
                    ) : (
                        <div>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={`Paste your ${selectedTool} error log or stack trace here...`}
                                className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm bg-gray-50 text-gray-800 resize-none"
                            />
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-xs text-gray-400">{inputText.length} characters</span>
                                <button
                                    onClick={processAnalysis}
                                    disabled={isAnalyzing || !inputText.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Search className="w-4 h-4" /> Analyze Error</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3 animate-fade-in">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div><h4 className="font-bold text-sm">Analysis Failed</h4><p className="text-sm opacity-90">{errorMsg}</p></div>
                </div>
            )}

            {currentResult && <AnalysisCard result={currentResult} isHistorical={isHistoricalMatch} />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
