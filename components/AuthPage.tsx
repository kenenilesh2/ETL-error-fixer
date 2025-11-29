
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, AlertCircle, User, Phone, Mail, Lock, ArrowLeft, CheckCircle, KeyRound, RefreshCw, Shield, Zap, TrendingUp, Check } from 'lucide-react';

interface AuthPageProps {
  onLogin: (user?: any) => void;
  demoMode: boolean;
  initialMode?: 'login' | 'register';
}

export function AuthPage({ onLogin, demoMode, initialMode = 'login' }: AuthPageProps) {
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'verify'>('login');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  useEffect(() => {
      if (initialMode === 'login' || initialMode === 'register') {
          setView(initialMode);
      }
  }, [initialMode]);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleResendOtp = async () => {
      if (resendTimer > 0) return;
      setLoading(true);
      setMsg(null);
      try {
          const { error } = await supabase.auth.resend({
              type: 'signup',
              email: email.trim()
          });
          
          if (error) {
              if (error.message.includes("already registered") || error.message.includes("already confirmed")) {
                  setMsg({ type: 'error', text: 'This email is already active. Please return to Login.' });
              } else {
                  throw error;
              }
          } else {
              setMsg({ type: 'success', text: 'New code sent! Previous codes are now invalid.' });
              setResendTimer(60); 
          }
      } catch (err: any) {
          console.error("Resend Error:", err);
          setMsg({ type: 'error', text: err.message });
      } finally {
          setLoading(false);
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
        if (view === 'login') {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanPassword,
            });
            if (error) throw error;
            // Login successful
        } else if (view === 'register') {
            const { data, error } = await supabase.auth.signUp({
              email: cleanEmail,
              password: cleanPassword,
              options: {
                data: {
                  first_name: firstName.trim(),
                  mobile: mobile.trim(),
                },
              }
            });
            if (error) throw error;

            if (data.session) {
                 setMsg({ type: 'success', text: 'Account already active. Logging you in...' });
                 return;
            }
            
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                 setMsg({ type: 'error', text: 'This email is already registered. Please Log In instead.' });
                 return;
            }
            
            setMsg({ type: 'success', text: 'Registration successful! Enter the code sent to your email.' });
            setView('verify');
            setResendTimer(30);
        } else if (view === 'verify') {
            const cleanOtp = otp.trim();
            
            // 1. Attempt verification
            const { data, error } = await supabase.auth.verifyOtp({
                email: cleanEmail,
                token: cleanOtp,
                type: 'signup'
            });
            
            if (error) {
                console.warn("OTP Verification failed:", error.message);
                
                // 2. SMART FALLBACK: 
                if (cleanPassword) {
                    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                        email: cleanEmail,
                        password: cleanPassword
                    });
                    
                    if (!loginError && loginData.session) {
                        setMsg({ type: 'success', text: 'Verified successfully (via login). Redirecting...' });
                        return; // Success!
                    }
                }

                if (error.message.includes("expired") || error.message.includes("invalid")) {
                    throw new Error("Invalid or expired code. Did you request a new one? Only the latest code works.");
                }
                throw error;
            }
            
            setMsg({ type: 'success', text: 'Email verified successfully! Logging you in...' });
        } else if (view === 'forgot') {
            const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
                redirectTo: window.location.origin
            });
            if (error) throw error;
            setMsg({ type: 'success', text: 'Password reset link sent to your email.' });
        }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let errorMessage = err.message || "An unexpected error occurred";
      if (err.message === "Invalid login credentials") {
          errorMessage = "Invalid email or password.";
      } else if (err.message.includes("User already registered")) {
          errorMessage = "User already registered. Please Log In.";
      }
      setMsg({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
      // --- VERIFY OTP VIEW ---
      if (view === 'verify') {
          return (
              <div className="space-y-6 animate-fade-in">
                  <div className="text-center space-y-2 mb-8">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600 mb-4">
                          <Mail className="w-6 h-6" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900">Check your email</h3>
                      <p className="text-gray-500">We sent a verification code to <span className="font-semibold text-gray-800">{email}</span></p>
                  </div>
                  
                  <form onSubmit={handleAuth}>
                    <div>
                        <div className="relative">
                            <KeyRound className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" />
                            <input 
                            type="text" 
                            required 
                            maxLength={8}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all tracking-[0.5em] font-mono text-center font-bold text-xl text-gray-800"
                            placeholder="000000"
                            value={otp}
                            onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">Enter the most recent code received.</p>
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading || otp.length < 6}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl mt-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                        Verify & Access
                    </button>
                   </form>

                   <div className="flex flex-col gap-3 mt-6">
                        <button 
                            type="button"
                            onClick={handleResendOtp}
                            disabled={resendTimer > 0 || loading}
                            className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : "Resend Code"}
                        </button>
                        
                        <button 
                            type="button"
                            onClick={() => setView('register')}
                            className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 flex items-center justify-center gap-2 text-sm"
                        >
                            Incorrect email? Go back
                        </button>
                   </div>
              </div>
          );
      }

      // --- FORGOT PASSWORD VIEW ---
      if (view === 'forgot') {
          return (
              <form onSubmit={handleAuth} className="space-y-5 animate-fade-in mt-6">
                  <div className="text-center mb-8">
                      <h3 className="text-xl font-bold text-gray-900">Reset Password</h3>
                      <p className="text-sm text-gray-500 mt-2">Enter your email to receive reset instructions</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5 ml-1">Email Address</label>
                    <div className="relative group">
                        <Mail className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input 
                        type="email" 
                        required 
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                        placeholder="name@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                   </div>
                   <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl mt-6 flex items-center justify-center gap-2"
                    >
                    {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                    Send Reset Link
                    </button>
                    <button 
                        type="button"
                        onClick={() => setView('login')}
                        className="w-full text-gray-500 hover:text-gray-800 font-medium py-2 flex items-center justify-center gap-2 mt-4"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Login
                    </button>
              </form>
          );
      }

      // --- LOGIN & REGISTER VIEW ---
      return (
        <form onSubmit={handleAuth} className="space-y-5 animate-fade-in mt-2">
            {view === 'register' && (
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5 ml-1">First Name</label>
                    <div className="relative group">
                        <User className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input 
                            type="text" 
                            required 
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                            placeholder="John"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                        />
                    </div>
                </div>
                <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5 ml-1">Mobile</label>
                    <div className="relative group">
                        <Phone className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input 
                            type="tel" 
                            required 
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                            placeholder="+1 234..."
                            value={mobile}
                            onChange={e => setMobile(e.target.value)}
                        />
                    </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                <input 
                  type="email" 
                  required 
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5 ml-1">Password</label>
              <div className="relative group">
                <Lock className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                <input 
                  type="password" 
                  required 
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {view === 'login' && (
                <div className="flex justify-end -mt-1">
                    <button 
                        type="button"
                        onClick={() => setView('forgot')}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    >
                        Forgot Password?
                    </button>
                </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl mt-8 flex items-center justify-center gap-2 transform active:scale-[0.98]"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {view === 'login' ? 'Sign In' : 'Create Account'}
            </button>
        </form>
      );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* LEFT SIDE - BRANDING */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 text-white">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500 blur-[120px]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500 blur-[120px]"></div>
          </div>
          
          <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                  <div className="bg-indigo-600 p-2 rounded-lg">
                      <Shield className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-bold text-2xl tracking-tight">ETL Remedy</span>
              </div>
              
              <h1 className="text-5xl font-extrabold leading-tight mb-6">
                  Intelligent Error <br/> 
                  <span className="text-indigo-400">Resolution Platform</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                  Automate your ETL debugging process. Detect errors, identify root causes, and get instant fix suggestions powered by advanced AI.
              </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-6">
             <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                 <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300">
                     <Zap className="w-5 h-5" />
                 </div>
                 <div>
                     <h4 className="font-bold text-sm">Instant Analysis</h4>
                     <p className="text-xs text-slate-400 mt-1">Reduce debugging time from hours to seconds.</p>
                 </div>
             </div>
             <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                 <div className="p-2 bg-green-500/20 rounded-lg text-green-300">
                     <TrendingUp className="w-5 h-5" />
                 </div>
                 <div>
                     <h4 className="font-bold text-sm">Optimization Tips</h4>
                     <p className="text-xs text-slate-400 mt-1">Get performance improvement suggestions for every error.</p>
                 </div>
             </div>
          </div>
          
          <div className="relative z-10 text-xs text-slate-500">
              © {new Date().getFullYear()} ETL Remedy. Enterprise Grade Security.
          </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
         <div className="max-w-md w-full bg-white lg:bg-transparent rounded-2xl lg:rounded-none shadow-2xl lg:shadow-none p-8 lg:p-0">
             {/* Mobile Logo */}
             <div className="lg:hidden flex items-center gap-2 mb-8 justify-center text-slate-900">
                  <Shield className="w-8 h-8 text-indigo-600" />
                  <span className="font-bold text-2xl">ETL Remedy</span>
             </div>

             <div className="mb-8">
                 <h2 className="text-2xl font-bold text-gray-900">
                     {view === 'login' ? 'Welcome back' : view === 'register' ? 'Get started' : view === 'verify' ? 'Verification' : 'Reset Password'}
                 </h2>
                 <p className="text-gray-500 mt-2 text-sm">
                     {view === 'login' && 'Please enter your details to sign in.'}
                     {view === 'register' && 'Create a new account to start analyzing logs.'}
                 </p>
             </div>

             {msg && (
                <div className={`mb-6 p-4 rounded-lg text-sm flex items-start gap-3 shadow-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                {msg.type === 'success' ? <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
                <span className="font-medium leading-relaxed">{msg.text}</span>
                </div>
            )}

            {renderForm()}

            {view !== 'forgot' && view !== 'verify' && (
                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <p className="text-sm text-gray-500">
                        {view === 'login' ? "Don't have an account?" : "Already have an account?"}
                        <button 
                        onClick={() => {
                            setView(view === 'login' ? 'register' : 'login');
                            setMsg(null);
                        }}
                        className="ml-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
                        >
                        {view === 'login' ? 'Sign up for free' : 'Log In'}
                        </button>
                    </p>
                </div>
            )}
         </div>
      </div>
    </div>
  );
}
