import React from 'react';
import { StoredError } from '../types';
import { Clock, Trash2, ChevronRight, AlertOctagon, Lock } from 'lucide-react';

interface HistorySidebarProps {
  history: StoredError[];
  onSelect: (error: StoredError) => void;
  onClear: () => void;
  onDelete: (id: string) => void;
  selectedId?: string;
}

const getSeverityDotColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-500';
      case 'High': return 'bg-orange-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-blue-500';
      default: return 'bg-gray-300';
    }
};

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, onSelect, onClear, onDelete, selectedId }) => {
  return (
    <div className="w-full md:w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          <Clock className="w-4 h-4" /> My Search History
        </h2>
        <div className="flex items-center gap-1">
             <div className="group relative">
                <Lock className="w-3 h-3 text-gray-400 cursor-help" />
                <div className="absolute right-0 w-48 bg-gray-800 text-white text-[10px] p-2 rounded hidden group-hover:block z-50 -bottom-8">
                    Visible only to you
                </div>
             </div>
            <button 
                onClick={onClear}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-gray-200 ml-2"
                title="Clear All History"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-gray-400">
                <AlertOctagon className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">No errors analyzed yet.</p>
                <p className="text-xs mt-1 opacity-60">Upload a log to start.</p>
            </div>
        ) : (
            <ul className="divide-y divide-gray-100">
            {history.map((item) => (
                <li key={item.id} className="relative group">
                    <button
                        onClick={() => onSelect(item)}
                        className={`w-full text-left p-4 hover:bg-gray-50 transition-all flex items-start ${selectedId === item.id ? 'bg-indigo-50/70 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                    >
                        <div className="flex-1 min-w-0 pr-6"> {/* Added padding right to prevent text overlap with delete button */}
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-2 h-2 rounded-full ${getSeverityDotColor(item.result.severity)}`} title={`Severity: ${item.result.severity}`}></div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                {item.result.tool || 'Talend'}
                            </span>
                            <span className="text-[10px] text-gray-400 ml-auto tabular-nums">
                                {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                        </div>
                        <p className={`text-sm font-medium truncate leading-tight ${selectedId === item.id ? 'text-indigo-800' : 'text-gray-900'}`}>
                            {item.result.errorType}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                            {item.result.component}
                        </p>
                        <div className="flex items-center mt-2 gap-2">
                            {item.count > 1 && (
                                <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200">
                                    {item.count} Occurrences
                                </span>
                            )}
                            {item.result.jobName && (
                                <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
                                    Job: {item.result.jobName}
                                </span>
                            )}
                        </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 mt-5 ml-2 transition-transform ${selectedId === item.id ? 'text-indigo-400 translate-x-1' : 'text-gray-300 group-hover:text-gray-400'}`} />
                    </button>
                    
                    {/* Individual Delete Button - Visible on Hover */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white shadow-sm border border-gray-200 rounded-full text-gray-400 hover:text-red-600 hover:border-red-200 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 z-10"
                        title="Delete this item"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </li>
            ))}
            </ul>
        )}
      </div>
    </div>
  );
};