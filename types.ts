export interface AnalysisResult {
  id: string;
  timestamp: number;
  tool: string;
  errorType: string;
  component: string;
  lineOfCode: string;
  cause: string;
  fix: string;
  optimizedSolution: string;
  codeSnippet: string;
  fingerprint: string;
  jobName?: string; // Extracted job name from log
  severity: 'Critical' | 'High' | 'Medium' | 'Low'; // Error severity
  confidenceScore: number; // AI confidence 0-100
}

export interface StoredError {
  id: string;
  timestamp: number;
  fingerprint: string;
  result: AnalysisResult;
  count: number;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  mobile: string;
  role: 'user' | 'admin';
  created_at: string;
}