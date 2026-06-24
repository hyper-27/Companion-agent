export interface BugItem {
  severity: string; // CRITICAL, HIGH, MEDIUM, LOW
  category: string; // Security, Logic, Runtime, Edge Case, Style
  title: string;
  description: string;
  snippet?: string;
  fix: string;
}

export interface BugHunterResult {
  overview: string;
  bugs: BugItem[];
}

export interface OptimizationItem {
  description: string;
  potentialTime: string;
  potentialSpace: string;
  explanation: string;
  optimizedCode: string;
}

export interface ComplexityResult {
  timeComplexity: string;
  spaceComplexity: string;
  complexityExplanation: string;
  optimizations: OptimizationItem[];
}

export interface DocComponent {
  name: string;
  type: string; // Function, Class, Method, etc.
  params?: string;
  returns?: string;
  description: string;
}

export interface DocResult {
  overview: string;
  documentedCode: string;
  components: DocComponent[];
}

export interface AnalysisLog {
  id: string;
  timestamp: string;
  fileName: string;
  language: string;
  code: string;
  bugHunter: BugHunterResult;
  complexity: ComplexityResult;
  doc: DocResult;
}
