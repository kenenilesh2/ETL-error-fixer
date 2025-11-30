
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, AlertCircle, User, Phone, Mail, Lock, ArrowLeft, CheckCircle, KeyRound, RefreshCw, Shield, Zap, TrendingUp, Terminal, Copy, Check, Moon, Sun, HelpCircle } from 'lucide-react';

interface AuthPageProps {
  onLogin: (user?: any) => void;
  demoMode: boolean;
  initialMode?: 'login' | 'register' | 'update_password';
  setManualRecoveryActive?: (active: boolean) => void;
  onRecoveryComplete?: () => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

export function AuthPage({ onLogin, demoMode, initialMode = 'login', setManualRecoveryActive, onRecoveryComplete, isDarkMode, toggleTheme }: AuthPageProps) {
  // Views:
  // login: Standard Sign In
  // register: Sign Up
  // verify: Sign Up OTP check
  // forgot: Request Password Reset (Enter Email)
  // verify_recovery: Enter Reset OTP
  // reset_password: Enter New Password (after OTP valid)
  // update_password: Link-based reset (Legacy/Backup)
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'verify' | 'verify_recovery' | 'reset_password' | 'update_password'>('login');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [showForgotRlsFix, setShowForgotRlsFix] = useState(false);
  const [showAdminFix, setShowAdminFix] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  useEffect(() => {
      if (initialMode) {
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

  const handleCopySql = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleResendOtp = async () => {
      if (resendTimer > 0) return;
      setLoading(true);
      setMsg(null);
      try {
          // If we are in verify_recovery mode, we need to resend the recovery email
          if (view === 'verify_recovery') {
             const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
             if (error) throw error;
             setMsg({ type: 'success', text: 'Recovery code resent. Check your email.' });
          } else {
             // Default signup resend
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
             }
          }
          setResendTimer(60); 
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
    setShowForgotRlsFix(false);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
        if (view === 'login') {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanPassword,
            });
            if (error) throw error;
            // Login successful - parent component handles session change
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
            const { data, error } = await supabase.auth.verifyOtp({
                email: cleanEmail,
                token: cleanOtp,
                type: 'signup'
            });
            
            if (error) {
                if (cleanPassword) {
                    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                        email: cleanEmail,
                        password: cleanPassword
                    });
                    if (!loginError && loginData.session) return; 
                }
                throw new Error("Invalid or expired code. Please try again.");
            }
            setMsg({ type: 'success', text: 'Email verified! Logging in...' });
        } else if (view === 'forgot') {
            // 1. Check if User Exists in DB
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', cleanEmail)
                .maybeSingle();

            if (!profile) {
                 // Either truly not registered, OR RLS hidden.
                 setMsg({ type: 'error', text: 'User is not registered. Please register yourself.' });
                 setShowForgotRlsFix(true); // Show SQL helper in case it's an RLS issue
                 setLoading(false);
                 return;
            }

            // 2. User exists, send recovery email
            const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
            if (error) throw error;

            setMsg({ type: 'success', text: 'Recovery code sent! Check your email.' });
            setView('verify_recovery'); // Move to OTP entry step
            setResendTimer(60);

        } else if (view === 'verify_recovery') {
             const cleanOtp = otp.trim();
             
             // CRITICAL: Lock UI BEFORE verifying OTP. 
             // verifyOtp creates a session which triggers onAuthStateChange in App.tsx.
             // If we don't lock, App.tsx will switch views and unmount this component before we finish.
             if (setManualRecoveryActive) setManualRecoveryActive(true);

             // 1. Verify Recovery Token
             const { data, error } = await supabase.auth.verifyOtp({
                 email: cleanEmail,
                 token: cleanOtp,
                 type: 'recovery'
             });

             if (error) {
                 if (setManualRecoveryActive) setManualRecoveryActive(false); // Unlock if failed
                 throw error;
             }
             
             // Explicitly set session to ensure next step works
             if (data.session) {
                 await supabase.auth.setSession(data.session);
             }

             setMsg({ type: 'success', text: 'Code verified successfully.' });
             setView('reset_password'); // Move to Password Update step
             
        } else if (view === 'reset_password') {
             // 1. Update Password
             const { error: updateError } = await supabase.auth.updateUser({
                 password: cleanPassword
             });

             if (updateError) throw updateError;

             // 2. Success Feedback & UI Reset
             setMsg({ type: 'success', text: 'Password updated! Redirecting to login...' });
             
             // 3. IMMEDIATE LOADING STOP
             setLoading(false);

             // 4. Cleanup and Redirect
             setTimeout(async () => {
                // If a parent callback is provided, use it to clear global session state
                if (onRecoveryComplete) {
                    onRecoveryComplete();
                } else {
                    // Fallback local cleanup
                    try { await supabase.auth.signOut(); } catch (e) {}
                }
                
                // Reset internal state
                setPassword('');
                setOtp('');
                
                // Unlock global app state if manual recovery was active
                if (setManualRecoveryActive) setManualRecoveryActive(false);
                
                // Force view to login
                setView('login');
                setMsg(null);
             }, 1000);
             
             return; 

        } else if (view === 'update_password') {
            // Legacy/Link flow
            const { error } = await supabase.auth.updateUser({ password: cleanPassword });
            if (error) throw error;
            
            setMsg({ type: 'success', text: 'Password updated! Redirecting...' });
            setLoading(false);
            
            setTimeout(async () => {
                if (onRecoveryComplete) {
                    onRecoveryComplete();
                } else {
                    try { await supabase.auth.signOut(); } catch (e) {}
                    onLogin(); 
                }
            }, 1000);
            return;
        }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let errorMessage = err.message || "An unexpected error occurred";
      if (err.message === "Invalid login credentials") errorMessage = "Invalid email or password.";
      
      // Auto-show admin fix if admin login fails
      if (email.trim() === 'kenenilesh2@gmail.com' && view === 'login') {
          setShowAdminFix(true);
          errorMessage = "Invalid credentials. Run the SQL Fix below in Supabase.";
      }

      setMsg({ type: 'error', text: errorMessage });
    } finally {
      // Ensure loading is always turned off if not already handled
      // Note: for reset_password success path, we handled it explicitly above
      if (view !== 'reset_password' && view !== 'update_password') {
          setLoading(false);
      } else if (msg?.type === 'error') {
          setLoading(false);
      }
    }
  };

  const adminFixSql = `
-- 1. Enable pgcrypto (Required for password hashing)
create extension if not exists pgcrypto;

-- 2. Create/Update kenenilesh2@gmail.com as ADMIN
DO $$
DECLARE
  target_email text := 'kenenilesh2@gmail.com';
  target_password text := 'admin@123';
  user_id uuid;
BEGIN
  -- Check if user exists in auth.users
  SELECT id INTO user_id FROM auth.users WHERE email = target_email;

  IF user_id IS NULL THEN
    -- CREATE NEW USER
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, 
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      target_email, crypt(target_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"role":"admin"}', now(), now()
    ) RETURNING id INTO user_id;
  ELSE
    -- UPDATE EXISTING USER PASSWORD AND ROLE
    UPDATE auth.users 
    SET encrypted_password = crypt(target_password, gen_salt('bf')),
        raw_user_meta_data = '{"role":"admin"}',
        updated_at = now()
    WHERE id = user_id;
  END IF;

  -- Upsert Profile
  INSERT INTO public.profiles (id, email, first_name, role)
  VALUES (user_id, target_email, 'System Admin', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin';
  
END $$;
`;

  const forgotFixSql = `create policy "Allow public profile check" on public.profiles for select using (true);`;

  const renderForm = () => {
      // --- STEP 3: RESET PASSWORD (NEW PASSWORD INPUT) ---
      if (view === 'reset_password' || view === 'update_password') {
          return (
              <form onSubmit={handleAuth} className="space-y-5 animate-fade-in mt-6">
                  <div className="text-center mb-8">
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 mb-4">
                          <Lock className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Set New Password</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Create a new secure password for your account.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1.5 ml-1">New Password</label>
                    <div className="relative group">
                        <Lock className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 dark:text-gray-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                        type="password" 
                        required 
                        minLength={6}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-1">Must be at least 6 characters</p>
                   </div>
                   <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl mt-6 flex items-center justify-center gap-2"
                    >
                    {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                    Update Password
                    </button>
              </form>
          );
      }

      // --- STEP 2: VERIFY RECOVERY CODE ---
      if (view === 'verify_recovery') {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="text-center space-y-2 mb-8">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 mb-4">
                        <KeyRound className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Verify Code</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Enter the 8-digit code sent to <span className="font-semibold text-gray-800 dark:text-gray-200">{email}</span></p>
                </div>
                
                <form onSubmit={handleAuth} className="space-y-5">
                  <div>
                      <div className="relative">
                          <KeyRound className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 dark:text-gray-500" />
                          <input 
                          type="text" 
                          required 
                          maxLength={8}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all tracking-[0.5em] font-mono text-center font-bold text-lg text-gray-800 dark:text-white bg-white dark:bg-slate-800"
                          placeholder="000000"
                          value={otp}
                          onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                          />
                      </div>
                  </div>

                  <button 
                      type="submit" 
                      disabled={loading || otp.length < 6}
                      className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl mt-6 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                      {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                      Verify Code
                  </button>
                 </form>

                 <div className="flex flex-col gap-3 mt-4">
                      <button 
                          type="button"
                          onClick={handleResendOtp}
                          disabled={resendTimer > 0 || loading}
                          className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : "Resend Code"}
                      </button>
                      
                      <button 
                          type="button"
                          onClick={() => setView('forgot')}
                          className="w-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium py-2 flex items-center justify-center gap-2 text-sm"
                      >
                          Incorrect email? Go back
                      </button>
                 </div>
            </div>
        );
      }

      // --- STEP 2A: VERIFY SIGNUP CODE (Original Verify) ---
      if (view === 'verify') {
          return (
              <div className="space-y-6 animate-fade-in">
                  <div className="text-center space-y-2 mb-8">
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 mb-4">
                          <Mail className="w-6 h-6" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Check your email</h3>
                      <p className="text-gray-500 dark:text-gray-400">We sent a verification code to <span className="font-semibold text-gray-800 dark:text-gray-200">{email}</span></p>
                  </div>
                  
                  <form onSubmit={handleAuth}>
                    <div>
                        <div className="relative">
                            <KeyRound className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 dark:text-gray-500" />
                            <input 
                            type="text" 
                            required 
                            maxLength={8}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all tracking-[0.5em] font-mono text-center font-bold text-xl text-gray-800 dark:text-white bg-white dark:bg-slate-800"
                            placeholder="000000"
                            value={otp}
                            onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                        </div>
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading || otp.length < 6}
                        className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl mt-6 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                        Verify & Access
                    </button>
                   </form>

                   <div className="flex flex-col gap-6 mt-6">
                        <button 
                            type="button"
                            onClick={handleResendOtp}
                            disabled={resendTimer > 0 || loading}
                            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : "Resend Code"}
                        </button>
                        
                        <button 
                            type="button"
                            onClick={() => setView('register')}
                            className="w-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium py-2 flex items-center justify-center gap-2 text-sm"
                        >
                            Go back
                        </button>
                   </div>
              </div>
          );
      }

      // --- STEP 1: FORGOT PASSWORD (EMAIL INPUT) ---
      if (view === 'forgot') {
          return (
              <form onSubmit={handleAuth} className="space-y-5 animate-fade-in mt-6">
                  <div className="text-center mb-8">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reset Password</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Enter your email to check registration and receive code</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1.5 ml-1">Email Address</label>
                    <div className="relative group">
                        <Mail className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 dark:text-gray-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                        type="email" 
                        required 
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white"
                        placeholder="name@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                   </div>
                   <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl mt-6 flex items-center justify-center gap-2"
                    >
                    {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                    Send Recovery Code
                    </button>
                    <button 
                        type="button"
                        onClick={() => setView('login')}
                        className="w-full text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium py-2 flex items-center justify-center gap-2 mt-4"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Login
                    </button>
                    
                    {showForgotRlsFix && (
                        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-xs animate-fade-in">
                            <div className="flex items-start gap-2 text-blue-800 dark:text-blue-200 font-semibold mb-2">
                                <Terminal className="w-4 h-4 mt-0.5" />
                                <span>Developer Fix Required</span>
                            </div>
                            <p className="text-blue-700 dark:text-blue-300 mb-2">
                                If you know this user exists, the database is blocking the check. Run this SQL in Supabase:
                            </p>
                            <div className="bg-slate-800 rounded p-2 text-green-400 font-mono mb-2 relative group">
                                <pre className="whitespace-pre-wrap">{forgotFixSql}</pre>
                                <button onClick={() => handleCopySql(forgotFixSql)} className="absolute top-1 right-1 p-1 bg-white/10 rounded hover:bg-white/20">
                                    {copiedSql ? <Check className="w-3 h-3 text-white"/> : <Copy className="w-3 h-3 text-white"/>}
                                </button>
                            </div>
                        </div>
                    )}
              </form>
          );
      }

      // --- DEFAULT: LOGIN & REGISTER VIEW ---
      return (
        <form onSubmit={handleAuth} className="space-y-5 animate-fade-in mt-2">
            {view === 'register' && (
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1.5 ml-1">First Name</label>
                    <div className="relative group">
                        <User className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 dark:text-gray-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                            type="text" 
                            required 
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white"
                            placeholder="John"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                        />
                    </div>
                </div>
                <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1.5 ml-1">Mobile</label>
                    <div className="relative group">
                        <Phone className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 dark:text-gray-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                            type="tel" 
                            required 
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white"
                            placeholder="+1 234..."
                            value={mobile}
                            onChange={e => setMobile(e.target.value)}
                        />
                    </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1.5 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 dark:text-gray-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="email" 
                  required 
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1.5 ml-1">Password</label>
              <div className="relative group">
                <Lock className="w-5 h-5 absolute left-3 top-3.5 text-gray-400 dark:text-gray-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="password" 
                  required 
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {view === 'login' && (
                <div className="flex justify-between items-center -mt-1">
                    <button
                        type="button"
                        onClick={() => setShowAdminFix(!showAdminFix)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                        <HelpCircle className="w-3 h-3"/> Trouble logging in?
                    </button>
                    <button 
                        type="button"
                        onClick={() => setView('forgot')}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors"
                    >
                        Forgot Password?
                    </button>
                </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl mt-6 flex items-center justify-center gap-2 transform active:scale-[0.98]"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {view === 'login' ? 'Sign In' : 'Create Account'}
            </button>
            
            
        </form>
      );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 lg:bg-white dark:lg:bg-slate-950 transition-colors duration-500">
      {/* LEFT SIDE - BRANDING */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 dark:bg-slate-950 relative overflow-hidden flex-col justify-between p-12 text-white border-r border-slate-800">
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden lg:overflow-visible">
         {/* Mobile-only Background Decor */}
         <div className="absolute inset-0 lg:hidden pointer-events-none z-0">
            <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[40%] bg-indigo-100/60 dark:bg-indigo-900/20 rounded-full blur-[80px]"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[70%] h-[40%] bg-purple-100/60 dark:bg-purple-900/20 rounded-full blur-[80px]"></div>
         </div>

         {/* Theme Toggle for Mobile */}
         <div className="absolute top-6 right-6 z-20">
             <button 
                onClick={toggleTheme}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
             >
                {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
             </button>
         </div>

         <div className="max-w-md w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none rounded-3xl lg:rounded-none shadow-xl lg:shadow-none p-8 lg:p-0 border border-white/50 dark:border-slate-800 lg:border-none relative z-10 transition-colors duration-300">
             {/* Mobile Logo Enhanced */}
             <div className="lg:hidden flex flex-col items-center gap-3 mb-8 justify-center">
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-3 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="font-extrabold text-2xl tracking-tight text-slate-800 dark:text-white">ETL Remedy</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-widest">Enterprise Log Analysis</p>
             </div>

             <div className="mb-8">
                 <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                     {view === 'login' ? 'Welcome back' : 
                      view === 'register' ? 'Get started' : 
                      view === 'verify' || view === 'verify_recovery' ? 'Verification' : 
                      view === 'reset_password' || view === 'update_password' ? 'Set New Password' : 
                      'Reset Password'}
                 </h2>
                 <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                     {view === 'login' && 'Please enter your details to sign in.'}
                     {view === 'register' && 'Create a new account to start analyzing logs.'}
                     {view === 'verify' && 'Check your email for the signup code.'}
                     {view === 'verify_recovery' && 'Check your email for the recovery code.'}
                     {(view === 'reset_password' || view === 'update_password') && 'Create a strong password to secure your account.'}
                     {view === 'forgot' && 'We will check if you are registered first.'}
                 </p>
             </div>

             {msg && (
                <div className={`mb-6 p-4 rounded-lg text-sm flex items-start gap-3 shadow-sm ${msg.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/30' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-900/30'}`}>
                {msg.type === 'success' ? <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
                <span className="font-medium leading-relaxed">{msg.text}</span>
                </div>
            )}

            {renderForm()}

            {view !== 'forgot' && view !== 'verify' && view !== 'verify_recovery' && view !== 'reset_password' && view !== 'update_password' && (
                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {view === 'login' ? "Don't have an account?" : "Already have an account?"}
                        <button 
                        onClick={() => {
                            setView(view === 'login' ? 'register' : 'login');
                            setMsg(null);
                        }}
                        className="ml-2 text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
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
