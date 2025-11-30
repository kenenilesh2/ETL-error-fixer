
import React from 'react';
import { StoredError } from '../types';
import { Clock, Trash2, ChevronRight, AlertOctagon, Lock, X } from 'lucide-react';

interface HistorySidebarProps {
  history: StoredError[];
  onSelect: (error: StoredError) => void;
  onClear: () => void;
  onDelete: (id: string) => void;
  selectedId?: string;
  isOpen: boolean;
  onClose: () => void;
}

const getSeverityDotColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-500';
      case 'High': return 'bg-orange-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-blue-500';
      default: return 'bg-gray-300 dark:bg-gray-600';
    }
};

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, onSelect, onClear, onDelete, selectedId, isOpen, onClose }) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
            onClick={onClose}
        ></div>
      )}

      {/* Sidebar Container */}
      <div className={`
          fixed md:static inset-y-0 left-0 z-30 w-[85vw] md:w-80 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 h-full flex flex-col shadow-2xl md:shadow-none transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Clock className="w-4 h-4" /> My Search History
          </h2>
          <div className="flex items-center gap-1">
               <div className="group relative hidden md:block">
                  <Lock className="w-3 h-3 text-gray-400 cursor-help" />
                  <div className="absolute left-0 w-48 bg-gray-800 text-white text-[10px] p-2 rounded hidden group-hover:block z-50 -bottom-8">
                      Visible only to you
                  </div>
               </div>
              <button 
                  onClick={onClear}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-800 ml-2 hidden md:block"
                  title="Clear All History"
              >
                  <Trash2 className="w-4 h-4" />
              </button>
              {/* Mobile Close Button */}
              <button 
                  onClick={onClose}
                  className="md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 p-1"
              >
                  <X className="w-5 h-5" />
              </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-gray-400 dark:text-gray-500">
                  <AlertOctagon className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">No errors analyzed yet.</p>
                  <p className="text-xs mt-1 opacity-60">Upload a log to start.</p>
              </div>
          ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {history.map((item) => (
                  <li key={item.id} className="relative group">
                      <button
                          onClick={() => {
                              onSelect(item);
                              onClose(); // Close drawer on mobile selection
                          }}
                          className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all flex items-start ${selectedId === item.id ? 'bg-indigo-50/70 dark:bg-indigo-900/20 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                      >
                          <div className="flex-1 min-w-0 pr-6"> {/* Added padding right to prevent text overlap with delete button */}
                          <div className="flex items-center gap-2 mb-1.5">
                              <div className={`w-2 h-2 rounded-full ${getSeverityDotColor(item.result.severity)}`} title={`Severity: ${item.result.severity}`}></div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                                  {item.result.tool || 'Talend'}
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto tabular-nums">
                                  {new Date(item.timestamp).toLocaleDateString()}
                              </span>
                          </div>
                          <p className={`text-sm font-medium truncate leading-tight ${selectedId === item.id ? 'text-indigo-800 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-200'}`}>
                              {item.result.errorType}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                              {item.result.component}
                          </p>
                          <div className="flex items-center mt-2 gap-2">
                              {item.count > 1 && (
                                  <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-900/50">
                                      {item.count} Occurrences
                                  </span>
                              )}
                              {item.result.jobName && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
                                      Job: {item.result.jobName}
                                  </span>
                              )}
                          </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 mt-5 ml-2 transition-transform ${selectedId === item.id ? 'text-indigo-400' : 'text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500'}`} />
                      </button>
                      
                      {/* Individual Delete Button - Visible on Hover (Desktop) or Always (Mobile somewhat) */}
                      <button
                          onClick={(e) => {
                              e.stopPropagation();
                              onDelete(item.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-700 rounded-full text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 z-10 md:opacity-0 opacity-100"
                          title="Delete this item"
                      >
                          <Trash2 className="w-3 h-3" />
                      </button>
                  </li>
              ))}
              </ul>
          )}
        </div>
        
        {/* Mobile-only Clear All Button at bottom */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 md:hidden">
            <button 
                onClick={onClear}
                className="w-full flex items-center justify-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 py-2 rounded-lg text-sm font-medium"
            >
                <Trash2 className="w-4 h-4" /> Clear History
            </button>
        </div>
      </div>
    </>
  );
};
