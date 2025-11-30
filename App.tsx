import React, { useState, useEffect, useRef } from 'react';
import { Upload, Search, Loader2, Database, AlertCircle, ArrowLeft, LogOut, Shield, X, CheckCircle, Terminal, Copy, Check, Menu, Moon, Sun, Sparkles, Command, ChevronRight } from 'lucide-react';
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
  const [recoveryMode, setRecoveryMode] = useState(false); // State for password reset flow (via Link)
  const [manualRecoveryActive, setManualRecoveryActive] = useState(false); // State for manual OTP reset flow
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
      if (typeof window !== 'undefined') {
          return document.documentElement.classList.contains('dark');
      }
      return false;
  });

  // Delete Error State
  const [deleteError, setDeleteError] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

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

  // Mobile Menu State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const initSession = async () => {
        // --- EMAIL VALIDATION CHECK ---
        const urlHash = window.location.hash;
        const urlSearch = window.location.search;

        const isEmailConfirmation = 
            (urlHash && (urlHash.includes('type=signup') || urlHash.includes('type=recovery') || urlHash.includes('access_token'))) ||
            (urlSearch && urlSearch.includes('code='));

        if (isEmailConfirmation) {
            console.log("Email verification/recovery detected.");
            // If it's a recovery flow, we'll let onAuthStateChange handle the mode switch
            if (!urlHash.includes('type=recovery')) {
                setValidationSuccess(true);
                setTimeout(() => setValidationSuccess(false), 8000);
            }
            window.history.replaceState(null, '', window.location.pathname);
        }

        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            
            if (data.session) {
                setSession(data.session);
                await syncUserProfile(data.session.user);
                await checkAdmin(data.session);
            }
            
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'PASSWORD_RECOVERY') {
                    setRecoveryMode(true);
                }
                
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
      if (session?.user && !recoveryMode) {
          fetchHistory(session.user);
      }
  }, [session, recoveryMode]); 

  // Toggle Theme
  const toggleTheme = () => {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      if (newMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
      }
  };

  // Sync profile logic to handle RLS safely after authentication
  const syncUserProfile = async (user: any) => {
      try {
          const { error } = await supabase.from('profiles').upsert({
                id: user.id,
                email: user.email,
                first_name: user.user_metadata?.first_name || user.email?.split('@')[0] || 'User',
                mobile: user.user_metadata?.mobile || '',
                // Note: We do NOT set role here to avoid overwriting existing admin roles
           }, { onConflict: 'id', ignoreDuplicates: false }); // ignoreDuplicates: false allows updating name/mobile but we should be careful about role

           if (error) {
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
      
      // Dynamic check: Query the profile to see if the user has the 'admin' role
      try {
          const { data, error } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
          
          if (data && data.role === 'admin') {
              setIsAdmin(true);
          } else {
              setIsAdmin(false);
          }
      } catch (e) {
          console.error("Error checking admin status:", e);
          setIsAdmin(false);
      }
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
        setRecoveryMode(false);
        setManualRecoveryActive(false);
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
    } catch (err: any) {
      const message = err.message || "Failed to analyze log. Please try again.";
      setErrorMsg(message);
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
    setMobileMenuOpen(false); // Close menu on mobile select
  };

  const handleCopySqlFix = () => {
      navigator.clipboard.writeText(`create policy "Users can delete own history" on public.error_history for delete using (auth.uid() = user_id);`);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
  };

  const deleteHistoryItem = async (id: string) => {
      if(!confirm("Delete this analysis?")) return;
      
      setDeleteError(false);
      try {
          const { error } = await supabase.from('error_history').delete().eq('id', id);
          if (error) {
              console.error("Delete failed:", error);
              setDeleteError(true);
          } else {
              setHistory(history.filter(h => h.id !== id));
              if (currentResult?.id === id) {
                  setCurrentResult(null);
              }
          }
      } catch (e) {
          console.error("Delete exception:", e);
          setDeleteError(true);
      }
  };

  const clearHistory = async () => {
      if(confirm("Are you sure you want to clear your ENTIRE history? This cannot be undone.")) {
          setDeleteError(false);
          try {
              const { error } = await supabase.from('error_history').delete().eq('user_id', session.user.id);
              if (!error) {
                  setHistory([]);
                  setCurrentResult(null);
              } else {
                  console.error("Clear history failed:", error);
                  setDeleteError(true);
              }
          } catch (e) {
              console.error("Clear history exception:", e);
              setDeleteError(true);
          }
      }
  }

  const ValidationPopup = ({ onClose }: { onClose: () => void }) => (
      <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-800 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100 px-6 py-4 rounded-xl shadow-2xl z-[100] flex items-center gap-4 animate-bounce-in ring-4 ring-green-50/50 dark:ring-green-900/50">
          <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-full">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
              <h3 className="font-bold text-lg leading-tight">Success!</h3>
              <p className="text-sm text-green-800 dark:text-green-300 font-medium">Email validation done successfully.</p>
          </div>
          <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full">
              <X className="w-5 h-5" />
          </button>
      </div>
  );

  const SqlFixModal = () => (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-slate-700">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 border-b border-red-100 dark:border-red-900/30 flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  <h3 className="font-bold text-red-900 dark:text-red-200">Permission Denied</h3>
                  <button onClick={() => setDeleteError(false)} className="ml-auto text-red-400 hover:text-red-700 dark:hover:text-red-300">
                      <X className="w-5 h-5" />
                  </button>
              </div>
              <div className="p-6">
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                      Supabase blocked the delete request. You need to enable a "DELETE" policy in your database.
                  </p>
                  <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
                            <Terminal className="w-3 h-3" /> SQL Fix
                        </span>
                        <button 
                            onClick={handleCopySqlFix}
                            className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                        >
                            {copiedSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedSql ? 'Copied' : 'Copy SQL'}
                        </button>
                    </div>
                    <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
                        {`create policy "Users can delete own history" on public.error_history for delete using (auth.uid() = user_id);`}
                    </pre>
                  </div>
                  <p className="text-xs text-gray-400 mt-4">
                      Run this in your Supabase SQL Editor to enable deletion.
                  </p>
              </div>
          </div>
      </div>
  );

  if (loadingSession) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
      );
  }

  // RECOVERY MODE CHECK: Show Update Password Screen (from Link)
  if (recoveryMode) {
      return (
          <AuthPage 
              onLogin={() => setRecoveryMode(false)}
              demoMode={false} 
              initialMode="update_password" 
              onRecoveryComplete={handleLogout}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
          />
      );
  }

  // --- SHOW AUTH PAGE IF NOT LOGGED IN OR IN MANUAL RECOVERY FLOW ---
  // We keep the AuthPage mounted if manualRecoveryActive is true, even if a session exists (from OTP verification)
  // This ensures the "verify -> update -> logout" sequence completes without the Main App mounting prematurely.
  if (!session || manualRecoveryActive) {
      return (
        <>
            {validationSuccess && <ValidationPopup onClose={() => setValidationSuccess(false)} />}
            <AuthPage 
                onLogin={(user) => { if (user) setSession({ user }); }} 
                demoMode={false} 
                initialMode={validationSuccess ? 'login' : 'login'}
                setManualRecoveryActive={setManualRecoveryActive}
                onRecoveryComplete={handleLogout}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
            />
        </>
      );
  }

  if (isAdmin) {
      return (
          <>
            {validationSuccess && <ValidationPopup onClose={() => setValidationSuccess(false)} />}
            <AdminDashboard 
                onLogout={handleLogout} 
                isDarkMode={isDarkMode} 
                toggleTheme={toggleTheme} 
                userEmail={session.user.email} 
            />
          </>
      );
  }

  // --- LANDING PAGE VIEW (Opening Page) ---
  if (!selectedTool) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative transition-colors duration-300 font-sans selection:bg-indigo-500/30 selection:text-indigo-600 dark:selection:text-indigo-300">
            {/* Ambient Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                 <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/20 blur-[120px] rounded-full"></div>
                 <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-blue-500/10 dark:bg-blue-600/10 blur-[100px] rounded-full"></div>
            </div>

            {/* Navigation */}
            <header className="sticky top-0 z-50 w-full backdrop-blur-lg bg-white/70 dark:bg-slate-900/70 border-b border-gray-200/50 dark:border-slate-800/50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                         <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                            <Shield className="w-6 h-6 text-white" />
                         </div>
                         <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 tracking-tight">
                             ETL Remedy
                         </h1>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col items-end mr-2">
                             <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                {session.user.user_metadata?.first_name || 'Developer'}
                             </span>
                             <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
                                Enterprise User
                             </span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                        <button onClick={toggleTheme} className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={handleLogout} 
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-slate-200 dark:border-slate-700 rounded-full transition-all text-sm font-medium shadow-sm hover:shadow-md" 
                        >
                            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign Out</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl mx-auto px-6 pt-16 pb-24 relative z-10 w-full">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-widest border border-indigo-100 dark:border-indigo-800 mb-6">
                        <Sparkles className="w-3 h-3" /> Intelligent Log Analysis
                    </div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight leading-tight">
                        Select your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">ETL Platform</span>
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Identify errors instantly. Get code-level fixes. Analyze logs from Talend, Informatica, and more with our enterprise-grade AI engine.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {TOOLS.map((tool) => (
                        <button
                            key={tool.id}
                            onClick={() => handleToolSelect(tool.id)}
                            className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all duration-500 flex flex-col items-center text-center overflow-hidden"
                        >
                            {/* Hover Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/0 to-indigo-50/50 dark:from-indigo-900/0 dark:to-indigo-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            
                            <div className="relative z-10 w-16 h-16 mb-6 flex items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <tool.icon className="w-full h-full drop-shadow-sm" />
                            </div>
                            
                            <div className="relative z-10">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                                    {tool.name}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
                                    {tool.description}
                                </p>
                            </div>

                            <div className="absolute bottom-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1">
                                Analyze Logs <ChevronRight className="w-3 h-3" />
                            </div>
                        </button>
                    ))}
                </div>
            </main>
        </div>
      );
  }

  // --- MAIN APP VIEW ---
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <HistorySidebar 
        history={history} 
        onSelect={handleHistorySelect} 
        onClear={clearHistory}
        onDelete={deleteHistoryItem}
        selectedId={currentResult?.id}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      
      {deleteError && <SqlFixModal />}
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 h-16 flex items-center justify-between px-4 md:px-6 shadow-sm shrink-0 z-10 transition-colors duration-300">
          <div className="flex items-center gap-2 md:gap-4">
             {/* Mobile Menu Toggle */}
             <button 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md"
             >
                <Menu className="w-5 h-5" />
             </button>

             <button onClick={handleBackToHome} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors">
                <ArrowLeft className="w-5 h-5" />
             </button>
             <div className="h-6 w-px bg-gray-300 dark:bg-slate-700 mx-1 md:mx-2"></div>
             <div className="flex items-center gap-2">
                 {(() => {
                     const ToolIcon = TOOLS.find(t => t.id === selectedTool)?.icon || Database;
                     return <ToolIcon className="w-5 h-5 md:w-6 md:h-6" />;
                 })()}
                 <h1 className="text-base md:text-lg font-bold text-gray-800 dark:text-white truncate max-w-[150px] md:max-w-none">
                    {TOOLS.find(t => t.id === selectedTool)?.name} <span className="text-gray-400 dark:text-slate-500 font-normal hidden sm:inline">Analyzer</span>
                 </h1>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-slate-800">
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                Logged in as <span className="font-semibold text-gray-700 dark:text-gray-300">{session.user.user_metadata?.first_name || session.user.email}</span>
            </span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full">
                <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-10">
            {dbFetchError && (
                 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 p-4 rounded-lg flex items-start gap-3">
                     <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                     <div>
                         <h4 className="font-bold text-red-800 dark:text-red-200 text-sm">History Load Failed</h4>
                         <p className="text-sm text-red-700 dark:text-red-300">{dbFetchError}</p>
                     </div>
                 </div>
            )}
            
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-1 transition-colors duration-300">
                <div className="flex border-b border-gray-100 dark:border-slate-800">
                    <button 
                        onClick={() => setMode('upload')}
                        className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === 'upload' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Upload Log File</span> <span className="sm:hidden">Upload</span>
                    </button>
                    <button 
                        onClick={() => setMode('manual')}
                        className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === 'manual' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        <Search className="w-4 h-4" /> <span className="hidden sm:inline">Paste Error / Console</span> <span className="sm:hidden">Paste</span>
                    </button>
                </div>

                <div className="p-4 md:p-6">
                    {mode === 'upload' ? (
                        <div 
                            className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg p-6 md:p-10 text-center hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input type="file" ref={fileInputRef} className="hidden" accept=".log,.txt" onChange={handleFileUpload} />
                            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6" />
                            </div>
                            <h3 className="text-gray-900 dark:text-white font-medium">Click to upload log file</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mt-1">Supports .txt and .log files</p>
                        </div>
                    ) : (
                        <div>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={`Paste your ${selectedTool} error log or stack trace here...`}
                                className="w-full h-40 p-4 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-gray-200 resize-none transition-colors"
                            />
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-xs text-gray-400 dark:text-gray-500">{inputText.length} chars</span>
                                <button
                                    onClick={processAnalysis}
                                    disabled={isAnalyzing || !inputText.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-6 py-2 rounded-lg font-medium shadow-md transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
                                >
                                    {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Search className="w-4 h-4" /> Analyze</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-start gap-3 animate-fade-in">
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