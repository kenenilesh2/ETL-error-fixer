
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, AlertCircle, User, Phone, Mail, Lock, ArrowLeft, CheckCircle } from 'lucide-react';

interface AuthPageProps {
  onLogin: (user?: any) => void;
  demoMode: boolean;
  initialMode?: 'login' | 'register';
}

export function AuthPage({ onLogin, demoMode, initialMode = 'login' }: AuthPageProps) {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [mobile, setMobile] = useState('');
  
  useEffect(() => {
      if (initialMode === 'login' || initialMode === 'register') {
          setView(initialMode);
      }
  }, [initialMode]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
        if (view === 'login') {
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw error;
        } else if (view === 'register') {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  first_name: firstName,
                  mobile: mobile,
                },
                emailRedirectTo: window.location.origin
              }
            });
            if (error) throw error;
            
            setMsg({ type: 'success', text: 'Registration successful! Please check your email for the validation link.' });
            setView('login');
        } else if (view === 'forgot') {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '#type=recovery'
            });
            if (error) throw error;
            setMsg({ type: 'success', text: 'Password reset link sent to your email.' });
            // Don't switch view immediately so they see the message
        }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let errorMessage = err.message || "An unexpected error occurred";
      if (err.message === "Invalid login credentials") {
          errorMessage = "Invalid email or password.";
      }
      setMsg({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
      if (view === 'forgot') {
          return (
              <form onSubmit={handleAuth} className="space-y-4">
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

      return (
        <form onSubmit={handleAuth} className="space-y-4">
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
        
        {view !== 'forgot' && (
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
