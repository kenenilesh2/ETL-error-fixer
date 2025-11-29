
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { StoredError, UserProfile } from '../types';
import { AnalysisCard } from './AnalysisCard';
import { Users, FileWarning, Activity, Eye, X, RefreshCw, Shield, LogOut, Mail, User, AlertCircle } from 'lucide-react';

interface GlobalActivity extends StoredError {
    userEmail?: string;
    userName?: string;
}

export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [stats, setStats] = useState({ totalUsers: 0, totalErrors: 0 });
    const [globalHistory, setGlobalHistory] = useState<GlobalActivity[]>([]);
    const [allErrors, setAllErrors] = useState<GlobalActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [dbError, setDbError] = useState<string | null>(null);
    const [viewError, setViewError] = useState<StoredError | null>(null);
    
    // View state: 'overview' | 'users' | 'errors'
    const [activeView, setActiveView] = useState<'overview' | 'users' | 'errors'>('overview');

    const fetchAdminData = async () => {
        setLoading(true);
        setDbError(null);
        let currentUsers: UserProfile[] = [];

        try {
            // 1. Fetch Users (Handle errors gracefully to not block the whole dashboard)
            const { data: usersData, error: userError } = await supabase.from('profiles').select('*');
            
            if (userError) {
                console.error("Failed to fetch users:", userError);
                if (userError.code === '42P17') {
                     setDbError("DB Policy Error: Infinite Recursion. Please update Supabase RLS policies.");
                } else {
                     setDbError(`User fetch failed: ${userError.message}`);
                }
            } else {
                currentUsers = usersData || [];
                setUsers(currentUsers);
            }

            // 2. Fetch Stats
            const { count, error: countError } = await supabase.from('error_history').select('*', { count: 'exact', head: true });
            
            setStats({
                totalUsers: currentUsers.length,
                totalErrors: count || 0
            });

            // 3. Fetch History (Up to 200 items for the 'All Errors' view)
            const { data: historyData, error: historyError } = await supabase
                .from('error_history')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);
            
            if (historyError) throw historyError;

            if (historyData) {
                const enriched = historyData.map((h: any) => {
                    const user = currentUsers.find(u => u.id === h.user_id);
                    return {
                        id: h.id,
                        timestamp: new Date(h.created_at).getTime(),
                        fingerprint: h.full_result.fingerprint,
                        result: h.full_result,
                        count: 1,
                        userEmail: user?.email || 'Unknown User',
                        userName: user?.first_name || 'Unknown'
                    };
                });
                
                // Set Global History (Feed - Top 20)
                setGlobalHistory(enriched.slice(0, 20));
                // Set All Errors (Full list)
                setAllErrors(enriched);
            }
        } catch (err: any) {
            console.error("Admin Dashboard General Error:", err);
            // Don't overwrite specific DB errors if we already caught one
            setDbError(prev => prev || err.message || "Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminData();
    }, []);

    const renderMainContent = () => {
        if (activeView === 'users') {
            return (
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                             <Users className="w-4 h-4 text-indigo-500" /> Registered Users
                        </h2>
                        <span className="text-xs text-gray-500">Total: {users.length}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Email</th>
                                    <th className="px-6 py-3">Mobile</th>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                            No users found or permission denied.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map(u => (
                                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-gray-900">{u.first_name || '-'}</td>
                                            <td className="px-6 py-3 text-gray-600">{u.email}</td>
                                            <td className="px-6 py-3 text-gray-600 font-mono text-xs">{u.mobile || 'N/A'}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        const displayData = activeView === 'errors' ? allErrors : globalHistory;
        const title = activeView === 'errors' ? 'All System Errors' : 'Live System Activity';
        const subtitle = activeView === 'errors' ? `Showing last ${allErrors.length} errors` : 'Real-time Feed (Last 20)';

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                        {activeView === 'errors' ? <FileWarning className="w-4 h-4 text-indigo-500" /> : <Activity className="w-4 h-4 text-indigo-500" />}
                        {title}
                    </h2>
                    <span className="text-xs text-gray-400">{subtitle}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">User</th>
                                <th className="px-6 py-3">Tool</th>
                                <th className="px-6 py-3">Error Analyzed</th>
                                <th className="px-6 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {displayData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                        No recent activity found.
                                    </td>
                                </tr>
                            ) : (
                                displayData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                                            {new Date(item.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{item.userName || 'Unknown'}</span>
                                                <span className="text-xs text-gray-500">{item.userEmail}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                {item.result.tool}
                                             </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="font-medium text-gray-800 truncate max-w-xs" title={item.result.errorType}>
                                                {item.result.errorType}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                 <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase
                                                    ${item.result.severity === 'Critical' ? 'bg-red-100 text-red-700' : 
                                                      item.result.severity === 'High' ? 'bg-orange-100 text-orange-700' : 
                                                      item.result.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 
                                                      'bg-blue-100 text-blue-700'}`}>
                                                    {item.result.severity}
                                                </span>
                                                <span className="text-xs text-gray-400 truncate max-w-[100px]">{item.result.component}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <button 
                                                onClick={() => setViewError(item)}
                                                className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded hover:bg-indigo-100 transition-colors"
                                            >
                                                <Eye className="w-3 h-3" /> View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {viewError && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <FileWarning className="w-5 h-5 text-indigo-600"/>
                                Error Analysis Details
                            </h3>
                            <button 
                                onClick={() => setViewError(null)}
                                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto bg-gray-50/50">
                            <AnalysisCard result={viewError.result} />
                            <div className="mt-6 border-t border-gray-200 pt-4 bg-white p-4 rounded-lg border">
                                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">User Context</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                     <div className="flex items-center gap-2">
                                         <User className="w-4 h-4 text-gray-400" />
                                         <span className="text-gray-500">User:</span>
                                         <span className="font-semibold text-gray-900">{(viewError as any).userName}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <Mail className="w-4 h-4 text-gray-400" />
                                         <span className="text-gray-500">Email:</span>
                                         <span className="font-mono text-gray-700">{(viewError as any).userEmail}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                         <Activity className="w-4 h-4 text-gray-400" />
                                         <span className="text-gray-500">Timestamp:</span>
                                         <span className="font-mono text-gray-700">{new Date(viewError.timestamp).toLocaleString()}</span>
                                     </div>
                                 </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <nav className="bg-slate-900 text-white shadow-lg px-6 py-4 flex justify-between items-center sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-indigo-400" /> 
                    <span className="font-bold text-xl tracking-tight">Admin Portal</span>
                </div>
                <div className="flex items-center gap-4">
                     <button 
                        onClick={() => fetchAdminData()} 
                        disabled={loading}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors" 
                        title="Refresh Data"
                     >
                        <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                     </button>
                     <span className="text-sm text-slate-400">admin@admin.com</span>
                    <button onClick={onLogout} className="text-sm font-medium bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-2">
                        <LogOut className="w-4 h-4" /> Logout
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-6 space-y-6">
                {dbError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
                        <div className="flex items-center gap-2 font-bold"><AlertCircle className="w-5 h-5"/> Database Configuration Alert</div>
                        <p>{dbError}</p>
                        {dbError.includes("Recursion") && (
                            <p className="text-sm mt-2 font-mono bg-red-50 p-2 rounded">
                                SQL Fix Required: Run the specific policy fix script in Supabase SQL Editor.
                            </p>
                        )}
                    </div>
                )}
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button 
                        onClick={() => setActiveView('users')}
                        className={`p-6 rounded-xl shadow-sm border transition-all text-left flex items-center gap-4 hover:shadow-md
                        ${activeView === 'users' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300' : 'bg-white border-gray-200 hover:border-indigo-100'}`}
                    >
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Users</div>
                            <div className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.totalUsers}</div>
                        </div>
                    </button>

                    <button 
                         onClick={() => setActiveView('errors')}
                         className={`p-6 rounded-xl shadow-sm border transition-all text-left flex items-center gap-4 hover:shadow-md
                         ${activeView === 'errors' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300' : 'bg-white border-gray-200 hover:border-indigo-100'}`}
                    >
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
                            <FileWarning className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Errors Analyzed</div>
                            <div className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.totalErrors}</div>
                        </div>
                    </button>

                    <button 
                         onClick={() => setActiveView('overview')}
                         className={`p-6 rounded-xl shadow-sm border transition-all text-left flex items-center gap-4 hover:shadow-md
                         ${activeView === 'overview' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300' : 'bg-white border-gray-200 hover:border-indigo-100'}`}
                    >
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">System Status</div>
                            <div className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                                Online
                            </div>
                        </div>
                    </button>
                </div>

                {/* Conditional Main Content */}
                {renderMainContent()}
            </main>
        </div>
    );
}
