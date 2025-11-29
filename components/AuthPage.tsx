
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, AlertCircle, User, Phone, Mail, Lock, ArrowLeft, CheckCircle, KeyRound, RefreshCw, Settings, Info } from 'lucide-react';

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
                // If OTP failed (maybe expired or user clicked link?), try logging in with password.
                // If they are already verified, this will succeed and solve the issue.
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

                // If fallback failed, show meaningful error
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
              <div className="space-y-4 animate-fade-in">
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-4">
                      <p className="text-sm text-indigo-800 font-medium text-center">We sent a code to <br/><span className="font-bold">{email}</span></p>
                      <p className="text-xs text-indigo-500 mt-1 text-center">Check your spam folder.</p>
                  </div>
                  
                  <form onSubmit={handleAuth}>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Confirmation Code</label>
                        <div className="relative">
                            <KeyRound className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                            <input 
                            type="text" 
                            required 
                            maxLength={8}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all tracking-[0.5em] font-mono text-center font-bold text-lg"
                            placeholder="000000"
                            value={otp}
                            onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 text-center">Enter the most recent code received.</p>
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading || otp.length < 6}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg mt-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Verify & Login
                    </button>
                   </form>

                   <div className="flex flex-col gap-2 mt-4">
                        <button 
                            type="button"
                            onClick={handleResendOtp}
                            disabled={resendTimer > 0 || loading}
                            className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : "Resend Code"}
                        </button>
                        
                        <button 
                            type="button"
                            onClick={() => setView('register')}
                            className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 flex items-center justify-center gap-2 text-xs"
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
              <form onSubmit={handleAuth} className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address</label>
                    <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <input 
                        type="email" 
                        required 
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        placeholder="name@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                   </div>
                   <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg mt-6 flex items-center justify-center gap-2"
                    >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send Reset Link
                    </button>
                    <button 
                        type="button"
                        onClick={() => setView('login')}
                        className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Login
                    </button>
              </form>
          );
      }

      // --- LOGIN & REGISTER VIEW ---
      return (
        <form onSubmit={handleAuth} className="space-y-4 animate-fade-in">
            {view === 'register' && (
              <>
                 <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">First Name</label>
                    <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <input 
                            type="text" 
                            required 
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="John"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mobile Number</label>
                    <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                        <input 
                            type="tel" 
                            required 
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="+1 234 567 8900"
                            value={mobile}
                            onChange={e => setMobile(e.target.value)}
                        />
                    </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input 
                  type="email" 
                  required 
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input 
                  type="password" 
                  required 
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {view === 'login' && (
                <div className="flex justify-end">
                    <button 
                        type="button"
                        onClick={() => setView('forgot')}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        Forgot Password?
                    </button>
                </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg mt-6 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {view === 'login' ? 'Sign In' : 'Create Account'}
            </button>
        </form>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <div className="p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ETL Fixer AI</h1>
            <p className="text-gray-500 mt-2">
                {view === 'login' && 'Welcome back, Developer'}
                {view === 'register' && 'Create your account'}
                {view === 'verify' && 'Verify your email'}
                {view === 'forgot' && 'Reset your password'}
            </p>
          </div>

          {msg && (
            <div className={`mb-6 p-4 rounded-lg text-sm flex items-start gap-2 ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
              {msg.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span className="font-medium">{msg.text}</span>
            </div>
          )}

          {renderForm()}
        </div>
        
        {view !== 'forgot' && view !== 'verify' && (
            <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600">
                {view === 'login' ? "Don't have an account?" : "Already have an account?"}
                <button 
                onClick={() => {
                    setView(view === 'login' ? 'register' : 'login');
                    setMsg(null);
                }}
                className="ml-2 text-indigo-600 font-semibold hover:underline"
                >
                {view === 'login' ? 'Register' : 'Log In'}
                </button>
            </p>
            </div>
        )}
      </div>
    </div>
  );
}
