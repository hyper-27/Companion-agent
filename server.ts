import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initializer for Gemini client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Helper to call Gemini API with exponential backoff on retryable errors (503, 429).
 */
async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelayMs = 1000,
  backoffFactor = 2
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      
      const errorMessage = error?.message || String(error);
      const status = error?.status || error?.statusCode || error?.status_code;
      
      const isRateLimit = status === 429 || errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.toLowerCase().includes("too many requests");
      const isUnavailable = status === 503 || errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE") || errorMessage.toLowerCase().includes("service unavailable");
      
      const isRetryable = isRateLimit || isUnavailable;
      
      if (isRetryable && attempt <= retries) {
        const currentDelay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
        console.warn(`[Dev Companion] Gemini API returned retryable error (${status || "unknown"}). Attempt ${attempt}/${retries}. Retrying in ${currentDelay}ms... Error: ${errorMessage}`);
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
      } else {
        console.error(`[Dev Companion] Gemini API failed on attempt ${attempt}. Error is not retryable or max retries reached. Error:`, error);
        throw error;
      }
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser with 10MB limit to handle larger code uploads
  app.use(express.json({ limit: "10mb" }));

  // REST API for multi-agent code analysis
  app.post("/api/analyze", async (req, res) => {
    const { code, fileName = "source_code", language = "plaintext" } = req.body;

    if (!code || typeof code !== "string" || code.trim() === "") {
      res.status(400).json({ error: "Code content is required." });
      return;
    }

    try {
      const ai = getGenAI();
      const modelName = "gemini-2.5-flash";

      console.log(`[Dev Companion] Starting sequential multi-agent analysis for file: ${fileName} (${language})`);

      // --- AGENT 1: Bug Hunter ---
      console.log("[Dev Companion] Running Agent 1: Bug Hunter...");
      const bugHunterResponse = await callGeminiWithRetry(() => ai.models.generateContent({
        model: modelName,
        contents: `Analyze the following source code for bugs, edge cases, safety issues, and security vulnerabilities:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        config: {
          systemInstruction: "You are Bug Hunter, an elite code auditor. Your mission is to perform a meticulous audit of the provided code. Identify logic bugs, runtime errors, edge cases, and security vulnerabilities. Be precise, highly technical, and constructive. Any security vulnerabilities identified MUST be formatted and categorized explicitly using standard OWASP Top 10 terminology (such as A01:2021-Broken Access Control, A02:2021-Cryptographic Failures, etc.). Return a comprehensive overview and a structured list of bugs.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overview: {
                type: Type.STRING,
                description: "Executive summary of the safety, security, and correctness of the code. Formatted in clear markdown. Ensure any security concerns reference the appropriate OWASP Top 10 category."
              },
              bugs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: { type: Type.STRING, description: "Severity of the issue: CRITICAL, HIGH, MEDIUM, or LOW" },
                    category: { type: Type.STRING, description: "Category: Security (with OWASP Top 10 category name, e.g., 'Security (OWASP A03:2021-Injection)'), Logic, Runtime, Edge Case, or Style" },
                    title: { type: Type.STRING, description: "Short descriptive title of the bug. For security issues, prefix the title with the relevant OWASP Top 10 code (e.g., '[OWASP A03:2021] SQL Injection')." },
                    description: { type: Type.STRING, description: "Detailed explanation of the issue, why it happens, and how it maps to OWASP Top 10 terminology if it is a security vulnerability." },
                    snippet: { type: Type.STRING, description: "The specific line or block of code with the problem" },
                    fix: { type: Type.STRING, description: "Clear instructions and code showing how to fix the issue." }
                  },
                  required: ["severity", "category", "title", "description", "fix"]
                }
              }
            },
            required: ["overview", "bugs"]
          }
        }
      }));

      const bugHunterData = JSON.parse(bugHunterResponse.text || "{}");

      // --- AGENT 2: Complexity Optimizer ---
      console.log("[Dev Companion] Running Agent 2: Complexity Optimizer...");
      const complexityOptimizerResponse = await callGeminiWithRetry(() => ai.models.generateContent({
        model: modelName,
        contents: `Analyze the time and space complexity of the following code and suggest performance optimizations:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        config: {
          systemInstruction: "You are Complexity Optimizer, an algorithms and system performance specialist. Analyze the current asymptotic complexities (Big O notation) of the code. Identify performance bottlenecks such as redundant loops, unnecessary memory allocations, or poor collection choices. Propose efficient algorithmic upgrades with performance estimations and optimized code snippets. You MUST always include a structured Markdown table summarizing the calculated Big O time complexity before and after optimization at the very beginning of your complexityExplanation.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              timeComplexity: { type: Type.STRING, description: "Current overall time complexity (e.g., O(N^2), O(N log N))" },
              spaceComplexity: { type: Type.STRING, description: "Current overall space complexity (e.g., O(1), O(N))" },
              complexityExplanation: {
                type: Type.STRING,
                description: "Detailed step-by-step analysis explaining the reasoning for the current time and space complexity. This MUST start with a beautifully structured Markdown table showing the calculated Big O time complexity BEFORE and AFTER optimization (columns: Function/Operation, Original Time Complexity, Optimized Time Complexity, Improvement Details)."
              },
              optimizations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING, description: "Short summary of the optimization opportunity" },
                    potentialTime: { type: Type.STRING, description: "The new time complexity if optimized (e.g., O(N))" },
                    potentialSpace: { type: Type.STRING, description: "The new space complexity if optimized (e.g., O(1))" },
                    explanation: { type: Type.STRING, description: "Detailed explanation of the algorithmic change and why it is faster or more memory efficient." },
                    optimizedCode: { type: Type.STRING, description: "The optimized block of code or full function rewrite." }
                  },
                  required: ["description", "potentialTime", "potentialSpace", "explanation", "optimizedCode"]
                }
              }
            },
            required: ["timeComplexity", "spaceComplexity", "complexityExplanation", "optimizations"]
          }
        }
      }));

      const complexityData = JSON.parse(complexityOptimizerResponse.text || "{}");

      // --- AGENT 3: Doc Generator ---
      console.log("[Dev Companion] Running Agent 3: Doc Generator...");
      const docGeneratorResponse = await callGeminiWithRetry(() => ai.models.generateContent({
        model: modelName,
        contents: `Add comments and document the following code completely. Ensure JSDoc/Docstrings are used where appropriate:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        config: {
          systemInstruction: "You are Doc Generator, a world-class technical writer. Your task is to produce perfect developer documentation. Generate a fully annotated version of the input code containing JSDoc/Docstrings, helpful type annotations, inline descriptions of tricky steps, and clear variable descriptions. Also, catalog each main functional component (methods, functions, classes).",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overview: { type: Type.STRING, description: "High-level summary of what this code file achieves and how to use it." },
              documentedCode: { type: Type.STRING, description: "The entire source code, beautifully formatted and enhanced with comprehensive documentation comments (JSDoc, docstrings, or appropriate language standard)." },
              components: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Name of the function, class, or module" },
                    type: { type: Type.STRING, description: "Type: Function, Class, Method, interface, or Variable" },
                    params: { type: Type.STRING, description: "Parameters/Inputs description" },
                    returns: { type: Type.STRING, description: "Return value / Outputs description" },
                    description: { type: Type.STRING, description: "Clear explanation of its responsibility and side effects." }
                  },
                  required: ["name", "type", "description"]
                }
              }
            },
            required: ["overview", "documentedCode", "components"]
          }
        }
      }));

      const docData = JSON.parse(docGeneratorResponse.text || "{}");

      console.log("[Dev Companion] All three agents finished successfully!");

      // Aggregate into a single unified JSON structure
      const aggregatedResult = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        fileName,
        language,
        code,
        bugHunter: bugHunterData,
        complexity: complexityData,
        doc: docData,
      };

      res.json(aggregatedResult);
    } catch (error: any) {
      console.error("[Dev Companion] Analysis Error:", error);
      res.status(500).json({
        error: "An error occurred during multi-agent analysis.",
        message: error.message || String(error),
      });
    }
  });

  // Serve frontend build static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Dev Companion] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Dev Companion] Failed to start server:", err);
});
