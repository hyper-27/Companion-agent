import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Terminal, 
  FileCode, 
  ShieldAlert, 
  Cpu, 
  BookOpen, 
  ChevronRight, 
  Search, 
  Upload, 
  FileText, 
  X, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  Info,
  Sparkles,
  ChevronDown,
  Settings,
  Flame,
  FileJson,
  Braces
} from "lucide-react";
import { AnalysisLog, BugItem, OptimizationItem, DocComponent } from "./types";
import MarkdownViewer from "./components/MarkdownViewer";
import { 
  fetchLogsFromFirestore, 
  saveLogToFirestore, 
  deleteLogFromFirestore,
  auth,
  loginWithGoogle,
  logoutUser
} from "./lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

export default function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Saved Logs State
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [activeLog, setActiveLog] = useState<AnalysisLog | null>(null);

  // Input states
  const [code, setCode] = useState<string>(`// Paste your code here or upload a file
function calculateFactorial(n) {
  if (n < 0) return undefined;
  if (n === 0 || n === 1) {
    return 1;
  }
  return n * calculateFactorial(n - 1);
}`);
  const [fileName, setFileName] = useState<string>("factorial.js");
  const [language, setLanguage] = useState<string>("javascript");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // UI state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"bugs" | "performance" | "docs">("bugs");
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    lines: number;
    extension: string;
    content: string;
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Sequential loading states
  // "idle" | "bugHunter" | "complexity" | "doc" | "failed"
  const [loadingState, setLoadingState] = useState<"idle" | "bugHunter" | "complexity" | "doc" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File Upload Reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load logs on mount
  useEffect(() => {
    async function loadLogs() {
      // Seed an initial sample log to give immediate context
      const sample: AnalysisLog = {
        id: "sample-1",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        fileName: "factorial.js",
        language: "javascript",
        code: `function calculateFactorial(n) {
  if (n < 0) return undefined;
  if (n === 0 || n === 1) {
    return 1;
  }
  return n * calculateFactorial(n - 1);
}`,
        bugHunter: {
          overview: "### Code Safety Overview\nThe code is highly straightforward but poses risks for unhandled inputs (e.g. non-integer values) and is vulnerable to Stack Overflow crashes for very large integers. In production settings, recursive operations should be safeguarded.",
          bugs: [
            {
              severity: "HIGH",
              category: "Edge Case",
              title: "Infinite Call Stack with Decimals",
              description: "If `n` is a float (e.g., `5.5`), `n === 0` and `n === 1` are never reached, causing infinite recursion and a Stack Overflow error.",
              snippet: "return n * calculateFactorial(n - 1);",
              fix: "Ensure `n` is integer-only, or check with `Number.isInteger(n)` before invoking recursion, or use `Math.floor(n)`."
            },
            {
              severity: "MEDIUM",
              category: "Style",
              title: "Implicit parameter types",
              description: "The parameter `n` does not have type safety validation, allowing users to pass strings or other unexpected payloads.",
              snippet: "function calculateFactorial(n)",
              fix: "Convert code to TypeScript to enforce typed constraints or add explicit validation inside the function body."
            }
          ]
        },
        complexity: {
          timeComplexity: "O(N)",
          spaceComplexity: "O(N)",
          complexityExplanation: "The function makes `N` recursive call frames which occupy the stack sequentially. Thus, both time complexity (number of additions/multiplications) and space complexity (stack depth) scale linearly with `N`.",
          optimizations: [
            {
              description: "Convert recursion to an iterative approach",
              potentialTime: "O(N)",
              potentialSpace: "O(1)",
              explanation: "An iterative loop recalculates factorials bottom-up, keeping space constant at O(1) by reusing a single variable and avoiding function frame allocation on the call stack.",
              optimizedCode: `function calculateFactorialIterative(n) {
  if (n < 0) return undefined;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}`
            }
          ]
        },
        doc: {
          overview: "### File: factorial.js\nThis file provides a recursive utility to compute the factorial of an integer. Primarily intended as a demonstration of mathematical recursion in javascript.",
          documentedCode: `/**
 * Calculates the mathematical factorial of a number (n!).
 * Assumes a non-negative integer parameter.
 * 
 * @param {number} n - The target non-negative integer.
 * @returns {number|undefined} The factorial result, or undefined if n is negative.
 */
function calculateFactorial(n) {
  // Handle invalid negative numbers
  if (n < 0) return undefined;
  
  // Base cases: 0! = 1 and 1! = 1
  if (n === 0 || n === 1) {
    return 1;
  }
  
  // Recursive multiplication
  return n * calculateFactorial(n - 1);
}`,
          components: [
            {
              name: "calculateFactorial",
              type: "Function",
              params: "n: number (expected integer >= 0)",
              returns: "number | undefined",
              description: "Computes n! recursively. Gracefully fails and returns undefined for any negative input value."
            }
          ]
        }
      };

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);
        setAuthLoading(false);

        if (user) {
          try {
            console.log("[Dev Companion] Fetching analysis logs from Firestore for:", user.uid);
            const firestoreLogs = await fetchLogsFromFirestore(user.uid);
            if (firestoreLogs.length > 0) {
              setLogs(firestoreLogs);
              setActiveLog(firestoreLogs[0]);
            } else {
              setLogs([sample]);
              setActiveLog(sample);
              await saveLogToFirestore(user.uid, sample);
            }
          } catch (err) {
            console.error("Failed to load logs from Firestore, falling back to localStorage:", err);
            const saved = localStorage.getItem(`dev_companion_logs_${user.uid}`);
            if (saved) {
              try {
                const parsed = JSON.parse(saved) as AnalysisLog[];
                setLogs(parsed);
                if (parsed.length > 0) {
                  setActiveLog(parsed[0]);
                }
              } catch (e) {
                console.error("Failed to parse logs from localStorage", e);
              }
            } else {
              setLogs([sample]);
              setActiveLog(sample);
            }
          }
        } else {
          console.log("[Dev Companion] Loading offline local logs...");
          const saved = localStorage.getItem("dev_companion_logs_offline");
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as AnalysisLog[];
              setLogs(parsed);
              if (parsed.length > 0) {
                setActiveLog(parsed[0]);
              } else {
                setLogs([sample]);
                setActiveLog(sample);
              }
            } catch (e) {
              console.error("Failed to parse offline logs from localStorage", e);
            }
          } else {
            setLogs([sample]);
            setActiveLog(sample);
            localStorage.setItem("dev_companion_logs_offline", JSON.stringify([sample]));
          }
        }
      });

      return () => unsubscribe();
    }
    loadLogs();
  }, []);

  // Save logs utility
  const saveLogs = (newLogs: AnalysisLog[]) => {
    setLogs(newLogs);
    if (currentUser) {
      localStorage.setItem(`dev_companion_logs_${currentUser.uid}`, JSON.stringify(newLogs));
    } else {
      localStorage.setItem("dev_companion_logs_offline", JSON.stringify(newLogs));
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Listen to Alt/Shift/Command shortcuts
      if (e.altKey || e.shiftKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveTab("bugs");
        } else if (e.key === "2") {
          e.preventDefault();
          setActiveTab("performance");
        } else if (e.key === "3") {
          e.preventDefault();
          setActiveTab("docs");
        } else if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          handleNewAnalysis();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Trigger copy utility
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Handle Drag-and-Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const processUploadedFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let detectedLang = "plaintext";

    if (["js", "jsx"].includes(ext)) detectedLang = "javascript";
    else if (["ts", "tsx"].includes(ext)) detectedLang = "typescript";
    else if (["py"].includes(ext)) detectedLang = "python";
    else if (["go"].includes(ext)) detectedLang = "go";
    else if (["java"].includes(ext)) detectedLang = "java";
    else if (["cpp", "cc", "cxx", "h"].includes(ext)) detectedLang = "cpp";
    else if (["rs"].includes(ext)) detectedLang = "rust";
    else if (["html"].includes(ext)) detectedLang = "html";
    else if (["css"].includes(ext)) detectedLang = "css";

    setFileName(file.name);
    setLanguage(detectedLang);
    setFileError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === "string") {
        const content = event.target.result;
        setCode(content);
        const linesCount = content.split("\n").length;
        const sizeStr = (file.size / 1024).toFixed(1) + " KB";
        setUploadedFile({
          name: file.name,
          size: sizeStr,
          lines: linesCount,
          extension: ext,
          content: content
        });
      }
    };
    reader.onerror = () => {
      setFileError("Error reading file.");
    };
    reader.readAsText(file);
  };

  // Execute Analysis Sequential flow
  const runAnalysis = async () => {
    if (!code.trim()) return;

    setErrorMessage(null);
    setLoadingState("bugHunter");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          fileName,
          language,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.error || "Failed to analyze code snippet");
      }

      const result: AnalysisLog = await response.json();

      // Persist results securely to Firestore database if logged in
      if (currentUser) {
        try {
          await saveLogToFirestore(currentUser.uid, result);
        } catch (fsErr) {
          console.error("Firestore persistence error:", fsErr);
        }
      }

      // Successfully processed all! Update logs
      const updated = [result, ...logs.filter((l) => l.id !== "sample-1")];
      saveLogs(updated);
      setActiveLog(result);
      setActiveTab("bugs");
      setLoadingState("idle");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected network or model error occurred.");
      setLoadingState("failed");
    }
  };

  // Reset to form
  const handleNewAnalysis = () => {
    setActiveLog(null);
    setErrorMessage(null);
    setLoadingState("idle");
    setUploadedFile(null);
    setFileError(null);
    setCode("");
    setFileName("");
    setLanguage("plaintext");
    setInputMode("upload");
  };

  // Delete saved log
  const handleDeleteLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentUser) {
      try {
        await deleteLogFromFirestore(currentUser.uid, id);
      } catch (fsErr) {
        console.error("Firestore delete error:", fsErr);
      }
    }
    const filtered = logs.filter((l) => l.id !== id);
    saveLogs(filtered);
    if (activeLog?.id === id) {
      setActiveLog(filtered.length > 0 ? filtered[0] : null);
    }
  };

  // Quick Load Preset Snippet
  const loadPreset = (presetKey: string) => {
    if (presetKey === "python") {
      setCode(`def get_user_data(user_id, database_conn):
    # Retrieve user records
    query = f"SELECT * FROM users WHERE id = '{user_id}'"
    cursor = database_conn.cursor()
    cursor.execute(query)
    records = cursor.fetchall()
    
    # Bottleneck: nested loop with recalculations
    results = []
    for row in records:
        for inner in records:
            score = 0
            for i in range(1000):
                score += i
            results.append({"user": row[1], "score": score})
    return results`);
      setFileName("db_utils.py");
      setLanguage("python");
    } else if (presetKey === "react") {
      setCode(`import React, { useState, useEffect } from 'react';

export default function InfiniteUsers() {
  const [users, setUsers] = useState([]);
  
  // Bug: Missing dependency array creates infinite api requests
  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data));
  });

  return (
    <div>
      <h3>Registered Users ({users.length})</h3>
      <ul>
        {users.map(u => <li key={u.id}>{u.name}</li>)}
      </ul>
    </div>
  );
}`);
      setFileName("InfiniteUsers.jsx");
      setLanguage("javascript");
    } else if (presetKey === "rust") {
      setCode(`fn find_max(numbers: &Vec<i32>) -> Option<i32> {
    if numbers.is_empty() {
        return None;
    }
    let mut max_val = numbers[0];
    for num in numbers {
        if *num > max_val {
            max_val = *num;
        }
    }
    Some(max_val)
}`);
      setFileName("utils.rs");
      setLanguage("rust");
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.language.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0c0c0d] text-[#e0e0e0] font-sans antialiased selection:bg-blue-500/30 selection:text-white">
      
      {/* VS CODE ACTIVITY BAR (FAR LEFT Narrow Bar) */}
      <div className="w-14 bg-[#181818] border-r border-[#2d2d2d] flex flex-col items-center justify-between py-4 flex-shrink-0 z-20">
        <div className="flex flex-col items-center space-y-6 w-full">
          {/* Main App Icon wrapper */}
          <div 
            onClick={handleNewAnalysis}
            className="w-10 h-10 bg-[#2d2d2d] hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 rounded flex items-center justify-center cursor-pointer transition-all border border-[#3d3d3d]"
            title="Start New Analysis (Alt+N)"
          >
            <Terminal size={20} className="animate-pulse" />
          </div>

          {/* Explorer/Log Active State */}
          <div 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-2 rounded cursor-pointer transition-colors ${!isSidebarCollapsed ? 'text-blue-500 bg-[#252526]' : 'text-[#858585] hover:text-[#cccccc]'}`}
            title="Toggle File History Sidebar"
          >
            <FileCode size={22} />
          </div>

          {/* Quick presets trigger helper icon */}
          <div 
            onClick={() => loadPreset("python")}
            className="p-2 rounded text-[#858585] hover:text-[#cccccc] cursor-pointer transition-colors"
            title="Load SQL injection Python preset"
          >
            <Flame size={20} />
          </div>

          <div 
            onClick={() => loadPreset("react")}
            className="p-2 rounded text-[#858585] hover:text-[#cccccc] cursor-pointer transition-colors"
            title="Load React Infinite Loop Preset"
          >
            <Braces size={20} />
          </div>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <div 
            className="p-2 rounded text-[#858585] hover:text-white cursor-help transition-colors"
            title="Dev Companion • Powered by Gemini 2.5 Flash"
          >
            <Sparkles size={18} className="text-amber-500" />
          </div>
          <div className="p-2 text-[#858585] hover:text-[#cccccc] cursor-pointer" title="Settings">
            <Settings size={18} />
          </div>
        </div>
      </div>

      {/* SIDEBAR: SAVED LOGS (VS Code Explorer Style) */}
      <div 
        className={`${
          isSidebarCollapsed ? "w-0 border-r-0" : "w-64 border-r"
        } flex-shrink-0 border-[#2d2d2d] bg-[#1e1e1e] flex flex-col transition-all duration-300 overflow-hidden relative`}
      >
        {/* Sidebar Header */}
        <div 
          id="sidebar-header" 
          className="px-4 py-3 border-b border-[#2d2d2d] flex items-center justify-between bg-gradient-to-r from-[#1c1c1e] to-[#151516] hover:from-[#212124] hover:to-[#18181a] transition-all duration-300 group"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300 font-mono group-hover:text-blue-400 transition-colors">
              Analysis History
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                handleNewAnalysis();
                setInputMode("upload");
                setTimeout(() => fileInputRef.current?.click(), 100);
              }}
              className="p-1 hover:bg-[#2a2d2e] rounded text-gray-400 hover:text-blue-400 transition-colors"
              title="Upload file (.py/.java) to analyze"
            >
              <Upload size={13} />
            </button>
            <button 
              onClick={handleNewAnalysis}
              className="p-1 hover:bg-[#2a2d2e] rounded text-gray-400 hover:text-white transition-colors"
              title="Create new workspace"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Sync/Auth Info Banner inside sidebar */}
        <div className="px-4 py-1.5 bg-[#151515] border-b border-[#2d2d2d] flex items-center justify-between text-[10px]">
          {authLoading ? (
            <span className="text-gray-500 font-mono flex items-center gap-1">Checking Sync...</span>
          ) : currentUser ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Cloud Sync Active
            </span>
          ) : (
            <span className="text-amber-500/95 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              Offline Mode
            </span>
          )}
          {!authLoading && !currentUser && (
            <button 
              onClick={loginWithGoogle}
              className="text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#2d2d2d] bg-[#1a1a1a]">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2 text-[#858585]" />
            <input
              type="text"
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#252526] border border-[#3c3c3c] rounded py-1 pl-7 pr-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-sans"
            />
          </div>
        </div>

        {/* History Log List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
          {filteredLogs.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-xs italic">
              No files saved
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isActive = activeLog?.id === log.id;
              const bugCount = log.bugHunter.bugs.length;
              const hasCritical = log.bugHunter.bugs.some(b => b.severity === "CRITICAL" || b.severity === "HIGH");

              return (
                <div
                  key={log.id}
                  onClick={() => {
                    setActiveLog(log);
                    setLoadingState("idle");
                  }}
                  className={`group relative px-4 py-2 flex flex-col cursor-pointer border-l-2 transition-all ${
                    isActive
                      ? "bg-[#2d2d2d] border-blue-500 text-white"
                      : "border-transparent hover:bg-[#2a2d2e] text-[#cccccc]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium truncate font-mono block max-w-[150px]">
                      {log.fileName}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wide bg-[#111115] text-[#858585]">
                      {log.language}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-[#858585]">
                    <span className="flex items-center gap-0.5 font-mono">
                      <Clock size={8} />
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {bugCount > 0 ? (
                      <span className={`flex items-center gap-0.5 font-semibold ${hasCritical ? "text-red-400" : "text-yellow-400"}`}>
                        <ShieldAlert size={9} />
                        {bugCount} {bugCount === 1 ? 'issue' : 'issues'}
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={9} />
                        Secure
                      </span>
                    )}
                  </div>

                  {/* Absolute Delete Action */}
                  <button
                    onClick={(e) => handleDeleteLog(log.id, e)}
                    className="absolute right-2 top-2.5 p-1 rounded hover:bg-red-500/20 text-[#6a6a6a] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete log"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Shortcuts Cheat Sheet */}
        <div className="p-3 border-t border-[#2d2d2d] bg-[#151515] text-[10px] text-[#858585] space-y-1">
          <div className="text-[8px] font-bold uppercase tracking-widest text-[#aaaaaa] mb-1">
            Keyboard Shortcuts
          </div>
          <div className="flex justify-between font-mono">
            <span>Bug Tab</span>
            <span>Shift + 1</span>
          </div>
          <div className="flex justify-between font-mono">
            <span>Perf Tab</span>
            <span>Shift + 2</span>
          </div>
          <div className="flex justify-between font-mono">
            <span>Docs Tab</span>
            <span>Shift + 3</span>
          </div>
          <div className="flex justify-between font-mono">
            <span>New Code</span>
            <span>Alt + N</span>
          </div>
        </div>
      </div>

      {/* COLLAPSIBLE SIDEBAR HANDLE */}
      <button 
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className="w-1 hover:w-1.5 bg-[#181818] hover:bg-blue-500/40 flex-shrink-0 flex items-center justify-center border-r border-[#2d2d2d] transition-all cursor-ew-resize"
        title={isSidebarCollapsed ? "Expand History" : "Collapse History"}
      />

      {/* MAIN DEV WORKSPACE */}
      <div className="flex-1 flex flex-col h-full bg-[#0c0c0d] relative overflow-hidden">
        
        {/* TOP PATH HEADER BAR */}
        <header className="h-10 border-b border-[#2d2d2d] bg-[#1e1e1e] flex items-center justify-between px-4 z-10 flex-shrink-0">
          <div className="flex items-center space-x-2 text-[12px] text-[#cccccc]">
            <span className="text-[#858585]">Home</span>
            <span>/</span>
            <span className="text-[#858585]">Smart-Multi-Agent</span>
            <span>/</span>
            <span className="text-[#e0e0e0] font-mono font-semibold flex items-center gap-1">
              <FileCode size={13} className="text-blue-400" />
              {activeLog ? activeLog.fileName : "configure_new_payload.ts"}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* AUTH WIDGET */}
            {authLoading ? (
              <div className="text-[11px] text-gray-500 font-mono">Loading Auth...</div>
            ) : currentUser ? (
              <div className="flex items-center space-x-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded pl-2 pr-1 py-0.5 text-xs text-gray-300">
                {currentUser.photoURL && (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ""}
                    className="w-5 h-5 rounded-full border border-gray-600"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className="truncate max-w-[100px] font-medium text-gray-200">
                  {currentUser.displayName || "User"}
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1 rounded border border-emerald-500/20 font-mono">Cloud</span>
                <button
                  onClick={logoutUser}
                  className="bg-[#1e1e1e] hover:bg-red-500/20 hover:text-red-300 text-gray-400 text-[10px] px-2 py-0.5 rounded transition-all cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[11px] font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/20 transition-all active:scale-[0.98]"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.113-5.111 4.113-3.418 0-6.205-2.787-6.205-6.205s2.787-6.205 6.205-6.205c1.554 0 2.966.574 4.053 1.513l3.12-3.12C18.994 2.227 15.845 1 12.24 1 6.136 1 1.136 6.136 1.136 12.24s5 11.24 11.104 11.24c6.382 0 10.151-4.482 10.151-10.24 0-.688-.061-1.353-.178-1.955H12.24z"/>
                </svg>
                <span>Google Sign-In</span>
              </button>
            )}

            {activeLog && (
              <button
                onClick={handleNewAnalysis}
                className="bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white text-[11px] px-3 py-1 rounded flex items-center gap-1 cursor-pointer border border-[#3d3d3d] transition-colors"
              >
                <Plus size={11} />
                <span>New Pipeline</span>
              </button>
            )}
          </div>
        </header>

        {/* INNER SCENE DISPATCHER */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            
            {/* STATE 1: CONFIGURING INPUT & PRESETS */}
            {!activeLog && loadingState === "idle" && (
              <motion.div 
                key="workspace-input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full w-full overflow-y-auto p-6 md:p-8 flex flex-col max-w-5xl mx-auto"
              >
                <div className="mb-6">
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Sparkles className="text-blue-400" size={20} />
                    Context-Aware Smart Dev Companion
                  </h1>
                  <p className="text-xs text-[#858585] mt-1">
                    An intelligent server-side pipeline invoking sequentially Bug Hunter, Complexity Optimizer, and JSDoc Documenter on your code snippet.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Side (Input editor & Drag&Drop) */}
                  <div className="lg:col-span-8 space-y-4">
                    
                    <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded p-5 shadow-2xl relative">
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500"></div>

                      {/* Unified Tab Switcher */}
                      <div className="flex border-b border-[#2d2d2d] mb-5">
                        <button
                          type="button"
                          onClick={() => setInputMode("upload")}
                          className={`px-4 py-2.5 text-xs font-bold tracking-wider transition-all duration-200 border-b-2 flex items-center gap-2 ${
                            inputMode === "upload"
                              ? "border-blue-500 text-blue-400 bg-blue-500/5"
                              : "border-transparent text-[#858585] hover:text-gray-300"
                          }`}
                        >
                          <Upload size={13} />
                          <span>Local File Uploader</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputMode("paste")}
                          className={`px-4 py-2.5 text-xs font-bold tracking-wider transition-all duration-200 border-b-2 flex items-center gap-2 ${
                            inputMode === "paste"
                              ? "border-blue-500 text-blue-400 bg-blue-500/5"
                              : "border-transparent text-[#858585] hover:text-gray-300"
                          }`}
                        >
                          <FileText size={13} />
                          <span>Manual Code Editor</span>
                        </button>
                      </div>

                      {inputMode === "upload" ? (
                        uploadedFile ? (
                          <div className="space-y-4">
                            {/* Loaded File Metadata Card */}
                            <div className="bg-[#131314] border border-[#2d2d30] rounded p-4 flex items-center justify-between shadow-inner">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded flex items-center justify-center text-[10px] font-extrabold font-mono uppercase tracking-wide border ${
                                  uploadedFile.extension === "py"
                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                    : uploadedFile.extension === "java"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                }`}>
                                  .{uploadedFile.extension}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-gray-200 font-mono flex items-center gap-1.5">
                                    <span>{uploadedFile.name}</span>
                                    {["py", "java"].includes(uploadedFile.extension) && (
                                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border font-sans ${
                                        uploadedFile.extension === "py"
                                          ? "bg-blue-500/10 text-blue-300 border-blue-500/25"
                                          : "bg-amber-500/10 text-amber-300 border-amber-500/25"
                                      }`}>
                                        {uploadedFile.extension === "py" ? "Python script" : "Java file"}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#858585] font-mono">
                                    <span className="flex items-center gap-0.5">
                                      <FileText size={10} />
                                      {uploadedFile.lines} lines
                                    </span>
                                    <span>•</span>
                                    <span>{uploadedFile.size}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setInputMode("paste")}
                                  className="px-2.5 py-1.5 bg-[#1e1e20] hover:bg-[#2a2d2e] border border-[#2d2d30] rounded text-[11px] font-bold text-gray-300 transition-colors flex items-center gap-1"
                                  title="Edit loaded source text"
                                >
                                  <FileCode size={12} className="text-blue-400" />
                                  <span>Edit Code</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadedFile(null);
                                    setCode("");
                                    setFileName("");
                                  }}
                                  className="p-1.5 hover:bg-red-500/10 text-[#858585] hover:text-red-400 rounded border border-transparent hover:border-red-500/20 transition-all"
                                  title="Remove file"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Elegant Code Preview Viewport */}
                            <div className="border border-[#2d2d30] rounded bg-[#0a0a0c] overflow-hidden flex font-mono text-[12px] relative shadow-md">
                              <div className="bg-[#111112] select-none text-right pr-2.5 pl-1.5 py-2.5 border-r border-[#222225] text-[#505052] leading-[18px] font-mono text-[11px]">
                                {Array.from({ length: Math.min(10, uploadedFile.lines) }).map((_, i) => (
                                  <div key={i}>{i + 1}</div>
                                ))}
                              </div>
                              <div className="flex-1 p-2.5 text-gray-300 overflow-x-auto overflow-y-auto max-h-[220px] leading-[18px] whitespace-pre font-mono scrollbar-thin scrollbar-thumb-zinc-800">
                                {uploadedFile.content.split("\n").slice(0, 10).join("\n")}
                                {uploadedFile.lines > 10 && (
                                  <div className="text-gray-500 italic text-[10px] mt-1.5 border-t border-[#222225] pt-2 flex items-center gap-1 font-sans">
                                    <Info size={11} className="text-blue-400" />
                                    <span>Showing first 10 of {uploadedFile.lines} lines. Choose 'Edit Code' tab to adjust the code block.</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Bottom pipeline action buttons */}
                            <div className="mt-5 flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFile(null);
                                  setCode("");
                                  setFileName("");
                                }}
                                className="px-4 py-2 bg-[#1a1a1c] hover:bg-[#222225] border border-[#2d2d30] rounded text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
                              >
                                Clear File
                              </button>
                              <button
                                type="button"
                                onClick={runAnalysis}
                                disabled={!code.trim()}
                                className={`flex items-center gap-1.5 py-2 px-5 rounded text-xs font-semibold tracking-wide transition-all shadow-md ${
                                  code.trim()
                                    ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-500/10"
                                    : "bg-gray-800 text-gray-500 cursor-not-allowed border border-transparent"
                                }`}
                              >
                                <Play size={12} fill="currentColor" />
                                <span>Analyze File Now</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-5">
                            {/* Featured language quick upload selectors */}
                            <div className="grid grid-cols-2 gap-4">
                              <div 
                                onClick={() => {
                                  // Quick load sample Python file
                                  const pyCode = `def process_user_records(user_ids, db_connection):\n    # Unsafe raw string SQL evaluation\n    for uid in user_ids:\n        query = f"SELECT * FROM accounts WHERE id = '{uid}'"\n        cursor = db_connection.cursor()\n        cursor.execute(query)\n        records = cursor.fetchall()\n        \n        # Performance bottleneck: O(N^2) inner multiplication loop\n        summary = []\n        for r in records:\n            for other in records:\n                score = sum([i for i in range(500)])\n                summary.append({"user": r[1], "score": score})\n    return summary`;
                                  setCode(pyCode);
                                  setFileName("user_analyzer.py");
                                  setLanguage("python");
                                  setUploadedFile({
                                    name: "user_analyzer.py",
                                    size: "0.6 KB",
                                    lines: 14,
                                    extension: "py",
                                    content: pyCode
                                  });
                                }}
                                className="border border-blue-500/10 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/35 rounded-lg p-4 text-center cursor-pointer transition-all duration-300 group relative overflow-hidden"
                              >
                                <div className="absolute top-1.5 right-2 text-[8px] font-bold font-mono bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Python
                                </div>
                                <Flame size={22} className="mx-auto mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                                <h4 className="text-xs font-bold text-gray-200">Load Python Sample (.py)</h4>
                                <p className="text-[10px] text-[#858585] mt-1.5">Load dynamic Python O(N²) loop & raw SQL injection snippet</p>
                              </div>

                              <div 
                                onClick={() => {
                                  // Quick load sample Java file
                                  const javaCode = `public class DatabaseConnector {\n    // Vulnerability: Hardcoded database authentication secret\n    private static final String DB_PASS = "Prod_Root_Secr3t_99!";\n\n    public void fetchTransactionHistory(String txCategory, java.sql.Connection conn) throws Exception {\n        java.sql.Statement statement = conn.createStatement();\n        // Unsafe dynamic statement execution\n        String rawQuery = "SELECT * FROM ledger WHERE category = '" + txCategory + "'";\n        java.sql.ResultSet results = statement.executeQuery(rawQuery);\n        \n        // Performance: Iterative string concatenation inside loop\n        String logText = "Logs:\\n";\n        while (results.next()) {\n            logText += "Transaction ID: " + results.getString("id") + " status: OK\\n";\n        }\n    }\n}`;
                                  setCode(javaCode);
                                  setFileName("DatabaseConnector.java");
                                  setLanguage("java");
                                  setUploadedFile({
                                    name: "DatabaseConnector.java",
                                    size: "0.8 KB",
                                    lines: 15,
                                    extension: "java",
                                    content: javaCode
                                  });
                                }}
                                className="border border-amber-500/10 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/35 rounded-lg p-4 text-center cursor-pointer transition-all duration-300 group relative overflow-hidden"
                              >
                                <div className="absolute top-1.5 right-2 text-[8px] font-bold font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Java
                                </div>
                                <Cpu size={22} className="mx-auto mb-2 text-amber-400 group-hover:scale-110 transition-transform" />
                                <h4 className="text-xs font-bold text-gray-200">Load Java Sample (.java)</h4>
                                <p className="text-[10px] text-[#858585] mt-1.5">Load Java hardcoded credentials & dynamic string concat class</p>
                              </div>
                            </div>

                            {/* Drop Zone Box */}
                            <div
                              onDragEnter={handleDrag}
                              onDragOver={handleDrag}
                              onDragLeave={handleDrag}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
                                dragActive
                                  ? "border-blue-500 bg-blue-500/10 scale-[1.01] shadow-lg shadow-blue-500/5"
                                  : "border-[#2d2d30] hover:border-[#444448] bg-[#121213]"
                              }`}
                            >
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".py,.java,.js,.jsx,.ts,.tsx,.go,.cpp,.cc,.rs"
                              />
                              <div className="w-12 h-12 rounded-full bg-[#1c1c1e] flex items-center justify-center mb-3 border border-[#2c2c2e]">
                                <Upload className="text-blue-400 animate-bounce" size={20} />
                              </div>
                              <h3 className="text-xs font-bold text-gray-200">Drag & Drop Your Code File Here</h3>
                              <p className="text-[11px] text-[#858585] mt-1.5 max-w-sm leading-relaxed">
                                Specifically designed to analyze local <span className="text-blue-400 font-semibold">.py</span> (Python) and <span className="text-amber-400 font-semibold">.java</span> (Java) script configurations.
                              </p>
                              <button
                                type="button"
                                className="mt-4 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded transition-colors"
                              >
                                Browse Files
                              </button>
                            </div>

                            {fileError && (
                              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs flex items-center gap-2">
                                <AlertTriangle size={14} />
                                <span>{fileError}</span>
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-[11px] font-bold text-[#858585] mb-1 font-mono uppercase tracking-wider">File Name</label>
                              <input
                                type="text"
                                placeholder="factorial.js"
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                className="w-full bg-[#151515] border border-[#2d2d2d] rounded py-1.5 px-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[#858585] mb-1 font-mono uppercase tracking-wider">Language Syntax</label>
                              <div className="relative">
                                <select
                                  value={language}
                                  onChange={(e) => setLanguage(e.target.value)}
                                  className="w-full appearance-none bg-[#151515] border border-[#2d2d2d] rounded py-1.5 px-3 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                                >
                                  <option value="javascript">JavaScript</option>
                                  <option value="typescript">TypeScript</option>
                                  <option value="python">Python</option>
                                  <option value="go">Go</option>
                                  <option value="java">Java</option>
                                  <option value="cpp">C++</option>
                                  <option value="rust">Rust</option>
                                  <option value="html">HTML</option>
                                  <option value="css">CSS</option>
                                  <option value="plaintext">Plain Text</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-2 text-[#858585] pointer-events-none" />
                              </div>
                            </div>
                          </div>

                          {/* Snippet Header presets */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-[#858585] font-mono uppercase tracking-wider">Source Code Snippet</span>
                            <div className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => loadPreset("python")}
                                className="text-[9px] bg-[#151515] hover:bg-[#2d2d2d] border border-[#2d2d2d] px-2 py-1 rounded text-[#cccccc] font-mono transition-colors"
                              >
                                Python Bottleneck
                              </button>
                              <button 
                                type="button"
                                onClick={() => loadPreset("react")}
                                className="text-[9px] bg-[#151515] hover:bg-[#2d2d2d] border border-[#2d2d2d] px-2 py-1 rounded text-[#cccccc] font-mono transition-colors"
                              >
                                React Infinite Loop
                              </button>
                              <button 
                                type="button"
                                onClick={() => loadPreset("rust")}
                                className="text-[9px] bg-[#151515] hover:bg-[#2d2d2d] border border-[#2d2d2d] px-2 py-1 rounded text-[#cccccc] font-mono transition-colors"
                              >
                                Rust Max Utility
                              </button>
                            </div>
                          </div>

                          {/* Code container area simulating editor */}
                          <div className="border border-[#2d2d2d] rounded bg-[#121212] overflow-hidden flex font-mono text-[13px] relative mb-4">
                            <div className="bg-[#181818] select-none text-right pr-3 pl-2 py-3 border-r border-[#2d2d2d] text-[#606060] text-[12px] leading-[20px] font-mono">
                              {Array.from({ length: Math.max(12, code.split("\n").length) }).map((_, i) => (
                                <div key={i}>{i + 1}</div>
                              ))}
                            </div>
                            <textarea
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                              spellCheck={false}
                              className="flex-1 bg-[#121212] p-3 text-white placeholder-gray-700 focus:outline-none resize-none min-h-[260px] max-h-[400px] leading-[20px] overflow-y-auto"
                            />
                          </div>

                          {/* Drag Drop section */}
                          <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border border-dashed rounded p-4 text-center cursor-pointer transition-all ${
                              dragActive
                                ? "border-blue-500 bg-blue-500/5"
                                : "border-[#3d3d3d] hover:border-[#5a5a5a] bg-[#151515]"
                            }`}
                          >
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              className="hidden"
                              accept=".js,.jsx,.ts,.tsx,.py,.go,.java,.cpp,.cc,.rs,.html,.css,.txt"
                            />
                            <Upload className="mx-auto mb-1 text-gray-500" size={20} />
                            <p className="text-xs text-gray-300">
                              Drag & drop source code, or <span className="text-blue-400 underline">browse computer</span>
                            </p>
                          </div>

                          {/* Trigger Multi-Agent Pipeline */}
                          <div className="mt-5 flex justify-end">
                            <button
                              type="button"
                              onClick={runAnalysis}
                              disabled={!code.trim()}
                              className={`flex items-center gap-1.5 py-2 px-5 rounded text-xs font-semibold tracking-wide transition-all ${
                                code.trim()
                                  ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                  : "bg-gray-800 text-gray-500 cursor-not-allowed border border-transparent"
                              }`}
                            >
                              <Play size={12} fill="currentColor" />
                              <span>Run Sequential Pipeline</span>
                            </button>
                          </div>
                        </div>
                      )}

                    </div>

                  </div>

                  {/* Right Side Workflow Helper */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded p-5 shadow-2xl">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">
                        Sequential Agent Pipeline
                      </h3>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <div className="w-5 h-5 rounded-full bg-red-950 text-red-400 border border-red-800/40 flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</div>
                          <div>
                            <h4 className="text-xs font-semibold text-white">Agent 1: Bug Hunter</h4>
                            <p className="text-[11px] text-[#858585] mt-0.5">Scans variables, types, and conditions to pinpoint exceptions and security leaks.</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <div className="w-5 h-5 rounded-full bg-amber-950 text-amber-400 border border-amber-800/40 flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</div>
                          <div>
                            <h4 className="text-xs font-semibold text-white">Agent 2: Complexity Optimizer</h4>
                            <p className="text-[11px] text-[#858585] mt-0.5">Calculates time/space Big O limits and offers refactored blocks.</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <div className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40 flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</div>
                          <div>
                            <h4 className="text-xs font-semibold text-white">Agent 3: Doc Generator</h4>
                            <p className="text-[11px] text-[#858585] mt-0.5">Generates clean comments, JSDocs, and input parameter catalogs.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#111112] border border-[#2d2d2d] p-4 rounded text-xs text-[#858585] flex gap-2.5 items-start">
                      <Info className="text-blue-400 flex-shrink-0" size={16} />
                      <div>
                        All API operations run safe from browser eavesdropping on our containerized secure backend proxies. Your private tokens stay clean.
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STATE 2: SEQUENTIAL LOADING TERMINAL */}
            {loadingState !== "idle" && loadingState !== "failed" && (
              <motion.div 
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full flex items-center justify-center p-6 bg-[#0c0c0f]"
              >
                <div className="max-w-md w-full bg-[#1e1e1e] border border-[#2d2d2d] rounded p-5 shadow-2xl font-mono text-xs">
                  
                  {/* Pseudo terminal title bar */}
                  <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-2 mb-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-[9px] text-[#858585] tracking-widest uppercase">Agent Sequence Active</span>
                  </div>

                  <div className="text-center py-3">
                    <div className="relative inline-flex mb-3">
                      <span className="absolute inline-flex h-10 w-10 rounded-full bg-blue-500 opacity-20 animate-ping"></span>
                      <div className="w-10 h-10 rounded-full border border-blue-500/30 border-t-blue-400 border-r-blue-400 animate-spin flex items-center justify-center">
                        <Terminal size={14} className="text-blue-400" />
                      </div>
                    </div>
                    <h3 className="text-xs font-semibold text-white tracking-widest font-mono">EXECUTING GEMINI DEV AGENTS</h3>
                    <p className="text-[10px] text-[#6a6a6a] font-mono mt-0.5">Please wait while tasks execute sequentially</p>
                  </div>

                  {/* Progressive logs list */}
                  <div className="space-y-2 bg-[#0c0c0f] p-3 rounded border border-[#2d2d2d] text-left">
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {loadingState === "bugHunter" ? (
                          <div className="w-3 h-3 rounded-full border border-t-red-400 border-transparent animate-spin flex-shrink-0"></div>
                        ) : (
                          <Check className="text-emerald-400 flex-shrink-0" size={12} />
                        )}
                        <span className={loadingState === "bugHunter" ? "text-red-400 font-semibold" : "text-gray-500"}>
                          Step 1: Agent (Bug Hunter)
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-[#6a6a6a]">
                        {loadingState === "bugHunter" ? "ACTIVE" : "DONE"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {loadingState === "complexity" ? (
                          <div className="w-3 h-3 rounded-full border border-t-amber-400 border-transparent animate-spin flex-shrink-0"></div>
                        ) : loadingState === "bugHunter" ? (
                          <div className="w-3 h-3 rounded-full bg-[#181818] border border-[#2d2d2d] flex items-center justify-center text-[8px] text-gray-600 font-mono">2</div>
                        ) : (
                          <Check className="text-emerald-400 flex-shrink-0" size={12} />
                        )}
                        <span className={
                          loadingState === "complexity" 
                            ? "text-amber-400 font-semibold" 
                            : loadingState === "bugHunter" ? "text-gray-600" : "text-gray-500"
                        }>
                          Step 2: Agent (Complexity Optimizer)
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-[#6a6a6a]">
                        {loadingState === "bugHunter" ? "WAITING" : loadingState === "complexity" ? "ACTIVE" : "DONE"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {loadingState === "doc" ? (
                          <div className="w-3 h-3 rounded-full border border-t-emerald-400 border-transparent animate-spin flex-shrink-0"></div>
                        ) : (loadingState === "bugHunter" || loadingState === "complexity") ? (
                          <div className="w-3 h-3 rounded-full bg-[#181818] border border-[#2d2d2d] flex items-center justify-center text-[8px] text-gray-600 font-mono">3</div>
                        ) : (
                          <Check className="text-emerald-400 flex-shrink-0" size={12} />
                        )}
                        <span className={
                          loadingState === "doc" 
                            ? "text-emerald-400 font-semibold" 
                            : (loadingState === "bugHunter" || loadingState === "complexity") ? "text-gray-600" : "text-gray-500"
                        }>
                          Step 3: Agent (Doc Generator)
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-[#6a6a6a]">
                        {loadingState === "doc" ? "ACTIVE" : "WAITING"}
                      </span>
                    </div>

                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#2d2d2d] flex items-center gap-1 text-[9px] text-[#858585]">
                    <span className="text-blue-400 font-mono">❯</span>
                    <span className="animate-pulse">
                      {loadingState === "bugHunter" && "Scanning memory allocations & security constraints..."}
                      {loadingState === "complexity" && "Deriving logarithmic runtime expressions..."}
                      {loadingState === "doc" && "Drafting beautifully formatted documentation..."}
                    </span>
                  </div>

                </div>
              </motion.div>
            )}

            {/* STATE 3: PIPELINE FAILING SCREEN */}
            {loadingState === "failed" && (
              <motion.div 
                key="failed-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full flex items-center justify-center p-6"
              >
                <div className="max-w-md w-full bg-[#1e1e1e] border border-red-500/30 rounded p-6 shadow-2xl text-center font-mono">
                  <div className="w-10 h-10 bg-red-950/50 text-red-400 border border-red-800/40 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle size={20} />
                  </div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Analysis Pipeline Broken</h3>
                  <p className="text-[11px] text-[#858585] mt-2 leading-relaxed">
                    {errorMessage || "The backend was unable to parse or reach the multi-agent models. Please confirm your API key configuration."}
                  </p>
                  
                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      onClick={runAnalysis}
                      className="w-full bg-red-800 hover:bg-red-700 text-white font-semibold text-xs py-2 px-3 rounded transition-colors cursor-pointer"
                    >
                      Retry Pipeline
                    </button>
                    <button
                      onClick={handleNewAnalysis}
                      className="w-full bg-transparent hover:bg-gray-800 text-[#858585] font-semibold text-xs py-2 px-3 rounded border border-[#2d2d2d] transition-colors cursor-pointer"
                    >
                      Back to Editor
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STATE 4: INTERACTIVE RESULTS DASHBOARD */}
            {activeLog && (
              <motion.div 
                key="workspace-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full flex flex-col lg:flex-row overflow-hidden"
              >
                
                {/* LEFT COLUMN: Input original code with syntax visualization colors */}
                <div className="flex-1 lg:w-1/2 border-b lg:border-b-0 lg:border-r border-[#2d2d2d] bg-[#1e1e1e] flex flex-col overflow-hidden">
                  <div className="h-9 border-b border-[#2d2d2d] bg-[#1a1a1a] flex items-center justify-between px-4 flex-shrink-0">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-[#858585] flex items-center gap-1">
                      <FileText size={12} className="text-blue-400" /> ORIGINAL CODE PREVIEW
                    </span>
                    <button
                      onClick={() => copyToClipboard(activeLog.code, "source")}
                      className="text-[#858585] hover:text-white flex items-center gap-1 text-[10px] transition-colors"
                    >
                      {copiedStates["source"] ? (
                        <>
                          <Check size={11} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Text visualizer container mimicking styled dark syntax */}
                  <div className="flex-1 overflow-auto flex font-mono text-[12px] leading-[20px]">
                    <div className="bg-[#181818] select-none text-right pr-3 pl-2 py-4 border-r border-[#2d2d2d] text-[#606060] text-[11px] leading-[20px] font-mono">
                      {activeLog.code.split("\n").map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    <pre className="flex-1 p-4 overflow-x-auto text-[#9cdcfe] font-mono select-text bg-[#1e1e1e] whitespace-pre-wrap">
                      <code>{activeLog.code}</code>
                    </pre>
                  </div>
                </div>

                {/* RIGHT COLUMN: Sequence Output Tabs */}
                <div className="flex-1 lg:w-1/2 bg-[#0c0c0d] flex flex-col overflow-hidden">
                  
                  {/* Tab bar header */}
                  <div className="flex border-b border-[#2d2d2d] bg-[#1e1e1e] flex-shrink-0">
                    {/* Tab 1: Bug Hunter */}
                    <button
                      onClick={() => setActiveTab("bugs")}
                      className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-1.5 relative transition-all border-r border-[#2d2d2d] cursor-pointer ${
                        activeTab === "bugs" ? "text-white bg-[#0c0c0d] border-t-2 border-t-red-500" : "text-[#858585] hover:text-[#cccccc]"
                      }`}
                    >
                      <ShieldAlert size={13} className={activeTab === "bugs" ? "text-red-400" : "text-[#858585]"} />
                      <span>Bug Hunter</span>
                      {activeLog.bugHunter.bugs.length > 0 && (
                        <span className="bg-red-950 text-red-400 text-[9px] px-1.5 py-0.2 rounded font-bold border border-red-900/30">
                          {activeLog.bugHunter.bugs.length}
                        </span>
                      )}
                    </button>

                    {/* Tab 2: Complexity */}
                    <button
                      onClick={() => setActiveTab("performance")}
                      className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-1.5 relative transition-all border-r border-[#2d2d2d] cursor-pointer ${
                        activeTab === "performance" ? "text-white bg-[#0c0c0d] border-t-2 border-t-amber-500" : "text-[#858585] hover:text-[#cccccc]"
                      }`}
                    >
                      <Cpu size={13} className={activeTab === "performance" ? "text-amber-400" : "text-[#858585]"} />
                      <span>Complexity</span>
                      <span className="bg-[#111115] text-[#cccccc] text-[9px] px-1.5 py-0.2 rounded font-mono border border-[#2d2d2d]">
                        {activeLog.complexity.timeComplexity}
                      </span>
                    </button>

                    {/* Tab 3: Documentation */}
                    <button
                      onClick={() => setActiveTab("docs")}
                      className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-1.5 relative transition-all border-r border-[#2d2d2d] cursor-pointer ${
                        activeTab === "docs" ? "text-white bg-[#0c0c0d] border-t-2 border-t-emerald-500" : "text-[#858585] hover:text-[#cccccc]"
                      }`}
                    >
                      <BookOpen size={13} className={activeTab === "docs" ? "text-emerald-400" : "text-[#858585]"} />
                      <span>Documentation</span>
                    </button>
                  </div>

                  {/* Active tab content block with smooth layout transitions */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <AnimatePresence mode="wait">
                      
                      {/* TAB 1 CONTENT: BUG HUNTER */}
                      {activeTab === "bugs" && (
                        <motion.div
                          key="bugs-tab"
                          initial={{ opacity: 0, x: 5 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -5 }}
                          className="space-y-4"
                        >
                          <div className="bg-[#1a1a1a] p-4 rounded border border-[#2d2d2d]">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Sparkles size={12} className="text-red-400" />
                              Safety & Security Assessment
                            </h3>
                            <MarkdownViewer content={activeLog.bugHunter.overview} />
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">
                              Detected Issues List ({activeLog.bugHunter.bugs.length})
                            </h4>

                            {activeLog.bugHunter.bugs.length === 0 ? (
                              <div className="bg-[#111112] border border-emerald-900/30 p-6 rounded text-center">
                                <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={24} />
                                <p className="text-xs text-white font-semibold">No critical warnings discovered</p>
                                <p className="text-[10px] text-gray-500 mt-1">Excellent job! This code satisfies core safety and runtime validations.</p>
                              </div>
                            ) : (
                              activeLog.bugHunter.bugs.map((bug, index) => {
                                const isCrit = bug.severity === "CRITICAL" || bug.severity === "HIGH";
                                return (
                                  <div 
                                    key={index} 
                                    className={`bg-[#1a1a1a] rounded border transition-colors ${
                                      isCrit ? "border-red-500/30 hover:border-red-500/50" : "border-yellow-500/20 hover:border-yellow-500/45"
                                    }`}
                                  >
                                    {/* Bug Header */}
                                    <div className="px-3.5 py-2 border-b border-[#2d2d2d] flex items-center justify-between bg-[#1f1f1f]">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                          isCrit ? "bg-red-950 text-red-400 border border-red-900/30" : "bg-yellow-950 text-yellow-400 border border-yellow-900/30"
                                        }`}>
                                          {bug.severity}
                                        </span>
                                        <span className="text-[9px] font-semibold text-[#858585] uppercase font-mono bg-[#111115] px-1.5 py-0.2 rounded border border-[#2d2d2d]">
                                          {bug.category}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-bold text-white font-mono">#{index + 1}</span>
                                    </div>

                                    {/* Bug Body */}
                                    <div className="p-4 space-y-2.5 text-xs text-[#cccccc]">
                                      <h4 className="font-bold text-white text-xs">{bug.title}</h4>
                                      <p className="leading-relaxed text-[#858585]">{bug.description}</p>

                                      {bug.snippet && (
                                        <div className="space-y-1">
                                          <span className="text-[9px] text-[#606060] font-mono block">VIOLATION POINT</span>
                                          <pre className="bg-[#111115] border border-[#2d2d2d] rounded p-2.5 overflow-x-auto text-red-300 font-mono text-[11px]">
                                            <code>{bug.snippet}</code>
                                          </pre>
                                        </div>
                                      )}

                                      <div className="space-y-1">
                                        <span className="text-[9px] text-[#606060] font-mono block">RECOMMENDED REMEDIATION</span>
                                        <pre className="bg-[#111115] border border-[#2d2d2d] rounded p-2.5 overflow-x-auto text-emerald-300 font-mono text-[11px]">
                                          <code>{bug.fix}</code>
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* TAB 2 CONTENT: COMPLEXITY & OPTIMIZATIONS */}
                      {activeTab === "performance" && (
                        <motion.div
                          key="perf-tab"
                          initial={{ opacity: 0, x: 5 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -5 }}
                          className="space-y-4"
                        >
                          {/* Big O Indicators Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#1a1a1a] p-3 rounded border border-[#2d2d2d] text-center">
                              <span className="text-[9px] font-bold font-mono text-[#858585] uppercase tracking-wider block">Time Complexity</span>
                              <span className="text-xl font-mono text-white font-bold tracking-tight block mt-1">{activeLog.complexity.timeComplexity}</span>
                            </div>
                            <div className="bg-[#1a1a1a] p-3 rounded border border-[#2d2d2d] text-center">
                              <span className="text-[9px] font-bold font-mono text-[#858585] uppercase tracking-wider block">Space Complexity</span>
                              <span className="text-xl font-mono text-white font-bold tracking-tight block mt-1">{activeLog.complexity.spaceComplexity}</span>
                            </div>
                          </div>

                          <div className="bg-[#1a1a1a] p-4 rounded border border-[#2d2d2d]">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Sparkles size={12} className="text-amber-400" />
                              Algorithmic Bottlenecks Analysis
                            </h3>
                            <MarkdownViewer content={activeLog.complexity.complexityExplanation} />
                          </div>

                          {/* Suggested Optimization lists */}
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">
                              Optimizations Suggestions ({activeLog.complexity.optimizations.length})
                            </h4>

                            {activeLog.complexity.optimizations.map((item, index) => (
                              <div key={index} className="bg-[#1a1a1a] border border-[#2d2d2d] rounded overflow-hidden">
                                <div className="px-3 py-2 border-b border-[#2d2d2d] bg-[#1f1f1f] flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-white truncate max-w-[220px]">{item.description}</h4>
                                  <div className="flex gap-1.5 font-mono text-[9px]">
                                    <span className="bg-amber-950 text-amber-400 border border-amber-900/40 px-1 rounded">Time: {item.potentialTime}</span>
                                    <span className="bg-[#151515] text-[#858585] border border-[#2d2d2d] px-1 rounded">Space: {item.potentialSpace}</span>
                                  </div>
                                </div>

                                <div className="p-4 space-y-3 text-xs text-[#cccccc]">
                                  <p className="leading-relaxed text-[#858585]">{item.explanation}</p>

                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] text-[#606060] font-mono">OPTIMIZED CODE PAYLOAD</span>
                                      <button
                                        onClick={() => copyToClipboard(item.optimizedCode, `opt-${index}`)}
                                        className="text-gray-500 hover:text-white text-[9px] flex items-center gap-0.5 font-mono"
                                      >
                                        {copiedStates[`opt-${index}`] ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                                        <span>{copiedStates[`opt-${index}`] ? "Copied" : "Copy"}</span>
                                      </button>
                                    </div>
                                    <pre className="bg-[#111115] border border-[#2d2d2d] rounded p-2.5 overflow-x-auto text-[#e5c07b] font-mono text-[11px]">
                                      <code>{item.optimizedCode}</code>
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* TAB 3 CONTENT: GENERATED DOCUMENTATION */}
                      {activeTab === "docs" && (
                        <motion.div
                          key="docs-tab"
                          initial={{ opacity: 0, x: 5 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -5 }}
                          className="space-y-4"
                        >
                          <div className="bg-[#1a1a1a] p-4 rounded border border-[#2d2d2d]">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Sparkles size={12} className="text-emerald-400" />
                              Module Overview & JSDoc Catalog
                            </h3>
                            <MarkdownViewer content={activeLog.doc.overview} />
                          </div>

                          {/* Annotated Complete Code Block */}
                          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded overflow-hidden">
                            <div className="px-3 py-2 border-b border-[#2d2d2d] bg-[#1f1f1f] flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold tracking-wider text-[#858585]">ANNOTATED DEVELOPMENT CODE</span>
                              <button
                                onClick={() => copyToClipboard(activeLog.doc.documentedCode, "annotated")}
                                className="text-gray-500 hover:text-white flex items-center gap-1 text-[10px] transition-colors"
                              >
                                {copiedStates["annotated"] ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                <span>{copiedStates["annotated"] ? "Copied" : "Copy to Clipboard"}</span>
                              </button>
                            </div>
                            <pre className="p-4 overflow-x-auto text-emerald-400 font-mono text-[11px] bg-[#111115] leading-relaxed max-h-[300px]">
                              <code>{activeLog.doc.documentedCode}</code>
                            </pre>
                          </div>

                          {/* Components lists */}
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">
                              Functions & Component Catalog ({activeLog.doc.components.length})
                            </h4>

                            {activeLog.doc.components.map((item, index) => (
                              <div key={index} className="bg-[#1a1a1a] border border-[#2d2d2d] p-3.5 rounded text-xs space-y-2">
                                <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-1.5 mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-white font-bold">{item.name}</span>
                                    <span className="text-[9px] uppercase font-semibold text-[#858585] bg-[#111115] px-1 rounded border border-[#2d2d2d]">
                                      {item.type}
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1 text-[#858585]">
                                  {item.params && (
                                    <div className="grid grid-cols-6 gap-1">
                                      <span className="col-span-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 font-mono">Params</span>
                                      <span className="col-span-5 font-mono text-gray-300 text-[11px]">{item.params}</span>
                                    </div>
                                  )}
                                  {item.returns && (
                                    <div className="grid grid-cols-6 gap-1">
                                      <span className="col-span-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 font-mono">Returns</span>
                                      <span className="col-span-5 font-mono text-emerald-300 text-[11px]">{item.returns}</span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-6 gap-1 pt-1">
                                    <span className="col-span-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 font-mono">Purpose</span>
                                    <span className="col-span-5 leading-relaxed text-[#cccccc]">{item.description}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </div>

                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* BOTTOM STATUS BAR (VS Code Blue) */}
        <footer className="h-6 bg-[#007acc] text-white flex items-center px-3 justify-between text-[11px] select-none flex-shrink-0 z-20 font-mono">
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-1">
              <Terminal size={11} fill="currentColor" />
              <span>Main Agent: Gemini-2.5-Flash</span>
            </div>
            <div className="hidden sm:inline">CPU Status: Active (12%)</div>
            <div className="hidden sm:inline">Secure Sandbox: Ready</div>
          </div>
          <div className="flex items-center space-x-3 text-white/90">
            <div>Spaces: 2</div>
            <div>UTF-8</div>
            <div className="bg-white/20 px-1.5 py-0.2 rounded hover:bg-white/30 cursor-pointer transition-colors" title="Tab Shortcuts">
              Shortcuts: Alt + 1-3
            </div>
          </div>
        </footer>

      </div>

    </div>
  );
}
