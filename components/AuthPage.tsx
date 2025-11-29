
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, AlertCircle, User, Phone, Mail, Lock, Info } from 'lucide-react';

interface AuthPageProps {
  onLogin: (user?: any) => void;
  demoMode: boolean;
  initialMode?: 'login' | 'register';
}

export function AuthPage({ onLogin, demoMode, initialMode = 'login' }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [mobile, setMobile] = useState('');
  
  useEffect(() => {
      setIsLogin(initialMode === 'login');
  }, [initialMode]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
        if (isLogin) {
            // Strictly use Supabase for all logins
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            
            if (error) {
                // AUTO-ADMIN FIX: If admin@admin.com fails to login, try to create it automatically
                // Note: 'admin' is 5 chars. If Supabase min length is 6, this auto-creation might fail 
                // and require the SQL script method.
                if (email === 'admin@admin.com' && error.message.includes("Invalid login credentials")) {
                    console.log("Admin account not found. Attempting auto-registration...");
                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email: 'admin@admin.com',
                        password: 'admin', // As requested
                        options: {
                            data: {
                                first_name: 'System Admin',
                                role: 'admin'
                            }
                        }
                    });
                    
                    if (!signUpError && signUpData.user) {
                         // Force role update just in case (best effort from client)
                         await supabase.from('profiles').upsert({
                             id: signUpData.user.id,
                             email: 'admin@admin.com',
                             role: 'admin',
                             first_name: 'System Admin'
                         });
                         setMsg({ 
                             type: 'success', 
                             text: 'Admin account initialized! Please check your email or verify in database.' 
                         });
                         setLoading(false);
                         return;
                    } else if (signUpError) {
                         console.error("Auto-admin creation failed:", signUpError);
                         if (signUpError.message.includes("Password should be")) {
                            setMsg({ type: 'error', text: "Could not auto-create admin: Password 'admin' is too short for Supabase settings. Please run the SQL script provided." });
                            setLoading(false);
                            return;
                         }
                    }
                }
                throw error;
            }
        } else {
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
            setIsLogin(true);
        }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let errorMessage = err.message || "An unexpected error occurred";
      if (err.message === "Invalid login credentials") {
          errorMessage = "Invalid email or password. Please try again.";
      } else if (err.message.includes("Email not confirmed")) {
          errorMessage = "Please check your inbox and verify your email address to log in.";
      }
      setMsg({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <div className="p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ETL Fixer AI</h1>
            <p className="text-gray-500 mt-2">{isLogin ? 'Welcome back, Developer' : 'Create your account'}</p>
          </div>

          {msg && (
            <div className={`mb-6 p-4 rounded-lg text-sm flex items-start gap-2 ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
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

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg mt-6 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-600">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-indigo-600 font-semibold hover:underline"
            >
              {isLogin ? 'Register' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
